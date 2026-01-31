#!/bin/bash
# End-to-end test script for Discord WebChat Gateway
# Usage: ./scripts/e2e-test.sh [BASE_URL] [ADMIN_API_KEY]

set -e

BASE_URL="${1:-http://localhost:3000}"
ADMIN_API_KEY="${2:-}"
ORIGIN="${3:-https://dev.arphost.com}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

test_endpoint() {
    local name="$1"
    local method="$2"
    local path="$3"
    local data="$4"
    local expected="$5"
    local headers="$6"

    local url="${BASE_URL}${path}"
    local curl_args="-s -w '\n%{http_code}'"

    if [ "$method" = "POST" ]; then
        curl_args="$curl_args -X POST -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_args="$curl_args -d '$data'"
        fi
    fi

    if [ -n "$ORIGIN" ]; then
        curl_args="$curl_args -H 'Origin: $ORIGIN'"
    fi

    if [ -n "$headers" ]; then
        curl_args="$curl_args $headers"
    fi

    local response
    response=$(eval "curl $curl_args '$url'" 2>/dev/null)
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')

    if echo "$body" | grep -q "$expected"; then
        log_pass "$name (HTTP $http_code)"
        return 0
    else
        log_fail "$name - expected '$expected' in response"
        echo "  Response: $body"
        return 1
    fi
}

echo "======================================"
echo "Discord WebChat E2E Tests"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "Origin: $ORIGIN"
echo ""

# Test 1: Health check
log_info "Testing health endpoint..."
test_endpoint "Health check" "GET" "/healthz" "" "ok" || true

# Test 2: Widget.js
log_info "Testing widget.js..."
test_endpoint "Widget.js served" "GET" "/widget.js" "" "DISCORD_WEBCHAT_LOADED" || true

# Test 3: Create guest session
log_info "Testing session creation..."
SESSION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/session/start-guest" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d '{"visitorName":"E2E Test","visitorEmail":"e2e@test.com"}')

if echo "$SESSION_RESPONSE" | grep -q '"ok":true'; then
    SESSION_UUID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionUuid":"[^"]*"' | cut -d'"' -f4)
    log_pass "Guest session created: $SESSION_UUID"
else
    log_fail "Guest session creation"
    echo "  Response: $SESSION_RESPONSE"
fi

# Test 4: Session resume
if [ -n "$SESSION_UUID" ]; then
    log_info "Testing session resume..."
    test_endpoint "Session resume" "POST" "/api/session/resume" \
        "{\"sessionUuid\":\"$SESSION_UUID\"}" '"ok":true' || true
fi

# Test 5: Page tracking
if [ -n "$SESSION_UUID" ]; then
    log_info "Testing page tracking..."
    test_endpoint "Page tracking" "POST" "/api/track/page" \
        "{\"sessionUuid\":\"$SESSION_UUID\",\"url\":\"https://example.com/test\",\"title\":\"E2E Test Page\"}" \
        '"ok":true' || true
fi

# Test 6: Admin API (if key provided)
if [ -n "$ADMIN_API_KEY" ]; then
    log_info "Testing admin API..."
    test_endpoint "Admin sessions list" "GET" "/api/admin/sessions?limit=5" "" \
        '"ok":true' "-H 'X-Admin-Key: $ADMIN_API_KEY'" || true

    if [ -n "$SESSION_UUID" ]; then
        test_endpoint "Admin session detail" "GET" "/api/admin/session/$SESSION_UUID" "" \
            '"ok":true' "-H 'X-Admin-Key: $ADMIN_API_KEY'" || true
    fi

    test_endpoint "Admin pageviews" "GET" "/api/admin/pageviews?limit=5" "" \
        '"ok":true' "-H 'X-Admin-Key: $ADMIN_API_KEY'" || true
else
    log_info "Skipping admin API tests (no ADMIN_API_KEY provided)"
fi

# Test 7: CORS headers
log_info "Testing CORS headers..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS "${BASE_URL}/api/session/start-guest" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" 2>/dev/null | grep -i "access-control")

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    log_pass "CORS headers present"
else
    log_fail "CORS headers missing"
fi

# Test 8: Invalid requests
log_info "Testing error handling..."
ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/session/start-client" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d '{"token":"invalid"}')

if echo "$ERROR_RESPONSE" | grep -q '"ok":false'; then
    log_pass "Invalid token rejected"
else
    log_fail "Invalid token should be rejected"
fi

# Summary
echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi
exit 0
