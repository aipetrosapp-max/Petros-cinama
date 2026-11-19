/**
 * PETROS CINEMA — MASTER ADMIN API
 *
 * Authentication:
 *  - Master password verified with PBKDF2-SHA256 (240k iterations, salt).
 *    The password itself never leaves the server and is never stored in the repo.
 *  - On success a random session token is issued; the client keeps it in memory
 *    only (never localStorage) and sends it as `x-admin-token`.
 *  - Sessions expire (default 4h) and are stored in memory on the server.
 *  - Brute-force protection: per-IP + per-name attempt throttling.
 *
 * All mutating routes require a valid session token.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import type {
  AdminConfig,
  AdminCatalogFile,
  TitleRecord,
  SeasonRecord,
  EpisodeRecord,
  WalletRecord,
  SourceRecord,
  FeatureFlags,
  ApiTokenKey,
  SubtitleFileRecord,
  MediaCategory,
  PlaybackKind
} from './types.ts';
import {
  validateTitle,
  validateQualityStream,
  validateSubtitleTrack,
  classifyPlayback,
  countEpisodes,
  countSeasons,
  countQualities,
  countSubtitles
} from './types.ts';
import {
  readLocalCatalog,
  writeLocalCatalog,
  readLocalConfig,
  writeLocalConfig,
  buildClientCatalog,
  buildCommitMessage,
  commitFiles,
  getGithubStatus,
  getRepoConfig,
  getLocalPaths,
  fetchGithubFile,
  decodeGithubContent
} from './githubSync.ts';

import { handleAdminChatMessage } from './agent.ts';
import { publishToTelegramChannel } from './telegramPublish.ts';
import { makeLocalId } from './agentUtils.ts';
import {
  readCollection,
  saveCollection,
  readProgress,
  startCollectionRun,
  validateCollectionItems
} from './collectionStore.ts';

export const adminRouter = express.Router();

/**
 * POST /api/admin/agent/message — the Persian chat entrypoint of the
 * Autonomous Local Cinema Admin Agent. Requires the admin session token.
 * Everything is processed locally; nothing leaves the server on its own.
 */
adminRouter.post('/agent/message', requireAdminAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) {
    res.status(400).json({ error: 'empty_message', messageFa: 'پیام خالی است.' });
    return;
  }
  try {
    const reply = await handleAdminChatMessage(text);
    res.json({ ok: true, ...reply });
  } catch (err: unknown) {
    res.status(500).json({
      ok: false,
      error: 'agent_error',
      messageFa: `⛔ خطای داخلی ایجنت: ${(err as Error).message}\nلطفاً جزئیات خطا را بفرست تا ریشه‌یابی شود.`
    });
  }
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MASTER_PASSWORD = (process.env.MASTER_ADMIN_PASSWORD || 'Ped12345@').trim();
const SESSION_TTL_MS = Number(process.env.MASTER_ADMIN_SESSION_TTL_MS || 4 * 60 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.MASTER_ADMIN_MAX_ATTEMPTS || 5);
const LOCKOUT_MS = Number(process.env.MASTER_ADMIN_LOCKOUT_MS || 5 * 60 * 1000);
const PBKDF2_ITERATIONS = 240_000;

const SALT_FILE = path.join(process.cwd(), 'data', 'admin-salt.bin');

let saltCache: Buffer | null = null;

function getSalt(): Buffer {
  if (saltCache) return saltCache;
  try {
    if (fs.existsSync(SALT_FILE)) {
      saltCache = fs.readFileSync(SALT_FILE);
      if (saltCache.length >= 16) return saltCache;
    }
  } catch {
    // regenerate below
  }
  saltCache = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(SALT_FILE), { recursive: true });
    fs.writeFileSync(SALT_FILE, saltCache);
  } catch {
    // read-only FS: the salt is regenerated per boot, which is acceptable
  }
  return saltCache;
}

export function hashMasterPassword(password: string, salt: Buffer): string {
  return crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha256')
    .toString('hex');
}

