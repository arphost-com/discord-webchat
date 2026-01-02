#!/usr/bin/env bash
set -euo pipefail

echo "Smoke test (all):"

./scripts/smoke-test.sh
./scripts/embed-tests.sh
./scripts/geoip-test.sh

echo "All smoke tests completed."
