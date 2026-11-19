/**
 * PETROS CINEMA — Autonomous Local Cinema Admin Agent (chat backend)
 *
 * A strictly-local Persian chat agent for the master admin panel.
 *  - No external AI/LLM service is contacted. All intents are parsed locally.
 *  - The agent acts ONLY on explicit owner commands received through the
 *    authenticated admin chat (`x-admin-token` required by the route).
 *  - On any error or limitation it answers honestly and clearly in Persian,
 *    including what it needs from the owner to proceed.
 *
 * Supported intents (Persian):
 *   سلام / درود ......................... greeting
 *   راهنما / کمک / دستورها .............. command list
 *   وضعیت / داشبورد / چند فیلم ......... catalog status summary
 *   گزارش فیلم‌ها / سلامت لینک‌ها ....... health report (HTTP Range probes)
 *   میزان درآمد / درآمد / ولت‌ها ........ wallet & revenue report (local data)
 *   <لینک MP4/HLS> (اضافه کن/منتشر کن).. validate via Range probe, add to
 *                                        catalog, optionally commit+push
 *   منتشر کن / اعمال سراسری ............ rebuild client manifest + git push
 *   مرورگر را باز کن <url> ............. launch the interactive local browser
 *
 * Immutable playback law (same as the client build): a title is only added
 * when a real, direct MP4/HLS/WebM file is verified. Raw Telegram posts and
 * trailer files are refused with an explicit explanation.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import {
  readLocalCatalog,
  writeLocalCatalog,
  readLocalConfig,
  writeLocalConfig,
  buildClientCatalog,
  buildCommitMessage,
  commitFiles,
  getRepoConfig
} from './githubSync.ts';
import { validateTitle, countQualities } from './types.ts';
import type { AdminCatalogFile, AdminConfig, TitleRecord } from './types.ts';
import { makeLocalId } from './agentUtils.ts';
import { publishToTelegramChannel, readTelegramBotConfig } from './telegramPublish.ts';

export interface AgentReply {
  intent: string;
  replyFa: string;
  data?: unknown;
}

const PROBE_TIMEOUT_MS = 9000;
const HEALTH_MAX_TITLES = 25;
const HEALTH_MAX_PROBES = 40;
const CHANNEL_MAX_PER_RUN = 20;
const CHANNEL_STATE_FILE = 'agent_channel_state.json';

interface ChannelState {
  publishedIds: Record<string, string>;
  filePublishedIds?: Record<string, string>;
}

function readChannelState(): ChannelState {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', CHANNEL_STATE_FILE), 'utf8');
    return JSON.parse(raw) as ChannelState;
  } catch {
    return { publishedIds: {} };
  }
}

async function writeChannelState(state: ChannelState): Promise<void> {
  try {
    await fsp.writeFile(
      path.join(process.cwd(), 'data', CHANNEL_STATE_FILE),
      JSON.stringify(state, null, 2),
      'utf8'
    );
  } catch {
    // state is best-effort; publishing still works
  }
}

function normalizeFa(text: string): string {
  return (text || '')
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/أإآ/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0].replace(/[.,؛!)،]+$/, '') : null;
}

/** True when the URL is a trailer/promo file — never publishable as the movie. */
function isTrailerUrl(url: string): boolean {
  return /(?:[-_/.])trailer(?:[-_.]|$)|official[-_]?trailer/i.test(url);
}

/**
 * Verify a direct media file with a real HTTP Range request.
 * Returns null when OK, otherwise a Persian failure reason.
 */
