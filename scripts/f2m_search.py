"""
Petros Cinema — Film2Media search (admin "filmyar-style" source finder).

Searches the Film2Media portal (f2mc.top) the same way the open-source
filmyar project does and returns structured entries.

Usage: python f2m_search.py "<query>"
Output: JSON to stdout: {"ok":true,"entries":[{title, year, isSeries, link}]}
"""
import sys
import json
import re
import urllib.request
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def parse_entry(raw_title: str, entry_html: str) -> dict:
    clean = re.sub(r"<[^>]+>", "", raw_title).strip()
    is_series = bool(re.search(r"سریال|مجموعه|فصل", clean, re.I))
    cal = re.search(r"icon-calendar[\s\S]*?</svg>\s*(\d{4})", entry_html, re.I)
    tmatch = re.search(r"\b(19\d\d|20\d\d)\b", clean)
    year = cal.group(1) if cal else (tmatch.group(1) if tmatch else None)
    return {"rawTitle": clean, "year": year, "isSeries": is_series}


def search(query: str) -> dict:
    clean_q = re.sub(r"[^A-Za-z0-9\s\u0600-\u06FF]", " ", query).strip()
    url = f"https://www.f2mc.top/?s={urllib.parse.quote(clean_q)}&type=both"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    out = {"ok": False, "query": query, "entries": []}
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        seen = set()
        for m in re.finditer(r'<article class="entry">([\s\S]*?)</article>', html):
            block = m.group(1)
            tm = re.search(r"<h2 class=\"entry-title\">([\s\S]*?)</h2>", block)
            lm = re.search(r'<a href="([^"]+)"[^>]*class="stretched-link"', block)
            if not (tm and lm):
                continue
            link = lm.group(1)
            if link in seen:
                continue
            seen.add(link)
            info = parse_entry(tm.group(1).strip(), block)
            title = re.sub(r"<[^>]+>", "", tm.group(1)).strip()
            # Persian entry title cleanup: keep the essential name
            title = re.sub(r"^دانلود\s+(?:فیلم|سریال|انیمیشن|مینی\s*سریال|فیلم\s*سینمایی)\s*", "", title)
            title = re.sub(r"\s*(?:با\s+)?(?:دوبله|زیرنویس|سانسور|فارسی|چسبیده|کامل|بدون\s*سانسور).*$", "", title, flags=re.I)
            out["entries"].append({
                "title": title[:80],
                "year": info["year"],
                "isSeries": info["isSeries"],
                "link": link,
            })
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)[:200]
    return out


if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else ""
    result = search(q)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=True))
