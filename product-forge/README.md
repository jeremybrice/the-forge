# Product Forge Plugin

Product management plugin for structured card generation with forge-lib integration.

## Overview

Product Forge automates the creation and management of product management artifacts using a three-tier hierarchy (Initiative → Epic → Story). All file operations are delegated to the `forge-lib` Python CLI for deterministic data layer operations.

## Architecture

**Separation of Concerns:**
- **forge-lib** (Python CLI) = Deterministic data layer handling ALL file operations
- **Plugin Commands** = Conversational workflow and forge-lib delegation (80-100 lines each)
- **Skills** = Reasoning guidance (tone, methodology) with NO file operation details

## Card Types

Product Forge supports 7 card types:

| Card Type | Purpose | Filename Pattern |
|-----------|---------|------------------|
| **Initiative** | Top-level project scoping and ROM estimation | `{slug}.md` |
| **Epic** | Team-level feature container | `{slug}.md` |
| **Story** | Engineering-level work items | `story-NNN-{slug}.md` |
| **Intake** | Stakeholder interview outputs | `intake-{product}-{feature}.md` |
| **Checkpoint** | Knowledge capture snapshots | `checkpoint-YYYY-MM-DD-{slug}.md` |
| **Decision** | Architectural decision logs | `{slug}.md` |
| **Release Notes** | Release documentation | `release-notes-YYMMDD.md` |

## Commands

### Card Management

**`/init`** - Initialize Product Forge directory structure

**`/intake`** - Conduct stakeholder intake interview and create intake card

**`/initiative`** - Create Initiative card with ROM estimation and scope definition

**`/epic`** - Create Epic card linked to parent Initiative

**`/story`** - Create Story card linked to parent Epic with sequential numbering

**`/decision`** - Create architectural decision log entry

**`/checkpoint`** - Create knowledge checkpoint snapshot

**`/release-notes`** - Create release notes document

### Jira Integration

**`/link-to-jira`** - Link existing cards to Jira issues

**`/pull-from-jira`** - Import Jira issues as Product Forge cards

**`/push-to-jira`** - Synchronize card changes back to Jira

## Hierarchy & Relationships

Product Forge enforces a strict hierarchy:

```
Initiative (Top Level)
├── Epic (Team Level)
│   ├── Story (Engineering Level)
│   └── Decision (Architectural Decision)
├── Decision (Initiative-level Decision)
└── Checkpoint (Knowledge Capture)

Intake (Standalone or linked to Initiative)
```

**Parent-Child Relationships:**
- Initiatives can have Epic and Decision children
- Epics can have Story and Decision children
- Stories, Checkpoints, and Release Notes have no children
- Intakes can link to Initiatives

## forge-lib Integration

All file operations use forge-lib CLI commands:

**Create cards:**
```bash
forge card create initiative "Title" --data '{"product": "webapp", "status": "Draft"}'
forge card create epic "Title" --parent initiative-slug --data '{"status": "Planning"}'
forge card create story "Title" --parent epic-slug --data '{"priority": "High"}'
```

**Query cards:**
```bash
forge card query --type initiative --status Draft
forge card query --type story --parent epic-slug --status "In Progress"
forge card query --product webapp
```

**Update cards:**
```bash
forge card update initiative-slug --data '{"status": "Approved"}'
```

**Relationship operations:**
```bash
forge relationship link story-001-slug epic-slug
forge relationship unlink story-001-slug epic-slug
forge relationship validate epic-slug story-001-slug
```

## Skills

### pm-methodology

Provides product management reasoning guidance and tone recommendations:
- Jira hierarchy explanation (Initiative → Epic → Story)
- Planning progression rules
- Card type selection logic
- Tone by card type (Executive, Planning, Engineering)
- Content guidelines

**Key principle:** All file operations delegated to forge-lib. This skill focuses on *how to think* about PM artifacts, not *how to write files*.

### product-context

Provides domain knowledge about the organization:
- Product ecosystem understanding
- Client relationship context
- Integration landscape
- Team structure

Uses `forge memory get-taxonomy` to read organizational taxonomy (products, clients, teams, integrations) and enrich card generation with proper tagging.

### jira-sync

Provides reasoning guidance for Jira sync operations:
- Field mapping logic (Forge ↔ Jira)
- Conflict resolution strategies
- Parent relationship validation
- MCP error handling patterns
- Status independence principle (local status vs. Jira status)

**Key principle:** All file operations delegated to forge-lib. This skill focuses on *how to reason about conflicts* and *which fields to sync*, not MCP tool calls.

## Workflow Examples

### Create Initiative → Epic → Story Chain

```
User: "Create an initiative for notification system overhaul"

1. Claude invokes pm-methodology skill to determine card type (Initiative)
2. Claude invokes product-context skill to resolve product/module tags
3. Claude calls: forge card create initiative "Notification System Overhaul" --data '{...}'
4. forge-lib validates frontmatter, renders template, writes file, updates index

User: "Create an epic for the email notification engine"

5. Claude calls: forge card create epic "Email Notification Engine" --parent notification-system-overhaul --data '{...}'
6. forge-lib links epic to parent initiative, updates parent's children array

User: "Create a story for the notification template builder"

7. Claude calls: forge card create story "Notification Template Builder" --parent email-notification-engine --data '{...}'
8. forge-lib generates story-001-notification-template-builder.md, links to parent epic
```

### Query Cards by Status

```
User: "Show me all draft initiatives for the webapp product"

Claude calls: forge card query --type initiative --status Draft --product webapp

forge-lib returns JSON with matching cards from index.json
```

## Directory Structure

```
product-forge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   ├── init.md
│   ├── intake.md
│   ├── initiative.md
│   ├── epic.md
│   ├── story.md
│   ├── decision.md
│   ├── checkpoint.md
│   ├── release-notes.md
│   ├── link-to-jira.md
│   ├── pull-from-jira.md
│   └── push-to-jira.md
└── skills/
    ├── pm-methodology/
    │   └── SKILL.md
    ├── product-context/
    │   └── SKILL.md
    └── jira-sync/
        └── SKILL.md
```

## Data Storage

Product Forge uses forge-lib's data layer:

```
cards/
├── initiatives/
├── epics/
├── stories/
├── intakes/
├── checkpoints/
├── decisions/
└── release-notes/

index.json  ← Generated by forge-lib for fast queries
```

All markdown files use YAML frontmatter with schemas defined in `forge-lib/schemas/`.

## Installation

1. Ensure `forge-lib` is installed and available in PATH
2. Place `product-forge/` directory in your Claude plugins directory
3. Run `forge memory init` to initialize taxonomy (optional)

## Version History

**2.0.0-alpha** - Complete rebuild with forge-lib integration
- Commands simplified from ~260 lines to ~100 lines
- All file operations delegated to forge-lib
- Skills streamlined to reasoning-only (no templates/schemas)
- Faster performance via JSON index files

**1.x** - Original LLM-driven file operation architecture (deprecated)

## Dependencies

- forge-lib >=2.0.0-alpha
- Python 3.9+
- PyYAML, Jinja2, jsonschema (installed with forge-lib)

## License

MIT
