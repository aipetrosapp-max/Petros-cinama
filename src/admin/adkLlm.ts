/**
 * PETROS CINEMA — In-App Agents on ADK (https://adk.dev — @google/adk)
 *
 * All Petros admin agents are built locally on the Agent Development Kit:
 *   LlmAgent + FunctionTools + InMemoryRunner + InMemorySessionService.
 * No external agent service; everything runs inside this server process.
 *
 * LLM: any OpenAI-compatible endpoint via `OpenAiCompatLlm` (Gemini's
 * OpenAI-compat URL, OpenAI, or a local gateway). When no key is configured
 * the deterministic rule-based router in agent.ts stays authoritative —
 * the ADK brain activates as soon as LOCAL_LLM_BASE_URL (the owner's own
 * local gateway) is configured.
 */

import { BaseLlm } from '@google/adk';
import type { LlmRequest, LlmResponse } from '@google/adk';



export interface OpenAiCompatOptions {
  model: string;
  baseURL: string;
  apiKey: string;
}

/** Minimal OpenAI→ADK bridge so every OpenAI-compatible model can power ADK agents. */
export class OpenAiCompatLlm extends BaseLlm {
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(options: OpenAiCompatOptions) {
    super({ model: options.model });
    this.baseURL = options.baseURL.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
  }

  private toOpenAiMessages(llmRequest: LlmRequest): Array<Record<string, unknown>> {
    const messages: Array<Record<string, unknown>> = [];
    const system = (llmRequest.config as { systemInstruction?: unknown } | undefined)?.systemInstruction ?? (llmRequest as unknown as { systemInstruction?: unknown }).systemInstruction;
    if (system) {
      const text = typeof system === 'string' ? system : JSON.stringify(system);
      messages.push({ role: 'system', content: text });
    }
    for (const content of llmRequest.contents || []) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const parts = content.parts || [];
      const toolCalls = parts.filter((p) => (p as { functionCall?: unknown }).functionCall);
      if (toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          tool_calls: toolCalls.map((p, i) => {
            const fc = (p as { functionCall: { name: string; args?: Record<string, unknown> } }).functionCall;
            return { id: `call_${i}`, type: 'function', function: { name: fc.name, arguments: JSON.stringify(fc.args || {}) } };
          })
        });
        continue;
      }
      const responses = parts.filter((p) => (p as { functionResponse?: unknown }).functionResponse);
      if (responses.length > 0) {
        for (const p of responses) {
          const fr = (p as { functionResponse: { name: string; response: unknown } }).functionResponse;
          messages.push({ role: 'tool', tool_call_id: 'call_0', name: fr.name, content: JSON.stringify(fr.response ?? {}) });
        }
        continue;
      }
      const text = parts
        .map((p) => (typeof (p as { text?: string }).text === 'string' ? (p as { text: string }).text : ''))
        .join('\n');
      if (text) messages.push({ role, content: text });
    }
    return messages;
  }

  private toOpenAiTools(llmRequest: LlmRequest): Array<Record<string, unknown>> | undefined {
    const declarations: Array<Record<string, unknown>> = [];
    for (const tool of (llmRequest.config?.tools as Array<{ functionDeclarations?: unknown[] }> | undefined) || []) {
      for (const d of tool?.functionDeclarations || []) {
        declarations.push(d as Record<string, unknown>);
      }
    }
    if (declarations.length === 0) return undefined;
    return declarations.map((d) => ({
      type: 'function',
      function: {
        name: d.name,
        description: d.description || '',
        parameters: d.parameters || { type: 'object', properties: {} }
      }
    }));
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream = false,
    abortSignal?: AbortSignal
  ): AsyncGenerator<LlmResponse, void, undefined> {
    const body = {
      model: this.model,
      messages: this.toOpenAiMessages(llmRequest),
      tools: this.toOpenAiTools(llmRequest),
      tool_choice: this.toOpenAiTools(llmRequest) ? 'auto' : undefined,
      stream: false
    };
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: abortSignal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const errResponse: LlmResponse = { errorCode: `llm_${res.status}`, errorMessage: detail.slice(0, 300) };
      yield errResponse;
      return;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    };
    const message = data.choices?.[0]?.message || {};
    const parts: Array<Record<string, unknown>> = [];
    if (message.tool_calls?.length) {
      for (const tc of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
    } else if (message.content) {
      parts.push({ text: message.content });
    }
    if (parts.length === 0) {
      const emptyResponse: LlmResponse = { errorCode: 'empty_response', errorMessage: 'LLM returned no content' };
      yield emptyResponse;
      return;
    }
    const response: LlmResponse = {
      content: { role: 'model', parts },
      finishReason: 'STOP' as LlmResponse['finishReason']
    };
    yield response;
  }

  /** Live-connection stub — Petros agents use one-shot turns, not live sessions. */
  async connect(_llmRequest: LlmRequest): Promise<
    import('@google/genai').Content extends never ? never : {
      sendHistory: (history: unknown[]) => Promise<void>;
      sendContent: (content: unknown) => Promise<void>;
      sendRealtime: (blob: unknown) => Promise<void>;
      close: () => Promise<void>;
      receive: () => AsyncGenerator<LlmResponse, void, void>;
    }
  > {
    // Matches BaseLlmConnection; Petros agents only use one-shot text turns.
    const never = (): Promise<never> => new Promise(() => {});
    return {
      sendHistory: async () => never(),
      sendContent: async () => never(),
      sendRealtime: async () => never(),
      close: async () => never(),
      receive: () => (async function* () {})() as AsyncGenerator<LlmResponse, void, void>,
    };
  }
}

export function isAdkLlmConfigured(): boolean {
  return Boolean(buildLocalLlmConfig());
}

export interface LocalLlmConfig {
  model: string;
  baseURL: string;
  apiKey: string;
}

/**
 * The ONLY allowed LLM endpoint is the owner's own local gateway/server
 * (Ollama, vLLM, LM Studio, llama.cpp, or the owner's self-hosted proxy).
 * Petros agents must NEVER connect to Gemini/OpenAI/DashScope or any
 * third-party AI cloud. Configure: LOCAL_LLM_BASE_URL (required),
 * LOCAL_LLM_MODEL, LOCAL_LLM_API_KEY (optional).
 */
export function buildLocalLlmConfig(): LocalLlmConfig | null {
  const baseURL = (process.env.LOCAL_LLM_BASE_URL || '').trim();
  if (!baseURL) return null;
  return {
    model: (process.env.LOCAL_LLM_MODEL || 'local-model').trim(),
    baseURL: baseURL.replace(/\/+$/, ''),
    apiKey: (process.env.LOCAL_LLM_API_KEY || 'NA').trim()
  };
}

export function buildAdkLlm(): OpenAiCompatLlm | null {
  const cfg = buildLocalLlmConfig();
  if (!cfg) return null;
  return new OpenAiCompatLlm(cfg);
}
