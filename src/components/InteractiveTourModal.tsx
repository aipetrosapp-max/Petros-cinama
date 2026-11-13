import React, { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  Film,
  Search,
  Compass,
  Download,
  Tv,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { LanguageCode, PrototypeRoute } from '../prototype/types';
import { useT } from '../prototype/i18n';

interface InteractiveTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  onNavigateToTab?: (route: PrototypeRoute) => void;
}

interface TourStep {
  id: string;
  icon: React.ReactNode;
  route?: PrototypeRoute;
  badgeEn: string;
  badgeFa: string;
  titleEn: string;
  titleFa: string;
  descriptionEn: string;
  descriptionFa: string;
  highlightDetailsEn: string[];
  highlightDetailsFa: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'cinema-home',
    icon: <Film className="w-7 h-7 text-[#F5B942]" />,
    route: 'universe',
    badgeEn: 'Core Platform',
    badgeFa: 'هسته پلتفرم',
    titleEn: 'Petros Cinema & Living Feed',
    titleFa: 'سالن سینما و فید هوشمند پتروس',
    descriptionEn:
      'Welcome to ai petros! The homepage dynamically organizes movies into living clusters based on cinematic aesthetics, rhythm, and your taste vector. All streams are synchronized live via cloud sources.',
    descriptionFa:
      'به سینما هوش مصنوعی پتروس خوش آمدید! صفحه اصلی به صورت هوشمند فیلم‌ها را بر اساس سبک بصری، ریتم و سلیقه سینمایی شما دسته‌بندی می‌کند. تمامی استریم‌ها به صورت زنده از کلود همگام می‌شوند.',
    highlightDetailsEn: [
      '4K HDR Ultra High Definition Streaming',
      'Dynamic GitHub Cloud Source Synchronization',
      'Non-intrusive Privacy-Preserving Experience'
    ],
    highlightDetailsFa: [
      'پخش با بالاترین کیفیت 4K HDR',
      'همگام‌سازی لحظه‌ای با مخزن ابری گیت‌هاب',
      'تجربه پخش تمیز، سریع و کاملاً بدون وقفه'
    ]
  },
  {
    id: 'search-top10',
    icon: <Search className="w-7 h-7 text-[#00F0FF]" />,
    route: 'search',
    badgeEn: 'Netflix Style',
    badgeFa: 'سبک نت‌فلیکس',
    titleEn: 'Global Top 10 & Intelligent Search',
    titleFa: '۱۰ عنوان برتر ترند جهان و جستجوی هوشمند',
    descriptionEn:
      'Discover the world\'s Top 10 trending Movies, TV Series, and Anime with smooth horizontal touch gestures, or use natural language queries (like "rainy cyberpunk noir") to find exact cinematic atmospheres.',
    descriptionFa:
      '۱۰ فیلم، سریال و انیمه ترند و پرطرفدار دنیا را با کارت‌های بزرگ و اسلاید لمسی به سبک نت‌فلیکس کشف کنید؛ یا با جستجوی متنی پیشرفته فیلم‌های هم‌حس خود را بیابید.',
    highlightDetailsEn: [
      'Touch swipe horizontal carousel for Top 10',
      'Filtered by Movies, Series, and Anime',
      'Semantic multi-lingual search & mood sparks'
    ],
    highlightDetailsFa: [
      'اسلاید لمسی روان برای ۱۰ اثر برتر جهان',
      'تفکیک بر اساس فیلم‌ها، سریال‌ها و انیمه‌ها',
      'جستجوی حسی و اتمسفریک با کلیدواژه‌های اختصاصی'
    ]
  },
  {
    id: '3d-universe',
    icon: <Compass className="w-7 h-7 text-[#A855F7]" />,
    route: 'discover',
    badgeEn: 'Spatial 3D',
    badgeFa: 'جهان ۳ بعدی',
    titleEn: '3D Spatial Exploration Universe',
    titleFa: 'اکتشاف سه‌بعدی در دنیای سینما',
    descriptionEn:
      'Navigate through a futuristic 3D cyberpunk projection space. Movies are placed in 3D coordinates based on emotional tension, pace, and surrealism. Rotate, zoom, and inspect films in spatial canvas.',
    descriptionFa:
      'در یک سالن سه‌بعدی و سایبرپانکی غوطه‌ور شوید! آثار بر اساس میزان کشش داستانی، ریتم و فضای سورئال در مختصات سه‌بعدی چیده شده‌اند تا با چرخش و زوم آنها را کاوش کنید.',
    highlightDetailsEn: [
      'Interactive 3D WebGL camera navigation',
      'Spatial proximity visual clustering',
      'Instant audio-visual previews on click'
    ],
    highlightDetailsFa: [
      'ناوبری لمسی و تعاملی در فضای سه‌بعدی',
      'خوشه‌بندی فضایی فیلم‌ها بر پایه حس سینمایی',
      'پیش‌نمایش آنی صوتی و تصویری با لمس هر نقطه'
    ]
  },
  {
    id: 'offline-vault',
    icon: <Download className="w-7 h-7 text-[#22C55E]" />,
    route: 'library',
    badgeEn: 'Offline Memory',
    badgeFa: 'آفلاین و بدون اینترنت',
    titleEn: 'In-App Offline Library & Downloads',
    titleFa: 'کتابخانه اختصاصی و دانلود آفلاین',
    descriptionEn:
      'Download any film directly to your local device memory or browser IndexedDB vault. Enjoy seamless playback even when completely offline during flights or travel.',
    descriptionFa:
      'فیلم‌ها و استریم‌ها را مستقیماً در حافظه دستگاه خود یا مخزن داخلی اپلیکیشن ذخیره کنید تا حتی بدون دسترسی به اینترنت، در سفر یا پرواز، از تماشای فیلم لذت ببرید.',
    highlightDetailsEn: [
      'High-speed chunked offline saving',
      'Zero loss local IndexedDB storage vault',
      'Save directly to device video gallery'
    ],
    highlightDetailsFa: [
      'دانلود سریع و ذخیره مستقیم در حافظه دستگاه',
      'مخزن پایدار داخلی برای پخش بدون اینترنت',
      'امکان ذخیره فایل در گالری ویدیوی گوشی و رایانه'
    ]
  },
  {
    id: 'tv-and-settings',
    icon: <Tv className="w-7 h-7 text-[#EAB308]" />,
    route: 'settings',
    badgeEn: 'Big Screen',
    badgeFa: 'تلویزیون و ریموت',
    titleEn: 'Android TV Navigation & Simple Settings',
    titleFa: 'حالت تلویزیون اندروید و تنظیمات ساده',
    descriptionEn:
      'Switch between Mobile/Desktop and Android TV remote mode. Use your TV D-Pad remote control to effortlessly navigate, adjust streaming quality, and configure subtitle preferences.',
    descriptionFa:
      'تنظیمات اپلیکیشن به صورت کاملاً خلاصه و اختصاصی طراحی شده‌اند: فعال‌سازی ریموت کنترل تلویزیون (D-Pad)، انتخاب کیفیت پیش‌فرض (4K یا 1080p)، تنظیمات زیرنویس و زبان برنامه.',
    highlightDetailsEn: [
      'Full Android TV & Smart TV D-Pad remote support',
      'Simplified application settings only',
      'Real-time cloud streams sync indicator'
    ],
    highlightDetailsFa: [
      'ناوبری کامل با ریموت کنترل تلویزیون‌های هوشمند',
      'تنظیمات اختصاصی، شفاف و بدون گزینه‌های اضافی',
      'نمایش لحظه‌ای وضعیت همگام‌سازی ابری استریم‌ها'
    ]
  }
];

