# Slack Forge

Slack intelligence harvester with review-first workflow for extracting tasks, knowledge, and JIRA activity.

## Overview

Slack Forge scans monitored Slack channels for actionable intelligence — tasks people mention, knowledge worth preserving, and JIRA activity summaries. All extracted items go through a **review-first model**: nothing is promoted to tasks-forge or forge-memory without explicit human approval.

**Key Features:**
- Channel discovery and configuration via Slack MCP tools
- 3 sequential sub-agents for scanning (task harvester, knowledge harvester, JIRA digest)
- Review-first workflow: pending → approved/rejected → promoted
- Promotion routes items to tasks-forge and forge-memory via existing forge-lib commands
- Configurable time frames (24h, 72h, 1 week, custom)
- Confidence scoring (high/medium/low) for each extracted item

## Architecture

**V2 vs V1:**
- **V1**: LLM directly reads/writes harvest files, manages YAML, handles numbering
- **V2**: forge-lib CLI handles all file operations, LLM focuses on workflow and conversation

**Commands → forge-lib delegation:**
- `/slack-forge:init` → `forge harvest init` + `forge harvest config`
- `/slack-forge:scan` → `forge harvest create` (via sub-agents)
- `/slack-forge:review` → `forge harvest query` + `forge harvest update`
- `/slack-forge:promote` → `forge harvest query` + `forge task create` / `forge memory create-knowledge` + `forge harvest update`

**Skills:**
- `task-harvester`: Reasoning-only skill for identifying actionable tasks in Slack messages
- `knowledge-harvester`: Reasoning-only skill for identifying knowledge worth preserving
- `jira-digest`: Reasoning-only skill for summarizing JIRA bot activity

## Commands

### `/slack-forge:init` - Initialize Slack Forge

Discover Slack channels, let user select which to monitor, save configuration. Re-runnable to update channel list.

**Usage:**
```
/slack-forge:init
```

**What it does:**
1. Creates `slack-forge/` directory structure via `forge harvest init`
2. Discovers accessible channels via Slack MCP tools
3. Lets user select channels to monitor
4. Identifies JIRA bot feed channel (if any)
5. Saves configuration via `forge harvest config`

**When to use:**
- First-time setup in a new project
- Updating monitored channel list

---

### `/slack-forge:scan` - Scan Slack Channels

Orchestrator command — asks for time frame, then runs 3 sequential sub-agents to extract tasks, knowledge, and JIRA activity. Creates harvest records for each item found.

**Usage:**
```
/slack-forge:scan
```

**Interactive Prompts:**
- Time frame: 24h / 72h / 1 week / custom date range

**Sub-agents (run sequentially):**
1. **Task Harvester** — Reads monitored channels, identifies actionable tasks
2. **Knowledge Harvester** — Reads monitored channels, identifies knowledge items
3. **JIRA Digest** — Reads JIRA bot channel, summarizes ticket activity

**forge-lib command (per extracted item):**
```bash
forge harvest create "Task title" --harvest-type task --data '{"source_channel": "eng-team", "confidence": "high"}'
```

---

### `/slack-forge:review` - Review Pending Harvests

Present pending harvest records for human review. Each item can be approved, rejected, edited, or skipped.

**Usage:**
```
/slack-forge:review
```

**Interactive Review:**
- Items grouped by harvest_type (tasks, knowledge, JIRA digests)
- For each item: Approve / Reject / Edit / Skip
- Edit allows modifying title and content before approving

**forge-lib commands:**
```bash
forge harvest query --status pending
forge harvest update {filename} --data '{"status": "approved"}'
forge harvest update {filename} --data '{"status": "rejected"}'
```

---

### `/slack-forge:promote` - Promote Approved Harvests

Push approved items to tasks-forge and/or forge-memory via existing forge-lib commands.

**Usage:**
```
/slack-forge:promote
```

**Routing by harvest_type:**
- **task** → `forge task create` (creates task in tasks-forge)
- **knowledge** → `forge memory create-knowledge` (creates knowledge entry in forge-memory)
- **jira-digest** → Informational only, marked as promoted directly

**forge-lib commands:**
```bash
forge harvest query --status approved
forge task create "Task title" --data '{"priority": 3, "status": "Open"}'
forge memory create-knowledge person "Jane Smith" --data '{"role": "Backend Engineer"}'
forge harvest update {filename} --data '{"status": "promoted"}'
```