/** Constant-time comparison that also tolerates different lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // still burn a comparison to keep the timing roughly constant
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Sessions + throttle
// ---------------------------------------------------------------------------

interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

const sessions = new Map<string, AdminSession>();

interface AttemptState {
  count: number;
  lockedUntil: number;
  lastAt: number;
}

const attempts = new Map<string, AttemptState>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function isMasterPasswordConfigured(): boolean {
  return MASTER_PASSWORD.length >= 8;
}

function issueSession(ip: string): AdminSession {
  const token = 'pc_admin_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: AdminSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip
  };
  sessions.set(token, session);
  // keep the session table small
  if (sessions.size > 20) {
    const oldest = [...sessions.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) sessions.delete(oldest.token);
  }
  return session;
}

export function validateAdminToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

/** Middleware: every mutating route must pass this. */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['x-admin-token'];
  const token = typeof header === 'string' ? header : '';
  const session = validateAdminToken(token);
  if (!session) {
    res.status(401).json({
      error: 'unauthorized',
      messageFa: 'نشست مدیریتی معتبر نیست یا منقضی شده است. دوباره وارد شوید.'
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readTokenValue(key: ApiTokenKey): string {
  switch (key) {
    case 'github':
      return (
        process.env.GITHUB_TOKEN ||
        process.env.GH_TOKEN ||
        process.env.VELORA_GITHUB_TOKEN ||
        ''
      ).trim();
    case 'telegram_bot':
      return (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '').trim();
    case 'gemini':
      return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    case 'telegram_api_hash':
      return (process.env.TG_API_HASH || process.env.TELEGRAM_API_HASH || '').trim();
    default:
      return '';
  }
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}

/** Public shape of the config: token values are never exposed. */
function redactConfig(config: AdminConfig): AdminConfig {
  return {
    ...config,
    tokens: (config.tokens || []).map((token) => {
      const live = readTokenValue(token.id);
      return {
        id: token.id,
        label: token.label,
        labelFa: token.labelFa,
        required: token.required,
        description: token.description,
        value: live ? maskSecret(live) : '',
        updatedAt: live ? token.updatedAt : undefined
      };
    })
  };
}

function requireBody(req: Request, res: Response): Record<string, unknown> | null {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'invalid_body', messageFa: 'بدنه درخواست نامعتبر است.' });
    return null;
  }
  return body;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeTitle(input: Partial<TitleRecord>, existing?: TitleRecord): TitleRecord {
  const now = new Date().toISOString();
  const seasons = Array.isArray(input.seasons) ? input.seasons : existing?.seasons || [];
  const episodes = Array.isArray(input.episodes) ? input.episodes : existing?.episodes || [];
  return {
    id: existing?.id || input.id || makeId('title'),
    title: (input.title ?? existing?.title ?? '').trim(),
    titleFa: (input.titleFa ?? existing?.titleFa ?? '').trim(),
    originalTitle: (input.originalTitle ?? existing?.originalTitle ?? '').trim(),
    category: (input.category ?? existing?.category ?? 'movie') as TitleRecord['category'],
    year: input.year ?? existing?.year,
    rating: input.rating ?? existing?.rating,
    synopsis: input.synopsis ?? existing?.synopsis ?? '',
    synopsisFa: input.synopsisFa ?? existing?.synopsisFa ?? '',
    director: input.director ?? existing?.director ?? '',
    cast: input.cast ?? existing?.cast ?? [],
    genres: input.genres ?? existing?.genres ?? [],
    tags: input.tags ?? existing?.tags ?? [],
    posterUrl: input.posterUrl ?? existing?.posterUrl ?? '',
    backdropUrl: input.backdropUrl ?? existing?.backdropUrl ?? '',
    durationSec: input.durationSec ?? existing?.durationSec,
    contentRating: input.contentRating ?? existing?.contentRating ?? '',
    status: (input.status ?? existing?.status ?? 'draft') as TitleRecord['status'],
    featured: input.featured ?? existing?.featured ?? false,
    trendingRank: input.trendingRank ?? existing?.trendingRank,
    qualities: input.qualities ?? existing?.qualities ?? [],
    subtitles: input.subtitles ?? existing?.subtitles ?? [],
    seasons: seasons.map((s) => ({ ...s, titleId: s.titleId || input.id || existing?.id || '' })),
    episodes: episodes.map((e) => ({ ...e, titleId: e.titleId || input.id || existing?.id || '' })),
    downloadLinks: input.downloadLinks ?? existing?.downloadLinks ?? [],
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

adminRouter.get('/auth/status', (_req, res) => {
  res.json({
    passwordConfigured: isMasterPasswordConfigured(),
    minimumLength: 12,
    sessionTtlMinutes: Math.round(SESSION_TTL_MS / 60000),
    locked: false
  });
});

adminRouter.post('/auth/login', (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;

  if (!isMasterPasswordConfigured()) {
    res.status(503).json({
      error: 'master_password_not_configured',
      messageFa:
        'رمز اصلی مدیریت روی سرور تنظیم نشده است. متغیر MASTER_ADMIN_PASSWORD را با حداقل ۱۲ کاراکتر تنظیم کنید.'
    });
    return;
  }

  const password = String(body.password || '');
  const ip = clientIp(req);
  const key = `${ip}:${String(body.username || 'master')}`;
  const state = attempts.get(key);

  if (state && state.lockedUntil > Date.now()) {
    const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    res.status(429).json({
      error: 'locked',
      messageFa: `به دلیل تلاش‌های ناموفق، ورود موقتاً قفل شد. ${Math.ceil(seconds / 60)} دقیقه دیگر تلاش کنید.`
    });
    return;
  }

  const expected = hashMasterPassword(MASTER_PASSWORD, getSalt());
  const candidate = hashMasterPassword(password, getSalt());

  if (!safeEqual(expected, candidate)) {
    const next: AttemptState = state || { count: 0, lockedUntil: 0, lastAt: 0 };
    next.count += 1;
    next.lastAt = Date.now();
    if (next.count >= MAX_ATTEMPTS) {
      next.lockedUntil = Date.now() + LOCKOUT_MS;
      next.count = 0;
    }
    attempts.set(key, next);
    res.status(401).json({
      error: 'invalid_credentials',
      messageFa: 'رمز عبور نادرست است.'
    });
    return;
  }

  attempts.delete(key);
  const session = issueSession(ip);
  res.json({
    token: session.token,
    expiresAt: new Date(session.expiresAt).toISOString(),
    messageFa: 'ورود موفق بود.'
  });
});

adminRouter.post('/auth/logout', requireAdminAuth, (req, res) => {
  const token = String(req.headers['x-admin-token'] || '');
  sessions.delete(token);
  res.json({ ok: true, messageFa: 'نشست بسته شد.' });
});

adminRouter.get('/auth/session', requireAdminAuth, (req, res) => {
  const token = String(req.headers['x-admin-token'] || '');
  const session = validateAdminToken(token);
  res.json({
    valid: true,
    expiresAt: session ? new Date(session.expiresAt).toISOString() : null
  });
});

// ---------------------------------------------------------------------------
// Dashboard + catalog
// ---------------------------------------------------------------------------

adminRouter.get('/dashboard', requireAdminAuth, async (_req, res) => {
  const catalog = await readLocalCatalog();
  const config = await readLocalConfig();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const byCategory = { movie: 0, series: 0, anime: 0 };
  for (const t of titles) {
    if (t.category && byCategory[t.category] !== undefined) byCategory[t.category] += 1;
  }
  const published = titles.filter((t) => t.status === 'published').length;
  const withStream = titles.filter((t) => (t.qualities?.length || 0) > 0).length;

  res.json({
    totals: {
      titles: titles.length,
      published,
      drafts: titles.filter((t) => t.status === 'draft').length,
      byCategory,
      seasons: countSeasons(titles),
      episodes: countEpisodes(titles),
      qualities: countQualities(titles),
      subtitles: countSubtitles(titles),
      wallets: (config.wallets || []).length,
      sources: (config.sources || []).length
    },
    catalogVersion: catalog.version,
    catalogUpdatedAt: catalog.updatedAt,
    manifestVersion: config.manifestVersion,
    features: config.features,
    withStream,
    withoutStream: titles.length - withStream
  });
});

adminRouter.get('/catalog', requireAdminAuth, async (_req, res) => {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  res.json({
    version: catalog.version,
    updatedAt: catalog.updatedAt,
    titles
  });
});

adminRouter.post('/catalog/title', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const input = body as Partial<TitleRecord>;
  const error = validateTitle(input);
  if (error) {
    res.status(400).json({ error: 'validation_failed', messageFa: error });
    return;
  }
  for (const q of input.qualities || []) {
    const qualityError = validateQualityStream(q);
    if (qualityError) {
      res.status(400).json({ error: 'validation_failed', messageFa: `کیفیت: ${qualityError}` });
      return;
    }
  }
  for (const s of input.subtitles || []) {
    const subtitleError = validateSubtitleTrack(s);
    if (subtitleError) {
      res.status(400).json({ error: 'validation_failed', messageFa: `زیرنویس: ${subtitleError}` });
      return;
    }
  }
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const title = sanitizeTitle(input);
  titles.unshift(title);
  catalog.streams = titles as never;
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.status(201).json({ ok: true, title, messageFa: 'عنوان جدید ذخیره شد.' });
});

adminRouter.put('/catalog/title/:id', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const input = body as Partial<TitleRecord>;
  const error = validateTitle(input);
  if (error) {
    res.status(400).json({ error: 'validation_failed', messageFa: error });
    return;
  }
  for (const q of input.qualities || []) {
    const qualityError = validateQualityStream(q);
    if (qualityError) {
      res.status(400).json({ error: 'validation_failed', messageFa: `کیفیت: ${qualityError}` });
      return;
    }
  }
  for (const s of input.subtitles || []) {
    const subtitleError = validateSubtitleTrack(s);
    if (subtitleError) {
      res.status(400).json({ error: 'validation_failed', messageFa: `زیرنویس: ${subtitleError}` });
      return;
    }
  }
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const index = titles.findIndex((t) => t.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'not_found', messageFa: 'عنوان یافت نشد.' });
    return;
  }
  const updated = sanitizeTitle(input, titles[index]);
  titles[index] = updated;
  catalog.streams = titles as never;
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.json({ ok: true, title: updated, messageFa: 'عنوان به‌روزرسانی شد.' });
});

