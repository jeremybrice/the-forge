# Slack Forge Eval Results

**Evaluator:** slack-eval agent
**Date:** 2026-03-09
**Plugin:** slack-forge
**Eval Candidates:** task-harvester (skill+agent), knowledge-harvester (skill+agent), jira-digest (skill+agent), scan command, promote command
**Contracts:** 1, 5, 6, IF2

---

## Executive Summary

Slack Forge's harvester skills/agents have **strong isolation behavior** — well-defined extraction rules, quality requirements with good/bad examples, and complete provenance tracking. However, the plugin has **critical cross-plugin failures** at multiple levels:

1. **Runtime bug (BLOCKING):** The promote command passes task priority as strings ("High"/"Medium"/"Low") but the task schema requires integers (1-5). Every task promotion would fail JSON Schema validation. Discovered via tasks-eval collaboration.
2. **Contract 6 violation:** No harvester checks Forge Memory for term resolution — zero references to memory/taxonomy/canonical in any skill or agent file.
3. **IF2 broken bilaterally:** Knowledge harvester has zero Cognitive Forge awareness. Confirmed absent on both sides via cognitive-eval collaboration.
4. **Knowledge promotion uncertain:** `general` type has no Forge Memory target; `source`/`harvested_on` provenance fields may be silently dropped. Discovered via memory-eval collaboration.

**Overall Isolation Score:** 8.3/10 — Strong extraction rules and quality bars; promote command downgraded due to priority type bug.
**Overall Ecosystem Score:** 2.5/10 — Promote command was the strongest ecosystem component but has a blocking runtime bug; harvesters operate in total isolation.

---

## Per-Component Eval Results

### 1. Task Harvester (Skill + Agent)

**Files evaluated:**
- `slack-forge/skills/task-harvester/SKILL.md` (62 lines)
- `slack-forge/agents/forge-task-harvester.md` (87 lines)

#### Isolation Score: 9/10

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-001 (explicit task extraction) | **PASS** | Skill defines "Direct requests" signal (`@name do X`), confidence=high for "explicit ask with owner/deadline", provenance requirements list all 4 fields. Agent specifies content must answer What/Who/Why/When with 2-3 sentence minimum. |
| isolation-002 (noise filtering) | **PASS** | Skill explicitly lists "Casual/social chat" and "Pure information-seeking questions" under Non-Tasks. Agent rule 4: "Skip social/noise content." |
| isolation-003 (confidence levels) | **PASS** | Three-level confidence system is well-defined: high=explicit+owner+deadline, medium=implied+weak assignment, low=speculative/unclear ownership. |
| isolation-004 (deduplication) | **PASS** | Skill: "Merge duplicate mentions of the same task across transcript files/windows when core action is identical." Agent rule 3: "Deduplicate repeated mentions of the same task." |
| isolation-005 (content quality) | **PASS** | Agent has extensive content quality section with good/bad examples, anti-patterns, and minimum bar (2-3 sentences, What/Who/Why/When). The example of good vs bad content is a genuine strength. |

**Strengths:**
- The content quality requirements with good/bad examples are the best in the Forge — they give concrete guidance that prevents low-quality extraction.
- The anti-patterns section ("Do NOT paste raw Slack message as content") addresses a real failure mode.
- Provenance requirements are complete and consistent between skill and agent.

**Gaps:**
- No guidance on handling ambiguous or overlapping tasks (e.g., a message that could be a task OR a decision).
- No explicit handling of thread context — the skill reads flat transcript text but Slack threads add conversational depth that could affect task identification.

#### Ecosystem Score: 2/10 (Awareness level only)

| Test Case | Result | Evidence |
|-----------|--------|----------|
| ecosystem-contract6-001 (Memory-First Resolution) | **FAIL** | Neither the task-harvester skill nor agent mentions Forge Memory, `forge memory`, taxonomy, acronym resolution, or any form of term lookup. The skill says "Preserve key nouns (project/system names)" in Title Rules but gives no guidance on resolving those nouns against canonical sources. **This is a Contract 6 violation.** |
| ecosystem-contract1-003 (promotion pathway mention) | **PARTIAL PASS** | The agent itself does NOT mention promotion or downstream plugins. However, the capture command that dispatches the agent does say "Run /slack-forge:review to approve or reject" — so the ecosystem awareness lives in the command layer, not the skill/agent layer. Graded at Awareness level. |

