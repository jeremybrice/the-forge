# The Forge Marketplace v2

A curated suite of Claude Code plugins for product management, task tracking, organizational memory, multi-agent reasoning, report generation, and Atlassian Rovo agent configuration — with a shared Python data layer and desktop visualization app.

## What's New in v2

**Complete architectural rebuild** moving data operations from LLM prompts into deterministic Python scripts.

### Key Changes

| Aspect | v1 | v2 |
|--------|----|----|
| **Data Layer** | LLM prompts with embedded file ops | Python CLI (`forge-lib`) |
| **Command Length** | 250-300 lines | 80-100 lines (60% reduction) |
| **Skills** | Include schemas, templates, file ops | Pure reasoning guidance only |
| **Queries** | Directory scanning + frontmatter parsing | Pre-built `index.json` files |
| **Validation** | LLM-enforced YAML structure | JSON Schema validation |
| **Templates** | Inline markdown strings in prompts | Jinja2 templates |
| **Relationships** | Manual parent-child updates | Automatic bidirectional linking |

### Benefits

- **Faster:** Index-based queries eliminate directory scanning
- **Maintainable:** Python handles data, LLM handles conversation
- **Deterministic:** Validation and file operations are testable
- **Simpler:** Commands focus on workflow, not file manipulation

## Architecture

```
the-forge-marketplace-v2/
  .claude-plugin/
    marketplace.json              ← Root plugin catalog

  forge-lib/                      ← Shared Python CLI (NEW in v2)
    forge.py                       ← CLI entry point
    core/                          ← Core modules
      frontmatter.py               ← YAML parsing
      slug.py                      ← Filename generation
      validator.py                 ← JSON Schema validation
      index_ops.py                 ← Index CRUD operations
      card_ops.py                  ← Card operations (7 types)
      task_ops.py                  ← Task operations
      memory_ops.py                ← Taxonomy & memory ops
      session_ops.py               ← Session operations
      report_ops.py                ← Report operations
      relationship_ops.py          ← Parent-child linking
    schemas/                       ← JSON Schema definitions
      initiative.json, epic.json, story.json, etc.
    templates/                     ← Jinja2 markdown templates
      initiative.md.j2, epic.md.j2, etc.
    tests/                         ← Unit tests (124 passing)
    requirements.txt               ← Python dependencies

  product-forge/                   ← Product management plugin
    .claude-plugin/plugin.json
    commands/                      ← 11 commands (80-100 lines each)
    skills/                        ← 2 skills (reasoning-only)
    README.md

  tasks-forge/                     ← Task management plugin
    commands/                      ← 3 commands
    skills/                        ← 1 skill
    README.md

  forge-memory/                    ← Organizational memory plugin
    commands/                      ← 4 commands
    skills/                        ← 2 skills
    README.md

  cognitive-forge/                 ← Multi-agent reasoning plugin
    commands/                      ← 2 commands
    agents/                        ← 5 agent definitions
    skills/                        ← 1 skill + references
    README.md

  report-forge/                    ← Report generation plugin
    commands/                      ← 3 commands
    agents/                        ← 3 report agents
    skills/                        ← 1 skill
    README.md

  rovo-forge/                      ← Atlassian Rovo agent builder
    commands/                      ← 2 commands
    skills/                        ← 3 skills + references
    sample-configs/                ← Example agent configs
    README.md

  forge-shell/                     ← Desktop visualization app
    src-tauri/                     ← Rust backend (Tauri)
    app/                           ← Vanilla JS frontend
      js/
        shell.js                   ← Main app controller
        utils.js                   ← ForgeUtils.readIndex()
        product-forge.js           ← Cards view controller
        tasks.js                   ← Tasks board
        memory.js                  ← Taxonomy browser
        cognitive-forge.js         ← Sessions viewer
        report-forge.js            ← Reports archive
        rovo-agent-forge.js        ← Rovo configs viewer
        roadmap.js                 ← Roadmap timeline
    README.md
```

## Installation

### Prerequisites

- **Python 3.8+** with pip
- **Node.js 18+** and npm (for Forge Shell)
- **Rust** (for building Forge Shell with Tauri)
- **Claude Code** extension

### Step 1: Install forge-lib

```bash
cd forge-lib
pip install -r requirements.txt
```

**Verify:**
```bash
python forge.py --help
```

You should see the CLI help output with 7 command groups: `card`, `task`, `memory`, `session`, `report`, `index`, `relationship`.

### Step 2: Run forge-lib Tests (Optional)

```bash
cd forge-lib
python -m pytest tests/ -v
```

All 124 tests should pass.

