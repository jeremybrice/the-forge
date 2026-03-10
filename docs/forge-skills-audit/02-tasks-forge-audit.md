# Tasks Forge — Audit Card

## Plugin Overview
Tasks Forge provides lightweight, folder-based task management with status lifecycle tracking, priority assignment, and triage workflows. It manages tasks as individual markdown files in a `tasks/` directory, with forge-lib handling all CRUD operations and schema validation. The plugin supports a five-state workflow (Open → In Progress → Completed, with Blocked and Cancelled branches) and includes triage reasoning for overdue, stale, stuck, and forgotten tasks.

## Component Inventory

| Component | Type | Lines | Has References |
|-----------|------|-------|----------------|
| task-management | Skill | 159 | No |
| start | Command | 87 | No |
| add | Command | 92 | No |
| update | Command | 146 | No |

**Total: 1 skill, 3 commands, 0 agents, 0 reference files**

---

## Per-Component Scores

### task-management (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description covers the core use case and mentions status transitions, priority, and triage. However, it wouldn't trigger on natural prompts like "what should I work on next?" or "I'm blocked on X" or "mark that as done." The description doesn't use the pushy pattern to capture those conversational triggers. |
| Core Objective | **Adequate** | The skill provides "workflow guidance" and "reasoning" but doesn't crisply define what success looks like. Is the goal to produce a correctly transitioned task? To give the user a recommendation? The objective is diffuse across multiple concerns (status, priority, triage, creation, external sync). |
| Procedural Logic | **Strong** | The state machine diagram is clear and comprehensive. Valid transitions are explicit with arrows. Triage reasoning provides clear decision trees for each category (overdue, stale, stuck, forgotten). Workflow prompts section maps natural language to actions. |
| Human-in-the-Loop | **Adequate** | The "what should I work on?" prompt pattern implies user interaction, and triage reasoning is presented as decision support rather than autonomous action. But there are no explicit gates defined; it's left to the consuming command to decide when to pause. |
| Output Specifications | **Weak** | No formal output templates. The workflow prompts section shows rough interaction patterns but doesn't specify how task lists, triage recommendations, or status confirmations should be formatted for the user. |
| Reference File Utilization | **Missing** | No reference files. The triage decision trees (overdue/stale/stuck/forgotten) are substantial enough to warrant extraction, especially since the update command's triage mode needs the same logic. |
| Connector/Tool Integration | **Adequate** | Notes that forge-lib handles all file operations and that task_ops.py validates transitions, but doesn't list these as formal dependencies or provide fallback behavior. The external sync section mentions MCP tools but is vague. |
| Progressive Disclosure | **Strong** | 159 lines, appropriately sized. Content is focused on reasoning rather than implementation. |
| Cross-Plugin Handoff | **Missing** | No mention of how tasks relate to Product Forge cards (stories are often tracked as tasks), Slack Forge harvested tasks (the promote flow feeds into Tasks Forge), or Forge Memory context. This is a significant gap given the CLAUDE.md workspace instructions explicitly describe Slack Forge → Tasks Forge promotion. |
| Writing Quality | **Strong** | Clean, well-organized. The state machine diagram is elegant. Decision trees in the triage section use conditional logic naturally. "Never delete completed tasks (they provide history)" is a well-reasoned convention. |

### start (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief but functional. |
| Core Objective | **Strong** | Clear: initialize the task management system. |
| Procedural Logic | **Strong** | Four-step workflow with idempotency check, initialization, legacy migration, and user orientation. Legacy TASKS.md migration is a thoughtful inclusion with clear parsing rules. |
| Human-in-the-Loop | **Strong** | Migration is gated behind explicit user confirmation. Error handling continues through remaining tasks rather than stopping on first failure. |
| Output Specifications | **Strong** | Clear templates for both "already initialized" and "freshly initialized" states. |
| Reference File Utilization | **Missing** | N/A for an init command. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib commands with JSON response parsing. |
| Progressive Disclosure | **Strong** | 87 lines, compact. |
| Cross-Plugin Handoff | **Adequate** | References the task-management skill for workflow guidance but doesn't suggest broader ecosystem setup (e.g., "also consider /memory:start if you haven't set up organizational memory"). |
| Writing Quality | **Strong** | Clean, imperative, well-structured. |

### add (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | "Quickly add a new task with an interactive prompt" is functional but doesn't suggest the range of input styles users might use (natural language, batch adds, from meeting notes). |
| Core Objective | **Strong** | Clear: add a new task interactively. |
| Procedural Logic | **Strong** | Six-step workflow: prerequisites → gather → parse → create → check response → confirm. Clean and sequential. |
| Human-in-the-Loop | **Adequate** | Gathers input interactively but doesn't confirm the assembled task before creating it. Similar to Forge Memory's remember command gap — it asks field by field but doesn't show a preview for approval. |
| Output Specifications | **Strong** | Clear confirmation template with all fields displayed. |
| Reference File Utilization | **Missing** | No reference files. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib create command with JSON parsing. |
| Progressive Disclosure | **Strong** | 92 lines, compact. |
| Cross-Plugin Handoff | **Weak** | Only mentions /tasks:update. Should suggest that tasks can be linked to Product Forge cards or that the task may be relevant to an ongoing Report Forge report. |
| Writing Quality | **Adequate** | Functional and clear but reads as a specification rather than guidance. Could benefit from explaining why interactive gathering matters (progressive capture, reducing friction). |

