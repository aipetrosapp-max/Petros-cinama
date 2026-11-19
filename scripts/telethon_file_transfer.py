#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Petros Cinema — Telethon file transfer worker (admin chat agent)

Reads   data/agent_transfer_job.json     = { items: [{id,title,url,watchUrl}], destination }
Writes  data/agent_transfer_status.json  = { <id>: {title,status,progressPct,error} }

For each catalog item: downloads the full video file from its direct URL into a
temp folder, uploads the REAL video file to the owner's Telegram channel via the
authorized Telethon session, then deletes the temp copy.

Credentials (never committed):
  TG_API_ID / TG_API_HASH env vars  (from my.telegram.org)
  Session: TG_STRING_SESSION env, or telegram_session.txt, or the existing
  SQLite session (petros_gateway_session.session).
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
from typing import Dict, Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOB_FILE = os.path.join(ROOT, "data", "agent_transfer_job.json")
STATUS_FILE = os.path.join(ROOT, "data", "agent_transfer_status.json")
TEMP_DIR = os.path.join(ROOT, "temp_telegram_downloads")
OUT_INVENTORY = os.path.join(ROOT, "data", "agent_channel_inventory.json")

def load_env_vars():
    api_id = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id or not api_hash:
        raise RuntimeError("TG_API_ID / TG_API_HASH تنظیم نشده است.")
    return int(api_id), api_hash

try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    write_all_status("telethon_missing", "کتابخانه Telethon نصب نیست: pip install telethon cryptg")
    sys.exit(1)


def save_json(path: str, data: Any) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def write_all_status(status: str, error: str) -> None:
    try:
        job = json.load(open(JOB_FILE, encoding="utf-8"))
        out = {}
        for item in job.get("items", []):
            out[item["id"]] = {"title": item.get("title", ""), "status": status, "progressPct": 0, "error": error}
        save_json(STATUS_FILE, out)
    except Exception:
        pass


def filename_from_url(url: str, fallback_id: str) -> str:
    try:
        name = os.path.basename(urllib.parse.urlparse(url).path)
        name = urllib.parse.unquote(name) or f"{fallback_id}.mp4"
        if not name.lower().endswith((".mp4", ".mkv", ".webm", ".m4v", ".mov")):
            name += ".mp4"
        return name.replace(os.sep, "_")[:120]
    except Exception:
        return f"{fallback_id}.mp4"


async def scan_channel() -> None:
    """Inventory every video already present in the destination channel.
    Writes data/agent_channel_inventory.json for the chat agent to diff against
    the site catalog."""
    api_id, api_hash = load_env_vars()
    dest = int(json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))["destination_channel"])

    session_str = os.environ.get("TG_STRING_SESSION", "").strip()
    session_txt = os.path.join(ROOT, "telegram_session.txt")
    if not session_str and os.path.exists(session_txt):
        try:
            with open(session_txt, encoding="utf-8") as sf:
                session_str = sf.read().strip()
        except Exception:
            session_str = ""
    if session_str:
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
    else:
        sqlite_session = os.path.join(ROOT, "petros_gateway_session.session")
        if not os.path.exists(sqlite_session):
            save_json(OUT_INVENTORY, {"error": "no_session", "messageFa": "نشست تلگرام یافت نشد — اول run_session.bat را اجرا کن."})
            return
        client = TelegramClient(sqlite_session, api_id, api_hash)

    await client.connect()
    if not await client.is_user_authorized():
        save_json(OUT_INVENTORY, {"error": "session_not_authorized", "messageFa": "نشست تلگرام معتبر نیست — run_session.bat را دوباره اجرا کن."})
        return

    try:
        entity = await client.get_entity(dest)
    except Exception as exc:  # noqa: BLE001
        save_json(OUT_INVENTORY, {"error": "channel_unreachable", "messageFa": f"دسترسی به کانال مقصد ممکن نشد: {exc}"})
        return

    items = []
    count = 0
    async for msg in client.iter_messages(entity, limit=None):
        count += 1
        if not (msg.video or msg.document):
            continue
        filename = ""
        try:
            for attr in (msg.document.attributes or []):
                if getattr(attr, "file_name", None):
                    filename = attr.file_name
                    break
        except Exception:
            filename = ""
        if not filename and msg.file and msg.file.name:
            filename = msg.file.name
        caption = (msg.message or "").strip()[:300]
        items.append({"msgId": msg.id, "filename": filename, "caption": caption})

    save_json(OUT_INVENTORY, {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "channel": dest,
        "scannedMessages": count,
        "videos": len(items),
        "items": items,
    })
    await client.disconnect()


