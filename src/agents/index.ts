// ============================================================================
// AI PETROS // GOOGLE ADK MULTI-AGENT MESH & ORCHESTRATOR (adk.dev)
// Unified multi-agent architecture coordinating all autonomous agents across Petros Cinema
// ============================================================================

export * from './adkTypes';
export * from './cinemaStreamAgent';
export * from './playbackScrubberAgent';
export * from './selfHealingAgent';
export * from './subtitleSyncAgent';
export * from './tasteCurationAgent';
export * from './smartSearchAgent';

import { cinemaStreamAgent } from './cinemaStreamAgent';
import { playbackScrubberAgent } from './playbackScrubberAgent';
import { selfHealingAgent } from './selfHealingAgent';
import { subtitleSyncAgent } from './subtitleSyncAgent';
import { tasteCurationAgent } from './tasteCurationAgent';
import { smartSearchAgent } from './smartSearchAgent';
import { AdkAgent, type AdkContext } from './adkTypes';

export class PetrosCinemaAdkMesh extends AdkAgent {
  constructor() {
    super({
      name: 'petros_cinema_adk_mesh',
      description: 'Master ADK Orchestrator coordinating all specialized cinema agents across the application.',
      instruction: 'Delegate specialized tasks to cinemaStreamAgent, playbackScrubberAgent, selfHealingAgent, subtitleSyncAgent, tasteCurationAgent, and smartSearchAgent.',
      subagents: [
        cinemaStreamAgent,
        playbackScrubberAgent,
        selfHealingAgent,
        subtitleSyncAgent,
        tasteCurationAgent,
        smartSearchAgent
      ]
    });
  }

  public getAgentsStatus() {
    return {
      orchestrator: this.name,
      model: this.model,
      activeAgentsCount: this.subagents.size,
      agents: Array.from(this.subagents.values()).map((agent) => ({
        name: agent.name,
        description: agent.description,
        toolsCount: agent.tools.size
      }))
    };
  }
}

export const petrosAdkMesh = new PetrosCinemaAdkMesh();
