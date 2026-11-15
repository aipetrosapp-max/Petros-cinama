import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Smartphone,
  Laptop,
  Tv,
  Globe,
  Sparkles,
  Play,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
  Layers,
  ArrowRight,
  Film,
  Monitor,
  Wifi,
  ExternalLink,
  Flame,
  Radio,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlatformInfo {
  id: string;
  name: string;
  nameFa: string;
  category: 'mobile' | 'desktop' | 'tv' | 'web';
  icon: React.ElementType;
  badge: string;
  version: string;
  size: string;
  downloadUrl: string;
  descriptionFa: string;
  instructionsFa: string;
  directDownload: boolean;
}

export interface AipetrosLandingProps {
  onEnterCinema: () => void;
}

export const AipetrosLandingScreen: React.FC<AipetrosLandingProps> = ({ onEnterCinema }) => {
  const [detectedPlatformId, setDetectedPlatformId] = useState<string>('web');
  const [downloadModalPlatform, setDownloadModalPlatform] = useState<PlatformInfo | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // 1. Intelligent OS & Device Detection Engine (like Spotify/Discord/Telegram)
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    let detected = 'web';

    if (/android/i.test(ua)) {
      if (/tv|smarttv|googletv|android tv|large screen/i.test(ua)) {
        detected = 'android-tv';
      } else {
        detected = 'android';
      }
    } else if (/ipad|iphone|ipod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) {
      detected = 'ios';
    } else if (/win/i.test(platform) || /windows/i.test(ua)) {
      detected = 'windows';
    } else if (/mac/i.test(platform) || /macintosh/i.test(ua)) {
      detected = 'macos';
    } else if (/smart-tv|tizen|webos|appletv/i.test(ua)) {
      detected = 'smart-tv';
    }

    setDetectedPlatformId(detected);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Multi-Platform Specifications with Direct Download Assets
  const platforms: PlatformInfo[] = useMemo(() => [
    {
      id: 'android',
      name: 'Android Mobile',
      nameFa: 'نسخه اندروید موبایل و تبلت',
      category: 'mobile',
      icon: Smartphone,
      badge: 'نسخه رسمی APK',
      version: 'v2.4.0',
      size: '18.4 MB',
      downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-Cinema.apk',
      descriptionFa: 'دانلود مستقیم فایل نصبی APK با قابلیت پخش 4K، دانلود درون‌برنامه‌ای و بدون نیاز به گوگل‌پلی.',
      instructionsFa: 'فایل APK را دانلود کنید و در مدیریت فایل گوشی روی آن بزنید و Install را انتخاب فرمایید.',
      directDownload: true
    },
    {
      id: 'android-tv',
      name: 'Android TV / Box',
      nameFa: 'نسخه تلویزیون هوشمند (Android TV)',
      category: 'tv',
      icon: Tv,
      badge: 'مخصوص تلویزیون و اندروید باکس',
      version: 'v2.4.0-tv',
      size: '22.1 MB',
      downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-AndroidTV.apk',
      descriptionFa: 'سازگار کامل با ریموت کنترل تلویزیون (D-Pad)، تصویر فوق عریض 4K HDR و صدای دالبی سینمایی.',
      instructionsFa: 'فایل را از طریق فلش مموری یا برنامه Send Files to TV روی تلویزیون نصب فرمایید.',
      directDownload: true
    },
    {
      id: 'windows',
      name: 'Windows Desktop',
      nameFa: 'نسخه دسکتاپ ویندوز (10 / 11)',
      category: 'desktop',
      icon: Laptop,
      badge: 'نسخه 64 بیتی پرسرعت',
      version: 'v2.4.0',
      size: '64.5 MB',
      downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-Cinema-Windows-x64.exe',
      descriptionFa: 'اپلیکیشن مستقل دسکتاپ ویندوز با پشتیبانی از شتاب‌دهنده گرافیکی GPU و کلیدهای میانبر سینمایی.',
      instructionsFa: 'فایل EXE را دانلود و اجرا فرمایید. نصب در چند ثانیه به صورت خودکار انجام می‌شود.',
      directDownload: true
    },
    {
      id: 'ios',
      name: 'iOS / iPhone & iPad',
      nameFa: 'نسخه آیفون و آیپد (PWA App)',
      category: 'mobile',
      icon: Smartphone,
      badge: 'بدون نیاز به اپ‌استور',
      version: 'v2.4.0 (WebPWA)',
      size: 'سبک و ابری (بدون پر کردن حافظه)',
      downloadUrl: '#ios-install',
      descriptionFa: 'اپلیکیشن نیتیو فوق‌العاده نرم با پشتیبانی کامل از حالت تمام صفحه، بدون نیاز به تحریم‌شکن یا جیلبریک.',
      instructionsFa: 'سایت را در مرورگر Safari باز کنید، دکمه Share (مربع با فلش رو به بالا) را بزنید و سپس "Add to Home Screen" را انتخاب کنید.',
      directDownload: false
    },
    {
      id: 'macos',
      name: 'macOS (Apple Silicon & Intel)',
      nameFa: 'نسخه مک‌او‌اس اپل',
      category: 'desktop',
      icon: Laptop,
      badge: 'Universal App',
      version: 'v2.4.0',
      size: '58.2 MB',
      downloadUrl: 'https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/Aipetros-Cinema-macOS.dmg',
      descriptionFa: 'عملکرد بهینه برای پردازنده‌های سری M اپل و مک‌های اینتل با وضوح رتینا (Retina Display).',
      instructionsFa: 'فایل DMG را دانلود کرده و آیکون Aipetros را به پوشه Applications بکشید.',
      directDownload: true
    },
    {
      id: 'web',
      name: 'Web Cinema (Browser)',
      nameFa: 'نسخه تحت وب آنلاین',
      category: 'web',
      icon: Globe,
      badge: 'بدون نیاز به نصب فایل',
      version: 'Cloud Edge',
      size: 'آنلاین',
      downloadUrl: '#launch',
      descriptionFa: 'ورود مستقیم و آنی به سینما از هر مرورگری روی هر سیستمی (کروم، فایرفاکس، سافاری، اج).',
      instructionsFa: 'با فشردن دکمه ورود، سینما مستقیماً در مرورگر شما با بالاترین سرعت بارگذاری می‌شود.',
      directDownload: false
    }
  ], []);

  const recommendedPlatform = useMemo(() => {
    return platforms.find((p) => p.id === detectedPlatformId) || platforms[0];
  }, [detectedPlatformId, platforms]);

  const handleDownloadClick = (platform: PlatformInfo) => {
    if (platform.id === 'web') {
      onEnterCinema();
      return;
    }
    if (platform.directDownload) {
      // Trigger direct download
      const a = document.createElement('a');
      a.href = platform.downloadUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setDownloadModalPlatform(platform);
  };

  const scrollToDownloads = () => {
    const el = document.getElementById('platforms-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white selection:bg-cyan-500 selection:text-black font-sans relative overflow-x-hidden" dir="rtl">
      {/* Background Ambient Glows & Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-cyan-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] bg-indigo-600/15 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* Floating Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#060913]/85 backdrop-blur-xl border-b border-cyan-500/20 py-3 shadow-2xl shadow-cyan-950/30'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#080d1a] rounded-xl flex items-center justify-center">
                <Film className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
                  AIPETROS
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  CINEMA
                </span>
              </div>
              <p className="text-[10px] text-gray-400 tracking-wide font-mono">NEXT-GEN STREAMING ARCHIVE</p>
            </div>
          </div>

          {/* Quick Links & CTA Button: aipetros-cinema */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={scrollToDownloads}
              className="hidden sm:inline-flex items-center gap-2 text-sm text-gray-300 hover:text-cyan-400 transition-colors px-3 py-2"
            >
              <Download className="w-4 h-4" />
              <span>پلتفرم‌ها و دانلود</span>
            </button>

            {/* Special Highlighted CTA: aipetros-cinema */}
            <button
              onClick={onEnterCinema}
              id="aipetros-cinema-btn"
              className="relative group overflow-hidden rounded-xl px-4 sm:px-6 py-2.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 text-black font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Play className="w-4 h-4 fill-black text-black" />
                <span>aipetros-cinema</span>
              </span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Live Smart Auto-Suggest */}
      <section className="relative z-10 pt-32 pb-20 md:pt-40 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Status Pill */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono shadow-inner mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>v2.4.0 MULTI-PLATFORM UNIVERSE • بدون فیلتر و بدون تبلیغات</span>
        </motion.div>

        {/* Big Catchy Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-tight md:leading-none max-w-5xl mx-auto"
        >
          سینمای بی‌پایان، با کیفیت{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
            4K واقعی
          </span>
          <br />
          برای تمام دستگاه‌های شما
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
        >
          پلتفرم استریم و دانلود مستقیم فیلم، سریال و انیمه‌های روز دنیا با سرعت ابری، بدون نیاز به اشتراک، کاملاً رایگان و مجهز به سوئیچ هوشمند کیفیت‌ها و زیرنویس فارسی هماهنگ.
        </motion.p>

        {/* SMART DEVICE AUTO-SUGGEST HERO BOX (Inspired by Spotify / Telegram / Discord) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 max-w-2xl mx-auto rounded-3xl p-1 bg-gradient-to-b from-cyan-500/40 via-indigo-500/20 to-transparent shadow-2xl shadow-cyan-950/50"
        >
          <div className="bg-[#0b1122]/95 backdrop-blur-2xl rounded-[22px] p-6 sm:p-8 border border-cyan-500/20 text-right">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <recommendedPlatform.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      تشخیص خودکار دستگاه شما
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{recommendedPlatform.version}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {recommendedPlatform.nameFa}
                  </h3>
                </div>
              </div>
              <div className="text-left font-mono text-xs text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-800/40">
                حجم: {recommendedPlatform.size}
              </div>
            </div>

            <p className="text-sm text-gray-300 mt-4 leading-relaxed">
              {recommendedPlatform.descriptionFa}
            </p>

            {/* Action Buttons for Auto-Suggested Platform */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => handleDownloadClick(recommendedPlatform)}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 text-black font-extrabold text-sm sm:text-base tracking-wide shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {recommendedPlatform.directDownload
                    ? `دانلود مستقیم برای دستگاه شما (${recommendedPlatform.name})`
                    : `اجرای مستقیم در دستگاه شما`}
                </span>
              </button>

              <button
                onClick={onEnterCinema}
                className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>ورود آنلاین به وب‌سینما</span>
              </button>
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید شده و امن بدون ویروس و تبلیغات</span>
              </span>
              <button
                onClick={scrollToDownloads}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 flex items-center gap-1"
              >
                <span>مشاهده سایر پلتفرم‌ها</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* MULTI-PLATFORM DIRECT DOWNLOADS GRID */}
      <section id="platforms-section" className="relative z-10 py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>یک اکانت، همه دیوایس‌ها</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            دانلود مستقیم پلتفرم‌های <span className="text-cyan-400">aipetros-cinema</span>
          </h2>
          <p className="mt-3 text-gray-400 text-sm sm:text-base">
            تمامی نسخه‌ها به صورت مستقیم، بدون واسطه و با حداکثر پهنای باند آماده دریافت هستند.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform) => {
            const isCurrent = platform.id === detectedPlatformId;
            const Icon = platform.icon;

            return (
              <motion.div
                key={platform.id}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
                className={`relative rounded-2xl p-6 transition-all border ${
                  isCurrent
                    ? 'bg-[#0c1326] border-cyan-400/50 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                    : 'bg-[#090e1c]/80 border-white/10 hover:border-cyan-500/30 hover:bg-[#0b1224]'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isCurrent && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-black animate-pulse">
                        دستگاه فعلی شما
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      {platform.version}
                    </span>
                  </div>
                </div>

                {/* Title & Desc */}
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{platform.nameFa}</span>
                </h3>
                <p className="text-xs text-cyan-400 font-mono mt-0.5">{platform.badge}</p>
                <p className="text-xs text-gray-300 mt-3 leading-relaxed min-h-[48px]">
                  {platform.descriptionFa}
                </p>

                {/* Footer Download CTA */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-mono text-gray-400">
                    حجم: <span className="text-gray-200">{platform.size}</span>
                  </div>

                  <button
                    onClick={() => handleDownloadClick(platform)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      isCurrent
                        ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 text-black hover:opacity-90 shadow-md shadow-cyan-500/20'
                        : 'bg-white/10 text-white hover:bg-cyan-500 hover:text-black'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{platform.directDownload ? 'دانلود مستقیم' : 'دریافت'}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CORE SUPERPOWERS / FEATURE SHOWCASE */}
      <section className="relative z-10 py-16 bg-[#04060d]/80 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-all">
              <Zap className="w-8 h-8 text-cyan-400 mb-3" />
              <h4 className="text-base font-bold text-white">کیفیت 4K و 1080p واقعی</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                استریم‌های واقعی با بیت‌ریت گیگابایتی، تفکیک کیفیت‌های 480p تا 4K و حفظ دقیقه در زمان تعویض کیفیت.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-all">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3" />
              <h4 className="text-base font-bold text-white">ضد هک و بدون ردگیری</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                معماری سرورلس استاتیک توزیع‌شده بر روی شبکه ابری Anycast کلودفلر، بدون دیتابیس آسیب‌پذیر و با SSL خودکار.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-all">
              <Sparkles className="w-8 h-8 text-indigo-400 mb-3" />
              <h4 className="text-base font-bold text-white">زیرنویس هوشمند + دانلود SRT</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                پشتیبانی از فرمت استاندارد WebVTT، همگام‌ساز تاخیر زیرنویس و امکان دانلود مستقیم فایل SRT برای هر اثر.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-all">
              <Radio className="w-8 h-8 text-sky-400 mb-3" />
              <h4 className="text-base font-bold text-white">آپدیت خودکار بدون نصب مجدد</h4>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                سرویس‌ورکر هوشمند با قابلیت SkipWaiting و اعمال لحظه‌ای نسخه‌های جدید گیت‌هاب بدون نیاز به پاک کردن کش.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-bold text-white">AIPETROS CINEMA • پتروس سینما</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>وضعیت سرورها: <strong className="text-emerald-400">۱۰۰٪ آنلاین و پایدار</strong></span>
          <span>•</span>
          <a
            href="https://t.me/Aipetros"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>کانال تلگرام: @Aipetros</span>
          </a>
        </div>

        <p className="text-[11px] text-gray-500 font-mono">
          © 2026 AIPETROS. All Rights Reserved.
        </p>
      </footer>

      {/* INSTRUCTIONS MODAL (e.g. for iOS or APK guidance) */}
      <AnimatePresence>
        {downloadModalPlatform && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c1326] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 text-right shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <downloadModalPlatform.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">{downloadModalPlatform.nameFa}</h3>
                </div>
                <button
                  onClick={() => setDownloadModalPlatform(null)}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  {downloadModalPlatform.instructionsFa}
                </p>

                {downloadModalPlatform.directDownload && (
                  <div className="p-3 bg-cyan-950/40 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 flex items-center justify-between">
                    <span>فایل آماده دریافت مستقیم:</span>
                    <a
                      href={downloadModalPlatform.downloadUrl}
                      className="px-3 py-1.5 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود فایل</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setDownloadModalPlatform(null);
                    onEnterCinema();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-black font-bold text-xs"
                >
                  ورود مستقیم به سینما
                </button>
                <button
                  onClick={() => setDownloadModalPlatform(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/15"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
