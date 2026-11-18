import asyncio
import os
import json
import re
from telethon import TelegramClient

API_ID = int(os.environ.get("TG_API_ID", "0"))
API_HASH = os.environ.get("TG_API_HASH", "")
SOURCE_CHANNEL_ID = -1002852905135  # لرد مووی

async def extract_movies_from_channel(limit=100):
    client = TelegramClient('petros_user_session', API_ID, API_HASH)
    await client.connect()

    channel = await client.get_entity(SOURCE_CHANNEL_ID)
    print(f"📡 متصل به کانال مبدأ: {channel.title}")

    extracted = []
    ad_keywords = ['بکس‌بت', 'بونوس', 'پیش‌بینی', 'ثبت‌نام', 'دلار رایگان']

    async for msg in client.iter_messages(channel, limit=limit):
        text = msg.text or ''
        # Filter out spam/ads
        if any(ad in text for ad in ad_keywords):
            continue

        if not msg.media and len(text) < 15:
            continue

        file_name = (getattr(msg.file, 'name', '') or '') if msg.file else ''
        size_bytes = (getattr(msg.file, 'size', 0) or 0) if msg.file else 0

        # Parse title and quality
        title_fa = ""
        title_en = ""
        year = None
        quality = "720p"

        # Quality detection
        if '1080' in (file_name + text):
            quality = '1080p'
        elif '720' in (file_name + text):
            quality = '720p'
        elif '480' in (file_name + text):
            quality = '480p'

        # Year detection
        m_year = re.search(r'\b(19\d{2}|20\d{2})\b', file_name + ' ' + text)
        if m_year:
            year = int(m_year.group(1))

        # Title detection from Persian patterns
        m_fa = re.search(r'(?:فیلم|سریال|انیمیشن)\s*[«: ]\s*([^»\n\r]+)', text)
        if m_fa:
            title_fa = m_fa.group(1).strip()

        # Title detection from English file name
        if file_name:
            clean_fn = re.sub(r'\.(1080p|720p|480p|WEBRip|BluRay|WEB-DL|x264|x265|Dubbed|SoftSub|HardSub|mp4|mkv).*$', '', file_name, flags=re.I)
            clean_fn = clean_fn.replace('.', ' ').strip()
            title_en = clean_fn

        if not title_fa and not title_en:
            continue

        extracted.append({
            "message_id": msg.id,
            "title": title_en or title_fa,
            "titleFa": title_fa or title_en,
            "year": year or 2026,
            "quality": quality,
            "file_name": file_name,
            "file_size": size_bytes,
            "has_media": bool(msg.media),
            "text": text[:200]
        })

    print(f"✅ تعداد {len(extracted)} فیلم و قسمت معتبر (بدون تبلیغات) از کانال لرد مووی استخراج شد.")
    await client.disconnect()
    return extracted

if __name__ == '__main__':
    res = asyncio.run(extract_movies_from_channel(50))
    print(json.dumps(res[:5], ensure_ascii=False, indent=2))
