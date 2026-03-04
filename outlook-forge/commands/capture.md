---
description: Harvest tasks, knowledge, meeting prep, and meeting notes from local Outlook transcript files
---

# Capture Command

You are the orchestrator for local Outlook transcript harvesting. This command reads files in `outlook-forge/transcripts/` and creates harvest records via `forge harvest create`.

This command **must not** use Chrome or navigate web pages.

## Instructions

### 1. Check Prerequisites

Check `outlook-forge/` exists and is initialized.

Ensure transcript files exist:
- `outlook-forge/transcripts/`
- At least one `*.md` transcript

If transcripts are missing:
```
No transcript files found for capture. Run /outlook-forge:scan first.
```

### 2. Ask for Capture Scope

```
Which transcripts should I capture?

1. Most recent scan
2. Select by date

Select (1-2):
```

Resolve "most recent scan" by selecting transcript files with the most recent date prefix (`outlook-forge/transcripts/YYYY-MM-DD-*`). If multiple dates, use the latest. Within the same date and timeframe, select files with the highest `-NNN` sequence number.

Identify available transcripts by source type:
- Calendar transcripts (source: calendar)
- Inbox transcripts (source: inbox)
- Sent transcripts (source: sent)
- Folder transcripts (source: folder:*)

### 3. Dispatch Local-Only Subagents

Dispatch each sub-agent sequentially using the **Task tool** (`subagent_type: general-purpose`). In each brief, include:
- The agent name and its markdown path
- The resolved transcript file path(s)
- The scan timeframe label and scan date

Dispatch order:

1. **Email Harvester** (`forge-email-harvester`) — only if inbox/sent/folder transcripts exist
   - Agent file: `outlook-forge/agents/forge-email-harvester.md`
   - Reads inbox, sent, and folder transcript files
   - Creates `harvest_type: task` and `harvest_type: knowledge` records

2. **Calendar Harvester** (`forge-calendar-harvester`) — only if calendar transcript exists
   - Agent file: `outlook-forge/agents/forge-calendar-harvester.md`
   - Reads calendar transcript, processes future events only
   - Creates `harvest_type: meeting-prep` and `harvest_type: task` records

3. **Meeting Harvester** (`forge-meeting-harvester`) — only if calendar transcript exists
   - Agent file: `outlook-forge/agents/forge-meeting-harvester.md`
   - Reads calendar transcript, processes past events only
   - Creates `harvest_type: meeting-notes` records

Each subagent must:
- Parse transcript text only
- Create records using `forge harvest create`
- Include provenance fields (`source_channel`, `source_channel_id`, `source_author`, `source_timestamp`, `scan_timeframe`, `scan_date`)

### 4. Present Summary

```
Capture complete:
- Task harvests: {task_count}
- Knowledge harvests: {knowledge_count}
- Meeting-prep harvests: {prep_count}
- Meeting-notes harvests: {notes_count}
- Total harvest records created: {total}

All records are pending review.
Run /outlook-forge:review to approve or reject.
```

## Notes

- `capture` is local-file-only and safe for subagents.
- Use `/outlook-forge:scan` first to refresh transcript snapshots.
- `capture` can be run independently or chained from `scan`.
