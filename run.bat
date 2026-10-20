@echo off
REM تشغيل الموقع على خادم محلي: http://localhost:8000
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/login.html
  python -m http.server 8000
  goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/login.html
  npx --yes serve -l 8000 .
  goto :eof
)

echo لم يتم العثور على Python ولا Node.js.
echo ثبّت أحدهما: https://www.python.org/downloads  او  https://nodejs.org
pause
