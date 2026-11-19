#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interactive StringSession Generator for Telethon
Run this script ONCE on your local computer to generate your TG_STRING_SESSION.
"""

import os
import sys

try:
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    print("❌ Telethon is not installed!")
    print("👉 Please run: pip install telethon cryptg")
    sys.exit(1)

def main():
    # Load uncommitted local credentials (.env.local) when env is not set.
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
    try:
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                if "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except Exception:
        pass

    print("=" * 70)
    print("🔐 Telegram StringSession Generator (راهنمای ساخت نشست تلگرام)")
    print("=" * 70)

    # Credentials MUST come from the environment. Never commit api_id/api_hash.
    api_id_raw = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id_raw or not api_hash:
        print("❌ TG_API_ID and TG_API_HASH must be set in the environment.")
        sys.exit(1)
    try:
        api_id = int(api_id_raw)
    except ValueError:
        print("❌ TG_API_ID must be numeric.")
        sys.exit(1)

    print("api_id and api_hash loaded from environment.")

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
