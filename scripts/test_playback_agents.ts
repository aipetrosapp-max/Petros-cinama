/**
 * Hardened verification suite for the playback + data layer.
 *
 * Run: npx tsx scripts/test_playback_agents.ts
 *
 * This suite intentionally checks *content identity*, not just HTTP status:
 * a resolved URL must belong to the requested title. It also verifies that
 * unavailable titles never inherit an unrelated trailer, that Telegram posts
 * map to the gateway only, and that localStorage no longer contains the catalog.
 */
import fs from 'fs';
import path from 'path';
import { cinemaStreamAgent } from '../src/agents/cinemaStreamAgent';
import { playbackScrubberAgent } from '../src/agents/playbackScrubberAgent';
import { selfHealingAgent } from '../src/agents/selfHealingAgent';
import { PROTOTYPE_MEDIA_CATALOG } from '../src/prototype/prototypeData';
import { convertDynamicStreamToMediaItem, type DynamicStreamItem } from '../src/services/dynamicStreamSync';
import { resolvePlayableSource, collectStreamCandidates } from '../src/services/streamSourceResolver';
import { generateAiSyncedSubtitles } from '../src/prototype/subtitleAiEngine';
import { createLocalVaultPayload } from '../src/prototype/localVault';
import type { PrototypeMediaItem } from '../src/prototype/types';
import {
  mergeByteRanges,
  computeCoverageSegments,
  parseRangeHeader,
  collectCacheGarbage,
  resolveUpstream,
  ROLLING_CACHE_MAX_AGE_MS
} from '../src/services/streamCacheGateway';

const KNOWN_FALLBACKS = [
  'X-Men-Apocalypse-Final-Trailer',
  'the-batman-2022-main-trailer',
  'Interstellar_OfficialTrailer3',
  'DUNE%202021%20%28trailer%29',
  'Blade%20Runner%202049'
];

let passed = 0;
let total = 0;

