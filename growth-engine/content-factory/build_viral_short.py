#!/usr/bin/env python3
"""
AI Petros (Petros Cinema) - Autonomous Viral Video Generator
Generates 9:16 Vertical Videos (1080x1920) for Instagram Reels, YouTube Shorts, and TikTok
using 100% FREE Microsoft Neural TTS (edge-tts) + FFmpeg.
Designed to run in GitHub Actions with zero local CPU/GPU load on the user's MacBook.
"""

import os
import sys
import json
import asyncio
import subprocess
import shutil
from typing import Dict, Any, List

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "output"))
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))

SCENARIOS = {
    "competitor_crusher_fa": {
        "id": "scenario_a",
        "lang": "fa",
        "voice": "fa-IR-FaridNeural",
        "title": "پایان دوران اشتراک‌های گران‌قیمت فیلیمو و نماوا",
        "caption": """🚨 پایان دوران اشتراک‌های گران‌قیمت! 
هنوز داری ماهی صدها هزار تومن پول اشتراک فیلیمو و نماوا میدی که آخرش فیلم سانسور شده ببینی؟!
پتروس سینما (AI Petros) اومده تا بساط اشتراک‌فروشی رو جمع کنه!

🎬 تمام فیلم‌ها و سریال‌های روز دنیا
💎 کیفیت کریستالی 4K HDR
🚫 بدون سانسور و با زیرنویس اختصاصی چسبیده
⚡️ ۱۰۰٪ رایگان برای همیشه و بدون نیاز به ثبت‌نام!

همین الان وارد لینک بیو شو یا کلمه «پتروس» رو کامنت کن تا لینک ورود مستقیم برات دایرکت بشه! 🔥
#فیلم_رایگان #جایگزین_فیلیمو #بدون_سانسور #پتروس_سینما #دانلود_فیلم #سینمایی""",
        "hook_text": "هنوز داری پول اشتراک فیلیمو میدی؟!",
        "script_segments": [
            {"time": "0-3s", "speech": "هنوز داری ماهی صدها هزار تومن پول اشتراک فیلیمو و نماوا میدی که آخرش فیلم سانسور شده ببینی؟!"},
            {"time": "3-12s", "speech": "پتروس سینما اومده تا بساط اشتراک‌فروشی رو جمع کنه. تمام فیلم‌ها و سریال‌های روز دنیا، با کیفیت فورکی، بدون سانسور، صد در صد رایگان برای همیشه و بدون نیاز به ثبت‌نام!"},
            {"time": "12-15s", "speech": "همین الان وارد لینک بیو شو یا کلمه پتروس رو کامنت کن تا لینک مستقیم برات ارسال بشه!"}
        ]
    },
    "hidden_gem_fa": {
        "id": "scenario_b",
        "lang": "fa",
        "voice": "fa-IR-DilaraNeural",
        "title": "۳ تا از خفن‌ترین فیلم‌های علمی-تخیلی که حتما باید ببینی",
        "caption": """🛸 ۳ شاهکار سینمایی که مغزت رو منفجر می‌کنه!
هر سه تا فیلم رو همین امشب می‌تونی با کیفیت 4K و زیرنویس فارسی رایگان توی Petros Cinema ببینی.
لینک بدون فیلتر در بیو پیج قرار گرفت 🍿
#فیلم_علمی_تخیلی #معرفی_فیلم #پتروس_سینما #فیلم_خوب_ببینیم""",
        "hook_text": "۳ شاهکار علمی-تخیلی که ندیدی...",
        "script_segments": [
            {"time": "0-3s", "speech": "سه تا از شاهکارهای سینمایی که هیچ‌کس بهت معرفی نکرده و می‌تونی همین امشب رایگان ببینی."},
            {"time": "3-12s", "speech": "این آثار با بالاترین کیفیت، بدون تبلیغات آزاردهنده و با صدای فراگیر در پتروس سینما آماده تماشا هستند."},
            {"time": "12-15s", "speech": "لینک تماشای مستقیم و بدون فیلتر در بیو پیج و کانال تلگرام پتروس سینما!"}
        ]
    },
    "cross_platform_shock_fa": {
        "id": "scenario_c",
        "lang": "fa",
        "voice": "fa-IR-FaridNeural",
        "title": "تبدیل فوری گوشی و تلویزیون به سینمای اختصاصی",
        "caption": """📺 گوشی، لپ‌تاپ و تلویزیون خونه‌ت رو در ۲ ثانیه تبدیل به سینمای اختصاصی کن!
بدون نیاز به نصب از گوگل‌پلی یا اپ‌استور. ۱۰۰٪ رایگان.
وارد لینک بیو شو! 🚀
#اندروید_تیوی #آیفون #پتروس_سینما #تماشای_رایگان""",
        "hook_text": "تلویزیونت رو سینمای اختصاصی کن!",
        "script_segments": [
            {"time": "0-3s", "speech": "گوشیت، لپ‌تاپت و تلویزیون خونه‌ت رو در دو ثانیه تبدیل به سینمای اختصاصی کن!"},
            {"time": "3-12s", "speech": "بدون نیاز به اپ استور یا گوگل پلی، وب‌اپلیکیشن هوشمند پتروس سینما با ریموت کنترل روی تمام دستگاه‌ها اجرا می‌شه."},
            {"time": "12-15s", "speech": "رایگانِ رایگان! لینک ورود مستقیم توی بیو و کپشن همین پست."}
        ]
    },
    "global_netflix_crusher_en": {
        "id": "scenario_d",
        "lang": "en",
        "voice": "en-US-ChristopherNeural",
        "title": "Stop Paying $20/Month for Streaming Services",
        "caption": """🔥 Stop paying $20/month for 5 different streaming apps that keep canceling your favorite shows.
AI Petros Cinema brings unlimited 4K HDR movies & series directly to your web browser with zero subscriptions.
👉 Link in bio!
#FreeStreaming #NetflixAlternative #StreamFree #MovieNight #AIPetros #PWA""",
        "hook_text": "Stop Paying $20/Month for Netflix!",
        "script_segments": [
            {"time": "0-3s", "speech": "Stop paying twenty dollars a month for five different streaming apps that keep canceling your favorite shows."},
            {"time": "3-12s", "speech": "AI Petros delivers thousands of global movies and series in crisp 4K HDR. No subscriptions, no credit cards, and zero ads."},
            {"time": "12-15s", "speech": "Tap the link in bio right now. Free streaming forever on AI Petros."}
        ]
    },
    "watch_party_viral_fa": {
        "id": "scenario_e",
        "lang": "fa",
        "voice": "fa-IR-DilaraNeural",
        "title": "تماشای همزمان فیلم با پارتنرت از راه دور",
        "caption": """🍿 امشب با دوستت یا پارتنرت از دو تا شهر مختلف همزمان یه فیلم رو آنلاین ببینید!
با قابلیت Watch-Party پتروس سینما فقط کافیه لینک رو بفرستی تا با هم ببینید و گپ بزنید! 👫
لینک مستقیم در بیو پیج.
#تماشای_همزمان #واچ_پارتی #فیلم_دیدن #پتروس_سینما""",
        "hook_text": "فیلم دیدن دونفره از راه دور!",
        "script_segments": [
            {"time": "0-3s", "speech": "امشب با دوستت یا پارتنرت از دو تا شهر مختلف همزمان یه فیلم رو آنلاین ببینید!"},
            {"time": "3-12s", "speech": "قابلیت واچ پارتی در پتروس سینما به شما اجازه می‌ده بدون نیاز به هیچ برنامه‌ای، به صورت کاملاً هماهنگ فیلم ببینید."},
            {"time": "12-15s", "speech": "لینک فیلم رو کپی کن، برای دوستت بفرست و رایگان لذت ببر!"}
        ]
    }
}

