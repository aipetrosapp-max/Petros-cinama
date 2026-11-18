import requests
import re
import json

def verify_code():
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

    url = 'https://www.instagram.com/api/v1/accounts/check_confirmation_code/'
    post_headers = {
        'User-Agent': headers['User-Agent'],
        'X-CSRFToken': csrf,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    payload = {
        'code': '533103',
        'email': 'aipetros.app@gmail.com'
    }
    resp = s.post(url, data=payload, headers=post_headers)
    print("Check code status:", resp.status_code)
    try:
        print("Response JSON:", resp.json())
    except Exception:
        print("Response Text:", resp.text[:200])

if __name__ == '__main__':
    verify_code()