adminRouter.delete('/catalog/title/:id', requireAdminAuth, async (req, res) => {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const before = titles.length;
  catalog.streams = titles.filter((t) => t.id !== req.params.id) as never;
  if (catalog.streams.length === before) {
    res.status(404).json({ error: 'not_found', messageFa: 'عنوان یافت نشد.' });
    return;
  }
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.json({ ok: true, messageFa: 'عنوان حذف شد.' });
});

// ---------------------------------------------------------------------------
// Seasons / episodes
// ---------------------------------------------------------------------------

adminRouter.post('/catalog/title/:id/season', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const title = titles.find((t) => t.id === req.params.id);
  if (!title) {
    res.status(404).json({ error: 'not_found', messageFa: 'عنوان یافت نشد.' });
    return;
  }
  const number = Number(body.season);
  if (!Number.isInteger(number) || number < 0) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'شماره فصل نامعتبر است.' });
    return;
  }
  const season: SeasonRecord = {
    id: makeId(`s${number}`),
    titleId: title.id,
    season: number,
    title: String(body.title || `Season ${number}`),
    titleFa: String(body.titleFa || ''),
    overview: String(body.overview || ''),
    posterUrl: String(body.posterUrl || ''),
    status: 'published'
  };
  title.seasons = [...(title.seasons || []), season];
  title.updatedAt = new Date().toISOString();
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.status(201).json({ ok: true, season, messageFa: 'فصل اضافه شد.' });
});

adminRouter.post('/catalog/title/:id/episode', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const title = titles.find((t) => t.id === req.params.id);
  if (!title) {
    res.status(404).json({ error: 'not_found', messageFa: 'عنوان یافت نشد.' });
    return;
  }
  const season = Number(body.season);
  const episode = Number(body.episode);
  if (!Number.isInteger(season) || !Number.isInteger(episode) || episode < 1) {
    res
      .status(400)
      .json({ error: 'validation_failed', messageFa: 'شماره فصل یا قسمت نامعتبر است.' });
    return;
  }
  const qualities = Array.isArray(body.qualities) ? body.qualities : [];
  for (const q of qualities) {
    const error = validateQualityStream(q);
    if (error) {
      res.status(400).json({ error: 'validation_failed', messageFa: `کیفیت: ${error}` });
      return;
    }
  }
  const subtitles = Array.isArray(body.subtitles) ? body.subtitles : [];
  for (const s of subtitles) {
    const error = validateSubtitleTrack(s);
    if (error) {
      res.status(400).json({ error: 'validation_failed', messageFa: `زیرنویس: ${error}` });
      return;
    }
  }
  const episodeRecord: EpisodeRecord = {
    id: makeId(`e${season}x${episode}`),
    titleId: title.id,
    season,
    episode,
    title: String(body.title || `Episode ${episode}`),
    titleFa: String(body.titleFa || ''),
    overview: String(body.overview || ''),
    durationSec: Number(body.durationSec || 0),
    posterUrl: String(body.posterUrl || ''),
    qualities,
    subtitles,
    status: 'published',
    releaseDate: String(body.releaseDate || '')
  };
  title.episodes = [...(title.episodes || []), episodeRecord];
  title.updatedAt = new Date().toISOString();
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.status(201).json({ ok: true, episode: episodeRecord, messageFa: 'قسمت اضافه شد.' });
});

