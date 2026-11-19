/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Sources tab: validate and register stream/download sources.
 */
import React, { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, ShieldCheck, Server, Radio } from 'lucide-react';
import type { SourceRecord } from '../types.ts';
import { adminApi, type SourceValidationResult } from '../client.ts';
import { getAdminMode } from '../transport.ts';
import {
  Panel,
  GoldButton,
  TextInput,
  Select,
  Field,
  Badge,
  useToast,
  EmptyState
} from './primitives.tsx';

const KIND_LABEL: Record<string, string> = {
  direct_mp4: 'MP4 مستقیم',
  hls: 'HLS / m3u8',
  telegram_gateway: 'تلگرام گیت‌وی (Range)',
  cache_gateway: 'کش استریم محلی'
};

export function SourcesTab() {
  const toast = useToast();
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('direct_mp4');
  const [gatewayPort, setGatewayPort] = useState('8089');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [browserUrl, setBrowserUrl] = useState('');
  const [launchingBrowser, setLaunchingBrowser] = useState(false);
  const [cookieCount, setCookieCount] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Array<{ host: string; count: number; logged_in: boolean; savedAt?: string | null; url?: string }>>([]);
  const [sourcePageUrl, setSourcePageUrl] = useState('');
  const [extractingFiles, setExtractingFiles] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<Array<{ url: string; text: string; type: string }>>([]);
  const [selectedForTelegram, setSelectedForTelegram] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [sendingToTelegram, setSendingToTelegram] = useState(false);
  const [transferItems, setTransferItems] = useState<Array<{ id: string; title: string; status: string; progressPct: number; error: string }>>([]);
  const [transferState, setTransferState] = useState<Record<string, { status: string; progressPct: number; error: string }>>({});

  const fileNameFromUrl = (u: string): string => {
    try {
      return decodeURIComponent(new URL(u).pathname.split('/').pop() || u);
    } catch {
      return u;
    }
  };

  const refreshSessions = async () => {
    try {
      const res = await adminApi.browserSessions();
      setSessions(res.sessions || []);
    } catch {
      setSessions([]);
    }
  };

  const extractSourceFiles = async () => {
    setExtractingFiles(true);
    setExtractedFiles([]);
    setSelectedForTelegram([]);
    try {
      const res = await adminApi.vipExtractLinks(sourcePageUrl.trim());
      if (res.ok) {
        // media + embed links are the transferable files; sort direct first
        const media = res.links.filter((l) => l.type === 'direct' || l.type === 'stream');
        const rest = res.links.filter((l) => l.type !== 'direct' && l.type !== 'stream');
        const all = [...media, ...rest];
        setExtractedFiles(all);
        setSelectedForTelegram(media.map((l) => l.url));
        toast.push('success', 'لیست فایل‌ها آماده شد', `${all.length} فایل — پیش‌فرض‌ها تیک خورده‌اند؛ هر خواستی را بردار/بگذار و ارسال کن.`);
      } else {
        toast.push('info', 'فایلی پیدا نشد', res.messageFa);
      }
    } catch (error) {
      toast.push('error', 'استخراج ناموفق', (error as Error).message);
    } finally {
      setExtractingFiles(false);
    }
  };

  const sendSelectedToTelegram = async () => {
    setSendingToTelegram(true);
    try {
      const items = selectedForTelegram.map((u) => ({
        url: u,
        ...(fileNames[u] ? { name: fileNames[u] } : {})
      }));
      const res = await adminApi.transferToTelegram(items);
      toast.push('success', 'ارسال شروع شد', res.messageFa);
      setSelectedForTelegram([]);
      void pollTransfer();
    } catch (error) {
      toast.push('error', 'ارسال ناموفق', (error as Error).message);
    } finally {
      setSendingToTelegram(false);
    }
  };

  const pollTransfer = async () => {
    try {
      const res = await adminApi.transferStatus();
      setTransferItems(res.items || []);
      setTransferState(Object.fromEntries((res.items || []).map((it) => [it.title, { status: it.status, progressPct: it.progressPct, error: it.error }])));
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void refreshSessions();
    const timer = setInterval(() => {
      void pollTransfer();
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const launchInteractiveBrowser = async () => {
    const target = browserUrl.trim() || url.trim();
    if (!target) {
      toast.push('info', 'آدرس سایت لازم است', 'ابتدا آدرس سایت (مثلاً https://digimoviez.com) را وارد کنید.');
      return;
    }
    setLaunchingBrowser(true);
    try {
      const res = await adminApi.launchBrowser(target);
      toast.push('success', 'مرورگر باز شد', 'پنجره Chrome for Testing روی مانیتور/نوار وظیفه باز می‌شود — بعد از لاگین آن را ببند تا کوکی‌ها ذخیره شود.');
      if (!name) setName(new URL(target).hostname);
      // auto-check for the session shortly after — the user closes the window when done
      setTimeout(() => {
        void fetchSessionCookies();
        void refreshSessions();
      }, 60_000);
    } catch (e) {
      toast.push('error', 'اجرای مرورگر ناموفق', (e as Error).message);
    } finally {
      setLaunchingBrowser(false);
    }
  };

  const fetchSessionCookies = async () => {
    const target = browserUrl.trim() || url.trim();
    if (!target) return;
    try {
      const host = new URL(target).hostname;
      const res = await adminApi.checkBrowserSession(host);
      if (res.ok && res.session) {
        setCookieCount(res.session.count);
        setNotes((prev) => (prev ? `${prev} | ` : '') + `کوکی VIP (${res.session?.count} عدد)`);
        toast.push('success', 'کوکی‌های نشست استخراج شد', `${res.session.count} کوکی فعال شناسایی شد.`);
      } else {
        toast.push('info', 'در انتظار بستن مرورگر', 'پس از ورود در مرورگر باز شده، آن را ببندید سپس این دکمه را بزنید.');
      }
    } catch (e) {
      toast.push('error', 'خطا', (e as Error).message);
    }
  };
  const [validation, setValidation] = useState<SourceValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await adminApi.sources();
      setSources(result.sources || []);
    } catch (error) {
      toast.push('error', 'بارگذاری سورس‌ها ناموفق', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = async () => {
    if (!url.trim()) {
      toast.push('info', 'آدرس لازم است', 'ابتدا آدرس سورس را وارد کنید.');
      return;
    }
    setValidating(true);
    setValidation(null);
    try {
      const result = await adminApi.validateSource(url.trim());
      setValidation(result);
      toast.push(result.ok ? 'success' : 'info', 'بررسی سورس', result.messageFa);
      if (result.ok && !name) setName(url.trim().split('/')[2] || 'منبع');
    } catch (error) {
      toast.push('error', 'بررسی ناموفق', (error as Error).message);
    } finally {
      setValidating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.addSource({
        name: name || 'منبع',
        kind: kind as SourceRecord['kind'],
        baseUrl: url.trim(),
        notes,
        gatewayPort: Number(gatewayPort) || 8089,
        username: username.trim() || undefined,
        password: password.trim() || undefined
      });
      toast.push('success', 'سورس ثبت شد');
      setUrl('');
      setName('');
      setUsername('');
      setPassword('');
      setNotes('');
      setValidation(null);
      await load();
    } catch (error) {
      toast.push('error', 'ثبت سورس ناموفق', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="🌐 ورود به سایت‌های VIP و استخراج نشست"
        subtitle="برای سایت‌هایی مانند دیجی‌موویز و سایر سایت‌های VIP — لینک مستقیم، مرورگر واقعی روی مانیتور، یا ورود خودکار با اکانت خودت"
      >
        {getAdminMode() === 'github' ? (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[10.5px] text-amber-200">
            ⚠️ این ابزارها (مرورگر واقعی، کوکی و نشست) فقط روی کامپیوتر خودت کار می‌کنند — پنل را از لوکال باز کن: <a href="http://localhost:3210/admin" target="_blank" rel="noopener noreferrer" className="underline">localhost:3210/admin</a>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <TextInput
            value={browserUrl}
            onChange={(e) => setBrowserUrl(e.target.value)}
            placeholder="مثال: https://digimoviez.com یا آدرس صفحه ورود سایت فیلم"
            dir="ltr"
          />
          {(() => {
            const target = (browserUrl.trim() || url.trim()).trim();
            const fullUrl = target ? (/^https?:\/\//i.test(target) ? target : `https://${target}`) : '';
            return (
              <a
                href={fullUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!fullUrl) {
                    e.preventDefault();
                    toast.push('info', 'آدرس لازم است', 'ابتدا آدرس سایت را وارد کنید.');
                    return;
                  }
                  toast.push('success', 'لینک باز شد', 'سایت در تب جدید باز شد. وارد اکانت شوید.');
                }}
                className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-gradient-to-l from-[#F3D06B]/90 to-[#D4AF37]/90 px-4 py-2.5 text-[11px] font-bold text-black transition hover:brightness-110"
                style={{ pointerEvents: fullUrl ? 'auto' : 'none', opacity: fullUrl ? 1 : 0.5 }}
              >
                ↗ باز کردن سایت در تب جدید
              </a>
            );
          })()}
          <GoldButton onClick={launchInteractiveBrowser} loading={launchingBrowser} variant="ghost">
            🖥️ مرورگر واقعی روی مانیتور
          </GoldButton>
        </div>
        {(browserUrl.trim() || url.trim()) ? (
          <p className="mt-2 text-[10px] text-zinc-500" dir="ltr">
            {/^https?:\/\//i.test(browserUrl.trim() || url.trim()) ? (browserUrl.trim() || url.trim()) : `https://${browserUrl.trim() || url.trim()}`}
          </p>
        ) : null}
        {launchingBrowser ? (
          <p className="mt-2 text-[10.5px] text-[#D4AF37]">
            ⏳ مرورگر در حال باز شدن است (چند ثانیه طول می‌کشد) — پنجره ممکن است پشت دیگر برنامه‌ها باز شود؛ در نوار وظیفه (Taskbar) دنبال پنجره «Google Chrome for Testing» بگرد.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-amber-300">📋 نشست‌های ذخیره‌شده (بعد از لاگین خودکار اضافه می‌شود):</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void refreshSessions()}
                className="rounded-lg border border-white/12 px-2 py-1 text-[10px] font-bold text-zinc-300 transition hover:border-[#D4AF37]/40"
              >
                ↻ بررسی دوباره
              </button>
              <button
                type="button"
                onClick={() => void fetchSessionCookies()}
                className="rounded-lg border border-white/12 px-2 py-1 text-[10px] font-bold text-zinc-300 transition hover:border-[#D4AF37]/40"
              >
                🍪 کوکی مرورگر زنده
              </button>
            </div>
          </div>
          {sessions.length === 0 ? (
            <p className="text-[10px] text-zinc-500">هنوز نشستی ذخیره نشده — یکی از دو دکمه بالا را استفاده کن، بعد از بستن مرورگر «بررسی دوباره» را بزن.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => (
                <Badge key={s.host} tone={s.logged_in ? 'green' : 'neutral'}>
                  {s.host} • {s.count} کوکی{s.logged_in ? ' ✓ لاگین' : ''}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[11px] font-bold text-amber-300">
            📋 وارد کردن دستی کوکی / نشست ورود (اختیاری و فوق‌العاده سریع):
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              placeholder="مقدار Cookie یا توکن لاگین سایت را اینجا بچسبانید (مثلاً: sessionid=...)"
              className="flex-1 text-xs"
              dir="ltr"
              onChange={(e) => {
                const val = e.target.value.trim();
                if (val) {
                  setNotes((prev) => (prev ? `${prev} | ` : '') + `Cookie: ${val}`);
                  toast.push('success', 'کوکی ثبت شد', 'نشست با موفقیت به سورس اضافه شد.');
                }
              }}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="📂 لیست فایل‌های منبع — تیک بزن، کامل به تلگرام برو"
        subtitle="از یک صفحه سایت منبع لینک بگیر؛ فایل‌ها را با تیک انتخاب کن؛ دانلود کامل + آپلود واقعی به کانال تلگرام تو با نام خود فایل‌ها"
      >
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            value={sourcePageUrl}
            onChange={(e) => setSourcePageUrl(e.target.value)}
            placeholder="آدرس یک صفحه از سایت منبع (لیست فیلم/سریال)"
            dir="ltr"
            className="min-w-[240px] flex-1"
          />
          <GoldButton
            onClick={() => void extractSourceFiles()}
            loading={extractingFiles}
            disabled={!sourcePageUrl.trim()}
          >
            📂 استخراج لیست فایل‌ها
          </GoldButton>
          <GoldButton
            variant="ghost"
            onClick={() => void sendSelectedToTelegram()}
            disabled={selectedForTelegram.length === 0 || sendingToTelegram}
          >
            {sendingToTelegram ? 'در حال ارسال…' : `📤 ارسال ${selectedForTelegram.length.toLocaleString('fa-IR')} فایل تیک‌خورده به تلگرام`}
          </GoldButton>
        </div>

        {extractedFiles.length > 0 ? (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
            {extractedFiles.map((f, i) => {
              const name = fileNameFromUrl(f.url);
              const checked = selectedForTelegram.includes(f.url);
              const st = transferState[f.url];
              return (
                <label
                  key={f.url + i}
                  className="flex cursor-pointer items-center gap-2 border-b border-white/5 px-2 py-2 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedForTelegram((prev) =>
                        prev.includes(f.url) ? prev.filter((u) => u !== f.url) : [...prev, f.url]
                      )
                    }
                    className="accent-[#D4AF37]"
                  />
                  <Badge tone={f.type === 'direct' || f.type === 'stream' ? 'green' : f.type === 'embed' ? 'gold' : 'neutral'}>
                    {f.type === 'direct' ? 'مستقیم' : f.type === 'stream' ? 'استریم' : f.type === 'embed' ? 'پلیر' : 'صفحه'}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-zinc-300" dir="ltr" title={f.url}>
                    {name}
                  </span>
                  <TextInput
                    value={fileNames[f.url] ?? ''}
                    onChange={(e) => setFileNames((prev) => ({ ...prev, [f.url]: e.target.value }))}
                    placeholder="نام ارسالی (اختیاری)"
                    className="w-40 text-[10px]"
                  />
                  {st ? (
                    <Badge tone={st.status === 'uploaded' ? 'green' : st.status === 'failed' ? 'red' : 'gold'}>
                      {st.status === 'downloading'
                        ? `⏬ ${st.progressPct}%`
                        : st.status === 'uploading'
                          ? `⏫ ${st.progressPct}%`
                          : st.status === 'uploaded'
                            ? '✅ رسید به تلگرام'
                            : `⛔ ${st.error || 'ناموفق'}`}
                    </Badge>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-zinc-500">
            صفحه منبع را بچسبان و «استخراج لیست فایل‌ها» را بزن — فایل‌های مستقیم/پلیر/صفحه‌های دانلود لیست می‌شوند. فایل‌هایی که تیک می‌زنی دانلود کامل می‌شوند و با همان نام اصلی به کانال «Aipetros» می‌روند.
          </p>
        )}

        {transferItems.length > 0 && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10.5px] font-bold text-amber-300">وضعیت انتقال اخیر:</p>
            {transferItems.map((t) => (
              <p key={t.id} className="text-[10px] text-zinc-300">
                {t.status === 'uploaded' ? '✅' : t.status === 'failed' ? '⛔' : '⏳'} {t.title} — {t.status === 'downloading' ? `⏬ ${t.progressPct}%` : t.status === 'uploading' ? `⏫ ${t.progressPct}%` : t.status === 'uploaded' ? 'رسید' : t.error || t.status}
              </p>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="سورس‌های استریم و دانلود"
        subtitle="اعتبارسنجی واقعی سورس با درخواست Range (۲۰۶) پیش از ثبت — سورس خراب یا بدون پشتیبانی بازه پذیرفته نمی‌شود"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <TextInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://host/path/movie.mp4 | https://host/master.m3u8 | /api/stream/cache/<id>"
            dir="ltr"
          />
          <GoldButton onClick={validate} loading={validating}>
            <ShieldCheck className="h-3.5 w-3.5" />
            اعتبارسنجی
          </GoldButton>
        </div>

        {validation ? (
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 text-[11px] leading-6 ${
              validation.ok
                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                : 'border-amber-500/30 bg-amber-950/30 text-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={validation.ok ? 'green' : 'red'}>
                {validation.ok ? 'معتبر' : 'نامعتبر'}
              </Badge>
              {validation.kind ? <Badge tone="gold">{KIND_LABEL[validation.kind]}</Badge> : null}
              {validation.status ? <Badge>HTTP {validation.status}</Badge> : null}
              {validation.contentType ? (
                <Badge dir="ltr">{validation.contentType}</Badge>
              ) : null}
              {validation.acceptsRanges ? <Badge tone="blue">Accept-Ranges ✓</Badge> : null}
              {validation.contentLength ? (
                <Badge dir="ltr">
                  {Math.round(validation.contentLength / 1024).toLocaleString('fa-IR')} KB
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5">{validation.messageFa}</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="نام سورس">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="نوع">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="direct_mp4">MP4 مستقیم</option>
              <option value="hls">HLS / m3u8</option>
              <option value="telegram_gateway">تلگرام گیت‌وی</option>
              <option value="cache_gateway">کش استریم</option>
            </Select>
          </Field>
          <Field label="پورت گیت‌وی تلگرام" hint="پورت پیش‌فرض سرویس Range">
            <TextInput
              type="number"
              value={gatewayPort}
              onChange={(e) => setGatewayPort(e.target.value)}
              dir="ltr"
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 rounded-xl border border-amber-500/20 bg-amber-950/10 p-3">
          <Field label="نام کاربری VIP (اختیاری)" hint="برای سایت‌های اشتراکی و VIP">
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user_vip"
              dir="ltr"
            />
          </Field>
          <Field label="رمز عبور VIP (اختیاری)" hint="برای Basic Auth سرور مبدا">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
            />
          </Field>
          <Field label="یادداشت">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="توضیحات سرور یا پلن" />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <GoldButton onClick={save} loading={saving} disabled={!url.trim()}>
            <Plus className="h-3.5 w-3.5" />
            ثبت سورس
          </GoldButton>
        </div>
      </Panel>

      <Panel title="سورس‌های ثبت‌شده" subtitle={`${sources.length} سورس`}>
        {loading ? (
          <p className="py-8 text-center text-xs text-zinc-500">در حال بارگذاری…</p>
        ) : sources.length === 0 ? (
          <EmptyState
            title="سورسی ثبت نشده است"
            description="سورس‌های استریم ابری و لینک‌های دانلود کم‌حجم را در این بخش ثبت و اعتبارسنجی کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-[11px]">
              <thead className="text-[10px] text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 pl-2 font-bold">نام</th>
                  <th className="py-2 pl-2 font-bold">نوع</th>
                  <th className="py-2 pl-2 font-bold">آدرس</th>
                  <th className="py-2 pl-2 font-bold">پورت</th>
                  <th className="py-2 pl-2 font-bold">وضعیت</th>
                  <th className="py-2 font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-b border-white/5">
                    <td className="py-2 pl-2 font-bold text-zinc-200">{source.name}</td>
                    <td className="py-2 pl-2">
                      <Badge tone="gold">{KIND_LABEL[source.kind] || source.kind}</Badge>
                    </td>
                    <td className="max-w-[16rem] truncate py-2 pl-2 text-zinc-500" dir="ltr">
                      {source.baseUrl || '—'}
                    </td>
                    <td className="py-2 pl-2 text-zinc-400" dir="ltr">
                      {source.gatewayPort || '—'}
                    </td>
                    <td className="py-2 pl-2">
                      <Badge tone={source.status === 'active' ? 'green' : 'neutral'}>
                        {source.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await adminApi.deleteSource(source.id);
                            toast.push('success', 'سورس حذف شد');
                            await load();
                          } catch (error) {
                            toast.push('error', 'حذف ناموفق', (error as Error).message);
                          }
                        }}
                        className="rounded-lg border border-white/12 p-1.5 text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="سرویس‌های استریم"
        subtitle="نشانی سرویس‌هایی که پنل برای اعتبارسنجی و پخش استفاده می‌کند"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ServiceCard
            icon={<Server className="h-4 w-4" />}
            title="سرور استریم محلی"
            detail="/api/stream/cache/<id> — گیت‌وی کش غلتان ۸ ساعته با پشتیبانی کامل Range"
          />
          <ServiceCard
            icon={<Radio className="h-4 w-4" />}
            title="گیت‌وی تلگرام"
            detail="پورت ۸۰۸۹ — سرویس Range تلگرام برای عناوین t.me"
          />
          <ServiceCard
            icon={<Link2 className="h-4 w-4" />}
            title="کلاینت‌ها"
            detail="همگام‌سازی خودکار با data/streams.json روی raw.githubusercontent.com"
          />
        </div>
      </Panel>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  detail
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5">
      <div className="flex items-center gap-2 text-[#F5E7B8]">
        {icon}
        <span className="text-xs font-bold">{title}</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-5 text-zinc-500" dir="auto">
        {detail}
      </p>
    </div>
  );
}