## Skills

### task-harvester

**Purpose:** Reasoning-only guidance for identifying actionable tasks in Slack messages.

**Provides:**
- Criteria for what constitutes an actionable task vs. casual conversation
- Confidence scoring logic (high/medium/low)
- Field extraction rules (title, assignee, due date, priority)
- Deduplication reasoning (avoid harvesting the same task twice)

**Does NOT provide:**
- File format details (handled by forge-lib)
- YAML parsing instructions (handled by forge-lib)
- Directory structure (handled by forge-lib)

### knowledge-harvester

**Purpose:** Reasoning-only guidance for identifying knowledge worth preserving.

**Provides:**
- Criteria for knowledge types (person expertise, project context, glossary terms, general knowledge)
- Memory type classification (person/project/glossary/general)
- Confidence scoring logic
- Context extraction rules

### jira-digest

**Purpose:** Reasoning-only guidance for summarizing JIRA bot activity.

**Provides:**
- JIRA event type classification (created, transitioned, commented, resolved)
- Summary generation logic for batches of JIRA events
- Priority inference from ticket patterns
- Sprint and epic grouping reasoning

## Data Model

### Harvest Record

All harvest files are created and managed by forge-lib using the harvest schema.

**Example harvest file:**
```yaml
---
title: "Implement rate limiting for API gateway"
type: "harvest"
harvest_type: "task"
status: "pending"
source_channel: "eng-team"
source_channel_id: "C01ABC123"
source_author: "jane.smith"
source_timestamp: "2026-02-17T14:30:00Z"
scan_timeframe: "24h"
scan_date: "2026-02-17"
confidence: "high"
tags: ["api", "rate-limiting"]
created: "2026-02-17"
updated: "2026-02-17"
---

## Extracted Content

Jane mentioned we need rate limiting on the API gateway before the v2 launch.

## Source Context

> @channel heads up — we need to get rate limiting in place before the v2 launch next week. I'll draft a design doc but someone needs to own the implementation.
```

### Configuration (config.json)

```json
{
  "channels": [
    {"id": "C01ABC123", "name": "eng-team", "type": "public", "monitor": true},
    {"id": "C02DEF456", "name": "product-updates", "type": "public", "monitor": true},
    {"id": "C03GHI789", "name": "jira-notifications", "type": "public", "monitor": true, "role": "jira"}
  ],
  "jira_channel": "C03GHI789",
  "updated": "2026-02-17"
}
```

### File Naming Pattern

```
YYYY-MM-DD-{harvest_type}-NNN.md
```

**Examples:**
- `2026-02-17-task-harvest-001.md`
- `2026-02-17-knowledge-harvest-001.md`
- `2026-02-17-jira-digest-001.md`

## Status Workflow

```
pending → approved → promoted
    ↓
 rejected
```

- **pending**: Newly created by scan, awaiting human review
- **approved**: Human confirmed the item is valid
- **rejected**: Human dismissed the item (terminal)
- **promoted**: Successfully pushed to tasks-forge or forge-memory (terminal)

## forge-lib CLI Reference

**Initialize slack-forge directory:**
```bash
forge harvest init
```

**Create harvest record:**
```bash
forge harvest create "Item title" --harvest-type task --data '{"source_channel": "eng-team", "confidence": "high"}'
forge harvest create "Knowledge item" --harvest-type knowledge --data '{"source_channel": "eng-team", "confidence": "medium"}'
forge harvest create "JIRA Weekly Digest" --harvest-type jira-digest --data '{"source_channel": "jira-notifications", "confidence": "high"}'
```

**Get harvest record:**
```bash
forge harvest get 2026-02-17-task-harvest-001
```

**Query harvest records:**
```bash
forge harvest query
forge harvest query --status pending
forge harvest query --harvest-type task
```

**Update harvest record:**
```bash
forge harvest update 2026-02-17-task-harvest-001 --data '{"status": "approved"}'
forge harvest update 2026-02-17-task-harvest-001 --data '{"status": "promoted"}'
```

**Manage channel config:**
```bash
forge harvest config --get
forge harvest config --set-channels '[{"id": "C01ABC123", "name": "eng-team", "type": "public", "monitor": true}]'
forge harvest config --set-jira-channel "C03GHI789"
```

