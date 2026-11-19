/**
 * PETROS CINEMA — In-App ADK Agent (https://adk.dev / @google/adk)
 *
 * The admin agent's brain is an ADK LlmAgent running locally inside this
 * server (LlmAgent + FunctionTools + InMemoryRunner + InMemorySessionService).
 * The deterministic Persian intent router in agent.ts remains the always-on
 * fallback; this ADK layer takes over automatically when an LLM key exists
 * (GEMINI_API_KEY / OPENAI_API_KEY) and gives the agent real reasoning,
 * multi-tool chains and persistent in-app session memory.
 */

import { LlmAgent, FunctionTool, InMemoryRunner, InMemorySessionService } from '@google/adk';
import { buildAdkLlm, isAdkLlmConfigured } from './adkLlm.ts';

export interface AdkAction {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

const SYSTEM_PROMPT_FA = [
  'تو «ایجنت پتروس سینما» هستی؛ دستیار اختصاصی کارفرما برای مدیریت سایت سینما.',
  'قوانین نانوشتنی:',
  '1) قانون پخش: فقط فایل‌های MP4/HLS مستقیم و تأییدشده روی سایت عمومی می‌روند؛ لینک خام تلگرام (t.me) و کش محلی هرگز.',
  '2) قانون کپی‌رایت: هیچ محتوای دارای کپی‌رایت از سورس‌ها به سایت عمومی منتقل نمی‌شود؛ فقط سورس‌های مجاز کارفرما.',
  '3) جریان جدید: هر عنوانی که از لینک می‌آید فقط روی سرور (پیش‌نویس) و کانال تلگرام ذخیره می‌شود؛ نمایش روی سایت بعد از تصمیم سطح A/B کارفرما.',
  '4) سطح A یعنی نمایش در همه کشورها؛ سطح B یعنی ممنوع در کشورهای فهرست‌شده یا فقط کشورهای فهرست‌شده.',
  '5) همه پاسخ‌ها فارسی، کوتاه، صادقانه و بدون ادعای کار نکرده.',
  'ابزارها را به ترتیب لازم صدا بزن و نتیجه واقعی هر ابزار را گزارش کن.'
].join('\n');

export interface AdkAgentHandle {
  agent: LlmAgent;
  runner: InMemoryRunner;
  sessionService: InMemorySessionService;
  userId: string;
  appName: string;
}

let cached: AdkAgentHandle | null = null;

/** Build (once) the in-app ADK agent with the admin actions as FunctionTools. */
export function getOrCreateAdkAgent(actions: AdkAction[]): AdkAgentHandle | null {
  if (!isAdkLlmConfigured()) return null;
  if (cached) return cached;

  const llm = buildAdkLlm();
  if (!llm) return null;

  const tools = actions.map(
    (a) =>
      new FunctionTool({
        name: a.name,
        description: a.description,
        parameters: { type: 'object', properties: {} } as never,
        // ToolExecuteFunction receives the raw string input when no Zod schema
        // is provided; the agent puts its JSON arguments in that string.
        execute: (input: unknown) => {
          let args: Record<string, unknown> = {};
          if (typeof input === 'string') {
            try {
              args = JSON.parse(input || '{}');
            } catch {
              args = { input };
            }
          } else if (input && typeof input === 'object') {
            args = input as Record<string, unknown>;
          }
          return a.execute(args);
        }
      })
  );

  const agent = new LlmAgent({
    name: 'petros_admin_agent',
    // runtime-verified BaseLlm (symbol check passes); TS structural typing is stricter
    model: llm as unknown as never,
    description: 'ایجنت ادمین پتروس سینما روی ADK',
    instruction: SYSTEM_PROMPT_FA,
    tools
  });

  // NOTE: InMemoryRunner builds its own InMemorySessionService internally;
  // we reuse runner.sessionService so session memory matches what runAsync sees.
  const runner = new InMemoryRunner({
    agent,
    appName: 'petros_admin'
  });
  const sessionService = runner.sessionService as InMemorySessionService;

  cached = { agent, runner, sessionService, userId: 'owner', appName: 'petros_admin' };
  return cached;
}

export interface AdkTurnResult {
  reply: string;
  sessionId: string;
}

/** Run one chat turn through the ADK runner with persistent session memory. */
export async function runAdkTurn(
  handle: AdkAgentHandle,
  sessionId: string,
  message: string
): Promise<AdkTurnResult> {
  const { userId, appName, sessionService, runner } = handle;
  // The runner requires the session to exist up-front; create it deterministically.
  const existing = await sessionService.getSession({ appName, userId, sessionId }).catch(() => null);
  if (!existing) {
    await sessionService.createSession({ appName, userId, sessionId });
  }

  let reply = '';
  const events = runner.runAsync({
    userId,
    sessionId,
    newMessage: { role: 'user', parts: [{ text: message }] }
  });
  for await (const event of events) {
    const text = event?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .filter(Boolean)
      .join('\n');
    if (text) reply = text;
  }
  return { reply, sessionId };
}

export function adkStatus(): { enabled: boolean; messageFa: string } {
  if (isAdkLlmConfigured()) {
    return { enabled: true, messageFa: '🧠 مغز ADK فعال است (مدل LLM متصل).' };
  }
  return {
    enabled: false,
    messageFa: '🧠 مغز ADK در انتظار کلید LLM است (GEMINI_API_KEY در تب ولت و توکن‌ها) — فعلاً مسیر قاعده‌محور داخلی پاسخ می‌دهد.'
  };
}
