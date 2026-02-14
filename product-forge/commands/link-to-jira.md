---
name: link-to-jira
description: "Link a specific Product Forge card to a Jira issue (create new or link existing)"
arguments:
  - name: card
    description: "Filename or title of the card to link"
    required: true
  - name: --create-new
    description: "Skip search and directly create a new Jira issue"
    required: false
---

# Link to Jira Command

## Overview

The `/link-to-jira` command establishes a bidirectional link between a Product Forge card and a Jira issue. It supports two workflows: searching for and linking to an existing Jira issue, or creating a new Jira issue from the card.

This is the first step before using `/push-to-jira` or `/pull-from-jira`. Once linked, the card can be synchronized bidirectionally with Jira.

Card frontmatter updates are delegated to `forge card update` for field persistence.

---

## Usage

### Link by searching for existing Jira issues

```
/link-to-jira notification-system-overhaul
```

Searches Jira for issues matching the card title and presents options to link to an existing issue or create a new one.

### Force creation of a new Jira issue

```
/link-to-jira notification-system-overhaul --create-new
```

Skips the search step and directly creates a new Jira issue for the card.

---

## Conversational Workflow

### Phase 1: Card Identification

The user must explicitly specify the card to link using:
- The filename (with or without `.md` extension): `notification-system-overhaul`
- The card title: "Notification System Overhaul"
- Partial match (if unambiguous)

If the user provides ambiguous input, ask for clarification before proceeding.

**Retrieve card via forge-lib:**
```bash
forge card get {card_identifier} --directory .
```

Extract from response:
- `title` (from frontmatter)
- `type` (from frontmatter)
- `description` (from frontmatter)
- `jira_key` or `jira_card` field (from frontmatter)
- Card body content (for description field when creating)

---

### Phase 2: Check for Existing Link

Inspect the frontmatter for linking fields:
- **Epic cards:** `jira_key`
- **Initiative and Story cards:** `jira_card`

If a link already exists:
```
Card is already linked to Jira issue: {jira_key}
Jira URL: {jira_url}

Options:
[1] Keep existing link
[2] Re-link to a different issue
[c] Cancel

Your choice:
```

If the user chooses to re-link, proceed to Phase 3. Otherwise, exit.

---

### Phase 3: Search for Existing Jira Issues (unless --create-new)

If `--create-new` flag is present, skip directly to Phase 4 (Create New Issue).

Build a JQL query using the card title:
```
summary ~ "{title}" AND issuetype = {mapped_type} ORDER BY created DESC
```

**Type mapping:**
- Initiative → `Initiative` (if available) or `Epic`
- Epic → `Epic`
- Story → `Story`
- Other types → `Task`

Call the MCP tool:
```
jira_search_issues(jql: <constructed query>, max_results: 5)
```

Reference the `jira-sync` skill for MCP tool usage and field mapping.

**Present Options:**
```
Found {N} matching Jira issues for "{card title}":

[1] Create new issue

--- Existing issues ---
[2] PROJ-123: Build notification system (Status: To Do, Created: 2026-01-15)
[3] PROJ-456: Notification overhaul (Status: In Progress, Created: 2026-01-10)
[4] PROJ-789: Email notification engine (Status: Done, Created: 2025-12-20)

[c] Cancel

Your choice:
```

---

### Phase 4: Handle User Selection

**Option [1]: Create New Issue**

Call the MCP tool to create a new Jira issue:
```
jira_create_issue(
  project_key: <from config>,
  summary: <card title>,
  description: <card body content or description>,
  issuetype: <mapped type>,
  parent: <parent card's jira_key or jira_card, if parent exists and card type is Story/Epic>
)
```

Extract the returned `key` and construct the `jira_url`:
```
jira_url = "https://{jira_domain}/browse/{key}"
```

**Option [2-6]: Link to Existing Issue**

Extract the Jira key from the selected result (e.g., `PROJ-123`).

Construct the `jira_url`:
```
jira_url = "https://{jira_domain}/browse/{key}"
```

**Option [c]: Cancel**

Exit without making changes.

---

### Phase 5: Update Card Frontmatter

Delegate frontmatter updates to forge-lib:

**For Epic cards:**
```bash
forge card update {card_identifier} --data '{
  "jira_key": "PROJ-123",
  "jira_url": "https://your-domain.atlassian.net/browse/PROJ-123",
  "jira_last_synced": "2026-02-12T14:30:00Z"
}' --directory .
```

**For Initiative and Story cards:**
```bash
forge card update {card_identifier} --data '{
  "jira_card": "PROJ-123",
  "jira_url": "https://your-domain.atlassian.net/browse/PROJ-123",
  "jira_last_synced": "2026-02-12T14:30:00Z"
}' --directory .
```

The `updated` date is automatically set by forge-lib.

**Confirm to user:**
```
Linked to Jira: PROJ-123
Jira URL: https://your-domain.atlassian.net/browse/PROJ-123
Card updated: cards/{type}s/{filename}.md
```

---

## Error Handling

**Card not found:**
```
Could not find card matching "{user input}".
Please specify the filename or full title.
```

**Jira search fails:**
```
Jira search failed: {error message}
Falling back to create-new mode.
```

**Jira create fails:**
```
Failed to create Jira issue: {error message}
Please check your Jira MCP configuration and permissions.
```

**Parent card not linked:**
If the card has a parent (from frontmatter `parent` field) and the parent card is not yet linked to Jira, warn the user:
```
Warning: Parent card "{parent}" is not linked to Jira.
The new Jira issue will be created without a parent link.
Consider linking the parent card first using /link-to-jira.
```

Proceed with creation anyway (don't block), but omit the `parent` field from the Jira create call.

---

## Key Behaviors

- This command is non-destructive. It only adds linking fields to the card frontmatter via forge-lib.
- The `jira-sync` skill provides the MCP tool interface and field mapping logic.
- The `jira_last_synced` timestamp uses ISO 8601 format with timezone (e.g., `2026-02-12T14:30:00Z`).
- Epic cards use `jira_key` for backward compatibility with the original schema. Initiative and Story cards use `jira_card`.
- Always present the user with options. Never silently create a Jira issue without confirmation.
- If the user later unlinks the card (by manually removing the fields), they can re-run `/link-to-jira` to establish a new link.

---

## forge-lib Delegation

This command delegates card read and update operations to forge-lib. YAML frontmatter field updates, file path resolution, and markdown file writing are handled by `forge card get` and `forge card update`.

The command focuses on conversational workflow, Jira MCP interaction, and user confirmation.