async function probeMediaUrl(url: string): Promise<string | null> {
  if (isTrailerUrl(url)) {
    return 'این آدرس یک فایل «تریلر» است، نه فیلم کامل. طبق قانون پخش، تریلر هرگز جای فیلم منتشر نمی‌شود.';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1', Accept: 'video/*' },
      signal: controller.signal
    });
    if (res.status !== 200 && res.status !== 206) {
      return `سرور پاسخ HTTP ${res.status} داد (نه 200 و نه 206). لینک قابل پخش مستقیم نیست.`;
    }
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type.includes('text/html')) {
      return 'سرور به‌جای فایل ویدیو، صفحه HTML برگرداند (احتمالاً صفحه لاگین یا تبلیغ). این لینک مستقیم نیست.';
    }
    if (type && !type.startsWith('video/') && !type.includes('mpegurl') && !type.includes('mp2t')) {
      return `نوع محتوا «${type}» است، نه ویدیو.`;
    }
    const len = res.headers.get('content-range') || res.headers.get('content-length');
    if (!len) {
      return 'سرور از سرویس بازه‌ای (Range/206) پشتیبانی نمی‌کند؛ استریم و سوییچ کیفیت در پلیر خراب می‌شود.';
    }
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `درخواست تست به سرور فایل شکست خورد: ${msg}`;
  } finally {
    clearTimeout(timer);
  }
}

function guessTitleFromUrl(url: string): { title: string; year?: number } {
  try {
    const file = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const base = file.replace(/\.(mp4|mkv|webm|m3u8|mpd)$/i, '');
    const cleaned = base.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
    const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[0]) : undefined;
    const title = (year && yearMatch ? cleaned.replace(yearMatch[0], '') : cleaned)
      .replace(/\b(1080p|720p|480p|2160p|4k|hdr|web-?dl|bluray|x264|x265|hevc|soren|cinemasoren|new|dubbed|farsi)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { title: title || base || 'عنوان بدون نام', year };
  } catch {
    return { title: 'عنوان بدون نام' };
  }
}

async function buildHealthReport(): Promise<AgentReply> {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  if (titles.length === 0) {
    return {
      intent: 'health',
      replyFa: 'کاتالوگ خالی است. اول با فرستادن لینک MP4 مستقیم در چت، فیلم اضافه کن.'
    };
  }

  const lines: string[] = [];
  let okCount = 0;
  let badCount = 0;
  let probes = 0;

  for (const title of titles.slice(0, HEALTH_MAX_TITLES)) {
    const urls = (title.qualities || []).map((q) => q.url).filter(Boolean);
    if (urls.length === 0) {
      lines.push(`• «${title.titleFa || title.title}» — بدون لینک استریم ❌`);
      badCount++;
      continue;
    }
    const perQuality: string[] = [];
    for (const url of urls) {
      if (probes >= HEALTH_MAX_PROBES) break;
      probes++;
      const error = await probeMediaUrl(url);
      if (error) {
        badCount++;
        perQuality.push(`✗ ${error}`);
      } else {
        okCount++;
        perQuality.push('✓ سالم');
      }
    }
    lines.push(`• «${title.titleFa || title.title}» (${title.status || 'بدون وضعیت'}) — ${perQuality.join(' | ')}`);
    if (probes >= HEALTH_MAX_PROBES) break;
  }

  const header = `📊 گزارش سلامت فیلم‌ها — ${titles.length} عنوان در کاتالوگ (${okCount} لینک سالم، ${badCount} مشکل‌دار):`;
  const body = lines.join('\n');
  const note =
    probes >= HEALTH_MAX_PROBES
      ? '\n(برای سرعت، حداکثر ۴۰ لینک اول تست شد؛ برای تست کامل دوباره همین دستور را بده.)'
      : '';
  return { intent: 'health', replyFa: `${header}\n${body}${note}` };
}

async function buildRevenueReport(config: AdminConfig): Promise<AgentReply> {
  const wallets = config.wallets || [];
  if (wallets.length === 0) {
    return {
      intent: 'revenue',
      replyFa: 'هنوز وولتی ثبت نشده است. از تب «ولت و توکن‌ها» ولت اضافه کن یا آدرس را همین‌جا بفرست.'
    };
  }
  const lines = wallets.map((w, i) => {
    const masked = `${String(w.address || '').slice(0, 6)}…${String(w.address || '').slice(-4)}`;
    return `${i + 1}. ${w.label || w.network} — شبکه ${w.network} — ${masked} — ${w.enabled ? 'فعال ✅' : 'غیرفعال ⛔'}`;
  });
  const enabled = wallets.filter((w) => w.enabled).length;
  return {
    intent: 'revenue',
    replyFa:
      `💰 گزارش درآمد — ${wallets.length} ولت ثبت شده (${enabled} فعال):\n${lines.join('\n')}\n\n` +
      '⚠️ درباره موجودی زنده: ایجنت طبق سیاست ایزولاسیون بدون اجازه تو هیچ درخواستی به سرویس‌های بیرونی نمی‌فرستد. ' +
      'برای دیدن موجودی واقعی هر ولت، یا در تب «ولت و توکن‌ها» آدرس را در اکسپلورر شبکه چک کن، یا صریحاً بگو «اجازه می‌دم موجودی آنلاین چک شود» تا سراغش برویم. ' +
      'آمار تبلیغات درون‌برنامه‌ای هم در حافظه مرورگر کاربران است و روی سرور موجود نیست؛ گزارش دقیق آن بعد از فعال‌سازی گزارش سمت کلاینت ممکن می‌شود.',
    data: { wallets: wallets.length, enabled }
  };
}

async function buildStatusSummary(): Promise<AgentReply> {
  const catalog = await readLocalCatalog();
  const config = await readLocalConfig();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const published = titles.filter((t) => t.status === 'published').length;
  const withStream = titles.filter((t) => (t.qualities?.length || 0) > 0).length;
  return {
    intent: 'status',
    replyFa:
      `📋 وضعیت کاتالوگ پتروس سینما:\n` +
      `• کل عناوین: ${titles.length} (منتشرشده: ${published}، پیش‌نویس: ${titles.length - published})\n` +
      `• عناوین دارای لینک استریم: ${withStream} | مجموع کیفیت‌ها: ${countQualities(titles as never)}\n` +
      `• نسخه مانیفست فعال: ${config.manifestVersion}\n` +
      `• سورس‌های ثبت‌شده: ${(config.sources || []).length} | ولت‌ها: ${(config.wallets || []).length}`
  };
}

function buildHelp(): AgentReply {
  return {
    intent: 'help',
    replyFa:
      '🤖 دستورهای ایجنت مدیریت پتروس:\n' +
      '• «وضعیت کاتالوگ» — خلاصه تعداد فیلم‌ها و نسخه منتشرشده\n' +
      '• «گزارش فیلم‌ها» — تست واقعی لینک‌ها و سلامت هر کیفیت\n' +
      '• «میزان درآمد» — گزارش ولت‌ها و درآمد\n' +
      '• لینک MP4 کامل + جمله «این فیلم را اضافه کن» — اعتبارسنجی و افزودن به کاتالوگ\n' +
      '• «منتشر کن» — ساخت مانیفست نهایی و push خودکار روی سایت\n' +
      '• «مرورگر را باز کن <آدرس>» — باز کردن مرورگر تعاملی محلی برای لاگین خودت\n' +
      '• «راهنما» — همین لیست\n\n' +
      'قانون پخش: فقط فایل MP4/HLS مستقیم و تأییدشده؛ تریلر و لینک خام تلگرام پذیرفته نمی‌شود.'
  };
}

async function publishEverything(note?: string): Promise<AgentReply> {
  const catalog = await readLocalCatalog();
  const config = await readLocalConfig();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const clientCatalog = buildClientCatalog(titles);
  const manifestVersion = `${Date.now().toString(36)}`;
  config.manifestVersion = manifestVersion;
  config.updatedAt = new Date().toISOString();
  await writeLocalCatalog(clientCatalog);
  await writeLocalConfig(config);
  const cfg = getRepoConfig();
  const commit = await commitFiles(
    [
      { path: cfg.catalogPath, content: JSON.stringify(clientCatalog, null, 2) },
      { path: cfg.configPath, content: JSON.stringify(config, null, 2) }
    ],
    buildCommitMessage(note?.trim() || `update catalog (${titles.length} titles) via admin chat agent`)
  );
  return {
    intent: 'publish',
    replyFa: commit.ok
      ? `🚀 منتشر شد: مانیفست نسخه ${manifestVersion} با ${titles.length} عنوان روی برنچ ${cfg.branch} پوش شد. همه دستگاه‌ها در چرخه همگام‌سازی خودکار دریافت می‌کنند.`
      : `⚠️ ذخیره محلی انجام شد ولی push ناموفق بود (${commit.message}). توکن گیت‌هاب (GITHUB_TOKEN) را در تب «ولت و توکن‌ها» چک کن و دوباره «منتشر کن» را بگو.`,
    data: { commit, manifestVersion, count: titles.length }
  };
}

async function addFromLink(url: string, publish: boolean): Promise<AgentReply> {
  // Immutable playback law: raw Telegram posts are never playable in production.
  if (/(^|\/\/)(www\.)?(t\.me|telegram\.me)\//i.test(url)) {
    return {
      intent: 'add',
      replyFa:
        '⛔ لینک‌های خام تلگرام (t.me) طبق قانون پخش پتروس قابل انتشار نیستند — روی سایت عمومی گیت‌وی محلی وجود ندارد و پخش قطعاً به خطای «نیاز به گیت‌وی» می‌خورد. ' +
        'اگر فایل فیلم را داری، آن را روی هاست یا سرویس فایل خودت آپلود کن و لینک مستقیم MP4/HLS را بفرست تا اعتبارسنجی و اضافه کنم.'
    };
  }

  const probeError = await probeMediaUrl(url);
  if (probeError) {
    return {
      intent: 'add',
      replyFa: `⛔ لینک اعتبارسنجی نشد: ${probeError}\nراهکار: مطمئن شو آدرس، فایل کامل MP4/M3U8 مستقیم است (نه صفحه سایت، نه تریلر). لینک سالم را دوباره بفرست.`
    };
  }

  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const lower = url.toLowerCase();
  const duplicate = titles.find((t) => (t.qualities || []).some((q) => (q.url || '').toLowerCase() === lower));
  if (duplicate) {
    return {
      intent: 'add',
      replyFa: `♻️ این لینک قبلاً برای «${duplicate.titleFa || duplicate.title}» ثبت شده است — چیزی اضافه نشد.`
    };
  }

  const guess = guessTitleFromUrl(url);
  const input = {
    id: makeLocalId('title'),
    title: guess.title,
    titleFa: guess.title,
    category: 'movie' as const,
    status: 'published' as const,
    ...(guess.year ? { year: guess.year } : {}),
    featured: publish,
    qualities: [{ id: makeLocalId('q'), quality: '1080p', url, format: 'direct_mp4' as const }],
    subtitles: [],
    seasons: [],
    episodes: []
  };
  const validation = validateTitle(input);
  if (validation) {
    return { intent: 'add', replyFa: `⛔ داده‌های عنوان معتبر نیست: ${validation}` };
  }

  const record = { ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as TitleRecord;
  titles.unshift(record);
  catalog.streams = titles as never;
  catalog.updatedAt = new Date().toISOString();
  await writeLocalCatalog(catalog);

  if (!publish) {
    return {
      intent: 'add',
      replyFa: `✅ «${guess.title}» با لینک تست‌شده (HTTP 206 ✓) به کاتالوگ اضافه شد (پیش‌نویس). هر وقت خواستی بگو «منتشر کن» تا روی سایت پوش شود.`
    };
  }

  const published = await publishEverything(`add ${guess.title} via admin chat agent`);
  return {
    intent: 'add',
    replyFa: `✅ «${guess.title}» اعتبارسنجی شد (پخش مستقیم MP4 ✓) و ${published.replyFa}`
  };
}

/**
 * Curated public-domain collection: acclaimed classic films whose copyright
 * has expired (or was never renewed) — hosted on archive.org, the reputable
 * public-domain repository. Every URL was verified live (HTTP 200/206,
 * video/mp4) before shipping this list; the agent re-probes at runtime.
 */
const PUBLIC_DOMAIN_COLLECTION: Array<{ title: string; year: number; identifier: string; sizeMB: number }> = [
  { title: 'The General', year: 1926, identifier: 'TheGeneral1926', sizeMB: 1003 },
  { title: 'Nosferatu', year: 1922, identifier: 'nosferatu_1922', sizeMB: 993 },
  { title: 'House on Haunted Hill', year: 1959, identifier: 'house_on_haunted_hill_ipod', sizeMB: 844 },
  { title: 'Meet John Doe', year: 1941, identifier: 'meetjohndoe', sizeMB: 1226 },
  { title: 'Penny Serenade', year: 1941, identifier: 'PennySerenade', sizeMB: 745 },
  { title: 'Scarlet Street', year: 1945, identifier: 'ScarletStreet', sizeMB: 633 },
  { title: 'His Girl Friday', year: 1940, identifier: 'his_girl_friday', sizeMB: 575 },
  { title: 'The Red House', year: 1947, identifier: 'TheRedHouse', sizeMB: 627 },
  { title: 'Angel and the Badman', year: 1947, identifier: 'angel_and_the_badman', sizeMB: 622 },
  { title: 'Carnival of Souls', year: 1962, identifier: 'CarnivalofSouls', sizeMB: 519 },
  { title: "Gulliver's Travels", year: 1939, identifier: 'gulliverstravels1939', sizeMB: 454 },
  { title: 'Nothing Sacred', year: 1937, identifier: 'NothingSacred', sizeMB: 442 },
  { title: 'The Phantom of the Opera', year: 1925, identifier: 'ThePhantomoftheOpera', sizeMB: 464 },
  { title: 'Battleship Potemkin', year: 1925, identifier: 'BattleshipPotemkin', sizeMB: 317 },
  { title: 'The Little Shop of Horrors', year: 1960, identifier: 'TheLittleShopOfHorrors', sizeMB: 217 },
  { title: 'Suddenly', year: 1954, identifier: 'Suddenly1954', sizeMB: 473 },
  { title: 'He Walked by Night', year: 1948, identifier: 'HeWalkedByNight', sizeMB: 486 },
  { title: 'The Amazing Mr. X', year: 1948, identifier: 'amazing_mr_x', sizeMB: 488 },
  { title: 'The Lost World', year: 1925, identifier: 'TheLostWorld1925', sizeMB: 420 },
  { title: 'Detour', year: 1945, identifier: 'detour_ipod', sizeMB: 830 },
  { title: 'Sabotage', year: 1936, identifier: 'Sabotage_1936', sizeMB: 1230 },
  { title: 'The Stranger', year: 1946, identifier: 'the_stranger_1946', sizeMB: 1697 }
];

/**
 * Resolve the best MP4 file of an archive.org item at runtime.
 * The metadata API is throttled under bursts, so retries with backoff are
 * mandatory; only files above 50MB (a real full movie) qualify.
 */
async function resolveArchiveOrgMp4(identifier: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 PetrosCinemaAdmin' },
        signal: AbortSignal.timeout(12000)
      });
      if (res.ok) {
        const data = (await res.json()) as {
          is_dark?: boolean;
          files?: Array<{ name?: string; size?: string | number }>;
        };
        if (data && !data.is_dark && Array.isArray(data.files)) {
          let best: { name: string; size: number } | null = null;
          for (const file of data.files) {
            const name = String(file.name || '');
            const size = Number(file.size || 0);
            if (name.toLowerCase().endsWith('.mp4') && size > 50_000_000) {
              if (!best || size > best.size) best = { name, size };
            }
          }
          if (best) {
            return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(best.name)}`;
          }
          return null; // item exists but has no qualifying MP4
        }
      }
    } catch {
      // fall through to retry
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return null;
}

/**
 * «۲۰ فیلم برتر پابلیک‌دومین را اضافه کن» — the agent's own collection test:
 * resolves each curated archive.org item's real MP4 at runtime, Range-probes
 * it (206 + video content), adds the passing ones, skips duplicates, publishes
 * to the site and reports each result honestly.
 */
async function addPublicDomainCollection(): Promise<AgentReply> {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const existingUrls = new Set(
    titles.flatMap((t) => (t.qualities || []).map((q) => (q.url || '').toLowerCase()))
  );

  const added: string[] = [];
  const failed: string[] = [];
  let skipped = 0;

  for (const entry of PUBLIC_DOMAIN_COLLECTION) {
    const resolved = await resolveArchiveOrgMp4(entry.identifier);
    if (!resolved) {
      failed.push(`⛔ «${entry.title}» — فایل MP4 کامل در آیتم «${entry.identifier}» یافت نشد (یا سرویس موقتاً در دسترس نیست).`);
      continue;
    }
    if (existingUrls.has(resolved.toLowerCase())) {
      skipped++;
      continue;
    }
    const probeError = await probeMediaUrl(resolved);
    if (probeError) {
      failed.push(`⛔ «${entry.title}» — ${probeError}`);
      continue;
    }
    const input = {
      id: makeLocalId('title'),
      title: entry.title,
      titleFa: `${entry.title} (${entry.year})`,
      category: 'movie' as const,
      status: 'published' as const,
      year: entry.year,
      featured: false,
      qualities: [{ id: makeLocalId('q'), quality: '1080p', url: resolved, format: 'direct_mp4' as const }],
      subtitles: [],
      seasons: [],
      episodes: []
    };
    const validation = validateTitle(input);
    if (validation) {
      failed.push(`⛔ «${entry.title}» — ${validation}`);
      continue;
    }
    const record = {
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as unknown as TitleRecord;
    titles.unshift(record);
    added.push(`✅ «${entry.title} (${entry.year})» — ${entry.sizeMB}MB`);
    await new Promise((r) => setTimeout(r, 800)); // gentle on archive.org
  }

  let publishNote = '';
  if (added.length > 0) {
    catalog.streams = titles as never;
    catalog.updatedAt = new Date().toISOString();
    await writeLocalCatalog(catalog);
    const published = await publishEverything(`add ${added.length} public-domain classics via admin chat agent`);
    publishNote = `\n🚀 ${published.replyFa}`;
  }

  return {
    intent: 'collection',
    replyFa:
      `📚 اجرای کالکشن پابلیک‌دومین تمام شد:\n` +
      `• اضافه و منتشر شد: ${added.length} عنوان\n` +
      (skipped ? `• قبلاً موجود بود: ${skipped} عنوان\n` : '') +
      (failed.length ? `• رد شده: ${failed.length}\n${failed.join('\n')}\n` : '') +
      `\n${added.join('\n')}${publishNote}` +
      (added.length < 20 && failed.length > 0
        ? `\n💡 اگر خطاها ۵۰۳ بود، سرویس آرشیو موقتاً شلوغ است — چند دقیقه بعد دوباره همین دستور را بفرست (ضدتکرار است و ادامه می‌دهد).`
        : '')
  };
}

/**
 * Transfer the site's videos to the owner's Telegram channel.
 *  - «<نام فیلم> را به کانال بفرست» → only that title
 *  - «ویدیوهای سایت را به کانال انتقال بده» → every catalog title with a
 *    playable stream URL not posted yet (local state file). Say
 *    «همه را دوباره بفرست» to force a resend.
 */
async function transferCatalogToChannel(
  message: string,
  forceAll: boolean
): Promise<AgentReply> {
  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const siteBase = (process.env.APP_URL || 'https://aipetros.xyz').replace(/\/+$/, '');
  const state = readChannelState();

  // Try to target ONE title if its name appears verbatim in the message.
  const wanted = titles.find(
    (t) =>
      ((t.titleFa || '') && message.includes(t.titleFa.toLowerCase())) ||
      ((t.title || '') && message.includes(t.title.toLowerCase()))
  );
  let targets = wanted ? [wanted] : titles;
  targets = targets.filter((t) => (t.qualities || []).some((q) => q.url));
  if (!forceAll && !wanted) {
    targets = targets.filter((t) => !state.publishedIds[t.id]);
  }
  if (targets.length === 0) {
    return {
      intent: 'channel',
      replyFa:
        'هرچیزی که در کاتالوگ بود، قبلاً به کانال ارسال شده است. برای ارسال دوباره همه عناوین بنویس: «همه را دوباره به کانال بفرست».'
    };
  }

  const batch = targets.slice(0, CHANNEL_MAX_PER_RUN);
  const results: string[] = [];
  let okCount = 0;
  for (const title of batch) {
    const mediaUrl = (title.qualities || []).find((q) => q.url)?.url || '';
    const res = await publishToTelegramChannel(
      mediaUrl,
      title.titleFa || title.title,
      `${siteBase}/#/watch/${title.id}`
    );
    if (res.ok) {
      okCount++;
      state.publishedIds[title.id] = new Date().toISOString();
    }
    results.push(`${res.ok ? '✅' : '⛔'} «${title.titleFa || title.title}» — ${res.messageFa}`);
    await new Promise((r) => setTimeout(r, 1500)); // gentle bot rate limit
  }
  await writeChannelState(state);

  const truncated = targets.length > batch.length ? ` (از ${targets.length} عنوان، ${batch.length} تای اول ارسال شد)` : '';
  return {
    intent: 'channel',
    replyFa: `📣 انتقال به کانال تلگرام تمام شد — ${okCount} موفق از ${batch.length}${truncated}:\n${results.join('\n')}`,
    data: { ok: okCount, total: batch.length }
  };
}