**Contract 6 Failure Evidence:**
> The task-harvester SKILL.md contains zero references to: Forge Memory, `forge memory`, taxonomy, acronym, shorthand, canonical, or resolution. The agent file similarly contains zero such references. When the transcript says "fix the CRM integration for Acme," the harvester will preserve "CRM" and "Acme" as-is without checking whether canonical expansions exist.

---

### 2. Knowledge Harvester (Skill + Agent)

**Files evaluated:**
- `slack-forge/skills/knowledge-harvester/SKILL.md` (66 lines)
- `slack-forge/agents/forge-knowledge-harvester.md` (88 lines)

#### Isolation Score: 8.5/10

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-knowledge-001 (decision extraction) | **PASS** | Skill lists "Decisions and rationale" as first knowledge signal. Confidence=high for "explicit decision/announcement." Agent requires content with summary paragraph + significance paragraph prefixed with `**Significance:** `. Good/bad examples provided. |
| isolation-knowledge-002 (ephemeral filtering) | **PASS** | Skill: "Filter Out: Ephemeral status chatter." Durability Test: "Keep items likely useful in 2+ weeks." Status updates would fail this test. |
| isolation-knowledge-003 (terminology capture) | **PASS** | Skill lists "Terminology/acronym definitions" as a knowledge signal. Tags must start with memory-hint destination tag — glossary for term definitions. |
| isolation-knowledge-004 (ownership changes) | **PASS** | Skill lists "Ownership/responsibility changes" as a knowledge signal. Tags should start with "person" memory-hint. Provenance requirements are complete. |

**Strengths:**
- The memory-hint tag system (person/project/glossary/general as first tag) is clever — it pre-classifies knowledge for the promote command's type inference. This is the knowledge harvester's strongest ecosystem contribution.
- The significance paragraph requirement ensures knowledge items have strategic context, not just facts.
- Good/bad content examples mirror the task harvester's quality approach.

**Gaps:**
- The durability test ("useful in 2+ weeks") is subjective — there's no concrete heuristic for edge cases.
- No guidance on handling knowledge that contradicts existing Forge Memory entries (e.g., a new ownership claim that conflicts with a stored entry).

#### Ecosystem Score: 2.5/10 (Awareness level)

| Test Case | Result | Evidence |
|-----------|--------|----------|
| ecosystem-contract6-002 (Memory-First Resolution) | **FAIL** | Neither the knowledge-harvester skill nor agent mentions Forge Memory lookup, taxonomy validation, or canonical name resolution. The skill mentions "Terminology/acronym definitions" as something to CAPTURE but never says to CHECK existing definitions first. **Contract 6 violation.** |
| ecosystem-IF2-001 (Complex discussion → debate) | **FAIL** | The knowledge-harvester skill has zero awareness of Cognitive Forge. It does not mention: unresolved discussions, debate, `/cognitive-forge:debate`, multi-perspective analysis, or any handoff to another plugin. It would capture the discussion as a knowledge item but would NOT flag it as needing structured debate. **Implied Flow 2 is not implemented.** |

**Contract 6 Failure Evidence:**
> The knowledge-harvester SKILL.md contains zero references to: Forge Memory, `forge memory`, recall, taxonomy, canonical, resolution, or any memory lookup mechanism. When processing a transcript that says "Todd is taking over the PSR process," the harvester will capture it without checking if "PSR" is already defined in Forge Memory or if "Todd" already has a person entry.

