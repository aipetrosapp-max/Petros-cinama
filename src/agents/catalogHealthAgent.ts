// ============================================================================
// AI PETROS // ADK CATALOG & REPOSITORY HEALTH INSPECTOR AGENT (adk.dev)
// Responsibilities:
//   1. Continuously scan all movies & series in the repository
//   2. Validate stream URLs, poster availability, and metadata integrity
//   3. Detect anomalies (blacklisted test videos, 403 Google links, dead URLs)
//   4. Auto-heal broken records with verified 4K/1080p unblocked cinema streams
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';
import type { PrototypeMediaItem } from '../prototype/types';
import { getStreamAvailability } from '../services/streamSourceResolver';

export interface CatalogItemAuditResult {
  id: string;
  title: string;
  isStreamValid: boolean;
  isPosterValid: boolean;
  isMetadataComplete: boolean;
  healed: boolean;
  issues: string[];
}

export interface CatalogHealthReport {
  totalFilmsScanned: number;
  healthyCount: number;
  healedCount: number;
  integrityScorePct: number;
  status: 'optimal' | 'recovering' | 'degraded';
  scanTimestamp: string;
}

export class CatalogHealthAgent extends AdkAgent {
  private lastReport: CatalogHealthReport = {
    totalFilmsScanned: 0,
    healthyCount: 0,
    healedCount: 0,
    integrityScorePct: 100,
    status: 'optimal',
    scanTimestamp: new Date().toISOString()
  };

  constructor() {
    super({
      name: 'catalog_health_agent',
      description: 'Autonomous ADK agent that scans the film & series repository, validates stream URLs, flags anomalies, and auto-heals corrupted records.',
      instruction: 'Verify that every film in the repository has a playable, unblocked stream. Automatically replace any broken or test clips with genuine Hollywood/Sci-Fi streams.'
    });

    this.registerTool({
      name: 'auditCatalogItem',
      description: 'Audits an individual movie/series item for stream and metadata validity.',
      parameters: {
        item: { type: 'object', description: 'PrototypeMediaItem object', required: true }
      },
      execute: (params: { item: PrototypeMediaItem }, context: AdkContext): CatalogItemAuditResult => {
        const item = params.item;
        const issues: string[] = [];
        let isPosterValid = true;

        const availability = getStreamAvailability(item);
        const isStreamValid = availability.status === 'available';
        if (!isStreamValid) {
          issues.push(
            availability.status === 'requires_gateway'
              ? 'Telegram source requires the configured range gateway'
              : 'No verified direct media source'
          );
        }
        const healed = false;

        if (!item.posterUrl || !item.posterUrl.startsWith('http')) {
          isPosterValid = false;
          issues.push('Invalid poster URL');
        }

        const isMetadataComplete = Boolean(item.titleEn || item.titleFa);
        if (!isMetadataComplete) issues.push('Incomplete metadata fields');

        if (!isStreamValid) {
          // Never mutate the item to point at another title. The player will show
          // a maintenance/retry state based on the resolver result.
          context.log(
            'warn',
            `"${item.titleEn || item.titleFa}" has no verified playable source; left unchanged.`
          );
        }

        return {
          id: item.id,
          title: item.titleEn,
          isStreamValid,
          isPosterValid,
          isMetadataComplete,
          healed,
          issues
        };
      }
    });
  }

  public auditRepository(catalog: PrototypeMediaItem[], context?: AdkContext): CatalogHealthReport {
    const ctx = context || this.createContext();
    const auditTool = this.tools.get('auditCatalogItem')!;

    let healthy = 0;
    let healed = 0;

    for (const item of catalog) {
      const res: CatalogItemAuditResult = auditTool.execute({ item }, ctx);
      if (res.healed) healed++;
      if (res.isStreamValid && res.isPosterValid) healthy++;
    }

    const total = catalog.length;
    const scorePct = total > 0 ? Math.round((healthy / total) * 100) : 100;

    this.lastReport = {
      totalFilmsScanned: total,
      healthyCount: healthy,
      healedCount: healed,
      integrityScorePct: scorePct,
      status: scorePct >= 95 ? 'optimal' : scorePct >= 80 ? 'recovering' : 'degraded',
      scanTimestamp: new Date().toISOString()
    };

    ctx.log('info', `Repository audit completed: ${healthy}/${total} healthy, ${healed} healed (${scorePct}%)`);
    return this.lastReport;
  }

  public getLastReport(): CatalogHealthReport {
    return { ...this.lastReport };
  }
}

export const catalogHealthAgent = new CatalogHealthAgent();
