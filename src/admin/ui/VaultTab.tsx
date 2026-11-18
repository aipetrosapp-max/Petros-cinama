/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Vault tab: crypto wallets, API tokens and client feature switches.
 */
import React, { useEffect, useState } from 'react';
import {
  Wallet,
  KeyRound,
  ToggleLeft,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Coins,
  ShieldAlert
} from 'lucide-react';
import type { AdminConfig, FeatureFlags, WalletRecord } from '../types.ts';
import { adminApi } from '../client.ts';
import {
  Panel,
  GoldButton,
  TextInput,
  Select,
  Field,
  Badge,
  Toggle,
  useToast,
  EmptyState
} from './primitives.tsx';

const NETWORKS: Array<{ id: WalletRecord['network']; decimals: number }> = [
  { id: 'BTC', decimals: 8 },
  { id: 'ETH', decimals: 18 },
  { id: 'USDT-TRC20', decimals: 6 },
  { id: 'USDT-ERC20', decimals: 6 },
  { id: 'TON', decimals: 9 },
  { id: 'LTC', decimals: 8 }
];

const FEATURE_LABELS: Array<{ key: keyof FeatureFlags; label: string; description: string }> = [
  {
    key: 'donationEnabled',
    label: 'درگاه دونیت',
    description: 'نمایش دکمه حمایت مالی در کلاینت‌ها'
  },
  {
    key: 'cryptoPaymentEnabled',
    label: 'پرداخت ارزی',
    description: 'امکان پرداخت با کیف‌پول رمزارز در اپلیکیشن'
  },
  {
    key: 'cryptoAdBannerEnabled',
    label: 'بنر تبلیغاتی رمزارز',
    description: 'نمایش بنر تبلیغات در صفحه اصلی'
  },
  {
    key: 'watchPartyEnabled',
    label: 'تماشای گروهی (Watch Party)',
    description: 'بدون پیاده‌سازی واقعی، کلاینت برچسب «به‌زودی» نشان می‌دهد'
  },
  {
    key: 'offlineDownloadEnabled',
    label: 'دانلود آفلاین',
    description: 'دانلود بایت واقعی و ذخیره در IndexedDB کلاینت'
  },
  {
    key: 'telegramGatewayEnabled',
    label: 'گیت‌وی تلگرام',
    description: 'مسیریابی عناوین t.me به سرویس Range'
  },
  {
    key: 'aiSubtitleSyncEnabled',
    label: 'همگام‌سازی زیرنویس هوشمند',
    description: 'فقط برای زیرنویس‌های ثبت‌شده؛ بدون متن ساختگی'
  },
  {
    key: 'maintenanceMode',
    label: 'حالت تعمیرات',
    description: 'نمایش وضعیت «در حال آماده‌سازی» به‌جای پخش'
  }
];

