#!/usr/bin/env python3
"""
AI Petros (Petros Cinema) - Programmatic SEO (pSEO) & Landing Page Engine
Generates ultra-fast static HTML landing pages with complete Schema.org JSON-LD,
OpenGraph, and Twitter Cards to rank #1 on Google for high-intent queries in Iran & globally.
"""

import os
import json
import re
import html
from typing import List, Dict, Any

BASE_URL = "https://aipetrosapp-max.github.io/Petros-cinama"
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "seo"))
DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dist", "seo"))
STREAMS_PATHS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "streams.json")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "streams.json"))
]

FALLBACK_MOVIES = [
    {
        "id": "petros-stream-xmen-apocalypse",
        "titleFa": "مردان ایکس: آخرالزمان (X-Men: Apocalypse)",
        "titleEn": "X-Men: Apocalypse",
        "year": "2016",
        "categoryFa": "علمی-تخیلی و اکشن",
        "categoryEn": "Sci-Fi / Action",
        "synopsisFa": "با ظهور نخستین و قدرتمندترین جهش‌یافته باستانی، مردان ایکس برای نجات تمدن بشری از نابودی مطلق متحد می‌شوند.",
        "synopsisEn": "As the first and most powerful ancient mutant awakens, the X-Men must unite to defeat his extinction plot.",
        "posterUrl": "https://image.tmdb.org/t/p/w780/2mtx2v9vFhG722Yg1g6x8N.jpg",
        "rating": "8.8"
    },
    {
        "id": "petros-stream-interstellar",
        "titleFa": "میان‌ستاره‌ای (Interstellar)",
        "titleEn": "Interstellar",
        "year": "2014",
        "categoryFa": "علمی-تخیلی ماجراجویی",
        "categoryEn": "Sci-Fi / Adventure",
        "synopsisFa": "گروهی از کاوشگران با عبور از کرم‌چاله‌ای در فضا تلاش می‌کنند تا بقای نسل بشر را در سیارات دوردست تضمین کنند.",
        "synopsisEn": "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        "posterUrl": "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "rating": "8.7"
    },
    {
        "id": "petros-stream-inception",
        "titleFa": "تلقین (Inception)",
        "titleEn": "Inception",
        "year": "2010",
        "categoryFa": "اکشن و دلهره‌آور",
        "categoryEn": "Action / Sci-Fi",
        "synopsisFa": "دزدی که اسرار شرکت‌ها را با ورود به ناخودآگاه هدف‌هایش در حین خواب می‌دزدد، مأموریتی برعکس برای کاشت یک ایده دریافت می‌کند.",
        "synopsisEn": "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.",
        "posterUrl": "https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        "rating": "8.8"
    }
]

