# page-agent (alibaba/page-agent) — استفاده امن در پتروس سینما

منبع: https://github.com/alibaba/page-agent — نسخه 1.12.4 — لایسنس MIT (vendor شده در `public/vendor/page-agent.demo.js` + `npm i page-agent`)

## قانون امنیتی
- اسکریپت **همیشه از خودِ سایت** لود می‌شود (`/vendor/page-agent.demo.js`)، نه CDN بیرونی.
- LLM با پارامترهای URL (model/baseURL/apiKey) تزریق می‌شود؛ apiKey فقط برای نشست ادمین و از سرور ادمین گرفته می‌شود و در حافظه صفحه می‌ماند.
- `autoInit=false` — مقداردهی دستی با کلید ادمین؛ بدون کلید، ایجنت مرورگر اصلاً راه نمی‌افتد.
- فقط صفحات پنل ادمین و صفحاتی که در iframe قابل بارگذاری‌اند کنترل می‌شوند.

## جریان کار ایجنت‌ها با مرورگر
1. کارفرما در چت ایجنت می‌نویسد: «مرورگر را باز کن <url>»
2. سرور ادمین یک نشست مرورگر می‌سازد (`/api/admin/agent/browser/start`) با توکن یک‌بارمصرف
3. صفحه `agent-browser.html?url=…&session=…` باز می‌شود: هدف در iframe + page-agent + مدل خودمان
4. کارفرما به ایجنت درون‌صفحه دستور فارسی می‌دهد؛ همه چیز لوکال باقی می‌ماند

## نگهداری
برای به‌روزرسانی: `npm install page-agent@latest` سپس کپی دوباره فایل iife به `public/vendor/`.