export const InteractiveTourModal: React.FC<InteractiveTourModalProps> = ({
  isOpen,
  onClose,
  lang,
  onNavigateToTab
}) => {
  const { t } = useT();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      if (onNavigateToTab && TOUR_STEPS[nextIdx].route) {
        onNavigateToTab(TOUR_STEPS[nextIdx].route!);
      }
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      if (onNavigateToTab && TOUR_STEPS[prevIdx].route) {
        onNavigateToTab(TOUR_STEPS[prevIdx].route!);
      }
    }
  };

  const handleSelectStep = (idx: number) => {
    setCurrentStepIndex(idx);
    if (onNavigateToTab && TOUR_STEPS[idx].route) {
      onNavigateToTab(TOUR_STEPS[idx].route!);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl rounded-3xl bg-[#090C16] border border-[#F5B942]/35 shadow-2xl shadow-[#F5B942]/10 overflow-hidden flex flex-col text-slate-100"
        >
          {/* Top Banner with Glow Accent */}
          <div className="relative p-5 pb-3 border-b border-white/10 bg-gradient-to-b from-[#F5B942]/10 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5B942]/20 border border-[#F5B942]/40 flex items-center justify-center shadow-lg shadow-[#F5B942]/20">
                <Sparkles className="w-5 h-5 text-[#F5B942]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-100">
                    {t('Interactive Platform Guide', 'آموزش و راهنمای پلتفرم پتروس')}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/30">
                    {currentStepIndex + 1} / {TOUR_STEPS.length}
                  </span>
                </div>
                <p className="text-xs text-[#A3AEC2]">
                  {t('Step-by-step visual walkthrough', 'معرفی مرحله‌به‌مرحله بخش‌ها و امکانات سینما')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Progress Bar Dots */}
          <div className="px-6 pt-4 flex items-center justify-between gap-1.5">
            {TOUR_STEPS.map((step, idx) => {
              const active = idx === currentStepIndex;
              const completed = idx < currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleSelectStep(idx)}
                  className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                    active
                      ? 'bg-[#F5B942] shadow-[0_0_8px_#F5B942]'
                      : completed
                      ? 'bg-[#F5B942]/40'
                      : 'bg-white/15'
                  }`}
                  title={t(step.titleEn, step.titleFa)}
                />
              );
            })}
          </div>

          {/* Active Step Content */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center shadow-inner">
                {currentStep.icon}
              </div>
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-[#00F0FF]">
                  {t(currentStep.badgeEn, currentStep.badgeFa)}
                </span>
                <h4 className="text-lg font-bold text-[#F5F7FA]">
                  {t(currentStep.titleEn, currentStep.titleFa)}
                </h4>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              {t(currentStep.descriptionEn, currentStep.descriptionFa)}
            </p>

            {/* Bullet Highlights */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              {(lang === 'fa' ? currentStep.highlightDetailsFa : currentStep.highlightDetailsEn).map(
                (detail, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-[#94A3B8]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#F5B942] shrink-0" />
                    <span>{detail}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Navigation Controls Footer */}
          <div className="p-4 px-6 bg-[#060810]/70 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isFirst
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t('Previous', 'مرحله قبل')}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-3.5 text-xs text-[#A3AEC2] hover:text-white transition-colors cursor-pointer"
              >
                {t('Skip Tour', 'رد شدن')}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="min-h-[40px] px-5 rounded-xl bg-gradient-to-r from-[#F5B942] to-[#E5A832] text-[#060810] text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[#F5B942]/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <span>{isLast ? t('Start Watching', 'شروع تماشا') : t('Next Step', 'مرحله بعد')}</span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
