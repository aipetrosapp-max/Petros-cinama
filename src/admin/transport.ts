/**
 * PETROS CINEMA — Admin transport (local API ↔ GitHub backend)
 *
 * The Master Admin Panel runs in two modes:
 *  • LOCAL   — the server (localhost:3210) is reachable: full API, agent, telegram.
 *  • GITHUB  — the panel is served from the static site (aipetros.xyz): every
 *              catalog/config operation goes straight to the GitHub Contents API
 *              with the OWNER's token. This is the connection law: local + GitHub only.
 */

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'aipetrosapp-max';
const REPO_NAME = 'Petros-cinama';
const REPO_BRANCH = 'main';

export type AdminMode = 'unknown' | 'local' | 'github';

let mode: AdminMode = 'unknown';
let githubToken = '';

export function getAdminMode(): AdminMode {
  return mode;
}

export function setAdminMode(next: AdminMode): void {
  mode = next;
}

export function getGithubToken(): string {
  return githubToken;
}

export function setGithubToken(token: string): void {
  githubToken = token || '';
}

export function hasGithubToken(): boolean {
  return Boolean(githubToken);
}

/** Probe the local server API (no auth needed for auth/status). */
export async function detectMode(): Promise<AdminMode> {
  try {
    const res = await fetch('/api/admin/auth/status', { signal: AbortSignal.timeout(2500) });
    mode = res.ok ? 'local' : 'github';
  } catch {
    mode = 'github';
  }
  return mode;
}

export class GithubApiError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function githubHeaders(): Record<string, string> {
  if (!githubToken) throw new GithubApiError(401, 'توکن گیت‌هاب وارد نشده است.');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export interface RepoFile {
  content: string;
  sha: string;
}

/** Read a JSON file from the repo (with its blob SHA for updates). */
export async function readRepoJson(path: string): Promise<{ data: unknown; sha: string } | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${REPO_BRANCH}`,
    { headers: githubHeaders(), cache: 'no-store' }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new GithubApiError(res.status, `خواندن ${path} از گیت‌هاب ناموفق بود (${res.status}).`);
  const payload = (await res.json()) as { content?: string; sha: string };
  const text = payload.content ? decodeURIComponent(escape(atob(payload.content.replace(/\n/g, '')))) : '';
  return { data: JSON.parse(text), sha: payload.sha };
}

/** Commit a JSON file back to the repo. */
export async function writeRepoJson(path: string, data: unknown, message: string): Promise<void> {
  const existing = await readRepoJson(path).catch(() => null);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const res = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    {
      method: 'PUT',
      headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message || 'chore(admin): github-mode update',
        branch: REPO_BRANCH,
        content,
        ...(existing?.sha ? { sha: existing.sha } : {})
      })
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GithubApiError(res.status, `نوشتن ${path} روی گیت‌هاب ناموفق بود (${res.status}). ${detail.slice(0, 120)}`);
  }
}

export async function verifyGithubToken(token: string): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  return res.ok;
}
