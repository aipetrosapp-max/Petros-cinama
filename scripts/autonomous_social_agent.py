import asyncio
import json
import os
import random
import time
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SESSION_NAME = 'petros_gateway_session'
CHANNEL_ID = -1003885570365 # @Aipetros

VIRAL_PROMOS = [
    """🍿 **فیلم سینمایی جدید رسید!**
بدون سانسور، با کیفیت خارق‌العاده 4K و صدای سه‌بعدی 🎧
بدون نیاز به خرید اشتراک یا پرداخت حتی یک ریال!

🎬 تماشای آنلاین فوری در مرورگر یا تلویزیون:
👉 https://aipetros.xyz

«بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!»
#پتروس_سینما #فیلم_رایگان #سینما""",

    """⚡️ **دیگه پول اشتراک فیلم و سریال نده!**
«پتروس سینما» اولین سامانه استریم کاملاً رایگان بدون تبلیغات آزاردهنده:
• ۴۱۹ فیلم برتر تاریخ سینما
• کیفیت 4K HDR واقعی
• زیرنویس و پخش آنی بدون معطلی

🌐 همین حالا امتحان کن:
👉 https://aipetros.xyz

«بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!»""",

    """🔥 **سینمای اختصاصی در جیب شما!**
پخش روان و مستقیم با حجم مصرفی بهینه و بالاترین رزولوشن.

🎬 ورود رایگان به تالار سینما:
👉 https://aipetros.xyz

«بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!»"""
]

async def auto_post_loop():
    print("[Autonomous Marketing AI Agent] Starting automated social publisher...")
    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.connect()
    
    if not await client.is_user_authorized():
        print("[Autonomous Marketing AI Agent] Error: Telethon not authorized.")
        return

    print("[Autonomous Marketing AI Agent] Authorized. Running distribution engine...")
    post_idx = 0
    while True:
        try:
            promo = VIRAL_PROMOS[post_idx % len(VIRAL_PROMOS)]
            post_idx += 1
            
            # Post directly to Aipetros channel
            msg = await client.send_message(CHANNEL_ID, promo)
            print(f"[{time.strftime('%H:%M:%S')}] Published viral promo #{msg.id} to @Aipetros")
            
            # Sleep 1 to 2 hours between channel announcements to keep channel organic and avoid spam
            await asyncio.sleep(3600)
        except Exception as e:
            print(f"[Autonomous Marketing AI Agent Error]: {e}")
            await asyncio.sleep(300)

if __name__ == '__main__':
    asyncio.run(auto_post_loop())