COMPARISON_CAMPAIGNS = [
    {
        "slug": "filimo-namava-free-alternative",
        "titleFa": "بهترین جایگزین رایگان فیلیمو و نماوا بدون سانسور | Petros Cinema",
        "titleEn": "Best 100% Free Filimo & Namava Alternative (No Censorship) | AI Petros",
        "metaDescFa": "پایان دوران اشتراک‌های گران‌قیمت ماهانه! تماشای تمام فیلم‌ها و سریال‌های روز دنیا با کیفیت 4K، بدون سانسور و با زیرنویس فارسی چسبیده ۱۰۰٪ رایگان و بدون ثبت‌نام.",
        "metaDescEn": "Stop paying expensive monthly subscriptions. Stream the latest global movies and series in 4K HDR, uncompressed audio, and zero censorship for free on AI Petros.",
        "h1Fa": "چرا Petros Cinema قاتل اشتراک‌های پولی فیلیمو و نماوا است؟",
        "h1En": "Why AI Petros is the Ultimate Free Alternative to Paid Streaming Services",
        "contentFa": """
        <p>در دورانی که کاربران ایرانی برای تماشای فیلم‌های سانسورشده و کم‌کیفیت مجبور به پرداخت هزینه‌های سنگین ماهانه به فیلیمو، نماوا و فیلم‌نت هستند، <strong>Petros Cinema</strong> با معماری نوین وب و هوش مصنوعی آمده تا مفهوم تماشای آنلاین را دگرگون کند.</p>
        <h2>مزایای انحصاری Petros Cinema نسبت به پلتفرم‌های پولی:</h2>
        <ul>
            <li><strong>۱۰۰٪ رایگان برای همیشه:</strong> هیچ نیازی به خرید اشتراک، شارژ حساب، یا وارد کردن کارت بانکی نیست.</li>
            <li><strong>بدون سانسور و بدون حذفیات:</strong> تمامی آثار به صورت دست‌نخورده با نسخه کارگردان و زیرنویس اختصاصی فارسی عرضه می‌شوند.</li>
            <li><strong>کیفیت فوق‌العاده 4K HDR و صدای سه‌بعدی:</strong> استریم مستقیم و پرسرعت بدون بافر و افت فریم.</li>
            <li><strong>بدون نیاز به نصب از اپ‌استور:</strong> وب‌اپلیکیشن PWA سبک و مدرن که در ۲ ثانیه روی آیفون، اندروید، تلویزیون هوشمند و ویندوز فعال می‌شود.</li>
            <li><strong>اتاق تماشای همزمان (Watch-Party):</strong> با دوستان و پارتنر خود از هر نقطه‌ای به طور همزمان فیلم ببینید و چت کنید.</li>
        </ul>
        """,
        "keywords": "جایگزین فیلیمو, جایگزین نماوا, دانلود رایگان فیلم, تماشای آنلاین بدون اشتراک, فیلم بدون سانسور, نتفلیکس رایگان ایرانی"
    },
    {
        "slug": "free-movies-no-subscription",
        "titleFa": "تماشای آنلاین رایگان فیلم و سریال بدون اشتراک و ثبت‌نام ۲۰۲۶ | Petros Cinema",
        "titleEn": "Watch Free Movies & TV Shows Online No Subscription 2026 | AI Petros",
        "metaDescFa": "کامل‌ترین آرشیو فیلم‌ها و سریال‌های ۲۰۲۶ هالیوود، کره، انیمه و جهان با پخش زنده و رایگان بدون ثبت‌نام در پتروس سینما.",
        "metaDescEn": "Stream thousands of latest movies and TV shows in pristine 4K HDR online without signup or subscription.",
        "h1Fa": "تماشای آنلاین هزاران فیلم و سریال برتر جهان بدون پرداخت یک ریال",
        "h1En": "Stream Unlimited Blockbusters Online with Zero Paywalls",
        "contentFa": """
        <p>دیگر نیازی به ثبت‌نام‌های وقت‌گیر و خرید اشتراک ندارید. تنها با یک کلیک وارد آرشیو عظیم <strong>Petros Cinema</strong> شوید و هر فیلمی را با کیفیت کریستالی تماشا کنید.</p>
        """,
        "keywords": "تماشای آنلاین فیلم بدون اشتراک, فیلم رایگان, دانلود فیلم 2026, تماشای فیلم خارجی رایگان"
    },
    {
        "slug": "free-netflix-alternative-2026",
        "titleFa": "Best Free Netflix Alternative 2026 (No Signup, No Ads) | AI Petros",
        "titleEn": "Best Free Netflix Alternative 2026 (No Signup, No Ads) | AI Petros",
        "metaDescFa": "بهترین جایگزین جهانی نتفلیکس در سال ۲۰۲۶ بدون اشتراک و بدون کارت اعتباری با پشتیبانی از زبان فارسی و انگلیسی.",
        "metaDescEn": "Looking for a genuine free Netflix alternative in 2026? AI Petros offers a decentralized VIP cinema streaming experience with zero ads and zero subscriptions.",
        "h1Fa": "The Death of Paid Streaming: Welcome to AI Petros Cinema",
        "h1En": "The Death of Paid Streaming: Welcome to AI Petros Cinema",
        "contentFa": """
        <p>Frustrated with price hikes, geo-restrictions, and fragmented libraries across Netflix, Disney+, and HBO Max? AI Petros brings a single unified VIP cinema dashboard directly to your browser.</p>
        <ul>
            <li>No Credit Card or KYC required</li>
            <li>Ultra-High Bitrate 4K HDR + Dolby Atmos Acoustic waveforms</li>
            <li>Decentralized Telegram Cloud stream ingest</li>
            <li>Zero buffering, adaptive spatial playback engine</li>
        </ul>
        """,
        "keywords": "free netflix alternative, stream movies free no signup, watch series free online 2026, stremio alternative web"
    }
]

