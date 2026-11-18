#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Connect gateway titles to the local Rolling Cache Stream Gateway.

Every catalog record with playbackStatus == "requires_gateway" (a Telegram
post upstream) is repointed to the standard same-origin route:

    /api/stream/cache/<streamId>

and its status becomes "available". The original t.me link is preserved in
`telegramUrl` so the cache gateway (src/services/streamCacheGateway.ts) can
resolve the upstream through STREAM_GATEWAY_URL at request time.

The local stream server (npm run dev:server) must be running for playback;
without it the player shows the honest maintenance state.

Run AFTER scripts/sanitize_catalog.py. Writes all three catalog copies.
"""
import json
import os
import sys

IO = sys.stdout
FILES = [
    os.path.join("data", "streams.json"),
    os.path.join("public", "data", "streams.json"),
    os.path.join("public", "streams.json"),
]

REASON_FA = "پخش از طریق گیت‌وی کش غلتان محلی فعال است."
REASON_EN = (
    "Rolling cache stream gateway route (/api/stream/cache). "
    "The local stream server must be running; the Telegram upstream is "
    "fetched with byte-range support and cached for 8 hours."
)


def is_telegram(url: str) -> bool:
    return isinstance(url, str) and ("t.me/" in url or "telegram.me/" in url)


def main() -> int:
    primary = FILES[0]
    with open(primary, encoding="utf-8") as fh:
        data = json.load(fh)
    streams = data.get("streams", [])

    flipped = 0
    skipped = 0
    for s in streams:
        if s.get("playbackStatus") != "requires_gateway":
            continue
        upstream = s.get("telegramUrl") or s.get("defaultStreamUrl") or ""
        if not is_telegram(upstream) or not s.get("id"):
            skipped += 1
            continue
        sid = s["id"]
        s["playbackStatus"] = "available"
        s["playbackStatusReason"] = REASON_EN
        s["defaultStreamUrl"] = f"/api/stream/cache/{sid}"
        for q in s.get("qualities") or []:
            if isinstance(q, dict):
                q["url"] = f"/api/stream/cache/{sid}"
        flipped += 1

    data["gatewayIntegration"] = {
        "mode": "rolling_cache_gateway",
        "route": "/api/stream/cache/<streamId>",
        "cacheDir": "cache/media_chunks",
        "rollingWindowHours": 8,
        "maxCacheGb": 50,
        "connectedTitles": flipped,
        "note": "Requires the local stream server (npm run dev:server).",
    }

    payload = json.dumps(data, ensure_ascii=False, indent=2)
    for path in FILES:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(payload + "\n")

    IO.write(f"connected={flipped} skipped={skipped} total={len(streams)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
