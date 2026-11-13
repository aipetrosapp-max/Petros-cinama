import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import { cryptoAdNetwork, type CryptoAdUnit } from '../services/cryptoAdNetwork';

interface CryptoAdBannerProps {
  unitType?: CryptoAdUnit['unitType'];
  className?: string;
  lang?: 'fa' | 'en';
}

export const CryptoAdBanner: React.FC<CryptoAdBannerProps> = ({
  unitType = 'banner-728x90',
  className = '',
  lang = 'fa'
}) => {
  const [ad] = useState<CryptoAdUnit>(() => cryptoAdNetwork.getRandomAd(unitType));
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !cryptoAdNetwork.isAdsEnabled()) return null;

  const isFa = lang === 'fa';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#F5B942]/20 bg-gradient-to-r from-[#0C101D] via-[#0E1528] to-[#0A0D18] p-3 sm:p-4 text-white shadow-md ${className}`}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Ad Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {ad.bannerImageUrl && (
            <img
              src={ad.bannerImageUrl}
              alt={ad.title}
              className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0 hidden xs:block"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30 flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>{ad.badgeText || (isFa ? 'اسپانسر کریپتو' : 'Crypto Sponsor')}</span>
              </span>
              <span className="text-xs font-semibold truncate text-[#F5F7FA]">{ad.title}</span>
            </div>
            <p className="text-[11px] text-[#A3AEC2] line-clamp-1 mt-0.5">
              {ad.description}
            </p>
          </div>
        </div>

        {/* Action Button & Dismiss */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <a
            href={ad.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[32px] px-3.5 py-1 rounded-lg bg-[#F5B942] text-[#060810] text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-sm"
          >
            <span>{ad.ctaText || (isFa ? 'مشاهده' : 'Visit')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="بستن تبلیغ"
            className="min-h-[32px] w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-[#A3AEC2] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
