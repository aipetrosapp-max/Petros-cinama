import type { PrototypeMediaItem } from '../prototype/types';

/**
 * Unique Poster Registry
 * ai petros / Petros Cinema (Aipetros-stream)
 *
 * Guarantees that no two titles on the home screen ever share the same poster.
 *
 * Root cause of the "identical CINEMA poster" bug: many legacy pipelines fell
 * back to one shared Unsplash photo (photo-1536440136628-849c177e76a1,
 * the "CINEMA CINEMA" red/purple staircase art). That URL is now blacklisted
 * and every title without a verified, non-duplicated poster of its own gets a
 * deterministic, title-derived unique poster instead.
 */

/** Poster URLs that are banned from ever being shown (the shared fallback art). */
export const SHARED_POSTER_BLACKLIST: string[] = [
  'photo-1536440136628-849c177e76a1'
];

/** Stable djb2 hash so poster assignment never flickers between renders. */
export function stableHash(input: string): number {
  let hash = 5381;
  const text = input || '';
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isBlacklistedPoster(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  if (!lower.startsWith('https://') && !lower.startsWith('data:image/') && !lower.startsWith('/')) {
    return true;
  }
  return SHARED_POSTER_BLACKLIST.some((marker) => lower.includes(marker));
}

const POSTER_ACCENTS = [
  '#D4AF37', '#F5B942', '#00F0FF', '#EF4444', '#A78BFA',
  '#34D399', '#F472B6', '#FB923C', '#60A5FA', '#FBBF24'
];

/**
 * Deterministic, title-derived unique poster (SVG data URI).
 * The same title always yields the same artwork, two different titles never do
 * (hue, palette and layout seed are derived from title + id).
 */
export function generateUniquePosterSvg(title: string, id: string): string {
  const safeTitle = (title || 'AI PETROS CINEMA')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const seed = stableHash(`${id}::${title}`);
  const accent = POSTER_ACCENTS[seed % POSTER_ACCENTS.length];
  const hue = seed % 360;
  const hue2 = (hue + 40 + (seed % 80)) % 360;
  const layout = seed % 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
    <defs>
      <radialGradient id="bg" cx="${30 + (layout * 25)}%" cy="${25 + layout * 15}%" r="95%">
        <stop offset="0%" stop-color="hsl(${hue},55%,16%)"/>
        <stop offset="55%" stop-color="hsl(${hue2},45%,9%)"/>
        <stop offset="100%" stop-color="#050508"/>
      </radialGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="url(#bg)"/>
    <g opacity="0.35" stroke="${accent}" fill="none" stroke-width="1.5">
      <circle cx="${140 + (seed % 320)}" cy="${180 + (seed % 260)}" r="${70 + (seed % 90)}"/>
      <line x1="0" y1="${520 + (seed % 120)}" x2="600" y2="${420 + (seed % 160)}"/>
      <line x1="${90 + (seed % 140)}" y1="900" x2="${240 + (seed % 200)}" y2="520"/>
    </g>
    <rect x="24" y="24" width="552" height="852" rx="20" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="2.5"/>
    <text x="300" y="95" text-anchor="middle" fill="${accent}" font-family="Cinzel, serif" font-size="17" letter-spacing="7" font-weight="bold">AI PETROS CINEMA</text>
    <g transform="translate(255,300)" stroke="${accent}" stroke-width="3" fill="none" opacity="0.85">
      <circle cx="45" cy="45" r="38" stroke-opacity="0.8"/>
      <circle cx="45" cy="45" r="14" fill="${accent}" fill-opacity="0.3"/>
      <line x1="45" y1="7" x2="45" y2="83" stroke-opacity="0.4"/>
      <line x1="7" y1="45" x2="83" y2="45" stroke-opacity="0.4"/>
      <line x1="18" y1="18" x2="72" y2="72" stroke-opacity="0.4"/>
      <line x1="18" y1="72" x2="72" y2="18" stroke-opacity="0.4"/>
    </g>
    <text x="300" y="590" text-anchor="middle" fill="url(#accent)" font-family="Vazirmatn, sans-serif" font-size="34" font-weight="bold">${safeTitle}</text>
    <text x="300" y="635" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="13" letter-spacing="3" opacity="0.85">EXCLUSIVE PREMIERE</text>
    <rect x="220" y="740" width="160" height="38" rx="19" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="1.5"/>
    <text x="300" y="765" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="14" font-weight="bold">★ 8.5 IMDb • 4K</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolve a guaranteed-unique poster for a single title.
 * The caller's own poster wins when it is valid and not blacklisted.
 */
export function resolveUniquePoster(title: string, id: string, posterUrl?: string | null): string {
  if (!isBlacklistedPoster(posterUrl)) return posterUrl as string;
  return generateUniquePosterSvg(title, id);
}

/**
 * Catalog-level uniqueness pass: after this returns, no two items share a
 * posterUrl and none carries a blacklisted/shared fallback art.
 */
export function ensureUniqueCatalogPosters(items: PrototypeMediaItem[]): PrototypeMediaItem[] {
  const ownerByPoster = new Map<string, string>();
  return items.map((item) => {
    const title = item.titleFa || item.titleEn || item.id;
    let poster = resolveUniquePoster(title, item.id, item.posterUrl);

    // If another title already owns this exact URL, give this item its own art.
    const existingOwner = ownerByPoster.get(poster);
    if (existingOwner && existingOwner !== item.id) {
      poster = generateUniquePosterSvg(title, item.id);
    }
    ownerByPoster.set(poster, item.id);
    return poster === item.posterUrl ? item : { ...item, posterUrl: poster };
  });
}
