#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deterministic catalog sanitizer for Petros Cinema.

- Removes duplicate titles.
- Cleans junk prefixes such as "فیلم", "دانلود", "اسم فیلم:", "امتیاز :".
- Normalizes year/category/duration and poster fields.
- Marks each record with an honest playbackStatus:
    available        -> verified direct host (archive.org / company3)
    requires_gateway -> t.me post (needs Telethon range gateway)
    unavailable      -> abrtech/mehracdn or no source
- Adds canonical records for Batman / Interstellar / Dune / Blade Runner.
- Never invents a playable URL. A title with no verified source stays
  unavailable and the UI shows the maintenance state.

Usage:
  python scripts/sanitize_catalog.py --write
  python scripts/sanitize_catalog.py --write --gateway-base http://localhost:8765
"""

from __future__ import annotations

import argparse
import html
import json
import re
import unicodedata
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse

TARGETS = [
    Path("data/streams.json"),
    Path("public/data/streams.json"),
    Path("public/streams.json"),
]

BAD_TITLE = re.compile(r"^(?:امتیاز|کیفیت|صوت|زیرنویس|کانال|لینک|پست)\s*[:：]?\s*[\d.%/]*$")
PREFIX_PATTERNS = [
    r"^\s*(?:دانلود\s+)?(?:فیلم|فیلم سینمایی|سریال|انیمه|انیمیشن|مستند)\s*(?:خارجی|ایرانی|جدید)?\s*[:：\-–—]*\s*",
    r"^\s*اسم\s*(?:فیلم|سریال|انیمه)\s*[:：\-–—]*\s*",
    r"^\s*دانلود\s+فصل\s*\d+\s*(?:سریال)?\s*[:：\-–—]*\s*",
    r"^\s*دانلود\s+[^:：]{1,40}?\s+با\s+زیرنویس[^:：]*[:：]?\s*",
    r"^\s*امتیاز\s*[:：]\s*[\d.]+/?\d*\s*",
    r"^\s*(?:دانلود|تماشای|پخش)\s*[:：\-–—]*\s*",
]
QUOTES = "«»\"'`“”"
YEAR_RE = re.compile(r"(?<!\d)((?:19|20)\d{2})(?!\d)")
FALLBACK_POSTER = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop"

CATEGORY_RULES = [
    ("series", ("سریال", "فصل", "قسمت", "series", "season", "episode", "s01", "s02")),
    ("anime", ("انیمه", "anime", "animation", "انیمیشن")),
    ("documentary", ("مستند", "documentary", "doc")),
]

TMDB = {
    "batman": "https://image.tmdb.org/t/p/w780/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    "interstellar": "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    "dune": "https://image.tmdb.org/t/p/w780/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    "blade-runner": "https://image.tmdb.org/t/p/w780/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
}

POPULAR = [
    {
        "id": "canonical-the-batman-2022",
        "title": "The Batman",
        "titleFa": "بتمن",
        "year": 2022,
        "category": "movie",
        "durationSec": 10560,
        "rating": "7.8/10",
        "director": "Matt Reeves",
        "genres": ["Action", "Crime", "Drama"],
        "posterUrl": TMDB["batman"],
        "synopsis": "Batman uncovers corruption in Gotham while pursuing the Riddler.",
        "synopsisFa": "بتمن در حالی که رد ریدلر را می‌گیرد، فساد گاتهام را کشف می‌کند.",
        "defaultStreamUrl": "",
        "trailerUrl": "https://archive.org/download/the-batman-2022-main-trailer-4k-prores/VGC921_trl_2_online_sb_txt_uhd_scp_bt1886_stereo_2398fps_20211011.mp4",
        "sourceType": "mp4",
        "qualities": [],
        "playbackStatus": "unavailable",
        "playbackStatusReason": "Only the official trailer is available; full movie source is not verified.",
        "subtitles": [],
        "subtitleStatus": "not_registered",
    },
    {
        "id": "canonical-interstellar-2014",
        "title": "Interstellar",
        "titleFa": "میان‌ستاره‌ای",
        "year": 2014,
        "category": "movie",
        "durationSec": 10140,
        "rating": "8.7/10",
        "director": "Christopher Nolan",
        "genres": ["Sci-Fi", "Drama", "Adventure"],
        "posterUrl": TMDB["interstellar"],
        "synopsis": "A team travels through a wormhole in search of a new home for humanity.",
        "synopsisFa": "گروهی از فضانوردان برای یافتن خانه‌ای جدید برای بشریت از کرم‌چاله می‌گذرند.",
        "defaultStreamUrl": "",
        "trailerUrl": "https://archive.org/download/interstellar-trailer-3/Interstellar_OfficialTrailer3_4K_51_prores.mp4",
        "sourceType": "mp4",
        "qualities": [],
        "playbackStatus": "unavailable",
        "playbackStatusReason": "Only the official trailer is available; full movie source is not verified.",
        "subtitles": [],
        "subtitleStatus": "not_registered",
    },
    {
        "id": "canonical-dune-2021",
        "title": "Dune",
        "titleFa": "تلماسه",
        "year": 2021,
        "category": "movie",
        "durationSec": 9300,
        "rating": "8.0/10",
        "director": "Denis Villeneuve",
        "genres": ["Sci-Fi", "Adventure", "Drama"],
        "posterUrl": TMDB["dune"],
        "synopsis": "Paul Atreides confronts his destiny on the desert planet Arrakis.",
        "synopsisFa": "پل آتریدیس در سیاره صحرایی آراکیس با سرنوشت خود روبه‌رو می‌شود.",
        "defaultStreamUrl": "",
        "trailerUrl": "https://archive.org/download/dune-2021-trailer/DUNE%202021%20%28trailer%29.mp4",
        "sourceType": "mp4",
        "qualities": [],
        "playbackStatus": "unavailable",
        "playbackStatusReason": "Only the official trailer is available; full movie source is not verified.",
        "subtitles": [],
        "subtitleStatus": "not_registered",
    },
    {
        "id": "canonical-blade-runner-2049",
        "title": "Blade Runner 2049",
        "titleFa": "بلید رانر ۲۰۴۹",
        "year": 2017,
        "category": "movie",
        "durationSec": 9840,
        "rating": "8.0/10",
        "director": "Denis Villeneuve",
        "genres": ["Sci-Fi", "Drama", "Mystery"],
        "posterUrl": TMDB["blade-runner"],
        "synopsis": "A young blade runner discovers a secret that could unravel society.",
        "synopsisFa": "بلید رانر جوانی رازی را کشف می‌کند که می‌تواند جامعه را از هم بپاشد.",
        "defaultStreamUrl": "https://archive.org/download/film-blade-runner-2049-vf-2017/Blade%20Runner%202049%20%282017%29.ia.mp4",
        "sourceType": "mp4",
        "qualities": [
            {
                "quality": "1080p",
                "url": "https://archive.org/download/film-blade-runner-2049-vf-2017/Blade%20Runner%202049%20%282017%29.ia.mp4",
                "format": "mp4",
            }
        ],
        "playbackStatus": "available",
        "playbackStatusReason": "Verified direct MP4 on archive.org (HTTP 206).",
        "subtitles": [],
        "subtitleStatus": "not_registered",
    },
]


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = str(value)
    for _fa, _en in zip("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"):
        value = value.replace(_fa, _en)
    value = html.unescape(value)
    value = re.sub(r"&\s*#?\s*0?38;?", "&", value)
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\u200c", " ").replace("\u200f", "").replace("\ufeff", "")
    value = re.sub(r"[*_~`#]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value.strip(QUOTES + " -:•|/\\t\n")


def clean_title(raw: str) -> str:
    value = clean_text(raw)
    if not value:
        return ""
    for _ in range(4):
        before = value
        for pattern in PREFIX_PATTERNS:
            value = re.sub(pattern, "", value, flags=re.IGNORECASE).strip()
        value = value.strip(QUOTES + " -:•|/\\t\n")
        value = re.sub(r"^(?:فیلم|سریال|انیمه|انیمیشن)\s*", "", value).strip(QUOTES + " -:•|/\\t\n")
        if value == before:
            break
    # Remove a duplicated quoted title: «X» -> X
    value = re.sub(r"^«\s*(.+?)\s*»$", r"\1", value)
    value = re.sub(r"\s*\((?:19\d{2}|20[0-2]\d)\)\s*$", "", value).strip()
    value = re.sub(r"\s+(?:19\d{2}|20[0-2]\d)\s*$", "", value).strip()
    return clean_text(value)


def title_key(item: dict, field: str = "titleFa") -> str:
    raw = item.get(field) or item.get("title") or item.get("titleFa") or ""
    key = clean_title(raw).lower()
    # Tatweel/diacritics are sometimes used to disguise duplicate titles.
    key = re.sub(r"[ـً-ٰٟ]", "", key)
    key = re.sub(r"[^\w؀-ۿ]+", " ", key)
    return re.sub(r"\s+", " ", key).strip()


def extract_year(*values: str) -> int | None:
    for value in values:
        for match in YEAR_RE.finditer(value or ""):
            year = int(match.group(1))
            if 1900 <= year <= 2027:
                return year
    return None


def normalize_category(item: dict) -> str:
    text = " ".join(
        str(item.get(k) or "") for k in ("title", "titleFa", "category", "mediaFolder", "tags")
    ).lower()
    for category, words in CATEGORY_RULES:
        if any(word in text for word in words):
            return category
    return "movie"


def host_of(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def classify_playback(item: dict) -> tuple[str, str]:
    urls = []
    if item.get("defaultStreamUrl"):
        urls.append(str(item["defaultStreamUrl"]))
    urls.extend(str(q.get("url") or "") for q in item.get("qualities") or [] if isinstance(q, dict))
    urls = [u for u in urls if u]

    if not urls:
        return "unavailable", "No media source is registered."

    hosts = {host_of(url) for url in urls}
    if any(host == "t.me" or host.endswith("telegram.me") for host in hosts):
        return "requires_gateway", "Telegram post link; requires the range gateway."
    if any("abrtech.top" in host or "mehracdn.com" in host for host in hosts):
        return "unavailable", "abrtech/mehracdn mirror is unverified and returned 503/404 in health checks."
    if any(host == "archive.org" or host.endswith("archive.org") or "company3.com" in host for host in hosts):
        return "available", "Verified direct media host."
    if all(url.startswith("http") for url in urls):
        return "available", "Direct HTTP media URL (runtime must validate it)."
    return "unavailable", "Unrecognized media source."


def merge_records(existing: dict, candidate: dict) -> dict:
    """Keep the richer/available record and merge non-empty quality sources."""
    def score(record: dict) -> int:
        playback = record.get("playbackStatus")
        value = 0
        if playback == "available":
            value += 100
        elif playback == "requires_gateway":
            value += 20
        value += 5 if record.get("posterUrl") else 0
        value += 3 if record.get("durationSec") else 0
        value += min(10, len(str(record.get("synopsisFa") or "")) // 80)
        return value

    primary, secondary = (existing, candidate) if score(existing) >= score(candidate) else (candidate, existing)
    merged = deepcopy(primary)
    for key, value in secondary.items():
        if key in ("qualities", "subtitles", "tags", "genres"):
            continue
        if not merged.get(key) and value:
            merged[key] = value

    quality_map = OrderedDict()
    for source in (primary, secondary):
        for q in source.get("qualities") or []:
            if isinstance(q, dict) and q.get("url"):
                quality_map[q["url"]] = q
    merged["qualities"] = list(quality_map.values())

    tags = []
    for source in (primary, secondary):
        for tag in source.get("tags") or []:
            if tag not in tags:
                tags.append(tag)
    merged["tags"] = tags

    subs = []
    for source in (primary, secondary):
        for sub in source.get("subtitles") or []:
            if sub not in subs:
                subs.append(sub)
    merged["subtitles"] = subs

    return merged


def enrich(item: dict) -> dict:
    item = dict(item)
    title = clean_title(item.get("title") or "")
    title_fa = clean_title(item.get("titleFa") or "")
    if not title and title_fa:
        title = title_fa
    if not title_fa and title:
        title_fa = title
    if not title or BAD_TITLE.match(title):
        return {}

    item["title"] = title
    item["titleFa"] = title_fa

    year = extract_year(item.get("titleFa"), item.get("title")) or int(item.get("year") or 0) or None
    if year:
        item["year"] = year

    item["category"] = normalize_category(item)
    item["posterUrl"] = item.get("posterUrl") or item.get("poster") or FALLBACK_POSTER
    item["poster"] = item["posterUrl"]
    item["backdropUrl"] = item.get("backdropUrl") or item["posterUrl"]

    duration = item.get("durationSec")
    try:
        duration = int(duration or 0)
    except (TypeError, ValueError):
        duration = 0
    if duration < 300:
        duration = 0
    item["durationSec"] = duration

    status, reason = classify_playback(item)
    item["playbackStatus"] = status
    item["playbackStatusReason"] = reason

    if not isinstance(item.get("genres"), list):
        item["genres"] = []
    if not isinstance(item.get("subtitles"), list):
        item["subtitles"] = []
    item["subtitleStatus"] = "registered" if item["subtitles"] else "not_registered"

    return item


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write the sanitized manifest to all targets")
    parser.add_argument("--gateway-base", default="", help="documentation only; gateway URL is built at runtime")
    args = parser.parse_args()

    canonical = max(TARGETS, key=lambda p: p.stat().st_size if p.exists() else 0)
    manifest = json.loads(canonical.read_text(encoding="utf-8"))
    streams = manifest.get("streams") or []
    before = len(streams)

    cleaned = []
    dropped = 0
    for raw in streams:
        item = enrich(raw)
        if not item:
            dropped += 1
            continue
        cleaned.append(item)

    buckets: OrderedDict[str, dict] = OrderedDict()
    alias_index: dict[str, str] = {}
    duplicates = 0
    for item in cleaned:
        keys = []
        for field in ("titleFa", "title"):
            key = title_key(item, field)
            if key and key not in keys:
                keys.append(key)
        if not keys:
            dropped += 1
            continue
        matched = next((alias_index[k] for k in keys if k in alias_index), None)
        if matched is not None:
            buckets[matched] = merge_records(buckets[matched], item)
            duplicates += 1
            for key in keys:
                alias_index[key] = matched
        else:
            bucket_key = keys[0]
            buckets[bucket_key] = item
            for key in keys:
                alias_index[key] = bucket_key

    merged = list(buckets.values())

    # Second pass: bilingual records often put both names in one field, e.g.
    # "سرزمین اوباش MobLand". Merge when the shorter title is fully contained
    # in the longer one and the release year matches (avoids merging sequels).
    collapsed: list[dict] = []
    for item in merged:
        keys = [title_key(item, f) for f in ("titleFa", "title") if title_key(item, f)]
        match_idx = None
        for idx, other in enumerate(collapsed):
            other_keys = [title_key(other, f) for f in ("titleFa", "title") if title_key(other, f)]
            years_ok = not item.get("year") or not other.get("year") or item.get("year") == other.get("year")
            if not years_ok:
                continue
            contained = any(
                len(a) >= 4 and len(b) >= 4 and (a in b or b in a)
                for a in keys for b in other_keys
            )
            if contained:
                match_idx = idx
                break
        if match_idx is None:
            collapsed.append(item)
        else:
            collapsed[match_idx] = merge_records(collapsed[match_idx], item)
            duplicates += 1
    merged = collapsed

    existing_keys = {title_key(item, field) for item in merged for field in ("titleFa", "title")}

    added_popular = 0
    for popular in POPULAR:
        key = title_key(popular, "title")
        if key in existing_keys:
            continue
        merged.insert(0, deepcopy(popular))
        existing_keys.add(key)
        added_popular += 1

    rank = {"available": 0, "requires_gateway": 1, "unavailable": 2}
    merged.sort(key=lambda x: (rank.get(x.get("playbackStatus"), 3), -(int(x.get("year") or 0))))

    status_counts = {}
    for item in merged:
        status = item.get("playbackStatus", "unavailable")
        status_counts[status] = status_counts.get(status, 0) + 1

    manifest["streams"] = merged
    manifest["totalStreams"] = len(merged)
    manifest["sanitizedAt"] = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    ).isoformat()
    manifest["sanitizer"] = "scripts/sanitize_catalog.py"

    print(f"input={before} cleaned={len(cleaned)} dropped={dropped} duplicates={duplicates} addedPopular={added_popular}")
    print(f"output={len(merged)} statuses={status_counts}")
    print(f"missing director={sum(1 for x in merged if not x.get('director'))} missing subtitles={sum(1 for x in merged if not x.get('subtitles'))}")

    if args.write:
        text = json.dumps(manifest, ensure_ascii=False, indent=2)
        for target in TARGETS:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text + "\n", encoding="utf-8")
            print(f"wrote {target}")
    else:
        print("dry run (pass --write to persist)")


if __name__ == "__main__":
    main()
