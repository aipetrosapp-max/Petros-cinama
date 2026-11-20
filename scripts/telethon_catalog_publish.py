#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Petros Cinema — Telethon catalog publisher

Publishes the COMPLETE library (data/streams.json) to the owner's Telegram
channel:

  mode=summary  → chunked index messages («لیست کامل کتابخانه», 40 titles per
                  message, each with year + quality labels)
  mode=full     → one polished post per title with every quality as a link

Resume-safe: data/telegram_catalog_state.json remembers sent ids so a restart
continues where it stopped. Progress: data/telegram_catalog_status.json.

Usage:
  python telethon_catalog_publish.py full    [limit]
  python telethon_catalog_publish.py summary [limit]
"""

import asyncio
import os
import re
import sys
import json
import time
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STREAMS_FILE = os.path.join(ROOT, "data", "streams.json")
STATE_FILE = os.path.join(ROOT, "data", "telegram_catalog_state.json")
STATUS_FILE = os.path.join(ROOT, "data", "telegram_catalog_status.json")
CONFIG_FILE = os.path.join(ROOT, "config.json")
SITE_BASE = "https://aipetros.xyz"

sys.stdout.reconfigure(encoding="utf-8")


def save_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_state() -> Dict[str, Any]:
    try:
        return json.load(open(STATE_FILE, encoding="utf-8"))
    except Exception:
        return {}


def write_status(update: Dict[str, Any]) -> None:
    try:
        cur = {}
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


def quality_line(q: Dict[str, Any]) -> str:
    label = clean_text(q.get("quality")) or "کیفیت"
    url = (q.get("url") or "").strip()
    fmt = clean_text(q.get("format"))
    if not url:
        return f"• {label}"
    tag = "دانلود"
    if fmt == "hls":
        tag = "پخش"
    return f"• [{label}]({url}) — {tag}"


def build_full_post(t: Dict[str, Any], index: int, total: int) -> str:
    title = clean_text(t.get("title") or "بدون عنوان")
    title_fa = clean_text(t.get("titleFa"))
    year = t.get("year")
    category = t.get("category") or "movie"
    cat_fa = {"movie": "🎬 فیلم", "series": "📺 سریال", "anime": "🌸 انیمه"}.get(category, "🎬 فیلم")
    rating = t.get("rating")
    genres = [clean_text(g) for g in (t.get("genres") or []) if clean_text(g)]
    director = clean_text(t.get("director"))
    cast = [clean_text(c) for c in (t.get("cast") or []) if clean_text(c)]

    lines: List[str] = [f"{cat_fa} | {index}/{total}"]
    lines.append("")
    head = f"**{title}**"
    if title_fa and title_fa != title:
        head += f"\n{title_fa}"
    if year:
        head += f" ({year})"
    lines.append(head)
    meta = []
    if rating:
        meta.append(f"⭐ {rating}")
    if genres:
        meta.append("🎭 " + "، ".join(genres[:3]))
    if director:
        meta.append(f"🎬 کارگردان: {director}")
    if cast:
        meta.append("👥 " + "، ".join(cast[:3]))
    if meta:
        lines.append("\n".join(meta))

    qs = t.get("qualities") or []
    if qs:
        lines.append("")
        lines.append("📼 **کیفیت‌های موجود:**")
        for q in qs[:8]:
            lines.append(quality_line(q))
    elif t.get("defaultStreamUrl") or t.get("playableUrl"):
        lines.append("")
        lines.append("📼 [مشاهده در سایت]({})".format(t.get("playableUrl") or t.get("defaultStreamUrl")))

    seasons = t.get("seasons") or []
    episodes = t.get("episodes") or []
    if seasons or episodes:
        lines.append("")
        if seasons:
            lines.append(f"📚 فصل‌ها: {len(seasons)}")
        if episodes:
            lines.append(f"🎞 قسمت‌ها: {len(episodes)}")

    lines.append("")
    lines.append(f"▶️ [تماشا در {SITE_BASE.replace('https://', '')}]({SITE_BASE}/#search?q={title.replace(' ', '%20')})")
    lines.append("@Aipetros")
    return "\n".join(lines)


def build_summary_chunk(chunk: List[Dict[str, Any]], page: int, pages: int, total: int) -> str:
    lines = [f"📚 **لیست کامل کتابخانه پتروس** — صفحه {page}/{pages}", f"🎬 کل: {total} عنوان", ""]
    for t in chunk:
        title = clean_text(t.get("title") or "بدون عنوان")
        year = t.get("year")
        cat = t.get("category") or "movie"
        icon = {"movie": "🎬", "series": "📺", "anime": "🌸"}.get(cat, "🎬")
        qs = [clean_text(q.get("quality")) for q in (t.get("qualities") or []) if clean_text(q.get("quality"))]
        qtxt = " | ".join(qs[:4]) if qs else "—"
        lines.append(f"{icon} {title}{' (' + str(year) + ')' if year else ''} — {qtxt}")
    lines.append("")
    lines.append(f"▶️ {SITE_BASE.replace('https://', '')}")
    lines.append("@Aipetros")
    return "\n".join(lines)


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    write_status({"running": True, "mode": mode, "sent": 0, "total": 0, "currentItem": "", "startedAt": time.time(), "finishedAt": None, "error": None})

    try:
        api_id = int(os.environ.get("TG_API_ID", "76997"))
        api_hash = os.environ.get("TG_API_HASH", "").strip()
        if not api_hash:
            # config.json holds the bot token; api_hash lives in .env.local
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
            raise RuntimeError("نشست تلگرام یافت نشد — اول run_session.bat را اجرا کن.")

        data = json.load(open(STREAMS_FILE, encoding="utf-8"))
        titles: List[Dict[str, Any]] = data.get("streams") or []
        # Only published titles (geo law: drafts stay server-side only)
        titles = [t for t in titles if (t.get("status") or "published") == "published"]
        if limit:
            titles = titles[:limit]
        total = len(titles)
        write_status({"total": total, "mode": mode})
        if not total:
            raise RuntimeError("کتابخانه خالی است.")

        state = load_state()
        sent_ids = set(state.get(f"sent_{mode}", []))
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
        asyncio.run(_publish(client, destination, titles, mode, sent_ids))
    except Exception as e:
        write_status({"running": False, "done": True, "error": str(e)[:300]})


async def _publish(client: Any, destination: int, titles: List[Dict[str, Any]], mode: str, sent_ids: set) -> None:
    await client.connect()
    me = await client.get_me()
    if not me:
        raise RuntimeError("نشست تلگرام معتبر نیست — run_session.bat را دوباره اجرا کن.")
    await client.get_entity(destination)

    sent = 0
    if mode == "full":
        idx = 0
        for t in titles:
            idx += 1
            tid = str(t.get("id") or t.get("title"))
            if tid in sent_ids:
                continue
            text = build_full_post(t, idx, len(titles))
            try:
                await client.send_message(destination, text, link_preview=False, parse_mode="md")
                sent_ids.add(tid)
                sent += 1
                write_status({"sent": sent, "currentItem": clean_text(t.get("title"))[:60], "total": len(titles)})
                save_json(STATE_FILE, {"sent_" + mode: list(sent_ids)})
                await asyncio.sleep(2.2)
            except Exception as e:
                msg = str(e)
                if "FloodWait" in msg:
                    mnum = re.search(r"(\d+)\s*seconds", msg)
                    wait = min(int(mnum.group(1)) + 5, 600) if mnum else 60
                    await asyncio.sleep(wait)
                    continue
                write_status({"lastError": msg[:200]})
    else:  # summary
        chunk_size = 40
        chunks = [titles[i:i + chunk_size] for i in range(0, len(titles), chunk_size)]
        for page, chunk in enumerate(chunks, 1):
            key = f"summary_page_{page}"
            if key in sent_ids:
                continue
            text = build_summary_chunk(chunk, page, len(chunks), len(titles))
            try:
                await client.send_message(destination, text, link_preview=False, parse_mode="md")
                sent_ids.add(key)
                sent += 1
                write_status({"sent": sent, "currentItem": f"صفحه {page} از {len(chunks)}", "total": len(chunks)})
                save_json(STATE_FILE, {"sent_" + mode: list(sent_ids)})
                await asyncio.sleep(2.2)
            except Exception as e:
                msg = str(e)
                if "FloodWait" in msg:
                    mnum = re.search(r"(\d+)\s*seconds", msg)
                    wait = min(int(mnum.group(1)) + 5, 600) if mnum else 60
                    await asyncio.sleep(wait)
                    continue
                write_status({"lastError": msg[:200]})

    await client.disconnect()
    write_status({"running": False, "finishedAt": time.time(), "sentTotal": sent, "done": True, "messageFa": f"تمام شد — {sent} پیام جدید ارسال شد."})


if __name__ == "__main__":
    main()
