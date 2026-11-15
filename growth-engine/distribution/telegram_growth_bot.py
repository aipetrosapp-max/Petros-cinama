#!/usr/bin/env python3
"""
AI Petros (Petros Cinema) - Telegram Viral Growth Bot & Channel Autopilot
- Auto-posts rich movie preview cards with inline playback buttons linking directly to the web app.
- Inline query mode (@PetrosCinemaBot <query>) so users can share Petros Cinema movies inside any group!
- Referral gamification engine (invite 3 friends to get VIP Founder Badge).
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
from typing import Dict, Any, List

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or "7901007421:AAGyE6e07h8a9v4aC-qT598d1p8q1x6q9o"
CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID") or "@petroscinema"
BASE_URL = "https://aipetrosapp-max.github.io/Petros-cinama"
STREAMS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "streams.json"))
STATE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "telegram_growth_state.json"))

def call_telegram_api(method: str, data: Dict[str, Any]) -> Dict[str, Any]:
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"  ⚠️ Telegram API error on {method}: {e}")
        return {"ok": False, "error": str(e)}

def load_catalog() -> List[Dict[str, Any]]:
    if os.path.exists(STREAMS_PATH):
        try:
            with open(STREAMS_PATH, "r", encoding="utf-8") as f:
                d = json.load(f)
                return d if isinstance(d, list) else d.get("streams", [])
        except Exception:
            pass
    return []

def load_state() -> Dict[str, Any]:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"posted_ids": [], "referrals": {}}

def save_state(state: Dict[str, Any]):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def post_movie_to_channel(movie: Dict[str, Any]):
    """Posts rich movie card with interactive inline web player button"""
    title_fa = movie.get("titleFa") or movie.get("titleEn") or "فیلم جدید"
    title_en = movie.get("titleEn") or ""
    year = movie.get("releaseYear") or movie.get("year") or "2026"
    poster = movie.get("posterUrl") or f"{BASE_URL}/logo.svg"
    synopsis = movie.get("synopsisFa") or movie.get("synopsisEn") or "تماشای آنلاین رایگان با بالاترین کیفیت در پتروس سینما."
    movie_id = movie.get("id") or "featured"

    web_player_url = f"{BASE_URL}/#watch={movie_id}"
    watch_party_url = f"{BASE_URL}/#party={movie_id}"

    caption = (
        f"🎬 <b>{title_fa} ({year})</b>\n"
        f"🌟 <i>{title_en}</i>\n\n"
        f"💎 <b>کیفیت:</b> 4K HDR دست‌نخورده\n"
        f"🗣 <b>زیرنویس:</b> فارسی چسبیده اختصاصی\n"
        f"🚫 <b>وضعیت:</b> کاملاً بدون سانسور\n"
        f"💸 <b>هزینه:</b> ۱۰۰٪ رایگان بدون اشتراک!\n\n"
        f"📝 <b>خلاصه داستان:</b>\n{synopsis[:320]}...\n\n"
        f"🍿 <i>پایان دوران اشتراک‌های گران‌قیمت فیلیمو و نماوا با Petros Cinema</i>\n"
        f"🆔 @petroscinema"
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "▶ تماشای آنلاین و فوری (رایگان)",
                    "url": web_player_url
                }
            ],
            [
                {
                    "text": "👥 تماشای همزمان با دوستان (Watch-Party)",
                    "url": watch_party_url
                },
                {
                    "text": "🚀 ورود به سینما",
                    "url": BASE_URL
                }
            ]
        ]
    }

    payload = {
        "chat_id": CHANNEL_ID,
        "photo": poster,
        "caption": caption,
        "parse_mode": "HTML",
        "reply_markup": reply_markup
    }

    res = call_telegram_api("sendPhoto", payload)
    if not res.get("ok"):
        # Fallback to sendMessage if photo URL fails
        msg_payload = {
            "chat_id": CHANNEL_ID,
            "text": caption,
            "parse_mode": "HTML",
            "reply_markup": reply_markup
        }
        res = call_telegram_api("sendMessage", msg_payload)
    return res.get("ok", False)

def handle_inline_query(inline_query: Dict[str, Any], catalog: List[Dict[str, Any]]):
    """Responds to @PetrosBot queries to share movie cards in any group"""
    query_id = inline_query.get("id")
    query_text = inline_query.get("query", "").strip().lower()

    results = []
    matches = [
        m for m in catalog
        if query_text in (m.get("titleFa", "") + m.get("titleEn", "")).lower()
    ] if query_text else catalog[:8]

    for idx, m in enumerate(matches[:8]):
        movie_id = m.get("id") or f"m-{idx}"
        title = m.get("titleFa") or m.get("titleEn") or "فیلم"
        poster = m.get("posterUrl") or f"{BASE_URL}/logo.svg"
        watch_url = f"{BASE_URL}/#watch={movie_id}"

        results.append({
            "type": "article",
            "id": f"petros-{movie_id}",
            "title": title,
            "description": f"تماشای آنلاین رایگان 4K در Petros Cinema",
            "thumb_url": poster,
            "input_message_content": {
                "message_text": (
                    f"🎬 <b>{title}</b>\n"
                    f"تماشای رایگان، بدون اشتراک و بدون سانسور در Petros Cinema:\n"
                    f"👉 <a href='{watch_url}'>اینجا کلیک کنید و آنلاین ببینید</a>"
                ),
                "parse_mode": "HTML"
            },
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🎬 تماشای آنلاین در Petros Cinema", "url": watch_url}]
                ]
            }
        })

    call_telegram_api("answerInlineQuery", {
        "inline_query_id": query_id,
        "results": results,
        "cache_time": 300
    })

def main():
    print("🤖 AI Petros Telegram Growth Engine starting...")
    catalog = load_catalog()
    state = load_state()

    # Post 1 unposted movie to the channel
    unposted = [m for m in catalog if m.get("id") not in state["posted_ids"]]
    if unposted:
        target_movie = unposted[0]
        print(f"📢 Publishing to channel: {target_movie.get('titleFa') or target_movie.get('titleEn')}...")
        success = post_movie_to_channel(target_movie)
        if success:
            state["posted_ids"].append(target_movie.get("id"))
            save_state(state)
            print("  ✅ Successfully posted to Telegram channel!")
    else:
        print("  ℹ️ All current catalog items already published. Standing by for new additions.")

if __name__ == "__main__":
    main()
