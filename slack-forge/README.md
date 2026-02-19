# Slack Forge

Slack intelligence pipeline with a transcript-first harvest workflow.

## Overview

Slack Forge uses a two-stage model:

1. **Scan stage (`/slack-forge:scan`)**
- Primary agent uses Slack MCP tools.
- Pulls messages from configured scope.
- Writes local transcript snapshots under `slack-forge/transcripts/`.

2. **Capture stage (`/slack-forge:capture`)**
- Local-only subagents read transcript files.
- Extract tasks, knowledge, and JIRA digests.
- Create pending harvest records for human review.

Nothing is promoted to tasks-forge or forge-memory without explicit review.

## Key Features

- MCP-based Slack retrieval by primary agent during scan
- Local-file harvesting by subagents during capture
- Review-first workflow: pending -> approved/rejected -> promoted
- Optional scan chaining: scan-only, scan-then-ask-capture, scan-and-auto-capture
- Configurable scan windows (24h, 72h, 1 week, custom)
- Confidence scoring for extracted items

## Commands

### `/slack-forge:init`
Initialize Slack Forge and configure monitored channels.

### `/slack-forge:scan`
Primary-agent MCP command. Produces transcript files only.

Expected outputs (as available):
- `slack-forge/transcripts/{scan-date}-{timeframe}-public-channels.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-dms.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-jira-bot.md`

Execution modes:
- Scan only
- Scan then ask before capture
- Scan and auto-run capture

### `/slack-forge:capture`
Local transcript harvesting command. Creates harvest records via forge-lib:
- task harvests
- knowledge harvests
- jira-digest harvests

### `/slack-forge:review`
Review pending harvests and approve/reject/edit.

### `/slack-forge:promote`
Promote approved harvests to tasks-forge and forge-memory.

## Architecture

### Data Flow

1. `/slack-forge:init` writes `slack-forge/config.json`
2. `/slack-forge:scan` uses MCP and writes transcript snapshots
3. `/slack-forge:capture` reads transcript snapshots and writes harvest files
4. `/slack-forge:review` updates harvest statuses
5. `/slack-forge:promote` routes approved items downstream

### Command to forge-lib delegation

- `/slack-forge:init` -> `forge harvest init` + `forge harvest config`
- `/slack-forge:scan` -> transcript generation only (no harvest creation)
- `/slack-forge:capture` -> `forge harvest create` (via local-only subagents)
- `/slack-forge:review` -> `forge harvest query` + `forge harvest update`
- `/slack-forge:promote` -> `forge harvest query` + downstream create + `forge harvest update`

## Skills

- `task-harvester`: extraction rules for actionable tasks from transcript text
- `knowledge-harvester`: extraction rules for durable organizational knowledge from transcript text
- `jira-digest`: JIRA event parsing/summarization from transcript text

Skills and agents do not perform MCP retrieval.

## Data Model

### Harvest Record

Harvest files are managed by forge-lib using `type: harvest` and `harvest_type`:
- `task`
- `knowledge`
- `jira-digest`

Each harvest includes source attribution fields and review status.

### Configuration (`config.json`)

```json
{
  "channels": [
    {"id": "C01ABC123", "name": "eng-team", "type": "public", "monitor": true},
    {"id": "C03GHI789", "name": "jira-notifications", "type": "public", "monitor": true, "role": "jira"}
  ],
  "jira_channel": "C03GHI789",
  "updated": "2026-02-17"
}
```

## Status Workflow

```
pending -> approved -> promoted
    \
     -> rejected
```

## Dependencies

- **forge-lib** — Python CLI for all file operations. Install from `forge-lib/`:
  ```bash
  pip install -r requirements.txt
  python forge.py --help
  ```
- **Slack MCP** — Required by the primary agent during `scan` only. Sub-agents do not require MCP.

## CLI Reference

### Setup

```bash
forge harvest init
forge harvest config --get
forge harvest config --set channels '[{"id":"C01ABC123","name":"eng-team","monitor":true}]'
```

### Creating harvest records (used by sub-agents during capture)

```bash
forge harvest create "{title}" --harvest-type task --data '{...}'
forge harvest create "{title}" --harvest-type knowledge --data '{...}'
forge harvest create "{title}" --harvest-type jira-digest --data '{...}'
```

### Reviewing

```bash
forge harvest query --status pending
forge harvest query --harvest-type task
forge harvest update 2026-02-17-task-harvest-001.md --data '{"status":"approved"}'
forge harvest update 2026-02-17-task-harvest-001.md --data '{"status":"rejected"}'
```

### Promoting

```bash
forge harvest query --status approved
# then run /slack-forge:promote
```

## Verification

After setup, verify the pipeline end-to-end:

```bash
# 1. Confirm forge-lib is available
python forge.py --help

# 2. Initialize slack-forge
# Run: /slack-forge:init

# 3. Confirm config was written
forge harvest config --get

# 4. Run a scan (requires Slack MCP)
# Run: /slack-forge:scan

# 5. Confirm transcript files were written
ls slack-forge/transcripts/

# 6. Run capture to create harvest records
# Run: /slack-forge:capture

# 7. Confirm harvest records exist
forge harvest query --status pending

# 8. Review and approve/reject
# Run: /slack-forge:review
```