export function VaultTab() {
  const toast = useToast();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [tokenDraft, setTokenDraft] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const result = await adminApi.vault();
      setConfig(result);
      setFeatures(result.features);
    } catch (error) {
      toast.push('error', 'بارگذاری ولت ناموفق', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFeatures = async (next: FeatureFlags) => {
    setFeatures(next);
    try {
      await adminApi.saveFeatures(next);
      toast.push('success', 'سوییچ‌ها ذخیره شدند', 'پس از «اعمال سراسری» در کلاینت‌ها اعمال می‌شوند.');
    } catch (error) {
      toast.push('error', 'ذخیره ناموفق', (error as Error).message);
    }
  };

  const saveToken = async (key: string) => {
    const value = (tokenDraft[key] || '').trim();
    if (!value) {
      toast.push('info', 'مقدار لازم است', 'توکن را وارد کنید.');
      return;
    }
    try {
      const result = await adminApi.saveToken(key, value);
      setConfig(result.config);
      setTokenDraft((prev) => ({ ...prev, [key]: '' }));
      toast.push('success', 'توکن ذخیره شد', result.messageFa);
    } catch (error) {
      toast.push('error', 'ذخیره توکن ناموفق', (error as Error).message);
    }
  };

  if (loading) {
    return (
      <Panel title="ولت و توکن‌ها">
        <p className="py-10 text-center text-xs text-zinc-500">در حال بارگذاری…</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="کیف‌پول‌های پلتفرم"
        subtitle="آدرس دریافت دونیت و پرداخت — فقط کیف‌پول‌های فعال به کلاینت‌ها ارسال می‌شوند"
        actions={
          <GoldButton
            variant="ghost"
            onClick={async () => {
              try {
                const result = await adminApi.saveWallet({
                  network: 'BTC',
                  address: '',
                  label: 'کیف‌پول جدید',
                  enabled: true,
                  decimals: 8
                });
                setConfig(result.config);
                toast.push('success', 'کیف‌پول ایجاد شد', 'آدرس را ویرایش کنید.');
              } catch (error) {
                toast.push('error', 'ایجاد کیف‌پول ناموفق', (error as Error).message);
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            کیف‌پول جدید
          </GoldButton>
        }
      >
        {(config?.wallets || []).length === 0 ? (
          <EmptyState
            title="کیف‌پولی ثبت نشده است"
            description="برای فعال‌سازی بخش دونیت، حداقل یک کیف‌پول فعال ثبت کنید."
          />
        ) : (
          <div className="space-y-2">
            {(config?.wallets || []).map((wallet) => (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                onChanged={(next) =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, wallets: next.map((w) => (w.id === wallet.id ? w : w)) }
                      : prev
                  )
                }
                onDelete={async () => {
                  try {
                    const result = await adminApi.deleteWallet(wallet.id);
                    setConfig(result.config);
                    toast.push('success', 'کیف‌پول حذف شد');
                  } catch (error) {
                    toast.push('error', 'حذف ناموفق', (error as Error).message);
                  }
                }}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="توکن‌های دسترسی API"
        subtitle="مقادیر توکن هرگز به مرورگر برنمی‌گردد؛ فقط پیش‌نمایش پوشانده‌شده نمایش داده می‌شود"
      >
        <div className="space-y-3">
          {(config?.tokens || []).map((token) => {
            const draft = tokenDraft[token.id] || '';
            const isRevealed = revealed[token.id];
            return (
              <div
                key={token.id}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-xs font-bold text-zinc-200">{token.labelFa}</span>
                    <Badge tone={token.value ? 'green' : 'red'}>
                      {token.value ? 'تنظیم‌شده' : 'تنظیم‌نشده'}
                    </Badge>
                    {token.required ? <Badge tone="gold">الزامی</Badge> : null}
                  </div>
                  <span className="text-[10px] text-zinc-600" dir="ltr">
                    {token.value || '—'}
                  </span>
                </div>
                {token.description ? (
                  <p className="mt-1.5 text-[10px] leading-5 text-zinc-500">{token.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <TextInput
                    value={draft}
                    onChange={(e) => setTokenDraft((prev) => ({ ...prev, [token.id]: e.target.value }))}
                    placeholder={isRevealed ? '••••••••' : 'توکن جدید را وارد کنید'}
                    type={isRevealed ? 'text' : 'password'}
                    className="min-w-[12rem] flex-1"
                    dir="ltr"
                  />
                  <GoldButton variant="ghost" onClick={() => setRevealed((prev) => ({ ...prev, [token.id]: !prev[token.id] }))}>
                    {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </GoldButton>
                  <GoldButton onClick={() => saveToken(token.id)}>
                    <Save className="h-3.5 w-3.5" />
                    ذخیره
                  </GoldButton>
                </div>
              </div>
            );
          })}
          {(config?.tokens || []).length === 0 ? (
            <EmptyState title="توکنی تعریف نشده است" />
          ) : null}
        </div>
      </Panel>

      <Panel
        title="سوییچ‌های کلاینت"
        subtitle="این سوییچ‌ها پس از «ذخیره و اعمال سراسری» روی همه دستگاه‌ها اعمال می‌شوند"
      >
        {features ? (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {FEATURE_LABELS.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                description={item.description}
                checked={Boolean(features[item.key])}
                onChange={(next) => saveFeatures({ ...features, [item.key]: next })}
              />
            ))}
          </div>
        ) : null}
      </Panel>

      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-950/25 px-4 py-3 text-[10px] leading-6 text-amber-200/90">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          توکن‌ها در فایل <code className="font-mono">data/admin-config.json</code> ذخیره می‌شوند؛
          این فایل نباید در ریپازیتوری عمومی قرار گیرد. برای محیط عملیاتی، متغیرهای محیطی
          سرور (<code className="font-mono">GITHUB_TOKEN</code>،
          <code className="font-mono"> TELEGRAM_BOT_TOKEN</code>،
          <code className="font-mono"> GEMINI_API_KEY</code>) توصیه می‌شود.
        </p>
      </div>
    </div>
  );
}

function WalletRow({
  wallet,
  onChanged,
  onDelete
}: {
  wallet: WalletRecord;
  onChanged: (wallets: WalletRecord[]) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [address, setAddress] = useState(wallet.address);
  const [label, setLabel] = useState(wallet.label || '');
  const [enabled, setEnabled] = useState(wallet.enabled);
  const [network, setNetwork] = useState(wallet.network);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await adminApi.saveWallet({
        id: wallet.id,
        network,
        address,
        label,
        enabled,
        decimals: NETWORKS.find((n) => n.id === network)?.decimals ?? 8
      });
      onChanged(result.config.wallets || []);
      toast.push('success', 'کیف‌پول ذخیره شد');
    } catch (error) {
      toast.push('error', 'ذخیره ناموفق', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5">
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr_auto]">
        <Field label="شبکه">
          <Select
            value={network}
            onChange={(e) => setNetwork(e.target.value as WalletRecord['network'])}
          >
            {NETWORKS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="آدرس کیف‌پول">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} dir="ltr" />
        </Field>
        <Field label="برچسب">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            title={enabled ? 'غیرفعال کردن' : 'فعال کردن'}
            className={`rounded-lg border px-2.5 py-2 transition ${
              enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/12 text-zinc-500'
            }`}
          >
            <ToggleLeft className="h-4 w-4" />
          </button>
          <GoldButton onClick={save} loading={saving}>
            <Save className="h-3.5 w-3.5" />
          </GoldButton>
          <GoldButton variant="danger" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </GoldButton>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Coins className="h-3 w-3 text-[#D4AF37]" />
        <span className="text-[9px] text-zinc-600">
          دقت اعشار: {NETWORKS.find((n) => n.id === network)?.decimals ?? 8} • وضعیت:{' '}
          {enabled ? 'فعال (در کلاینت نمایش داده می‌شود)' : 'غیرفعال'}
        </span>
      </div>
    </div>
  );
}
