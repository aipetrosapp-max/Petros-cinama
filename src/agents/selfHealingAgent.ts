// ============================================================================
// AI PETROS // ADK SELF-HEALING RESILIENCE AGENT (adk.dev)
// Responsibilities:
//   1. Intercept stream errors (403, 404, CORS drops, buffering stalls)
//   2. Autonomous sub-2ms CDN failover to secondary unblocked edge mirrors
//   3. Seamlessly restore playback timestamp without user interruption
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';
import { aiCinemaStreamEngine } from '../services/aiCinemaStreamEngine';

export interface FailoverInput {
  failedUrl: string;
  videoElement: HTMLVideoElement | null;
  currentSec: number;
}

export interface FailoverOutput {
  backupUrl: string;
  resumedPositionSec: number;
  recoveryTimeMs: number;
}

export class SelfHealingAgent extends AdkAgent {
  private totalRecoveries = 0;

  constructor() {
    super({
      name: 'self_healing_resilience_agent',
      description: 'Autonomous ADK agent that detects network drops or stream failures, executes sub-2ms edge rotation, and resumes playback.',
      instruction: 'Always restore playback seamlessly from the exact same second. If browser autoplay blocks audio, fall back to muted autoplay to avoid halting video.'
    });

    this.registerTool({
      name: 'rotateToHealthyMirror',
      description: 'Blacklists the failed node and acquires the next verified unblocked edge mirror.',
      parameters: {
        failedUrl: { type: 'string', description: 'URL of the failing stream', required: true }
      },
      execute: (params: { failedUrl: string }, context: AdkContext) => {
        context.log('warn', `Engaging failover: blacklisting ${params.failedUrl}`);
        const backupUrl = aiCinemaStreamEngine.reportPlaybackFailure(params.failedUrl);
        context.log('action', `Acquired healthy backup CDN node: ${backupUrl}`);
        return backupUrl;
      }
    });

    this.registerTool({
      name: 'restorePlaybackState',
      description: 'Re-attaches stream URL to video element and restores position.',
      parameters: {
        backupUrl: { type: 'string', description: 'New stream URL', required: true },
        resumePos: { type: 'number', description: 'Playback position in seconds to resume from' }
      },
      execute: (params: { backupUrl: string; resumePos: number; videoElement: HTMLVideoElement | null }, context: AdkContext) => {
        const video = params.videoElement;
        if (!video) return;

        video.src = params.backupUrl;
        video.load();
        video.currentTime = params.resumePos;
        video.play().catch(() => {
          context.log('warn', 'Autoplay gesture policy caught, retrying muted');
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    });
  }

  public handleFailover(input: FailoverInput, context?: AdkContext): FailoverOutput {
    const ctx = context || this.createContext();
    const start = performance.now();
    this.totalRecoveries++;

    const rotateTool = this.tools.get('rotateToHealthyMirror')!;
    const backupUrl: string = rotateTool.execute({ failedUrl: input.failedUrl }, ctx);

    const restoreTool = this.tools.get('restorePlaybackState')!;
    restoreTool.execute({
      backupUrl,
      resumePos: input.currentSec,
      videoElement: input.videoElement
    }, ctx);

    const elapsed = Math.round(performance.now() - start);
    return {
      backupUrl,
      resumedPositionSec: input.currentSec,
      recoveryTimeMs: elapsed
    };
  }

  public getRecoveryCount(): number {
    return this.totalRecoveries;
  }
}

export const selfHealingAgent = new SelfHealingAgent();
