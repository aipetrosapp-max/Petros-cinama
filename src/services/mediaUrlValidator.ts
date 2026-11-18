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
  return true;
}
