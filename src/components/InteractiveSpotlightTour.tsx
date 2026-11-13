import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Eye,
  CheckCircle2,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { LanguageCode, PrototypeRoute } from '../prototype/types';
import { useT } from '../prototype/i18n';

export interface SpotlightStep {
  id: string;
  selector: string;
  route?: PrototypeRoute;
  badgeEn: string;
  badgeFa: string;
  titleEn: string;
  titleFa: string;
  descriptionEn: string;
  descriptionFa: string;
  preferredPosition?: 'top' | 'bottom' | 'auto';
}

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: 'brand',
    selector: '#tour-step-brand',
    route: 'universe',
    badgeEn: 'Cinema Brand',
    badgeFa: 'برند سینما',
    titleEn: 'ai petros & Petros Cinema',
    titleFa: 'سینمای هوش مصنوعی پتروس',
    descriptionEn:
      'Welcome to ai petros. This is your autonomous streaming cinema. All encoding, 4K bitrate selection, and recommendations are driven in the background by AI.',
    descriptionFa:
      'به پلتفرم پخش فیلم ai petros خوش آمدید. تمامی تصمیمات، انتخاب کیفیت 4K، ریتم و دسته‌بندی‌ها به طور خودکار توسط هوش مصنوعی در پس‌زمینه هدایت می‌شوند.',
    preferredPosition: 'bottom'
  },
  {
    id: 'tutorial-btn',
    selector: '#tour-step-tutorial',
    route: 'universe',
    badgeEn: 'Interactive Tour',
    badgeFa: 'راهنمای هوشمند',
    titleEn: 'Live Walkthrough Guide',
    titleFa: 'دکمه آموزش و معرفی زنده',
    descriptionEn:
      'Tap this button anytime to launch this interactive spotlight walkthrough and explore newly added capabilities.',
    descriptionFa:
      'در هر زمان با لمس این دکمه می‌توانید راهنمای زنده و متحرک بخش‌های مختلف را مشاهده کنید.',
    preferredPosition: 'bottom'
  },
  {
    id: 'lang-btn',
    selector: '#tour-step-lang',
    route: 'universe',
    badgeEn: 'Global Languages',
    badgeFa: 'زبان‌های بین‌المللی',
    titleEn: 'Instant Language Switching',
    titleFa: 'تغییر سریع زبان برنامه',
    descriptionEn:
      'Toggle seamlessly between English, Persian, and global languages with a single touch. All film synopses and metadata adapt instantly.',
    descriptionFa:
      'با یک لمس ساده بین زبان انگلیسی، فارسی و سایر زبان‌های دنیا جابجا شوید؛ عناوین و خلاصه‌ها بلافاصله تطبیق می‌یابند.',
    preferredPosition: 'bottom'
  },
  {
    id: 'cinema-feed',
    selector: '#tour-step-cinema-hero',
    route: 'universe',
    badgeEn: 'Living Stream',
    badgeFa: 'سالن استریم زنده',
    titleEn: 'AI Living Cinema Feed',
    titleFa: 'استریم زنده و دسته‌بندی هوشمند',
    descriptionEn:
      'The primary cinema stage. Watch curated 4K HDR films, continuous broadcast streams, and personalized cinema picks without manual setup.',
    descriptionFa:
      'صحنه اصلی سینما پتروس. فیلم‌های باکیفیت 4K HDR و استریم‌های پخش مداوم به صورت زنده و خودکار در این بخش قرار می‌گیرند.',
    preferredPosition: 'top'
  },
  {
    id: 'top10-carousel',
    selector: '#tour-step-top10',
    route: 'search',
    badgeEn: 'Netflix Style',
    badgeFa: 'سبک نت‌فلیکس',
    titleEn: 'Top 10 Trending Worldwide',
    titleFa: '۱۰ فیلم، سریال و انیمه برتر ترند جهان',
    descriptionEn:
      'Browse the world\'s hottest 10 trending movies, series, and anime with smooth horizontal finger-swipe gestures, ranking badges, and instant play.',
    descriptionFa:
      '۱۰ اثر ترند و پرطرفدار سینما، سریال‌ها و انیمه‌های جهان را با ژست لمسی انگشت (Swipe) و نشانگرهای رتبه‌بندی به سبک نت‌فلیکس مرور کنید.',
    preferredPosition: 'bottom'
  },
  {
    id: 'nav-dock',
    selector: '#tour-step-nav',
    route: 'universe',
    badgeEn: 'Navigation',
    badgeFa: 'ناوبری پلتفرم',
    titleEn: 'Autonomous Navigation Bar',
    titleFa: 'بخش‌های اصلی و ناوبری',
    descriptionEn:
      'Switch between the Cinema Hall, 3D Spatial Cyberpunk Universe, AI Search, and your Offline Download Vault.',
    descriptionFa:
      'به آسانی میان سالن سینما، جهان سه‌بعدی سایبرنوار، جستجوی پیشرفته و کتابخانه دانلودهای آفلاین جابجا شوید.',
    preferredPosition: 'top'
  }
];

