Source pair: `.cursor/rules/contributor.mdc`

# Contributor contract

Layers:

- Plugin `commands/` converse and call `forge-lib`.
- `forge-lib` writes files, validates schemas, and maintains indexes.
- Forge Shell reads the filesystem. It does not use `index.json`.

Do not invent a second plugin, card, or task system. Do not add marketplace or Claude host files.

Tests: `make -C forge-lib test`. Docs: `docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/DATA_FLOW.md`.

Relay wrap-up uses `.relay/relay.sh` via the `session-save` and `relay-learn` skills.
