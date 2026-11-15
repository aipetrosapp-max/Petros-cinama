import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Send,
  MessageCircle,
  Share2,
  Sparkles,
  X,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useT } from '../i18n';
import type { PrototypeMediaItem } from '../types';

interface WatchPartyShareModalProps {
  isOpen: boolean;
  item: PrototypeMediaItem | null;
  onClose: () => void;
}

export function WatchPartyShareModal({ isOpen, item, onClose }: WatchPartyShareModalProps) {
  const { t, lang } = useT();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !item) return null;

  const itemTitle = t(item.titleEn, item.titleFa);
  const shareUrl = `https://aipetrosapp-max.github.io/Petros-cinama/#watch=${item.id}&party=1`;

  const shareTextFa = `🍿 بیا این فیلم خفن «${itemTitle}» رو همین الان آنلاین و رایگان با هم توی Petros Cinema ببینیم! کاملاً بدون سانسور و بدون نیاز به خرید اشتراک:\n${shareUrl}`;
  const shareTextEn = `🍿 Let's watch "${itemTitle}" together for free in 4K on AI Petros Cinema! No subscription, zero ads:\n${shareUrl}`;
  const activeShareText = lang === 'fa' ? shareTextFa : shareTextEn;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeShareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Watch ${itemTitle} on AI Petros`,
          text: activeShareText,
          url: shareUrl
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(activeShareText)}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(activeShareText)}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[rgba(212,175,55,0.35)] bg-[#0B0C10] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.15)] text-slate-100"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 end-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3.5 border-b border-[rgba(212,175,55,0.15)] pb-4">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.25)]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base sm:text-lg font-bold tracking-wider text-[#D4AF37]">
                  {t('WATCH-PARTY WITH FRIENDS', 'تماشای همزمان فیلم با دوستان')}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  FREE
                </span>
              </div>
              <p className="text-xs text-[#A3AEC2]">
                {t('Invite friends or your partner to stream synchronized 4K video together.', 'لینک را ارسال کنید تا با دوستان یا پارتنرتان فیلم را همزمان تماشا کنید.')}
              </p>
            </div>
          </div>

          {/* Film Highlight Mini Card */}
          <div className="my-5 p-3 rounded-2xl bg-white/[0.02] border border-[rgba(212,175,55,0.2)] flex items-center gap-3">
            <img
              src={item.posterUrl}
              alt={itemTitle}
              className="w-14 h-18 rounded-xl object-cover border border-[rgba(212,175,55,0.3)] shrink-0"
            />
            <div className="min-w-0">
              <h4 className="font-cinzel text-sm font-bold text-slate-100 truncate">
                {itemTitle}
              </h4>
              <p className="text-xs text-[#A3AEC2] mt-0.5">
                {item.quality || '4K HDR'} · {item.releaseYear || '2026'} · {t('Uncensored', 'بدون سانسور')}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#D4AF37]">
                <Sparkles className="w-3 h-3" />
                <span>{t('Zero sign-up required for your guests', 'مهمانان شما نیاز به هیچ ثبت‌نامی ندارند')}</span>
              </div>
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={telegramShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/40 text-[#229ED9] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{t('Telegram Share', 'ارسال در تلگرام')}</span>
              </a>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('WhatsApp Share', 'ارسال در واتس‌اپ')}</span>
              </a>
            </div>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('Link Copied to Clipboard!', 'لینک دعوت اختصاصی کپی شد!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t('Copy 1-Click Invite Link', 'کپی لینک دعوت یک‌کلیکه')}</span>
                </>
              )}
            </button>

            {/* Native Mobile Share fallback */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleNativeShare}
                className="text-[11px] text-[#A3AEC2] hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t('Or share using system share sheet...', 'یا اشتراک‌گذاری با منوی گوشی...')}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
