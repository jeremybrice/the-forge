# README Rebrand Design

**Date:** 2026-02-22
**Status:** Approved

## Context

The current README.md is ~515 lines of technical documentation with no images, no branding, and no visual hierarchy. It reads like internal developer docs. The goal is to rebrand it as a polished product landing page for portfolio showcase purposes.

## Audience

Portfolio showcase — recruiters, hiring managers, and peers evaluating the work. Need to demonstrate ambition, craft, and completeness.

## Approach

**Product Landing Page README** — structured like a product homepage that scrolls through 7 branded sections. Deep technical detail (CLI reference, data formats, troubleshooting) moves out to individual plugin READMEs and forge-lib/README.md.

## Design

### Section 1: Hero Block

Centered layout with:
- Forge app icon (120px) from `forge-shell/forge-app-icon.png`
- "The Forge" heading
- Tagline: **"AI-native product management for Claude Code"**
- One-liner description
- 4 badges: version (orange), Python 3.8+ (blue), 124 tests passing (green), 7 plugins (violet)

### Section 2: What is The Forge?

- 2-3 sentence value prop explaining the three layers (7 plugins + Python CLI + desktop app)
- **Hero screenshot**: `docs/images/forge-shell-dashboard.png` — wide shot of Forge Shell showing sidebar + main content area

### Section 3: Plugin Grid

Table with emoji icons, plugin names in bold, and one-line descriptions:

| Emoji | Plugin | One-liner |
|-------|--------|-----------|
| :clipboard: | Product Forge | Initiatives, epics, stories — full product hierarchy with auto-linked relationships |
| :white_check_mark: | Tasks Forge | Sequential task tracking with status workflow and priority management |
| :brain: | Cognitive Forge | Multi-agent debates and explorations with 5 specialized reasoning agents |
| :bulb: | Forge Memory | Organizational knowledge with taxonomy — products, modules, teams, integrations |
| :bar_chart: | Report Forge | 8 report types generated via multi-agent orchestration |
| :robot: | Rovo Forge | Interactive builders for Atlassian Rovo Jira & Confluence agents |
| :speech_balloon: | a removed harvest plugin | Channel intelligence harvester — surfaces tasks, knowledge, and JIRA activity |

### Section 4: Architecture Diagram

Mermaid diagram (GitHub renders natively) showing:
- Claude Code → LLM Reasoning Layer → Plugin Commands (80-100 lines each)
- 7 Plugins fan out from commands
- All plugins → forge.py (Python CLI)
- forge.py → JSON Schema Validation, Jinja2 Templates, Index Operations, Relationship Linking
- Data Layer: cards/, tasks/, sessions/, memory/, reports/
- Forge Shell (Tauri Desktop App) reads from all data directories

### Section 5: Forge Shell Screenshots

Table layout alternating screenshots and descriptions:
- **Cards View** (`docs/images/forge-shell-cards.png`) — Product Forge filterable grid
- **Tasks Board** (`docs/images/forge-shell-tasks.png`) — Kanban-style board
- **Roadmap** (`docs/images/forge-shell-roadmap.png`) — Timeline visualization

### Section 6: Quick Start

Minimal 4-step install:
1. `cd forge-lib && pip install -r requirements.txt`
2. `python forge.py --help`
3. Symlink marketplace to `~/.claude/marketplaces/forge`
4. (Optional) `cd forge-shell && npm install && npm run tauri dev`

One line pointing to plugin READMEs for detailed workflows.

### Section 7: Footer

- Documentation links table — one row per plugin README + forge-lib + forge-shell
- Author: Jeremy Brice
- Centered "Built with Python · Rust · Vanilla JS · Claude Code" footer

## Screenshots to Capture

User will capture these and save to `docs/images/`:

1. **`forge-shell-dashboard.png`** — Main landing/overview (hero image for Section 2)
2. **`forge-shell-cards.png`** — Product Forge cards grid with data populated
3. **`forge-shell-tasks.png`** — Tasks board/kanban view
4. **`forge-shell-roadmap.png`** — Roadmap timeline view

## What Gets Removed

All of the following moves out of README.md (already exists in plugin READMEs and forge-lib/README.md):
- v1 vs v2 comparison table
- Full directory tree
- Detailed installation steps (Steps 1-5)
- All "Quick Start Workflows" per plugin
- forge-lib CLI Reference section
- Data Format section (YAML frontmatter examples)
- Index Files section (index.json examples)
- Validation section
- Templates section
- Full Forge Shell architecture details
- Testing & Validation section
- Troubleshooting section
- Version History section

## Implementation

1. Create `docs/images/` directory
2. Write new README.md (~150-180 lines)
3. User captures 4 screenshots and adds them to `docs/images/`
