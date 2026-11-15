import React from 'react';
import { Play, Sparkles } from 'lucide-react';
import type { PrototypeMediaItem } from '../types';
import { useT } from '../i18n';

interface GoldenMarqueePosterProps {
  item: PrototypeMediaItem;
  titleOverride?: string;
  onClick?: () => void;
  className?: string;
}

export function GoldenMarqueePoster({
  item,
  titleOverride,
  onClick,
  className = ''
}: GoldenMarqueePosterProps) {
  const { t } = useT();
  const displayTitle = titleOverride || item.titleEn || item.titleFa || 'VIP CINEMA SELECTION';

  // Bulbs along top, right, bottom, left
  const bulbCountHorizontal = 12;
  const bulbCountVertical = 16;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Sub-header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-[#F5B942]" />
        <span className="font-cinzel text-xs font-bold tracking-[0.18em] text-[#D4AF37]">
          MOOD CONCIERGE & MARQUEE
        </span>
      </div>

      {/* Marquee Structure */}
      <div
        onClick={onClick}
        className="group relative cursor-pointer p-4 rounded-3xl bg-gradient-to-b from-[#2a2416] via-[#151720] to-[#0c0d12] border-2 border-[rgba(212,175,55,0.65)] shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(212,175,55,0.3)] transition-transform duration-300 hover:scale-[1.02]"
        style={{
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.25), inset 0 0 20px rgba(212, 175, 55, 0.2)'
        }}
      >
        {/* Top Glowing Marquee Title Plaque */}
        <div className="relative -mt-8 mb-3 mx-auto max-w-[90%] px-5 py-2 rounded-xl bg-gradient-to-r from-[#8a7224] via-[#F5B942] to-[#8a7224] border-2 border-[#FFF2A7] shadow-[0_8px_25px_rgba(212,175,55,0.7)] text-center">
          <span className="font-cinzel text-xs sm:text-sm font-black tracking-widest text-[#050508] uppercase truncate block">
            {displayTitle}
          </span>
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>

        {/* Outer Bulbs - Top Row */}
        <div className="absolute top-2 inset-x-5 flex justify-between pointer-events-none">
          {Array.from({ length: bulbCountHorizontal }).map((_, i) => (
            <div
              key={`top-${i}`}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFF2A7] shadow-[0_0_8px_#F5B942] animate-pulse"
              style={{ animationDelay: `${(i * 120) % 1500}ms` }}
            />
          ))}
        </div>

        {/* Outer Bulbs - Left Column */}
        <div className="absolute inset-y-6 left-2 flex flex-col justify-between pointer-events-none">
          {Array.from({ length: bulbCountVertical }).map((_, i) => (
            <div
              key={`left-${i}`}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFF2A7] shadow-[0_0_8px_#F5B942] animate-pulse"
              style={{ animationDelay: `${(i * 150) % 1500}ms` }}
            />
          ))}
        </div>

        {/* Outer Bulbs - Right Column */}
        <div className="absolute inset-y-6 right-2 flex flex-col justify-between pointer-events-none">
          {Array.from({ length: bulbCountVertical }).map((_, i) => (
            <div
              key={`right-${i}`}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFF2A7] shadow-[0_0_8px_#F5B942] animate-pulse"
              style={{ animationDelay: `${((i + 4) * 150) % 1500}ms` }}
            />
          ))}
        </div>

        {/* Outer Bulbs - Bottom Row */}
        <div className="absolute bottom-2 inset-x-5 flex justify-between pointer-events-none">
          {Array.from({ length: bulbCountHorizontal }).map((_, i) => (
            <div
              key={`bot-${i}`}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FFF2A7] shadow-[0_0_8px_#F5B942] animate-pulse"
              style={{ animationDelay: `${((i + 6) * 120) % 1500}ms` }}
            />
          ))}
        </div>

        {/* Poster Canvas */}
        <div className="relative rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.5)] aspect-[2/3] w-56 sm:w-64 bg-black">
          <img
            src={item.posterUrl}
            alt={displayTitle}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Vignette & Amber Specular Reflection */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />

          {/* Center Play Button on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.9)] transform group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 fill-current stroke-[2] translate-x-0.5" />
            </div>
          </div>

          {/* Bottom Title Bar */}
          <div className="absolute bottom-3 inset-x-3 text-center">
            <p className="font-cinzel text-xs font-bold text-[#FFF2A7] drop-shadow-md truncate">
              {item.titleFa || item.titleEn}
            </p>
            <p className="text-[10px] font-mono text-[#D4AF37] drop-shadow">
              {item.releaseYear} · {item.quality} · IMAX VIP
            </p>
          </div>
        </div>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-widest text-[#8E9BB3] mt-3">
        {t('Cinema Movie Poster Interface', 'طراحی مارکی و قاب سینمایی پوستر')}
      </p>
    </div>
  );
}
