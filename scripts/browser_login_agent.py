"""
Playwright-based Headed/Headless session capturer for VIP cinema sources.
Allows admin to open target site, log in manually via interactive browser,
and automatically extracts authentication cookies & headers for streams.
"""
import sys
import json
import os
from playwright.sync_api import sync_playwright

def open_login_browser(target_url, session_output_path):
    print(f"Launching interactive browser for: {target_url}", flush=True)
    with sync_playwright() as p:
        # Launch visible browser for admin to interact and login
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto(target_url)
        print("Browser opened. Please complete login inside the browser window.", flush=True)
        print("Waiting for browser to be closed by user or login completion...", flush=True)
        
        # Wait until user closes page or browser
        try:
            page.wait_for_event("close", timeout=300000) # 5 minutes max
        except Exception:
            pass

        # Extract cookies before exit
        cookies = context.cookies()
        cookie_header = "; ".join([f"{c['name']}={c['value']}" for c in cookies])
        
        result = {
            "url": target_url,
            "cookies": cookies,
            "cookie_header": cookie_header,
            "count": len(cookies)
        }
        
        with open(session_output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        print(f"Captured {len(cookies)} cookies successfully.", flush=True)
        browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python browser_login_agent.py <url> <output_json_path>")
        sys.exit(1)
    open_login_browser(sys.argv[1], sys.argv[2])
