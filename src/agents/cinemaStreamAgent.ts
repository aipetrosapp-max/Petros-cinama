// ============================================================================
// AI PETROS // CINEMA STREAM AGENT (adk.dev)
// Resolves a title to one verified direct media URL or the configured Telegram
// gateway. It never substitutes an unrelated movie/trailer when the requested
// title has no verified source.
// ============================================================================

import { AdkAgent, type AdkContext, type AdkExecutionResult } from './adkTypes';
import type { AiStreamResolutionResult } from '../services/aiCinemaStreamEngine';
import {
  getStreamAvailability,
  resolvePlayableSource,
  type ResolvedStreamSource
} from '../services/streamSourceResolver';
import type { PrototypeMediaItem } from '../prototype/types';

export interface ResolveStreamInput {
  item: PrototypeMediaItem | null | undefined;
  preferredQuality?: string;
}

export class CinemaStreamAgent extends AdkAgent<ResolveStreamInput, AiStreamResolutionResult> {
  constructor() {
    super({
      name: 'cinema_stream_agent',
      description:
        'ADK agent that resolves one verified direct stream (or Telegram gateway stream) for a title and reports unavailability honestly.',
      instruction:
        'Never return an unrelated film, trailer or test clip. If the requested title has no verified direct source, return an empty URL and mark it unavailable.'
    });

    this.registerTool({
      name: 'resolveGenuineStream',
      description: 'Returns the verified playable source for this title, or null when none exists.',
      parameters: {
        movieTitle: { type: 'string', description: 'English or Persian title of the movie', required: true },
        genre: { type: 'string', description: 'Genre category of the movie' }
      },
      execute: (params: { movieTitle: string; genre?: string }, context: AdkContext) => {
        context.log(
          'info',
          `Resolving verified source for "${params.movieTitle}" (no fallback substitution permitted)`
        );
        return null as ResolvedStreamSource | null;
      }
    });
  }

  public async run(
    input: ResolveStreamInput,
    context?: AdkContext
  ): Promise<AdkExecutionResult<AiStreamResolutionResult>> {
    const ctx = context || this.createContext();
    const start = performance.now();
    const title = input.item?.titleEn || input.item?.titleFa || 'Cinema Movie';

    ctx.log('info', `Resolving stream for: ${title}`);
    const availability = getStreamAvailability(input.item, {
      preferredQualityId: input.preferredQuality
    });
    const source = availability.source;
    const elapsed = Math.round(performance.now() - start);

    if (!source) {
      ctx.log(
        'warn',
        availability.status === 'requires_gateway'
          ? 'Title requires the Telegram range gateway; no URL will be attached to <video>.'
          : 'No verified direct media source. Player will show maintenance state.'
      );
      return {
        agentName: this.name,
        success: true,
        data: {
          streamUrl: '',
          available: false,
          sourceType: 'unavailable',
          nodeName: 'No verified source',
          quality: input.preferredQuality?.toUpperCase() || input.item?.quality || '—',
          isIranAccessible: true,
          resolutionTimeMs: elapsed,
          matchedGenre: input.item?.categoryEn || 'Cinema',
          reasonEn: availability.reasonEn,
          reasonFa: availability.reasonFa
        },
        executionTimeMs: elapsed,
        toolsInvoked: [],
        logs: ctx.logs
      };
    }

    return {
      agentName: this.name,
      success: true,
      data: {
        streamUrl: source.url,
        available: true,
        sourceType: source.kind === 'gateway' ? 'telegram_gateway' : 'direct_mp4',
        nodeName: source.kind === 'gateway' ? 'Telegram Range Gateway' : 'Verified Direct Media',
        quality: input.preferredQuality?.toUpperCase() || input.item?.quality || '4K HDR',
        isIranAccessible: true,
        resolutionTimeMs: elapsed,
        matchedGenre: input.item?.categoryEn || 'Cinema'
      },
      executionTimeMs: elapsed,
      toolsInvoked: [],
      logs: ctx.logs
    };
  }
}

export const cinemaStreamAgent = new CinemaStreamAgent();

/** Used by diagnostics/tests to prove a URL was produced from the item itself. */
export function resolveStreamForTest(item: PrototypeMediaItem, gatewayBase?: string | null) {
  return resolvePlayableSource(item, { gatewayBase });
}