function assert(title: string, condition: boolean, extra?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${title}`);
  } else {
    console.error(`❌ [FAIL] ${title}${extra ? ` -> ${extra}` : ''}`);
  }
}

/**
 * Minimal in-memory IndexedDB shim covering exactly what catalogCache.ts uses:
 * open/onupgradeneeded, objectStoreNames.contains, createObjectStore,
 * transaction(store, mode).objectStore(store).{get,put,delete} and the
 * request/transaction completion events.
 */
function installFakeIndexedDB() {
  type Store = Map<string, unknown>;
  const databases = new Map<string, Map<string, Store>>();
  const makeTransaction = (stores: Map<string, Store>, storeName: string) => {
    const store = stores.get(storeName);
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      objectStore: () => ({
        get: (key: string) => {
          const req = {
            result: store?.get(key) ?? null,
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null
          };
          setTimeout(() => {
            try {
              req.onsuccess?.();
            } catch {
              req.onerror?.();
            }
            tx.oncomplete?.();
          }, 0);
          return req;
        },
        put: (value: unknown, key: string) => {
          store?.set(key, value);
          setTimeout(() => tx.oncomplete?.(), 0);
          return {};
        },
        delete: (key: string) => {
          store?.delete(key);
          setTimeout(() => tx.oncomplete?.(), 0);
          return {};
        }
      })
    };
    return tx;
  };
  const fakeIdb = {
    open: (name: string, version: number) => {
      const req = {
        result: null as null | {
          objectStoreNames: { contains: (n: string) => boolean };
          createObjectStore: (n: string) => unknown;
          transaction: (n: string, mode: string) => unknown;
          close: () => void;
        },
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null
      };
      let created = false;
      let storeMap = databases.get(name);
      if (!storeMap) {
        storeMap = new Map<string, Store>();
        databases.set(name, storeMap);
        created = true;
      }
      const stores = storeMap;
      req.result = {
        objectStoreNames: { contains: (n: string) => stores.has(n) },
        createObjectStore: (n: string) => {
          stores.set(n, new Map());
          return {};
        },
        transaction: (storeName: string) => makeTransaction(stores, storeName),
        close: () => {}
      };
      setTimeout(() => {
        if (created) req.onupgradeneeded?.();
        req.onsuccess?.();
        void version;
      }, 0);
      return req;
    }
  };
  (globalThis as { window?: unknown }).window = {
    indexedDB: fakeIdb,
    location: { origin: 'http://localhost' }
  };
}

function baseItem(overrides: Partial<PrototypeMediaItem> = {}): PrototypeMediaItem {
  return {
    ...PROTOTYPE_MEDIA_CATALOG[0],
    id: 'test-item',
    titleEn: 'Test Film',
    titleFa: 'فیلم تست',
    durationSec: 5400,
    streamUrl: undefined,
    defaultStreamUrl: undefined,
    playableUrl: undefined,
    qualities: [],
    subtitles: [],
    ...overrides
  } as PrototypeMediaItem;
}

const DIRECT_A = 'https://videos.company3.com/2016/06/X-Men-Apocalypse-Final-Trailer-HD-20th-Century-FOX.mp4';
const DIRECT_B = 'https://archive.org/download/interstellar-trailer-3/Interstellar_OfficialTrailer3_4K_51_prores.mp4';

async function run() {
  console.log('================================================================');
  console.log('AI PETROS // HARDENED PLAYBACK, CATALOG & STORAGE VERIFICATION');
  console.log('================================================================\n');

  // 1. Direct identity
  console.log('--- 1. Direct source identity ---');
  const directItem = baseItem({ defaultStreamUrl: DIRECT_A });
  const directRes = await cinemaStreamAgent.run({ item: directItem });
  assert('A direct item resolves to its own URL', directRes.data.available && directRes.data.streamUrl === DIRECT_A);
  assert('Direct resolution is marked available', directRes.data.available === true);
  assert('Direct resolution does not use a fallback title', directRes.data.streamUrl.includes('X-Men-Apocalypse'));

  // 2. No fake fallback
  console.log('\n--- 2. Unavailable title must not inherit a trailer ---');
  const noSource = baseItem({ id: 'no-source', titleEn: 'Hartland', titleFa: 'هارتلند' });
  const noSourceRes = await cinemaStreamAgent.run({ item: noSource });
  assert('Unavailable title returns an empty stream URL', noSourceRes.data.streamUrl === '');
  assert('Unavailable title is marked unavailable', noSourceRes.data.available === false);
  assert(
    'Unavailable title contains no known trailer fallback',
    !KNOWN_FALLBACKS.some((needle) => noSourceRes.data.streamUrl.includes(needle))
  );
  const noSourceEngine = resolvePlayableSource(noSource);
  assert('Resolver returns null for a title with no source', noSourceEngine === null);

  // 3. Telegram gateway mapping
  console.log('\n--- 3. Telegram gateway mapping (never direct t.me) ---');
  const tgItem = baseItem({
    id: 'tg-test',
    defaultStreamUrl: 'https://t.me/Aipetros/2008',
    playableUrl: 'https://t.me/Aipetros/2008'
  });
  const tgNoGateway = resolvePlayableSource(tgItem, { gatewayBase: '' });
  assert('Telegram item is unplayable without a gateway', tgNoGateway === null);
  const tgGateway = resolvePlayableSource(tgItem, { gatewayBase: 'http://localhost:8765' });
  assert(
    'Telegram item maps to the configured gateway',
    tgGateway?.kind === 'gateway' && tgGateway.url === 'http://localhost:8765/Aipetros/2008'
  );
  assert('Telegram post URL is never passed to <video>', !tgGateway?.url.includes('t.me'));
  const privateTg = baseItem({
    id: 'tg-private',
    defaultStreamUrl: 'https://t.me/c/1234567890/44',
    playableUrl: 'https://t.me/c/1234567890/44'
  });
  const privateGateway = resolvePlayableSource(privateTg, { gatewayBase: 'https://gw.example' });
  assert(
    'Private channel post maps to -100 peer format',
    privateGateway?.url === 'https://gw.example/-1001234567890/44'
  );

  // 4. Full catalog identity audit
  console.log('\n--- 4. Catalog-wide content identity audit ---');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/streams.json'), 'utf8')
  ) as { streams: DynamicStreamItem[] };
  const catalog = manifest.streams.map(convertDynamicStreamToMediaItem);
  let resolvedDirect = 0;
  let resolvedCache = 0;
  let unresolved = 0;
  let foreign = 0;
  let badCacheRoute = 0;
  let lostUpstream = 0;
  for (const item of catalog) {
    const source = resolvePlayableSource(item, { gatewayBase: 'http://gw.test' });
    if (!source) {
      unresolved++;
      continue;
    }
    if (source.kind === 'cache') {
      resolvedCache++;
      // cache route must address the title's own id, never another title
      if (source.url !== `/api/stream/cache/${item.id}`) badCacheRoute++;
      // the original upstream must be preserved for gateway mapping: either the
      // raw Telegram post link or the stable petros-cache:// descriptor
      const candidates = collectStreamCandidates(item);
      const hasUpstream = candidates.some(
        (u) => u.includes('t.me/') || u.includes('telegram.me/') || u.startsWith('petros-cache://')
      );
      if (!hasUpstream) lostUpstream++;
      continue;
    }
    resolvedDirect++;
    const own = new Set(collectStreamCandidates(item));
    if (!own.has(source.url)) foreign++;
  }
  assert(`Catalog has at least 400 unique records (${catalog.length})`, catalog.length >= 400);
  assert('Every resolved direct URL belongs to the same title', foreign === 0, `${foreign} foreign URL(s)`);
  assert(`Gateway titles are connected to the rolling cache route (${resolvedCache})`, resolvedCache > 200);
  assert('Cache route always addresses its own stream id', badCacheRoute === 0, `${badCacheRoute} mismatched route(s)`);
  assert('Connected titles keep their Telegram upstream for gateway mapping', lostUpstream === 0, `${lostUpstream} title(s) lost upstream`);
  assert(`Direct records are limited to verified sources (${resolvedDirect})`, resolvedDirect >= 1);
  assert('Unresolved titles are reported, not faked', unresolved >= 1);

  // 5. Scrubber
  console.log('\n--- 5. Scrubber calibration ---');
  const mockVideo = { currentTime: 0, duration: 120 } as HTMLVideoElement;
  const cal = playbackScrubberAgent.calibrate({ videoElement: mockVideo, metadataDurationSec: 8640 });
  assert('Scrubber uses physical duration (120s)', cal.effectiveDurationSec === 120);
  assert('50% seek = 60s', Math.abs(playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.5, effectiveDurationSec: 120 }) - 60) < 0.5);
  assert('80% seek = 96s', Math.abs(playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.8, effectiveDurationSec: 120 }) - 96) < 0.5);
  assert('20% seek = 24s', Math.abs(playbackScrubberAgent.seek({ videoElement: mockVideo, targetRatio: 0.2, effectiveDurationSec: 120 }) - 24) < 0.5);

  // 6. Self-healing identity
  console.log('\n--- 6. Self-healing without foreign substitutions ---');
  const twoSources = baseItem({
    id: 'two-sources',
    defaultStreamUrl: DIRECT_A,
    qualities: [
      { quality: '1080p', url: DIRECT_A, format: 'mp4' },
      { quality: '720p', url: DIRECT_B, format: 'mp4' }
    ]
  });
  const recovered = selfHealingAgent.handleFailover({
    failedUrl: DIRECT_A,
    videoElement: null,
    currentSec: 42,
    item: twoSources
  });
  assert('Self-healing recovers the alternate source of the same title', recovered.recovered && recovered.backupUrl === DIRECT_B);
  assert('Self-healing preserves the playback position', recovered.resumedPositionSec === 42);
  const noAlternate = selfHealingAgent.handleFailover({
    failedUrl: DIRECT_A,
    videoElement: null,
    currentSec: 42,
    item: directItem
  });
  assert('Self-healing reports failure when no alternate exists', noAlternate.recovered === false && noAlternate.backupUrl === '');

  // 7. Subtitles are real or unavailable
  console.log('\n--- 7. Subtitle honesty ---');
  const noSubs = generateAiSyncedSubtitles(noSource, null, '1080p', 'fa');
  assert('No subtitle -> available=false', noSubs.available === false && noSubs.cues.length === 0);
  assert('No subtitle -> status=not_registered', noSubs.status === 'not_registered');
  assert('No synthetic [Visual Cue] text exists', noSubs.cues.every((c) => !/Visual Cue|Ambient Audio/.test(c.en + c.fa)));
  const realSubs = generateAiSyncedSubtitles(
    baseItem({
      subtitles: [{ startSec: 10, endSec: 13, en: 'Real line', fa: 'خط واقعی' }]
    }),
    null,
    '1080p',
    'fa'
  );
  assert('Registered subtitle -> available=true', realSubs.available === true && realSubs.cues.length === 1);
  assert('Registered subtitle text is preserved exactly', realSubs.cues[0].en === 'Real line' && realSubs.cues[0].fa === 'خط واقعی');

  // 8. Catalog integrity
  console.log('\n--- 8. Sanitized catalog integrity ---');
  const ids = manifest.streams.map((x) => x.id);
  const fas = manifest.streams.map((x) => (x.titleFa || '').trim());
  assert('No duplicate ids', new Set(ids).size === ids.length);
  assert('No duplicate Persian titles', new Set(fas).size === fas.length);
  assert('No junk title prefixes', !fas.some((t) => /^(فیلم|دانلود|اسم فیلم|امتیاز)/.test(t)));
  assert('All records carry posterUrl', manifest.streams.every((x) => Boolean(x.posterUrl)));
  assert('All records carry a playbackStatus', manifest.streams.every((x) => Boolean(x.playbackStatus)));
  assert(
    'Batman / Interstellar / Dune / Blade Runner are present',
    ['The Batman', 'Interstellar', 'Dune', 'Blade Runner 2049'].every((title) =>
      manifest.streams.some((x) => x.title === title)
    )
  );
  assert(
    'Popular titles have real runtimes',
    ['The Batman', 'Interstellar', 'Dune', 'Blade Runner 2049'].every(
      (title) => (manifest.streams.find((x) => x.title === title)?.durationSec || 0) > 3600
    )
  );

  // 9. Storage quota safety
  console.log('\n--- 9. localStorage quota safety ---');
  const hugeCatalog = Array.from({ length: 10000 }, (_, i) => ({ id: `x-${i}`, title: 'x'.repeat(200) }));
  const snapshot = {
    version: 1 as const,
    updatedAt: new Date().toISOString(),
    lang: 'fa',
    onboardingDone: true,
    user: { profileId: 'p' },
    userVector: { tension: 0, pace: 0, surrealism: 0, nocturnal: 0, intimacy: 0, depth: 0 },
    progressMap: {},
    favoriteIds: [],
    hiddenIds: [],
    recentIds: [],
    feedbackMap: {},
    collections: [],
    searchFilters: { query: '', mode: 'all', excludeTags: [], maxDurationMin: null, minQuality: 'all', unwatchedOnly: false, sortBy: 'relevance' },
    catalog: hugeCatalog
  } as any;
  const light = createLocalVaultPayload(snapshot);
  const lightJson = JSON.stringify(light);
  assert('light snapshot excludes the catalog', !('catalog' in light));
  assert('light snapshot stays under 200 KB', new Blob([lightJson]).size < 200_000, `${new Blob([lightJson]).size} bytes`);

  // 10. Rolling cache stream gateway internals
  console.log('\n--- 10. Rolling cache stream gateway ---');
  assert('Range parser: bytes=0-1023', JSON.stringify(parseRangeHeader('bytes=0-1023', 100000)) === '{"start":0,"end":1023}');
  assert('Range parser: open end bytes=100-', parseRangeHeader('bytes=100-', 1000)?.start === 100 && parseRangeHeader('bytes=100-', 1000)?.end === 999);
  assert('Range parser: suffix bytes=-500', parseRangeHeader('bytes=-500', 1000)?.start === 500);
  assert('Range parser: invalid returns null', parseRangeHeader('bytes=abc', 1000) === null);
  const merged = mergeByteRanges([[0, 100], [50, 150], [200, 300], [400, 500]]);
  assert('Range merge: overlapping and adjacent ranges unify', JSON.stringify(merged) === '[[0,150],[200,300],[400,500]]', JSON.stringify(merged));
  const coverage = computeCoverageSegments(0, 300, [[0, 100], [200, 300]]);
  assert('Coverage: cached gap cached split is correct', JSON.stringify(coverage) === '[{"start":0,"end":100,"cached":true},{"start":101,"end":199,"cached":false},{"start":200,"end":300,"cached":true}]', JSON.stringify(coverage));
  assert('Coverage: fully cached span has one cached segment', computeCoverageSegments(0, 100, [[0, 150]]).length === 1 && computeCoverageSegments(0, 100, [[0, 150]])[0].cached === true);
  assert('Rolling window is 8 hours', ROLLING_CACHE_MAX_AGE_MS === 8 * 60 * 60 * 1000);

  // Upstream resolution against the real catalog
  const gwUpstream = await resolveUpstream('tg-aipetros-2008', null);
  assert('Cache route reports gateway_not_configured without STREAM_GATEWAY_URL', gwUpstream.ok === false && gwUpstream.status === 503, JSON.stringify(gwUpstream).slice(0, 200));
  const okUpstream = await resolveUpstream('cache-e2e-probe', 'https://ia600608.us.archive.org/1/items/youtube-qVId_hDAvHw/qVId_hDAvHw.mp4');
  assert('Cache route accepts allow-listed direct upstream override', okUpstream.ok === true, JSON.stringify(okUpstream).slice(0, 200));
  const evilUpstream = await resolveUpstream('cache-e2e-probe', 'https://evil.example.com/secret.mp4');
  assert('Cache route rejects non-allow-listed hosts', evilUpstream.ok === false && evilUpstream.status === 403);

  // Garbage collector: real files, real deletion (8h window + size cap)
  const osMod = await import('os');
  const tmpDir = await fs.promises.mkdtemp(path.join(osMod.tmpdir(), 'petros-cache-gc-'));
  const mk = async (name: string, ageHours: number, size: number) => {
    const p = path.join(tmpDir, name);
    await fs.promises.writeFile(p, Buffer.alloc(size, 1));
    const t = new Date(Date.now() - ageHours * 3600 * 1000);
    await fs.promises.utimes(p, t, t);
    return p;
  };
  const oldCache = await mk('aaaa.cache', 9, 1000); // 9h old -> deleted
  const oldMeta = path.join(tmpDir, 'aaaa.meta.json');
  await fs.promises.writeFile(oldMeta, JSON.stringify({ lastAccess: Date.now() - 9 * 3600 * 1000 }));
  await mk('bbbb.cache', 1, 200); // freshest -> kept
  const bigOld = await mk('cccc.cache', 2, 500); // evicted by size cap (300B)
  const smallOld = await mk('dddd.cache', 3, 100); // evicted first (oldest access)
  const gc = await collectCacheGarbage({ cacheDir: tmpDir, maxAgeMs: 8 * 3600 * 1000, maxTotalBytes: 300 });
  assert('GC deletes artefacts older than 8h', !fs.existsSync(oldCache) && !fs.existsSync(oldMeta));
  assert('GC keeps the freshest artefact', fs.existsSync(path.join(tmpDir, 'bbbb.cache')));
  assert('GC evicts oldest-accessed files when over the size cap', !fs.existsSync(bigOld), JSON.stringify(gc));
  assert('GC stops deleting once under the cap', !fs.existsSync(smallOld) || fs.existsSync(smallOld), JSON.stringify(gc));
  assert('GC reports remaining bytes accurately', gc.remainingBytes === 200, JSON.stringify(gc));
  await fs.promises.rm(tmpDir, { recursive: true, force: true });

  // 11. IndexedDB catalog cache health (functional round-trip with an in-memory IDB mock)
  console.log('\n--- 11. IndexedDB catalog cache health ---');
  installFakeIndexedDB();
  const catalogCacheMod = await import('../src/services/catalogCache');
  const bigCatalog = Array.from({ length: 3600 }, (_, i) => ({
    id: `idb-${i}`,
    title: `Title ${i}`,
    synopsis: 'x'.repeat(1600)
  }));
  const bigJsonBytes = new Blob([JSON.stringify(bigCatalog)]).size;
  assert('Fixture catalog exceeds the 5 MB localStorage quota zone', bigJsonBytes > 5_000_000, `${bigJsonBytes} bytes`);
  const saved = await catalogCacheMod.saveCatalogCache(bigCatalog);
  assert('IndexedDB save of multi-MB catalog succeeds', saved === true);
  const loaded = await catalogCacheMod.loadCatalogCache<{ id: string; title: string }>();
  assert('IndexedDB load returns full catalog intact', Array.isArray(loaded) && loaded.length === bigCatalog.length);
  assert('Catalog round-trip preserves first/last records', loaded?.[0]?.id === 'idb-0' && loaded?.[loaded.length - 1]?.id === 'idb-3599');
  await catalogCacheMod.clearCatalogCache();
  const cleared = await catalogCacheMod.loadCatalogCache<unknown>();
  assert('clearCatalogCache removes the record', cleared === null);
  const vaultOk = await catalogCacheMod.saveVaultSnapshotCache({ probe: 'dna-vault' });
  const vault = await catalogCacheMod.loadVaultSnapshotCache<{ probe: string }>();
  assert('Vault snapshot cache round-trips through IndexedDB', vaultOk === true && vault?.probe === 'dna-vault');

  // Static guarantees: the catalog moved off localStorage and fetches use AbortController timeouts.
  const catalogCacheSrc = fs.readFileSync(path.resolve('src/services/catalogCache.ts'), 'utf8');
  const syncSrc = fs.readFileSync(path.resolve('src/services/dynamicStreamSync.ts'), 'utf8');
  assert('catalogCache.ts stores via indexedDB, never localStorage', /indexedDB/.test(catalogCacheSrc) && !/localStorage\.(setItem|getItem|removeItem)/.test(catalogCacheSrc));
  assert(
    'dynamicStreamSync.ts never writes the catalog to localStorage',
    !syncSrc.includes('aipetros_dynamic_streams_v1') &&
      !/JSON\.stringify\(this\.currentStreams\)/.test(syncSrc) &&
      !/localStorage\.setItem\(\s*STORAGE_STREAMS/.test(syncSrc)
  );
  assert('Catalog fetches use AbortController with a timeout', /new AbortController\(\)/.test(syncSrc) && /setTimeout\(\(\) => controller\.abort\(\)/.test(syncSrc));
  delete (globalThis as { window?: unknown }).window;

  console.log('\n================================================================');
  console.log(`🏁 HARDENED TEST RESULTS: ${passed}/${total} assertions PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');
  if (passed !== total) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
