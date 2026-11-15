import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Clapperboard,
  Cpu,
  Download,
  ExternalLink,
  EyeOff,
  Film,
  Flag,
  FolderPlus,
  Globe2,
  HardDriveDownload,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  FeedbackRecord,
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  UserCollection,
  WatchProgressEntry
} from '../types';
import { cosineSimilarity6D } from '../tasteEngine';
import {
  fetchBackendFilmDetails,
  pickRandomCardinalEntrances,
  type BackendFilmDetailsResponse,
  type BackendStreamQuality
} from '../filmDetailsClient';
import { useT } from '../i18n';
import { AdaptiveModal, Button, formatDuration, cleanCinemaTitle } from '../components/UiPrimitives';
import { FilmScreeningDossier } from '../components/FilmScreeningDossier';

export type ContentFeedbackIssueReason = 'broken_link' | 'quality_issue' | 'not_interested' | 'other';

interface ContentDetailModalProps {
  item: PrototypeMediaItem | null;
  catalog: PrototypeMediaItem[];
  lang: LanguageCode;
  isFavorite: boolean;
  downloadRecord?: OfflineDownloadRecord;
  progress?: WatchProgressEntry;
  feedback?: FeedbackRecord;
  collections: UserCollection[];
  onClose: () => void;
  onPlay: (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => void;
  onWatchTrailer: (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => void;
  onDownload: (
    item: PrototypeMediaItem,
    saveFileToDevice?: boolean,
    selectedQuality?: BackendStreamQuality
  ) => void;
  onSelectItem: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onToggleCollectionItem: (collectionId: string, contentId: string) => void;
  onFeedback: (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => void;
  onHide: (item: PrototypeMediaItem) => void;
  onSubmitReport: (
    item: PrototypeMediaItem,
    reason: ContentFeedbackIssueReason,
    details: string
  ) => void;
  onOpenLanguagePicker: () => void;
}

export function ContentDetailModal({
  item,
  catalog,
  isFavorite,
  downloadRecord,
  progress,
  feedback,
  collections,
  onClose,
  onPlay,
  onWatchTrailer,
  onDownload,
  onSelectItem,
  onToggleFavorite,
  onToggleCollectionItem,
  onFeedback,
  onHide,
  onSubmitReport,
  onOpenLanguagePicker
}: ContentDetailModalProps) {
  const { t, lang, languageInfo, translateTexts, isTranslating } = useT();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ContentFeedbackIssueReason>('broken_link');
  const [reportDetails, setReportDetails] = useState('');

  const [details, setDetails] = useState<BackendFilmDetailsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedQualityId, setSelectedQualityId] = useState<string>('');
  const [openSeq, setOpenSeq] = useState(0);

  // Fresh random 4-direction entrance (Left, Right, Top, Bottom) every time a film opens
  const cardEntrances = useMemo(() => pickRandomCardinalEntrances(8), [item?.id, openSeq]);

  useEffect(() => {
    if (!item) {
      setDetails(null);
      setSelectedQualityId('');
      return;
    }
    setOpenSeq((s) => s + 1);
    setLoadingDetails(true);
    let active = true;

    void fetchBackendFilmDetails(item).then((res) => {
      if (!active) return;
      setDetails(res);
      const recQuality = res.qualities.find((q) => q.recommended) || res.qualities[0];
      setSelectedQualityId(recQuality?.id || '');
      setLoadingDetails(false);
    });

    return () => {
      active = false;
    };
  }, [item]);

  // Proactively batch-translate ALL IMDb fields & backend quality texts whenever details or language changes
  useEffect(() => {
    if (!details || lang === 'en') return;
    const imdb = details.imdb;
    const textsToTranslate = [
      imdb.matchedTitle,
      imdb.director,
      imdb.typeLabel,
      imdb.timelineLabel,
      imdb.contentRating,
      imdb.country,
      imdb.plotSummary,
      imdb.imdbReferenceNote,
      ...imdb.cast,
      ...imdb.genres,
      ...imdb.spokenLanguages,
      ...details.qualities.map((q) => q.label),
      ...details.qualities.map((q) => q.batteryMode),
      ...details.qualities.map((q) => q.audio)
    ];
    void translateTexts(textsToTranslate);
  }, [details, lang, translateTexts]);

  const related = useMemo(() => {
    if (!item) return [];
    return catalog
      .filter((c) => c.id !== item.id && c.availabilityStatus === 'available')
      .map((c) => ({
        item: c,
        sim: cosineSimilarity6D(item.vector, c.vector) + (c.clusterId === item.clusterId ? 0.15 : 0)
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3);
  }, [item, catalog]);

  if (!item) return null;

  const title = cleanCinemaTitle(t(item.titleEn, item.titleFa));
  const creator = item.creatorEn ? t(item.creatorEn, item.creatorFa) : '';
  const category = t(item.categoryEn, item.categoryFa);
  const synopsis = t(item.synopsisEn, item.synopsisFa);
  const resumeSec =
    progress && !progress.completed && progress.positionSec > 5 ? progress.positionSec : 0;
  const isDownloading = downloadRecord?.status === 'downloading';
  const isDownloaded = downloadRecord?.status === 'completed';

  const imdb = details?.imdb;
  const backendQualities = details?.qualities || [];
  const activeQuality =
    backendQualities.find((q) => q.id === selectedQualityId) || backendQualities[0];

  const getMotionProps = (idx: number) => {
    const ent = cardEntrances[idx] || { initialX: 0, initialY: 28, delay: 0 };
    return {
      initial: { opacity: 0, x: ent.initialX, y: ent.initialY },
      animate: { opacity: 1, x: 0, y: 0 },
      transition: { type: 'spring' as const, stiffness: 280, damping: 24, delay: ent.delay }
    };
  };

  return (
    <AdaptiveModal
      isOpen={Boolean(item)}
      onClose={() => {
        setReportOpen(false);
        onClose();
      }}
      title={title}
      subtitle={`${category} · ${activeQuality ? activeQuality.resolution : item.quality} · ${formatDuration(item.durationSec)}`}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-5 overflow-x-hidden">
        {/* Top Translate / Language Action Strip */}
        <motion.div
          key={`${item.id}-${openSeq}-translate-bar`}
          {...getMotionProps(0)}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F5B942]/30 bg-[#F5B942]/8 px-4 py-2.5"
        >
          <div className="flex items-center gap-2 text-xs text-[#F5F7FA]">
            <Sparkles className="h-4 w-4 text-[#F5B942] shrink-0" />
            <span>
              {t(
                'IMDb details & backend stream qualities auto-translate into your selected language.',
                'تمامی اطلاعات IMDb و لیست کیفیت‌های بک‌اند به زبان انتخابی شما ترجمه می‌شوند.'
              )}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={onOpenLanguagePicker}>
            <Globe2 className="h-3.5 w-3.5 text-[#F5B942]" />
            <span>
              {isTranslating
                ? t('Translating...', 'در حال ترجمه...')
                : `${t('Translate', 'ترجمه')}: ${languageInfo.nativeName}`}
            </span>
          </Button>
        </motion.div>

        {/* Visual Banner with Gold Marquee Rim Light + Unified Action Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <motion.div
            key={`${item.id}-${openSeq}-poster`}
            {...getMotionProps(1)}
            className="md:col-span-5 relative group"
          >
            {/* Top Glowing Marquee Title Plaque */}
            <div className="relative -mt-2 mb-2 mx-auto max-w-[95%] px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8a7224] via-[#F5B942] to-[#8a7224] border-2 border-[#FFF2A7] shadow-[0_6px_20px_rgba(212,175,55,0.7)] text-center z-20">
              <span className="font-cinzel text-xs font-black tracking-widest text-[#050508] uppercase truncate block">
                {cleanCinemaTitle(title)}
              </span>
            </div>

            {/* Marquee Frame with Glowing Incandescent Bulbs */}
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-b from-[#2a2416] via-[#151720] to-[#0c0d12] border-2 border-[rgba(212,175,55,0.65)] shadow-[0_0_35px_rgba(212,175,55,0.3)]">
              {/* Outer Bulbs Top */}
              <div className="absolute top-1 inset-x-4 flex justify-between pointer-events-none">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <span
                    key={`top-${i}`}
                    className="w-1.5 h-1.5 rounded-full bg-[#FFF2A7] shadow-[0_0_6px_#F5B942] animate-pulse"
                    style={{ animationDelay: `${(i * 150) % 1200}ms` }}
                  />
                ))}
              </div>

              {/* Outer Bulbs Bottom */}
              <div className="absolute bottom-1 inset-x-4 flex justify-between pointer-events-none">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <span
                    key={`bot-${i}`}
                    className="w-1.5 h-1.5 rounded-full bg-[#FFF2A7] shadow-[0_0_6px_#F5B942] animate-pulse"
                    style={{ animationDelay: `${((i + 3) * 150) % 1200}ms` }}
                  />
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-[rgba(212,175,55,0.4)] bg-[#050508] aspect-[16/10] md:aspect-[4/3] relative shadow-inner">
                <img src={item.posterUrl} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {imdb && (
                  <div className="absolute top-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5B942] px-3 py-1 text-xs font-bold text-[#050508] shadow-[0_0_12px_rgba(212,175,55,0.6)]">
                    <span className="font-mono">IMDb</span>
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span dir="ltr" className="font-mono-tabular">
                      {imdb.imdbRating}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onWatchTrailer(item, activeQuality)}
                  className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(212,175,55,0.4)] bg-[#050508]/85 px-3.5 py-1.5 text-xs font-semibold text-[#D4AF37] backdrop-blur-md hover:bg-[#D4AF37]/20 transition-all cursor-pointer shadow-md"
                >
                  <Clapperboard className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{t('Watch Trailer', 'تماشای تریلر')}</span>
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            key={`${item.id}-${openSeq}-actions`}
            {...getMotionProps(2)}
            className="md:col-span-7 flex flex-col justify-between gap-5 rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0B0C10] p-5 shadow-xl"
          >
            <div className="space-y-3">
              {creator && (
                <p className="text-xs font-cinzel font-bold text-[#D4AF37]">
                  {t('Creator / Director:', 'کارگردان / خالق:')} {imdb ? t(imdb.director) : creator}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3AEC2]">
                <span className="px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.25)] font-mono text-[10px] font-bold">
                  {activeQuality ? activeQuality.resolution : item.quality}
                </span>
                <span dir="ltr" className="font-mono-tabular">
                  {imdb?.year || item.releaseYear}
                </span>
                <span>·</span>
                <span>{t(item.clusterLabelEn, item.clusterLabelFa)}</span>
              </div>

              <p className="text-sm text-[#CBD5E1] leading-relaxed">
                {imdb && imdb.plotSummary !== item.synopsisEn ? t(imdb.plotSummary) : synopsis}
              </p>

              <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>
                  {activeQuality
                    ? `${t('Pristine Master Quality:', 'کیفیت کریستالی مستر:')} ${t(activeQuality.label)} (${activeQuality.bitrateMbps} Mbps)`
                    : t('Verified Stream & Full Quality Ready', 'استریم تاییدشده و آماده پخش با کیفیت کامل')}
                </span>
              </p>
            </div>

            {/* Unified Compact Control Header */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => onPlay(item, activeQuality)}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-bold text-xs tracking-wider shadow-[0_0_24px_rgba(212,175,55,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current stroke-[2]" />
                <span>
                  {resumeSec > 0
                    ? `${t('Resume', 'ادامه از')} ${formatDuration(resumeSec)}`
                    : activeQuality
                    ? `${t('Play Full Movie', 'پخش فیلم')} (${activeQuality.resolution})`
                    : t('Play Full Movie', 'پخش فیلم کامل')}
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={() => onDownload(item, false, activeQuality)}
                  className="h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-xs text-slate-200 hover:text-[#D4AF37] transition-all cursor-pointer"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4AF37]" />
                      <span className="font-mono">{downloadRecord.progressPct}%</span>
                    </>
                  ) : isDownloaded ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{t('Saved', 'ذخیره‌شده')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <span>{t('Save Offline', 'ذخیره آفلاین')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={() => onDownload(item, true, activeQuality)}
                  className="h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-xs text-slate-200 hover:text-[#D4AF37] transition-all cursor-pointer"
                >
                  <HardDriveDownload className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{t('Save to Device', 'دانلود فایل')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(item)}
                  className={`h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border transition-all cursor-pointer text-xs ${
                    isFavorite
                      ? 'border-[#D4AF37] bg-[rgba(212,175,55,0.2)] text-[#D4AF37]'
                      : 'border-[rgba(212,175,55,0.22)] bg-[#050508]/70 text-slate-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
                  <span>{isFavorite ? t('Favorited', 'علاقه‌مندی') : t('Favorite', 'علاقه‌مندی')}</span>
                </button>
              </div>
            </div>

            {isDownloading && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#F5B942] transition-all duration-200"
                    style={{ width: `${downloadRecord.progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#A3AEC2]">
                  {t('Preparing offline clip...', 'در حال آماده‌سازی فایل آفلاین...')}{' '}
                  <span dir="ltr" className="font-mono-tabular">
                    ({downloadRecord.progressPct}%)
                  </span>
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Film Screening Room Hub & Dossier (From VIP Cinema Design) */}
        <motion.div
          key={`${item.id}-${openSeq}-screening-dossier`}
          {...getMotionProps(3)}
          className="w-full"
        >
          <FilmScreeningDossier
            item={item}
            onPlayScreening={(slot) => {
              onPlay(item, activeQuality);
            }}
          />
        </motion.div>

        {/* IMDb Live Database Record + Backend Stream Qualities List (Animated from Random Sides) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Film Information Dossier Card (IMDb & Cast) */}
          <motion.div
            key={`${item.id}-${openSeq}-imdb`}
            {...getMotionProps(3)}
            className="lg:col-span-6 rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#0B0C10] p-5 space-y-4 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(212,175,55,0.18)] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F5B942] px-2.5 py-0.5 text-[11px] font-black tracking-wide text-[#050508] shadow-[0_0_10px_rgba(212,175,55,0.4)]">
                  IMDb
                </span>
                <h3 className="font-cinzel text-sm sm:text-base font-bold tracking-wider text-[#D4AF37]">
                  {t('FILM INFORMATION DOSSIER', 'شناسنامه رسمی سینمایی اثر')}
                </h3>
              </div>
              {imdb && (
                <a
                  href={imdb.imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-[#D4AF37] hover:underline"
                >
                  <span>{imdb.imdbId}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {loadingDetails && !imdb ? (
              <div className="space-y-2.5 py-4 text-xs text-[#A3AEC2] flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                <span>{t('Fetching live record from IMDb...', 'در حال دریافت اطلاعات دقیق از IMDb...')}</span>
              </div>
            ) : imdb ? (
              <div className="space-y-4 text-xs">
                {/* 3 Metric Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#050508] p-3 text-center">
                    <p className="text-[10px] text-[#8E9BB3] font-mono uppercase">{t('IMDb Rating', 'امتیاز')}</p>
                    <p dir="ltr" className="text-sm font-bold text-[#D4AF37] font-mono-tabular mt-0.5">
                      ★ {imdb.imdbRating} / 10
                    </p>
                    <p dir="ltr" className="text-[9px] text-[#A3AEC2]">
                      {imdb.votesCount.toLocaleString()} {t('votes', 'رای')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#050508] p-3 text-center">
                    <p className="text-[10px] text-[#8E9BB3] font-mono uppercase">{t('Timeline', 'زمان و سال')}</p>
                    <p className="text-xs font-semibold text-[#F5F7FA] truncate mt-0.5">
                      {t(imdb.typeLabel)}
                    </p>
                    <p dir="ltr" className="text-[10px] text-[#A3AEC2] font-mono-tabular">
                      {imdb.year} · {imdb.runtimeMinutes} {t('min', 'دقیقه')}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#050508] p-3 text-center">
                    <p className="text-[10px] text-[#8E9BB3] font-mono uppercase">{t('Certification', 'رده‌بندی')}</p>
                    <p className="text-xs font-semibold text-emerald-400 mt-0.5">{t(imdb.contentRating)}</p>
                    <p dir="ltr" className="text-[10px] text-[#A3AEC2] font-mono-tabular">
                      {imdb.imdbRank ? `#${imdb.imdbRank.toLocaleString()}` : 'VIP MASTER'}
                    </p>
                  </div>
                </div>

                {/* Structured Cast with Avatars */}
                <div className="space-y-2 pt-1 border-t border-[rgba(212,175,55,0.12)]">
                  <p className="font-cinzel text-xs font-bold tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{t('CAST & SCREENING TALENT', 'ستارگان و بازیگران')}</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {imdb.cast.slice(0, 4).map((actor, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-[rgba(212,175,55,0.15)]">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#806010] flex items-center justify-center text-[10px] font-bold text-[#050508] shrink-0">
                          {actor[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{t(actor)}</p>
                          <p className="text-[9px] text-[#8E9BB3] tracking-wide">Starring Role</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Genres */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {imdb.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.08)] px-3 py-0.5 text-[10px] font-medium text-[#D4AF37]"
                    >
                      {t(g)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>

          {/* Backend Available Stream Qualities List Card */}
          <motion.div
            key={`${item.id}-${openSeq}-qualities`}
            {...getMotionProps(4)}
            className="lg:col-span-6 rounded-2xl border border-white/12 bg-[#06070C]/80 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#38BDF8]" />
                <h3 className="text-sm font-semibold text-[#F5F7FA]">
                  {t('Backend Stream Qualities', 'لیست کیفیت‌های موجود از بک‌اند')}
                </h3>
              </div>
              <span className="text-[11px] font-mono-tabular text-[#34D399]">
                {backendQualities.length} {t('Profiles Ready', 'کیفیت آماده')}
              </span>
            </div>

            {loadingDetails && backendQualities.length === 0 ? (
              <div className="py-4 flex items-center gap-2 text-xs text-[#A3AEC2]">
                <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                <span>{t('Loading stream profiles from backend...', 'در حال دریافت لیست کیفیت‌ها از سرور...')}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {backendQualities.map((q) => {
                  const selected = q.id === activeQuality?.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQualityId(q.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-2.5 text-start transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#F5B942] bg-[#F5B942]/12 text-[#F5F7FA]'
                          : 'border-white/10 bg-[#0D101A]/75 text-[#D2DAE8] hover:border-white/25'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-mono-tabular font-semibold text-[#F5B942]">
                            {q.resolution}
                          </span>
                          <span className="text-xs font-semibold truncate">{t(q.label)}</span>
                          {q.recommended && (
                            <span className="rounded-full bg-[#34D399]/15 border border-[#34D399]/40 px-2 py-0.5 text-[10px] text-[#34D399]">
                              {t('Recommended', 'پیشنهادی')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8E9BB3] truncate">
                          {q.codec} · {t(q.audio)} · {t(q.batteryMode)}
                        </p>
                      </div>

                      <div dir="ltr" className="shrink-0 text-end space-y-0.5 font-mono-tabular">
                        <p className="text-xs font-semibold text-[#F5F7FA]">{q.bitrateMbps} Mbps</p>
                        <p className="text-[10px] text-[#A3AEC2]">~{q.estimatedSizeMb} MB</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Feedback + Collections Bar */}
        <motion.div
          key={`${item.id}-${openSeq}-taste`}
          {...getMotionProps(5)}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#06070C]/70 p-4"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#A3AEC2]">
              {t('Quick Taste Signal', 'تأثیر فوری بر موتور سلیقه')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={feedback?.sentiment === 'like' ? 'primary' : 'secondary'}
                onClick={() => onFeedback(item, 'like')}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {t('Like', 'پسندیدم')}
              </Button>
              <Button
                size="sm"
                variant={feedback?.sentiment === 'less_like_this' ? 'danger' : 'secondary'}
                onClick={() => onFeedback(item, 'less_like_this')}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {t('Less Like This', 'کمتر از این سبک')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onHide(item);
                  onClose();
                }}
              >
                <EyeOff className="h-3.5 w-3.5" />
                {t('Hide', 'مخفی کردن')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#A3AEC2] flex items-center gap-1.5">
              <FolderPlus className="h-3.5 w-3.5 text-[#F5B942]" />
              <span>{t('Assign to Collections', 'افزودن به کلکسیون‌ها')}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {collections.map((col) => {
                const inside = col.itemIds.includes(item.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onToggleCollectionItem(col.id, item.id)}
                    className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-full px-3 text-xs border transition-colors cursor-pointer ${
                      inside
                        ? 'border-[#F5B942] bg-[#F5B942]/15 text-[#F5B942]'
                        : 'border-white/12 bg-white/[0.04] text-[#A3AEC2] hover:text-white'
                    }`}
                  >
                    {inside && <Check className="h-3 w-3" />}
                    <span>{col.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Chapters */}
        {item.chapters.length > 0 && (
          <motion.div
            key={`${item.id}-${openSeq}-chapters`}
            {...getMotionProps(6)}
            className="space-y-2.5 rounded-2xl border border-white/10 bg-[#06070C]/55 p-4"
          >
            <h3 className="text-xs font-semibold text-[#A3AEC2]">{t('Chapters', 'فصل‌های ویدئو')}</h3>
            <div className="flex flex-wrap gap-2">
              {item.chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onPlay(item, activeQuality)}
                  className="min-h-[36px] rounded-full border border-white/10 bg-[#151A28] px-3.5 text-xs text-[#F5F7FA] hover:border-[#F5B942]/50 cursor-pointer"
                >
                  <span dir="ltr" className="font-mono-tabular text-[#F5B942] me-2">
                    {formatDuration(ch.timeSec)}
                  </span>
                  <span>{t(ch.labelEn, ch.labelFa)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Animated Playback Feedback / Hide Drawer */}
        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setReportOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs text-[#A3AEC2] hover:text-[#FCA5A5] transition-colors cursor-pointer"
          >
            <Flag className="h-3.5 w-3.5" />
            <span>{t('Report Playback Issue or Hide Item', 'گزارش خطای پخش یا مخفی‌سازی از فید')}</span>
          </button>

          <AnimatePresence>
            {reportOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#FCA5A5]">
                    {t(
                      'This title will immediately be hidden from your personal feed.',
                      'این مورد فوراً از فید شخصی شما مخفی می‌شود.'
                    )}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value as ContentFeedbackIssueReason)}
                      className="min-h-[42px] rounded-xl border border-white/15 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                    >
                      <option value="broken_link">
                        {t('Broken Stream / Playback Error', 'خطای پخش یا کیفیت تصویر')}
                      </option>
                      <option value="quality_issue">
                        {t('Subtitle or Audio Sync Issue', 'ناهماهنگی صدا یا زیرنویس')}
                      </option>
                      <option value="not_interested">
                        {t('Not Matching My Taste', 'نامرتبط با سلیقه من')}
                      </option>
                      <option value="other">{t('Other Reason', 'سایر موارد')}</option>
                    </select>
                    <input
                      type="text"
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder={t('Optional details...', 'توضیح کوتاه (اختیاری)...')}
                      className="min-h-[42px] rounded-xl border border-white/15 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        onSubmitReport(
                          item,
                          reportReason,
                          reportDetails || t('Submitted from detail modal', 'ارسال‌شده از صفحه جزئیات')
                        );
                        setReportOpen(false);
                        onClose();
                      }}
                    >
                      {t('Hide & Save Feedback', 'تایید و مخفی‌سازی')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReportOpen(false)}>
                      {t('Cancel', 'انصراف')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Related Content */}
        {related.length > 0 && (
          <motion.div
            key={`${item.id}-${openSeq}-related`}
            {...getMotionProps(7)}
            className="space-y-3 pt-2 border-t border-white/10"
          >
            <h3 className="text-sm font-semibold text-[#F5F7FA]">
              {t('Related in Your Universe', 'آثار هم‌جنس در جهان شما')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {related.map(({ item: rel }) => {
                const relTitle = t(rel.titleEn, rel.titleFa);
                const relCategory = t(rel.categoryEn, rel.categoryFa);
                return (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onSelectItem(rel)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#06070C]/65 p-2.5 text-start hover:border-[#F5B942]/45 transition-colors cursor-pointer"
                  >
                    <img
                      src={rel.posterUrl}
                      alt={relTitle}
                      className="h-14 w-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#F5F7FA] group-hover:text-[#F5B942]">
                        {relTitle}
                      </p>
                      <p className="truncate text-[11px] text-[#A3AEC2]">{relCategory}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </AdaptiveModal>
  );
}
