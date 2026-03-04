---
description: Scan Outlook calendar and inbox via Chrome and write local transcript files
---

# Scan Command

You are the **primary-agent orchestrator** for Outlook Forge scanning. This command uses Claude in Chrome to navigate Outlook Web (`outlook.office.com`) and writes local transcript files under `outlook-forge/transcripts/`.

This command **does not** create harvest records.

**Requires:** Chrome connection (`claude --chrome` or `/chrome`)

## Instructions

### 1. Check Prerequisites

Check if `outlook-forge/` directory exists. If not:
```
Outlook Forge not initialized. Run /outlook-forge:init first.
```

Load configuration:

```bash
forge harvest config --get --plugin outlook-forge
```

If config is missing or sources are empty:
```
No sources configured. Run /outlook-forge:init to set up Outlook monitoring.
```

Ensure transcript directory exists:
```bash
mkdir -p outlook-forge/transcripts
```

Verify Chrome is connected. If not:
```
Chrome connection required. Run /chrome to connect, then retry /outlook-forge:scan.
```

### 2. Determine Scan Parameters

Parse command arguments. Supported parameters:

- `--source calendar|inbox|sent|folder:{name}` — which source to scan (required)
- `--days N` — number of days to scan (default: from config, typically 3 for calendar, 1 for inbox)
- `--max-items N` — max items to open and read in detail (default: from config, typically 20)
- `--unread-only` — for mail sources, only read unread messages

If no `--source` provided, prompt:

```
What would you like to scan?

1. Calendar (next {calendar_days} days)
2. Inbox (last {inbox_days} days)
3. Sent Items (last {inbox_days} days)
4. Specific folder
5. All monitored sources

Select (1-5):
```

If option 5 ("All monitored sources"), run scans sequentially for each source with `monitor: true` in config.

### 3. Ask Scan Execution Mode

```
How should I run this scan?

1. Scan only
2. Scan then ask before capture
3. Scan and auto-run capture

Select (1-3):
```

### 4. Present Scan Brief

```
Scan Brief:
- Source: {source}
- Time window: {days} days
- Max items: {max_items}
- Unread only: {yes/no}
- Mode: {scan_only | scan_then_ask | scan_and_auto_capture}

Proceed? (yes/no)
```

### 5. Execute Chrome Scan — Calendar

If source is `calendar`:

**Before writing the transcript, resolve its filename:**

```bash
forge transcript filename --scan-date {YYYY-MM-DD} --timeframe {N}d --type calendar --dir outlook-forge/transcripts
```

Use the returned filename exactly.

**Chrome navigation steps:**

1. Navigate to `outlook.office.com/calendar`
2. Ensure the view shows the correct date range:
   - For 1-3 days: use Day or Work Week view
   - For 7+ days: use Week or Month view
3. Read visible events from the calendar grid
4. For each event (up to `--max-items`):
   - Click on the event to open the detail popup/panel
   - Extract: title, start time, end time, attendees, location, description/body
   - Close the popup and move to the next event
5. Navigate forward if the date range extends beyond the visible view

**Write transcript with YAML frontmatter:**

```markdown
---
scan_date: {YYYY-MM-DD}
source: calendar
timeframe: {N}d
scan_run: {NNN from filename}
generated: {ISO 8601 timestamp}
---

## {Day of Week}, {Month Day, Year}

### {Start Time} - {End Time} | {Event Title}
- **Organizer:** {organizer name/email}
- **Attendees:** {comma-separated list}
- **Location:** {location or "Teams Meeting" or "No location"}
- **Description:** {event body/description, or "No description"}

### {Start Time} - {End Time} | {Event Title}
...

## {Next Day}
...
```

### 6. Execute Chrome Scan — Inbox/Sent/Folder

If source is `inbox`, `sent`, or `folder:{name}`:

**Resolve filename:**

```bash
forge transcript filename --scan-date {YYYY-MM-DD} --timeframe {N}d --type {source} --dir outlook-forge/transcripts
```

**Chrome navigation steps:**

1. Navigate to the appropriate URL:
   - `inbox` → `outlook.office.com/mail`
   - `sent` → `outlook.office.com/mail/sentitems`
   - `folder:{name}` → navigate to the named folder via the sidebar
2. Read the message list, noting subjects, senders, dates, and read/unread status
3. Apply time window filter: only process messages within the `--days` range
4. If `--unread-only`, skip read messages
5. For each message (up to `--max-items`):
   - Click on the message to open it in the reading pane
   - Extract: subject, sender, recipients (To/CC), date, priority, body text
   - Move to the next message
6. Scroll down the message list if more messages exist within the time window

**Write transcript with YAML frontmatter:**

```markdown
---
scan_date: {YYYY-MM-DD}
source: {inbox|sent|folder:{name}}
timeframe: {N}d
scan_run: {NNN from filename}
generated: {ISO 8601 timestamp}
---

## Unread ({count})

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
**To:** {recipients}
**CC:** {cc_recipients or omit if none}
**Priority:** {High|Normal|Low}
**Body:**
{email body text — first ~500 characters for long emails, full text for short ones}

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
...

## Read ({count} most recent)

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
...
```

### 7. Present Scan Summary

```
Scan complete:
- Source: {source}
- Time window: {days} days
- Items scanned: {count}
- Transcript: {filename}

No harvest records created in scan mode.
```

### 8. Optional Capture Chaining

If mode `scan_then_ask`:
```
Transcripts are ready. Run /outlook-forge:capture now? (yes/no)
```
If yes, invoke `/outlook-forge:capture`.

If mode `scan_and_auto_capture`:
- Invoke `/outlook-forge:capture` immediately.

If mode `scan_only`:
```
To harvest tasks/knowledge/meeting items from these transcripts, run /outlook-forge:capture.
```

## Chrome Navigation Tips

- If Outlook prompts for re-authentication, pause and ask the user to log in manually, then continue.
- If a CAPTCHA appears, pause and ask the user to complete it.
- If the page is slow to load, wait for content to appear before extracting.
- Use visible text content — do not try to parse HTML or DOM structure directly.
- If an email is too long, capture the first ~500 characters and note "[truncated]".

## Notes

- `scan` is Chrome navigation + transcript generation only.
- Re-running scan is safe — sequential filenames prevent overwriting.
- Review and promotion happen after capture (`/outlook-forge:review`, `/outlook-forge:promote`).
