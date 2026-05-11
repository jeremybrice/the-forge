#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
TMP=$(mktemp -d)
# Find a UID that does NOT exist. The recorder will fall back to default;
# if the user's default mic is currently producing audio this test won't fire,
# so instead we exercise it by pointing at BlackHole 2ch if installed
# (silent loopback). Skip if absent.
BLACKHOLE_UID=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null \
  | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); blk=[x for x in d["devices"] if "BlackHole" in x["name"]]; print(blk[0]["uid"] if blk else "")')
if [ -z "$BLACKHOLE_UID" ]; then
  echo "SKIP: BlackHole not installed — silence guard cannot be deterministically tested without it"
  exit 0
fi
echo "Using silent device: $BLACKHOLE_UID"
OUT=$( (echo "{\"cmd\":\"start\",\"outDir\":\"$TMP\",\"id\":\"silencetest\",\"sources\":[\"mic\"],\"micDeviceUID\":\"$BLACKHOLE_UID\"}"; sleep 2; echo '{"cmd":"stop"}'; sleep 1) | "$BIN" 2>/dev/null )
echo "$OUT"
echo "$OUT" | grep -q '"code":"MIC_SILENT_AT_SOURCE"' || { echo "FAIL: silence guard did not fire"; exit 1; }
echo "PASS"
rm -rf "$TMP"
