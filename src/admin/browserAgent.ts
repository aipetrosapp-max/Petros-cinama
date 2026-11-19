/**
 * PETROS CINEMA — Secure browser-agent sessions (page-agent integration)
 *
 * Vendor: https://github.com/alibaba/page-agent (MIT) v1.12.4
 * Served locally from /vendor/page-agent.demo.js — never from a CDN.
 *
 * Flow:
 *  1. Admin agent / panel requests a browser session for a URL
 *     → POST /api/admin/agent/browser/start  (requires admin token)
 *     → returns /agent-browser.html?url=…&session=…&task=…
 *  2. The page validates the session → GET /api/admin/agent/browser/llm-config
 *     → one-time LLM credentials (OpenAI-compatible) live only in that page's memory
 *  3. Page loads the target in an iframe + instantiates PageAgent with the task
 *
 * Security: sessions are one-time (or 15-minute TTL), memory-only, never logged.
 */

import { createHash, randomBytes } from 'crypto';
import path from 'path';
import fsp from 'fs/promises';

interface BrowserAgentSession {
  id: string;
  url: string;
  taskFa: string;
  createdAt: number;
  usedLlmConfig: boolean;
}

const SESSION_TTL_MS = 15 * 60 * 1000;
const sessions = new Map<string, BrowserAgentSession>();

export function sanitizeAgentTargetUrl(raw: string): string | null {
  try {
    const u = new URL(String(raw || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    // block obvious local-network SSRF targets
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\])/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function startBrowserSession(url: string, taskFa = ''): { sessionId: string; pageUrl: string } {
  const id = randomBytes(16).toString('hex');
  sessions.set(id, {
    id,
    url,
    taskFa,
    createdAt: Date.now(),
    usedLlmConfig: false
  });
  // opportunistic cleanup
  for (const [key, s] of sessions) {
    if (Date.now() - s.createdAt > SESSION_TTL_MS) sessions.delete(key);
  }
  const params = new URLSearchParams({ url, session: id });
  if (taskFa) params.set('task', taskFa);
  return { sessionId: id, pageUrl: `/agent-browser.html?${params.toString()}` };
}

export function getBrowserSession(id: string): BrowserAgentSession | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return s;
}

/** Validate and burn a one-time session (single exchange of LLM config). */
export function consumeBrowserSession(id: string): BrowserAgentSession | null {
  const s = getBrowserSession(id);
  if (!s) return null;
  sessions.delete(id);
  return s;
}

export interface LlmConfig {
  mode: 'openai' | 'demo';
  model: string;
  baseURL: string;
  apiKey: string;
  messageFa: string;
}

/** Resolve the OpenAI-compatible LLM credentials for the browser agent. */
export function resolveBrowserLlmConfig(): LlmConfig {
  const gemini = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const openai = (process.env.OPENAI_API_KEY || '').trim();
  if (gemini) {
    return {
      mode: 'openai',
      model: (process.env.BROWSER_AGENT_MODEL || 'gemini-2.0-flash').trim(),
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: gemini,
      messageFa: 'مدل Gemini متصل شد. ایجنت مرورگر آماده است.'
    };
  }
  if (openai) {
    return {
      mode: 'openai',
      model: (process.env.BROWSER_AGENT_MODEL || 'gpt-4o-mini').trim(),
      baseURL: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim(),
      apiKey: openai,
      messageFa: 'مدل OpenAI متصل شد. ایجنت مرورگر آماده است.'
    };
  }
  return {
    mode: 'demo',
    model: '',
    baseURL: '',
    apiKey: '',
    messageFa:
      'کلید LLM تنظیم نشده — ایجنت با مدل آزمایشی رایگان page-agent اجرا می‌شود (فقط برای تست). برای حالت کامل، GEMINI_API_KEY را در تب ولت و توکن‌ها ثبت کن.'
  };
}

export function sessionFingerprint(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
}

export async function verifyVendorBundle(): Promise<{ ok: boolean; sizeBytes: number; source: string }> {
  const p = path.join(process.cwd(), 'public', 'vendor', 'page-agent.demo.js');
  try {
    const stat = await fsp.stat(p);
    return { ok: stat.size > 10000, sizeBytes: stat.size, source: 'local vendor bundle' };
  } catch {
    return { ok: false, sizeBytes: 0, source: 'missing — run: cp node_modules/page-agent/dist/iife/page-agent.demo.js public/vendor/' };
  }
}
