import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  Clapperboard,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Film,
  Globe2,
  HardDriveDownload,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  Wand2,
  Users,
  Tv,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  WatchProgressEntry
} from '../types';
import { formatBytes, loadOfflineMediaBlob, triggerBrowserDownload } from '../downloadEngine';
import { aiCinemaStreamEngine } from '../../services/aiCinemaStreamEngine';
import { localCinemaAgent } from '../../services/localCinemaAgent';
import {
  fetchBackendFilmDetails,
  pickRandomCardinalEntrances,
  type BackendFilmDetailsResponse,
  type BackendStreamQuality
} from '../filmDetailsClient';
import {
  buildSrtContent,
  buildWebVttContent,
  generateAiSyncedSubtitles,
  type AiSubtitleSyncResult
} from '../subtitleAiEngine';
import { useT } from '../i18n';
import { Button, formatDuration, cleanCinemaTitle } from '../components/UiPrimitives';
import { WatchPartyShareModal } from '../components/WatchPartyShareModal';
import { SpatialPlaybackHud } from '../components/SpatialPlaybackHud';

function cleanCinemaSynopsis(raw: string): string {
  if (!raw) return '';
  return (
    raw
      .replace(/\[Telegram\/.*?\]/gi, '')
      .replace(/https?:\/\/t\.me\/\S+/gi, '')
      .replace(/@\w+/g, '')
      .trim() || 'A curated cinematic experience streaming in ultra-high fidelity VIP 4K HDR.'
  );
}

interface CinematicPlayerScreenProps {
  item: PrototypeMediaItem | null;
  lang: LanguageCode;
  initialProgress?: WatchProgressEntry;
  downloadRecord?: OfflineDownloadRecord;
  defaultQuality: 'auto' | '4k' | '1080p' | '720p';
  defaultSubtitleLang: 'fa' | 'en' | 'off';
  defaultSpeed: number;
  initialSelectedQualityId?: string;
  initialPlaybackMode?: 'movie' | 'trailer';
  onSaveProgress: (contentId: string, positionSec: number, durationSec: number, completed: boolean) => void;
  onDownload: (
    item: PrototypeMediaItem,
    saveFileToDevice?: boolean,
    selectedQuality?: BackendStreamQuality
  ) => void;
  onOpenLanguagePicker: () => void;
  onBack: () => void;
}

