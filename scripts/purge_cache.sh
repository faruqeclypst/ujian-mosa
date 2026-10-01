#!/bin/bash
# Purge Cloudflare Cache for examku.my.id

# Load environment variables from VPS .env
if [ -f /root/.env ]; then
  export $(grep -v '^#' /root/.env | xargs)
fi

TOKEN="${CF_TOKEN}"
ZONE="${ZONE_ID:-668c9f7ebe161a19608987616a6115d3}"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: CF_TOKEN tidak ditemukan di /root/.env"
  exit 1
fi

if [ "$1" == "files" ]; then
  echo "⚡ Purging specific assets..."
  PAYLOAD='{"files":["https://modalbangsa.examku.my.id/vendor-v2/katex/katex.min.css","https://modalbangsa.examku.my.id/assets/index-Bknx9l9u.js","https://modalbangsa.examku.my.id/vendor-v2/fonts/gfonts.css","https://modalbangsa.examku.my.id/vendor-v2/katex/fonts/KaTeX_Math-Italic.woff2"]}'
else
  echo "⚡ Purging ALL Cloudflare cache for examku.my.id..."
  PAYLOAD='{"purge_everything":true}'
fi

curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" \
  -d "$PAYLOAD" | jq .
