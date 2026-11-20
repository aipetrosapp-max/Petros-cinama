#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Petros Cinema — Telethon LIBRARY UPLOAD (real files → owner channel)

Uploads the ACTUAL video files of the whole catalog (data/streams.json) to the
owner's Telegram channel, ordered from the NEWEST year first, every quality,
proper file names. Resume-safe: data/telegram_library_state.json remembers
uploaded title+quality ids; progress: data/telegram_library_status.json.

Usage:
  python telethon_library_upload.py [limit] [minYear]
"""

import asyncio
import os
import re
import sys
import json
import time
import shutil
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STREAMS_FILE = os.path.join(ROOT, "data", "streams.json")
STATE_FILE = os.path.join(ROOT, "data", "telegram_library_state.json")
STATUS_FILE = os.path.join(ROOT, "data", "telegram_library_status.json")
CONFIG_FILE = os.path.join(ROOT, "config.json")
TEMP_DIR = os.path.join(ROOT, "temp_telegram_downloads")

MAX_TG_BYTES = 1_900_000_000  # 2GB telegram free limit minus margin

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
    """Proper file name: URL basename decoded, else Title.Quality.ext"""
    base = urllib.parse.unquote((url or "").split("?")[0].split("/")[-1])
    base = re.sub(r"[^\w\.\-\+\(\)\[\] ]", "_", base).strip("._")
    if "." in base:
        ext = base.rsplit(".", 1)[-1].lower()
        if 2 <= len(ext) <= 5:
            return base
    fallback = re.sub(r"[^\w\- ]", "", title).strip().replace(" ", ".")
    q = (quality or "").replace("p", "") or ""
    return f"{fallback or 'Petros'}{('.' + q) if q else ''}.mp4"


async def download_file(url: str, dest: str, cookie_header: str = "") -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", **({"Cookie": cookie_header} if cookie_header else {})})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        got = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            got += len(chunk)
            if total:
                write_status({"phase": "downloading", "pct": min(99, int(got * 100 / total)), "bytes": got})
    return os.path.getsize(dest) > 0


async def run(client: Any, destination: int, titles: List[Dict[str, Any]], sent_ids: set) -> None:
    await client.connect()
    me = await client.get_me()
    if not me:
        raise RuntimeError("نشست تلگرام معتبر نیست.")
    await client.get_entity(destination)

    jobs: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    for t in titles:
        for q in (t.get("qualities") or []):
            if not (q.get("url") or "").startswith("http"):
                continue
            jobs.append((t, q))
    total = len(jobs)
    write_status({"running": True, "total": total, "sent": 0, "skipped": 0, "failed": 0, "phase": "starting", "pct": 0})

    sent = skipped = failed = 0
    idx = 0
    for t, q in jobs:
        idx += 1
        title = clean_text(t.get("title") or "بدون عنوان")
        year = t.get("year")
        quality = clean_text(q.get("quality"))
        url = q["url"]
        jid = f"{t.get('id')}::{quality}::{hashlib_hash(url)}"
        if jid in sent_ids:
            continue

        write_status({"currentItem": f"{title} — {quality}", "sent": sent, "skipped": skipped, "failed": failed, "phase": "checking", "pct": 0, "current": idx})

        # HEAD size check → skip files beyond the Telegram limit
        size = 0
        try:
            hreq = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
            with urllib.request.urlopen(hreq, timeout=30) as h:
                size = int(h.headers.get("Content-Length") or 0)
        except Exception:
            size = 0
        if size > MAX_TG_BYTES:
            skipped += 1
            write_status({"skipped": skipped, "lastSkip": f"{title} [{quality}] — بزرگ‌تر از حد تلگرام ({size // 1048576} MB)"})
            sent_ids.add(jid)
            save_json(STATE_FILE, {"sent": list(sent_ids)})
            continue

        os.makedirs(TEMP_DIR, exist_ok=True)
        fname = proper_name(url, title, quality)
        dest = os.path.join(TEMP_DIR, fname)
        try:
            ok = await download_file(url, dest)
            if not ok:
                failed += 1
                write_status({"failed": failed, "lastError": f"دانلود ناموفق: {title}"})
                continue
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
            write_status({"sent": sent, "phase": "uploaded", "pct": 100})
        except Exception as e:
            msg = str(e)
            if "FloodWait" in msg:
                mnum = re.search(r"(\d+)\s*seconds", msg)
                wait = min(int(mnum.group(1)) + 5, 900) if mnum else 60
                await asyncio.sleep(wait)
                continue
            failed += 1
            write_status({"failed": failed, "lastError": msg[:200]})
        finally:
            try:
                if os.path.exists(dest):
                    os.remove(dest)
            except Exception:
                pass
            await asyncio.sleep(1.5)

    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    write_status({"running": False, "done": True, "phase": "finished", "finishedAt": time.time(),
                  "messageFa": f"تمام شد — {sent} فایل آپلود شد، {skipped} رد شد (حجم زیاد)، {failed} ناموفق."})
    await client.disconnect()


def hashlib_hash(s: str) -> str:
    import hashlib
    return hashlib.md5(s.encode("utf-8", "ignore")).hexdigest()[:10]


async def amain(limit: int, min_year: int) -> None:
    data = json.load(open(STREAMS_FILE, encoding="utf-8"))
    titles = [t for t in (data.get("streams") or []) if (t.get("status") or "published") == "published"]
    if min_year:
        titles = [t for t in titles if (t.get("year") or 0) >= min_year]
    # newest first (ترتیب: از جدیدترین)
    titles.sort(key=lambda t: (-(t.get("year") or 0), clean_text(t.get("title") or "")))
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

    state = {}
    if os.path.exists(STATE_FILE):
        try:
            state = json.load(open(STATE_FILE, encoding="utf-8"))
        except Exception:
            state = {}
    sent_ids = set(state.get("sent", []))

    client = TelegramClient(StringSession(session_str), api_id, api_hash)
    await run(client, destination, titles, sent_ids)


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    min_year = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    write_status({"running": True, "done": False, "mode": "upload", "startedAt": time.time(), "error": None})
    try:
        asyncio.run(amain(limit, min_year))
    except Exception as e:
        write_status({"running": False, "done": True, "phase": "error", "error": str(e)[:300]})


if __name__ == "__main__":
    main()
