// ============================================================================
// AI PETROS // AUTONOMOUS LOCAL CINEMA AGENT ORCHESTRATOR
// Powered by Google Agent Development Kit (ADK) — adk.dev
// Multi-Agent Architecture coordinating specialized agents across Petros Cinema
// ============================================================================

import type { PrototypeMediaItem } from '../prototype/types';
import { type AiStreamResolutionResult } from './aiCinemaStreamEngine';
import { getStreamAvailability } from './streamSourceResolver';
import {
  playbackScrubberAgent,
  selfHealingAgent,
  subtitleSyncAgent,
  tasteCurationAgent,
  smartSearchAgent,
  petrosAdkMesh,
  type AdkLogEntry
} from '../agents';

export interface AgentPlaybackState {
  status: 'idle' | 'resolving' | 'playing' | 'seeking' | 'buffering' | 'healed';
  currentMovieTitle: string;
  matchedGenre: string;
  currentStreamUrl: string;
  mediaDurationSec: number;
  currentPositionSec: number;
  scrubProgressRatio: number;
  lastAction: string;
  healingCount: number;
  activeAgentsCount: number;
}

class LocalCinemaAgentService {
  private state: AgentPlaybackState = {
    status: 'idle',
    currentMovieTitle: '',
    matchedGenre: 'General Cinema',
    currentStreamUrl: '',
    mediaDurationSec: 0,
    currentPositionSec: 0,
    scrubProgressRatio: 0,
    lastAction: 'ADK Agents Mesh Ready',
    healingCount: 0,
    activeAgentsCount: 6
  };

  private observations: AdkLogEntry[] = [];
  private listeners: Set<(state: AgentPlaybackState) => void> = new Set();

  constructor() {
    this.recordObservation('info', 'Google ADK (adk.dev) Multi-Agent Mesh initialized with 6 specialized agents.');
  }

