/**
 * PETROS CINEMA — Master Admin Panel · Public-Domain Collection Tab
 * Editable 250-title collection (title/year/identifier) + background
 * ingestion runner with live progress (multi-quality: up to 3 real MP4s).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Save, RefreshCw, Trash2, Plus, ListVideo } from 'lucide-react';
import { adminApi } from '../client.ts';
import { Panel, GoldButton, TextInput, useToast, Badge, SearchInput } from './primitives.tsx';
import { Spinner } from './LoginGate.tsx';

interface CollectionItem {
  title: string;
  year?: number | null;
  identifier: string;
}

interface Progress {
  running?: boolean;
  total?: number;
  processed?: number;
  added?: number;
  skipped?: number;
  failed?: number;
  log?: string[];
}

export function CollectionTab() {
  const toast = useToast();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.getCollection();
      setItems(data.items || []);
      setProgress(data.progress || {});
    } catch (error) {
      toast.push('error', 'بارگذاری کالکشن', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // live progress polling while a run is active
  useEffect(() => {
    if (progress.running) {
      pollRef.current = window.setInterval(async () => {
        try {
          const pr = await adminApi.getCollectionProgress();
          setProgress(pr);
        } catch {
          // transient
        }
      }, 3000);
    } else if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
      void load();
    }
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [progress.running, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.identifier.toLowerCase().includes(q) ||
        String(it.year || '').includes(q)
    );
  }, [items, query]);

  const removeItem = (identifier: string) => {
    setItems((prev) => prev.filter((it) => it.identifier !== identifier));
    setDirty(true);
  };

  const addItem = () => {
    const title = newTitle.trim();
    const identifier = newIdentifier.trim();
    if (!title || !identifier) {
      toast.push('info', 'اطلاعات ناقص', 'عنوان و شناسه آرشیو هر دو لازم است.');
      return;
    }
    if (items.some((it) => it.identifier.toLowerCase() === identifier.toLowerCase())) {
      toast.push('info', 'تکراری', 'این شناسه قبلاً در کالکشن هست.');
      return;
    }
    const year = Number(newYear);
    setItems((prev) => [...prev, { title, identifier, year: Number.isFinite(year) && year ? year : null }]);
    setNewTitle('');
    setNewYear('');
    setNewIdentifier('');
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.saveCollection(items);
      toast.push('success', 'کالکشن ذخیره شد', res.messageFa || `${items.length} عنوان`);
      setDirty(false);
    } catch (error) {
      toast.push('error', 'ذخیره ناموفق', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      if (dirty) await adminApi.saveCollection(items);
      setDirty(false);
      const res = await adminApi.runCollection();
      toast.push(res.started ? 'success' : 'info', res.started ? 'اجرا شروع شد' : 'در حال اجرا', res.messageFa);
      const pr = await adminApi.getCollectionProgress();
      setProgress(pr);
    } catch (error) {
      toast.push('error', 'اجرا ناموفق', (error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const pct = progress.total ? Math.round(((progress.processed || 0) / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Panel
        title="📚 کالکشن پابلیک‌دومین (قابل ویرایش)"
        subtitle={`لیست ${items.length} فیلم برتر بدون کپی‌رایت — اجراگر پس‌زمینه تا ۳ کیفیت واقعی برای هر فیلم پیدا و اعتبارسنجی می‌کند`}
        actions={
          <>
            <GoldButton variant="ghost" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
              تازه‌سازی
            </GoldButton>
            <GoldButton variant="ghost" onClick={save} loading={saving}>
              <Save className="h-3.5 w-3.5" />
              {dirty ? 'ذخیره تغییرات *' : 'ذخیره'}
            </GoldButton>
            <GoldButton onClick={run} loading={running}>
              <Play className="h-3.5 w-3.5" />
              {progress.running ? 'در حال اجرا…' : 'اجرای کالکشن'}
            </GoldButton>
          </>
        }
      >
        {/* Progress */}
        {(progress.running || progress.processed) ? (
          <div className="mb-4 rounded-2xl border border-[#D4AF37]/25 bg-black/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-[#F5E7B8]">
                {progress.running ? '⏳ در حال اجرا…' : '🏁 آخرین اجرا'}
              </span>
              <span className="text-zinc-400">
                پردازش {progress.processed || 0}/{progress.total} • اضافه {progress.added || 0} • رد {progress.failed || 0} • تکراری {progress.skipped || 0}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5B942] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress.log?.length ? (
              <div dir="rtl" className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[10.5px] leading-5 text-zinc-400">
                {progress.log.map((line, i) => (
                  <div key={i} className={line.includes('✅') ? 'text-emerald-300' : line.includes('⛔') ? 'text-rose-300' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Add row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="جستجوی عنوان / شناسه / سال…" />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="عنوان فیلم" className="min-w-[180px] flex-1" />
          <TextInput value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="سال" dir="ltr" className="w-24" />
          <TextInput value={newIdentifier} onChange={(e) => setNewIdentifier(e.target.value)} placeholder="شناسه archive.org (مثال: detour_ipod)" dir="ltr" className="min-w-[220px] flex-1" />
          <GoldButton variant="ghost" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            افزودن به لیست
          </GoldButton>
        </div>

        {loading ? (
          <Spinner label="در حال بارگذاری کالکشن…" />
        ) : (
          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((it) => (
              <div
                key={it.identifier}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-2"
              >
                <ListVideo className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-zinc-100">{it.title}</p>
                  <p dir="ltr" className="truncate text-[9.5px] text-zinc-500">
                    {it.identifier}
                  </p>
                </div>
                {it.year ? <Badge>{it.year}</Badge> : null}
                <button
                  type="button"
                  title="حذف از کالکشن"
                  onClick={() => removeItem(it.identifier)}
                  className="rounded-lg border border-white/12 p-1.5 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">چیزی مطابق جستجو پیدا نشد.</p>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