interface InteractiveSpotlightTourProps {
  isOpen: boolean;
  onClose: () => void;
  lang: LanguageCode;
  currentRoute: PrototypeRoute;
  onNavigateToTab: (route: PrototypeRoute) => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const InteractiveSpotlightTour: React.FC<InteractiveSpotlightTourProps> = ({
  isOpen,
  onClose,
  lang,
  currentRoute,
  onNavigateToTab
}) => {
  const { t } = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const isMeasuringRef = useRef(false);

  const activeStep = SPOTLIGHT_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === SPOTLIGHT_STEPS.length - 1;

  // Measure target DOM element
  const measureTarget = useCallback(() => {
    if (!isOpen || !activeStep) return;

    // Try finding the primary selector or mobile/fallback selector
    let el = document.querySelector(activeStep.selector);
    if (!el && activeStep.id === 'nav-dock') {
      // Fallback for mobile bottom dock or desktop nav
      el = document.querySelector('#tour-step-mobile-nav') || document.querySelector('#tour-step-desktop-nav');
    }

    if (el) {
      // Ensure it is visible in the viewport
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        });
        return;
      }
    }

    // Fallback centered target if element not immediately rendered
    setTargetRect({
      top: window.innerHeight / 2 - 80,
      left: Math.max(16, window.innerWidth / 2 - 160),
      width: Math.min(320, window.innerWidth - 32),
      height: 160,
      bottom: window.innerHeight / 2 + 80,
      right: window.innerWidth / 2 + 160
    });
  }, [isOpen, activeStep]);

  // Handle route change when step requires a specific tab
  useEffect(() => {
    if (!isOpen) return;

    if (activeStep?.route && activeStep.route !== currentRoute) {
      onNavigateToTab(activeStep.route);
    }

    // Short timeout to allow new screen layout to paint
    const timer = setTimeout(() => {
      measureTarget();
    }, 120);

    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isOpen, stepIndex, activeStep, currentRoute, onNavigateToTab, measureTarget]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setStepIndex((prev) => prev - 1);
    }
  };

  // Tooltip positioning logic
  const getTooltipStyle = () => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const padding = 14;
    const tooltipWidth = Math.min(360, window.innerWidth - 32);
    let top = targetRect.bottom + padding;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

    // Check bounds
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }

    // If target is too low or preferred position is top, place above target
    if (
      activeStep.preferredPosition === 'top' ||
      top + 220 > window.innerHeight
    ) {
      top = Math.max(16, targetRect.top - 230 - padding);
    }

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${tooltipWidth}px`
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto select-none">
      {/* Dark Ambient Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-[3px] transition-opacity"
      />

      {/* Animated Glowing Spotlight Halo around the target button/box */}
      {targetRect && (
        <motion.div
          layoutId="spotlight-frame"
          initial={false}
          animate={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 32
          }}
          className="absolute z-10 pointer-events-none rounded-2xl border-2 border-[#F5B942] shadow-[0_0_35px_rgba(245,185,66,0.65),inset_0_0_15px_rgba(245,185,66,0.3)] ring-4 ring-[#F5B942]/20"
        >
          {/* Animated corner beacon dots */}
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-[#00F0FF] animate-ping" />
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-[#00F0FF]" />
          <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#F5B942]" />
        </motion.div>
      )}

      {/* Floating Animated Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={getTooltipStyle()}
          className="absolute z-20 rounded-2xl bg-[#090C16]/95 border border-[#F5B942]/40 shadow-2xl shadow-[#F5B942]/15 backdrop-blur-xl p-4 sm:p-5 text-slate-100 flex flex-col gap-3"
        >
          {/* Tooltip Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/30">
                {t(activeStep.badgeEn, activeStep.badgeFa)}
              </span>
              <span className="text-[10px] font-mono text-[#A3AEC2]">
                {stepIndex + 1} / {SPOTLIGHT_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#F5B942] shrink-0" />
              <span>{t(activeStep.titleEn, activeStep.titleFa)}</span>
            </h4>
            <p className="text-xs leading-relaxed text-[#CBD5E1]">
              {t(activeStep.descriptionEn, activeStep.descriptionFa)}
            </p>
          </div>

          {/* Step Indicator Progress Dots */}
          <div className="flex items-center justify-between gap-1 pt-1">
            <div className="flex items-center gap-1">
              {SPOTLIGHT_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === stepIndex
                      ? 'w-5 bg-[#F5B942] shadow-[0_0_6px_#F5B942]'
                      : idx < stepIndex
                      ? 'w-2 bg-[#F5B942]/50'
                      : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="min-h-[32px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t('Back', 'قبلی')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="min-h-[32px] px-3.5 rounded-xl bg-[#F5B942] hover:bg-[#E5A832] text-[#060810] text-xs font-black flex items-center gap-1 shadow-md shadow-[#F5B942]/20 active:scale-95 transition-all cursor-pointer"
              >
                <span>{isLast ? t('Got It', 'متوجه شدم') : t('Next', 'بعدی')}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
