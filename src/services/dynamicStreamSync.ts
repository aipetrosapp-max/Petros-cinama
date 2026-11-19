import type { PrototypeMediaItem } from '../prototype/types';
import { loadCatalogCache, saveCatalogCache } from './catalogCache';
import { isLegacyLocalOrTelegramUrl, isPlayableDirectMediaUrl, isPlayableHttpsMediaFile, isTrailerUrl } from './mediaUrlValidator';
import { resolveUniquePoster } from './posterRegistry';

/**
 * Dynamic URL & Stream Sync Service
 * ai petros / Petros Cinema (Aipetros-stream)
 * 
 * Automatically synchronizes streaming media sources and metadata
 * from a public GitHub repository file without requiring any complex CMS or server-side admin panel.
 */

export interface VideoStreamQualitySource {
  quality: '4K' | '1080p' | '720p' | '480p' | 'Auto';
  url: string;
  format?: 'hls' | 'mp4' | 'dash' | 'webm' | 'direct';
  bitrate?: number;
  fps?: number;
}

export interface DynamicStreamItem {
  id: string;
  title: string;
  titleFa: string;
  synopsis: string;
  synopsisFa: string;
  category: 'cinema' | 'ai-feature' | 'documentary' | 'live-stream' | 'short-film' | 'cyber-noir' | 'movie' | 'series' | 'anime';
  posterUrl: string;
  backdropUrl?: string;
  year?: number;
  durationSec: number;
  rating?: string;
  director?: string;
  tags?: string[];
  qualities: VideoStreamQualitySource[];
  defaultStreamUrl: string;
  sourceType?: 'hls' | 'mp4' | 'embed' | 'direct' | 'telegram' | string;
  telegramUrl?: string;
  /** stable upstream descriptor for the rolling cache gateway */
  upstreamUrl?: string;
  telegramPostId?: number;
  poster?: string;
  featured?: boolean;
  trendingRank?: number;
  isLive?: boolean;
  // AI Smart Routing & Folder Organization
  season?: number;
  episode?: number;
  seriesTitle?: string;
  mediaFolder?: string; // e.g. "Series/Breaking Bad/Season 01/1080p", "Movies/Interstellar/4K", "Telegram/LordMovie/Series/S01E05"
  originalSource?: string;
  playbackStatus?: 'available' | 'requires_gateway' | 'unavailable' | 'maintenance';
  playbackStatusReason?: string;
  trailerUrl?: string;
  subtitleUrl?: string;
  /** Two-tier geo policy (set by the Master Admin Agent only). */
  geoPolicy?: { mode: 'block' | 'allow'; countries: string[]; noteFa?: string; updatedAt?: string };
}

export interface DynamicStreamsManifest {
  version: string;
  updatedAt: string;
  brand: string;
  platform: string;
  syncSource: string;
  channelName?: string;
  streams: DynamicStreamItem[];
}

const STORAGE_SYNC_META = 'aipetros_sync_metadata_v1';
const FETCH_TIMEOUT_MS = 9000;
const STORAGE_CUSTOM_URL_KEY = 'aipetros_github_sync_url_override';

// Default public GitHub raw URL for the streaming source manifest
export const DEFAULT_GITHUB_STREAMS_URL = 
  'https://raw.githubusercontent.com/aipetrosapp-max/Petros-cinama/main/data/streams.json';

// Fallback mirror if primary GitHub raw URL is unreachable
export const FALLBACK_MIRROR_URL = '/data/streams.json';

type SyncListener = (streams: DynamicStreamItem[], metadata: { lastSyncedAt: string; source: string }) => void;

class DynamicStreamSyncService {
  private syncUrl: string;
  private syncListeners: Set<SyncListener> = new Set();
  private timerId: number | null = null;
  private currentStreams: DynamicStreamItem[] = [];
  private lastSyncedAt: string | null = null;
  private isSyncing = false;
  private syncIntervalMs = 5 * 60 * 1000; // 5 minutes periodic auto-check
  private cacheReady: Promise<void>;

