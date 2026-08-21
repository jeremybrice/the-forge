# Architecture — The Forge v2

Supported hosts: Cursor and Grok Build. Plugin `commands/` are workflow files, not host slash-commands.

## Design Philosophy

v2 separates **deterministic data operations** from **LLM reasoning**. In v1, commands mixed file I/O, validation, and conversation logic in 250-300 line files. v2 splits this:

- **forge-lib** (Python CLI) — file operations, JSON Schema validation, Jinja2 templates, index management
- **LLM Commands** (Markdown) — conversational workflow, user interaction, orchestration
- **Skills** (Markdown) — pure reasoning guidance; no file operations, schemas, or templates

Commands delegate all persistence to forge-lib via subprocess calls, keeping command files focused on conversation flow.

## System Layers

| Layer | Technology | Responsibility | Example |
|-------|-----------|---------------|---------|
| forge-lib | Python CLI (`forge.py`) | File ops, JSON Schema validation, Jinja2 templates, index management | `forge card create`, `forge task create` |
| Commands | Markdown | Conversational workflow, user interaction, orchestration | `product-forge/commands/create.md` |
| Skills | Markdown + YAML frontmatter | Pure reasoning guidance — no file ops, schemas, or templates | `product-forge/skills/jira-sync/SKILL.md` |
| forge-shell | Tauri + vanilla JS | Desktop dashboards, direct FS scanning via ForgeFS | `forge-shell/app/js/product-forge.js` |

**Data flow:** User → Plugin Command → forge-lib CLI (subprocess) → JSON on stdout → LLM interprets result → guides next step.

## Plugin Anatomy

Standard plugin directory structure (product-forge as reference):

```
{plugin-name}/
├── README.md           # Plugin-specific docs
├── agents/             # Specialized reasoning agents (.md files)
├── commands/           # LLM command definitions (.md files)
└── skills/             # Pure reasoning skills (subdirectories with SKILL.md)
```

**Delegation pattern:** Commands never do file I/O directly. They call `forge.py` subcommands, receive JSON output, and use it to guide conversation.

**Not all plugins have agents.** tasks-forge, forge-memory, and rovo-forge operate without agents. See [PATTERNS.md](PATTERNS.md) for orchestrator vs agent-less patterns.

## Validation and Schemas

**JSON Schema files** — `forge-lib/schemas/` (15 schemas):
`agent.json`, `checkpoint.json`, `decision.json`, `epic.json`, `glossary.json`, `initiative.json`, `intake.json`, `person.json`, `project-memory.json`, `recording.json`, `release-note.json`, `report.json`, `session.json`, `story.json`, `task.json`

**Jinja2 templates** — `forge-lib/templates/` (15 matching `.md.j2` files, one per schema). Templates generate markdown content for new entities.

**Index files** — `index.json` per entity directory, maintained automatically by forge-lib on create/update. Used for fast plugin queries. forge-shell does **not** use these (see below).

**Validator** — `forge-lib/core/validator.py` provides JSON Schema validation with caching.

See `forge-lib/README.md` for full CLI reference, exit codes, and usage patterns.

## forge-shell Architecture

forge-shell is a **Tauri desktop app** — not a plugin. It provides visual dashboards for all plugins.

**ForgeFS** — Filesystem abstraction in `forge-shell/app/js/fs-adapter.js`:
- Dual-mode: Tauri backend (desktop) and Browser File System Access API
- Methods: `readDir()`, `readFile()`, `getFileMeta()`, `isTauri()`
- Higher-level helpers in `forge-shell/app/js/utils.js` (`ForgeUtils.FS`)

**Data loading** — forge-shell scans directories directly via ForgeFS and parses markdown frontmatter. It does **not** read `index.json` files, avoiding index drift issues.

**PLUGINS array** — `forge-shell/app/js/shell.js` registers 10 plugins, each with `id`, `label`, `icon`, and `requiredDir` (the data directory that must exist to enable the plugin).

**View controllers** — IIFE modules registered via `Shell.registerController(pluginId, controller)`. Each implements `init(rootHandle)` and `destroy()`. Scoped DOM queries target `#view-{plugin-id}` containers. One JS file per plugin dashboard in `forge-shell/app/js/`.

**Routing** — Unified SPA with hash-based routing, pre-rendered view containers, IndexedDB for persisting the workspace directory handle.

**Style guide** — `forge-shell/STYLE_GUIDE.md` defines the standardized toolbar pattern, mandatory CSS classes (12 documented), layout dimensions, and Font Awesome icon conventions. All view controllers must follow this guide.

See `forge-shell/README.md` for setup, directory structure, and plugin registration details.

## Version

**v2.2.1** — Cross-cutting documentation, epic jira_card attribute, and status filter panel.
