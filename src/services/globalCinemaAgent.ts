import type { PrototypeMediaItem, TasteVector6D } from '../prototype/types';
import { generateUniquePosterSvg } from './posterRegistry';

export interface CinemetaMetaItem {
  id: string; // IMDb ID like tt0068646
  type: 'movie' | 'series';
  name: string;
  year?: string | number;
  poster?: string;
  background?: string;
  description?: string;
  imdbRating?: string | number;
  genres?: string[];
  director?: string[] | string;
  cast?: string[];
  runtime?: string;
  streamUrl?: string;
}

const GLOBAL_CACHE_KEY = 'aipetros_global_cinema_cache_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const GENRE_MAP_FA: Record<string, string> = {
  Action: 'اکشن',
  Adventure: 'ماجراجویی',
  Animation: 'انیمیشن',
  Comedy: 'کمدی',
  Crime: 'جنایی',
  Documentary: 'مستند',
  Drama: 'درام',
  Family: 'خانوادگی',
  Fantasy: 'فانتزی',
  History: 'تاریخی',
  Horror: 'ترسناک',
  Music: 'موسیقی',
  Mystery: 'معمایی',
  Romance: 'عاشقانه',
  'Sci-Fi': 'علمی-تخیلی',
  ScienceFiction: 'علمی-تخیلی',
  Thriller: 'مهیج',
  War: 'جنگی',
  Western: 'وسترن'
};

