#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interactive StringSession Generator for Telethon
Run this script ONCE on your local computer to generate your TG_STRING_SESSION.
"""

import sys

try:
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    print("❌ Telethon is not installed!")
    print("👉 Please run: pip install telethon cryptg")
    sys.exit(1)

def main():
    print("=" * 70)
    print("🔐 Telegram StringSession Generator (راهنمای ساخت نشست تلگرام)")
    print("=" * 70)

    # Pre-configured from your Telegram developer credentials
    default_api_id = 76997
    default_api_hash = "5fab41b477b0caf5a30648b86570b5b5"

    print(f"✅ api_id از پیش تنظیم شد: {default_api_id}")
    print(f"✅ api_hash از پیش تنظیم شد: {default_api_hash}\n")

    api_id = default_api_id
    api_hash = default_api_hash

    print("⏳ در حال اتصال به سرورهای تلگرام...")
    print("👇 لطفاً شماره موبایل خود را همراه با کد کشور وارد کنید (مثلاً: +989123456789):")
    with TelegramClient(StringSession(), api_id, api_hash) as client:
        session_string = client.session.save()
        
        # Save to local file as backup
        try:
            with open("telegram_session.txt", "w", encoding="utf-8") as f:
                f.write(session_string.strip())
        except Exception:
            pass

        print("\n" + "=" * 70)
        print("🎉 نشست شما (StringSession) با موفقیت تولید شد:")
        print("=" * 70)
        print(session_string)
        print("=" * 70)
        print("\n📁 همچنین نشست در فایل telegram_session.txt ذخیره شد.")
        print("📋 این متن طولانی را کپی کنید و در چت بفرستید تا فوراً در گیت‌هاب ست شود.\n")

if __name__ == "__main__":
    main()