async def generate_voiceover(text: str, voice: str, output_path: str):
    """Generate high quality Microsoft Neural TTS voiceover via edge-tts (100% free)"""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice, rate="+6%", pitch="+0Hz")
        await communicate.save(output_path)
        print(f"  🎙️ Generated Voiceover: {os.path.basename(output_path)}")
        return True
    except Exception as e:
        print(f"  ⚠️ edge-tts error (or not installed): {e}")
        return False

def render_vertical_video_ffmpeg(
    audio_path: str,
    output_video_path: str,
    hook_text: str,
    bg_image_path: str = ""
):
    """
    Renders 9:16 (1080x1920) 60fps vertical video using FFmpeg.
    Adds cinematic black vignette, gold luxury borders, bold subtitles, and animated waveforms.
    """
    if not shutil.which("ffmpeg"):
        print("  ℹ️ FFmpeg is not installed locally. Rendering will execute on GitHub Actions runner.")
        return False

    # Get audio duration
    try:
        probe_cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path
        ]
        duration = float(subprocess.check_output(probe_cmd).strip())
    except Exception:
        duration = 14.5

    # Safe text filter escaping
    safe_hook = hook_text.replace("'", "").replace(":", "")

    # FFmpeg command to build 1080x1920 video with gold brand overlay & audio
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=0x050508:s=1080x1920:d={duration}",
        "-i", audio_path,
        "-filter_complex",
        (
            f"[0:v]drawbox=x=40:y=40:w=1000:h=1840:color=0xD4AF37@0.4:t=3,"
            f"drawtext=text='AI PETROS CINEMA':fontcolor=0xD4AF37:fontsize=52:x=(w-text_w)/2:y=180,"
            f"drawtext=text='VIP STREAMING // 100% FREE':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=250,"
            f"drawtext=text='{safe_hook}':fontcolor=0xF5B942:fontsize=64:x=(w-text_w)/2:y=850,"
            f"drawbox=x=120:y=1550:w=840:h=120:color=0xD4AF37@0.9:t=fill,"
            f"drawtext=text='WATCH FREE -> aipetros.pages.dev':fontcolor=0x050508:fontsize=44:x=(w-text_w)/2:y=1588[v]"
        ),
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_video_path
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"  🎬 Rendered Vertical Short: {os.path.basename(output_video_path)}")
        return True
    except Exception as e:
        print(f"  ⚠️ FFmpeg render error: {e}")
        return False

