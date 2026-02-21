---
description: Harvest tasks, knowledge, and JIRA digests from local transcript files
---

# Capture Command

You are the orchestrator for local Slack transcript harvesting. This command reads files in `slack-forge/transcripts/` and creates harvest records via `forge harvest create`.

This command **must not** call Slack MCP tools.

## Instructions

### 1. Check Prerequisites

Check `slack-forge/` exists and is initialized.

Ensure transcript files exist:
- `slack-forge/transcripts/`
- at least one `*.md` transcript for the selected timeframe

If transcripts are missing:
```
No transcript files found for capture. Run /slack-forge:scan first.
```

### 2. Ask for Capture Scope

Prompt:

```
Which transcript window should I capture?

1. Most recent scan
2. Select by timeframe/date

Select (1-2):
```

Resolve "most recent scan" by selecting transcript files with the most recent date prefix in their filename (`slack-forge/transcripts/YYYY-MM-DD-*`). If multiple dates are present, use the latest date only. Within the same date and timeframe, select files with the highest `-NNN` sequence number — this represents the most recent scan run.

Resolve transcript file set:
- public channels transcript (optional)
- DMs transcript (optional)
- JIRA transcript (optional)

### 3. Dispatch Local-Only Subagents

Dispatch each sub-agent sequentially using the **Task tool** (`subagent_type: general-purpose`). In each brief, include:
- The agent name and its markdown path (e.g., `slack-forge/agents/forge-task-harvester.md`)
- The resolved transcript file path(s)
- The scan timeframe label and scan date

Dispatch order:

1. **Task Harvester** (`forge-task-harvester`)
- Agent file: `slack-forge/agents/forge-task-harvester.md`
- Reads local transcript files
- Creates `harvest_type: task` records

2. **Knowledge Harvester** (`forge-knowledge-harvester`)
- Agent file: `slack-forge/agents/forge-knowledge-harvester.md`
- Reads local transcript files
- Creates `harvest_type: knowledge` records

3. **JIRA Digest** (`forge-jira-digest`) — only if a JIRA transcript is present
- Agent file: `slack-forge/agents/forge-jira-digest.md`
- Reads local JIRA transcript
- Creates `harvest_type: jira-digest` records

Each subagent must:
- Parse transcript text only
- Create records using `forge harvest create`
- Include provenance fields (`source_channel`, `source_channel_id`, `source_author`, `source_timestamp`, `scan_timeframe`, `scan_date`)

### 4. Present Summary

```
Capture complete:
- Task harvests: {task_count}
- Knowledge harvests: {knowledge_count}
- JIRA digest harvests: {jira_count}
- Total harvest records created: {total}

All records are pending review.
Run /slack-forge:review to approve or reject.
```

## Notes

- `capture` is local-file-only and safe for subagents.
- Use `/slack-forge:scan` first to refresh transcript snapshots.
- `capture` can be run independently or chained from `scan`.
