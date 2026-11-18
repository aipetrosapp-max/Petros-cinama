import asyncio
import os
import json
import time
from datetime import datetime
from aiohttp import web
from telethon import TelegramClient

API_ID = 76997
API_HASH = '5fab41b477b0caf5a30648b86570b5b5'
SESSION_NAME = 'petros_gateway_session'
CHANNEL_ID = -1003885570365

CACHE_DIR = 'data/stream_cache'
os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_EXPIRY_SECONDS = 8 * 3600 # 8 Hours Rolling Cache

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

async def cleanup_cache_loop():
    """Background Daemon: automatically purges cached media older than 8 hours"""
    while True:
        try:
            now = time.time()
            for fname in os.listdir(CACHE_DIR):
                fpath = os.path.join(CACHE_DIR, fname)
                if os.path.isfile(fpath):
                    if now - os.path.getmtime(fpath) > CACHE_EXPIRY_SECONDS:
                        try:
                            os.remove(fpath)
                            print(f"[Cache Daemon] Expired cache purged (>8h): {fname}")
                        except Exception:
                            pass
        except Exception as e:
            print(f"[Cache Daemon Error]: {e}")
        await asyncio.sleep(600) # Check every 10 minutes

async def handle_stream(request):
    msg_id = int(request.match_info.get('msg_id', 0))
    if not msg_id:
        return web.Response(status=400, text="Invalid message ID")

    cached_file = os.path.join(CACHE_DIR, f"tg_{msg_id}.mp4")

    # If already cached and valid, stream directly with Range support
    if os.path.exists(cached_file) and os.path.getsize(cached_file) > 1024:
        return await stream_file_with_range(request, cached_file)

    # Otherwise fetch from Telegram Channel directly
    try:
        msg = await client.get_messages(CHANNEL_ID, ids=msg_id)
        if not msg or not msg.media:
            return web.Response(status=404, text="Movie file not found in Telegram channel")

        total_size = msg.file.size
        file_name = getattr(msg.file, 'name', f"movie_{msg_id}.mp4")

        # Stream directly while streaming chunks
        range_header = request.headers.get('Range')
        start = 0
        end = total_size - 1

        if range_header:
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            if len(range_match) > 1 and range_match[1]:
                end = int(range_match[1])

        length = end - start + 1
        headers = {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Range': f'bytes {start}-{end}/{total_size}',
            'Content-Length': str(length),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Range, Content-Range',
            'Cache-Control': 'public, max-age=28800' # 8 hours
        }

        response = web.StreamResponse(status=206 if range_header else 200, headers=headers)
        await response.prepare(request)

        # Stream chunked directly from Telethon
        async for chunk in client.iter_download(msg.media, offset=start, limit=length, chunk_size=256*1024):
            await response.write(chunk)

        await response.write_eof()
        return response

    except Exception as e:
        print(f"[Gateway Error Msg #{msg_id}]: {e}")
        return web.Response(status=500, text=str(e))

async def stream_file_with_range(request, file_path):
    total_size = os.path.getsize(file_path)
    range_header = request.headers.get('Range')
    start = 0
    end = total_size - 1

    if range_header:
        parts = range_header.replace('bytes=', '').split('-')
        start = int(parts[0]) if parts[0] else 0
        if len(parts) > 1 and parts[1]:
            end = int(parts[1])

    length = end - start + 1
    headers = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Range': f'bytes {start}-{end}/{total_size}',
        'Content-Length': str(length),
        'Access-Control-Allow-Origin': '*'
    }

    response = web.StreamResponse(status=206 if range_header else 200, headers=headers)
    await response.prepare(request)

    with open(file_path, 'rb') as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            chunk = f.read(min(remaining, 256*1024))
            if not chunk:
                break
            await response.write(chunk)
            remaining -= len(chunk)

    await response.write_eof()
    return response

async def init_app():
    await client.connect()
    app = web.Application()
    app.router.add_get('/stream/{msg_id}', handle_stream)
    app.router.add_options('/stream/{msg_id}', lambda r: web.Response(headers={'Access-Control-Allow-Origin': '*'}))
    asyncio.create_task(cleanup_cache_loop())
    return app

if __name__ == '__main__':
    print("🚀 Petros Real Telegram Rolling Cache Gateway starting on port 8089...")
    web.run_app(init_app(), port=8089)
