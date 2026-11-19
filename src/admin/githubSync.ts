/**
 * PETROS CINEMA — GITHUB LIVE SYNC ENGINE
 *
 * Two-way, commit-based synchronisation between the Admin Panel and the
 * GitHub repository that every client already polls:
 *
 *   data/streams.json      → the media catalog consumed by Dynamic Stream Sync
 *   data/admin-config.json → feature flags, wallets, sources, token presence
 *
 * The client (web / Android / TV / desktop) already fetches
 * `raw.githubusercontent.com/<owner>/<repo>/<branch>/data/streams.json`
 * on a timer. Therefore a single commit on the `main` branch propagates to
 * every installed device without any client update or manual refresh
 * (Zero-Client-Update Architecture).
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type {
  AdminCatalogFile,
  AdminConfig,
  GithubRepoConfig,
  TitleRecord
} from './types.ts';
import { isPlayableDirectMediaUrl } from '../services/mediaUrlValidator.ts';

const GITHUB_API = 'https://api.github.com';

export interface GithubFileEntry {
  path: string;
  sha: string;
  content: string;
  encoding: 'base64' | 'utf-8';
}

export interface CommitResult {
  ok: boolean;
  commitSha?: string;
  htmlUrl?: string;
  message: string;
  files: string[];
  error?: string;
}

export interface GithubStatus {
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
}

export function getRepoConfig(): GithubRepoConfig {
  const raw =
    process.env.GITHUB_REPO || 'aipetrosapp-max/Petros-cinama';
  const [owner = 'aipetrosapp-max', repo = 'Petros-cinama'] = raw.split('/');
  return {
    owner: process.env.GITHUB_OWNER || owner,
    repo: process.env.GITHUB_REPO_NAME || repo,
    branch: process.env.GITHUB_BRANCH || 'main',
    catalogPath: process.env.GITHUB_CATALOG_PATH || 'data/streams.json',
    configPath: process.env.GITHUB_CONFIG_PATH || 'data/admin-config.json'
  };
}

export function getGithubToken(): string {
  return (
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.VELORA_GITHUB_TOKEN ||
    ''
  ).trim();
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'PetrosCinema-MasterAdminPanel',
    ...extra
  };
  const token = getGithubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GITHUB_API}${pathname}`, {
    ...init,
    headers: authHeaders((init.headers as Record<string, string>) || {})
  });
}

export function isGithubConfigured(): boolean {
  return Boolean(getGithubToken());
}

/** Fetch a single file from the repository. */
export async function fetchGithubFile(
  repoPath: string
): Promise<GithubFileEntry | null> {
  const cfg = getRepoConfig();
  const res = await githubFetch(
    `/repos/${cfg.owner}/${cfg.repo}/contents/${repoPath}?ref=${encodeURIComponent(cfg.branch)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    path: string;
    sha: string;
    content: string;
    encoding: string;
  };
  return {
    path: data.path,
    sha: data.sha,
    content: data.content,
    encoding: (data.encoding as 'base64' | 'utf-8') || 'base64'
  };
}

export function decodeGithubContent(entry: GithubFileEntry): string {
  if (entry.encoding === 'utf-8') return entry.content;
  return Buffer.from(entry.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

/** Latest commit touching the catalog file — used for the "live" indicator. */
export async function fetchLatestCommit(
  repoPath?: string
): Promise<{ sha: string; url: string; date: string; message: string } | null> {
  const cfg = getRepoConfig();
  const query = repoPath
    ? `?path=${encodeURIComponent(repoPath)}&sha=${encodeURIComponent(cfg.branch)}&per_page=1`
    : `?sha=${encodeURIComponent(cfg.branch)}&per_page=1`;
  const res = await githubFetch(`/repos/${cfg.owner}/${cfg.repo}/commits${query}`);
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    sha: string;
    html_url: string;
    commit: { message: string; committer?: { date?: string } };
  }>;
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;
  return {
    sha: first.sha,
    url: first.html_url,
    date: first.commit?.committer?.date || new Date().toISOString(),
    message: first.commit?.message || ''
  };
}

export async function getGithubStatus(): Promise<GithubStatus> {
  const cfg = getRepoConfig();
  const base: GithubStatus = {
    configured: isGithubConfigured(),
    owner: cfg.owner,
    repo: cfg.repo,
    branch: cfg.branch,
    tokenPresent: Boolean(getGithubToken())
  };
  if (!base.tokenPresent) {
    base.error = 'توکن GitHub تنظیم نشده است (GITHUB_TOKEN).';
    return base;
  }
  try {
    const me = await githubFetch('/user');
    if (!me.ok) {
      base.error = `احراز هویت GitHub ناموفق بود (HTTP ${me.status}).`;
      return base;
    }
    const user = (await me.json()) as { login?: string };
    if (user.login && user.login !== cfg.owner) {
      base.error = `توکن متعلق به کاربر ${user.login} است، نه ${cfg.owner}.`;
    }
    const commit = await fetchLatestCommit(cfg.catalogPath);
    if (commit) {
      base.lastCommitSha = commit.sha;
      base.lastCommitUrl = commit.url;
      base.lastCommitAt = commit.date;
    }
    const catalog = await fetchGithubFile(cfg.catalogPath);
    if (catalog) base.catalogSha = catalog.sha;
    const config = await fetchGithubFile(cfg.configPath);
    if (config) base.configSha = config.sha;
    return base;
  } catch (error) {
    base.error = String(error).slice(0, 200);
    return base;
  }
}

/** Build the Git blob/tree/commit payload for the given files. */
export function buildCommitFiles(
  files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  return files.map((file) => ({
    path: file.path,
    content: Buffer.from(file.content, 'utf8').toString('base64')
  }));
}

/**
 * Commit and push files to the branch. Uses the Git Data API
 * (create blob → tree → commit → ref update) so a single commit contains
 * every changed reference file.
 */
export async function commitFiles(
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<CommitResult> {
  const cfg = getRepoConfig();
  const touched = files.map((f) => f.path);
  if (!isGithubConfigured()) {
    return {
      ok: false,
      message: 'توکن GitHub تنظیم نشده است؛ فقط تغییرات محلی ذخیره شد.',
      files: touched,
      error: 'github_token_missing'
    };
  }

  try {
    const baseRef = await githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${encodeURIComponent(cfg.branch)}`
    );
    if (!baseRef.ok) {
      return {
        ok: false,
        message: `برنچ ${cfg.branch} یافت نشد (HTTP ${baseRef.status}).`,
        files: touched,
        error: 'branch_not_found'
      };
    }
    const refData = (await baseRef.json()) as { object: { sha: string } };
    const headSha = refData.object.sha;

    const baseCommit = await githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/git/commits/${headSha}`
    );
    const baseTreeSha =
      baseCommit.ok
        ? (((await baseCommit.json()) as { tree: { sha: string } }).tree.sha)
        : undefined;

    const blobs: Array<{ path: string; sha: string }> = [];
    for (const file of files) {
      const blobRes = await githubFetch(
        `/repos/${cfg.owner}/${cfg.repo}/git/blobs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            encoding: 'base64'
          })
        }
      );
      if (!blobRes.ok) {
        return {
          ok: false,
          message: `ساخت blob برای ${file.path} ناموفق بود (HTTP ${blobRes.status}).`,
          files: touched,
          error: 'blob_failed'
        };
      }
      const blob = (await blobRes.json()) as { sha: string };
      blobs.push({ path: file.path, sha: blob.sha });
    }

    const treeRes = await githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/git/trees`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map((b) => ({
            path: b.path,
            mode: '100644',
            type: 'blob',
            sha: b.sha
          }))
        })
      }
    );
    if (!treeRes.ok) {
      return {
        ok: false,
        message: `ساخت tree ناموفق بود (HTTP ${treeRes.status}).`,
        files: touched,
        error: 'tree_failed'
      };
    }
    const tree = (await treeRes.json()) as { sha: string };

    const commitRes = await githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/git/commits`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [headSha]
        })
      }
    );
    if (!commitRes.ok) {
      return {
        ok: false,
        message: `ساخت commit ناموفق بود (HTTP ${commitRes.status}).`,
        files: touched,
        error: 'commit_failed'
      };
    }
    const commit = (await commitRes.json()) as { sha: string; html_url?: string };

    const refRes = await githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${encodeURIComponent(cfg.branch)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: commit.sha, force: false })
      }
    );
    if (!refRes.ok) {
      return {
        ok: false,
        message: `به‌روزرسانی برنچ ناموفق بود (HTTP ${refRes.status}).`,
        files: touched,
        error: 'ref_update_failed'
      };
    }

    return {
      ok: true,
      commitSha: commit.sha,
      htmlUrl: commit.html_url,
      message: 'کامیت با موفقیت روی برنچ push شد.',
      files: touched
    };
  } catch (error) {
    return {
      ok: false,
      message: `خطای غیرمنتظره: ${String(error).slice(0, 200)}`,
      files: touched,
      error: 'unexpected'
    };
  }
}

