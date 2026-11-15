import React, { useState } from 'react';
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
  Wand2
} from 'lucide-react';
import { formatDuration } from './UiPrimitives';
import { useT } from '../i18n';

interface SpatialPlaybackHudProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  speed: number;
  subMode: 'auto' | 'fa' | 'en' | 'off';
  lang: string;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (positionSec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleSubtitleMode: () => void;
  onToggleSpeed: () => void;
  onOpenAiSubtitlePanel?: () => void;
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
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleSubtitleMode,
  onToggleSpeed,
  onOpenAiSubtitlePanel,
  className = ''
}: SpatialPlaybackHudProps) {
  const { t } = useT();
  const [gainKnob, setGainKnob] = useState(85);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  // Waveform bars simulation
  const barCount = 48;
  const waveformHeights = [
    25, 40, 65, 80, 50, 75, 95, 60, 35, 70, 90, 100, 85, 45, 65, 80, 92, 60, 40, 70, 85, 95, 75, 50,
    30, 45, 70, 88, 62, 78, 96, 68, 42, 65, 82, 94, 72, 48, 66, 84, 90, 70, 52, 40, 60, 78, 55, 30
  ];

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div
      className={`spatial-playback-bar relative w-full rounded-[28px] sm:rounded-[36px] border border-[rgba(212,175,55,0.35)] bg-gradient-to-b from-[#14161f]/95 via-[#0b0c10]/98 to-[#050508]/98 backdrop-blur-3xl px-4 sm:px-8 py-3.5 sm:py-4 shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_35px_rgba(212,175,55,0.2),inset_0_1px_2px_rgba(255,255,255,0.2)] select-none ${className}`}
      style={{
        boxShadow:
          '0 25px 60px rgba(0, 0, 0, 0.98), 0 0 30px rgba(212, 175, 55, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.25)'
      }}
    >
      {/* 1. Top Section: Golden Audio Waveform Scrubber & Current/Total Timestamps */}
      <div className="space-y-1.5 pb-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#D4AF37] px-1 font-bold">
          <span className="flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5B942] animate-pulse" />
            <span>{formatDuration(currentTime)}</span>
          </span>
          <span className="text-[#A3AEC2]">{formatDuration(duration)}</span>
        </div>

        {/* Interactive Audio Waveform Scrub Track */}
        <div
          onClick={handleWaveformClick}
          className="relative h-10 sm:h-12 w-full rounded-xl bg-black/60 border border-[rgba(212,175,55,0.25)] px-2 py-1 flex items-end justify-between gap-[2px] sm:gap-1 cursor-pointer overflow-hidden group shadow-inner"
        >
          {/* Progress Shimmer Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[rgba(212,175,55,0.15)] to-[rgba(245,185,66,0.28)] pointer-events-none transition-all duration-150"
            style={{ width: `${progressRatio * 100}%` }}
          />

          {waveformHeights.map((h, i) => {
            const barRatio = i / barCount;
            const isPlayed = barRatio <= progressRatio;
            return (
              <div
                key={i}
                className="w-full rounded-t-sm transition-all duration-150 relative z-10"
                style={{
                  height: `${h}%`,
                  background: isPlayed
                    ? 'linear-gradient(to top, #8a7224, #D4AF37, #FFF2A7)'
                    : 'rgba(255, 255, 255, 0.18)',
                  boxShadow: isPlayed ? '0 0 8px rgba(212, 175, 55, 0.4)' : 'none'
                }}
              />
            );
          })}

          {/* Current Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#FFF2A7] shadow-[0_0_10px_#F5B942] pointer-events-none z-20"
            style={{ left: `${progressRatio * 100}%` }}
          />
        </div>
      </div>

      {/* 2. Controls Grid: Rotary Knobs + Center Transport + Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left Side: 2 Rotary Dials (VOLUME & GAIN) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Volume Dial */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onToggleMute}
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-[rgba(212,175,55,0.45)] bg-[#050508] flex items-center justify-center shadow-[inset_0_0_10px_rgba(212,175,55,0.25)] hover:border-[#D4AF37] transition-all cursor-pointer"
            >
              <span
                className="absolute w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"
                style={{
                  transform: `rotate(${muted ? 0 : volume * 270 - 135}deg) translate(0, -14px)`
                }}
              />
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#D4AF37]" />
              )}
            </button>
            <span className="text-[8px] font-mono tracking-widest text-[#A3AEC2] uppercase mt-1">
              VOLUME
            </span>
          </div>

          {/* Acoustic Gain Dial */}
          <div className="flex flex-col items-center hidden sm:flex">
            <button
              type="button"
              onClick={() => setGainKnob((g) => (g >= 100 ? 50 : g + 15))}
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-[rgba(212,175,55,0.45)] bg-[#050508] flex items-center justify-center shadow-[inset_0_0_10px_rgba(212,175,55,0.25)] hover:border-[#D4AF37] transition-all cursor-pointer"
            >
              <span
                className="absolute w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"
                style={{
                  transform: `rotate(${(gainKnob / 100) * 270 - 135}deg) translate(0, -14px)`
                }}
              />
              <span className="text-[9px] font-mono font-bold text-[#F5B942]">{gainKnob}%</span>
            </button>
            <span className="text-[8px] font-mono tracking-widest text-[#A3AEC2] uppercase mt-1">
              ACOUSTIC
            </span>
          </div>

          {/* Mini Volume Slider */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Volume Slider"
            className="w-16 sm:w-20 accent-[#D4AF37] hidden md:block"
          />
        </div>

        {/* Center Transport: Rewind + Contoured Play/Pause Notch + Forward */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Rewind 10s */}
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            aria-label="Rewind 10 seconds"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508]/90 text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Central Contoured Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-tr from-[#8a7224] via-[#F5B942] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.85)] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current stroke-[2.5]" />
            ) : (
              <Play className="w-6 h-6 fill-current stroke-[2.5] translate-x-0.5" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            type="button"
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            aria-label="Forward 10 seconds"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508]/90 text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: CC Tags + 30s Skip Dial + Speed Knob + Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* AI Subtitle Studio Button */}
          {onOpenAiSubtitlePanel && (
            <button
              type="button"
              onClick={onOpenAiSubtitlePanel}
              className="p-2 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/80 text-[#D4AF37] hover:border-[#D4AF37] transition-all cursor-pointer hidden sm:flex items-center justify-center shadow-sm"
              title={t('AI Subtitle Sync', 'همسان‌سازی زیرنویس با هوش مصنوعی')}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          )}

          {/* CC Tags Button */}
          <button
            type="button"
            onClick={onToggleSubtitleMode}
            className="h-9 px-3 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508]/90 text-xs font-mono font-semibold text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Captions className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>
              {subMode === 'off'
                ? 'CC'
                : subMode === 'auto'
                ? `CC:${lang.toUpperCase()}`
                : `CC:${subMode.toUpperCase()}`}
            </span>
          </button>

          {/* 30s Skip Dial Button */}
          <button
            type="button"
            onClick={() => onSeek(Math.min(duration, currentTime + 30))}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[rgba(212,175,55,0.35)] bg-[#050508] flex flex-col items-center justify-center text-[#F5B942] hover:border-[#D4AF37] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title="Skip 30 seconds"
          >
            <span className="text-[10px] font-mono font-black">30</span>
            <span className="text-[7px] font-mono text-[#A3AEC2]">SEC</span>
          </button>

          {/* Speed Rotary Knob (1.0x, 1.25x, 1.5x, 2.0x) */}
          <button
            type="button"
            onClick={onToggleSpeed}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[rgba(212,175,55,0.35)] bg-[#050508] flex flex-col items-center justify-center text-[#D4AF37] hover:border-[#D4AF37] transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title="Playback Speed"
          >
            <span className="text-[10px] font-mono font-black">{speed}x</span>
            <span className="text-[7px] font-mono text-[#A3AEC2]">SPEED</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508]/90 text-slate-200 hover:text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
