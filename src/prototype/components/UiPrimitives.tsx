import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  Download,
  EyeOff,
  HelpCircle,
  Loader2,
  Lock,
  MoreVertical,
  Play,
  RefreshCw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  WifiOff,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ExplainedRecommendation,
  FeedbackRecord,
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  UiSimulationState,
  WatchProgressEntry
} from '../types';
import { useT } from '../i18n';

export function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function generateCinemaPosterSvg(title: string, accentHex = '#D4AF37'): string {
  const safeTitle = (title || 'AI PETROS CINEMA')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
    <defs>
      <radialGradient id="bg" cx="50%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#1e180d"/>
        <stop offset="50%" stop-color="#0e0f14"/>
        <stop offset="100%" stop-color="#050508"/>
      </radialGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF0A0"/>
        <stop offset="45%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#996E0F"/>
      </linearGradient>
      <linearGradient id="borderG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.8"/>
        <stop offset="50%" stop-color="#D4AF37" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#D4AF37" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="url(#bg)"/>
    <rect x="24" y="24" width="552" height="852" rx="20" fill="none" stroke="url(#borderG)" stroke-width="2.5"/>
    <circle cx="300" cy="360" r="160" fill="none" stroke="#D4AF37" stroke-opacity="0.15" stroke-width="1.5" stroke-dasharray="8,8"/>
    <!-- Stylized Film Projector Icon -->
    <g transform="translate(255, 315)" stroke="#D4AF37" stroke-width="3" fill="none">
      <circle cx="45" cy="45" r="38" stroke-opacity="0.8"/>
      <circle cx="45" cy="45" r="14" fill="#D4AF37" fill-opacity="0.3"/>
      <line x1="45" y1="7" x2="45" y2="83" stroke-opacity="0.4"/>
      <line x1="7" y1="45" x2="83" y2="45" stroke-opacity="0.4"/>
      <line x1="18" y1="18" x2="72" y2="72" stroke-opacity="0.4"/>
      <line x1="18" y1="72" x2="72" y2="18" stroke-opacity="0.4"/>
    </g>
    <!-- Brand Header -->
    <text x="300" y="95" text-anchor="middle" fill="#D4AF37" font-family="Cinzel, serif" font-size="18" letter-spacing="7" font-weight="bold">AI PETROS CINEMA</text>
    <text x="300" y="125" text-anchor="middle" fill="#A3AEC2" font-family="sans-serif" font-size="12" letter-spacing="3" opacity="0.8">VIP 4K ULTRA STREAM</text>
    <!-- Movie Title -->
    <text x="300" y="580" text-anchor="middle" fill="url(#gold)" font-family="Vazirmatn, sans-serif" font-size="34" font-weight="bold">${safeTitle}</text>
    <text x="300" y="625" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="14" letter-spacing="3" opacity="0.85">CINEMATIC PREMIERE</text>
    <!-- Badge -->
    <rect x="220" y="740" width="160" height="38" rx="19" fill="#D4AF37" fill-opacity="0.16" stroke="#D4AF37" stroke-width="1.5"/>
    <text x="300" y="765" text-anchor="middle" fill="#D4AF37" font-family="sans-serif" font-size="14" font-weight="bold">★ 8.5 IMDb • 4K</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const sizeCls =
    size === 'sm'
      ? 'min-h-[40px] px-3.5 py-1.5 text-xs gap-1.5'
      : size === 'lg'
      ? 'min-h-[48px] px-5 sm:px-6 py-3 text-sm gap-2'
      : 'min-h-[44px] px-4 sm:px-4.5 py-2 text-xs sm:text-sm gap-2';

  const variantCls =
    variant === 'primary'
      ? 'bg-[#F5B942] text-[#06070C] font-semibold shadow-[0_10px_26px_-8px_rgba(245,185,66,0.48)] hover:bg-[#fbd074]'
      : variant === 'danger'
      ? 'bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/40 hover:bg-[#EF4444]/25'
      : variant === 'ghost'
      ? 'bg-transparent text-[#A3AEC2] hover:text-[#F5F7FA] hover:bg-white/[0.06]'
      : 'liquid-glass-pill text-[#F5F7FA] border border-white/15 hover:border-[#F5B942]/50';

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { y: 1 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070C] disabled:opacity-45 disabled:cursor-not-allowed ${sizeCls} ${variantCls} ${className}`}
      {...(rest as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.button>
  );
}

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextInput({ label, error, hint, id, className = '', ...rest }: TextInputProps) {
  const inputId = id || `inp-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-[#A3AEC2]">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full min-h-[44px] rounded-2xl border bg-[#0D101A] px-4 py-2.5 text-base sm:text-sm text-[#F5F7FA] placeholder:text-[#7A869F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942] ${
          error ? 'border-[#EF4444]' : 'border-white/12 focus:border-[#F5B942]/60'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-[#FCA5A5]">{error}</p>}
      {!error && hint && <p className="text-[11px] text-[#8E9BB3]">{hint}</p>}
    </div>
  );
}

export interface AdaptiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function AdaptiveModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-3xl'
}: AdaptiveModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#06070C]/80 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className={`relative w-full ${maxWidthClass} max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-white/12 bg-[#0D101A] shadow-[0_32px_90px_-15px_rgba(0,0,0,0.95)] pb-[env(safe-area-inset-bottom)]`}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0D101A]/95 px-5 py-4 backdrop-blur-xl">
              <div className="min-w-0">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
                <h2 className="truncate text-base sm:text-lg font-semibold text-[#F5F7FA]">{title}</h2>
                {subtitle && <p className="truncate text-xs text-[#A3AEC2]">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#A3AEC2] hover:text-[#F5F7FA] hover:border-white/30 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 sm:p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface MediaCardProps {
  recommendation: ExplainedRecommendation;
  lang: LanguageCode;
  isFavorite: boolean;
  downloadRecord?: OfflineDownloadRecord;
  progress?: WatchProgressEntry;
  feedback?: FeedbackRecord;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onFeedback: (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => void;
  onHide: (item: PrototypeMediaItem) => void;
}

export function cleanCinemaTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^Telegram\s+Cinema\s+Post\s*#?(\d+)/i, 'Featured Cinema Stream #$1')
    .replace(/^پست\s+سینمایی\s+تلگرام\s*#?(\d+)/i, 'اکران ویژه پتروس #$1')
    .replace(/\[Telegram\/.*?\]/gi, '')
    .trim();
}

export function MediaCard({
  recommendation,
  isFavorite,
  downloadRecord,
  progress,
  feedback,
  onOpenDetail,
  onPlay,
  onDownload,
  onToggleFavorite,
  onFeedback,
  onHide
}: MediaCardProps) {
  const { t } = useT();
  const { item, score, reasonFa, reasonEn } = recommendation;
  const [imgError, setImgError] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isHoldingPreview, setIsHoldingPreview] = useState(false);

  const rawTitle = t(item.titleEn, item.titleFa);
  const title = cleanCinemaTitle(rawTitle);
  const category = t(item.categoryEn, item.categoryFa);
  const creator = item.creatorEn || item.creatorFa ? t(item.creatorEn || item.creatorFa || '', item.creatorFa) : '';
  const reason = t(reasonEn, reasonFa);
  const synopsis = t(item.synopsisEn, item.synopsisFa);
  const progressPct =
    progress && progress.durationSec > 0
      ? Math.min(100, Math.round((progress.positionSec / progress.durationSec) * 100))
      : 0;

  const isDownloading = downloadRecord?.status === 'downloading';
  const isDownloaded = downloadRecord?.status === 'completed';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-[24px] border border-[rgba(212,175,55,0.22)] bg-[#0B0C10] shadow-[0_8px_32px_rgba(0,0,0,0.85)] transition-all duration-300 hover:border-[#D4AF37]/75 hover:shadow-[0_16px_48px_rgba(212,175,55,0.22)]"
      onMouseLeave={() => {
        setMenuOpen(false);
        setIsHoldingPreview(false);
      }}
    >
      {/* Visual Frame — Press & Hold for kinetic atmosphere preview (Zero scale/zoom!) */}
      <div
        className="relative aspect-[16/10] w-full overflow-hidden bg-[#050508] select-none cursor-pointer"
        onClick={() => onPlay(item)}
        onPointerDown={() => setIsHoldingPreview(true)}
        onPointerUp={() => setIsHoldingPreview(false)}
        onPointerCancel={() => setIsHoldingPreview(false)}
      >
        <img
          src={!imgError && item.posterUrl ? item.posterUrl : generateCinemaPosterSvg(title, item.accentHex)}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`h-full w-full object-cover transition-all duration-500 ${
            isHoldingPreview ? 'brightness-110 saturate-110' : 'brightness-95 group-hover:brightness-105'
          }`}
        />

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
            isHoldingPreview
              ? 'bg-gradient-to-t from-[#050508]/95 via-[#050508]/25 to-transparent opacity-100'
              : 'bg-gradient-to-t from-[#050508]/90 via-transparent to-[#050508]/40'
          }`}
        />

        {/* Hold Preview Animated Caption */}
        <AnimatePresence>
          {isHoldingPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-[#050508]/90 px-3 py-2 backdrop-blur-md border border-[rgba(212,175,55,0.4)]"
            >
              <p className="text-[11px] font-cinzel font-bold text-[#D4AF37]">
                {t('Motion scene preview...', 'پیش‌نمایش صحنه انتخابی...')}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[#F5F7FA]">{synopsis}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Row: Clean Action Controls */}
        <div
          className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            dir="ltr"
            className="rounded-full bg-[#050508]/85 border border-[rgba(212,175,55,0.3)] px-3 py-1 text-[11px] font-mono font-bold text-[#D4AF37] backdrop-blur-md shadow-sm"
          >
            {score}% {t('Match', 'تطابق')}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDownload(item)}
              aria-label={t('Download for offline', 'دانلود برای تماشای آفلاین')}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full backdrop-blur-md transition-colors cursor-pointer px-2 gap-1 ${
                isDownloaded
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : isDownloading
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'bg-[#050508]/80 text-[#F5F7FA] border border-white/10 hover:border-[#D4AF37]/50'
              }`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4AF37]" />
                  <span dir="ltr" className="text-[10px] font-mono-tabular text-[#D4AF37]">
                    {downloadRecord.progressPct}%
                  </span>
                </>
              ) : isDownloaded ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              aria-label={t('Bookmark', 'ذخیره در علاقه‌مندی‌ها')}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#D4AF37] text-[#050508] shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                  : 'bg-[#050508]/80 text-[#F5F7FA] border border-white/10 hover:border-[#D4AF37]/50'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={t('More options', 'گزینه‌های بیشتر')}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full bg-[#050508]/80 text-[#F5F7FA] border border-white/10 backdrop-blur-md hover:border-[#D4AF37]/50 transition-colors cursor-pointer"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute end-0 top-10 z-30 w-44 rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#0B0C10]/95 p-1.5 shadow-2xl backdrop-blur-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onFeedback(item, 'like');
                        setMenuOpen(false);
                      }}
                      className={`w-full min-h-[38px] flex items-center gap-2 rounded-xl px-3 text-xs text-start transition-colors cursor-pointer ${
                        feedback?.sentiment === 'like'
                          ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                          : 'text-[#F5F7FA] hover:bg-white/[0.06]'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('More like this', 'مشابه این بیشتر')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onFeedback(item, 'less_like_this');
                        setMenuOpen(false);
                      }}
                      className={`w-full min-h-[38px] flex items-center gap-2 rounded-xl px-3 text-xs text-start transition-colors cursor-pointer ${
                        feedback?.sentiment === 'less_like_this'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'text-[#A3AEC2] hover:bg-white/[0.06] hover:text-[#F5F7FA]'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('Less like this', 'کمتر از این سبک')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDownload(item);
                        setMenuOpen(false);
                      }}
                      className="w-full min-h-[38px] flex items-center gap-2 rounded-xl px-3 text-xs text-start text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('Download Offline', 'دانلود و ذخیره فایل')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onHide(item);
                        setMenuOpen(false);
                      }}
                      className="w-full min-h-[38px] flex items-center gap-2 rounded-xl px-3 text-xs text-start text-[#FCA5A5] hover:bg-[#EF4444]/15 transition-colors cursor-pointer"
                    >
                      <EyeOff className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('Hide this item', 'عدم نمایش این مورد')}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Floating Gold Play Trigger Button on Corner */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(item);
          }}
          aria-label={`${t('Play', 'پخش')} ${title}`}
          className="absolute bottom-3 end-3 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] shadow-[0_0_20px_rgba(212,175,55,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current stroke-[2]" />
        </button>

        {/* Resume Progress Track */}
        {progressPct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/15">
            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5B942]" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 gap-3 bg-[#0B0C10]">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onPlay(item)}
            className="text-start w-full text-sm sm:text-base font-cinzel font-bold tracking-wide text-[#F5F7FA] hover:text-[#D4AF37] transition-colors line-clamp-1 cursor-pointer"
          >
            {title}
          </button>

          <div className="flex items-center gap-2 text-xs text-[#A3AEC2]">
            <span className="px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.25)] font-mono text-[10px] font-bold">
              {item.quality || '1080p'}
            </span>
            <span className="font-mono-tabular">
              {formatDuration(item.durationSec)}
            </span>
            <span>·</span>
            <span className="truncate">{category}</span>
            {creator ? <span className="hidden sm:inline">· {creator}</span> : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[rgba(212,175,55,0.12)]">
          <button
            type="button"
            onClick={() => setShowWhy((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A3AEC2] hover:text-[#D4AF37] transition-colors cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
            <span>{t('Why this?', 'چرا پیشنهاد شد؟')}</span>
          </button>
          <button
            type="button"
            onClick={() => onPlay(item)}
            className="text-[11px] font-cinzel font-semibold text-[#D4AF37] hover:underline cursor-pointer tracking-wider"
          >
            {t('Details & Dossier', 'شناسنامه و پخش')}
          </button>
        </div>

        <AnimatePresence>
          {showWhy && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-xl bg-[#050508] border border-[rgba(212,175,55,0.2)] px-3 py-2 text-[11px] leading-relaxed text-[#D2DAE8]"
            >
              {reason}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export interface StateBoundaryProps {
  uiState: UiSimulationState;
  lang: LanguageCode;
  onRetry: () => void;
  onResetFilters?: () => void;
  onOpenDownloads?: () => void;
  children: React.ReactNode;
}

export function StateBoundary({
  uiState,
  onRetry,
  onResetFilters,
  onOpenDownloads,
  children
}: StateBoundaryProps) {
  const { t } = useT();

  if (uiState === 'normal') return <>{children}</>;

  if (uiState === 'loading') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 py-4" aria-busy="true">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="rounded-[22px] border border-white/10 bg-[#0D101A] overflow-hidden">
            <div className="aspect-[16/10] w-full poster-skeleton-shimmer" />
            <div className="p-4 space-y-2.5">
              <div className="h-4 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (uiState === 'slow_network') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F5B942]/30 bg-[#F5B942]/10 px-4 py-3 text-xs text-[#F5F7FA]">
          <span>
            {t(
              'Slow network detected — streaming and assets stepped down to Lite Mode.',
              'اتصال کند شناسایی شد — پخش و تصاویر با کیفیت سبک‌سازی‌شده بارگذاری می‌شوند.'
            )}
          </span>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t('Restore Full Quality', 'بازگشت به حالت عادی')}
          </Button>
        </div>
        {children}
      </div>
    );
  }

  if (uiState === 'partial_failure') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
            <span>
              {t(
                'Some secondary shelves are unavailable; your personal feeds remain active.',
                'بخشی از فیدهای فرعی موقتاً در دسترس نیست؛ جهان شخصی شما بدون اختلال فعال است.'
              )}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Retry', 'تلاش مجدد')}
          </Button>
        </div>
        {children}
      </div>
    );
  }

  const stateCopy: Record<
    Exclude<UiSimulationState, 'normal' | 'loading' | 'slow_network' | 'partial_failure'>,
    { icon: React.ReactNode; titleEn: string; titleFa: string; descEn: string; descFa: string }
  > = {
    empty: {
      icon: <HelpCircle className="h-7 w-7 text-[#F5B942]" />,
      titleEn: 'Nothing here yet',
      titleFa: 'این بخش هنوز خالی است',
      descEn: 'Explore the universe or tune preferences to populate this space.',
      descFa: 'با کاوش در جهان محتوا یا تنظیم علاقه‌مندی‌ها، پیشنهادهای دقیق اینجا ظاهر می‌شوند.'
    },
    error: {
      icon: <AlertTriangle className="h-7 w-7 text-[#FCA5A5]" />,
      titleEn: 'Unable to load stream catalog',
      titleFa: 'خطا در دریافت داده‌های محتوا',
      descEn: 'A temporary connection error occurred. Your local data remains safely preserved.',
      descFa: 'خطای موقت در پاسخگویی سرویس رخ داد. داده‌های محلی شما محفوظ هستند.'
    },
    offline: {
      icon: <WifiOff className="h-7 w-7 text-[#38BDF8]" />,
      titleEn: 'You are currently offline',
      titleFa: 'اتصال اینترنت قطع است',
      descEn: 'Live streaming is paused while offline, though your downloaded items remain playable.',
      descFa: 'پخش آنلاین موقتاً متوقف شده اما فایل‌های دانلودشده و تاریخچه در حافظه برنامه در دسترس‌اند.'
    },
    no_results: {
      icon: <HelpCircle className="h-7 w-7 text-[#A3AEC2]" />,
      titleEn: 'No matching results found',
      titleFa: 'نتیجه‌ای با این فیلترها پیدا نشد',
      descEn: 'Relax duration, quality, or blocked-tag constraints to expand results.',
      descFa: 'فیلترهای مدت‌زمان، کیفیت یا موضوعات مسدودشده را بازبینی کنید تا جهان بازتر شود.'
    }
  };

  const info = stateCopy[uiState];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="my-8 mx-auto max-w-xl rounded-[28px] border border-white/12 bg-[#0D101A] p-6 sm:p-8 text-center space-y-4"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05] border border-white/10">
        {info.icon}
      </div>
      <h3 className="text-lg font-semibold text-[#F5F7FA]">{t(info.titleEn, info.titleFa)}</h3>
      <p className="text-sm text-[#A3AEC2] leading-relaxed">{t(info.descEn, info.descFa)}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {t('Retry', 'تلاش مجدد')}
        </Button>
        {uiState === 'offline' && onOpenDownloads && (
          <Button variant="secondary" onClick={onOpenDownloads}>
            <Download className="h-4 w-4" />
            {t('Open Offline Downloads', 'تماشای دانلودهای آفلاین')}
          </Button>
        )}
        {uiState === 'no_results' && onResetFilters && (
          <Button variant="secondary" onClick={onResetFilters}>
            {t('Reset Filters', 'پاک کردن فیلترها')}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export interface ToastMessage {
  id: string;
  text: string;
  undoLabel?: string;
  onUndo?: () => void;
}

export function ToastBanner({
  toast,
  onDismiss
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6 start-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#F5B942]/40 bg-[#0D101A]/95 px-4 py-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3"
        >
          <p className="text-xs sm:text-sm text-[#F5F7FA]">{toast.text}</p>
          <div className="flex items-center gap-2 shrink-0">
            {toast.onUndo && toast.undoLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onUndo?.();
                  onDismiss();
                }}
                className="min-h-[34px] rounded-full bg-[#F5B942] px-3 text-xs font-semibold text-[#06070C] cursor-pointer"
              >
                {toast.undoLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-full text-[#A3AEC2] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
