// ============================================================================
// AI PETROS // MASTER SUPREME ORCHESTRATOR AGENT (adk.dev)
// The Central Supreme Agent managing, coordinating, and directing all 10 domain agents
// ============================================================================

import { AdkAgent, type AdkContext, type AdkLogEntry } from './adkTypes';
import { cinemaStreamAgent } from './cinemaStreamAgent';
import { playbackScrubberAgent } from './playbackScrubberAgent';
import { selfHealingAgent } from './selfHealingAgent';
import { subtitleSyncAgent } from './subtitleSyncAgent';
import { tasteCurationAgent } from './tasteCurationAgent';
import { smartSearchAgent } from './smartSearchAgent';
import { cacheStorageAgent } from './cacheStorageAgent';
import { monetizationAdAgent } from './monetizationAdAgent';
import { securityGuardAgent } from './securityGuardAgent';
import { catalogHealthAgent } from './catalogHealthAgent';
import type { PrototypeMediaItem } from '../prototype/types';

export interface SupremeAgentStatus {
  orchestratorName: string;
  framework: string;
  totalSubagents: number;
  overallStatus: 'optimal' | 'recovering' | 'warning';
  agents: Array<{
    name: string;
    description: string;
    toolsCount: number;
    status: string;
  }>;
  securityHealth: any;
  catalogHealth: any;
  monetizationSummary: {
    ownerWallet: string;
    totalEarningsUsd: number;
    watchSeconds: number;
    thresholdHourRemainingMin: number;
  };
}

export class MasterSupremeOrchestratorAgent extends AdkAgent {
  constructor() {
    super({
      name: 'master_supreme_orchestrator_agent',
      description: 'The Supreme Conductor agent from Google ADK (adk.dev) that directs, commands, and coordinates all 10 autonomous agents across Petros Cinema.',
      instruction: 'Coordinate cross-agent workflows (A2A protocol). Ensure cinema streams are genuine, scrubber is accurate, security is airtight, ads respect the 1-hour rule, and repository stays 100% healthy.',
      subagents: [
        cinemaStreamAgent,
        playbackScrubberAgent,
        selfHealingAgent,
        subtitleSyncAgent,
        tasteCurationAgent,
        smartSearchAgent,
        cacheStorageAgent,
        monetizationAdAgent,
        securityGuardAgent,
        catalogHealthAgent
      ]
    });
  }

  /**
   * High-Speed Pre-Playback Workflow
   * Orchestrates Security -> Monetization (1-Hour Rule) -> Stream Resolution in <10ms
   */
  public preparePlaybackSession(
    item: PrototypeMediaItem,
    preferredQuality?: string
  ): {
    streamResolution: any;
    adEvaluation: any;
    isSecurityApproved: boolean;
    orchestrationTimeMs: number;
  } {
    const start = performance.now();
    const ctx = this.createContext();

    // 1. Security Check
    const secResult = securityGuardAgent.validateStream(item.streamUrl || '', ctx);

    // 2. Monetization Policy Check (Strict 1-Hour Rule)
    const adResult = monetizationAdAgent.evaluatePreRoll(undefined, ctx);

    // 3. Stream Resolution (Hollywood/Sci-Fi/Action matching)
    const streamRes = cinemaStreamAgent.run({ item, preferredQuality }, ctx);

    const elapsed = Math.round(performance.now() - start);
    ctx.log('action', `Pre-playback workflow orchestrated for "${item.titleEn}" in ${elapsed}ms`);

    return {
      streamResolution: streamRes,
      adEvaluation: adResult,
      isSecurityApproved: secResult.safe,
      orchestrationTimeMs: elapsed
    };
  }

  /**
   * System-Wide Diagnostic & Health Audit
   */
  public getSupremeHealthReport(catalog?: PrototypeMediaItem[]): SupremeAgentStatus {
    const secReport = securityGuardAgent.getSecurityReport();
    const catReport = catalog && catalog.length > 0
      ? catalogHealthAgent.auditRepository(catalog)
      : catalogHealthAgent.getLastReport();
    const earnings = monetizationAdAgent.getEarningsRecord();
    const watchSec = monetizationAdAgent.getSessionWatchSeconds();
    const remMin = Math.max(0, Math.ceil((3600 - watchSec) / 60));

    const subagentsList = Array.from(this.subagents.values()).map((agent) => ({
      name: agent.name,
      description: agent.description,
      toolsCount: agent.tools.size,
      status: 'active'
    }));

    return {
      orchestratorName: this.name,
      framework: 'Google Agent Development Kit (adk.dev)',
      totalSubagents: this.subagents.size,
      overallStatus: secReport.status === 'alert' ? 'warning' : 'optimal',
      agents: subagentsList,
      securityHealth: secReport,
      catalogHealth: catReport,
      monetizationSummary: {
        ownerWallet: monetizationAdAgent.getOwnerWallet(),
        totalEarningsUsd: earnings.totalEarningsUsd,
        watchSeconds: watchSec,
        thresholdHourRemainingMin: remMin
      }
    };
  }
}

export const masterSupremeOrchestratorAgent = new MasterSupremeOrchestratorAgent();
