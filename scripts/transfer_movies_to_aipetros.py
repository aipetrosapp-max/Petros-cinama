import asyncio
import os
import json
import re
import sys
from telethon import TelegramClient
from telethon.errors import FloodWaitError

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SOURCE_CHANNEL_ID = -1002852905135  # لرد مووی
DEST_CHANNEL_ID = -1003885570365    # Aipetros
STATE_FILE = "transfer_state.json"

AD_KEYWORDS = [
    'بکس‌بت', 'بونوس', 'پیش‌بینی', 'ثبت‌نام', 'دلار رایگان', 'bet', 'باکس بت', 
    'واریز آنی', 'شارژ هدیه', 'کازینو', 'انفجار', 'پوکر', 'سایت معتبر', 'بازی انفجار'
]

def load_transferred():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_transferred(transferred_set):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(list(transferred_set), f)
    except Exception as e:
        print(f"⚠️ Error saving state: {e}")

def clean_caption(text: str) -> str:
    if not text:
        return ""
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        if any(ad in line for ad in AD_KEYWORDS):
            continue
        line = re.sub(r'@[a-zA-Z0-9_]{4,}', '@Aipetros', line)
        line = re.sub(r'کانال ما[^:\n]*[:\s]*@\w+', '🚀 کانال پتروس سینما: @Aipetros', line)
        cleaned_lines.append(line)
    
    result = '\n'.join(cleaned_lines).strip()
    if '@Aipetros' not in result:
        result += '\n\n🍿 پتروس سینما: @Aipetros'
    return result

async def run_full_transfer(batch_chunk_size=100):
    client = TelegramClient('petros_user_session', API_ID, API_HASH)
    await client.connect()

    source = await client.get_entity(SOURCE_CHANNEL_ID)
    dest = await client.get_entity(DEST_CHANNEL_ID)
    print(f"📡 مبدأ: {source.title} -> مقصد: {dest.title}", flush=True)

    transferred = load_transferred()
    print(f"[*] موارد قبلاً منتقل شده: {len(transferred)} عدد", flush=True)

    total_transferred_this_session = 0
    buffer = []

    print("[*] در حال اسکن کل تاریخچه کانال لرد مووی...", flush=True)

    async for msg in client.iter_messages(source):
        if msg.id in transferred:
            continue

        text = msg.text or ''
        if any(ad in text for ad in AD_KEYWORDS):
            # Mark ad as processed so we don't scan it again
            transferred.add(msg.id)
            continue

        if not msg.media and len(text) < 15:
            transferred.add(msg.id)
            continue

        buffer.append(msg)

        # When buffer reaches chunk size, transfer in chronological order
        if len(buffer) >= batch_chunk_size:
            buffer.reverse()
            for m in buffer:
                try:
                    caption = clean_caption(m.text or '')
                    if m.media:
                        await client.send_file(
                            dest,
                            m.media,
                            caption=caption,
                            supports_streaming=True
                        )
                    elif caption:
                        await client.send_message(dest, caption)

                    transferred.add(m.id)
                    save_transferred(transferred)
                    total_transferred_this_session += 1
                    print(f"  ✅ [Msg {m.id}] منتقل شد (مجموع کل جلسه: {total_transferred_this_session})", flush=True)
                    await asyncio.sleep(1.8)
                except FloodWaitError as fe:
                    print(f"  ⏳ محدودیت موقت ارسال تلگرام: {fe.seconds} ثانیه انتظار...", flush=True)
                    await asyncio.sleep(fe.seconds + 2)
                    # Retry this message
                    try:
                        if m.media:
                            await client.send_file(dest, m.media, caption=caption, supports_streaming=True)
                        elif caption:
                            await client.send_message(dest, caption)
                        transferred.add(m.id)
                        save_transferred(transferred)
                    except Exception as ex2:
                        print(f"  ⚠️ خطا در تلاش مجدد: {ex2}", flush=True)
                except Exception as ex:
                    print(f"  ❌ خطا در انتقال پیام {m.id}: {ex}", flush=True)
                    transferred.add(m.id)
                    save_transferred(transferred)
                    await asyncio.sleep(1.0)

            save_transferred(transferred)
            buffer = []

    # Process remaining
    if buffer:
        buffer.reverse()
        for m in buffer:
            try:
                caption = clean_caption(m.text or '')
                if m.media:
                    await client.send_file(dest, m.media, caption=caption, supports_streaming=True)
                elif caption:
                    await client.send_message(dest, caption)
                transferred.add(m.id)
                save_transferred(transferred)
                total_transferred_this_session += 1
                await asyncio.sleep(1.8)
            except Exception as e:
                print(f"  ❌ خطا در انتقال پیام نهایی {m.id}: {e}", flush=True)

    print(f"\n🎉 انتقال کامل تاریخچه کانال به اتمام رسید! مجموعاً {total_transferred_this_session} فایل و پست منتقل شد.", flush=True)
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(run_full_transfer(50))
