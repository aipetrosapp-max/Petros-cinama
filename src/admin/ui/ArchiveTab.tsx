/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Archive tab: movies / series / anime with seasons, episodes,
 * multi-quality streams and subtitle tracks.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Film,
  Clapperboard,
  Tv,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Subtitles,
  Languages,
  Link2,
  Send
} from 'lucide-react';
import type {
  TitleRecord,
  SeasonRecord,
  EpisodeRecord,
  QualityStream,
  SubtitleTrack,
  MediaCategory
} from '../types.ts';
import { QUALITY_PRESETS } from '../types.ts';
import { adminApi } from '../client.ts';
import {
  Panel,
  GoldButton,
  TextInput,
  TextArea,
  Select,
  Field,
  Badge,
  Modal,
  SearchInput,
  EmptyState,
  useToast,
  inputClass
} from './primitives.tsx';

const CATEGORY_META: Record<MediaCategory, { labelFa: string; icon: React.ReactNode }> = {
  movie: { labelFa: 'فیلم', icon: <Film className="h-3.5 w-3.5" /> },
  series: { labelFa: 'سریال', icon: <Tv className="h-3.5 w-3.5" /> },
  anime: { labelFa: 'انیمه', icon: <Sparkles className="h-3.5 w-3.5" /> }
};

type SortKey = 'updated' | 'title' | 'year' | 'rating';

