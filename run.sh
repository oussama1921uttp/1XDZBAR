#!/bin/sh
# تشغيل الموقع على خادم محلي: http://localhost:8000
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  echo "افتح: http://localhost:8000/login.html"
  python3 -m http.server 8000
elif command -v npx >/dev/null 2>&1; then
  echo "افتح: http://localhost:8000/login.html"
  npx --yes serve -l 8000 .
else
  echo "ثبّت Python أو Node.js أولاً"
fi
