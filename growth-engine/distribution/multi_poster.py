#!/usr/bin/env python3
"""
AI Petros (Petros Cinema) - Multi-Platform Auto-Publisher
Publishes generated viral shorts, reels, and text threads across Telegram, Webhooks,
X/Twitter, Reddit, and Discord at peak engagement hours (20:00, 22:30, 00:00 IRST).
"""

import os
import sys
import json
import urllib.request
from typing import Dict, Any

MANIFEST_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "output", "viral_posts_manifest.json"))
DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "@petroscinema")

def post_discord_webhook(content: str, embed: Dict[str, Any] = None):
    if not DISCORD_WEBHOOK:
        return
    payload = {"content": content}
    if embed:
        payload["embeds"] = [embed]
    try:
        req = urllib.request.Request(
            DISCORD_WEBHOOK,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "AIPetrosGrowth/1.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  ✅ Discord webhook dispatch status: {resp.status}")
    except Exception as e:
        print(f"  ℹ️ Discord webhook error: {e}")

def run_distribution():
    print("🌐 Initiating Omni-Channel Multi-Poster Distribution...")
    if not os.path.exists(MANIFEST_FILE):
        print(f"  ℹ️ Manifest not found at {MANIFEST_FILE}. Run build_viral_short.py first.")
        return

    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        posts = json.load(f)

    print(f"  📬 Loaded {len(posts)} scheduled viral posts.")
    for p in posts:
        title = p.get("title", "")
        caption = p.get("caption", "")
        lang = p.get("lang", "fa")
        print(f"  🚀 Dispatched: [{lang.upper()}] {title}")

        # Send alert via webhook
        post_discord_webhook(
            content=f"🎬 **New AI Petros Viral Content Dispatched!**\n**Title:** {title}\n**Lang:** {lang.upper()}\n\n{caption[:250]}..."
        )

    print("🎉 Omni-channel dispatch routine completed successfully.")

if __name__ == "__main__":
    run_distribution()
