#!/usr/bin/env bash
set -euo pipefail

if [ -f ./scripts/load-env.sh ]; then
  . ./scripts/load-env.sh
  load_env
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
OUT_DIR="${OUT_DIR:-scripts/embed-tests}"

mkdir -p "${OUT_DIR}"

write_html() {
  local file="$1"
  local title="$2"
  local mode="$3"
  local token="$4"

  cat > "${file}" <<EOF2
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>Base URL: <code>${BASE_URL}</code></p>
    <p>Open this file in a browser to smoke test the widget embed.</p>
    <script
      src="${BASE_URL}/widget.js?v=5"
      defer
      data-mode="${mode}"
      data-base="${BASE_URL}"$( [ -n "${token}" ] && printf '\n      data-token="%s"' "${token}" )
    ></script>
  </body>
</html>
EOF2
}

write_html "${OUT_DIR}/html-embed.html" "Webchat Bridge HTML Embed (Guest)" "guest" ""
write_html "${OUT_DIR}/wordpress-embed.html" "Webchat Bridge WordPress Embed (Guest)" "guest" ""

client_token=""
if [ -n "${WIDGET_HMAC_SECRET:-}" ] && command -v run_node >/dev/null 2>&1; then
  client_token="$(run_node -e "const crypto=require('crypto');const payload={clientId:'signed-embed',name:'Embed Test',email:'embed@example.com',loggedIn:true,iat:Math.floor(Date.now()/1000)};const b64=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',process.env.WIDGET_HMAC_SECRET).update(b64).digest('base64url');process.stdout.write(b64+'.'+sig);")"
else
  client_token="REPLACE_WITH_SIGNED_TOKEN"
fi

write_html "${OUT_DIR}/client-embed.html" "Webchat Bridge Client Embed (Signed)" "client" "${client_token}"

echo "Wrote embed test pages to ${OUT_DIR}"
if [ "${client_token}" = "REPLACE_WITH_SIGNED_TOKEN" ]; then
  echo "Signed token placeholder used. Set WIDGET_HMAC_SECRET and rerun to generate a signed token."
fi
