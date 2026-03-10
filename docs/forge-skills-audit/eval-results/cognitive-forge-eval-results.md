# Cognitive Forge — Eval Results

**Date:** 2026-03-09
**Evaluator:** cognitive-eval agent
**Plugin:** Cognitive Forge 2.2.0
**Eval Candidates:** debate (command), explore (command), forge-evaluator (agent)
**Contracts:** 4, 5, 6, IF2, IF3

---

## Summary

Cognitive Forge's three eval candidates are **strong in isolation** — the debate orchestration protocol is well-specified, explore's dialogue governance is thoughtful, and forge-evaluator's evidence grounding structure is solid. However, the plugin has **zero ecosystem awareness**. Not a single line across any of the 9 component files references Product Forge, Tasks Forge, Forge Memory, Report Forge, or Slack Forge. All five ecosystem contracts (4, 5, 6, IF2, IF3) fail at the minimum bar (Level 1: Awareness).

---

## Per-Component Eval Scores

### 1. debate.md (Moderator Protocol) — 333 lines

**Isolation Score: Strong**

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-debate-001 (Intake classification) | PASS | Phase 1 (lines 22-50) specifies concept classification into 4 types with clear signals table, confirmation block template, and explicit "Wait for user confirmation. Do not proceed until the user confirms or corrects." |
| isolation-debate-002 (Parallel agent spawning) | PASS | Phase 2 (lines 59-132) specifies spawning 3 core agents "simultaneously using parallel Task tool calls" with explicit instruction "Spawn all selected agents in a single message with parallel Task tool calls. Do not wait for one agent to finish before spawning the next." (line 132) |
| isolation-debate-003 (Decomposer recruitment) | PASS | Phase 1 Step 3 (line 56): "Recruit Decomposer if the concept has 4+ interacting components, nested dependencies, or layered structural complexity." Conditional spawning alongside core agents specified in lines 93-99. |
| isolation-debate-004 (Evaluator recruitment) | PASS | Phase 1 Step 3 (line 57): "Recruit Evaluator if the concept makes specific factual claims, relies on checkable assumptions about markets/users/technology." Conditional spawning in lines 101-103. |
| isolation-debate-005 (Synthesis structure) | PASS | Phase 5 (lines 208-242) specifies all six required sections with clear templates. Synthesis Principles (lines 236-241) explicitly state "Do not average," "Honor the strongest critique," "Preserve surprise," "Be actionable." |
| isolation-debate-006 (Cross-examination trigger) | PASS | Phase 4 (lines 174-206) specifies cross-examination is optional, triggers only when "tension is substantive (not just different emphasis)" and "resolving the tension would materially change the synthesis." Limited to 1 round. Task tool template included. |
| isolation-debate-007 (Session persistence) | PASS | Phase 6 (lines 243-323) fully specifies forge-lib session create with all parameters, JSON response parsing, filepath extraction, and error handling with user-facing recovery instructions. |
| isolation-debate-008 (Quiet mode) | PASS | Lines 170-172: "Do not show individual agent outputs. Skip directly to Phase 5 (Synthesis)." Clear behavioral specification. |

**Ecosystem Score: Missing (Level 0)**

| Test Case | Result | Evidence |
|-----------|--------|----------|
| ecosystem-cognitive-c4-001 (Decision card suggestion) | FAIL | No mention of Product Forge, decision cards, or `/product-forge:create` anywhere in debate.md. After synthesis, the command proceeds directly to session persistence (Phase 6) with no handoff suggestions. The Forge Verdict says to include "next steps" but never suggests these could become cards or tasks in other plugins. |
| ecosystem-cognitive-c4-003 (Both card + task suggestion) | FAIL | Neither Product Forge nor Tasks Forge is mentioned. The "Be actionable" synthesis principle (line 241) says "the user should leave with specific next steps" but does not connect next steps to task tracking. |
| ecosystem-cognitive-c5-001 (Proactive handoff) | FAIL | After Phase 6 session persistence, the command ends. No proactive suggestions for downstream plugins. The entire post-synthesis flow is: persist session → report filepath → done. |
| ecosystem-cognitive-c6-001 (Memory-first resolution) | FAIL | No mention of Forge Memory, `/forge-memory:recall`, or any memory lookup during intake. When the user provides domain terms like "SOAP endpoints," the debate proceeds without checking organizational memory for context. No reference to acronym resolution or taxonomy lookup. |
| ecosystem-cognitive-if2-001 (Slack discussion origin) | FAIL | No mention of Slack Forge as a potential concept source. Debate command does not acknowledge that topics may originate from harvested discussions. |
| ecosystem-cognitive-if3-001 (Report finding origin) | FAIL | No mention of Report Forge as a potential concept source. No awareness that debates may be triggered by report analysis findings. |

