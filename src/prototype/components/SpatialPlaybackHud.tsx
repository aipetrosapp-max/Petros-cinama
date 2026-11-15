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

      {/* 2. Controls Row: Left Utility Pills + Centered Tactile Glass + Right Pills */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {/* Left Side: Quality & Subtitle Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Subtitle Sync Pill */}
          <button
            type="button"
            onClick={onOpenAiSubtitlePanel || onToggleSubtitleMode}
            className={`min-h-[34px] px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              subMode !== 'off'
                ? 'border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.12)] text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                : 'border-white/10 bg-white/[0.04] text-[#A3AEC2] hover:text-white'
            }`}
            title={t('Subtitle Sync & Settings', 'تنظیمات و همسان‌سازی زیرنویس هوشمند')}
          >
            <Captions className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="truncate max-w-[130px] sm:max-w-[170px]">{subtitleLabel}</span>
          </button>

          {/* Quality Selector Pill */}
          <button
            type="button"
            onClick={onOpenQualityPicker || onOpenAiSubtitlePanel}
            className="min-h-[34px] px-2.5 sm:px-3 rounded-full border border-[rgba(212,175,55,0.3)] bg-white/[0.04] hover:bg-[rgba(212,175,55,0.1)] text-[11px] font-mono font-bold text-[#F5B942] inline-flex items-center gap-1.5 transition-all cursor-pointer"
            title={t('Projection Quality', 'کیفیت پخش سالن')}
          >
            <Tv className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{activeQualityLabel}</span>
          </button>
        </div>

        {/* Center: Tactile Glass Controls (Rewind 10s, Glowing Play/Pause, Forward 10s) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rewind 10s */}
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            aria-label="Rewind 10 seconds"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[rgba(212,175,55,0.25)] bg-[#050508]/85 text-zinc-300 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title="10s Rewind"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Glowing Gold Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-[#A68019] via-[#F5B942] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_24px_rgba(212,175,55,0.7)] hover:scale-108 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current stroke-[2.5]" />
            ) : (
              <Play className="w-5 h-5 fill-current stroke-[2.5] translate-x-0.5" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            type="button"
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            aria-label="Forward 10 seconds"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[rgba(212,175,55,0.25)] bg-[#050508]/85 text-zinc-300 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title="10s Forward"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Side: Speed, Volume & Fullscreen Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Speed Pill */}
          <button
            type="button"
            onClick={onToggleSpeed}
            className="min-h-[34px] px-2.5 sm:px-3 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-mono text-[#D4AF37] hover:border-[#D4AF37]/50 inline-flex items-center gap-1 transition-all cursor-pointer"
            title={t('Playback Speed', 'سرعت پخش')}
          >
            <Gauge className="w-3 h-3 text-[#D4AF37]" />
            <span>{speed}x</span>
          </button>

          {/* Volume Button with Popover on Hover / Click */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              type="button"
              onClick={onToggleMute}
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 flex items-center justify-center transition-all cursor-pointer"
              title={muted || volume === 0 ? t('Unmute', 'وصل صدا') : t('Mute', 'قطع صدا')}
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              )}
            </button>

            {showVolumeSlider && (
              <div className="absolute bottom-full mb-2 start-1/2 -translate-x-1/2 p-2 rounded-xl border border-[rgba(212,175,55,0.3)] bg-[#0B0C10]/95 backdrop-blur-xl shadow-xl flex items-center gap-2 z-40">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  aria-label="Volume Slider"
                  className="w-20 accent-[#D4AF37] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.1)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.2)] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title={isFullscreen ? t('Exit Fullscreen', 'خروج از تمام‌صفحه') : t('Fullscreen', 'تمام‌صفحه')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
