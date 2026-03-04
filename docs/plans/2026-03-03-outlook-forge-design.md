# Outlook-Forge Plugin Design

**Date:** 2026-03-03
**Status:** Approved
**Plugin:** outlook-forge
**Version:** v2.1.0-alpha (marketplace standard)

## Overview

New plugin for extracting calendar and email context from Microsoft Outlook using Claude in Chrome browser automation. Follows the slack-forge pipeline pattern: scan raw content via Chrome navigation, process through harvester agents, review, and promote to downstream forge plugins.

No MCP servers, no Microsoft Graph API tokens, no OAuth setup. Claude in Chrome navigates Outlook Web using the user's existing browser session.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | Claude in Chrome → Outlook Web | No API setup required. Uses existing browser login. Immediate value. |
| Architecture | Chrome-only, no MCP upgrade path | Simplicity. User preference. Can revisit later if needed. |
| Pipeline | scan → capture → review → promote | Direct mirror of slack-forge. Proven pattern. |
| Harvest schema | Reuse existing `source_channel`/`source_channel_id` | Zero schema changes. Field names are slightly semantic mismatch ("channel" for "folder") but avoids forking infrastructure. |
| forge-lib changes | None | All existing harvest commands work unchanged. |
| Harvest types | task, knowledge, meeting-prep, meeting-notes | Covers email action items, reference info, calendar preparation, and post-meeting follow-ups. |
| Scan targets | calendar, inbox, sent, folder:{name} | Configurable per-scan. Covers primary Outlook use cases. |

## Plugin Structure

```
outlook-forge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   ├── init.md              # /outlook-forge:init
│   ├── scan.md              # /outlook-forge:scan (Chrome-primary)
│   ├── capture.md           # /outlook-forge:capture (local-only orchestrator)
│   ├── review.md            # /outlook-forge:review
│   └── promote.md           # /outlook-forge:promote
├── agents/
│   ├── forge-email-harvester.md       # extracts tasks + decisions from email transcripts
│   ├── forge-calendar-harvester.md    # extracts prep items + action items from calendar transcripts
│   └── forge-meeting-harvester.md     # extracts notes + follow-ups from meeting detail transcripts
└── skills/
    ├── email-harvester/
    │   └── SKILL.md          # email extraction patterns, signal identification
    ├── calendar-harvester/
    │   └── SKILL.md          # calendar/scheduling extraction patterns
    └── meeting-harvester/
        └── SKILL.md          # meeting context extraction patterns
```

Runtime data directories (created by init):
```
outlook-forge/
├── config.json
├── harvests/
│   ├── index.json
│   └── *.md
└── transcripts/
    └── *.md
```

## Scan Command — Chrome Browser Strategy

### How It Works

1. User runs `/outlook-forge:scan --source calendar --days 3`
2. Command requires Chrome connection (`claude --chrome` or `/chrome`)
3. Claude navigates to `outlook.office.com` in Chrome
4. Claude reads page content, clicks into individual items, extracts structured text
5. Raw content written to transcript files in `outlook-forge/transcripts/`

### Scan Sources

| Source | URL Target | Extraction |
|--------|-----------|------------|
| `calendar` | `outlook.office.com/calendar` | Navigate to calendar view, read events for date range. Click into each event for attendees, description, location. |
| `inbox` | `outlook.office.com/mail` | Navigate to inbox, read subjects and senders. Click into important/unread emails for body content. |
| `sent` | `outlook.office.com/mail/sentitems` | Same as inbox but for sent folder. |
| `folder:{name}` | Navigate to specific mail folder | For focused scanning of project-specific folders. |

### Parameters

- `--source calendar|inbox|sent|folder:{name}` (required)
- `--days N` — how many days back/forward to scan (default: 1 for email, 3 for calendar)
- `--max-items N` — cap on items to open and read in detail (default: 20)
- `--unread-only` — for inbox, only process unread messages

### Transcript Format — Calendar

```markdown
---
scan_date: 2026-03-03
source: calendar
timeframe: 3d
scan_run: 1
generated: 2026-03-03T14:30:00Z
---

## Monday, March 3, 2026

### 9:00 AM - 9:30 AM | Weekly Standup
- **Attendees:** Alice, Bob, Carol
- **Location:** Teams Meeting
- **Description:** Weekly team sync to review sprint progress

### 11:00 AM - 12:00 PM | Architecture Review
- **Attendees:** Alice, Dave, External: john@partner.com
- **Location:** Conference Room B / Teams
- **Description:** Review proposed API changes for Q2 migration
- **Agenda:** 1. Current state review 2. Migration timeline 3. Risk assessment

## Tuesday, March 4, 2026
...
```

