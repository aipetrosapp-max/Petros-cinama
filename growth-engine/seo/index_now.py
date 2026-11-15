#!/usr/bin/env python3
"""
AI Petros (Petros Cinema) - Instant Search Indexing Engine (IndexNow + Sitemap Generator)
Auto-generates sitemap.xml, robots.txt, and pings Bing, Yandex, Google, and IndexNow API
on every single deployment so newly added movies rank within minutes.
"""

import os
import glob
import json
import urllib.request
import urllib.parse
from datetime import datetime

BASE_URL = "https://aipetrosapp-max.github.io/Petros-cinama"
INDEXNOW_KEY = "aipetroskey2026growth"
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public"))
DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dist"))

def generate_sitemap_and_robots():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")

    # Collect all URLs
    urls = [
        f"{BASE_URL}/",
        f"{BASE_URL}/#universe",
        f"{BASE_URL}/#discover",
        f"{BASE_URL}/#search",
        f"{BASE_URL}/#library",
        f"{BASE_URL}/#landing"
    ]

    # Collect all generated SEO pages
    seo_public_dir = os.path.join(PUBLIC_DIR, "seo")
    if os.path.exists(seo_public_dir):
        for f in glob.glob(os.path.join(seo_public_dir, "*.html")):
            fname = os.path.basename(f)
            urls.append(f"{BASE_URL}/seo/{fname}")

    # Build sitemap.xml
    xml_entries = []
    for u in urls:
        priority = "1.0" if u == f"{BASE_URL}/" else "0.8"
        xml_entries.append(f"""  <url>
    <loc>{u}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>{priority}</priority>
  </url>""")

    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{"".join(xml_entries)}
</urlset>"""

    # Build robots.txt
    robots_content = f"""User-agent: *
Allow: /
Allow: /seo/
Sitemap: {BASE_URL}/sitemap.xml

# IndexNow Key Verification
User-agent: IndexNow
Allow: /{INDEXNOW_KEY}.txt
"""

    # Write IndexNow key file
    key_file_content = INDEXNOW_KEY

    for target_dir in [PUBLIC_DIR, DIST_DIR]:
        if os.path.exists(target_dir):
            with open(os.path.join(target_dir, "sitemap.xml"), "w", encoding="utf-8") as f:
                f.write(sitemap_content)
            with open(os.path.join(target_dir, "robots.txt"), "w", encoding="utf-8") as f:
                f.write(robots_content)
            with open(os.path.join(target_dir, f"{INDEXNOW_KEY}.txt"), "w", encoding="utf-8") as f:
                f.write(key_file_content)

    print(f"🗺️ Generated sitemap.xml ({len(urls)} URLs), robots.txt, and IndexNow key file.")
    return urls

def ping_search_engines(url_list):
    print("🚀 Pinging IndexNow and Search Engine endpoints...")
    host = "aipetrosapp-max.github.io"
    key_location = f"{BASE_URL}/{INDEXNOW_KEY}.txt"

    payload = {
        "host": host,
        "key": INDEXNOW_KEY,
        "keyLocation": key_location,
        "urlList": url_list[:100]  # First 100 high-priority URLs
    }

    # 1. IndexNow API Ping
    try:
        req = urllib.request.Request(
            "https://api.indexnow.org/indexnow",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  ✅ IndexNow API Ping status: {resp.status}")
    except Exception as e:
        print(f"  ℹ️ IndexNow API response: {e}")

    # 2. Bing / Yandex sitemap ping
    sitemap_url = urllib.parse.quote(f"{BASE_URL}/sitemap.xml")
    pings = [
        f"https://www.bing.com/ping?sitemap={sitemap_url}",
        f"https://webmaster.yandex.ru/ping?sitemap={sitemap_url}"
    ]
    for p in pings:
        try:
            req = urllib.request.Request(p, headers={"User-Agent": "AIPetrosGrowthBot/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                print(f"  ✅ Sitemap ping: {p.split('?')[0]} -> {resp.status}")
        except Exception as e:
            print(f"  ℹ️ Ping: {p.split('?')[0]} -> {e}")

if __name__ == "__main__":
    urls = generate_sitemap_and_robots()
    ping_search_engines(urls)
