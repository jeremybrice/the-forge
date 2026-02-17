---
description: Initialize the task management system in the current directory
---

# Start Command

Initialize the folder-based task management system using forge-lib.

## Instructions

### 1. Check Current State

Check if `tasks/` directory exists in the current working directory.

If it exists, inform the user:
```
Task system already initialized.
- Tasks directory: tasks/
- To add a task: /tasks:add
- To update tasks: /tasks:update
```

If not, proceed to initialization.

### 2. Initialize Task System

Run forge-lib to create the task directory structure:

```bash
forge task init
```

This creates:
- `tasks/` directory for task files
- `tasks/index.json` for fast queries

### 3. Handle Legacy TASKS.md (Optional)

If a `TASKS.md` file exists in the current directory, offer to migrate it:

```
I found a legacy TASKS.md file. Would you like me to migrate it to the new folder-based system?

This will:
- Parse tasks from TASKS.md sections (Active, Waiting On, Someday, Done)
- Create individual task files (task-001.md, task-002.md, etc.)
- Archive the original as TASKS.md.legacy

Migrate? (yes/no)
```

If yes:
1. Read TASKS.md content
2. Parse sections using these patterns:
   - `## Active` section → status: "Open"
   - `## Waiting On` section → status: "Blocked"
   - `## Someday` section → status: "Open" with priority: "Low"
   - `## Done` section → status: "Completed"
3. Extract tasks matching pattern: `- [ ] **Title** - note` or `- [x] ~~Title~~ (date) - note`
4. For each task, prepare task data and call:
   ```bash
   forge task create "Task Title" --data '{"status": "Open", "priority": "Medium", "description": "note content"}'
   ```
5. Move TASKS.md to TASKS.md.legacy
6. Report migration results

### 4. Orient the User

```
Task system ready:
- Tasks: tasks/
- Commands: /tasks:add, /tasks:update
- CLI: forge task --help

All task operations use forge-lib for consistent data handling.
```

## Notes

- Initialization is idempotent (safe to run multiple times)
- Legacy migration is optional and one-time
- All task data managed by forge-lib ensures schema compliance
- Use task-management skill for status workflow guidance
