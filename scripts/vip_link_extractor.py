"""
Petros Cinema — VIP page link extractor (session-aware).

Loads a page of the owner's VIP site WITH the owner's own saved session
cookies and lists the video/source links found inside (direct media,
download pages, players, network streams). For the owner's connectivity
test only — nothing is copied anywhere.

Usage: python vip_link_extractor.py <page_url> <session_json> <out_json>
"""
import sys
import json
import re
import urllib.parse
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MEDIA_RE = re.compile(r"\.(mp4|mkv|webm|m3u8|avi|mov|mpd)(\?|#|$)", re.I)
QUALITY_RE = re.compile(r"(480p|720p|1080p|2160p|4k|hdr|x265|x264|hevc|bluray|web[- ]?dl)", re.I)
LINK_TEXT_RE = re.compile(r"(دانلود|کیفیت|دوبله|زیرنویس|دانلود فیلم|download|episode|قسمت|فصل|season|series|movie)", re.I)


def extract(page_url: str, session_path: str, out_path: str, full: bool = False) -> dict:
    sess = {}
    try:
        sess = json.load(open(session_path, encoding="utf-8"))
    except Exception:
        pass
    cookies = sess.get("cookies") or []
    host = urlsplit(page_url).hostname or ""
    found: dict = {}
    with_session = bool(cookies)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA)
        if with_session:
            safe = []
            for c in cookies:
                if not c.get("name"):
                    continue
                safe.append({
                    "name": c["name"],
                    "value": c.get("value", ""),
                    "domain": c.get("domain") or host,
                    "path": c.get("path", "/"),
                })
            try:
                context.add_cookies(safe)
            except Exception:
                pass
        page = context.new_page()
        media_hits: list = []
        page.on("response", lambda r: media_hits.append(r.url) if MEDIA_RE.search(r.url) else None)
        try:
            page.goto(page_url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            result = {"url": page_url, "ok": False, "withSession": with_session, "count": 0, "links": [], "message": f"باز شدن صفحه ناموفق بود: {e}"}
            json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            browser.close()
            return result
        try:
            page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            pass
        page.wait_for_timeout(2000)

        anchors = []
        iframes = []
        try:
            anchors = page.eval_on_selector_all(
                "a[href]", "els => els.map(e => ({href: e.href, text: (e.innerText||'').trim().slice(0,140)}))"
            )
        except Exception:
            pass
        try:
            iframes = page.eval_on_selector_all(
                "iframe[src], embed[src], video[src], source[src]",
                "els => els.map(e => e.src || e.getAttribute('src'))"
            )
        except Exception:
            pass

        for a in anchors:
            href, text = a.get("href", "") or "", a.get("text", "") or ""
            if not href.startswith("http"):
                continue
            if MEDIA_RE.search(href):
                kind = "direct"
            elif QUALITY_RE.search(href) or LINK_TEXT_RE.search(text) or QUALITY_RE.search(text):
                kind = "page"
            elif full:
                kind = "link"
            else:
                continue
            if href not in found:
                found[href] = {"url": href, "text": text, "type": kind}

        for src in iframes:
            if src and (MEDIA_RE.search(src) or "embed" in src.lower() or "player" in src.lower()):
                if src not in found:
                    kind = "stream" if MEDIA_RE.search(src) else "embed"
                    found[src] = {"url": src, "text": "(پخش‌کننده/iframe)" if kind == "embed" else "(فایل در player)", "type": kind}

        for m in media_hits:
            if m not in found:
                found[m] = {"url": m, "text": "(استریم شبکه)", "type": "stream"}

        browser.close()

    links = list(found.values())

    # Probe real size of direct/stream files (fast HEAD, with the session) so the
    # owner can see what he is sending before ticking anything.
    probed = 0
    for l in links:
        try:
            name = l["url"].split("?")[0].split("/")[-1]
            l["name"] = urllib.parse.unquote(name) or l["url"][:60]
            q = QUALITY_RE.search(l["name"])
            l["quality"] = q.group(0) if q else ""
        except Exception:
            l["name"] = l["url"][:60]
            l["quality"] = ""
        if probed < 60 and l["type"] in ("direct", "stream"):
            probed += 1
            try:
                head = context.request.head(l["url"], timeout=15000, fail_on_status_code=False)
                clen = head.headers.get("content-length")
                l["size"] = int(clen) if clen and clen.isdigit() else None
                l["http"] = head.status
            except Exception:
                l["size"] = None

    cap = 800 if full else 200
    links = links[:cap]
    result = {
        "url": page_url,
        "ok": True,
        "withSession": with_session,
        "full": full,
        "count": len(links),
        "links": links,
        "message": f"{len(links)} لینک پیدا شد" + (" (با نشست VIP)" if with_session else " (بدون نشست — لطفاً اول لاگین کن)"),
    }
    json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps({"count": len(links), "withSession": with_session}, ensure_ascii=True))
    return result


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"count": 0, "message": "usage: vip_link_extractor.py <page_url> <session_json> <out_json> [full]"}))
        sys.exit(1)
    full_mode = len(sys.argv) > 4 and sys.argv[4] in ("1", "true", "True", "full")
    extract(sys.argv[1], sys.argv[2], sys.argv[3], full=full_mode)
