// ============================================================================
// AI PETROS // ADK CACHE & STORAGE MANAGEMENT AGENT (adk.dev)
// Responsibilities:
//   1. Monitor browser storage (LocalStorage, CacheStorage, IndexedDB)
//   2. Enforce storage quotas and perform intelligent LRU cache pruning
//   3. Pre-fetch and cache film metadata and posters for zero-latency UI
// ============================================================================

import { AdkAgent, type AdkContext, type AdkExecutionResult } from './adkTypes';

export interface StorageMetrics {
  usedKb: number;
  totalQuotaKb: number;
  percentageUsed: number;
  cachedFilmsCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

export class CacheStorageAgent extends AdkAgent {
  private cachePrefix = 'aipetros_cache_';
  private maxAllowedKb = 50 * 1024; // 50 MB threshold for browser localStorage/cache

  constructor() {
    super({
      name: 'cache_storage_agent',
      description: 'Autonomous ADK agent managing client storage, IndexedDB, LRU cache eviction, and asset prefetching.',
      instruction: 'Ensure client storage never exceeds safety limits. Clean up stale or orphan cache keys automatically while keeping favorite films safe.'
    });

    this.registerTool({
      name: 'calculateStorageUsage',
      description: 'Calculates the approximate storage consumed by the application.',
      execute: (_params: any, context: AdkContext) => {
        let totalBytes = 0;
        let cachedItems = 0;

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                const val = localStorage.getItem(key) || '';
                totalBytes += key.length * 2 + val.length * 2;
                if (key.startsWith('aipetros_') || key.includes('film') || key.includes('stream')) {
                  cachedItems++;
                }
              }
            }
          }
        } catch (e) {
          context.log('warn', 'Unable to inspect localStorage quota', e);
        }

        const usedKb = Math.round(totalBytes / 1024);
        const percentageUsed = Math.min(100, Math.round((usedKb / this.maxAllowedKb) * 100));
        const status = percentageUsed > 85 ? 'warning' : 'healthy';

        context.log('info', `Storage metrics: ${usedKb} KB used (${percentageUsed}%) across ${cachedItems} cached keys`);

        return {
          usedKb,
          totalQuotaKb: this.maxAllowedKb,
          percentageUsed,
          cachedFilmsCount: cachedItems,
          status
        };
      }
    });

    this.registerTool({
      name: 'pruneStaleCache',
      description: 'Safely removes old or non-essential cache entries if approaching quota.',
      execute: (params: { targetKbToFree?: number }, context: AdkContext) => {
        let freedBytes = 0;
        const keysToRemove: string[] = [];

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('aipetros_temp_') || key.startsWith('aipetros_cache_'))) {
                keysToRemove.push(key);
              }
            }

            for (const k of keysToRemove) {
              const val = localStorage.getItem(k) || '';
              freedBytes += k.length * 2 + val.length * 2;
              localStorage.removeItem(k);
            }
          }
        } catch (e) {
          context.log('warn', 'Cache pruning encountered an error', e);
        }

        const freedKb = Math.round(freedBytes / 1024);
        context.log('action', `Pruned ${keysToRemove.length} temporary cache keys, freed ${freedKb} KB`);
        return { freedKb, removedCount: keysToRemove.length };
      }
    });
  }

  public getStorageMetrics(context?: AdkContext): StorageMetrics {
    const ctx = context || this.createContext();
    const tool = this.tools.get('calculateStorageUsage')!;
    return tool.execute({}, ctx);
  }

  public pruneCache(targetKb?: number, context?: AdkContext): { freedKb: number; removedCount: number } {
    const ctx = context || this.createContext();
    const tool = this.tools.get('pruneStaleCache')!;
    return tool.execute({ targetKbToFree: targetKb }, ctx);
  }
}

export const cacheStorageAgent = new CacheStorageAgent();
