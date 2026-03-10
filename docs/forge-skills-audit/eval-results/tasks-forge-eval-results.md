# Tasks Forge — Eval Results

**Date:** 2026-03-09
**Evaluator:** tasks-eval agent
**Eval Candidates:** task-management (skill), update/triage mode (command)
**Contracts Tested:** 1, 4, 5, 6, IF4

---

## Summary

| Component | Isolation Score | Ecosystem Score | Overall |
|-----------|----------------|-----------------|---------|
| task-management (skill) | 5/6 PASS | 0/5 PASS | 5/11 (45%) |
| update (triage mode) | 3/4 PASS | 0/2 PASS | 3/6 (50%) |
| **Combined** | **8/10 PASS** | **0/7 PASS** | **8/17 (47%)** |

**Headline finding:** Tasks Forge is strong in isolation (80% pass rate on core behavior) but has zero ecosystem awareness. Every single ecosystem test case fails. The plugin operates in complete isolation from the Forge ecosystem despite sitting at the center of multiple explicit CLAUDE.md contracts.

---

## Isolation Test Results — task-management

### isolation-task-mgmt-001: Priority ordering for "what should I work on?" — PASS

**Evidence:** SKILL.md lines 132-136:
> 1. Show priority 1-2 Open tasks first
> 2. Show priority 3 Open tasks
> 3. Highlight anything overdue
> 4. Suggest unblocking Blocked tasks if possible

