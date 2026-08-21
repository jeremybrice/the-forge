#!/usr/bin/env bash
# install.sh — refresh Relay wiring for Cursor and Grok Build.
set -euo pipefail
MARK="# >>> relay >>>"

copy_tool() {
  mkdir -p .relay
  if [ ! -f .relay/relay.sh ]; then
    echo "relay: missing .relay/relay.sh (must be tracked in this repo)" >&2
    return 1
  fi
  chmod +x .relay/relay.sh
}

gitignore_data() {
  touch .gitignore
  grep -qF ".session-log/" .gitignore || printf '\n%s\n.session-log/\n' "$MARK" >> .gitignore
}

append_block() { # file, source-block
  local file="$1" src="$2"
  [ -f "$src" ] || return 0
  touch "$file"
  grep -qF "$MARK" "$file" 2>/dev/null && return 0
  { printf '\n%s\n' "$MARK"; cat "$src"; printf '%s\n' "# <<< relay <<<"; } >> "$file"
}

wire_cursor() {
  mkdir -p .cursor/skills
  [ -d .relay/adapters/cursor/skills ] && cp -R .relay/adapters/cursor/skills/. .cursor/skills/ 2>/dev/null || true
  append_block AGENTS.md .relay/adapters/cursor/AGENTS.relay.md
}

wire_grok() {
  mkdir -p .grok/skills
  [ -d .relay/adapters/grok/skills ] && cp -R .relay/adapters/grok/skills/. .grok/skills/ 2>/dev/null || true
}

usage() {
  echo "usage: ./install.sh" >&2
  echo "Wires Relay for Cursor and Grok Build. Creates .cursor/ and .grok/ if missing." >&2
}

main() {
  if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
  fi
  copy_tool
  mkdir -p .cursor .grok
  wire_cursor
  wire_grok
  gitignore_data
  echo "relay: installed for Cursor and Grok Build. Handoffs accumulate in .session-log/ (gitignored)."
}

main "$@"
