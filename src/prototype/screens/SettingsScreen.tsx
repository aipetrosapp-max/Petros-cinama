import React, { useState } from 'react';
import {
  Globe2,
  Sparkles,
  RotateCcw,
  Sliders,
  Tv,
  Check,
  Film,
  HardDrive
} from 'lucide-react';
import type {
  LanguageCode,
  UserAccountState,
  TasteVector6D,
  PrototypeMediaItem,
  WatchProgressEntry,
  FeedbackRecord
} from '../types';
import { useT, resolveLanguageLabel } from '../i18n';
import { AiTasteDnaPanel } from '../components/AiTasteDnaPanel';

interface SettingsScreenProps {
  lang: LanguageCode;
  user: UserAccountState;
  vaultSizeBytes: number;
  userVector: TasteVector6D;
  catalog: PrototypeMediaItem[];
  progressMap: Record<string, WatchProgressEntry>;
  feedbackMap: Record<string, FeedbackRecord>;
  favoriteIds: Set<string>;
  onChangeLang: (lang: LanguageCode) => void;
  onOpenLanguagePicker: () => void;
  onUpdateUser: (patch: Partial<UserAccountState>) => void;
  onUpdateUserVector?: (newVector: TasteVector6D) => void;
  onWipeLocalMemory: () => void;
}

export function SettingsScreen({
  lang,
  user,
  vaultSizeBytes,
  userVector,
  catalog,
  progressMap,
  feedbackMap,
  favoriteIds,
  onChangeLang,
  onOpenLanguagePicker,
  onUpdateUser,
  onUpdateUserVector,
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
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* 1. Global World Language Selector (70+ Languages Supported) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.28)] shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#D4AF37]">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cinzel text-sm sm:text-base font-bold text-[#F5F7FA]">
                {t('INTERFACE LANGUAGE', 'زبان برنامه')}
              </h2>
              <p className="text-[11px] text-[#A3AEC2]">
                {t('Current language: ', 'زبان فعلی: ')}
                <span className="font-semibold text-[#D4AF37]">{resolveLanguageLabel(lang).nativeName} ({resolveLanguageLabel(lang).englishName})</span>
              </p>
            </div>
          </div>

          {/* Trigger All 70+ Languages Picker */}
          <button
            type="button"
            onClick={onOpenLanguagePicker}
            className="px-4 py-2 rounded-xl border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] hover:bg-[rgba(212,175,55,0.25)] text-[#F5F7FA] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center gap-2 cursor-pointer"
          >
            <Globe2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{t('All 70+ World Languages...', 'همه ۷۰+ زبان‌های دنیا...')}</span>
          </button>
        </div>

        {/* Quick Language Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[rgba(212,175,55,0.12)]">
          {[
            { code: 'en', label: 'English' },
            { code: 'fa', label: 'فارسی' },
            { code: 'ar', label: 'العربية' },
            { code: 'es', label: 'Español' },
            { code: 'fr', label: 'Français' },
            { code: 'de', label: 'Deutsch' },
            { code: 'tr', label: 'Türkçe' },
            { code: 'ru', label: 'Русский' },
            { code: 'zh', label: '中文' }
          ].map((item) => {
            const active = lang.toLowerCase() === item.code.toLowerCase();
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => onChangeLang(item.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#F5B942] text-[#050508] font-bold shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'bg-white/[0.04] border border-white/10 text-[#A3AEC2] hover:text-white hover:border-[rgba(212,175,55,0.3)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Real AI Taste DNA & Explainability Engine */}
      <section>
        <AiTasteDnaPanel
          userVector={userVector}
          catalog={catalog}
          progressMap={progressMap}
          feedbackMap={feedbackMap}
          favoriteIds={favoriteIds}
          onUpdateVector={(v) => {
            if (onUpdateUserVector) {
              onUpdateUserVector(v);
            }
          }}
        />
      </section>

      {/* 3. Cinema Streaming & Subtitle Preferences */}
      <section className="p-6 rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.25)] shadow-xl space-y-5">
        <div className="flex items-center gap-2.5 border-b border-[rgba(212,175,55,0.15)] pb-3">
          <Film className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h3 className="font-cinzel text-sm sm:text-base font-bold text-[#D4AF37]">
              {t('STREAMING & AUDITORIUM QUALITY', 'تنظیمات پخش و کیفیت تصویر')}
            </h3>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('Default video resolution and subtitle matching', 'کیفیت پیش‌فرض پخش و همسان‌سازی هوشمند زیرنویس')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quality Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              {t('Preferred Resolution', 'کیفیت پیش‌فرض پخش')}
            </label>
            <select
              value={user.preferredQuality}
              onChange={(e) => onUpdateUser({ preferredQuality: e.target.value as any })}
              className="w-full h-10 rounded-xl border border-[rgba(212,175,55,0.3)] bg-black px-3 text-xs font-mono font-bold text-[#D4AF37] focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="auto" className="bg-[#0B0C10] text-white">Auto (ABR · Adaptive Bitrate)</option>
              <option value="4K" className="bg-[#0B0C10] text-white">4K HDR VIP Master (60 FPS)</option>
              <option value="1080p" className="bg-[#0B0C10] text-white">1080p Full HD</option>
              <option value="720p" className="bg-[#0B0C10] text-white">720p Mobile Lite</option>
            </select>
          </div>

          {/* Subtitle Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200 block">
              {t('Default Subtitle Language', 'زبان پیش‌فرض زیرنویس')}
            </label>
            <select
              value={user.defaultSubtitleLang}
              onChange={(e) => onUpdateUser({ defaultSubtitleLang: e.target.value as any })}
              className="w-full h-10 rounded-xl border border-[rgba(212,175,55,0.3)] bg-black px-3 text-xs font-mono font-bold text-[#D4AF37] focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="fa" className="bg-[#0B0C10] text-white">فارسی (Persian Subtitles)</option>
              <option value="en" className="bg-[#0B0C10] text-white">English Subtitles</option>
              <option value="off" className="bg-[#0B0C10] text-white">{t('Subtitles Off', 'بدون زیرنویس')}</option>
            </select>
          </div>
        </div>

        {/* TV Remote D-Pad Mode Toggle */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-[rgba(212,175,55,0.18)] flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-200">
              {t('Zero-Config TV Remote & Gamepad Mode', 'حالت کنترل ریموت تلویزیون و دسته بازی')}
            </p>
            <p className="text-[10px] text-[#A3AEC2]">
              {t('Enables high-contrast D-pad navigation for Smart TVs and projectors', 'ناوبری ۴جهته با کنترل تلویزیون هوشمند')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateUser({ liteUniverseMode: !user.liteUniverseMode })}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative ${
              user.liteUniverseMode ? 'bg-[#D4AF37]' : 'bg-white/15'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#050508] shadow-sm transition-transform ${
                user.liteUniverseMode ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 4. Neuromorphic Calibration Capsule (Reset AI Taste Memory) */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[#0B0C10]/90 border border-amber-500/25 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">
              {t('Neuromorphic Taste Calibration', 'کالیبراسیون و ریست حافظه هوش مصنوعی')}
            </h3>
            <p className="text-xs text-[#A3AEC2]">
              {t(
                'Clears local preference embeddings and restarts autonomous discovery models.',
                'تنظیمات سلیقه و هوش شخصی‌سازی را به حالت اولیه بازمی‌گرداند.'
              )}
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
