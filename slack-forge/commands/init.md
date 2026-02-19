---
description: Discover Slack channels and configure which to monitor for intelligence harvesting
---

# Init Command

Initialize slack-forge and configure monitored channels using Slack MCP tools and forge-lib.

## Instructions

### 1. Check Current State

Check if `slack-forge/` directory exists in the current working directory.

If it exists, load current config:

```bash
forge harvest config --get
```

Check the `success` field in the JSON response. If `success` is `true` and channels are configured, inform the user:

```
Slack Forge already initialized.
- Channels monitored: {count}
- JIRA channel: {jira_channel or "none"}
- Last updated: {updated}

Would you like to update your channel configuration? (yes/no)
```

If user says no, show next steps and exit:
```
- To scan channels: /slack-forge:scan
- To capture harvests from transcripts: /slack-forge:capture
- To review harvests: /slack-forge:review
```

If user says yes, proceed to step 3 (channel discovery).

If `slack-forge/` does not exist, proceed to step 2.

### 2. Initialize Directory

Run forge-lib to create the slack-forge directory structure:

```bash
forge harvest init
```

Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and stop.

This creates:
- `slack-forge/` directory for harvest records
- `slack-forge/index.json` for fast queries

### 3. Discover Channels

Use the Slack MCP tool to discover accessible channels:

```
slack_search_channels (query: "")
```

Also discover DM conversations if relevant:

```
slack_search_users (query: "")
```

Collect results and organize by type:
- **Public channels** — channels accessible to the workspace
- **Private channels** — channels the bot has been invited to
- **DMs** — direct message conversations (optional, for monitoring specific people)

### 4. Present Channel List

Present the discovered channels organized by type:

```
Found {total} accessible channels:

Public Channels:
  1. #eng-team
  2. #product-updates
  3. #design-sync
  ...

Private Channels:
  4. #leadership-sync
  ...

Which channels would you like to monitor? (enter numbers, comma-separated, or "all public")
```

Let the user select channels. Accept:
- Comma-separated numbers (e.g., "1, 2, 5")
- "all public" to select all public channels
- "all" to select everything

### 5. Identify JIRA Channel

Ask the user to identify the JIRA bot feed channel:

```
Which channel receives JIRA bot notifications? (enter number, or "none")
```

If the user identifies a JIRA channel, tag it with `role: "jira"` in the config.

### 6. Save Configuration

Build the channel configuration array. For each selected channel:
```json
{"id": "C01ABC123", "name": "eng-team", "type": "public", "monitor": true}
```

For the JIRA channel, add:
```json
{"id": "C03GHI789", "name": "jira-notifications", "type": "public", "monitor": true, "role": "jira"}
```

Save via forge-lib:

```bash
forge harvest config --set-channels '[{channel_array_json}]'
```

If a JIRA channel was identified:
```bash
forge harvest config --set-jira-channel "{channel_id}"
```

Check the `success` field in each JSON response. If `success` is `false`, report the `error` field to the user and stop.

### 7. Confirm Setup

```
Slack Forge configured:
- Monitored channels: {count}
- JIRA feed: {jira_channel_name or "none"}
- Config saved: slack-forge/config.json

Next steps:
- Scan channels: /slack-forge:scan
- Capture harvests from local transcripts: /slack-forge:capture
- CLI: forge harvest --help
```

## Notes

- Initialization is idempotent (safe to run multiple times to update config)
- Channel discovery requires Claude AI Slack MCP tools to be configured
- Config can be updated at any time by re-running this command
- All configuration data managed by forge-lib ensures consistency
