import type { OfflineDownloadRecord, PrototypeMediaItem } from './types';
import { resolvePlayableSource } from '../services/streamSourceResolver';

const OFFLINE_DB_NAME = 'AiPetrosOfflineMediaDB';
const OFFLINE_BLOB_STORE = 'mediaBlobs';

function openOfflineDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(OFFLINE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_BLOB_STORE)) {
          db.createObjectStore(OFFLINE_BLOB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveOfflineMediaBlob(contentId: string, blob: Blob): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OFFLINE_BLOB_STORE, 'readwrite');
      tx.objectStore(OFFLINE_BLOB_STORE).put(blob, contentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function loadOfflineMediaBlob(contentId: string): Promise<Blob | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  try {
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(OFFLINE_BLOB_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_BLOB_STORE).get(contentId);
      req.onsuccess = () => {
        const res = req.result;
        resolve(res instanceof Blob ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}

export async function deleteOfflineMediaBlob(contentId: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OFFLINE_BLOB_STORE, 'readwrite');
      tx.objectStore(OFFLINE_BLOB_STORE).delete(contentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}

export class DownloadUnavailableError extends Error {
  code: 'no_source' | 'network' | 'not_media' | 'aborted';
  titleFa: string;
  titleEn: string;

  constructor(
    code: DownloadUnavailableError['code'],
    titleFa: string,
    titleEn: string,
    messageEn: string,
    messageFa: string
  ) {
    super(messageEn);
    this.name = 'DownloadUnavailableError';
    this.code = code;
    this.titleFa = titleFa;
    this.titleEn = titleEn;
    this.messageFa = messageFa;
  }

  messageFa: string;
}

function extensionFor(mimeType: string, url: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('matroska')) return 'mkv';
  if (type.includes('mpegurl') || url.toLowerCase().includes('.m3u8')) return 'm3u8';
  if (url.toLowerCase().includes('.webm')) return 'webm';
  if (url.toLowerCase().includes('.mkv')) return 'mkv';
  return 'mp4';
}

/**
 * Downloads the actual media bytes for a title.
 *
 * There is no canvas/MediaRecorder synthesis anymore. If the title has no
 * verified direct source (or the configured Telegram gateway), this throws a
 * transparent DownloadUnavailableError.
 */
export async function downloadRealMedia(
  item: PrototypeMediaItem,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const source = resolvePlayableSource(item);
  if (!source) {
    throw new DownloadUnavailableError(
      'no_source',
      item.titleFa,
      item.titleEn,
      'This title has no verified direct download source. No substitute file was created.',
      'این عنوان منبع دانلود مستقیم تأییدشده ندارد. هیچ فایل جایگزینی ساخته نشد.'
    );
  }

  const mediaUrl = source.url;
  onProgress(5);

  async function fetchWithProxy(): Promise<Response> {
    const headers = { Accept: 'video/*,application/octet-stream' };
    let directError: unknown = null;
    const host = (() => {
      try {
        return new URL(mediaUrl).hostname.toLowerCase();
      } catch {
        return '';
      }
    })();
    // These CDNs are known to omit Access-Control-Allow-Origin on their media
    // edge nodes, so start with the same-origin allow-listed proxy.
    const proxyFirst = host.endsWith('archive.org') || host.endsWith('company3.com');

    const tryDirect = async (): Promise<Response | null> => {
      try {
        const direct = await fetch(mediaUrl, { method: 'GET', headers, signal });
        if (direct.ok && !(direct.headers.get('content-type') || '').includes('text/html')) {
          return direct;
        }
      } catch (error) {
        directError = error;
      }
      return null;
    };

    const tryProxy = async (): Promise<Response | null> => {
      try {
        const proxy = await fetch(`/api/media/proxy?url=${encodeURIComponent(mediaUrl)}`, {
          method: 'GET',
          headers,
          signal
        });
        if (proxy.ok && !(proxy.headers.get('content-type') || '').includes('text/html')) {
          return proxy;
        }
      } catch (error) {
        directError = error;
      }
      return null;
    };

    if (proxyFirst) {
      const viaProxy = await tryProxy();
      if (viaProxy) return viaProxy;
      const direct = await tryDirect();
      if (direct) return direct;
    } else {
      const direct = await tryDirect();
      if (direct) return direct;
      const viaProxy = await tryProxy();
      if (viaProxy) return viaProxy;
    }

    if (signal?.aborted) {
      throw new DownloadUnavailableError(
        'aborted',
        item.titleFa,
        item.titleEn,
        'Download cancelled.',
        'دانلود لغو شد.'
      );
    }
    throw new DownloadUnavailableError(
      'network',
      item.titleFa,
      item.titleEn,
      `Could not fetch the media file (CORS/network). The CDN does not allow browser reads and no same-origin proxy is available: ${String(directError).slice(0, 120)}`,
      `دریافت فایل ممکن نشد (CORS یا شبکه). سرور CDN اجازه خواندن به مرورگر نمی‌دهد و پروکسی هم‌دامنه در دسترس نیست: ${String(directError).slice(0, 120)}`
    );
  }

  let response: Response;
  try {
    response = await fetchWithProxy();
  } catch (error) {
    if (error instanceof DownloadUnavailableError) throw error;
    throw new DownloadUnavailableError(
      'network',
      item.titleFa,
      item.titleEn,
      `Could not fetch the media file: ${String(error).slice(0, 120)}`,
      `دریافت فایل ممکن نشد: ${String(error).slice(0, 120)}`
    );
  }

  if (!response.ok) {
    throw new DownloadUnavailableError(
      'network',
      item.titleFa,
      item.titleEn,
      `Media server returned HTTP ${response.status}.`,
      `سرور مدیا پاسخ HTTP ${response.status} داد.`
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new DownloadUnavailableError(
      'not_media',
      item.titleFa,
      item.titleEn,
      `The source returned ${contentType}, not a media file.`,
      `منبع، فایل مدیا برنگرداند (${contentType}).`
    );
  }

  const totalHeader = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new DownloadUnavailableError(
        'not_media',
        item.titleFa,
        item.titleEn,
        'The media server returned an empty file.',
        'سرور مدیا فایل خالی برگرداند.'
      );
    }
    onProgress(100);
    const mimeType = blob.type || contentType || 'video/mp4';
    return {
      blob,
      filename: `${item.id}.${extensionFor(mimeType, mediaUrl)}`,
      mimeType
    };
  }

  const chunks: BlobPart[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value as unknown as BlobPart);
      received += value.byteLength;
      if (totalHeader > 0) {
        const pct = Math.min(98, 5 + Math.round((received / totalHeader) * 93));
        onProgress(pct);
      }
    }
  }

  if (received === 0) {
    throw new DownloadUnavailableError(
      'not_media',
      item.titleFa,
      item.titleEn,
      'The media server returned no bytes.',
      'سرور مدیا هیچ بایتی برنگرداند.'
    );
  }

  const mimeType = contentType || 'video/mp4';
  if (mimeType.includes('matroska')) {
    throw new DownloadUnavailableError(
      'not_media',
      item.titleFa,
      item.titleEn,
      'This source is an MKV container that the browser cannot reliably play. A direct MP4 source is required.',
      'این منبع از فرمت MKV است که مرورگر نمی‌تواند مطمئن پخش کند. منبع MP4 مستقیم لازم است.'
    );
  }

  onProgress(100);
  const blob = new Blob(chunks, { type: mimeType });
  return {
    blob,
    filename: `${item.id}.${extensionFor(mimeType, mediaUrl)}`,
    mimeType
  };
}

/** Backward-compatible alias used by existing screens. */
export async function generateDownloadableMediaClip(
  item: PrototypeMediaItem,
  onProgress: (pct: number) => void
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  return downloadRealMedia(item, onProgress);
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
