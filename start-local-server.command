#!/bin/sh
cd "$(dirname "$0")"
echo "Track2Crack v1.8 local server starting at http://localhost:8080"
python3 -m http.server 8080
