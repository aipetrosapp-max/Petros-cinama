/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Root SPA shell: RTL, luxury gold on matte black, tab navigation, dashboard.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  LibraryBig,
  Server,
  Wallet,
  Github,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Activity,
  Clapperboard,
  Layers,
  Subtitles,
  CircleDot,
  Bot,
  UploadCloud,
  ListVideo
} from 'lucide-react';
import { adminApi, clearSessionToken, setSessionToken, getSessionExpiry } from '../client.ts';
import type { TitleRecord } from '../types.ts';
import { LoginGate, SessionExpiryBadge, Spinner } from './LoginGate.tsx';
import { ArchiveTab } from './ArchiveTab.tsx';
import { SourcesTab } from './SourcesTab.tsx';
import { VaultTab } from './VaultTab.tsx';
import { SyncTab } from './SyncTab.tsx';
import { AgentChatTab } from './AgentChatTab.tsx';
import { CollectionTab } from './CollectionTab.tsx';
import { Panel, StatCard, Badge, GoldButton, useToast } from './primitives.tsx';

type TabKey = 'agent' | 'dashboard' | 'archive' | 'collection' | 'sources' | 'vault' | 'sync';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'agent', label: 'ایجنت هوشمند', icon: <Bot className="h-4 w-4" /> },
  { key: 'dashboard', label: 'داشبورد', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'archive', label: 'آرشیو مدیا', icon: <LibraryBig className="h-4 w-4" /> },
  { key: 'collection', label: 'کالکشن ۲۵۰تایی', icon: <ListVideo className="h-4 w-4" /> },
  { key: 'sources', label: 'سورس‌ها', icon: <Server className="h-4 w-4" /> },
  { key: 'vault', label: 'ولت و توکن‌ها', icon: <Wallet className="h-4 w-4" /> },
  { key: 'sync', label: 'همگام‌سازی گیت‌هاب', icon: <Github className="h-4 w-4" /> }
];

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const toast = useToast();
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminApi.dashboard>> | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (window as unknown as { __pc_admin_expiry?: number }).__pc_admin_expiry = getSessionExpiry();
  }, [authenticated]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, catalog] = await Promise.all([adminApi.dashboard(), adminApi.catalog()]);
      setDashboard(dash);
      setTitles(catalog.titles || []);
    } catch {
      // the session may have expired — the guard below handles it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } catch {
      // ignore
    }
    clearSessionToken();
    setAuthenticated(false);
    setTab('dashboard');
  }, []);

  if (!authenticated) {
    return (
      <LoginGate
        onAuthenticated={() => {
          (window as unknown as { __pc_admin_expiry?: number }).__pc_admin_expiry =
            getSessionExpiry();
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#06060a] text-zinc-200">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(1000px 520px at 100% -10%, rgba(212,175,55,0.13), transparent 60%), radial-gradient(800px 520px at 0% 100%, rgba(90,60,20,0.10), transparent 60%)'
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06060a]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-gradient-to-b from-[#D4AF37]/25 to-transparent">
              <ShieldCheck className="h-4.5 w-4.5 text-[#F5E7B8]" style={{ height: '1.1rem', width: '1.1rem' }} />
            </div>
            <div>
              <h1 className="text-xs font-black leading-4 text-[#F5E7B8] sm:text-sm">
                Petros Cinema Master Admin Panel
              </h1>
              <p className="text-[9px] text-zinc-500">پنل مدیریت اختصاصی پتروس سینما</p>
            </div>
          </div>

          <div className="mr-auto flex items-center gap-2">
            <GoldButton
              variant="ghost"
              onClick={async () => {
                if (!window.confirm('اعمال سراسری: ساخت مانیفست و push روی سایت؟')) return;
                try {
                  const res = await adminApi.publish('publish via admin header');
                  if (res.ok) {
                    toast.push('success', 'روی سایت منتشر شد', 'همه دستگاه‌ها در چرخه همگام‌سازی دریافت می‌کنند.');
                  } else {
                    toast.push('info', 'فقط محلی ذخیره شد', 'push گیت‌هاب ناموفق بود — تب همگام‌سازی را چک کن.');
                  }
                  await load();
                } catch (e) {
                  toast.push('error', 'انتشار ناموفق', (e as Error).message);
                }
              }}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              اعمال سراسری
            </GoldButton>
            <button
              type="button"
              onClick={load}
              title="تازه‌سازی داده‌ها"
              className="rounded-xl border border-white/12 p-2 text-zinc-400 transition hover:border-[#D4AF37]/40 hover:text-[#F5E7B8]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <SessionExpiryBadge onLogout={logout} />
            <button
              type="button"
              onClick={logout}
              title="خروج"
              className="rounded-xl border border-white/12 p-2 text-zinc-400 transition hover:border-rose-500/40 hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mx-auto max-w-[1400px] overflow-x-auto px-2 pb-2 sm:px-4">
          <div className="flex min-w-max gap-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
                  tab === item.key
                    ? 'bg-gradient-to-l from-[#F3D06B]/90 to-[#D4AF37]/90 text-black'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-[#F5E7B8]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {loading && !dashboard ? (
          <Spinner label="در حال بارگذاری داده‌ها…" />
        ) : tab === 'agent' ? (
          <AgentChatTab />
        ) : tab === 'dashboard' ? (
          <DashboardView dashboard={dashboard} titles={titles} onNavigate={setTab} />
        ) : tab === 'archive' ? (
          <ArchiveTab titles={titles} onChanged={load} />
        ) : tab === 'collection' ? (
          <CollectionTab />
        ) : tab === 'sources' ? (
          <SourcesTab />
        ) : tab === 'vault' ? (
          <VaultTab />
        ) : (
          <SyncTab onPublished={load} />
        )}
      </main>

      <footer className="relative border-t border-white/10 px-4 py-5 text-center text-[10px] text-zinc-600">
        Petros Cinema Master Admin Panel — تمام عملیات نوشتن با توکن نشست اعتبارسنجی می‌شود.
      </footer>
    </div>
  );
}

function DashboardView({
  dashboard,
  titles,
  onNavigate
}: {
  dashboard: Awaited<ReturnType<typeof adminApi.dashboard>> | null;
  titles: TitleRecord[];
  onNavigate?: (tab: 'agent' | 'dashboard' | 'archive' | 'sources' | 'vault' | 'sync') => void;
}) {
  const toast = useToast();
  const recent = useMemo(
    () =>
      [...titles]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 8),
    [titles]
  );

  if (!dashboard) {
    return (
      <Panel title="داشبورد">
        <p className="py-10 text-center text-xs text-zinc-500">اطلاعاتی برای نمایش نیست.</p>
      </Panel>
    );
  }

  const totals = dashboard.totals;

  return (
    <div className="space-y-4">
      <Panel
        title="داشبورد کلی"
        subtitle={`نسخه کاتالوگ: ${dashboard.catalogVersion} • آخرین به‌روزرسانی: ${new Date(
          dashboard.catalogUpdatedAt
        ).toLocaleString('fa-IR')}`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="کل عناوین"
            value={totals.titles.toLocaleString('fa-IR')}
            hint={`${totals.published.toLocaleString('fa-IR')} منتشرشده — کلیک: آرشیو`}
            icon={<Clapperboard className="h-4 w-4 text-[#D4AF37]" />}
            onClick={onNavigate ? () => onNavigate('archive') : undefined}
          />
          <StatCard
            label="فصل / قسمت"
            value={`${totals.seasons} / ${totals.episodes}`}
            hint="ساختار سریال و انیمه"
            icon={<Layers className="h-4 w-4 text-sky-400" />}
          />
          <StatCard
            label="کیفیت‌های ثبت‌شده"
            value={totals.qualities.toLocaleString('fa-IR')}
            hint="۴K / ۱۰۸۰ / ۷۲۰ / ۴۸۰"
            icon={<Activity className="h-4 w-4 text-emerald-400" />
            }
          />
          <StatCard
            label="زیرنویس‌ها"
            value={totals.subtitles.toLocaleString('fa-IR')}
            hint="ترک فارسی و انگلیسی"
            icon={<Subtitles className="h-4 w-4 text-rose-400" />
            }
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="فیلم"
            value={totals.byCategory.movie.toLocaleString('fa-IR')}
            hint="عنوان تک‌قسمتی"
          />
          <StatCard
            label="سریال"
            value={totals.byCategory.series.toLocaleString('fa-IR')}
            hint="فصل و قسمت"
          />
          <StatCard
            label="انیمه"
            value={totals.byCategory.anime.toLocaleString('fa-IR')}
            hint="فصل و قسمت"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="دارای استریم"
            value={dashboard.withStream.toLocaleString('fa-IR')}
            hint="قابل پخش در کلاینت — کلیک: گزارش سلامت در چت ایجنت"
            onClick={onNavigate ? () => onNavigate('agent') : undefined}
          />
          <StatCard
            label="بدون استریم"
            value={dashboard.withoutStream.toLocaleString('fa-IR')}
            hint="نمایش وضعیت تعمیرات در کلاینت"
          />
          <StatCard
            label="manifestVersion"
            value={dashboard.manifestVersion}
            hint="شناسه همگام‌سازی زنده"
          />
        </div>
      </Panel>

      <Panel title="سوییچ‌های فعال کلاینت" subtitle="وضعیت فعلی پرچم‌های قابلیت‌ها">
        <div className="flex flex-wrap gap-2">
          {Object.entries(dashboard.features).map(([key, value]) => (
            <Badge key={key} tone={value ? 'green' : 'neutral'}>
              <CircleDot className="h-2.5 w-2.5" />
              {FEATURE_LABELS_FA[key] || key}
            </Badge>
          ))}
        </div>
      </Panel>

      <Panel
        title="آخرین تغییرات"
        subtitle="۸ عنوان اخیراً ویرایش‌شده"
        actions={
          <GoldButton
            variant="ghost"
            onClick={() =>
              toast.push('info', 'نکته', 'برای اعمال تغییرات روی کلاینت‌ها به تب «همگام‌سازی گیت‌هاب» بروید.')
            }
          >
            راهنما
          </GoldButton>
        }
      >
        {recent.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">هنوز عنوانی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-[11px]">
              <thead className="text-[10px] text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 pl-2 font-bold">عنوان</th>
                  <th className="py-2 pl-2 font-bold">دسته</th>
                  <th className="py-2 pl-2 font-bold">وضعیت</th>
                  <th className="py-2 pl-2 font-bold">استریم</th>
                  <th className="py-2 font-bold">آخرین تغییر</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((title) => (
                  <tr key={title.id} className="border-b border-white/5">
                    <td className="py-2 pl-2 font-bold text-zinc-200">
                      {title.titleFa || title.title}
                    </td>
                    <td className="py-2 pl-2 text-zinc-400">
                      {title.category === 'movie'
                        ? 'فیلم'
                        : title.category === 'series'
                          ? 'سریال'
                          : 'انیمه'}
                    </td>
                    <td className="py-2 pl-2">
                      <Badge tone={title.status === 'published' ? 'green' : 'neutral'}>
                        {title.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
                      </Badge>
                    </td>
                    <td className="py-2 pl-2">
                      <Badge tone={(title.qualities || []).length ? 'gold' : 'red'}>
                        {(title.qualities || []).length || 0} کیفیت
                      </Badge>
                    </td>
                    <td className="py-2 text-zinc-500">
                      {new Date(title.updatedAt).toLocaleString('fa-IR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

const FEATURE_LABELS_FA: Record<string, string> = {
  donationEnabled: 'درگاه دونیت',
  cryptoPaymentEnabled: 'پرداخت ارزی',
  cryptoAdBannerEnabled: 'بنر تبلیغات',
  watchPartyEnabled: 'تماشای گروهی',
  offlineDownloadEnabled: 'دانلود آفلاین',
  telegramGatewayEnabled: 'گیت‌وی تلگرام',
  aiSubtitleSyncEnabled: 'زیرنویس هوشمند',
  maintenanceMode: 'حالت تعمیرات'
};
