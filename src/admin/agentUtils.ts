import crypto from 'crypto';

/** Small shared util for the admin agent (kept separate to avoid heavy imports). */
export function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Two-tier geo policy editing (titles live in data/streams.json in stream shape)
// ---------------------------------------------------------------------------

interface GeoPolicyInput {
  mode: 'block' | 'allow';
  countries: string[];
}

interface GeoStreamLike {
  id: string;
  title: string;
  titleFa?: string;
  geoPolicy?: { mode: 'block' | 'allow'; countries: string[]; noteFa?: string; updatedAt?: string };
  geoPending?: boolean;
}

function normKey(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '');
}

/**
 * Match titles mentioned in a Persian message by substring of title/titleFa
 * (strip policy keywords first so the words themselves don't match a title).
 */
const GEO_STOPWORDS = new Set(['the', 'and', 'for', 'his', 'her', 'who', 'new', 'one', 'two', 'man', 'men', 'big', 'boy', 'girl', 'film', 'movie', 'series', 'anime', 'love', 'life', 'night', 'day', 'home', 'road', 'city', 'king', 'last', 'lost', 'dead']);

function matchesMessage(stream: GeoStreamLike, message: string): boolean {
  const cleaned = message
    .replace(/(ببند|بسته|ممنوع|بلاک|پخش نشه|فقط در کشور|فقط کشورها|فقط این کشورها|فقط از کشور|ببینند|ببین|دیده بشه|دیده شود|پخش بشه|پخش شود|باز بشه|قید جغرافیایی|محدودیت جغرافیایی|قید کشور|بردار|حذف کن|لغو|برای|کشورها?|را)/g, ' ')
    .replace(/\b[A-Za-z]{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hay = normKey(`${stream.title} ${stream.titleFa || ''}`);
  const tokens = cleaned.split(' ').map((w) => normKey(w)).filter((w) => w.length >= 4 && !GEO_STOPWORDS.has(w));
  if (tokens.length === 0) return false;
  // the strongest signal: a distinctive (long) token appears in the title
  const longTokens = tokens.filter((w) => w.length >= 5);
  if (longTokens.some((w) => hay.includes(w))) return true;
  // fallback: every remaining token must appear (all-of)
  return tokens.every((w) => hay.includes(w));
}

export async function applyPolicyToMatchingTitles(
  message: string,
  policy: GeoPolicyInput
): Promise<{ matched: number; changedTitles: string[] }> {
  const { readLocalCatalog, writeLocalCatalog } = await import('./githubSync.ts');
  const catalog = await readLocalCatalog();
  const streams = (catalog.streams || []) as unknown as GeoStreamLike[];
  const changedTitles: string[] = [];
  for (const s of streams) {
    if (!matchesMessage(s, message)) continue;
    s.geoPolicy = {
      mode: policy.mode,
      countries: policy.countries,
      noteFa: policy.mode === 'block' ? 'در کشورهای فهرست‌شده پخش نمی‌شود' : 'فقط در کشورهای فهرست‌شده قابل مشاهده است',
      updatedAt: new Date().toISOString()
    };
    s.geoPending = false;
    changedTitles.push(s.titleFa || s.title);
  }
  if (changedTitles.length > 0) {
    catalog.updatedAt = new Date().toISOString();
    await writeLocalCatalog(catalog);
  }
  return { matched: changedTitles.length, changedTitles };
}

export async function clearPolicyFromMatchingTitles(message: string): Promise<{ matched: number; changedTitles: string[] }> {
  const { readLocalCatalog, writeLocalCatalog } = await import('./githubSync.ts');
  const catalog = await readLocalCatalog();
  const streams = (catalog.streams || []) as unknown as GeoStreamLike[];
  const changedTitles: string[] = [];
  for (const s of streams) {
    if (!s.geoPolicy) continue;
    if (!matchesMessage(s, message)) continue;
    delete s.geoPolicy;
    changedTitles.push(s.titleFa || s.title);
  }
  if (changedTitles.length > 0) {
    catalog.updatedAt = new Date().toISOString();
    await writeLocalCatalog(catalog);
  }
  return { matched: changedTitles.length, changedTitles };
}

/** Tier A decision: title becomes visible in every country (clears geoPending). */
export async function applyTierA(message: string): Promise<{ matched: number; changedTitles: string[] }> {
  const { readLocalCatalog, writeLocalCatalog } = await import('./githubSync.ts');
  const catalog = await readLocalCatalog();
  const streams = (catalog.streams || []) as unknown as GeoStreamLike[];
  const changedTitles: string[] = [];
  for (const s of streams) {
    if (s.geoPending !== true && s.geoPolicy) continue; // only pending or tier-B entries need a decision
    if (s.geoPending !== true) continue;
    if (!matchesMessage(s, message)) continue;
    delete s.geoPolicy;
    s.geoPending = false;
    changedTitles.push(s.titleFa || s.title);
  }
  if (changedTitles.length > 0) {
    catalog.updatedAt = new Date().toISOString();
    await writeLocalCatalog(catalog);
  }
  return { matched: changedTitles.length, changedTitles };
}
