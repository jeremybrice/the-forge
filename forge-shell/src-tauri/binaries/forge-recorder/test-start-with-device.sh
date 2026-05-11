#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
TMP=$(mktemp -d)
# Use the system default device's UID — read it via list_devices first.
DEFAULT_UID=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null \
  | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print(next(x["uid"] for x in d["devices"] if x["isDefault"]))')
echo "Using UID: $DEFAULT_UID"
OUT=$( (echo "{\"cmd\":\"start\",\"outDir\":\"$TMP\",\"id\":\"smoketest\",\"sources\":[\"mic\"],\"micDeviceUID\":\"$DEFAULT_UID\"}"; sleep 2; echo '{"cmd":"stop"}'; sleep 1) | "$BIN" 2>&1 )
echo "$OUT"
# Stderr must mention the device we asked for
echo "$OUT" | grep -q "using requested device uid=$DEFAULT_UID" || { echo "FAIL: device override not applied"; exit 1; }
echo "PASS"
rm -rf "$TMP"