---

### 2. explore.md (Guide Protocol) — 304 lines

**Isolation Score: Strong**

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-explore-001 (Conversational intake) | PASS | Phase 1 (lines 21-45): "Begin with conversational understanding. Do not present a formatted intake block immediately — have a genuine exchange first." Explicit guidance to weave questions naturally. Exploration Map presented only after sufficient understanding. |
| isolation-explore-002 (Type-based techniques) | PASS | Phase 3 (lines 87-111) provides explicit technique recommendations per concept type: Business (Perspective Synthesis, Evidence Anchoring, Boundary Mapping), Philosophical (Steel Opposition, Boundary Mapping, Constraint Shaping), Framework (Boundary Mapping, Excellence Calibration, Perspective Synthesis), Creative (Possibility Expansion, Excellence Calibration, Iterative Refinement). |
| isolation-explore-003 (Pause after technique) | PASS | Line 111: "Critical: Pause after each technique for user response. Do not chain techniques without giving the user space to react, redirect, or go deeper." Also reinforced in Anti-Patterns section (line 299): "Monologue Mode: Delivering long analyses without pausing for user input." |
| isolation-explore-004 (Decomposer recruitment with explanation) | PASS | Phase 2 (lines 57-85): Specifies telling user why before spawning ("This concept has enough structural complexity..."), providing dialogue context in agent prompt, summarizing output conversationally, and integrating (not dumping) agent insights. |
| isolation-explore-005 (No Challenger/Explorer/Synthesizer recruitment) | PASS | Lines 273-274: "Never recruit Challenger, Explorer, or Synthesizer — the Guide embodies those perspectives through the dialogue itself. Spawning them would fragment the conversation." |
| isolation-explore-006 (Adaptive synthesis format) | PASS | Phase 6 (lines 165-182): "Do not force a format. Let the conversation determine the appropriate synthesis shape." Provides concept-type-specific examples (Business = recommendations, Philosophical = narrative, Framework = comparative, Creative = generative). |
| isolation-explore-007 (Session persistence) | PASS | Phase 7 (lines 184-261) specifies forge-lib session create with exploration-specific fields (relationship, techniques_applied). Narrative summary assembly (not raw transcript) is specified. |

**Ecosystem Score: Missing (Level 0)**

| Test Case | Result | Evidence |
|-----------|--------|----------|
| ecosystem-cognitive-c4-002 (Task creation suggestion) | FAIL | No mention of Tasks Forge or `/tasks-forge:add` anywhere in explore.md. The synthesis asks "What are the concrete next steps?" (line 182) but never suggests tracking them as tasks. |
| ecosystem-cognitive-c5-002 (Proactive handoff) | FAIL | After Phase 7 session persistence, the command ends with filepath confirmation. No proactive suggestions for any downstream plugin. |
| ecosystem-cognitive-c6-002 (Memory-first for acronyms) | FAIL | No mention of Forge Memory or memory lookup during intake. When user provides acronyms ("PSR"), the Guide would proceed without resolving against organizational taxonomy. |
| ecosystem-cognitive-if3-002 (Report origin awareness) | FAIL | No mention of Report Forge. Explore command does not acknowledge that exploration topics may originate from report findings. |

---

### 3. forge-evaluator.md (Agent) — 75 lines

**Isolation Score: Strong**

| Test Case | Result | Evidence |
|-----------|--------|----------|
| isolation-evaluator-001 (Five output sections) | PASS | Lines 44-65 specify all five required sections: Claim Inventory (with 4-level classification), Evidence Assessment (supporting/contradicting/confidence/what-if-false), Reality Gaps (prioritized by impact), Comparable Evidence (precedents/analogies/outcomes), Evidence Verdict (percentage + single most important thing to verify). |
| isolation-evaluator-002 (Specific WebSearch queries) | PASS | Line 69: "When using WebSearch or WebFetch, search for evidence relevant to the concept's specific claims. Do not perform generic searches." Clear directive against unfocused research. |
| isolation-evaluator-003 (Epistemic humility) | PASS | Line 71: "Distinguish between 'no evidence exists' and 'I could not find evidence.'" Also line 70: "Always disclose when you cannot find evidence — absence of evidence is itself informative." |

