#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
OUT=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null)
echo "$OUT"
# Must produce a single JSON line with event=devices and a non-empty array
echo "$OUT" | grep -q '"event":"devices"' || { echo "FAIL: no devices event"; exit 1; }
echo "$OUT" | grep -q '"devices":\[' || { echo "FAIL: missing devices array"; exit 1; }
echo "PASS"
