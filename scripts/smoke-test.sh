#!/usr/bin/env bash
set -euo pipefail

if [ -f ./scripts/load-env.sh ]; then
  . ./scripts/load-env.sh
  load_env
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Smoke test: ${BASE_URL}"

health="$(curl -sS "${BASE_URL}/healthz")"
if [ "${health}" != "ok" ]; then
  echo "healthz failed: ${health}"
  exit 1
fi
echo "healthz ok"

widget_head="$(curl -sS "${BASE_URL}/widget.js" | head -n 1)"
echo "widget.js head: ${widget_head}"

guest_resp="$(curl -sS -H 'Content-Type: application/json' \
  -d '{"visitorName":"Smoke Test","entryUrl":"smoke","visitorId":"smoke-visitor"}' \
  "${BASE_URL}/api/session/start-guest")"
echo "${guest_resp}" | grep -q '"sessionUuid"' || {
  echo "start-guest failed: ${guest_resp}"
  exit 1
}
echo "start-guest ok"

track_resp="$(curl -sS -H 'Content-Type: application/json' \
  -d '{"visitorId":"smoke-visitor","url":"https://example.com/smoke","title":"Smoke","referrer":""}' \
  "${BASE_URL}/api/track/page")"
echo "${track_resp}" | grep -q '"ok":true' || {
  echo "track-page failed: ${track_resp}"
  exit 1
}
echo "track-page ok"

if [ -n "${WIDGET_HMAC_SECRET:-}" ] && command -v run_node >/dev/null 2>&1; then
  token="$(run_node -e "const crypto=require('crypto');const payload={clientId:123,name:'Smoke User',email:'smoke@example.com',loggedIn:true,iat:Math.floor(Date.now()/1000)};const b64=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',process.env.WIDGET_HMAC_SECRET).update(b64).digest('base64url');process.stdout.write(b64+'.'+sig);")"
  client_resp="$(curl -sS -H 'Content-Type: application/json' \
    -d "{\"token\":\"${token}\"}" \
    "${BASE_URL}/api/session/start-client")"
  echo "${client_resp}" | grep -q '"sessionUuid"' || {
    echo "start-client failed: ${client_resp}"
    exit 1
  }
  echo "start-client ok"
else
  echo "start-client skipped (set WIDGET_HMAC_SECRET and have node or docker installed)"
fi