  constructor() {
    this.syncUrl = this.getStoredSyncUrl();
    this.cacheReady = this.loadFromCache();
    
    // Auto sync on online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncNow(false).catch(() => {});
      });
    }
  }

  public getStoredSyncUrl(): string {
    if (typeof window === 'undefined') return DEFAULT_GITHUB_STREAMS_URL;
    return localStorage.getItem(STORAGE_CUSTOM_URL_KEY) || DEFAULT_GITHUB_STREAMS_URL;
  }

  public setSyncUrl(url: string) {
    this.syncUrl = url.trim() || DEFAULT_GITHUB_STREAMS_URL;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CUSTOM_URL_KEY, this.syncUrl);
    }
    this.syncNow(true).catch(() => {});
  }

  public resetSyncUrl() {
    this.setSyncUrl(DEFAULT_GITHUB_STREAMS_URL);
  }

  private async loadFromCache(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const cached = await loadCatalogCache<DynamicStreamItem>();
      if (cached && cached.length > 0) {
        // Purge stale cached entries pointing at the local rolling-cache
        // gateway (/api/stream/cache/) or raw Telegram posts: on production
        // builds they are unplayable and trigger the maintenance error box.
        const clean = cached.filter(isCleanStreamItem);
        this.currentStreams = clean;
        if (clean.length !== cached.length) {
          void saveCatalogCache(clean);
        }
      }
      const meta = localStorage.getItem(STORAGE_SYNC_META);
      if (meta) {
        const metaObj = JSON.parse(meta);
        this.lastSyncedAt = metaObj.lastSyncedAt || null;
      }
    } catch {
      // IndexedDB unavailable (private mode) — sync still works in memory.
    }
  }

  public getStreams(): DynamicStreamItem[] {
    return this.currentStreams;
  }

  /** Await this before relying on the persistent cache. */
  public async hydrate(): Promise<void> {
    await this.cacheReady;
  }

  public getLastSyncedTime(): string | null {
    return this.lastSyncedAt;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Fetch and synchronize the latest stream list from public GitHub repository or local bundle
   */
  public async syncNow(force = true): Promise<{ success: boolean; count: number; error?: string }> {
    if (this.isSyncing) {
      return { success: true, count: this.currentStreams.length };
    }

    this.isSyncing = true;
    try {
      await this.cacheReady;
      const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      const candidateUrls = [
        `${cleanBase}data/streams.json`,
        `${cleanBase}streams.json`,
        './data/streams.json',
        './streams.json',
        '/data/streams.json',
        this.syncUrl
      ];

      let data: DynamicStreamsManifest | null = null;
      let lastErr: any = null;

      for (const candidate of candidateUrls) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const targetUrl = candidate + (candidate.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
          const res = await fetch(targetUrl, {
            cache: force ? 'no-cache' : 'default',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          if (res.ok) {
            const parsed = await res.json();
            if (parsed && Array.isArray(parsed.streams) && parsed.streams.length > 0) {
              data = parsed;
              console.log(`[DynamicStreamSync] Successfully hydrated ${parsed.streams.length} titles from: ${candidate}`);
              break;
            }
          }
        } catch (e) {
          lastErr = e;
        } finally {
          clearTimeout(timer);
        }
      }

      if (!data || !Array.isArray(data.streams)) {
        throw new Error(`Failed to load valid cinema streams from candidates: ${lastErr?.message || 'Empty or unreachable manifest'}`);
      }

      // Merge remote streams with existing local custom streams so user streams are never lost
      const remoteIds = new Set(data.streams.map((s) => s.id));
      const userCustom = this.currentStreams.filter((s) => !remoteIds.has(s.id) && isCleanStreamItem(s));
      const cleanRemote = data.streams.filter(isCleanStreamItem);
      this.currentStreams = [...userCustom, ...cleanRemote];
      this.lastSyncedAt = new Date().toISOString();

      // Full catalog lives in IndexedDB. localStorage keeps only a tiny pointer.
      if (typeof window !== 'undefined') {
        const persisted = await saveCatalogCache(this.currentStreams);
        try {
          localStorage.setItem(STORAGE_SYNC_META, JSON.stringify({
            lastSyncedAt: this.lastSyncedAt,
            version: data.version || '2.4.0',
            source: this.syncUrl,
            count: this.currentStreams.length,
            persistedToIndexedDb: persisted
          }));
        } catch {
          // A blocked localStorage must not abort the catalog update.
        }
      }

      // Notify all active listeners
      this.notifyListeners();

      return { success: true, count: this.currentStreams.length };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('[ai petros Stream Sync] Failed to sync with stream repository:', errorMessage);
      return { success: false, count: this.currentStreams.length, error: errorMessage };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Save and persist custom ingested streams from Owner Portal directly into dynamic stream cache
   */
  public saveCustomStreams(streams: DynamicStreamItem[]) {
    this.currentStreams = streams;
    this.lastSyncedAt = new Date().toISOString();
    if (typeof window !== 'undefined') {
      void saveCatalogCache(this.currentStreams);
      try {
        localStorage.setItem(STORAGE_SYNC_META, JSON.stringify({
          lastSyncedAt: this.lastSyncedAt,
          version: '2.4.0',
          source: 'Owner AI Ingestion Portal',
          count: this.currentStreams.length
        }));
      } catch {
        // ignore storage quota/metadata failure
      }
    }
    this.notifyListeners();
  }

  public startPeriodicSync(intervalMs = this.syncIntervalMs) {
    this.stopPeriodicSync();
    this.syncIntervalMs = intervalMs;
    // Initial sync
    this.syncNow(false).catch(() => {});
    // Recurring timer
    if (typeof window !== 'undefined') {
      this.timerId = window.setInterval(() => {
        this.syncNow(false).catch(() => {});
      }, this.syncIntervalMs);
    }
  }

  public stopPeriodicSync() {
    if (this.timerId !== null && typeof window !== 'undefined') {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    // Call once immediately with current data
    if (this.currentStreams.length > 0) {
      listener(this.currentStreams, {
        lastSyncedAt: this.lastSyncedAt || new Date().toISOString(),
        source: this.syncUrl
      });
    }
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private notifyListeners() {
    const meta = {
      lastSyncedAt: this.lastSyncedAt || new Date().toISOString(),
      source: this.syncUrl
    };
    for (const listener of this.syncListeners) {
      try {
        listener(this.currentStreams, meta);
      } catch (err) {
        console.error('Error in stream sync listener:', err);
      }
    }
  }
}

export const dynamicStreamSync = new DynamicStreamSyncService();

const DEFAULT_CINEMA_POSTERS = [
  'https://image.tmdb.org/t/p/w780/gKkl37BQuKTanygYQG1pyYgLVgf.jpg', // Interstellar
  'https://image.tmdb.org/t/p/w780/2H1TmgdfNbfKlUkIYwODGe94LEv.jpg', // X-Men Apocalypse
  'https://image.tmdb.org/t/p/w780/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', // Dune
  'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', // Oppenheimer
  'https://image.tmdb.org/t/p/w780/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', // Blade Runner 2049
  'https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
  'https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'  // The Matrix
];

/**
 * Legacy guard: a stream whose playable links only point at the local rolling
 * cache route, a raw Telegram post, a trailer file, or the shared fake demo
 * clip can never play as the full movie on the production build. Such stale
 * entries are purged from every cache layer at load/sync time.
 */
export function isCleanStreamItem(stream: DynamicStreamItem): boolean {
  const record = stream as unknown as {
    defaultStreamUrl?: string;
    playableUrl?: string;
    streamUrl?: string;
    upstreamUrl?: string;
    telegramUrl?: string;
    qualities?: { url?: string }[];
  };
  const urls = [
    record.defaultStreamUrl,
    record.playableUrl,
    record.streamUrl,
    record.upstreamUrl,
    record.telegramUrl,
    ...(Array.isArray(record.qualities) ? record.qualities.map((q) => q.url) : [])
  ].filter((u): u is string => Boolean(u));

  // Legacy cache-route / raw-Telegram links: always stale.
  if (urls.some(isLegacyLocalOrTelegramUrl)) return false;

  // The stream must offer at least one full-movie file (NOT a trailer, NOT a
  // fake demo clip): a verified HTTPS MP4/HLS/WebM in production, or any
  // validated direct media route while running on the local dev gateway.
  const movieFiles = urls.filter((u) => !isTrailerUrl(u));
  const hasMovieFile = movieFiles.some(
    (u) => isPlayableHttpsMediaFile(u) || isPlayableDirectMediaUrl(u)
  );
  return hasMovieFile;
}

export function getFallbackPoster(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % DEFAULT_CINEMA_POSTERS.length;
  }
  return DEFAULT_CINEMA_POSTERS[hash];
}

export function convertDynamicStreamToMediaItem(stream: DynamicStreamItem): PrototypeMediaItem {
  const displayTitle = stream.titleFa || stream.title || stream.id;
  return {
    id: stream.id,
    titleEn: stream.title,
    titleFa: stream.titleFa || stream.title,
    creatorEn: stream.director || 'Petros Cinema',
    creatorFa: stream.director || 'سینما هوش مصنوعی پتروس',
    categoryEn: stream.category.toUpperCase(),
    categoryFa: stream.category === 'cyber-noir' ? 'سایبرنوآر' :
                stream.category === 'anime' ? 'انیمه' :
                stream.category === 'series' ? 'سریال' :
                stream.category === 'live-stream' ? 'پخش زنده' :
                stream.category === 'ai-feature' ? 'فیلم هوش مصنوعی' :
                stream.category === 'documentary' ? 'مستند' : 'سینما',
    clusterId: stream.category === 'cyber-noir' ? 'neon-futures' : 'noir-shadows',
    clusterLabelEn: 'Aipetros Cloud Stream',
    clusterLabelFa: 'استریم ابری پتروس',
    durationSec: Number(stream.durationSec) > 0 ? Number(stream.durationSec) : 0,
    quality: (stream.qualities && Array.isArray(stream.qualities) && stream.qualities.some(q => q.quality === '4K')) ? '4K HDR' : '1080p',
    releaseYear: stream.year || 0,
    addedDaysAgo: 0,
    posterUrl: resolveUniquePoster(displayTitle, stream.id, stream.posterUrl || (stream as any).poster),
    accentHex: '#F5B942',
    synopsisEn: stream.synopsis,
    synopsisFa: stream.synopsisFa || stream.synopsis,
    tags: [
      ...(Array.isArray(stream.tags) ? stream.tags : ['Aipetros', '4K']),
      ...(stream.mediaFolder ? [stream.mediaFolder] : []),
      ...(stream.season ? [`Season ${stream.season}`] : []),
      ...(stream.episode ? [`Episode ${stream.episode}`] : []),
      ...(stream.seriesTitle ? [stream.seriesTitle] : []),
      ...(stream.defaultStreamUrl ? [stream.defaultStreamUrl] : []),
      ...(stream.originalSource ? [stream.originalSource] : [])
    ],
    tagsFa: [
      ...(Array.isArray(stream.tags) ? stream.tags : ['پتروس', 'کیفیت بالا']),
      ...(stream.mediaFolder ? [stream.mediaFolder] : []),
      ...(stream.season ? [`فصل ${stream.season}`] : []),
      ...(stream.episode ? [`قسمت ${stream.episode}`] : []),
      ...(stream.seriesTitle ? [stream.seriesTitle] : [])
    ],
    vector: {
      tension: 0.8,
      pace: 0.6,
      surrealism: 0.7,
      nocturnal: 0.9,
      intimacy: 0.5,
      depth: 0.85
    },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Petros Cinema Verified Source',
    streamUrl: '',
    defaultStreamUrl: stream.defaultStreamUrl || stream.telegramUrl,
    playableUrl: stream.defaultStreamUrl || stream.telegramUrl,
    upstreamUrl: stream.upstreamUrl,
    telegramUrl: stream.telegramUrl || stream.defaultStreamUrl,
    trailerUrl: stream.trailerUrl,
    streamStatus: stream.playbackStatus || 'unavailable',
    streamStatusReason: stream.playbackStatusReason,
    subtitleUrl: stream.subtitleUrl,
    sourceType: stream.sourceType || (stream.defaultStreamUrl?.includes('t.me') ? 'telegram' : 'direct_mp4'),
    originalSource: stream.originalSource,
    qualities: stream.qualities || [],
    subtitles: [],
    geoPolicy: stream.geoPolicy,
    chapters: [],
    spatialPos: { x: 0, y: 0, z: -100 }
  };
}
