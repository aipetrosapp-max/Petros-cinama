/**
 * IndexedDB-backed cache for the full cinema catalog.
 *
 * localStorage is intentionally NOT used for the 5–6 MB manifest. It remains
 * only for tiny metadata (timestamp/version). This prevents the
 * "setItem exceeded the quota" failure that used to abort the sync listener.
 */

const DB_NAME = 'AiPetrosCatalogDB';
const DB_VERSION = 1;
const STREAM_STORE = 'streamManifest';
const STREAM_KEY = 'current';
const VAULT_STORE = 'vaultSnapshots';
const VAULT_KEY = 'primary';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STREAM_STORE)) db.createObjectStore(STREAM_STORE);
        if (!db.objectStoreNames.contains(VAULT_STORE)) db.createObjectStore(VAULT_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readValue<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

async function writeValue(store: string, key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } finally {
    db.close();
  }
}

async function deleteValue(store: string, key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}

export interface CachedStreamManifest<T> {
  streams: T[];
  savedAt: string;
}

export function loadCatalogCache<T>(): Promise<T[] | null> {
  return readValue<CachedStreamManifest<T>>(STREAM_STORE, STREAM_KEY).then((cached) => {
    if (!cached || !Array.isArray(cached.streams) || cached.streams.length === 0) return null;
    return cached.streams;
  });
}

export function saveCatalogCache<T>(streams: T[]): Promise<boolean> {
  return writeValue(STREAM_STORE, STREAM_KEY, {
    streams,
    savedAt: new Date().toISOString()
  } satisfies CachedStreamManifest<T>);
}

export function clearCatalogCache(): Promise<void> {
  return deleteValue(STREAM_STORE, STREAM_KEY);
}

export function loadVaultSnapshotCache<T>(): Promise<T | null> {
  return readValue<T>(VAULT_STORE, VAULT_KEY);
}

export function saveVaultSnapshotCache<T>(snapshot: T): Promise<boolean> {
  return writeValue(VAULT_STORE, VAULT_KEY, snapshot);
}

export function clearVaultSnapshotCache(): Promise<void> {
  return deleteValue(VAULT_STORE, VAULT_KEY);
}
