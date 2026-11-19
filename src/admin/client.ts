/**
 * PETROS CINEMA — MASTER ADMIN PANEL
 * Client side of the admin API.
 *
 * Security note: the session token is kept in a module-scoped variable only
 * (in-memory). It is never written to localStorage / sessionStorage, so a
 * page refresh requires a new login and XSS cannot persist the session.
 */

import type {
  AdminConfig,
  TitleRecord,
  SeasonRecord,
  EpisodeRecord,
  WalletRecord,
  SourceRecord,
  FeatureFlags,
  MediaCategory,
  SubtitleFileRecord,
  CollectionItem
} from './types.ts';

let sessionToken = '';
let sessionExpiresAt = 0;

export class AdminApiError extends Error {
  public status: number;
  public code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function setSessionToken(token: string, expiresAt?: string): void {
  sessionToken = token || '';
  sessionExpiresAt = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 3_600_000;
}

export function clearSessionToken(): void {
  sessionToken = '';
  sessionExpiresAt = 0;
}

export function hasSession(): boolean {
  return Boolean(sessionToken) && Date.now() < sessionExpiresAt;
}

export function getSessionExpiry(): number {
  return sessionExpiresAt;
}

interface AdminRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, init: AdminRequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) || {})
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionToken) headers['x-admin-token'] = sessionToken;

  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const data = (payload || {}) as { error?: string; messageFa?: string };
    throw new AdminApiError(
      response.status,
      data.error || 'request_failed',
      data.messageFa || `درخواست با خطا مواجه شد (HTTP ${response.status}).`
    );
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  totals: {
    titles: number;
    published: number;
    drafts: number;
    byCategory: Record<MediaCategory, number>;
    seasons: number;
    episodes: number;
    qualities: number;
    subtitles: number;
    wallets: number;
    sources: number;
  };
  catalogVersion: string;
  catalogUpdatedAt: string;
  manifestVersion: string;
  features: FeatureFlags;
  withStream: number;
  withoutStream: number;
}

export interface GithubStatusResponse {
  configured: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  tokenPresent: boolean;
  lastCommitSha?: string;
  lastCommitUrl?: string;
  lastCommitAt?: string;
  catalogSha?: string;
  configSha?: string;
  error?: string;
  catalogPath?: string;
  configPath?: string;
}

export interface PublishResult {
  ok: boolean;
  manifestVersion: string;
  files: string[];
  counts: {
    titles: number;
    seasons: number;
    episodes: number;
    qualities: number;
    subtitles: number;
  };
  messageFa: string;
  commit?: {
    ok: boolean;
    commitSha?: string;
    htmlUrl?: string;
    message: string;
  };
}