### Transcript Format — Inbox

```markdown
---
scan_date: 2026-03-03
source: inbox
timeframe: 1d
scan_run: 1
generated: 2026-03-03T14:30:00Z
---

## Unread (5)

### [2026-03-03 09:14] From: alice@company.com | Subject: Q2 Budget Approval Needed
**Priority:** High
**Body:**
Hi team, we need to finalize the Q2 budget by Friday. Please review the attached
spreadsheet and submit your department estimates...

### [2026-03-03 08:45] From: bob@company.com | Subject: Re: API Migration Timeline
**Priority:** Normal
**Body:**
Following up on yesterday's discussion — I've updated the timeline doc...

## Read (15 most recent)
...
```

## Harvest Data Model

Reuses the existing forge-lib harvest infrastructure unchanged.

### Harvest Types

| Type | Created by | Content |
|------|-----------|---------|
| `task` | email-harvester, calendar-harvester | Action items from emails or calendar prep |
| `knowledge` | email-harvester | Decisions, context, reference info from email threads |
| `meeting-prep` | calendar-harvester | Preparation notes, agenda items, attendee research |
| `meeting-notes` | meeting-harvester | Post-meeting action items, decisions, follow-ups |

### Frontmatter

```yaml
---
title: "Submit Q2 budget estimates by Friday"
type: harvest
harvest_type: task
status: pending
source_channel: "inbox"
source_channel_id: "inbox"
source_timestamp: "2026-03-03 09:14 UTC"
source_author: "alice@company.com"
scan_timeframe: 1d
scan_date: 2026-03-03
confidence: high
tags:
  - budget
  - q2
  - deadline
created: 2026-03-03
updated: 2026-03-03
---
```

Field mapping: `source_channel` = Outlook folder name (inbox, sent, calendar), `source_channel_id` = same value, `source_author` = email address or meeting organizer.

### Body Sections

```markdown
## Extracted Content

{2-3 sentence narrative paragraph}

## Source Context

{email quote or calendar event details with attribution}

## Action Items

- {verb + responsible person + deliverable}
```

### Status State Machine

```
pending → approved → promoted   (terminal)
        → rejected              (terminal)
```

## Command Workflows

### /outlook-forge:init

- **Requires:** Chrome connection
- **Steps:**
  1. Navigate to `outlook.office.com`
  2. Read folder list from sidebar, discover available calendars
  3. Present discovered sources to user for selection
  4. Create `outlook-forge/config.json`
  5. Run `forge harvest init --plugin outlook-forge`
- **forge-lib:** `forge harvest init`, `forge harvest config --set-channels`

### /outlook-forge:scan

- **Requires:** Chrome connection
- **Parameters:** `--source`, `--days`, `--max-items`, `--unread-only`
- **Steps:**
  1. Read config.json for defaults
  2. Get collision-safe filename via `forge transcript filename`
  3. Navigate Chrome to appropriate Outlook Web URL
  4. Extract content from page (list view + detail clicks)
  5. Write transcript file with YAML frontmatter
  6. Optional: chain to `/outlook-forge:capture`
- **forge-lib:** `forge transcript filename --scan-date ... --timeframe ... --type ... --dir outlook-forge/transcripts`

### /outlook-forge:capture

- **Requires:** Local only (no Chrome needed)
- **Steps:**
  1. Read transcript files from `outlook-forge/transcripts/`
  2. Dispatch subagent: **forge-email-harvester** (for inbox/sent transcripts)
  3. Dispatch subagent: **forge-calendar-harvester** (for calendar transcripts)
  4. Dispatch subagent: **forge-meeting-harvester** (for past calendar events)
  5. All harvests created with status `pending`
- **forge-lib:** `forge harvest create "{title}" --harvest-type {type} --data '{...}'`

### /outlook-forge:review

- **Identical to slack-forge:review**
- Query pending harvests, interactive A/R/E/S per item
- **forge-lib:** `forge harvest query --status pending`, `forge harvest update ...`

### /outlook-forge:promote

- **Routes by harvest type:**
  - `task` → `forge task create`
  - `knowledge` → `forge memory create-knowledge`
  - `meeting-prep` → `forge card create` (product-forge prep card)
  - `meeting-notes` → `forge task create` (follow-up action items)
- **forge-lib:** standard create + update commands

## Config.json

