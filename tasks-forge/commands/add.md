---
description: Quickly add a new task with an interactive prompt
---

# Add Command

Interactively add a new task to the task management system.

## Instructions

### 1. Check Prerequisites

Check if `tasks/` directory exists. If not:
```
Task system not initialized. Run /tasks:start first.
```

### 2. Gather Task Information

Prompt the user interactively:

```
Let's add a new task.

Title: [wait for input]
Description (optional): [wait for input]
Priority (1-5, default 3): [wait for input]
Due date (YYYY-MM-DD, or leave blank): [wait for input]
```

### 3. Parse and Validate Input

- **Title**: Required, use as provided
- **Description**: Optional, can be empty
- **Priority**: Must be an integer from 1 to 5
  - `1` = highest priority
  - `3` = default
  - `5` = lowest priority
- **Due date**: If provided, validate YYYY-MM-DD format

### 4. Create Task via forge-lib

Build the task creation command:

```bash
forge task create "{title}" \
  --data '{"priority": {priority}, "status": "Open", "description": "{description}", "due_date": "{due_date}"}'
```

Notes:
- Omit `description` from JSON if empty
- Omit `due_date` from JSON if not provided
- Status always starts as "Open"
- forge-lib handles sequential numbering (task-001.md, task-002.md, etc.)

### 5. Check forge-lib Response

Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and do not proceed to the confirmation step.

The forge-lib command returns JSON on success:
```json
{
  "success": true,
  "data": {
    "filename": "task-003.md",
    "id": "task-003",
    "title": "Review API spec",
    "status": "Open",
    "priority": 2
  }
}
```

### 6. Confirm to User

```
Task added: {filename}
- Title: {title}
- Priority: {priority} (1 highest, 5 lowest)
- Due: {due_date or "none"}
- Status: Open

Your task is now tracked in tasks/

If this relates to a Product Forge story, you can link them with the `parent` field.
For Slack-sourced tasks, consider `/slack-forge:scan` for systematic harvesting.
```

## Notes

- All tasks start with status "Open"
- Sequential numbering handled automatically by forge-lib
- Use `/tasks:update` to sync with external systems or change status
- Task files use standardized schema enforced by forge-lib
