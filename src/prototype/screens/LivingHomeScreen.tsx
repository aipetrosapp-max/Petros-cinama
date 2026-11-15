import React from 'react';
import {
  Clapperboard,
  Compass,
  Download,
  FolderHeart,
  Play,
  SlidersHorizontal,
  Sparkles,
  WifiOff
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
import { CryptoAdBanner } from '../../components/CryptoAdBanner';
import { SavingsCalculatorCard } from '../components/SavingsCalculatorCard';
import { GoldenMarqueePoster } from '../components/GoldenMarqueePoster';

function cleanCinemaSynopsis(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[Telegram\/.*?\]/gi, '')
    .replace(/https?:\/\/t\.me\/\S+/gi, '')
    .replace(/@\w+/g, '')
    .trim() || 'A curated cinematic experience streaming in ultra-high fidelity VIP 4K HDR.';
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
  const { t } = useT();

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
        recommendedForYou: catalog.slice(1, 7).map((item) => ({
          item,
          score: 88,
          reasonFa: 'منتخب پلتفرم پتروس',
          reasonEn: 'Curated for you'
        })),
        newDiscoveries: catalog.slice(2, 6).map((item) => ({
          item,
          score: 82,
          reasonFa: 'کشف جدید',
          reasonEn: 'New discovery'
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

  const hero = layout.heroPick;

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
            <h2 className="text-lg sm:text-xl font-semibold text-[#F5F7FA]">
              {t(titleEn, titleFa)}
            </h2>
            <p className="text-xs text-[#A3AEC2]">{t(subtitleEn, subtitleFa)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('discover')}>
            {t('View in Spatial Map', 'مشاهده در نقشه جهان')}
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
    <div className="space-y-8 sm:space-y-10 pb-6">
      {!personalizationEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#0D101A] px-4 py-3.5">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#D2DAE8]">
            <WifiOff className="h-4 w-4 text-[#F5B942] shrink-0" />
            <span>
              {t(
                'Personalization is turned off — showing neutral editorial feeds without taste profiling.',
                'شخصی‌سازی غیرفعال است — در حال نمایش ردیف‌های عمومی بدون ردیابی سلیقه.'
              )}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={onEnablePersonalization}>
            {t('Re-enable Personalization', 'فعال‌سازی دوباره شخصی‌سازی')}
          </Button>
        </div>
      )}

      {hero && (
        <section id="tour-step-cinema-hero" className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[rgba(212,175,55,0.25)] bg-[#0B0C10] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.12)]">
          {/* Ambient Glow behind hero */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Hero Backdrop with Multi-stop Gradient */}
            <div className="lg:col-span-7 relative min-h-[260px] sm:min-h-[380px] overflow-hidden">
              <img
                src={hero.item.posterUrl}
                alt={cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
                className="h-full w-full object-cover scale-105 hover:scale-100 transition-transform duration-700"
              />
              {/* Multi-stop vertical & horizontal gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10]/40 to-transparent lg:bg-gradient-to-l lg:from-[#0B0C10] lg:via-[#0B0C10]/50 lg:to-transparent" />
            </div>

            {/* Hero Information & Action Hierarchy */}
            <div className="lg:col-span-5 p-6 sm:p-9 flex flex-col justify-between gap-6 z-10">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)] text-[11px] font-mono font-bold tracking-wider">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    <span>
                      {personalizationEnabled
                        ? `${t('VIP UNIVERSE SPOTLIGHT', 'اکران اختصاصی VIP')} · ${hero.score}% MATCH`
                        : t('EDITORIAL SPOTLIGHT', 'اکران برگزیده')}
                    </span>
                  </span>
                </div>

                <h1 className="font-cinzel text-2xl sm:text-4xl font-bold tracking-wide text-[#F5F7FA] leading-tight drop-shadow-md">
                  {cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
                </h1>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3AEC2]">
                  <span className="px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.25)] font-mono text-[10px] font-bold">
                    {hero.item.quality || '4K HDR'}
                  </span>
                  <span className="font-mono-tabular">
                    {formatDuration(hero.item.durationSec)}
                  </span>
                  <span>·</span>
                  <span className="text-slate-300">{t(hero.item.categoryEn, hero.item.categoryFa)}</span>
                  {hero.item.creatorEn || hero.item.creatorFa ? (
                    <span className="hidden sm:inline">
                      · {t(hero.item.creatorEn || hero.item.creatorFa || '', hero.item.creatorFa)}
                    </span>
                  ) : null}
                </div>

                <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed line-clamp-3">
                  {cleanCinemaSynopsis(t(hero.item.synopsisEn, hero.item.synopsisFa))}
                </p>

                <p className="rounded-2xl bg-[#050508]/80 border border-[rgba(212,175,55,0.18)] px-4 py-2.5 text-xs text-[#A3AEC2]">
                  {t(hero.reasonEn, hero.reasonFa)}
                </p>
              </div>

              {/* Action Hierarchy: Primary Wide Glowing Gold CTA + Secondary Frosted Row */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => onPlay(hero.item)}
                  className="w-full h-12 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37] text-[#050508] font-cinzel font-bold text-sm tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.55)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-current stroke-[2]" />
                  <span>
                    {progressMap[hero.item.id] && !progressMap[hero.item.id].completed
                      ? t('Resume Watching', 'ادامه تماشا')
                      : t('Watch Now', 'شروع تماشا')}
                  </span>
                </button>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => onWatchTrailer(hero.item)}
                    className="h-10 inline-flex flex-col items-center justify-center rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-300 hover:text-[#D4AF37] transition-all cursor-pointer"
                    title={t('Watch Trailer', 'تریلر')}
                  >
                    <Clapperboard className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-[9px] tracking-tight mt-0.5">{t('Trailer', 'تریلر')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownload(hero.item)}
                    className="h-10 inline-flex flex-col items-center justify-center rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-300 hover:text-[#D4AF37] transition-all cursor-pointer"
                    title={t('Download', 'دانلود')}
                  >
                    <Download className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-[9px] tracking-tight mt-0.5">{t('Save', 'ذخیره')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDetail(hero.item)}
                    className="h-10 inline-flex flex-col items-center justify-center rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-300 hover:text-[#D4AF37] transition-all cursor-pointer"
                    title={t('Details', 'شناسنامه')}
                  >
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-[9px] tracking-tight mt-0.5">{t('Dossier', 'شناسنامه')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('discover')}
                    className="h-10 inline-flex flex-col items-center justify-center rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#050508]/70 hover:bg-[#151722] hover:border-[#D4AF37] text-slate-300 hover:text-[#D4AF37] transition-all cursor-pointer"
                    title={t('Discover 3D Map', 'کاوش ۳بعدی')}
                  >
                    <Compass className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-[9px] tracking-tight mt-0.5">{t('3D Map', 'فضای ۳بعدی')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Marquee Cinema Poster Showcase (From Reference VIP Design) */}
      {hero && (
        <section className="py-2 flex justify-center">
          <GoldenMarqueePoster
            item={hero.item}
            titleOverride={cleanCinemaTitle(t(hero.item.titleEn, hero.item.titleFa))}
            onClick={() => onOpenDetail(hero.item)}
          />
        </section>
      )}

      {layout.continueWatching.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-[#F5F7FA]">
                {t('Continue Watching', 'ادامه تماشا')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {t('Pick up right where you paused', 'بازگشت دقیق به آخرین لحظه‌ای که توقف کردید')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('library')}>
              {t('Full History', 'تمام سابقه در کتابخانه')}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {layout.continueWatching.map(({ item, progress }) => {
              const pct = Math.min(100, Math.round((progress.positionSec / progress.durationSec) * 100));
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-[#0D101A] p-3 hover:border-[#F5B942]/45 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onPlay(item)}
                    className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[#151A28] cursor-pointer"
                  >
                    <img
                      src={item.posterUrl}
                      alt={t(item.titleEn, item.titleFa)}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <Play className="h-5 w-5 text-[#F5B942] fill-current" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(item)}
                      className="block truncate text-sm font-semibold text-[#F5F7FA] hover:text-[#F5B942] cursor-pointer text-start w-full"
                    >
                      {t(item.titleEn, item.titleFa)}
                    </button>
                    <p dir="ltr" className="text-[11px] font-mono-tabular text-[#A3AEC2]">
                      {formatDuration(progress.positionSec)} / {formatDuration(progress.durationSec)} ({pct}%)
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#F5B942]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {renderShelf(
        personalizationEnabled ? 'Recommended for You' : 'Platform Highlights',
        personalizationEnabled ? 'پیشنهاد ویژه برای شما' : 'برگزیده‌های عمومی پلتفرم',
        personalizationEnabled
          ? 'Live-ranked via internal 6D cosine similarity and your interactions'
          : 'General editorial order',
        personalizationEnabled
          ? 'چیدمان زنده بر پایه بردار ۶بعدی سلیقه و بازخوردهای شما'
          : 'چیدمان عمومی بدون پروفایل سلیقه',
        layout.recommendedForYou
      )}

      {collections.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-[#0D101A] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#F5B942]/15 text-[#F5B942] flex items-center justify-center shrink-0">
              <FolderHeart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F5F7FA]">
                {t('Your Collections', 'مجموعه‌های شخصی شما')}
              </h2>
              <p className="text-xs text-[#A3AEC2]">
                {collections.map((c) => `${c.name} (${c.itemIds.length})`).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onNavigate('library')}>
              {t('Library & Downloads', 'کتابخانه و دانلودها')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('settings')}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('Tune Preferences', 'تنظیمات سلیقه')}
            </Button>
          </div>
        </section>
      )}

      {/* Free Forever vs Paid Competitors Subscription Savings Calculator */}
      <SavingsCalculatorCard />

      {/* Non-intrusive Crypto Sponsor Banner (No KYC) */}
      <div className="py-2">
        <CryptoAdBanner unitType="banner-728x90" lang={lang === 'fa' ? 'fa' : 'en'} />
      </div>

      {renderShelf(
        'New Discoveries',
        'کشف‌های تازه',
        'Unwatched titles aligned closely with your current trajectory',
        'آثاری که هنوز ندیده‌اید اما نزدیک به روحیه شما هستند',
        layout.newDiscoveries
      )}

      {renderShelf(
        'Hidden Gems',
        'جواهرهای کم‌دیده',
        'High-craft selections curated for depth rather than clicks',
        'آثار با عمق بصری و روایی بالا خارج از فهرست‌های تکراری',
        layout.hiddenGems
      )}

      {renderShelf(
        'Explore Something Different',
        'پنجره تجربه متفاوت',
        'Deliberately contrasting picks to keep discovery alive',
        'خروج آگاهانه از دایره تکراری و کشف ژانرهای تازه',
        layout.exploreDifferent
      )}

      {renderShelf(
        'Recently Added',
        'تازه اضافه‌شده به جهان',
        'Latest curated arrivals in your universe',
        'جدیدترین آثار اضافه‌شده به آرشیو',
        layout.recentlyAdded
      )}
    </div>
  );
}
