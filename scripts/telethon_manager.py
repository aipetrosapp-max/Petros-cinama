import os
import sys
import json
import asyncio
from telethon import TelegramClient
from telethon.tl.functions.messages import ImportChatInviteRequest
from telethon.tl.types import Updates

CONFIG_FILE = "config_telethon.json"

def get_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

async def check_or_login(api_id: int, api_hash: str, phone: str, code: str = None, password: str = None):
    client = TelegramClient("petros_user", api_id, api_hash)
    await client.connect()
    
    if not await client.is_user_authorized():
        if not code:
            # Request phone code
            sent = await client.send_code_request(phone)
            save_config({
                "api_id": api_id,
                "api_hash": api_hash,
                "phone": phone,
                "phone_code_hash": sent.phone_code_hash
            })
            print("CODE_REQUESTED")
            await client.disconnect()
            return {"status": "code_needed"}
        else:
            # Sign in with code
            cfg = get_config()
            phone_code_hash = cfg.get("phone_code_hash")
            try:
                await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
            except Exception as e:
                if "Two-steps verification is enabled" in str(e) or "SessionPasswordNeededError" in str(e):
                    if password:
                        await client.sign_in(password=password)
                    else:
                        print("PASSWORD_NEEDED")
                        await client.disconnect()
                        return {"status": "password_needed"}
                else:
                    raise e
                    
    me = await client.get_me()
    print(f"AUTHORIZED: {me.first_name} (@{me.username})")
    await client.disconnect()
    return {"status": "authorized", "user": me.first_name}

if __name__ == "__main__":
    print("Telethon Module Ready.")
