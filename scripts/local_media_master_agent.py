"""
PETROS CINEMA — MASTER ARCHIVAL & MEDIA SANITIZER AGENT
Autonomous local agent that:
1. Detects and merges multi-quality videos into single movie entries (1080p, 720p, 480p, 360p).
2. Separates trailers from main movie cards and links them accurately to details.trailer.previewVideoUrl.
3. Fixes playableUrl / streamUrl so the main video plays immediately without error or fallback loop.
4. Auto-sanitizes titles (removes emojis, colons, prefix junk).
"""
import json
import os
import re
import time

CATALOG_PATH = 'data/streams.json'
PUBLIC_CATALOG_PATH = 'public/data/streams.json'
PUBLIC_ROOT_CATALOG = 'public/streams.json'

def clean_movie_title(text):
    if not text:
        return "فیلم بدون عنوان"
    line = text.split('\n')[0]
    line = re.sub(r'[*_`#]+', '', line)
    line = re.sub(r'^(🎬|📺|📼|فیلم|سریال|«|\s)+', '', line)
    line = re.sub(r'(»|\s)+$', '', line)
    line = re.sub(r'^(:\s*«|:\s*)', '', line)
    line = re.sub(r'(\s*«\s*|\s*»\s*)', ' ', line)
    return line.strip(' :»«-') or "فیلم بدون عنوان"

def detect_quality_from_text(text):
    t = text.lower()
    if '2160' in t or '4k' in t:
        return '4K HDR'
    if '1080' in t:
        return '1080p'
    if '720' in t:
        return '720p'
    if '480' in t:
        return '480p'
    if '360' in t:
        return '360p'
    return '1080p'

def run_agent():
    print("🤖 [Petros Local Media Agent] Starting catalog scan and auto-healing...")
    if not os.path.exists(CATALOG_PATH):
        print("❌ Catalog not found at", CATALOG_PATH)
        return

    with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    streams = data.get('streams', [])
    print(f"📊 Loaded {len(streams)} raw stream records.")

    # 1. Map of Trailes vs Movies
    trailers_map = {}
    movies_map = {}

    for s in streams:
        raw_title = (s.get('title') or s.get('titleFa') or '').strip()
        if not raw_title or raw_title.startswith('http'):
            continue

        is_trailer = 'تریلر' in raw_title or 'trailer' in raw_title.lower()
        cleaned = clean_movie_title(raw_title)

        # If it's a trailer, record its stream URL
        if is_trailer:
            trailers_map[cleaned] = s.get('playableUrl') or s.get('streamUrl') or (s.get('qualities', [{}])[0].get('url'))
            print(f"🎬 Identified Trailer: '{cleaned}' -> {trailers_map[cleaned]}")
            continue

        # Extract quality info
        detected_q = detect_quality_from_text(raw_title)
        if not detected_q and s.get('qualities'):
            detected_q = s['qualities'][0].get('quality', '1080p')

        qs = s.get('qualities') or []
        first_q_url = qs[0].get('url', '') if len(qs) > 0 and isinstance(qs[0], dict) else ''
        target_stream_url = s.get('playableUrl') or s.get('streamUrl') or first_q_url

        if cleaned not in movies_map:
            s['title'] = cleaned
            s['titleFa'] = cleaned
            s['cleaned_qualities'] = []
            movies_map[cleaned] = s

        # Add quality
        existing_qs = [q['quality'] for q in movies_map[cleaned]['cleaned_qualities']]
        if detected_q not in existing_qs and target_stream_url:
            movies_map[cleaned]['cleaned_qualities'].append({
                "id": f"q-{detected_q.lower()}",
                "quality": detected_q,
                "url": target_stream_url,
                "format": "telegram_gateway" if "t.me" in target_stream_url else "direct_mp4",
                "label": f"کیفیت {detected_q}"
            })

    # Assemble cleaned catalog
    final_streams = []
    for title, movie in movies_map.items():
        # Attach trailer if exists
        trailer_url = trailers_map.get(title)
        if trailer_url:
            movie['trailerUrl'] = trailer_url
            print(f"🔗 Linked trailer directly to movie '{title}'")

        # Set qualities properly
        if movie.get('cleaned_qualities'):
            movie['qualities'] = movie['cleaned_qualities']
            # Set primary playable URL to the highest quality (e.g. 1080p or 720p)
            movie['playableUrl'] = movie['qualities'][0]['url']
            movie['streamUrl'] = movie['qualities'][0]['url']
            movie['defaultStreamUrl'] = movie['qualities'][0]['url']

        if 'cleaned_qualities' in movie:
            del movie['cleaned_qualities']

        final_streams.append(movie)

    data['streams'] = final_streams
    data['updatedAt'] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Save to all 3 paths
    with open(CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(PUBLIC_CATALOG_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(PUBLIC_ROOT_CATALOG, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ [Petros Local Media Agent] Sanitization finished. Total movies: {len(final_streams)}")

if __name__ == '__main__':
    run_agent()
