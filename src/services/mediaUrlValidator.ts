/**
 * Strict allow-list for URLs that may be attached to an HTML5 <video> element.
 *
 * t.me pages, abrtech/mehracdn mirrors, Google test buckets and sample clips are
 * explicitly rejected. Rejecting a URL is always safer than silently substituting
 * another video.
 */
export function isPlayableDirectMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase().trim();
  // Same-origin rolling cache gateway route served by server.ts
  // (/api/stream/cache/<streamId>). It speaks HTTP 206/Content-Range.
  if (u.startsWith('/api/stream/cache/')) return true;
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false;
  if (u.includes('t.me/') || u.includes('telegram') || u.includes('telegram.org')) return false;
  if (u.includes('abrtech.top')) return false;
  if (u.includes('mehracdn.com')) return false;
  if (u.includes('commondatastorage.googleapis.com')) return false;
  if (u.includes('storage.googleapis.com')) return false;
  if (u.includes('flower.mp4')) return false;
  if (u.includes('view_from_a_blue_moon')) return false; // eliminates the opening flower bud clip
  if (u.includes('bigbuckbunny') || u.includes('bbb_')) return false;
  if (u.includes('oceans.mp4')) return false;
  if (u.includes('friday.mp4')) return false;
  // Known fake/demo asset: one shared YouTube clip that was wrongly attached to
  // several different titles. It never belongs to any movie — reject everywhere.
  if (u.includes('youtube-qvid_hdavhw') || u.includes('qvid_hdavhw.mp4')) return false;
  return true;
}

/**
 * True when the URL is a trailer/promo file rather than a full movie.
 * Trailer files are reserved for the dedicated trailer mode only; they must
 * never be resolved as the movie stream.
 */
export function isTrailerUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  return /(?:[\-_/\.])trailer(?:[\-_\.]|$)|trailerhd|official[-_]?trailer/.test(u);
}

/**
 * Strict production-grade media URL: a real HTTPS video file a browser can
 * attach to <video> and decode (MP4 / HLS / DASH / WebM / Ogg). Same-origin relative
 * routes (/api/stream/cache/…) and raw Telegram links NEVER pass this check.
 */
export function isPlayableHttpsMediaFile(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase().trim();
  if (u.startsWith('/api/stream/cache/')) return false; // relative localhost route
  if (u.includes('t.me/') || u.includes('telegram.me/') || u.includes('telegram.org')) return false;
  if (!u.startsWith('https://')) return false;
  if (!isPlayableDirectMediaUrl(url)) return false;
  const path = u.split(/[?#]/)[0];
  return /\.(mp4|m3u8|webm|mpd|ogv)$/.test(path);
}

/**
 * Legacy storage detector: links that only worked against a local rolling
 * cache gateway or raw Telegram posts. Any snapshot containing them must be
 * purged from IndexedDB / localStorage immediately.
 */
export function isLegacyLocalOrTelegramUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase().trim();
  return (
    u.startsWith('/api/stream/cache/') ||
    u.startsWith('petros-cache://') ||
    u.includes('t.me/') ||
    u.includes('telegram.me/')
  );
}
