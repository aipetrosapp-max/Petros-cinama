import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CryptoAdUnit } from '../services/cryptoAdNetwork';

interface CryptoAdModalProps {
  isOpen: boolean;
  ad: CryptoAdUnit | null;
  onClose: (skipped: boolean) => void;
  lang?: 'fa' | 'en';
}

export const CryptoAdModal: React.FC<CryptoAdModalProps> = ({
  isOpen,
  ad,
  onClose,
  lang = 'fa'
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(5);
      setCanSkip(false);
      return;
    }

    setSecondsRemaining(5);
    setCanSkip(false);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || !ad) return null;

  const isFa = lang === 'fa';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Crypto Sponsor Interstitial"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#F5B942]/30 bg-gradient-to-b from-[#0F1424] via-[#0A0E1A] to-[#060810] p-6 shadow-2xl shadow-black/80"
          dir={isFa ? 'rtl' : 'ltr'}
        >
          {/* Subtle Glow Header */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#F5B942]/15 blur-3xl pointer-events-none rounded-full" />

          {/* Top Bar with Badge & Timer */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F5B942]/15 border border-[#F5B942]/30 text-[#F5B942]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isFa ? 'اسپانسر کریپتو • بدون KYC' : 'Crypto Sponsor • No KYC'}</span>
              </span>
              <span className="text-[11px] text-[#A3AEC2] hidden sm:inline">
                {isFa ? 'حفظ حریم خصوصی ۱۰۰٪ بدون ردیاب' : '100% Zero-Tracking & Private'}
              </span>
            </div>

            {/* Skip Button / Timer */}
            <div className="flex items-center gap-2">
              {canSkip ? (
                <button
                  type="button"
                  onClick={() => onClose(true)}
                  className="min-h-[36px] px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>{isFa ? 'رد کردن تبلیغ' : 'Skip Ad'}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs text-[#A3AEC2]">
                  <span>{isFa ? 'رد کردن بعد از' : 'Skip in'}</span>
                  <span className="font-bold text-[#F5B942] w-3 text-center">{secondsRemaining}</span>
                  <span>{isFa ? 'ثانیه' : 's'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content Body */}
          <div className="my-5 flex flex-col gap-4">
            {ad.bannerImageUrl && (
              <div className="relative aspect-[16/8] w-full overflow-hidden rounded-xl border border-white/10 bg-black">
                <img
                  src={ad.bannerImageUrl}
                  alt={ad.title}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-xs text-white/90">
                  <span className="font-semibold text-[#F5B942]">{ad.sponsorName}</span>
                  <span className="bg-black/60 px-2 py-0.5 rounded text-[10px] text-white/70">A-Ads Network</span>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-wide">
                {ad.title}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-[#A3AEC2] leading-relaxed">
                {ad.description}
              </p>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
            <p className="text-[11px] text-[#A3AEC2]/80 text-center sm:text-start">
              {isFa
                ? 'پلتفرم ai petros با اسپانسرهای غیرمتمرکز بدون ثبت مشخصات شما پایدار می‌ماند.'
                : 'ai petros operates via privacy-preserving decentralized crypto sponsorships.'}
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={ad.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClose(false)}
                className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#F5B942] to-[#D4AF37] text-[#060810] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#F5B942]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>{ad.ctaText || (isFa ? 'مشاهده اسپانسر' : 'Visit Sponsor')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {canSkip && (
                <button
                  type="button"
                  onClick={() => onClose(true)}
                  className="sm:hidden min-h-[40px] px-3 rounded-xl bg-white/10 text-white text-xs font-semibold"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