The workflow prompts section provides explicit ordering guidance. An LLM following these instructions would correctly surface priority 1-2 tasks first and exclude Completed tasks (they wouldn't appear in the Open task query).

**Grade:** PASS

---

### isolation-task-mgmt-002: Invalid transition rejection (Open → Completed) — PASS

**Evidence:** SKILL.md lines 21-25, Valid Transitions section:
> - **Open** → In Progress (starting work), Cancelled (no longer needed)

Open → Completed is not listed as a valid transition. The skill provides an explicit state machine that an LLM would consult. The update command (line 33-38) mirrors this with the same valid transitions and says: "If transition is invalid, warn the user and suggest valid transitions."

**Grade:** PASS

---

### isolation-task-mgmt-003: Dual-category triage (overdue AND blocked) — PASS (with caveat)

**Evidence:** SKILL.md lines 64-84, Triage Reasoning section lists four independent categories:
> **Overdue Tasks (past due_date):** [decision tree]
> **Stuck Tasks (Blocked 14+ days):** [decision tree]

Both categories have independent detection criteria. A task with status Blocked, due_date in the past, and 20 days in Blocked state qualifies for both. The skill provides separate decision trees for each, and there's no instruction to stop after the first match.

**Caveat:** The skill doesn't explicitly address multi-category tasks. An LLM would likely surface both concerns, but the priority/ordering of which triage reasoning to apply first is undefined.

**Grade:** PASS (minor gap — no multi-category guidance)

---

### isolation-task-mgmt-004: Natural language "X is done" mapping — PASS

**Evidence:** SKILL.md lines 143-146:
> **When user says "X is done":**
> - Find the task by title
> - Update status to Completed
> - Confirm transition

Combined with the fuzzy matching logic (lines 116-119):
> - Compare task titles case-insensitively
> - Allow minor wording differences ("Review API" ≈ "API Review")
> - Match if 80%+ words overlap

"The API review is done" would match "Review API spec" via the fuzzy matching rules. In Progress → Completed is a valid transition.

**Grade:** PASS

---

### isolation-task-mgmt-005: Vague idea rejection — PASS

**Evidence:** SKILL.md lines 96-98:
> **When NOT to create a task:**
> - Vague ideas without clear action ("think about X")

The prompt "I should probably think about reorganizing the codebase someday" matches the "think about X" anti-pattern. The skill provides clear guidance to avoid creating tasks for vague ideas.

**Grade:** PASS

---

### isolation-task-mgmt-006: Blocked task prompts for blocker description — FAIL (minor)

**Evidence:** SKILL.md lines 149-151:
> **When user says "X is blocked":**
> - Find the task by title
> - Update status to Blocked
> - Prompt for blocker description (add to task notes)

The instruction says "prompt for blocker description" — this is present and correct. However, the skill doesn't specify HOW to add the blocker to task notes. The forge-lib command would be `forge task update task-003 --data '{"status": "Blocked", "notes": "..."}'` but the skill doesn't specify the field name or command format. This is a minor gap since the skill says "This skill provides reasoning only, not implementation details" (line 158), but the gap between "prompt for blocker description" and actually persisting it is under-specified.

**Grade:** FAIL (minor — blocker persistence mechanism undefined in skill)

---

## Isolation Test Results — update (triage mode)

### isolation-triage-001: Multi-status query and flagging — PASS

**Evidence:** update.md lines 65-80:
> ```bash
> forge task query --status Open
> # Repeat with --status "In Progress" or --status Blocked
> ```
> Flag tasks that:
> - Have `due_date` in the past (overdue)
> - Have been "Open" for 30+ days (stale)
> - Have been "Blocked" for 14+ days (stuck)
> - Are "In Progress" but not updated in 7+ days (forgotten)

All four flag categories are explicit with clear thresholds. The query instructions cover Open, In Progress, and Blocked statuses. The 5-option action menu is defined at lines 84-98.

**Grade:** PASS

---

### isolation-triage-002: Stale detection 30-day threshold — PASS

**Evidence:** update.md line 79:
> - Have been "Open" for 30+ days (stale)

The threshold is explicit: 30+ days. A 25-day task would not be flagged; a 35-day task would. This matches the task-management skill's threshold (SKILL.md line 69: "Stale Tasks (Open 30+ days)").

**Grade:** PASS

---

### isolation-triage-003: Summary report accuracy — PASS

**Evidence:** update.md lines 112-119:
> ```
> Triage complete:
> - 2 tasks marked completed
> - 1 task rescheduled
> - 3 tasks updated
> - X tasks now need attention
> ```

The template provides a clear summary format with per-action counts. An LLM following this template would produce accurate counts.

**Grade:** PASS

---

### isolation-triage-004: Transition validation in triage — FAIL

**Evidence:** update.md lines 100-107 define the action menu:
> - **Completed**: `forge task update task-012 --data '{"status": "Completed"}'`

The command provides the forge-lib call directly without checking whether the transition is valid for the current status. Lines 33-38 define valid transitions and line 40 says "If transition is invalid, warn the user and suggest valid transitions" — but this is under "Mode 1: Update Specific Task," not under Mode 2 (Triage).

The triage mode action application (lines 100-107) does not reference the transition validation logic. An LLM following triage mode strictly would attempt Blocked → Completed without validating. The cross-reference to "Status transitions follow the workflow defined in task-management skill" (line 141) is a Notes section hint, but it's not integrated into the triage action flow.

**Grade:** FAIL — Triage mode bypasses transition validation that Mode 1 enforces. A Blocked task offered "Mark completed" would attempt an invalid transition.

---

## Ecosystem Test Results — task-management

### ecosystem-task-mgmt-c1-001: Slack Forge awareness during task listing — FAIL (Level 0)

**Contract:** 1 (Slack Forge → Tasks Forge harvest promotion)

**Evidence:** The entire SKILL.md (159 lines) contains zero mentions of:
- "Slack" (0 occurrences)
- "harvest" (0 occurrences)
- "promote" / "promotion" (0 occurrences)
- "source" as a task origin field (0 occurrences)
- Any upstream plugin by name (0 occurrences)

The skill has no awareness that tasks can originate from Slack Forge harvest promotion. When listing tasks, there is no guidance to surface provenance metadata.

**Grade:** FAIL — Level 0 (below Awareness). Contract 1 is architecturally absent from the Tasks Forge side.

---

### ecosystem-task-mgmt-c1-002: Slack Forge suggested for Slack-sourced tasks — FAIL (Level 0)

**Contract:** 1

**Evidence:** Same as above. The task creation reasoning section (lines 87-105) lists "Action item identified in meeting notes, emails, or chat" as a valid trigger but never mentions `/slack-forge:scan` or `/slack-forge:capture` as the systematic alternative to manual entry for Slack-sourced tasks.

**Grade:** FAIL — Level 0. No Slack Forge command reference anywhere.

---

### ecosystem-task-mgmt-c4-001: Cognitive Forge debate outcomes for reprioritization — FAIL (Level 0)

**Contract:** 4 (Cognitive Forge debate outcomes → task priorities)

**Evidence:** The SKILL.md contains zero mentions of:
- "Cognitive" (0 occurrences)
- "debate" (0 occurrences)
- "session" as a Cognitive Forge artifact (0 occurrences)
- "explore" (0 occurrences)

The priority guidelines (lines 36-58) provide static criteria (urgency, deadlines, business impact) but never reference decision records or debate outcomes as inputs to prioritization.

**Grade:** FAIL — Level 0. Contract 4 is architecturally absent from the Tasks Forge side.

---

### ecosystem-task-mgmt-c5-001: Proactive handoff to Product Forge after task creation — FAIL (Level 0)

**Contract:** 5 (Proactive Handoff Suggestions)

**Evidence:** The SKILL.md contains zero mentions of:
- "Product Forge" (0 occurrences)
- "card" as a Product Forge artifact (0 occurrences)
- "link" in the context of cross-plugin relationships (0 occurrences)
- Any `/product-forge:*` command (0 occurrences)

After task creation guidance, the skill does not suggest linking tasks to Product Forge cards.

**Grade:** FAIL — Level 0. No proactive handoff to any downstream plugin.

---

### ecosystem-task-mgmt-c6-001: Memory-first resolution for shorthand — FAIL (Level 0)

**Contract:** 6 (Memory-First Resolution behavioral directive)

**Evidence:** The SKILL.md contains zero mentions of:
- "Memory" or "Forge Memory" (0 occurrences)
- "taxonomy" (0 occurrences)
- "recall" or "remember" (0 occurrences)
- "acronym" or "shorthand" (0 occurrences)
- Any `/forge-memory:*` command (0 occurrences)

The CLAUDE.md workspace directive says "Always check Forge Memory first when the user uses shorthand, acronyms, or names you don't recognize." The task-management skill has no implementation of this directive.

**Grade:** FAIL — Level 0. The behavioral directive is completely unimplemented.

---

## Ecosystem Test Results — update (triage mode)

### ecosystem-triage-c5-001: Post-triage Report Forge suggestion — FAIL (Level 0)

**Contract:** 5 (Proactive Handoff) + Implied Flow 4

**Evidence:** The update.md triage summary template (lines 112-119) contains only action counts:
> ```
> Triage complete:
> - 2 tasks marked completed
> - 1 task rescheduled
> - 3 tasks updated
> - X tasks now need attention
> ```

No mention of Report Forge, `/report-forge:generate`, or any downstream suggestion. The entire update.md (146 lines) contains zero mentions of "Report", "report", or any plugin name other than "task-management" (line 141 reference to the skill).

**Grade:** FAIL — Level 0. No post-triage handoff suggestion.

---

### ecosystem-triage-if4-001: Systemic blocker escalation via Report Forge — FAIL (Level 0)

**Contract:** Implied Flow 4

**Evidence:** Same as above. The triage mode has no logic for detecting systemic patterns (e.g., multiple tasks blocked by the same dependency) and no suggestion to escalate via Report Forge. The triage processes tasks individually without cross-task pattern analysis.

**Grade:** FAIL — Level 0. Implied Flow 4 is completely unimplemented.

---

## Ecosystem Contract Compliance Summary

| Contract | Level | Evidence |
|----------|-------|----------|
| **Contract 1** (Slack → Tasks) | **Level 0 — Absent** | Zero mentions of Slack Forge in any component. The CLAUDE.md-defined harvest promotion flow is architecturally missing from the receiving side. |
| **Contract 4** (Cognitive → Tasks) | **Level 0 — Absent** | Zero mentions of Cognitive Forge. Priority guidance uses only static criteria, not decision records. |
| **Contract 5** (Proactive Handoff) | **Level 0 — Absent** | No component suggests any downstream plugin after completing its action. The add command's confirmation says only "Your task is now tracked in tasks/" with no handoff. The triage summary is a dead end. |
| **Contract 6** (Memory-First) | **Level 0 — Absent** | Zero mentions of Forge Memory. The CLAUDE.md behavioral directive to check memory for shorthand/acronyms is completely unimplemented. |
| **IF4** (Tasks → Reports) | **Level 0 — Absent** | Triage produces per-task actions and summary counts but never suggests Report Forge for status reporting, even when systemic issues are present. |

**Overall Ecosystem Grade: Level 0 across all 5 contracts.** Tasks Forge is the most ecosystem-isolated plugin in the Forge marketplace.

---

## Teammate Collaboration Findings

### From memory-eval (Contract 6)
memory-eval asked whether Tasks Forge queries Forge Memory taxonomy when creating tasks. Confirmed: **zero Forge Memory awareness**. The add command gathers fields and calls `forge task create` with no taxonomy lookup. memory-eval's org-context skill claims Tasks Forge is a taxonomy consumer (org-context SKILL.md line 122: "Tasks Forge: Related product/module for tasks") — this claim is aspirational. Tasks Forge has no mechanism to consume taxonomy. **Contract 6 is broken bilaterally** — Forge Memory claims Tasks Forge is a consumer, but Tasks Forge never queries Forge Memory.

### From cognitive-eval (Contract 4)
cognitive-eval asked about task schema compatibility for debate action items. Investigation of `forge-lib/schemas/task.json` revealed: (a) no `source` or `provenance` field exists, (b) `additionalProperties: false` blocks adding custom fields, (c) the `external_id`/`external_link` fields referenced in SKILL.md are NOT in the schema (dead code). **Contract 4 Context Passing (Level 3) is structurally blocked** — even if Cognitive Forge perfectly structured its action items, Tasks Forge has no field to record session provenance. The closest workaround is the `tags` array (e.g., tag "cognitive-forge") but this is undocumented.

### From product-eval (Contract 5)
product-eval asked whether Tasks Forge can link tasks to Product Forge story cards. Discovery: the task schema HAS a `parent` field (`"Parent task or story filename (without extension)"`) that could reference Product Forge stories. **However, neither the task-management skill nor the add command mentions this field.** The add command only gathers title, description, priority, and due_date — `parent` is never exposed. This is the inverse of the `external_id` gap: here the schema supports it but the skill doesn't document it. **Contract 5 is broken at Level 0 on both sides** (Product Forge create doesn't suggest `/tasks-forge:add`, Tasks Forge doesn't mention Product Forge), but Level 3 Context Passing is achievable without schema changes since the `parent` field already exists.

### From report-eval (Implied Flow 4)
report-eval asked about triage summary format and Report Forge awareness. Confirmed: triage output is conversational text (action counts only), not structured data. The summary template is:
```
Triage complete:
- 2 tasks marked completed
- 1 task rescheduled
- 3 tasks updated
- X tasks now need attention
```
No pattern analysis, no structured findings, no Report Forge suggestion. **IF4 is broken at Level 0 on the Tasks Forge side.** The underlying forge-lib queries return structured JSON that could feed into reports, but the triage mode processes it interactively and discards the structure in the summary. Three changes needed: (1) pattern detection logic, (2) conditional Report Forge suggestion, (3) structured findings output.

report-eval confirmed IF4 is **bilateral Level 0**. Key details from the Report Forge side: (a) `quarterly-review` and `executive-summary` report types are natural semantic fits for triage data, (b) the generate command has NO structured task data input — the Investigator would need to scan `tasks/` itself, (c) the Investigator has no task-aware investigation strategy (its metric collection focuses on git metrics and code features, not task status counts), (d) the best available flow would be a topic-string hint like `/report-forge:generate --type quarterly-review "Q1 Task Status"` and hope the Investigator picks up the context. Four changes needed across both plugins to enable IF4.

### From slack-eval (Contract 1)
slack-eval shared the exact promote command schema. The promote command calls `forge task create` directly (batch operation, not user-interactive). Slack provenance is embedded in the description field as text prefix ("Harvested from #channel by @author on date") — no structured `source` field. Tags from the harvest pass through but no automatic `slack-harvest` tag is added. **Asymmetric handoff: Slack Forge implements Contract 1 at Level 3 (Context Passing) on its side, but Tasks Forge is Level 0 (Absent).** Additionally, a **priority type mismatch bug** was discovered: promote passes priority as strings ("High"/"Medium"/"Low") but the task schema requires integers (1-5). This would cause runtime validation failure on every promoted task. See "Cross-Plugin Interoperability Bug" section below.

---

## Isolation Findings Detail

### Strength: State Machine Design
The five-state workflow with explicit valid transitions is consistent between the task-management skill and the update command. Both enumerate the same transitions. This is the plugin's strongest structural feature and would reliably prevent invalid status changes in Mode 1 (specific update).

### Weakness: Triage Mode Transition Bypass
The triage mode's action menu offers "Mark completed" for any flagged task regardless of current status, but doesn't integrate the transition validation logic from Mode 1. A Blocked task offered "Mark completed" would attempt Blocked → Completed, which is invalid. The cross-reference in the Notes section ("Status transitions follow the workflow defined in task-management skill") is insufficient — it should be integrated into the triage action flow with per-status action filtering.

### Weakness: Skill Output Specifications
The task-management skill provides reasoning guidance but never specifies output formats. How should a task list be presented? How should triage recommendations be formatted? The commands define their own templates, but the skill (which should set the standard) leaves this unspecified.

### Minor Gap: Blocker Description Persistence
The skill says "prompt for blocker description (add to task notes)" but doesn't specify the field name or forge-lib command parameter for persisting the blocker text. This is a small gap bridgeable by an LLM familiar with forge-lib, but it's technically under-specified.

---

## Schema-Skill Inconsistency (discovered during teammate collaboration)

During collaboration with cognitive-eval on Contract 4, I checked the actual forge-lib task schema (`forge-lib/schemas/task.json`) and discovered an inconsistency:

- **The task-management skill references `external_id` and `external_link` fields** (SKILL.md lines 110-111: "Use `external_id` and `external_link` to maintain connection")
- **The task JSON schema sets `additionalProperties: false`** and does NOT include `external_id` or `external_link` as valid properties
- **This means any task creation or update that includes these fields would be rejected by forge-lib validation**

The External System Integration section of the skill (lines 107-119) is effectively dead code — the schema prevents the fields it describes from being stored.

Additionally, there is no `source` or `provenance` field in the schema, which means:
- Tasks promoted from Slack Forge (Contract 1) cannot record their origin
- Tasks created from Cognitive Forge action items (Contract 4) cannot reference the session
- Cross-plugin provenance tracking is structurally impossible without a schema change

**Impact:** This doesn't just affect ecosystem awareness in the skill text — it's a forge-lib schema limitation that blocks provenance tracking at the data layer.

---

## Cross-Plugin Interoperability Bug (discovered during slack-eval collaboration)

slack-eval shared the exact `forge task create` call used by Slack Forge's promote command for Contract 1. The promote command passes priority as **string values** ("High", "Medium", "Low"):

```bash
forge task create "{title}" --data '{"priority": "High", "status": "Open", ...}'
```

The task schema requires priority as an **integer** (1-5):

```json
"priority": {"type": "integer", "minimum": 1, "maximum": 5}
```

**This is a runtime bug:** every task promoted from Slack Forge would fail JSON Schema validation. `"High"` is a string, not an integer. forge-lib would return `{"success": false, "error": "Validation failed: ..."}` and no task would be created.

**Correct mapping should be:**
- high confidence → `"priority": 2`
- medium confidence → `"priority": 3`
- low confidence → `"priority": 4`

**Classification:** This is not a skill instruction gap — it's a data contract mismatch between two plugins that would cause silent failure at runtime. Both slack-eval and tasks-eval have flagged this for their respective eval results.

---

## Recommended Improvements

### Priority 1: Add Cross-Plugin Handoff Awareness (all 5 contracts)
Add a new section to SKILL.md: "## Ecosystem Connections"

Minimum content:
```markdown
## Ecosystem Connections

**Task Sources:**
- Manual creation via `/tasks-forge:add`
- Slack Forge harvest promotion (`/slack-forge:promote` creates tasks from Slack discussions)
- Cognitive Forge action items (debate/explore sessions may produce tasks)

**Downstream Consumers:**
- Report Forge: triage outcomes and task status data inform status reports (`/report-forge:generate`)
- Product Forge: tasks can be linked to product cards for implementation tracking

**Memory-First Resolution:**
When task descriptions contain shorthand, acronyms, or informal names, check Forge Memory
first (`/forge-memory:recall`) to resolve to canonical names before creating or updating tasks.

**Post-Action Suggestions:**
- After task creation: "If this relates to a Product Forge story, you can link them."
- After triage: "Consider generating a status report with `/report-forge:generate` to share outcomes."
- When user mentions Slack as source: "You can systematically harvest tasks from Slack with `/slack-forge:scan`."
```

### Priority 2: Integrate Transition Validation into Triage Mode
In update.md Mode 2, filter the action menu based on valid transitions for the task's current status. A Blocked task should not be offered "Mark completed" directly.

### Priority 3: Add Output Format Templates to Skill
Add a "## Output Formats" section to SKILL.md specifying how task lists, triage recommendations, and status confirmations should be formatted.

### Priority 4: Extract Shared Reference File
Create `tasks-forge/skills/task-management/references/triage-thresholds.md` containing the day-count thresholds and decision trees, referenced by both the skill and the update command.

### Priority 5: Improve Description Triggering
Update the task-management skill description to capture conversational triggers:
```yaml
description: >
  Task management workflow guidance for status transitions, priority assignment,
  and triage reasoning. Use when helping users manage task lifecycles, decide
  what to work on next, track progress, or review overdue and blocked work —
  even if they don't explicitly say "task" (e.g., "what's on my plate?",
  "I finished the API review", "triage my work", "I'm blocked on X").
```

---

## Appendix: Test Case Cross-Reference

| Test Case ID | Component | Category | Result |
|-------------|-----------|----------|--------|
| isolation-task-mgmt-001 | task-management | isolation | PASS |
| isolation-task-mgmt-002 | task-management | isolation | PASS |
| isolation-task-mgmt-003 | task-management | isolation | PASS (minor caveat) |
| isolation-task-mgmt-004 | task-management | isolation | PASS |
| isolation-task-mgmt-005 | task-management | isolation | PASS |
| isolation-task-mgmt-006 | task-management | isolation | FAIL (minor) |
| isolation-triage-001 | update (triage) | isolation | PASS |
| isolation-triage-002 | update (triage) | isolation | PASS |
| isolation-triage-003 | update (triage) | isolation | PASS |
| isolation-triage-004 | update (triage) | isolation | FAIL |
| ecosystem-task-mgmt-c1-001 | task-management | ecosystem | FAIL (Level 0) |
| ecosystem-task-mgmt-c1-002 | task-management | ecosystem | FAIL (Level 0) |
| ecosystem-task-mgmt-c4-001 | task-management | ecosystem | FAIL (Level 0) |
| ecosystem-task-mgmt-c5-001 | task-management | ecosystem | FAIL (Level 0) |
| ecosystem-task-mgmt-c6-001 | task-management | ecosystem | FAIL (Level 0) |
| ecosystem-triage-c5-001 | update (triage) | ecosystem | FAIL (Level 0) |
| ecosystem-triage-if4-001 | update (triage) | ecosystem | FAIL (Level 0) |