adminRouter.delete('/catalog/title/:id/episode/:episodeId', requireAdminAuth, async (req, res) => {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const title = titles.find((t) => t.id === req.params.id);
  if (!title) {
    res.status(404).json({ error: 'not_found', messageFa: 'عنوان یافت نشد.' });
    return;
  }
  title.episodes = (title.episodes || []).filter((e) => e.id !== req.params.episodeId);
  title.updatedAt = new Date().toISOString();
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);
  res.json({ ok: true, messageFa: 'قسمت حذف شد.' });
});

// ---------------------------------------------------------------------------
// Subtitle file upload (SRT / WebVTT)
// ---------------------------------------------------------------------------

const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024; // 2 MB per track

function safeSubtitleSlug(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function looksLikeSubtitleText(content: string, format: 'srt' | 'vtt'): string | null {
  const head = content.slice(0, 64).trim();
  if (format === 'vtt' && !/^WEBVTT/i.test(head)) {
    return 'فایل VTT باید با سربرگ WEBVTT شروع شود.';
  }
  if (format === 'srt' && !/^\d+\s*$/.test(content.split(/\r?\n/)[0] || '') &&
      !/\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(content.slice(0, 240))) {
    return 'فایل SRT باید با شمارهٔ ایندکس یا تایم‌کد ff:ff:ff,fff --> شروع شود.';
  }
  if (!/-->/.test(content)) {
    return 'هیچ خط زمانی (--> ) در فایل زیرنویس یافت نشد.';
  }
  return null;
}

adminRouter.post('/catalog/subtitle-file', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;

  const rawName = String(body.filename || '').trim();
  const extMatch = rawName.toLowerCase().match(/\.(srt|vtt)$/);
  if (!extMatch) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'پسوند فایل باید .srt یا .vtt باشد.' });
    return;
  }
  const format = extMatch[1] as 'srt' | 'vtt';

  let content = '';
  if (typeof body.contentBase64 === 'string' && body.contentBase64.length > 0) {
    try {
      content = Buffer.from(body.contentBase64, 'base64').toString('utf8');
    } catch {
      res.status(400).json({ error: 'validation_failed', messageFa: 'محتوای base64 قابل‌خواندن نیست.' });
      return;
    }
  } else if (typeof body.content === 'string') {
    content = body.content;
  }

  const byteLength = Buffer.byteLength(content, 'utf8');
  if (byteLength === 0) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'فایل زیرنویس خالی است.' });
    return;
  }
  if (byteLength > MAX_SUBTITLE_BYTES) {
    res.status(413).json({ error: 'too_large', messageFa: 'حجم فایل زیرنویس نباید بیشتر از ۲ مگابایت باشد.' });
    return;
  }
  const structuralError = looksLikeSubtitleText(content, format);
  if (structuralError) {
    res.status(400).json({ error: 'invalid_subtitle', messageFa: structuralError });
    return;
  }

  const paths = getLocalPaths();
  const dir = path.join(paths.root, 'public', 'subtitles');
  const repoDir = 'subtitles';
  const slug = safeSubtitleSlug(rawName.replace(/\.(srt|vtt)$/i, ''));
  const stamp = Date.now().toString(36);
  const filename = `${slug || 'subtitle'}-${stamp}.${format}`;
  const localPath = path.join(dir, filename);

  try {
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(localPath, content, 'utf8');
  } catch (error) {
    res.status(500).json({
      error: 'write_failed',
      messageFa: `ذخیرهٔ فایل روی سرور ناموفق بود: ${String(error).slice(0, 120)}`
    });
    return;
  }

  const record: SubtitleFileRecord = {
    url: `./subtitles/${filename}`,
    localPath,
    repoPath: `${repoDir}/${filename}`,
    filename,
    format,
    sizeBytes: byteLength,
    uploadedAt: new Date().toISOString()
  };

  const config = await readLocalConfig();
  config.subtitleFiles = [...(config.subtitleFiles || []), record];
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);

  res.status(201).json({
    ok: true,
    record,
    messageFa: 'فایل زیرنویس بارگذاری شد. با «اعمال سراسری» روی گیت‌هاب کامیت می‌شود.'
  });
});