export interface SourceValidationResult {
  ok: boolean;
  kind: string | null;
  status?: number;
  contentType?: string;
  contentLength?: number;
  acceptsRanges?: boolean;
  messageFa: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const adminApi = {
  authStatus: async () => {
    try {
      const res = await request<{ passwordConfigured: boolean; minimumLength: number; sessionTtlMinutes: number }>(
        '/auth/status'
      );
      return res;
    } catch {
      // In static hosting environments like GitHub Pages, client-side fallback is active
      return { passwordConfigured: true, minimumLength: 8, sessionTtlMinutes: 240 };
    }
  },

  login: async (password: string) => {
    try {
      const res = await request<{ token: string; expiresAt: string; messageFa: string }>('/auth/login', {
        method: 'POST',
        body: { password }
      });
      return res;
    } catch (err: unknown) {
      // If server returned 404 or 405 (e.g. GitHub Pages static host), use client-side sha256 authentication
      const isStaticOrDisallowed =
        err instanceof AdminApiError && (err.status === 405 || err.status === 404);

      if (isStaticOrDisallowed) {
        // Precomputed SHA-256 for Ped12345@
        const TARGET_HASH = 'a003a83cdddddcbe55d9d81c68b2c13b798c21386d16f1c94989fb3a88218b7c';
        
        // Calculate SHA-256 using Web Crypto API in browser
        const encoder = new TextEncoder();
        const data = encoder.encode(password.trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === TARGET_HASH) {
          const fakeToken = 'gh_admin_' + Math.random().toString(36).substring(2);
          const expires = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
          setSessionToken(fakeToken, expires);
          return {
            token: fakeToken,
            expiresAt: expires,
            messageFa: 'ورود موفق به پنل مدیریت اختصاصی پتروس سینما'
          };
        } else {
          throw new AdminApiError(401, 'invalid_password', 'رمز عبور وارد شده نادرست است.');
        }
      }
      throw err;
    }
  },

  logout: () => request<{ ok: boolean; messageFa: string }>('/auth/logout', { method: 'POST' }),

  session: () =>
    request<{ valid: boolean; expiresAt: string | null }>('/auth/session'),

  dashboard: () => request<DashboardSummary>('/dashboard'),

  catalog: () =>
    request<{ version: string; updatedAt: string; titles: TitleRecord[] }>('/catalog'),

  createTitle: (title: Partial<TitleRecord>) =>
    request<{ ok: boolean; title: TitleRecord; messageFa: string }>('/catalog/title', {
      method: 'POST',
      body: title
    }),

  updateTitle: (id: string, title: Partial<TitleRecord>) =>
    request<{ ok: boolean; title: TitleRecord; messageFa: string }>(`/catalog/title/${id}`, {
      method: 'PUT',
      body: title
    }),

  deleteTitle: (id: string) =>
    request<{ ok: boolean; messageFa: string }>(`/catalog/title/${id}`, { method: 'DELETE' }),

  addSeason: (id: string, season: Partial<SeasonRecord>) =>
    request<{ ok: boolean; season: SeasonRecord; messageFa: string }>(
      `/catalog/title/${id}/season`,
      { method: 'POST', body: season }
    ),

  addEpisode: (id: string, episode: Partial<EpisodeRecord>) =>
    request<{ ok: boolean; episode: EpisodeRecord; messageFa: string }>(
      `/catalog/title/${id}/episode`,
      { method: 'POST', body: episode }
    ),

  deleteEpisode: (id: string, episodeId: string) =>
    request<{ ok: boolean; messageFa: string }>(`/catalog/title/${id}/episode/${episodeId}`, {
      method: 'DELETE'
    }),

  validateSource: (url: string) =>
    request<SourceValidationResult>('/sources/validate', { method: 'POST', body: { url } }),

  sources: () => request<{ sources: SourceRecord[] }>('/sources'),

  addSource: (source: Partial<SourceRecord>) =>
    request<{ ok: boolean; source: SourceRecord; messageFa: string }>('/sources', {
      method: 'POST',
      body: source
    }),

  deleteSource: (id: string) =>
    request<{ ok: boolean; messageFa: string }>(`/sources/${id}`, { method: 'DELETE' }),

  // Public-Domain editable collection
  getCollection: () =>
    request<{ items: CollectionItem[]; progress?: unknown }>('/collection'),
  saveCollection: (items: CollectionItem[]) =>
    request<{ ok: boolean; count: number; messageFa: string }>('/collection', {
      method: 'PUT',
      body: { items }
    }),
  runCollection: () =>
    request<{ ok: boolean; started: boolean; messageFa: string }>('/collection/run', { method: 'POST' }),
  // page-agent browser copilot (vendored alibaba/page-agent)
  getPanelLlmConfig: () =>
    request<{ mode: 'openai' | 'demo'; model: string; baseURL: string; apiKey: string; messageFa: string }>(
      '/agent/llm-config'
    ),
  startBrowserSession: (url: string, taskFa = '') =>
    request<{ ok: boolean; pageUrl: string; messageFa: string }>('/agent/browser/start', {
      method: 'POST',
      body: { url, taskFa }
    }),
  getCollectionProgress: () =>
    request<{ running?: boolean; total?: number; processed?: number; added?: number; failed?: number; skipped?: number; log?: string[] }>(
      '/collection/progress'
    ),

  /** Persian chat with the Autonomous Local Cinema Admin Agent. */
  agentMessage: (text: string) =>
    request<{ ok: boolean; intent: string; replyFa: string; data?: unknown }>('/agent/message', {
      method: 'POST',
      body: { text }
    }),

  vault: () => request<AdminConfig>('/vault'),

  saveWallet: (wallet: Partial<WalletRecord> & { id?: string }) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(
      `/vault/wallet/${wallet.id || 'new'}`,
      { method: 'PUT', body: wallet }
    ),

  deleteWallet: (id: string) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(`/vault/wallet/${id}`, {
      method: 'DELETE'
    }),

  saveFeatures: (features: FeatureFlags) =>
    request<{ ok: boolean; features: FeatureFlags; messageFa: string }>('/vault/features', {
      method: 'PUT',
      body: features
    }),

  saveToken: (key: string, value: string) =>
    request<{ ok: boolean; config: AdminConfig; messageFa: string }>(`/vault/token/${key}`, {
      method: 'POST',
      body: { value }
    }),

  syncStatus: () => request<GithubStatusResponse>('/sync/status'),

  remoteCatalog: () =>
    request<{ sha: string; version: string; updatedAt: string; count: number }>(
      '/sync/remote-catalog'
    ),

  publish: (message?: string) =>
    request<PublishResult>('/sync/publish', {
      method: 'POST',
      body: { message: message || '' }
    }),

  preview: () =>
    request<{ bytes: number; titles: number; preview: string }>('/sync/preview'),

  uploadSubtitleFile: (filename: string, contentBase64: string) =>
    request<{ ok: boolean; record: SubtitleFileRecord; messageFa: string }>(
      '/catalog/subtitle-file',
      { method: 'POST', body: { filename, contentBase64 } }
    ),

  subtitleFiles: () =>
    request<{ subtitleFiles: SubtitleFileRecord[] }>('/catalog/subtitle-files'),

  deleteSubtitleFile: (filename: string) =>
    request<{ ok: boolean; messageFa: string }>(
      `/catalog/subtitle-file/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    ),

  addFromLink: (payload: {
    url: string;
    title?: string;
    titleFa?: string;
    category?: MediaCategory;
    quality?: string;
    postToTelegram?: boolean;
    username?: string;
    password?: string;
  }) =>
    request<{
      duplicate: boolean;
      created: TitleRecord | null;
      telegram: { ok: boolean; method?: string; messageFa: string } | null;
      messageFa: string;
    }>('/catalog/from-link', { method: 'POST', body: payload }),

  launchBrowser: (url: string) =>
    request<{ ok: boolean; sessionFile: string; messageFa: string }>('/browser/launch', {
      method: 'POST',
      body: { url }
    }),

  checkBrowserSession: (host: string) =>
    request<{ ok: boolean; session?: { url: string; cookie_header: string; count: number }; messageFa?: string }>(
      `/browser/session/${encodeURIComponent(host)}`
    )
};
