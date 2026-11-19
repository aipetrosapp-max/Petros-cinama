"""
Petros Cinema — VIP site auto-login & session extractor.

Logs into the OWNER's own VIP account on a site with the credentials the
owner provides, then extracts the session cookies to a vault file
(data/browser_sessions/<host>.json) so subsequent link checks can download
with the owner's entitlement.

Usage: python vip_auto_login.py <site_url> <username> <password> <output_json>
"""
import sys
import json
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

LOGIN_PATHS = ("/login", "/sign-in", "/signin", "/auth/login", "/wp-login.php", "/account/login")


def find_password_field(page):
    try:
        return page.query_selector("input[type=password]:visible")
    except Exception:
        return None


def vip_login(site_url: str, username: str, password: str, out_path: str) -> dict:
    result = {
        "url": site_url,
        "host": urlsplit(site_url).hostname or "",
        "ok": False,
        "count": 0,
        "logged_in": False,
        "message": "",
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA)
        page = context.new_page()
        try:
            page.goto(site_url, wait_until="domcontentloaded", timeout=35000)
        except Exception as e:
            result["message"] = f"باز شدن سایت ناموفق بود: {e}"
            json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            browser.close()
            return result

        # If no password field on the landing page, try common login paths.
        if find_password_field(page) is None:
            for path in LOGIN_PATHS:
                try:
                    page.goto(site_url.rstrip("/") + path, wait_until="domcontentloaded", timeout=20000)
                    if find_password_field(page):
                        break
                except Exception:
                    continue

        pw = find_password_field(page)
        if pw is None:
            result["message"] = "فرم لاگین پیدا نشد — لاگین دستی لازم است (دکمه مرورگر زنده)."
            json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            browser.close()
            return result

        # Username-like field nearest to the password input.
        user = None
        for sel in (
            'input[name*=user i]', 'input[name*=email i]', 'input[name*=login i]',
            'input[id*=user i]', 'input[id*=email i]', 'input[type=email]',
            'input[type=text]:visible', 'input[type=tel]:visible'
        ):
            try:
                el = page.query_selector(sel)
                if el:
                    user = el
                    break
            except Exception:
                continue

        try:
            if user:
                user.fill(username, timeout=5000)
            pw.fill(password, timeout=5000)
            submitted = False
            for sel in (
                'button[type=submit]', 'input[type=submit]',
                'button:has-text("ورود")', 'button:has-text("Login")',
                'button:has-text("Sign in")', 'form button'
            ):
                try:
                    btn = page.query_selector(sel)
                    if btn:
                        btn.click(timeout=5000)
                        submitted = True
                        break
                except Exception:
                    continue
            if not submitted:
                pw.press("Enter")
        except Exception as e:
            result["message"] = f"پر کردن فرم ناموفق بود: {e}"
            json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            browser.close()
            return result

        # Wait for post-login load.
        try:
            page.wait_for_load_state("networkidle", timeout=25000)
        except Exception:
            pass
        page.wait_for_timeout(2500)

        cookies = context.cookies()
        header = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
        auth_like = [
            c["name"] for c in cookies
            if any(k in c["name"].lower() for k in ("auth", "sess", "token", "login", "user", "logged", "hash", "wordpress"))
        ]
        logged_in = bool(cookies) and (len(auth_like) > 0 or len(cookies) > 2)

        result.update(
            ok=bool(cookies),
            count=len(cookies),
            logged_in=bool(logged_in),
            auth_cookies=auth_like,
            cookies=cookies,
            cookie_header=header,
            message="ورود موفق و نشست استخراج شد." if logged_in else "کوکی گرفته شد اما نشست احراز هویت معلوم نیست.",
        )
        json.dump(result, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        browser.close()
        return result


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(json.dumps({"ok": False, "message": "usage: vip_auto_login.py <url> <user> <pass> <out>"}))
        sys.exit(1)
    res = vip_login(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    # Windows console may not be UTF-8 — keep stdout ASCII-safe
    print(json.dumps({k: res[k] for k in ("ok", "count", "logged_in", "message")}, ensure_ascii=True))
