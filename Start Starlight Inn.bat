@echo off
chcp 65001 >nul
title Starlight Inn — Desktop Launcher
color 0E
echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║                                               ║
echo  ║      STARLIGHT INN                            ║
echo  ║                                               ║
echo  ║   Starting your game...                       ║
echo  ║                                               ║
echo  ╚═══════════════════════════════════════════════╝
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Try to find Chrome, Edge, or Firefox (NOT Internet Explorer)
set "BROWSER="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files\Mozilla Firefox\firefox.exe" set "BROWSER=C:\Program Files\Mozilla Firefox\firefox.exe"
if exist "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" set "BROWSER=C:\Program Files (x86)\Mozilla Firefox\firefox.exe"

REM Find Node.js
set "NODE="
for %%p in (node.exe) do set "NODE=%%~$PATH:p"

if not exist "%NODE%" (
    echo ⚠️  Node.js not found — but we can still play!
    echo.
    if exist "%BROWSER%" (
        echo ✅ Opening in browser: %BROWSER%
        start "" "%BROWSER%" "file:///%SCRIPT_DIR%index.html"
    ) else (
        echo 🌐 Opening in default browser...
        start "" "file:///%SCRIPT_DIR%index.html"
    )
    echo.
    echo ┌─────────────────────────────────────────────┐
    echo │  💡 Pro Tip: Install Node.js for the best   │
    echo │     experience (server mode with chat).     │
    echo │     Get it free at: https://nodejs.org      │
    echo └─────────────────────────────────────────────┘
    echo.
    echo Game window should be open now. Enjoy! ✨
    echo.
    pause
    exit /b 0
)

echo ✅ Node.js found
echo 🚀 Starting server on http://localhost:8080 ...
if exist "%BROWSER%" (
    echo ✅ Opening in %BROWSER%
    start "" "%BROWSER%" "http://localhost:8080"
) else (
    echo 🌐 Opening in default browser...
    start "" "http://localhost:8080"
)
echo.
echo Press Ctrl+C here to stop the server when done playing.
echo.

"%NODE%" server.js

echo.
echo Server stopped. Thanks for playing! ✨
pause