**IF2 Failure Evidence:**
> The knowledge-harvester SKILL.md lists these knowledge signals: "Decisions and rationale, Process or policy changes, Ownership/responsibility changes, Project milestone/scope updates, Terminology/acronym definitions, Durable architecture/technical context." None of these signals include "unresolved discussions" or "multi-perspective debates." There is no mention of Cognitive Forge, `/cognitive-forge:debate`, or any cross-plugin suggestion mechanism anywhere in the skill or agent files.

---

### 3. JIRA Digest (Skill + Agent)

**Files evaluated:**
- `slack-forge/skills/jira-digest/SKILL.md` (75 lines)
- `slack-forge/agents/forge-jira-digest.md` (87 lines)

#### Isolation Score: 9/10

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-jira-001 (executive briefing structure) | **PASS** | Agent defines explicit 4-part content structure: (1) Items Needing Action, (2) Summary Stats, (3) Status Transitions grouped by outcome, (4) Key Tickets to Watch. Anti-patterns prohibit flat event listing and "Untitled" titles. Title format is specified: `"JIRA Digest — {date} ({timeframe})"`. |
| isolation-jira-002 (needs_action flags) | **PASS** | Skill defines actionability rules: needs_action=true for "direct assignment to user/team, explicit mentions/review requests, blockers requiring intervention." Default informational events to false. |

**Strengths:**
- The 4-part digest structure is the most prescriptive output format in the Forge — it leaves little room for quality variance.
- Anti-patterns are specifically targeted at known failure modes ("Do NOT list every event flat", "Do NOT put jira_events in frontmatter").
- The confidence system for JIRA events (high=clear ticket reference, medium=partial parse, low=ambiguous) is well-calibrated.

**Gaps:**
- No ecosystem awareness at all — the JIRA digest operates entirely in isolation. It doesn't suggest that actionable JIRA items could become Tasks Forge tasks, or that project-level insights could enrich Forge Memory.
- The promote command treats JIRA digests as "informational only" — they are marked promoted without creating any downstream entities. This may be correct for most digests, but high-priority action items could arguably promote to tasks.

#### Ecosystem Score: 1/10 (Missing)

The JIRA digest skill and agent contain zero references to any other Forge plugin. The promote command marks them as "informational" with no downstream entity creation. While this is architecturally defensible (digests are summaries, not atomic items), it means JIRA events that surface actionable items have no pathway to Tasks Forge.

---

### 4. Scan Command

**File evaluated:** `slack-forge/commands/scan.md` (197 lines)

#### Isolation Score: 9/10

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-scan-001 (prerequisites + prompts) | **PASS** | Step 1 checks config via `forge harvest config --get`. Step 2 prompts for timeframe (4 options). Step 3 prompts for execution mode (3 options). Step 4 presents scan brief with confirmation gate. Well-structured human-in-the-loop flow. |
| isolation-scan-002 (transcript format) | **PASS** | Comprehensive transcript format contract defined with YAML frontmatter (scan_date, timeframe, scan_run, generated), channel headers with IDs (`## #name (ID)`), and message format (`[timestamp] @author: content`). Sub-agent extraction rules are documented inline. |
| isolation-scan-003 (auto-capture chaining) | **PASS** | Mode 3 (`scan_and_auto_capture`) explicitly states: "Invoke `/slack-forge:capture` immediately after scan summary." Mode 2 prompts first. Mode 1 ends with suggestion. |

**Strengths:**
- The transcript format contract is the most important specification in Slack Forge — it's the data contract between the scan command (producer) and all three harvester agents (consumers). It is well-specified with exact field extraction rules.
- JIRA transcript cleanup pipeline (raw → temp → clean → write) is a practical optimization.
- Sequential filename resolution via `forge transcript filename` prevents overwrite collisions.

