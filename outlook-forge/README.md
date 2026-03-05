# Outlook Forge

Outlook intelligence harvester for The Forge Marketplace. Scans your Outlook calendar and inbox via **Claude in Chrome** browser automation, extracts actionable tasks, knowledge, and meeting context, then routes approved items to downstream forge plugins.

## Requirements

- Claude in Chrome extension installed and connected
- Logged into `outlook.office.com` in Chrome
- Claude Code with `--chrome` flag or `/chrome` enabled
- forge-lib installed (`pip install -r forge-lib/requirements.txt`)

## Commands

| Command | Description |
|---------|-------------|
| `/outlook-forge:init` | Discover Outlook folders/calendars and configure scan sources |
| `/outlook-forge:scan` | Navigate Outlook Web via Chrome and write transcript files |
| `/outlook-forge:capture` | Dispatch harvester agents on local transcripts |
| `/outlook-forge:review` | Interactive review of pending harvests (A/R/E/S) |
| `/outlook-forge:promote` | Push approved items to tasks-forge, forge-memory, product-forge |

## Architecture

```
/outlook-forge:scan  (Chrome-primary, requires browser)
    └── Chrome navigates outlook.office.com
    └── Reads calendar events, inbox emails
    └── Writes outlook-forge/transcripts/*.md
    └── Optional: chains to /outlook-forge:capture

/outlook-forge:capture  (local orchestrator, no Chrome)
    └── Reads outlook-forge/transcripts/*.md
    └── Dispatches: forge-email-harvester (tasks + knowledge)
    └── Dispatches: forge-calendar-harvester (meeting-prep + scheduling tasks)
    └── Dispatches: forge-meeting-harvester (meeting-notes)
    └── All harvests created with status: pending

/outlook-forge:review  (interactive)
    └── forge harvest query --status pending
    └── A=approve / R=reject / E=edit / S=skip

/outlook-forge:promote  (routes by harvest type)
    └── task → forge task create (tasks-forge)
    └── knowledge → forge memory create-knowledge (forge-memory)
    └── meeting-prep → forge card create (product-forge)
    └── meeting-notes → forge task create per action item (tasks-forge)
```

## Harvest Types

| Type | Source | Content |
|------|--------|---------|
| `task` | emails, calendar | Action items with deadlines and owners |
| `knowledge` | emails | Decisions, policy changes, reference info |
| `meeting-prep` | calendar (future) | Preparation checklists for upcoming meetings |
| `meeting-notes` | calendar (past) | Post-meeting action items and decisions |

## Scan Parameters

```
/outlook-forge:scan --source calendar --days 3
/outlook-forge:scan --source inbox --days 1
/outlook-forge:scan --source inbox --days 1 --unread-only
/outlook-forge:scan --source sent --days 7
/outlook-forge:scan --source folder:project-x --days 3
```

## Skills

| Skill | Purpose |
|-------|---------|
| `email-harvester` | Email signal identification: action items, deadlines, decisions, knowledge |
| `calendar-harvester` | Calendar extraction: meeting prep, scheduling tasks, attendee context |
| `meeting-harvester` | Post-meeting extraction: action items, decisions, follow-ups |

## Data Model

Reuses the forge-lib harvest schema. The `source_channel` field holds the Outlook folder name (inbox, sent, calendar, folder:{name}). The `source_author` field holds the sender email or meeting organizer.

## Status Workflow

```
pending → approved → promoted   (terminal)
        → rejected              (terminal)
```

## CLI Reference

```bash
# Harvest management
forge harvest query --status pending --plugin outlook-forge
forge harvest query --harvest-type task --plugin outlook-forge
forge harvest update {filename} --data '{"status": "approved"}' --plugin outlook-forge

# Transcript management
forge transcript filename --scan-date 2026-03-03 --timeframe 3d --type calendar --dir outlook-forge/transcripts
```

## Verification

1. Run `/outlook-forge:init` — should discover folders and calendars via Chrome
2. Run `/outlook-forge:scan --source calendar --days 1` — should create a calendar transcript
3. Run `/outlook-forge:scan --source inbox --days 1` — should create an inbox transcript
4. Run `/outlook-forge:capture` — should create harvest records from transcripts
5. Run `/outlook-forge:review` — should present harvests for interactive review
6. Run `/outlook-forge:promote` — should create tasks/knowledge/cards from approved harvests