### update (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description is brief. The argument-hint is a nice touch but only covers direct update; doesn't mention triage mode in the description. |
| Core Objective | **Strong** | Clear: update task status or sync from external sources. Three modes are well-defined. |
| Procedural Logic | **Strong** | Three distinct modes (specific update, triage, external sync) with clear workflows for each. Triage mode's five-option action menu is well-designed. Status transition validation before update is a good defensive pattern. |
| Human-in-the-Loop | **Strong** | Triage mode is fully interactive with per-task action prompts and a summary report. Status transitions validate before executing. |
| Output Specifications | **Strong** | Clear templates for update confirmations, triage presentation, and summary reports. |
| Reference File Utilization | **Missing** | No reference files. Triage thresholds (30 days stale, 14 days stuck, 7 days forgotten) duplicate the task-management skill's values. |
| Connector/Tool Integration | **Adequate** | forge-lib commands are explicit. External sync section mentions MCP tools but notes it as "Future Enhancement" with a graceful fallback message. |
| Progressive Disclosure | **Strong** | 146 lines, reasonable size. |
| Cross-Plugin Handoff | **Weak** | External sync mentions Asana, Linear, Jira, GitHub generically. No mention of Slack Forge as a task source (despite the CLAUDE.md workflow describing exactly this). No mention that completed tasks might inform Report Forge. |
| Writing Quality | **Strong** | Well-structured with clear mode separation. Error handling is consistent. |

---

## Strengths

1. **The state machine is well-designed.** The five-state workflow with explicit valid transitions is the plugin's best structural feature. It's expressed clearly in both the skill (as reasoning guidance) and the update command (as validation logic), and the two are consistent with each other.

2. **Triage reasoning is thoughtful.** The four categories of tasks needing attention (overdue, stale, stuck, forgotten) with specific day thresholds and decision trees give the triage workflow genuine intelligence rather than just listing old tasks.

3. **forge-lib delegation is clean and consistent.** Like Forge Memory, every component cleanly separates reasoning from execution with explicit JSON response checking.

4. **The plugin is appropriately scoped.** At only 4 components and ~484 total lines, it does one thing (task management) and does it without bloat. This is the leanest plugin in the Forge ecosystem.

## Critical Gaps

1. **Cross-plugin handoff awareness is the biggest gap.** The CLAUDE.md workspace instructions explicitly describe Slack Forge → Tasks Forge promotion as a core workflow, but neither the skill nor any command mentions Slack Forge. Similarly, there's no connection to Product Forge cards (stories as tasks), Forge Memory context (task-related people/projects), or Report Forge (completed tasks informing reports). For a plugin that sits at the center of the "do the work" layer, this isolation is a significant architectural miss.

2. **No reference files anywhere.** Triage thresholds and decision logic appear in both the task-management skill and the update command. A shared reference would ensure consistency and reduce duplication.

3. **Output specifications are weak in the skill.** The task-management skill provides reasoning guidance but doesn't specify how recommendations, task lists, or triage results should be formatted for the user. The commands compensate with their own templates, but the skill itself — which should set the standard — leaves formatting unspecified.

4. **Add command lacks pre-create confirmation.** Same pattern as Forge Memory's remember command: gathers fields interactively but doesn't show a preview before persisting.

5. **Description triggering needs improvement.** The task-management skill description is functional but wouldn't trigger on conversational prompts like "what's on my plate?", "I finished that API review," or "can you triage my tasks?" These are the natural ways users interact with task systems.

## Triage Recommendation

**Full eval candidates (2):**

- **task-management** — The triage reasoning (overdue/stale/stuck/forgotten decision trees) and workflow prompt patterns ("what should I work on?", "I'm working on X", "X is done", "X is blocked") make behavioral claims about how the skill guides task management decisions. Does the priority guidance actually produce useful recommendations when applied to a realistic task list? Does the triage logic correctly categorize edge cases (e.g., a task that's both overdue AND blocked)? Do the natural language workflow prompts match correctly to task lookup and status updates? These are testable behavioral questions.

- **update (triage mode)** — The triage mode is the most complex interactive workflow in the plugin. It queries multiple task statuses, applies threshold-based flagging, presents interactive action menus, and produces summary reports. Testing whether this flow produces correct, useful triage sessions with realistic task data would validate both the command's implementation and the task-management skill's reasoning guidance simultaneously.

**Description optimization candidates (1):**
- **task-management** — would benefit from the Skill Creator's description optimization loop to capture conversational triggers like "what should I work on?" and "triage my tasks."

**Direct improvement candidates (edit without full eval):**
- Add cross-plugin handoff awareness to task-management skill (Slack Forge as source, Product Forge for card linking, Report Forge as consumer)
- Extract shared `references/triage-thresholds.md` with day-count logic and decision trees
- Add pre-create confirmation gate to add command
- Improve update command description to mention triage mode
