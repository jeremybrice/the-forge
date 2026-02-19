# Repository Guidelines

## Project Structure & Module Organization
This repo is a monorepo for the Forge ecosystem.
- `forge-lib/`: shared Python CLI/data layer (`forge.py`, `core/`, `schemas/`, `templates/`, `tests/`).
- `*-forge/` plugin packs: command/agent/skill definitions (`product-forge`, `tasks-forge`, `forge-memory`, `cognitive-forge`, `report-forge`, `rovo-forge`, `slack-forge`).
- `forge-shell/`: Tauri desktop app (`app/` frontend JS/CSS, `src-tauri/` Rust backend).
- `.claude-plugin/marketplace.json`: plugin catalog wiring.
- `docs/`: plans and audit artifacts.

## Build, Test, and Development Commands
- `cd forge-lib && python3 forge.py --help`: inspect CLI commands.
- `cd forge-lib && python3 -m pytest -q`: run Python test suite.
- `cd forge-shell && npm run tauri:dev`: run desktop app in development mode.
- `cd forge-shell/src-tauri && cargo check`: compile-check Rust backend quickly.
- `cd forge-shell && npm run tauri:build`: create desktop build artifacts.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, snake_case functions/modules.
- JavaScript (Forge Shell): existing style uses 2-space indentation and module-style files in `app/js/`.
- Rust: standard `rustfmt` style and idiomatic error handling via `Result`.
- Keep schemas/templates aligned with runtime behavior (e.g., task `priority` is numeric `1..5`).
- File naming examples:
  - Tasks: `tasks/task-001.md`
  - Sessions/Reports: `YYYY-MM-DD-slug.md`

## Testing Guidelines
- Framework: `pytest` in `forge-lib/tests/`.
- Test files follow `test_*.py`; test names should describe behavior (`test_link_to_parent_updates_index_entry`).
- Add or update tests for any CLI contract changes, schema changes, or index/update flows.
- For `forge-shell` changes, run `cargo check` and perform targeted manual flow checks (watch/unwatch, view refresh, file updates).

## Commit & Pull Request Guidelines
- Prefer concise, imperative commits (seen in history):  
  - `feat(slack-forge): add ...`  
  - `docs: add ...`  
  - `Fix ...`
- PRs should include:
  - What changed and why.
  - Affected modules/paths.
  - Validation evidence (pytest output, `cargo check`, and screenshots for UI changes).
  - Any contract or migration notes (schemas, command examples, naming rules).

## Security & Configuration Notes
- Do not commit secrets, API tokens, or local machine paths.
- Keep generated/local config out of commits unless intentionally versioned.
