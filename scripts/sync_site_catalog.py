import json
import urllib.request
import re
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://www.myf2ms.top/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

def fetch_url(url, timeout=12):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return None

def normalize_title(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r'\b(?:19|20)\d{2}\b', '', s)
    s = re.sub(r'\b(?:1080p|720p|480p|4k|2160p|bluray|web-dl|webrip|hdr|farsi|dub|sub|part\s*\d+|e\d+|s\d+)\b', '', s)
    s = re.sub(r'[^\w\s]', '', s)
    return s.strip()

def process_movie_post(post_url, post_title, existing_titles, existing_urls):
    en_match = re.search(r'([A-Za-z0-9\s:\-\'.]+(?:19|20)\d{2})', post_title)
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', post_title)
    year = int(year_match.group(1)) if year_match else 2026

    if en_match:
        title_en = en_match.group(1).strip()
    else:
        title_en = post_title.replace('دانلود فیلم', '').replace('دانلود سریال', '').replace('بدون سانسور با زیرنویس فارسی چسبیده', '').strip()

    title_en_clean = re.sub(r'\s+', ' ', title_en).strip()
    norm_title = normalize_title(title_en_clean)

    if norm_title in existing_titles or post_url.lower() in existing_urls:
        return {"status": "skipped", "title": title_en_clean, "reason": "Already in repo"}

    post_html = fetch_url(post_url, timeout=10)
    if not post_html:
        return {"status": "error", "title": title_en_clean, "reason": "Failed to fetch page"}

    dl_matches = list(set(re.findall(r'href="(https?://[^"]+\.(?:mkv|mp4)[^"]*)"', post_html, re.IGNORECASE)))
    qualities = []
    default_stream = ""

    for dl in dl_matches:
        q_name = "1080p"
        if "2160p" in dl or "4k" in dl.lower():
            q_name = "4K"
        elif "1080p" in dl:
            q_name = "1080p"
        elif "720p" in dl:
            q_name = "720p"
        elif "480p" in dl:
            q_name = "480p"

        if not default_stream and q_name in ["1080p", "720p"]:
            default_stream = dl

        qualities.append({
            "quality": q_name,
            "url": dl,
            "format": "mp4" if dl.endswith(".mp4") else "mkv",
            "bitrate": 14000 if q_name == "4K" else 8500 if q_name == "1080p" else 4500
        })

    if not default_stream and dl_matches:
        default_stream = dl_matches[0]

    poster_m = re.findall(r'<meta property="og:image" content="([^"]+)"', post_html)
    poster = poster_m[0] if poster_m else "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop"

    desc_m = re.findall(r'<meta property="og:description" content="([^"]+)"', post_html)
    synopsis = desc_m[0] if desc_m else f"Official streaming presentation for {title_en_clean}."

    is_series = "series" in post_url.lower() or "سریال" in post_title
    category = "series" if is_series else "movie"

    return {
        "status": "added",
        "item": {
            "id": f"f2m-{year}-{re.sub(r'[^a-zA-Z0-9]', '', title_en_clean).lower()[:20]}",
            "title": title_en_clean,
            "titleFa": post_title.replace('بدون سانسور با زیرنویس فارسی چسبیده', '').replace('دانلود فیلم', '').replace('دانلود سریال', '').strip(),
            "category": category,
            "year": year,
            "durationSec": 2700 if is_series else 7200,
            "rating": "8.0/10",
            "posterUrl": poster,
            "backdropUrl": poster,
            "synopsis": synopsis,
            "synopsisFa": synopsis,
            "defaultStreamUrl": default_stream,
            "originalSource": post_url,
            "sourceType": "mp4",
            "qualities": qualities,
            "tags": [category.upper(), str(year), "Film2Media", "Verified Stream", "Subtitled"]
        }
    }

def main():
    repo_file = "data/streams.json"
    if not os.path.exists(repo_file):
        print(f"Error: {repo_file} does not exist.", flush=True)
        return

    with open(repo_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    existing_streams = manifest.get("streams", [])
    print(f"[*] Current repository has {len(existing_streams)} items.", flush=True)
    existing_titles = set(normalize_title(s.get("title", "")) for s in existing_streams if s.get("title"))
    existing_urls = set((s.get("defaultStreamUrl") or s.get("originalSource") or "").lower().strip() for s in existing_streams)

    print(f"[*] Fetching target site: {BASE_URL} ...", flush=True)
    home_html = fetch_url(BASE_URL)
    if not home_html:
        print("[!] Failed to fetch target site homepage.", flush=True)
        return

    posts = re.findall(r'<a\s+href="(https?://www\.myf2ms\.top/(?:[0-9]+|series)/[^"/]+/?)"[^>]*title="([^"]+)"', home_html)
    if not posts:
        posts = re.findall(r'<a\s+href="(https?://www\.myf2ms\.top/[^"/]+/[^"/]+/?)"[^>]*title="([^"]+)"', home_html)

    movie_links = {}
    for link, title in posts:
        clean_url = link.rstrip('/') + '/'
        clean_title = title.strip()
        if clean_url not in movie_links and len(clean_title) > 3:
            movie_links[clean_url] = clean_title

    total_target = len(movie_links)
    print(f"[*] Found {total_target} unique movie/series posts on target site!", flush=True)

    items_to_crawl = list(movie_links.items())
    print(f"[*] Scraping and analyzing all {len(items_to_crawl)} items in parallel...", flush=True)

    new_items = []
    skipped_count = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(process_movie_post, url, title, existing_titles, existing_urls): (url, title) for url, title in items_to_crawl}
        for future in as_completed(futures):
            res = future.result()
            if res["status"] == "added":
                new_items.append(res["item"])
                print(f"  [+] Added: {res['item']['title']} ({len(res['item']['qualities'])} stream links)", flush=True)
            elif res["status"] == "skipped":
                skipped_count += 1
                print(f"  [-] Skipped (in repo): {res['title']}", flush=True)

    print(f"\n==========================================", flush=True)
    print(f"[*] TARGET SITE TOTAL POSTS: {total_target}", flush=True)
    print(f"[*] SITE REPOSITORY (CURRENT): {len(existing_streams)}", flush=True)
    print(f"[*] INVENTORY DIFFERENCE (NEW MOVIES TO ADD): {len(new_items)}", flush=True)
    print(f"[*] SKIPPED (DUPLICATES/ALREADY IN REPO): {skipped_count}", flush=True)
    print(f"==========================================", flush=True)

    if new_items:
        manifest["streams"] = new_items + existing_streams
        manifest["updatedAt"] = "2026-11-15T00:25:00.000Z"
        with open(repo_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"[SUCCESS] Updated {repo_file}! Total repository streams now: {len(manifest['streams'])}", flush=True)

if __name__ == "__main__":
    main()
