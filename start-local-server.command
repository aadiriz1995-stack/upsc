#!/bin/sh
cd "$(dirname "$0")"
echo "Starting Track2Crack v1.7 at http://localhost:8080"
echo "Keep this terminal open while using Google Drive sync."
python3 -m http.server 8080
