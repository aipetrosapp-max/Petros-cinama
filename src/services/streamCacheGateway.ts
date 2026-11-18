/**
 * Rolling Cache Stream Gateway (server-side).
 *
 * Serves catalog titles through one standard same-origin route:
 *   GET/HEAD /api/stream/cache/<streamId>[?url=<override>]
 *
 * Behaviour:
 *  - The first request for a byte range is fetched from the upstream source
 *    (Telegram range gateway, archive.org, ...) and streamed to the client
 *    while being written into `cache/media_chunks/<sha1>.cache`.
 *  - Later requests for already-cached bytes are served straight from disk, so
 *    re-scrubbing and re-watching within the rolling window never re-downloads.
 *  - Full support for `Range: bytes=` / HTTP 206 / `Content-Range`, which is
 *    what HTML5 <video> needs for instant seeking.
 *  - A background garbage collector deletes every cache artefact older than
 *    ROLLING_CACHE_MAX_AGE_MS (8 hours) and trims the total cache size down to
 *    ROLLING_CACHE_MAX_BYTES (50 GB) whenever it grows beyond the cap.
 *
 * Without an upstream (e.g. the Telethon gateway is not running) the route
 * answers with an explicit JSON error instead of faking media bytes.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { Request, Response } from 'express';

export const ROLLING_CACHE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
export const ROLLING_CACHE_MAX_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
export const ROLLING_CACHE_GC_INTERVAL_MS = 5 * 60 * 1000;

const DEFAULT_CACHE_DIR = path.join(process.cwd(), 'cache', 'media_chunks');
const CATALOG_PATHS = ['data/streams.json', 'public/data/streams.json'];

export type ByteRange = [number, number];

interface CacheMeta {
  url: string;
  contentType: string;
  totalLength: number;
  ranges: ByteRange[];
  createdAt: number;
  lastAccess: number;
}

interface RawCatalogStream {
  id?: string;
  telegramUrl?: string;
  defaultStreamUrl?: string;
  sourceType?: string;
  telegramPostId?: number;
  /** explicit upstream descriptor written by the Master Admin Panel publish */
  upstreamUrl?: string;
}

