import type { ImdbFilmMetadata } from './filmDetailsClient';
import type { PrototypeMediaItem } from './types';

export interface SyncedSubtitleCue {
  id: string;
  startSec: number;
  endSec: number;
  en: string;
  fa: string;
}

export interface AiSubtitleSyncResult {
  filmId: string;
  available: boolean;
  status: 'available' | 'not_registered';
  matchedFilename: string;
  confidencePct: number;
  detectedFps: string;
  autoOffsetMs: number;
  matchedAt: string;
  cues: SyncedSubtitleCue[];
  externalUrl?: string;
  messageFa: string;
  messageEn: string;
}

function formatTimestamp(sec: number, separator: ',' | '.'): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`;
}

/**
 * Returns only real, human-provided subtitle cues.
 *
 * The previous implementation generated placeholder dialogue such as
 * "[Visual Cue #3]" from metadata. That is intentionally removed: if a title has
 * no registered SRT/VTT cues, the result is `available: false` and the UI shows
 * "official subtitles not registered".
 */
export function generateAiSyncedSubtitles(
  item: PrototypeMediaItem,
  imdb: ImdbFilmMetadata | null,
  resolutionLabel: string,
  langCode: string
): AiSubtitleSyncResult {
  const base = {
    filmId: item.id,
    matchedAt: new Date().toISOString(),
    autoOffsetMs: 0,
    detectedFps: ''
  };

  const externalUrl = item.subtitleUrl?.trim() || '';
  const realCues = Array.isArray(item.subtitles)
    ? item.subtitles
        .filter((s) => s && (s.fa?.trim() || s.en?.trim()))
        .map((s, idx) => ({
          id: `${item.id}-sub-${idx}`,
          startSec: Math.max(0, Number(s.startSec) || 0),
          endSec: Math.max(0.5, Number(s.endSec) || 0),
          en: s.en || '',
          fa: s.fa || ''
        }))
    : [];

  if (!externalUrl && realCues.length === 0) {
    return {
      ...base,
      available: false,
      status: 'not_registered',
      matchedFilename: '',
      confidencePct: 0,
      cues: [],
      messageFa: 'زیرنویس رسمی برای این عنوان ثبت نشده است.',
      messageEn: 'No official subtitle is registered for this title.'
    };
  }

  const cleanTitleSlug = item.titleEn
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const imdbTag = imdb?.imdbId ? `.${imdb.imdbId}` : '';
  const resTag = resolutionLabel ? `.${resolutionLabel.replace(/\s+/g, '')}` : '';
  const matchedFilename = `${cleanTitleSlug}${imdbTag}${resTag}.${langCode}.srt`;

  return {
    ...base,
    available: true,
    status: 'available',
    matchedFilename,
    confidencePct: 100,
    cues: realCues,
    externalUrl: externalUrl || undefined,
    messageFa: externalUrl
      ? 'زیرنویس رسمی از فایل VTT/SRT متصل شده است.'
      : 'زیرنویس رسمی ثبت‌شده برای این عنوان بارگذاری شد.',
    messageEn: externalUrl
      ? 'Official VTT/SRT subtitle attached.'
      : 'Registered official subtitle loaded for this title.'
  };
}

export function buildSrtContent(
  cues: SyncedSubtitleCue[],
  offsetMs: number,
  renderText: (cue: SyncedSubtitleCue) => string
): string {
  const offsetSec = offsetMs / 1000;
  return cues
    .map((cue, idx) => {
      const start = Math.max(0, cue.startSec + offsetSec);
      const end = Math.max(start + 1.2, cue.endSec + offsetSec);
      return `${idx + 1}\n${formatTimestamp(start, ',')} --> ${formatTimestamp(
        end,
        ','
      )}\n${renderText(cue)}\n`;
    })
    .join('\n');
}

export function buildWebVttContent(
  cues: SyncedSubtitleCue[],
  offsetMs: number,
  renderText: (cue: SyncedSubtitleCue) => string
): string {
  const offsetSec = offsetMs / 1000;
  const body = cues
    .map((cue) => {
      const start = Math.max(0, cue.startSec + offsetSec);
      const end = Math.max(start + 1.2, cue.endSec + offsetSec);
      return `${formatTimestamp(start, '.')} --> ${formatTimestamp(
        end,
        '.'
      )}\n${renderText(cue)}\n`;
    })
    .join('');
  return `WEBVTT\n\n${body}`;
}
