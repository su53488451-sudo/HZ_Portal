@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8026/version-2.html"
  node serve.mjs
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    start "" "http://127.0.0.1:8026/version-2.html"
    py -m http.server 8026 --bind 127.0.0.1
  ) else (
    echo Node.js or Python is required.
    pause
  )
)
