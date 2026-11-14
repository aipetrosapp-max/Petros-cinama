@echo off
cd /d "%~dp0"
cls
echo ======================================================================
echo    Telegram StringSession Generator - Petros Cinema
echo ======================================================================
echo.
echo Installing required libraries (telethon cryptg)...
python -m pip install telethon cryptg
echo.
echo Starting session generator...
echo.
python generate_session.py
echo.
echo ======================================================================
echo Done! Please copy the session string above and paste it in chat.
echo ======================================================================
pause
