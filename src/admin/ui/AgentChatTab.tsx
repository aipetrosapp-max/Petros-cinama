/**
 * PETROS CINEMA — Master Admin Panel · Agent Chat Tab
 * Minimal luxury Persian chat with the Autonomous Local Cinema Admin Agent.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bot, SendHorizonal, Sparkles, User } from 'lucide-react';
import { adminApi } from '../client.ts';
import { Panel, GoldButton, useToast } from './primitives.tsx';

interface ChatMessage {
  id: string;
  from: 'me' | 'agent';
  text: string;
  time: string;
}

const QUICK_COMMANDS = [
  'وضعیت کاتالوگ',
  'گزارش فیلم‌ها',
  'میزان درآمد',
  'مقایسه با کانال تلگرام',
  'وضعیت انتقال فایل',
  'فایل‌ها را با تلگرام‌کلاینت به کانال بفرست',
  'منتشر کن',
  'راهنما'
];

function nowTime(): string {
  return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export function AgentChatTab() {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      from: 'agent',
      text:
        'سلام کارفرما! 👑\nمن ایجنت مدیریت اختصاصی پتروس هستم — کاملاً محلی و زیر نظر خودت.\nدستور بده: «وضعیت کاتالوگ»، «گزارش فیلم‌ها»، «میزان درآمد»، یا لینک MP4 فیلم با جمله «این فیلم را اضافه کن».',
      time: nowTime()
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, from: 'me', text, time: nowTime() }]);
    setInput('');
    setSending(true);
    try {
      const res = await adminApi.agentMessage(text);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, from: 'agent', text: res.replyFa || 'پاسخی دریافت نشد.', time: nowTime() }
      ]);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'خطا';
      toast.push('error', 'ارتباط با ایجنت', msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          from: 'agent',
          text: `⛔ ارتباط با ایجنت برقرار نشد: ${msg}\nمطمئن شو بک‌اند (server.ts) روی همان سروری است که پنل را باز کرده‌ای.`,
          time: nowTime()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="🤖 ایجنت مدیریت اختصاصی پتروس"
        subtitle="چت فارسی مستقیم با ایجنت محلی — هیچ داده‌ای بدون دستور تو به بیرون ارسال نمی‌شود"
      >
        <div className="flex h-[62vh] flex-col overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#0B0C10]">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.from === 'me' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                    m.from === 'me'
                      ? 'border-white/15 bg-white/5 text-zinc-300'
                      : 'border-[rgba(212,175,55,0.45)] bg-[#1a1710] text-[#D4AF37]'
                  }`}
                >
                  {m.from === 'me' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  dir="rtl"
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-6 ${
                    m.from === 'me'
                      ? 'rounded-tr-sm bg-white/10 text-zinc-100'
                      : 'rounded-tl-sm border border-[rgba(212,175,55,0.2)] bg-gradient-to-br from-[#171307] to-[#0B0C10] text-[#F5E7B8]'
                  }`}
                >
                  {m.text}
                  <span className="mt-1 block text-[9px] text-zinc-500">{m.time}</span>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-[#D4AF37]/80">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-[11px]">ایجنت در حال اجرای دستور…</span>
              </div>
            )}
          </div>

          {/* Quick commands */}
          <div className="flex flex-wrap gap-2 border-t border-white/5 px-3 py-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void send(cmd)}
                disabled={sending}
                className="cursor-pointer rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.06)] px-3 py-1 text-[11px] text-[#F5E7B8] transition hover:bg-[rgba(212,175,55,0.16)] disabled:opacity-40"
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-[rgba(212,175,55,0.2)] bg-[#08090D] p-3">
            <textarea
              dir="rtl"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="پیام خود را به ایجنت بنویس… (مثال: لینک MP4 + «این فیلم را منتشر کن»)"
              className="max-h-28 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(212,175,55,0.5)]"
            />
            <GoldButton onClick={() => void send()} loading={sending}>
              <SendHorizonal className="h-3.5 w-3.5" />
            </GoldButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
