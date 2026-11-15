import React, { useState } from 'react';
import { Sparkles, Sliders, Dna, History, RotateCcw, Check, Film } from 'lucide-react';
import type { TasteVector6D, PrototypeMediaItem, WatchProgressEntry, FeedbackRecord } from '../types';
import { useT } from '../i18n';

interface AiTasteDnaPanelProps {
  userVector: TasteVector6D;
  catalog: PrototypeMediaItem[];
  progressMap: Record<string, WatchProgressEntry>;
  feedbackMap: Record<string, FeedbackRecord>;
  favoriteIds: Set<string>;
  onUpdateVector: (newVector: TasteVector6D) => void;
  className?: string;
}

export function AiTasteDnaPanel({
  userVector,
  catalog,
  progressMap,
  feedbackMap,
  favoriteIds,
  onUpdateVector,
  className = ''
}: AiTasteDnaPanelProps) {
  const { t } = useT();

  const [vector, setVector] = useState<TasteVector6D>(userVector);
  const [hasChanges, setHasChanges] = useState(false);

  // 6 Real Dimensions with intuitive explanations
  const dimensions = [
    {
      key: 'tension' as const,
      labelFa: 'هیجان، تنش و تعلیق',
      labelEn: 'Tension & Suspense',
      descFa: 'میزان اضطراب داستانی، هیجان روایی و صحنه‌های پرکشش',
      descEn: 'Narrative thrill, heart-racing conflict and high suspense',
      color: '#EF4444'
    },
    {
      key: 'pace' as const,
      labelFa: 'ریتم و سرعت پیشروی',
      labelEn: 'Pacing & Adrenaline',
      descFa: 'ضرب‌آهنگ داستان از ریتم آرامِ تأمل‌برانگیز تا اکشن پرشتاب',
      descEn: 'From contemplative slow-burn to rapid-fire kinetic editing',
      color: '#F59E0B'
    },
    {
      key: 'surrealism' as const,
      labelFa: 'سورئالیسم و ابعاد فانتزی',
      labelEn: 'Surrealism & Wonder',
      descFa: 'دنیاهای نامتعارف، خطوط زمانی غیرخطی و فضاهای رازآلود',
      descEn: 'Architectural dreamscapes, non-linear time and sci-fi wonder',
      color: '#8B5CF6'
    },
    {
      key: 'nocturnal' as const,
      labelFa: 'اتمسفر شبانه و سایه‌روشن (نوآر)',
      labelEn: 'Nocturnal & Noir Vibe',
      descFa: 'نورپردازی تاریک، کوچه‌های بارانی نئونی و حال‌وهوای نیمه‌شب',
      descEn: 'Low-key lighting, neon rain and late-night atmosphere',
      color: '#38BDF8'
    },
    {
      key: 'intimacy' as const,
      labelFa: 'صمیمیت عاطفی و درام انسانی',
      labelEn: 'Character Intimacy',
      descFa: 'تمرکز بر روابط کاراکترها، احساسات عمیق و قاب‌های صمیمی',
      descEn: 'Chamber dialogues, emotional depth and character focus',
      color: '#EC4899'
    },
    {
      key: 'depth' as const,
      labelFa: 'پیچیدگی معنایی و تفکر فلسفی',
      labelEn: 'Philosophical Depth',
      descFa: 'داستان‌های چندلایه که بعد از پایان فیلم ذهن را درگیر می‌کنند',
      descEn: 'Layered narratives leaving a lingering intellectual resonance',
      color: '#10B981'
    }
  ];

  const handleSliderChange = (key: keyof TasteVector6D, value: number) => {
    const updated = { ...vector, [key]: value };
    setVector(updated);
    setHasChanges(true);
    onUpdateVector(updated);
  };

  const handleResetToCalculated = () => {
    setVector(userVector);
    setHasChanges(false);
    onUpdateVector(userVector);
  };

  // Recent influential items (watched, liked, or favorited)
  const influentialItems = React.useMemo(() => {
    const ids = new Set<string>();
    Object.keys(progressMap).forEach((id) => ids.add(id));
    favoriteIds.forEach((id) => ids.add(id));
    Object.keys(feedbackMap).forEach((id) => ids.add(id));

    return catalog
      .filter((item) => ids.has(item.id))
      .slice(0, 4)
      .map((item) => {
        let reason = 'تماشا شده در سالن اصلی سینما';
        if (favoriteIds.has(item.id)) reason = 'ثبت در علاقه‌مندی‌ها';
        else if (feedbackMap[item.id]?.sentiment === 'like') reason = 'دریافت لایک و بازخورد مثبت';
        return { item, reason };
      });
  }, [catalog, progressMap, feedbackMap, favoriteIds]);

  return (
    <div
      className={`rounded-3xl bg-[#0B0C10]/95 border border-[rgba(212,175,55,0.28)] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_25px_rgba(212,175,55,0.12)] space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(212,175,55,0.18)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.35)] flex items-center justify-center text-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.25)]">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-cinzel text-base sm:text-lg font-black tracking-wider text-[#D4AF37]">
              {t('AI TASTE DNA & EXPLAINABILITY', 'پروفایل هوشمند سلیقه شما (AI Taste DNA)')}
            </h3>
            <p className="text-xs text-[#A3AEC2]">
              {t(
                'Transparent algorithmic weights shaped by your actual views & ratings',
                'تحلیل شفاف و زنده دلایل پیشنهاد فیلم‌ها بر پایه تعاملات و سلیقه واقعی شما'
              )}
            </p>
          </div>
        </div>

        {hasChanges && (
          <button
            type="button"
            onClick={handleResetToCalculated}
            className="px-3.5 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-[#D4AF37]" />
            <span>{t('Reset Tuning', 'بازنشانی')}</span>
          </button>
        )}
      </div>

      {/* 6 Interactive Dimension Sliders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#A3AEC2]">
          <span className="font-mono uppercase tracking-wider flex items-center gap-1.5 text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{t('Manual Algorithm Tuning', 'تنظیم دستی مؤلفه‌های پیشنهاددهنده')}</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400">LIVE SYNCED</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dimensions.map((dim) => {
            const val = vector[dim.key] ?? 0.5;
            const pct = Math.round(val * 100);
            return (
              <div
                key={dim.key}
                className="p-3.5 rounded-2xl bg-black/45 border border-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.4)] transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{t(dim.labelEn, dim.labelFa)}</span>
                  <span className="font-mono font-bold text-[#F5B942] text-[11px]">{pct}%</span>
                </div>

                <div className="relative flex items-center" dir="ltr">
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={val}
                    onChange={(e) => handleSliderChange(dim.key, Number(e.target.value))}
                    aria-label={dim.labelEn}
                    className="aether-slider w-full"
                  />
                </div>

                <p className="text-[10px] text-[#8E9BB3] leading-tight">
                  {t(dim.descEn, dim.descFa)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Influential Movies Section */}
      <div className="space-y-3 pt-3 border-t border-[rgba(212,175,55,0.14)]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-cinzel font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>{t('Films That Shaped Your Algorithm', 'فیلم‌های تأثیرگذار بر الگوریتم شما')}</span>
          </span>
          <span className="text-[10px] text-[#A3AEC2]">
            {influentialItems.length > 0 ? `${influentialItems.length} اثر شناسایی‌شده` : 'بر اساس سلیقه اولیه'}
          </span>
        </div>

        {influentialItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {influentialItems.map(({ item, reason }) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-black/35 border border-[rgba(212,175,55,0.18)]"
              >
                <img
                  src={item.posterUrl}
                  alt={item.titleEn}
                  className="w-10 h-14 rounded-lg object-cover border border-[#D4AF37]/40 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {t(item.titleEn, item.titleFa)}
                  </p>
                  <p className="text-[10px] text-[#D4AF37] mt-0.5 truncate">{reason}</p>
                  <p className="text-[9px] font-mono text-[#8E9BB3] mt-0.5">
                    {item.releaseYear} · {item.quality}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 text-center space-y-1">
            <p className="text-xs text-slate-300">
              {t(
                'Watch or favorite your first film to see real-time taste vector weights appear here.',
                'با تماشا یا نشان‌کردن اولین فیلم، نحوه اثرگذاری دقیق آن بر الگوریتم هوش مصنوعی اینجا ثبت می‌شود.'
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