```json
{
  "sources": [
    {"id": "inbox", "name": "Inbox", "type": "mail", "monitor": true},
    {"id": "sent", "name": "Sent Items", "type": "mail", "monitor": false},
    {"id": "calendar", "name": "Calendar", "type": "calendar", "monitor": true},
    {"id": "folder:project-x", "name": "Project X", "type": "mail", "monitor": true}
  ],
  "defaults": {
    "calendar_days": 3,
    "inbox_days": 1,
    "max_items": 20
  },
  "updated": "2026-03-03"
}
```

## Agents

### forge-email-harvester

- **Input:** Inbox/sent transcript files
- **Output:** task + knowledge harvests
- **Skills:** email-harvester (signal patterns for action items, decisions, deadlines, FYIs)
- **Tools:** Read, Grep, Glob, Bash
- **Extraction rules:**
  - Action items with deadlines → `task` harvest (high confidence)
  - Direct requests to the user → `task` harvest (high confidence)
  - Decisions or policy changes → `knowledge` harvest (medium-high confidence)
  - FYI/informational with no action → skip or `knowledge` harvest (low confidence)
- **Anti-patterns:** Don't harvest newsletter/marketing emails, don't create tasks from CC'd FYI threads

### forge-calendar-harvester

- **Input:** Calendar transcript files
- **Output:** task + meeting-prep harvests
- **Skills:** calendar-harvester (scheduling patterns, prep identification)
- **Extraction rules:**
  - Upcoming meetings with agendas → `meeting-prep` harvest with prep checklist
  - Meetings with external attendees → `meeting-prep` harvest with attendee research prompt
  - Recurring standups/syncs → `task` harvest for prep items only if agenda is specific
  - All-day events / OOO → skip
- **Anti-patterns:** Don't create meeting-prep for routine standups with no agenda

### forge-meeting-harvester

- **Input:** Calendar transcript files (past events only)
- **Output:** meeting-notes harvests
- **Skills:** meeting-harvester (action item extraction, decision logging)
- **Extraction rules:**
  - Past meetings with description/notes → `meeting-notes` harvest
  - Extract: decisions made, action items assigned, follow-up dates
  - Attribution: who owns each action item
- **Anti-patterns:** Don't harvest past events with no meaningful content

## Skills

### email-harvester/SKILL.md

Pure reasoning guidance for email signal identification:
- **High-confidence signals:** explicit deadlines, direct requests ("please do X"), approval requests
- **Medium-confidence signals:** discussion threads with implied actions, forwarded items with "FYI - thoughts?"
- **Low-confidence signals:** informational updates, newsletters, automated notifications
- **Quality rules:** always attribute to sender, always include deadline if present, prefer specific over vague action items

### calendar-harvester/SKILL.md

Pure reasoning guidance for calendar extraction:
- **Prep-worthy signals:** external attendees, attached agendas, meetings > 30 minutes with specific topics
- **Skip signals:** all-day events, OOO blocks, recurring standups without agendas
- **Quality rules:** always list attendees, always note if virtual/in-person, extract agenda items as prep checklist

### meeting-harvester/SKILL.md

Pure reasoning guidance for post-meeting extraction:
- **Action item patterns:** "I'll do X", "Can you handle Y", "Let's follow up on Z by Friday"
- **Decision patterns:** "We decided to", "The consensus was", "Going with option A"
- **Quality rules:** attribute actions to specific people, include follow-up dates, distinguish decisions from discussion

## Forge-Shell View

New view controller `outlook-forge.js`:
- **Two tabs:** Harvests (filterable by type + status) and Transcripts (raw scan data)
- **Harvest detail:** title, type badge, status pill, metadata grid, rendered body
- **Transcript detail:** scan date, source, timeframe, rendered body
- **Config bar:** monitored sources and default scan parameters
- **CSS variables:** `--of-type-task`, `--of-type-knowledge`, `--of-type-meeting-prep`, `--of-type-meeting-notes` + standard status colors

## Forge-lib Integration

No new forge-lib modules required. All existing infrastructure works unchanged:

- `forge harvest init` / `config` / `create` / `query` / `update`
- `forge transcript filename` / `clean`
- `harvest.json` schema (reused, `source_channel` holds folder names)
- `harvest.md.j2` template (reused unchanged)

## Prerequisites

- Claude in Chrome extension installed and connected
- User logged into Outlook Web (`outlook.office.com`) in Chrome
- Chrome running and accessible to Claude Code (`claude --chrome` or `/chrome`)