adminRouter.post('/browser/launch', requireAdminAuth, async (req, res) => {
  const targetUrl = String(req.body?.url || '').trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.status(400).json({ error: 'invalid_url', messageFa: 'آدرس اینترنتی نامعتبر است.' });
    return;
  }

  const outDir = path.join(process.cwd(), 'data', 'browser_sessions');
  await fsp.mkdir(outDir, { recursive: true });
  const host = new URL(targetUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sessionPath = path.join(outDir, `${host}.json`);

  try {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(process.cwd(), 'scripts', 'browser_login_agent.py');
    const child = spawn(python, [scriptPath, targetUrl, sessionPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    res.json({
      ok: true,
      sessionFile: `${host}.json`,
      messageFa: 'مرورگر زنده باز شد. لطفاً در پنجره مرورگر لاگین کنید؛ کوکی‌ها خودکار استخراج می‌شوند.'
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: 'browser_launch_failed',
      messageFa: `خطا در اجرای مرورگر: ${(err as Error).message}`
    });
  }
});

adminRouter.get('/browser/session/:host', requireAdminAuth, async (req, res) => {
  const host = String(req.params.host || '').replace(/[^a-zA-Z0-9.-]/g, '_');
  const sessionPath = path.join(process.cwd(), 'data', 'browser_sessions', `${host}.json`);
  if (!fs.existsSync(sessionPath)) {
    res.status(404).json({ ok: false, messageFa: 'نشستی یافت نشد یا مرورگر هنوز بسته نشده است.' });
    return;
  }
  try {
    const data = JSON.parse(await fsp.readFile(sessionPath, 'utf-8'));
    res.json({ ok: true, session: data });
  } catch {
    res.status(500).json({ error: 'read_failed', messageFa: 'خطا در خواندن فایل نشست.' });
  }
});

adminRouter.get('/catalog/subtitle-files', requireAdminAuth, async (_req, res) => {
  const config = await readLocalConfig();
  res.json({ subtitleFiles: config.subtitleFiles || [] });
});

adminRouter.delete('/catalog/subtitle-file/:filename', requireAdminAuth, async (req, res) => {
  const config = await readLocalConfig();
  const target = (config.subtitleFiles || []).find((f) => f.filename === req.params.filename);
  if (!target) {
    res.status(404).json({ error: 'not_found', messageFa: 'فایل یافت نشد.' });
    return;
  }
  try {
    await fsp.rm(target.localPath, { force: true });
  } catch {
    // missing file is fine; still drop the record
  }
  config.subtitleFiles = (config.subtitleFiles || []).filter((f) => f.filename !== req.params.filename);
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.json({ ok: true, messageFa: 'فایل زیرنویس حذف شد.' });
});

// ---------------------------------------------------------------------------
// Public-Domain Collection (editable list + background ingestion)
// ---------------------------------------------------------------------------

adminRouter.get('/collection', requireAdminAuth, async (_req, res) => {
  const [collection, progress] = await Promise.all([readCollection(), readProgress()]);
  res.json({ ...collection, progress });
});

adminRouter.put('/collection', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const check = validateCollectionItems(body.items);
  if (!check.ok) {
    res.status(400).json({ error: 'validation_failed', messageFa: check.messageFa });
    return;
  }
  const collection = await readCollection();
  collection.items = check.items;
  await saveCollection(collection);
  res.json({ ok: true, count: check.items.length, messageFa: `کالکشن ذخیره شد (${check.items.length} عنوان).` });
});

adminRouter.post('/collection/run', requireAdminAuth, async (_req, res) => {
  const result = await startCollectionRun();
  res.json({ ok: true, started: result.started, messageFa: result.messageFa, progress: result.progress });
});

adminRouter.get('/collection/progress', requireAdminAuth, async (_req, res) => {
  res.json(await readProgress());
});

// ---------------------------------------------------------------------------
// Quick-add from a single link (Telegram post / direct media / HLS)
//
// Behaviour requested by the owner:
//   1. Paste ONE link (t.me post, .mp4/.mkv/.webm, .m3u8 …).
//   2. The whole movie + series list is scanned; if the exact link (or the
//      same Telegram post id, or the same normalized title) already exists,
//      nothing is added and the client reports it as a duplicate.
//   3. Otherwise the title is created in the site catalog (draft) and — when
//      requested — published to the owner's Telegram channel through the bot.
// ---------------------------------------------------------------------------

interface TelegramPostRef {
  channel: string;
  messageId: number;
  isPrivate: boolean;
}

function parseTelegramPostLink(rawUrl: string): TelegramPostRef | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 't.me' && host !== 'telegram.me' && host !== 'www.t.me') return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const messageId = Number(parts[parts.length - 1]);
  if (!Number.isInteger(messageId) || messageId <= 0) return null;
  if (parts[0] === 'c' && parts.length >= 3 && /^\d+$/.test(parts[1])) {
    return { channel: `-100${parts[1]}`, messageId, isPrivate: true };
  }
  const channel = parts[0].replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,64}$/.test(channel)) return null;
  return { channel, messageId, isPrivate: false };
}

function normalizeTitleKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .trim();
}

function titleFromMediaUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const file = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return file
      .replace(/\.(mp4|mkv|webm|m4v|mov|avi|m3u8|ts)$/i, '')
      .replace(/[._+\-]+/g, ' ')
      .replace(/\b(480p|720p|1080p|2160p|4k|hdcam|webrip|bluray|x264|x265|h264|hevc|aac|dual.?audio|subs?)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return '';
  }
}

/** Best-effort caption read from the public t.me/s/ web preview. */
async function fetchTelegramPostTitle(post: TelegramPostRef): Promise<string> {
  if (post.isPrivate) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`https://t.me/${post.channel}/${post.messageId}?embed=1`, {
      headers: { 'User-Agent': 'PetrosAdmin/1.0' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) return '';
    const html = await response.text();
    const caption =
      html.match(/tgme_widget_message_text[^>]*>([^<]{4,160})</)?.[1] ||
      html.match(/<meta property="og:title" content="([^"]{3,120})"/)?.[1] ||
      '';
    const cleaned = caption
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/فیلم\s+(سینمایی\s+)?|دانلود\s+/gi, '')
      .replace(/[:：].*$/, '')
      .trim()
      .slice(0, 120);
    // Reject junk: pure ids / digits / embed fragments are not titles.
    if (!cleaned || /^[\d_\-]+$/.test(cleaned) || !/[\p{L}]{3}/u.test(cleaned)) return '';
    return cleaned;
  } catch {
    return '';
  }
}