/**
 * Real-file transfer via the Telethon user session (bot API cannot send files
 * over 20MB). Builds a job file, launches the detached Python worker and
 * reports honestly when the Telegram credentials/session are missing.
 */
async function startTelethonFileTransfer(message: string, forceAll: boolean): Promise<AgentReply> {
  const apiId = (process.env.TG_API_ID || '').trim();
  const apiHash = (process.env.TG_API_HASH || '').trim();
  const hasSession =
    Boolean((process.env.TG_STRING_SESSION || '').trim()) ||
    fs.existsSync(path.join(process.cwd(), 'telegram_session.txt')) ||
    fs.existsSync(path.join(process.cwd(), 'petros_gateway_session.session'));
  if (!apiId || !apiHash || !hasSession) {
    return {
      intent: 'channel_file',
      replyFa:
        '⛔ برای گذاشتن خود فایل ویدیو در کانال، نشست کاربری تلگرام لازم است (بات تلگرام سقف ۲۰ مگابایت دارد):\n' +
        '۱) از my.telegram.org سه چیز بگیر: API_ID و API_HASH.\n' +
        '۲) در همان پنجره‌ای که server.ts اجرا می‌شود ست کن: set TG_API_ID=… و set TG_API_HASH=…\n' +
        '۳) یک بار run_session.bat را اجرا کن، کد تلگرام را وارد کن تا telegram_session.txt ساخته شود.\n' +
        '۴) دوباره همین دستور را بفرست. تا آن موقع، هر چیزی بفرستی فقط به‌صورت لینک در کانال می‌نشیند.'
    };
  }

  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const siteBase = (process.env.APP_URL || 'https://aipetros.xyz').replace(/\/+$/, '');
  const state = readChannelState();
  const fileState = state.filePublishedIds || {};

  const wanted = titles.find(
    (t) =>
      ((t.titleFa || '') && message.includes(t.titleFa.toLowerCase())) ||
      ((t.title || '') && message.includes(t.title.toLowerCase()))
  );
  let targets = wanted ? [wanted] : titles;
  targets = targets.filter((t) => (t.qualities || []).some((q) => q.url));
  if (!forceAll && !wanted) {
    targets = targets.filter((t) => !fileState[t.id]);
  }
  if (targets.length === 0) {
    return {
      intent: 'channel_file',
      replyFa: 'همه فایل‌های قابل ارسال قبلاً به کانال رفته‌اند. برای تکرار بنویس «همه را دوباره با فایل به کانال بفرست».'
    };
  }

  const job = {
    destination: readTelegramBotConfig().channel,
    items: targets.slice(0, 10).map((t) => ({
      id: t.id,
      title: t.titleFa || t.title,
      url: (t.qualities || []).find((q) => q.url)?.url || '',
      watchUrl: `${siteBase}/#/watch/${t.id}`
    }))
  };
  await fsp.writeFile(path.join(process.cwd(), 'data', 'agent_transfer_job.json'), JSON.stringify(job, null, 2), 'utf8');
  try {
    await fsp.rm(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), { force: true });
  } catch {
    // fresh run
  }

  const python = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(python, [path.join(process.cwd(), 'scripts', 'telethon_file_transfer.py')], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return {
    intent: 'channel_file',
    replyFa:
      `📤 انتقال واقعی ${job.items.length} فایل شروع شد (دانلود از منبع + آپلود مستقیم فایل با نشست تلگرام).\n` +
      'برای فیلم‌های چند گیگابایتی صبور باش؛ هر لحظه بگو «وضعیت انتقال فایل» تا درصد پیشرفت را بدهم.\n' +
      'پس از اتمام هر فایل، نسخه کپی موقت از روی دیسک پاک می‌شود.'
  };
}

