import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Sparkles
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
  agentStatusText?: string;
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
  agentStatusText = 'AI Agent Active · Direct Stream Control',
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverPositionRatio, setHoverPositionRatio] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 360;
  const progressRatio = Math.min(1, Math.max(0, currentTime / safeDuration));
  const activeRatio = dragRatio !== null ? dragRatio : progressRatio;
  const displayCurrentTime = dragRatio !== null ? dragRatio * safeDuration : currentTime;

  const updateSeekFromPointer = (clientX: number) => {
    if (!scrubTrackRef.current || safeDuration <= 0) return;
    const rect = scrubTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setDragRatio(ratio);
    onSeek(ratio * safeDuration);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateSeekFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateSeekFromPointer(e.clientX);
    } else if (scrubTrackRef.current && safeDuration > 0) {
      const rect = scrubTrackRef.current.getBoundingClientRect();
      const hoverX = e.clientX - rect.left;
      setHoverPositionRatio(Math.max(0, Math.min(1, hoverX / rect.width)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDragRatio(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDragRatio(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleQuickSkip = (deltaSec: number) => {
    const next = Math.max(0, Math.min(safeDuration, currentTime + deltaSec));
    onSeek(next);
  };

  return (
    <div
      className={`spatial-playback-bar relative w-full rounded-[24px] sm:rounded-[32px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#10121A]/95 via-[#08090E]/98 to-[#040507]/98 backdrop-blur-3xl px-3.5 sm:px-6 py-3 sm:py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.18),inset_0_1px_1px_rgba(255,255,255,0.15)] select-none ${className}`}
    >
      {/* 1. Golden Laser Timeline Scrubber */}
      <div className="space-y-1 pb-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#D4AF37] px-1 font-bold">
          <span className="flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5B942] animate-pulse" />
            <span dir="ltr">{formatDuration(displayCurrentTime)}</span>
          </span>

          {/* Local AI Agent Status Badge */}
          <div className="flex items-center gap-1 text-[9.5px] font-sans font-medium text-amber-300/80 bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{agentStatusText}</span>
          </div>

          <span dir="ltr" className="text-[#A3AEC2]">{formatDuration(safeDuration)}</span>
        </div>

        {/* Laser Scrub Track (Touch-friendly & Pointer-captured for smooth drag on Mobile & Desktop) */}
        <div
          ref={scrubTrackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => {
            setIsHoveringScrubber(false);
            setHoverPositionRatio(null);
          }}
          className="relative h-7 sm:h-8 w-full flex items-center cursor-pointer group touch-none"
        >
          {/* Base rail */}
          <div className="h-1.5 sm:h-2 w-full rounded-full bg-white/10 group-hover:bg-white/20 transition-all overflow-hidden relative">
            {/* Played laser fill */}
            <div
              className="absolute inset-y-0 start-0 bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#FFF2A7] shadow-[0_0_14px_rgba(212,175,55,0.95)]"
              style={{ width: `${activeRatio * 100}%` }}
            />
          </div>

          {/* Glowing Laser Scrub Needle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-gradient-to-br from-[#FFF2A7] via-[#F5B942] to-[#D4AF37] border-2 border-white shadow-[0_0_16px_#F5B942,0_0_30px_rgba(212,175,55,0.9)] pointer-events-none transition-transform ${
              isDragging ? 'scale-130' : 'group-hover:scale-120'
            }`}
            style={{
              left: `calc(${activeRatio * 100}% - 9px)`
            }}
          />
        </div>
      </div>

      {/* 2. Exact VisionOS Circular Controls Row */}
      <div className="flex items-center justify-around gap-2 pt-1.5 px-1 sm:px-4 max-w-lg mx-auto">
        {/* 1. Speed Control */}
        <button
          type="button"
          onClick={onToggleSpeed}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex items-center justify-center font-mono font-bold text-xs sm:text-sm transition-all active:scale-95">
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
          <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border flex flex-col items-center justify-center transition-all active:scale-95 ${
            subMode !== 'off'
              ? 'border-[rgba(212,175,55,0.6)] bg-gradient-to-b from-[#252014] to-[#12100a] text-[#F5B942] shadow-[0_0_16px_rgba(212,175,55,0.3)]'
              : 'border-white/15 bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#A3AEC2] group-hover:text-white group-hover:border-white/30'
          }`}>
            <span className="font-bold text-[11px] leading-tight">CC</span>
            <span className="text-[8.5px] leading-tight text-[#D4AF37]">
              {subMode === 'en' ? 'ENG' : subMode === 'off' ? 'OFF' : 'فارسی'}
            </span>
          </div>
          <span className="text-[10px] text-[#A3AEC2] group-hover:text-[#D4AF37] transition-colors">
            {t('Subtitles', 'زیرنویس')}
          </span>
        </button>

        {/* 3. Center Glowing Gold Double-Ring Play/Pause Button */}
        <div className="flex items-center gap-2">
          {/* Quick -10s skip */}
          <button
            type="button"
            onClick={() => handleQuickSkip(-10)}
            className="w-8 h-8 rounded-full border border-amber-500/20 bg-black/40 text-amber-300 hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
            title="10s Back"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="relative w-15 h-15 sm:w-17 sm:h-17 rounded-full p-1 bg-gradient-to-tr from-[#99761E] via-[#F5B942] to-[#FFF4BA] shadow-[0_0_35px_rgba(245,185,66,0.65),0_0_12px_rgba(212,175,55,0.9)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
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

          {/* Quick +10s skip */}
          <button
            type="button"
            onClick={() => handleQuickSkip(10)}
            className="w-8 h-8 rounded-full border border-amber-500/20 bg-black/40 text-amber-300 hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
            title="10s Forward"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. Quality Selector */}
        <button
          type="button"
          onClick={onOpenQualityPicker || onOpenAiSubtitlePanel}
          className="flex flex-col items-center gap-1 group cursor-pointer"
        >
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex flex-col items-center justify-center font-mono font-bold transition-all active:scale-95">
            <span className="text-[11px] leading-tight text-[#F5B942]">4K</span>
            <span className="text-[8.5px] leading-tight text-[#A3AEC2]">HDR</span>
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
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#181a24] to-[#0c0d14] text-[#A3AEC2] group-hover:text-[#D4AF37] group-hover:border-[#F5B942] group-hover:shadow-[0_0_15px_rgba(212,175,55,0.35)] flex items-center justify-center transition-all active:scale-95">
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
