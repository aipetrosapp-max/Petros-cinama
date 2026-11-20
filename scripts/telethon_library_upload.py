#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Petros Cinema — Telethon LIBRARY UPLOAD v2 (real files → owner channel)

Uploads the ACTUAL video files of the whole catalog (data/streams.json) to the
owner's Telegram channel. Resume-safe; progress in status json.

v2 speed pipeline:
  • Pre-measure file sizes with parallel HEAD probes (12 threads)
  • Order SMALLEST first → maximum completed files per night
  • Pipeline: downloads run in parallel (3 workers) while the previous file
    uploads to Telegram — the two links are used at the same time

Usage:
  python telethon_library_upload.py [limit] [minYear]
"""

import asyncio
import concurrent.futures
import os
import re
import sys
import json
import time
import shutil
import hashlib
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STREAMS_FILE = os.path.join(ROOT, "data", "streams.json")
STATE_FILE = os.path.join(ROOT, "data", "telegram_library_state.json")
STATUS_FILE = os.path.join(ROOT, "data", "telegram_library_status.json")
CONFIG_FILE = os.path.join(ROOT, "config.json")
TEMP_DIR = os.path.join(ROOT, "temp_telegram_downloads")

MAX_TG_BYTES = 1_900_000_000

sys.stdout.reconfigure(encoding="utf-8")


def save_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def write_status(update: Dict[str, Any]) -> None:
    try:
        cur: Dict[str, Any] = {}
        if os.path.exists(STATUS_FILE):
            try:
                cur = json.load(open(STATUS_FILE, encoding="utf-8"))
            except Exception:
                cur = {}
        cur.update(update)
        save_json(STATUS_FILE, cur)
    except Exception:
        pass


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def proper_name(url: str, title: str, quality: str) -> str:
    base = urllib.parse.unquote((url or "").split("?")[0].split("/")[-1])
    base = re.sub(r"[^\w\.\-\+\(\)\[\] ]", "_", base).strip("._")
    if "." in base:
        ext = base.rsplit(".", 1)[-1].lower()
        if 2 <= len(ext) <= 5:
            return base
    fallback = re.sub(r"[^\w\- ]", "", title).strip().replace(" ", ".")
    q = (quality or "").replace("p", "") or ""
    return f"{fallback or 'Petros'}{('.' + q) if q else ''}.mp4"


def md5s(s: str) -> str:
    return hashlib.md5(s.encode("utf-8", "ignore")).hexdigest()[:10]


async def download_file(url: str, dest: str) -> bool:
    def _sync() -> bool:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
            total = int(r.headers.get("Content-Length") or 0)
            got = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
                got += len(chunk)
        return os.path.getsize(dest) > 0
    return await asyncio.to_thread(_sync)


async def main_async(limit: int, min_year: int) -> None:
    data = json.load(open(STREAMS_FILE, encoding="utf-8"))
    titles = [t for t in (data.get("streams") or []) if (t.get("status") or "published") == "published"]
    if min_year:
        titles = [t for t in titles if (t.get("year") or 0) >= min_year]
    if limit:
        titles = titles[:limit]
    if not titles:
        raise RuntimeError("کتابخانه خالی است.")

    api_id = int(os.environ.get("TG_API_ID", "76997"))
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_hash:
        env_file = os.path.join(ROOT, ".env.local")
        if os.path.exists(env_file):
            for line in open(env_file, encoding="utf-8", errors="ignore"):
                m = re.match(r"\s*TG_API_HASH\s*=\s*(\S+)", line)
                if m:
                    api_hash = m.group(1).strip()
    if not api_hash:
        raise RuntimeError("TG_API_HASH تنظیم نشده است.")

    cfg = json.load(open(CONFIG_FILE, encoding="utf-8"))
    destination = int(cfg["destination_channel"])

    from telethon import TelegramClient
    from telethon.sessions import StringSession

    session_str = os.environ.get("TG_STRING_SESSION", "").strip()
    if not session_str:
        spath = os.path.join(ROOT, "telegram_session.txt")
        if os.path.exists(spath):
            session_str = open(spath, encoding="utf-8").read().strip()
    if not session_str:
        raise RuntimeError("نشست تلگرام یافت نشد.")

    state: Dict[str, Any] = {}
    if os.path.exists(STATE_FILE):
        try:
            state = json.load(open(STATE_FILE, encoding="utf-8"))
        except Exception:
            state = {}
    sent_ids = set(state.get("sent", []))

    # ── Build job list + parallel HEAD size probes ──
    jobs: List[Tuple[Dict[str, Any], Dict[str, Any], str]] = []
    for t in titles:
        for q in (t.get("qualities") or []):
            url = (q.get("url") or "").strip()
            if url.startswith("http"):
                jid = f"{t.get('id')}::{clean_text(q.get('quality'))}::{md5s(url)}"
                if jid not in sent_ids:
                    jobs.append((t, q, jid))

    def head_size(job: Tuple[Dict[str, Any], Dict[str, Any], str]) -> int:
        try:
            h = urllib.request.urlopen(
                urllib.request.Request(job[1]["url"], headers={"User-Agent": "Mozilla/5.0"}, method="HEAD"), timeout=25)
            return int(h.headers.get("Content-Length") or 0)
        except Exception:
            return 2 ** 60

    write_status({"running": True, "done": False, "mode": "upload", "phase": "sizing", "total": len(jobs), "sent": 0, "skipped": 0, "failed": 0, "error": None})
    with concurrent.futures.ThreadPoolExecutor(12) as ex:
        sizes = list(ex.map(head_size, jobs))

    jobs = [j for j, s in zip(jobs, sizes) if s <= MAX_TG_BYTES]
    skipped = len(sizes) - len(jobs)
    jobs.sort(key=lambda j: dict(zip([x[2] for x in jobs], sizes)).get(j[2], 0))
    sizes_map = dict(zip([x[2] for x in jobs], [s for s in sizes if s <= MAX_TG_BYTES]))
    jobs.sort(key=lambda j: sizes_map.get(j[2], 2 ** 60))
    total = len(jobs)
    write_status({"phase": "starting", "total": total, "skipped": skipped})

    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    await client.connect()
    me = await client.get_me()
    if not me:
        raise RuntimeError("نشست تلگرام معتبر نیست.")
    await client.get_entity(destination)

    os.makedirs(TEMP_DIR, exist_ok=True)
    queue: asyncio.Queue = asyncio.Queue(maxsize=3)
    sent = failed = 0
    skipped_final = skipped

    async def downloader_worker() -> None:
        for t, q, jid in jobs:
            url = q["url"]
            title = clean_text(t.get("title") or "بدون عنوان")
            quality = clean_text(q.get("quality"))
            fname = proper_name(url, title, quality)
            dest = os.path.join(TEMP_DIR, fname)
            try:
                write_status({"phase": "downloading", "currentItem": f"{title} — {quality}", "currentFile": fname, "pct": 0})
                ok = await download_file(url, dest)
                if not ok:
                    await queue.put((t, q, jid, None, None))
                    continue
                await queue.put((t, q, jid, dest, fname))
            except Exception as e:
                msg = str(e)
                write_status({"lastError": f"دانلود: {msg[:150]}"})
                await queue.put((t, q, jid, None, None))
        await queue.put(None)  # poison pill

    async def uploader_worker() -> None:
        nonlocal sent, failed, skipped_final
        while True:
            item = await queue.get()
            if item is None:
                break
            t, q, jid, dest, fname = item
            title = clean_text(t.get("title") or "بدون عنوان")
            year = t.get("year")
            quality = clean_text(q.get("quality"))
            if dest is None:
                failed += 1
                write_status({"failed": failed, "lastError": f"دانلود ناموفق: {title} [{quality}]"})
                continue
            try:
                size_mb = os.path.getsize(dest) / 1048576
                caption = f"🎬 {title}" + (f" ({year})" if year else "") + f"\n📼 کیفیت {quality}" + (f" — {size_mb:.0f} MB" if size_mb >= 1 else "")
                write_status({"phase": "uploading", "pct": 0, "currentFile": fname, "fileMB": round(size_mb, 1)})

                def progress(current: int, total_bytes: int) -> None:
                    if total_bytes:
                        write_status({"phase": "uploading", "pct": min(99, int(current * 100 / total_bytes))})

                await client.send_file(destination, dest, caption=caption, parse_mode="md", supports_streaming=True, progress_callback=progress)
                sent += 1
                sent_ids.add(jid)
                save_json(STATE_FILE, {"sent": list(sent_ids)})
                write_status({"sent": sent, "phase": "uploaded", "pct": 100, "currentItem": f"{title} — {quality}"})
            except Exception as e:
                msg = str(e)
                if "FloodWait" in msg:
                    mnum = re.search(r"(\d+)\s*seconds", msg)
                    wait = min(int(mnum.group(1)) + 5, 900) if mnum else 60
                    await asyncio.sleep(wait)
                    # re-queue once
                    await queue.put((t, q, jid, dest, fname))
                    continue
                failed += 1
                write_status({"failed": failed, "lastError": msg[:200]})
            finally:
                if dest and os.path.exists(dest):
                    try:
                        os.remove(dest)
                    except Exception:
                        pass
                await asyncio.sleep(1.0)

    dl_task = asyncio.create_task(downloader_worker())
    up_task = asyncio.create_task(uploader_worker())
    await up_task
    dl_task.cancel()

    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    write_status({"running": False, "done": True, "phase": "finished", "finishedAt": time.time(),
                  "messageFa": f"تمام شد — {sent} فایل آپلود شد، {skipped_final} رد شد (حجم زیاد)، {failed} ناموفق."})
    await client.disconnect()


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    min_year = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    write_status({"running": True, "done": False, "mode": "upload", "startedAt": time.time(), "error": None})
    try:
        asyncio.run(main_async(limit, min_year))
    except Exception as e:
        write_status({"running": False, "done": True, "phase": "error", "error": str(e)[:300]})


if __name__ == "__main__":
    main()
