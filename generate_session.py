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
    print("برای دریافت api_id و api_hash:")
    print("1. به آدرس https://my.telegram.org بروید.")
    print("2. با شماره خود وارد شوید و به بخش 'API development tools' بروید.")
    print("3. مقادیر api_id و api_hash را کپی کنید.\n")

    api_id_input = input("👉 لطفاً api_id عددی خود را وارد کنید: ").strip()
    api_hash_input = input("👉 لطفاً api_hash خود را وارد کنید: ").strip()

    if not api_id_input.isdigit():
        print("❌ مقدار api_id باید صرفاً عدد باشد!")
        return

    api_id = int(api_id_input)
    api_hash = api_hash_input

    print("\n⏳ در حال اتصال به سرورهای تلگرام...")
    with TelegramClient(StringSession(), api_id, api_hash) as client:
        session_string = client.session.save()
        print("\n" + "=" * 70)
        print("🎉 نشست شما (StringSession) با موفقیت تولید شد:")
        print("=" * 70)
        print(session_string)
        print("=" * 70)
        print("\n📋 این متن طولانی بالا را کاملاً کپی کنید.")
        print("سپس در گیت‌هاب به مسیر زیر بروید:")
        print("Settings -> Secrets and variables -> Actions -> New repository secret")
        print("و به عنوان secret با نام TG_STRING_SESSION ذخیره کنید.\n")

if __name__ == "__main__":
    main()
