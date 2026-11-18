// ============================================================================
// AI PETROS // SELF-HEALING RESILIENCE AGENT (adk.dev)
// Intercepts stream errors, blacklists the failing node and re-attaches a
// verified alternate source when one exists. If no verified source exists it
// reports failure so the UI can show an honest maintenance state.
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';
import { aiCinemaStreamEngine } from '../services/aiCinemaStreamEngine';
import type { PrototypeMediaItem } from '../prototype/types';

export interface FailoverInput {
  failedUrl: string;
  videoElement: HTMLVideoElement | null;
  currentSec: number;
  item?: PrototypeMediaItem | null;
}

export interface FailoverOutput {
  backupUrl: string;
  resumedPositionSec: number;
  recoveryTimeMs: number;
  recovered: boolean;
}

export class SelfHealingAgent extends AdkAgent {
  private totalRecoveries = 0;

  constructor() {
    super({
      name: 'self_healing_resilience_agent',
      description:
        'ADK agent that detects stream failures, blacklists the broken node and restores playback only from a verified alternate source.',
      instruction:
        'Never substitute an unrelated film or trailer. If no verified alternate source exists, return recovered=false and preserve the last known position for the retry action.'
    });

    this.registerTool({
      name: 'rotateToHealthyMirror',
      description: 'Blacklists the failed node and returns the next verified source for the same title, if any.',
      parameters: {
        failedUrl: { type: 'string', description: 'URL of the failing stream', required: true }
      },
      execute: (params: { failedUrl: string; item?: PrototypeMediaItem | null }, context: AdkContext) => {
        context.log('warn', `Engaging failover: blacklisting ${params.failedUrl}`);
        const backupUrl = aiCinemaStreamEngine.reportPlaybackFailure(params.failedUrl, params.item);
        if (backupUrl) {
          context.log('action', `Acquired verified backup source: ${backupUrl}`);
        } else {
          context.log('warn', 'No verified backup source exists; maintenance state required.');
        }
        return backupUrl;
      }
    });

    this.registerTool({
      name: 'restorePlaybackState',
      description: 'Re-attaches a verified stream URL to the video element and restores position.',
      parameters: {
        backupUrl: { type: 'string', description: 'New stream URL', required: true },
        resumePos: { type: 'number', description: 'Playback position in seconds to resume from' }
      },
      execute: (
        params: { backupUrl: string; resumePos: number; videoElement: HTMLVideoElement | null },
        context: AdkContext
      ) => {
        const video = params.videoElement;
        if (!video || !params.backupUrl) return;

        video.src = params.backupUrl;
        if (typeof video.load === 'function') {
          video.load();
        }
        video.currentTime = params.resumePos;
        if (typeof video.play === 'function') {
          video.play().catch(() => {
            context.log('warn', 'Autoplay gesture policy caught, retrying muted');
            video.muted = true;
            if (typeof video.play === 'function') {
              video.play().catch(() => {});
            }
          });
        }
      }
    });
  }

  public handleFailover(input: FailoverInput, context?: AdkContext): FailoverOutput {
    const ctx = context || this.createContext();
    const start = performance.now();
    this.totalRecoveries++;

    const rotateTool = this.tools.get('rotateToHealthyMirror')!;
    const backupUrl: string = rotateTool.execute(
      { failedUrl: input.failedUrl, item: input.item },
      ctx
    );

    if (backupUrl) {
      const restoreTool = this.tools.get('restorePlaybackState')!;
      restoreTool.execute(
        {
          backupUrl,
          resumePos: input.currentSec,
          videoElement: input.videoElement
        },
        ctx
      );
    }

    return {
      backupUrl,
      resumedPositionSec: input.currentSec,
      recoveryTimeMs: Math.round(performance.now() - start),
      recovered: Boolean(backupUrl)
    };
  }

  public getRecoveryCount(): number {
    return this.totalRecoveries;
  }
}

export const selfHealingAgent = new SelfHealingAgent();
