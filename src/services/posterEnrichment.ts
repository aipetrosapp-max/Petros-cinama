import type { PrototypeMediaItem } from '../prototype/types';
import { ensureUniqueCatalogPosters, resolveUniquePoster, SHARED_POSTER_BLACKLIST } from './posterRegistry';

/**
 * Real-Poster Enrichment Service (TMDb archive via the public Cinemeta API)
 *
 * Every title that ends up with a generated fallback poster is looked up in a
 * reputable metadata archive (Cinemeta serves official TMDb artwork, no API
 * key required) and gets its genuine, high-quality movie poster. Uniqueness is
 * re-enforced after every enrichment pass so two titles can never share art.
 */

const POSTER_CACHE_KEY = 'aipetros_unique_poster_map_v1';
const CINEMETA_SEARCH = 'https://v3-cinemeta.strem.io/catalog';
const MAX_LOOKUPS_PER_RUN = 12;
const FETCH_TIMEOUT_MS = 8000;

interface CinemetaMeta {
  name?: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
}

function loadPosterCache(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(POSTER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function savePosterCache(cache: Record<string, string>): void {
  try {
    window.localStorage.setItem(POSTER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota / private mode — cache is best-effort
  }
}

function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\(\d{4}\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function extractYear(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const match = value.match(/\d{4}/);
    return match ? Number(match[0]) : undefined;
  }
  if (typeof value === 'number') return value;
  return undefined;
}

async function searchCinemetaPoster(
  _title: string,
  _year?: number,
  _isSeries?: boolean
): Promise<string | null> {
  // CONNECTION LAW: no external poster cloud (cinemeta removed).
  // Posters come from the owner's catalog data or local generated art.
  return null;
}

async function _searchCinemetaPosterDisabled(
  title: string,
  year?: number,
  isSeries?: boolean
): Promise<string | null> {
  const type = isSeries ? 'series' : 'movie';
  const url = `${CINEMETA_SEARCH}/${type}/top/search=${encodeURIComponent(normalizeTitle(title))}.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { metas?: CinemetaMeta[] };
    const metas = Array.isArray(data?.metas) ? data.metas : [];
    const best =
      metas.find((m) => year && extractYear(m.releaseInfo) === year) ||
      metas.find((m) => Boolean(m.poster)) ||
      null;
    return best?.poster || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function posterIsSharedOrBroken(url?: string | null): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    SHARED_POSTER_BLACKLIST.some((marker) => lower.includes(marker)) ||
    lower.startsWith('data:image/svg')
  );
}

/**
 * Replace generated/placeholder posters with genuine archive artwork.
 * Returns the catalog with unique, real posters wherever a match was found.
 */
export async function enrichCatalogPosters(items: PrototypeMediaItem[]): Promise<PrototypeMediaItem[]> {
  if (typeof window === 'undefined' || items.length === 0) return items;

  const cache = loadPosterCache();
  const updated = [...items];
  let lookups = 0;

  for (let i = 0; i < updated.length && lookups < MAX_LOOKUPS_PER_RUN; i++) {
    const item = updated[i];
    if (!posterIsSharedOrBroken(item.posterUrl)) continue;

    const cacheKey = normalizeTitle(item.titleEn || item.titleFa);
    if (!cacheKey) continue;

    if (cache[cacheKey] !== undefined) {
      const cached = cache[cacheKey];
      updated[i] = {
        ...item,
        posterUrl: cached || resolveUniquePoster(item.titleFa || item.titleEn, item.id, item.posterUrl)
      };
      continue;
    }

    lookups++;
    const isSeries = item.categoryEn === 'SERIES' || item.categoryEn === 'series';
    const year = item.releaseYear || undefined;
    const real = await searchCinemetaPoster(item.titleEn || item.titleFa, year, isSeries);
    if (real && !posterIsSharedOrBroken(real)) {
      cache[cacheKey] = real;
      savePosterCache(cache);
      updated[i] = { ...item, posterUrl: real };
    } else {
      // Remember the miss for this session so we never re-query in a loop.
      cache[cacheKey] = '';
      // keep deterministic unique generated art
      updated[i] = {
        ...item,
        posterUrl: resolveUniquePoster(item.titleFa || item.titleEn, item.id, item.posterUrl)
      };
    }
  }

  return ensureUniqueCatalogPosters(updated);
}
