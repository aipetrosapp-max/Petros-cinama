import os
import json
from datetime import datetime

OUTPUT_DIR = 'marketing_campaigns'
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_DOMAIN = 'https://aipetros.xyz'

HIGHLIGHT_MOVIES = [
    {
        'title': 'Interstellar',
        'titleFa': 'میان‌ستاره‌ای',
        'hook': 'یکی از شاهکارهای تاریخ سینما که تا ثانیه آخر نفستونو حبس میکنه...',
        'genre': 'علمی-تخیلی / کیهانی',
        'quality': '4K HDR Cinema',
        'audio': 'صدای فضایی سه‌بعدی و باینورال'
    },
    {
        'title': 'The Batman (2022)',
        'titleFa': 'بتمن',
        'hook': 'تاریک‌ترین و خفن‌ترین نسخه بتمن در گاتهام سیتی...',
        'genre': 'اکشن / نوآر / معمایی',
        'quality': '4K UHD ProRes',
        'audio': 'دالبی اتموس بدون سانسور'
    },
    {
        'title': 'Dune',
        'titleFa': 'تلماسه',
        'hook': 'سفر به سیاره شنی آراکیس با جلوه‌های بصری خیره‌کننده...',
        'genre': 'حماسی / فانتزی',
        'quality': '1080p 60FPS',
        'audio': 'موسیقی هانس زیمر با نهایت تفکیک صدا'
    },
    {
        'title': 'Blade Runner 2049',
        'titleFa': 'بلید رانر ۲۰۴۹',
        'hook': 'اوج هنر سینمای سایبرپانک و فضاسازی خیره‌کننده نئونی...',
        'genre': 'سایبرپانک / درام',
        'quality': 'Full HD Master',
        'audio': 'صدای سینمایی فراگیر'
    },
    {
        'title': 'X-Men: Apocalypse',
        'titleFa': 'مردان ایکس: آخرالزمان',
        'hook': 'نبرد حماسی جهش‌یافتگان علیه قدرتمندترین نیروی باستانی...',
        'genre': 'مارول / اکشن ابرقهرمانی',
        'quality': '4K HDR Studio Master',
        'audio': 'بیت‌ریت فوق‌سریع بدون قطعی'
    }
]

def generate_social_media_packages():
    campaigns = []
    
    for idx, movie in enumerate(HIGHLIGHT_MOVIES, 1):
        pkg = {
            'campaign_id': f'camp_{idx:02d}_{movie["title"].lower().replace(" ", "_")}',
            'target_movie': movie['title'],
            'target_movie_fa': movie['titleFa'],
            'domain_cta': TARGET_DOMAIN,
            'channels': {
                'instagram_reels': {
                    'title': f'ریلز اینستاگرام: تماشای {movie["titleFa"]}',
                    'hook_text': movie['hook'],
                    'caption': f"""🔥 تماشای آنلاین فیلم شاهکار «{movie["titleFa"]}» بدون سانسور با کیفیت سینمایی {movie["quality"]}!

دیگه نیازی به خرید اشتراک‌های گرون‌قیمت یا درگیر شدن با فیلترشکن ندارید. 
در پلتفرم اختصاصی AI Petros Cinema بدون افت سرعت و با {movie["audio"]} ببینید.

🌐 ورود به سالن آنلاین:
👉 {TARGET_DOMAIN}

#فیلم #سینما #فیلم_خارجی #بدون_سانسور #{movie["title"].replace(" ", "_")} #دانلود_فیلم #پتروس_سینما #4K""",
                    'video_script': f"""[۰ تا ۳ ثانیه]: قلاب بصری شوکه‌کننده از صحنه اکشن/هیجانی {movie["title"]} همراه با متن درشت: «این فیلم رو هنوز ندیدی؟!»
[۳ تا ۱۰ ثانیه]: کات به صحنه‌های جذاب و نمایش لوگوی AI Petros Cinema: «پخش رایگان 4K بدون نیاز به فیلترشکن»
[۱۰ تا ۱۵ ثانیه]: کال‌تو‌اکشن: لینک مستقیم سایت در بایو و آدرس {TARGET_DOMAIN}"""
                },
                'youtube_shorts': {
                    'title': f'{movie["titleFa"]} بدون سانسور 4K | AI Petros Cinema #shorts',
                    'description': f"""تماشای رایگان و بدون سانسور فیلم «{movie["titleFa"]}» با کیفیت 4K در سینمای هوش مصنوعی پتروس:
{TARGET_DOMAIN}

#Shorts #Movies #{movie["title"].replace(" ", "")} #FilmCinema #4KMovies""",
                    'tags': ['فیلم جدید', 'سینما', movie['title'], movie['titleFa'], 'تماشای آنلاین', 'بدون سانسور', '4K HDR', 'پتروس سینما']
                },
                'twitter_x_reddit': {
                    'tweet': f"""اگه دنبال یه شاهکار واقعی با کیفیت 4K واقعی و صدای دالبی هستید، «{movie["titleFa"]}» رو از دست ندید.
پخش مستقیم، بدون قطعی، بدون سانسور و کاملاً رایگان در پتروس سینما:
👇
{TARGET_DOMAIN}

#{movie["title"].replace(" ", "_")} #سینما #فیلم""",
                    'reddit_post': {
                        'subreddit': 'r/iranian / r/PersianCinema',
                        'title': f'پلتفرم اختصاصی تماشای فیلم 4K بدون نیاز به VPN — {movie["titleFa"]}',
                        'body': f"""سلام به همه،
برای تماشای فیلم‌ها با کیفیت اورجینال بدون مشکل سرعت و قطعی، سیستم AI Petros Cinema فعال شده و تماشای آنلاین فیلم‌هایی مثل {movie["titleFa"]} رو با پلیر اختصاصی بدون لگ فراهم کرده:
{TARGET_DOMAIN}"""
                    }
                }
            }
        }
        campaigns.append(pkg)
    
    output_file = os.path.join(OUTPUT_DIR, 'live_viral_campaigns.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(campaigns, f, ensure_ascii=False, indent=2)
    
    # Save a readable Persian guide
    guide_file = os.path.join(OUTPUT_DIR, 'README_CAMPAIGNS.md')
    with open(guide_file, 'w', encoding='utf-8') as f:
        f.write(f"# 📢 پکیج‌های تبلیغاتی آماده انتشار پتروس سینما ({TARGET_DOMAIN})\n\n")
        for c in campaigns:
            f.write(f"## 🎬 کمپین: {c['target_movie_fa']} ({c['target_movie']})\n")
            f.write(f"**آدرس ورود مستقیم:** `{c['domain_cta']}`\n\n")
            f.write("### اینستاگرام (Reels):\n")
            f.write(f"```text\n{c['channels']['instagram_reels']['caption']}\n```\n\n")
            f.write("### توییتر / تلگرام:\n")
            f.write(f"```text\n{c['channels']['twitter_x_reddit']['tweet']}\n```\n\n")
            f.write("---\n\n")

    print(f"✅ Generated {len(campaigns)} viral multi-channel marketing campaigns targeting {TARGET_DOMAIN}")

if __name__ == '__main__':
    generate_social_media_packages()
