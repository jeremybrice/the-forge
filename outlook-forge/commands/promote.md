---
description: Promote approved harvest records to tasks-forge, forge-memory, and product-forge
---

# Promote Command

Push approved harvest items to their destination plugins via forge-lib commands.

## Instructions

### 1. Query Approved Harvests

```bash
forge harvest query --status approved --plugin outlook-forge
```

Check `success`. If `false`, report `error` and stop.

If empty:
```
No approved harvest records found.
- To review pending items: /outlook-forge:review
- To scan Outlook: /outlook-forge:scan
```

### 2. Present Promotion Plan

```
{total} approved items ready for promotion:
- {task_count} tasks → tasks-forge
- {knowledge_count} knowledge items → forge-memory
- {prep_count} meeting prep → product-forge (prep cards)
- {notes_count} meeting notes → tasks-forge (follow-up tasks)

Proceed with promotion? (yes/no)
```

If no, exit without changes.

### 3. Promote Task Harvests

For each approved item with `harvest_type: "task"`:

1. Map fields:
   - `title` → task title
   - `confidence` → priority (high → "High", medium → "Medium", low → "Low")
   - `source_channel` + `source_author` → description provenance
   - `tags` → task tags

2. Create task:
   ```bash
   forge task create "{title}" --data '{
     "priority": "{mapped_priority}",
     "status": "Open",
     "description": "Harvested from Outlook {source_channel} by {source_author} on {scan_date}.\n\n{extracted_content}",
     "tags": [{tags}]
   }'
   ```
   Check `success`. If `false`, report error and skip (do not mark promoted).

3. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

4. Report: `[Task] "{title}" → {task_filename} (Open, {priority})`

### 4. Promote Knowledge Harvests

For each approved item with `harvest_type: "knowledge"`:

1. Determine knowledge type from content and tags:
   - First tag is memory-hint: `person`, `project`, `glossary`, or `general`
   - Default to `project` if no hint

2. Build knowledge entry name from title

3. Create:
   ```bash
   forge memory create-knowledge {type} "{name}" --data '{
     "source": "outlook-forge harvest from {source_channel}",
     "harvested_on": "{scan_date}"
   }'
   ```
   Check `success`. If `false`, report error and skip.

4. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

5. Report: `[Knowledge] "{title}" → memory/{type}/{slug}.md`

### 5. Promote Meeting-Prep Harvests

For each approved item with `harvest_type: "meeting-prep"`:

1. Create a product-forge card with the prep content:
   ```bash
   forge card create "{title}" --data '{
     "type": "decision",
     "status": "In Progress",
     "description": "Meeting preparation card.\n\n{extracted_content}\n\n**Source:** Outlook calendar, {source_author}, {source_timestamp}",
     "tags": ["meeting-prep", {tags}]
   }'
   ```
   Check `success`. If `false`, report error and skip.

2. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

3. Report: `[Meeting Prep] "{title}" → {card_filename}`

### 6. Promote Meeting-Notes Harvests

For each approved item with `harvest_type: "meeting-notes"`:

1. Create tasks for each action item in the harvest:
   ```bash
   forge task create "{action_item_title}" --data '{
     "priority": "Medium",
     "status": "Open",
     "description": "Follow-up from meeting: {harvest_title}\n\n{action_item_detail}\n\n**Source:** {source_timestamp}, organizer: {source_author}",
     "tags": ["meeting-followup", {tags}]
   }'
   ```
   Check `success`. If `false`, report error and continue with next action item.

2. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

3. Report: `[Meeting Notes] "{title}" → {count} follow-up tasks created`

### 7. Present Summary

```
Promotion complete:
- {task_promoted} tasks created in tasks-forge
- {knowledge_promoted} knowledge entries in forge-memory
- {prep_promoted} meeting prep cards in product-forge
- {notes_promoted} meeting follow-ups in tasks-forge
- {failed_count} items failed (still approved, retry with /outlook-forge:promote)

{if task_promoted > 0}
View tasks: forge task query --status Open
{/if}
{if knowledge_promoted > 0}
View knowledge: forge memory query-knowledge
{/if}
```

## Notes

- Promotion only processes approved items — run `/outlook-forge:review` first
- Failed promotions remain in "approved" status for retry
- Meeting-notes may create multiple tasks (one per action item)
- Meeting-prep creates product-forge decision cards for pre-meeting preparation
- All operations go through forge-lib for schema validation
