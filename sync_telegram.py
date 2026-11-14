#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Autonomous Telegram Channel Video Synchronizer & Auto-Uploader
Runs seamlessly on GitHub Actions with zero dedicated servers.
"""

import os
import sys
import json
import asyncio
import re
import shutil
from typing import Dict, Any, List

try:
    from telethon import TelegramClient, errors
    from telethon.sessions import StringSession
    from telethon.tl.types import MessageMediaDocument, DocumentAttributeVideo, DocumentAttributeFilename
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

def clean_movie_caption(raw_caption: str) -> str:
    """
    Cleans promotional ads and channel handles while preserving movie titles,
    quality specs, synopsis, and subtitle indicators.
    """
    if not raw_caption:
        return ""

    lines = raw_caption.splitlines()
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        # Filter out promotional lines
        if re.search(r'(کانال\s*ما|عضویت|join|channel|sponsored|تبلیغات|پروکسی|proxy|t\.me/|@)', stripped, re.IGNORECASE):
            # Check if this line is purely an ad or contains a movie title too
            if len(stripped) < 45 or re.match(r'^[\s@#\w\-–—:•|]+$', stripped):
                continue
        cleaned_lines.append(line)

    result = "\n".join(cleaned_lines).strip()
    return result if result else raw_caption.strip()

def progress_callback(action: str, current: int, total: int):
    pct = (current / total) * 100 if total > 0 else 0
    curr_mb = current / (1024 * 1024)
    tot_mb = total / (1024 * 1024)
    sys.stdout.write(f"\r[{action}] {pct:.1f}% ({curr_mb:.1f} MB / {tot_mb:.1f} MB)")
    sys.stdout.flush()

async def main():
    print("=" * 65)
    print("🚀 Starting Telegram Autonomous Video Sync Agent")
    print("=" * 65)

    api_id_env = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    session_str = os.environ.get("TG_STRING_SESSION")

    if not api_id_env or not api_hash or not session_str:
        print("❌ Missing required environment variables:")
        print("   - TG_API_ID:", "SET" if api_id_env else "MISSING")
        print("   - TG_API_HASH:", "SET" if api_hash else "MISSING")
        print("   - TG_STRING_SESSION:", "SET" if session_str else "MISSING")
        print("💡 Please configure these in your GitHub Repository Secrets.")
        sys.exit(1)

    try:
        api_id = int(api_id_env.strip())
    except ValueError:
        print(f"❌ TG_API_ID must be a numeric integer, got: {api_id_env}")
        sys.exit(1)

    config = load_json(CONFIG_FILE, {})
    source_channels = config.get("source_channels", [])
    destination_channel = config.get("destination_channel")
    delay_sec = int(config.get("delay_between_uploads_sec", 7))
    max_videos_per_run = int(config.get("max_videos_per_run", 5))
    clean_caption_flag = bool(config.get("clean_caption", True))

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
        dest_entity = await client.get_entity(destination_channel)
        print(f"🎯 Target Destination Channel: {getattr(dest_entity, 'title', destination_channel)}")
    except Exception as e:
        print(f"❌ Failed to access destination channel '{destination_channel}': {e}")
        print("💡 Make sure your Telegram user account is an Administrator in the destination channel!")
        await client.disconnect()
        sys.exit(1)

    total_uploaded = 0

    for source in source_channels:
        channel_key = str(source)
        last_processed_id = state.get(channel_key, 0)
        print(f"\n📂 Checking Source Channel: {source} (Last Processed ID: {last_processed_id})")

        try:
            source_entity = await client.get_entity(source)
        except Exception as e:
            print(f"⚠️ Could not resolve source channel {source}: {e}")
            continue

        messages = []
        try:
            # Fetch messages newer than last_processed_id
            async for msg in client.iter_messages(source_entity, min_id=last_processed_id, limit=30):
                if msg.video or (msg.media and isinstance(msg.media, MessageMediaDocument) and any(isinstance(x, DocumentAttributeVideo) for x in getattr(msg.media.document, 'attributes', []))):
                    messages.append(msg)
        except Exception as e:
            print(f"⚠️ Error reading messages from {source}: {e}")
            continue

        if not messages:
            print(f"✨ No new video messages found in {source}.")
            continue

        # Process in chronological order (oldest to newest)
        messages.reverse()
        print(f"🎬 Found {len(messages)} new video(s) in {source}. Processing up to {max_videos_per_run}...")

        for msg in messages:
            if total_uploaded >= max_videos_per_run:
                print(f"⏸️ Reached max limit ({max_videos_per_run}) for this run. Remaining will sync in next run.")
                break

            msg_caption = msg.text or ""
            caption = clean_movie_caption(msg_caption) if clean_caption_flag else msg_caption

            # Extract video filename or generate fallback
            filename = f"video_{msg.id}.mp4"
            if msg.media and hasattr(msg.media, 'document'):
                for attr in msg.media.document.attributes:
                    if isinstance(attr, DocumentAttributeFilename):
                        filename = attr.file_name
                        break

            temp_filepath = os.path.join(TEMP_DIR, filename)

            print(f"\n⬇️ Downloading Post #{msg.id} ({filename})...")
            try:
                await client.download_media(
                    msg,
                    file=temp_filepath,
                    progress_callback=lambda c, t: progress_callback("Downloading", c, t)
                )
                print("\n✅ Download completed successfully.")
            except errors.FloodWaitError as fwe:
                print(f"\n⚠️ FloodWait: Telegram requested waiting {fwe.seconds} seconds...")
                await asyncio.sleep(fwe.seconds + 5)
                continue
            except Exception as e:
                print(f"\n❌ Error downloading message #{msg.id}: {e}")
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)
                continue

            # Upload to destination channel
            print(f"⬆️ Uploading to Destination Channel without forward tags...")
            try:
                await client.send_file(
                    dest_entity,
                    file=temp_filepath,
                    caption=caption,
                    supports_streaming=True,
                    progress_callback=lambda c, t: progress_callback("Uploading", c, t)
                )
                print(f"\n🎉 Successfully uploaded Post #{msg.id} to destination channel!")
                total_uploaded += 1

                # Update state immediately after each successful upload
                state[channel_key] = msg.id
                save_json(STATE_FILE, state)

            except errors.FloodWaitError as fwe:
                print(f"\n⚠️ FloodWait during upload: Sleeping {fwe.seconds} seconds...")
                await asyncio.sleep(fwe.seconds + 5)
            except Exception as e:
                print(f"\n❌ Upload failed for message #{msg.id}: {e}")
            finally:
                # Always remove temporary file from runner disk
                if os.path.exists(temp_filepath):
                    try:
                        os.remove(temp_filepath)
                        print(f"🧹 Temporary file '{filename}' removed from disk.")
                    except Exception as ce:
                        print(f"⚠️ Could not delete temp file: {ce}")

            # Polite pause between uploads
            print(f"⏳ Waiting {delay_sec}s before next operation...")
            await asyncio.sleep(delay_sec)

        # Update state for channel
        if messages:
            last_in_batch = messages[-1].id
            if last_in_batch > state.get(channel_key, 0):
                state[channel_key] = last_in_batch
                save_json(STATE_FILE, state)

    # Cleanup temp directory
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)

    await client.disconnect()
    print("\n" + "=" * 65)
    print(f"🏁 Sync run finished! Total videos uploaded: {total_uploaded}")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