def load_catalog() -> List[Dict[str, Any]]:
    for path in STREAMS_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
                    if isinstance(data, dict) and "streams" in data:
                        return data["streams"]
            except Exception as e:
                print(f"⚠️ Error reading catalog from {path}: {e}")
    return FALLBACK_MOVIES

def sanitize_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\[Telegram/.*?\]", "", text)
    text = re.sub(r"https?://t\.me/\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"Telegram\s+Cinema\s+Post\s*#?(\d+)", r"Featured Cinema Stream #\1", text, flags=re.I)
    return text.strip()

def build_html_page(
    title: str,
    meta_desc: str,
    keywords: str,
    h1: str,
    body_html: str,
    canonical_url: str,
    og_image: str = "",
    schema_json: Dict[str, Any] = None,
    movie_id: str = ""
) -> str:
    escaped_title = html.escape(title)
    escaped_desc = html.escape(meta_desc)
    escaped_keywords = html.escape(keywords)
    escaped_h1 = html.escape(h1)
    if not og_image:
        og_image = f"{BASE_URL}/logo.svg"

    app_target_url = f"{BASE_URL}/#watch={movie_id}" if movie_id else BASE_URL

    json_ld_scripts = ""
    if schema_json:
        json_ld_scripts += f'\n<script type="application/ld+json">\n{json.dumps(schema_json, ensure_ascii=False, indent=2)}\n</script>'

    # Default FAQ Schema for rich search appearance
    faq_schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "آیا تماشای فیلم در Petros Cinema واقعاً ۱۰۰٪ رایگان است؟",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "بله! پتروس سینما کاملاً رایگان، بدون نیاز به اشتراک، بدون ثبت‌نام و بدون سانسور طراحی شده است."
                }
            },
            {
                "@type": "Question",
                "name": "How to watch movies on AI Petros?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Simply open the web application on any device (iOS, Android, Smart TV, Mac, Windows) and tap Play immediately with zero paywalls."
                }
            }
        ]
    }
    json_ld_scripts += f'\n<script type="application/ld+json">\n{json.dumps(faq_schema, ensure_ascii=False, indent=2)}\n</script>'

    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escaped_title}</title>
  <meta name="description" content="{escaped_desc}">
  <meta name="keywords" content="{escaped_keywords}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="{canonical_url}">

  <!-- OpenGraph / Facebook / Telegram -->
  <meta property="og:type" content="video.movie">
  <meta property="og:title" content="{escaped_title}">
  <meta property="og:description" content="{escaped_desc}">
  <meta property="og:url" content="{canonical_url}">
  <meta property="og:site_name" content="AI Petros (Petros Cinema)">
  <meta property="og:image" content="{og_image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped_title}">
  <meta name="twitter:description" content="{escaped_desc}">
  <meta name="twitter:image" content="{og_image}">

  <!-- Preconnect Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Vazirmatn:wght@400;600;700;900&display=swap" rel="stylesheet">

  {json_ld_scripts}

  <style>
    :root {{
      --obsidian: #050508;
      --gold: #D4AF37;
      --gold-glow: rgba(212, 175, 55, 0.4);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--obsidian);
      color: #E2E8F0;
      font-family: 'Vazirmatn', -apple-system, sans-serif;
      line-height: 1.7;
      padding: 0;
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}
    .header {{
      background: rgba(11, 12, 16, 0.9);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(212, 175, 55, 0.25);
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
    }}
    .brand {{
      font-family: 'Cinzel', serif;
      font-weight: 900;
      font-size: 1.35rem;
      color: var(--gold);
      letter-spacing: 0.15em;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}
    .brand-badge {{
      font-size: 0.65rem;
      padding: 0.15rem 0.5rem;
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid var(--gold);
      border-radius: 9999px;
      color: var(--gold);
    }}
    .cta-btn {{
      background: linear-gradient(135deg, #D4AF37, #F5B942, #D4AF37);
      color: #050508;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.6rem 1.4rem;
      border-radius: 9999px;
      text-decoration: none;
      box-shadow: 0 0 20px var(--gold-glow);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }}
    .cta-btn:hover {{
      transform: scale(1.05);
      filter: brightness(1.1);
    }}
    .container {{
      max-width: 900px;
      margin: 2.5rem auto;
      padding: 0 1.25rem;
      flex: 1;
    }}
    h1 {{
      font-size: 1.85rem;
      color: #F8FAFC;
      margin-bottom: 1.25rem;
      line-height: 1.4;
      font-weight: 900;
    }}
    .hero-card {{
      background: #0B0C10;
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 24px;
      padding: 2rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    }}
    .hero-card::before {{
      content: '';
      position: absolute;
      top: -50px;
      right: -50px;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }}
    .poster-img {{
      width: 100%;
      max-height: 440px;
      object-fit: cover;
      border-radius: 16px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);
    }}
    .content-body {{
      font-size: 0.95rem;
      color: #CBD5E1;
      margin-bottom: 1.5rem;
    }}
    .content-body p {{ margin-bottom: 1rem; }}
    .content-body ul {{ margin: 1rem 1.5rem 1.5rem 1.5rem; }}
    .content-body li {{ margin-bottom: 0.5rem; }}
    .footer {{
      background: #0B0C10;
      border-top: 1px solid rgba(212, 175, 55, 0.15);
      padding: 1.5rem;
      text-align: center;
      font-size: 0.75rem;
      color: #64748B;
    }}
  </style>
</head>
<body>
  <header class="header">
    <a href="{BASE_URL}/" class="brand">
      AI PETROS
      <span class="brand-badge">VIP 4K</span>
    </a>
    <a href="{app_target_url}" class="cta-btn">
      🎬 تماشای رایگان در اپ
    </a>
  </header>

  <main class="container">
    <article class="hero-card">
      {f'<img src="{og_image}" alt="{escaped_title}" class="poster-img">' if og_image and og_image != f"{BASE_URL}/logo.svg" else ''}
      <h1>{escaped_h1}</h1>
      <div class="content-body">
        {body_html}
      </div>
      <div style="text-align: center; margin-top: 2rem;">
        <a href="{app_target_url}" class="cta-btn" style="font-size: 1.1rem; padding: 0.85rem 2.2rem;">
          ▶ ورود به سالن پخش و تماشای بدون سانسور
        </a>
      </div>
    </article>
  </main>

  <footer class="footer">
    <p>AI Petros Cinema — Autonomous VIP Streaming Space · 100% Free Forever</p>
    <p style="margin-top: 0.35rem; color: #D4AF37;">قاتل اشتراک‌های پولی فیلیمو، نماوا و نتفلیکس</p>
  </footer>
</body>
</html>
"""

def generate_all_seo_pages():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(DIST_DIR, exist_ok=True)

    catalog = load_catalog()
    print(f"📦 Generating Programmatic SEO pages for {len(catalog)} catalog items & comparison campaigns...")

    generated_urls = []

    # 1. Comparison & Keyword Target Pages
    for camp in COMPARISON_CAMPAIGNS:
        slug = camp["slug"]
        canonical = f"{BASE_URL}/seo/{slug}.html"
        generated_urls.append(canonical)

        schema = {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "AI Petros Cinema",
            "url": canonical,
            "applicationCategory": "EntertainmentApplication",
            "operatingSystem": "All (Web, iOS, Android, Smart TV, Windows)",
            "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "USD"
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "18400"
            }
        }

        html_content = build_html_page(
            title=camp["titleFa"],
            meta_desc=camp["metaDescFa"],
            keywords=camp["keywords"],
            h1=camp["h1Fa"],
            body_html=camp["contentFa"],
            canonical_url=canonical,
            schema_json=schema
        )

        for out_dir in [PUBLIC_DIR, DIST_DIR]:
            out_file = os.path.join(out_dir, f"{slug}.html")
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(html_content)

        print(f"  ✅ Campaign generated: {slug}.html")

    # 2. Movie/Stream Specific Pages
    for idx, item in enumerate(catalog[:50]): # Top 50 movies indexed into static landing pages
        movie_id = item.get("id") or f"stream-{idx}"
        title_en = sanitize_text(item.get("titleEn") or item.get("titleFa") or f"Cinema Movie #{idx}")
        title_fa = sanitize_text(item.get("titleFa") or item.get("titleEn") or f"فیلم سینمایی #{idx}")
        year = str(item.get("releaseYear") or item.get("year") or "2026")
        poster = item.get("posterUrl") or f"{BASE_URL}/logo.svg"
        synopsis_fa = sanitize_text(item.get("synopsisFa") or item.get("synopsisEn") or "تماشای آنلاین و رایگان با کیفیت بالا در پتروس سینما.")
        synopsis_en = sanitize_text(item.get("synopsisEn") or item.get("synopsisFa") or "Stream in high fidelity on AI Petros.")

        slug = f"watch-{re.sub(r'[^a-zA-Z0-9]+', '-', title_en.lower()).strip('-')}"
        if not slug or slug == "watch-":
            slug = f"watch-{movie_id}"
        canonical = f"{BASE_URL}/seo/{slug}.html"
        generated_urls.append(canonical)

        meta_title = f"تماشای آنلاین و رایگان {title_fa} ({year}) بدون سانسور | Petros Cinema"
        meta_desc = f"تماشا و دانلود رایگان فیلم {title_fa} ({year}) با زیرنویس فارسی چسبیده و کیفیت 4K بدون اشتراک در پتروس سینما — {synopsis_fa[:120]}..."
        keywords = f"{title_fa}, دانلود {title_fa}, تماشای آنلاین {title_fa}, زیرنویس فارسی {title_en}, فیلم {year}, petros cinema"

        schema = {
            "@context": "https://schema.org",
            "@type": "Movie",
            "name": title_en,
            "alternateName": title_fa,
            "dateCreated": year,
            "image": poster,
            "description": synopsis_en,
            "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "8.8",
                "bestRating": "10",
                "ratingCount": "2450"
            }
        }

        body_html = f"""
        <p><strong>خلاصه داستان:</strong> {synopsis_fa}</p>
        <p><strong>English Synopsis:</strong> {synopsis_en}</p>
        <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 14px; padding: 1rem; margin: 1.5rem 0;">
            <p style="margin: 0; color: #D4AF37; font-weight: bold;">💎 ویژگی‌های پخش در Petros Cinema:</p>
            <ul style="margin: 0.5rem 1.5rem 0 1.5rem; font-size: 0.9rem;">
                <li>کیفیت دست‌نخورده 4K HDR با صدای چندکاناله</li>
                <li>زیرنویس همگام‌سازی‌شده هوشمند با هوش مصنوعی</li>
                <li>۱۰۰٪ بدون سانسور و بدون پرداخت اشتراک</li>
            </ul>
        </div>
        """

        html_content = build_html_page(
            title=meta_title,
            meta_desc=meta_desc,
            keywords=keywords,
            h1=f"فیلم سینمایی {title_fa} ({year})",
            body_html=body_html,
            canonical_url=canonical,
            og_image=poster,
            schema_json=schema,
            movie_id=movie_id
        )

        for out_dir in [PUBLIC_DIR, DIST_DIR]:
            out_file = os.path.join(out_dir, f"{slug}.html")
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(html_content)

    print(f"🎉 Programmatic SEO build complete! Generated {len(generated_urls)} search-engine pages.")
    return generated_urls

if __name__ == "__main__":
    generate_all_seo_pages()
