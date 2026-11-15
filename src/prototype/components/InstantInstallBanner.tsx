import React, { useEffect, useState } from 'react';
import { Download, Tv, X, Sparkles, Smartphone, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useT } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstantInstallBanner() {
  const { t } = useT();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const dismissed = sessionStorage.getItem('petros_pwa_dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If mobile or TV, show banner after 4 seconds
    const timer = setTimeout(() => {
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && !isStandalone && !sessionStorage.getItem('petros_pwa_dismissed')) {
        setIsVisible(true);
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS Safari instructions
      alert(
        t(
          'To install on iPhone or iPad: tap the Share icon at the bottom of Safari, then select "Add to Home Screen".',
          'برای نصب روی آیفون: در پایین صفحه سافاری دکمه اشتراک‌گذاری (Share) را بزنید و گزینه «Add to Home Screen» را انتخاب کنید.'
        )
      );
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('petros_pwa_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible || isInstalled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="fixed bottom-20 md:bottom-6 start-4 end-4 md:start-auto md:end-6 md:max-w-md z-50 pointer-events-auto"
      >
        <div className="p-3.5 sm:p-4 rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[#0B0C10]/95 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.92),0_0_20px_rgba(212,175,55,0.15)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#D4AF37] shrink-0 shadow-[0_0_12px_rgba(212,175,55,0.2)]">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel text-xs font-bold text-[#D4AF37] truncate">
                  AI PETROS NATIVE PWA
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[rgba(212,175,55,0.15)] text-[#D4AF37]">
                  FAST
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {t('Add to Home Screen in 2s (TV & Mobile)', 'نصب فوری در ۲ ثانیه روی گوشی و تلویزیون')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="h-8 px-3 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('Install', 'نصب')}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[#A3AEC2] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
