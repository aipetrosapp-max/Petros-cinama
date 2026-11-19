/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Client side of the admin API.
 *
 * Security note: the session token is kept in a module-scoped variable only
 * (in-memory). It is never written to localStorage / sessionStorage, so a
 * page refresh requires a new login and XSS cannot persist the session.
 */

import type {
  AdminConfig,
  TitleRecord,
  SeasonRecord,
  EpisodeRecord,
  WalletRecord,
  SourceRecord,
  FeatureFlags,
  MediaCategory,
  SubtitleFileRecord,
  CollectionItem
} from './types.ts';
import {
  getAdminMode,
  readRepoJson,
  writeRepoJson,
  GithubApiError
} from './transport.ts';

let sessionToken = '';
let sessionExpiresAt = 0;

export class AdminApiError extends Error {
  public status: number;
  public code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function setSessionToken(token: string, expiresAt?: string): void {
  sessionToken = token || '';
  sessionExpiresAt = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 3_600_000;
}

export function clearSessionToken(): void {
  sessionToken = '';
  sessionExpiresAt = 0;
}

export function hasSession(): boolean {
  return Boolean(sessionToken) && Date.now() < sessionExpiresAt;
}

export function getSessionExpiry(): number {
  return sessionExpiresAt;
}

interface AdminRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, init: AdminRequestInit = {}): Promise<T> {
  if (getAdminMode() === 'github') {
    return githubRequest<T>(path, init);
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) || {})
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionToken) headers['x-admin-token'] = sessionToken;

  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const data = (payload || {}) as { error?: string; messageFa?: string };
    throw new AdminApiError(
      response.status,
      data.error || 'request_failed',
      data.messageFa || `درخواست با خطا مواجه شد (HTTP ${response.status}).`
    );
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// GITHUB MODE — the panel is served from the static site (aipetros.xyz).
// Every catalog/config operation is committed straight to the repo with the
// owner's token. Connection law: local + GitHub only.
// ---------------------------------------------------------------------------

interface CatalogFile {
  version: string;
  updatedAt: string;
  streams: TitleRecord[];
}

let githubCatalogCache: { file: CatalogFile; sha: string } | null = null;

async function loadCatalog(force = false): Promise<{ file: CatalogFile; sha: string }> {
  if (githubCatalogCache && !force) return githubCatalogCache;
  const raw = await readRepoJson('data/streams.json');
  const file = (raw?.data || { version: '', updatedAt: '', streams: [] }) as CatalogFile;
  githubCatalogCache = { file, sha: raw?.sha || '' };
  return githubCatalogCache;
}

async function commitCatalog(message: string): Promise<void> {
  const { file } = await loadCatalog();
  file.updatedAt = new Date().toISOString();
  await writeRepoJson('data/streams.json', file, message);
  await loadCatalog(true);
}

