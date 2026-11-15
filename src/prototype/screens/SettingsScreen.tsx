import React, { useState } from 'react';
import {
  Globe2,
  Sparkles,
  Check,
  Flame,
  Volume2,
  Tv,
  Film,
  RotateCcw,
  Sliders,
  PlaySquare
} from 'lucide-react';
import type {
  LanguageCode,
  UserAccountState
} from '../types';
import { useT } from '../i18n';

interface SettingsScreenProps {
  lang: LanguageCode;
  user: UserAccountState;
  vaultSizeBytes: number;
  onChangeLang: (lang: LanguageCode) => void;
  onOpenLanguagePicker: () => void;
  onUpdateUser: (patch: Partial<UserAccountState>) => void;
  onWipeLocalMemory: () => void;
}

export function SettingsScreen({
  lang,
  onChangeLang,
  onOpenLanguagePicker,
  onWipeLocalMemory
}: SettingsScreenProps) {
  const { t } = useT();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('AiPetrosUniverseVaultDB');
      }
    } catch (e) {
      console.warn('Reset error:', e);
    }
    onWipeLocalMemory();
    window.location.reload();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-7 pb-16">
      {/* 1. Language & Identity Setup (VIP Holographic Tickets) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#D4AF37]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#D4AF37]">
                {t('ACCESS AUTHENTICATION & IDENTITY', 'احراز هویت و بلیط ورود VIP')}
              </h2>
              <p className="text-[11px] text-[#A3AEC2]">
                {t('Select your VIP Cinema Pass & language', 'گذرنامه سینمایی و زبان رابط کاربری خود را انتخاب کنید')}
              </p>
            </div>
          </div>
          <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]">
            STAGE 01
          </span>
        </div>

        {/* Ticket Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* English Ticket */}
          <button
            type="button"
            onClick={() => onChangeLang('en')}
            className={`vip-ticket-card group relative p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between overflow-hidden ${
              lang === 'en'
                ? 'active bg-gradient-to-r from-[#1f1a10] via-[#14120c] to-[#0d0c08] border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.25)]'
                : 'bg-[#0B0C10]/80 border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37]/50 hover:bg-[#121318]'
            }`}
          >
            <div className="space-y-1 z-10">
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-xl font-bold tracking-wider text-[#D4AF37]">ENG</span>
                <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.25)]">
                  VIP 01
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">English Interface</p>
              <p className="text-[10px] text-[#A3AEC2] tracking-wide">Pristine Audio & CC</p>
            </div>

            {/* Fake Barcode stub on right */}
            <div className="flex items-center gap-3 z-10 pl-2">
              <div className="flex flex-col items-center gap-1 opacity-70">
                <div className="flex gap-[2px] h-9 items-center">
                  <span className="w-[1.5px] h-full bg-[#D4AF37]" />
                  <span className="w-[3px] h-full bg-[#D4AF37]" />
                  <span className="w-[1px] h-full bg-[#D4AF37]" />
                  <span className="w-[2px] h-full bg-[#D4AF37]" />
                  <span className="w-[1px] h-full bg-[#D4AF37]" />
                  <span className="w-[3px] h-full bg-[#D4AF37]" />
                  <span className="w-[1px] h-full bg-[#D4AF37]" />
                  <span className="w-[2px] h-full bg-[#D4AF37]" />
                </div>
                <span className="text-[8px] font-mono tracking-tighter text-[#D4AF37]">#0091-EN</span>
              </div>
              {lang === 'en' && (
                <div className="w-6 h-6 rounded-full bg-[#D4AF37] text-[#050508] flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.6)]">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
          </button>

          {/* Persian Ticket */}
          <button
            type="button"
            onClick={() => onChangeLang('fa')}
            dir="rtl"
            className={`vip-ticket-card group relative p-5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between overflow-hidden ${
              lang === 'fa'
                ? 'active bg-gradient-to-l from-[#1f1a10] via-[#14120c] to-[#0d0c08] border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.25)]'
                : 'bg-[#0B0C10]/80 border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37]/50 hover:bg-[#121318]'
            }`}
          >
            <div className="space-y-1 z-10 text-right">
              <div className="flex items-center gap-2 justify-start">
                <span className="font-bold text-xl text-[#D4AF37]">فارسی</span>
                <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.25)]">
                  VIP 03
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">رابط کاربری راست‌چین</p>
              <p className="text-[10px] text-[#A3AEC2]">زیرنویس و دوبله فارسی</p>
            </div>

            {/* Fake Barcode stub */}
            <div className="flex items-center gap-3 z-10 pr-2">
              <div className="flex flex-col items-center gap-1 opacity-70">
                <div className="flex gap-[2px] h-9 items-center">
                  <span className="w-[2px] h-full bg-[#D4AF37]" />
                  <span className="w-[1px] h-full bg-[#D4AF37]" />
                  <span className="w-[3px] h-full bg-[#D4AF37]" />
                  <span className="w-[1.5px] h-full bg-[#D4AF37]" />
                  <span className="w-[2px] h-full bg-[#D4AF37]" />
                  <span className="w-[1px] h-full bg-[#D4AF37]" />
                  <span className="w-[3px] h-full bg-[#D4AF37]" />
                </div>
                <span className="text-[8px] font-mono tracking-tighter text-[#D4AF37]">#0093-FA</span>
              </div>
              {lang === 'fa' && (
                <div className="w-6 h-6 rounded-full bg-[#D4AF37] text-[#050508] flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.6)]">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
          </button>
        </div>

        {/* More Languages Glass Pill */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onOpenLanguagePicker}
            className="px-4 py-2 rounded-full border border-[rgba(212,175,55,0.25)] bg-[#0B0C10]/70 hover:bg-[#151720] hover:border-[#D4AF37] text-[#A3AEC2] hover:text-[#D4AF37] text-xs font-medium transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Globe2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>+ {t('More World Languages', 'سایر زبان‌های جهانی')}</span>
          </button>
        </div>
      </section>

      {/* 2. Projection & Acoustics Control Room (Westworld Dashboard) */}
      <section className="p-6 sm:p-7 rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.25)] shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle,rgba(212,175,55,0.07)_0%,transparent_70%)] pointer-events-none" />

        {/* Room Header */}
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.15)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#D4AF37]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#D4AF37]">
                  PROJECTION ROOM // AI ENGINE
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              </div>
              <p className="text-xs text-[#A3AEC2]">
                {t('Live Westworld-style acoustics and spatial projection diagnostics', 'پنل مانیتورینگ زنده صوت، تصویر و هوش مصنوعی تئاتر')}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#D4AF37] tracking-widest hidden sm:inline">
            4K HDR VIP-CORE
          </span>
        </div>

        {/* Gold Soundstage Equalizer Bars */}
        <div className="p-4 rounded-2xl bg-black/60 border border-[rgba(212,175,55,0.18)] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#A3AEC2]">
            <span className="flex items-center gap-1.5 font-mono text-[#D4AF37]">
              <Volume2 className="w-3.5 h-3.5" />
              <span>SPATIAL ACOUSTIC WAVEFORM</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-400">96kHz / 24-BIT LOSSLESS</span>
          </div>

          <div className="flex items-end justify-between h-14 pt-2 px-1">
            {[35, 60, 85, 45, 75, 95, 65, 80, 50, 70, 90, 100, 60, 40, 80, 55, 90, 70, 45, 85, 95, 60, 35].map((h, i) => (
              <div
                key={i}
                className="gold-eq-bar w-1.5 sm:w-2 rounded-t-sm"
                style={{
                  height: `${h}%`,
                  animationDelay: `${(i * 0.08) % 1.2}s`,
                  opacity: 0.65 + (h / 250)
                }}
              />
            ))}
          </div>
        </div>

        {/* 3 Rotary Dial Gauges (Master / Acoustics / Smart Theatre) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
          {/* Dial 1: Master */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-[rgba(212,175,55,0.18)] flex flex-col items-center">
            <div className="relative w-14 h-14 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_12px_rgba(212,175,55,0.2)]">
              <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
              <div className="w-9 h-9 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[10px] font-mono text-[#D4AF37]">
                94%
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider">
              {t('Master', 'مستر')}
            </span>
            <span className="text-[9px] text-[#A3AEC2]">IMAX 4K</span>
          </div>

          {/* Dial 2: Acoustics */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-[rgba(212,175,55,0.18)] flex flex-col items-center">
            <div className="relative w-14 h-14 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_12px_rgba(212,175,55,0.2)]">
              <span className="absolute -right-0.5 top-2 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
              <div className="w-9 h-9 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[10px] font-mono text-[#D4AF37]">
                88%
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider">
              {t('Acoustics', 'صدا')}
            </span>
            <span className="text-[9px] text-[#A3AEC2]">Dolby Atmos</span>
          </div>

          {/* Dial 3: Smart Theatre */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-[rgba(212,175,55,0.18)] flex flex-col items-center">
            <div className="relative w-14 h-14 rounded-full border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center shadow-[inset_0_0_12px_rgba(212,175,55,0.2)]">
              <span className="absolute top-1 left-2 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
              <div className="w-9 h-9 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[10px] font-mono text-[#D4AF37]">
                AUTO
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-200 mt-2 font-mono uppercase tracking-wider">
              {t('Theatre', 'تئاتر')}
            </span>
            <span className="text-[9px] text-[#A3AEC2]">AI Spatial Sync</span>
          </div>
        </div>

        {/* Tactile System Toggles */}
        <div className="space-y-3 pt-2">
          {/* Toggle 1: Adaptive 4K Laser */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-[rgba(212,175,55,0.18)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.1)] flex items-center justify-center text-[#D4AF37]">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {t('Adaptive 4K HDR Laser Projection', 'پروژکشن لیزری 4K HDR تطبیقی')}
                </p>
                <p className="text-[10px] text-[#A3AEC2]">
                  {t('Pristine uncompressed bitrate streaming with zero buffering', 'استریم با بیت‌ریت کریستالی بدون افت کیفیت')}
                </p>
              </div>
            </div>
            <span className="w-10 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-end px-0.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
            </span>
          </div>

          {/* Toggle 2: Zero-Config TV Remote Mode */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-[rgba(212,175,55,0.18)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.1)] flex items-center justify-center text-[#D4AF37]">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {t('Zero-Config TV Remote & Gamepad Mode', 'حالت کنترل ریموت تلویزیون و دسته بازی')}
                </p>
                <p className="text-[10px] text-[#A3AEC2]">
                  {t('10-foot D-Pad spatial navigation activated automatically', 'ناوبری چهارجهته فضایی برای مانیتور و تلویزیون')}
                </p>
              </div>
            </div>
            <span className="w-10 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-end px-0.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
            </span>
          </div>

          {/* Toggle 3: Autonomous Cloud Stream Sync */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-[rgba(212,175,55,0.18)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.1)] flex items-center justify-center text-[#D4AF37]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {t('Autonomous Cloud Stream Sync', 'همگام‌سازی ابری خودکار استریم')}
                </p>
                <p className="text-[10px] text-[#A3AEC2]">
                  {t('Silently ingesting telegram streams and master cloud catalogues', 'به‌روزرسانی پیوسته فیلم‌ها و کانال‌ها در پس‌زمینه')}
                </p>
              </div>
            </div>
            <span className="w-10 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-end px-0.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
            </span>
          </div>
        </div>
      </section>

      {/* 3. Neuromorphic Calibration Capsule (Reset AI Taste Memory) */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#0B0C10]/90 border border-amber-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">
              {t('Neuromorphic Taste Calibration', 'کالیبراسیون و ریست حافظه هوش مصنوعی')}
            </h3>
            <p className="text-xs text-[#A3AEC2]">
              {t('Clears local preference embeddings and restarts autonomous discovery models.', 'تنظیمات سلیقه و هوش شخصی‌سازی را به حالت اولیه بازمی‌گرداند.')}
            </p>
          </div>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[38px] px-5 rounded-full bg-white/[0.04] hover:bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 self-start sm:self-auto"
          >
            {t('Recalibrate AI', 'کالیبراسیون مجدد')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHardReset}
              className="min-h-[38px] px-5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-md shadow-red-600/30"
            >
              {t('Confirm Reset', 'تأیید بازنشانی')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-[38px] px-4 rounded-full bg-white/10 text-slate-300 text-xs cursor-pointer hover:bg-white/15"
            >
              {t('Cancel', 'انصراف')}
            </button>
          </div>
        )}
      </section>

      {/* Platform Info Footer */}
      <div className="p-4 text-center text-xs text-[#64748B] space-y-1">
        <p className="font-cinzel text-[#D4AF37] text-sm tracking-widest font-bold">
          AI PETROS · VIP CINEMA UNIVERSE
        </p>
        <p className="font-mono text-[10px] tracking-wide">
          Autonomous Projection Engine · UE5 Spatial Edition v2.5.0
        </p>
      </div>
    </div>
  );
}
