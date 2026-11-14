import json
import urllib.request
import re
import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

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

def process_movie_post(post_url, post_title, fa_alt_title, existing_titles, existing_urls):
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
    if not dl_matches:
        return {"status": "error", "title": title_en_clean, "reason": "No direct streams"}

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

    is_series = "series" in post_url.lower() or "سریال" in post_title or "سریال" in fa_alt_title
    category = "series" if is_series else "movie"

    # Clean Persian title
    clean_fa = fa_alt_title or post_title
    clean_fa = clean_fa.replace('بدون سانسور با زیرنویس فارسی چسبیده', '').replace('دانلود فیلم', '').replace('دانلود سریال', '').strip()

    return {
        "status": "added",
        "item": {
            "id": f"f2m-{year}-{re.sub(r'[^a-zA-Z0-9]', '', title_en_clean).lower()[:20]}",
            "title": title_en_clean,
            "titleFa": clean_fa,
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
    print(f"[*] کاتالوگ فعلی سایت پتروس سینما: {len(existing_streams)} اثر", flush=True)
    existing_titles = set(normalize_title(s.get("title", "")) for s in existing_streams if s.get("title"))
    existing_urls = set((s.get("defaultStreamUrl") or s.get("originalSource") or "").lower().strip() for s in existing_streams)

    # Categories to crawl across the site
    crawl_sections = [
        "https://www.myf2ms.top/",
        "https://www.myf2ms.top/genres/action/",
        "https://www.myf2ms.top/genres/action/page/2/",
        "https://www.myf2ms.top/genres/comedy/",
        "https://www.myf2ms.top/genres/comedy/page/2/",
        "https://www.myf2ms.top/genres/animation/",
        "https://www.myf2ms.top/genres/sci-fi/",
        "https://www.myf2ms.top/genres/horror/",
        "https://www.myf2ms.top/genres/drama/",
        "https://www.myf2ms.top/genres/thriller/",
        "https://www.myf2ms.top/genres/crime/",
        "https://www.myf2ms.top/genres/adventure/",
        "https://www.myf2ms.top/genres/mystery/",
        "https://www.myf2ms.top/genres/fantasy/",
        "https://www.myf2ms.top/series/",
        "https://www.myf2ms.top/series/page/2/"
    ]

    movie_targets = {}
    print(f"[*] در حال خزش {len(crawl_sections)} بخش و دسته‌بندی مختلف سایت مرجع...", flush=True)

    for section_url in crawl_sections:
        html = fetch_url(section_url)
        if not html:
            continue
        articles = re.findall(r'<article class="entry">([\s\S]*?)</article>', html)
        if not articles:
            articles = re.findall(r'<article[^>]*>([\s\S]*?)</article>', html)

        count_added = 0
        for art in articles:
            m = re.search(r'<a\s+href="(https?://www\.myf2ms\.top/(?:[0-9]+|series)/[^"/]+/?)"[^>]*>([\s\S]*?)</a>', art)
            if m:
                post_url = m.group(1).rstrip('/') + '/'
                post_title = re.sub(r'<[^>]+>', '', m.group(2)).strip()
                alt_m = re.search(r'alt="([^"]+)"', art)
                fa_alt = alt_m.group(1).strip() if alt_m else post_title
                if post_url not in movie_targets and len(post_title) > 2:
                    movie_targets[post_url] = (post_title, fa_alt)
                    count_added += 1

        print(f"    - {section_url} -> {count_added} عنوان جدید شناسایی شد (مجموع کل: {len(movie_targets)})", flush=True)

    total_target = len(movie_targets)
    print(f"\n[*] مجموع کل عناوین منحصر‌به‌فرد یافت شده در سایت مرجع: {total_target} اثر", flush=True)

    # Filter out items already in repo
    pending_to_scrape = []
    skipped_count = 0
    for url, (title, fa_alt) in movie_targets.items():
        en_match = re.search(r'([A-Za-z0-9\s:\-\'.]+(?:19|20)\d{2})', title)
        cand_en = en_match.group(1).strip() if en_match else title
        norm = normalize_title(cand_en)
        if norm in existing_titles or url.lower() in existing_urls:
            skipped_count += 1
        else:
            pending_to_scrape.append((url, title, fa_alt))

    print(f"[*] عناوین موجود در مخزن سایت شما (بدون تکرار و نادیده گرفته شده): {skipped_count}", flush=True)
    print(f"[*] اختلاف موجودی (عناوین کاملاً جدید که باید استخراج شوند): {len(pending_to_scrape)} اثر", flush=True)

    new_items = []
    if pending_to_scrape:
        print(f"[*] در حال استخراج موازی جزئیات و لینک‌های استریم با ۸ نخ پردازشی...", flush=True)
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(process_movie_post, url, title, fa_alt, existing_titles, existing_urls): (url, title) for url, title, fa_alt in pending_to_scrape}
            for future in as_completed(futures):
                res = future.result()
                if res["status"] == "added":
                    new_items.append(res["item"])
                    existing_titles.add(normalize_title(res["item"]["title"]))
                    print(f"  [+] اضافه شد: {res['item']['title']} ({len(res['item']['qualities'])} کیفیت استریم)", flush=True)
                elif res["status"] == "skipped":
                    skipped_count += 1

    print(f"\n==========================================", flush=True)
    print(f"[*] مجموع عناوین شناسایی شده در سایت مبدا: {total_target}", flush=True)
    print(f"[*] تکراری (از قبل در مخزن سایت شما موجود بود): {skipped_count}", flush=True)
    print(f"[*] اختلاف موجودی (عناوین جدید افزوده شده): {len(new_items)}", flush=True)
    print(f"==========================================", flush=True)

    if new_items:
        manifest["streams"] = new_items + existing_streams
        manifest["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with open(repo_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"✅ مخزن سایت با موفقیت به‌روز شد! مجموع کل فیلم‌ها و سریال‌های پتروس سینما: {len(manifest['streams'])}", flush=True)
    else:
        print("ℹ️ تمامی این عناوین از قبل در مخزن سایت موجود بودند و نیازی به تغییر مخزن نبود.", flush=True)

if __name__ == "__main__":
    main()
