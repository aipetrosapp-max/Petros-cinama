import React, { useState } from 'react';
import {
  Globe2,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import type {
  LanguageCode,
  UserAccountState
} from '../types';
import { useT } from '../i18n';
import { CinematicPassCard } from '../components/CinematicPassCard';
import { ProjectionAcousticsDashboard } from '../components/ProjectionAcousticsDashboard';

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
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* 1. Cinematic Pass & Entry (Access Authentication & Identity + 35mm Gold Projector + VIP Tickets) */}
      <section className="p-6 sm:p-8 rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.3)] shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(212,175,55,0.15)] relative overflow-hidden">
        <CinematicPassCard
          lang={lang}
          onChangeLang={onChangeLang}
          onOpenLanguagePicker={onOpenLanguagePicker}
        />

        {/* More Languages Glass Pill */}
        <div className="flex justify-center sm:justify-end pt-3">
          <button
            type="button"
            onClick={onOpenLanguagePicker}
            className="px-4 py-2 rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508]/80 hover:bg-[#151720] hover:border-[#D4AF37] text-[#A3AEC2] hover:text-[#D4AF37] text-xs font-medium transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Globe2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>+ {t('More World Languages', 'سایر زبان‌های جهانی')}</span>
          </button>
        </div>
      </section>

      {/* 2. Theatre Dashboard & Acoustics (PROJECTION ROOM /// AI ENGINE) */}
      <section>
        <ProjectionAcousticsDashboard />
      </section>

      {/* 3. Neuromorphic Calibration Capsule (Reset AI Taste Memory) */}
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
