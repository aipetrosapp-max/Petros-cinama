/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Shared UI primitives: toasts, modals, fields, tables, badges.
 * Dark cinematic theme with luxury gold (#D4AF37) on matte black.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info, Loader2, Search, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Toast system
// ---------------------------------------------------------------------------

export type ToastKind = 'success' | 'error' | 'info' | 'loading';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, description?: string) => number;
  dismiss: (id: number) => void;
  update: (id: number, patch: Partial<Omit<ToastItem, 'id'>>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev, { id, kind, title, description }]);
      if (kind !== 'loading') {
        window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
      }
      return id;
    },
    [dismiss]
  );

  const update = useCallback((id: number, patch: Partial<Omit<ToastItem, 'id'>>) => {
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const value = useMemo(() => ({ push, dismiss, update }), [push, dismiss, update]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100000] flex w-[min(94vw,26rem)] -translate-x-1/2 flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
            {items.map((item) => (
              <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tones: Record<ToastKind, string> = {
    success: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-100',
    error: 'border-rose-500/40 bg-rose-950/80 text-rose-100',
    info: 'border-[#D4AF37]/40 bg-[#0b0b10]/90 text-[#F5E7B8]',
    loading: 'border-white/15 bg-[#0b0b10]/90 text-zinc-200'
  };
  const icons: Record<ToastKind, React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />,
    error: <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />,
    info: <Info className="h-4 w-4 shrink-0 text-[#F5B942]" />,
    loading: <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#F5B942]" />
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl transition-all ${tones[item.kind]}`}
    >
      <span className="mt-0.5">{icons[item.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold leading-5">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 break-words text-[11px] leading-5 opacity-80">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="بستن"
        className="rounded-lg p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = ''
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-[#08080c]/85 shadow-[0_20px_60px_-30px_rgba(212,175,55,0.45)] backdrop-blur-xl ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-black tracking-tight text-[#F5E7B8] sm:text-base">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-[11px] leading-5 text-zinc-400">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function GoldButton({
  children,
  onClick,
  disabled,
  loading,
  type = 'button',
  variant = 'primary',
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-l from-[#F3D06B] via-[#E5C158] to-[#D4AF37] text-black hover:brightness-110 shadow-[0_10px_30px_-12px_rgba(212,175,55,0.7)]',
    ghost: 'border border-white/15 bg-white/[0.04] text-zinc-200 hover:border-[#D4AF37]/40 hover:text-[#F5E7B8]',
    danger: 'border border-rose-500/40 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  error
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-zinc-400">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[10px] text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[10px] text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/30';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className || ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-[72px] ${props.className || ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${inputClass} appearance-none pl-8 ${props.className || ''}`} />
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'جستجو…'
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pr-9`}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  dir
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'amber';
  dir?: 'rtl' | 'ltr';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/12 bg-white/[0.05] text-zinc-300',
    gold: 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5E7B8]',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    red: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  };
  return (
    <span
      dir={dir}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right transition hover:border-[#D4AF37]/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold text-zinc-200">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[10px] leading-4 text-zinc-500">{description}</span>
        ) : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? 'border-[#D4AF37]/60 bg-[#D4AF37]/25' : 'border-white/15 bg-white/5'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
            checked ? 'right-0.5 bg-[#F5E7B8]' : 'right-6 bg-zinc-500'
          }`}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </span>
    </button>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-6">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#D4AF37]/25 bg-[#08080c] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] sm:rounded-3xl ${
          wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <h3 className="text-sm font-black text-[#F5E7B8]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</span>
        {icon}
      </div>
      <p dir="ltr" className="mt-1.5 text-xl font-black tabular-nums text-[#F5E7B8]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 px-6 py-12 text-center">
      <p className="text-sm font-bold text-zinc-300">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-6 text-zinc-500">{description}</p>
      ) : null}
    </div>
  );
}

export function LockedOverlay({ reason }: { reason: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-[#06060a]/80 backdrop-blur-md">
      <div className="rounded-2xl border border-[#D4AF37]/25 bg-black/70 px-5 py-4 text-center">
        <p className="text-xs font-bold text-[#F5E7B8]">{reason}</p>
        <p className="mt-1 text-[10px] text-zinc-500">برای ویرایش ابتدا وارد شوید.</p>
      </div>
    </div>
  );
}
