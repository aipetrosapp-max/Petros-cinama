import os
import json

OUTPUT_DIR = 'marketing_campaigns/blitz_outreach'
os.makedirs(OUTPUT_DIR, exist_ok=True)

DOMAIN = 'https://aipetros.xyz'
SLOGAN = 'بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!'

BLITZ_CAMPAIGN = {
    'campaign_title': 'عملیات سونامی ۲۴ ساعته پتروس سینما (Iran Cinema Blitz)',
    'target_domain': DOMAIN,
    'core_slogan': SLOGAN,
    'channels': {
        'influencer_dms': {
            'target_types': 'پیج‌های نقد فیلم، اینفلوئنسرهای فناوری/گجت، پیج‌های انیمه و یوتیوبرهای ایرانی',
            'dm_template_cinema_reviewers': f"""سلام و درود! 🎬
ما پلتفرم استریم اختصاصی AI Petros Cinema رو با یک هدف شفاف بالا آوردیم:
«پایان دوران اشتراک‌های گرون‌قیمت و سانسورهای اعصاب‌خردکن».

شعار ما: «{SLOGAN}»
تمام فیلم‌ها، سریال‌ها و انیمه‌های روز دنیا با کیفیت واقعی 4K HDR، بدون سانسور و ۱۰۰٪ کاملاً رایگان روی وب‌اپلیکیشن اختصاصی ما پخش میشن.
خوشحال میشیم به عنوان یکی از اولین متخصصین سینما، کیفیت پخش و صدای باینورال رو تست کنید:
👉 {DOMAIN}

اگر مایل بودید، آماده همکاری ویژه و پروموت در پلتفرم هستیم! 🌟""",
            'dm_template_tech_influencers': f"""سلام وقت بخیر! 🚀
یه وب‌اپلیکیشن PWA کاملاً جدید بر پایه هوش مصنوعی برای تماشای فیلم و انیمه بالا آوردیم به اسم AI Petros Cinema:
بدون نیاز به نصب، بدون فیلترشکن، استریم مستقیم 4K با هدرهای Range و صدای سه‌بعدی.
آدرس: {DOMAIN}
دوست داشتیم تستش کنید و نظرتون رو بهمون بگید!"""
        },
        'viral_comments_under_trending_posts': {
            'strategy': 'کامنت‌های تاپ زیر آخرین پست‌های پیج‌های میلیونی فیلم‌نیوز، سینماتیکت، زومجی و پیج‌های انیمه',
            'comments': [
                f"دیگه واقعاً پول اشتراک فیلیمو و نماوا دادن اشتباهه! پتروس سینما تمام فیلم و انیمه‌ها رو 4K بدون سانسور رایگان گذاشته: {DOMAIN}",
                f"اگه دنبال یه سایت بدون قطعی و فیلتر برای دیدن فیلم و انیمه با کیفیت 4K هستید حتما {DOMAIN} رو تست کنید، بدون ثبت‌نام پخش میکنه.",
                f"«{SLOGAN}» بالاخره یه پلتفرم اومد که فیلم دیدن رو پولی نکرد! دمشون گرم: {DOMAIN}"
            ]
        },
        'telegram_supergroups_broadcast': {
            'target': 'سوپرگروه‌های چت سینمایی، گروه‌های دانشجویی، کانال‌های انیمه و تبادلات شبانه',
            'message': f"""🔥 **خبر فوری برای عاشقان فیلم، سریال و انیمه!**

دیگه نیازی به خرید اشتراک، لینک‌های خراب یا فیلترشکن‌های پرقطعی ندارید!
پلتفرم هوشمند **AI Petros Cinema** رسماً در دسترس قرار گرفت:

🎬 **{SLOGAN}**

✨ ۱۰۰٪ کاملاً رایگان برای همیشه
✨ کیفیت خارق‌العاده 4K بدون افت سرعت
✨ بدون هیچ‌گونه سانسور و حذفیات
✨ تماشای مستقیم روی گوشی و لپ‌تاپ:

🌐 **ورود به سالن پخش اختصاصی:**
👉 {DOMAIN}"""
        },
        'twitter_viral_storm': {
            'tweets': [
                f"دوستان این وب‌سایت {DOMAIN} رو بوک‌مارک کنید. هر فیلم و انیمه‌ای که فکرشو بکنید با کیفیت 4K و بدون سانسور کاملاً رایگان پخش میکنه. بدون اشتراک! ریتوییت کنید بقیه هم استفاده کنن.",
                f"پایان دوران اشتراک‌های پولی فیلم و سریال در ایران!\nپتروس سینما با شعار «{SLOGAN}» استارت زد.\nورود مستقیم: {DOMAIN}"
            ]
        }
    }
}

def export_blitz():
    json_path = os.path.join(OUTPUT_DIR, 'blitz_dispatch_matrix.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(BLITZ_CAMPAIGN, f, ensure_ascii=False, indent=2)

    md_path = os.path.join(OUTPUT_DIR, 'BLITZ_ACTION_PLAN.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# ⚡ برنامه اقدام فوری سونامی ۲۴ ساعته پتروس سینما\n\n")
        f.write(f"**دامنه رسمی:** `{DOMAIN}`\n")
        f.write(f"**شعار:** `{SLOGAN}`\n\n---\n\n")
        f.write("### ۱. دایرکت آماده برای اینفلوئنسرهای سینمایی و تکنولوژی:\n")
        f.write(f"```text\n{BLITZ_CAMPAIGN['channels']['influencer_dms']['dm_template_cinema_reviewers']}\n```\n\n")
        f.write("### ۲. کامنت‌های آماده برای ترند شدن زیر پست‌های داغ:\n")
        for c in BLITZ_CAMPAIGN['channels']['viral_comments_under_trending_posts']['comments']:
            f.write(f"- `{c}`\n")
        f.write("\n### ۳. پیام آماده ارسال برای سوپرگروه‌ها و کانال‌ها:\n")
        f.write(f"```text\n{BLITZ_CAMPAIGN['channels']['telegram_supergroups_broadcast']['message']}\n```\n")

    print("✅ Blitz campaign matrix exported successfully.")

if __name__ == '__main__':
    export_blitz()
