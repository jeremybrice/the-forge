---
name: task-management
description: Task management workflow guidance for status transitions, priority assignment, and triage reasoning. Use when helping users manage task lifecycles and make decisions about task updates.
---

# Task Management

Guidance for task workflow reasoning and status management.

## Status Workflow

Tasks progress through a state machine with validated transitions:

```
Open → In Progress → Completed
  ↓         ↓            ↑
Cancelled ← Blocked → (reopen)
```

**Valid Transitions:**
- **Open** → In Progress (starting work), Cancelled (no longer needed)
- **In Progress** → Blocked (waiting on dependency), Completed (finished), Cancelled (abandoned), Open (pausing work)
- **Blocked** → In Progress (dependency resolved), Open (changing approach), Cancelled (giving up)
- **Completed** → Open (reopening for rework)
- **Cancelled** → Open (reconsidering)

**Status Meanings:**
- **Open**: Ready to work on, not yet started
- **In Progress**: Actively being worked on
- **Blocked**: Waiting on external dependency or blocker
- **Completed**: Work finished successfully
- **Cancelled**: Decided not to pursue

## Priority Guidelines

**High Priority:**
- Urgent AND important
- Has a deadline within 3 days
- Blocks other people's work
- Critical business impact
- Use sparingly (5-10% of tasks max)

**Medium Priority:**
- Default for most tasks
- Important but not urgent
- Has a deadline beyond 3 days
- Standard workflow items

**Low Priority:**
- Nice to have
- No deadline
- Exploratory or research work
- Can be deferred indefinitely

## Triage Reasoning

When triaging tasks, consider:

**Overdue Tasks (past due_date):**
- Still relevant? → Reschedule or complete
- No longer needed? → Cancel
- Waiting on blocker? → Mark as Blocked

**Stale Tasks (Open 30+ days):**
- Forgotten or deprioritized? → Move to Low priority
- No longer relevant? → Cancel
- Ready to start? → Keep as is or move to In Progress

**Stuck Tasks (Blocked 14+ days):**
- Blocker still exists? → Keep Blocked, update description
- Blocker resolved? → Move to In Progress
- Alternative approach? → Move to Open
- Give up? → Cancel

**Forgotten In Progress (7+ days without update):**
- Actually done? → Mark Completed
- Still working on it? → Keep In Progress
- Paused? → Move to Open
- Blocked? → Mark as Blocked

## Task Creation Reasoning

**When to create a task:**
- User explicitly says "add task" or "remind me to"
- Action item identified in meeting notes, emails, or chat
- Commitment made to deliver something
- External request requiring follow-up
- Recurring work that needs tracking

**When NOT to create a task:**
- Vague ideas without clear action ("think about X")
- Already tracked in external system and not managed locally
- One-time questions that don't require follow-up
- Immediate actions completed on the spot

**Task Scope:**
- One task = one completable unit of work
- If description has multiple distinct actions, consider splitting
- Tasks should be completable within 1-2 weeks ideally
- Large projects → break into smaller tasks

## External System Integration Reasoning

**When syncing from external systems:**
- Use `external_id` and `external_link` to maintain connection
- Local status reflects external status when syncing
- Don't duplicate tasks already managed externally unless user wants local tracking
- Prefer external system as source of truth for status

**Fuzzy Matching Logic:**
- Compare task titles case-insensitively
- Allow minor wording differences ("Review API" ≈ "API Review")
- Match if 80%+ words overlap
- Use `external_id` for definitive matching when available

## Conventions

- Use consistent terminology (not "todo", "action item", "ticket" interchangeably)
- Task titles should be actionable (start with verb: "Review...", "Update...", "Send...")
- Update `updated` date whenever any field changes
- Never delete completed tasks (they provide history)
- Dependencies reference task IDs, not filenames
- Tags should be lowercase, singular, consistent across tasks

## Workflow Prompts

**When user asks "what should I work on?"**
1. Show High priority Open tasks first
2. Show Medium priority Open tasks
3. Highlight anything overdue
4. Suggest unblocking Blocked tasks if possible

**When user says "I'm working on X":**
- Find the task by title
- Update status to In Progress
- Confirm transition

**When user says "X is done":**
- Find the task by title
- Update status to Completed
- Confirm transition

**When user says "X is blocked":**
- Find the task by title
- Update status to Blocked
- Prompt for blocker description (add to task notes)

## Notes

- All file operations handled by forge-lib (never write YAML directly)
- Status transitions validated by task_ops.py
- Use forge CLI for all task CRUD operations
- This skill provides reasoning only, not implementation details