// ---------------------------------------------------------------------------
// Local reference files (what clients consume)
// ---------------------------------------------------------------------------

export function getLocalPaths() {
  const root = process.cwd();
  return {
    root,
    catalog: path.join(root, 'data', 'streams.json'),
    config: path.join(root, 'data', 'admin-config.json'),
    publicCatalog: path.join(root, 'public', 'data', 'streams.json'),
    publicCatalogFlat: path.join(root, 'public', 'streams.json')
  };
}

export async function readLocalCatalog(): Promise<AdminCatalogFile> {
  const paths = getLocalPaths();
  for (const candidate of [paths.catalog, paths.publicCatalog]) {
    try {
      const raw = await fsp.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw) as AdminCatalogFile;
      if (Array.isArray(parsed.streams)) return parsed;
    } catch {
      // try next
    }
  }
  return {
    version: '0.0.0',
    updatedAt: new Date().toISOString(),
    streams: []
  };
}

export async function writeLocalCatalog(catalog: AdminCatalogFile): Promise<string[]> {
  const paths = getLocalPaths();
  const payload = JSON.stringify(catalog, null, 2);
  const written: string[] = [];
  for (const target of [paths.catalog, paths.publicCatalog, paths.publicCatalogFlat]) {
    try {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, payload, 'utf8');
      written.push(target);
    } catch (error) {
      console.error(`[AdminSync] failed writing ${target}:`, error);
    }
  }
  return written;
}

