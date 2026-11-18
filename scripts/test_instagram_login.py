import requests
import re
import json
import time

def test_login():
    s = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    r = s.get('https://www.instagram.com/accounts/login/', headers=headers)
    csrf = s.cookies.get('csrftoken', '')
    if not csrf:
        m = re.search(r'"csrf_token":"([^"]+)"', r.text)
        if m:
            csrf = m.group(1)
            s.cookies.set('csrftoken', csrf, domain='.instagram.com')

    login_url = 'https://www.instagram.com/api/v1/web/accounts/login/ajax/'
    post_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-CSRFToken': csrf,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/accounts/login/',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    timestamp = int(time.time())
    payload = {
        'enc_password': f'#PWD_INSTAGRAM_BROWSER:0:{timestamp}:navwow-7vyqra-Kunzot',
        'username': 'aipetros.app@gmail.com',
        'queryParams': '{}',
        'optIntoOneTap': 'false'
    }

    resp = s.post(login_url, data=payload, headers=post_headers)
    print("Response code:", resp.status_code)
    try:
        data = resp.json()
        print("Response JSON:", json.dumps(data, indent=2))
        if data.get('authenticated'):
            print("AUTHENTICATED SUCCESSFULLY!")
            cookies = s.cookies.get_dict()
            with open('instagram_session.json', 'w') as f:
                json.dump(cookies, f)
            print("Saved cookies to instagram_session.json")
    except Exception as e:
        print("Non-JSON response:", resp.text[:200])

if __name__ == '__main__':
    test_login()
