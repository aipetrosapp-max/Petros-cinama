import type { PrototypeMediaItem } from '../prototype/types';
import {
  isPlayableDirectMediaUrl,
  isPlayableHttpsMediaFile,
  isTrailerUrl
} from './mediaUrlValidator';

/**
 * Single source of truth for deciding whether a title can actually be played.
 *
 * Rules:
 *  - A direct HTTP(S) media URL is playable only if the strict validator accepts it.
 *  - Telegram post links are NEVER passed to <video>. They are converted to the
 *    Telethon HTTP gateway only when the operator explicitly configured it.
 *  - Unverified mirrors (abrtech.top / mehracdn redirects) are not treated as
 *    playable. They can return 503/404 and often serve MKV with a non-video MIME.
 *  - When nothing is playable we return null. Callers must show an honest
 *    "server under maintenance" state instead of injecting an unrelated clip.
 */

export const STREAM_GATEWAY_STORAGE_KEY = 'aipetros_stream_gateway_base';

export interface ResolvedStreamSource {
  url: string;
  kind: 'direct' | 'gateway' | 'cache';
  host: string;
}

export interface StreamAvailability {
  status: 'available' | 'requires_gateway' | 'unavailable';
  source: ResolvedStreamSource | null;
  reasonEn: string;
  reasonFa: string;
}

export interface ResolveOptions {
  preferredQualityId?: string;
  gatewayBase?: string | null;
}

export function normalizeGatewayBase(value?: string | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return '';
  return raw.replace(/\/+$/, '');
}

/**
 * True when the bundle runs in production (aipetros.xyz, APK, Electron…).
 * In production the app has no local rolling cache server, so relative
 * localhost routes and raw Telegram links must never be shown as playable.
 */
export function isProductionRuntime(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  return env.PROD === true || env.MODE === 'production';
}

function isLocalPlaybackHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** A title is verified-playable only through a direct HTTPS MP4/HLS file. */
export function hasVerifiedDirectSource(item: PrototypeMediaItem | null | undefined): boolean {
  if (!item) return false;
  return collectStreamCandidates(item).some(
    (candidate) => isPlayableHttpsMediaFile(candidate) && !isTrailerUrl(candidate)
  );
}

export function getConfiguredGatewayBase(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STREAM_GATEWAY_STORAGE_KEY);
      if (stored) return normalizeGatewayBase(stored);
    } catch {
      // private mode / storage disabled
    }
  }
  const envValue = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_STREAM_GATEWAY_URL;
  return normalizeGatewayBase(envValue);
}

/**
 * Accepts t.me/<channel>/<id>, t.me/c/<internalId>/<id>, telegram.me/...
 * Private channel URLs use the -100<internalId> peer format expected by Telethon.
 */
