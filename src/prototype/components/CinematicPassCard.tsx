import React from 'react';
import { Check } from 'lucide-react';
import type { LanguageCode } from '../types';
import { useT } from '../i18n';

interface CinematicPassCardProps {
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onOpenLanguagePicker?: () => void;
}

export function CinematicPassCard({
  lang,
  onChangeLang,
  onOpenLanguagePicker
}: CinematicPassCardProps) {
  const { t } = useT();

  return (
    <div className="space-y-6 text-center">
      {/* 35mm Golden Film Projector with Volumetric Light Beam Rays */}
      <div className="relative flex flex-col items-center justify-center pt-2">
        <div className="relative w-40 h-32 flex items-center justify-center">
          {/* Volumetric Beam Rays */}
          <div
            className="absolute left-1/2 top-1/2 -translate-y-1/2 w-48 h-32 pointer-events-none opacity-80"
            style={{
              background:
                'radial-gradient(ellipse at 15% 50%, rgba(245, 185, 66, 0.45) 0%, rgba(212, 175, 55, 0.2) 40%, transparent 75%)',
              transform: 'translateX(20px) rotate(-6deg)',
              filter: 'blur(8px)'
            }}
          />
          {/* Light Cone Overlay */}
          <div
            className="absolute left-1/2 top-1/2 -translate-y-1/2 w-52 h-24 pointer-events-none opacity-50"
            style={{
              clipPath: 'polygon(15% 45%, 100% 0%, 100% 100%, 15% 55%)',
              background: 'linear-gradient(90deg, rgba(255,242,167,0.7) 0%, rgba(212,175,55,0.2) 60%, transparent 100%)'
            }}
          />

          {/* Projector SVG */}
          <svg
            viewBox="0 0 160 120"
            className="relative z-10 w-28 h-24 filter drop-shadow-[0_0_16px_rgba(212,175,55,0.6)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Top Film Reels */}
            <circle cx="56" cy="32" r="18" stroke="#D4AF37" strokeWidth="2.5" fill="#0B0C10" />
            <circle cx="56" cy="32" r="8" stroke="#F5B942" strokeWidth="1.5" />
            <circle cx="56" cy="32" r="3" fill="#FFF2A7" />
            <line x1="56" y1="14" x2="56" y2="50" stroke="#D4AF37" strokeWidth="1.2" opacity="0.7" />
            <line x1="38" y1="32" x2="74" y2="32" stroke="#D4AF37" strokeWidth="1.2" opacity="0.7" />

            <circle cx="94" cy="30" r="16" stroke="#D4AF37" strokeWidth="2.5" fill="#0B0C10" />
            <circle cx="94" cy="30" r="7" stroke="#F5B942" strokeWidth="1.5" />
            <circle cx="94" cy="30" r="2.5" fill="#FFF2A7" />
            <line x1="94" y1="14" x2="94" y2="46" stroke="#D4AF37" strokeWidth="1.2" opacity="0.7" />
            <line x1="78" y1="30" x2="110" y2="30" stroke="#D4AF37" strokeWidth="1.2" opacity="0.7" />

            {/* Projector Body */}
            <rect
              x="42"
              y="44"
              width="60"
              height="38"
              rx="4"
              stroke="#D4AF37"
              strokeWidth="2.5"
              fill="url(#goldGradBody)"
            />
            {/* Side Lens Assembly */}
            <path
              d="M102 54 L122 47 L122 75 L102 68 Z"
              stroke="#F5B942"
              strokeWidth="2"
              fill="url(#goldLensGrad)"
            />
            <ellipse cx="122" cy="61" rx="3" ry="14" fill="#FFF2A7" stroke="#D4AF37" strokeWidth="1.5" />

            {/* Tripod Stand */}
            <line x1="72" y1="82" x2="72" y2="94" stroke="#D4AF37" strokeWidth="2.5" />
            <line x1="72" y1="94" x2="48" y2="114" stroke="#D4AF37" strokeWidth="2" />
            <line x1="72" y1="94" x2="72" y2="115" stroke="#D4AF37" strokeWidth="2" />
            <line x1="72" y1="94" x2="96" y2="114" stroke="#D4AF37" strokeWidth="2" />

            {/* Gradients */}
            <defs>
              <linearGradient id="goldGradBody" x1="42" y1="44" x2="102" y2="82" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1C1810" />
                <stop offset="0.5" stopColor="#0E0F14" />
                <stop offset="1" stopColor="#252014" />
              </linearGradient>
              <linearGradient id="goldLensGrad" x1="102" y1="54" x2="122" y2="61" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F5B942" />
                <stop offset="1" stopColor="#D4AF37" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title & Badge */}
        <h2 className="font-cinzel text-base sm:text-lg font-black tracking-[0.2em] text-[#D4AF37] mt-1">
          {t('ACCESS AUTHENTICATION & IDENTITY', 'احراز هویت و شناسنامه سینمایی')}
        </h2>
        <div className="mt-2 inline-flex items-center px-4 py-1 rounded-full border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.12)] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          <span className="text-[10px] font-mono tracking-widest uppercase text-[#F5B942] font-bold">
            {t('SELECT IDENTITY', 'انتخاب هویت و زبان VIP')}
          </span>
        </div>
      </div>

      {/* 2 VIP Holographic Cinema Tickets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {/* ENG [VIP 01] Ticket */}
        <button
          type="button"
          onClick={() => onChangeLang('en')}
          className={`vip-ticket-card group relative p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between overflow-hidden ${
            lang === 'en'
              ? 'active bg-gradient-to-r from-[#241e12] via-[#15130d] to-[#0c0b08] border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.35)]'
              : 'bg-[#0B0C10]/85 border-[rgba(212,175,55,0.25)] hover:border-[#D4AF37]/60 hover:bg-[#13141a]'
          }`}
        >
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2">
              <span className="font-cinzel text-2xl font-black tracking-wider text-[#D4AF37]">ENG</span>
              <span className="text-[11px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded bg-[rgba(212,175,55,0.2)] text-[#F5B942] border border-[rgba(212,175,55,0.35)]">
                [VIP 01]
              </span>
            </div>
            <p className="text-xs text-slate-200 font-semibold tracking-wide">English Interface</p>
            <p className="text-[10px] text-[#A3AEC2] tracking-wider font-mono">Pristine 4K Master & CC</p>
          </div>

          {/* Barcode Stub */}
          <div className="flex items-center gap-3 z-10 pl-2">
            <div className="flex flex-col items-center gap-1 opacity-80">
              <div className="flex gap-[2px] h-11 items-center">
                <span className="w-[1.5px] h-full bg-[#D4AF37]" />
                <span className="w-[3px] h-full bg-[#D4AF37]" />
                <span className="w-[1px] h-full bg-[#D4AF37]" />
                <span className="w-[2.5px] h-full bg-[#D4AF37]" />
                <span className="w-[1px] h-full bg-[#D4AF37]" />
                <span className="w-[3px] h-full bg-[#D4AF37]" />
                <span className="w-[1px] h-full bg-[#D4AF37]" />
                <span className="w-[2px] h-full bg-[#D4AF37]" />
              </div>
              <span className="text-[8px] font-mono tracking-tighter text-[#D4AF37]">#0091-EN</span>
            </div>
            {lang === 'en' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.7)]">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            )}
          </div>
        </button>

        {/* فارسی [VIP 03] Ticket */}
        <button
          type="button"
          onClick={() => onChangeLang('fa')}
          dir="rtl"
          className={`vip-ticket-card group relative p-5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between overflow-hidden ${
            lang === 'fa'
              ? 'active bg-gradient-to-l from-[#241e12] via-[#15130d] to-[#0c0b08] border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.35)]'
              : 'bg-[#0B0C10]/85 border-[rgba(212,175,55,0.25)] hover:border-[#D4AF37]/60 hover:bg-[#13141a]'
          }`}
        >
          <div className="space-y-1 z-10 text-right">
            <div className="flex items-center gap-2 justify-start">
              <span className="font-bold text-2xl text-[#D4AF37]">فارسی</span>
              <span className="text-[11px] font-mono font-bold tracking-widest px-2.5 py-0.5 rounded bg-[rgba(212,175,55,0.2)] text-[#F5B942] border border-[rgba(212,175,55,0.35)]">
                [VIP 03]
              </span>
            </div>
            <p className="text-xs text-slate-200 font-semibold tracking-wide">رابط کاربری راست‌چین</p>
            <p className="text-[10px] text-[#A3AEC2] tracking-wider font-mono">زیرنویس و دوبله سینمایی</p>
          </div>

          {/* Barcode Stub */}
          <div className="flex items-center gap-3 z-10 pr-2">
            <div className="flex flex-col items-center gap-1 opacity-80">
              <div className="flex gap-[2px] h-11 items-center">
                <span className="w-[2px] h-full bg-[#D4AF37]" />
                <span className="w-[1px] h-full bg-[#D4AF37]" />
                <span className="w-[3px] h-full bg-[#D4AF37]" />
                <span className="w-[1.5px] h-full bg-[#D4AF37]" />
                <span className="w-[2.5px] h-full bg-[#D4AF37]" />
                <span className="w-[1px] h-full bg-[#D4AF37]" />
                <span className="w-[3px] h-full bg-[#D4AF37]" />
              </div>
              <span className="text-[8px] font-mono tracking-tighter text-[#D4AF37]">#0093-FA</span>
            </div>
            {lang === 'fa' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_12px_rgba(212,175,55,0.7)]">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            )}
          </div>
        </button>
      </div>

      <p className="text-[11px] font-mono tracking-widest uppercase text-[#8E9BB3]">
        {t('Cinematic Pass & Entry', 'گذرنامه و بلیط اختصاصی ورود')}
      </p>
    </div>
  );
}
