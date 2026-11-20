"""
Petros Cinema — Film2Media post file extractor (filmyar-style).

Opens a Film2Media post page and extracts every direct .mkv/.mp4 link
(the same regex-technique as the open-source filmyar project), then HEAD-probes
each for the real size.

Usage: python f2m_files.py "<post_url>" <out_json>
Output JSON: {"ok":true,"count":N,"links":[{name,url,quality,size,dubbed,subbed}]}
"""
import sys
import json
import re
import urllib.request
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
QUALITY_RE = re.compile(r"(2160p|1080p|720p|480p|360p|4K)", re.I)


def extract(post_url: str) -> dict:
    out = {"ok": False, "url": post_url, "links": []}
    try:
        req = urllib.request.Request(post_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        html = re.sub(r"&#13;|&#10;", "\n", html, flags=re.I)

        seen = set()
        links = []
        for m in re.finditer(r"https?://[^\s'\"<>]+\.(?:mkv|mp4|avi)", html, re.I):
            raw = m.group(0)
            for part in re.split(r"(?:\r\n|\r|\n|%0[Dd]%0[Aa]|%0[Dd]|%0[Aa]|%20|\s)+", raw):
                url = part.strip()
                if not url.startswith("http") or url in seen:
                    continue
                seen.add(url)
                name = urllib.parse.unquote(url.split("/")[-1].split("?")[0])
                q = QUALITY_RE.search(name)
                links.append({
                    "name": name,
                    "url": url,
                    "type": "direct",
                    "quality": q.group(0) if q else "",
                    "dubbed": bool(re.search(r"DUB|دوبله", url, re.I)),
                    "subbed": bool(re.search(r"SUB|SoftSub", url, re.I)),
                })

        # HEAD probe sizes (limit 12, skip remaining probes for a failed host)
        failed_hosts = set()
        probed = 0
        for l in links:
            if probed >= 12:
                break
            try:
                host = urllib.parse.urlparse(l["url"]).hostname or ""
                if host in failed_hosts:
                    continue
                hreq = urllib.request.Request(l["url"], headers={"User-Agent": UA}, method="HEAD")
                with urllib.request.urlopen(hreq, timeout=8) as h:
                    clen = h.headers.get("Content-Length")
                    cd = h.headers.get("Content-Disposition", "")
                    if clen and clen.isdigit():
                        l["size"] = int(clen)
                    mcd = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";\r\n]+)", cd, re.I)
                    if mcd and mcd.group(1):
                        l["name"] = urllib.parse.unquote(mcd.group(1).strip('"'))[:90]
                probed += 1
            except Exception:
                failed_hosts.add(host)

        out["links"] = links
        out["count"] = len(links)
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)[:200]
    return out


if __name__ == "__main__":
    result = extract(sys.argv[1] if len(sys.argv) > 1 else "")
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=True))