**Ecosystem Score: N/A** (forge-evaluator is an agent recruited by the Moderator/Guide, not a user-facing command. Ecosystem handoff responsibility falls on the commands that invoke it, not the agent itself.)

---

## Ecosystem Contract Compliance

### Contract 4: Decision to Action (Cognitive Forge -> Product Forge + Tasks Forge)

**Grade: Missing (Level 0 — below minimum bar)**

**Evidence:** Searched all 9 component files for any reference to Product Forge, Tasks Forge, decision cards, task creation, `/product-forge:create`, `/tasks-forge:add`, or any downstream plugin command. **Zero results.** The debate synthesis structure (Forge Verdict, Weaknesses to Address, Unexplored Territory) naturally produces content that COULD map to decision cards and task priorities, but the skill never makes the connection.

**Specific gap in debate.md:** The Forge Verdict section (line 232-233) says to provide "a qualitative judgment about readiness, potential, and next steps." The "next steps" are where a handoff suggestion should live. Currently the synthesis ends and flows directly to session persistence with no ecosystem bridge.

**Specific gap in explore.md:** The synthesis asks "What are the concrete next steps?" (line 182). These next steps could be tasks, but the command never suggests `/tasks-forge:add`.

**Bilateral confirmation from product-eval:** Product Forge's forge-decision agent has NO mechanism to read Cognitive Forge session files (works from "conversation context or direct input" only). The user would need to manually paste debate synthesis into the conversation. However, the field mapping is strong:

| Debate Synthesis Section | Decision Card Field | Mapping Quality |
|--------------------------|--------------------|-----------------|
| Forge Verdict | `decision` section | Direct (what was decided) |
| Refined Understanding + Unresolved Tensions | `rationale` section | Natural (reasoning + trade-offs) |
| Weaknesses to Address | `impact` section | Good (what changes) |
| Agent perspectives | `stakeholders` | Partial (perspectives, not people) |
| Concept classification | `decision_type` | Requires mapping (Business->Scope/Priority, Framework->Architecture/Technical) |

**Key constraint:** No `alternatives_considered` field exists in the decision card schema. Alternatives must be woven into the `rationale` section as trade-offs. The debate's Challenger analysis and Unresolved Tensions naturally provide this content but not in an isolated field.

**Maximum achievable levels for Contract 4:**
- Decision card path: Level 2 (Specificity) achievable with handoff text; Level 3 (Context Passing) requires forge-decision agent to read session files
- Task path: Level 2 (Specificity) achievable with handoff text; Level 3 blocked by task schema (`additionalProperties: false`, no source field)

---

### Contract 5: Proactive Handoff Suggestions

**Grade: Missing (Level 0)**

**Evidence:** Neither debate.md nor explore.md includes any post-completion handoff suggestion. The flow for both commands is: synthesis → persist session → report filepath → end. The ecosystem test plan (line 126) specifies that Cognitive Forge debate completion should "Suggest decision card and/or task creation (see Contract 4)." This is entirely absent.

---

### Contract 6: Memory-First Resolution

**Grade: Missing (Level 0)**

**Evidence:** Neither command references Forge Memory, `/forge-memory:recall`, or any memory lookup. The CLAUDE.md workspace directive says "Always check Forge Memory first when the user uses shorthand, acronyms, or names you don't recognize." The ecosystem test plan (line 146) specifies that when the user says "Debate whether we should sunset the legacy SOAP endpoints," the skill should check Forge Memory for "SOAP endpoints" and any related product/module context. No Cognitive Forge component implements this.

---

### Implied Flow 2: Slack Forge -> Cognitive Forge (Complex Discussions -> Debate)

**Grade: Missing (Level 0)**

**Evidence:** No Cognitive Forge component mentions Slack Forge. The debate command does not acknowledge that concepts may originate from Slack discussions.

