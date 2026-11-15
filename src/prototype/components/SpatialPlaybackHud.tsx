import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Captions,
  Maximize2,
  Minimize2,
  Tv,
  Gauge
} from 'lucide-react';
import { formatDuration } from './UiPrimitives';
import { useT } from '../i18n';

export interface SpatialPlaybackHudProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  speed: number;
  subMode: 'auto' | 'fa' | 'en' | 'off';
  lang: string;
  isFullscreen: boolean;
  activeQualityLabel?: string;
  aiSyncConfidencePct?: number | null;
  onTogglePlay: () => void;
  onSeek: (positionSec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleSubtitleMode: () => void;
  onToggleSpeed: () => void;
  onOpenAiSubtitlePanel?: () => void;
  onOpenQualityPicker?: () => void;
  className?: string;
}

export function SpatialPlaybackHud({
  duration,
  currentTime,
  isPlaying,
  volume,
  muted,
  speed,
  subMode,
  lang,
  isFullscreen,
  activeQualityLabel = '4K HDR',
  aiSyncConfidencePct = 98.5,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleSubtitleMode,
  onToggleSpeed,
  onOpenAiSubtitlePanel,
  onOpenQualityPicker,
  className = ''
}: SpatialPlaybackHudProps) {
  const { t } = useT();
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverPositionRatio, setHoverPositionRatio] = useState<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubTrackRef.current) return;
    const rect = scrubTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubTrackRef.current) return;
    const rect = scrubTrackRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverPositionRatio(ratio);
  };

  const subtitleLabel = subMode === 'off'
    ? t('No Subtitles', 'زیرنویس: خاموش')
    : subMode === 'en'
    ? 'CC: English'
    : `CC فارسی ${aiSyncConfidencePct ? `(AI ${aiSyncConfidencePct}%)` : ''}`;

  return (
    <div
      className={`spatial-playback-bar relative w-full rounded-[24px] sm:rounded-[32px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#10121A]/95 via-[#08090E]/98 to-[#040507]/98 backdrop-blur-3xl px-3.5 sm:px-6 py-3 sm:py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.18),inset_0_1px_1px_rgba(255,255,255,0.15)] select-none ${className}`}
    >
      {/* 1. Golden Laser Timeline Scrubber */}
      <div className="space-y-1 pb-2">
        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#D4AF37] px-1 font-bold">
          <span className="flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5B942] animate-pulse" />
            <span dir="ltr">{formatDuration(currentTime)}</span>
          </span>

          {hoverPositionRatio !== null && isHoveringScrubber && (
            <span dir="ltr" className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
              {formatDuration(hoverPositionRatio * duration)}
            </span>
          )}

          <span dir="ltr" className="text-[#A3AEC2]">{formatDuration(duration)}</span>
        </div>

        {/* Laser Scrub Track (Thin, elegant, glowing line) */}
        <div
          ref={scrubTrackRef}
          onClick={handleTrackClick}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => {
            setIsHoveringScrubber(false);
            setHoverPositionRatio(null);
          }}
          onMouseMove={handleMouseMove}
          className="relative h-4 sm:h-5 w-full flex items-center cursor-pointer group"
        >
          {/* Base rail */}
          <div className="h-1 sm:h-1.5 w-full rounded-full bg-white/10 group-hover:bg-white/15 transition-all overflow-hidden relative">
            {/* Played laser fill */}
            <div
              className="absolute inset-y-0 start-0 bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#FFF2A7] shadow-[0_0_12px_rgba(212,175,55,0.9)] transition-all duration-75"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>

          {/* Glowing Laser Scrub Needle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#FFF2A7] to-[#D4AF37] border border-white/80 shadow-[0_0_14px_#F5B942,0_0_24px_rgba(212,175,55,0.8)] pointer-events-none transition-transform duration-75 group-hover:scale-125"
            style={{
              left: `calc(${progressRatio * 100}% - 7px)`
            }}
          />
        </div>
      </div>

      {/* 2. Exact VisionOS Circular Controls Row (Reference Image 2) */}
      <div className="flex items-center justify-around gap-2 pt-2 px-1 sm:px-4 max-w-lg mx-auto">
        {/* 1. Speed Control */}
        <button
          type="button"
          onClick={onToggleSpeed}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex items-center justify-center font-mono font-bold text-xs sm:text-sm transition-all active:scale-95">
            {speed}x
          </div>
          <span className="text-[10px] text-[#A3AEC2] group-hover:text-[#D4AF37] transition-colors">
            {t('Speed', 'سرعت')}
          </span>
        </button>

        {/* 2. Subtitles Toggle */}
        <button
          type="button"
          onClick={onOpenAiSubtitlePanel || onToggleSubtitleMode}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex flex-col items-center justify-center transition-all active:scale-95 ${
            subMode !== 'off'
              ? 'border-[rgba(212,175,55,0.6)] bg-gradient-to-b from-[#252014] to-[#12100a] text-[#F5B942] shadow-[0_0_16px_rgba(212,175,55,0.3)]'
              : 'border-white/15 bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#A3AEC2] group-hover:text-white group-hover:border-white/30'
          }`}>
            <span className="font-bold text-[11px] leading-tight">CC</span>
            <span className="text-[9px] leading-tight text-[#D4AF37]">
              {subMode === 'en' ? 'ENG' : subMode === 'off' ? 'OFF' : 'فارسی'}
            </span>
          </div>
          <span className="text-[10px] text-[#A3AEC2] group-hover:text-[#D4AF37] transition-colors">
            {t('Subtitles', 'زیرنویس')}
          </span>
        </button>

        {/* 3. Center Glowing Gold Double-Ring Play/Pause Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full p-1 bg-gradient-to-tr from-[#99761E] via-[#F5B942] to-[#FFF4BA] shadow-[0_0_35px_rgba(245,185,66,0.65),0_0_12px_rgba(212,175,55,0.9)] hover:scale-108 active:scale-95 transition-all cursor-pointer group"
          >
            {/* Inner Black/Gold Glass Ring */}
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1c180f] to-[#090805] border border-[rgba(255,244,186,0.4)] flex items-center justify-center text-[#F5B942] group-hover:text-white transition-colors">
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-[2.5]" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-[2.5] translate-x-0.5" />
              )}
            </div>
          </button>
        </div>

        {/* 4. Quality Selector */}
        <button
          type="button"
          onClick={onOpenQualityPicker || onOpenAiSubtitlePanel}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex flex-col items-center justify-center font-mono font-bold transition-all active:scale-95">
            <span className="text-[11px] leading-tight text-[#F5B942]">4K</span>
            <span className="text-[9px] leading-tight text-[#A3AEC2]">HDR</span>
          </div>
          <span className="text-[10px] text-[#A3AEC2] group-hover:text-[#D4AF37] transition-colors">
            {t('Quality', 'کیفیت')}
          </span>
        </button>

        {/* 5. Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#A3AEC2] group-hover:text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex items-center justify-center transition-all active:scale-95">
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </div>
          <span className="text-[10px] text-[#A3AEC2] group-hover:text-[#D4AF37] transition-colors">
            {t('Fullscreen', 'تمام‌صفحه')}
          </span>
        </button>
      </div>
    </div>
  );
}