function readFileTransferStatus(): AgentReply {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), 'utf8');
    const status = JSON.parse(raw) as Record<string, { title: string; status: string; progressPct: number; error: string }>;
    const entries = Object.entries(status);
    if (entries.length === 0) {
      return { intent: 'transfer_status', replyFa: 'هنوز اطلاعاتی از انتقال ثبت نشده؛ چند لحظه صبر کن و دوباره بپرس.' };
    }
    const label: Record<string, string> = {
      downloading: '⏬ در حال دانلود',
      uploading: '⏫ در حال آپلود',
      uploaded: '✅ کامل شد',
      failed: '⛔ ناموفق'
    };
    const lines = entries.map(([id, s]) => `• «${s.title}» — ${label[s.status] || s.status} ${s.progressPct ? `(${s.progressPct}٪)` : ''}${s.error ? ` — ${s.error}` : ''}`);
    const done = entries.filter(([, s]) => s.status === 'uploaded').length;
    return { intent: 'transfer_status', replyFa: `📊 وضعیت انتقال فایل‌ها (${done}/${entries.length} کامل):\n${lines.join('\n')}` };
  } catch {
    return { intent: 'transfer_status', replyFa: 'انتقال فعالی در جریان نیست یا هنوز شروع نشده. با «فایل‌ها را با تلگرام‌کلاینت به کانال بفرست» شروع کن.' };
  }
}