**Bilateral confirmation from slack-eval:** Slack Forge has zero references to Cognitive Forge across all 11 files (3 skills, 3 agents, 5 commands). The knowledge-harvester identifies "Decisions and rationale" as a knowledge signal but makes no distinction between resolved decisions and unresolved discussions. There is no detection heuristic for "no clear consensus" anywhere in the Slack Forge pipeline. IF2 is completely absent from both sides.

**Fix requires both sides:** Slack Forge needs an "unresolved multi-person discussion" signal in the knowledge-harvester that suggests `/cognitive-forge:debate`. Cognitive Forge needs intake-level awareness that debate topics can originate from Slack discussions.

---

### Implied Flow 3: Report Forge -> Cognitive Forge (Analysis -> Deeper Exploration)

**Grade: Missing (Level 0)**

**Evidence:** No Cognitive Forge component mentions Report Forge. Neither debate nor explore acknowledges that topics may originate from report analysis findings. Like IF2, the primary responsibility is on the upstream (Report Forge suggesting `/cognitive-forge:debate` or `/cognitive-forge:explore`), but Cognitive Forge could acknowledge report-originated concepts in intake.

---

## Teammate Collaboration Findings

### Messages Sent and Responses Received

1. **product-eval (Contract 4 — Decision Cards):**
   - Asked about decision card schema for Context Passing grading.
   - Response: Product Forge's create command and forge-decision agent have NO awareness of Cognitive Forge sessions. The forge-decision agent generates decisions from conversation context only, not from structured session records. However, the Forge Synthesis structure maps naturally to decision card fields (Refined Understanding -> rationale, Unresolved Tensions -> alternatives considered, Forge Verdict -> recommendation). **Contract 4 is broken bilaterally.**

2. **tasks-eval (Contract 4 — Task Creation):**
   - Asked about task schema for `/tasks-forge:add` compatibility.
   - Response: Tasks Forge task-management skill has no mention of Cognitive Forge sessions or debate outcomes. The `next_steps` array in Cognitive Forge session records is freeform text, not structured task objects. **Contract 4 is broken bilaterally.**

3. **slack-eval (IF2 — Complex Discussions -> Debate):**
   - Asked whether Slack Forge flags unresolved discussions and mentions Cognitive Forge.
   - Response: Knowledge-harvester identifies "Decisions and rationale" as a knowledge signal but has NO guidance for detecting unresolved discussions or suggesting `/cognitive-forge:debate`. Zero cross-plugin awareness. **IF2 is broken bilaterally.**

4. **report-eval (IF3 — Analysis -> Deeper Exploration):**
   - report-eval asked whether debate/explore accept topics from Report Forge recommendations.
   - Response provided: Both commands accept freeform concepts (would work functionally) but have zero awareness that topics may originate from reports. **IF3 is one-way at best** -- if Report Forge suggests debate, it works, but Cognitive Forge will not incorporate report context.

### Impact on Eval Findings

Teammate collaboration confirmed that ALL ecosystem contracts involving Cognitive Forge are broken bilaterally -- not just on the Cognitive Forge side. Key additional findings:

- **Latent compatibility on Contract 4:** The Forge Synthesis structure (6 sections) maps naturally to Product Forge decision card fields. The data shape is already compatible; only the signpost is missing. This makes the fix particularly low-cost.
- **Intake source blindness:** Cognitive Forge treats all concepts as user-originated. Adding a single "concepts may arrive from other plugins" note to intake would address IF2 and IF3 simultaneously.
- **Freeform next_steps vs structured tasks:** Cognitive Forge's `next_steps` array stores freeform strings. For Contract 4 task compatibility, either the next_steps format needs to become more structured, or the handoff suggestion should just point users to `/tasks-forge:add` and let them reformulate.
- **Contract 4 Context Passing (Level 3) is structurally blocked for tasks:** tasks-eval confirmed that the task schema (`forge-lib/schemas/task.json`) has `additionalProperties: false` and no `source` or `provenance` field. There is no way to tag a task as originating from a Cognitive Forge session at the schema level. The closest workaround is the `tags` array (e.g., `["cognitive-forge", "debate-outcome"]`). The best achievable path today: Cognitive Forge suggests `/tasks-forge:add` with a clear title/description per action item, and the user manually creates each task. Level 3 (Context Passing) is unachievable without a schema change on the Tasks Forge side.
- **Task schema inconsistency discovered:** tasks-eval found that the task-management skill references `external_id` and `external_link` fields (SKILL.md lines 110-111) that the validated schema rejects. This is a Tasks Forge bug, not a Cognitive Forge issue, but it means the "External System Integration" path described in the skill is non-functional.

