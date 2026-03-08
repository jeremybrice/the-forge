# CLAUDE.md — The Forge Marketplace v2

Claude Code plugin marketplace with 6 plugins + 1 desktop app + shared forge-lib Python CLI. See [README.md](README.md) for architecture overview and installation.

## Quick Start

All plugins use **forge-lib** (Python CLI) for file operations. Commands focus on conversational workflow and delegate persistence to `forge card`, `forge task`, `forge session`, `forge report`, `forge memory`, and `forge relationship` commands.

**Install forge-lib:**
```bash
cd forge-lib
pip install -r requirements.txt
```

**Verify installation:**
```bash
python forge.py --help
```

## Plugins

| Plugin | Primary Commands | Data Location |
|--------|-----------------|---------------|
| **product-forge** | `/product-forge:create`, `/product-forge:update`, `/product-forge:review`, `/product-forge:init`, `/product-forge:checkpoint` | `cards/` + `cards/index.json` |
| **tasks-forge** | `/tasks-forge:start`, `/tasks-forge:add`, `/tasks-forge:update` | `tasks/` + `tasks/index.json` |
| **forge-memory** | `/forge-memory:start`, `/forge-memory:setup-org`, `/forge-memory:remember`, `/forge-memory:recall`, `/forge-memory:triage` | `memory/` + `CLAUDE.md` |
| **cognitive-forge** | `/cognitive-forge:debate`, `/cognitive-forge:explore` | `sessions/` + `sessions/index.json` |
| **report-forge** | `/report-forge:generate`, `/report-forge:list`, `/report-forge:update` | `reports/` + `reports/index.json` |
| **rovo-forge** | `/rovo-forge:jira-agent`, `/rovo-forge:confluence-agent` | `rovo-agents/` + `rovo-agents/index.json` |
| **slack-forge** | `/slack-forge:init`, `/slack-forge:scan`, `/slack-forge:review`, `/slack-forge:promote` | `slack-forge/harvests/` + `slack-forge/harvests/index.json` + `slack-forge/config.json` |
| **outlook-forge** | `/outlook-forge:init`, `/outlook-forge:scan`, `/outlook-forge:capture`, `/outlook-forge:review`, `/outlook-forge:promote` | `outlook-forge/harvests/` + `outlook-forge/harvests/index.json` |

## Architecture

**v2 Key Change:** Separation of concerns
- **forge-lib** (Python) = Deterministic data layer (file operations, schemas, templates, validation)
- **LLM** = Reasoning and conversation layer (workflow guidance, tone, methodology)
- **Commands** = 80-100 lines (down from 250-300 in v1) focused on conversational workflow
- **Skills** = Pure reasoning guidance (no file operations, schemas, or templates)

**Performance:** forge-lib plugins query `index.json` files; forge-shell uses direct FS scanning via `ForgeFS` helpers.

**Validation:** JSON Schema validation for all entity types via `forge.py` CLI.

**Templates:** Jinja2 templates in `forge-lib/templates/` generate markdown content.

**Relationships:** Bidirectional parent-child updates handled automatically by `forge relationship link`.

## File Naming Patterns

| Entity Type | Pattern | Example |
|------------|---------|---------|
| Initiative/Epic/Decision | `{kebab-case-title}.md` | `notification-system-overhaul.md` |
| Story | `story-NNN-{slug}.md` | `story-001-notification-template-builder.md` |
| Task | `task-NNN.md` | `task-001.md` |
| Session | `YYYY-MM-DD-{slug}.md` | `2026-02-14-api-architecture-debate.md` |
| Report | `YYYY-MM-DD-{slug}.md` | `2026-02-14-q1-performance-review.md` |
| Checkpoint | `checkpoint-YYYY-MM-DD-{slug}.md` | `checkpoint-2026-02-14-architecture-decisions.md` |
| Rovo Agent | `{slug}/agent.md` | `ticket-triage-agent/agent.md` |
| Harvest | `YYYY-MM-DD-{harvest_type}-NNN.md` | `2026-02-17-task-harvest-001.md` |

## Forge Shell Desktop App

**Location:** `forge-shell/` (not a plugin)

**Purpose:** Tauri desktop app providing visual dashboards for all plugins.

**Data Loading:** Uses direct filesystem scanning via `ForgeFS` utility in `forge-shell/app/js/utils.js`. Each view controller scans its plugin's data directory and parses markdown frontmatter directly (refactored from index.json in commit `da5080c`).

**View Controllers:**
- `product-forge.js` — Cards grid view
- `tasks.js` — Task board with filtering
- `memory.js` — Taxonomy and knowledge browser
- `cognitive-forge.js` — Session history
- `report-forge.js` — Report archive
- `rovo-agent-forge.js` — Agent config viewer
- `slack-forge.js` — Harvest dashboard with review workflow
- `outlook-forge.js` — Outlook harvest dashboard with calendar integration
- `roadmap.js` — Roadmap timeline view

**Launch:**
```bash
cd forge-shell
npm install
npm run tauri dev
```

See `forge-shell/README.md` for details.

## Documentation

- `README.md` — Architecture overview, installation, verification plan
- `forge-lib/README.md` — CLI reference, usage patterns, examples
- `{plugin}/README.md` — Plugin-specific workflows and command details
- `forge-shell/STYLE_GUIDE.md` — UI standardization, toolbar patterns, CSS conventions
- `docs/ARCHITECTURE.md` — System architecture, layer separation, plugin anatomy
- `docs/PATTERNS.md` — Recurring implementation patterns and conventions
- `docs/DATA_FLOW.md` — Inter-plugin data flow and shared data contracts
- `docs/DECISION_LOG.md` — Indexed design decisions with links to design docs

## Version

**v2.2.1** — Cross-cutting documentation, epic jira_card attribute, and status filter panel.
