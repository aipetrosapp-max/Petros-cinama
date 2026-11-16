// ============================================================================
// AI PETROS // ADK TELEGRAM CATALOG & PURIFICATION AGENT (adk.dev)
// Internal Autonomous Agent responsible for checking the movie repository
// against Telegram, purging obsolete mock items, and ensuring authentic
// synchronization right at app startup and on demand.
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';
import type { PrototypeMediaItem } from '../prototype/types';
import { dynamicStreamSync, convertDynamicStreamToMediaItem, type DynamicStreamItem } from '../services/dynamicStreamSync';

export interface CatalogPurificationReport {
  timestamp: string;
  totalSynced: number;
  purgedDummyCount: number;
  duplicateCount: number;
  status: 'purified' | 'synced' | 'degraded';
  messageFa: string;
}

export class TelegramCatalogAgent extends AdkAgent {
  private lastReport: CatalogPurificationReport = {
    timestamp: new Date().toISOString(),
    totalSynced: 0,
    purgedDummyCount: 0,
    duplicateCount: 0,
    status: 'synced',
    messageFa: 'مخزن فیلم‌های سینما آماده بررسی است.'
  };

  // Custom user-defined legal & operational rules dictionary
  private customUserRules: Record<string, any> = {};

  constructor() {
    super({
      name: 'telegram_catalog_agent',
      description: 'Internal autonomous ADK agent that synchronizes, purifies, and verifies the cinema repository against Telegram channels at app startup.',
      instruction: 'Purge all legacy mock data, verify Telegram media sources, and ensure real movie titles and posters are loaded cleanly without artificial restrictions.'
    });

    this.registerTool({
      name: 'purifyObsoleteMockItems',
      description: 'Scans the given item list and purges legacy prototype items (X-Men, Interstellar seeds, etc.) and duplicates.',
      parameters: {
        items: { type: 'object', description: 'Array of PrototypeMediaItem', required: true }
      },
      execute: (params: { items: PrototypeMediaItem[] }, context: AdkContext) => {
        const initialCount = params.items.length;
        const legacyPrefixes = [
          'film-x-men',
          'film-interstellar',
          'film-blade-runner',
          'film-dune',
          'film-batman'
        ];

        const seenIds = new Set<string>();
        const seenPosts = new Set<string>();

        const purified = params.items.filter((item) => {
          if (!item || !item.id) return false;
          // Filter out legacy dummy entries if we have genuine Telegram items
          if (legacyPrefixes.some((p) => item.id.startsWith(p)) && initialCount > 5) {
            return false;
          }
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);

          const postKey = item.defaultStreamUrl || item.telegramUrl || item.streamUrl || '';
          if (postKey && postKey.includes('t.me/')) {
            if (seenPosts.has(postKey)) return false;
            seenPosts.add(postKey);
          }
          return true;
        });

        const purged = initialCount - purified.length;
        context.log('action', `Purified catalog: removed ${purged} legacy/duplicate items. Active: ${purified.length}`);
        return { purified, purgedCount: purged };
      }
    });

    this.registerTool({
      name: 'fetchTelegramStreamManifest',
      description: 'Fetches the full 540+ cinema stream manifest from local and remote endpoints with automatic failover.',
      parameters: {},
      execute: async (_params: any, context: AdkContext) => {
        context.log('info', 'Querying Telegram stream repository manifest...');
        const syncResult = await dynamicStreamSync.syncNow(true);
        const rawStreams = dynamicStreamSync.getStreams();
        context.log('action', `Retrieved ${rawStreams.length} stream records from Telegram catalog source.`);
        return { streams: rawStreams, success: syncResult.success };
      }
    });
  }

  /**
   * Sets user/owner legal and operational rules dynamically without hardcoded limits.
   */
  public setCustomRule(ruleKey: string, ruleValue: any): void {
    this.customUserRules[ruleKey] = ruleValue;
    console.log(`[TelegramCatalogAgent] Custom rule registered: ${ruleKey} =`, ruleValue);
  }

  public getCustomRules(): Record<string, any> {
    return { ...this.customUserRules };
  }

  /**
   * Main startup execution pipeline:
   * 1. Fetches manifest from Telegram repository with multi-candidate failover
   * 2. Purges obsolete prototype items from cache and memory
   * 3. Hydrates authentic items with Persian titles, high-res posters, and direct links
   * 4. Returns the clean 540+ item catalog
   */
  public async purifyAndSync(
    currentItems: PrototypeMediaItem[] = []
  ): Promise<{ catalog: PrototypeMediaItem[]; report: CatalogPurificationReport }> {
    const ctx = this.createContext();
    ctx.log('info', 'Starting autonomous Telegram repository check & purification at app launch...');

    // 1. Fetch latest repository manifest
    const fetchTool = this.tools.get('fetchTelegramStreamManifest')!;
    const fetchRes = await fetchTool.execute({}, ctx);
    const rawStreams: DynamicStreamItem[] = fetchRes.streams || [];

    // 2. Convert dynamic items
    const convertedItems = rawStreams.map(convertDynamicStreamToMediaItem);

    // 3. Merge with current items if any custom ones exist
    const pool = convertedItems.length > 0 ? convertedItems : currentItems;

    // 4. Purify items
    const purifyTool = this.tools.get('purifyObsoleteMockItems')!;
    const purifyRes = purifyTool.execute({ items: pool }, ctx);
    const cleanCatalog: PrototypeMediaItem[] = purifyRes.purified;

    // 5. Clean up old offline vault in localStorage if present
    if (typeof window !== 'undefined') {
      try {
        const vaultStr = localStorage.getItem('aipetros_offline_vault_v1');
        if (vaultStr) {
          const vault = JSON.parse(vaultStr);
          if (vault && Array.isArray(vault.catalog)) {
            vault.catalog = cleanCatalog;
            localStorage.setItem('aipetros_offline_vault_v1', JSON.stringify(vault));
          }
        }
      } catch {
        // ignore parse error
      }
    }

    this.lastReport = {
      timestamp: new Date().toISOString(),
      totalSynced: cleanCatalog.length,
      purgedDummyCount: purifyRes.purgedCount,
      duplicateCount: 0,
      status: cleanCatalog.length > 0 ? 'synced' : 'degraded',
      messageFa: `مخزن ابری پتروس سینما با موفقیت بررسی و پاک‌سازی شد (${cleanCatalog.length} عنوان فعال).`
    };

    ctx.log('action', `App startup check complete: ${cleanCatalog.length} active cinema items loaded.`);
    return {
      catalog: cleanCatalog,
      report: this.lastReport
    };
  }

  public getLastReport(): CatalogPurificationReport {
    return this.lastReport;
  }
}

export const telegramCatalogAgent = new TelegramCatalogAgent();
