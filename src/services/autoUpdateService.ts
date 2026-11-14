/**
 * Autonomous Zero-Reinstall Auto-Update Engine
 * Guarantees that whenever GitHub is updated, all clients (PWA, mobile, Android TV, web)
 * automatically update their UI/UX and code without requiring re-installation or manual cache clearing.
 */

export interface VersionInfo {
  version: string;
  buildTime: string;
  app?: string;
  autoUpdate?: boolean;
}

const LOCAL_VERSION_KEY = 'aipetros_active_build_version';
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

class AutoUpdateService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private currentVersion: string | null = null;
  private checkTimer: number | null = null;
  private onUpdateCallbacks: Set<(newVersion: string) => void> = new Set();

  constructor() {
    this.currentVersion = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_VERSION_KEY) : null;
    this.init();
  }

  public onNewVersion(callback: (newVersion: string) => void) {
    this.onUpdateCallbacks.add(callback);
    return () => this.onUpdateCallbacks.delete(callback);
  }

  public async init() {
    if (typeof window === 'undefined') return;

    // Register Service Worker
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        this.swRegistration = reg;

        // Check for updates immediately
        reg.update().catch(() => {});

        // Listen for updates from Service Worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[AutoUpdate] New Service Worker version detected!');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                this.notifyUpdate('New build deployed');
              }
            });
          }
        });
      } catch (err) {
        console.warn('[AutoUpdate] ServiceWorker registration bypassed:', err);
      }
    }

    // Periodic & Event-Driven Version Polling
    this.checkRemoteVersion();
    this.checkTimer = window.setInterval(() => this.checkRemoteVersion(), CHECK_INTERVAL_MS);

    // Also check on tab focus or online event
    window.addEventListener('focus', () => this.checkRemoteVersion());
    window.addEventListener('online', () => this.checkRemoteVersion());
  }

  public async checkRemoteVersion(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const cacheBuster = Date.now();
      const resp = await fetch(`./version.json?_t=${cacheBuster}`, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
      });

      if (!resp.ok) return false;

      const data: VersionInfo = await resp.json();
      const remoteVersion = `${data.version}-${data.buildTime}`;

      if (!this.currentVersion) {
        this.currentVersion = remoteVersion;
        localStorage.setItem(LOCAL_VERSION_KEY, remoteVersion);
        return false;
      }

      if (this.currentVersion !== remoteVersion) {
        console.log(`[AutoUpdate] Version bump detected! Local: ${this.currentVersion} -> Remote: ${remoteVersion}`);
        this.currentVersion = remoteVersion;
        localStorage.setItem(LOCAL_VERSION_KEY, remoteVersion);

        // Force Service Worker update
        if (this.swRegistration) {
          this.swRegistration.update().catch(() => {});
        }

        this.notifyUpdate(data.version);
        return true;
      }
    } catch {
      // offline or unreachable
    }
    return false;
  }

  private notifyUpdate(version: string) {
    this.onUpdateCallbacks.forEach((cb) => {
      try {
        cb(version);
      } catch {}
    });
  }

  public forceApplyUpdate() {
    if (typeof window === 'undefined') return;
    // Clear legacy cache keys
    if ('caches' in window) {
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).finally(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }
}

export const autoUpdateService = new AutoUpdateService();
