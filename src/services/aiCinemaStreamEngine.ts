// ============================================================================
// AI PETROS CINEMA // STREAM RESOLUTION ENGINE
// Only verified direct media or the explicitly configured Telegram gateway can
// reach the player. There is NO automatic trailer/test-clip fallback.
// ============================================================================

import type { PrototypeMediaItem } from '../prototype/types';
import { isPlayableDirectMediaUrl } from './mediaUrlValidator';
import {
  collectStreamCandidates,
  getConfiguredGatewayBase,
  getStreamAvailability,
  resolvePlayableSource,
  type ResolvedStreamSource
} from './streamSourceResolver';

export { isPlayableDirectMediaUrl } from './mediaUrlValidator';

/**
 * URL identity for blacklisting: browsers hand <video>.src back as an absolute
 * URL while catalog candidates are relative paths (e.g. /api/stream/cache/x).
 * Compare same-origin URLs by path+query so a dead cache route is recognised
 * no matter which form it arrives in.
 */
export function normalizeUrlForMatching(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return parsed.pathname + parsed.search;
    }
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

export interface AiStreamResolutionResult {
  streamUrl: string;
  available: boolean;
  sourceType: 'direct_mp4' | 'hls' | 'ai_cdn_mirror' | 'telegram_gateway' | 'unavailable';
  nodeName: string;
  quality: string;
  isIranAccessible: boolean;
  resolutionTimeMs: number;
  matchedGenre: string;
  reasonEn?: string;
  reasonFa?: string;
}

class AiCinemaStreamEngineService {
  private failedUrls: Set<string> = new Set();
  private totalStreamsHandled = 0;

  /**
   * Resolve exactly one genuine source for this item.
   * Returns available=false and streamUrl='' when nothing can be played.
   */
  public resolvePlayableStream(
    item: PrototypeMediaItem | null | undefined,
    selectedQualityId?: string
  ): AiStreamResolutionResult {
    const startTime = performance.now();
    this.totalStreamsHandled++;

    if (!item) {
      return {
        streamUrl: '',
        available: false,
        sourceType: 'unavailable',
        nodeName: 'No title selected',
        quality: '—',
        isIranAccessible: true,
        resolutionTimeMs: 0,
        matchedGenre: 'cinema',
        reasonEn: 'No title selected.',
        reasonFa: 'عنوانی انتخاب نشده است.'
      };
    }

    const availability = getStreamAvailability(item, { preferredQualityId: selectedQualityId });
    const source = availability.source;

    if (!source) {
      return {
        streamUrl: '',
        available: false,
        sourceType: 'unavailable',
        nodeName: availability.status === 'requires_gateway' ? 'Telegram Gateway Required' : 'No verified source',
        quality: selectedQualityId?.toUpperCase() || item.quality || '—',
        isIranAccessible: false,
        resolutionTimeMs: Math.round(performance.now() - startTime),
        matchedGenre: item.categoryEn || 'Cinema',
        reasonEn: availability.reasonEn,
        reasonFa: availability.reasonFa
      };
    }

    return {
      streamUrl: source.url,
      available: true,
      sourceType: source.kind === 'gateway' ? 'telegram_gateway' : 'direct_mp4',
      nodeName: source.kind === 'gateway' ? 'Telegram Range Gateway' : 'Verified Direct Media',
      quality: selectedQualityId?.toUpperCase() || item.quality || '4K HDR',
      isIranAccessible: source.kind === 'gateway',
      resolutionTimeMs: Math.round(performance.now() - startTime),
      matchedGenre: item.categoryEn || 'Cinema'
    };
  }

  /**
   * Blacklist a failing URL. Returns the next *verified* source belonging to the
   * same title, never an unrelated fallback clip. Empty string means the player
   * must show the maintenance state.
   */
  public reportPlaybackFailure(failedUrl: string, item?: PrototypeMediaItem | null): string {
    if (failedUrl) {
      this.failedUrls.add(normalizeUrlForMatching(failedUrl));
      console.warn(
        `[AI Cinema Stream Engine] Blacklisted failing node: ${failedUrl}. Active blacklisted count: ${this.failedUrls.size}`
      );
    }
    if (!item) return '';

    // Try each candidate belonging to this exact title. Never jump to another
    // title's trailer. A candidate may resolve to a direct URL or a gateway URL.
    for (const candidate of collectStreamCandidates(item)) {
      const single = {
        ...item,
        playableUrl: candidate,
        streamUrl: '',
        defaultStreamUrl: '',
        qualities: []
      };
      const source = resolvePlayableSource(single);
      if (source && !this.failedUrls.has(normalizeUrlForMatching(source.url))) {
        return source.url;
      }
    }
    return '';
  }

  public blacklist(url: string): void {
    if (url) this.failedUrls.add(normalizeUrlForMatching(url));
  }

  public isBlacklisted(url: string): boolean {
    return this.failedUrls.has(normalizeUrlForMatching(url));
  }

  /** Remove a URL from the blacklist (used by the player's Retry control). */
  public unblacklist(url: string): void {
    this.failedUrls.delete(normalizeUrlForMatching(url));
  }

  public getConfiguredGateway(): string {
    return getConfiguredGatewayBase();
  }

  public getStats() {
    return {
      totalStreamsHandled: this.totalStreamsHandled,
      blacklistedNodesCount: this.failedUrls.size,
      availableNodes: 0
    };
  }

  /** Exposed for diagnostics/tests only. */
  public static describeSource(source: ResolvedStreamSource | null): string {
    return source ? `${source.kind}:${source.host}` : 'none';
  }
}

export const aiCinemaStreamEngine = new AiCinemaStreamEngineService();
