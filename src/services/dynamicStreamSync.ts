import type { PrototypeMediaItem } from '../prototype/types';

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
  sourceType: 'hls' | 'mp4' | 'embed' | 'direct';
  featured?: boolean;
  trendingRank?: number;
  isLive?: boolean;
  // AI Smart Routing & Folder Organization
  season?: number;
  episode?: number;
  seriesTitle?: string;
  mediaFolder?: string; // e.g. "Series/Breaking Bad/Season 01/1080p", "Movies/Interstellar/4K", "Telegram/LordMovie/Series/S01E05"
  originalSource?: string;
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

const STORAGE_SYNC_KEY = 'aipetros_dynamic_streams_v1';
const STORAGE_SYNC_META = 'aipetros_sync_metadata_v1';
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

  constructor() {
    this.syncUrl = this.getStoredSyncUrl();
    this.loadFromCache();
    
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

  private loadFromCache(): DynamicStreamItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(STORAGE_SYNC_KEY);
      const meta = localStorage.getItem(STORAGE_SYNC_META);
      if (cached) {
        this.currentStreams = JSON.parse(cached);
      }
      if (meta) {
        const metaObj = JSON.parse(meta);
        this.lastSyncedAt = metaObj.lastSyncedAt || null;
      }
    } catch {
      // ignore parse error
    }
    return this.currentStreams;
  }

  public getStreams(): DynamicStreamItem[] {
    if (this.currentStreams.length === 0) {
      this.loadFromCache();
    }
    return this.currentStreams;
  }

  public getLastSyncedTime(): string | null {
    return this.lastSyncedAt;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Fetch and synchronize the latest stream list from public GitHub repository
   */
  public async syncNow(force = true): Promise<{ success: boolean; count: number; error?: string }> {
    if (this.isSyncing) {
      return { success: true, count: this.currentStreams.length };
    }

    this.isSyncing = true;
    try {
      const targetUrl = this.syncUrl + (this.syncUrl.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
      let response: Response;

      try {
        response = await fetch(targetUrl, {
          cache: force ? 'no-cache' : 'default',
          headers: {
            'Accept': 'application/json'
          }
        });
      } catch {
        // Fallback to local mirror or cache if network failed
        response = await fetch(FALLBACK_MIRROR_URL + `?_t=${Date.now()}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data: DynamicStreamsManifest = await response.json();
      if (!data || !Array.isArray(data.streams)) {
        throw new Error('Invalid streams format in public GitHub manifest');
      }

      // Merge remote streams with existing local custom streams so user streams are never lost
      const remoteIds = new Set(data.streams.map((s) => s.id));
      const userCustom = this.currentStreams.filter((s) => !remoteIds.has(s.id));
      this.currentStreams = [...userCustom, ...data.streams];
      this.lastSyncedAt = new Date().toISOString();

      // Persist to local cache
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(this.currentStreams));
        localStorage.setItem(STORAGE_SYNC_META, JSON.stringify({
          lastSyncedAt: this.lastSyncedAt,
          version: data.version || '1.0.0',
          source: this.syncUrl,
          count: this.currentStreams.length
        }));
      }

      // Notify all active listeners
      this.notifyListeners();

      return { success: true, count: this.currentStreams.length };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('[ai petros Stream Sync] Failed to sync with remote GitHub file:', errorMessage);
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
      localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(this.currentStreams));
      localStorage.setItem(STORAGE_SYNC_META, JSON.stringify({
        lastSyncedAt: this.lastSyncedAt,
        version: '2.4.0',
        source: 'Owner AI Ingestion Portal',
        count: this.currentStreams.length
      }));
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
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&auto=format&fit=crop&q=80'
];

export function getFallbackPoster(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % DEFAULT_CINEMA_POSTERS.length;
  }
  return DEFAULT_CINEMA_POSTERS[hash];
}

export function convertDynamicStreamToMediaItem(stream: DynamicStreamItem): PrototypeMediaItem {
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
    durationSec: stream.durationSec || 600,
    quality: stream.qualities.some(q => q.quality === '4K') ? '4K HDR' : '1080p',
    releaseYear: stream.year || 2026,
    addedDaysAgo: 0,
    posterUrl: stream.posterUrl || getFallbackPoster(stream.id),
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
    sourceName: 'GitHub Cloud Sync (Petros Cinema)',
    streamUrl: stream.defaultStreamUrl,
    defaultStreamUrl: stream.defaultStreamUrl,
    originalSource: stream.originalSource,
    qualities: stream.qualities,
    subtitles: [
      { startSec: 1, endSec: 8, en: stream.title, fa: stream.titleFa || stream.title },
      { startSec: 9, endSec: 25, en: stream.synopsis, fa: stream.synopsisFa || stream.synopsis }
    ],
    chapters: [
      { id: 'ch-1', timeSec: 0, labelEn: 'Opening Sequence', labelFa: 'آغاز' },
      { id: 'ch-2', timeSec: Math.floor((stream.durationSec || 600) / 2), labelEn: 'Climax & AI Vision', labelFa: 'نقطه اوج' }
    ],
    spatialPos: { x: 0, y: 0, z: -100 }
  };
}