export function ArchiveTab({
  titles,
  onChanged
}: {
  titles: TitleRecord[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | MediaCategory>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [editing, setEditing] = useState<TitleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [seasonTarget, setSeasonTarget] = useState<TitleRecord | null>(null);
  const [episodeTarget, setEpisodeTarget] = useState<TitleRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = titles.filter((title) => {
      if (category !== 'all' && title.category !== category) return false;
      if (!q) return true;
      return (
        title.title.toLowerCase().includes(q) ||
        title.titleFa.toLowerCase().includes(q) ||
        (title.originalTitle || '').toLowerCase().includes(q) ||
        (title.director || '').toLowerCase().includes(q) ||
        (title.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'year') return (b.year || 0) - (a.year || 0);
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [titles, query, category, sort]);

  const remove = async (title: TitleRecord) => {
    if (!window.confirm(`عنوان «${title.titleFa || title.title}» حذف شود؟`)) return;
    try {
      await adminApi.deleteTitle(title.id);
      toast.push('success', 'عنوان حذف شد', title.titleFa || title.title);
      onChanged();
    } catch (error) {
      toast.push('error', 'حذف ناموفق', (error as Error).message);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      <Panel
        title="آرشیو مدیا"
        subtitle={`${filtered.length} عنوان از مجموع ${titles.length} — فیلم، سریال و انیمه با ساختار فصل/قسمت`}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان، کارگردان، برچسب…" />
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'all' | MediaCategory)}
              className="w-40"
            >
              <option value="all">همه دسته‌ها</option>
              <option value="movie">فیلم</option>
              <option value="series">سریال</option>
              <option value="anime">انیمه</option>
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-40"
            >
              <option value="updated">آخرین تغییر</option>
              <option value="title">عنوان</option>
              <option value="year">سال</option>
              <option value="rating">امتیاز</option>
            </Select>
            <GoldButton onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              عنوان جدید
            </GoldButton>
          </>
        }
      >
        <LinkImportCard onAdded={onChanged} />
        {filtered.length === 0 ? (
          <EmptyState
            title="عنوانی یافت نشد"
            description="فیلترها را تغییر دهید یا یک عنوان جدید بسازید. عنوان‌هایی که کیفیت یا لینک ندارند در کلاینت با وضعیت «منبع تأییدشده‌ای موجود نیست» نمایش داده می‌شوند."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((title) => {
              const isOpen = Boolean(expanded[title.id]);
              const episodes = title.episodes || [];
              const seasons = title.seasons || [];
              return (
                <article
                  key={title.id}
                  className="rounded-2xl border border-white/10 bg-black/40 transition hover:border-[#D4AF37]/25"
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <img
                      src={title.posterUrl || '/icon.svg'}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-zinc-100">
                          {title.titleFa || title.title}
                        </h3>
                        <Badge tone="gold">
                          {CATEGORY_META[title.category]?.icon}
                          {CATEGORY_META[title.category]?.labelFa}
                        </Badge>
                        <Badge tone={title.status === 'published' ? 'green' : 'neutral'}>
                          {title.status === 'published'
                            ? 'منتشرشده'
                            : title.status === 'draft'
                              ? 'پیش‌نویس'
                              : 'بایگانی'}
                        </Badge>
                        {title.year ? <Badge>{title.year}</Badge> : null}
                        {seasons.length ? <Badge tone="blue">{seasons.length} فصل</Badge> : null}
                        {episodes.length ? (
                          <Badge tone="blue">{episodes.length} قسمت</Badge>
                        ) : null}
                        {(title.qualities || []).length ? (
                          <Badge tone="gold">{title.qualities.length} کیفیت</Badge>
                        ) : (
                          <Badge tone="red">بدون استریم</Badge>
                        )}
                        {(title.subtitles || []).length ? (
                          <Badge tone="green">{title.subtitles.length} زیرنویس</Badge>
                        ) : null}
                      </div>
                      <p dir="ltr" className="mt-1 truncate text-[10px] text-zinc-500">
                        {title.title}
                        {title.originalTitle ? ` • ${title.originalTitle}` : ''}
                        {title.director ? ` • ${title.director}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="افزودن فصل"
                        onClick={() => setSeasonTarget(title)}
                        className="rounded-lg border border-white/12 p-2 text-zinc-400 transition hover:border-sky-500/40 hover:text-sky-300"
                      >
                        <Layers className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="افزودن قسمت"
                        onClick={() => setEpisodeTarget(title)}
                        className="rounded-lg border border-white/12 p-2 text-zinc-400 transition hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        <Clapperboard className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="ویرایش"
                        onClick={() => setEditing(title)}
                        className="rounded-lg border border-white/12 p-2 text-zinc-400 transition hover:border-[#D4AF37]/40 hover:text-[#F5E7B8]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="حذف"
                        onClick={() => remove(title)}
                        className="rounded-lg border border-white/12 p-2 text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="نمایش جزئیات"
                        onClick={() => toggleExpand(title.id)}
                        className="rounded-lg border border-white/12 p-2 text-zinc-400 transition hover:text-white"
                      >
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-white/10 px-4 py-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                            <Layers className="h-3.5 w-3.5" /> کیفیت‌های این عنوان
                          </h4>
                          {(title.qualities || []).length === 0 ? (
                            <p className="text-[10px] text-rose-400">
                              بدون کیفیت — این عنوان در کلاینت قابل پخش نخواهد بود.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {(title.qualities || []).map((q) => (
                                <li
                                  key={q.id}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2"
                                >
                                  <span className="truncate text-[10px] text-zinc-300" dir="ltr">
                                    {q.quality}
                                  </span>
                                  <span className="truncate text-[9px] text-zinc-600" dir="ltr">
                                    {q.url}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                            <Subtitles className="h-3.5 w-3.5" /> زیرنویس‌ها
                          </h4>
                          {(title.subtitles || []).length === 0 ? (
                            <p className="text-[10px] text-zinc-500">زیرنویسی ثبت نشده است.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {(title.subtitles || []).map((s) => (
                                <li
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/30 px-3 py-2"
                                >
                                  <span className="flex items-center gap-1.5 text-[10px] text-zinc-300">
                                    <Languages className="h-3 w-3 text-[#D4AF37]" />
                                    {s.languageFa || s.language}
                                  </span>
                                  <span className="text-[9px] text-zinc-500" dir="ltr">
                                    {s.format.toUpperCase()} • {s.offsetMs >= 0 ? '+' : ''}
                                    {(s.offsetMs / 1000).toFixed(1)}s
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {episodes.length ? (
                        <div className="mt-4">
                          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                            <Clapperboard className="h-3.5 w-3.5" /> قسمت‌ها
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] text-right text-[11px]">
                              <thead className="text-[10px] text-zinc-500">
                                <tr className="border-b border-white/10">
                                  <th className="py-2 pl-2 font-bold">فصل / قسمت</th>
                                  <th className="py-2 pl-2 font-bold">عنوان</th>
                                  <th className="py-2 pl-2 font-bold">کیفیت‌ها</th>
                                  <th className="py-2 pl-2 font-bold">زیرنویس</th>
                                  <th className="py-2 font-bold">عملیات</th>
                                </tr>
                              </thead>
                              <tbody>
                                {episodes.map((ep) => (
                                  <tr key={ep.id} className="border-b border-white/5">
                                    <td className="py-2 pl-2 text-zinc-400" dir="ltr">
                                      S{ep.season} · E{ep.episode}
                                    </td>
                                    <td className="py-2 pl-2 text-zinc-200">{ep.titleFa || ep.title}</td>
                                    <td className="py-2 pl-2">
                                      <span className="flex flex-wrap gap-1">
                                        {(ep.qualities || []).map((q) => (
                                          <Badge key={q.id} tone="gold">
                                            {q.quality}
                                          </Badge>
                                        ))}
                                      </span>
                                    </td>
                                    <td className="py-2 pl-2 text-zinc-500">
                                      {(ep.subtitles || []).length || '—'}
                                    </td>
                                    <td className="py-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await adminApi.deleteEpisode(title.id, ep.id);
                                            toast.push('success', 'قسمت حذف شد', ep.title);
                                            onChanged();
                                          } catch (error) {
                                            toast.push('error', 'حذف ناموفق', (error as Error).message);
                                          }
                                        }}
                                        className="rounded-lg border border-white/12 p-1.5 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-300"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {creating ? (
        <TitleEditor
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            onChanged();
          }}
        />
      ) : null}

      {editing ? (
        <TitleEditor
          mode="edit"
          title={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}

      {seasonTarget ? (
        <SeasonModal
          title={seasonTarget}
          onClose={() => setSeasonTarget(null)}
          onSaved={() => {
            setSeasonTarget(null);
            onChanged();
          }}
        />
      ) : null}

      {episodeTarget ? (
        <EpisodeModal
          title={episodeTarget}
          onClose={() => setEpisodeTarget(null)}
          onSaved={() => {
            setEpisodeTarget(null);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title editor (qualities + subtitles)
// ---------------------------------------------------------------------------

function TitleEditor({
  mode,
  title,
  onClose,
  onSaved
}: {
  mode: 'create' | 'edit';
  title?: TitleRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<TitleRecord>>({
    title: title?.title || '',
    titleFa: title?.titleFa || '',
    originalTitle: title?.originalTitle || '',
    category: title?.category || 'movie',
    year: title?.year,
    rating: title?.rating,
    synopsis: title?.synopsis || '',
    synopsisFa: title?.synopsisFa || '',
    director: title?.director || '',
    cast: title?.cast || [],
    genres: title?.genres || [],
    tags: title?.tags || [],
    posterUrl: title?.posterUrl || '',
    backdropUrl: title?.backdropUrl || '',
    durationSec: title?.durationSec,
    status: title?.status || 'draft',
    qualities: title?.qualities || [],
    subtitles: title?.subtitles || []
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TitleRecord>(key: K, value: TitleRecord[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      if (mode === 'create') await adminApi.createTitle(form);
      else if (title) await adminApi.updateTitle(title.id, form);
      toast.push('success', mode === 'create' ? 'عنوان ساخته شد' : 'عنوان به‌روزرسانی شد');
      onSaved();
    } catch (error) {
      toast.push('error', 'ذخیره ناموفق', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      wide
      title={mode === 'create' ? 'عنوان جدید' : `ویرایش: ${title?.titleFa || title?.title}`}
      onClose={onClose}
      footer={
        <>
          <GoldButton variant="ghost" onClick={onClose}>
            انصراف
          </GoldButton>
          <GoldButton onClick={save} loading={saving}>
            ذخیره
          </GoldButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="عنوان فارسی">
          <TextInput
            value={form.titleFa || ''}
            onChange={(e) => set('titleFa', e.target.value)}
            placeholder="مثال: کهکشان شکسته"
          />
        </Field>
        <Field label="عنوان انگلیسی">
          <TextInput
            value={form.title || ''}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Example: Interstellar"
            dir="ltr"
          />
        </Field>
        <Field label="عنوان اصلی">
          <TextInput
            value={form.originalTitle || ''}
            onChange={(e) => set('originalTitle', e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="دسته‌بندی">
          <Select
            value={form.category}
            onChange={(e) => set('category', e.target.value as MediaCategory)}
          >
            <option value="movie">فیلم</option>
            <option value="series">سریال</option>
            <option value="anime">انیمه</option>
          </Select>
        </Field>
        <Field label="سال انتشار">
          <TextInput
            type="number"
            value={form.year ?? ''}
            onChange={(e) => set('year', e.target.value ? Number(e.target.value) : undefined)}
            dir="ltr"
          />
        </Field>
        <Field label="امتیاز (۰ تا ۱۰)">
          <TextInput
            type="number"
            step="0.1"
            value={form.rating ?? ''}
            onChange={(e) => set('rating', e.target.value ? Number(e.target.value) : undefined)}
            dir="ltr"
          />
        </Field>
        <Field label="مدت زمان (ثانیه)">
          <TextInput
            type="number"
            value={form.durationSec ?? ''}
            onChange={(e) =>
              set('durationSec', e.target.value ? Number(e.target.value) : undefined)
            }
            dir="ltr"
          />
        </Field>
        <Field label="کارگردان">
          <TextInput
            value={form.director || ''}
            onChange={(e) => set('director', e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="پوستر (URL)">
          <TextInput
            value={form.posterUrl || ''}
            onChange={(e) => set('posterUrl', e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="وضعیت انتشار">
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value as TitleRecord['status'])}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی</option>
          </Select>
        </Field>
        <Field label="برچسب‌ها (با کاما جدا کنید)">
          <TextInput
            value={(form.tags || []).join(', ')}
            onChange={(e) =>
              set(
                'tags',
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="خلاصه داستان (فارسی)">
            <TextArea
              value={form.synopsisFa || ''}
              onChange={(e) => set('synopsisFa', e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="خلاصه داستان (انگلیسی)">
            <TextArea
              value={form.synopsis || ''}
              onChange={(e) => set('synopsis', e.target.value)}
              dir="ltr"
            />
          </Field>
        </div>
      </div>

      <QualityEditor
        qualities={form.qualities || []}
        onChange={(next) => set('qualities', next)}
      />
      <SubtitleEditor
        subtitles={form.subtitles || []}
        onChange={(next) => set('subtitles', next)}
      />
    </Modal>
  );
}

function QualityEditor({
  qualities,
  onChange
}: {
  qualities: QualityStream[];
  onChange: (next: QualityStream[]) => void;
}) {
  const update = (index: number, patch: Partial<QualityStream>) => {
    const next = [...qualities];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#F5E7B8]">
          <Layers className="h-3.5 w-3.5" /> مدیریت چندکیفیتی
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {QUALITY_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() =>
                onChange([
                  ...qualities,
                  {
                    id: `q-${Date.now().toString(36)}`,
                    quality: preset,
                    url: '',
                    format: 'direct_mp4'
                  }
                ])
              }
              className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-bold text-[#F5E7B8] transition hover:bg-[#D4AF37]/20"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>
      {qualities.length === 0 ? (
        <p className="text-[10px] text-zinc-500">
          هیچ کیفیتی تعریف نشده است. بدون کیفیت معتبر، این عنوان در کلاینت «بدون منبع تأییدشده» نمایش داده می‌شود.
        </p>
      ) : (
        <div className="space-y-2">
          {qualities.map((q, index) => (
            <div key={q.id} className="grid gap-2 sm:grid-cols-[9rem_1fr_8rem_2rem]">
              <TextInput
                value={q.quality}
                onChange={(e) => update(index, { quality: e.target.value })}
                placeholder="1080p"
                dir="ltr"
              />
              <TextInput
                value={q.url}
                onChange={(e) => update(index, { url: e.target.value })}
                placeholder="https://…/movie-1080p.mp4 یا /api/stream/cache/<id>"
                dir="ltr"
              />
              <Select
                value={q.format}
                onChange={(e) =>
                  update(index, { format: e.target.value as QualityStream['format'] })
                }
              >
                <option value="direct_mp4">MP4 مستقیم</option>
                <option value="hls">HLS / m3u8</option>
                <option value="telegram_gateway">تلگرام گیت‌وی</option>
                <option value="cache_gateway">کش استریم</option>
              </Select>
              <button
                type="button"
                onClick={() => onChange(qualities.filter((_, i) => i !== index))}
                className="rounded-lg border border-white/12 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-300"
                aria-label="حذف کیفیت"
              >
                <Trash2 className="mx-auto h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubtitleEditor({
  subtitles,
  onChange
}: {
  subtitles: SubtitleTrack[];
  onChange: (next: SubtitleTrack[]) => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const update = (index: number, patch: Partial<SubtitleTrack>) => {
    const next = [...subtitles];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleUpload = async (file: File) => {
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      toast.push('error', 'فرمت نامعتبر', 'فقط فایل‌های .srt و .vtt قابل بارگذاری هستند.');
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const base64 = btoa(binary);
      const res = await adminApi.uploadSubtitleFile(file.name, base64);
      const langGuess = /fa|persian|farsi/i.test(file.name) ? 'fa' : /en|eng/i.test(file.name) ? 'en' : 'fa';
      onChange([
        ...subtitles,
        {
          id: `s-${Date.now().toString(36)}`,
          language: langGuess,
          languageFa: langGuess === 'fa' ? 'فارسی' : langGuess,
          format: res.record.format,
          url: res.record.url,
          offsetMs: 0,
          label: file.name
        }
      ]);
      toast.push('success', 'زیرنویس بارگذاری شد', res.messageFa);
    } catch (error) {
      toast.push(
        'error',
        'خطای بارگذاری',
        error instanceof Error ? error.message : 'بارگذاری فایل زیرنویس ناموفق بود.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#F5E7B8]">
          <Subtitles className="h-3.5 w-3.5" /> موتور زیرنویس
        </h4>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...subtitles,
              {
                id: `s-${Date.now().toString(36)}`,
                language: 'fa',
                languageFa: 'فارسی',
                format: 'vtt',
                url: '',
                offsetMs: 0
              }
            ])
          }
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/20"
        >
          + افزودن زیرنویس
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-bold text-[#F5E7B8] transition hover:bg-[#D4AF37]/20 disabled:opacity-50"
        >
          {uploading ? 'در حال بارگذاری…' : '↑ بارگذاری فایل SRT / VTT'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
      </div>
      {subtitles.length === 0 ? (
        <p className="text-[10px] text-zinc-500">
          بدون زیرنویس ثبت‌شده، کلاینت پیام «زیرنویس رسمی ثبت نشده است» نمایش می‌دهد و هیچ متن ساختگی تولید نمی‌کند.
        </p>
      ) : (
        <div className="space-y-2">
          {subtitles.map((s, index) => (
            <div key={s.id} className="grid gap-2 sm:grid-cols-[7rem_8rem_1fr_7rem_2rem]">
              <TextInput
                value={s.language}
                onChange={(e) => update(index, { language: e.target.value })}
                placeholder="fa"
                dir="ltr"
              />
              <TextInput
                value={s.languageFa}
                onChange={(e) => update(index, { languageFa: e.target.value })}
                placeholder="فارسی"
              />
              <TextInput
                value={s.url}
                onChange={(e) => update(index, { url: e.target.value })}
                placeholder="https://…/movie.fa.vtt"
                dir="ltr"
              />
              <div>
                <TextInput
                  type="number"
                  value={Math.round(s.offsetMs / 1000)}
                  onChange={(e) => update(index, { offsetMs: Number(e.target.value) * 1000 })}
                  title="آفست زمانی بر حسب ثانیه"
                  dir="ltr"
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(subtitles.filter((_, i) => i !== index))}
                className="rounded-lg border border-white/12 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-300"
                aria-label="حذف زیرنویس"
              >
                <Trash2 className="mx-auto h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick add from a link: check the whole list → if new, add to site + Telegram
// ---------------------------------------------------------------------------
function LinkImportCard({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [postToTelegram, setPostToTelegram] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const link = url.trim();
    if (!/^https?:\/\//i.test(link)) {
      toast.push('error', 'لینک نامعتبر', 'یک آدرس کامل وارد کنید؛ مثال: https://t.me/Aipetros/12345 یا https://cdn…/movie.mp4');
      return;
    }
    setBusy(true);
    try {
      const res = await adminApi.addFromLink({
        url: link,
        title: title.trim() || undefined,
        postToTelegram
      });
      if (res.duplicate) {
        toast.push('info', 'تکراری — چیزی اضافه نشد', res.messageFa);
      } else {
        toast.push(
          res.telegram && !res.telegram.ok ? 'info' : 'success',
          'به لیست اضافه شد',
          res.messageFa
        );
        setUrl('');
        setTitle('');
        onAdded();
      }
    } catch (error) {
      toast.push('error', 'افزودن ناموفق', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-[#D4AF37]/25 bg-black/40 p-4">
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#F5E7B8]">
        <Link2 className="h-3.5 w-3.5" /> افزودن سریع از لینک (بررسی کل لیست فیلم و سریال)
      </h4>
      <p className="mb-3 text-[10px] leading-relaxed text-zinc-400">
        لینک پست تلگرام (t.me/…/postId)، فایل مستقیم (mp4/mkv/webm) یا HLS بچسبانید. اگر عنوان از
        قبل در کاتالوگ باشد، تکراری گزارش می‌شود و چیزی اضافه نمی‌شود؛ در غیر صورت وارد سایت شده و
        در صورت تمایل توسط بات در کانال تلگرام شما منتشر می‌شود.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto_auto]">
        <TextInput
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://t.me/Aipetros/12345 یا https://cdn.site/movie.1080p.mp4"
          dir="ltr"
        />
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان (اختیاری)" />
        <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-black/30 px-3 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={postToTelegram}
            onChange={(e) => setPostToTelegram(e.target.checked)}
            className="accent-[#D4AF37]"
          />
          انتشار در کانال تلگرام
        </label>
        <GoldButton onClick={() => void submit()} disabled={busy || !url.trim()}>
          <Send className="h-3.5 w-3.5" />
          {busy ? 'در حال بررسی…' : 'بررسی و افزودن'}
        </GoldButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Season / episode modals
// ---------------------------------------------------------------------------

function SeasonModal({
  title,
  onClose,
  onSaved
}: {
  title: TitleRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [number, setNumber] = useState((title.seasons?.length || 0) + 1);
  const [name, setName] = useState('');
  const [nameFa, setNameFa] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open
      title={`افزودن فصل — ${title.titleFa || title.title}`}
      onClose={onClose}
      footer={
        <>
          <GoldButton variant="ghost" onClick={onClose}>
            انصراف
          </GoldButton>
          <GoldButton
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await adminApi.addSeason(title.id, {
                  season: number,
                  title: name || `Season ${number}`,
                  titleFa: nameFa
                });
                toast.push('success', 'فصل اضافه شد', `فصل ${number}`);
                onSaved();
              } catch (error) {
                toast.push('error', 'افزودن فصل ناموفق', (error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            افزودن فصل
          </GoldButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="شماره فصل">
          <TextInput
            type="number"
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
            dir="ltr"
          />
        </Field>
        <Field label="عنوان فصل (انگلیسی)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} dir="ltr" />
        </Field>
        <Field label="عنوان فصل (فارسی)">
          <TextInput value={nameFa} onChange={(e) => setNameFa(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function EpisodeModal({
  title,
  onClose,
  onSaved
}: {
  title: TitleRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState((title.episodes?.length || 0) + 1);
  const [name, setName] = useState('');
  const [nameFa, setNameFa] = useState('');
  const [qualities, setQualities] = useState<QualityStream[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open
      wide
      title={`افزودن قسمت — ${title.titleFa || title.title}`}
      onClose={onClose}
      footer={
        <>
          <GoldButton variant="ghost" onClick={onClose}>
            انصراف
          </GoldButton>
          <GoldButton
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await adminApi.addEpisode(title.id, {
                  season,
                  episode,
                  title: name || `Episode ${episode}`,
                  titleFa: nameFa,
                  qualities,
                  subtitles
                });
                toast.push('success', 'قسمت اضافه شد', `S${season} E${episode}`);
                onSaved();
              } catch (error) {
                toast.push('error', 'افزودن قسمت ناموفق', (error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            افزودن قسمت
          </GoldButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="شماره فصل">
          <TextInput
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            dir="ltr"
          />
        </Field>
        <Field label="شماره قسمت">
          <TextInput
            type="number"
            value={episode}
            onChange={(e) => setEpisode(Number(e.target.value))}
            dir="ltr"
          />
        </Field>
        <Field label="عنوان قسمت (انگلیسی)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} dir="ltr" />
        </Field>
        <Field label="عنوان قسمت (فارسی)">
          <TextInput value={nameFa} onChange={(e) => setNameFa(e.target.value)} />
        </Field>
      </div>
      <QualityEditor qualities={qualities} onChange={setQualities} />
      <SubtitleEditor subtitles={subtitles} onChange={setSubtitles} />
    </Modal>
  );
}

export const adminInputClass = inputClass;
