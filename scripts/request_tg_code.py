import asyncio
import json
import os
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
PHONE = '+989120345231'
SESSION_NAME = 'petros_gateway_session'
AUTH_FILE = 'gateway_auth_pending.json'

async def send_code():
    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.connect()
    
    if await client.is_user_authorized():
        print("ALREADY_AUTHORIZED")
        await client.disconnect()
        return

    res = await client.send_code_request(PHONE)
    with open(AUTH_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            'phone': PHONE,
            'phone_code_hash': res.phone_code_hash
        }, f)
    print("CODE_SENT_SUCCESS")
    await client.disconnect()

if __name__ == '__main__':
    asyncio.run(send_code())
