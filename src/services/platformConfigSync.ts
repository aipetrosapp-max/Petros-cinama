// ============================================================================
// PETROS CINEMA // PLATFORM CONFIG SYNC (Zero-Client-Update Architecture)
//
// The Master Admin Panel commits data/admin-config.json to GitHub and bumps
// `manifestVersion`. Every installed client (web / android / TV / desktop)
// polls this small file and applies feature switches, wallet addresses and
// maintenance mode live — without a new build or store update.
//
// Candidates:
//   1. /api/public/config          — self-hosted streaming server (instant)
//   2. {BASE}data/admin-config.json — same-origin static bundle (GitHub Pages)
//   3. raw.githubusercontent.com    — canonical repo file (any mirror)
//
// The payload is a few KB, so localStorage is safe here (the multi-MB catalog
// lives in IndexedDB via catalogCache.ts — this must not change).
// ============================================================================

import { DEFAULT_GITHUB_STREAMS_URL } from './dynamicStreamSync';

export interface PlatformFeatureFlags {
  donationEnabled: boolean;
  cryptoPaymentEnabled: boolean;
  cryptoAdBannerEnabled: boolean;
  watchPartyEnabled: boolean;
  offlineDownloadEnabled: boolean;
  telegramGatewayEnabled: boolean;
  aiSubtitleSyncEnabled: boolean;
  maintenanceMode: boolean;
}

export interface PlatformWallet {
  network: string;
  address: string;
  label?: string;
  enabled: boolean;
  decimals?: number;
}

export interface PlatformConfig {
  manifestVersion: string;
  features: PlatformFeatureFlags;
  wallets: PlatformWallet[];
  updatedAt: string;
}

type ConfigListener = (config: PlatformConfig) => void;

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;
const STORAGE_KEY = 'aipetros_platform_config_v1';

const FEATURE_DEFAULTS: PlatformFeatureFlags = {
  donationEnabled: true,
  cryptoPaymentEnabled: true,
  cryptoAdBannerEnabled: true,
  watchPartyEnabled: true,
  offlineDownloadEnabled: true,
  telegramGatewayEnabled: true,
  aiSubtitleSyncEnabled: true,
  maintenanceMode: false
};

function readStoredSnapshot(): PlatformConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlatformConfig;
    if (parsed && parsed.features && typeof parsed.manifestVersion === 'string') return parsed;
  } catch {
    // corrupted snapshot — ignore
  }
  return null;
}

class PlatformConfigSyncService {
  private config: PlatformConfig | null = null;
  private listeners = new Set<ConfigListener>();
  private timerId: number | null = null;
  private isSyncing = false;

  constructor() {
    this.config = readStoredSnapshot();
  }

  /** Feature switch with a safe default while no config has ever loaded. */
  public isFeatureEnabled(name: keyof PlatformFeatureFlags, fallback = true): boolean {
    if (!this.config) return fallback;
    const value = this.config.features?.[name];
    return typeof value === 'boolean' ? value : FEATURE_DEFAULTS[name] && fallback;
  }

  public getConfig(): PlatformConfig | null {
    return this.config;
  }

  public getManifestVersion(): string {
    return this.config?.manifestVersion || '';
  }

  /** Live wallet list from the panel; null means "use built-in defaults". */
  public getWallets(): PlatformWallet[] | null {
    const wallets = (this.config?.wallets || []).filter((w) => w.enabled && w.address);
    return this.config && wallets.length > 0 ? wallets : null;
  }

  public subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    if (this.config) listener(this.config);
    return () => this.listeners.delete(listener);
  }

  private candidateUrls(): string[] {
    const urls = new Set<string>();
    if (typeof window !== 'undefined') {
      urls.add('/api/public/config');
    }
    const baseUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    urls.add(`${cleanBase}data/admin-config.json`);
    try {
      const rawStreams = new URL(DEFAULT_GITHUB_STREAMS_URL);
      rawStreams.pathname = rawStreams.pathname.replace(
        /data\/streams\.json$/,
        'data/admin-config.json'
      );
      urls.add(rawStreams.toString());
    } catch {
      // invalid default URL — skip
    }
    return [...urls];
  }

  public async syncNow(): Promise<PlatformConfig | null> {
    if (this.isSyncing) return this.config;
    this.isSyncing = true;
    try {
      for (const candidate of this.candidateUrls()) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const target = candidate + (candidate.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
          const response = await fetch(target, {
            cache: 'no-cache',
            headers: { Accept: 'application/json' },
            signal: controller.signal
          });
          if (!response.ok) continue;
          const parsed = (await response.json()) as Partial<PlatformConfig>;
          if (!parsed || !parsed.features || typeof parsed.manifestVersion !== 'string') {
            continue;
          }
          const next: PlatformConfig = {
            manifestVersion: parsed.manifestVersion,
            features: { ...FEATURE_DEFAULTS, ...parsed.features },
            wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
            updatedAt: parsed.updatedAt || new Date().toISOString()
          };
          const changed = !this.config || this.config.manifestVersion !== next.manifestVersion;
          this.config = next;
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // quota/private mode: in-memory copy still applies for this session
          }
          if (changed) {
            console.log(
              `[PlatformConfigSync] manifest ${next.manifestVersion} applied from ${candidate}`
            );
            for (const listener of this.listeners) {
              try {
                listener(next);
              } catch (err) {
                console.error('[PlatformConfigSync] listener error:', err);
              }
            }
          }
          return next;
        } catch {
          // try next candidate
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      this.isSyncing = false;
    }
    return this.config;
  }

  public start(intervalMs = POLL_INTERVAL_MS): void {
    this.stop();
    void this.syncNow();
    if (typeof window !== 'undefined') {
      this.timerId = window.setInterval(() => void this.syncNow(), intervalMs);
      window.addEventListener('online', () => void this.syncNow());
    }
  }

  public stop(): void {
    if (this.timerId !== null && typeof window !== 'undefined') {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

export const platformConfigSync = new PlatformConfigSyncService();

/** Convenience accessor used across client screens. */
export function isFeatureEnabled(
  name: keyof PlatformFeatureFlags,
  fallback = true
): boolean {
  return platformConfigSync.isFeatureEnabled(name, fallback);
}
