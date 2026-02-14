---
name: jira-sync
description: "Provides reasoning guidance for Jira sync operations. Field mapping, conflict resolution strategies, and MCP error handling patterns. All file operations delegated to forge-lib."
user_invocable: false
---

# Jira Sync Skill

This skill provides reasoning guidance for bidirectional synchronization between Product Forge cards and Jira via the Atlassian MCP server. All file operations are handled by forge-lib.

## Field Mapping Logic

### Forge → Jira (Push)

| Forge Field | Jira Field | Notes |
|-------------|------------|-------|
| `title` | `summary` | Truncate to 255 chars if needed |
| Body content | `description` | Convert markdown to Jira wiki markup or plain text |
| `type` | `issuetype` | Initiative → Initiative, Epic → Epic, Story → Story |
| `parent` (reference) | `parent` link | Resolve parent's `jira_key` before creating child |

**Not synced to Jira:** `status`, `product`, `module`, `client`, `team`, `confidence` (local-only fields)

### Jira → Forge (Pull)

| Jira Field | Forge Field | Notes |
|------------|-------------|-------|
| `summary` | `title` | Direct mapping |
| `description` | Body content | Convert from Jira wiki markup to markdown |
| `key` | `jira_key` | Store for bidirectional reference |
| `self` | `jira_url` | Full URL for easy access |
| `status.name` | `jira_status` | **Read-only reference field** (never pushed back) |
| `timeestimate` | `estimate_hours` | Convert seconds to hours (÷ 3600) |

**Not imported from Jira:** Labels, custom fields, comments, attachments, workflow transitions

## Conflict Resolution Strategy

### Conflict Detection

Conflicts occur when **both title OR description change in both systems since last sync**.

- Local `status` and Jira status are **independent** (no conflict)
- `jira_status` field is a read-only reference to Jira's current status
- Local status changes never push to Jira
- Jira status changes never overwrite local `status`

### Resolution Options

1. **Keep Forge** - Push local changes to Jira, overwrite remote
2. **Accept Jira** - Pull Jira changes to local, overwrite local
3. **Manual Merge** - User resolves conflicts manually, then chooses direction

### Conflict Presentation

When presenting conflicts to the user:

```
## Sync Conflict Detected

Both the local card and Jira issue have been modified since the last sync.

### Title
**Local (Forge):** [local title]
**Remote (Jira):** [jira title]

### Description
**Local (Forge):**
[local body]

**Remote (Jira):**
[jira body]

### Status
**Local status:** [forge status]
**Jira status:** [jira status]

*Note: Local and Jira statuses are independent and do not conflict.*

### Resolution Options
1. **Keep Forge** - Overwrite Jira with local changes
2. **Accept Jira** - Overwrite local card with Jira changes
3. **Manual Merge** - Resolve conflicts manually then sync
```

## Parent Relationship Validation

Before creating a child issue in Jira:

1. Read the parent card file (specified in `parent` field)
2. Check if parent has `jira_key` or `jira_card` field
3. If parent is not synced: **Error - "Parent card must be synced to Jira first"**
4. Use parent's Jira key for the `parent` parameter in `jira_create_issue`

## MCP Error Handling Patterns

### MCP Server Unavailable
**Signature:** Tool not found, connection refused, timeout
**Message:** "Atlassian MCP server is not available. Check that the server is running and configured."

### Authentication Failure
**Signature:** 401 Unauthorized
**Message:** "Jira authentication failed. Check your credentials in the MCP server config."

### Issue Not Found
**Signature:** 404 Not Found
**Message:** "Issue {key} not found in Jira. It may have been deleted."

### Permission Denied
**Signature:** 403 Forbidden
**Message:** "Insufficient permissions for this operation in Jira."

### Invalid Transition
**Signature:** 400 Bad Request (workflow transition)
**Message:** "Cannot move issue to this status. The transition is not valid in the Jira workflow."

## Validation Rules

### Jira Key Format
**Pattern:** `PROJECT-123` (uppercase letters, hyphen, numbers)
**Regex:** `/^[A-Z][A-Z0-9]+-\d+$/`

### Valid Issue Types
Only sync these card types: **Initiative**, **Epic**, **Story**

### Required Fields for Creation
- `type` (Initiative, Epic, or Story)
- `title` (must be present)
- Card must NOT already have `jira_key` or `jira_card`

## Batch Sync Guidance

When syncing multiple cards:

1. Process each card individually (do not batch create in a single MCP call)
2. Track results: succeeded count, failed count, per-card results
3. Present summary: "Synced 8 of 10 cards. 2 failed: [card names]"
4. Continue processing remaining cards even if some fail
5. Store `last_synced` timestamp on successful sync for conflict detection

## Status Independence Principle

**Key rule:** Local `status` and Jira status are independent workflows.

- **Local `status`:** Forge-specific workflow (Draft, Ready, In Progress, Done)
- **Jira status:** Jira-specific workflow (To Do, In Progress, Done, etc.)
- **`jira_status` field:** Read-only reference to Jira's current status

**Never:**
- Push local status changes to Jira
- Overwrite local status with Jira status
- Treat status differences as conflicts

**Always:**
- Pull Jira status to `jira_status` field on every sync
- Preserve local `status` field independently
- Allow both statuses to differ without warning

## Usage with forge-lib

All Jira sync operations are performed via MCP tools, not forge-lib. However, forge-lib handles card reading/writing:

```bash
# Read card frontmatter
forge card get story-001-user-auth

# Update card with Jira fields after sync
forge card update story-001-user-auth --data '{"jira_key":"PROJ-123","last_synced":"2024-01-15T10:30:00Z"}'
```

MCP operations (jira_create_issue, jira_update_issue, jira_get_issue) are called directly from commands, following the patterns defined in this skill.