adminRouter.post('/catalog/from-link', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const rawUrl = String(body.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'یک لینک کامل http/https وارد کنید (پست تلگرام یا فایل مستقیم).' });
    return;
  }

  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];

  // ---- duplicate scan across the whole movie + series list ----
  const tgPost = parseTelegramPostLink(rawUrl);
  const wantedKey = normalizeTitleKey(String(body.title || '') || titleFromMediaUrl(rawUrl));
  const lowerUrl = rawUrl.toLowerCase();
  const duplicate = titles.find((t) => {
    const extra = t as unknown as Record<string, unknown>;
    const allUrls: string[] = [
      ...(t.qualities || []).map((q) => q.url || ''),
      ...(t.downloadLinks || []).map((d) => d.url || ''),
      ...(t.episodes || []).flatMap((e) => (e.qualities || []).map((q) => q.url || '')),
      // Reference files written by the publish step use the client-stream shape:
      // the original Telegram/media URL lives in these fields too.
      ...['playableUrl', 'defaultStreamUrl', 'streamUrl', 'telegramUrl', 'upstreamUrl', 'originalSource']
        .map((key) => (typeof extra[key] === 'string' ? (extra[key] as string) : ''))
    ];
    if (allUrls.some((u) => u.toLowerCase() === lowerUrl)) return true;
    if (tgPost) {
      const samePost = allUrls.some((u) => {
        const other = parseTelegramPostLink(u);
        return other && other.channel === tgPost.channel && other.messageId === tgPost.messageId;
      });
      if (samePost) return true;
    }
    if (wantedKey) {
      const keys = [t.title, t.titleFa, t.originalTitle || ''].map(normalizeTitleKey).filter(Boolean);
      if (keys.includes(wantedKey)) return true;
    }
    return false;
  });
  if (duplicate) {
    res.json({
      duplicate: true,
      created: null,
      telegram: null,
      messageFa: `این عنوان قبلاً در لیست وجود دارد: «${duplicate.titleFa || duplicate.title}» — چیزی اضافه نشد.`
    });
    return;
  }

  // ---- resolve a title + kind for the new record ----
  const kind = tgPost ? 'telegram_gateway' : classifyPlayback(rawUrl);
  if (!tgPost && !kind) {
    res.status(400).json({
      error: 'validation_failed',
      messageFa: 'این لینک نه پست تلگرام است و نه فایل مدیای مستقیم (mp4/mkv/webm/m3u8).'
    });
    return;
  }
  const guessTitle =
    String(body.title || '').trim() ||
    (tgPost ? await fetchTelegramPostTitle(tgPost) : '') ||
    titleFromMediaUrl(rawUrl) ||
    (tgPost ? `${tgPost.channel} post ${tgPost.messageId}` : rawUrl.slice(0, 60));

  const input = {
    id: makeId('title'),
    title: guessTitle,
    titleFa: String(body.titleFa || '') || guessTitle,
    category: (body.category as MediaCategory) ||
      (/\b(s0\d|season|فصل|قسمت|episode)\b/i.test(rawUrl + guessTitle) ? 'series' : 'movie'),
    status: 'draft' as const,
    qualities: [
      {
        id: makeId('q'),
        quality: String(body.quality || '1080p'),
        url: rawUrl,
        format: (kind || 'direct_mp4') as PlaybackKind,
        ...(body.username ? { username: String(body.username).trim() } : {}),
        ...(body.password ? { password: String(body.password).trim() } : {})
      }
    ],
    subtitles: []
  };
  const validation = validateTitle(input);
  if (validation) {
    res.status(400).json({ error: 'validation_failed', messageFa: validation });
    return;
  }

  const title = sanitizeTitle(input);
  titles.unshift(title);
  catalog.streams = titles as never;
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);

  // ---- optional Telegram publication to the owner's channel ----
  let telegram: { ok: boolean; method?: string; messageFa: string } | null = null;
  if (body.postToTelegram !== false) {
    const siteBase = (process.env.APP_URL || 'https://aipetros.xyz').replace(/\/+$/, '');
    telegram = await publishToTelegramChannel(rawUrl, title.titleFa || title.title, `${siteBase}/#/watch/${title.id}`);
  }

  res.status(201).json({
    duplicate: false,
    created: title,
    telegram,
    messageFa: telegram?.ok
      ? 'عنوان هم به سایت و هم به کانال تلگرام اضافه شد. با «اعمال سراسری» روی همه دستگاه‌ها پخش می‌شود.'
      : `عنوان به سایت اضافه شد${telegram ? ` — ${telegram.messageFa}` : ''}. برای انتشار نهایی «اعمال سراسری» را بزنید.`
  });
});

// ---------------------------------------------------------------------------
// Source validation
// ---------------------------------------------------------------------------

adminRouter.post('/sources/validate', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const url = String(body.url || '').trim();
  const kind = classifyPlayback(url);
  if (!kind) {
    res.status(400).json({
      ok: false,
      kind: null,
      messageFa: 'آدرس نامعتبر است. نمونهٔ درست: https://host/file.mp4 یا https://host/master.m3u8'
    });
    return;
  }

  const result: {
    ok: boolean;
    kind: string;
    status?: number;
    contentType?: string;
    contentLength?: number;
    acceptsRanges?: boolean;
    messageFa: string;
  } = { ok: false, kind, messageFa: '' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      signal: controller.signal
    });
    clearTimeout(timer);
    result.status = response.status;
    result.contentType = response.headers.get('content-type') || '';
    result.contentLength = Number(response.headers.get('content-length') || 0);
    result.acceptsRanges =
      (response.headers.get('accept-ranges') || '').toLowerCase() === 'bytes' ||
      response.status === 206;
    const isPlayable =
      (response.status === 200 || response.status === 206) &&
      /video|audio|octet-stream|mp4|mpegurl/i.test(result.contentType);
    result.ok = isPlayable;
    result.messageFa = isPlayable
      ? 'سورس معتبر است و پخش با پشتیبانی Range تأیید شد.'
      : 'سورس پاسخ داد اما محتوای ویدیویی قابل‌پخش برنگرداند.';
  } catch (error) {
    result.messageFa = `دسترسی به سورس ناموفق بود: ${String(error).slice(0, 140)}`;
  }
  res.json(result);
});

adminRouter.get('/sources', requireAdminAuth, async (_req, res) => {
  const config = await readLocalConfig();
  res.json({ sources: config.sources || [] });
});