function resolveCacheDescriptor(descriptor: string): UpstreamResolution {
  const withoutScheme = descriptor.slice('petros-cache://'.length);
  const separator = withoutScheme.indexOf('/');
  const mode = (separator === -1 ? withoutScheme : withoutScheme.slice(0, separator)).toLowerCase();
  const rest = separator === -1 ? '' : withoutScheme.slice(separator + 1);

  if (mode === 'telegram') {
    const [channel, rawId] = rest.split('/');
    const messageId = Number(rawId);
    if (!channel || !Number.isInteger(messageId) || messageId <= 0) {
      return {
        ok: false,
        status: 400,
        code: 'invalid_descriptor',
        messageFa: 'توصیف‌گر upstream کش نامعتبر است.'
      };
    }
    const base = getConfiguredGatewayBase();
    if (!base) {
      return {
        ok: false,
        status: 503,
        code: 'gateway_not_configured',
        messageFa:
          'گیت‌وی استریم تلگرام فعال نیست. متغیر STREAM_GATEWAY_URL را تنظیم و stream_gateway.py را اجرا کنید.'
      };
    }
    return { ok: true, url: `${base}/${encodeURIComponent(channel)}/${messageId}` };
  }

  if (mode === 'direct') {
    let target = rest;
    try {
      target = decodeURIComponent(rest);
    } catch {
      // keep raw
    }
    try {
      const parsed = new URL(target);
      if (!isAllowedOverrideHost(parsed.hostname)) {
        return {
          ok: false,
          status: 403,
          code: 'host_not_allowed',
          messageFa: 'دامنه درخواستی در فهرست مجاز کش استریم نیست.'
        };
      }
      return { ok: true, url: parsed.toString() };
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'invalid_descriptor',
        messageFa: 'توصیف‌گر upstream کش نامعتبر است.'
      };
    }
  }

  return {
    ok: false,
    status: 400,
    code: 'invalid_descriptor',
    messageFa: 'حالت توصیف‌گر کش ناشناخته است.'
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** Merge overlapping / adjacent byte ranges into a sorted, disjoint list. */
export function mergeByteRanges(ranges: ByteRange[]): ByteRange[] {
  const sorted = [...ranges]
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end >= start)
    .sort((a, b) => a[0] - b[0]);
  const merged: ByteRange[] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/**
 * Split a requested [start,end] span into cached / uncached segments, given the
 * merged ranges already present on disk.
 */
export function computeCoverageSegments(
  start: number,
  end: number,
  cachedRanges: ByteRange[]
): Array<{ start: number; end: number; cached: boolean }> {
  const merged = mergeByteRanges(cachedRanges);
  const segments: Array<{ start: number; end: number; cached: boolean }> = [];
  let cursor = start;
  for (const [cStart, cEnd] of merged) {
    if (cEnd < cursor) continue;
    if (cStart > end) break;
    if (cStart > cursor) {
      segments.push({ start: cursor, end: Math.min(cStart - 1, end), cached: false });
      cursor = cStart;
    }
    if (cursor > end) break;
    const segEnd = Math.min(cEnd, end);
    segments.push({ start: cursor, end: segEnd, cached: true });
    cursor = segEnd + 1;
    if (cursor > end) break;
  }
  if (cursor <= end) {
    segments.push({ start: cursor, end, cached: false });
  }
  return segments.filter((seg) => seg.end >= seg.start);
}

/** Parse a single `Range: bytes=...` header. Multi-range headers use the first range. */
export function parseRangeHeader(
  header: string | undefined,
  totalLength: number
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    // suffix range: last N bytes
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    if (totalLength > 0) {
      const start = Math.max(0, totalLength - suffix);
      return { start, end: totalLength - 1 };
    }
    return null; // unknown length: cannot resolve suffix range locally
  }
  const start = Number(rawStart);
  if (!Number.isFinite(start) || start < 0) return null;
  // Open-ended range with a known total length resolves to totalLength-1 (RFC 7233).
  const end = rawEnd === '' ? (totalLength > 0 ? totalLength - 1 : Number.MAX_SAFE_INTEGER) : Number(rawEnd);
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

// ---------------------------------------------------------------------------
// Catalog + upstream resolution
// ---------------------------------------------------------------------------

let catalogCache: { mtimeMs: number; byId: Map<string, RawCatalogStream> } | null = null;

async function getCatalogById(): Promise<Map<string, RawCatalogStream>> {
  for (const rel of CATALOG_PATHS) {
    const filePath = path.join(process.cwd(), rel);
    try {
      const stat = await fsp.stat(filePath);
      if (catalogCache && catalogCache.mtimeMs === stat.mtimeMs) return catalogCache.byId;
      const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8')) as {
        streams?: RawCatalogStream[];
      };
      const byId = new Map<string, RawCatalogStream>();
      for (const stream of parsed.streams || []) {
        if (stream?.id) byId.set(String(stream.id), stream);
      }
      catalogCache = { mtimeMs: stat.mtimeMs, byId };
      return byId;
    } catch {
      // try next path
    }
  }
  return catalogCache?.byId || new Map();
}

function getConfiguredGatewayBase(): string {
  const raw =
    process.env.STREAM_GATEWAY_URL || process.env.VITE_STREAM_GATEWAY_URL || '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

interface TelegramPost {
  channel: string;
  messageId: number;
}

function parseTelegramPostUrl(rawUrl?: string | null): TelegramPost | null {
  if (!rawUrl) return null;
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
  if (parts[0] === 'c' && parts.length >= 3) {
    const internalId = parts[1];
    if (!/^\d+$/.test(internalId)) return null;
    return { channel: `-100${internalId}`, messageId };
  }
  const channel = parts[0].replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,64}$/.test(channel)) return null;
  return { channel, messageId };
}

function isAllowedOverrideHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === 'archive.org' || host.endsWith('.archive.org')) return true;
  if (host.endsWith('company3.com')) return true;
  const gatewayHost = (() => {
    const base = getConfiguredGatewayBase();
    if (!base) return '';
    try {
      return new URL(base).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (gatewayHost && host === gatewayHost) return true;
  const extra = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(host);
}

export type UpstreamResolution =
  | { ok: true; url: string }
  | { ok: false; status: number; code: string; messageFa: string };

/** Resolve which upstream URL backs a cache route call. */
export async function resolveUpstream(
  streamId: string,
  overrideUrl: string | null
): Promise<UpstreamResolution> {
  if (overrideUrl) {
    try {
      const parsed = new URL(overrideUrl);
      if (!isAllowedOverrideHost(parsed.hostname)) {
        return {
          ok: false,
          status: 403,
          code: 'host_not_allowed',
          messageFa: 'دامنه درخواستی در فهرست مجاز کش استریم نیست.'
        };
      }
      return { ok: true, url: parsed.toString() };
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'invalid_url',
        messageFa: 'آدرس منبع نامعتبر است.'
      };
    }
  }

  const catalog = await getCatalogById();
  const stream = catalog.get(streamId);

  // A catalog entry may carry an explicit cache upstream descriptor:
  //   sourceType: 'petros-cache'
  //   telegramUrl: 'petros-cache://telegram/<channel>/<messageId>'
  //   telegramUrl: 'petros-cache://direct/<encoded absolute url>'
  // This keeps the real upstream stable across publish round-trips even when
  // the original t.me / mirror link is normalized away.
  const descriptor = (stream?.upstreamUrl || stream?.telegramUrl || '').trim();
  if (descriptor.startsWith('petros-cache://')) {
    return resolveCacheDescriptor(descriptor);
  }

  if (!stream) {
    return {
      ok: false,
      status: 404,
      code: 'unknown_stream',
      messageFa: 'این عنوان در کاتالوگ یافت نشد.'
    };
  }

  const telegramUrl = stream.telegramUrl || '';
  const post = parseTelegramPostUrl(telegramUrl);
  if (post) {
    const base = getConfiguredGatewayBase();
    if (!base) {
      return {
        ok: false,
        status: 503,
        code: 'gateway_not_configured',
        messageFa:
          'گیت‌وی استریم تلگرام فعال نیست. متغیر STREAM_GATEWAY_URL را تنظیم و stream_gateway.py را اجرا کنید.'
      };
    }
    return { ok: true, url: `${base}/${encodeURIComponent(post.channel)}/${post.messageId}` };
  }

  const direct = stream.defaultStreamUrl || '';
  if (/^https?:\/\//i.test(direct) && !direct.includes('t.me')) {
    try {
      const parsed = new URL(direct);
      if (isAllowedOverrideHost(parsed.hostname)) return { ok: true, url: parsed.toString() };
    } catch {
      // fallthrough
    }
  }

  return {
    ok: false,
    status: 503,
    code: 'no_upstream',
    messageFa: 'منبع بالادستی معتبری برای این عنوان یافت نشد.'
  };
}

// ---------------------------------------------------------------------------
// Cache storage
// ---------------------------------------------------------------------------

interface CachePaths {
  dir: string;
  data: string;
  meta: string;
  key: string;
}

function cachePathsFor(upstreamUrl: string, cacheDir: string = DEFAULT_CACHE_DIR): CachePaths {
  const key = crypto.createHash('sha1').update(upstreamUrl).digest('hex');
  return {
    dir: cacheDir,
    key,
    data: path.join(cacheDir, `${key}.cache`),
    meta: path.join(cacheDir, `${key}.meta.json`)
  };
}

async function readMeta(paths: CachePaths): Promise<CacheMeta | null> {
  try {
    const raw = await fsp.readFile(paths.meta, 'utf8');
    const parsed = JSON.parse(raw) as CacheMeta;
    if (parsed && Array.isArray(parsed.ranges)) return parsed;
  } catch {
    // no meta yet
  }
  return null;
}

async function writeMeta(paths: CachePaths, meta: CacheMeta): Promise<void> {
  meta.ranges = mergeByteRanges(meta.ranges);
  await fsp.mkdir(paths.dir, { recursive: true });
  await fsp.writeFile(paths.meta, JSON.stringify(meta), 'utf8');
}

async function ensureDataFile(paths: CachePaths): Promise<void> {
  await fsp.mkdir(paths.dir, { recursive: true });
  try {
    await fsp.access(paths.data);
  } catch {
    await fsp.writeFile(paths.data, '');
  }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

function sendJsonError(res: Response, status: number, code: string, messageFa: string): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(status).json({ error: code, messageFa });
}

export async function handleCacheStream(req: Request, res: Response): Promise<void> {
  const streamId = String(req.params?.streamId || '');
  const override = typeof req.query.url === 'string' ? req.query.url : null;

  const upstream = await resolveUpstream(streamId, override);
  if (!upstream.ok) {
    sendJsonError(res, upstream.status, upstream.code, upstream.messageFa);
    return;
  }

  const paths = cachePathsFor(upstream.url);
  const meta = (await readMeta(paths)) || {
    url: upstream.url,
    contentType: '',
    totalLength: 0,
    ranges: [],
    createdAt: Date.now(),
    lastAccess: Date.now()
  };
  meta.lastAccess = Date.now();

  if (req.method === 'HEAD') {
    res.status(200).setHeader('Accept-Ranges', 'bytes');
    if (meta.contentType) res.setHeader('Content-Type', meta.contentType);
    if (meta.totalLength > 0) res.setHeader('Content-Length', String(meta.totalLength));
    res.setHeader('X-Petros-Cache', meta.ranges.length ? 'hit' : 'miss');
    res.end();
    return;
  }

  const rangeHeader = req.headers.range;
  const requested = parseRangeHeader(rangeHeader, meta.totalLength);
  const isRangeRequest = Boolean(rangeHeader) && requested !== null;

  try {
    if (!isRangeRequest) {
      await serveFullFile(req, res, upstream.url, paths, meta);
    } else {
      await serveRangeRequest(req, res, upstream.url, paths, meta, requested as { start: number; end: number });
    }
  } catch (error) {
    const status = (error as { upstreamStatus?: number }).upstreamStatus;
    if (!res.headersSent) {
      // No byte has reached the player yet: answer with an honest error so the
      // <video> element fires onError and the maintenance state renders.
      sendJsonError(res, 502, 'upstream_unavailable',
        'دریافت از منبع بالادستی ناموفق بود. گیت‌وی استریم در دسترس نیست.');
    } else if (!res.writableEnded) {
      // client disconnected or upstream died mid-stream: keep what we cached
      res.end();
    }
  } finally {
    try {
      if (meta.ranges.length > 0) {
        // something real was cached: persist metadata and refresh the timestamp
        await writeMeta(paths, meta);
        await fsp.utimes(paths.data, new Date(), new Date());
      } else {
        // nothing was cached (e.g. dead gateway): remove empty artefacts so the
        // cache never contains fake/empty files
        await fsp.rm(paths.data, { force: true });
        await fsp.rm(paths.meta, { force: true });
      }
    } catch {
      // best-effort metadata persistence
    }
  }
}

function applyCommonHeaders(res: Response, cacheTag: string): void {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Range, Accept-Ranges, Content-Length, Content-Type, X-Petros-Cache'
  );
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');
  res.setHeader('X-Petros-Cache', cacheTag);
}

