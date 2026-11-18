import asyncio
import json
import os
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SESSION_NAME = 'petros_gateway_session'
PASSWORD = 'Ped12345@'

async def submit_password():
    client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
    await client.connect()

    try:
        await client.sign_in(password=PASSWORD)
        print("2FA_LOGIN_SUCCESSFUL")
        me = await client.get_me()
        print(f"Logged in successfully as: {me.first_name} (@{me.username}) ID: {me.id}")
    except Exception as e:
        print(f"2FA_ERROR: {e}")
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(submit_password())