export async function readLocalConfig(): Promise<AdminConfig> {
  const paths = getLocalPaths();
  try {
    const raw = await fsp.readFile(paths.config, 'utf8');
    const parsed = JSON.parse(raw) as AdminConfig;
    if (parsed && Array.isArray(parsed.wallets)) return parsed;
  } catch {
    // fall through to defaults
  }
  return {
    version: 1,
    manifestVersion: 'local',
    features: {
      donationEnabled: false,
      cryptoPaymentEnabled: false,
      cryptoAdBannerEnabled: true,
      watchPartyEnabled: false,
      offlineDownloadEnabled: true,
      telegramGatewayEnabled: true,
      aiSubtitleSyncEnabled: true,
      maintenanceMode: false
    },
    wallets: [],
    tokens: [],
    sources: [],
    updatedAt: new Date().toISOString()
  };
}

export async function writeLocalConfig(config: AdminConfig): Promise<void> {
  const paths = getLocalPaths();
  const payload = JSON.stringify(config, null, 2);
  await fsp.mkdir(path.dirname(paths.config), { recursive: true });
  await fsp.writeFile(paths.config, payload, 'utf8');
  // Mirror into the static bundle so GitHub Pages / packaged clients can read
  // {BASE}data/admin-config.json without a server. Best-effort.
  try {
    const publicConfig = path.join(paths.root, 'public', 'data', 'admin-config.json');
    await fsp.mkdir(path.dirname(publicConfig), { recursive: true });
    await fsp.writeFile(publicConfig, payload, 'utf8');
  } catch {
    // non-fatal: raw.githubusercontent remains the fallback channel
  }
}

