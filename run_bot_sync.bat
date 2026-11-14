@echo off
chcp 65001 >nul
title Petros Cinema - Telegram Bot Auto-Publisher
color 0b

echo =====================================================================
echo    🚀 Petros Cinema Telegram Channel Auto-Publisher
echo    (انتشار خودکار فیلم‌ها در کانال تلگرام توسط ربات)
echo =====================================================================
echo.

python -u scripts/telegram_bot_publisher.py

echo.
echo =====================================================================
echo عملیات به پایان رسید. برای خروج یک کلید را فشار دهید.
echo =====================================================================
pause >nul
