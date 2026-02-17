# Tasks Forge

Folder-based task management with rich metadata, status workflows, and external system sync.

## Overview

Tasks Forge provides a lightweight, git-friendly task management system that stores tasks as individual markdown files with YAML frontmatter. All task operations are handled by the **forge-lib** Python CLI, ensuring schema compliance and data consistency.

**Key Features:**
- Sequential task numbering (task-001.md, task-002.md, ...)
- Status state machine with validated transitions
- Priority-based organization (High/Medium/Low)
- External system integration (Linear, Asana, Jira, GitHub via MCP)
- Interactive triage workflows
- JSON index for fast queries

## Architecture

**V2 vs V1:**
- **V1**: LLM directly reads/writes task files, manages YAML, handles numbering
- **V2**: forge-lib CLI handles all file operations, LLM focuses on workflow and conversation

**Commands → forge-lib delegation:**
- `/tasks:start` → `forge task init`
- `/tasks:add` → `forge task create`
- `/tasks:update` → `forge task query` + `forge task update`

**Skills:**
- `task-management`: Reasoning-only skill for status workflow, priority guidelines, triage logic

## Commands

### `/tasks:start` - Initialize Task System

Initialize the task management system in the current directory.

**Usage:**
```
/tasks:start
```

**What it does:**
1. Creates `tasks/` directory structure via `forge task init`
2. Optionally migrates legacy `TASKS.md` file
3. Sets up index.json for fast queries

**When to use:**
- First-time setup in a new project
- Migrating from legacy TASKS.md format

---

### `/tasks:add` - Add New Task

Interactively add a new task with guided prompts.

**Usage:**
```
/tasks:add
```

**Interactive Prompts:**
- Title (required)
- Description (optional)
- Priority (High/Medium/Low, default: Medium)
- Due date (YYYY-MM-DD, optional)

**Example:**
```
Title: Review API spec for Phoenix project
Description: Focus on authentication flow and rate limiting
Priority: High
Due date: 2026-02-20
```

Creates: `tasks/task-003.md` with status "Open"

**forge-lib command:**
```bash
forge task create "Review API spec" --data '{"priority": "High", "due_date": "2026-02-20"}'
```

---

### `/tasks:update` - Update Tasks

Update task status, priority, or run triage workflows.

**Usage:**
```
/tasks:update task-003 --status "In Progress"
/tasks:update task-003 --priority High
/tasks:update --triage
```

**Modes:**

#### 1. Update Specific Task
```
/tasks:update task-003 --status "In Progress"
```

Validates status transition and updates task via forge-lib.

#### 2. Triage Mode
```
/tasks:update --triage
```

Interactive triage workflow:
- Identifies overdue tasks (past due_date)
- Flags stale tasks (Open 30+ days)
- Finds stuck tasks (Blocked 14+ days)
- Highlights forgotten tasks (In Progress, 7+ days without update)

For each flagged task, prompts for action:
1. Mark completed
2. Update status
3. Reschedule due date
4. Move to low priority
5. Skip

#### 3. External Sync (requires MCP)
Sync tasks from Linear, Asana, Jira, or GitHub when MCP tools are configured.

**forge-lib commands:**
```bash
forge task query --status Open
forge task update task-003 --data '{"status": "Completed"}'
```

## Skills

### task-management

**Purpose:** Reasoning-only guidance for task workflow decisions.

**Provides:**
- Status transition rules and state machine logic
- Priority assignment guidelines
- Triage reasoning (when to complete, reschedule, cancel)
- Task creation criteria (when to create vs when not to)
- External system integration logic

**Does NOT provide:**
- File format details (handled by forge-lib)
- YAML parsing instructions (handled by forge-lib)
- Directory structure (handled by forge-lib)

**Key Workflows:**

**Status State Machine:**
```
Open → In Progress → Completed
  ↓         ↓            ↑
Cancelled ← Blocked → (reopen)
```

