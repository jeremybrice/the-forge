---
description: Review pending harvest records — approve, reject, edit, or skip each item
---

# Review Command

Present pending harvest records for human review and disposition.

## Instructions

### 1. Query Pending Harvests

```bash
forge harvest query --status pending --plugin outlook-forge
```

Check `success`. If `false`, report `error` and stop.

If empty:
```
No pending harvest records found.
- To scan Outlook: /outlook-forge:scan
- To check all harvests: forge harvest query --plugin outlook-forge
```

### 2. Group by Harvest Type

Organize pending items into groups:
- **Tasks** — harvest_type: "task"
- **Knowledge** — harvest_type: "knowledge"
- **Meeting Prep** — harvest_type: "meeting-prep"
- **Meeting Notes** — harvest_type: "meeting-notes"

Present summary:
```
{total} pending harvest records to review:
- {task_count} tasks
- {knowledge_count} knowledge items
- {prep_count} meeting prep items
- {notes_count} meeting notes

Reviewing in order: Tasks → Knowledge → Meeting Prep → Meeting Notes
```

### 3. Review Each Item

For each pending item:

```
[{harvest_type}] {title}
- Source: {source_channel} from {source_author}
- Confidence: {confidence}
- Scanned: {scan_date} ({scan_timeframe})
- File: {filename}

{extracted content preview — first 3-5 lines of body}

Action? (A)pprove / (R)eject / (E)dit / (S)kip
```

Handle choices:

#### Approve
```bash
forge harvest update {filename} --data '{"status": "approved"}' --plugin outlook-forge
```

#### Reject
```bash
forge harvest update {filename} --data '{"status": "rejected"}' --plugin outlook-forge
```

#### Edit
Prompt for title and content changes, then:
```bash
forge harvest update {filename} --data '{"status": "approved", "title": "{new_title}"}' --plugin outlook-forge
```

#### Skip
Leave as pending. Move to next item.

### 4. Present Summary

```
Review complete:
- {approved_count} approved
- {rejected_count} rejected
- {skipped_count} skipped (still pending)

{if approved_count > 0}
Run /outlook-forge:promote to push approved items to tasks-forge, forge-memory, and product-forge.
{/if}
```

## Notes

- Review is interactive and requires user confirmation for each item
- Skipped items remain pending for next review
- Rejected items are terminal
- All transitions go through forge-lib for validation