/** Serve the whole file (HTTP 200). Fully-cached files never touch the network. */
async function serveFullFile(
  req: Request,
  res: Response,
  upstreamUrl: string,
  paths: CachePaths,
  meta: CacheMeta
): Promise<void> {
  const fullyCached =
    meta.totalLength > 0 &&
    meta.contentType &&
    computeCoverageSegments(0, meta.totalLength - 1, meta.ranges).every((seg) => seg.cached);

  if (fullyCached) {
    const stat = await fsp.stat(paths.data);
    const length = Math.min(meta.totalLength, stat.size);
    res.status(200);
    applyCommonHeaders(res, 'hit');
    res.setHeader('Content-Type', meta.contentType || 'video/mp4');
    res.setHeader('Content-Length', String(length));
    await streamDiskSegment(res, paths.data, 0, length - 1);
    res.end();
    return;
  }

  await ensureDataFile(paths);
  const controller = new AbortController();
  req.on('close', () => controller.abort());
  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: 'video/*,application/octet-stream' },
    signal: controller.signal
  });
  if (!upstream.ok || !upstream.body) {
    (upstream as unknown as { upstreamStatus?: number }).upstreamStatus = upstream.status;
    throw upstream;
  }
  meta.contentType = meta.contentType || upstream.headers.get('content-type') || 'video/mp4';
  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 0) meta.totalLength = declaredLength;

  res.status(200);
  applyCommonHeaders(res, 'miss');
  res.setHeader('Content-Type', meta.contentType || 'video/mp4');
  if (meta.totalLength > 0) res.setHeader('Content-Length', String(meta.totalLength));

  const fh = await fsp.open(paths.data, 'r+');
  try {
    let position = 0;
    for await (const chunk of upstream.body) {
      const bytes = chunk as Uint8Array;
      if (!res.write(bytes)) {
        await new Promise<void>((resolve) => res.once('drain', () => resolve()));
      }
      await fh.write(bytes, 0, bytes.length, position);
      position += bytes.length;
    }
    if (meta.totalLength <= 0) meta.totalLength = position;
    meta.ranges = mergeByteRanges([...meta.ranges, [0, Math.max(0, position - 1)]]);
    res.end();
  } finally {
    await fh.close();
  }
}

