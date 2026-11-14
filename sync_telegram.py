#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Autonomous Telegram Channel Video Synchronizer & Auto-Uploader
Features:
- Instant Server-Side Copy (0.4s per video without downloading/uploading)
- Automatic IMDb Metadata Integration (Title, Year, Stars, IMDb link)
- Clean Perso-English Captions with Petros Cinema streaming link
- Infinite Archival & Scheduled Syncing on GitHub Actions
"""

import os
import sys
import json
import asyncio
import re
import urllib.request
import urllib.parse
import shutil
from typing import Dict, Any, List, Optional

try:
    from telethon import TelegramClient, errors
    from telethon.sessions import StringSession
    from telethon.tl.types import (
        MessageMediaDocument,
        DocumentAttributeVideo,
        DocumentAttributeFilename,
        InputPeerChannel
    )
    from telethon.tl.functions.messages import ImportChatInviteRequest, CheckChatInviteRequest
except ImportError:
    print("❌ Telethon is not installed! Run: pip install telethon cryptg")
    sys.exit(1)

CONFIG_FILE = "config.json"
STATE_FILE = "state.json"
TEMP_DIR = "temp_telegram_downloads"

def load_json(filepath: str, default: Any) -> Any:
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Failed to parse {filepath}: {e}")
    return default

def save_json(filepath: str, data: Any) -> None:
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Error saving {filepath}: {e}")

def fetch_imdb_info(query: str) -> Optional[Dict[str, Any]]:
    """Query free IMDb suggestion endpoint for metadata and actors"""
    if not query:
        return None
    try:
        q = urllib.parse.quote(query.strip())
        url = f"https://v3.sg.media-imdb.com/suggestion/x/{q}.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=4) as r:
            data = json.loads(r.read().decode('utf-8'))
            results = data.get('d', [])
            if results:
                first = results[0]
                return {
                    'title': first.get('l'),
                    'year': first.get('y'),
                    'actors': first.get('s'),
                    'imdb_id': first.get('id')
                }
    except Exception:
        pass
    return None

def build_enriched_caption(raw_text: str, web_url: str = "https://aipetrosapp-max.github.io/Petros-cinama/") -> str:
    """
    Parses original caption, extracts specs, queries IMDb, and creates
    a clean professional Telegram cinema post.
    """
    persian_title = None
    quality = None
    audio = None

    for line in raw_text.splitlines():
        l_str = line.strip()
        if re.search(r'1080p', l_str, re.IGNORECASE):
            quality = '1080p Full HD'
        elif re.search(r'720p', l_str, re.IGNORECASE):
            quality = '720p HD'
        elif re.search(r'480p', l_str, re.IGNORECASE):
            quality = '480p SD'
        elif re.search(r'4k|2160p', l_str, re.IGNORECASE):
            quality = '4K Ultra HD'

        if 'دوبله' in l_str:
            audio = 'دوبله فارسی'
        elif 'زیرنویس' in l_str:
            audio = 'زیرنویس چسبیده فارسی'

        if not persian_title and re.search(r'[\u0600-\u06FF]', l_str):
            clean = re.sub(r'^[^\w\u0600-\u06FF]+', '', l_str)
            clean = re.sub(r'[*_~`]+', '', clean).strip()
            if not any(k in clean for k in ['زیرنویس', 'کیفیت', 'کانال', 'صوت', 'دانلود', 'فایل', 'لینک']):
                if len(clean) > 2:
                    persian_title = clean

    # Detect English title & Year
    m = re.search(r'([A-Za-z0-9\s:\-\.\']+?)\s*\(?((?:19|20)\d{2})\)?', raw_text)
    eng_title = None
    imdb_id = None
    actors = None
    year = None

    if m:
        t_clean = m.group(1).strip(' -:•\t\n')
        year = m.group(2)
        imdb_res = fetch_imdb_info(f"{t_clean} {year}")
        if imdb_res:
            eng_title = imdb_res.get('title')
            year = imdb_res.get('year') or year
            actors = imdb_res.get('actors')
            imdb_id = imdb_res.get('imdb_id')
        else:
            eng_title = t_clean

    lines = []
    main_name = persian_title or eng_title or "فیلم سینمایی"
    header = f"🎬 **{main_name}**"
    if eng_title and persian_title and eng_title.lower() not in persian_title.lower():
        header += f" | **{eng_title}**"
    if year:
        header += f" `({year})`"
    lines.append(header)
    lines.append("")

    if imdb_id:
        lines.append(f"⭐️ **IMDb:** https://www.imdb.com/title/{imdb_id}/")
    if actors:
        lines.append(f"🎭 **بازیگران:** {actors}")
    if quality or audio:
        specs = []
        if quality:
            specs.append(f"📥 **کیفیت:** {quality}")
        if audio:
            specs.append(f"🔊 **صوت/زیرنویس:** {audio}")
        lines.append(" | ".join(specs))

    lines.append("")
    lines.append("🍿 **تماشای آنلاین و بدون فیلتر در پتروس سینما:**")
    lines.append(f"🌐 {web_url}")

    return "\n".join(lines)

def progress_callback(action: str, current: int, total: int):
    pct = (current / total) * 100 if total > 0 else 0
    curr_mb = current / (1024 * 1024)
    tot_mb = total / (1024 * 1024)
    sys.stdout.write(f"\r[{action}] {pct:.1f}% ({curr_mb:.1f} MB / {tot_mb:.1f} MB)")
    sys.stdout.flush()

async def resolve_target(client: TelegramClient, identifier: Any):
    """
    Robustly resolves a target peer from:
    - Invite link (e.g. 'https://t.me/+fAEG65IvvM05MDY0' or '+fAEG65IvvM05MDY0')
    - Channel username ('@THEFILMO041')
    - Numerical ID (-1003885570365, 3885570365, etc.)
    - In-memory dialogs cache search
    """
    if isinstance(identifier, str):
        identifier = identifier.strip()
        if "t.me/+" in identifier or "joinchat/" in identifier or identifier.startswith("+"):
            invite_hash = identifier.split("+")[-1] if "+" in identifier else identifier.split("joinchat/")[-1]
            invite_hash = invite_hash.strip("/? \t\n")
            try:
                check = await client(CheckChatInviteRequest(invite_hash))
                if getattr(check, "chat", None):
                    return InputPeerChannel(check.chat.id, check.chat.access_hash)
            except Exception:
                pass
            try:
                imported = await client(ImportChatInviteRequest(invite_hash))
                if imported.chats:
                    return InputPeerChannel(imported.chats[0].id, imported.chats[0].access_hash)
            except Exception:
                pass

        if identifier.startswith("-100") or identifier.lstrip("-").isdigit():
            try:
                identifier = int(identifier)
            except ValueError:
                pass

    try:
        return await client.get_entity(identifier)
    except Exception:
        pass

    async for dialog in client.iter_dialogs():
        if isinstance(identifier, int):
            if dialog.id == identifier or dialog.entity.id == abs(identifier) or str(abs(identifier)) in str(dialog.id):
                return dialog.input_entity
        elif isinstance(identifier, str):
            clean_str = identifier.lstrip("@").lower()
            d_user = (dialog.username or "").lower()
            if d_user == clean_str or dialog.name == identifier:
                return dialog.input_entity

    return await client.get_entity(identifier)

async def main():
    print("=" * 65)
    print("🚀 Starting Telegram Autonomous Video Sync & Archival Engine")
    print("⚡ Mode: Instant Server-Side Copy + IMDb Metadata Auto-Enrichment")
    print("=" * 65)

    api_id_env = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    session_str = os.environ.get("TG_STRING_SESSION")

    if not api_id_env or not api_hash or not session_str:
        print("❌ Missing required environment variables (TG_API_ID, TG_API_HASH, TG_STRING_SESSION)")
        sys.exit(1)

    try:
        api_id = int(api_id_env.strip())
    except ValueError:
        print(f"❌ TG_API_ID must be a numeric integer, got: {api_id_env}")
        sys.exit(1)

    config = load_json(CONFIG_FILE, {})
    source_channels = config.get("source_channels", [])
    destination_channel = config.get("destination_channel")
    delay_sec = int(config.get("delay_between_uploads_sec", 2))
    max_videos_per_run = int(config.get("max_videos_per_run", 20))
    enrich_imdb_flag = bool(config.get("enrich_with_imdb", True))
    use_server_side_copy = bool(config.get("server_side_copy", True))

    if not destination_channel:
        print("❌ No destination_channel configured in config.json!")
        sys.exit(1)

    if not source_channels:
        print("⚠️ No source_channels configured in config.json. Nothing to sync.")
        sys.exit(0)

    state: Dict[str, int] = load_json(STATE_FILE, {})
    os.makedirs(TEMP_DIR, exist_ok=True)

    client = TelegramClient(StringSession(session_str.strip()), api_id, api_hash.strip())

    try:
        await client.start()
    except Exception as e:
        print(f"❌ Telegram authentication failed: {e}")
        sys.exit(1)

    me = await client.get_me()
    print(f"✅ Connected to Telegram as: {me.first_name} (@{me.username or me.id})")

    # Resolve destination entity
    try:
        dest_entity = await resolve_target(client, destination_channel)
        dest_title = getattr(dest_entity, "title", str(destination_channel))
        print(f"🎯 Target Destination Channel: {dest_title}")
    except Exception as e:
        print(f"❌ Failed to access destination channel '{destination_channel}': {e}")
        print("💡 Make sure your Telegram user account is an Administrator in the destination channel!")
        await client.disconnect()
        sys.exit(1)

    total_synced = 0

    for source in source_channels:
        channel_key = str(source)
        last_processed_id = state.get(channel_key, 0)
        print(f"\n📂 Checking Source Channel: {source} (Last Processed ID: {last_processed_id})")

        try:
            source_entity = await resolve_target(client, source)
        except Exception as e:
            print(f"⚠️ Could not resolve source channel {source}: {e}")
            continue

        messages = []
        try:
            # Fetch messages newer than last_processed_id
            async for msg in client.iter_messages(source_entity, min_id=last_processed_id, limit=max_videos_per_run * 2):
                if msg.video or (msg.media and isinstance(msg.media, MessageMediaDocument) and any(isinstance(x, DocumentAttributeVideo) for x in getattr(msg.media.document, 'attributes', []))):
                    messages.append(msg)
        except Exception as e:
            print(f"⚠️ Error reading messages from {source}: {e}")
            continue

        if not messages:
            print(f"✨ No new video messages found in {source}.")
            continue

        # Oldest to newest
        messages.reverse()
        print(f"🎬 Found {len(messages)} new video(s) in {source}. Processing up to {max_videos_per_run}...")

        for msg in messages:
            if total_synced >= max_videos_per_run:
                print(f"⏸️ Reached batch limit ({max_videos_per_run}) for this run. Next run will continue.")
                break

            msg_caption = msg.text or ""
            caption = build_enriched_caption(msg_caption) if enrich_imdb_flag else msg_caption

            print(f"\n⚡ Processing Post #{msg.id}...")
            synced = False

            # Strategy 1: Instant Server-Side Copy (0.4s, zero disk/bandwidth)
            if use_server_side_copy and msg.media:
                try:
                    await client.send_message(
                        dest_entity,
                        message=caption,
                        file=msg.media
                    )
                    print(f"🎉 [Server-Side Clone] Successfully copied Post #{msg.id} to destination in ~0.5s!")
                    synced = True
                except errors.FloodWaitError as fwe:
                    print(f"⚠️ FloodWait: Telegram asked to wait {fwe.seconds}s...")
                    await asyncio.sleep(fwe.seconds + 5)
                except Exception as e:
                    print(f"⚠️ Server-side copy fell back due to: {e}. Falling back to disk method...")

            # Strategy 2: Fallback to Download and Upload
            if not synced:
                filename = f"video_{msg.id}.mp4"
                if msg.media and hasattr(msg.media, 'document'):
                    for attr in msg.media.document.attributes:
                        if isinstance(attr, DocumentAttributeFilename):
                            filename = attr.file_name
                            break
                temp_filepath = os.path.join(TEMP_DIR, filename)

                try:
                    print(f"⬇️ Downloading Post #{msg.id} ({filename})...")
                    await client.download_media(
                        msg,
                        file=temp_filepath,
                        progress_callback=lambda c, t: progress_callback("Downloading", c, t)
                    )
                    print("\n⬆️ Uploading to destination...")
                    await client.send_file(
                        dest_entity,
                        file=temp_filepath,
                        caption=caption,
                        supports_streaming=True,
                        progress_callback=lambda c, t: progress_callback("Uploading", c, t)
                    )
                    print(f"\n🎉 Successfully uploaded Post #{msg.id} via disk!")
                    synced = True
                except errors.FloodWaitError as fwe:
                    print(f"⚠️ FloodWait during upload: Sleeping {fwe.seconds}s...")
                    await asyncio.sleep(fwe.seconds + 5)
                except Exception as e:
                    print(f"❌ Upload failed for message #{msg.id}: {e}")
                finally:
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)

            if synced:
                total_synced += 1
                state[channel_key] = msg.id
                save_json(STATE_FILE, state)

            # Polite anti-flood delay
            await asyncio.sleep(delay_sec)

    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)

    await client.disconnect()
    print("\n" + "=" * 65)
    print(f"🏁 Engine Finished! Total videos successfully synced: {total_synced}")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