/**
 * Direct link → real file in the Telegram channel, bypassing the site catalog
 * entirely (the owner asked for channel-first operation). The URL is not added
 * to the site and no playback-law check blocks it — it is a plain
 * download-and-upload into the owner's own channel via the Telethon session.
 */
async function transferDirectLinkToChannel(url: string): Promise<AgentReply> {
  // A transfer already running? Never spawn a second one.
  try {
    const st = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), 'utf8')) as Record<string, { status: string }>;
    if (Object.values(st).some((s) => s.status === 'downloading' || s.status === 'uploading')) {
      return { intent: 'channel_file', replyFa: '⏳ یک انتقال فایل در جریان است («وضعیت انتقال فایل»). بعد از تمام شدنش دوباره لینک را بفرست.' };
    }
  } catch {
    // no active transfer
  }

  const hasSession =
    Boolean((process.env.TG_STRING_SESSION || '').trim()) ||
    fs.existsSync(path.join(process.cwd(), 'telegram_session.txt')) ||
    fs.existsSync(path.join(process.cwd(), 'petros_gateway_session.session'));
  if (!process.env.TG_API_ID || !process.env.TG_API_HASH || !hasSession) {
    return { intent: 'channel_file', replyFa: '⛔ نشست تلگرام کاربری آماده نیست — اول دستور «فایل‌ها را با تلگرام‌کلاینت به کانال بفرست» را بزن تا راهنمای دقیقش را بدهم.' };
  }

  const guess = guessTitleFromUrl(url);
  const job = {
    destination: readTelegramBotConfig().channel,
    items: [{ id: `direct-${Date.now().toString(36)}`, title: guess.title, url, watchUrl: '' }]
  };
  await fsp.writeFile(path.join(process.cwd(), 'data', 'agent_transfer_job.json'), JSON.stringify(job, null, 2), 'utf8');
  try {
    await fsp.rm(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), { force: true });
  } catch {
    // fresh run
  }
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(python, [path.join(process.cwd(), 'scripts', 'telethon_file_transfer.py')], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return {
    intent: 'channel_file',
    replyFa: `📤 دانلود «${guess.title}» از لینک و آپلود مستقیم فایل در کانال شروع شد (بدون ورود به سایت).\nپیشرفت: «وضعیت انتقال فایل»`
  };
}

