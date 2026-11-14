# -*- coding: utf-8 -*-
import re
import urllib.request
import urllib.parse
import json

def format_rich_caption(raw_text: str) -> str:
    persian_title = None
    quality = None
    audio = None

    for line in raw_text.splitlines():
        l_str = line.strip()
        if re.search(r'1080p', l_str, re.IGNORECASE):
            quality = '1080p Full HD'
        elif re.search(r'720p', l_str, re.IGNORECASE):
            quality = '720p HD'
        elif re.search(r'480p', l_str, re.IGNORECASE):
            quality = '480p SD'
        elif re.search(r'4k|2160p', l_str, re.IGNORECASE):
            quality = '4K Ultra HD'

        if 'دوبله' in l_str:
            audio = 'دوبله فارسی'
        elif 'زیرنویس' in l_str:
            audio = 'زیرنویس چسبیده فارسی'

        if not persian_title and re.search(r'[\u0600-\u06FF]', l_str):
            clean = re.sub(r'^[^\w\u0600-\u06FF]+', '', l_str).strip()
            if not any(k in clean for k in ['زیرنویس', 'کیفیت', 'کانال', 'صوت', 'دانلود', 'فایل']):
                persian_title = clean

    m = re.search(r'([A-Za-z0-9\s:\-\.\']+?)\s*\(?((?:19|20)\d{2})\)?', raw_text)
    eng_title = None
    imdb_id = None
    actors = None
    year = None

    if m:
        t_clean = m.group(1).strip(' -:•\t\n')
        year = m.group(2)
        try:
            q = urllib.parse.quote(f"{t_clean} {year}")
            url = f"https://v3.sg.media-imdb.com/suggestion/x/{q}.json"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=4) as r:
                res = json.loads(r.read().decode('utf-8')).get('d', [])
                if res:
                    eng_title = res[0].get('l')
                    year = res[0].get('y') or year
                    actors = res[0].get('s')
                    imdb_id = res[0].get('id')
        except Exception:
            eng_title = t_clean

    lines = []
    main_name = persian_title or eng_title or "فیلم سینمایی"
    header = f"🎬 **{main_name}**"
    if eng_title and persian_title and eng_title.lower() not in persian_title.lower():
        header += f" | **{eng_title}**"
    if year:
        header += f" `({year})`"
    lines.append(header)
    lines.append("")

    if imdb_id:
        lines.append(f"⭐️ **IMDb:** https://www.imdb.com/title/{imdb_id}/")
    if actors:
        lines.append(f"🎭 **بازیگران:** {actors}")
    if quality or audio:
        specs = []
        if quality:
            specs.append(f"📥 **کیفیت:** {quality}")
        if audio:
            specs.append(f"🔊 **صوت/زیرنویس:** {audio}")
        lines.append(" | ".join(specs))

    lines.append("")
    lines.append("🍿 **تماشای آنلاین و بدون فیلتر در پتروس سینما:**")
    lines.append("🌐 https://aipetrosapp-max.github.io/Petros-cinama/")

    return "\n".join(lines)

if __name__ == "__main__":
    sample = """**📺 مردان ایکس: آخر الزمان 🎬 X-Men: Apocalypse 2016

📖 زیرنویس فارسی
📥 کیفیت 1080P

🎯 کانال ما 👈 @THEFILMO041"""
    print(format_rich_caption(sample))
