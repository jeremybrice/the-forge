---
description: Discover Outlook folders and calendars via Chrome and configure what to monitor for intelligence harvesting
---

# Init Command

Initialize outlook-forge and configure scan sources using Claude in Chrome and forge-lib.

**Requires:** Chrome connection (`claude --chrome` or `/chrome`)

## Instructions

### 1. Check Current State

Check if `outlook-forge/` directory exists in the current working directory.

If it exists, load current config:

```bash
forge harvest config --get --plugin outlook-forge
```

Check the `success` field in the JSON response. If `success` is `true` and sources are configured, inform the user:

```
Outlook Forge already initialized.
- Sources monitored: {count}
- Last updated: {updated}

Would you like to update your source configuration? (yes/no)
```

If user says no, show next steps and exit:
```
- To scan: /outlook-forge:scan
- To capture harvests from transcripts: /outlook-forge:capture
- To review harvests: /outlook-forge:review
```

If user says yes, proceed to step 3 (source discovery).

If `outlook-forge/` does not exist, proceed to step 2.

### 2. Initialize Directory

Run forge-lib to create the outlook-forge directory structure:

```bash
forge harvest init --plugin outlook-forge
```

Check the `success` field. If `success` is `false`, report the `error` field and stop.

Also create the transcripts directory:

```bash
mkdir -p outlook-forge/transcripts
```

### 3. Verify Chrome Connection

Check that Chrome is connected:
- If Chrome is not connected, prompt: `Chrome connection required. Run /chrome to connect, then retry /outlook-forge:init.`
- If Chrome is connected, proceed.

### 4. Discover Sources via Chrome

Navigate to `outlook.office.com` in Chrome.

**Discover mail folders:**
1. Navigate to `outlook.office.com/mail`
2. Read the folder list from the left sidebar (Inbox, Sent Items, Drafts, etc.)
3. Note any custom folders the user has created

**Discover calendars:**
1. Navigate to `outlook.office.com/calendar`
2. Read the calendar list from the left sidebar (Calendar, shared calendars, etc.)

Collect all discovered sources.

### 5. Present Source List

```
Found sources in your Outlook account:

Mail Folders:
  1. Inbox
  2. Sent Items
  3. Drafts
  4. {custom folder 1}
  5. {custom folder 2}
  ...

Calendars:
  6. Calendar (default)
  7. {shared calendar}
  ...

Which sources would you like to monitor? (enter numbers, comma-separated)
Default recommendation: Inbox + Calendar
```

Let the user select sources. Default to Inbox + Calendar if user says "default" or presses enter.

### 6. Configure Defaults

Ask the user for scan defaults:

```
Configure scan defaults:

Calendar scan window (days forward): [3]
Inbox scan window (days back): [1]
Max items per scan: [20]

Press Enter to accept defaults, or type new values.
```

### 7. Save Configuration

Build the sources configuration. For each selected source:
```json
{"id": "inbox", "name": "Inbox", "type": "mail", "monitor": true}
```
```json
{"id": "calendar", "name": "Calendar", "type": "calendar", "monitor": true}
```

For custom mail folders:
```json
{"id": "folder:project-x", "name": "Project X", "type": "mail", "monitor": true}
```

Save via forge-lib:

```bash
forge harvest config --set-channels '[{sources_array_json}]' --plugin outlook-forge
```

Check `success`. If `false`, report error and stop.

### 8. Confirm Setup

```
Outlook Forge configured:
- Monitored sources: {count}
- Calendar window: {days}d forward
- Inbox window: {days}d back
- Max items per scan: {max}
- Config saved: outlook-forge/config.json

Next steps:
- Scan Outlook: /outlook-forge:scan
- Capture harvests: /outlook-forge:capture
- CLI: forge harvest --help
```

## Notes

- Initialization is idempotent (safe to run multiple times)
- Requires Chrome connected to a browser logged into outlook.office.com
- Config can be updated by re-running this command
