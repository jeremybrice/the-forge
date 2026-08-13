---
name: pull-from-jira
description: "One-way pull from Jira to Product Forge card"
arguments:
  - name: card
    description: "Filename, title, or Jira key"
    required: true
  - name: --force
    description: "Apply changes without prompt"
    required: false
---

# Pull from Jira Command

## Overview

The `/pull-from-jira` command performs a one-way sync from Jira to a Product Forge card. It retrieves the latest data from a Jira issue and updates the local card with changes detected in Jira.

This command is destructive to local card content. It overwrites the card's title, description, and metadata with data from Jira. Use this when Jira is the source of truth.

The command always presents a diff to the user before applying changes, unless the `--force` flag is specified.

Card updates are delegated to `forge card update` for field persistence.

---

## Usage

### Pull changes from Jira to a card (with diff approval)

```
/pull-from-jira notification-system-overhaul
```

Fetches the linked Jira issue, compares it to the local card, and presents a diff for user approval before applying changes.

### Pull by Jira key

```
/pull-from-jira PROJ-123
```

Searches for the local card linked to `PROJ-123`, fetches the Jira issue, and presents a diff for approval.

### Force pull without prompt

```
/pull-from-jira notification-system-overhaul --force
```

Skips the diff approval step and immediately applies all detected changes from Jira to the local card.

---

## Conversational Workflow

### Phase 1: Card and Jira Key Resolution

The user must explicitly specify the card or Jira key using one of:
- **Filename** (with or without `.md`): `notification-system-overhaul`
- **Card title**: "Notification System Overhaul"
- **Jira key**: `PROJ-123`

If the user provides ambiguous input, ask for clarification before proceeding.

**If user provided filename or title:**
1. Retrieve card via `forge card get {type} {card_identifier} --directory .`
2. Extract `jira_card` from frontmatter
3. If no linking field is present:
   ```
   Card is not linked to Jira.
   Use /link-to-jira first to establish a connection.
   ```
   Exit.

**If user provided Jira key (format: `PROJ-123`):**
1. Query cards via `forge card query --directory . --format json` and search for matching `jira_card` field
2. If multiple matches found (unlikely but possible):
   ```
   Multiple cards linked to {jira_card}:
   [1] cards/epics/email-notification-engine.md
   [2] cards/stories/story-001-notification-template-builder.md

   Select card to update: [1/2/c]
   ```
3. If no matches found:
   ```
   No local card found linked to {jira_card}.
   Use /link-to-jira to create a link first.
   ```
   Exit.

---

### Phase 2: Fetch Jira Issue

Call the MCP tool:
```
jira_get_issue(issue_key: <jira_card>)
```

Extract the following fields from the response:
- `summary` (maps to card `title`)
- `description` (maps to card body content)
- `status.name` (maps to `jira_status` frontmatter field)
- `timeestimate` (maps to `estimate_hours` frontmatter field, converted from seconds)
- `updated` (Jira last updated timestamp, for reference)

Reference the `jira-sync` skill for MCP tool usage and field mapping.

---

### Phase 3: Compare Jira Data to Local Card

Perform a semantic comparison to detect changes:

**Title changes:**
- Compare Jira `summary` to local frontmatter `title`

**Description changes:**
- Compare Jira `description` to local card body content (everything below frontmatter)
- Use line-by-line diff to identify added, removed, or modified sections

**Jira status changes:**
- Compare Jira `status.name` to local frontmatter `jira_status`
- Store Jira status in a separate `jira_status` field (do NOT map to local `status` field)

**Estimate changes:**
- Compare Jira `timeestimate` (in seconds) to local frontmatter `estimate_hours`
- Convert seconds to hours: `estimate_hours = timeestimate / 3600`
- Round to 1 decimal place

**No changes detected:**
If no changes are detected in any of the above fields:
```
No changes detected in Jira issue {jira_card}.
Local card is already up to date.
```
Exit without modifying the card.

---

### Phase 4: Present Diff to User (unless --force)

If the `--force` flag is NOT present, display a detailed diff of detected changes:

```
Changes detected in Jira issue {jira_card}:

Title:
- Local:  "Build notification system"
+ Jira:   "Build notification preferences UI"

Description:
[Show line-by-line diff of changed sections, abbreviated if very long]

Jira Status:
- Local:  To Do
+ Jira:   In Progress
(Stored in jira_status field; local status field unchanged)

Estimate:
- Local:  null
+ Jira:   40 hours
(Stored in estimate_hours field)

Last updated in Jira: 2026-02-10T16:45:00Z

Apply these changes to local card? [y/N]
```