### Step 3: Install the Marketplace

Add the marketplace to your Claude Code config:

**Option A: Symlink (recommended for development)**
```bash
ln -s /path/to/the-forge-marketplace-v2 ~/.claude/marketplaces/forge-v2
```

**Option B: Clone into Claude Code directory**
```bash
cd ~/.claude/marketplaces
git clone <repository-url> forge-v2
cd forge-v2/forge-lib
pip install -r requirements.txt
```

### Step 4: Verify Plugin Registration

Open Claude Code and check that all 6 plugins are available:
- `/product-forge:init`
- `/tasks-forge:start`
- `/forge-memory:start`
- `/cognitive-forge:debate`
- `/report-forge:generate`
- `/rovo-forge:jira-agent`

### Step 5: Install Forge Shell (Optional)

```bash
cd forge-shell
npm install
npm run tauri dev
```

The desktop app will launch with dashboards for all plugins.

## Quick Start Workflows

### Product Management (product-forge)

```bash
# Initialize cards directory
/product-forge:init

# Create intake
/product-forge:intake

# Create initiative
/product-forge:initiative

# Create epic (links to parent initiative)
/product-forge:epic

# Create story (links to parent epic)
/product-forge:story
```

All cards are saved to `cards/` and indexed in `cards/index.json`.

### Task Management (tasks-forge)

```bash
# Initialize tasks directory
/tasks-forge:start

# Create a task (sequential numbering: task-001.md, task-002.md, etc.)
/tasks-forge:add

# Update task status
/tasks-forge:update
```

Tasks are saved to `tasks/` and indexed in `tasks/index.json`.

### Organizational Memory (forge-memory)

```bash
# Initialize memory structure
/forge-memory:start

# Set up organizational taxonomy
/forge-memory:setup-org

# Store knowledge
/forge-memory:remember

# Retrieve knowledge
/forge-memory:recall
```

Taxonomy stored in `memory/context/` and indexed in `memory/index.json`.

### Multi-Agent Reasoning (cognitive-forge)

```bash
# Launch multi-agent debate
/cognitive-forge:debate

# Interactive exploration
/cognitive-forge:explore
```

Sessions saved to `sessions/` with date-based filenames (YYYY-MM-DD-slug.md) and indexed in `sessions/index.json`.

### Report Generation (report-forge)

```bash
# Generate report with multi-agent orchestration
/report-forge:generate

# List existing reports
/report-forge:list

# Update report status
/report-forge:update
```

Reports saved to `reports/` with date-based filenames and indexed in `reports/index.json`.

### Rovo Agent Configuration (rovo-forge)

```bash
# Build Jira agent config
/rovo-forge:jira-agent

# Build Confluence agent config
/rovo-forge:confluence-agent
```

Agent configs saved to `rovo-agents/{slug}/agent.md` and indexed in `rovo-agents/index.json`.

## forge-lib CLI Reference

See `forge-lib/README.md` for comprehensive CLI documentation.

**Quick examples:**

```bash
# Create an initiative card
python forge.py card create initiative \
  --title "Notification System Overhaul" \
  --data '{"status": "Draft", "product": "webapp", "priority": "P1"}'

# Query cards by type and status
python forge.py card query initiative --status "Approved"

# Create a task with sequential numbering
python forge.py task create \
  --title "Implement email notifications" \
  --data '{"priority": "P2", "status": "Ready"}'

# Link child to parent (bidirectional update)
python forge.py relationship link \
  initiative-filename.md \
  epic-filename.md

# Rebuild index from frontmatter
python forge.py index rebuild cards
```

All commands output JSON: `{"success": true, "data": {...}}` or `{"success": false, "error": "..."}`

## Data Format

All entities use YAML frontmatter + markdown body:

```markdown
---
type: initiative
title: "Notification System Overhaul"
status: Approved
product: webapp
priority: P1
created: 2026-02-14
updated: 2026-02-14
parent: null
children:
  - email-notification-engine
  - push-notification-service
---

## Background

[Initiative content here...]
```

## Index Files

Each plugin maintains an `index.json` file for fast queries:

```json
{
  "last_updated": "2026-02-14T12:00:00Z",
  "cards": [
    {
      "filename": "notification-system-overhaul.md",
      "type": "initiative",
      "title": "Notification System Overhaul",
      "status": "Approved",
      "product": "webapp",
      "priority": "P1",
      "created": "2026-02-14",
      "updated": "2026-02-14",
      "parent": null,
      "children": ["email-notification-engine", "push-notification-service"],
      "body": "## Background\n\n[Initiative content...]"
    }
  ]
}
```

