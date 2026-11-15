import asyncio
import os
import json
import re
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
AIPETROS_CHANNEL_ID = -1003885570365
STREAMS_FILE = "data/streams.json"

def clean_title(raw: str) -> str:
    if not raw:
        return ""
    t = re.sub(r'[*_`~#«»]+', '', raw)
    t = re.sub(r'\b(19\d{2}|20\d{2})\b', '', t)
    t = re.sub(r'\b(1080p|720p|480p|360p|mkv|mp4|bluray|web-dl|duble|farsi|dubbed|softsub|hardsub)\b', '', t, flags=re.I)
    return t.strip()

async def sync_channel():
    client = TelegramClient('petros_user_session', API_ID, API_HASH)
    await client.connect()

    channel = await client.get_entity(AIPETROS_CHANNEL_ID)
    print(f"📡 در حال اسکن کانال {channel.title} ({AIPETROS_CHANNEL_ID})...", flush=True)

    items_map = {}
    total_scanned = 0

    async for msg in client.iter_messages(channel, limit=1000):
        total_scanned += 1
        text = msg.text or ''
        file_name = (getattr(msg.file, 'name', '') or '') if msg.file else ''

        # Detect year
        year_match = re.search(r'\b(19\d{2}|20\d{2})\b', text + ' ' + file_name)
        year = int(year_match.group(1)) if year_match else 2026

        # Detect quality
        quality = "720p"
        if "1080" in text or "1080" in file_name:
            quality = "1080p"
        elif "480" in text or "480" in file_name:
            quality = "480p"
        elif "360" in text or "360" in file_name:
            quality = "360p"
        elif "720" in text or "720" in file_name:
            quality = "720p"

        # Detect category
        category = "movie"
        if "سریال" in text or "series" in text.lower() or "قسمت" in text or "S0" in file_name or "E0" in file_name:
            category = "series"
        elif "انیمه" in text or "انیمیشن" in text or "anime" in text.lower():
            category = "anime"

        # Extract title
        title_fa = ""
        title_en = ""

        # Pattern: 📺 عنوان فارسی 🎬 Title English 2026
        dual_match = re.search(r'📺\s*([^🎬\n]+)\s*🎬\s*([^\n\r(]+)', text)
        if dual_match:
            title_fa = clean_title(dual_match.group(1))
            title_en = clean_title(dual_match.group(2))
        else:
            # Pattern: 🎬 فیلم : عنوان  🎬 Title English
            fa_match = re.search(r'(?:فیلم|سریال|انیمیشن)\s*[:« ]\s*([^🎬»\n\r]+)', text)
            if fa_match:
                title_fa = clean_title(fa_match.group(1))

            en_match = re.search(r'([A-Za-z0-9\s:_-]{3,40})\s*(?:19|20)\d{2}', text + ' ' + file_name)
            if en_match:
                title_en = clean_title(en_match.group(1))

        if not title_fa and not title_en:
            if file_name:
                clean_fn = re.sub(r'\.(1080p|720p|480p|WEBRip|BluRay|WEB-DL|x264|x265|mp4|mkv).*$', '', file_name, flags=re.I)
                title_en = clean_fn.replace('.', ' ').strip()
                title_fa = title_en

        if not title_fa and not title_en:
            continue

        primary_title = title_fa or title_en
        key = re.sub(r'[^a-zA-Z0-9\u0600-\u06FF]', '', primary_title).lower()
        if len(key) < 2:
            continue

        # Extract rating
        rating = "7.5"
        rate_m = re.search(r'امتیاز\s*[:\s]*([0-9.]+)', text)
        if rate_m:
            rating = rate_m.group(1)

        # Extract synopsis
        synopsis = ""
        syn_m = re.search(r'(?:خلاصه|داستان)[^:\n]*[:\s]*([^\n\r]+)', text)
        if syn_m:
            synopsis = syn_m.group(1).strip()

        # Link to message
        post_url = f"https://t.me/Aipetros/{msg.id}"

        if key not in items_map:
            items_map[key] = {
                "id": f"tg-aipetros-{msg.id}",
                "title": title_en or title_fa,
                "titleFa": title_fa or title_en,
                "year": year,
                "category": category,
                "rating": rating,
                "synopsisFa": synopsis or f"پخش و دانلود اختصاصی فیلم {title_fa or title_en} با کیفیت‌های مختلف در کانال پتروس سینما.",
                "synopsis": f"Stream and download {title_en or title_fa} from Aipetros Cinema.",
                "poster": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop",
                "defaultStreamUrl": post_url,
                "sourceType": "telegram",
                "telegramPostId": msg.id,
                "telegramUrl": post_url,
                "qualities": []
            }

        # Add quality if it has media
        if msg.media:
            # Check if this quality already added
            existing_quals = [q["quality"] for q in items_map[key]["qualities"]]
            if quality not in existing_quals:
                items_map[key]["qualities"].append({
                    "quality": quality,
                    "url": post_url,
                    "format": "mkv" if "mkv" in file_name.lower() else "mp4",
                    "bitrate": 8500 if quality == "1080p" else 4500 if quality == "720p" else 2000
                })

    print(f"✅ تعداد {len(items_map)} عنوان اختصاصی از کانال Aipetros استخراج شد.")

    # Sort qualities
    for item in items_map.values():
        item["qualities"].sort(key=lambda q: 0 if q["quality"] == "1080p" else 1 if q["quality"] == "720p" else 2)

    # Load existing manifest
    manifest = {}
    if os.path.exists(STREAMS_FILE):
        try:
            with open(STREAMS_FILE, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            manifest = {}

    existing_streams = manifest.get("streams", [])
    print(f"[*] موارد قبلی در streams.json: {len(existing_streams)}")

    # Merge new items
    existing_ids = {s.get("id") for s in existing_streams}
    new_added = 0
    for item in items_map.values():
        if item["id"] not in existing_ids:
            existing_streams.insert(0, item)  # Add Telegram items to the top!
            existing_ids.add(item["id"])
            new_added += 1

    manifest["streams"] = existing_streams
    manifest["totalStreams"] = len(existing_streams)
    manifest["lastSync"] = "2026-11-15T04:55:00.000Z"
    manifest["telegramChannel"] = "Aipetros"

    with open(STREAMS_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"🎉 تعداد {new_added} عنوان فیلم و سریال از کانال تلگرام به مخزن streams.json اضافه شد!")
    print(f"[*] مجموع فیلم‌ها در سایت هم‌اکنون: {len(existing_streams)}")

    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(sync_channel())
