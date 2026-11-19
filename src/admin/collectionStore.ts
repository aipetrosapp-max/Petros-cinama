/**
 * PETROS CINEMA — Public-Domain Collection store + runner
 * Shared by admin API routes and the Persian chat agent.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

const COLLECTION_FILE = 'data/public_domain_collection.json';
const STATE_FILE = 'data/collection_state.json';
const PROGRESS_FILE = 'data/collection_progress.json';

export interface CollectionItem {
  title: string;
  year?: number | null;
  identifier: string;
}

export interface CollectionFile {
  version: number;
  updatedAt: string;
  note?: string;
  items: CollectionItem[];
}

export interface CollectionProgress {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  total?: number;
  processed?: number;
  added?: number;
  skipped?: number;
  failed?: number;
  lastItem?: string;
  error?: string;
  log?: string[];
}

const p = (...segments: string[]) => path.join(process.cwd(), ...segments);

export async function readCollection(): Promise<CollectionFile> {
  try {
    return JSON.parse(await fsp.readFile(p(COLLECTION_FILE), 'utf8'));
  } catch {
    return { version: 1, updatedAt: '', items: [] };
  }
}

export async function saveCollection(collection: CollectionFile): Promise<void> {
  collection.updatedAt = new Date().toISOString();
  await fsp.writeFile(p(COLLECTION_FILE), JSON.stringify(collection, null, 2), 'utf8');
}

export async function readProgress(): Promise<CollectionProgress> {
  try {
    return JSON.parse(await fsp.readFile(p(PROGRESS_FILE), 'utf8'));
  } catch {
    return { running: false };
  }
}

export function isStaleRun(progress: CollectionProgress): boolean {
  if (!progress.running) return false;
  if (!progress.startedAt) return false;
  // a run that never finished and is older than 25 minutes is considered dead
  const age = Date.now() - new Date(progress.startedAt).getTime();
  return age < 25 * 60 * 1000;
}

/** Launch (or continue) the detached ingestion worker. */
export async function startCollectionRun(): Promise<{ started: boolean; messageFa: string; progress: CollectionProgress }> {
  const progress = await readProgress();
  if (progress.running && isStaleRun(progress)) {
    return {
      started: false,
      messageFa: '⏳ یک اجرا در جریان است. با «وضعیت کالکشن» پیشرفت را ببین؛ پس از تمام شدن دوباره اجرا کن تا ادامه دهد.',
      progress
    };
  }
  const python = process.platform === 'win32' ? 'python' : 'python3';
  // node ships with the project runtime (tsx environment already requires node)
  const child = spawn(process.execPath, [p('scripts', 'collection_ingest_worker.mjs')], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd()
  });
  child.unref();
  return {
    started: true,
    messageFa: '🚀 اجرای کالکشن شروع شد (پس‌زمینه). پیشرفت: «وضعیت کالکشن» یا تب کالکشن در پنل.',
    progress: { running: true }
  };
}

export function validateCollectionItems(items: unknown): { ok: true; items: CollectionItem[] } | { ok: false; messageFa: string } {
  if (!Array.isArray(items)) {
    return { ok: false, messageFa: 'آرایه items الزامی است.' };
  }
  const cleaned: CollectionItem[] = [];
  const seen = new Set<string>();
  for (const raw of items as Array<Record<string, unknown>>) {
    const identifier = String(raw?.identifier || '').trim();
    const title = String(raw?.title || '').trim();
    if (!identifier || !title) {
      return { ok: false, messageFa: 'هر آیتم باید title و identifier داشته باشد.' };
    }
    if (!/^[A-Za-z0-9._-]+$/.test(identifier)) {
      return { ok: false, messageFa: `شناسه نامعتبر: ${identifier}` };
    }
    if (seen.has(identifier.toLowerCase())) continue;
    seen.add(identifier.toLowerCase());
    const year = Number(raw?.year);
    cleaned.push({ title, identifier, year: Number.isFinite(year) ? year : null });
  }
  return { ok: true, items: cleaned };
}

export function collectionFileExists(): boolean {
  return fs.existsSync(p(COLLECTION_FILE));
}