**Diff format notes:**
- Use `-` prefix for local values being replaced
- Use `+` prefix for Jira values being applied
- For description changes, show a concise summary or line diff
- If description is very long (>50 lines), show first 20 lines with "... (truncated)" message

If the user declines, exit. If the user accepts or `--force` is present, proceed.

---

### Phase 5: Apply Changes to Local Card

Delegate updates to forge-lib:

```bash
forge card update {type} {card_identifier} --data '{
  "title": "<Jira summary>",
  "jira_status": "<Jira status.name>",
  "estimate_hours": <Jira timeestimate / 3600, rounded to 1 decimal>,
  "jira_last_synced": "<current timestamp in ISO 8601 format>"
}' --directory .
```

**Update body content:**
- If the body content changed, write the entire card with updated body using forge-lib
- Replace the card body (everything below frontmatter) with Jira `description`

**Preserve unchanged fields:**
- `type`, `status`, `product`, `module`, `client`, `team`, `parent`, `children`, `created`, and all other frontmatter fields remain untouched
- The `updated` date is automatically set by forge-lib

**Confirm to user:**
```
Card updated from Jira: {jira_card}
Jira URL: {jira_url}
Local card: cards/{type}s/{filename}.md

Updated fields:
- title
- description
- jira_status
- estimate_hours
- jira_last_synced
```

Customize the "Updated fields" list to show only the fields that actually changed.

If you make further local changes, push them with `/product-forge:push-to-jira {filename}`.

---

## Field Mapping Details

The following Jira fields are pulled and mapped to local card fields:

| Jira Field       | Local Card Field      | Notes                                                    |
|------------------|-----------------------|----------------------------------------------------------|
| `summary`        | `title` (frontmatter) | Overwrites local title                                   |
| `description`    | Card body content     | Overwrites entire body below frontmatter                 |
| `status.name`    | `jira_status`         | Stored separately; does NOT overwrite local `status`     |
| `timeestimate`   | `estimate_hours`      | Converted from seconds to hours (÷ 3600), rounded to 1dp |
| `updated`        | (reference only)      | Displayed in diff; not stored in card                    |

**Important notes:**
- **Jira status does NOT overwrite local status.** Local `status` follows Product Forge enums (e.g., Draft, In Progress, Completed). Jira `status.name` is stored in a separate `jira_status` field for reference.
- **Estimate is stored in hours.** Jira uses seconds (`timeestimate`). The command converts to hours for readability.
- **Parent and children are NOT updated.** Jira parent/subtask relationships are out of scope for this command.

Reference the `jira-sync` skill for complete field mapping details.

---

## Error Handling

**Card not found:**
```
Could not find card matching "{user input}".
Please specify the filename, title, or Jira key.
```

**Card not linked to Jira:**
```
Card is not linked to Jira.
Use /link-to-jira first to establish a connection.
```

**Jira fetch fails:**
```
Failed to fetch Jira issue {jira_card}: {error message}
Please check that the issue exists and you have view permissions.
```

**Jira key not found in local cards:**
```
No local card found linked to {jira_card}.
Use /link-to-jira to create a link first, or create a new card.
```

---

## Key Behaviors

- This command is destructive to local card content. It overwrites the card's title, description, and metadata with Jira data.
- Jira is the source of truth. Local content is replaced, not merged.
- The `jira-sync` skill provides the MCP tool interface and field mapping logic.
- The `jira_last_synced` timestamp uses ISO 8601 format with timezone (e.g., `2026-02-12T14:30:00Z`).
- All card types (Initiative, Epic, Story) use `jira_card` for Jira linkage.
- Always present a diff for user approval unless `--force` is specified.
- If no changes are detected, exit without modifying the card.
- Jira status is stored in `jira_status`, NOT in the local `status` field. This preserves the Product Forge status workflow.

---

## forge-lib Delegation

This command delegates card read and update operations to forge-lib. YAML frontmatter field updates, file path resolution, and markdown file writing are handled by `forge card get` and `forge card update`.

The command focuses on conversational workflow, Jira MCP interaction, diff presentation, and user confirmation.
