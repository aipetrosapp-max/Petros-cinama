import { clearCatalogCache, loadCatalogCache, saveVaultSnapshotCache, loadVaultSnapshotCache, clearVaultSnapshotCache } from '../services/catalogCache';
import { isLegacyLocalOrTelegramUrl } from '../services/mediaUrlValidator';
import type {
  FeedbackRecord,
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  SearchFilterState,
  TasteVector6D,
  UserAccountState,
  UserCollection,
  WatchProgressEntry
} from './types';

/**
 * In-App Local Vault — Storage Version 2
 *
 * v2 migration (2026): the user-visible stale-catalog bug on aipetros.xyz was
 * caused by old IndexedDB / localStorage snapshots holding unplayable entries
 * whose links only worked against the local rolling cache gateway
 * (/api/stream/cache/…) or raw Telegram posts (t.me). Those snapshots are now:
 *   1. ignored (version 2 snapshot key + record key),
 *   2. PURGED immediately, and
 *   3. replaced by the purified live server catalog.
 */

export const SNAPSHOT_VERSION = 2;

/** v2 key — any key below in LEGACY list is purged on startup. */
export const VAULT_STORAGE_KEY = 'aipetros_universe_inapp_memory_v2';

/** Storage keys written by older builds. They are never read again. */
export const LEGACY_VAULT_STORAGE_KEYS = [
  'aipetros_universe_inapp_memory_v1'
] as const;

const IDB_NAME = 'AiPetrosUniverseVaultDB';
const IDB_VERSION = 2;
const IDB_STORE = 'memorySnapshots';
const IDB_RECORD_KEY = 'primary_snapshot_v2';
/** Record key used by v1 builds inside the same database. */
const LEGACY_IDB_RECORD_KEYS = ['primary_snapshot'] as const;

export interface InAppVaultSnapshot {
  version: number;
  updatedAt: string;
  lang: LanguageCode;
  onboardingDone: boolean;
  user: UserAccountState;
  userVector: TasteVector6D;
  progressMap: Record<string, WatchProgressEntry>;
  favoriteIds: string[];
  hiddenIds: string[];
  recentIds: string[];
  feedbackMap: Record<string, FeedbackRecord>;
  collections: UserCollection[];
  downloads?: Record<string, OfflineDownloadRecord>;
  searchFilters: SearchFilterState;
  catalog?: PrototypeMediaItem[];
}

export interface VaultPurgeReport {
  purged: boolean;
  details: string[];
}

/** True when a media item's links only work via the local cache gateway or raw Telegram. */
export function hasLegacyStreamLinks(item: Partial<PrototypeMediaItem> | null | undefined): boolean {
  if (!item) return false;
  const urls = [
    item.streamUrl,
    item.defaultStreamUrl,
    item.playableUrl,
    item.upstreamUrl,
    item.telegramUrl,
    ...(Array.isArray(item.qualities) ? item.qualities.map((q) => q?.url) : [])
  ].filter((u): u is string => Boolean(u));
  return urls.some(isLegacyLocalOrTelegramUrl);
}

function snapshotHasLegacyStreamLinks(snapshot: Partial<InAppVaultSnapshot> | null | undefined): boolean {
  return Array.isArray(snapshot?.catalog) && snapshot.catalog.some(hasLegacyStreamLinks);
}

export function loadVaultSnapshot(): InAppVaultSnapshot | null {
  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InAppVaultSnapshot>;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || !parsed.user || !parsed.userVector) {
      return null;
    }
    return parsed as InAppVaultSnapshot;
  } catch {
    return null;
  }
}

function openVaultIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function createLocalVaultPayload(snapshot: InAppVaultSnapshot): Omit<InAppVaultSnapshot, 'catalog'> {
  const { catalog, ...lightSnapshot } = snapshot;
  return lightSnapshot;
}