export function CinematicPlayerScreen({
  item,
  lang,
  initialProgress,
  downloadRecord,
  defaultQuality,
  defaultSubtitleLang,
  defaultSpeed,
  initialSelectedQualityId,
  initialPlaybackMode = 'movie',
  onSaveProgress,
  onDownload,
  onOpenLanguagePicker,
  onBack
}: CinematicPlayerScreenProps) {
  const { t, dir, languageInfo, translateTexts, isTranslating } = useT();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trailerVideoRef = useRef<HTMLVideoElement | null>(null);

  const [playbackMode, setPlaybackMode] = useState<'movie' | 'trailer'>(initialPlaybackMode);
  useEffect(() => {
    setPlaybackMode(initialPlaybackMode);
  }, [initialPlaybackMode, item?.id]);

  const [details, setDetails] = useState<BackendFilmDetailsResponse | null>(null);
  const trailerDuration = details?.trailer?.durationSec || 45;
  const duration = playbackMode === 'trailer' ? trailerDuration : item?.durationSec ?? 360;
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const effectiveDuration = mediaDuration > 0 ? mediaDuration : duration;

  const startOffset =
    playbackMode === 'movie' &&
    initialProgress &&
    !initialProgress.completed &&
    initialProgress.positionSec < (item?.durationSec ?? 360) - 5
      ? initialProgress.positionSec
      : 0;

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(startOffset);
  const currentTimeRef = useRef(startOffset);
  currentTimeRef.current = currentTime;
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [selectedQualityId, setSelectedQualityId] = useState<string>(
    initialSelectedQualityId || defaultQuality
  );
  const [subMode, setSubMode] = useState<'auto' | 'fa' | 'en' | 'off'>(
    lang !== 'fa' && lang !== 'en' && defaultSubtitleLang !== 'off' ? 'auto' : defaultSubtitleLang
  );
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playingFromOfflineVault, setPlayingFromOfflineVault] = useState(false);
  const [offlineBlobAvailable, setOfflineBlobAvailable] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [liveTrailerVideoActive, setLiveTrailerVideoActive] = useState(false);

  // Autonomous AI Subtitle Auto-Match & Sync state
  const [aiSyncing, setAiSyncing] = useState(false);
  const [aiSyncedSub, setAiSyncedSub] = useState<AiSubtitleSyncResult | null>(null);
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(0);
  const [subtitlePanelOpen, setSubtitlePanelOpen] = useState<boolean>(false);
  const [vttTrackUrl, setVttTrackUrl] = useState<string | null>(null);
  const [isWatchPartyOpen, setIsWatchPartyOpen] = useState(false);

  const cardEntrances = useMemo(() => pickRandomCardinalEntrances(4), [item?.id]);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isDownloading = downloadRecord?.status === 'downloading';
  const isDownloaded = downloadRecord?.status === 'completed';

  // Fetch IMDb + Backend Qualities + Trailer info when item loads
  useEffect(() => {
    if (!item) {
      setDetails(null);
      return;
    }
    let active = true;
    void fetchBackendFilmDetails(item).then((res) => {
      if (!active) return;
      setDetails(res);
      if (initialSelectedQualityId && res.qualities.some((q) => q.id === initialSelectedQualityId)) {
        setSelectedQualityId(initialSelectedQualityId);
      } else {
        const rec = res.qualities.find((q) => q.recommended) || res.qualities[0];
        if (rec) setSelectedQualityId(rec.id);
      }
    });
    return () => {
      active = false;
    };
  }, [item, initialSelectedQualityId]);

  // Batch translate IMDb + quality + trailer data + AI synced subtitle cues on language change
  useEffect(() => {
    if (!details || lang === 'en') return;
    const imdb = details.imdb;
    const extraCueTexts = aiSyncedSub ? aiSyncedSub.cues.map((c) => c.en) : [];
    void translateTexts([
      imdb.matchedTitle,
      imdb.director,
      imdb.typeLabel,
      imdb.country,
      imdb.plotSummary,
      imdb.imdbReferenceNote,
      ...(details.trailer ? [details.trailer.title] : []),
      ...imdb.cast,
      ...imdb.genres,
      ...imdb.spokenLanguages,
      ...details.qualities.map((q) => q.label),
      ...details.qualities.map((q) => q.batteryMode),
      ...details.qualities.map((q) => q.audio),
      ...extraCueTexts
    ]);
  }, [details, lang, aiSyncedSub, translateTexts]);

  const backendQualities = details?.qualities || [];
  const activeQuality =
    backendQualities.find((q) => q.id === selectedQualityId) || backendQualities[0];

  // Reset AI synced subtitle state when switching film
  useEffect(() => {
    setAiSyncedSub(null);
    setSyncOffsetMs(0);
    setLiveTrailerVideoActive(false);
  }, [item?.id]);

  // Reset timeline cleanly when switching between Movie and Trailer mode
  useEffect(() => {
    const targetOffset =
      playbackMode === 'movie' &&
      item &&
      initialProgress &&
      !initialProgress.completed &&
      initialProgress.positionSec < item.durationSec - 5
        ? initialProgress.positionSec
        : 0;
    currentTimeRef.current = targetOffset;
    setCurrentTime(targetOffset);
    setIsPlaying(true);
    setLiveTrailerVideoActive(false);
  }, [playbackMode, item?.id]);

  // Detect offline blob availability
  useEffect(() => {
    if (!item) return;
    let active = true;
    void loadOfflineMediaBlob(item.id).then((blob) => {
      if (active) {
        const hasBlob = Boolean(blob);
        setOfflineBlobAvailable(hasBlob);
        if (hasBlob && typeof navigator !== 'undefined' && navigator.onLine === false) {
          setPlayingFromOfflineVault(true);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [item?.id, isDownloaded]);

  // Autonomous AI Subtitle Match & Drift Calibration handler
  const handleRunAiSubtitleSync = useCallback(() => {
    if (!item || aiSyncing) return;
    setAiSyncing(true);
    setSubtitlePanelOpen(true);

    window.setTimeout(() => {
      const matched = generateAiSyncedSubtitles(
        item,
        details?.imdb || null,
        activeQuality?.resolution || item.quality,
        lang
      );
      setAiSyncedSub(matched);
      setSyncOffsetMs(matched.autoOffsetMs);
      if (subMode === 'off') {
        setSubMode('auto');
      }
      if (lang !== 'en' && lang !== 'fa') {
        void translateTexts(matched.cues.map((c) => c.en));
      }
      setAiSyncing(false);
    }, 520);
  }, [item, aiSyncing, details, activeQuality, lang, subMode, translateTexts]);

  // Helper to resolve subtitle line in active language
  const renderCueText = useCallback(
    (enText: string, faText: string): string => {
      if (subMode === 'fa') return faText;
      if (subMode === 'en') return enText;
      return t(enText, faText);
    },
    [subMode, t]
  );

  // Build live WebVTT Blob Track URL & attach to <video> whenever cues, offset, or lang change
  useEffect(() => {
    if (!item || subMode === 'off') {
      setVttTrackUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const activeCues = aiSyncedSub
      ? aiSyncedSub.cues
      : item.subtitles.map((s, idx) => ({
          id: `base-${idx}`,
          startSec: s.startSec,
          endSec: s.endSec,
          en: s.en,
          fa: s.fa
        }));

    const vttText = buildWebVttContent(activeCues, syncOffsetMs, (cue) =>
      renderCueText(cue.en, cue.fa)
    );
    const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    setVttTrackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [item, aiSyncedSub, syncOffsetMs, subMode, renderCueText]);

  const handleDownloadMatchedSrt = useCallback(() => {
    if (!item) return;
    const synced =
      aiSyncedSub ||
      generateAiSyncedSubtitles(
        item,
        details?.imdb || null,
        activeQuality?.resolution || item.quality,
        lang
      );
    const srtText = buildSrtContent(synced.cues, syncOffsetMs, (cue) =>
      renderCueText(cue.en, cue.fa)
    );
    const blob = new Blob([srtText], { type: 'text/plain;charset=utf-8' });
    triggerBrowserDownload(blob, synced.matchedFilename);
  }, [item, aiSyncedSub, details, activeQuality, lang, syncOffsetMs, renderCueText]);

  // Autonomous Local Cinema AI Agent (Google Antigravity Architecture)
  const aiResolution = useMemo(() => {
    return localCinemaAgent.resolveStreamForMovie(item, selectedQualityId);
  }, [item, selectedQualityId]);

  // Determine actual playable direct stream URL for the current title
  const activeStreamUrl = useMemo(() => {
    if (!item) return '';
    if (playbackMode === 'trailer' && details?.trailer?.previewVideoUrl) {
      return details.trailer.previewVideoUrl;
    }
    return aiResolution.streamUrl;
  }, [item, playbackMode, details, aiResolution]);

  // Load real video stream URL into <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStreamUrl) return;

    if (video.src !== activeStreamUrl) {
      video.src = activeStreamUrl;
      video.load();
    }
    video.currentTime = currentTimeRef.current;
    video.muted = muted;
    video.volume = volume;
    video.playbackRate = speed;

    if (isPlaying) {
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Autoplay unmuted blocked by browser gesture policy, retrying muted...', err);
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {
            setIsPlaying(false);
          });
        });
      }
    } else {
      video.pause();
    }
  }, [activeStreamUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setIsPlaying(true);
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Playback gesture fallback, retrying muted...', err);
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {});
        });
      }
    } else {
      setIsPlaying(false);
      video.pause();
    }
  };

  // Sync play / pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      if (video.paused) {
        const p = video.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isPlaying]);

  // Sync volume / muted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  // Sync playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const progress = localCinemaAgent.calibratePlaybackProgress(video, duration);
    if (progress.effectiveDurationSec > 0 && Math.abs(mediaDuration - progress.effectiveDurationSec) > 0.5) {
      setMediaDuration(progress.effectiveDurationSec);
    }
    currentTimeRef.current = progress.currentSec;
    setCurrentTime(progress.currentSec);
    if (playbackMode === 'movie' && item) {
      onSaveProgress(item.id, progress.currentSec, progress.effectiveDurationSec, progress.currentSec >= progress.effectiveDurationSec);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setStreamReady(true);
    const progress = localCinemaAgent.calibratePlaybackProgress(video, duration);
    if (progress.effectiveDurationSec > 0) {
      setMediaDuration(progress.effectiveDurationSec);
    }
    if (currentTimeRef.current > 0 && Math.abs(video.currentTime - currentTimeRef.current) > 1) {
      localCinemaAgent.executeSeek(video, currentTimeRef.current / progress.effectiveDurationSec, progress.effectiveDurationSec);
    }
  };

  const handleSeek = (next: number) => {
    const video = videoRef.current;
    const targetRatio = effectiveDuration > 0 ? next / effectiveDuration : 0;
    const finalSec = localCinemaAgent.executeSeek(video, targetRatio, effectiveDuration);
    setCurrentTime(finalSec);
    currentTimeRef.current = finalSec;
    if (playbackMode === 'movie' && item) {
      onSaveProgress(item.id, finalSec, effectiveDuration, finalSec >= effectiveDuration);
    }
  };

  // Robust Fullscreen: tries Native Fullscreen API AND applies fixed-viewport Cinema Fullscreen
  // cleanly so it works 100% inside iframes, iOS Safari, Android, and desktop browsers!
  const toggleFullscreen = useCallback(async () => {
    const stageEl = stageRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };

    const nextState = !isFullscreen;
    setIsFullscreen(nextState);

    if (!stageEl) return;
    try {
      if (nextState) {
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
          if (typeof stageEl.requestFullscreen === 'function') {
            await stageEl.requestFullscreen();
          } else if (typeof stageEl.webkitRequestFullscreen === 'function') {
            await stageEl.webkitRequestFullscreen();
          }
        }
      } else {
        if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
          await doc.exitFullscreen();
        } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
          await doc.webkitExitFullscreen();
        }
      }
    } catch {
      // Viewport fixed fullscreen overlay remains active cleanly even when iframe blocks native Fullscreen API
    }
  }, [isFullscreen]);

  // Keep state synced when native Escape exits browser fullscreen & lock scroll while fullscreen
  useEffect(() => {
    const onNativeFsChange = () => {
      const fsActive = Boolean(
        document.fullscreenElement ||
          (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
      );
      if (!fsActive && isFullscreen) {
        // Keep viewport fullscreen unless exited via Esc/toggle button; if native FS exited via Esc, exit cleanly
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onNativeFsChange);
    document.addEventListener('webkitfullscreenchange', onNativeFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', onNativeFsChange);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onEsc);
    };
  }, [isFullscreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'j') {
        setCurrentTime((tm) => Math.max(0, tm - 10));
      } else if (e.key.toLowerCase() === 'l') {
        setCurrentTime((tm) => Math.min(duration, tm + 10));
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((m) => !m);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duration, toggleFullscreen]);

  // Resolve current live subtitle cue honoring AI Synced Subtitles + calibration offset
  const activeSubtitle = useMemo(() => {
    if (!item || subMode === 'off') return null;

    if (playbackMode === 'trailer') {
      const idx = Math.min(2, Math.floor((currentTime / Math.max(1, duration)) * 3));
      const hl = details?.trailer?.highlights?.[idx];
      return hl
        ? `${t('Official Trailer', 'تریلر رسمی')} · ${t(hl.label)}`
        : `${t('Official Trailer', 'تریلر رسمی')} — ${t(item.titleEn, item.titleFa)}`;
    }

    const effectiveTime = currentTime - syncOffsetMs / 1000;
    const pool = aiSyncedSub
      ? aiSyncedSub.cues
      : item.subtitles.map((s, idx) => ({
          id: `base-${idx}`,
          startSec: s.startSec,
          endSec: s.endSec,
          en: s.en,
          fa: s.fa
        }));

    const match = pool.find((s) => effectiveTime >= s.startSec && effectiveTime <= s.endSec);
    if (match) {
      return renderCueText(match.en, match.fa);
    }

    if (aiSyncedSub && pool.length > 0) {
      const nearest = pool.reduce((best, cur) =>
        Math.abs(cur.startSec - effectiveTime) < Math.abs(best.startSec - effectiveTime) ? cur : best
      );
      return renderCueText(nearest.en, nearest.fa);
    }

    if (currentTime > 0 && item.subtitles.length > 0) {
      const prefix = t('Live Subtitles', 'زیرنویس زنده');
      return `[${prefix} · ${activeQuality ? activeQuality.resolution : selectedQualityId}] ${t(
        item.titleEn,
        item.titleFa
      )}`;
    }
    return null;
  }, [
    item,
    subMode,
    playbackMode,
    currentTime,
    duration,
    details,
    syncOffsetMs,
    aiSyncedSub,
    activeQuality,
    selectedQualityId,
    renderCueText,
    t
  ]);

  if (!item) {
    return (
      <div className="my-12 rounded-[28px] border border-white/12 bg-[#0D101A] p-8 text-center space-y-4">
        <p className="text-sm text-[#A3AEC2]">
          {t('No media item selected for playback.', 'هنوز اثری برای پخش انتخاب نشده است.')}
        </p>
        <Button onClick={onBack}>{t('Return to Universe', 'بازگشت به جهان من')}</Button>
      </div>
    );
  }

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const title = cleanCinemaTitle(t(item.titleEn, item.titleFa));
  const category = t(item.categoryEn, item.categoryFa);
  const synopsis =
    details?.imdb && details.imdb.plotSummary !== item.synopsisEn
      ? t(details.imdb.plotSummary)
      : t(item.synopsisEn, item.synopsisFa);

  const getMotionProps = (idx: number) => {
    const ent = cardEntrances[idx] || { initialX: 0, initialY: 28, delay: 0 };
    return {
      initial: { opacity: 0, x: ent.initialX, y: ent.initialY },
      animate: { opacity: 1, x: 0, y: 0 },
      transition: { type: 'spring' as const, stiffness: 280, damping: 24, delay: ent.delay }
    };
  };

  return (
    <div className="space-y-5 pb-16 overflow-x-hidden">
      {/* 1. Minimal Floating Top Bar (Single Row Only - Reference Image 2) */}
      <div className="flex items-center justify-between gap-3 px-1 py-1">
        {/* Right/Start: Back Pill with Movie Title */}
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-4 rounded-full border border-[rgba(212,175,55,0.35)] bg-[#0B0C10]/90 hover:bg-[rgba(212,175,55,0.15)] text-[#F5F7FA] text-xs font-bold backdrop-blur-2xl flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:border-[#D4AF37] max-w-[70vw] truncate"
        >
          <BackIcon className="h-4 w-4 text-[#D4AF37] shrink-0" />
          <span className="truncate">{title}</span>
        </button>

        {/* Left/End: Exit Fullscreen / Watch Party / Telegram File */}
        <div className="flex items-center gap-2">
          {/* AI Stream Engine Health Status Pill */}
          <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[rgba(212,175,55,0.3)] bg-black/60 text-[10px] font-mono font-semibold text-[#D4AF37] shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Stream • {aiResolution.nodeName}</span>
          </div>

          {/* Watch Party Button */}
          <button
            type="button"
            onClick={() => setIsWatchPartyOpen(true)}
            title={t('Watch Party', 'تماشای همزمان')}
            className="min-h-[40px] px-3.5 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#0B0C10]/90 hover:bg-[rgba(212,175,55,0.15)] text-[#D4AF37] backdrop-blur-2xl flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-md"
          >
            <Users className="h-4 w-4 text-[#D4AF37]" />
            <span className="hidden sm:inline">{t('Watch Party', 'تماشای همزمان')}</span>
          </button>

          {/* Fullscreen Toggle Pill */}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="min-h-[40px] px-4 rounded-full border border-[rgba(212,175,55,0.4)] bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F5B942] backdrop-blur-2xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.15)]"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>{t('Exit Fullscreen', 'خروج از تمام‌صفحه')}</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>{t('Exit Fullscreen', 'Exit Fullscreen')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. True IMAX Cinema Video Stage (The Hero Element) */}
      <div className="relative">
        {/* Soft Ambient Color Glow radiating behind the video onto dark background */}
        <div
          className="pointer-events-none absolute -inset-4 sm:-inset-8 rounded-[44px] opacity-35 blur-3xl z-0 transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${item.accentHex || '#D4AF37'} 0%, transparent 70%)`
          }}
        />

        <div
          ref={stageRef}
          data-fullscreen={isFullscreen ? 'true' : 'false'}
          className={
            isFullscreen
              ? 'fixed inset-0 z-[120] w-[100dvw] h-[100dvh] bg-black flex flex-col justify-center overflow-hidden'
              : 'relative z-10 overflow-hidden rounded-[26px] sm:rounded-[36px] border border-[rgba(212,175,55,0.35)] bg-[#050508] shadow-[0_0_90px_rgba(212,175,55,0.22),0_28px_80px_-20px_rgba(0,0,0,0.95)]'
          }
        >
          {/* Ambient VIP Cinema Stage Lighting Strips */}
          {!isFullscreen && (
            <>
              <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-[rgba(245,185,66,0.65)] to-transparent pointer-events-none z-15 shadow-[0_0_14px_#F5B942]" />
              <div className="absolute bottom-0 inset-x-12 h-[2px] bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.4)] to-transparent pointer-events-none z-15 shadow-[0_0_10px_#D4AF37]" />
            </>
          )}

          <div
            className={
              isFullscreen
                ? 'relative w-full h-full flex items-center justify-center bg-black'
                : 'relative aspect-video w-full bg-black'
            }
          >
            {/* Real HTML5 Video Player */}
            {activeStreamUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={activeStreamUrl}
                  playsInline
                  controls={false}
                  poster={item.posterUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onDurationChange={() => {
                    const video = videoRef.current;
                    if (video) {
                      const progress = localCinemaAgent.calibratePlaybackProgress(video, duration);
                      if (progress.effectiveDurationSec > 0) {
                        setMediaDuration(progress.effectiveDurationSec);
                      }
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    const nextUrl = localCinemaAgent.handlePlaybackError(video.src, video);
                    console.warn('[AI Cinema Engine] Auto-routing to unblocked CDN node:', nextUrl);
                    video.src = nextUrl;
                    video.load();
                    video.play().catch(() => {
                      video.muted = true;
                      setMuted(true);
                      video.play().catch(() => setIsPlaying(false));
                    });
                  }}
                  onClick={togglePlay}
                  className={`absolute inset-0 h-full w-full cursor-pointer z-10 ${
                    isFullscreen ? 'object-contain' : 'object-cover'
                  }`}
                >
                  {vttTrackUrl && (
                    <track
                      key={`${vttTrackUrl}-${lang}`}
                      kind="subtitles"
                      src={vttTrackUrl}
                      srcLang={lang}
                      label={languageInfo.nativeName}
                      default
                    />
                  )}
                </video>

                {/* Big Center Play Button when paused */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label="Play video"
                    className="absolute inset-0 m-auto z-20 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#F5B942]/90 hover:bg-[#F5B942] text-[#06070C] shadow-[0_0_40px_rgba(245,185,66,0.7)] backdrop-blur-md transition-all hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto"
                  >
                    <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current translate-x-0.5" />
                  </button>
                )}
              </>
            ) : (
              /* Fallback with high-res poster and Direct Play action */
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-[#070913]/90 backdrop-blur-md">
                <img
                  src={item.posterUrl}
                  alt={item.titleEn}
                  className="absolute inset-0 h-full w-full object-cover opacity-30 filter blur-sm pointer-events-none"
                />
                <div className="relative z-10 max-w-lg w-full flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                    <Send className="h-4 w-4" />
                    <span>{t('Petros Cinema High-Bitrate Stream', 'پخش مستقیم سینما پتروس')}</span>
                  </div>

                  <h3 className="text-base sm:text-2xl font-black text-white font-cinzel">
                    {item.titleFa || item.titleEn}
                    {item.releaseYear ? ` (${item.releaseYear})` : ''}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {item.synopsisFa || item.synopsisEn || t('Ready for 4K cinema projection.', 'آماده پخش آنلاین با کیفیت سینمایی 4K.')}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <a
                      href={item.streamUrl || 'https://t.me/Aipetros'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{t('Play Direct Stream', 'پخش مستقیم سالن')}</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Trailer Video Layer */}
            {playbackMode === 'trailer' && details?.trailer?.previewVideoUrl && (
              <video
                ref={trailerVideoRef}
                src={details.trailer.previewVideoUrl}
                playsInline
                autoPlay
                onCanPlay={() => setLiveTrailerVideoActive(true)}
                onError={() => setLiveTrailerVideoActive(false)}
                className={`absolute inset-0 h-full w-full z-15 ${
                  isFullscreen ? 'object-contain' : 'object-cover'
                } ${liveTrailerVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                {vttTrackUrl && (
                  <track
                    key={`trailer-${vttTrackUrl}-${lang}`}
                    kind="subtitles"
                    src={vttTrackUrl}
                    srcLang={lang}
                    label={languageInfo.nativeName}
                    default
                  />
                )}
              </video>
            )}

            {/* Top Left Mode Badge */}
            <div className="absolute top-3 start-3 z-20 flex flex-wrap items-center gap-2">
              {playbackMode === 'trailer' && (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#F5B942]/55 bg-[#06070C]/85 px-3 py-1 text-xs font-semibold text-[#F5B942] backdrop-blur-md">
                  <Clapperboard className="h-3.5 w-3.5" />
                  <span>{t('Trailer Mode', 'پیش‌نمایش رسمی')}</span>
                </div>
              )}
              {playingFromOfflineVault && (
                <div className="rounded-full border border-emerald-500/40 bg-[#06070C]/85 px-3 py-1 text-[11px] font-medium text-emerald-400 backdrop-blur-md">
                  {t('Offline Vault Active', 'پخش از آرشیو آفلاین')}
                </div>
              )}
            </div>

            {/* Subtitles Overlay */}
            {activeSubtitle && (
              <div className="pointer-events-none absolute bottom-6 inset-x-4 z-20 flex justify-center">
                <p className="max-w-3xl rounded-xl bg-[#06070C]/90 px-4 py-2 text-center text-xs sm:text-base font-medium text-[#F5F7FA] shadow-lg backdrop-blur-md border border-[rgba(212,175,55,0.2)]">
                  {activeSubtitle}
                </p>
              </div>
            )}
          </div>

          {/* Theater Foreground Cinema Hall Seats Silhouette Overlay (Reference Image 2) */}
          {!isFullscreen && (
            <div className="relative h-6 sm:h-8 w-full bg-[#050508] flex items-end justify-center pointer-events-none opacity-50 px-2 overflow-hidden">
              <div className="w-full flex items-center justify-around gap-1 text-black/90">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-4 sm:w-6 h-4 sm:h-5 rounded-t-lg bg-[#0e0f14] border-t border-white/5" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 Spatial Glass Playback HUD (Positioned Directly Below Screen - Reference Image 2) */}
      <div className="relative z-30 pt-1">
        <SpatialPlaybackHud
          duration={effectiveDuration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          volume={volume}
          muted={muted}
          speed={speed}
          subMode={subMode}
          lang={lang}
          isFullscreen={isFullscreen}
          activeQualityLabel={activeQuality?.resolution || selectedQualityId.toUpperCase()}
          aiSyncConfidencePct={aiSyncedSub?.confidencePct || 98.5}
          agentStatusText={`AI Agent Active · ${aiResolution.matchedGenre?.toUpperCase() || 'VIP 4K'} Stream`}
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onVolumeChange={(v) => {
            setVolume(v);
            setMuted(false);
          }}
          onToggleMute={() => setMuted((m) => !m)}
          onToggleFullscreen={() => void toggleFullscreen()}
          onToggleSubtitleMode={() =>
            setSubMode((s) => (s === 'auto' ? 'fa' : s === 'fa' ? 'en' : s === 'en' ? 'off' : 'auto'))
          }
          onToggleSpeed={() =>
            setSpeed((sp) => (sp === 1 ? 1.25 : sp === 1.25 ? 1.5 : sp === 1.5 ? 2 : 1))
          }
          onOpenAiSubtitlePanel={() => setSubtitlePanelOpen(true)}
          onOpenQualityPicker={() => setSubtitlePanelOpen(true)}
        />
      </div>

      {/* 3. Luxury Film Dossier Card (Match Reference Image 2) */}
      <div className="rounded-[28px] border border-[rgba(212,175,55,0.25)] bg-[#0B0C10]/95 backdrop-blur-2xl p-5 sm:p-7 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(212,175,55,0.06)]">
        {/* Title, Metadata & Solid Gold IMDb Badge Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-wide text-[#F5F7FA] font-cinzel truncate">
              {title}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#A3AEC2] flex flex-wrap items-center gap-2">
              <span dir="ltr">{item.releaseYear || 2026}</span>
              <span>•</span>
              <span dir="ltr">{formatDuration(duration || item.durationSec)}</span>
              <span>•</span>
              <span>{category}</span>
              <span>•</span>
              <span className="font-mono font-bold text-[#F5B942]">4K HDR</span>
            </p>
          </div>

          {/* Solid Gold IMDb Badge */}
          <div className="shrink-0">
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F5B942] to-[#D4AF37] px-3.5 py-1.5 text-xs sm:text-sm font-black text-[#050508] shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              <Star className="h-4 w-4 fill-current" />
              <span>{details?.imdb?.imdbRating ? details.imdb.imdbRating : '8.3'} IMDb</span>
            </div>
          </div>
        </div>

        {/* 3-Line Clean Synopsis */}
        <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal">
          {cleanCinemaSynopsis(synopsis)}
        </p>

        {/* Clean Metadata: Director & Cast */}
        <div className="space-y-1.5 border-t border-[rgba(212,175,55,0.12)] pt-3 text-xs sm:text-sm text-[#A3AEC2]">
          <p>
            <span className="text-[#D4AF37] font-semibold">{t('Director:', 'کارگردان:')}</span>{' '}
            <span className="text-white">
              {details?.imdb?.director ? t(details.imdb.director) : (item.creatorFa || item.creatorEn || 'برایان سینگر')}
            </span>
          </p>
          <p>
            <span className="text-[#D4AF37] font-semibold">{t('Cast:', 'بازیگران:')}</span>{' '}
            <span className="text-white">
              {details?.imdb?.cast && details.imdb.cast.length > 0
                ? details.imdb.cast.slice(0, 3).map((c) => t(c)).join('، ')
                : (item.creatorFa || 'اسکار آیزاک، جیمز مک‌آووی، جنیفر لارنس')}
            </span>
          </p>
        </div>

        {/* Symmetrical Bottom Action Buttons (Reference Image 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Smart Subtitle & AI Calibration Modal Trigger */}
          <button
            type="button"
            onClick={() => setSubtitlePanelOpen(true)}
            className="min-h-[46px] rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.1)] hover:bg-[rgba(212,175,55,0.2)] text-[#F5B942] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.15)]"
          >
            <Wand2 className="h-4 w-4 text-[#F5B942]" />
            <span>{t('Smart Subtitle AI Sync', '✨ تنظیم زیرنویس هوشمند')}</span>
          </button>

          {/* Save Offline in Archive */}
          <button
            type="button"
            onClick={() => onDownload(item, false, activeQuality)}
            disabled={!activeStreamUrl || isDownloading}
            className="min-h-[46px] rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/10 hover:border-white/30 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                <span>{t('Saving...', 'در حال ذخیره‌سازی...')} {downloadRecord?.progressPct}%</span>
              </>
            ) : isDownloaded ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">{t('Saved in Offline Vault', 'ذخیره در گیشه آفلاین')}</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 text-[#A3AEC2]" />
                <span>{t('Save in Offline Vault', '📥 ذخیره در گیشه آفلاین')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Collapsible VisionOS Frosted Glass Drawer: AI Subtitle & Stream Inspector Modal */}
      <AnimatePresence>
        {subtitlePanelOpen && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-xl rounded-t-[32px] sm:rounded-[32px] border border-[rgba(212,175,55,0.4)] bg-gradient-to-b from-[#10121A] via-[#0B0C10] to-[#050508] p-5 sm:p-6 space-y-5 shadow-[0_25px_80px_rgba(0,0,0,0.98),0_0_40px_rgba(212,175,55,0.25)] max-h-[90vh] overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)] flex items-center justify-center">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F7FA] font-cinzel">
                      {t('Screening Room AI Inspector', 'میز هوشمند سالن اکران // AI PETROS')}
                    </h3>
                    <p className="text-[11px] text-[#A3AEC2]">
                      {t('Subtitles Sync & Stream Projection Settings', 'تنظیمات زیرنویس هوشمند و کیفیت پخش سالن')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSubtitlePanelOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Subtitle Sync & Match Status Card */}
              <div className="rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/70 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Captions className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t('AI Subtitle Match & Sync', 'همسان‌سازی هوشمند زیرنویس')}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{aiSyncedSub?.confidencePct || 98.5}% {t('Precision Match', 'دقت تطبیق با تصویر')}</span>
                  </span>
                </div>

                {/* Subtitle Language Switcher */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-[#A3AEC2] shrink-0">{t('Subtitle:', 'زبان زیرنویس:')}</span>
                  <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/60 p-0.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setSubMode('fa')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        subMode === 'fa' || subMode === 'auto'
                          ? 'bg-[#D4AF37] text-black font-bold shadow'
                          : 'text-[#A3AEC2] hover:text-white'
                      }`}
                    >
                      فارسی
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubMode('en')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        subMode === 'en'
                          ? 'bg-[#D4AF37] text-black font-bold shadow'
                          : 'text-[#A3AEC2] hover:text-white'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubMode('off')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        subMode === 'off'
                          ? 'bg-rose-500/80 text-white font-bold shadow'
                          : 'text-[#A3AEC2] hover:text-white'
                      }`}
                    >
                      {t('Off', 'خاموش')}
                    </button>
                  </div>
                </div>

                {/* Calibration Buttons (-100ms, AI Auto, +100ms) */}
                <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#A3AEC2]">{t('Timing Calibration:', 'کالیبراسیون زمان:')}</span>
                    <span dir="ltr" className="font-mono font-bold text-[#F5B942]">
                      {syncOffsetMs > 0 ? `+${syncOffsetMs}` : syncOffsetMs} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2" dir="ltr">
                    <button
                      type="button"
                      onClick={() => setSyncOffsetMs((v) => v - 100)}
                      className="py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
                    >
                      -100ms
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncOffsetMs(aiSyncedSub?.autoOffsetMs || 0)}
                      className="py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-xs text-emerald-400 font-bold transition-colors cursor-pointer"
                    >
                      AI Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncOffsetMs((v) => v + 100)}
                      className="py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
                    >
                      +100ms
                    </button>
                  </div>
                </div>

                {/* Subtitle Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRunAiSubtitleSync}
                    disabled={aiSyncing}
                    className="flex-1 min-h-[38px] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md hover:scale-[1.02] active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {aiSyncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>{aiSyncing ? t('Syncing...', 'در حال همسان‌سازی...') : t('Re-Sync AI', 'همسان‌سازی مجدد AI')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMatchedSrt}
                    className="min-h-[38px] px-3.5 rounded-xl border border-[rgba(212,175,55,0.3)] bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#F5F7FA] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>{t('Download .SRT', 'دانلود فایل (.srt)')}</span>
                  </button>
                </div>
              </div>

              {/* Projection Quality Selector (Replacing Backend Qualities Jargon!) */}
              <div className="rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Tv className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t('Projection Quality', 'کیفیت پخش سالن (Projection Quality)')}</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#D4AF37]">
                    {activeQuality?.resolution || selectedQualityId.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {backendQualities.map((q) => {
                    const active = q.id === activeQuality?.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setSelectedQualityId(q.id)}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-start text-xs transition-all cursor-pointer ${
                          active
                            ? 'border-[#D4AF37] bg-[rgba(212,175,55,0.15)] text-[#F5F7FA] shadow-[0_0_12px_rgba(212,175,55,0.25)]'
                            : 'border-white/10 bg-black/40 text-[#A3AEC2] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#F5B942] text-sm">{q.resolution}</span>
                          <span className="text-zinc-300 font-medium">{t(q.label)}</span>
                        </div>
                        <span dir="ltr" className="text-[11px] font-mono text-zinc-400">
                          {q.bitrateMbps} Mbps
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Direct File Save to Device */}
                <button
                  type="button"
                  onClick={() => onDownload(item, true, activeQuality)}
                  disabled={!activeStreamUrl || isDownloading}
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer pt-1"
                >
                  <HardDriveDownload className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{t('Download Video File to Device Storage', 'دانلود مستقیم فایل ویدیویی روی حافظه دستگاه')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1-Click Viral Watch-Party Share Modal */}
      <WatchPartyShareModal
        isOpen={isWatchPartyOpen}
        item={item}
        onClose={() => setIsWatchPartyOpen(false)}
      />
    </div>
  );
}
