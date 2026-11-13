import React, { useState } from 'react';
import {
  Globe2,
  Sparkles,
  Cpu,
  CheckCircle2,
  Trash2,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
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
  const { t, languageInfo } = useT();
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
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Autonomous AI Engine Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0F1424] via-[#0B0E19] to-[#070912] border border-[#F5B942]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#F5B942]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5B942]/25 to-[#F5B942]/5 border border-[#F5B942]/40 flex items-center justify-center text-[#F5B942] font-black text-2xl shadow-xl shadow-[#F5B942]/15">
              <Cpu className="w-7 h-7 text-[#F5B942]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-100">
                  {t('AI Autonomous Engine', 'موتور هوشمند و خودکار پتروس')}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#A3AEC2] mt-0.5">
                {t(
                  'All streaming, resolution, TV detection, and catalog syncing are autonomously managed in the background.',
                  'تمامی تصمیمات مربوط به کیفیت، استریم، ریموت تلویزیون و همگام‌سازی به طور خودکار توسط هوش مصنوعی در پس‌زمینه مدیریت می‌شوند.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Autonomous Background Operations Info Card */}
      <section className="p-6 sm:p-7 rounded-3xl bg-[#0B0E19]/90 border border-white/10 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00F0FF]/15 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {t('Active Autonomous Background Systems', 'سیستم‌های فعال خودکار در پس‌زمینه')}
            </h2>
            <p className="text-xs text-[#A3AEC2]">
              {t('Zero manual configuration required — seamlessly optimized by AI', 'بدون نیاز به تنظیم دستی — بهینه‌سازی ۱۰۰٪ خودکار توسط هوش مصنوعی')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('Adaptive 4K HDR Streaming', 'استریم هوشمند و تطبیقی 4K HDR')}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              {t(
                'AI dynamically selects the highest pristine bitrate and uncompressed audio matching your network.',
                'هوش مصنوعی بالاترین کیفیت تصویر بدون بافر را متناسب با سرعت اتصال به صورت خودکار انتخاب می‌کند.'
              )}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('Zero-Config TV Remote Mode', 'تشخیص خودکار ریموت و تلویزیون')}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              {t(
                'Detects Android TV, Apple TV, and gamepads automatically, enabling spatial 10-foot D-Pad navigation.',
                'دستگاه‌های تلویزیون هوشمند و ریموت کنترل به صورت خودکار شناسایی شده و ناوبری چهارجهته فعال می‌شود.'
              )}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('Autonomous Cloud Stream Sync', 'همگام‌سازی خودکار و بی‌صدا با گیت‌هاب')}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              {t(
                'Video catalog and live broadcast channels synchronize quietly in the background without intrusive alerts.',
                'فهرست فیلم‌ها و کانال‌های زنده به صورت نامحسوس و دائمی از مخزن ابری گیت‌هاب به‌روزرسانی می‌شوند.'
              )}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('Smart Subtitle & Dialogue Alignment', 'انطباق خودکار زیرنویس و زبان')}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              {t(
                'Subtitle tracks and audio streams are automatically matched to your preferred viewing language.',
                'زیرنویس‌های هماهنگ به صورت هوشمند بر اساس زبان انتخابی شما آماده پخش می‌گردند.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Language Selection (Only essential user preference) */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/90 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {t('Interface Language', 'زبان رابط کاربری')}
            </h2>
            <p className="text-xs text-[#A3AEC2]">
              {t('Select your display language', 'زبان نمایشی برنامه را انتخاب کنید')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onChangeLang('en')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              lang === 'en'
                ? 'bg-[#F5B942]/15 border-[#F5B942] text-slate-100 shadow-md shadow-[#F5B942]/10'
                : 'bg-white/5 border-white/10 text-[#A3AEC2] hover:bg-white/10'
            }`}
          >
            <div>
              <p className="text-sm font-bold">English</p>
              <p className="text-[11px] text-[#94A3B8]">Default</p>
            </div>
            {lang === 'en' && <Check className="w-4 h-4 text-[#F5B942]" />}
          </button>

          <button
            type="button"
            onClick={() => onChangeLang('fa')}
            className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between ${
              lang === 'fa'
                ? 'bg-[#F5B942]/15 border-[#F5B942] text-slate-100 shadow-md shadow-[#F5B942]/10'
                : 'bg-white/5 border-white/10 text-[#A3AEC2] hover:bg-white/10'
            }`}
          >
            <div className="order-2 text-right">
              <p className="text-sm font-bold">فارسی</p>
              <p className="text-[11px] text-[#94A3B8]">راست‌چین</p>
            </div>
            {lang === 'fa' && <Check className="w-4 h-4 text-[#F5B942] order-1" />}
          </button>

          <button
            type="button"
            onClick={onOpenLanguagePicker}
            className="p-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-[#A3AEC2] hover:text-white transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold">{t('Other Languages', 'سایر زبان‌ها')}</p>
              <p className="text-[11px] text-[#94A3B8]">{languageInfo.nativeName}</p>
            </div>
            <Globe2 className="w-4 h-4 text-[#00F0FF]" />
          </button>
        </div>
      </section>

      {/* Reset AI Memory (Clean & minimal) */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/90 border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-200">
            {t('Reset AI Taste Memory', 'بازنشانی حافظه هوش مصنوعی')}
          </h3>
          <p className="text-xs text-[#A3AEC2]">
            {t('Clears local taste calibration and restarts discovery models.', 'تنظیمات سلیقه و تاریخچه تماشا را به حالت پیش‌فرض بازمی‌گرداند.')}
          </p>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[38px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
          >
            {t('Reset Memory', 'بازنشانی')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHardReset}
              className="min-h-[38px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer"
            >
              {t('Confirm Reset', 'تأیید بازنشانی')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-[38px] px-3 rounded-xl bg-white/10 text-slate-300 text-xs cursor-pointer"
            >
              {t('Cancel', 'انصراف')}
            </button>
          </div>
        )}
      </section>

      {/* Platform Info Footer */}
      <div className="p-4 text-center text-xs text-[#64748B] space-y-1">
        <p className="font-editorial text-[#F5B942] text-sm">ai petros · Petros Cinema</p>
        <p>Aipetros-stream Engine · Autonomous Edition v2.4.0</p>
      </div>
    </div>
  );
}
