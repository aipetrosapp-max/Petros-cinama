import urllib.request
import urllib.parse

DOMAIN = 'https://aipetros.xyz'
SITEMAP_URL = f'{DOMAIN}/sitemap.xml'

PING_TARGETS = [
    ('Google', f'https://www.google.com/ping?sitemap={urllib.parse.quote(SITEMAP_URL)}'),
    ('Bing / IndexNow', f'https://www.bing.com/ping?sitemap={urllib.parse.quote(SITEMAP_URL)}')
]

def ping_search_engines():
    print("🚀 Pinging search engines to accelerate Google rank #1 indexing...")
    for engine, url in PING_TARGETS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                print(f"✅ {engine} ping response: HTTP {resp.status}")
        except Exception as e:
            print(f"⚠️ {engine} ping attempted: {e}")

if __name__ == '__main__':
    ping_search_engines()
