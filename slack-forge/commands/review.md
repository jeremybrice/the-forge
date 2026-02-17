---
description: Review pending harvest records — approve, reject, edit, or skip each item
---

# Review Command

Present pending harvest records for human review and disposition.

## Instructions

### 1. Query Pending Harvests

Query all pending harvest records:

```bash
forge harvest query --status pending
```

Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and stop.

Parse the harvests array from the response. If empty:
```
No pending harvest records found.
- To scan channels: /slack-forge:scan
- To check all harvests: forge harvest query
```

### 2. Group by Harvest Type

Organize pending items into groups:
- **Tasks** — harvest_type: "task"
- **Knowledge** — harvest_type: "knowledge"
- **JIRA Digests** — harvest_type: "jira-digest"

Present a summary:
```
{total} pending harvest records to review:
- {task_count} tasks
- {knowledge_count} knowledge items
- {jira_count} JIRA digests

Reviewing in order: Tasks → Knowledge → JIRA Digests
```

### 3. Review Each Item

For each pending item, present the details:

```
[{harvest_type}] {title}
- Source: #{source_channel} by @{source_author}
- Confidence: {confidence}
- Scanned: {scan_date} ({scan_timeframe})
- File: {filename}

{extracted content preview — first 3-5 lines of body}

Action? (A)pprove / (R)eject / (E)dit / (S)kip
```

Handle the user's choice:

#### Approve
```bash
forge harvest update {filename} --data '{"status": "approved"}'
```
Check the `success` field. If `success` is `false`, report the error and continue to next item.

#### Reject
```bash
forge harvest update {filename} --data '{"status": "rejected"}'
```
Check the `success` field. If `success` is `false`, report the error and continue to next item.

#### Edit
Prompt the user for changes:
```
Current title: {title}
New title (or Enter to keep):

Current content preview:
{content}

Updated content (or Enter to keep):
```

After edits, approve the item with updated fields:
```bash
forge harvest update {filename} --data '{"status": "approved", "title": "{new_title}"}'
```
Check the `success` field. If `success` is `false`, report the error and continue to next item.

#### Skip
Leave the item as pending. Move to the next item without any update.

### 4. Present Summary

After all items have been reviewed:

```
Review complete:
- {approved_count} approved
- {rejected_count} rejected
- {skipped_count} skipped (still pending)

{if approved_count > 0}
Approved items are ready for promotion. Run /slack-forge:promote to push to tasks-forge and forge-memory.
{/if}
```

## Notes

- Review is interactive and requires user confirmation for each item
- Skipped items remain pending and will appear in the next review
- Rejected items are terminal — they will not appear in future reviews
- Edited items are approved with the updated title/content
- All status transitions go through forge-lib for validation
- Use confidence levels to prioritize: review high-confidence items first
- Items can also be reviewed individually via `forge harvest update` CLI
