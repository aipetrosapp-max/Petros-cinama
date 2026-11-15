import React from 'react';
import {
  Clapperboard,
  Compass,
  Download,
  FolderHeart,
  Play,
  Sparkles,
  Star,
  Tv,
  WifiOff,
  Flame,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import type {
  ExplainedRecommendation,
  FeedbackRecord,
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  PrototypeRoute,
  TasteVector6D,
  UserCollection,
  WatchProgressEntry
} from '../types';
import { computeLivingHomepage } from '../tasteEngine';
import { useT } from '../i18n';
import { Button, MediaCard, formatDuration, cleanCinemaTitle } from '../components/UiPrimitives';
import { GoldenMarqueePoster } from '../components/GoldenMarqueePoster';

function cleanCinemaSynopsis(raw: string): string {
  if (!raw) return '';
  return (
    raw
      .replace(/\[Telegram\/.*?\]/gi, '')
      .replace(/https?:\/\/t\.me\/\S+/gi, '')
      .replace(/@\w+/g, '')
      .trim() || 'A curated cinematic experience streaming in ultra-high fidelity VIP 4K HDR.'
  );
}

interface LivingHomeScreenProps {
  catalog: PrototypeMediaItem[];
  lang: LanguageCode;
  userVector: TasteVector6D;
  personalizationEnabled: boolean;
  progressMap: Record<string, WatchProgressEntry>;
  favoriteIds: Set<string>;
  downloadsMap: Record<string, OfflineDownloadRecord>;
  hiddenIds: Set<string>;
  blockedTopics: string[];
  feedbackMap: Record<string, FeedbackRecord>;
  collections: UserCollection[];
  onNavigate: (route: PrototypeRoute) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onFeedback: (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => void;
  onHide: (item: PrototypeMediaItem) => void;
  onEnablePersonalization: () => void;
}

export function LivingHomeScreen({
  catalog,
  lang,
  userVector,
  personalizationEnabled,
  progressMap,
  favoriteIds,
  downloadsMap,
  hiddenIds,
  blockedTopics,
  feedbackMap,
  collections,
  onNavigate,
  onOpenDetail,
  onPlay,
  onWatchTrailer,
  onDownload,
  onToggleFavorite,
  onFeedback,
  onHide,
  onEnablePersonalization
}: LivingHomeScreenProps) {
  const { t, dir } = useT();

  const layout = React.useMemo(() => {
    try {
      return computeLivingHomepage({
        catalog,
        userVector,
        personalizationEnabled,
        progressMap,
        favoriteIds,
        hiddenIds,
        blockedTopics,
        feedbackMap,
        lang
      });
    } catch (err) {
      console.warn('computeLivingHomepage fallback triggered:', err);
      const fallbackHero = catalog[0]
        ? {
            item: catalog[0],
            score: 96,
            reasonFa: 'پیشنهاد برگزیده سینما پتروس',
            reasonEn: 'Petros Cinema Editorial Spotlight'
          }
        : null;
      return {
        heroPick: fallbackHero,
        continueWatching: [],
        recommendedForYou: catalog.slice(1, 11).map((item) => ({
          item,
          score: 88,
          reasonFa: 'منتخب هوش مصنوعی برای سلیقه شما',
          reasonEn: 'AI Curated for you'
        })),
        newDiscoveries: catalog.slice(2, 12).map((item) => ({
          item,
          score: 82,
          reasonFa: 'اکران جدید',
          reasonEn: 'New screening'
        })),
        hiddenGems: [],
        recentlyAdded: [],
        exploreDifferent: []
      };
    }
  }, [
    catalog,
    userVector,
    personalizationEnabled,
    progressMap,
    favoriteIds,
    hiddenIds,
    blockedTopics,
    feedbackMap,
    lang
  ]);

  const hero = layout.heroPick || (catalog[0] ? {
    item: catalog[0],
    score: 98,
    reasonFa: 'اکران افتتاحیه سالن اصلی IMAX 4K',
    reasonEn: 'IMAX 4K VIP Hall Premiere'
  } : null);

  // Top 10 Ranked Movies for Live Trending carousel
  const top10Trending = React.useMemo(() => {
    const list = [...catalog]
      .filter((c) => !hiddenIds.has(c.id))
      .sort((a, b) => (b.releaseYear || 2024) - (a.releaseYear || 2024));
    return list.slice(0, 10);
  }, [catalog, hiddenIds]);

  // If catalog is completely empty, show luxury cinema projector loader
  if (!catalog || catalog.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.25)_0%,transparent_70%)] animate-pulse" />
          <Tv className="w-12 h-12 text-[#D4AF37] animate-bounce" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="font-cinzel text-xl font-bold text-[#D4AF37] tracking-wider">
            {t('CALIBRATING IMAX VIP STAGE...', 'آماده‌سازی سالن سینما پتروس...')}
          </h2>
          <p className="text-xs text-[#A3AEC2] leading-relaxed">
            {t(
              'Synchronizing 500+ cinema streams & AI taste clusters directly into memory.',
              'در حال همگام‌سازی بیش از ۵۰۰ فیلم و سریال با کیفیت سینمایی 4K و اتصال به مخزن ابری...'
            )}
          </p>
        </div>
      </div>
    );
  }

  const renderShelf = (
    titleEn: string,
    titleFa: string,
    subtitleEn: string,
    subtitleFa: string,
    recs: ExplainedRecommendation[]
  ) => {
    if (recs.length === 0) return null;
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-cinzel text-base sm:text-xl font-bold text-[#F5F7FA] tracking-wide">
              {t(titleEn, titleFa)}
            </h2>
            <p className="text-xs text-[#A3AEC2]">{t(subtitleEn, subtitleFa)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('discover')}>
            {t('View in 3D Map', 'کاوش در فضای سه‌بعدی')}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
          {recs.map((rec) => (
            <MediaCard
              key={rec.item.id}
              recommendation={rec}
              lang={lang}
              isFavorite={favoriteIds.has(rec.item.id)}
              downloadRecord={downloadsMap[rec.item.id]}
              progress={progressMap[rec.item.id]}
              feedback={feedbackMap[rec.item.id]}
              onOpenDetail={onOpenDetail}
              onPlay={onPlay}
              onDownload={onDownload}
              onToggleFavorite={onToggleFavorite}
              onFeedback={onFeedback}
              onHide={onHide}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-12">
      {/* 1. FEATURED IMAX STAGE (Top Hero with 3D Cinema Bezel & Ambient Reflection) */}
      {hero && (
        <section
          id="tour-step-cinema-hero"
          className="relative group rounded-[28px] sm:rounded-[36px] border-2 border-[rgba(212,175,55,0.4)] bg-[#0B0C10] shadow-[0_25px_80px_rgba(0,0,0,0.98),0_0_40px_rgba(212,175,55,0.2)] overflow-hidden"
        >
          {/* Ambient Lighting Rays inside Bezel */}
          <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-[radial-gradient(circle,rgba(245,185,66,0.2)_0%,transparent_70%)] pointer-events-none z-10" />
          <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none z-10" />

          {/* Bezel Golden Top Accent */}
          <div className="absolute top-0 inset-x-12 h-[2px] bg-gradient-to-r from-transparent via-[#F5B942] to-transparent z-20 shadow-[0_0_12px_#F5B942]" />

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[420px] sm:min-h-[460px]">
            {/* Cinema Stage Screen Backdrop */}
            <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[420px] overflow-hidden bg-black flex items-center justify-center">
              <img
                src={hero.item.posterUrl}
                alt={cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
                className="h-full w-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
              />
              {/* Cinema Vignette & Multi-stop Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-black/40 to-transparent lg:bg-gradient-to-l lg:from-[#0B0C10] lg:via-black/50 lg:to-transparent pointer-events-none" />

              {/* Centered Play Watermark */}
              <div
                onClick={() => onPlay(hero.item)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#FFF2A7] text-[#050508] flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,0.8)] scale-90 group-hover:scale-105 transition-transform">
                  <Play className="w-8 h-8 fill-current stroke-[2.5] translate-x-0.5" />
                </div>
              </div>
            </div>

            {/* Stage Right Information & Action Hierarchy */}
            <div className="lg:col-span-5 p-6 sm:p-9 flex flex-col justify-between gap-6 z-10 bg-[#0B0C10]/95 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-[rgba(212,175,55,0.18)]">
              <div className="space-y-4">
                {/* Gold VIP Pass Badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[rgba(212,175,55,0.25)] to-[rgba(245,185,66,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.4)] text-[11px] font-mono font-bold tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <Sparkles className="h-3 w-3 animate-pulse text-[#F5B942]" />
                    <span>[VIP HALL 01 · 4K IMAX]</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                    {hero.score}% MATCH
                  </span>
                </div>

                {/* Movie Title */}
                <h1 className="font-cinzel text-2xl sm:text-4xl font-black tracking-wide text-[#F5F7FA] leading-tight drop-shadow-lg">
                  {cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
                </h1>

                {/* Specs Strip */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3AEC2]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/35 font-mono text-[10px] font-bold">
                    {hero.item.quality || '4K HDR'}
                  </span>
                  <span className="font-mono-tabular">
                    {formatDuration(hero.item.durationSec)}
                  </span>
                  <span>·</span>
                  <span className="text-slate-300 font-medium">
                    {t(hero.item.categoryEn, hero.item.categoryFa)}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-slate-300">
                    {hero.item.releaseYear || 2026}
                  </span>
                </div>

                {/* Synopsis */}
                <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed line-clamp-3">
                  {cleanCinemaSynopsis(t(hero.item.synopsisEn, hero.item.synopsisFa))}
                </p>

                {/* AI Matching Reason */}
                <div className="rounded-2xl bg-[#050508]/80 border border-[rgba(212,175,55,0.25)] p-3 text-xs text-[#D4AF37] flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-current shrink-0 text-[#F5B942]" />
                  <span>{t(hero.reasonEn, hero.reasonFa)}</span>
                </div>
              </div>

              {/* Action Buttons: Primary Gold Watch in VIP Hall + Secondary Controls */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => onPlay(hero.item)}
                  className="w-full h-13 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-black text-sm tracking-wider shadow-[0_0_35px_rgba(212,175,55,0.65)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-current stroke-[2.5]" />
                  <span>{t('Watch in VIP Hall', 'پخش در سالن اصلی (VIP 4K)')}</span>
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(hero.item)}
                    className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/80 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-200 hover:text-[#D4AF37] transition-all cursor-pointer text-xs font-semibold"
                  >
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t('Dossier', 'شناسنامه')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onWatchTrailer(hero.item)}
                    className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/80 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-200 hover:text-[#D4AF37] transition-all cursor-pointer text-xs font-semibold"
                  >
                    <Clapperboard className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t('Trailer', 'تریلر')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownload(hero.item)}
                    className="h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[#050508]/80 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-200 hover:text-[#D4AF37] transition-all cursor-pointer text-xs font-semibold"
                  >
                    <Download className="h-4 w-4 text-[#D4AF37]" />
                    <span>{t('Download', 'دانلود')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ambient Theater Light Reflection Below Bezel */}
          <div className="h-3 w-full bg-gradient-to-b from-[rgba(212,175,55,0.3)] to-transparent blur-sm pointer-events-none" />
        </section>
      )}

      {/* 2. 🔥 ترندهای روز سینما (Top 10 Ranked Cinema Titles with Giant Gold Numbers 1-10) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.2)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-[#F5B942]">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-lg sm:text-2xl font-black text-[#F5F7FA] tracking-wide flex items-center gap-2">
                <span>{t('TRENDING NOW · TOP 10', '🔥 ترندهای برتر روز سینما پتروس')}</span>
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t(
                  'The 10 most watched & acclaimed cinematic masterpieces this week',
                  '۱۰ اثر برتر سینمایی با بالاترین نرخ تماشا و امتیاز منتقدان'
                )}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#D4AF37] uppercase bg-[rgba(212,175,55,0.1)] px-2.5 py-1 rounded-full border border-[rgba(212,175,55,0.3)] hidden sm:inline">
            GLOBAL CHARTS
          </span>
        </div>

        {/* Horizontal Scroll Track with Giant 3D Gold Numbers */}
        <div className="relative overflow-x-auto pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 sm:gap-6 min-w-max">
            {top10Trending.map((item, index) => {
              const rank = index + 1;
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenDetail(item)}
                  className="group relative w-44 sm:w-52 shrink-0 cursor-pointer select-none transition-transform duration-300 hover:scale-[1.03]"
                >
                  <div className="relative flex items-end">
                    {/* Giant Gold Metallic Rank Number (1-10) */}
                    <span
                      className="font-cinzel text-7xl sm:text-8xl font-black tracking-tighter leading-none select-none pointer-events-none z-10 -mr-4 sm:-mr-6 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
                      style={{
                        background:
                          'linear-gradient(180deg, #FFF2A7 0%, #F5B942 35%, #D4AF37 70%, #684f10 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 25px rgba(212, 175, 55, 0.4)'
                      }}
                    >
                      {rank}
                    </span>

                    {/* Movie Poster Card */}
                    <div className="relative flex-1 aspect-[2/3] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.35)] bg-black shadow-[0_12px_30px_rgba(0,0,0,0.85)] group-hover:border-[#D4AF37] group-hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all">
                      <img
                        src={item.posterUrl}
                        alt={cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                      {/* Top Badges */}
                      <div className="absolute top-2 start-2 flex items-center gap-1">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/75 text-[#F5B942] border border-[#F5B942]/30 backdrop-blur-md">
                          {item.quality || '4K'}
                        </span>
                      </div>

                      {/* Hover Play Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlay(item);
                        }}
                        aria-label="Play"
                        className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#FFF2A7] text-[#050508] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.8)] cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-current stroke-[2] translate-x-0.5" />
                      </button>

                      {/* Bottom Info */}
                      <div className="absolute bottom-2 inset-x-2">
                        <p className="font-cinzel text-xs font-bold text-white truncate">
                          {cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                        </p>
                        <p className="text-[10px] font-mono text-[#D4AF37]">
                          {item.releaseYear || 2026} · {t(item.categoryEn, item.categoryFa)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. 🏛️ FEATURED MARQUEE CINEMA POSTER (With Glowing Incandescent Bulbs) */}
      {hero && (
        <section className="py-2 flex justify-center">
          <GoldenMarqueePoster
            item={hero.item}
            titleOverride={cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
            onClick={() => onOpenDetail(hero.item)}
          />
        </section>
      )}

      {/* 4. CONTINUE WATCHING SHELF (If User has Progress) */}
      {layout.continueWatching.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-cinzel text-base sm:text-xl font-bold text-[#F5F7FA]">
                {t('Continue Watching', 'ادامه تماشا')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t('Pick up right where you paused', 'بازگشت دقیق به آخرین لحظه‌ای که توقف کردید')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('library')}>
              {t('Full History', 'تمام سابقه در آرشیو')}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {layout.continueWatching.map(({ item, progress }) => {
              const pct = Math.min(
                100,
                Math.round((progress.positionSec / progress.durationSec) * 100)
              );
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#0B0C10] p-3 hover:border-[#D4AF37] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onPlay(item)}
                    className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-black cursor-pointer group"
                  >
                    <img
                      src={item.posterUrl}
                      alt={cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <Play className="h-6 w-6 text-[#F5B942] fill-current" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(item)}
                      className="block truncate text-sm font-semibold text-[#F5F7FA] hover:text-[#D4AF37] cursor-pointer text-start w-full"
                    >
                      {cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                    </button>
                    <p dir="ltr" className="text-[11px] font-mono-tabular text-[#A3AEC2]">
                      {formatDuration(progress.positionSec)} / {formatDuration(progress.durationSec)} ({pct}%)
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F5B942]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. ✨ منتخب هوش مصنوعی برای سلیقه شما (AI Curated For You with Match Reasons) */}
      {renderShelf(
        'AI Curated For You',
        '✨ منتخب هوش مصنوعی برای سلیقه شما',
        'Dynamically calibrated from your visual mood preferences & watch frequency',
        'چیدمان هوشمند با تحلیل ۶بعدی تنش داستانی، سرعت ریتم و اتمسفر بصری شما',
        layout.recommendedForYou
      )}

      {/* 6. 🎬 اکران‌های جدید و ویژه (New & Exclusive Screenings) */}
      {renderShelf(
        'New & Exclusive Screenings',
        '🎬 اکران‌های جدید و ویژه سینما پتروس',
        'Latest 4K HDR digital releases freshly ingested into the cloud vault',
        'جدیدترین عناوین با کیفیت کریستالی و بدون افت کیفیت در سرورهای ابری',
        layout.newDiscoveries
      )}

      {/* Collections Row */}
      {collections.length > 0 && (
        <section className="rounded-3xl border border-[rgba(212,175,55,0.22)] bg-[#0B0C10] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center shrink-0">
              <FolderHeart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F5F7FA]">
                {t('Your VIP Cinema Collections', 'کلکسیون‌های اختصاصی شما')}
              </h3>
              <p className="text-xs text-[#A3AEC2]">
                {collections.length} {t('custom private lists in your local vault', 'فهرست شخصی در حافظه داخلی')}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('library')}>
            {t('Open Collections', 'مشاهده کلکسیون‌ها')}
          </Button>
        </section>
      )}
    </div>
  );
}
