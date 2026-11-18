import os
import json

OUTPUT_DIR = 'marketing_campaigns'
os.makedirs(OUTPUT_DIR, exist_ok=True)

DOMAIN = 'https://aipetros.xyz'
CORE_SLOGAN = 'بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!'

CAMPAIGN_PACKAGES = [
    {
        'platform': 'Instagram (Reels, Story, Feed)',
        'target_audience': 'علاقه‌مندان فیلم، سریال و انیمه در ایران (کاربران خسته از اشتراک فیلیمو/نماوا)',
        'core_message': '۱۰۰٪ کاملاً رایگان • بدون سانسور • بدون اشتراک • کیفیت 4K و صدای سه‌بعدی',
        'hook': '❌ دیگه یک ریال هم پول اشتراک فیلم و سریال نده!',
        'caption': f"""🎬 {CORE_SLOGAN}

💥 دورهٔ اشتراک‌های گرون‌قیمت، سانسورهای اعصاب‌خردکن و سرعت پایین تموم شد!
در پلتفرم هوشمند AI Petros Cinema به بزرگترین آرشیو فیلم‌های روز جهان، سریال‌ها و انیمه‌ها دسترسی داری:

✨ ۱۰۰٪ کاملاً رایگان برای همیشه
✨ کیفیت سینمایی 4K HDR با صدای سه‌بعدی
✨ بدون هیچ‌گونه سانسور و حذفیات
✨ بدون نیاز به نصب یا فیلترشکن (PWA پرسرعت)

🌐 همین الان وارد سالن سینما شو:
👉 {DOMAIN}

#فیلم #سریال #انیمه #دانلود_فیلم #فیلم_رایگان #بدون_سانسور #انیمه_بدون_سانسور #پتروس_سینما #4K""",
        'reel_storyboard': f"""• ثانیه ۰ تا ۳: نمایش پیام اخطار قرمز رنگ: «چرا هنوز داری برای فیلم دیدن پول اشتراک میدی؟!»
• ثانیه ۳ تا ۸: ورق زدن سریع پوستر انیمه‌ها و فیلم‌های هالیوودی در پتروس سینما با اسکرول نرم و کیفیت 4K.
• ثانیه ۸ تا ۱۲: نمایش متن طلایی: «{CORE_SLOGAN}»
• ثانیه ۱۲ تا ۱۵: اشاره به لینک ورود مستقیم در بایو: {DOMAIN}"""
    },
    {
        'platform': 'Telegram Channels & Groups (رسمی و تبادلی)',
        'target_audience': 'کانال‌های فیلم و سینما، انیمه‌بازها و سوپرگروه‌های دانشجویی/دانلودی',
        'post_text': f"""🔥 **پایان دوران اشتراک‌های پولی!**

🎬 **{CORE_SLOGAN}**

دیگه لازم نیست برای دیدن فیلم و انیمه دنبال لینک سالم و فیلترشکن بگردی یا ماهانه کلی پول بدی!

🌟 **پلتفرم اختصاصی پتروس سینما (AI Petros Cinema):**
✅ ۱۰۰٪ کاملاً رایگان
✅ کیفیت شگفت‌انگیز 4K بدون افت سرعت
✅ بدون سانسور با صدای دالبی باینورال
✅ تماشای مستقیم روی آیفون، اندروید و کامپیوتر

👇 **ورود مستقیم و تماشا در سالن سینما:**
🌐 {DOMAIN}"""
    },
    {
        'platform': 'YouTube Shorts & TikTok',
        'target_audience': 'بینندگان یوتیوب فارسی و علاقه‌مندان به شورتس و انیمه',
        'title': f'{CORE_SLOGAN} | معرفی AI Petros Cinema #Shorts',
        'script': f"""میدونستی الان یه سایتی اومده که هر فیلم، سریال و انیمه‌ای که فکرشو بکنی رو با کیفیت 4K بدون سانسور و کاملاً رایگان پخش میکنه؟
نه اشتراک میخواد، نه ثبت‌نام پیچیده!
آدرسش اینه: {DOMAIN}
برو ببین و حالشو ببر!""",
        'description': f"""{CORE_SLOGAN}
تماشای آنلاین و کاملاً رایگان فیلم، سریال و انیمه با کیفیت 4K در AI Petros Cinema:
{DOMAIN}

#فیلم #سریال #انیمه #رایگان #Shorts #Movies"""
    },
    {
        'platform': 'Twitter / X & Reddit (فروم‌ها و شبکه‌های متنی)',
        'target_audience': 'جامعه گیمرها، ماشین‌بازها، انیمه‌فن‌ها و خوره فیلم‌های توییتر و ردیت',
        'tweet_thread': [
            f"۱/ اگر شما هم از سانسورهای عجیب و غریب پلتفرم‌های داخلی و هزینه‌های بالای اشتراک خسته شدید، این سایت رو بوک‌مارک کنید:\n\n{DOMAIN}",
            f"۲/ پلتفرم پتروس سینما یه شعار جذاب داره: «{CORE_SLOGAN}»\nنه نیازی به ثبت کارت بانکی هست، نه اشتراک ماهیانه. تمام آرشیو به صورت 4K و رایگان پخش میشه.",
            f"۳/ پلیرش کاملاً درون‌برنامه‌ایه و روی وب‌اپ (PWA) با بالاترین بیت‌ریت و بدون لگ لود میشه.\nپیشنهاد میکنم امشب یه فیلم 4K رو باهاش تست کنید: {DOMAIN}"
        ],
        'reddit_post': {
            'subreddit': 'r/iranian / r/AnimePersian / r/PersianCinema',
            'title': f'معرفی پلتفرم پتروس سینما: {CORE_SLOGAN}',
            'body': f"""سلام دوستان،
برای اونایی که دنبال یه جا بدون سانسور با کیفیت بالا برای فیلم و انیمه هستن که نخوان ماهانه هزینه کنن، پتروس سینما با شعار «{CORE_SLOGAN}» بالا اومده.
سایت رو بدون افت سرعت و بدون نیاز به نصب از لینک زیر میتونید ببینید:
{DOMAIN}"""
        }
    }
]

