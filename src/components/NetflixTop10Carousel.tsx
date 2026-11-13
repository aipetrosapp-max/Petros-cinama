import React, { useState } from 'react';
import { Flame, Play, Info, Sparkles, Film, Tv, Star } from 'lucide-react';
import { motion } from 'motion/react';
import type { PrototypeMediaItem } from '../prototype/types';
import { useT } from '../prototype/i18n';

interface NetflixTop10CarouselProps {
  catalog: PrototypeMediaItem[];
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlay: (item: PrototypeMediaItem) => void;
}

type Top10Filter = 'all' | 'movie' | 'series' | 'anime';

interface Top10Item {
  rank: number;
  type: 'movie' | 'series' | 'anime';
  titleEn: string;
  titleFa: string;
  year: number;
  quality: string;
  rating: string;
  synopsisEn: string;
  synopsisFa: string;
  posterUrl: string;
  accentHex: string;
  mediaRef?: PrototypeMediaItem;
}

export const NetflixTop10Carousel: React.FC<NetflixTop10CarouselProps> = ({
  catalog,
  onOpenDetail,
  onPlay
}) => {
  const { t } = useT();
  const [activeFilter, setActiveFilter] = useState<Top10Filter>('all');

  // Curated global trending Top 10 items mapped to available media catalog or verified assets
  const top10List: Top10Item[] = [
    {
      rank: 1,
      type: 'movie',
      titleEn: 'Dune: Awakening Matrix',
      titleFa: 'تل‌ماسه: ماتریکس بیداری',
      year: 2026,
      quality: '4K HDR',
      rating: '8.9',
      synopsisEn: 'Epic journey across desert planets combining prophetic visions and galactic warfare.',
      synopsisFa: 'حماسه بزرگ در سیارات کویری با پیوند الهامات بصری و نبرد کهکشانی.',
      posterUrl: catalog[0]?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop',
      accentHex: '#F5B942',
      mediaRef: catalog[0]
    },
    {
      rank: 2,
      type: 'anime',
      titleEn: 'Cyber Requiem: Neo Tokyo',
      titleFa: 'رکوئیم سایبر: توکیو نوین',
      year: 2026,
      quality: '4K 60FPS',
      rating: '9.1',
      synopsisEn: 'A rogue neural net hacker navigates the neon abyss of 2088 Shinjuku.',
      synopsisFa: 'نبرد یک هکر شبکه عصبی در اعماق نئونی و بارانی شینجوکو در سال ۲۰۸۸.',
      posterUrl: catalog[1]?.posterUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop',
      accentHex: '#00F0FF',
      mediaRef: catalog[1]
    },
    {
      rank: 3,
      type: 'series',
      titleEn: 'Midnight Shadows: Berlin',
      titleFa: 'سایه‌های نیمه‌شب: برلین',
      year: 2025,
      quality: '4K HDR',
      rating: '8.7',
      synopsisEn: 'Cold war clandestine audio surveillance tapes resurface in a modern intelligence agency.',
      synopsisFa: 'نوارهای صوتی جاسوسی جنگ سرد در یک آژانس مدرن امنیتی دوباره افشا می‌شوند.',
      posterUrl: catalog[2]?.posterUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop',
      accentHex: '#E11D48',
      mediaRef: catalog[2]
    },
    {
      rank: 4,
      type: 'anime',
      titleEn: 'Solo Resonance: Shadow Monarch',
      titleFa: 'رزونانس سایه‌ها: تک‌رو',
      year: 2026,
      quality: '1080p',
      rating: '9.2',
      synopsisEn: 'A lone hunter awakens ancestral dimensional keys to alter fate itself.',
      synopsisFa: 'شکارچی تنها کلیدهای ابعادی نیاکان را بیدار می‌کند تا سرنوشت را تغییر دهد.',
      posterUrl: catalog[3]?.posterUrl || 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop',
      accentHex: '#8B5CF6',
      mediaRef: catalog[3]
    },
    {
      rank: 5,
      type: 'movie',
      titleEn: 'Solaris Mirage',
      titleFa: 'سراب سولاریس',
      year: 2026,
      quality: '4K HDR',
      rating: '8.6',
      synopsisEn: 'Cosmic research vessel encounters living ocean memories lightyears from Earth.',
      synopsisFa: 'فضاپیمای تحقیقاتی در سال نوری دور از زمین با اقیانوسی زنده از خاطرات روبرو می‌شود.',
      posterUrl: catalog[4]?.posterUrl || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop',
      accentHex: '#10B981',
      mediaRef: catalog[4]
    },
    {
      rank: 6,
      type: 'series',
      titleEn: 'Velvet Samurai: Shogun Blood',
      titleFa: 'سامورایی مخملین: خون شوگان',
      year: 2025,
      quality: '4K HDR',
      rating: '8.8',
      synopsisEn: 'Masterless swordsman defending Kyoto in an alternate feudal cyberpunk timeline.',
      synopsisFa: 'شمشیرزن بی‌استاد در حال دفاع از کیوتو در خط زمانی سایبرپانک فئودالی.',
      posterUrl: catalog[5]?.posterUrl || 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?w=600&auto=format&fit=crop',
      accentHex: '#F59E0B',
      mediaRef: catalog[5]
    },
    {
      rank: 7,
      type: 'anime',
      titleEn: 'Astral Siren & The Void',
      titleFa: 'سایرن اخترشناس و خلاء',
      year: 2026,
      quality: '1080p',
      rating: '8.5',
      synopsisEn: 'Acoustic visual frequencies navigating uncharted celestial constellations.',
      synopsisFa: 'فرکانس‌های صوتی و بصری که در میان صورت‌های فلکی ناشناخته حرکت می‌کنند.',
      posterUrl: catalog[6]?.posterUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop',
      accentHex: '#38BDF8',
      mediaRef: catalog[6]
    },
    {
      rank: 8,
      type: 'movie',
      titleEn: 'Rain Detective: Platform 4',
      titleFa: 'کارآگاه باران: ایستگاه ۴',
      year: 2026,
      quality: '4K HDR',
      rating: '8.4',
      synopsisEn: 'Magnetic tape reels that capture echoes of past conversations in the rain.',
      synopsisFa: 'نوارهای صوتی مغناطیسی که پژواک گفت‌وگوهای گذشته را زیر باران بازسازی می‌کنند.',
      posterUrl: catalog[7]?.posterUrl || catalog[0]?.posterUrl,
      accentHex: '#64748B',
      mediaRef: catalog[7] || catalog[0]
    },
    {
      rank: 9,
      type: 'series',
      titleEn: 'Quantum Oasis: The Protocol',
      titleFa: 'واحه کوانتومی: پروتکل',
      year: 2026,
      quality: '4K HDR',
      rating: '8.8',
      synopsisEn: 'Underground digital underground sanctuary preserving human consciousness.',
      synopsisFa: 'پناهگاه زیرزمینی دیجیتال که آخرین امواج آگاهی انسانی را نگهداری می‌کند.',
      posterUrl: catalog[8]?.posterUrl || catalog[1]?.posterUrl,
      accentHex: '#EC4899',
      mediaRef: catalog[8] || catalog[1]
    },
    {
      rank: 10,
      type: 'anime',
      titleEn: 'Eclipse Bloom: Genesis',
      titleFa: 'شکوفه کسوف: پیدایش',
      year: 2026,
      quality: '4K 60FPS',
      rating: '9.0',
      synopsisEn: 'Bioluminescent flora awakening during solar singularity.',
      synopsisFa: 'رویش گیاهان فسفری در لحظه تکینگی خورشیدی.',
      posterUrl: catalog[9]?.posterUrl || catalog[2]?.posterUrl,
      accentHex: '#A855F7',
      mediaRef: catalog[9] || catalog[2]
    }
  ];

  const filteredItems = top10List.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  const handleCardClick = (item: Top10Item) => {
    if (item.mediaRef) {
      onOpenDetail(item.mediaRef);
    } else if (catalog[0]) {
      onOpenDetail(catalog[0]);
    }
  };

  const handlePlayClick = (e: React.MouseEvent, item: Top10Item) => {
    e.stopPropagation();
    if (item.mediaRef) {
      onPlay(item.mediaRef);
    } else if (catalog[0]) {
      onPlay(catalog[0]);
    }
  };

  return (
    <div className="w-full space-y-4 rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-[#0F1424]/90 via-[#0A0D18]/80 to-transparent border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background Ambience Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-[#F5B942]/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-0 left-10 w-80 h-40 bg-[#00F0FF]/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header with Netflix Style Flame Badge & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E11D48] to-[#F5B942] flex items-center justify-center shadow-lg shadow-[#E11D48]/30">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight">
                {t('Top 10 Trending Worldwide', '۱۰ فیلم، سریال و انیمه برتر ترند جهان')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#E11D48] text-white tracking-widest uppercase">
                LIVE
              </span>
            </div>
            <p className="text-xs text-[#A3AEC2]">
              {t('Swipe horizontally to explore ranking charts', 'برای مشاهده رتبه‌بندی، کارت‌ها را به چپ و راست اسلاید کنید')}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md self-start sm:self-auto overflow-x-auto max-w-full">
          {(
            [
              { id: 'all', en: 'All Top 10', fa: 'همه ۱۰ تا' },
              { id: 'movie', en: 'Movies', fa: 'فیلم‌ها' },
              { id: 'series', en: 'TV Series', fa: 'سریال‌ها' },
              { id: 'anime', en: 'Anime', fa: 'انیمه‌ها' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`min-h-[32px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-gradient-to-r from-[#F5B942] to-[#E5A832] text-[#060810] shadow-md shadow-[#F5B942]/20 font-bold'
                  : 'text-[#A3AEC2] hover:text-white hover:bg-white/5'
              }`}
            >
              {t(tab.en, tab.fa)}
            </button>
          ))}
        </div>
      </div>

      {/* Netflix Horizontal Scrolling Touch Strip with Huge Rank Numbers */}
      <div className="relative -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-4 overflow-x-auto scrollbar-none flex gap-6 sm:gap-8 snap-x snap-mandatory touch-pan-x">
        {filteredItems.map((item) => (
          <motion.div
            key={item.rank}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            onClick={() => handleCardClick(item)}
            className="flex-shrink-0 flex items-end snap-start cursor-pointer group select-none relative"
            style={{ width: '230px' }}
          >
            {/* Massive Netflix-style Rank Number */}
            <div className="relative -mr-5 sm:-mr-7 z-0 pointer-events-none select-none">
              <span
                className="text-[110px] sm:text-[130px] font-black leading-none tracking-tighter"
                style={{
                  WebkitTextStroke: '3px rgba(245, 185, 66, 0.45)',
                  color: '#060810',
                  textShadow: '0 0 20px rgba(245, 185, 66, 0.25)',
                  fontFamily: 'Impact, sans-serif'
                }}
              >
                {item.rank}
              </span>
            </div>

            {/* Poster Card */}
            <div className="relative z-10 w-[160px] sm:w-[175px] h-[240px] sm:h-[260px] rounded-2xl overflow-hidden border border-white/15 bg-[#0D101C] shadow-xl group-hover:border-[#F5B942]/60 group-hover:shadow-[0_10px_25px_rgba(245,185,66,0.2)] transition-all">
              <img
                src={item.posterUrl}
                alt={t(item.titleEn, item.titleFa)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060810] via-black/40 to-transparent" />

              {/* Top Badges */}
              <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-md text-[#F5B942] border border-[#F5B942]/40">
                  TOP {item.rank}
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/15 backdrop-blur-md text-slate-200">
                  {item.quality}
                </span>
              </div>

              {/* Bottom Info & Play Action Button */}
              <div className="absolute bottom-2.5 inset-x-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#CBD5E1]">
                  <span className="capitalize px-1.5 py-0.2 rounded bg-white/10 text-white font-medium">
                    {item.type}
                  </span>
                  <div className="flex items-center gap-0.5 text-[#F5B942] font-bold">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>{item.rating}</span>
                  </div>
                  <span>· {item.year}</span>
                </div>

                <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#F5B942] transition-colors">
                  {t(item.titleEn, item.titleFa)}
                </h4>

                <button
                  type="button"
                  onClick={(e) => handlePlayClick(e, item)}
                  className="w-full min-h-[30px] mt-1.5 rounded-xl bg-[#F5B942] hover:bg-[#E5A832] text-[#060810] text-[11px] font-extrabold flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{t('Play Now', 'پخش مستقیم')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
