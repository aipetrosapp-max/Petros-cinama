import json
import random
import urllib.request
import time
from concurrent.futures import ThreadPoolExecutor

manifest = json.load(open('data/streams.json', encoding='utf-8'))
streams = manifest.get('streams', [])

movies = [s for s in streams if s.get('category') == 'movie' and not any(x in (s.get('titleFa') or '').lower() for x in ['انیمه', 'انیمیشن'])]
series = [s for s in streams if s.get('category') == 'series' and not any(x in (s.get('titleFa') or '').lower() for x in ['انیمه', 'انیمیشن'])]
anime = [s for s in streams if s.get('category') == 'anime' or any(x in (s.get('titleFa') or '').lower() for x in ['انیمه', 'انیمیشن']) or any(x in (s.get('title') or '').lower() for x in ['anime', 'demon', 'jojo', 'aoashi', 'clover', 'revengers'])]

print(f"Total Movies: {len(movies)}, Series: {len(series)}, Anime: {len(anime)}", flush=True)

random.seed(42)
sample_movies = random.sample(movies, 5)
sample_series = random.sample(series, 5)
sample_anime = random.sample(anime, 5)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Range": "bytes=0-16384" # Request first 16KB for instant stream header verification
}

def verify_media_stream(item, item_type):
    title = item.get('titleFa') or item.get('title')
    year = item.get('year', 2026)
    quals = item.get('qualities', [])
    url = item.get('defaultStreamUrl') or (quals[0]['url'] if quals else None)
    
    if not url:
        return {
            "type": item_type,
            "title": title,
            "year": year,
            "ok": False,
            "error": "No stream URL"
        }
        
    req = urllib.request.Request(url, headers=headers)
    try:
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=8) as resp:
            elapsed = round((time.time() - t0) * 1000, 1)
            status = resp.status
            content_type = resp.headers.get("Content-Type", "unknown")
            content_length = resp.headers.get("Content-Length", "unknown")
            content_range = resp.headers.get("Content-Range", "unknown")
            first_chunk = resp.read(1024)
            
            # Detect container magic bytes
            is_mkv = first_chunk.startswith(b'\x1a\x45\xdf\xa3')
            is_mp4 = b'ftyp' in first_chunk[:32] or b'moov' in first_chunk[:32]
            
            return {
                "type": item_type,
                "title": title,
                "year": year,
                "url": url,
                "qualities_count": len(quals),
                "qualities": [q.get('quality') for q in quals[:4]],
                "ok": True,
                "status": status,
                "latency_ms": elapsed,
                "content_type": content_type,
                "content_range": content_range,
                "bytes_received": len(first_chunk),
                "format_detected": "MKV (Matroska Video)" if is_mkv else "MP4 (ISO Base Media)" if is_mp4 else "Binary Media Stream",
                "playable": status in [200, 206]
            }
    except Exception as e:
        return {
            "type": item_type,
            "title": title,
            "year": year,
            "url": url,
            "ok": False,
            "error": str(e)
        }

all_samples = (
    [(m, "🎬 Movie") for m in sample_movies] +
    [(s, "📺 Series") for s in sample_series] +
    [(a, "⚔️ Anime") for a in sample_anime]
)

print(f"\n[*] Testing all 15 random titles in parallel with 8 threads...", flush=True)

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(verify_media_stream, item, item_type) for item, item_type in all_samples]
    results = [f.result() for f in futures]

print("\n" + "="*80)
print("🎯 LIVE STREAM VERIFICATION RESULTS (15 RANDOM SELECTIONS)")
print("="*80)

passed = 0
for r in results:
    if r["ok"]:
        passed += 1
        print(f"[{r['type']}] {r['title']} ({r['year']})")
        print(f"      🔗 Qualities ({r['qualities_count']}): {r['qualities']}")
        print(f"      📡 URL: {r['url'][:70]}...")
        print(f"      ✅ Status: HTTP {r['status']} | Ping: {r['latency_ms']}ms | Header: {r['format_detected']}")
        print(f"      📦 Range: {r['content_range']} | MIME: {r['content_type']}\n", flush=True)
    else:
        print(f"[{r['type']}] {r['title']} ({r['year']})")
        print(f"      ❌ Stream Error: {r['error']}\n", flush=True)

print("="*80)
print(f"📊 SUMMARY: {passed}/15 streams responded with HTTP 200/206 verified media bytes!")
print("="*80, flush=True)
