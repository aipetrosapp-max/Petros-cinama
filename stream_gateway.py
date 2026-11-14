# -*- coding: utf-8 -*-
"""
Telegram-to-HTTP High-Speed Video Streaming Gateway
Enables web browsers (Safari, Chrome, Firefox) to stream private Telegram channel videos
directly inside HTML5 <video> with byte-range seeking and zero disk caching.
"""

import os
import re
import asyncio
from aiohttp import web
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import CheckChatInviteRequest
from telethon.tl.types import InputPeerChannel

# Get configuration from env or local file
API_ID_ENV = os.environ.get("TG_API_ID", "76997")
API_HASH = os.environ.get("TG_API_HASH", "5fab41b477b0caf5a30648b86570b5b5")

SESSION_STR = os.environ.get("TG_STRING_SESSION")
if not SESSION_STR and os.path.exists("telegram_session.txt"):
    with open("telegram_session.txt", "r", encoding="utf-8") as f:
        SESSION_STR = f.read().strip()

if not SESSION_STR:
    raise ValueError("TG_STRING_SESSION is required (set env var or generate telegram_session.txt)")

API_ID = int(API_ID_ENV)
PORT = int(os.environ.get("PORT", 8765))

client = TelegramClient(StringSession(SESSION_STR), API_ID, API_HASH)

async def resolve_peer(channel_param: str):
    channel_param = channel_param.strip()
    if "t.me/+" in channel_param or channel_param.startswith("+"):
        invite_hash = channel_param.split("+")[-1].strip("/? \t\n")
        check = await client(CheckChatInviteRequest(invite_hash))
        return InputPeerChannel(check.chat.id, check.chat.access_hash)

    if channel_param.startswith("-100") or channel_param.isdigit() or (channel_param.startswith("-") and channel_param[1:].isdigit()):
        cid = int(channel_param)
        async for dialog in client.iter_dialogs():
            if dialog.id == cid or dialog.entity.id == abs(cid) or str(abs(cid)) in str(dialog.id):
                return dialog.input_entity
        return await client.get_entity(cid)

    return await client.get_entity(channel_param)

async def handle_stream(request: web.Request):
    channel_param = request.match_info["channel"]
    msg_id = int(request.match_info["msg_id"])

    try:
        entity = await resolve_peer(channel_param)
    except Exception as e:
        return web.Response(text=f"Channel resolve error: {e}", status=404)

    try:
        msg = await client.get_messages(entity, ids=msg_id)
    except Exception as e:
        return web.Response(text=f"Message fetch error: {e}", status=404)

    if not msg or not msg.media or not hasattr(msg.media, "document"):
        return web.Response(text="No video media found in message", status=404)

    file_size = msg.file.size
    mime_type = msg.file.mime_type or "video/mp4"

    range_header = request.headers.get("Range")
    start = 0
    end = file_size - 1

    status = 200
    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if m:
            start = int(m.group(1))
            if m.group(2):
                end = int(m.group(2))
            status = 206

    content_length = end - start + 1

    headers = {
        "Content-Type": mime_type,
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Range",
    }
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

    response = web.StreamResponse(status=status, headers=headers)
    await response.prepare(request)

    chunk_size = 256 * 1024
    try:
        async for chunk in client.iter_download(msg.media, offset=start, request_size=chunk_size):
            await response.write(chunk)
            start += len(chunk)
            if start > end:
                break
    except (ConnectionResetError, asyncio.CancelledError):
        pass
    except Exception as e:
        print(f"Stream chunk error: {e}")

    return response

async def handle_cors(request: web.Request):
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Range, Content-Type",
        }
    )

async def handle_health(request: web.Request):
    return web.json_response({
        "status": "online",
        "service": "Petros Cinema Telegram Stream Gateway",
        "connected": client.is_connected()
    })

async def on_startup(app):
    await client.connect()
    print("✅ Telegram Stream Gateway connected to MTProto!")

async def on_cleanup(app):
    await client.disconnect()
    print("🛑 Telegram Stream Gateway disconnected.")

def create_app():
    app = web.Application()
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    app.router.add_get("/", handle_health)
    app.router.add_options("/{channel}/{msg_id}", handle_cors)
    app.router.add_get("/{channel}/{msg_id}", handle_stream)
    return app

if __name__ == "__main__":
    print(f"🚀 Starting Telegram Stream Gateway on port {PORT}")
    web.run_app(create_app(), host="0.0.0.0", port=PORT)
