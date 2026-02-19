---
description: Scan Slack via MCP and write local transcript files
---

# Scan Command

You are the **primary-agent orchestrator** for Slack Forge scanning. This command uses Slack MCP tools to pull channel/DM/JIRA data and writes local transcript files under `slack-forge/transcripts/`.

This command **does not** create harvest records.

## Instructions

### 1. Check Prerequisites

Check if `slack-forge/` directory exists. If not:
```
Slack Forge not initialized. Run /slack-forge:init first.
```

Load configuration:

```bash
forge harvest config --get
```

If config is missing or channels are empty:
```
No channels configured. Run /slack-forge:init to set up channel monitoring.
```

Ensure transcript directory exists:
- `slack-forge/transcripts/`

### 2. Ask for Time Frame

Prompt:

```
What time frame should I scan?

1. Last 24 hours
2. Last 72 hours (3 days)
3. Last week (7 days)
4. Custom date range

Select (1-4):
```

Compute start/end bounds and store label (`24h`, `72h`, `1w`, `custom`).

### 3. Ask Scan Execution Mode

Prompt before execution:

```
How should I run this scan?

1. Scan only
2. Scan then ask before capture
3. Scan and auto-run capture

Select (1-3):
```

Mode behavior:
- `1` = transcript capture only
- `2` = capture transcripts, then prompt user to run `/slack-forge:capture`
- `3` = capture transcripts, then invoke `/slack-forge:capture` immediately

### 4. Build Scan Scope

From config:
- `monitor: true` and `role != jira` => standard channels/DM scope
- `role: jira` or `jira_channel` => JIRA scope

Present scan brief:

```
Scan Brief:
- Time frame: {timeframe}
- Channels/DMs: {count}
- JIRA channel: {name or "none"}
- Mode: {scan_only | scan_then_ask | scan_and_auto_capture}

Proceed? (yes/no)
```

### 5. Execute MCP Retrieval (Primary Agent)

Use Slack MCP tools to retrieve messages for configured scope.

Expected transcript outputs (as available):
- `slack-forge/transcripts/{scan-date}-{timeframe}-public-channels.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-dms.md`
- `slack-forge/transcripts/{scan-date}-{timeframe}-jira-bot.md`

Transcript requirements:
- Include scan metadata block (`Scan Date`, `Timeframe`, `Generated`).
- Include channel headers with IDs.
- Include message author and source timestamp.

**Transcript format — writer and sub-agent contract:**

```markdown
---
scan_date: 2026-02-17
timeframe: 72h
generated: 2026-02-17T14:30:00Z
---

## #eng-team (C01ABC123)

[2026-02-15 09:14 UTC] @alice: We should move PROJ-42 to Done, it's been deployed.
[2026-02-15 09:16 UTC] @bob: Agreed, I'll update the ticket.

## #design-review (C02DEF456)

No messages in this window.
```

Sub-agents extract provenance from this structure:
- `source_channel` and `source_channel_id` from the `## #{name} ({ID})` header.
- `source_author` from `@{username}` in the message line.
- `source_timestamp` from the `[YYYY-MM-DD HH:MM UTC]` prefix.

If any source has no messages in window, include an explicit "No messages" section.

### 6. Present Scan Summary

```
Scan complete:
- Transcripts written: {count}
- Public channel transcript: {file or "none"}
- DM transcript: {file or "none"}
- JIRA transcript: {file or "none"}

No harvest records created in scan mode.
```

### 7. Optional Capture Chaining

If mode `scan_then_ask`:

```
Transcripts are ready. Run /slack-forge:capture now? (yes/no)
```

If yes, invoke `/slack-forge:capture` in the same run.

If mode `scan_and_auto_capture`:
- Invoke `/slack-forge:capture` immediately after scan summary.

If mode `scan_only`:
- End with next step:
```
To harvest tasks/knowledge/JIRA digests from these transcripts, run /slack-forge:capture.
```

## Notes

- `scan` is MCP retrieval + transcript generation only.
- Primary agent performs MCP calls; local-only subagents do not.
- Re-running scan is safe and creates a new time-window snapshot.
- Review and promotion happen after capture (`/slack-forge:review`, `/slack-forge:promote`).