/** Serve an HTTP 206 range request, mixing disk hits and upstream fetches. */
async function serveRangeRequest(
  req: Request,
  res: Response,
  upstreamUrl: string,
  paths: CachePaths,
  meta: CacheMeta,
  requested: { start: number; end: number }
): Promise<void> {
  let end = meta.totalLength > 0 ? Math.min(requested.end, meta.totalLength - 1) : requested.end;
  const start = requested.start;
  if (meta.totalLength > 0 && start >= meta.totalLength) {
    res.status(416).setHeader('Content-Range', `bytes */${meta.totalLength}`).end();
    return;
  }

  const segments = computeCoverageSegments(start, end, meta.ranges);
  const allCached = segments.length > 0 && segments.every((seg) => seg.cached);
  const cacheTag = allCached ? 'hit' : segments.some((seg) => seg.cached) ? 'partial' : 'miss';

  // Fail fast BEFORE any 206 header reaches the player: when uncached bytes
  // are needed, verify the upstream is reachable with a tiny 1-byte probe and
  // learn its real total length at the same time, so the 206 carries an exact
  // Content-Range total and open-ended ranges resolve to totalLength-1.
  if (!allCached || meta.totalLength <= 0) {
    const probe = await probeUpstream(upstreamUrl, start);
    if (!probe.ok) {
      sendJsonError(res, 502, 'upstream_unavailable',
        'دریافت از منبع بالادستی ناموفق بود. گیت‌وی استریم در دسترس نیست.');
      return;
    }
    if (probe.total > 0) meta.totalLength = Math.max(meta.totalLength, probe.total);
  }
  if (meta.totalLength > 0) end = Math.min(end, meta.totalLength - 1);

  await ensureDataFile(paths);
  res.status(206);
  applyCommonHeaders(res, cacheTag);
  res.setHeader('Content-Type', meta.contentType || 'video/mp4');
  const length = end - start + 1;
  res.setHeader('Content-Length', String(length));
  res.setHeader(
    'Content-Range',
    `bytes ${start}-${end}/${meta.totalLength > 0 ? meta.totalLength : '*'}`
  );

  const fh = await fsp.open(paths.data, 'r+');
  const controller = new AbortController();
  req.on('close', () => controller.abort());
  try {
    let index = 0;
    while (index < segments.length) {
      // merge consecutive uncached segments into a single upstream request
      const seg = segments[index];
      if (seg.cached) {
        await streamDiskSegment(res, paths.data, seg.start, seg.end);
        index += 1;
        continue;
      }
      let fetchEnd = seg.end;
      let consumed = 1;
      while (index + consumed < segments.length && !segments[index + consumed].cached) {
        fetchEnd = segments[index + consumed].end;
        consumed += 1;
      }
      const received = await streamUpstreamSegment(
        res,
        upstreamUrl,
        seg.start,
        fetchEnd,
        fh,
        meta,
        controller
      );
      if (received >= 0) {
        meta.ranges = mergeByteRanges([...meta.ranges, [seg.start, seg.start + received - 1]]);
        if (meta.totalLength <= 0) {
          const declared = received < fetchEnd - seg.start + 1 ? -1 : 0;
          if (declared === 0 && seg.start + received >= fetchEnd) {
            // full segment fetched; total length still unknown until a full pass
          }
        }
      }
      index += consumed;
    }
    res.end();
  } finally {
    await fh.close();
  }
}

