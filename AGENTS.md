# The Forge — Contributor Contract

This repo is The Forge product: seven plugin folders, `forge-lib`, and Forge Shell.
Supported hosts: Cursor and Grok Build only.

## Startup

1. Read this file.
2. If `.session-log/latest.md` or `.session-log/index.md` exists, read them.
   If they are missing, continue. Do not create a fake handoff.

## Hard contracts

- Commands converse. `forge-lib` writes. Forge Shell reads the filesystem.
- Plugin `commands/`, `skills/`, and `agents/` are product source. They are
  not Cursor commands and not Grok commands. Do not port them in a drive-by.
- Do not invent a second plugin, card, or task system.
- Do not add Claude, Codex, or OpenCode host files (`CLAUDE.md`, `.claude/`,
  `.claude-plugin/`, `opencode.json`, `.opencode/`, `.codex/`).
- Live 365 cards, memory, and Kai live in `cowork-database`. Do not write
  those here.
- Cursor is source (`.cursor/`). Grok files under `.grok/` are pairs.
- Tests: `make -C forge-lib test`.

## Routing

| Intent | Start here |
|--------|------------|
| Card workflows | `product-forge/` and `product-forge/README.md` |
| Task workflows | `tasks-forge/` |
| Memory workflows | `forge-memory/` |
| Debate / explore | `cognitive-forge/` |
| Reports | `report-forge/` |
| Rovo builders | `rovo-forge/` |
| Audio / Whisper | `audio-forge/` |
| Python data layer | `forge-lib/` and `forge-lib/README.md` |
| Desktop UI | `forge-shell/` |
| Host contract | `.cursor/rules/` (source) and `.grok/rules/` (pairs) |

## File naming (entities created by forge-lib)

| Entity Type | Pattern | Example |
|------------|---------|---------|
| Initiative/Epic/Decision | `{kebab-case-title}.md` | `notification-system-overhaul.md` |
| Story | `story-NNN-{slug}.md` | `story-001-notification-template-builder.md` |
| Task | `task-NNN.md` | `task-001.md` |
| Session | `YYYY-MM-DD-{slug}.md` | `2026-02-14-api-architecture-debate.md` |
| Report | `YYYY-MM-DD-{slug}.md` | `2026-02-14-q1-performance-review.md` |
| Checkpoint | `checkpoint-YYYY-MM-DD-{slug}.md` | `checkpoint-2026-02-14-architecture-decisions.md` |
| Rovo Agent | `{slug}/agent.md` | `ticket-triage-agent/agent.md` |
| Recording | `YYYY-MM-DD-{slug}.md` | `2026-05-06-sprint-standup.md` |

## Docs

- `docs/ARCHITECTURE.md` — layers and plugin anatomy
- `docs/PATTERNS.md` — orchestrator vs agent-less
- `docs/DATA_FLOW.md` — who writes which directory

# >>> relay >>>
## Relay — session handoff (L2)
At the START of a session, read `.session-log/latest.md` and `.session-log/index.md`
if they exist. If missing, continue.
When the user signals the session is wrapping up ("done for today", "let's
continue tomorrow", or a task completes and we're winding down), run
`session-save` to persist a Relay handoff. If unsure the session is ending,
offer it in one line.
At wrap-up, also capture durable facts/lessons with `relay-learn` (or inline
`knowledge add`), and surface any graduation-ready lesson for the user to approve.
# <<< relay <<<
