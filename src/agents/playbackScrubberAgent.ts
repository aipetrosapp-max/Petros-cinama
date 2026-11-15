// ============================================================================
// AI PETROS // ADK PLAYBACK & SCRUBBER AGENT (adk.dev)
// Responsibilities:
//   1. Calibrate real physical video element duration against virtual duration
//   2. Enable smooth, lag-free forward & backward scrubbing with pointer capture
//   3. Enforce boundary-safe seeks to eliminate video stall and playback errors
// ============================================================================

import { AdkAgent, type AdkContext, type AdkExecutionResult } from './adkTypes';

export interface CalibrateProgressInput {
  videoElement: HTMLVideoElement | null;
  metadataDurationSec: number;
}

export interface CalibratedProgressOutput {
  currentSec: number;
  effectiveDurationSec: number;
  progressRatio: number;
}

export interface ExecuteSeekInput {
  videoElement: HTMLVideoElement | null;
  targetRatio: number;
  effectiveDurationSec: number;
}

export class PlaybackScrubberAgent extends AdkAgent {
  constructor() {
    super({
      name: 'playback_scrubber_agent',
      description: 'Autonomous ADK agent controlling time tracking, scrubber needle motion, and frame-accurate seeking.',
      instruction: 'Ensure the scrubber reflects the true playable buffer. Never allow seek requests to exceed the video element duration to prevent playback stall.'
    });

    this.registerTool({
      name: 'calibrateTimeline',
      description: 'Calculates the true effective timeline duration and current progress ratio.',
      parameters: {
        currentTime: { type: 'number', description: 'Current playback position in seconds', required: true },
        videoDuration: { type: 'number', description: 'Video element physical duration in seconds' },
        metadataDuration: { type: 'number', description: 'Fallback metadata duration in seconds' }
      },
      execute: (params: { currentTime: number; videoDuration?: number; metadataDuration?: number }, context: AdkContext) => {
        const hasValidDuration = params.videoDuration && isFinite(params.videoDuration) && params.videoDuration > 0;
        const effectiveDur = hasValidDuration ? params.videoDuration! : (params.metadataDuration || 360);
        const ratio = effectiveDur > 0 ? Math.min(1, Math.max(0, params.currentTime / effectiveDur)) : 0;
        return {
          currentSec: params.currentTime,
          effectiveDurationSec: effectiveDur,
          progressRatio: ratio
        };
      }
    });

    this.registerTool({
      name: 'clampSeekBoundary',
      description: 'Clamps the requested seek time within the safe physical media boundary.',
      parameters: {
        targetRatio: { type: 'number', description: 'Normalized scrub position (0.0 to 1.0)', required: true },
        effectiveDuration: { type: 'number', description: 'Effective duration in seconds', required: true },
        videoDuration: { type: 'number', description: 'Physical video duration' }
      },
      execute: (params: { targetRatio: number; effectiveDuration: number; videoDuration?: number }, context: AdkContext) => {
        const clampedRatio = Math.max(0, Math.min(1, params.targetRatio));
        const rawSec = clampedRatio * params.effectiveDuration;
        const hasVid = params.videoDuration && isFinite(params.videoDuration) && params.videoDuration > 0;
        const maxBound = hasVid ? Math.max(0, params.videoDuration! - 0.25) : rawSec;
        const safeSec = Math.min(rawSec, maxBound);

        context.log('action', `Clamped seek: ${(clampedRatio * 100).toFixed(1)}% -> ${safeSec.toFixed(1)}s (max: ${maxBound.toFixed(1)}s)`);
        return safeSec;
      }
    });
  }

  public calibrate(input: CalibrateProgressInput, context?: AdkContext): CalibratedProgressOutput {
    const ctx = context || this.createContext();
    const cur = input.videoElement?.currentTime || 0;
    const vidDur = input.videoElement?.duration;

    const tool = this.tools.get('calibrateTimeline')!;
    return tool.execute({
      currentTime: cur,
      videoDuration: vidDur,
      metadataDuration: input.metadataDurationSec
    }, ctx);
  }

  public seek(input: ExecuteSeekInput, context?: AdkContext): number {
    const ctx = context || this.createContext();
    const tool = this.tools.get('clampSeekBoundary')!;
    const safeSec = tool.execute({
      targetRatio: input.targetRatio,
      effectiveDuration: input.effectiveDurationSec,
      videoDuration: input.videoElement?.duration
    }, ctx);

    if (input.videoElement) {
      try {
        input.videoElement.currentTime = safeSec;
      } catch (err) {
        ctx.log('warn', 'Video seek warning caught', err);
      }
    }
    return safeSec;
  }
}

export const playbackScrubberAgent = new PlaybackScrubberAgent();
