/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * GitHub Live Sync tab: repository status + "save & apply globally" action.
 */
import React, { useEffect, useState } from 'react';
import {
  Github,
  GitCommitHorizontal,
  UploadCloud,
  RefreshCw,
  ExternalLink,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { adminApi, type GithubStatusResponse, type PublishResult } from '../client.ts';
import { Panel, GoldButton, TextInput, Badge, Field, useToast, StatCard } from './primitives.tsx';

export function SyncTab({ onPublished }: { onPublished: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<GithubStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<PublishResult | null>(null);
  const [remote, setRemote] = useState<{ sha: string; version: string; count: number } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [syncStatus, remoteCatalog] = await Promise.all([
        adminApi.syncStatus(),
        adminApi.remoteCatalog().catch(() => null)
      ]);
      setStatus(syncStatus);
      setRemote(remoteCatalog);
    } catch (error) {
      toast.push('error', 'دریافت وضعیت ناموفق', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    setPublishing(true);
    try {
      const outcome = await adminApi.publish(message.trim());
      setResult(outcome);
      toast.push(
        outcome.ok ? 'success' : 'info',
        outcome.ok ? 'اعمال سراسری انجام شد' : 'فقط به‌صورت محلی ذخیره شد',
        outcome.messageFa
      );
      if (outcome.ok) {
        setMessage('');
        await loadStatus();
        onPublished();
      }
    } catch (error) {
      toast.push('error', 'اعمال سراسری ناموفق', (error as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="موتور همگام‌سازی زنده گیت‌هاب"
        subtitle="معماری Zero-Client-Update: با یک commit روی برنچ main، همه دستگاه‌های نصب‌شده بدون به‌روزرسانی کلاینت تغییرات را دریافت می‌کنند"
        actions={
          <GoldButton variant="ghost" onClick={loadStatus} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            تازه‌سازی وضعیت
          </GoldButton>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="اتصال گیت‌هاب"
            value={status?.configured ? 'متصل' : 'تنظیم‌نشده'}
            hint={status?.configured ? `${status.owner}/${status.repo}` : 'GITHUB_TOKEN لازم است'}
            icon={
              status?.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )
            }
          />
          <StatCard
            label="برنچ هدف"
            value={status?.branch || '—'}
            hint={status?.configPath || 'data/admin-config.json'}
            icon={<GitCommitHorizontal className="h-4 w-4 text-[#D4AF37]" />
            }
          />
          <StatCard
            label="آخرین commit"
            value={status?.lastCommitSha ? status.lastCommitSha.slice(0, 7) : '—'}
            hint={status?.lastCommitAt ? new Date(status.lastCommitAt).toLocaleString('fa-IR') : '—'}
            icon={<Github className="h-4 w-4 text-zinc-400" />
            }
          />
          <StatCard
            label="کاتالوگ ریموت"
            value={remote ? remote.count : '—'}
            hint={remote ? `نسخه ${remote.version}` : 'در دسترس نیست'}
            icon={<Radio className="h-4 w-4 text-emerald-400" />
            }
          />
        </div>

        {status?.error ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[11px] leading-6 text-amber-200">
            {status.error}
          </div>
        ) : null}

        {status?.lastCommitUrl ? (
          <a
            href={status.lastCommitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F5E7B8] underline-offset-4 hover:underline"
          >
            مشاهده آخرین commit در گیت‌هاب
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </Panel>

      <Panel
        title="ذخیره و اعمال سراسری"
        subtitle="کاتالوگ بازسازی می‌شود، فایل‌های مرجع به‌روز می‌شوند، سپس روی main کامیت و push می‌شود"
      >
        <Field label="پیام کامیت (اختیاری)">
          <TextInput
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="مثال: افزودن ۱۲ فیلم جدید و فعال‌سازی درگاه دونیت"
          />
        </Field>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5">
          <h4 className="mb-2.5 text-[11px] font-bold text-zinc-400">مراحل اجرا</h4>
          <ol className="space-y-1.5 text-[10px] leading-6 text-zinc-500">
            <li>
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
                ۱
              </span>
              بازسازی کاتالوگ کلاینت از مدل داخلی (عنوان‌ها، کیفیت‌ها، زیرنویس‌ها، فصل/قسمت‌ها)
            </li>
            <li>
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
                ۲
              </span>
              نوشتن <code className="font-mono">data/streams.json</code> و{' '}
              <code className="font-mono">public/</code> به‌صورت محلی
            </li>
            <li>
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
                ۳
              </span>
              ساخت commit روی برنچ{' '}
              <code className="font-mono">{status?.branch || 'main'}</code> و push از طریق GitHub API
            </li>
            <li>
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
                ۴
              </span>
              افزایش <code className="font-mono">manifestVersion</code> برای همگام‌سازی فوری کلاینت‌ها
            </li>
          </ol>
        </div>

        <div className="mt-4 flex justify-end">
          <GoldButton onClick={publish} loading={publishing} className="min-w-[12rem]">
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            ذخیره و اعمال سراسری
          </GoldButton>
        </div>

        {result ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3.5 ${
              result.ok
                ? 'border-emerald-500/30 bg-emerald-950/25'
                : 'border-amber-500/30 bg-amber-950/25'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.ok ? 'green' : 'amber'}>
                {result.ok ? 'اعمال شد' : 'فقط محلی'}
              </Badge>
              <Badge tone="gold">manifest: {result.manifestVersion}</Badge>
              {result.commit?.commitSha ? (
                <Badge dir="ltr">{result.commit.commitSha.slice(0, 8)}</Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-6 text-zinc-300">{result.messageFa}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
              <Badge>عنوان: {result.counts.titles}</Badge>
              <Badge>فصل: {result.counts.seasons}</Badge>
              <Badge>قسمت: {result.counts.episodes}</Badge>
              <Badge>کیفیت: {result.counts.qualities}</Badge>
              <Badge>زیرنویس: {result.counts.subtitles}</Badge>
            </div>
            {result.commit?.htmlUrl ? (
              <a
                href={result.commit.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F5E7B8] underline-offset-4 hover:underline"
              >
                مشاهده commit
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="جریان انتشار زنده" subtitle="مسیر دریافت تغییرات در کلاینت‌ها">
        <div className="space-y-2 text-[10px] leading-6 text-zinc-500">
          <p>
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
              ۱
            </span>
            پنل، commit را روی <code className="font-mono">main</code> منتشر می‌کند.
          </p>
          <p>
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
              ۲
            </span>
            کلاینت‌های نصب‌شده (وب، اندروید، تلویزیون، دسکتاپ) در چرخه Dynamic Stream Sync
            فایل <code className="font-mono">data/streams.json</code> را از
            <code className="font-mono"> raw.githubusercontent.com</code> می‌خوانند.
          </p>
          <p>
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
              ۳
            </span>
            کاتالوگ در IndexedDB ذخیره و پلیر بدون نصب نسخه جدید، فهرست و استریم‌ها را تازه می‌کند.
          </p>
          <p>
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/20 text-[9px] font-bold text-[#F5E7B8]">
              ۴
            </span>
            سوییچ‌های بخش ولت از طریق <code className="font-mono">/api/public/config</code> به
            کلاینت‌ها می‌رسند.
          </p>
        </div>
      </Panel>
    </div>
  );
}
