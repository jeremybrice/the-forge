#!/usr/bin/env bash
set -euo pipefail

# Build the forge-recorder Swift sidecar and copy it to the Tauri binaries
# directory with the architecture-specific suffix Tauri expects.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SCRIPT_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) TRIPLE="aarch64-apple-darwin" ;;
  x86_64) TRIPLE="x86_64-apple-darwin" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

echo "Building forge-recorder for ${TRIPLE}…"
swift build -c release --arch "$ARCH"

SRC=".build/release/forge-recorder"
DEST="$BIN_DIR/forge-recorder-$TRIPLE"

cp -f "$SRC" "$DEST"
chmod +x "$DEST"
echo "Wrote $DEST"