**Gaps:**
- The transcript format is documented INLINE in the scan command rather than in a shared reference file. This means the harvester agents must trust that the scan command follows this contract — there's no single source of truth both sides can reference.
- No mention of Forge Memory context enrichment during scan (Contract 6 would apply if the scan command processed entity names, but since it's raw transcript capture, this is less critical).

#### Ecosystem Score: 3/10 (Awareness level)

The scan command's ecosystem awareness is limited to chaining to `/slack-forge:capture`. It mentions no plugins outside the Slack Forge pipeline. This is partially defensible since scan is a data collection step, not an analysis step — ecosystem awareness is more appropriate at the capture/promote layers.

---

### 5. Promote Command

**File evaluated:** `slack-forge/commands/promote.md` (153 lines)

#### Isolation Score: 6/10 (downgraded from 8.5 — priority type mismatch is a blocking bug)

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-promote-001 (task schema mapping) | **FAIL — RUNTIME BUG** | The promote command maps confidence to priority as STRINGS: high→"High", medium→"Medium", low→"Low". However, tasks-eval confirmed the task schema requires priority as an **integer (1-5)**, not a string. Passing `"priority": "High"` would fail JSON Schema validation (`additionalProperties: false`). **Every promoted task would be rejected by forge-lib at runtime.** Correct mapping should be: high→1 or 2, medium→3, low→4 or 5. |
| isolation-promote-002 (knowledge schema mapping) | **PASS** | Type inference from tags/content (person/project/glossary). Uses `forge memory create-knowledge {type} "{name}"` with source and harvested_on metadata. Memory-hint tag system from knowledge-harvester maps directly to promote's type inference. |
| isolation-promote-003 (empty queue) | **PASS** | Explicit handling: "No approved harvest records found" with suggestions for /slack-forge:review and /slack-forge:scan. |

**Strengths:**
- The memory-hint→knowledge-type inference chain (harvester tags → promote type selection) is a well-designed handoff.
- Error handling is thorough: checks success field, skips on failure, reports errors, marks promoted on success.
- The promote command is the only Slack Forge component with explicit cross-plugin integration.

**Gaps:**
- **CRITICAL: Priority type mismatch.** The promote command passes priority as strings ("High"/"Medium"/"Low") but the task schema requires integers (1-5). This is a runtime bug that would cause every task promotion to fail JSON Schema validation. Discovered during collaboration with tasks-eval.
- The promote summary provides `forge task query` and `forge memory query-knowledge` commands for viewing results, but does NOT suggest next steps in the broader Forge workflow (e.g., "You can now triage these tasks with `/tasks-forge:start`" or "These knowledge entries are now available for Product Forge card enrichment").
- JIRA digests are marked promoted but create no downstream entities — there's no option to selectively promote actionable JIRA items as tasks.
- The task schema has `additionalProperties: false`, so there's no `source` field available — provenance can only live in the description text or tags array.

#### Ecosystem Score: 7/10 (Context Passing level)

| Test Case | Result | Evidence |
|-----------|--------|----------|
| ecosystem-contract1-001 (task schema) | **FAIL — Runtime Bug** | The promote command uses `forge task create` with the correct CLI structure, BUT passes priority as strings ("High"/"Medium"/"Low") instead of integers (1-5). This type mismatch would cause JSON Schema validation failure. The architecture is correct but the value encoding breaks at runtime. Discovered during tasks-eval collaboration. |
| ecosystem-contract1-002 (knowledge schema) | **PARTIAL PASS — Awareness** | The promote command uses `forge memory create-knowledge` with correct type inference for 3/4 types. However, `general` has no target type, and `source`/`harvested_on` provenance fields may be silently dropped by forge-lib. Downgraded from Context Passing after memory-eval collaboration. |
| ecosystem-contract5-002 (proactive handoff) | **PARTIAL PASS — Specificity** | The summary mentions "tasks created in tasks-forge" and "knowledge entries created in forge-memory" with query commands, but does NOT suggest broader Forge workflow next steps (e.g., `/tasks-forge:start` for triage). |

---

## Ecosystem Contract Compliance

### Contract 1: Slack Forge → Tasks Forge + Forge Memory (Harvest Promotion)

**Grade: Split — Task promotion BROKEN (runtime bug), Knowledge promotion at Awareness (Level 1)**

**Task promotion (BROKEN — downgraded after tasks-eval collaboration):** The promote command passes priority as strings ("High"/"Medium"/"Low") but the task schema requires integers (1-5). This type mismatch would cause JSON Schema validation failure on every promoted task. The data flow is architecturally correct (right CLI, right fields) but the value encoding is wrong. This is a **blocking runtime bug**, not just a skill instruction gap. Additionally, provenance is embedded as unstructured text in the description (see recommendation #3).

**Knowledge promotion (Level 1 — downgraded after memory-eval collaboration):** The promote command calls `forge memory create-knowledge` with the correct type for 3 of 4 memory-hint tags (person/project/glossary). However:
- The `general` memory-hint tag has no corresponding Forge Memory type — promote defaults to `project`, but this is undocumented.
- The `source` and `harvested_on` fields passed in `--data` are NOT among Forge Memory's documented fields per type. Whether forge-lib preserves or silently drops these is unknown — provenance may be lost at the contract boundary.
- Forge Memory's skills assume interactive knowledge creation (user→Claude→store), not programmatic injection from plugin promotion. There is no "receive promoted entry" pathway in the memory-management skill.

**Gap (both sides):** The contract works by accident (shared forge-lib CLI) not by design (neither receiving plugin has skill-level awareness of Slack Forge as a source). Tasks Forge has zero Slack Forge awareness. Forge Memory has zero Slack Forge awareness.

### Contract 5: Proactive Handoff Suggestions

**Grade: Specificity (Level 2) — at the command layer**

The command chain (capture → review → promote) includes specific command suggestions at each step:
- Capture says: "Run /slack-forge:review to approve or reject"
- Review says: "Run /slack-forge:promote to push to tasks-forge and forge-memory"
- Promote provides query commands for viewing results

**Gap:** Handoff suggestions stay within the Slack Forge pipeline. The promote command's summary does not suggest broader Forge workflow steps like task triage or knowledge enrichment.

### Contract 6: Memory-First Resolution

**Grade: Missing (Level 0)**

**This is the most significant ecosystem failure.** Neither the task-harvester, knowledge-harvester, nor jira-digest skill/agent references Forge Memory for term resolution. The CLAUDE.md workspace instruction explicitly states: "Always check Forge Memory first when the user uses shorthand, acronyms, or names you don't recognize." The harvesters process transcripts full of shorthand, acronyms, and informal names — exactly the context where memory-first resolution should fire.

**Evidence:** Zero occurrences of "forge memory", "taxonomy", "canonical", "recall", "acronym resolution", or "shorthand" in any of the three skill files or three agent files.

### Implied Flow 2: Slack Forge → Cognitive Forge (Complex Discussions → Debate)

**Grade: Missing (Level 0)**

The knowledge-harvester has zero awareness of Cognitive Forge. It captures knowledge signals including "Decisions and rationale" but does not distinguish between resolved decisions (which should be captured) and unresolved multi-perspective discussions (which should be flagged for `/cognitive-forge:debate`). There is no detection heuristic for "no clear consensus" and no suggestion mechanism.

---

## Findings from Teammate Collaboration

### tasks-eval (Contract 1)
- Shared exact `forge task create` schema used by promote command.
- **CRITICAL FINDING — Priority type mismatch:** tasks-eval revealed the task schema requires priority as an integer (1-5), not a string. The promote command passes "High"/"Medium"/"Low" strings, which would fail JSON Schema validation. **Every task promotion is broken at runtime.** Added as recommendation #1 (highest priority).
- **Confirmed:** Tasks Forge has zero awareness of Slack Forge as a task source (Level 0). Contract 1 is one-sided.
- **Additional finding:** Slack provenance is embedded as unstructured text in the task description. The task schema has `additionalProperties: false`, so no custom `source` field is possible. Only option is tags array (recommend auto-adding `"slack-harvest"` tag). Added recommendation #4.
- **Additional finding:** No structured `source` field available in task schema — provenance can only live in description text or tags array.

### memory-eval (Contract 1 + Contract 6)
- Shared exact `forge memory create-knowledge` schema with type inference details and memory-hint tag mapping.
- **Confirmed:** 3 of 4 memory-hint types align — person, project, and glossary all have corresponding `forge memory create-knowledge` types. The `general` type is resolved on the Slack Forge side (promote defaults `general→project`) so all 4 types are accounted for, though this fallback is undocumented.
- **Provenance uncertain at storage, LOST at recall:** Forge Memory's remember command documents specific `--data` fields per type (role/team/context for person, description/status/people for project, definition/context for glossary). The promote command's `source` and `harvested_on` fields are NOT among these documented fields. Whether forge-lib preserves or drops them is a forge-lib implementation question. **Even if provenance survives storage, memory-eval confirmed the recall flow never surfaces metadata like source or harvested_on.** A Slack-promoted entry looks identical to a manually created one when recalled. Provenance is lost at the recall layer regardless.
- **Skill awareness: Missing on both sides.** memory-management (198 lines), remember (129 lines), and recall (175 lines) contain zero mentions of Slack Forge. The learning loop assumes "ask user for definition → store" with no path for "receive promoted entry from another plugin."
- **Contract 6 bilateral gap confirmed:** Forge Memory doesn't advertise itself to Slack Forge as a resolution source (memory-eval's side), and Slack Forge harvesters don't query Forge Memory during extraction (my side).
- **Revised Contract 1 knowledge assessment:** The contract works by accident (shared forge-lib interface) not by design (neither side has skill-level awareness). Knowledge promotion pathway at Awareness level — provenance is lost at recall even if it survives storage.

### cognitive-eval (Implied Flow 2)
- **Confirmed bilateral broken handoff.** Cognitive Forge debate command has zero awareness of Slack Forge as an upstream source. cognitive-eval searched all 9 Cognitive Forge files — no mentions of Slack, harvest, discussion, channel, or upstream source.
- **IF2 bilateral status:** Slack Forge knowledge-harvester = Level 0, Cognitive Forge debate = Level 0.
- **Agreed fix scope:** Slack Forge side adds unresolved-discussion detection and `/cognitive-forge:debate` suggestion (~5-10 lines in knowledge-harvester). Cognitive Forge side adds upstream source acknowledgment to debate intake phase (~5-10 lines in debate.md). The Slack side fix is more impactful since it's the discovery point.

---

## Recommended Improvements

### Critical (Contract violations)

1. **FIX PRIORITY TYPE MISMATCH IN PROMOTE COMMAND** (Contract 1 — runtime bug, BLOCKING)
   - The promote command maps confidence to priority as strings: high→"High", medium→"Medium", low→"Low". The task schema requires priority as an integer (1-5). This causes JSON Schema validation failure on every promoted task.
   - Fix in `slack-forge/commands/promote.md`: change the mapping to: high confidence → `"priority": 1` or `"priority": 2`, medium confidence → `"priority": 3`, low confidence → `"priority": 4` or `"priority": 5`.
   - Discovered during collaboration with tasks-eval. This is the highest-priority fix — without it, the entire task promotion pipeline is non-functional.

2. **Add Forge Memory lookup to task-harvester and knowledge-harvester skills** (Contract 6)
   - Both skills should include a step: "Before finalizing extracted items, check Forge Memory for canonical names of people, projects, acronyms, and terms mentioned in the transcript. Use `forge memory recall` or `forge memory query-knowledge` to resolve shorthand."
   - This should appear in both SKILL.md files and both agent .md files.

3. **Add unresolved-discussion detection to knowledge-harvester** (IF2)
   - Add a knowledge signal: "Unresolved multi-person discussions — multiple viewpoints with no clear consensus"
   - Add a suggestion mechanism: "If a knowledge item represents an unresolved discussion with 3+ viewpoints, suggest structured analysis with `/cognitive-forge:debate`"
   - Add tag: `unresolved-discussion` for items that meet this criteria.

4. **Add structured provenance tag to promoted tasks** (Contract 1 improvement)
   - The promote command embeds Slack provenance as unstructured text in the task description (`"Harvested from #channel by @author on date"`). This means Tasks Forge cannot programmatically identify Slack-originated tasks.
   - Fix: Add `"slack-harvest"` as an automatic tag on every promoted task. The task schema has `additionalProperties: false` so a dedicated `source` field is not possible without schema changes.
   - Discovered during collaboration with tasks-eval: without structured provenance, even if Tasks Forge adds Slack awareness, it has no reliable way to filter or identify harvest-originated tasks.

5. **Fix `general` memory-hint type mapping and verify provenance fields** (Contract 1 knowledge gap)
   - The knowledge-harvester allows `general` as a memory-hint tag, but Forge Memory has no `general` knowledge type. The promote command silently defaults to `project`. Either: (a) remove `general` from knowledge-harvester and force classification into person/project/glossary, or (b) document the `general→project` fallback explicitly.
   - The `source` and `harvested_on` fields in `--data` are not among Forge Memory's documented fields per type. Verify at the forge-lib level whether `create-knowledge` preserves arbitrary extra fields. If not, provenance is silently lost during promotion.
   - Discovered during collaboration with memory-eval.

### Important (Ecosystem enrichment)

5. **Add broader workflow suggestions to promote command summary** (Contract 5)
   - After promoting tasks: "You can triage these tasks with `/tasks-forge:start`"
   - After promoting knowledge: "These entries are now available for Product Forge card enrichment and Report Forge scoping"

6. **Consider selective JIRA digest → task promotion pathway**
   - JIRA digests with `needs_action: true` items could optionally promote to Tasks Forge as tasks, rather than being purely informational.

### Moderate (Structural improvements)

7. **Extract transcript format contract to a shared reference file**
   - The scan command's inline transcript format specification should be in `slack-forge/references/transcript-format.md` and referenced by both the scan command and all three harvester agents.

8. **Add thread/context handling guidance to harvester skills**
   - Slack threads add conversational depth that flat transcripts may lose. The skills should guide how to handle threaded vs. flat context.

---

## Score Summary

| Component | Isolation | Ecosystem | Overall |
|-----------|-----------|-----------|---------|
| Task Harvester (skill+agent) | 9/10 | 2/10 | 6.9/10 |
| Knowledge Harvester (skill+agent) | 8.5/10 | 2.5/10 | 6.7/10 |
| JIRA Digest (skill+agent) | 9/10 | 1/10 | 6.6/10 |
| Scan Command | 9/10 | 3/10 | 7.2/10 |
| Promote Command | 6/10 | 4/10 | 5.0/10 |
| **Plugin Average** | **8.3/10** | **2.5/10** | **6.3/10** |

*Overall = 70% isolation + 30% ecosystem for harvesters/scan; 50%/50% for promote command*

---

## Audit Dimension Scores (10-dimension rubric)

| Dimension | Score | Notes |
|-----------|-------|-------|
| 1. Trigger & Description Quality | Adequate | Skills have clear scopes but descriptions are not pushy enough for independent triggering |
| 2. Core Objective Clarity | Strong | Each skill/agent has a clear, unambiguous objective |
| 3. Procedural Logic | Strong | 5-stage pipeline is well-sequenced with explicit dependencies |
| 4. Human-in-the-Loop Gates | Strong | Review command is entirely human-gated; scan has confirmation before execution |
| 5. Output Specifications | Strong | Content quality requirements with good/bad examples are best-in-class |
| 6. Reference File Utilization | Missing | Zero reference files — transcript format is inline, no shared resources |
| 7. Connector/Tool Integration | Adequate | forge-lib delegation is clean; MCP tools referenced in scan but not listed as formal dependencies |
| 8. Progressive Disclosure | Adequate | Skills are lean (<100 lines each) but no reference extraction |
| 9. Cross-Plugin Handoff Awareness | Weak | Only promote command has cross-plugin awareness; harvesters operate in isolation |
| 10. Writing Quality & Tone | Strong | Imperative form, reasoning-based instructions, good examples |