async function streamDiskSegment(
  res: Response,
  dataPath: string,
  start: number,
  end: number
): Promise<void> {
  const stream = fs.createReadStream(dataPath, { start, end });
  for await (const chunk of stream) {
    if (!res.write(chunk as Uint8Array)) {
      await new Promise<void>((resolve) => res.once('drain', () => resolve()));
    }
  }
}

/** Fetch one byte range upstream, tee it to the client and the cache file. */
/**
 * Probe the upstream with a 1-byte range request. Serves two purposes:
 *  - learn the real total length from "Content-Range: bytes a-b/<total>";
 *  - fail fast (before any response headers are sent to the player) when the
 *    upstream/gateway is unreachable, so the client gets an honest 502.
 */
async function probeUpstream(
  upstreamUrl: string,
  start: number
): Promise<{ ok: boolean; total: number }> {
  const controller = new AbortController();
  try {
    const resp = await fetch(upstreamUrl, {
      headers: { Range: `bytes=${start}-${start}` },
      signal: controller.signal
    });
    if (!resp.ok) return { ok: false, total: 0 };
    const contentRange = resp.headers.get('content-range') || '';
    const match = /\/(\d+)\s*$/.exec(contentRange);
    if (match) return { ok: true, total: Number(match[1]) };
    const declared = Number(resp.headers.get('content-length') || 0);
    if (resp.status === 200 && declared > 0) return { ok: true, total: declared };
    return { ok: true, total: 0 };
  } catch {
    return { ok: false, total: 0 };
  } finally {
    controller.abort();
  }
}

async function streamUpstreamSegment(
  res: Response,
  upstreamUrl: string,
  start: number,
  end: number,
  fh: fs.promises.FileHandle,
  meta: CacheMeta,
  controller: AbortController
): Promise<number> {
  const upstream = await fetch(upstreamUrl, {
    headers: {
      Range: `bytes=${start}-${end}`,
      Accept: 'video/*,application/octet-stream'
    },
    signal: controller.signal
  });
  if (!upstream.ok || !upstream.body) {
    (upstream as unknown as { upstreamStatus?: number }).upstreamStatus = upstream.status;
    throw upstream;
  }
  if (upstream.status === 200 && start > 0) {
    // upstream ignored our range; alignment is impossible for this segment
    (upstream as unknown as { upstreamStatus?: number }).upstreamStatus = 500;
    throw upstream;
  }
  meta.contentType = meta.contentType || upstream.headers.get('content-type') || 'video/mp4';
  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (upstream.status === 206) {
    // For a range response Content-Length is the range size, not the file size.
    // The real total lives in "Content-Range: bytes a-b/<total>".
    const contentRange = upstream.headers.get('content-range') || '';
    const totalMatch = /\/(\d+)\s*$/.exec(contentRange);
    if (totalMatch) meta.totalLength = Math.max(meta.totalLength, Number(totalMatch[1]));
  }

  let position = start;
  let received = 0;
  try {
    for await (const chunk of upstream.body) {
      const bytes = chunk as Uint8Array;
      if (!res.write(bytes)) {
        await new Promise<void>((resolve) => res.once('drain', () => resolve()));
      }
      await fh.write(bytes, 0, bytes.length, position);
      position += bytes.length;
      received += bytes.length;
    }
  } catch (error) {
    if (meta.totalLength <= 0 && declaredLength > 0) meta.totalLength = declaredLength;
    if (!controller.signal.aborted) throw error;
    // client disconnected: keep the bytes we managed to cache
  }
  if (meta.totalLength <= 0 && upstream.status === 200 && declaredLength > 0 && start === 0) {
    meta.totalLength = declaredLength;
  }
  return received;
}

// ---------------------------------------------------------------------------
// Background garbage collector
// ---------------------------------------------------------------------------

export interface GarbageCollectionOptions {
  cacheDir?: string;
  maxAgeMs?: number;
  maxTotalBytes?: number;
}

