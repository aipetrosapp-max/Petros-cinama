@echo off
title Petros Cinema - Telegram Stream Gateway
cd /d "%~dp0"
echo ======================================================================
echo    Petros Cinema - Telegram-to-HTTP Video Streaming Gateway
echo    Converts Telegram video posts to direct browser streaming URLs!
echo ======================================================================
echo.
python stream_gateway.py
pause