**Priority Guidelines:**
- **High**: Urgent + important, deadline ≤3 days, blocks others (5-10% of tasks)
- **Medium**: Standard workflow items, deadline >3 days (default)
- **Low**: Nice to have, no deadline, can defer indefinitely

**Triage Reasoning:**
- Overdue? → Reschedule, complete, or cancel
- Stale (Open 30+ days)? → Deprioritize or cancel
- Stuck (Blocked 14+ days)? → Find alternative or cancel
- Forgotten (In Progress 7+ days)? → Complete, pause, or mark blocked

## Task File Format

All task files are created and managed by forge-lib using the task schema.

**Example task file:**
```yaml
---
title: "Review API spec for Phoenix project"
type: "task"
status: "In Progress"
priority: "High"
assignee: ""
created: "2026-02-14"
updated: "2026-02-14"
due_date: "2026-02-20"
dependencies: []
tags: ["phoenix", "api", "review"]
external_link: ""
external_id: ""
---

Focus areas:
- Authentication flow
- Rate limiting strategy
- Backwards compatibility
```

**Status Values:**
- `Open` - Ready to work on, not started
- `In Progress` - Actively being worked on
- `Blocked` - Waiting on external dependency
- `Completed` - Work finished
- `Cancelled` - Decided not to pursue

**Priority Values:**
- `High` - Urgent and important
- `Medium` - Standard priority
- `Low` - Nice to have, no urgency

## forge-lib CLI Reference

**Initialize tasks:**
```bash
forge task init
```

**Create task:**
```bash
forge task create "Task title" --data '{"priority": "Medium", "status": "Open"}'
forge task create "Task title" --data '{"description": "Details", "due_date": "2026-02-20"}'
```

**Query tasks:**
```bash
forge task query
forge task query --status Open
forge task query --priority High
```

**Get task:**
```bash
forge task get task-003
```

**Update task:**
```bash
forge task update task-003 --data '{"status": "In Progress"}'
forge task update task-003 --data '{"priority": "High", "due_date": "2026-02-25"}'
```

All commands return JSON for easy parsing and integration.

## Line Count Comparison (v1 vs v2)

**Commands:**
- start.md: 114 lines (v1) → 75 lines (v2) = **34% reduction**
- add.md: 99 lines (v1) → 66 lines (v2) = **33% reduction**
- update.md: 139 lines (v1) → 108 lines (v2) = **22% reduction**

**Skills:**
- task-management: 237 lines (v1) → 144 lines (v2) = **39% reduction**

**Total:** 589 lines (v1) → 393 lines (v2) = **33% overall reduction**

All file operations, YAML parsing, schema validation, and sequential numbering moved to forge-lib.

## Migration from V1

Tasks Forge v2 can migrate legacy TASKS.md files automatically:

1. Run `/tasks:start` in a directory with TASKS.md
2. Confirm migration when prompted
3. Legacy file archived as TASKS.md.legacy
4. Individual task files created with sequential numbering

**No manual migration needed** - the start command handles everything.

## Integration with External Systems

When MCP tools are configured (Linear, Asana, Jira, GitHub):
- Tasks can be imported with `external_id` and `external_link` fields
- Status syncs bidirectionally
- Use `/tasks:update` to trigger sync workflows

## Dependencies

- **forge-lib** v2.0.0+ with task operations support
- Python 3.9+
- Optional: MCP tools for external system integration

## Usage Example

```
# Initialize in new project
/tasks:start

# Add tasks interactively
/tasks:add
> Title: Implement user authentication
> Priority: High
> Due date: 2026-02-28

# Update task status
/tasks:update task-001 --status "In Progress"

# Run triage
/tasks:update --triage
> [Review flagged tasks and take actions]

# Query via CLI
forge task query --status Open --priority High
```

## Notes

- Task numbers are sequential and permanent (001, 002, 003...)
- Completed tasks remain in tasks/ directory for history
- All schema validation handled by forge-lib
- Safe to edit task files manually (forge-lib validates on read)
- Index automatically rebuilds when files change
