import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Compass,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ExplainedRecommendation,
  FeedbackRecord,
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  SearchFilterState,
  TasteVector6D,
  WatchProgressEntry
} from '../types';
import { blendVector, cosineSimilarity6D, runIntelligentSearch } from '../tasteEngine';
import { useT } from '../i18n';
import { Button, MediaCard } from '../components/UiPrimitives';
import { NetflixTop10Carousel } from '../../components/NetflixTop10Carousel';
import { globalCinemaAgent } from '../../services/globalCinemaAgent';

interface IntelligentSearchScreenProps {
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
  filters: SearchFilterState;
  onChangeFilters: (next: SearchFilterState) => void;
  onPersonalizeTaste?: (targetVector: TasteVector6D, alpha?: number, note?: string) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onFeedback: (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => void;
  onHide: (item: PrototypeMediaItem) => void;
}

interface AiQuestionOption {
  id: string;
  labelEn: string;
  labelFa: string;
  subEn: string;
  subFa: string;
  targetVector: TasteVector6D;
  mode?: SearchFilterState['mode'];
  maxDurationMin?: number | null;
  minQuality?: SearchFilterState['minQuality'];
  sortBy?: SearchFilterState['sortBy'];
  queryAppend?: string;
}

interface AiAppliedSignal {
  id: string;
  labelEn: string;
  labelFa: string;
  targetVector: TasteVector6D;
}

const QUICK_SPARKS = [
  { q: 'باران', en: 'Rainy Noir', fa: 'نوار بارانی' },
  { q: 'tokyo', en: 'Neon Tokyo', fa: 'توکیو نئونی' },
  { q: 'آرام', en: 'Quiet Sanctuary', fa: 'آرامش و خلوت' },
  { q: 'سورئال', en: 'Surreal Dream', fa: 'رؤیای سورئال' },
  { q: 'انیمیشن', en: 'Adult Animation', fa: 'انیمیشن بزرگسال' },
  { q: 'صدا', en: 'Binaural Audio', fa: 'صدا و اتمسفر' }
];

export interface CinemaMoodCard {
  id: string;
  icon: string;
  titleEn: string;
  titleFa: string;
  descEn: string;
  descFa: string;
  query: string;
  targetVector: TasteVector6D;
  bgGradient: string;
  glowBorder: string;
  accentColor: string;
}

export const CINEMA_MOOD_CARDS: CinemaMoodCard[] = [
  {
    id: 'noir-rain',
    icon: '🌧️',
    titleEn: 'Rainy Noir & Mystery',
    titleFa: 'نوار بارانی و معمایی',
    descEn: 'Deep shadows, tension, wet asphalt',
    descFa: 'سایه‌های عمیق، ریتم معلق و باران شبانه',
    query: 'باران',
    targetVector: { tension: 0.92, pace: 0.35, surrealism: 0.45, nocturnal: 0.98, intimacy: 0.60, depth: 0.90 },
    bgGradient: 'from-[#0B132B]/85 via-[#1C2541]/50 to-[#050508]',
    glowBorder: 'border-cyan-500/30 hover:border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    accentColor: '#38BDF8'
  },
  {
    id: 'cyber-tokyo',
    icon: '🌆',
    titleEn: 'Cyberpunk & Neon Futures',
    titleFa: 'سایبرپانک و توکیو نئونی',
    descEn: 'High-tech dystopias, synth wave, neon glow',
    descFa: 'آینده دور، آسمان‌خراش‌های نئونی و ریتم الکترونیک',
    query: 'سایبرپانک',
    targetVector: { tension: 0.85, pace: 0.85, surrealism: 0.80, nocturnal: 0.95, intimacy: 0.45, depth: 0.75 },
    bgGradient: 'from-[#2E0854]/85 via-[#180B2B]/50 to-[#050508]',
    glowBorder: 'border-fuchsia-500/30 hover:border-fuchsia-400/60 shadow-[0_0_20px_rgba(217,70,239,0.15)]',
    accentColor: '#E879F9'
  },
  {
    id: 'velvet-intimacy',
    icon: '🕯️',
    titleEn: 'Velvet Intimacy & Calm',
    titleFa: 'درام صمیمی و آرامش',
    descEn: 'Warm light, poetic stillness, deep conversations',
    descFa: 'اتمسفر گرم، خلوت شاعرانه و قصه‌های عمیق',
    query: 'آرام',
    targetVector: { tension: 0.35, pace: 0.25, surrealism: 0.40, nocturnal: 0.85, intimacy: 0.95, depth: 0.88 },
    bgGradient: 'from-[#3B1F0B]/85 via-[#221307]/50 to-[#050508]',
    glowBorder: 'border-amber-500/30 hover:border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    accentColor: '#F59E0B'
  },
  {
    id: 'surreal-mind',
    icon: '🌌',
    titleEn: 'Surreal & Mind-Bending',
    titleFa: 'سورئال و ماورایی',
    descEn: 'Cosmic mazes, alternate realities, lucid dreams',
    descFa: 'هزارتوهای ذهنی، مرز رؤیا و واقعیت، شوک فکری',
    query: 'سورئال',
    targetVector: { tension: 0.70, pace: 0.45, surrealism: 0.98, nocturnal: 0.80, intimacy: 0.55, depth: 0.95 },
    bgGradient: 'from-[#140B34]/85 via-[#0A1A2F]/50 to-[#050508]',
    glowBorder: 'border-purple-500/30 hover:border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    accentColor: '#C084FC'
  },
  {
    id: 'kinetic-action',
    icon: '⚡',
    titleEn: 'Fast-Paced Action & Kinetic',
    titleFa: 'اکشن سریع و آدرنالین',
    descEn: 'Adrenaline rushes, relentless tempo, martial mastery',
    descFa: 'مبارزات نفس‌گیر، هیجان بی‌وقفه و شتاب بالا',
    query: 'اکشن',
    targetVector: { tension: 0.95, pace: 0.95, surrealism: 0.40, nocturnal: 0.70, intimacy: 0.30, depth: 0.65 },
    bgGradient: 'from-[#450A0A]/85 via-[#260505]/50 to-[#050508]',
    glowBorder: 'border-rose-500/30 hover:border-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    accentColor: '#FB7185'
  }
];

export const AI_CONCIERGE_PILLS = [
  {
    id: 'pill-masterpiece',
    emoji: '🔥',
    titleEn: 'Masterpieces Rated 8.5+',
    titleFa: 'شاهکارهای سینمایی بالای ۸.۵',
    query: 'شاهکار',
    vector: { tension: 0.85, pace: 0.6, surrealism: 0.7, nocturnal: 0.9, intimacy: 0.8, depth: 0.98 }
  },
  {
    id: 'pill-weekend',
    emoji: '🍿',
    titleEn: 'Weekend Blockbusters',
    titleFa: 'هیجان و سرگرمی آخر هفته',
    query: 'مهیج',
    vector: { tension: 0.9, pace: 0.9, surrealism: 0.5, nocturnal: 0.8, intimacy: 0.4, depth: 0.7 }
  },
  {
    id: 'pill-nolan',
    emoji: '🧠',
    titleEn: 'Mind-Bending Christopher Nolan Style',
    titleFa: 'معمایی و شوک فکری شبیه نولان',
    query: 'معمایی',
    vector: { tension: 0.88, pace: 0.65, surrealism: 0.95, nocturnal: 0.85, intimacy: 0.5, depth: 0.95 }
  }
];

const EXCLUDABLE_TAGS = [
  { tag: 'animation', fa: 'بدون انیمیشن', en: 'No Animation' },
  { tag: 'fast-paced', fa: 'بدون ریتم تند', en: 'No Fast-Paced' },
  { tag: 'surreal', fa: 'بدون سورئال', en: 'No Surreal' },
  { tag: 'cyber', fa: 'بدون سایبرپانک', en: 'No Cyber' }
];

function detectTopicContext(query: string): {
  key: 'rain' | 'neon' | 'calm' | 'surreal' | 'noir' | 'animation' | 'general';
  echoLabel: string;
} {
  const q = query.trim().toLowerCase();
  if (/rain|باران|wet|storm|نوار بارانی/.test(q)) return { key: 'rain', echoLabel: query.trim() };
  if (/tokyo|neon|cyber|نئون|توکیو|سایبر/.test(q)) return { key: 'neon', echoLabel: query.trim() };
  if (/calm|slow|asmr|binaural|sound|whisper|آرام|صدا|ملایم/.test(q)) return { key: 'calm', echoLabel: query.trim() };
  if (/surreal|dream|abstract|سورئال|رؤیا/.test(q)) return { key: 'surreal', echoLabel: query.trim() };
  if (/anim|انیمیشن|انیمه/.test(q)) return { key: 'animation', echoLabel: query.trim() };
  if (/noir|tension|shadow|mystery|نوار|تنش|معما/.test(q)) return { key: 'noir', echoLabel: query.trim() };
  return { key: 'general', echoLabel: query.trim() };
}

function parseFreeformReplyToSignal(text: string): {
  vector: TasteVector6D;
  patch: Partial<SearchFilterState>;
} {
  const lower = text.toLowerCase();
  const vector: TasteVector6D = {
    tension: 0.6,
    pace: 0.45,
    surrealism: 0.55,
    nocturnal: 0.8,
    intimacy: 0.65,
    depth: 0.78
  };
  const patch: Partial<SearchFilterState> = {};

  if (/آرام|ملایم|خلوت|calm|slow|quiet|soft|gentle|ambient|chill/.test(lower)) {
    vector.pace = 0.22;
    vector.tension = 0.35;
    vector.intimacy = 0.85;
  }
  if (/تند|هیجان|پرانرژی|fast|intense|kinetic|action|energy/.test(lower)) {
    vector.pace = 0.88;
    vector.tension = 0.85;
  }
  if (/شب|تاریک|باران|سایه|night|dark|noir|rain|midnight/.test(lower)) {
    vector.nocturnal = 0.96;
    vector.tension = Math.max(vector.tension, 0.76);
  }
  if (/صمیمی|رمانتیک|نزدیک|intimate|velvet|warm|close/.test(lower)) {
    vector.intimacy = 0.95;
    vector.depth = 0.82;
  }
  if (/سورئال|خیالی|عجیب|surreal|dream|art|abstract/.test(lower)) {
    vector.surrealism = 0.94;
    vector.depth = 0.9;
  }
  if (/کوتاه|سریع|short|quick|brief/.test(lower)) {
    patch.maxDurationMin = 8;
    patch.sortBy = 'duration_asc';
  }
  if (/4k|کیفیت|واضح|hdr/.test(lower)) {
    patch.minQuality = '4K';
  }
  if (/جدید|متفاوت|تازه|new|different|fresh|surprise/.test(lower)) {
    patch.mode = 'different';
  }

  return { vector, patch };
}

export function IntelligentSearchScreen({
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
  filters,
  onChangeFilters,
  onPersonalizeTaste,
  onOpenDetail,
  onPlay,
  onDownload,
  onToggleFavorite,
  onFeedback,
  onHide
}: IntelligentSearchScreenProps) {
  const { t } = useT();
  const [aiReplyInput, setAiReplyInput] = useState('');
  const [aiSignals, setAiSignals] = useState<AiAppliedSignal[]>([]);
  const [aiStep, setAiStep] = useState<number>(0);
  const [aiDismissed, setAiDismissed] = useState(false);
  const [aiManualOpen, setAiManualOpen] = useState(false);
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(4);
  const [globalSearchResults, setGlobalSearchResults] = useState<PrototypeMediaItem[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);

  // Live World Cinema Search across global movie & series database
  useEffect(() => {
    const q = filters.query?.trim();
    if (!q || q.length < 2) {
      setGlobalSearchResults([]);
      setIsGlobalSearching(false);
      return;
    }

    let active = true;
    setIsGlobalSearching(true);
    const timer = setTimeout(() => {
      void globalCinemaAgent.searchGlobal(q).then((results) => {
        if (active) {
          setGlobalSearchResults(results);
          setIsGlobalSearching(false);
        }
      });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters.query]);

  const globalRecommendations: ExplainedRecommendation[] = useMemo(() => {
    return globalSearchResults.map((item) => ({
      item,
      score: 98,
      reasonEn: `Live Global Cinema Match (${item.releaseYear})`,
      reasonFa: `نمایش زنده از کاتالوگ بین‌المللی سینما (${item.releaseYear})`
    }));
  }, [globalSearchResults]);

  // Live effective taste vector blended with everything user clicked/typed right here
  const liveVector = useMemo(() => {
    return aiSignals.reduce((acc, sig) => blendVector(acc, sig.targetVector, 0.42), userVector);
  }, [userVector, aiSignals]);

  const queryActive = filters.query.trim().length > 0;
  const isAiCardOpen = !aiDismissed && (aiManualOpen || (aiSignals.length > 0 && !queryActive));

  const topicCtx = useMemo(() => detectTopicContext(filters.query), [filters.query]);

  // Build real-time AI clarifying question + dynamically personalized options
  const aiPromptData = useMemo(() => {
    const qText = topicCtx.echoLabel || t('your mood', 'حال‌وهوای موردنظرت');
    const replyHint = aiReplyInput.trim();

    let questionEn = '';
    let questionFa = '';
    let baseOptions: AiQuestionOption[] = [];

    if (aiStep % 3 === 0) {
      if (topicCtx.key === 'rain') {
        questionEn = `For "${qText}", which nocturnal atmosphere feels closest right now?`;
        questionFa = `برای حال‌وهوای «${qText}»، الان کدام فضا بیشتر با مود تو می‌خواند؟`;
      } else if (topicCtx.key === 'neon') {
        questionEn = `Inside "${qText}", should we lean toward kinetic energy or misty solitude?`;
        questionFa = `در دنیای «${qText}»، ریتم پرانرژی می‌خواهی یا خلوت نئونی و آرام؟`;
      } else if (topicCtx.key === 'calm') {
        questionEn = `For "${qText}", what sensory texture calms your focus most?`;
        questionFa = `برای حس «${qText}»، چه نوع فضا و صدایی بیشتر آرامت می‌کند؟`;
      } else if (queryActive) {
        questionEn = `What exact vibe are you hoping to feel inside "${qText}"?`;
        questionFa = `از جست‌وجوی «${qText}» دنبال چه حس‌وحال دقیق‌تری هستی؟`;
      } else {
        questionEn = 'Tell me how your night feels — every choice personalizes your stream live:';
        questionFa = 'الان چه حال‌وهوایی می‌خواهی؟ هر انتخاب، نتایج را در لحظه برای تو می‌چیند:';
      }

      baseOptions = [
        {
          id: 'opt-hypnotic',
          labelEn: 'Rain-soaked Noir & Deep Mystery',
          labelFa: 'نوار بارانی و رمزآلود',
          subEn: 'Slow shadows, high tension',
          subFa: 'سایه‌های عمیق و ریتم مرموز',
          targetVector: { tension: 0.9, pace: 0.3, surrealism: 0.48, nocturnal: 0.96, intimacy: 0.58, depth: 0.92 },
          mode: 'similar'
        },
        {
          id: 'opt-velvet',
          labelEn: 'Warm Velvet & Intimate Quiet',
          labelFa: 'صمیمی، گرم و مخملی',
          subEn: 'Close framing, unhurried',
          subFa: 'قاب‌بندی نزدیک و اتمسفر نرم',
          targetVector: { tension: 0.42, pace: 0.25, surrealism: 0.45, nocturnal: 0.88, intimacy: 0.96, depth: 0.84 },
          mode: 'similar'
        },
        {
          id: 'opt-electric',
          labelEn: 'Kinetic Neon & Bold Rhythm',
          labelFa: 'نئون پرانرژی و ریتم تند',
          subEn: 'City lights, crisp motion',
          subFa: 'نورهای شهری و حرکت سریع',
          targetVector: { tension: 0.82, pace: 0.88, surrealism: 0.72, nocturnal: 0.94, intimacy: 0.48, depth: 0.78 }
        },
        {
          id: 'opt-surreal',
          labelEn: 'Dreamlike Surreal Cinema',
          labelFa: 'سینمای رؤیایی و سورئال',
          subEn: 'Abstract poetry, fresh angles',
          subFa: 'تصویرسازی شاعرانه و متفاوت',
          targetVector: { tension: 0.38, pace: 0.34, surrealism: 0.96, nocturnal: 0.74, intimacy: 0.62, depth: 0.94 },
          mode: 'different'
        }
      ];
    } else if (aiStep % 3 === 1) {
      questionEn = queryActive
        ? `How long and intense should "${qText}" be tonight?`
        : 'How should the pace, duration, and clarity feel right now?';
      questionFa = queryActive
        ? `مدت‌زمان و شدت ریتم برای «${qText}» چطور باشد بهتر است؟`
        : 'مدت‌زمان و کیفیت تصویر موردنظرت را انتخاب کن:';

      baseOptions = [
        {
          id: 'opt-short-dive',
          labelEn: 'Short & Immersive (Under 10m)',
          labelFa: 'کوتاه و متمرکز (زیر ۱۰ دقیقه)',
          subEn: 'Quick escape right now',
          subFa: 'شروع سریع و بی‌مقدمه',
          targetVector: { ...liveVector, pace: 0.62 },
          maxDurationMin: 10,
          sortBy: 'duration_asc'
        },
        {
          id: 'opt-4k-cinema',
          labelEn: 'Pure 4K HDR Reference Visuals',
          labelFa: 'فقط کیفیت مرجع 4K HDR',
          subEn: 'Ultra-crisp master clarity',
          subFa: 'بالاترین وضوح تصویر و نور',
          targetVector: { ...liveVector, depth: 0.92 },
          minQuality: '4K'
        },
        {
          id: 'opt-slow-drift',
          labelEn: 'Unhurried Slow-Burn Flow',
          labelFa: 'ریتم آهسته و عمیق',
          subEn: 'Zero rush, hypnotic audio',
          subFa: 'بدون شتاب، غوطه‌ور در فضا',
          targetVector: { ...liveVector, pace: 0.22, intimacy: 0.82 },
          maxDurationMin: null
        },
        {
          id: 'opt-fresh-unwatched',
          labelEn: 'Surprise Me (Unwatched Only)',
          labelFa: 'کشف تازه (فقط دیده‌نشده‌ها)',
          subEn: 'Fresh angles outside habit',
          subFa: 'پیشنهادهای تازه و متفاوت',
          targetVector: { ...liveVector, surrealism: Math.min(0.95, liveVector.surrealism + 0.18) },
          mode: 'different'
        }
      ];
    } else {
      questionEn = 'Want to refine even further, or lock in this personalized mix?';
      questionFa = 'می‌خواهی ترکیب شخصی‌سازی‌شده‌ات را دقیق‌تر کنم؟';

      baseOptions = [
        {
          id: 'opt-deeper-match',
          labelEn: 'Lock Tightest Taste Match',
          labelFa: 'قفل روی دقیق‌ترین تطابق سلیقه',
          subEn: 'Prioritize strongest similarity',
          subFa: 'بالاترین درصد شباهت به تو',
          targetVector: liveVector,
          mode: 'similar',
          sortBy: 'relevance'
        },
        {
          id: 'opt-newest',
          labelEn: 'Fresh Arrivals Matching This',
          labelFa: 'تازه‌ترین آثار منطبق با این حس',
          subEn: 'Newest uploads first',
          subFa: 'جدیدترین‌ها در صدر لیست',
          targetVector: liveVector,
          sortBy: 'recent'
        },
        {
          id: 'opt-wild-card',
          labelEn: 'Contrast Twist (Unexpected)',
          labelFa: 'چرخش غیرمنتظره و متفاوت',
          subEn: 'Break the usual pattern',
          subFa: 'پیشنهاد غافلگیرکننده خارج از عادت',
          targetVector: {
            tension: 1 - liveVector.tension * 0.5,
            pace: 1 - liveVector.pace * 0.5,
            surrealism: 0.9,
            nocturnal: liveVector.nocturnal,
            intimacy: 0.72,
            depth: 0.88
          },
          mode: 'different'
        }
      ];
    }

    // Dynamically personalize options IN REAL TIME while the user is typing in the inline reply box too!
    if (replyHint.length >= 2) {
      const parsedHint = parseFreeformReplyToSignal(replyHint);
      const customLiveOption: AiQuestionOption = {
        id: `live-typed-${replyHint}`,
        labelEn: `Personalize for "${replyHint}"`,
        labelFa: `شخصی‌سازی لحظه‌ای برای «${replyHint}»`,
        subEn: 'Generated live from your typed answer',
        subFa: 'ساخته‌شده در لحظه از پاسخ تایپ‌شده تو',
        targetVector: parsedHint.vector,
        ...parsedHint.patch
      };
      baseOptions = [customLiveOption, ...baseOptions.slice(0, 3)];
    }

    // Score & re-order options dynamically against the user's live taste vector
    const rankedOptions = baseOptions
      .map((opt, idx) => {
        const sim = cosineSimilarity6D(liveVector, opt.targetVector);
        const affinityPct = Math.max(68, Math.min(99, Math.round(sim * 100)));
        return { opt, affinityPct, isTypedCustom: idx === 0 && replyHint.length >= 2 };
      })
      .sort((a, b) => {
        if (a.isTypedCustom !== b.isTypedCustom) return a.isTypedCustom ? -1 : 1;
        return b.affinityPct - a.affinityPct;
      });

    return { questionEn, questionFa, rankedOptions };
  }, [topicCtx, queryActive, aiStep, aiReplyInput, liveVector, t]);

  const grouped = useMemo(
    () =>
      runIntelligentSearch({
        catalog,
        filters,
        userVector: liveVector,
        personalizationEnabled,
        progressMap,
        hiddenIds,
        blockedTopics,
        feedbackMap,
        lang
      }),
    [
      catalog,
      filters,
      liveVector,
      personalizationEnabled,
      progressMap,
      hiddenIds,
      blockedTopics,
      feedbackMap,
      lang
    ]
  );

  const fallbackMatches: ExplainedRecommendation[] = useMemo(() => {
    if (grouped.totalCount > 0 || globalSearchResults.length > 0) return [];
    return [...catalog]
      .map((item) => {
        const score = Math.max(
          65,
          Math.min(99, Math.round(cosineSimilarity6D(liveVector, item.vector) * 100))
        );
        return {
          item,
          score,
          reasonEn: `Closest thematic & mood match to your request (${score}% resonance)`,
          reasonFa: `نزدیک‌ترین تطابق حس‌وحال و اتمسفر با سلیقه شما (${score}٪ هم‌پوشانی)`
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [grouped.totalCount, globalSearchResults.length, catalog, liveVector]);

  const handleSelectMoodCard = (card: CinemaMoodCard) => {
    setAiDismissed(false);
    onChangeFilters({ ...filters, query: card.query });
    onPersonalizeTaste?.(card.targetVector, 0.45, card.titleEn);
  };

  const handleSelectConciergePill = (pill: (typeof AI_CONCIERGE_PILLS)[0]) => {
    setAiDismissed(false);
    onChangeFilters({ ...filters, query: pill.query });
    onPersonalizeTaste?.(pill.vector, 0.45, pill.titleEn);
  };

  const handleSelectAiOption = (opt: AiQuestionOption) => {
    setAiSignals((prev) => [
      ...prev.filter((s) => s.id !== opt.id),
      { id: opt.id, labelEn: opt.labelEn, labelFa: opt.labelFa, targetVector: opt.targetVector }
    ]);
    setAiStep((s) => s + 1);
    setAiDismissed(false);

    const nextFilters: SearchFilterState = { ...filters };
    if (opt.mode) nextFilters.mode = opt.mode;
    if (opt.maxDurationMin !== undefined) nextFilters.maxDurationMin = opt.maxDurationMin;
    if (opt.minQuality) nextFilters.minQuality = opt.minQuality;
    if (opt.sortBy) nextFilters.sortBy = opt.sortBy;
    onChangeFilters(nextFilters);

    onPersonalizeTaste?.(opt.targetVector, 0.34, opt.labelEn);
  };

  const handleSubmitAiReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = aiReplyInput.trim();
    if (!text) return;

    const { vector, patch } = parseFreeformReplyToSignal(text);
    const sigId = `reply-${Date.now()}`;
    setAiSignals((prev) => [
      ...prev,
      {
        id: sigId,
        labelEn: text,
        labelFa: text,
        targetVector: vector
      }
    ]);
    onChangeFilters({
      ...filters,
      ...patch
    });
    onPersonalizeTaste?.(vector, 0.4, text);
    setAiReplyInput('');
    setAiStep((s) => s + 1);
  };

  const handleRemoveSignal = (sigId: string) => {
    setAiSignals((prev) => prev.filter((s) => s.id !== sigId));
  };

  const resetAllFilters = () => {
    onChangeFilters({
      query: '',
      mode: 'all',
      excludeTags: [],
      maxDurationMin: null,
      minQuality: 'all',
      unwatchedOnly: false,
      sortBy: 'relevance'
    });
    setAiSignals([]);
    setAiReplyInput('');
    setAiStep(0);
    setAiDismissed(false);
    setAiManualOpen(false);
    setVisibleLimit(4);
  };

  const renderBucket = (
    titleEn: string,
    titleFa: string,
    list: ExplainedRecommendation[],
    maxItems?: number
  ) => {
    if (list.length === 0) return null;
    const shown = maxItems ? list.slice(0, maxItems) : list;
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7FA]">
            {t(titleEn, titleFa)}{' '}
            <span dir="ltr" className="text-xs font-mono-tabular text-[#A3AEC2]">
              ({list.length})
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
          {shown.map((rec) => (
            <MediaCard
              key={`${titleEn}-${rec.item.id}`}
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
    <div className="space-y-7 pb-10">
      {/* Netflix-Style Live Top 10 Trending Movies, Series & Anime (only in discovery mode) */}
      {!queryActive && (
        <div id="tour-step-top10" className="w-full">
          <NetflixTop10Carousel
            catalog={catalog}
            onOpenDetail={onOpenDetail}
            onPlay={onPlay}
          />
        </div>
      )}

      {/* Redesigned AI Discovery Search Console (VIP Cinema Mood Concierge & Marquee) */}
      <div className="relative overflow-hidden rounded-[26px] sm:rounded-[32px] border border-[rgba(212,175,55,0.25)] bg-[#0B0C10] p-5 sm:p-7 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.95),0_0_24px_rgba(212,175,55,0.08)] space-y-5">
        {/* Ambient radial highlight */}
        <div
          className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-52 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }}
        />

        {/* Marquee Concierge Header Row */}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold tracking-widest text-[#D4AF37] uppercase">
              <Wand2 className="h-3.5 w-3.5 animate-pulse" />
              <span>{t('MOOD CONCIERGE & MARQUEE // AI PETROS', 'میزبان هوشمند و موود سینمایی')}</span>
            </div>
            <h1 className="font-cinzel text-xl sm:text-3xl font-bold tracking-wide text-[#F5F7FA]">
              {t('Describe a Mood, Scene, or Feeling', 'هر حال‌وهوا، صحنه یا حسی را بنویسید')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTechSpecs((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">{t('Specs', 'دقیق‌تر')}</span>
            </Button>
          </div>
        </div>

        {/* Main Search Input with Glowing Golden Aura */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute start-4 h-5 w-5 text-[#D4AF37]" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => {
              setAiDismissed(false);
              onChangeFilters({ ...filters, query: e.target.value });
            }}
            placeholder={t(
              'Type anything (e.g. rainy noir, neon tokyo, quiet sanctuary, cyberpunk)...',
              'شروع به تایپ کن (مثلاً: نوار بارانی، توکیو نئونی، آرام، سورئال)...'
            )}
            className="w-full min-h-[54px] rounded-full border border-[rgba(212,175,55,0.3)] bg-[#050508] ps-12 pe-14 text-base sm:text-sm text-[#F5F7FA] placeholder:text-[#7A869F] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)] focus:border-[#D4AF37] focus:shadow-[0_0_24px_rgba(212,175,55,0.35)] focus-visible:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => {
                onChangeFilters({ ...filters, query: '' });
              }}
              aria-label="Clear search"
              className="absolute end-3 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-full text-[#A3AEC2] hover:text-[#D4AF37] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Inspiration Sparks as Luxury Marquee Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap">
          <span className="text-[11px] font-mono text-[#D4AF37] inline-flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
            <Compass className="h-3.5 w-3.5 text-[#D4AF37]" />
            {t('Spark Mood:', 'موودهای پیشنهادی:')}
          </span>
          {QUICK_SPARKS.map((sp) => (
            <button
              key={sp.q}
              type="button"
              onClick={() => {
                setAiDismissed(false);
                onChangeFilters({ ...filters, query: sp.q });
              }}
              className={`min-h-[34px] shrink-0 rounded-full border px-4 text-xs font-medium transition-all cursor-pointer ${
                filters.query.toLowerCase() === sp.q.toLowerCase()
                  ? 'border-[#D4AF37] bg-[rgba(212,175,55,0.18)] text-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                  : 'border-[rgba(212,175,55,0.22)] bg-[#050508]/80 text-[#CBD5E1] hover:border-[#D4AF37]/60 hover:text-[#D4AF37]'
              }`}
            >
              {t(sp.en, sp.fa)}
            </button>
          ))}
        </div>

        {/* Ask AI Concierge 3-Pill Quick Selector */}
        <div className="pt-2 border-t border-[rgba(212,175,55,0.15)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[#D4AF37] inline-flex items-center gap-1.5 uppercase tracking-wider font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              {t('Ask AI Concierge (Instant Curations):', 'پرسش از کارگردان هوشمند (انتخاب سریع):')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {AI_CONCIERGE_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => handleSelectConciergePill(pill)}
                className="flex items-center gap-2 rounded-xl border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.06)] px-3 py-2 text-start text-xs text-[#F5F7FA] hover:border-[#D4AF37] hover:bg-[rgba(212,175,55,0.14)] transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
              >
                <span className="text-base shrink-0">{pill.emoji}</span>
                <span className="font-medium truncate">{t(pill.titleEn, pill.titleFa)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 1-Tap Glowing Cinema Mood Cards */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#A3AEC2] inline-flex items-center gap-1.5 uppercase tracking-wider">
              {t('Cinema Mood Atmospheres (1-Tap Experience):', 'اتمسفرهای سینمایی (ورود با یک کلیک):')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {CINEMA_MOOD_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelectMoodCard(card)}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card.bgGradient} p-3.5 text-start transition-all cursor-pointer ${card.glowBorder}`}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className="text-2xl">{card.icon}</span>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 uppercase"
                    style={{ color: card.accentColor, backgroundColor: `${card.accentColor}15` }}
                  >
                    {t('Explore', 'انتخاب')}
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-[#F5F7FA] group-hover:text-[#D4AF37] transition-colors truncate">
                  {t(card.titleEn, card.titleFa)}
                </h4>
                <p className="text-[11px] text-[#A3AEC2] line-clamp-1 mt-0.5">
                  {t(card.descEn, card.descFa)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Optional Collapsible Precision Specs Drawer */}
        <AnimatePresence initial={false}>
          {showTechSpecs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  value={filters.maxDurationMin ?? ''}
                  onChange={(e) =>
                    onChangeFilters({
                      ...filters,
                      maxDurationMin: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  className="min-h-[42px] rounded-2xl border border-white/12 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                >
                  <option value="">{t('Any Duration', 'همه مدت‌ها')}</option>
                  <option value="7">{t('Under 7 min', 'زیر ۷ دقیقه')}</option>
                  <option value="10">{t('Under 10 min', 'زیر ۱۰ دقیقه')}</option>
                  <option value="15">{t('Under 15 min', 'زیر ۱۵ دقیقه')}</option>
                </select>

                <select
                  value={filters.minQuality}
                  onChange={(e) =>
                    onChangeFilters({
                      ...filters,
                      minQuality: e.target.value as SearchFilterState['minQuality']
                    })
                  }
                  className="min-h-[42px] rounded-2xl border border-white/12 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                >
                  <option value="all">{t('All Resolutions', 'همه کیفیت‌ها')}</option>
                  <option value="4K">4K HDR / 60FPS</option>
                  <option value="1080p">1080p+</option>
                </select>

                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    onChangeFilters({
                      ...filters,
                      sortBy: e.target.value as SearchFilterState['sortBy']
                    })
                  }
                  className="min-h-[42px] rounded-2xl border border-white/12 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                >
                  <option value="relevance">{t('Best Match', 'بیشترین تطابق')}</option>
                  <option value="recent">{t('Most Recent', 'جدیدترین')}</option>
                  <option value="duration_asc">{t('Shortest First', 'کوتاه‌ترین')}</option>
                </select>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilters({ ...filters, unwatchedOnly: !filters.unwatchedOnly })
                    }
                    className={`flex-1 min-h-[42px] rounded-2xl border px-3 text-xs cursor-pointer transition-colors ${
                      filters.unwatchedOnly
                        ? 'border-[#F5B942] bg-[#F5B942]/15 text-[#F5B942]'
                        : 'border-white/12 bg-[#06070C] text-[#A3AEC2]'
                    }`}
                  >
                    {t('Unwatched Only', 'فقط دیده‌نشده‌ها')}
                  </button>
                  <Button variant="ghost" size="sm" onClick={resetAllFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-[#A3AEC2]">{t('Exclude:', 'حذف از نتایج:')}</span>
                  {EXCLUDABLE_TAGS.map((tagItem) => {
                    const active = filters.excludeTags.includes(tagItem.tag);
                    return (
                      <button
                        key={tagItem.tag}
                        type="button"
                        onClick={() =>
                          onChangeFilters({
                            ...filters,
                            excludeTags: active
                              ? filters.excludeTags.filter((x) => x !== tagItem.tag)
                              : [...filters.excludeTags, tagItem.tag]
                          })
                        }
                        className={`min-h-[34px] rounded-full px-3 text-xs cursor-pointer border transition-colors ${
                          active
                            ? 'border-[#EF4444]/50 bg-[#EF4444]/15 text-[#FCA5A5]'
                            : 'border-white/12 bg-[#06070C] text-[#A3AEC2]'
                        }`}
                      >
                        {t(tagItem.en, tagItem.fa)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Global Agent Searching Indicator */}
      {isGlobalSearching && (
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-[#F5B942] animate-ping" />
          <span className="text-xs text-[#F5B942] font-mono">
            {t('AI Agent searching all global movies & series...', 'ایجنت در حال جستجو در آرشیو تمام فیلم‌ها و سریال‌های جهان...')}
          </span>
        </div>
      )}

      {/* World Cinema Live Search Results */}
      {globalRecommendations.length > 0 && (
        <div className="space-y-6 pt-2">
          {renderBucket(
            'World Cinema Live Showcase',
            'آرشیو بین‌المللی فیلم و سریال‌های جهان',
            globalRecommendations
          )}
        </div>
      )}

      {/* Live Results Showcase */}
      {grouped.totalCount === 0 && globalRecommendations.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#13141C] to-[#08090E] p-6 sm:p-8 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(212,175,55,0.1)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.35)] shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-xl mx-auto">
              <h2 className="font-cinzel text-lg sm:text-xl font-bold text-[#F5F7FA]">
                {t('Closest AI Thematic Matches & Trending Masterpieces', 'نزدیک‌ترین فیلم‌های سینما پتروس به حال‌وهوای درخواستی شما')}
              </h2>
              <p className="text-xs sm:text-sm text-[#A3AEC2] leading-relaxed">
                {t(
                  'No film is hidden under strict constraints! Our VIP Concierge surfaced the closest cinematic matches and top-rated masterworks for you:',
                  'هیچ درِ بسته‌ای در سینما پتروس وجود ندارد! اگرچه اثری با این مشخصات بسیار دقیق ثبت نشده، نزدیک‌ترین شاهکارهای متناسب با اتمسفر مدنظر شما برای تماشا آماده شده است:'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button variant="primary" onClick={resetAllFilters}>
                <RotateCcw className="h-4 w-4" />
                {t('Reset Filters & Show All Movies', 'پاک‌سازی فیلترها و نمایش همه آثار')}
              </Button>
            </div>
          </div>

          {/* Render Fallback Matches */}
          {fallbackMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.2)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#D4AF37] animate-ping" />
                  <h3 className="text-sm sm:text-base font-semibold text-[#D4AF37]">
                    {t('AI Curated Suggestions for You', 'پیشنهادهای طلایی هوش مصنوعی برای این لحظه')}
                  </h3>
                </div>
                <span dir="ltr" className="text-xs font-mono text-[#D4AF37]/80">
                  {fallbackMatches.length} {t('Masterpieces', 'شاهکار')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
                {fallbackMatches.map((rec) => (
                  <MediaCard
                    key={`fallback-${rec.item.id}`}
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
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {renderBucket('Best Matches', 'بهترین نتایج', grouped.bestMatches, visibleLimit)}

          {grouped.bestMatches.length > visibleLimit && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleLimit((v) => v + 6)}>
                {t('Load More Results', 'نمایش نتایج بیشتر')}
              </Button>
            </div>
          )}

          {renderBucket(
            'Most Relevant to Your Taste',
            'مرتبط با سلیقه لحظه‌ای شما',
            grouped.preferenceRelevant
          )}
          {renderBucket('Recently Added', 'تازه اضافه‌شده', grouped.recentlyAdded)}
          {renderBucket('Similar Content', 'محتوای مشابه', grouped.similarContent)}
          {renderBucket('New Discoveries', 'کشف‌های تازه', grouped.newDiscoveries)}
        </div>
      )}
    </div>
  );
}