def build_free_unlimited_marketing_vault():
    vault_file = os.path.join(OUTPUT_DIR, 'free_unlimited_master_campaigns.json')
    with open(vault_file, 'w', encoding='utf-8') as f:
        json.dump(CAMPAIGN_PACKAGES, f, ensure_ascii=False, indent=2)

    readme_file = os.path.join(OUTPUT_DIR, 'FREE_UNLIMITED_CAMPAIGNS.md')
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write(f"# 🚀 کمپین رسمی و سراسری «کاملاً رایگان و نامحدود» پتروس سینما\n\n")
        f.write(f"### 🎯 شعار محوری: **{CORE_SLOGAN}**\n")
        f.write(f"🌐 **دامنه مقصد:** `{DOMAIN}`\n\n---\n\n")
        for pkg in CAMPAIGN_PACKAGES:
            f.write(f"## 📱 پلتفرم: {pkg['platform']}\n")
            f.write(f"**مخاطب هدف:** {pkg.get('target_audience', 'عمومی')}\n\n")
            if 'caption' in pkg:
                f.write(f"**کپشن آماده اینستاگرام:**\n```text\n{pkg['caption']}\n```\n\n")
            if 'post_text' in pkg:
                f.write(f"**متن آماده تلگرام:**\n```text\n{pkg['post_text']}\n```\n\n")
            if 'tweet_thread' in pkg:
                f.write(f"**رشته‌توییت X:**\n```text\n" + "\n\n".join(pkg['tweet_thread']) + "\n```\n\n")
            f.write("---\n\n")

    print(f"✅ Generated Free Unlimited Master Campaigns with official slogan: '{CORE_SLOGAN}'")

if __name__ == '__main__':
    build_free_unlimited_marketing_vault()