export function parseTelegramPostUrl(
  rawUrl?: string | null
): { channel: string; messageId: number } | null {
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

export function buildGatewayStreamUrl(
  telegramUrl?: string | null,
  gatewayBase?: string | null
): string | null {
  const base = normalizeGatewayBase(gatewayBase ?? getConfiguredGatewayBase());
  if (!base) return null;
  const post = parseTelegramPostUrl(telegramUrl);
  if (!post) return null;
  return `${base}/${encodeURIComponent(post.channel)}/${post.messageId}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isTelegramUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?(?:t\.me|telegram\.me)\//i.test(url);
}

function isUnverifiedMirror(url: string): boolean {
  const host = hostOf(url).toLowerCase();
  return host.includes('abrtech.top') || host.includes('mehracdn.com');
}

function qualityCandidates(item: PrototypeMediaItem, preferredQualityId?: string): string[] {
  const qualities = Array.isArray(item.qualities) ? item.qualities : [];
  const normalizedPreferred = preferredQualityId?.trim().toLowerCase();
  const ordered = normalizedPreferred
    ? [
        ...qualities.filter(
          (q) =>
            q.quality?.toLowerCase() === normalizedPreferred ||
            (q as { id?: string }).id === preferredQualityId
        ),
        ...qualities.filter(
          (q) =>
            q.quality?.toLowerCase() !== normalizedPreferred &&
            (q as { id?: string }).id !== preferredQualityId
        )
      ]
    : qualities;
  return ordered.map((q) => q.url).filter((url): url is string => Boolean(url));
}

export function collectStreamCandidates(
  item: PrototypeMediaItem | null | undefined,
  preferredQualityId?: string
): string[] {
  if (!item) return [];
  const qUrls = qualityCandidates(item, preferredQualityId);
  return [
    ...(qUrls.length > 0 ? qUrls : []),
    item.playableUrl,
    item.streamUrl,
    item.defaultStreamUrl,
    // Lowest priority: the raw upstream (Telegram post or cache descriptor).
    // Preserved so cache-route titles keep a resolvable origin.
    (item as { upstreamUrl?: string }).upstreamUrl,
    item.telegramUrl
  ].filter((url): url is string => Boolean(url));
}

/**
 * Resolve a title to exactly one playable source, or null.
 * `gatewayBase` is injectable so CLI tests can verify Telegram mapping without
 * starting a real gateway.
 */
export function resolvePlayableSource(
  item: PrototypeMediaItem | null | undefined,
  options: ResolveOptions = {}
): ResolvedStreamSource | null {
  if (!item) return null;
  const gatewayBase = normalizeGatewayBase(
    options.gatewayBase === undefined ? getConfiguredGatewayBase() : options.gatewayBase
  );

  for (const candidate of collectStreamCandidates(item, options.preferredQualityId)) {
    if (isUnverifiedMirror(candidate)) continue;

    // Immutable separation law: a trailer file may NEVER be resolved as the
    // movie stream. Trailers play only through the dedicated trailer mode.
    if (isTrailerUrl(candidate)) continue;

    // Stable upstream descriptor written by the Master Admin Panel publish:
    // it is by definition served through the same-origin rolling cache route.
    // In production (no local stream server exists) cache routes are skipped
    // entirely so the player never lands on the maintenance error state.
    if (candidate.startsWith('petros-cache://')) {
      const id = (item as { id?: string }).id;
      if (id && (!isProductionRuntime() || isLocalPlaybackHost())) {
        return { url: `/api/stream/cache/${id}`, kind: 'cache', host: 'same-origin' };
      }
      continue;
    }

    if (isTelegramUrl(candidate)) {
      const gatewayUrl = buildGatewayStreamUrl(candidate, gatewayBase);
      if (gatewayUrl) {
        return { url: gatewayUrl, kind: 'gateway', host: hostOf(gatewayUrl) };
      }
      continue;
    }

    if (candidate.startsWith('/api/stream/cache/')) {
      if (!isProductionRuntime() || isLocalPlaybackHost()) {
        return { url: candidate, kind: 'cache', host: 'same-origin' };
      }
      continue;
    }
    // petros-cache:// descriptors are same-origin cache routes too: map them
    // to the canonical route so the client never sends the scheme anywhere.
    if (candidate.startsWith('petros-cache://')) {
      const id = (item as { id?: string }).id;
      if (id) return { url: `/api/stream/cache/${id}`, kind: 'cache', host: 'same-origin' };
      continue;
    }

    if (isPlayableDirectMediaUrl(candidate)) {
      return { url: candidate, kind: 'direct', host: hostOf(candidate) };
    }
  }

  return null;
}

export function getStreamAvailability(
  item: PrototypeMediaItem | null | undefined,
  options: ResolveOptions = {}
): StreamAvailability {
  const source = resolvePlayableSource(item, options);
  if (source) {
    return {
      status: 'available',
      source,
      reasonEn:
        source.kind === 'gateway'
          ? 'Telegram gateway stream'
          : source.kind === 'cache'
            ? 'Rolling cache stream gateway (local stream server)'
            : 'Verified direct media',
      reasonFa:
        source.kind === 'gateway'
          ? 'استریم از گیت‌وی تلگرام'
          : source.kind === 'cache'
            ? 'گیت‌وی کش غلتان استریم (سرور استریم محلی)'
            : 'فایل مدیای مستقیم تأییدشده'
    };
  }

  const candidates = collectStreamCandidates(item, options.preferredQualityId);
  const telegramOnly = candidates.length > 0 && candidates.every(isTelegramUrl);
  if (telegramOnly) {
    return {
      status: 'requires_gateway',
      source: null,
      reasonEn: 'This title is hosted on Telegram. Configure the stream gateway to play it in-app.',
      reasonFa: 'این عنوان روی تلگرام میزبانی می‌شود. برای پخش درون‌برنامه‌ای، گیت‌وی استریم را فعال کنید.'
    };
  }

  return {
    status: 'unavailable',
    source: null,
    reasonEn: 'No verified direct media source is currently available for this title.',
    reasonFa: 'منبع پخش مستقیم و تأییدشده‌ای برای این عنوان در حال حاضر موجود نیست.'
  };
}

/**
 * Immutable playback law (client build):
 * "Under no circumstances may the app display a title whose full movie cannot
 * be played."
 *
 *  - PRODUCTION: a title is playable ONLY when it carries a verified direct
 *    HTTPS MP4/HLS/WebM file. Relative localhost routes (/api/stream/cache/…)
 *    and raw Telegram links (t.me) are always treated as non-playable.
 *  - DEV (localhost with the local stream server running): cache/gateway
 *    routes keep working so the operator can test the gateway.
 */
export function isItemPlayable(item: PrototypeMediaItem | null | undefined): boolean {
  if (hasVerifiedDirectSource(item)) return true;
  if (isProductionRuntime()) return false; // cache-route / t.me-only titles: never show
  return Boolean(resolvePlayableSource(item));
}