All commands return JSON for easy parsing and integration.

## Scan Orchestration Flow

The `/slack-forge:scan` command runs 3 sub-agents sequentially:

```
1. Task Harvester
   - Read each monitored channel via slack_read_channel
   - Apply task-harvester skill reasoning
   - Create harvest records (--harvest-type task)
   - Report: "Found X potential tasks"

2. Knowledge Harvester
   - Read same channels (reuse cached content)
   - Apply knowledge-harvester skill reasoning
   - Create harvest records (--harvest-type knowledge)
   - Report: "Found X knowledge items"

3. JIRA Digest
   - Read JIRA bot channel only
   - Apply jira-digest skill reasoning
   - Create harvest record(s) (--harvest-type jira-digest)
   - Report: "Summarized X JIRA events"
```

## Time Frame Options

| Option | Description | Slack API Parameter |
|--------|-------------|-------------------|
| 24h | Last 24 hours | `oldest` = now - 86400 |
| 72h | Last 3 days | `oldest` = now - 259200 |
| 1 week | Last 7 days | `oldest` = now - 604800 |
| Custom | User-specified date range | `oldest` / `latest` from user input |

## Workflow Example

```
# 1. Initialize — discover and select channels
/slack-forge:init
> Found 12 accessible channels
> Select channels to monitor: [eng-team, product-updates, design-sync]
> JIRA bot channel: jira-notifications
> Configuration saved (3 channels + 1 JIRA feed)

# 2. Scan — extract intelligence from Slack
/slack-forge:scan
> Time frame? 24h
> Agent 1: Task Harvester — found 4 potential tasks
> Agent 2: Knowledge Harvester — found 2 knowledge items
> Agent 3: JIRA Digest — summarized 8 JIRA events
> Total: 7 harvest records created. Run /slack-forge:review to review.

# 3. Review — approve or reject each item
/slack-forge:review
> [Task] "Implement rate limiting" (high confidence) — Approve
> [Task] "Update onboarding docs" (medium confidence) — Approve
> [Task] "Fix CSS on login page" (low confidence) — Reject
> [Task] "Deploy to staging" (medium confidence) — Skip
> [Knowledge] "Jane Smith — API gateway expert" (high confidence) — Approve
> [Knowledge] "Phoenix project uses Redis caching" (medium confidence) — Approve
> [JIRA Digest] "Feb 17 — 8 events" (high confidence) — Approve
> Summary: 5 approved, 1 rejected, 1 skipped

# 4. Promote — push approved items to forge plugins
/slack-forge:promote
> [Task] "Implement rate limiting" → tasks/task-012.md (Open, High)
> [Task] "Update onboarding docs" → tasks/task-013.md (Open, Medium)
> [Knowledge] "Jane Smith" → memory/people/jane-smith.md
> [Knowledge] "Phoenix project" → memory/projects/phoenix-project.md
> [JIRA Digest] "Feb 17" → marked promoted (informational only)
> Summary: 5 items promoted
```

## Verification

After installation, verify the plugin is working:

1. **Initialize slack-forge directory:**
   ```
   /slack-forge:init
   ```
   Expected: Creates `slack-forge/` directory with `config.json`

2. **Run a scan:**
   ```
   /slack-forge:scan
   ```
   Expected: Interactive scan creates harvest records in `slack-forge/`

3. **Review pending items:**
   ```
   /slack-forge:review
   ```
   Expected: Interactive review of pending harvest records

4. **Verify forge-lib integration:**
   ```bash
   python forge-lib/forge.py harvest query --directory .
   ```
   Expected: Returns JSON with `{"success": true, "data": {"harvests": [...]}}`

## Dependencies

- **forge-lib** v2.0.0+ with harvest operations support
- Python 3.9+
- Claude AI Slack MCP tools (`slack_search_channels`, `slack_search_users`, `slack_read_channel`)

## Notes

- Harvest numbers are sequential per type and permanent (001, 002, 003...)
- Rejected and promoted harvests remain in slack-forge/ directory for audit trail
- All schema validation handled by forge-lib
- Safe to edit harvest files manually (forge-lib validates on read)
- Index automatically rebuilds when files change
- Config can be updated at any time by re-running `/slack-forge:init`
