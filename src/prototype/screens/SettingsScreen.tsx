import React, { useState } from 'react';
import {
  Globe2,
  Tv,
  MonitorPlay,
  Volume2,
  Subtitles,
  Radio,
  RefreshCw,
  HardDrive,
  Trash2,
  Check,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  LanguageCode,
  UserAccountState
} from '../types';
import { useT } from '../i18n';
import { Button } from '../components/UiPrimitives';
import { formatBytes } from '../downloadEngine';
import { dynamicStreamSync } from '../../services/dynamicStreamSync';
import { tvRemote } from '../../services/tvRemoteNavigation';

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
  user,
  vaultSizeBytes,
  onChangeLang,
  onOpenLanguagePicker,
  onUpdateUser,
  onWipeLocalMemory
}: SettingsScreenProps) {
  const { t, languageInfo } = useT();
  const [isTvMode, setIsTvMode] = useState(() => tvRemote.isTvModeEnabled());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  const handleToggleTvMode = () => {
    const next = !isTvMode;
    setIsTvMode(next);
    tvRemote.setTvModeEnabled(next);
  };

  const handleSyncStreamsNow = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await dynamicStreamSync.syncNow(true);
      if (res.success) {
        setSyncMessage(
          t(
            `Successfully synchronized ${res.count} cloud streams from GitHub!`,
            `همگام‌سازی موفق: ${res.count} منبع استریم از گیت‌هاب دریافت شد!`
          )
        );
      } else {
        setSyncMessage(
          t('Using bundled local stream catalogue.', 'استفاده از منابع استریم پیش‌فرض اپلیکیشن.')
        );
      }
    } catch {
      setSyncMessage(t('Cloud sync completed with cached sources.', 'همگام‌سازی با منابع ذخیره‌شده انجام شد.'));
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleClearAppCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('AiPetrosUniverseVaultDB');
      }
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    onWipeLocalMemory();
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#0F1424] via-[#0B0E19] to-[#070912] border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F5B942]/15 border border-[#F5B942]/35 flex items-center justify-center text-[#F5B942] font-black text-2xl shadow-lg shadow-[#F5B942]/20">
            P
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              {t('Application Settings', 'تنظیمات اپلیکیشن')}
            </h1>
            <p className="text-xs text-[#A3AEC2]">
              {t('Configure playback, language, and display preferences', 'پیکربندی زبان، کیفیت پخش و تنظیمات اختصاصی برنامه')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
            ai petros v2.4.0
          </span>
        </div>
      </div>

      {/* 1. Language Preferences */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {t('Language Preferences', 'زبان اپلیکیشن')}
            </h2>
            <p className="text-xs text-[#A3AEC2]">
              {t('Select your preferred interface language', 'زبان مورد نظر خود برای رابط کاربری را انتخاب کنید')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* English Option */}
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
              <p className="text-[11px] text-[#94A3B8]">Default Interface</p>
            </div>
            {lang === 'en' && <Check className="w-4 h-4 text-[#F5B942]" />}
          </button>

          {/* Persian Option */}
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
              <p className="text-[11px] text-[#94A3B8]">راست‌چین و روان</p>
            </div>
            {lang === 'fa' && <Check className="w-4 h-4 text-[#F5B942] order-1" />}
          </button>

          {/* Other World Languages */}
          <button
            type="button"
            onClick={onOpenLanguagePicker}
            className="p-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-[#A3AEC2] hover:text-white transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold">{t('Other Languages', 'سایر زبان‌ها')}</p>
              <p className="text-[11px] text-[#94A3B8]">
                {languageInfo.nativeName} ({languageInfo.code.toUpperCase()})
              </p>
            </div>
            <Globe2 className="w-4 h-4 text-[#00F0FF]" />
          </button>
        </div>
      </section>

      {/* 2. Video & Stream Playback Quality */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942]">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {t('Streaming & Video Quality', 'کیفیت استریم و پخش ویدیو')}
            </h2>
            <p className="text-xs text-[#A3AEC2]">
              {t('Default resolution for movies and trailers', 'وضوح تصویر پیش‌فرض هنگام پخش فیلم‌ها و پیش‌نمایش')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          {(
            [
              { id: 'auto', label: 'Auto Adaptive', labelFa: 'خودکار (هوشمند)', sub: 'Best Quality' },
              { id: '4K', label: '4K Ultra HD', labelFa: 'کیفیت 4K', sub: '2160p HDR' },
              { id: '1080p', label: '1080p Full HD', labelFa: 'کیفیت 1080p', sub: 'High Definition' },
              { id: '720p', label: '720p HD', labelFa: 'کیفیت 720p', sub: 'Data Saver' }
            ] as const
          ).map((q) => {
            const active = user.preferredQuality === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onUpdateUser({ preferredQuality: q.id })}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  active
                    ? 'bg-[#F5B942]/15 border-[#F5B942] text-slate-100 shadow-md shadow-[#F5B942]/10 font-bold'
                    : 'bg-white/5 border-white/10 text-[#A3AEC2] hover:bg-white/10'
                }`}
              >
                <p className="text-xs font-bold">{t(q.label, q.labelFa)}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{q.sub}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Subtitles & Audio Preferences */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Subtitles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {t('Subtitles & Audio Settings', 'تنظیمات زیرنویس و پخش')}
            </h2>
            <p className="text-xs text-[#A3AEC2]">
              {t('Default subtitle language and playback speed', 'تنظیم زبان زیرنویس و سرعت پیش‌فرض پخش')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Subtitle Language Selector */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              {t('Default Subtitle Language', 'زبان پیش‌فرض زیرنویس')}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateUser({ defaultSubtitleLang: 'en' })}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  user.defaultSubtitleLang === 'en'
                    ? 'bg-[#F5B942] text-[#060810] border-[#F5B942]'
                    : 'bg-white/5 text-[#A3AEC2] border-white/10 hover:text-white'
                }`}
              >
                English Subtitles
              </button>
              <button
                type="button"
                onClick={() => onUpdateUser({ defaultSubtitleLang: 'fa' })}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  user.defaultSubtitleLang === 'fa'
                    ? 'bg-[#F5B942] text-[#060810] border-[#F5B942]'
                    : 'bg-white/5 text-[#A3AEC2] border-white/10 hover:text-white'
                }`}
              >
                زیرنویس فارسی
              </button>
            </div>
          </div>

          {/* Playback Speed Selector */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              {t('Default Playback Speed', 'سرعت پخش پیش‌فرض')}
            </label>
            <div className="flex items-center gap-2">
              {[1, 1.25, 1.5].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onUpdateUser({ defaultSpeed: speed })}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    user.defaultSpeed === speed
                      ? 'bg-[#F5B942] text-[#060810] border-[#F5B942]'
                      : 'bg-white/5 text-[#A3AEC2] border-white/10 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Android TV & Big Screen Mode */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('Android TV & Remote Mode', 'حالت تلویزیون و ریموت کنترل')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t(
                  'Enables high-contrast D-Pad remote navigation for Smart TVs',
                  'فعال‌سازی ناوبری چهارجهته (D-Pad) برای تلویزیون‌های هوشمند و ریموت'
                )}
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={handleToggleTvMode}
            className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
              isTvMode ? 'bg-[#F5B942] justify-end' : 'bg-white/20 justify-start'
            }`}
          >
            <div className={`w-6 h-6 rounded-full shadow-md ${isTvMode ? 'bg-[#060810]' : 'bg-white'}`} />
          </button>
        </div>

        {isTvMode && (
          <div className="p-3 rounded-2xl bg-[#F5B942]/10 border border-[#F5B942]/30 text-xs text-[#F5B942] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              {t(
                'TV Navigation active. Use Arrow Keys, Enter to Select, Back/Escape to Return.',
                'حالت تلویزیون فعال است. از کلیدهای جهت‌نما، Enter برای انتخاب و Escape/Back برای بازگشت استفاده کنید.'
              )}
            </span>
          </div>
        )}
      </section>

      {/* 5. Cloud Streams Live Sync Status */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('Dynamic Stream Synchronization', 'همگام‌سازی ابری استریم‌ها')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t('Connected to official GitHub cloud stream repository', 'متصل به مخزن رسمی استریم‌ها در گیت‌هاب')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncStreamsNow}
            disabled={isSyncing}
            className="min-h-[40px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#F5B942]' : ''}`} />
            <span>{isSyncing ? t('Syncing...', 'در حال همگام‌سازی...') : t('Sync Now', 'بروزرسانی استریم‌ها')}</span>
          </button>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
      </section>

      {/* 6. In-App Memory & Reset */}
      <section className="p-6 rounded-3xl bg-[#0B0E19]/80 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t('In-App Storage & Cache', 'حافظه و کش اپلیکیشن')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t('Stored offline catalog & watch history:', 'حجم داده‌های ذخیره‌شده و سوابق تماشا:')}{' '}
                <span className="font-mono text-slate-200 font-bold">{formatBytes(vaultSizeBytes)}</span>
              </p>
            </div>
          </div>

          {!confirmClearCache ? (
            <button
              type="button"
              onClick={() => setConfirmClearCache(true)}
              className="min-h-[40px] px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('Clear App Cache', 'پاکسازی کش و ریست')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAppCache}
                className="min-h-[40px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              >
                <span>{t('Confirm Reset', 'تأیید و پاکسازی')}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearCache(false)}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {t('Cancel', 'انصراف')}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 7. Platform Info Footer */}
      <div className="p-4 text-center text-xs text-[#64748B] space-y-1">
        <p className="font-editorial text-[#F5B942] text-sm">ai petros · Petros Cinema</p>
        <p>Aipetros-stream Engine · Obsidian Noir Edition</p>
      </div>
    </div>
  );
}
