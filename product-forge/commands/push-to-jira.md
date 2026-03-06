---
name: push-to-jira
description: "One-way push from Product Forge card to Jira (create or update)"
arguments:
  - name: card
    description: "Filename or title of the card to push"
    required: true
  - name: --force
    description: "Overwrite Jira without prompt"
    required: false
---

# Push to Jira Command

## Overview

The `/push-to-jira` command performs a one-way sync from a Product Forge card to Jira. It supports two modes:

1. **Create Mode:** If the card is not yet linked to Jira, create a new Jira issue and link it.
2. **Update Mode:** If the card is already linked, update the existing Jira issue with the card's current content.

This command is destructive to Jira data. It overwrites the Jira issue's summary and description with the card's current content. Use this when the card is the source of truth.

Card frontmatter updates are delegated to `forge card update` for field persistence.

---

## Usage

### Push a card to Jira (with confirmation)

```
/push-to-jira notification-system-overhaul
```

Pushes the card to Jira. If the card is already linked, prompts for confirmation before overwriting the Jira issue.

### Force push without confirmation

```
/push-to-jira notification-system-overhaul --force
```

Skips the confirmation prompt and immediately overwrites the Jira issue with the card's content.

---

## Conversational Workflow

### Phase 1: Card Identification

The user must explicitly specify the card to push using:
- The filename (with or without `.md` extension): `notification-system-overhaul`
- The card title: "Notification System Overhaul"
- Partial match (if unambiguous)

If the user provides ambiguous input, ask for clarification before proceeding.

**Retrieve card via forge-lib:**
```bash
forge card get {type} {card_identifier} --directory .
```

Extract from response:
- `title` (from frontmatter)
- `type` (from frontmatter)
- `description` (from frontmatter)
- `parent` (from frontmatter, if present)
- `jira_card` field (from frontmatter)
- Card body content (for Jira description field)

---

### Phase 2: Determine Mode (Create or Update)

Inspect the frontmatter for linking fields:
- **All card types:** Check for `jira_card`

**If linking field is null or missing:** Enter **Create Mode**.

**If linking field is present:** Enter **Update Mode**.

---

## Create Mode

### Phase 3A: Resolve Parent Link (if applicable)

If the card has a `parent` field in frontmatter:
1. Retrieve parent card via `forge card get {parent_type} {parent} --directory .`
2. Extract the parent's `jira_card` field
3. If the parent is not linked to Jira:
   ```
   Warning: Parent card "{parent}" is not linked to Jira.
   The new Jira issue will be created without a parent link.
   Consider linking the parent card first using /link-to-jira.

   Proceed anyway? [y/N]
   ```
   If user declines, exit. If user accepts, proceed without parent.

### Phase 4A: Build Jira Issue Payload

Construct the payload for the Jira create call:

**Required fields:**
- `project_key`: From MCP configuration or prompt user
- `summary`: Card `title` from frontmatter
- `description`: Card body content (full markdown below frontmatter)
- `issuetype`: Mapped from card `type`

**Type mapping:**
- Initiative → `Initiative` (if available in Jira) or `Epic`
- Epic → `Epic`
- Story → `Story`
- Intake → `Task`
- Checkpoint → `Task`
- Decision → `Task`

**Optional fields (if applicable):**
- `parent`: Parent's `jira_card` (only if parent is linked and card type is Story/Epic)

Reference the `jira-sync` skill for detailed field mapping.

### Phase 5A: Call MCP Tool

Call the MCP tool:
```
jira_create_issue(
  project_key: <project_key>,
  summary: <card title>,
  description: <card body content>,
  issuetype: <mapped type>,
  parent: <parent jira key, if applicable>
)
```

Extract the returned `key` (e.g., `PROJ-123`).

Reference the `jira-sync` skill for MCP tool usage.

### Phase 6A: Update Card Frontmatter

Delegate frontmatter updates to forge-lib:

**For all card types (Initiative, Epic, Story):**
```bash
forge card update {type} {card_identifier} --data '{
  "jira_card": "PROJ-123",
  "jira_url": "https://your-domain.atlassian.net/browse/PROJ-123",
  "jira_last_synced": "2026-02-12T14:30:00Z"
}' --directory .
```

The `updated` date is automatically set by forge-lib.

**Confirm to user:**
```
Pushed to Jira: PROJ-123
Jira URL: https://your-domain.atlassian.net/browse/PROJ-123
Card updated: cards/{type}s/{filename}.md
```

---

## Update Mode

### Phase 3B: Confirm Overwrite (unless --force)

If the `--force` flag is NOT present, prompt the user for confirmation:

```
Card is already linked to Jira issue: {jira_card}
Jira URL: {jira_url}

This will overwrite the Jira issue with the card's current content:
- Summary: "{card title}"
- Description: {N} lines from card body

Proceed? [y/N]
```

If the user declines, exit. If the user accepts or `--force` is present, proceed.

### Phase 4B: Build Jira Update Payload

Construct the payload for the Jira update call:

**Fields to update:**
- `summary`: Card `title` from frontmatter
- `description`: Card body content (full markdown below frontmatter)

Do NOT update:
- `issuetype` (cannot be changed after creation)
- `parent` (requires separate move operation, out of scope)
- `status` (status is managed by Jira workflows)

Reference the `jira-sync` skill for detailed field mapping.

### Phase 5B: Call MCP Tool

Call the MCP tool:
```
jira_update_issue(
  issue_key: <jira_card or jira_card>,
  summary: <card title>,
  description: <card body content>
)
```

Reference the `jira-sync` skill for MCP tool usage.

### Phase 6B: Update Card Frontmatter

Delegate frontmatter updates to forge-lib:

```bash
forge card update {type} {card_identifier} --data '{
  "jira_last_synced": "2026-02-12T14:30:00Z"
}' --directory .
```

The `updated` date is automatically set by forge-lib.

**Confirm to user:**
```
Pushed to Jira: {jira_card}
Jira URL: {jira_url}
Card: cards/{type}s/{filename}.md
```

---

## Error Handling

**Card not found:**
```
Could not find card matching "{user input}".
Please specify the filename or full title.
```

**Jira create fails:**
```
Failed to create Jira issue: {error message}
Please check your Jira MCP configuration and permissions.
```

**Jira update fails:**
```
Failed to update Jira issue {jira_card}: {error message}
Please check that the issue still exists and you have edit permissions.
```

**Parent card not found:**
If the card references a parent that doesn't exist locally:
```
Warning: Parent card "{parent}" not found locally.
The Jira issue will be created without a parent link.
```

Proceed with creation anyway (don't block).

---

## Key Behaviors

- This command is destructive to Jira. It overwrites the Jira issue's summary and description with the card's content.
- The card is always the source of truth. Jira content is replaced, not merged.
- The `jira-sync` skill provides the MCP tool interface and field mapping logic.
- The `jira_last_synced` timestamp uses ISO 8601 format with timezone (e.g., `2026-02-12T14:30:00Z`).
- All card types (Initiative, Epic, Story) use `jira_card` for Jira linkage.
- In Update Mode, status and parent are NOT updated. Status is managed by Jira workflows. Parent changes require a separate Jira move operation.
- Always prompt for confirmation in Update Mode unless `--force` is specified.

---

## forge-lib Delegation

This command delegates card read and update operations to forge-lib. YAML frontmatter field updates, file path resolution, and markdown file writing are handled by `forge card get` and `forge card update`.

The command focuses on conversational workflow, Jira MCP interaction, and user confirmation.
