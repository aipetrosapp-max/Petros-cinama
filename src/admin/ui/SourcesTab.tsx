/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Sources tab: validate and register stream/download sources.
 */
import React, { useEffect, useState } from 'react';
import { Link2, Plus, Trash2, ShieldCheck, Server, Radio } from 'lucide-react';
import type { SourceRecord } from '../types.ts';
import { adminApi, type SourceValidationResult } from '../client.ts';
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

  const launchInteractiveBrowser = async () => {
    const target = browserUrl.trim() || url.trim();
    if (!target) {
      toast.push('info', 'آدرس سایت لازم است', 'ابتدا آدرس سایت (مثلاً https://digimoviez.com) را وارد کنید.');
      return;
    }
    setLaunchingBrowser(true);
    try {
      const res = await adminApi.launchBrowser(target);
      toast.push('success', 'مرورگر باز شد', res.messageFa);
      if (!name) setName(new URL(target).hostname);
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
        title="🌐 مرورگر لاگین هوشمند سورس (Web Bot Login)"
        subtitle="برای سایت‌هایی مانند دیجی‌موویز و سایت‌های VIP — مرورگر را باز کنید، در پنجره باز شده لاگین کنید، کوکی‌ها و توکن‌ها خودکار استخراج می‌شوند"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <TextInput
            value={browserUrl}
            onChange={(e) => setBrowserUrl(e.target.value)}
            placeholder="مثال: https://digimoviez.com یا آدرس صفحه ورود سایت فیلم"
            dir="ltr"
          />
          <GoldButton onClick={launchInteractiveBrowser} loading={launchingBrowser}>
            🌐 باز کردن مرورگر لاگین
          </GoldButton>
          <GoldButton variant="ghost" onClick={fetchSessionCookies}>
            📥 استخراج خودکار کوکی‌ها {cookieCount ? `(${cookieCount})` : ''}
          </GoldButton>
        </div>
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
