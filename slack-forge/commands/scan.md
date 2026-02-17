---
description: Scan monitored Slack channels for tasks, knowledge, and JIRA activity
---

# Scan Command

You are the **Orchestrator** for Slack Forge scanning. You dispatch 3 sequential sub-agents via the Task tool to extract intelligence from monitored Slack channels and create harvest records.

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

Check the `success` field. If `success` is `false` or channels array is empty:
```
No channels configured. Run /slack-forge:init to set up channel monitoring.
```

### 2. Ask for Time Frame

Prompt the user:

```
What time frame should I scan?

1. Last 24 hours
2. Last 72 hours (3 days)
3. Last week (7 days)
4. Custom date range

Select (1-4):
```

Calculate the cutoff timestamp based on the current system time:
- 24h: current time minus 86400 seconds
- 72h: current time minus 259200 seconds
- 1 week: current time minus 604800 seconds
- Custom: prompt for start date (YYYY-MM-DD) and optionally end date

Store the selected timeframe label (e.g., "24h", "72h", "1w", or "custom") for harvest record metadata.

### 3. Extract Channel Lists from Config

Parse the config response:
- **Monitored channels**: all entries where `monitor` is `true` AND `role` is NOT `"jira"`
- **JIRA channel**: the entry where `role` is `"jira"`, or fall back to `jira_channel` field from config

If no JIRA channel is configured, skip Agent 3 (JIRA Digest) later.

Confirm the scan scope with the user:
```
Scan Brief:
- Time frame: {timeframe}
- Monitored channels: {count} ({channel_names})
- JIRA channel: {jira_channel_name or "none"}

Proceed? (yes/no)
```

### 4. Dispatch Agent 1: Task Harvester

Inform the user:
```
Agent 1/3: Dispatching Task Harvester...
```

Use the Task tool to spawn the forge-task-harvester agent:

```
Task tool call:
  subagent_type: "general-purpose"
  description: "Task Harvester scan"
  prompt: |
    Read slack-forge/agents/forge-task-harvester.md for your role and instructions.

    **Scan Brief:**
    - Timeframe: {timeframe_label}
    - Cutoff: {cutoff_timestamp}
    - Channels to scan:
      {for each channel: "- #{name} (ID: {id})"}

    Read each channel using `slack_read_channel (channel: "{channel_name}")`.
    For each task found, create a harvest record using `forge harvest create`.

    Return your results in the output format specified in your agent file.
```

Wait for the Task Harvester to complete. Capture the results and present a brief status to the user:
```
Task Harvester complete: {count} potential tasks found
```

### 5. Dispatch Agent 2: Knowledge Harvester

Inform the user:
```
Agent 2/3: Dispatching Knowledge Harvester...
```

Use the Task tool to spawn the forge-knowledge-harvester agent:

```
Task tool call:
  subagent_type: "general-purpose"
  description: "Knowledge Harvester scan"
  prompt: |
    Read slack-forge/agents/forge-knowledge-harvester.md for your role and instructions.

    **Scan Brief:**
    - Timeframe: {timeframe_label}
    - Cutoff: {cutoff_timestamp}
    - Channels to scan:
      {for each channel: "- #{name} (ID: {id})"}

    Read each channel using `slack_read_channel (channel: "{channel_name}")`.
    For each knowledge item found, create a harvest record using `forge harvest create`.

    Return your results in the output format specified in your agent file.
```

Wait for the Knowledge Harvester to complete. Capture the results:
```
Knowledge Harvester complete: {count} knowledge items found
```

### 6. Dispatch Agent 3: JIRA Digest

If no JIRA channel is configured, skip:
```
Agent 3/3: JIRA Digest — skipped (no JIRA channel configured)
```

Otherwise, inform the user:
```
Agent 3/3: Dispatching JIRA Digest...
```

Use the Task tool to spawn the forge-jira-digest agent:

```
Task tool call:
  subagent_type: "general-purpose"
  description: "JIRA Digest scan"
  prompt: |
    Read slack-forge/agents/forge-jira-digest.md for your role and instructions.

    **Scan Brief:**
    - Timeframe: {timeframe_label}
    - Cutoff: {cutoff_timestamp}
    - JIRA channel: #{jira_channel_name} (ID: {jira_channel_id})

    Read the JIRA channel using `slack_read_channel (channel: "{jira_channel_name}")`.
    Parse JIRA bot events and create digest harvest record(s) using `forge harvest create`.

    Return your results in the output format specified in your agent file.
```

Wait for the JIRA Digest agent to complete. Capture the results:
```
JIRA Digest complete: {count} events summarized
```

### 7. Present Summary

Combine results from all three agents:

```
Scan complete:
- Task Harvester: {task_count} potential tasks
- Knowledge Harvester: {knowledge_count} knowledge items
- JIRA Digest: {jira_count} digest record(s)
- Total: {total} harvest records created

Agents used: forge-task-harvester, forge-knowledge-harvester, forge-jira-digest

All items are pending review. Run /slack-forge:review to approve or reject.
```

## Notes

- Agents are dispatched **sequentially** via the Task tool to respect Slack MCP rate limits
- Each agent gets its own focused context and dedicated MCP session for extraction quality
- All harvest records start with status "pending" — nothing is auto-promoted
- Agent files are in `slack-forge/agents/` and skills in `slack-forge/skills/`
- The scan command is safe to run multiple times; sequential numbering prevents conflicts
- If an agent fails or errors, report the failure and continue with the next agent
