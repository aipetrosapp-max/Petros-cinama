import os
import sys
import json
import time
import urllib.request
import urllib.parse
import re
from typing import Dict, Any, List, Optional

CONFIG_FILE = "config.json"
STATE_FILE = "state_bot.json"
REPO_FILE = "data/streams.json"

def load_json(filepath: str, default: Any) -> Any:
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error loading {filepath}: {e}")
    return default

def save_json(filepath: str, data: Any) -> None:
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Error saving {filepath}: {e}")

def call_telegram_api(bot_token: str, method: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    data = json.dumps(params).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        print(f"❌ Telegram API Error ({method}): {e.code} - {err_msg}")
        return None
    except Exception as e:
        print(f"❌ Request Error ({method}): {e}")
        return None

def detect_channel_id(bot_token: str) -> Optional[int]:
    """Auto-detect channel ID from recent bot updates where bot was added as admin"""
    res = call_telegram_api(bot_token, "getUpdates", {"allowed_updates": ["channel_post", "my_chat_member"]})
    if not res or not res.get("ok"):
        return None
    for update in reversed(res.get("result", [])):
        if "channel_post" in update:
            chat = update["channel_post"].get("chat", {})
            return chat.get("id")
        if "my_chat_member" in update:
            chat = update["my_chat_member"].get("chat", {})
            if chat.get("type") == "channel":
                return chat.get("id")
    return None

def format_movie_caption(movie: Dict[str, Any], web_player_url: str = "https://aipetrosapp-max.github.io/Petros-cinama/") -> str:
    title_en = movie.get("title", "")
    title_fa = movie.get("titleFa") or title_en
    year = movie.get("year", "")
    rating = movie.get("rating", "")
    category = movie.get("category", "movie")
    qualities = movie.get("qualities", [])
    synopsis = movie.get("synopsisFa") or movie.get("synopsis") or ""

    cat_emoji = "📺" if category == "series" else "🎬"
    clean_title = re.sub(r"<[^>]+>", "", title_fa)[:60].strip()

    lines = []
    header = f"{cat_emoji} <b>{clean_title}</b>"
    if year:
        header += f" <code>({year})</code>"
    lines.append(header)

    if rating:
        lines.append(f"⭐️ <b>امتیاز:</b> {rating}")

    if synopsis:
        clean_syn = re.sub(r"<[^>]+>", "", synopsis)[:80].strip() + "..."
        lines.append(f"📝 <b>خلاصه:</b> {clean_syn}")

    lines.append("")
    lines.append("📥 <b>لینک‌های دانلود مستقیم:</b>")

    if qualities:
        for q in qualities[:4]:
            q_name = q.get("quality", "1080p")
            q_url = q.get("url", "")
            if q_url:
                lines.append(f"🔹 <a href=\"{q_url}\">دانلود با کیفیت {q_name}</a>")
    elif movie.get("defaultStreamUrl"):
        lines.append(f"🔹 <a href=\"{movie['defaultStreamUrl']}\">دانلود با کیفیت اصلی</a>")

    lines.append("")
    lines.append("🍿 <b>پتروس سینما:</b>")
    lines.append(f"🌐 <a href=\"{web_player_url}\">تماشای آنلاین در وب‌سایت</a>")

    return "\n".join(lines)

def publish_movie(bot_token: str, chat_id: Any, movie: Dict[str, Any]) -> bool:
    caption = format_movie_caption(movie)
    poster_url = movie.get("posterUrl")

    # Send Photo with safe HTML caption
    if poster_url and poster_url.startswith("http"):
        params = {
            "chat_id": chat_id,
            "photo": poster_url,
            "caption": caption,
            "parse_mode": "HTML"
        }
        res = call_telegram_api(bot_token, "sendPhoto", params)
        if res and res.get("ok"):
            return True

    # Fallback to default high-res poster
    params = {
        "chat_id": chat_id,
        "photo": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",
        "caption": caption,
        "parse_mode": "HTML"
    }
    res = call_telegram_api(bot_token, "sendPhoto", params)
    if res and res.get("ok"):
        return True

    # Fallback to text message if photo completely rejected
    params_txt = {
        "chat_id": chat_id,
        "text": caption,
        "parse_mode": "HTML",
        "disable_web_page_preview": False
    }
    res_txt = call_telegram_api(bot_token, "sendMessage", params_txt)
    return bool(res_txt and res_txt.get("ok"))

def main():
    print("=" * 65)
    print("🤖 Petros Cinema Official Telegram Bot Auto-Publisher")
    print("=" * 65)

    config = load_json(CONFIG_FILE, {})
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN") or config.get("bot_token")
    channel_id = config.get("channel_id") or config.get("destination_channel")
    delay_sec = int(config.get("delay_between_uploads_sec", 1))
    max_batch = int(config.get("max_videos_per_run", 50))

    if not bot_token or bot_token == "PASTE_YOUR_BOT_TOKEN_HERE":
        print("\n❌ توکن ربات تنظیم نشده است!")
        sys.exit(1)

    # Check bot identity
    me = call_telegram_api(bot_token, "getMe", {})
    if not me or not me.get("ok"):
        print("❌ توکن ربات نامعتبر است! لطفاً توکن صحیح را بررسی فرمایید.")
        sys.exit(1)

    bot_username = me["result"].get("username", "UnknownBot")
    print(f"✅ ربات متصل شد: @{bot_username}")

    state = load_json(STATE_FILE, {"published_ids": []})
    published_ids = set(state.get("published_ids", []))

    manifest = load_json(REPO_FILE, {})
    all_movies = manifest.get("streams", [])

    print(f"[*] کل فیلم‌ها در مخزن سایت: {len(all_movies)}")
    print(f"[*] فیلم‌های قبلاً منتشرشده در کانال: {len(published_ids)}")

    pending = [m for m in all_movies if m.get("id") not in published_ids]
    print(f"[*] فیلم‌های جدید آماده انتشار در کانال: {len(pending)}")

    if not pending:
        print("🎉 تمامی فیلم‌های موجود در مخزن، از قبل در کانال تلگرام شما منتشر شده‌اند!")
        return

    success_count = 0
    for movie in pending[:max_batch]:
        title = movie.get("titleFa") or movie.get("title")
        m_id = movie.get("id")
        print(f"  [+] در حال ارسال پوستر و لینک‌ها: {title} ...", flush=True)

        ok = publish_movie(bot_token, channel_id, movie)
        if ok:
            published_ids.add(m_id)
            state["published_ids"] = list(published_ids)
            save_json(STATE_FILE, state)
            success_count += 1
            print(f"      ✅ ارسال شد!", flush=True)
        else:
            print(f"      ❌ ارسال ناموفق بود.", flush=True)

        time.sleep(delay_sec)

    print(f"\n==========================================")
    print(f"🎉 پایان مرحله انتشار: {success_count} فیلم جدید همراه با پوستر و لینک‌های مستقیم در کانال منتشر شد!")
    print(f"==========================================")

if __name__ == "__main__":
    main()