export interface GarbageCollectionResult {
  deletedFiles: number;
  deletedBytes: number;
  remainingBytes: number;
}

/** Delete artefacts older than maxAgeMs, then trim to maxTotalBytes. */
export async function collectCacheGarbage(
  options: GarbageCollectionOptions = {}
): Promise<GarbageCollectionResult> {
  const dir = options.cacheDir || DEFAULT_CACHE_DIR;
  const maxAgeMs = options.maxAgeMs ?? ROLLING_CACHE_MAX_AGE_MS;
  const maxTotalBytes = options.maxTotalBytes ?? ROLLING_CACHE_MAX_BYTES;

  const result: GarbageCollectionResult = {
    deletedFiles: 0,
    deletedBytes: 0,
    remainingBytes: 0
  };

  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return result;
  }

  const now = Date.now();
  interface Tracked {
    dataFile: string;
    metaFile: string | null;
    size: number;
    lastAccess: number;
  }
  const tracked: Tracked[] = [];
  const metas = new Set(entries.filter((name) => name.endsWith('.meta.json')));
  const datas = entries.filter((name) => name.endsWith('.cache'));

  for (const dataFile of datas) {
    const dataPath = path.join(dir, dataFile);
    const metaFile = dataFile.replace(/\.cache$/, '.meta.json');
    const metaPath = path.join(dir, metaFile);
    let size = 0;
    let lastAccess = now;
    try {
      const stat = await fsp.stat(dataPath);
      size = stat.size;
      lastAccess = stat.mtimeMs;
    } catch {
      continue;
    }
    let metaLastAccess = 0;
    if (metas.has(metaFile)) {
      try {
        const parsed = JSON.parse(await fsp.readFile(metaPath, 'utf8')) as CacheMeta;
        metaLastAccess = Number(parsed.lastAccess) || 0;
      } catch {
        metaLastAccess = 0;
      }
    }
    tracked.push({
      dataFile: dataPath,
      metaFile: metas.has(metaFile) ? metaPath : null,
      size,
      lastAccess: Math.max(lastAccess, metaLastAccess)
    });
  }

  const remove = async (entry: Tracked) => {
    try {
      await fsp.rm(entry.dataFile, { force: true });
      if (entry.metaFile) await fsp.rm(entry.metaFile, { force: true });
      result.deletedFiles += entry.metaFile ? 2 : 1;
      result.deletedBytes += entry.size;
    } catch {
      // best effort
    }
  };

  // 1) age-based eviction (8-hour rolling window)
  for (const entry of tracked) {
    if (now - entry.lastAccess > maxAgeMs) {
      await remove(entry);
      entry.size = 0;
    }
  }

  // 2) size-based eviction (oldest access first)
  let total = tracked.reduce((sum, entry) => sum + entry.size, 0);
  if (total > maxTotalBytes) {
    const alive = tracked
      .filter((entry) => entry.size > 0)
      .sort((a, b) => a.lastAccess - b.lastAccess);
    for (const entry of alive) {
      if (total <= maxTotalBytes) break;
      await remove(entry);
      total -= entry.size;
      entry.size = 0;
    }
  }

  // 3) orphaned meta files
  const remainingData = new Set(tracked.filter((entry) => entry.size > 0).map((entry) => path.basename(entry.dataFile)));
  for (const metaName of metas) {
    if (!remainingData.has(metaName.replace(/\.meta\.json$/, '.cache'))) {
      try {
        await fsp.rm(path.join(dir, metaName), { force: true });
        result.deletedFiles += 1;
      } catch {
        // best effort
      }
    }
  }

  result.remainingBytes = tracked.reduce((sum, entry) => sum + entry.size, 0);
  return result;
}

let gcTimer: NodeJS.Timeout | null = null;

/** Start the background garbage collector (idempotent). */
export function startCacheGarbageCollector(): void {
  if (gcTimer) return;
  const run = () => {
    collectCacheGarbage().catch(() => {});
  };
  run();
  gcTimer = setInterval(run, ROLLING_CACHE_GC_INTERVAL_MS);
  gcTimer.unref?.();
}

export function stopCacheGarbageCollector(): void {
  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }
}

export function getCacheDirectory(): string {
  return DEFAULT_CACHE_DIR;
}