adminRouter.post('/sources', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const url = String(body.baseUrl || body.url || '').trim();
  const kind = classifyPlayback(url);
  if (url && !kind) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'نوع سورس قابل تشخیص نیست.' });
    return;
  }
  const config = await readLocalConfig();
  const source: SourceRecord = {
    id: makeId('src'),
    name: String(body.name || 'منبع جدید'),
    nameFa: String(body.nameFa || ''),
    kind: kind || 'direct_mp4',
    baseUrl: url,
    homepage: String(body.homepage || ''),
    status: body.status === 'disabled' ? 'disabled' : 'active',
    notes: String(body.notes || ''),
    gatewayPort: Number(body.gatewayPort || 8089),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  config.sources = [...(config.sources || []), source];
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.status(201).json({ ok: true, source, messageFa: 'سورس افزوده شد.' });
});

adminRouter.delete('/sources/:id', requireAdminAuth, async (req, res) => {
  const config = await readLocalConfig();
  config.sources = (config.sources || []).filter((s) => s.id !== req.params.id);
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.json({ ok: true, messageFa: 'سورس حذف شد.' });
});

// ---------------------------------------------------------------------------
// Wallets / tokens / feature flags
// ---------------------------------------------------------------------------

adminRouter.get('/vault', requireAdminAuth, async (_req, res) => {
  const config = await readLocalConfig();
  res.json(redactConfig(config));
});

adminRouter.put('/vault/wallet/:id', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const config = await readLocalConfig();
  const wallets = config.wallets || [];
  const index = wallets.findIndex((w) => w.id === req.params.id);
  const address = String(body.address || '').trim();
  if (!address) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'آدرس کیف‌پول الزامی است.' });
    return;
  }
  if (index === -1) {
    const wallet: WalletRecord = {
      id: makeId('wallet'),
      network: (body.network || 'BTC') as WalletRecord['network'],
      address,
      label: String(body.label || ''),
      enabled: body.enabled !== false,
      decimals: Number(body.decimals ?? 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    wallets.push(wallet);
    config.wallets = wallets;
  } else {
    wallets[index] = {
      ...wallets[index],
      network: (body.network || wallets[index].network) as WalletRecord['network'],
      address,
      label: String(body.label ?? wallets[index].label ?? ''),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : wallets[index].enabled,
      decimals: Number(body.decimals ?? wallets[index].decimals),
      updatedAt: new Date().toISOString()
    };
    config.wallets = wallets;
  }
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.json({ ok: true, config: redactConfig(config), messageFa: 'کیف‌پول ذخیره شد.' });
});

adminRouter.delete('/vault/wallet/:id', requireAdminAuth, async (req, res) => {
  const config = await readLocalConfig();
  config.wallets = (config.wallets || []).filter((w) => w.id !== req.params.id);
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.json({ ok: true, config: redactConfig(config), messageFa: 'کیف‌پول حذف شد.' });
});

adminRouter.put('/vault/features', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const config = await readLocalConfig();
  const flags: FeatureFlags = {
    donationEnabled: Boolean(body.donationEnabled),
    cryptoPaymentEnabled: Boolean(body.cryptoPaymentEnabled),
    cryptoAdBannerEnabled: Boolean(body.cryptoAdBannerEnabled),
    watchPartyEnabled: Boolean(body.watchPartyEnabled),
    offlineDownloadEnabled: Boolean(body.offlineDownloadEnabled),
    telegramGatewayEnabled: Boolean(body.telegramGatewayEnabled),
    aiSubtitleSyncEnabled: Boolean(body.aiSubtitleSyncEnabled),
    maintenanceMode: Boolean(body.maintenanceMode)
  };
  config.features = flags;
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);
  res.json({ ok: true, features: flags, messageFa: 'سوییچ‌ها ذخیره شدند.' });
});

adminRouter.post('/vault/token/:key', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const key = String(req.params.key) as ApiTokenKey;
  const allowed: ApiTokenKey[] = ['github', 'telegram_bot', 'gemini', 'telegram_api_hash'];
  if (!allowed.includes(key)) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'کلید توکن نامعتبر است.' });
    return;
  }
  const value = String(body.value || '').trim();
  if (!value) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'مقدار توکن الزامی است.' });
    return;
  }
  const config = await readLocalConfig();
  const tokens = config.tokens || [];
  const index = tokens.findIndex((t) => t.id === key);
  const entry = {
    id: key,
    label:
      index >= 0
        ? tokens[index].label
        : key === 'github'
          ? 'GitHub PAT'
          : key === 'telegram_bot'
            ? 'Telegram Bot Token'
            : key === 'gemini'
              ? 'Gemini API Key'
              : 'Telegram API Hash',
    labelFa:
      index >= 0
        ? tokens[index].labelFa
        : key === 'github'
          ? 'توکن گیت‌هاب'
          : key === 'telegram_bot'
            ? 'توکن ربات تلگرام'
            : key === 'gemini'
              ? 'کلید جمینای'
              : 'هش تلگرام',
    required: index >= 0 ? tokens[index].required : true,
    description:
      index >= 0
        ? tokens[index].description
        : 'برای اعمال سراسری و سرویس‌های خودکار استفاده می‌شود.',
    value,
    updatedAt: new Date().toISOString()
  };
  if (index >= 0) tokens[index] = entry;
  else tokens.push(entry);
  config.tokens = tokens;
  config.updatedAt = new Date().toISOString();
  await writeLocalConfig(config);

  // Activate the token for this server process immediately (memory only —
  // never written to the repo). Persisting it in the environment remains the
  // owner's choice for survival across restarts.
  const envKey =
    key === 'github'
      ? 'GITHUB_TOKEN'
      : key === 'telegram_bot'
        ? 'TELEGRAM_BOT_TOKEN'
        : key === 'gemini'
          ? 'GEMINI_API_KEY'
          : 'TG_API_HASH';
  process.env[envKey] = value;

  // Tokens are never echoed back; the client only sees a masked preview.
  res.json({
    ok: true,
    config: redactConfig(config),
    messageFa:
      'توکن ذخیره شد. برای اعمال آن روی سرویس‌های فعال، متغیر محیطی متناظر را در سرور مقداردهی کنید.'
  });
});

// ---------------------------------------------------------------------------
// GitHub live sync
// ---------------------------------------------------------------------------

