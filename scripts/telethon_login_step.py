#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Petros Cinema — Telegram login helper (two-step, no interactive prompt)

Step 1:  python scripts/telethon_login_step.py start <phone>
         -> sends the login code to the phone, saves the phone_code_hash.
Step 2:  python scripts/telethon_login_step.py code <code> [password]
         -> completes the sign-in and writes telegram_session.txt.

Credentials come from the environment or the uncommitted .env.local file.
The resulting StringSession is written to telegram_session.txt (gitignored).
"""

import os
import sys
import json
import asyncio

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGIN_STATE = os.path.join(ROOT, "data", "telegram_login_state.json")
SESSION_OUT = os.path.join(ROOT, "telegram_session.txt")

# tiny uncommitted-env loader (same keys as server.ts)
try:
    with open(os.path.join(ROOT, ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
except Exception:
    pass

try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    print("Telethon is not installed! Run: pip install telethon cryptg")
    sys.exit(1)


def load_env() -> tuple[int, str]:
    api_id = os.environ.get("TG_API_ID", "").strip()
    api_hash = os.environ.get("TG_API_HASH", "").strip()
    if not api_id or not api_hash:
        print("MISSING_CREDENTIALS")
        sys.exit(1)
    return int(api_id), api_hash


async def start(phone: str) -> None:
    api_id, api_hash = load_env()
    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.connect()
    sent = await client.send_code_request(phone)
    state = {
        "phone": phone,
        "phone_code_hash": sent.phone_code_hash,
        "requestedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    with open(LOGIN_STATE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    print("CODE_SENT")
    await client.disconnect()


async def code(code: str, password: str | None) -> None:
    api_id, api_hash = load_env()
    with open(LOGIN_STATE, encoding="utf-8") as f:
        state = json.load(f)
    client = TelegramClient(StringSession(), api_id, api_hash)
    await client.connect()
    try:
        await client.sign_in(
            phone=state["phone"],
            code=code,
            phone_code_hash=state["phone_code_hash"],
            password=password or None,
        )
    except Exception as exc:  # noqa: BLE001
        name = type(exc).__name__
        if name == "SessionPasswordNeededError":
            print("PASSWORD_NEEDED")
        else:
            print(f"LOGIN_FAILED: {exc}")
        await client.disconnect()
        sys.exit(1)
    me = await client.get_me()
    session_string = client.session.save()
    await client.disconnect()
    with open(SESSION_OUT, "w", encoding="utf-8") as f:
        f.write(str(session_string))
    print(f"LOGGED_IN as {me.first_name or ''} (@{me.username or 'no-username'})")
    print("SESSION_SAVED -> telegram_session.txt")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "start" and len(sys.argv) >= 3:
        asyncio.run(start(sys.argv[2]))
    elif mode == "code" and len(sys.argv) >= 3:
        asyncio.run(code(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
    else:
        print("usage: telethon_login_step.py start <phone> | code <code> [password]")
        sys.exit(1)
