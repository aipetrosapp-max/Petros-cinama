/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Login gate: master password → in-memory session token.
 */
import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { adminApi, setSessionToken, AdminApiError } from '../client.ts';
import { useToast, GoldButton, TextInput } from './primitives.tsx';

export function LoginGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .authStatus()
      .then((status) => setConfigured(status.passwordConfigured))
      .catch(() => setConfigured(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('رمز عبور را وارد کنید.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.login(password);
      setSessionToken(result.token, result.expiresAt);
      toast.push('success', 'ورود موفق', result.messageFa);
      onAuthenticated();
    } catch (err) {
      const message =
        err instanceof AdminApiError ? err.message : 'ورود ناموفق بود. دوباره تلاش کنید.';
      setError(message);
      toast.push('error', 'ورود ناموفق', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06060a] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(900px 500px at 50% -10%, rgba(212,175,55,0.16), transparent 65%), radial-gradient(700px 500px at 100% 100%, rgba(120,80,20,0.12), transparent 60%)'
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#08080c]/90 p-7 shadow-[0_40px_120px_-40px_rgba(212,175,55,0.35)] backdrop-blur-xl sm:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-b from-[#D4AF37]/25 to-transparent">
              <ShieldCheck className="h-8 w-8 text-[#F5E7B8]" />
            </div>
            <h1 className="text-lg font-black leading-7 text-[#F5E7B8]">
              Petros Cinema Master Admin Panel
            </h1>
            <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">
              پنل مدیریت اختصاصی پتروس سینما — کنترل آرشیو، استریم، کیف‌پول و اعمال سراسری
            </p>
          </div>

          {configured === false ? (
            <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-[11px] leading-6 text-amber-200">
              رمز اصلی مدیریت روی سرور تنظیم نشده است. متغیر محیطی{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
                MASTER_ADMIN_PASSWORD
              </code>{' '}
              را با حداقل ۱۲ کاراکتر مقداردهی کنید و سرویس را ری‌استارت کنید.
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="master-password"
                className="mb-1.5 block text-[11px] font-bold text-zinc-400"
              >
                رمز عبور اصلی مدیریت
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <TextInput
                  id="master-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="pr-9 pl-10 text-center tracking-[0.3em]"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-[#F5E7B8]"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-[11px] leading-5 text-rose-200">
                {error}
              </div>
            ) : null}

            <GoldButton type="submit" loading={loading} className="w-full">
              {loading ? 'در حال بررسی…' : 'ورود امن به پنل'}
              {!loading ? <Lock className="h-3.5 w-3.5" /> : null}
            </GoldButton>
          </form>

          <div className="mt-6 space-y-1.5 border-t border-white/10 pt-5 text-[10px] leading-5 text-zinc-600">
            <p>• توکن نشست فقط در حافظه مرورگر نگهداری می‌شود (نه localStorage).</p>
            <p>• پس از چند تلاش ناموفق، ورود موقتاً قفل می‌شود.</p>
            <p>• تمام عملیات نوشتن با توکن نشست اعتبارسنجی می‌شوند.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionExpiryBadge({ onLogout }: { onLogout: () => void }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => {
      const expiry = Number(
        (window as unknown as { __pc_admin_expiry?: number }).__pc_admin_expiry || 0
      );
      setRemaining(Math.max(0, Math.floor((expiry - Date.now()) / 60000)));
    };
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={onLogout}
      title="خروج از پنل"
      className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-zinc-300 transition hover:border-rose-500/40 hover:text-rose-300"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      نشست فعال • {remaining} دقیقه
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
      {label ? <span className="text-xs">{label}</span> : null}
    </div>
  );
}