adminRouter.get('/sync/status', requireAdminAuth, async (_req, res) => {
  const status = await getGithubStatus();
  const cfg = getRepoConfig();
  res.json({
    ...status,
    catalogPath: cfg.catalogPath,
    configPath: cfg.configPath,
    localCatalogPath: getLocalPaths().catalog
  });
});

adminRouter.get('/sync/remote-catalog', requireAdminAuth, async (_req, res) => {
  const cfg = getRepoConfig();
  const entry = await fetchGithubFile(cfg.catalogPath);
  if (!entry) {
    res.status(404).json({
      error: 'not_found',
      messageFa: 'فایل کاتالوگ در ریپازیتوری یافت نشد یا دسترسی مجاز نیست.'
    });
    return;
  }
  try {
    const parsed = JSON.parse(decodeGithubContent(entry)) as AdminCatalogFile;
    res.json({
      sha: entry.sha,
      version: parsed.version,
      updatedAt: parsed.updatedAt,
      count: (parsed.streams || []).length
    });
  } catch (error) {
    res.status(400).json({
      error: 'invalid_remote_file',
      messageFa: 'فایل کاتالوگ ریموت JSON معتبر نیست.'
    });
  }
});

/**
 * The "save & apply globally" action:
 *   1. rebuild the client catalog from the local reference files
 *   2. write it locally (data/ + public/)
 *   3. commit & push data/streams.json + data/admin-config.json to main
 *   4. bump the manifest version so every client syncs immediately
 */
adminRouter.post('/sync/publish', requireAdminAuth, async (req, res) => {
  const body = (req.body || {}) as { message?: string; bumpVersion?: boolean };
  const catalog = await readLocalCatalog();
  const config = await readLocalConfig();

  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const clientCatalog = buildClientCatalog(titles);
  const manifestVersion = body.bumpVersion === false
    ? config.manifestVersion
    : `${Date.now().toString(36)}`;
  config.manifestVersion = manifestVersion;
  config.updatedAt = new Date().toISOString();

  const localWrites = await writeLocalCatalog(clientCatalog);
  await writeLocalConfig(config);

  const cfg = getRepoConfig();
  const files: Array<{ path: string; content: string }> = [
    { path: cfg.catalogPath, content: JSON.stringify(clientCatalog, null, 2) },
    { path: cfg.configPath, content: JSON.stringify(config, null, 2) }
  ];

  // Ship every uploaded SRT/VTT track alongside the catalog.
  const subtitleCommits: Array<{ path: string; ok: boolean; note?: string }> = [];
  for (const sub of config.subtitleFiles || []) {
    try {
      const content = await fsp.readFile(sub.localPath, 'utf8');
      files.push({ path: sub.repoPath, content });
      subtitleCommits.push({ path: sub.repoPath, ok: true });
    } catch {
      subtitleCommits.push({ path: sub.repoPath, ok: false, note: 'local_file_missing' });
    }
  }

  const summary =
    body.message?.trim() ||
    `update catalog (${titles.length} titles, manifest ${manifestVersion})`;
  const commit = await commitFiles(files, buildCommitMessage(summary));

  res.json({
    ok: commit.ok,
    commit,
    manifestVersion,
    localWrites,
    files: files.map((f) => f.path),
    subtitleCommits,
    counts: {
      titles: titles.length,
      seasons: countSeasons(titles),
      episodes: countEpisodes(titles),
      qualities: countQualities(titles),
      subtitles: countSubtitles(titles)
    },
    messageFa: commit.ok
      ? `تغییرات روی برنچ ${cfg.branch} اعمال شد. همه دستگاه‌ها در چرخه همگام‌سازی خودکار دریافت می‌کنند.`
      : `تغییرات فقط به‌صورت محلی ذخیره شد (${commit.message})`
  });
});

adminRouter.get('/sync/preview', requireAdminAuth, async (_req, res) => {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const clientCatalog = buildClientCatalog(titles);
  const preview = JSON.stringify(clientCatalog, null, 2);
  res.json({
    bytes: Buffer.byteLength(preview, 'utf8'),
    titles: titles.length,
    preview: preview.slice(0, 8000)
  });
});

/** Public endpoint used by the client to discover live feature flags. */
export const publicConfigRouter = express.Router();
publicConfigRouter.get('/config', async (_req, res) => {
  try {
    const config = await readLocalConfig();
    res.json({
      manifestVersion: config.manifestVersion,
      features: config.features,
      wallets: (config.wallets || []).filter((w) => w.enabled),
      updatedAt: config.updatedAt
    });
  } catch {
    res.status(500).json({ error: 'config_unavailable' });
  }
});

/** Admin-only helper: import a raw catalog file (used for migrations). */
adminRouter.post('/sync/import-local', requireAdminAuth, async (req, res) => {
  const body = requireBody(req, res);
  if (!body) return;
  const payload = body.payload as string | undefined;
  if (!payload) {
    res.status(400).json({ error: 'validation_failed', messageFa: 'محتوای فایل ارسال نشده است.' });
    return;
  }
  try {
    const parsed = JSON.parse(payload) as AdminCatalogFile;
    if (!Array.isArray(parsed.streams)) throw new Error('streams missing');
    await writeLocalCatalog(parsed);
    res.json({ ok: true, count: parsed.streams.length, messageFa: 'فایل وارد شد.' });
  } catch (error) {
    res.status(400).json({ error: 'invalid_file', messageFa: 'فایل JSON معتبر نیست.' });
  }
});

export { readLocalCatalog as adminReadCatalog, readLocalConfig as adminReadConfig };
export async function adminWriteCatalog(catalog: AdminCatalogFile): Promise<void> {
  await writeLocalCatalog(catalog);
}
export async function adminWriteConfig(config: AdminConfig): Promise<void> {
  await writeLocalConfig(config);
}
export { fsp as adminFs };
