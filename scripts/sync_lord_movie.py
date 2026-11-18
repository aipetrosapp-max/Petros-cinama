"""
Direct Fast Channel Sync script using existing local petros_gateway_session.
Copies videos from newly added source channels directly to Aipetros channel and updates catalog.
"""
import asyncio
import json
import os
import re
import time
from telethon import TelegramClient
from telethon.tl.types import MessageMediaDocument, DocumentAttributeVideo

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SESSION_NAME = 'petros_gateway_session'
DEST_CHANNEL_ID = -1003885570365
SOURCE_CHANNEL_ID = -1002852905135 # لرد مووی

CATALOG_PATH = 'data/streams.json'
PUBLIC_CATALOG_PATH = 'public/data/streams.json'

def clean_title(text):
    if not text:
        return "فیلم جدید"
    line = text.split('\n')[0]
    line = re.sub(r'[*_`#]+', '', line)
    line = re.sub(r'^(🎬|📺|📼|فیلم|سریال|«|\s)+', '', line)
    line = re.sub(r'(»|\s)+$', '', line)
    return line.strip() or "فیلم جدید"

async def sync_now(limit=20):
    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.connect()
    if not await client.is_user_authorized():
        print("Telegram session unauthorized!")
        return

    source = await client.get_entity(SOURCE_CHANNEL_ID)
    dest = await client.get_entity(DEST_CHANNEL_ID)
    print(f"Syncing from: {source.title} -> {dest.title}")

    # Load existing catalog
    catalog_obj = {}
    streams_list = []
    if os.path.exists(CATALOG_PATH):
        try:
            with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
                catalog_obj = json.load(f)
                if isinstance(catalog_obj, dict):
                    streams_list = catalog_obj.get('streams', [])
                elif isinstance(catalog_obj, list):
                    streams_list = catalog_obj
        except Exception:
            streams_list = []

    new_items_count = 0
    async for msg in client.iter_messages(source, limit=limit):
        if msg.video or (msg.document and any(isinstance(x, DocumentAttributeVideo) for x in msg.document.attributes)):
            raw_text = msg.text or ""
            title_fa = clean_title(raw_text)

            # Forward / Copy to dest channel
            try:
                copied = await client.send_message(dest, f"🍿 **{title_fa}**\n\n📺 تماشای آنلاین و بدون سانسور در پتروس سینما:\n🔗 https://aipetros.xyz", file=msg.media)
                print(f"Copied to dest channel: {title_fa} (Message {copied.id})")
                
                # Add to catalog
                item_id = f"petros-stream-tg-{copied.id}"
                new_entry = {
                    "id": item_id,
                    "title": title_fa,
                    "titleFa": title_fa,
                    "category": "movie",
                    "year": 2026,
                    "playableUrl": f"https://t.me/Aipetros/{copied.id}",
                    "telegramUrl": f"https://t.me/Aipetros/{copied.id}",
                    "qualities": [
                        {
                            "id": f"q-{copied.id}",
                            "quality": "720p",
                            "url": f"https://t.me/Aipetros/{copied.id}",
                            "format": "telegram_gateway"
                        }
                    ],
                    "status": "published",
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                streams_list.insert(0, new_entry)
                new_items_count += 1
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Error copying {msg.id}: {e}")

    if isinstance(catalog_obj, dict):
        catalog_obj['streams'] = streams_list
        catalog_obj['updatedAt'] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        save_target = catalog_obj
    else:
        save_target = streams_list

    # Save catalogs
    with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(save_target, f, ensure_ascii=False, indent=2)
    os.makedirs(os.path.dirname(PUBLIC_CATALOG_PATH), exist_ok=True)
    with open(PUBLIC_CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(save_target, f, ensure_ascii=False, indent=2)
    with open('public/streams.json', 'w', encoding='utf-8') as f:
        json.dump(save_target, f, ensure_ascii=False, indent=2)

    print(f"Successfully added {new_items_count} new movies to catalog and Aipetros channel!")
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(sync_now(limit=15))
