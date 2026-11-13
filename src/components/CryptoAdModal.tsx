import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, X, Sparkles, CheckCircle2, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CryptoAdUnit } from '../services/cryptoAdNetwork';
import type { OptimizedAdUnit } from '../services/aiAdOptimizationAgent';

interface CryptoAdModalProps {
  isOpen: boolean;
  ad: CryptoAdUnit | OptimizedAdUnit | null;
  onClose: (skipped: boolean) => void;
  lang?: 'fa' | 'en';
}

export const CryptoAdModal: React.FC<CryptoAdModalProps> = ({
  isOpen,
  ad,
  onClose,
  lang = 'en'
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
  const payoutWallet = (ad as OptimizedAdUnit).payoutWallet || 'TXPetrosCinemaAiStreamNoKycVault7792Xm';
  const networkName = (ad as OptimizedAdUnit).networkName || 'A-Ads Anonymous Network';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Petros AI Ad Optimization & Sponsor Interstitial"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#F5B942]/35 bg-gradient-to-b from-[#0F1424] via-[#0A0E1A] to-[#060810] p-5 sm:p-6 shadow-2xl shadow-black/90"
          dir={isFa ? 'rtl' : 'ltr'}
        >
          {/* Subtle Glow Header */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#F5B942]/15 blur-3xl pointer-events-none rounded-full" />

          {/* Top Bar with AI Agent Badge & Timer */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5B942]/15 border border-[#F5B942]/30 text-[#F5B942]">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>{isFa ? 'ایجنت تبلیغات AI • بدون KYC' : 'AI Ad Agent • No KYC'}</span>
              </span>
              <span className="text-[10px] text-[#A3AEC2] hidden sm:inline">
                {isFa ? 'بهترین نرخ درآمد کریپتویی' : 'Top Optimized Crypto Network'}
              </span>
            </div>

            {/* Skip Button / Timer */}
            <div className="flex items-center gap-2">
              {canSkip ? (
                <button
                  type="button"
                  onClick={() => onClose(true)}
                  className="min-h-[34px] px-3.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <span>{isFa ? 'رد کردن تبلیغ' : 'Skip Ad'}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-xs text-[#A3AEC2]">
                  <span>{isFa ? 'رد کردن در' : 'Skip in'}</span>
                  <span className="font-mono font-bold text-[#F5B942] w-3 text-center">{secondsRemaining}</span>
                  <span>{isFa ? 'ثانیه' : 's'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Banner Media Visual */}
          <div className="my-4 flex flex-col gap-3">
            {ad.bannerImageUrl && (
              <div className="relative aspect-[16/8] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg">
                <img
                  src={ad.bannerImageUrl}
                  alt={ad.title}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 start-3 end-3 flex items-center justify-between text-xs text-white/90">
                  <span className="font-bold text-[#F5B942] drop-shadow">{ad.sponsorName}</span>
                  <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                    {networkName}
                  </span>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-wide">
                {ad.title}
              </h3>
              <p className="mt-1 text-xs text-[#A3AEC2] leading-relaxed">
                {ad.description}
              </p>
            </div>
          </div>

          {/* AI Wallet Direct Payout Attribution Box */}
          <div className="p-3 rounded-2xl bg-[#00F0FF]/5 border border-[#00F0FF]/20 flex items-center justify-between gap-3 text-xs mb-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <Wallet className="w-4 h-4 text-[#00F0FF] shrink-0" />
              <div className="truncate">
                <p className="text-[10px] text-[#A3AEC2]">
                  {isFa ? 'واریز مستقیم درآمد به آدرس ولت شما:' : 'Direct Ad Revenue Routed To Wallet:'}
                </p>
                <p className="font-mono text-[11px] text-[#00F0FF] font-semibold truncate" dir="ltr">
                  {payoutWallet}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 shrink-0 border border-emerald-500/30">
              {isFa ? 'تأیید آنی' : 'Verified'}
            </span>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
            <p className="text-[10px] text-[#64748B] text-center sm:text-start">
              {isFa
                ? 'نمایش هدفمند پس از هر ۴ ویدیو · بدون ایجاد مزاحمت یا ثبت اطلاعات شخصی.'
                : 'Targeted ad strictly after every 4 videos. Zero personal data tracked.'}
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={ad.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClose(false)}
                className="w-full sm:w-auto min-h-[38px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#F5B942] to-[#D4AF37] text-[#060810] font-black text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-[#F5B942]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>{ad.ctaText || (isFa ? 'مشاهده اسپانسر' : 'Visit Sponsor')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {canSkip && (
                <button
                  type="button"
                  onClick={() => onClose(true)}
                  className="sm:hidden min-h-[38px] px-3 rounded-xl bg-white/10 text-white text-xs font-semibold"
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
