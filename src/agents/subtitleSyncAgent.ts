// ============================================================================
// AI PETROS // ADK SUBTITLE SYNC AGENT (adk.dev)
// Responsibilities:
//   1. Frame-accurate audio-dialogue subtitle alignment
//   2. Real-time neural subtitle generation for Persian and English
//   3. Dynamic millisecond drift compensation & WebVTT/SRT synthesis
// ============================================================================

import { AdkAgent, type AdkContext } from './adkTypes';
import {
  generateAiSyncedSubtitles,
  buildWebVttContent,
  type AiSubtitleSyncResult,
  type SyncedSubtitleCue
} from '../prototype/subtitleAiEngine';
import type { PrototypeMediaItem } from '../prototype/types';
import type { ImdbFilmMetadata } from '../prototype/filmDetailsClient';

export interface SubtitleSyncInput {
  item: PrototypeMediaItem;
  preferredLanguage: 'fa' | 'en' | 'auto';
  imdbMetadata?: ImdbFilmMetadata | null;
  resolutionLabel?: string;
  currentOffsetMs?: number;
}

export class SubtitleSyncAgent extends AdkAgent {
  constructor() {
    super({
      name: 'subtitle_sync_agent',
      description: 'Autonomous ADK agent that synthesizes frame-accurate subtitles and auto-corrects speech-to-text timing drift.',
      instruction: 'Ensure subtitle cues are delivered at least 150ms before dialogue audio and synchronized with precision.'
    });

    this.registerTool({
      name: 'synthesizeSubtitles',
      description: 'Generates neural bilingual subtitle cues with confidence scoring.',
      parameters: {
        title: { type: 'string', description: 'Movie title', required: true },
        language: { type: 'string', description: 'Target subtitle language' }
      },
      execute: (params: { item: PrototypeMediaItem; imdb?: ImdbFilmMetadata | null; res?: string; lang: 'fa' | 'en' | 'auto' }, context: AdkContext) => {
        context.log('action', `Synthesizing subtitles for "${params.item.titleEn}" (${params.lang})`);
        const langCode = params.lang === 'en' ? 'en' : 'fa';
        return generateAiSyncedSubtitles(params.item, params.imdb || null, params.res || '4K HDR', langCode);
      }
    });

    this.registerTool({
      name: 'buildVttUrl',
      description: 'Converts subtitle cues into a live browser Blob VTT track URL.',
      execute: (params: { syncedResult: AiSubtitleSyncResult; lang: 'fa' | 'en' | 'auto' }, context: AdkContext) => {
        const langCode = params.lang === 'en' ? 'en' : 'fa';
        const vttText = buildWebVttContent(
          params.syncedResult.cues,
          0,
          (cue: SyncedSubtitleCue) => (langCode === 'fa' ? cue.fa : cue.en)
        );
        const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
        return URL.createObjectURL(blob);
      }
    });
  }

  public async sync(input: SubtitleSyncInput, context?: AdkContext): Promise<{
    syncResult: AiSubtitleSyncResult;
    vttBlobUrl: string;
  }> {
    const ctx = context || this.createContext();
    const synthTool = this.tools.get('synthesizeSubtitles')!;
    const syncResult: AiSubtitleSyncResult = await synthTool.execute({
      item: input.item,
      imdb: input.imdbMetadata,
      res: input.resolutionLabel,
      lang: input.preferredLanguage
    }, ctx);

    const vttTool = this.tools.get('buildVttUrl')!;
    const vttBlobUrl: string = await vttTool.execute({
      syncedResult: syncResult,
      lang: input.preferredLanguage
    }, ctx);

    return {
      syncResult,
      vttBlobUrl
    };
  }
}

export const subtitleSyncAgent = new SubtitleSyncAgent();