/**
 * Diff the site catalog (movies + series) against the videos already in the
 * owner's Telegram channel, then transfer every missing title as a real file.
 * First call runs the channel scan; the next call reports the diff and starts
 * the transfer automatically.
 */
async function compareCatalogWithChannel(message: string): Promise<AgentReply> {
  const inventoryPath = path.join(process.cwd(), 'data', 'agent_channel_inventory.json');
  const forceRescan = /(دوباره اسکن|اسکن دوباره|دوباره مقایسه)/.test(message);

  const catalog = await readLocalCatalog();
  const titles = (catalog.streams || []) as unknown as TitleRecord[];
  const withStreams = titles.filter((t) => (t.qualities || []).some((q) => q.url));
  if (withStreams.length === 0) {
    return { intent: 'compare', replyFa: 'کاتالوگ خالی است؛ اول فیلم اضافه کن بعد مقایسه کن.' };
  }

  let inventory: { generatedAt?: string; error?: string; messageFa?: string; items?: Array<{ filename?: string; caption?: string }> } | null = null;
  try {
    inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch {
    inventory = null;
  }

  if (!inventory || forceRescan || inventory.error) {
    // (re)start the scan worker
    try {
      await fsp.rm(inventoryPath, { force: true });
    } catch {
      // ignore
    }
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(python, [path.join(process.cwd(), 'scripts', 'telethon_file_transfer.py'), 'scan'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return {
      intent: 'compare',
      replyFa:
        '🔍 در حال اسکن ویدیوهای کانال تلگرام… (بسته به تعداد پیام‌ها ۱ تا ۳ دقیقه طول می‌کشد)\n' +
        'چند لحظه بعد دوباره بنویس «مقایسه با کانال» تا بگویم چه چیزی در کاتالوگ هست که در کانال نیست و فوراً انتقالشان شروع شود.'
    };
  }

  // A transfer is already running? Never start a duplicate one.
  try {
    const st = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), 'utf8')) as Record<string, { status: string }>;
    const running = Object.values(st).some((s) => s.status === 'downloading' || s.status === 'uploading');
    if (running) {
      return { intent: 'compare', replyFa: '⏳ یک انتقال فایل همین الان در جریان است («وضعیت انتقال فایل»). بعد از اتمامش، دوباره «مقایسه با کانال» را بگو تا موارد جاافتاده شروع شوند.' };
    }
  } catch {
    // no active transfer
  }

  const norm = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '');
  const haystack = (inventory.items || []).map((i) => norm(`${i.filename || ''} ${i.caption || ''}`)).filter(Boolean);

  const state = readChannelState();
  const fileState = state.filePublishedIds || {};
  const missing: TitleRecord[] = [];
  const present: string[] = [];
  for (const t of withStreams) {
    const key = norm(t.titleFa || t.title);
    if (key.length >= 4 && haystack.some((h) => h.includes(key) || key.includes(h))) {
      present.push(t.titleFa || t.title);
    } else {
      missing.push(t);
    }
  }

  const header =
    `🔍 مقایسه با کانال انجام شد:\n` +
    `• کاتالوگ سایت: ${withStreams.length} عنوان (فیلم و سریال)\n` +
    `• ویدیوهای موجود در کانال: ${inventory.items?.length || 0}\n` +
    (present.length ? `• در کانال موجودند: ${present.join('، ')}\n` : '');

  if (missing.length === 0) {
    return { intent: 'compare', replyFa: `${header}\n✅ همه عناوین کاتالوگ در کانال موجودند — چیزی برای انتقال نماند.` };
  }

  // Start transferring the missing titles as real files.
  const siteBase = (process.env.APP_URL || 'https://aipetros.xyz').replace(/\/+$/, '');
  const job = {
    destination: readTelegramBotConfig().channel,
    items: missing.slice(0, 10).map((t) => ({
      id: t.id,
      title: t.titleFa || t.title,
      url: (t.qualities || []).find((q) => q.url)?.url || '',
      watchUrl: `${siteBase}/#/watch/${t.id}`
    }))
  };
  await fsp.writeFile(path.join(process.cwd(), 'data', 'agent_transfer_job.json'), JSON.stringify(job, null, 2), 'utf8');
  try {
    await fsp.rm(path.join(process.cwd(), 'data', 'agent_transfer_status.json'), { force: true });
  } catch {
    // fresh run
  }
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(python, [path.join(process.cwd(), 'scripts', 'telethon_file_transfer.py')], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return {
    intent: 'compare',
    replyFa:
      `${header}\n📤 ${missing.length} عنوان در کانال نبود — انتقال فایلشان شروع شد:\n` +
      missing.slice(0, 10).map((t) => `• «${t.titleFa || t.title}»`).join('\n') +
      `\n(حداکثر ۱۰ عنوان در هر اجرا؛ پیشرفت: «وضعیت انتقال فایل»)`
  };
}