function makeId(title: string): string {
  const slug = String(title || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'item'}-${Date.now().toString(36)}`;
}

function dashboardFrom(catalog: CatalogFile, config: AdminConfig): DashboardSummary {
  const titles = catalog.streams || [];
  const byCategory: Record<string, number> = { movie: 0, series: 0, anime: 0 };
  let qualities = 0;
  let subtitles = 0;
  let seasons = 0;
  let episodes = 0;
  let withStream = 0;
  for (const t of titles) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    qualities += (t.qualities || []).length;
    subtitles += (t.subtitles || []).length + ((t as unknown as { subtitleUrl?: string }).subtitleUrl ? 1 : 0);
    seasons += (t.seasons || []).length;
    episodes += (t.episodes || []).length;
    if ((t as unknown as { playableUrl?: string }).playableUrl || (t.qualities || []).length > 0) withStream += 1;
  }
  return {
    totals: {
      titles: titles.length,
      published: titles.filter((t) => t.status === 'published').length,
      drafts: titles.filter((t) => t.status === 'draft' || t.geoPending === true).length,
      byCategory: byCategory as DashboardSummary['totals']['byCategory'],
      seasons,
      episodes,
      qualities,
      subtitles,
      wallets: (config.wallets || []).length,
      sources: (config.sources || []).length
    },
    catalogVersion: catalog.version,
    catalogUpdatedAt: catalog.updatedAt,
    manifestVersion: config.manifestVersion || '',
    features: config.features || ({} as FeatureFlags),
    withStream,
    withoutStream: titles.length - withStream
  };
}

async function loadConfig(): Promise<AdminConfig> {
  const raw = await readRepoJson('data/admin-config.json');
  return (raw?.data || {
    version: 1,
    manifestVersion: '',
    features: {},
    wallets: [],
    tokens: {},
    sources: [],
    subtitleFiles: []
  }) as AdminConfig;
}

/**
 * Mini rule-agent for GitHub mode — same Persian intents as the server agent,
 * operating directly on the repo. No external AI: deterministic rules only.
 */
async function githubAgentMessage(text: string): Promise<{ intent: string; replyFa: string }> {
  const t = text.trim();
  const lower = t.toLowerCase();
  const { file } = await loadCatalog();
  const titles = file.streams || [];
  const findTargets = (name: string): TitleRecord[] =>
    titles.filter(
      (x) =>
        (x.title || '').toLowerCase().includes(name.toLowerCase()) ||
        (x.titleFa || '').includes(name)
    );

  // «سطح A برای X» → everywhere
  const tierA = t.match(/سطح\s*[Aا]\s*(?:برای\s*)?(.+)/);
  if (tierA) {
    const targets = findTargets(tierA[1].trim());
    if (targets.length === 0) return { intent: 'geo_not_found', replyFa: `عنوانی با نام «${tierA[1].trim()}» پیدا نکردم.` };
    for (const x of targets) {
      x.geoPolicy = undefined;
      x.geoPending = false;
      x.status = 'published';
      x.updatedAt = new Date().toISOString();
    }
    await commitCatalog(`geo: tier A for ${targets.length} title(s)`);
    return { intent: 'geo_tier_a', replyFa: `✅ «${targets[0].title}» در تمام کشورها آزاد شد (سطح A) و منتشر شد.` };
  }

  // «قید جغرافیایی X را بردار»
  const clearGeo = t.match(/قید جغرافیایی\s*(?:را)?\s*(.*?)\s*(?:بردار|حذف|پاک)/);
  if (clearGeo) {
    const targets = findTargets(clearGeo[1].trim());
    if (targets.length === 0) return { intent: 'geo_not_found', replyFa: 'عنوانی پیدا نکردم.' };
    for (const x of targets) {
      x.geoPolicy = undefined;
      x.geoPending = false;
      x.status = 'published';
      x.updatedAt = new Date().toISOString();
    }
    await commitCatalog('geo: policy cleared');
    return { intent: 'geo_clear', replyFa: `✅ قید جغرافیایی «${targets[0].title}» برداشته شد.` };
  }

  // «کشور IR و IQ را برای X ببند» / «فقط در کشورهای US و GB»
  const codes = (t.match(/\b[A-Za-z]{2}\b/g) || []).filter((c) => /^[A-Za-z]{2}$/.test(c));
  const codesUp = codes.map((c) => c.toUpperCase());
  if (codesUp.length > 0) {
    const blockMode = /ببند|ممنوع|مسدود/.test(t);
    const allowMode = /فقط/.test(t);
    if (blockMode || allowMode) {
      const nameMatch = t.match(/برای\s*(.+?)(?:\s*(?:ببند|ممنوع|مسدود|فقط))/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      const targets = name ? findTargets(name) : [];
      if (targets.length === 0) return { intent: 'geo_not_found', replyFa: 'عنوانی برای این قانون پیدا نکردم.' };
      for (const x of targets) {
        x.geoPolicy = {
          mode: allowMode ? 'allow' : 'block',
          countries: codesUp,
          noteFa: allowMode ? 'فقط در کشورهای انتخابی' : 'در کشورهای انتخابی ممنوع',
          updatedAt: new Date().toISOString()
        };
        x.geoPending = false;
        x.status = 'published';
        x.updatedAt = new Date().toISOString();
      }
      await commitCatalog(`geo: ${allowMode ? 'allow' : 'block'} ${codesUp.join(',')}`);
      return {
        intent: 'geo_set',
        replyFa: allowMode
          ? `✅ «${targets[0].title}» فقط در ${codesUp.join('، ')} دیده می‌شود.`
          : `⛔️ «${targets[0].title}» در ${codesUp.join('، ')} بسته شد.`
      };
    }
  }

  // افزودن لینک → draft (server+telegram only from local mode)
  const link = t.match(/https?:\/\/[^\s]+/);
  if (link && /اضافه|افزودن|بگیر|ذخیره/.test(lower + t)) {
    const title = t.replace(/https?:\/\/[^\s]+/, '').replace(/اضافه کن|بگیر|ذخیره کن|افزودن|به آرشیو/g, '').trim() || 'عنوان تازه';
    const newTitle: TitleRecord = {
      id: makeId(title),
      title,
      titleFa: title,
      category: 'movie',
      status: 'draft',
      qualities: [],
      subtitles: [],
      seasons: [],
      episodes: [],
      geoPending: true,
      updatedAt: new Date().toISOString()
    } as unknown as TitleRecord;
    titles.unshift(newTitle);
    await commitCatalog(`ingest: ${title} (draft, geo pending)`);
    return {
      intent: 'add_from_link',
      replyFa: `📥 «${title}» به‌صورت پیش‌نویس ذخیره شد و در انتظار تصمیم سطح A/B توست. در حالت گیت‌هاب، بات تلگرام و تست پروب فقط از حالت لوکال انجام می‌شود. بعد از تأیید کیفیت‌ها بگو: «سطح A برای ${title}».`
    };
  }

  if (/وضعیت|گزارش|چند|آمار/.test(t)) {
    const dash = dashboardFrom(file, await loadConfig());
    return {
      intent: 'status',
      replyFa: `📊 کل عناوین: ${dash.totals.titles} | منتشرشده: ${dash.totals.published} | در انتظار تصمیم جغرافیا: ${dash.totals.drafts} | کیفیت‌ها: ${dash.totals.qualities} | زیرنویس: ${dash.totals.subtitles}`
    };
  }

  if (/سطح\s*[Bب]/.test(t)) {
    return {
      intent: 'help',
      replyFa: 'سطح B یعنی محدودسازی کشور — بگو: «کشور IR و IQ را برای نام فیلم ببند» یا «نام فیلم فقط در کشورهای US و GB دیده بشه».'
    };
  }

  return {
    intent: 'help',
    replyFa:
      'دستورها (حالت گیت‌هاب): «وضعیت» • «سطح A برای نام فیلم» • «کشور IR و IQ را برای نام فیلم ببند» • «نام فیلم فقط در کشورهای US و GB دیده بشه» • «قید جغرافیایی نام فیلم را بردار» • «لینک https://... را با نام فیلم ذخیره کن». برای ایجنت کامل (ADK، تلگرام، مرورگر) پنل را از حالت لوکال باز کن.'
  };
}


async function githubRequest<T>(path: string, init: AdminRequestInit = {}): Promise<T> {
  const method = init.method || 'GET';
  const body = (init.body || {}) as Record<string, unknown>;
  const fail = (code: string, messageFa: string): never => {
    throw new AdminApiError(501, code, messageFa);
  };

  try {
    if (path === '/auth/status') {
      return { passwordConfigured: true, minimumLength: 8, sessionTtlMinutes: 240 } as T;
    }

    if (path === '/auth/login' && method === 'POST') {
      const password = String(body.password || '');
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password.trim()));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const TARGET_HASH = 'a003a83cdddddcbe55d9d81c68b2c13b798c21386d16f1c94989fb3a88218b7c';
      if (hashHex !== TARGET_HASH) {
        throw new AdminApiError(401, 'invalid_password', 'رمز عبور وارد شده نادرست است.');
      }
      const token = 'gh_admin_' + Math.random().toString(36).slice(2);
      const expires = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      setSessionToken(token, expires);
      return { token, expiresAt: expires, messageFa: 'ورود موفق (حالت گیت‌هاب)' } as T;
    }

    if (path === '/auth/logout') {
      return { ok: true, messageFa: 'خارج شدی.' } as T;
    }

    if (path === '/dashboard') {
      const config = await loadConfig().catch(() => ({}) as AdminConfig);
      return dashboardFrom((await loadCatalog()).file, config) as T;
    }

    if (path === '/catalog' && method === 'GET') {
      try {
        const { file } = await loadCatalog(true);
        return { version: file.version, updatedAt: file.updatedAt, titles: file.streams || [] } as T;
      } catch (e: unknown) {
        throw new AdminApiError(502, 'github_read_failed', `خواندن کاتالوگ از گیت‌هاب ناموفق بود: ${e instanceof Error ? e.message : 'خطای شبکه'}`);
      }
    }

    if (path === '/catalog/title' && method === 'POST') {
      const input = body as Partial<TitleRecord>;
      const { file } = await loadCatalog();
      const title = { ...input, id: input.id || makeId(input.title || 'item'), updatedAt: new Date().toISOString() } as TitleRecord;
      (file.streams = file.streams || []).unshift(title);
      await commitCatalog(`catalog: add ${title.title}`);
      return { ok: true, title, messageFa: 'عنوان اضافه شد و روی گیت‌هاب کامیت شد.' } as T;
    }

    const titleMatch = path.match(/^\/catalog\/title\/([^/]+)$/);
    if (titleMatch) {
      const id = decodeURIComponent(titleMatch[1]);
      const { file } = await loadCatalog();
      const titles = file.streams || [];
      const idx = titles.findIndex((x) => x.id === id);
      if (idx === -1) throw new AdminApiError(404, 'not_found', 'عنوان پیدا نشد.');
      if (method === 'PUT') {
        const patch = body as Partial<TitleRecord>;
        const geoOnly = Object.keys(patch).length === 1 && 'geoPolicy' in patch;
        if (!geoOnly) {
          titles[idx] = { ...titles[idx], ...patch, id, updatedAt: new Date().toISOString() } as TitleRecord;
        } else {
          titles[idx] = {
            ...titles[idx],
            geoPolicy: patch.geoPolicy as TitleRecord['geoPolicy'],
            ...(patch.geoPolicy ? { status: 'published' as const, geoPending: false } : {}),
            updatedAt: new Date().toISOString()
          };
        }
        await commitCatalog(`catalog: update ${titles[idx].title}`);
        return { ok: true, title: titles[idx], messageFa: 'ذخیره شد (کامیت گیت‌هاب).' } as T;
      }
      if (method === 'DELETE') {
        const removed = titles.splice(idx, 1)[0];
        await commitCatalog(`catalog: delete ${removed.title}`);
        return { ok: true, messageFa: 'حذف شد.' } as T;
      }
    }

    const seasonMatch = path.match(/^\/catalog\/title\/([^/]+)\/season$/);
    if (seasonMatch && method === 'POST') {
      const id = decodeURIComponent(seasonMatch[1]);
      const { file } = await loadCatalog();
      const target = (file.streams || []).find((x) => x.id === id);
      if (!target) throw new AdminApiError(404, 'not_found', 'عنوان پیدا نشد.');
      const season = { ...body, id: body.id || makeId('season') } as unknown as SeasonRecord;
      target.seasons = [...(target.seasons || []), season];
      await commitCatalog(`catalog: add season to ${target.title}`);
      return { ok: true, season, messageFa: 'فصل اضافه شد.' } as T;
    }

    if (path === '/collection' && method === 'GET') {
      const raw = await readRepoJson('data/public_domain_collection.json');
      const data = (raw?.data || { items: [] }) as { items?: CollectionItem[]; progress?: unknown };
      return { items: data.items || [], progress: data.progress } as T;
    }

    if (path === '/collection' && method === 'PUT') {
      const raw = await readRepoJson('data/public_domain_collection.json');
      const data = (raw?.data || { version: 1, items: [] }) as Record<string, unknown>;
      data.items = (body.items as CollectionItem[]) || [];
      data.updatedAt = new Date().toISOString();
      await writeRepoJson('data/public_domain_collection.json', data, 'collection: edit from admin panel');
      return { ok: true, count: (data.items as unknown[]).length, messageFa: 'کالکشن ذخیره شد (کامیت گیت‌هاب).' } as T;
    }

    if (path === '/collection/run' || path === '/collection/progress') {
      if (path === '/collection/progress') return { running: false } as T;
      return {
        ok: false,
        started: false,
        messageFa: 'اجرای ورکر اینجست کالکشن فقط در حالت لوکال ممکن است. پنل را از سرور خودت (localhost:3210/admin) باز کن.'
      } as T;
    }

    if (path === '/vault' && method === 'GET') {
      return (await loadConfig()) as T;
    }

    if (path.startsWith('/vault/wallet/')) {
      const id = decodeURIComponent(path.split('/')[3] || 'new');
      const config = await loadConfig();
      if (method === 'PUT') {
        const wallet = body as Partial<WalletRecord>;
        const wallets = (config.wallets || []) as WalletRecord[];
        const widx = wallets.findIndex((w) => w.id === id);
        const record = { ...wallet, id: id === 'new' ? makeId('wallet') : id } as WalletRecord;
        if (widx >= 0) wallets[widx] = record;
        else wallets.push(record);
        config.wallets = wallets;
      } else if (method === 'DELETE') {
        config.wallets = ((config.wallets || []) as WalletRecord[]).filter((w) => w.id !== id);
      }
      config.updatedAt = new Date().toISOString();
      await writeRepoJson('data/admin-config.json', config, 'vault: wallets update');
      return { ok: true, config, messageFa: 'ذخیره شد.' } as T;
    }

    if (path === '/vault/features' && method === 'PUT') {
      const config = await loadConfig();
      config.features = body as unknown as FeatureFlags;
      config.updatedAt = new Date().toISOString();
      await writeRepoJson('data/admin-config.json', config, 'vault: features update');
      return { ok: true, features: config.features, messageFa: 'ذخیره شد.' } as T;
    }

    if (path.startsWith('/vault/token/') && method === 'POST') {
      const key = decodeURIComponent(path.split('/')[3] || '');
      const config = await loadConfig();
      config.tokens = { ...(config.tokens || {}), [key]: { set: true, updatedAt: new Date().toISOString() } } as AdminConfig['tokens'];
      await writeRepoJson('data/admin-config.json', config, 'vault: token presence');
      return { ok: true, config, messageFa: 'ذخیره شد.' } as T;
    }

    if (path === '/sources' && method === 'GET') {
      const config = await loadConfig();
      return { sources: (config.sources || []) as SourceRecord[] } as T;
    }

    if (path === '/sync/status') {
      return { configured: true, owner: 'aipetrosapp-max', repo: 'Petros-cinama', branch: 'main', mode: 'github' } as T;
    }

    if (path === '/sync/remote-catalog') {
      const { file, sha } = await loadCatalog(true);
      return { sha, version: file.version, updatedAt: file.updatedAt, count: (file.streams || []).length } as T;
    }

    if (path === '/sync/preview') {
      const { file } = await loadCatalog();
      const json = JSON.stringify(file);
      return { bytes: json.length, titles: (file.streams || []).length, preview: json.slice(0, 1200) } as T;
    }

    if (path === '/sync/publish' && method === 'POST') {
      await commitCatalog('publish: sync from admin panel (github mode)');
      const { file } = await loadCatalog(true);
      const published = (file.streams || []).filter((x) => x.status !== 'draft' && x.geoPending !== true).length;
      return { ok: true, pushed: true, commitSha: 'github-mode', publishedCount: published, messageFa: 'کاتالوگ روی گیت‌هاب کامیت شد؛ سایت همان را می‌خواند.' } as T;
    }

    if (path === '/agent/message' && method === 'POST') {
      const result = await githubAgentMessage(String(body.text || ''));
      return { ok: true, ...result } as T;
    }

    if (path === '/catalog/from-link' && method === 'POST') {
      const result = await githubAgentMessage(`ذخیره کن ${String(body.url || '')} ${String(body.title || body.titleFa || '')}`);
      return { duplicate: false, created: null, telegram: null, messageFa: result.replyFa } as T;
    }

    if (path.startsWith('/agent/') || path.startsWith('/browser/')) {
      return fail('local_only', 'این ابزار (ایجنت مرورگر / کوکی / LLM) فقط در حالت لوکال کار می‌کند.');
    }

    if (path.startsWith('/catalog/subtitle-file')) {
      return fail('local_only', 'بارگذاری فایل زیرنویس فقط در حالت لوکال ممکن است (فایل باینری).');
    }

    return fail('not_supported_github_mode', `این عملیات (${method} ${path}) در حالت گیت‌هاب پشتیبانی نمی‌شود.`);
  } catch (err: unknown) {
    if (err instanceof AdminApiError) throw err;
    if (err instanceof GithubApiError) throw new AdminApiError(err.status, 'github_error', err.message);
    throw new AdminApiError(500, 'github_mode_error', err instanceof Error ? err.message : 'خطای ناشناخته در حالت گیت‌هاب');
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  totals: {
    titles: number;
    published: number;
    drafts: number;
    byCategory: Record<MediaCategory, number>;
    seasons: number;
    episodes: number;
    qualities: number;
    subtitles: number;
    wallets: number;
    sources: number;
  };
  catalogVersion: string;
  catalogUpdatedAt: string;
  manifestVersion: string;
  features: FeatureFlags;
  withStream: number;
  withoutStream: number;
}

export interface GithubStatusResponse {
  configured: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  tokenPresent: boolean;
  lastCommitSha?: string;
  lastCommitUrl?: string;
  lastCommitAt?: string;
  catalogSha?: string;
  configSha?: string;
  error?: string;
  catalogPath?: string;
  configPath?: string;
}

export interface PublishResult {
  ok: boolean;
  manifestVersion: string;
  files: string[];
  counts: {
    titles: number;
    seasons: number;
    episodes: number;
    qualities: number;
    subtitles: number;
  };
  messageFa: string;
  commit?: {
    ok: boolean;
    commitSha?: string;
    htmlUrl?: string;
    message: string;
  };
}

export interface SourceValidationResult {
  ok: boolean;
  kind: string | null;
  status?: number;
  contentType?: string;
  contentLength?: number;
  acceptsRanges?: boolean;
  messageFa: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const adminApi = {
  authStatus: async () => {
    try {
      const res = await request<{ passwordConfigured: boolean; minimumLength: number; sessionTtlMinutes: number }>(
        '/auth/status'
      );
      return res;
    } catch {
      // In static hosting environments like GitHub Pages, client-side fallback is active
      return { passwordConfigured: true, minimumLength: 8, sessionTtlMinutes: 240 };
    }
  },

  login: async (password: string) => {
    try {
      const res = await request<{ token: string; expiresAt: string; messageFa: string }>('/auth/login', {
        method: 'POST',
        body: { password }
      });
      return res;
    } catch (err: unknown) {
      // If server returned 404/405/501 (e.g. GitHub Pages or a static file server), use client-side sha256 authentication
      const isStaticOrDisallowed =
        err instanceof AdminApiError && (err.status === 405 || err.status === 404 || err.status === 501);

      if (isStaticOrDisallowed) {
        // Precomputed SHA-256 for Ped12345@
        const TARGET_HASH = 'a003a83cdddddcbe55d9d81c68b2c13b798c21386d16f1c94989fb3a88218b7c';
        
        // Calculate SHA-256 using Web Crypto API in browser
        const encoder = new TextEncoder();
        const data = encoder.encode(password.trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === TARGET_HASH) {
          const fakeToken = 'gh_admin_' + Math.random().toString(36).substring(2);
          const expires = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
          setSessionToken(fakeToken, expires);
          return {
            token: fakeToken,
            expiresAt: expires,
            messageFa: 'ورود موفق به پنل مدیریت اختصاصی پتروس سینما'
          };
        } else {
          throw new AdminApiError(401, 'invalid_password', 'رمز عبور وارد شده نادرست است.');
        }
      }
      throw err;
    }
  },

  logout: () => request<{ ok: boolean; messageFa: string }>('/auth/logout', { method: 'POST' }),

  session: () =>
    request<{ valid: boolean; expiresAt: string | null }>('/auth/session'),

  dashboard: () => request<DashboardSummary>('/dashboard'),

  catalog: () =>
    request<{ version: string; updatedAt: string; titles: TitleRecord[] }>('/catalog'),

  createTitle: (title: Partial<TitleRecord>) =>
    request<{ ok: boolean; title: TitleRecord; messageFa: string }>('/catalog/title', {
      method: 'POST',
      body: title
    }),

  updateTitle: (id: string, title: Partial<TitleRecord>) =>
    request<{ ok: boolean; title: TitleRecord; messageFa: string }>(`/catalog/title/${id}`, {
      method: 'PUT',
      body: title
    }),

  deleteTitle: (id: string) =>
    request<{ ok: boolean; messageFa: string }>(`/catalog/title/${id}`, { method: 'DELETE' }),

  addSeason: (id: string, season: Partial<SeasonRecord>) =>
    request<{ ok: boolean; season: SeasonRecord; messageFa: string }>(
      `/catalog/title/${id}/season`,
      { method: 'POST', body: season }
    ),

  addEpisode: (id: string, episode: Partial<EpisodeRecord>) =>
    request<{ ok: boolean; episode: EpisodeRecord; messageFa: string }>(
      `/catalog/title/${id}/episode`,
      { method: 'POST', body: episode }
    ),

  deleteEpisode: (id: string, episodeId: string) =>
    request<{ ok: boolean; messageFa: string }>(`/catalog/title/${id}/episode/${episodeId}`, {
      method: 'DELETE'
    }),

  validateSource: (url: string) =>
    request<SourceValidationResult>('/sources/validate', { method: 'POST', body: { url } }),

  sources: () => request<{ sources: SourceRecord[] }>('/sources'),

  addSource: (source: Partial<SourceRecord>) =>
    request<{ ok: boolean; source: SourceRecord; messageFa: string }>('/sources', {
      method: 'POST',
      body: source
    }),

  deleteSource: (id: string) =>
    request<{ ok: boolean; messageFa: string }>(`/sources/${id}`, { method: 'DELETE' }),

  // Public-Domain editable collection
  getCollection: () =>
    request<{ items: CollectionItem[]; progress?: unknown }>('/collection'),
  saveCollection: (items: CollectionItem[]) =>
    request<{ ok: boolean; count: number; messageFa: string }>('/collection', {
      method: 'PUT',
      body: { items }
    }),
  runCollection: () =>
    request<{ ok: boolean; started: boolean; messageFa: string }>('/collection/run', { method: 'POST' }),
  // page-agent browser copilot (vendored alibaba/page-agent)
  getPanelLlmConfig: () =>
    request<{ mode: 'openai' | 'demo'; model: string; baseURL: string; apiKey: string; messageFa: string }>(
      '/agent/llm-config'
    ),
  startBrowserSession: (url: string, taskFa = '') =>
    request<{ ok: boolean; pageUrl: string; messageFa: string }>('/agent/browser/start', {
      method: 'POST',
      body: { url, taskFa }
    }),
  getCollectionProgress: () =>
    request<{ running?: boolean; total?: number; processed?: number; added?: number; failed?: number; skipped?: number; log?: string[] }>(
      '/collection/progress'
    ),

  /** Persian chat with the Autonomous Local Cinema Admin Agent. */
  agentMessage: (text: string) =>
    request<{ ok: boolean; intent: string; replyFa: string; data?: unknown }>('/agent/message', {
      method: 'POST',
      body: { text }
    }),

  vault: () => request<AdminConfig>('/vault'),

  saveWallet: (wallet: Partial<WalletRecord> & { id?: string }) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(
      `/vault/wallet/${wallet.id || 'new'}`,
      { method: 'PUT', body: wallet }
    ),

  deleteWallet: (id: string) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(`/vault/wallet/${id}`, {
      method: 'DELETE'
    }),

  saveFeatures: (features: FeatureFlags) =>
    request<{ ok: boolean; features: FeatureFlags; messageFa: string }>('/vault/features', {
      method: 'PUT',
      body: features
    }),

  saveToken: (key: string, value: string) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(`/vault/token/${key}`, {
      method: 'POST',
      body: { value }
    }),

  syncStatus: () => request<GithubStatusResponse>('/sync/status'),

  remoteCatalog: () =>
    request<{ sha: string; version: string; updatedAt: string; count: number }>(
      '/sync/remote-catalog'
    ),

  publish: (message?: string) =>
    request<PublishResult>('/sync/publish', {
      method: 'POST',
      body: { message: message || '' }
    }),

  preview: () =>
    request<{ bytes: number; titles: number; preview: string }>('/sync/preview'),

  uploadSubtitleFile: (filename: string, contentBase64: string) =>
    request<{ ok: boolean; record: SubtitleFileRecord; messageFa: string }>(
      '/catalog/subtitle-file',
      { method: 'POST', body: { filename, contentBase64 } }
    ),

  subtitleFiles: () =>
    request<{ subtitleFiles: SubtitleFileRecord[] }>('/catalog/subtitle-files'),

  deleteSubtitleFile: (filename: string) =>
    request<{ ok: boolean; messageFa: string }>(
      `/catalog/subtitle-file/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    ),

  addFromLink: (payload: {
    url: string;
    title?: string;
    titleFa?: string;
    category?: MediaCategory;
    quality?: string;
    postToTelegram?: boolean;
    username?: string;
    password?: string;
  }) =>
    request<{
      duplicate: boolean;
      created: TitleRecord | null;
      telegram: { ok: boolean; method?: string; messageFa: string } | null;
      messageFa: string;
    }>('/catalog/from-link', { method: 'POST', body: payload }),

  launchBrowser: (url: string) =>
    request<{ ok: boolean; sessionFile: string; messageFa: string }>('/browser/launch', {
      method: 'POST',
      body: { url }
    }),

  checkBrowserSession: (host: string) =>
    request<{ ok: boolean; session?: { url: string; cookie_header: string; count: number }; messageFa?: string }>(
      `/browser/session/${encodeURIComponent(host)}`
    )
};
