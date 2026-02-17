---
description: Scan monitored Slack channels for tasks, knowledge, and JIRA activity
---

# Scan Command

Orchestrate 3 sequential sub-agents to extract intelligence from monitored Slack channels.

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

Store the selected timeframe label (e.g., "24h", "72h", "1 week", or "custom") for harvest record metadata.

### 3. Extract Channel Lists from Config

Parse the config response:
- **Monitored channels**: all entries where `monitor` is `true` AND `role` is NOT `"jira"`
- **JIRA channel**: the entry where `role` is `"jira"`, or fall back to `jira_channel` field from config

If no JIRA channel is configured, skip Agent 3 (JIRA Digest) later.

### 4. Agent 1: Task Harvester

Inform the user:
```
Agent 1/3: Task Harvester — scanning {count} channels...
```

For each monitored channel:

1. Read channel messages using the Slack MCP tool:
   ```
   slack_read_channel (channel_id: "{id}", oldest: "{cutoff_timestamp}")
   ```

2. Apply `task-harvester` skill reasoning to the messages. Look for:
   - Explicit task assignments ("can you...", "we need to...", "TODO:")
   - Action items from discussions
   - Commitments people made ("I'll handle...", "I'm going to...")
   - Requests for help or work

3. For each identified task, create a harvest record:
   ```bash
   forge harvest create "{task_title}" --harvest-type task --data '{
     "source_channel": "{channel_name}",
     "source_channel_id": "{channel_id}",
     "source_author": "{author}",
     "source_timestamp": "{message_timestamp}",
     "scan_timeframe": "{timeframe}",
     "confidence": "{high|medium|low}",
     "tags": ["{relevant}", "{tags}"]
   }'
   ```
   Check the `success` field in each JSON response. If `success` is `false`, report the error and continue to next item.

Report:
```
Task Harvester complete: found {count} potential tasks
```

### 5. Agent 2: Knowledge Harvester

Inform the user:
```
Agent 2/3: Knowledge Harvester — scanning {count} channels...
```

For each monitored channel (reuse messages already read in Agent 1 if possible):

1. Read channel messages if not already cached from Agent 1.

2. Apply `knowledge-harvester` skill reasoning. Look for:
   - People expertise signals ("I've been working on...", domain knowledge demonstrations)
   - Project context (architecture decisions, technology choices, integration details)
   - Glossary terms (acronyms defined, jargon explained)
   - General organizational knowledge (processes, conventions, tribal knowledge)

3. For each identified knowledge item, create a harvest record:
   ```bash
   forge harvest create "{knowledge_title}" --harvest-type knowledge --data '{
     "source_channel": "{channel_name}",
     "source_channel_id": "{channel_id}",
     "source_author": "{author}",
     "source_timestamp": "{message_timestamp}",
     "scan_timeframe": "{timeframe}",
     "confidence": "{high|medium|low}",
     "tags": ["{relevant}", "{tags}"]
   }'
   ```
   Check the `success` field in each JSON response. If `success` is `false`, report the error and continue to next item.

Report:
```
Knowledge Harvester complete: found {count} knowledge items
```

### 6. Agent 3: JIRA Digest

If no JIRA channel is configured, skip this agent:
```
Agent 3/3: JIRA Digest — skipped (no JIRA channel configured)
```

Otherwise, inform the user:
```
Agent 3/3: JIRA Digest — reading JIRA feed...
```

1. Read the JIRA channel:
   ```
   slack_read_channel (channel_id: "{jira_channel_id}", oldest: "{cutoff_timestamp}")
   ```

2. Apply `jira-digest` skill reasoning. Categorize JIRA events:
   - Tickets created
   - Status transitions (e.g., "In Progress" → "Done")
   - Comments added
   - Tickets resolved or closed

3. Create one or more digest harvest records summarizing the activity:
   ```bash
   forge harvest create "JIRA Digest — {date_range}" --harvest-type jira-digest --data '{
     "source_channel": "{jira_channel_name}",
     "source_channel_id": "{jira_channel_id}",
     "scan_timeframe": "{timeframe}",
     "confidence": "high",
     "tags": ["jira", "digest"]
   }'
   ```
   Check the `success` field. If `success` is `false`, report the error.

Report:
```
JIRA Digest complete: summarized {count} JIRA events
```

### 7. Present Summary

```
Scan complete:
- Task Harvester: {task_count} potential tasks
- Knowledge Harvester: {knowledge_count} knowledge items
- JIRA Digest: {jira_count} digest record(s)
- Total: {total} harvest records created

All items are pending review. Run /slack-forge:review to approve or reject.
```

## Notes

- Sub-agents run sequentially to avoid rate-limiting Slack MCP tools
- All harvest records start with status "pending" — nothing is auto-promoted
- Confidence scoring helps prioritize review (high → medium → low)
- Duplicate detection is best-effort — review step catches remaining duplicates
- The scan command is safe to run multiple times; sequential numbering prevents conflicts
- Use the task-harvester, knowledge-harvester, and jira-digest skills for reasoning guidance
