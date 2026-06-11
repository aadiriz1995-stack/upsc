@echo off
cd /d "%~dp0"
echo Starting Track2Crack v1.7 at http://localhost:8080
echo Keep this window open while using Google Drive sync.
python -m http.server 8080
pause
