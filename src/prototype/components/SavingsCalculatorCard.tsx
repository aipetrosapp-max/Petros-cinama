import React, { useState } from 'react';
import { DollarSign, Share2, Check, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';
import { useT } from '../i18n';

export function SavingsCalculatorCard() {
  const { t, lang } = useT();
  const [copied, setCopied] = useState(false);

  const isFa = lang === 'fa';
  const savingsText = isFa
    ? '۳,۶۰۰,۰۰۰+ تومان'
    : '$600+ / Year';

  const viralMessageFa = `🎉 من با استفاده از پلتفرم رایگان Petros Cinema سالانه بیش از ۳,۶۰۰,۰۰۰ تومان در هزینه اشتراک فیلیمو و نماوا صرفه‌جویی کردم! تمام فیلم‌ها و سریال‌های روز دنیا بدون سانسور و با کیفیت 4K رایگان:\nhttps://aipetrosapp-max.github.io/Petros-cinama/`;
  const viralMessageEn = `🎉 I saved over $600/year by switching to AI Petros Cinema! Stream thousands of 4K HDR movies & series 100% free with zero subscriptions:\nhttps://aipetrosapp-max.github.io/Petros-cinama/`;

  const activeViralMessage = isFa ? viralMessageFa : viralMessageEn;

  const handleShareStory = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Streaming Savings on AI Petros',
          text: activeViralMessage,
          url: 'https://aipetrosapp-max.github.io/Petros-cinama/'
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeViralMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-[rgba(212,175,55,0.25)] bg-[#0B0C10] shadow-xl space-y-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xl shadow-[0_0_16px_rgba(212,175,55,0.2)]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-cinzel text-sm sm:text-base font-bold tracking-wider text-[#D4AF37]">
                {t('ANNUAL SUBSCRIPTION SAVINGS CALCULATOR', 'محاسبه‌گر صرفه‌جویی سالانه در هزینه اشتراک')}
              </h3>
            </div>
            <p className="text-xs text-[#A3AEC2] mt-0.5">
              {t(
                'By streaming on AI Petros instead of paid services (Filimo / Namava / Netflix):',
                'میزان پولی که با تماشا در پتروس سینما به جای فیلیمو، نماوا و نتفلیکس پس‌انداز کرده‌اید:'
              )}
            </p>
          </div>
        </div>

        {/* Savings Badge */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-[#8E9BB3] block">
              {t('You Saved', 'صرفه‌جویی شما')}
            </span>
            <span className="font-mono text-lg sm:text-xl font-black text-emerald-400">
              {savingsText}
            </span>
          </div>

          <button
            type="button"
            onClick={handleShareStory}
            className="h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] text-xs font-bold text-[#D4AF37] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{t('Copied!', 'کپی شد!')}</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>{t('Share Story', 'اشتراک‌گذاری در استوری')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