Index files are updated automatically by `forge.py` on create/update operations.

## Validation

All entities are validated against JSON schemas in `forge-lib/schemas/`:

```bash
# Validate data before creation
python forge.py card create initiative \
  --title "Test" \
  --data '{"status": "InvalidStatus"}'

# Returns:
# {"success": false, "error": "Validation error: 'InvalidStatus' is not one of ['Draft', 'Submitted', 'Approved', 'Superseded']"}
```

## Templates

Markdown content is generated from Jinja2 templates in `forge-lib/templates/`:

- `initiative.md.j2` — Initiative card structure
- `epic.md.j2` — Epic card structure
- `story.md.j2` — Story card structure
- `task.md.j2` — Task structure
- `session.md.j2` — Debate/exploration session
- `report.md.j2` — Report structure with 8 types
- And more...

Templates are rendered with frontmatter data and body content.

## Forge Shell Desktop App

The Forge Shell provides visual dashboards for all plugins:

- **Cards View** — Grid display with filtering by type, status, product
- **Tasks Board** — Kanban-style board with status columns
- **Memory Browser** — Taxonomy tree with knowledge search
- **Sessions Viewer** — Session history with agent participation
- **Reports Archive** — Report library with filters
- **Rovo Configs** — Agent configuration gallery
- **Roadmap Timeline** — Product roadmap visualization

All views load data from `index.json` files via `ForgeUtils.readIndex()`.

See `forge-shell/README.md` for build and development instructions.

## Plugin Documentation

Each plugin has detailed documentation in its README:

- `product-forge/README.md` — Card hierarchy, relationship patterns, Jira integration
- `tasks-forge/README.md` — Task workflow, status transitions, priority system
- `forge-memory/README.md` — Taxonomy types, tiered lookup, knowledge organization
- `cognitive-forge/README.md` — Agent orchestration, debate vs exploration modes
- `report-forge/README.md` — 8 report types, multi-agent generation workflow
- `rovo-forge/README.md` — Jira vs Confluence agents, skill references, sample configs

## Testing & Validation

### forge-lib Unit Tests

```bash
cd forge-lib
python -m pytest tests/ -v
```

124 tests covering:
- Frontmatter parsing and serialization
- Slug generation and sequential numbering
- JSON Schema validation
- Index operations (create, read, update, rebuild)
- Card operations for all 7 types
- Task operations with status state machine
- Memory taxonomy operations
- Session and report operations
- Relationship bidirectional updates

### End-to-End Validation

See validation checkpoints in commit history:
- Validation Checkpoint 1: Foundation (schemas, templates, core utilities)
- Validation Checkpoint 2: Product Forge (initiative → epic → story chain)
- Validation Checkpoint 3: Forge Memory (taxonomy CRUD)
- Validation Checkpoint 4: Tasks Forge (sequential numbering, status workflow)
- Validation Checkpoint 5: Cognitive Forge (session creation, date-based naming)
- Validation Checkpoint 6: Report Forge + Rovo Forge (report generation, agent configs)

Each checkpoint includes CLI tests and verification of index.json updates.

## Troubleshooting

### forge.py command not found

Make sure you're in the `forge-lib` directory:
```bash
cd forge-lib
python forge.py --help
```

### Import errors in Python

Install dependencies:
```bash
cd forge-lib
pip install -r requirements.txt
```

### Plugin commands not showing in Claude Code

Verify marketplace installation:
```bash
ls -la ~/.claude/marketplaces/forge-v2
```

Check that `.claude-plugin/marketplace.json` exists and is valid JSON.

### Forge Shell won't launch

Install dependencies:
```bash
cd forge-shell
npm install
```

Make sure Rust is installed:
```bash
rustc --version
```

Install Rust from https://rustup.rs if needed.

### Index.json not updating

Rebuild the index:
```bash
python forge.py index rebuild cards
python forge.py index rebuild tasks
python forge.py index rebuild sessions
python forge.py index rebuild reports
python forge.py index rebuild rovo-agents
```

## Contributing

This is a personal project rebuild. See commit history for build phases and orchestration strategy.

## Version History

- **v2.0.0-alpha** (2026-02-14) — Complete architectural rebuild
  - Added forge-lib Python CLI
  - Simplified commands 60% (260 → 100 lines average)
  - Skills streamlined to reasoning-only
  - Index-based queries via index.json
  - JSON Schema validation
  - Jinja2 templates
  - Automatic bidirectional relationships
  - 6 plugins + Forge Shell desktop app

- **v1.0.x** — Original LLM-driven file operations architecture

## License

Private project.

## Author

Jeremy Brice