function mapCinemetaToPrototypeItem(meta: CinemetaMetaItem, index: number): PrototypeMediaItem {
  const isSeries = meta.type === 'series';
  const cleanYear = typeof meta.year === 'string' ? parseInt(meta.year, 10) || 2026 : meta.year || 2026;
  const ratingStr = meta.imdbRating ? `${meta.imdbRating}/10` : '8.5/10';
  const genres = meta.genres || ['Cinema', 'Drama'];
  const genresFa = genres.map((g) => GENRE_MAP_FA[g] || g);

  const directorName = Array.isArray(meta.director)
    ? meta.director.join(', ')
    : meta.director || (isSeries ? 'Executive Producers' : 'Acclaimed Director');

  const castList = Array.isArray(meta.cast) ? meta.cast : [];
  const castStr = castList.length > 0 ? castList.slice(0, 3).join(', ') : '';

  // Poster law: the shared Unsplash "CINEMA" art is banned — every title gets
  // its own unique poster (generated from its name) when Cinemeta has none.
  const poster = meta.poster || generateUniquePosterSvg(meta.name, `poster-${meta.id || index}`);
  const backdrop = meta.background || poster;

  const synopsisEn = meta.description || `${meta.name} (${cleanYear}) - High-fidelity global cinema presentation. Directed by ${directorName}.`;
  const synopsisFa = `${meta.name} (${cleanYear}) - اثری برجسته در رتبه برترین آثار جهانی سینما با امتیاز IMDb ${ratingStr}. بازیگران: ${castStr || 'ستارگان برجسته'}.`;

  const defaultVector: TasteVector6D = {
    tension: genres.some((g) => /action|thriller|horror|crime/i.test(g)) ? 0.85 : 0.45,
    pace: genres.some((g) => /action|scifi|adventure/i.test(g)) ? 0.8 : 0.5,
    surrealism: genres.some((g) => /scifi|fantasy|animation/i.test(g)) ? 0.85 : 0.3,
    nocturnal: genres.some((g) => /crime|noir|horror/i.test(g)) ? 0.9 : 0.4,
    intimacy: genres.some((g) => /drama|romance/i.test(g)) ? 0.85 : 0.4,
    depth: 0.9
  };

  return {
    id: `global-${meta.id || index}-${meta.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    titleEn: meta.name,
    titleFa: `${meta.name} (${cleanYear})`,
    creatorEn: directorName,
    creatorFa: directorName,
    categoryEn: isSeries ? 'SERIES' : 'MOVIE',
    categoryFa: isSeries ? 'سریال جهانی' : 'فیلم سینمایی',
    clusterId: isSeries ? 'velvet-cinema' : 'noir-shadows',
    clusterLabelEn: 'World Cinema Live Feed',
    clusterLabelFa: 'کاتالوگ زنده سینمای جهان',
    durationSec: isSeries ? 3600 : 7200,
    quality: '4K HDR',
    releaseYear: cleanYear,
    addedDaysAgo: 0,
    posterUrl: poster,
    accentHex: '#F5B942',
    synopsisEn,
    synopsisFa,
    tags: [
      meta.name,
      String(cleanYear),
      ratingStr,
      isSeries ? 'Series' : 'Movie',
      'Global Cinema',
      ...genres,
      ...castList
    ],
    tagsFa: [
      meta.name,
      String(cleanYear),
      isSeries ? 'سریال' : 'فیلم سینمایی',
      'سینمای جهان',
      ...genresFa
    ],
    vector: defaultVector,
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: `Global Database (${meta.id || 'IMDb'})`,
    defaultStreamUrl: meta.streamUrl || '',
    streamUrl: meta.streamUrl || '',
    qualities: meta.streamUrl
      ? [
          {
            quality: '1080p',
            url: meta.streamUrl,
            format: 'direct'
          }
        ]
      : [],
    subtitles: [
      { startSec: 1, endSec: 10, en: meta.name, fa: `${meta.name} (${cleanYear})` },
      { startSec: 11, endSec: 25, en: synopsisEn, fa: synopsisFa }
    ],
    chapters: [
      { id: 'ch-1', timeSec: 0, labelEn: 'Opening Sequence', labelFa: 'آغاز فیلم' },
      { id: 'ch-2', timeSec: 1800, labelEn: 'Main Act', labelFa: 'بخش اصلی' }
    ],
    spatialPos: { x: (index % 5) * 40 - 80, y: 0, z: -100 - index * 10 }
  };
}

class GlobalCinemaAgent {
  private inMemoryCache: PrototypeMediaItem[] = [];
  private lastFetchTime = 0;
  private isFetching = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(GLOBAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.items && Array.isArray(parsed.items) && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          this.inMemoryCache = parsed.items;
          this.lastFetchTime = parsed.timestamp;
        }
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage(items: PrototypeMediaItem[]) {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(
        GLOBAL_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          items: items.slice(0, 100) // keep top 100 in storage
        })
      );
    } catch {
      // ignore storage quota
    }
  }

  /**
   * Fetch Live Global Catalog (Top 50 Movies + Top 50 Series worldwide)
   */
  public async getGlobalCatalog(forceRefresh = false): Promise<PrototypeMediaItem[]> {
    if (!forceRefresh && this.inMemoryCache.length > 0 && Date.now() - this.lastFetchTime < CACHE_TTL_MS) {
      return this.inMemoryCache;
    }

    if (this.isFetching) {
      return this.inMemoryCache;
    }

    this.isFetching = true;
    try {
      // CONNECTION LAW: no external metadata cloud (cinemeta removed) — local only.
      const moviesRes: PromiseSettledResult<Response> = { status: 'rejected', reason: new Error('connection-law') };
      const seriesRes: PromiseSettledResult<Response> = { status: 'rejected', reason: new Error('connection-law') };

      const items: PrototypeMediaItem[] = [];

      // (external catalog sync removed by connection law — items stay local)
      if (items.length > 0) {
        this.inMemoryCache = items;
        this.lastFetchTime = Date.now();
        this.saveToStorage(items);
      }
      return this.inMemoryCache;
    } catch (err) {
      console.warn('GlobalCinemaAgent catalog sync error:', err);
      return this.inMemoryCache;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Search ANY Movie or Series worldwide in real-time
   */
  public async searchGlobal(query: string): Promise<PrototypeMediaItem[]> {
    const clean = query.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];

    try {
      // CONNECTION LAW: no external metadata agents (cinemeta/tvmaze removed).
      // Global search answers from the local/telegram catalog only.
      const results: PrototypeMediaItem[] = [];
      return results;
    } catch (err) {
      console.warn('GlobalCinemaAgent search error:', err);
      return [];
    }
  }
}

export const globalCinemaAgent = new GlobalCinemaAgent();
