# slack-forge Design Document

**Date:** 2026-02-17
**Status:** Approved
**Plugin:** slack-forge
**Version:** v1.0.0

## Overview

slack-forge is a Slack intelligence plugin that harvests tasks, organizational knowledge, and JIRA activity summaries from Slack conversations using the Claude AI Slack MCP tools. It creates review-first harvest records that users curate before promoting to tasks-forge and forge-memory.

## Commands

| Command | Purpose |
|---------|---------|
| `/slack-forge:init` | Discover Slack channels, let user select which to monitor, save config. Re-runnable to update channel list. |
| `/slack-forge:scan` | Orchestrator — asks for time frame, then runs 3 sequential sub-agents (tasks, knowledge, JIRA). Creates harvest records. |
| `/slack-forge:review` | Present pending harvest records for approve / reject / edit. |
| `/slack-forge:promote` | Push approved items to tasks-forge and/or forge-memory via existing forge-lib commands. |

## Architecture: Scan Orchestration

The `/slack-forge:scan` command uses a sequential sub-agent pattern. Each agent gets its own focused context and dedicated MCP session, which ensures extraction quality and respects Slack API rate limits.

```
User: /slack-forge:scan
  |
  +-- Ask time frame (24h / 72h / 1 week / custom)
  +-- Calculate cutoff timestamp from current time
  +-- Load channel config from slack-forge/config.json
  |
  +-- Agent 1: Task Harvester
  |   +-- Read configured channels via Slack MCP
  |   +-- Extract conversations that imply tasks/action items
  |   +-- Create harvest records (harvest_type: task) via forge-lib
  |   +-- Report back: "Found 4 potential tasks"
  |
  +-- Agent 2: Knowledge Harvester
  |   +-- Read same channels via Slack MCP
  |   +-- Extract knowledge (decisions, context about people/projects, important info)
  |   +-- Create harvest records (harvest_type: knowledge) via forge-lib
  |   +-- Report back: "Found 6 knowledge items"
  |
  +-- Agent 3: JIRA Digest
  |   +-- Read JIRA bot channel via Slack MCP
  |   +-- Summarize activity + extract structured action items
  |   +-- Create harvest record (harvest_type: jira-digest) via forge-lib
  |   +-- Report back: "Summarized 12 JIRA events"
  |
  +-- Orchestrator presents unified summary
```

## Data Model

### Data Directory

`slack-forge/` following the standard forge pattern with `index.json`.

### Config File: `slack-forge/config.json`

```json
{
  "channels": [
    { "id": "C01ABC123", "name": "engineering", "type": "public", "monitor": true },
    { "id": "C02DEF456", "name": "product-team", "type": "private", "monitor": true },
    { "id": "D03GHI789", "name": "dm-todd-martinez", "type": "dm", "monitor": true },
    { "id": "C04JKL012", "name": "jira-bot-feed", "type": "public", "monitor": true, "role": "jira" }
  ],
  "jira_channel": "C04JKL012",
  "updated": "2026-02-17"
}
```

The `role: "jira"` flag identifies the JIRA bot channel. All other `monitor: true` channels get scanned by task and knowledge agents.

### Harvest Record Schema

Single schema for all three harvest types:

**Required fields:** `title`, `type` (const: "harvest"), `harvest_type` (task | knowledge | jira-digest), `status` (pending | approved | rejected | promoted), `source_channel`, `source_channel_id`, `source_timestamp`, `source_author`, `scan_timeframe`, `scan_date`, `confidence` (high | medium | low), `created`, `updated`

### File Naming Pattern

`YYYY-MM-DD-{harvest_type}-{NNN}.md`

Examples:
- `2026-02-17-task-harvest-001.md`
- `2026-02-17-knowledge-harvest-001.md`
- `2026-02-17-jira-digest-001.md`

### Example Harvest Record

```yaml
---
title: "Review API authentication flow"
type: harvest
harvest_type: task
status: pending
source_channel: "engineering"
source_channel_id: "C01ABC123"
source_timestamp: "2026-02-16T14:32:00Z"
source_author: "todd-martinez"
scan_timeframe: "72h"
scan_date: "2026-02-17"
confidence: high
created: 2026-02-17
updated: 2026-02-17
---

## Extracted Content

Todd mentioned the API auth flow needs a review before the Q1 release.
He asked Jeremy to take a look by EOD Thursday.

## Source Context

> "Hey can you review the auth flow changes? We need that locked down
> before Q1 release" -- Todd, #engineering, Feb 16
```

### Status Workflow

```
pending  -> approved | rejected
approved -> promoted
rejected -> (terminal)
promoted -> (terminal)
```

No backwards transitions.

## forge-lib Integration

### New Files

| File | Purpose |
|------|---------|
| `core/harvest_ops.py` | Create, query, update harvest records. Sequential numbering per harvest_type per day. |
| `schemas/harvest.json` | JSON Schema for harvest records |
| `templates/harvest.md.j2` | Jinja2 template for harvest markdown files |

