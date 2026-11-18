import asyncio
import json
import os
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SESSION_NAME = 'petros_gateway_session'
AUTH_FILE = 'gateway_auth_pending.json'
CODE = '90617'

async def complete_login():
    if not os.path.exists(AUTH_FILE):
        print("NO_PENDING_AUTH_FILE")
        return

    with open(AUTH_FILE, 'r', encoding='utf-8') as f:
        auth_data = json.load(f)

    phone = auth_data['phone']
    phone_code_hash = auth_data['phone_code_hash']

    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.connect()

    try:
        await client.sign_in(phone=phone, code=CODE, phone_code_hash=phone_code_hash)
        print("LOGIN_SUCCESSFUL")
        me = await client.get_me()
        print(f"Logged in as: {me.first_name} (@{me.username}) ID: {me.id}")
    except Exception as e:
        print(f"LOGIN_ERROR: {e}")
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(complete_login())