---

## Recommended Improvements

### Priority 1: Add Post-Synthesis Handoff Block to debate.md

After Phase 5 synthesis and before Phase 6 persistence, add a new section:

```markdown
## Phase 5b: Handoff Suggestions

After delivering the synthesis, suggest relevant downstream actions:

- If the debate produced a clear decision or recommendation:
  "This debate produced a clear recommendation. Capture it as a decision card with
  `/product-forge:create --type decision`. The Forge Verdict maps to the decision statement,
  Refined Understanding and Unresolved Tensions map to rationale (trade-offs considered),
  and Weaknesses to Address maps to impact."

- If the synthesis includes actionable next steps:
  "These next steps could be tracked as tasks with `/tasks-forge:add`."
  (Note: Task schema has no source/provenance field. Suggest using tags like
  "cognitive-forge" or "debate-outcome" for traceability until schema is extended.)

- If key insights should be preserved in organizational memory:
  "Key insights from this debate could enrich organizational memory with `/forge-memory:remember`."
```

**Effort:** Low (~15 lines). **Impact:** Addresses Contracts 4 and 5 for debate.

### Priority 2: Add Post-Synthesis Handoff Block to explore.md

After Phase 6 synthesis and before Phase 7 persistence, add equivalent handoff suggestions:

```markdown
After delivering the synthesis, suggest relevant downstream actions based on what emerged:

- Action items identified → suggest `/tasks-forge:add`
- Decision reached → suggest `/product-forge:create` with decision type
- New terminology or concepts defined → suggest `/forge-memory:remember`
- Topic warrants adversarial testing → suggest `/cognitive-forge:debate`
```

**Effort:** Low (~15 lines). **Impact:** Addresses Contracts 4 and 5 for explore.

### Priority 3: Add Memory-First Resolution to Intake (both commands)

In debate.md Phase 1 Step 1 and explore.md Phase 1, add guidance:

```markdown
Before classifying the concept, check Forge Memory for any domain terms, acronyms,
or shorthand in the user's concept description. Use `/forge-memory:recall` to resolve
unfamiliar terms against organizational taxonomy. If a term resolves, use the canonical
name in the concept brief. If a term is unknown, ask the user to clarify and offer to
add it with `/forge-memory:remember`.
```

**Effort:** Low (~10 lines per command). **Impact:** Addresses Contract 6.

### Priority 4: Acknowledge Diverse Concept Origins in Intake

Add a brief note in both commands' intake phases:

```markdown
Concepts may come from various sources: direct user ideas, Slack Forge harvested
discussions, Report Forge analysis findings, or Product Forge card reviews. If the
user mentions a source, incorporate that context into the concept brief.
```

**Effort:** Low (~5 lines per command). **Impact:** Addresses IF2 and IF3 (Cognitive Forge side).

### Priority 5: Clarify Moderator vs Guide Role Boundary (from audit)

This is an isolation improvement. In debate.md, clarify that the Moderator does NOT analyze during Phases 1-4 (orchestrates only) but DOES produce original synthesis in Phase 5 (this is not aggregation — it's the Moderator's own integrated judgment). In explore.md, clarify that the Guide IS an analyzer throughout (embodying multiple perspectives) and its synthesis is a natural continuation of its analytical role.

**Effort:** Low (~10 lines editorial). **Impact:** Addresses role clarity ambiguity.

---

## Final Assessment

| Dimension | Score |
|-----------|-------|
| Isolation quality (debate) | Strong |
| Isolation quality (explore) | Strong |
| Isolation quality (forge-evaluator) | Strong |
| Ecosystem awareness (all contracts) | Missing |
| Overall plugin maturity | Strong isolation, zero ecosystem integration |

**Bottom line:** Cognitive Forge is a well-crafted plugin that operates as a complete island. Its debate orchestration, dialogue governance, and evidence grounding are all well-specified. But it participates in zero ecosystem contracts despite being explicitly named in Contract 4 and the behavioral directives (Contracts 5, 6). The fixes are all low-effort editorial additions (~50 lines total across both commands) that would move the plugin from Level 0 to Level 2 (Specificity) on most contracts. No architectural changes are needed — just adding handoff text to existing workflow endpoints.
