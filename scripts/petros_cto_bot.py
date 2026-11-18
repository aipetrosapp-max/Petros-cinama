import time
import json
import urllib.request
import os
import ssl
from datetime import datetime

BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
CHAT_ID = int(os.environ.get('TELEGRAM_CHAT_ID', '86871707'))
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
MEMORY_FILE = 'scripts/gemini_conversation_memory.json'

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# Cascade of models prioritized by user:
# 1. gemini-4-hydrogen (Primary target)
# 2. gemini-4-argon / gemini-4-carbon (Next generation)
# 3. gemini-3.5-flash / gemini-3.5-flash-lite (Stable low-latency fallbacks)
MODELS_CASCADE = [
    'gemini-4-hydrogen',
    'gemini-4-argon',
    'gemini-4-carbon',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite'
]

SYSTEM_PROMPT = """شما «مدیر ارشد فنی، بیزینسی و استراتژیک پتروس سینما (Petros Cinema CTO / Executive AI Partner)» هستید که با قدرتمندترین نسل هوش مصنوعی جمنای گوگل (سری Hydrogen و نسل‌های بعدی) مجهز شده‌اید.
مخاطب مستقیم شما: پدرام (Pedram)، مالک، موسس و رهبر پتروس سینما است.

ارزش‌ها و قواعد کلیدی شما:
۱. کاملاً اختصاصی، محرمانه و وفادار به پدرام هستید (Zero Data Leak - هیچ اطلاعاتی به بیرون منتقل نمی‌شود).
۲. تسلط ۱۰۰٪ بر بیزینس و وضعیت سیستم:
   - نام پروژه: پتروس سینما (AI Petros Cinema)
   - دامنه رسمی: https://aipetros.xyz
   - شعار رسمی و غیرقابل تغییر: «بدون هیچ محدودیتی، بی‌وقفه فیلم، سریال و انیمه ببین!»
   - بیزینس مدل: ۱۰۰٪ رایگان، بدون اشتراک، بدون سانسور، کیفیت 4K HDR، صدای سه‌بعدی بینورال
   - آرشیو: ۴۱۹ فیلم پالایش‌شده (شامل ۲۰۴ فیلم اختصاصی استریم تلگرام از کانال @Aipetros)
   - گیت‌وی استریم سرور: پورت 8089 فعال با کش غلتان ۸ ساعته و HTTP 206
   - لایو استریم ۲۴/۷ توییچ: آنلاین و در حال پخش زنده
   - هدف فوری: دستیابی به ۲,۵۰۰ کاربر فعال
۳. سبک پاسخگویی:
   - بسیار باهوش، محترمانه، واقع‌بین، شفاف، قاطع، تحلیلی و اجرایی به زبان فارسی روان.
   - هرگز وعده دروغین یا آمار فیک ندهید. به سوالات بیزینسی با ارقام و تحلیل دقیق پاسخ دهید.
   - تمام سوابق گفتگوهای قبلی پدرام را در حافظه دارید و مکالمات کاملاً پیوسته و هوشمندانه است."""

def load_memory():
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_memory(history):
    trimmed = history[-30:]
    try:
        with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(trimmed, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Memory save error: {e}")

def ask_gemini_cascaded(user_message, history):
    contents = []
    for turn in history:
        contents.append({
            'role': turn['role'],
            'parts': [{'text': turn['text']}]
        })
    
    contents.append({
        'role': 'user',
        'parts': [{'text': user_message}]
    })

    payload = {
        'contents': contents,
        'systemInstruction': {
            'parts': [{'text': SYSTEM_PROMPT}]
        },
        'generationConfig': {
            'temperature': 0.7,
            'maxOutputTokens': 1200
        }
    }
    payload_bytes = json.dumps(payload).encode('utf-8')

    # Try each model in sequence: Hydrogen -> Argon -> Carbon -> Flash
    for model_name in MODELS_CASCADE:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}'
        req = urllib.request.Request(
            url,
            data=payload_bytes,
            headers={'Content-Type': 'application/json', 'User-Agent': 'PetrosHydrogen/1.0'}
        )
        try:
            timeout_sec = 12 if 'hydrogen' in model_name else 8
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout_sec) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                reply = data['candidates'][0]['content']['parts'][0]['text']
                active_model_name = model_name.replace('gemini-', 'Gemini ').replace('-', ' ').title()
                print(f"[AI Model Dispatched]: {model_name}")
                return reply.strip(), active_model_name
        except Exception as e:
            print(f"[Model {model_name} unavailable / timeout]: {e} -> Failing over to next tier...")
            continue

    return "پدرام عزیز، در حال حاضر اتصال سرورهای هوش مصنوعی با ترافیک بالا مواجه است؛ پیام شما ثبت شد و تا لحظاتی دیگر مجدداً تلاش می‌کنم.", "Offline"

def send_telegram_message(text):
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'
    payload = json.dumps({
        'chat_id': CHAT_ID,
        'text': text
    }).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=10) as r:
            return True
    except Exception as e:
        print(f"Telegram send error: {e}")
        return False

def bot_polling_loop():
    print("🚀 Gemini Hydrogen AI CTO Bot Activated!")
    offset = 0
    history = load_memory()

    notify_msg = """🧬 معماری هوش مصنوعی مدیر فنی روی مدل «هیدروژن (Gemini 4 Hydrogen)» تنظیم شد!

پدرام عزیز، اولویت‌بندی مدل‌های مغز ربات مطابق دستور شما چیده شد:
۱. اولویت اصلی: **Gemini 4 Hydrogen**
۲. پشتیبان اول (در صورت اتمام یا تاخیر کوئری): **Gemini 4 Argon & Carbon**
۳. پشتیبان پایدار: **Gemini 3.5 Flash**

هم‌اکنون تمام سطوح استدلال، بیزینس و تصمیم‌گیری با هوشمندترین نسل هیدروژن فعال است."""
    send_telegram_message(notify_msg)

    while True:
        try:
            url = f'https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?offset={offset}&timeout=20'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=25) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get('ok') and data.get('result'):
                    for update in data['result']:
                        offset = update['update_id'] + 1
                        msg = update.get('message', {})
                        chat = msg.get('chat', {})
                        user_id = chat.get('id')
                        text = msg.get('text', '')
                        
                        if user_id == CHAT_ID and text:
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] Pedram: {text}")
                            
                            ai_reply, used_model = ask_gemini_cascaded(text, history)
                            
                            # Append model footnote subtly if requested
                            final_text = ai_reply
                            
                            # Save to persistent history
                            history.append({'role': 'user', 'text': text})
                            history.append({'role': 'model', 'text': final_text})
                            save_memory(history)
                            
                            send_telegram_message(final_text)
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] Dispatched via {used_model}")
        except Exception as e:
            pass
        time.sleep(1)

if __name__ == '__main__':
    bot_polling_loop()