/**
 * Convert an internal TitleRecord into the client-facing stream shape.
 * The clients already understand `playableUrl`, `qualities[]`, `subtitles[]`
 * and the `/api/stream/cache/<id>` route.
 */
export function titleToClientStream(
  title: TitleRecord,
  cacheRouteFor: (id: string) => string
): Record<string, unknown> {
  // The local reference file may already be a client-format record written by
  // the Telegram sync (with telegramUrl / defaultStreamUrl / qualities).
  // A publish round-trip must NEVER lose the real upstream links.
  const incoming = title as TitleRecord & {
    telegramUrl?: string;
    defaultStreamUrl?: string;
    upstreamUrl?: string;
    telegramPostId?: number;
  };

  const allCandidates = [
    ...((title.qualities || []).map((q) => q.url)),
    incoming.defaultStreamUrl || '',
    incoming.telegramUrl || ''
  ].filter(Boolean);

  // The canonical Telegram post, if any record field carries one.
  const telegramPost = allCandidates.find((u) => /(?:t\.me|telegram\.me)\//i.test(u)) || '';
  // Was this title already routed through the rolling cache gateway?
  const wasCacheRouted = allCandidates.some((u) => u.startsWith('/api/stream/cache/'));
  // A loopback Telegram gateway URL is an upstream hint, not client-direct media.
  const loopbackHint = allCandidates.find((u) => {
    try {
      const h = new URL(u).hostname.toLowerCase();
      return /^https?:\/\//i.test(u) && (h === '127.0.0.1' || h === 'localhost');
    } catch {
      return false;
    }
  });

  // Verified public direct media stays direct.
  const directUrl = allCandidates.find((u) => {
    if (!/^https?:\/\//i.test(u)) return false;
    if (/(?:t\.me|telegram\.me)\//i.test(u) || u.startsWith('/api/stream/cache/')) return false;
    try {
      const h = new URL(u).hostname.toLowerCase();
      if (h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]') return false;
    } catch {
      return false;
    }
    return isPlayableDirectMediaUrl(u);
  });

  // Everything Telegram-backed (or already cache-routed) goes through the
  // same-origin rolling cache route.
  const useCache = !directUrl && (Boolean(telegramPost) || wasCacheRouted || Boolean(loopbackHint));
  const playableUrl = directUrl || (useCache ? cacheRouteFor(title.id) : '');

  // Stable upstream descriptor for the cache gateway: survives any number of
  // publish round-trips without depending on the original link fields.
  let upstreamDescriptor = '';
  if (useCache) {
    const existing = (incoming.upstreamUrl || '').trim();
    if (existing.startsWith('petros-cache://')) {
      upstreamDescriptor = existing;
    } else if (telegramPost) {
      try {
        const parsed = new URL(telegramPost);
        const parts = parsed.pathname.split('/').filter(Boolean);
        let channel = '';
        let messageId = 0;
        if (parts[0] === 'c' && parts.length >= 3) {
          channel = `-100${parts[1]}`;
          messageId = Number(parts[2]);
        } else if (parts.length >= 2) {
          channel = parts[0].replace(/^@/, '');
          messageId = Number(parts[parts.length - 1]);
        }
        if (channel && Number.isInteger(messageId) && messageId > 0) {
          upstreamDescriptor = `petros-cache://telegram/${channel}/${messageId}`;
        }
      } catch {
        // fall through to direct descriptor
      }
    }
    if (!upstreamDescriptor && wasCacheRouted) {
      // Non-telegram mirror (e.g. retired CDN): keep it as an explicit direct
      // descriptor so the gateway applies its host allow-list at request time.
      const mirror = allCandidates.find(
        (u) => /^https?:\/\//i.test(u) && !u.startsWith('/api/stream/cache/') && !/(?:t\.me|telegram\.me)\//i.test(u)
      );
      if (mirror) {
        upstreamDescriptor = `petros-cache://direct/${encodeURIComponent(mirror)}`;
      }
    }
  }

  // For cache-routed titles every quality maps to the same canonical route;
  // verified-direct titles keep their real URLs; unavailable titles keep their
  // original (non-playable) URLs untouched so nothing looks fake-playable.
  const qualities = (title.qualities || []).map((q) => ({
    quality: q.quality,
    url: useCache ? cacheRouteFor(title.id) : q.url,
    format: q.format,
    bitrate: q.bitrateKbps || 0,
    fps: q.fps || 0,
    label: q.label
  }));

  return {
    id: title.id,
    title: title.title,
    titleFa: title.titleFa,
    originalTitle: title.originalTitle || '',
    category: title.category,
    poster: title.posterUrl || '',
    posterUrl: title.posterUrl || '',
    backdropUrl: title.backdropUrl || '',
    year: title.year || 0,
    rating: title.rating ? `${title.rating}/10` : '',
    durationSec: title.durationSec || 0,
    director: title.director || '',
    cast: title.cast || [],
    genres: title.genres || [],
    tags: title.tags || [],
    featured: Boolean(title.featured),
    trendingRank: title.trendingRank || 0,
    defaultStreamUrl: playableUrl,
    playableUrl,
    upstreamUrl: upstreamDescriptor,
    telegramUrl: telegramPost,
    sourceType: title.category === 'movie' ? 'mp4' : 'series',
    qualities,
    subtitles: (title.subtitles || []).map((s) => ({
      language: s.language,
      label: s.label || s.languageFa,
      url: s.url,
      format: s.format,
      offsetMs: s.offsetMs,
      forced: Boolean(s.forced)
    })),
    subtitleStatus: (title.subtitles || []).length ? 'registered' : 'not_registered',
    seasons: (title.seasons || []).map((s) => ({
      id: s.id,
      season: s.season,
      title: s.title,
      titleFa: s.titleFa || '',
      status: s.status
    })),
    episodes: (title.episodes || []).map((e) => ({
      id: e.id,
      season: e.season,
      episode: e.episode,
      title: e.title,
      titleFa: e.titleFa || '',
      durationSec: e.durationSec || 0,
      posterUrl: e.posterUrl || '',
      status: e.status,
      qualities: (e.qualities || []).map((q) => ({
        quality: q.quality,
        url: cacheRouteFor(e.id),
        format: q.format,
        bitrate: q.bitrateKbps || 0,
        fps: q.fps || 0
      })),
      subtitles: (e.subtitles || []).map((s) => ({
        language: s.language,
        label: s.label || s.languageFa,
        url: s.url,
        format: s.format,
        offsetMs: s.offsetMs,
        forced: Boolean(s.forced)
      }))
    })),
    geoPolicy: title.geoPolicy
      ? { mode: title.geoPolicy.mode, countries: (title.geoPolicy.countries || []).map((c) => c.toUpperCase().slice(0, 2)), noteFa: title.geoPolicy.noteFa, updatedAt: title.geoPolicy.updatedAt }
      : undefined,
    playbackStatus: playableUrl ? 'available' : 'unavailable',
    playbackStatusReason: playableUrl
      ? directUrl
        ? 'Verified direct media published through the Master Admin Panel.'
        : 'Rolling cache stream gateway route published through the Master Admin Panel.'
      : 'No verified source published for this title yet.',
    updatedAt: title.updatedAt
  };
}

export function buildClientCatalog(titles: TitleRecord[]): AdminCatalogFile {
  const cfg = getRepoConfig();
  const cacheRouteFor = (id: string) => `/api/stream/cache/${id}`;
  return {
    version: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    brand: 'Petros Cinema',
    platform: 'AI Petros Cinema',
    channelName: 'Aipetros',
    streams: titles.map((t) => titleToClientStream(t, cacheRouteFor)) as never
  };
}

export function buildCommitMessage(summary: string): string {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  return `chore(admin): ${summary} [${stamp}]`;
}

export function hashPayload(payload: string): string {
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 12);
}

export function catalogExistsSync(): boolean {
  return fs.existsSync(getLocalPaths().catalog);
}
