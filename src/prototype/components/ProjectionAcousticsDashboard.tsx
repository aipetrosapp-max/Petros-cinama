import React, { useState } from 'react';
import { Volume2, Sliders, Sparkles, Activity, Disc, Radio } from 'lucide-react';
import { useT } from '../i18n';

interface ProjectionAcousticsDashboardProps {
  className?: string;
}

export function ProjectionAcousticsDashboard({ className = '' }: ProjectionAcousticsDashboardProps) {
  const { t } = useT();

  // 3 Luxury Cinema Toggles
  const [imaxProjection, setImaxProjection] = useState(true);
  const [acousticAudio, setAcousticAudio] = useState(true);
  const [smartTheaterSync, setSmartTheaterSync] = useState(true);

  // Rotary values
  const [masterVol, setMasterVol] = useState(94);
  const [acousticLevel, setAcousticLevel] = useState(88);
  const [smartSyncPct, setSmartSyncPct] = useState(99);

  return (
    <div
      className={`rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.3)] p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.15)] space-y-6 relative overflow-hidden ${className}`}
    >
      <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.18)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.2)]">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-base sm:text-lg font-black tracking-[0.16em] text-[#D4AF37]">
                PROJECTION ROOM /// AI ENGINE
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            </div>
            <p className="text-[11px] text-[#A3AEC2]">
              {t(
                'Live Westworld-style acoustics and spatial projection diagnostics',
                'پنل زنده مانیتورینگ آکوستیک، لیزر و موتور هوش مصنوعی'
              )}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#D4AF37] tracking-widest px-2.5 py-1 rounded-full bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.25)] hidden sm:inline">
          VIP ENGINE 4K
        </span>
      </div>

      {/* Animated Golden Soundstage Equalizer / Waveform */}
      <div className="p-4 rounded-2xl bg-black/60 border border-[rgba(212,175,55,0.22)] space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#A3AEC2]">
          <span className="flex items-center gap-1.5 font-mono text-[#D4AF37] font-semibold">
            <Volume2 className="w-3.5 h-3.5" />
            <span>SPATIAL ACOUSTIC WAVEFORM</span>
          </span>
          <span className="font-mono text-[10px] text-emerald-400 tracking-wider">
            96kHz / 24-BIT LOSSLESS DOLBY
          </span>
        </div>

        {/* 28 High-Definition Equalizer Bars */}
        <div className="flex items-end justify-between h-16 pt-2 px-1 gap-1">
          {[
            30, 48, 72, 90, 60, 85, 100, 75, 45, 65, 88, 95, 70, 50, 80, 92, 64, 40, 78, 85, 96, 68,
            42, 60, 84, 76, 52, 35
          ].map((h, i) => (
            <div
              key={i}
              className="gold-eq-bar flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                animationDelay: `${(i * 0.07) % 1.2}s`,
                opacity: 0.7 + (h / 300)
              }}
            />
          ))}
        </div>
      </div>

      {/* 3 Circular Rotary Dial Gauges: Master, Acoustic, Smart Theatre */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
        {/* Dial 1: Master */}
        <div className="p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.2)] flex flex-col items-center group">
          <div className="relative w-16 h-16 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_14px_rgba(212,175,55,0.25)]">
            <span
              className="absolute w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"
              style={{
                top: '4px',
                right: '12px'
              }}
            />
            <div className="w-10 h-10 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-xs font-mono font-bold text-[#F5B942] shadow-inner">
              {masterVol}%
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider">
            {t('Master', 'مستر')}
          </span>
          <span className="text-[9px] text-[#A3AEC2] font-mono">IMAX 4K</span>
        </div>

        {/* Dial 2: Acoustic */}
        <div className="p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.2)] flex flex-col items-center group">
          <div className="relative w-16 h-16 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_14px_rgba(212,175,55,0.25)]">
            <span
              className="absolute w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"
              style={{
                top: '8px',
                left: '10px'
              }}
            />
            <div className="w-10 h-10 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-xs font-mono font-bold text-[#F5B942] shadow-inner">
              {acousticLevel}%
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider">
            {t('Acoustic', 'آکوستیک')}
          </span>
          <span className="text-[9px] text-[#A3AEC2] font-mono">DOLBY ATMOS</span>
        </div>

        {/* Dial 3: Smart Theatre */}
        <div className="p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.2)] flex flex-col items-center group">
          <div className="relative w-16 h-16 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_14px_rgba(212,175,55,0.25)]">
            <span
              className="absolute w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"
              style={{
                top: '3px',
                left: '26px'
              }}
            />
            <div className="w-10 h-10 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-xs font-mono font-bold text-emerald-400 shadow-inner">
              {smartSyncPct}%
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider truncate max-w-full">
            {t('Smart Theatre', 'هوش تئاتر')}
          </span>
          <span className="text-[9px] text-emerald-400 font-mono">AUTONOMOUS</span>
        </div>
      </div>

      {/* 3 Circular Quick-Status Badges */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/35 border border-[rgba(212,175,55,0.18)] text-center">
          <Disc className="w-4 h-4 text-[#D4AF37] mb-1" />
          <span className="text-[10px] font-semibold text-slate-200">IMAX 4K Laser</span>
          <span className="text-[8px] font-mono text-emerald-400">ACTIVE</span>
        </div>

        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/35 border border-[rgba(212,175,55,0.18)] text-center">
          <Radio className="w-4 h-4 text-[#D4AF37] mb-1" />
          <span className="text-[10px] font-semibold text-slate-200">Acoustic Audio</span>
          <span className="text-[8px] font-mono text-emerald-400">SYNCED</span>
        </div>

        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/35 border border-[rgba(212,175,55,0.18)] text-center">
          <Sparkles className="w-4 h-4 text-[#D4AF37] mb-1" />
          <span className="text-[10px] font-semibold text-slate-200">Smart Theater</span>
          <span className="text-[8px] font-mono text-emerald-400">ONLINE</span>
        </div>
      </div>

      {/* 3 Luxury Golden Toggle Switches */}
      <div className="space-y-3 pt-2">
        {/* Toggle 1: IMAX 4K Laser Projection */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.22)]">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200">
              {t('IMAX 4K Laser Projection', 'پروژکشن لیزری IMAX 4K')}
            </span>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('HDR10+ / Dolby Vision calibrated tone-mapping', 'کالیبراسیون داینامیک رنگ و شفافیت سینمایی')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImaxProjection((p) => !p)}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative ${
              imaxProjection
                ? 'bg-gradient-to-r from-[#8a7224] to-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#050508] border border-[#FFF2A7] shadow-md transition-transform ${
                imaxProjection ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Acoustic Theatre Audio */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.22)]">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200">
              {t('Acoustic Theatre Audio', 'صدای آکوستیک فراگیر تئاتر')}
            </span>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('Spatial binaural 7.1.4 virtual stage simulation', 'شبیه‌سازی سه بعدی ۷.۱.۴ سالن آمفی‌تئاتر')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAcousticAudio((p) => !p)}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative ${
              acousticAudio
                ? 'bg-gradient-to-r from-[#8a7224] to-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#050508] border border-[#FFF2A7] shadow-md transition-transform ${
                acousticAudio ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Toggle 3: Smart Theatre Sync */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.22)]">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200">
              {t('Smart Theater Sync', 'همگام‌سازی هوشمند سالن سینما')}
            </span>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('Autonomous ambient lighting and subtitle sync', 'هماهنگی خودکار نورپردازی و همسان‌سازی زیرنویس')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSmartTheaterSync((p) => !p)}
            className={`w-13 h-7 rounded-full p-1 transition-all cursor-pointer relative ${
              smartTheaterSync
                ? 'bg-gradient-to-r from-[#8a7224] to-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#050508] border border-[#FFF2A7] shadow-md transition-transform ${
                smartTheaterSync ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="text-center pt-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#8E9BB3]">
          {t('Theatre Dashboard & Acoustics', 'داشبورد صوتی و تصویری تئاتر')}
        </p>
      </div>
    </div>
  );
}