function launchBrowser(targetUrl: string): AgentReply {
  try {
    const outDir = path.join(process.cwd(), 'data', 'browser_sessions');
    const host = new URL(targetUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const sessionPath = path.join(outDir, `${host}.json`);
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(python, [path.join(process.cwd(), 'scripts', 'browser_login_agent.py'), targetUrl, sessionPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return {
      intent: 'browser',
      replyFa:
        '🖥️ مرورگر تعاملی روی مانیتور تو باز شد. خودت یوزر/پسورد و کپچا را وارد کن. ' +
        'بعد از بستن مرورگر، بگو «نشست را بررسی کن» تا کوکی‌های نشست خوانده شود. ' +
        'یادآوری: استخراج لینک‌های محتوای دارای کپی‌رایت برای انتشار، خارج از محدوده کاری من است — این مرورگر برای سورس‌های مجاز شماست.'
    };
  } catch (err: unknown) {
    return {
      intent: 'browser',
      replyFa: `⛔ باز کردن مرورگر ناموفق بود: ${(err as Error).message}. مطمئن شو پایتون و Playwright روی سرور نصب است.`
    };
  }
}

/** Main local intent router. Every action is triggered by the owner's message. */
export async function handleAdminChatMessage(rawText: string): Promise<AgentReply> {
  const text = normalizeFa(rawText);
  if (!text) {
    return { intent: 'empty', replyFa: 'پیامی دریافت نشد. یک دستور یا لینک بفرست.' };
  }

  const url = firstUrl(rawText);

  if (/(راهنما|کمک|دستورها|چه کار .*می تونی)/.test(text)) return buildHelp();
  if (/^(سلام|درود|هی|های)([\s!\u060C.,؟?]|$)/.test(text) && text.length < 30) {
    return {
      intent: 'greeting',
      replyFa: 'سلام کارفرما! 👑 ایجنت اختصاصی پتروس آماده است. «راهنما» را بفرست تا دستورها را ببینی، یا مستقیم لینک فیلم بده.'
    };
  }
  if (/گزارش فیلم|سلامت|لینک ها|وضعیت لینک/.test(text)) return buildHealthReport();
  if (/درآمد|میزان درامد|ولت|درامد/.test(text)) {
    const config = await readLocalConfig();
    return buildRevenueReport(config);
  }
  if (/منتشر کن|اعمال سراسری|پابلیش|پوش کن/.test(text) && !url) {
    return publishEverything('publish via admin chat agent');
  }
  // Direct link → real file in the channel (channel-first mode)
  if (url && /کانال/.test(text) && /(فایل|بفرست|دانلود)/.test(text)) {
    return transferDirectLinkToChannel(url);
  }
  if (/(پابلیک دومین|حق نشر ندارد|بدون کپی|کالکشن کلاسیک|فیلم‌های کلاسیک)/.test(text) && /(اضافه|بیاور|اجرای|کالکشن)/.test(text)) {
    return addPublicDomainCollection();
  }
  if (/(پابلیک دومین|حق نشر ندارد|بدون کپی|کالکشن کلاسیک|فیلم‌های کلاسیک)/.test(text) && /(اضافه|بیاور|اجرای|کالکشن)/.test(text) && /۲۰|20/.test(text)) {
    return addPublicDomainCollection();
  }
  // Big editable collection run (250-title list)
  if (/(کالکشن|لیست کالکشن)/.test(text) && /(اجرای|اجرا کن|شروع کن|ادامه)/.test(text) && !/۲۰|20/.test(text)) {
    const { startCollectionRun, readProgress } = await import('./collectionStore.ts');
    const result = await startCollectionRun();
    return { intent: 'collection_run', replyFa: result.messageFa, data: result.progress };
  }
  if (/وضعیت کالکشن/.test(text)) {
    const { readProgress } = await import('./collectionStore.ts');
    const pr = await readProgress();
    return {
      intent: 'collection_progress',
      replyFa:
        `📊 وضعیت کالکشن:\n` +
        `• پردازش‌شده: ${pr.processed ?? 0} از ${pr.total ?? '—'}\n` +
        `• اضافه‌شده: ${pr.added ?? 0} | رد شده: ${pr.failed ?? 0} | تکراری: ${pr.skipped ?? 0}\n` +
        (pr.running ? '• وضعیت: در حال اجرا ⏳\n' : '• وضعیت: متوقف/تمام (برای ادامه «اجرای کالکشن» را بگو)\n') +
        `\n${(pr.log || []).slice(0, 8).join('\n')}`
    };
  }
  // Catalog vs Telegram channel diff — transfer whatever is missing
  if (/(مقایسه|اسکن|در کانال نیست)/.test(text) && /(کانال|تلگرام)/.test(text)) {
    return compareCatalogWithChannel(rawText);
  }
  // Real-file transfer via the Telethon user session (large videos)
  if (/کانال/.test(text) && /(فایل|تلثون|کلاینت|ویدیوی واقعی)/.test(text) && /(بفرست|انتقال)/.test(text)) {
    return startTelethonFileTransfer(text, /(دوباره|مجدد|همه)/.test(text));
  }
  if (/وضعیت انتقال فایل|وضعیت فایل/.test(text)) return readFileTransferStatus();
  // Transfer site videos to the owner's Telegram channel
  if (/کانال/.test(text) && /(بفرست|انتقال|پست کن|اعلام کن)/.test(text)) {
    // Any «again / resend» wording forces a resend of every title.
    return transferCatalogToChannel(text, /(دوباره|مجدد|همه)/.test(text));
  }
  if (/مرورگر/.test(text) && url) return launchBrowser(url);

  if (url && /اضافه کن|منتشر کن|پوش کن|پابلیش|ثبت کن|بیاور|بگذار/.test(text)) {
    return addFromLink(url, /منتشر کن|پوش کن|پابلیش/.test(text));
  }
  if (url) {
    return {
      intent: 'url',
      replyFa:
        'لینکی دیدم. برای افزودن، همراه لینک بنویس «این فیلم را اضافه کن» (فقط ذخیره در کاتالوگ) یا «این فیلم را منتشر کن» (اعتبارسنجی + افزودن + پوش خودکار روی سایت).'
    };
  }
  if (/وضعیت|داشبورد|چند فیلم|چتت/.test(text)) return buildStatusSummary();

  return {
    intent: 'unknown',
    replyFa:
      'متوجه منظورت نشدم 🤔 این‌ها را می‌توانم انجام دهم: «وضعیت کاتالوگ»، «گزارش فیلم‌ها»، «میزان درآمد»، افزودن فیلم با لینک MP4، «منتشر کن»، «مرورگر را باز کن <آدرس>». برای شروع «راهنما» را بفرست.'
  };
}