### New CLI Commands in `forge.py`

```bash
# Initialize slack-forge data directory + config
forge harvest init --directory .

# Create a harvest record
forge harvest create "Review API auth flow" \
  --harvest-type task \
  --data '{"source_channel": "engineering", "source_channel_id": "C01ABC123",
           "source_timestamp": "2026-02-16T14:32:00Z", "source_author": "todd-martinez",
           "scan_timeframe": "72h", "confidence": "high"}'

# Query harvests
forge harvest query --status pending --harvest-type task
forge harvest query --status approved

# Update harvest status
forge harvest update 2026-02-17-task-harvest-001.md \
  --data '{"status": "approved"}'

# Channel config management
forge harvest config --set-channels '[...]'
forge harvest config --set-jira-channel "C04JKL012"
forge harvest config --get
```

### Promote Workflow

The `/slack-forge:promote` command (not forge-lib) handles cross-plugin routing:

1. Query approved harvests via `forge harvest query --status approved`
2. For task harvests: call `forge task create "title" --data '{...}'`
3. For knowledge harvests: call `forge memory create-knowledge <type> "name" --data '{...}'`
4. Mark harvest as promoted via `forge harvest update <file> --data '{"status": "promoted"}'`

## Init Command Flow

### First Run

1. Create data directory via `forge harvest init --directory .`
2. Discover channels via `slack_search_channels` and `slack_search_users` MCP tools
3. Present full channel list to user for selection
4. Ask user to identify the JIRA bot feed channel
5. Save config via `forge harvest config` commands
6. Confirm setup with channel count and next steps

### Re-run (Config Update)

1. Load existing config via `forge harvest config --get`
2. Re-scan available channels
3. Show new channels not in config, existing monitored channels
4. Let user add/remove channels
5. Save updated config

## Sub-Agent Skills

Three skill files in `slack-forge/skills/`, providing pure reasoning guidance (no file operations):

### `task-harvester/SKILL.md`

- What constitutes a task (direct asks, commitments, deadlines, action items)
- Distinguishing real tasks from casual conversation
- Confidence scoring: high = explicit ask with assignee/deadline, medium = implied action item, low = might be a task
- Task attribution (who asked, who's responsible)
- Clean title extraction from conversational context
- Deduplication across channels

### `knowledge-harvester/SKILL.md`

- What constitutes preservable knowledge (decisions, process changes, people context, project updates, acronym definitions)
- Mapping to forge-memory types: person, project, glossary, general
- When to suggest updating existing memory vs creating new
- Confidence scoring: high = explicit decision/announcement, medium = useful context, low = might be worth saving
- Noise filtering (social chat, off-topic, repetitive standups)

### `jira-digest/SKILL.md`

- Parsing JIRA bot message patterns (assignments, status transitions, comments, mentions)
- Grouping events by ticket for readability
- Identifying actionable vs informational events
- Structured item extraction: `{ticket, event_type, summary, needs_action}`
- Summary writing: chronological narrative highlighting items needing attention

## Forge Shell View Controller

**New file:** `forge-shell/app/js/slack-forge.js`

**Plugin entry in `shell.js`:**
```js
{ id: 'slack-forge', label: 'Slack Forge', icon: 'fa-brands fa-slack', requiredDir: 'slack-forge' }
```

**Dashboard layout:**
- Status counts at top (pending, approved, promoted, rejected)
- Filter by harvest_type (tasks, knowledge, JIRA) and status
- Card list showing source channel, author, timeframe, confidence
- Config summary at bottom (channel count, last scan date)
- Data loaded via direct FS scanning of `slack-forge/` directory

## Time Frame Handling

All three commands share the same time frame options:
- **24h** — past 24 hours from current time
- **72h** — past 72 hours from current time
- **1 week** — past 7 days from current time
- **Custom** — user specifies a start date

The scan command calculates the cutoff timestamp from the current system time and passes it as context to each sub-agent.

## Slack MCP Integration

Uses the built-in Claude AI Slack MCP tools:
- `slack_search_channels` — channel discovery during init
- `slack_search_users` — DM discovery during init
- `slack_read_channel` — reading channel messages during scan
- `slack_search_public_and_private` — searching across channels if needed

No custom Slack API integration required.

## Design Decisions

1. **Review-first model** — Harvest records are staging area. Nothing touches tasks-forge or forge-memory until user explicitly approves and promotes.
2. **Sequential sub-agents** — Respects Slack MCP rate limits, gives each agent focused context for better extraction quality.
3. **Single schema, three harvest types** — Keeps forge-lib simple. One set of CRUD operations handles all harvest types.
4. **Config-driven channels** — Discover once, scan repeatedly. No per-scan channel selection friction.
5. **Promote as LLM command, not forge-lib** — Cross-plugin routing is reasoning work (mapping harvest fields to task/memory fields). forge-lib stays focused on CRUD.
