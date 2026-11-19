/**
 * PETROS CINEMA — Two-Tier Geographic Gate (سطح‌بندی جغرافیایی)
 *
 * Tier A (no geoPolicy)      → visible everywhere.
 * Tier B `block`             → hidden in the listed countries, visible elsewhere.
 * Tier B `allow`             → visible ONLY in the listed countries.
 *
 * The visitor country is detected once at app entry from several free geo-IP
 * providers (no key), cached for 1 hour. Detection failure ⇒ 'UNKNOWN':
 * Tier A stays visible; Tier B titles stay hidden (strict admin control).
 * Only the Master Admin Agent / Admin Panel can change the policies.
 */

const CACHE_KEY = 'aipetros_geo_country_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface GeoPolicy {
  mode: 'block' | 'allow';
  countries: string[];
  noteFa?: string;
  updatedAt?: string;
}

export interface GeoVisibleRecord {
  geoPolicy?: GeoPolicy;
}

let cachedCountry: string | null = null;

export function normalizeCountryCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().slice(0, 2);
}

/** Read the detected country from cache (no network). */
export function getCachedCountry(): string | null {
  if (cachedCountry) return cachedCountry;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && typeof raw.country === 'string' && Date.now() - raw.at < CACHE_TTL_MS) {
      cachedCountry = raw.country;
    }
  } catch {
    // no cache
  }
  return cachedCountry;
}

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response | null> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(ms), cache: 'no-store' });
  } catch {
    return null;
  }
}

/** Detect the visitor country once per hour (multiple fallback providers). */
export async function detectVisitorCountry(): Promise<string> {
  const cached = getCachedCountry();
  if (cached) return cached;

  let country = 'UNKNOWN';

  // Provider 1: geojs (no key, CORS-enabled)
  const geojs = await fetchWithTimeout('https://get.geojs.io/v1/ip/country.json');
  if (geojs && geojs.ok) {
    try {
      const data = await geojs.json();
      if (data?.country && data.country !== 'ZZ') country = normalizeCountryCode(data.country);
    } catch {
      // next provider
    }
  }

  // Provider 2: ipwho.is
  if (country === 'UNKNOWN') {
    const ipwho = await fetchWithTimeout('https://ipwho.is/');
    if (ipwho && ipwho.ok) {
      try {
        const data = await ipwho.json();
        if (data?.country_code && data.success !== false) country = normalizeCountryCode(data.country_code);
      } catch {
        // next provider
      }
    }
  }

  // Provider 3: Cloudflare trace (plain text `loc=DE`)
  if (country === 'UNKNOWN') {
    const cf = await fetchWithTimeout('https://www.cloudflare.com/cdn-cgi/trace');
    if (cf && cf.ok) {
      const text = await cf.text();
      const m = text.match(/^loc=([A-Za-z]{2})$/m);
      if (m) country = normalizeCountryCode(m[1]);
    }
  }

  cachedCountry = country;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ country, at: Date.now() }));
  } catch {
    // storage full/blocked — memory cache still applies
  }
  return country;
}

/** Is this record visible for a visitor from `country`? */
export function isGeoVisible(record: GeoVisibleRecord, country: string): boolean {
  const policy = record.geoPolicy;
  if (!policy || !Array.isArray(policy.countries) || policy.countries.length === 0) return true; // Tier A
  const list = policy.countries.map(normalizeCountryCode);
  const c = normalizeCountryCode(country);
  if (policy.mode === 'block') {
    return !list.includes(c); // unknown country stays visible for block-mode
  }
  // mode 'allow' — strict: unknown country cannot see tier B
  return list.includes(c);
}

/** Filter a stream list for the detected/assumed country. */
export function filterStreamsByGeo<T extends GeoVisibleRecord>(streams: T[], country: string): T[] {
  return streams.filter((s) => isGeoVisible(s, country));
}

/** Simulate what a visitor from `country` would see (admin/agent preview). */
export function geoPreviewCounts(streams: GeoVisibleRecord[], country: string): { visible: number; hidden: number } {
  let visible = 0;
  let hidden = 0;
  for (const s of streams) {
    if (isGeoVisible(s, country)) visible++;
    else hidden++;
  }
  return { visible, hidden };
}

export function clearGeoCountryCache(): void {
  cachedCountry = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
