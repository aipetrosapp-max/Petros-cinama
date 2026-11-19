/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Domain model: media archive (movies / series / anime), seasons & episodes,
 * multi-quality streams, subtitle tracks, sources, wallet vault and API tokens.
 *
 * This model is the single contract between:
 *   - the Admin Panel (React SPA)
 *   - the server API (/api/admin/*)
 *   - the GitHub Live Sync Engine (data/streams.json, data/admin-config.json)
 *   - every installed client (Dynamic Stream Sync + rolling cache)
 */

export type MediaCategory = 'movie' | 'series' | 'anime';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type PlaybackKind = 'direct_mp4' | 'hls' | 'telegram_gateway' | 'cache_gateway';
export type SubtitleFormat = 'srt' | 'vtt';

export const QUALITY_PRESETS = ['4K HDR', '1080p', '720p', '480p'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export interface QualityStream {
  id: string;
  quality: string;
  url: string;
  format: PlaybackKind;
  bitrateKbps?: number;
  fps?: number;
  sizeBytes?: number;
  /** subtitle / quality label shown in the player */
  label?: string;
  /** Optional HTTP Basic Auth credentials for VIP sources */
  username?: string;
  password?: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  languageFa: string;
  format: SubtitleFormat;
  /** absolute URL to the .srt / .vtt file */
  url: string;
  /** time offset in milliseconds applied by the client */
  offsetMs: number;
  forced?: boolean;
  label?: string;
}

export interface EpisodeRecord {
  id: string;
  titleId: string;
  season: number;
  episode: number;
  title: string;
  titleFa?: string;
  overview?: string;
  durationSec?: number;
  posterUrl?: string;
  qualities: QualityStream[];
  subtitles: SubtitleTrack[];
  status: ContentStatus;
  releaseDate?: string;
}

export interface SeasonRecord {
  id: string;
  titleId: string;
  season: number;
  title: string;
  titleFa?: string;
  overview?: string;
  posterUrl?: string;
  status: ContentStatus;
}

export interface TitleRecord {
  id: string;
  title: string;
  titleFa: string;
  originalTitle?: string;
  category: MediaCategory;
  year?: number;
  rating?: number;
  synopsis?: string;
  synopsisFa?: string;
  director?: string;
  cast?: string[];
  genres?: string[];
  tags?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  durationSec?: number;
  contentRating?: string;
  status: ContentStatus;
  featured?: boolean;
  trendingRank?: number;
  /** movie → single stream set; series/anime → per season/episode */
  qualities: QualityStream[];
  subtitles: SubtitleTrack[];
  seasons: SeasonRecord[];
  episodes: EpisodeRecord[];
  /** offline / low-bandwidth download mirrors */
  downloadLinks?: Array<{ id: string; label: string; url: string; sizeBytes?: number }>;
  /** Two-tier geo policy (admin-only): block = hidden in listed countries; allow = visible ONLY in listed countries. */
  geoPolicy?: { mode: 'block' | 'allow'; countries: string[]; noteFa?: string; updatedAt?: string };
  createdAt: string;
  updatedAt: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  nameFa?: string;
  kind: PlaybackKind;
  baseUrl?: string;
  homepage?: string;
  status: 'active' | 'disabled';
  notes?: string;
  /** Telegram gateway uses the local range gateway (default port 8089) */
  gatewayPort?: number;
  /** VIP credentials for auto-authenticating stream links on this domain */
  username?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

/** Editable public-domain collection entry (archive.org item). */
export interface CollectionItem {
  title: string;
  year?: number | null;
  identifier: string;
}

export interface WalletRecord {
  id: string;
  network: 'BTC' | 'ETH' | 'USDT-TRC20' | 'TON' | 'USDT-ERC20' | 'LTC';
  address: string;
  label?: string;
  enabled: boolean;
  /** smallest unit, e.g. 8 for BTC */
  decimals: number;
  createdAt: string;
  updatedAt: string;
}

export type ApiTokenKey = 'github' | 'telegram_bot' | 'gemini' | 'telegram_api_hash';

export interface ApiTokenRecord {
  id: ApiTokenKey;
  label: string;
  labelFa: string;
  /** never returned to the client; only a masked preview + presence flag */
  value?: string;
  updatedAt?: string;
  required: boolean;
  description?: string;
}

export interface FeatureFlags {
  donationEnabled: boolean;
  cryptoPaymentEnabled: boolean;
  cryptoAdBannerEnabled: boolean;
  watchPartyEnabled: boolean;
  offlineDownloadEnabled: boolean;
  telegramGatewayEnabled: boolean;
  aiSubtitleSyncEnabled: boolean;
  maintenanceMode: boolean;
}

export interface SubtitleFileRecord {
  /** served path relative to the site root, e.g. ./subtitles/interstellar.fa.vtt */
  url: string;
  /** local file under public/subtitles */
  localPath: string;
  /** path committed inside the GitHub repository */
  repoPath: string;
  filename: string;
  format: SubtitleFormat;
  sizeBytes: number;
  uploadedAt: string;
}

export interface AdminConfig {
  version: number;
  /** bumped on every publish → clients pick up the change instantly */
  manifestVersion: string;
  features: FeatureFlags;
  wallets: WalletRecord[];
  tokens: ApiTokenRecord[];
  sources: SourceRecord[];
  /** uploaded SRT/VTT files that ship with the publish commit */
  subtitleFiles?: SubtitleFileRecord[];
  updatedAt: string;
}

export interface AdminCatalogFile {
  version: string;
  updatedAt: string;
  brand?: string;
  platform?: string;
  channelName?: string;
  streams: TitleRecord[];
}

export interface GithubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  /** path of the catalog inside the repository */
  catalogPath: string;
  /** path of the admin config inside the repository */
  configPath: string;
}

// ---------------------------------------------------------------------------
// Validation helpers (shared by the API and the panel)
// ---------------------------------------------------------------------------

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function classifyPlayback(url: string): PlaybackKind | null {
  if (!isValidHttpUrl(url)) return null;
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  if (lower.includes('/api/stream/cache/')) return 'cache_gateway';
  if (lower.includes('t.me/') || lower.includes('telegram.me/')) return 'telegram_gateway';
  if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mkv')) return 'direct_mp4';
  return 'direct_mp4';
}

export function validateQualityStream(input: Partial<QualityStream>): string | null {
  if (!input.url || !isValidHttpUrl(input.url)) {
    return 'آدرس استریم معتبر نیست (باید http/https باشد).';
  }
  if (!input.quality || !input.quality.trim()) {
    return 'نام کیفیت الزامی است.';
  }
  if (input.fps !== undefined && (input.fps < 0 || input.fps > 240)) {
    return 'فریم‌ریت باید بین ۰ تا ۲۴۰ باشد.';
  }
  if (input.bitrateKbps !== undefined && input.bitrateKbps < 0) {
    return 'بیت‌ریت نمی‌تواند منفی باشد.';
  }
  return null;
}

export function validateSubtitleTrack(input: Partial<SubtitleTrack>): string | null {
  if (!input.language || !input.language.trim()) return 'زبان زیرنویس الزامی است.';
  if (!input.url || !isValidHttpUrl(input.url)) {
    return 'آدرس فایل زیرنویس معتبر نیست.';
  }
  if (!/\.(srt|vtt)(\?|$)/i.test(input.url)) {
    return 'فرمت فایل زیرنویس باید srt یا vtt باشد.';
  }
  if (input.offsetMs !== undefined && Math.abs(input.offsetMs) > 10 * 60 * 1000) {
    return 'آفست زمانی نمی‌تواند بیشتر از ۱۰ دقیقه باشد.';
  }
  return null;
}

export function validateTitle(input: Partial<TitleRecord>): string | null {
  // Geo-only partial updates (from the inline geo control) skip full-title validation.
  const geoOnly = 'geoPolicy' in input && Object.keys(input).length === 1;
  if (!geoOnly) {
    if (!input.title?.trim() && !input.titleFa?.trim()) {
      return 'حداقل یکی از عنوان فارسی یا انگلیسی الزامی است.';
    }
    if (!input.category || !['movie', 'series', 'anime'].includes(input.category)) {
      return 'دسته‌بندی باید یکی از movie / series / anime باشد.';
    }
  }
  if (input.year !== undefined && (input.year < 1888 || input.year > 2100)) {
    return 'سال انتشار نامعتبر است.';
  }
  if (input.durationSec !== undefined && input.durationSec < 0) {
    return 'مدت زمان نمی‌تواند منفی باشد.';
  }
  if (input.category === 'movie' && input.qualities && input.qualities.length > 0) {
    for (const q of input.qualities) {
      const error = validateQualityStream(q);
      if (error) return `کیفیت: ${error}`;
    }
  }
  return null;
}

export function countEpisodes(titles: TitleRecord[]): number {
  return titles.reduce((sum, t) => sum + (t.episodes?.length || 0), 0);
}

export function countSeasons(titles: TitleRecord[]): number {
  return titles.reduce((sum, t) => sum + (t.seasons?.length || 0), 0);
}

export function countQualities(titles: TitleRecord[]): number {
  return titles.reduce(
    (sum, t) =>
      sum +
      (t.qualities?.length || 0) +
      (t.episodes || []).reduce((ep, e) => ep + (e.qualities?.length || 0), 0),
    0
  );
}

export function countSubtitles(titles: TitleRecord[]): number {
  return titles.reduce(
    (sum, t) =>
      sum +
      (t.subtitles?.length || 0) +
      (t.episodes || []).reduce((ep, e) => ep + (e.subtitles?.length || 0), 0),
    0
  );
}
