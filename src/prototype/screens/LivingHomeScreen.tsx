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
      {/* 1. FULL-BLEED IMMERSIVE HERO STAGE (Reference Image 1) */}
      {hero && (
        <section
          id="tour-step-cinema-hero"
          className="relative -mx-3 sm:-mx-6 lg:-mx-8 -mt-5 sm:-mt-6 h-[66vh] sm:h-[72vh] min-h-[520px] max-h-[720px] overflow-hidden group select-none"
        >
          {/* Edge-to-Edge Movie Backdrop / Cinematic Space Visual */}
          <div className="absolute inset-0 bg-black">
            <img
              src={hero.item.posterUrl}
              alt={cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
              className="h-full w-full object-cover object-center scale-105 group-hover:scale-100 transition-transform duration-1000 opacity-90"
            />
            {/* Top Atmospheric Shadow for Status / Header */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#050508]/85 via-[#050508]/30 to-transparent pointer-events-none z-10" />

            {/* Seamless Deep Obsidian Multi-stop Bottom Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/80 via-45% to-transparent pointer-events-none z-10" />

            {/* Ambient Warm Golden Color Glow Radiating Behind UI */}
            <div
              className="absolute inset-0 pointer-events-none z-10 opacity-60"
              style={{
                background:
                  'radial-gradient(circle at 50% 82%, rgba(245, 185, 66, 0.28) 0%, rgba(212, 175, 55, 0.12) 35%, transparent 70%)'
              }}
            />
          </div>

          {/* Centered / Aligned Lower Stage Overlay Content */}
          <div className="absolute bottom-6 sm:bottom-10 inset-x-4 sm:inset-x-8 z-20 flex flex-col items-center text-center space-y-3 sm:space-y-4 max-w-4xl mx-auto">
            {/* Subtle Frosted Glass Pill */}
            <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg">
              <span className="text-[11px] sm:text-xs font-semibold text-white/90 tracking-wide">
                {t('Recommended based on your taste', 'توصیه شده بر اساس سلیقه شما')}
              </span>
            </div>

            {/* Giant Bold Gold-Tinted Cinematic Title */}
            <h1 className="font-cinzel text-3xl sm:text-5xl md:text-6xl font-black tracking-wide leading-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF4BA] via-[#F3D06B] to-[#D4AF37] drop-shadow-[0_4px_30px_rgba(212,175,55,0.5)]">
              {cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
            </h1>

            {/* Crisp Gold-Bordered Metadata Capsule */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-1.5 rounded-full border border-[rgba(212,175,55,0.45)] bg-black/65 backdrop-blur-xl text-xs sm:text-sm font-bold text-[#F3D06B] shadow-[0_0_20px_rgba(212,175,55,0.22)]">
              <span>{t('🏆 Box Office Leader #1', '🏆 صدرنشین گیشه #1')}</span>
              <span className="text-[rgba(212,175,55,0.5)]">•</span>
              <span className="font-mono">★ 8.7 IMDb</span>
              <span className="text-[rgba(212,175,55,0.5)]">•</span>
              <span className="font-mono tracking-wider">4K IMAX</span>
            </div>

            {/* Primary CTA Row: Golden Ticket Button + Frosted Glass Preview Button */}
            <div className="flex items-center justify-center gap-3 pt-2 w-full max-w-md">
              {/* Ticket-shaped Glowing Gold Button */}
              <button
                type="button"
                onClick={() => onPlay(hero.item)}
                className="relative flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2.5 px-6 rounded-2xl bg-gradient-to-r from-[#F3D06B] via-[#E5C158] to-[#D4AF37] text-black font-extrabold text-xs sm:text-sm tracking-wide shadow-[0_0_35px_rgba(212,175,55,0.55)] hover:scale-[1.03] active:scale-95 transition-all cursor-pointer overflow-hidden group/btn"
              >
                {/* Left/Right ticket notches */}
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#050508]" />
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#050508]" />

                <span className="font-bold">{t('Enter VIP Hall', 'ورود به سالن اکران')}</span>
                <span className="text-base">🎟️</span>
              </button>

              {/* Frosted Glass Secondary Button */}
              <button
                type="button"
                onClick={() => onWatchTrailer(hero.item)}
                className="min-h-[48px] sm:min-h-[52px] px-6 rounded-2xl border border-white/25 bg-[#141620]/80 backdrop-blur-2xl text-white font-bold text-xs sm:text-sm hover:bg-white/10 hover:border-white/40 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                {t('Preview', 'پیش‌نمایش')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2. BOX OFFICE & DAILY TRENDS (Reference Image 1) */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.2)] pb-2.5">
          <h2 className="font-cinzel text-xl sm:text-2xl font-black text-[#F3D06B] tracking-wide">
            {t('Box Office & Daily Trends', 'گیشه و ترندهای روز')}
          </h2>
          <span className="text-[10px] font-mono tracking-widest text-[#D4AF37] uppercase bg-[rgba(212,175,55,0.1)] px-3 py-1 rounded-full border border-[rgba(212,175,55,0.3)]">
            TOP 10 VIP
          </span>
        </div>

        {/* Horizontal Scroll Track with Giant 3D Gold Numbers */}
        <div className="relative overflow-x-auto pb-6 pt-2 -mx-3 px-3 sm:mx-0 sm:px-0 no-scrollbar">
          <div className="flex gap-4 sm:gap-6 min-w-max">
            {top10Trending.map((item, index) => {
              const rank = index + 1;
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenDetail(item)}
                  className="group relative w-38 sm:w-46 shrink-0 cursor-pointer select-none transition-transform duration-300 hover:scale-[1.03]"
                >
                  <div className="relative">
                    {/* Movie Poster Card */}
                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.4)] bg-black shadow-[0_12px_30px_rgba(0,0,0,0.85)] group-hover:border-[#F3D06B] group-hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all">
                      <img
                        src={item.posterUrl}
                        alt={cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                      {/* Top Badges */}
                      <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/80 text-[#F5B942] border border-[#F5B942]/40 backdrop-blur-md">
                          {item.quality || '4K HDR'}
                        </span>
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/95 border border-white/20 backdrop-blur-md">
                          {t('Preview', 'پیش‌نمایش')}
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
                      <div className="absolute bottom-2 inset-x-2 text-center">
                        <p className="font-cinzel text-xs font-bold text-white truncate">
                          {cleanCinemaTitle(t(item.titleEn, item.titleFa))}
                        </p>
                      </div>
                    </div>

                    {/* Giant 3D Metallic Gold Rank Number (1-10) Overlapping Bottom Corner */}
                    <span
                      className="font-cinzel text-7xl sm:text-8xl font-black tracking-tighter leading-none select-none pointer-events-none absolute -bottom-5 -right-4 z-20 drop-shadow-[0_8px_16px_rgba(0,0,0,0.95)]"
                      style={{
                        background:
                          'linear-gradient(180deg, #FFF9D2 0%, #F3D06B 35%, #D4AF37 70%, #684f10 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))'
                      }}
                    >
                      {rank}
                    </span>
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
