import React from 'react';
import { Users, Sparkles, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useT } from '../i18n';
import type { PrototypeMediaItem } from '../types';

interface WatchPartyShareModalProps {
  isOpen: boolean;
  item: PrototypeMediaItem | null;
  onClose: () => void;
}

/**
 * Watch Party is intentionally presented as a beta/coming-soon feature.
 * The previous implementation generated an invite URL that did not create a
 * room or synchronize playback. No broken link or Telegram redirect is exposed.
 */
export function WatchPartyShareModal({ isOpen, item, onClose }: WatchPartyShareModalProps) {
  const { t } = useT();

  if (!isOpen || !item) return null;

  const itemTitle = t(item.titleEn, item.titleFa);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[rgba(212,175,55,0.35)] bg-[#0B0C10] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.95)] text-slate-100"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close', 'بستن')}
            className="absolute top-4 end-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 border-b border-[rgba(212,175,55,0.15)] pb-4">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-[#D4AF37]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#D4AF37]">
                  {t('WATCH PARTY', 'تماشای همزمان')}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" />
                  {t('COMING SOON', 'به‌زودی')}
                </span>
              </div>
              <p className="text-xs text-[#A3AEC2] mt-0.5">{itemTitle}</p>
            </div>
          </div>

          <div className="my-5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
              <Sparkles className="w-4 h-4" />
              <span>{t('Synchronized rooms are not available yet', 'اتاق همگام‌سازی هنوز فعال نیست')}</span>
            </div>
            <p className="text-xs leading-relaxed text-[#A3AEC2]">
              {t(
                'A previous version created an invite link that did not synchronize playback. That link has been removed so no broken promise is shown. A real WebSocket/WebRTC room is planned for the next release.',
                'در نسخه قبلی لینک دعوتی ساخته می‌شد که پخش را همگام نمی‌کرد. آن لینک حذف شد تا وعده بی‌نتیجه‌ای نمایش داده نشود. اتاق واقعی مبتنی بر WebSocket/WebRTC در نسخه بعدی ارائه می‌شود.'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            {t('Continue Watching Solo', 'ادامه تماشای انفرادی')}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
