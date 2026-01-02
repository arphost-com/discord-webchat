#!/usr/bin/env bash
set -euo pipefail

if [ -f ./scripts/load-env.sh ]; then
  . ./scripts/load-env.sh
  load_env
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_IP="${GEOIP_TEST_IP:-8.8.8.8}"
ADMIN_API_KEY="${ADMIN_API_KEY:-}"

echo "GeoIP test: ${BASE_URL} (X-Forwarded-For=${TEST_IP})"

session_resp="$(curl -sS -H 'Content-Type: application/json' \
  -d '{"visitorName":"GeoIP Test","entryUrl":"geoip-test","visitorId":"geoip-test"}' \
  "${BASE_URL}/api/session/start-guest")"
session_uuid="$(echo "${session_resp}" | sed -n 's/.*"sessionUuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "${session_uuid}" ]; then
  echo "start-guest failed: ${session_resp}"
  exit 1
fi
echo "session ok: ${session_uuid}"

track_resp="$(curl -sS -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: ${TEST_IP}" \
  -d "{\"visitorId\":\"geoip-test\",\"sessionUuid\":\"${session_uuid}\",\"url\":\"https://example.com/geoip\",\"title\":\"GeoIP Test\",\"referrer\":\"\"}" \
  "${BASE_URL}/api/track/page")"
echo "${track_resp}" | grep -q '"ok":true' || {
  echo "track-page failed: ${track_resp}"
  exit 1
}
echo "track-page ok"

if [ -n "${ADMIN_API_KEY}" ]; then
  detail_resp="$(curl -sS -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    "${BASE_URL}/api/admin/session/${session_uuid}")"

  if command -v run_node >/dev/null 2>&1; then
    run_node -e "const data=JSON.parse(process.argv[1]);const s=data.session||{};const ok=Boolean(s.geo_country||s.geo_region||s.geo_city||s.geo_lat||s.geo_lng);console.log('geo fields:', {country:s.geo_country, region:s.geo_region, city:s.geo_city, lat:s.geo_lat, lng:s.geo_lng, timezone:s.geo_timezone});process.exit(ok?0:2)" \
      "${detail_resp}" || {
        echo "geo lookup missing in session. Raw response:"
        echo "${detail_resp}"
        exit 1
      }
  else
    echo "ADMIN_API_KEY set but node/docker is missing; raw session response:"
    echo "${detail_resp}"
  fi
else
  echo "ADMIN_API_KEY not set; skipping admin session geo check."
fi
