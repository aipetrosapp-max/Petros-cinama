#!/usr/bin/env node
/**
 * PETROS CINEMA — Public-Domain Collection Ingestion Worker
 *
 * Reads   data/public_domain_collection.json  (editable list: title/year/identifier)
 * Writes  data/collection_state.json          (processed identifiers)
 *         data/collection_progress.json       (live progress for the admin UI/chat)
 * Updates data/streams.json + public copies    (adds titles with up to 3 real
 *                                              quality derivatives each)
 *
 * One run processes as many items as fit in the time budget, then stops;
 * re-running continues where it left off (anti-duplicate by URL).
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COLLECTION = path.join(ROOT, 'data', 'public_domain_collection.json');
const STATE = path.join(ROOT, 'data', 'collection_state.json');
const PROGRESS = path.join(ROOT, 'data', 'collection_progress.json');
const UA = 'Mozilla/5.0 PetrosCinemaCollectionIngest';
const TIME_BUDGET_MS = 8 * 60 * 1000;
const MAX_FILES_PER_ITEM = 3;
const MIN_FILE_BYTES = 30_000_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(14000)
      });
      if (res.ok) return await res.json();
      if (res.status >= 500 || res.status === 429) {
        await sleep(2500 * attempt);
        continue;
      }
      return null;
    } catch {
      await sleep(2000 * attempt);
    }
  }
  return null;
}

async function probeMedia(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Range: 'bytes=0-0', 'User-Agent': UA },
        signal: AbortSignal.timeout(12000)
      });
      if (res.status === 200 || res.status === 206) {
        const type = (res.headers.get('content-type') || '').toLowerCase();
        if (!type.includes('text/html')) return true;
      }
      if (res.status >= 500 || res.status === 403) {
        await sleep(2000);
        continue;
      }
      return false;
    } catch {
      await sleep(2000);
    }
  }
  return false;
}

async function loadJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeCatalogStreams(streams) {
  const payload = JSON.stringify({ version: new Date().toISOString(), updatedAt: new Date().toISOString(), streams }, null, 2);
  for (const rel of ['data/streams.json', 'public/data/streams.json', 'public/streams.json']) {
    try {
      await fs.writeFile(path.join(ROOT, rel), payload, 'utf8');
    } catch (e) {
      console.error('write failed', rel, e.message);
    }
  }
}

function qualityLabel(rank, name) {
  const n = (name || '').toLowerCase();
  if (n.includes('1080')) return '1080p';
  if (n.includes('720')) return '720p';
  if (rank === 0) return '720p';
  if (rank === 1) return '480p';
  return '360p';
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

async function main() {
  const collection = await loadJson(COLLECTION, { items: [] });
  const state = await loadJson(STATE, {});
  const items = collection.items || [];

  const progress = {
    running: true,
    startedAt: new Date().toISOString(),
    total: items.length,
    processed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    lastItem: '',
    log: []
  };
  const pushLog = (line) => {
    progress.log.unshift(`${new Date().toISOString().slice(11, 19)} — ${line}`);
    progress.log = progress.log.slice(0, 30);
    return fs.writeFile(PROGRESS, JSON.stringify(progress, null, 2), 'utf8').catch(() => {});
  };
  await fs.writeFile(PROGRESS, JSON.stringify(progress, null, 2), 'utf8').catch(() => {});

  const started = Date.now();
  let processed = 0;

  for (const item of items) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      await pushLog('⏸ سقف زمانی این اجرا پر شد — دوباره «اجرای کالکشن» را بزن تا ادامه دهد.');
      break;
    }
    if (state[item.identifier]?.status === 'added') {
      processed++;
      continue;
    }

    progress.lastItem = item.title;
    await pushLog(`⏳ «${item.title}» — دریافت متادیتا…`);
    const meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`);
    if (!meta || meta.is_dark || !Array.isArray(meta.files)) {
      state[item.identifier] = { status: 'failed', error: 'metadata_unavailable', at: new Date().toISOString() };
      progress.failed++;
      processed++;
      progress.processed = processed;
      await pushLog(`⛔ «${item.title}» — متادیتا در دسترس نبود`);
      await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8').catch(() => {});
      await sleep(1200);
      continue;
    }

    // pick up to 3 real playable derivatives (full movie only), biggest first:
    // IA items usually ship [name].mp4 (main), [name]_512kb.mp4 (480p),
    // [name].ia.mp4 (IA transcode) and an Ogg .ogv — all browser-playable.
    const candidates = meta.files
      .map((f) => ({ name: String(f.name || ''), size: Number(f.size || 0) }))
      .filter((f) => /\.(mp4|ogv)$/i.test(f.name) && f.size > MIN_FILE_BYTES)
      .sort((a, b) => b.size - a.size)
      .slice(0, MAX_FILES_PER_ITEM);

    // ensure at most one variant per derivative family (main/512kb/ia/ogv)
    const mp4s = [];
    const seenKinds = new Set();
    for (const f of candidates) {
      const n = f.name.toLowerCase();
      const kind = n.endsWith('.ogv') ? 'ogv' : n.includes('512kb') ? '512kb' : n.includes('.ia.') ? 'ia' : 'main';
      if (seenKinds.has(kind)) continue;
      seenKinds.add(kind);
      mp4s.push(f);
      if (mp4s.length >= MAX_FILES_PER_ITEM) break;
    }

    if (mp4s.length === 0) {
      state[item.identifier] = { status: 'failed', error: 'no_full_mp4', at: new Date().toISOString() };
      progress.failed++;
      processed++;
      progress.processed = processed;
      await pushLog(`⛔ «${item.title}» — فایل MP4 کامل پیدا نشد`);
      await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8').catch(() => {});
      await sleep(1000);
      continue;
    }

    const qualities = [];
    for (let i = 0; i < mp4s.length; i++) {
      const url = `https://archive.org/download/${encodeURIComponent(item.identifier)}/${encodeURIComponent(mp4s[i].name)}`;
      const ok = await probeMedia(url);
      if (!ok) continue;
      const isOgv = mp4s[i].name.toLowerCase().endsWith('.ogv');
      qualities.push({
        id: makeId('q'),
        quality: qualityLabel(i, mp4s[i].name),
        url,
        format: isOgv ? 'direct_ogv' : 'direct_mp4',
        sizeMB: Math.round(mp4s[i].size / 1e6)
      });
    }

    if (qualities.length === 0) {
      state[item.identifier] = { status: 'failed', error: 'probe_failed', at: new Date().toISOString() };
      progress.failed++;
      processed++;
      progress.processed = processed;
      await pushLog(`⛔ «${item.title}» — هیچ فایلی اعتبارسنجی پخش را رد نکرد`);
      await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8').catch(() => {});
      await sleep(1000);
      continue;
    }

    // duplicate check across the whole catalog
    const catalog = await loadJson(path.join(ROOT, 'data', 'streams.json'), { streams: [] });
    const streams = catalog.streams || [];
    const mainUrl = qualities[0].url.toLowerCase();
    const titleKey = String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const dupeUrl = streams.some((t) => (t.qualities || []).some((q) => (q.url || '').toLowerCase() === mainUrl));
    const dupeTitle = streams.some((t) => String(t.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === titleKey);
    if (dupeUrl || dupeTitle) {
      state[item.identifier] = { status: 'added', qualities: qualities.length, duplicate: true, at: new Date().toISOString() };
      progress.skipped++;
      processed++;
      progress.processed = processed;
      await pushLog(`♻️ «${item.title}» — قبلاً در کاتالوگ بود`);
      await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8').catch(() => {});
      await sleep(600);
      continue;
    }

    const year = Number.isInteger(item.year) ? item.year : undefined;
    const title = {
      id: makeId('title'),
      title: item.title,
      titleFa: year ? `${item.title} (${year})` : item.title,
      category: 'movie',
      status: 'published',
      year,
      featured: false,
      qualities,
      subtitles: [],
      seasons: [],
      episodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    streams.unshift(title);
    catalog.streams = streams;
    catalog.updatedAt = new Date().toISOString();
    await writeCatalogStreams(streams);

    state[item.identifier] = { status: 'added', qualities: qualities.length, at: new Date().toISOString() };
    progress.added++;
    processed++;
    progress.processed = processed;
    await pushLog(`✅ «${title.titleFa}» — ${qualities.length} کیفیت اضافه شد (${qualities.map((q) => q.quality).join('، ')})`);
    await fs.writeFile(STATE, JSON.stringify(state, null, 2), 'utf8').catch(() => {});
    await sleep(1500); // gentle on archive.org
  }

  progress.running = false;
  progress.finishedAt = new Date().toISOString();
  await pushLog('🏁 این اجرا تمام شد. برای ادامه عناوین بعدی دوباره «اجرای کالکشن» را بزن.');
  await fs.writeFile(PROGRESS, JSON.stringify(progress, null, 2), 'utf8').catch(() => {});
}

main().catch(async (e) => {
  try {
    const progress = await loadJson(PROGRESS, {});
    progress.running = false;
    progress.error = String(e && e.message ? e.message : e);
    await fs.writeFile(PROGRESS, JSON.stringify(progress, null, 2), 'utf8');
  } catch {}
  process.exit(1);
});
