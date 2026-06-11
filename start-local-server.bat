@echo off
cd /d %~dp0
echo Track2Crack v1.8 local server starting at http://localhost:8080
python -m http.server 8080
pause