export async function saveVaultSnapshot(snapshot: InAppVaultSnapshot): Promise<void> {
  // Keep localStorage small: the 5+ MB catalog is stored in IndexedDB only.
  // This prevents the catalog from exhausting the localStorage quota.
  try {
    window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(createLocalVaultPayload(snapshot)));
  } catch {
    // Quota or private mode fallback still proceeds to IndexedDB below
  }

  await saveVaultSnapshotCache(snapshot);
}

export async function loadVaultFromIndexedDb(): Promise<InAppVaultSnapshot | null> {
  const cached = await loadVaultSnapshotCache<InAppVaultSnapshot>();
  if (cached && cached.version === SNAPSHOT_VERSION && cached.user && cached.userVector) {
    return cached;
  }

  const db = await openVaultIdb();
  if (!db) return null;
  try {
    return await new Promise<InAppVaultSnapshot | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        const val = req.result as Partial<InAppVaultSnapshot> | undefined;
        if (val && val.version === SNAPSHOT_VERSION && val.user && val.userVector) {
          resolve(val as InAppVaultSnapshot);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

export async function clearVaultSnapshot(): Promise<void> {
  try {
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
    for (const key of LEGACY_VAULT_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  await clearVaultSnapshotCache();
  const db = await openVaultIdb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(IDB_RECORD_KEY);
      for (const key of LEGACY_IDB_RECORD_KEYS) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}

/**
 * Startup purge of stale browser storage.
 *
 * Detects — and immediately deletes — any legacy snapshot (localStorage v1
 * keys, v1 IndexedDB records) that contains unplayable rolling-cache or
 * raw-Telegram links, plus the stale rolling stream manifest cache. The live
 * catalog from the server then replaces them on the next hydration.
 */
export async function purgeLegacyVaultData(): Promise<VaultPurgeReport> {
  const details: string[] = [];

  if (typeof window !== 'undefined') {
    // 1. Legacy localStorage snapshots (aipetros_universe_inapp_memory_v1)
    for (const key of LEGACY_VAULT_STORAGE_KEYS) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        details.push(`legacy-localStorage:${key}`);
        window.localStorage.removeItem(key);
      } catch {
        // ignore read errors
      }
    }

    // 2. Current localStorage snapshot holding legacy links? Drop its catalog.
    try {
      const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
      if (raw && snapshotHasLegacyStreamLinks(JSON.parse(raw) as Partial<InAppVaultSnapshot>)) {
        details.push(`stale-catalog:${VAULT_STORAGE_KEY}`);
        window.localStorage.removeItem(VAULT_STORAGE_KEY);
      }
    } catch {
      // ignore parse errors
    }
  }

  // 3. IndexedDB vault snapshots (AiPetrosUniverseVaultDB)
  try {
    const idbSnapshot = await loadVaultFromIndexedDb();
    if (idbSnapshot && snapshotHasLegacyStreamLinks(idbSnapshot)) {
      details.push('stale-catalog:IndexedDB-vault');
      await clearVaultSnapshot();
    }
  } catch {
    // ignore
  }

  // 4. Rolling stream manifest cache (AiPetrosCatalogDB) with legacy links
  try {
    const cachedStreams = await loadCatalogCache<unknown>();
    if (Array.isArray(cachedStreams)) {
      const hasLegacy = cachedStreams.some((stream) => {
        if (!stream || typeof stream !== 'object') return false;
        const record = stream as Record<string, unknown>;
        const urls = [
          record.defaultStreamUrl,
          record.playableUrl,
          record.streamUrl,
          record.upstreamUrl,
          record.telegramUrl,
          ...(Array.isArray(record.qualities)
            ? (record.qualities as Array<{ url?: string }>).map((q) => q?.url)
            : [])
        ].filter((u): u is string => Boolean(u));
        return urls.some(isLegacyLocalOrTelegramUrl);
      });
      if (hasLegacy) {
        details.push('stale-stream-manifest:AiPetrosCatalogDB');
        await clearCatalogCache();
      }
    }
  } catch {
    // ignore
  }

  return { purged: details.length > 0, details };
}

export function getVaultByteSize(): number {
  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY) || '';
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}