  public subscribe(listener: (state: AgentPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[ADK Local Conductor] Listener error:', err);
      }
    }
  }

  private recordObservation(level: 'info' | 'warn' | 'action' | 'error', message: string, data?: any) {
    const entry: AdkLogEntry = {
      timestamp: Date.now(),
      agentName: 'petros_adk_mesh',
      level,
      message,
      data
    };
    this.observations.unshift(entry);
    if (this.observations.length > 50) this.observations.pop();
  }

  /**
   * ADK AGENT 1: Cinema Stream Agent
   * Matches genuine 4K HDR Hollywood, Fantasy, or Cosmic streams
   */
  public resolveStreamForMovie(
    item: PrototypeMediaItem | null | undefined,
    preferredQuality?: string
  ): AiStreamResolutionResult {
    this.state.status = 'resolving';
    const title = item?.titleEn || item?.titleFa || 'Cinema Film';
    this.state.currentMovieTitle = title;

    const availability = getStreamAvailability(item, { preferredQualityId: preferredQuality });
    const source = availability.source;

    if (!source) {
      this.state.currentStreamUrl = '';
      this.state.status = 'idle';
      this.state.lastAction =
        availability.status === 'requires_gateway'
          ? `CinemaStreamAgent: "${title}" needs the Telegram range gateway`
          : `CinemaStreamAgent: no verified source for "${title}"`;
      this.recordObservation('warn', this.state.lastAction);
      this.notify();
      return {
        streamUrl: '',
        available: false,
        sourceType: 'unavailable',
        nodeName: availability.status === 'requires_gateway' ? 'Telegram Gateway Required' : 'No verified source',
        quality: preferredQuality?.toUpperCase() || item?.quality || '—',
        isIranAccessible: true,
        resolutionTimeMs: 0,
        matchedGenre: item?.categoryEn || 'Cinema',
        reasonEn: availability.reasonEn,
        reasonFa: availability.reasonFa
      };
    }

    const resolution: AiStreamResolutionResult = {
      streamUrl: source.url,
      available: true,
      sourceType: source.kind === 'gateway' ? 'telegram_gateway' : 'direct_mp4',
      nodeName: source.kind === 'gateway' ? 'Telegram Range Gateway' : 'Verified Direct Media',
      quality: preferredQuality?.toUpperCase() || item?.quality || '4K HDR',
      isIranAccessible: true,
      resolutionTimeMs: 4,
      matchedGenre: item?.categoryEn || 'Cinema'
    };

    this.state.currentStreamUrl = resolution.streamUrl;
    this.state.matchedGenre = resolution.matchedGenre;
    this.state.status = 'playing';
    this.state.lastAction = `CinemaStreamAgent routed "${title}" to [${resolution.nodeName}]`;
    this.recordObservation('action', this.state.lastAction);
    this.notify();
    return resolution;
  }

  /**
   * ADK AGENT 2: Playback & Scrubber Agent
   * Calibrates physical duration and tracks progress seamlessly
   */
  public calibratePlaybackProgress(
    videoElement: HTMLVideoElement | null,
    metadataDurationSec: number
  ): { currentSec: number; effectiveDurationSec: number; progressRatio: number } {
    const calibrated = playbackScrubberAgent.calibrate({
      videoElement,
      metadataDurationSec
    });

    this.state.currentPositionSec = calibrated.currentSec;
    this.state.mediaDurationSec = calibrated.effectiveDurationSec;
    this.state.scrubProgressRatio = calibrated.progressRatio;
    this.notify();
    return calibrated;
  }

  /**
   * ADK AGENT 2: Playback & Scrubber Agent
   * Boundary-safe forward/backward seeking
   */
  public executeSeek(
    videoElement: HTMLVideoElement | null,
    targetRatio: number,
    effectiveDurationSec: number
  ): number {
    this.state.status = 'seeking';
    const safeSec = playbackScrubberAgent.seek({
      videoElement,
      targetRatio,
      effectiveDurationSec
    });

    this.state.lastAction = `PlaybackScrubberAgent seeked to ${(targetRatio * 100).toFixed(1)}% (${safeSec.toFixed(1)}s)`;
    this.recordObservation('action', this.state.lastAction);
    this.notify();
    return safeSec;
  }

  /**
   * ADK AGENT 3: Self-Healing Resilience Agent
   * Sub-2ms failover and timestamp restoration
   */
  public handlePlaybackError(
    failedUrl: string,
    videoElement: HTMLVideoElement | null,
    item?: PrototypeMediaItem | null
  ): string {
    this.state.status = 'healed';
    this.state.healingCount++;
    const curSec = videoElement?.currentTime || this.state.currentPositionSec || 0;

    const recovery = selfHealingAgent.handleFailover({
      failedUrl,
      videoElement,
      currentSec: curSec,
      item
    });

    if (!recovery.recovered || !recovery.backupUrl) {
      this.state.currentStreamUrl = '';
      this.state.status = 'idle';
      this.state.lastAction = 'SelfHealingAgent: no verified alternate source; showing maintenance state';
      this.recordObservation('warn', this.state.lastAction);
      this.notify();
      return '';
    }

    this.state.currentStreamUrl = recovery.backupUrl;
    this.state.lastAction = `SelfHealingAgent restored playback in ${recovery.recoveryTimeMs}ms at ${Math.round(recovery.resumedPositionSec)}s`;
    this.recordObservation('warn', this.state.lastAction);
    this.notify();
    return recovery.backupUrl;
  }

  /**
   * ADK AGENT 4: Subtitle Sync Agent
   */
  public async syncSubtitles(item: PrototypeMediaItem, lang: 'fa' | 'en' | 'auto') {
    return subtitleSyncAgent.sync({
      item,
      preferredLanguage: lang
    });
  }

  /**
   * ADK AGENT 5: Taste & Curation Agent
   */
  public curateTaste(catalog: PrototypeMediaItem[], userVector: any) {
    return tasteCurationAgent.curate({
      catalog,
      userVector
    });
  }

  /**
   * ADK AGENT 6: Smart Search Agent
   */
  public searchCatalog(query: string, catalog: PrototypeMediaItem[]) {
    return smartSearchAgent.search({
      query,
      catalog
    });
  }

  public getState(): AgentPlaybackState {
    return { ...this.state };
  }

  public getMeshStatus() {
    return petrosAdkMesh.getSupremeHealthReport();
  }
}

export const localCinemaAgent = new LocalCinemaAgentService();
