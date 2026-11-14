@echo off
cd /d "%~dp0"
cls
echo ======================================================================
echo    Telegram StringSession Generator - Petros Cinema
echo ======================================================================
echo.
python generate_session.py
echo.

if exist telegram_session.txt (
    type telegram_session.txt | clip
    echo ======================================================================
    echo [SUCCESS] Text has been AUTOMATICALLY COPIED to your Clipboard!
    echo Just come to our chat and press (Ctrl + V) to Paste it!
    echo ======================================================================
    start notepad telegram_session.txt
)

echo.
pause
