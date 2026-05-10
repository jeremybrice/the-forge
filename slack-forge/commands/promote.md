---
description: Promote approved harvest records to tasks-forge and forge-memory
---

# Promote Command

Push approved harvest items to their destination plugins via forge-lib commands.

## Instructions

### 1. Query Approved Harvests

Query all approved harvest records:

```bash
forge harvest query --status approved
```

Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and stop.

Parse the harvests array from the response. If empty:
```
No approved harvest records found.
- To review pending items: /slack-forge:review
- To scan channels: /slack-forge:scan
```

### 2. Present Promotion Plan

Summarize what will be promoted:

```
{total} approved items ready for promotion:
- {task_count} tasks → tasks-forge
- {knowledge_count} knowledge items → forge-memory
- {jira_count} JIRA digests → mark promoted (informational)

Proceed with promotion? (yes/no)
```

If user says no, exit without changes.

### 3. Promote Task Harvests

For each approved item with `harvest_type: "task"`:

1. Map harvest fields to task fields:
   - `title` → task title
   - `source_channel` → include in description as provenance
   - `source_author` → include in description as provenance
   - `confidence` → map to integer priority: high → 2, medium → 3, low → 4
   - `tags` → task tags

2. Create the task via forge-lib:
   ```bash
   forge task create "{title}" --data '{
     "priority": {mapped_priority},
     "status": "Open",
     "description": "Harvested from #{source_channel} by @{source_author} on {scan_date}.\n\n{extracted_content}",
     "tags": [{tags}]
   }'
   ```
   Check the `success` field. If `success` is `false`, report the error and skip this item (do not mark as promoted).

3. On successful task creation, mark harvest as promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}'
   ```
   Check the `success` field. If `success` is `false`, report the error but continue (task was still created).

4. Report:
   ```
   [Task] "{title}" → {task_filename} (Open, {priority})
   ```

### 4. Promote Knowledge Harvests

For each approved item with `harvest_type: "knowledge"`:

1. Determine the memory knowledge type from the item content and tags:
   - Person expertise signals → `person`
   - Project context → `project`
   - Acronym or term definition → `glossary`
   - General organizational knowledge → default to `project`

2. Build the knowledge entry name:
   - Person: use the person's name (e.g., "Jane Smith")
   - Project: use the project name (e.g., "Phoenix Project")
   - Glossary: use the term (e.g., "API Gateway")

3. Create the knowledge entry via forge-lib:
   ```bash
   forge memory create-knowledge {type} "{name}" --data '{
     "source": "slack-forge harvest from #{source_channel}",
     "harvested_on": "{scan_date}"
   }'
   ```
   Check the `success` field. If `success` is `false`, report the error and skip this item.

4. On successful creation, mark harvest as promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}'
   ```

5. Report:
   ```
   [Knowledge] "{title}" → memory/{type}/{slug}.md
   ```

### 5. Promote JIRA Digest Harvests

For each approved item with `harvest_type: "jira-digest"`:

JIRA digests are informational summaries — they do not create tasks or knowledge entries. Mark them as promoted directly:

```bash
forge harvest update {filename} --data '{"status": "promoted"}'
```

Check the `success` field. If `success` is `false`, report the error and continue.

Report:
```
[JIRA Digest] "{title}" → marked promoted (informational)
```

### 6. Present Summary

```
Promotion complete:
- {task_promoted} tasks created in tasks-forge
- {knowledge_promoted} knowledge entries created in forge-memory
- {jira_promoted} JIRA digests archived
- {failed_count} items failed (still approved, retry with /slack-forge:promote)

{if task_promoted > 0}
View tasks: forge task query --status Open
{/if}
{if knowledge_promoted > 0}
View knowledge: forge memory query-knowledge
{/if}
{if task_promoted > 0}
You can triage these tasks with /tasks-forge:start
{/if}
{if knowledge_promoted > 0}
These entries are now available for Product Forge card enrichment and Report Forge scoping.
{/if}
```

## Notes

- Promotion only processes approved items — run `/slack-forge:review` first
- Failed promotions remain in "approved" status and can be retried
- Task priority is inferred from harvest confidence: high → 2, medium → 3, low → 4
- Knowledge type is inferred from content — the LLM determines the best category
- JIRA digests are informational only and do not create downstream entities
- All operations go through forge-lib for schema validation and consistency
- Promoted items remain in slack-forge/ directory for audit trail
