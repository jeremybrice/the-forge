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

# Re-codesign so the embedded __TEXT,__info_plist section is hashed into the
# Code Directory ("Info.plist=bound" in `codesign -dvvv`). Swift's linker
# adhoc-signs the binary *before* sectcreate is fully reflected in the CD, so
# without this step macOS reports the plist as unbound and may refuse to read
# the bundle identifier for TCC attribution.
#
# We pin the identifier explicitly so the cdhash stays stable across rebuilds
# and the user only sees the mic permission prompt once.
/usr/bin/codesign --force --sign - \
  --identifier com.forge-marketplace.shell.recorder \
  "$DEST"

echo "Wrote $DEST"
