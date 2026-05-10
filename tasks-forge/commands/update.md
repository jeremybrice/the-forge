---
description: Update task status or sync from external sources
argument-hint: "[task-id] [--status STATUS] [--priority PRIORITY]"
---

# Update Command

Update existing tasks or sync from external sources.

## Usage

```bash
/tasks:update task-003 --status "In Progress"
/tasks:update task-003 --priority 1
/tasks:update --triage
```

## Instructions

### Mode 1: Update Specific Task

When user provides a task ID:

#### 1. Parse Arguments

Extract:
- Task ID (e.g., "task-003")
- Status to set (if provided)
- Priority to set (if provided)

#### 2. Validate Status Transition

If updating status, check the status workflow:
- Open → In Progress, Cancelled
- In Progress → Blocked, Completed, Cancelled, Open
- Blocked → In Progress, Open, Cancelled
- Completed → Open (reopening)
- Cancelled → Open (reopening)

If transition is invalid, warn the user and suggest valid transitions.

#### 3. Update via forge-lib

Build the update command:

```bash
forge task update task-003 --data '{"status": "In Progress", "priority": 1}'
```

Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and do not proceed.

Parse the successful JSON response and confirm:
```
Task updated: task-003.md
- Status: Open → In Progress
- Priority: 3 → 1
```

### Mode 2: Triage Mode (`--triage`)

When user runs `/tasks:update --triage`:

#### 1. Query All Active Tasks

```bash
forge task query --status Open
# Repeat with --status "In Progress" or --status Blocked to query other statuses.
```

Check the `success` field in each query response. If `success` is `false`, report the `error` field to the user and do not proceed with triage.

This returns JSON array of tasks on success.

#### 2. Identify Tasks Needing Attention

Flag tasks that:
- Have `due_date` in the past (overdue)
- Have been "Open" for 30+ days (stale)
- Have been "Blocked" for 14+ days (stuck)
- Are "In Progress" but not updated in 7+ days (forgotten)

#### 3. Present for Triage

For each flagged task, present:
```
task-012.md - "Update API documentation"
- Status: Open
- Created: 45 days ago
- Due: 10 days overdue
- No updates in 45 days

Action?
1. Mark completed
2. Update status
3. Reschedule due date
4. Move to someday (low priority)
5. Skip
```

#### 4. Apply User's Choice

Based on user input:
- **Completed**: `forge task update task-012 --data '{"status": "Completed"}'`
- **Update status**: Prompt for new status, then update
- **Reschedule**: Prompt for new due date, then `forge task update task-012 --data '{"due_date": "YYYY-MM-DD"}'`
- **Move to someday**: `forge task update task-012 --data '{"priority": 5}'`
- **Skip**: Continue to next

For each triage update, check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and continue to the next task.

#### 5. Report Summary

```
Triage complete:
- 2 tasks marked completed
- 1 task rescheduled
- 3 tasks updated
- X tasks now need attention
```

If triage surfaced systemic patterns (many blocked tasks, recurring overdue items), suggest: "Consider generating a status report with `/report-forge:generate` to share findings with leadership."

### Mode 3: External Sync (Future Enhancement)

**Note:** External sync (Asana, Linear, Jira, GitHub) requires MCP integration.

If MCP tools are available:
1. Query external systems for assigned tasks
2. Compare against local tasks using `external_id` field
3. Offer to import new tasks or sync status changes
4. Use `forge task create` with `--external-id` and `--external-link` for imports
5. Use `forge task update` for status syncs
6. Check the `success` field in each forge-lib JSON response. If `success` is `false`, report the `error` field to the user and skip that item (continue syncing remaining items).

If MCP not available:
```
External sync requires MCP integration (Linear, Asana, Jira, GitHub).
Configure MCP tools to enable this feature.
```

## Notes

- Status transitions follow the workflow defined in task-management skill
- Invalid transitions are blocked with helpful error messages
- Triage mode is interactive and requires user confirmation for changes
- All updates go through forge-lib for schema validation
- Use `forge task query --help` to see all query options