async def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "scan":
        await scan_channel()
        return
    with open(JOB_FILE, encoding="utf-8") as f:
        job = json.load(f)
    items = job.get("items", [])
    destination = job.get("destination")
    # Telethon requires a numeric chat id (a string id is not resolvable)
    try:
        destination = int(str(destination).strip())
    except (TypeError, ValueError):
        pass

    api_id_raw = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id_raw or not api_hash:
        write_all_status("no_credentials", "TG_API_ID / TG_API_HASH تنظیم نشده است.")
        return
    api_id = int(api_id_raw)

    session_str = os.environ.get("TG_STRING_SESSION", "").strip()
    session_txt = os.path.join(ROOT, "telegram_session.txt")
    if not session_str and os.path.exists(session_txt):
        try:
            with open(session_txt, encoding="utf-8") as sf:
                session_str = sf.read().strip()
        except Exception:
            session_str = ""

    status: Dict[str, Any] = {}
    save_json(STATUS_FILE, status)

    if session_str:
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
    else:
        sqlite_session = os.path.join(ROOT, "petros_gateway_session.session")
        if not os.path.exists(sqlite_session):
            write_all_status("no_session", "هیچ نشست تلگرام معتبری یافت نشد. اول run_session.bat را اجرا کن.")
            return
        client = TelegramClient(sqlite_session, api_id, api_hash)

    await client.connect()
    if not await client.is_user_authorized():
        write_all_status("session_not_authorized", "نشست تلگرام معتبر نیست یا منقضی شده. run_session.bat را دوباره اجرا کن.")
        return

    os.makedirs(TEMP_DIR, exist_ok=True)

    # Resolve & cache the destination entity once (raw numeric ids need this)
    try:
        destination = await client.get_entity(destination)
    except Exception as e:
        write_all_status("destination_unreachable", f"کانال مقصد پیدا نشد: {e}")
        return

    for item in items:
        item_id = str(item.get("id", ""))
        title = item.get("title", "")
        url = item.get("url", "")
        watch_url = item.get("watchUrl", "")
        entry = {"title": title, "status": "downloading", "progressPct": 0, "error": ""}
        status[item_id] = entry
        save_json(STATUS_FILE, status)

        fname = filename_from_url(url, item_id)
        local_path = os.path.join(TEMP_DIR, fname)

        last_write = [0.0]

        def hook(blocks: int, block_size: int, total: int) -> None:
            if total > 0:
                pct = min(99, int(blocks * block_size * 100 / total))
                now = time.time()
                if pct - last_write[0] >= 5 or now - last_write[1] > 10:
                    last_write[0] = pct
                    last_write[1] = now
                    entry["progressPct"] = pct
                    save_json(STATUS_FILE, status)

        last_write.append(0.0)

        try:
            # VIP sources may need the owner's session cookies to download
            cookie_header = str(item.get("cookieHeader", "")).strip()
            if cookie_header:
                opener = urllib.request.build_opener()
                req = urllib.request.Request(url)
                req.add_header("Cookie", cookie_header)
                req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                req.add_header("Referer", urllib.parse.urljoin(url, "/"))
                with opener.open(req, timeout=60) as resp, open(local_path, "wb") as fh:
                    total = int(resp.headers.get("Content-Length", 0) or 0)
                    downloaded = 0
                    while True:
                        chunk = resp.read(1024 * 512)
                        if not chunk:
                            break
                        fh.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            pct = min(99, int(downloaded * 100 / total))
                            if pct - last_write[0] >= 5:
                                last_write[0] = pct
                                entry["progressPct"] = pct
                                save_json(STATUS_FILE, status)
            else:
                urllib.request.urlretrieve(url, local_path, reporthook=hook)
            entry["status"] = "uploading"
            entry["progressPct"] = 0
            save_json(STATUS_FILE, status)

            if watch_url:
                caption = f"🎬 {title}\n✅ پخش آنلاین و دانلود: {watch_url}"
            else:
                caption = f"🎬 {title}"
            await client.send_file(
                destination,
                local_path,
                caption=caption,
                supports_streaming=True,
                force_document=False,
            )
            entry["status"] = "uploaded"
            entry["progressPct"] = 100
            # Mark as sent so the chat agent's dedup skips it next run.
            try:
                state_path = os.path.join(ROOT, "data", "agent_channel_state.json")
                try:
                    with open(state_path, encoding="utf-8") as sf:
                        channel_state = json.load(sf)
                except Exception:
                    channel_state = {}
                channel_state.setdefault("filePublishedIds", {})[item_id] = (
                    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                )
                with open(state_path, "w", encoding="utf-8") as sf:
                    json.dump(channel_state, sf, ensure_ascii=False, indent=2)
            except Exception:
                pass
        except Exception as exc:  # noqa: BLE001
            entry["status"] = "failed"
            entry["error"] = str(exc)[:200]
        finally:
            try:
                if os.path.exists(local_path):
                    os.remove(local_path)
            except Exception:
                pass
            save_json(STATUS_FILE, status)

    await client.disconnect()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
