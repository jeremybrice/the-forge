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
Priority (High/Medium/Low, default Medium): [wait for input]
Due date (YYYY-MM-DD, or leave blank): [wait for input]
```

### 3. Parse and Validate Input

- **Title**: Required, use as provided
- **Description**: Optional, can be empty
- **Priority**: Map user input to schema values:
  - "High" / "high" / "H" → "High"
  - "Low" / "low" / "L" → "Low"
  - Default or "Medium" → "Medium"
- **Due date**: If provided, validate YYYY-MM-DD format

### 4. Create Task via forge-lib

Build the task creation command:

```bash
forge task create "{title}" \
  --data '{"priority": "{priority}", "status": "Open", "description": "{description}", "due_date": "{due_date}"}'
```

Notes:
- Omit `--description` if empty
- Omit `--due-date` if not provided
- Status always starts as "Open"
- forge-lib handles sequential numbering (task-001.md, task-002.md, etc.)

### 5. Parse forge-lib Response

The forge-lib command returns JSON:
```json
{
  "success": true,
  "data": {
    "filename": "task-003.md",
    "id": "task-003",
    "title": "Review API spec",
    "status": "Open",
    "priority": "High"
  }
}
```

### 6. Confirm to User

```
Task added: {filename}
- Title: {title}
- Priority: {priority}
- Due: {due_date or "none"}
- Status: Open

Your task is now tracked in tasks/
```

## Notes

- All tasks start with status "Open"
- Sequential numbering handled automatically by forge-lib
- Use `/tasks:update` to sync with external systems or change status
- Task files use standardized schema enforced by forge-lib