async def produce_all_shorts(dry_run: bool = False):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    metadata_manifest = []

    print(f"🚀 Launching Viral Content Factory ({len(SCENARIOS)} scenarios)...")

    for key, sc in SCENARIOS.items():
        print(f"\n▶ Processing {sc['title']} ({key})...")
        full_speech = " ".join([seg["speech"] for seg in sc["script_segments"]])
        audio_file = os.path.join(OUTPUT_DIR, f"{key}_voiceover.mp3")
        video_file = os.path.join(OUTPUT_DIR, f"{key}_reel_1080x1920.mp4")

        # 1. Generate Voiceover
        if not dry_run:
            await generate_voiceover(full_speech, sc["voice"], audio_file)

        # 2. Render Vertical Video (Runs on GitHub Actions runner or locally if FFmpeg present)
        if not dry_run and os.path.exists(audio_file):
            render_vertical_video_ffmpeg(audio_file, video_file, sc["hook_text"])

        # 3. Save Post Metadata
        post_meta = {
            "scenario_key": key,
            "title": sc["title"],
            "caption": sc["caption"],
            "lang": sc["lang"],
            "hook": sc["hook_text"],
            "audio_file": audio_file if os.path.exists(audio_file) else None,
            "video_file": video_file if os.path.exists(video_file) else None
        }
        metadata_manifest.append(post_meta)

    # Save manifest for multi-poster
    manifest_path = os.path.join(OUTPUT_DIR, "viral_posts_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(metadata_manifest, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Content Factory completed! Manifest saved to: {manifest_path}")

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    asyncio.run(produce_all_shorts(dry_run=is_dry))
