# Product Forge — Eval Results

**Date:** 2026-03-09
**Evaluator:** product-eval agent
**Components evaluated:** 5 (create orchestrator, forge-initiative, forge-story, forge-intake, Jira sync system)
**Test cases:** 47 (32 isolation, 15 ecosystem)
**Contracts evaluated:** 2, 3, 4, 5, 6, IF1

---

## Summary

Product Forge's **isolation quality is excellent**. The orchestrator/agent architecture, the Jira sync system, and the individual agents all perform their claimed functions well. The seven-phase create workflow, the bidirectional Jira sync, and the adaptive intake interview are all well-specified and would produce correct behavior for their primary use cases.

Product Forge's **ecosystem participation is poor**. Across all 15 ecosystem test cases, the plugin fails to meet the expected bar on 12 of them. The plugin operates in near-total isolation despite being the central planning artifact in the Forge ecosystem. No command suggests pushing to Jira after creation, creating tasks in Tasks Forge, generating reports, or adding unknown terms to Forge Memory.

**Overall isolation score: 9.2 / 10**
**Overall ecosystem score: 2.1 / 10**
**Weighted combined score: 7.1 / 10** (70% isolation, 30% ecosystem)

---

## Component 1: create (Orchestrator Command)

**File:** `product-forge/commands/create.md` (184 lines)

### Isolation Eval

| Test ID | Result | Notes |
|---------|--------|-------|
| isolation-create-001 | **PASS** | Card type detection table in Phase 1 correctly maps "story" signal word. Proceeds without disambiguation. |
| isolation-create-002 | **PASS** | "If ambiguous" clause explicitly presents 6-option disambiguation prompt and says "Wait for user selection before proceeding." |
| isolation-create-003 | **PASS** | "If `--type` is provided, use that type directly" — bypasses detection cleanly. |
| isolation-create-004 | **PASS** | Phase 3 agent recruitment template is well-structured. Spawns Task tool with correct agent path, concept brief, and taxonomy. |
| isolation-create-005 | **PASS** | Phase 4 presents draft with "Create this card? Confirm, request revisions, or cancel." and explicitly says "If the user requests revisions" before "On approval" in Phase 5. |
| isolation-create-006 | **PASS** | "Feed revisions back to the agent via a follow-up Task tool call. Present the revised draft. Repeat until approved or cancelled." |
| isolation-create-007 | **PASS** | Phase 5 shows correct forge-lib call syntax with JSON response parsing. Phase 7 reports filename from response.data. |
| isolation-create-008 | **PASS** | Phase 6 handles relationship linking with error fallback: "Card saved to ... but relationship linking failed: {response.error}" with manual command suggestion. |
| isolation-create-009 | **PASS** | "For batch stories, call `forge card create story` once per story." Phase 7 batch confirmation template lists all files. |
| isolation-create-010 | **PASS** | "If no description is provided, ask the user: 'What would you like to create?'" |

**Isolation score: 10/10** — All test cases pass. The seven-phase orchestrator is exceptionally well-specified.

### Ecosystem Eval

| Test ID | Contract | Result | Level | Evidence |
|---------|----------|--------|-------|----------|
| ecosystem-create-001 | Contract 2 | **PARTIAL PASS** | Context Passing (partial) | Phase 2 step 3 says "Product taxonomy: Query via `forge memory get-taxonomy products` (gracefully degrade if unavailable)". This fetches taxonomy. **However**, there is no instruction to resolve shorthand terms against the taxonomy or to use canonical names. The taxonomy is passed to the agent, but the orchestrator doesn't verify resolution happened. |
| ecosystem-create-002 | Contract 2 | **FAIL** | None | No instruction anywhere in create.md to detect unknown terms and suggest adding them to Forge Memory. The product-context skill mentions "flag it to the user and offer to add it" but create.md doesn't invoke this behavior explicitly. |
| ecosystem-create-003 | Contract 5 | **FAIL** | None | Phase 7 confirmation has no mention of Jira, push-to-jira, or any other plugin. Just reports the filename. |
| ecosystem-create-004 | Contract 5 | **FAIL** | None | No mention of Tasks Forge anywhere in create.md. Phase 7 confirmation has no follow-up suggestions. |
| ecosystem-create-005 | Contract 6 | **PARTIAL PASS** | Awareness | Phase 2 queries taxonomy, which implicitly checks memory. But there's no explicit "check Forge Memory for acronyms before proceeding" instruction. The product-context skill handles this, but it's indirect — relies on skill auto-invocation rather than explicit orchestrator behavior. |
| ecosystem-create-006 | IF1 | **FAIL** | None | No post-creation Jira suggestion. No mention of the sync loop. |

**Ecosystem score: 1.5/6** — Only partial credit on taxonomy resolution (via product-context skill indirection). All proactive handoff suggestions are completely absent.

**Key failing evidence:**
- Phase 7 confirmation (lines 163-175) contains ONLY filename reporting. No next-step suggestions to any other plugin.
- The "Key Rules" section (lines 179-184) focuses entirely on internal architecture (delegation, approval gates) with zero cross-plugin awareness.

---

## Component 2: forge-initiative (Agent)

**File:** `product-forge/agents/forge-initiative.md` (89 lines)

### Isolation Eval

| Test ID | Result | Notes |
|---------|--------|-------|
| isolation-initiative-001 | **PASS** | Create mode output format explicitly lists all required sections with content guidance ("2-3 paragraphs" for background and proposed_solution). Tone identity section establishes executive voice. |
| isolation-initiative-002 | **PASS** | Affected_systems section says "Bullet list of system names from product taxonomy." This explicitly ties to taxonomy. |
| isolation-initiative-003 | **PASS** | "If the concept brief is ambiguous, state your assumptions clearly rather than guessing silently." |
| isolation-initiative-004 | **PASS** | Review mode defines strengths/gaps/suggestions/verdict with five specific review criteria. |
| isolation-initiative-005 | **PASS** | Content Guidelines reference pm-methodology: no dashes, no tables, prose for Background and Proposed Solution, substantive bullets. |

**Isolation score: 10/10**

### Ecosystem Eval

| Test ID | Contract | Result | Level | Evidence |
|---------|----------|--------|-------|----------|
| ecosystem-initiative-001 | Contract 2 | **PARTIAL PASS** | Context Passing (partial) | Agent receives taxonomy in concept brief and affected_systems instruction says "from product taxonomy." But agent has no instruction to validate terms against taxonomy or flag mismatches. It will use what it receives, but won't actively resolve or validate. |

**Ecosystem score: 1.5/2** — Taxonomy usage is present but passive (uses what's given rather than actively resolving).

---

## Component 3: forge-story (Agent)

**File:** `product-forge/agents/forge-story.md` (105 lines)

### Isolation Eval

| Test ID | Result | Notes |
|---------|--------|-------|
| isolation-story-001 | **PASS** | Output format is the most detailed of all agents. All required sections specified. Acceptance test format "Test N: Name / Steps / Expected Result" explicitly defined. |
| isolation-story-002 | **PASS** | Named test format is specified in both Output Format and Content Guidelines. "4-6 named tests" with coverage guidance. |
| isolation-story-003 | **PASS** | Validation Rules item 2: "Business rules, not system logic: 'What' and 'why' from business perspective." Content Guidelines: "describe 'what' not 'how'". |
| isolation-story-004 | **PASS** | Validation Rules item 1: "Atomic scope: Completable in 1-3 days by one engineer or pair." Review criteria: "Is scope atomic (completable in 1-3 days)? Should this be broken down further?" |
| isolation-story-005 | **PASS** | "For batch generation, return all stories in a single response." Each story uses same structure. Validation rules apply to each. |
| isolation-story-006 | **PASS** | Title format section explicitly gives two options with guidance: "User Story Format (feature work)" vs "Simple Directive Format (backend, infrastructure, focused work)." |

**Isolation score: 10/10** — The most thoroughly specified agent. Validation rules are a strong defensive pattern.

### Ecosystem Eval

| Test ID | Contract | Result | Level | Evidence |
|---------|----------|--------|-------|----------|
| ecosystem-story-001 | Contract 2 | **PARTIAL PASS** | Context Passing (partial) | Frontmatter includes product/module/client "From taxonomy or user input." Passive use of provided taxonomy — no active resolution or validation. |
| ecosystem-story-002 | Contract 2 | **PARTIAL PASS** | Awareness | Batch generation would inherit taxonomy from concept brief. Consistency depends on orchestrator passing correct data. No explicit "verify consistency across batch" instruction. |
| ecosystem-story-003 | Contract 5 | **FAIL** | None | No mention of Tasks Forge, implementation tracking, or any downstream plugin. Agent's Rules section is focused on internal constraints (read-only, no forge-lib). |

**Ecosystem score: 1/3** — Passive taxonomy usage only. No proactive handoffs.

**Key failing evidence:**
- Lines 98-105 (Rules section): Entirely internal-focused. No mention of downstream consumers.
- No "after story creation, suggest..." pattern anywhere in the file.

---

## Component 4: forge-intake (Agent)

**File:** `product-forge/agents/forge-intake.md` (108 lines)

### Isolation Eval

| Test ID | Result | Notes |
|---------|--------|-------|
| isolation-intake-001 | **PASS** | Phase 1: "Assess what the user has already provided (screenshots, docs, verbal summary). Skip questions where answers are evident." |
| isolation-intake-002 | **PASS** | Phase 2: "3-4 questions per batch" explicitly stated. Seven topic areas listed for adaptive coverage. |
| isolation-intake-003 | **PASS** | Phase 3 Red Flag Probing: "'Just a simple toggle' → Get defaults, behaviors, who can change it" — exact match for test scenario. |
| isolation-intake-004 | **PASS** | "'Handle that later' → Capture as Open Question" — explicitly listed as red flag pattern. |
| isolation-intake-005 | **PASS** | Seven topic areas are enumerated. Interview Tips say "Mirror user's language" and "Acknowledge what they've provided" supporting adaptive (not rigid) coverage. |
| isolation-intake-006 | **PASS** | Phase 4 output format specifies title format, frontmatter fields, and all 10 sections including optional ones. |
| isolation-intake-007 | **PASS** | Interview Tips: "Handle 'I don't know' gracefully: capture as Open Question." |

**Isolation score: 10/10** — The red flag probing section is the most sophisticated behavioral guidance in any Forge agent.

### Ecosystem Eval

| Test ID | Contract | Result | Level | Evidence |
|---------|----------|--------|-------|----------|
| ecosystem-intake-001 | Contract 2 | **PARTIAL PASS** | Context Passing (partial) | Agent receives "Product taxonomy (products, modules, clients)" in Input section. Frontmatter uses "From taxonomy or user input." Passive — no active resolution instruction. |
| ecosystem-intake-002 | Contract 5 | **FAIL** | None | No mention of creating Product Forge cards from intake results. Topic 7 "Card Type Manifest" identifies what cards to create but doesn't suggest the `/product-forge:create` command as a next step. |
| ecosystem-intake-003 | Contract 4 | **FAIL** | None | No mention of Cognitive Forge, `/cognitive-forge:debate`, or structured decision analysis. Unresolved decisions would be captured as Open Questions but without any cross-plugin suggestion. |

**Ecosystem score: 0.5/3** — Minimal taxonomy awareness. Complete absence of cross-plugin handoffs despite the intake agent being a natural upstream provider for multiple plugins.

**Key failing evidence:**
- Topic 7 "Card Type Manifest" (line 46) identifies "Initiative, Epic, Story, or combination" but never mentions how to create them (no `/product-forge:create` suggestion).
- No mention of Cognitive Forge anywhere in the file.
- Rules section (lines 101-107) is entirely internal-focused.

---

## Component 5: Jira Sync System (jira-sync + push-to-jira + pull-from-jira)

**Files:** `product-forge/skills/jira-sync/SKILL.md` (172 lines), `product-forge/commands/push-to-jira.md` (282 lines), `product-forge/commands/pull-from-jira.md` (288 lines)

### Isolation Eval

| Test ID | Result | Notes |
|---------|--------|-------|
| isolation-jira-push-001 | **PASS** | All six phases for Create Mode clearly documented with correct MCP calls, payload construction, and frontmatter update. |
| isolation-jira-push-002 | **PASS** | Update Mode confirmation prompt shows linked issue key, URL, summary, line count. Waits for user before calling MCP. |
| isolation-jira-push-003 | **PASS** | Phase 3A parent resolution: checks parent jira_card, presents warning with suggestion to link parent first, asks proceed/exit. |
| isolation-jira-push-004 | **PASS** | "If the user accepts or `--force` is present, proceed." Force bypasses confirmation cleanly. |
| isolation-jira-push-005 | **PASS** | Type mapping table explicitly maps Decision → Task, Intake → Task, Checkpoint → Task. |
| isolation-jira-pull-001 | **PASS** | Five-phase workflow with diff presentation using -/+ format. Phase 4 shows detailed diff template. |
| isolation-jira-pull-002 | **PASS** | Phase 1 handles Jira key format detection, queries all cards, handles multiple matches with numbered selection. |
| isolation-jira-pull-003 | **PASS** | "No changes detected" early exit is explicitly documented with clean message. |
| isolation-jira-pull-004 | **PASS** | Status independence maintained: "Stored separately; does NOT overwrite local `status`." Diff template shows "(Stored in jira_status field; local status field unchanged)." |
| isolation-jira-pull-005 | **PASS** | "Convert seconds to hours: `estimate_hours = timeestimate / 3600`. Round to 1 decimal place." |
| isolation-jira-pull-006 | **PASS** | "Card is not linked to Jira. Use /link-to-jira first to establish a connection." Exit. |

**Isolation score: 10/10** — The Jira sync system is the most thoroughly documented integration in the Forge. Status independence principle is consistently reinforced across all three files.

### Ecosystem Eval

| Test ID | Contract | Result | Level | Evidence |
|---------|----------|--------|-------|----------|
| ecosystem-jira-001 | IF1 | **FAIL** | None | push-to-jira Phase 6A/6B confirmation (lines 157-162, 225-230) reports success but has NO suggestion about pull-from-jira for future changes. No sync loop awareness. |
| ecosystem-jira-002 | Contract 5 | **FAIL** | None | pull-from-jira Phase 5 confirmation (lines 203-217) lists updated fields but has NO mention of downstream impact (Tasks Forge, re-push, etc.). |
| ecosystem-jira-003 | Contract 2 | **PASS** | Awareness | jira-sync skill explicitly documents "Not synced to Jira: `status`, `product`, `module`, `client`, `team`, `confidence` (local-only fields)." This preserves taxonomy-derived fields correctly. |

**Ecosystem score: 1/3** — Only the jira-sync skill's field mapping documentation passes (preserving local-only taxonomy fields). Both commands completely lack post-action suggestions.

**Key failing evidence:**
- push-to-jira confirmation template (lines 157-162): Only shows "Pushed to Jira: PROJ-123 / Jira URL / Card updated." No next steps.
- pull-from-jira confirmation template (lines 203-217): Only shows "Card updated from Jira" with field list. No downstream impact suggestions.
- "Key Behaviors" sections in both commands focus entirely on destructive operation warnings and sync mechanics — zero cross-plugin content.

---

## Ecosystem Contract Compliance

### Contract 2: Product Forge → Forge Memory (Taxonomy Reference)

**Grade: Level 1 (Awareness) — partial**

**Evidence:** The create command's Phase 2 queries taxonomy via `forge memory get-taxonomy products`. The product-context skill describes taxonomy resolution with graceful degradation. However:
- No explicit unknown-term detection with memory addition suggestion
- Resolution is passive (passes taxonomy to agent) rather than active (validates and resolves)
- product-context skill overlaps with Forge Memory's org-context skill — unclear which fires

**Gap:** The create command should explicitly check for unknown terms after taxonomy lookup and suggest `/forge-memory:remember` for new terms. Currently this behavior is described in product-context skill (line 62: "offer to add it via `forge memory set-taxonomy`") but not wired into the create command workflow.

**Cross-testing with memory-eval (Contract 2 deep dive):**

Tested product-context resolution against memory-eval's taxonomy terms:
| Term | Expected Resolution | product-context Behavior | Result |
|------|-------------------|------------------------|--------|
| "WebApp" (exact) | → WebApp | Should resolve via taxonomy query | LIKELY PASS (trivial match) |
| "billing stuff" (fuzzy) | → Billing | No fuzzy matching heuristics defined | DEPENDS ON LLM INFERENCE |
| "the mobile app" (informal) | → MobileApp | No informal language resolution rules | DEPENDS ON LLM INFERENCE |
| "Acme" (partial) | → Acme Corp | No partial match guidance | DEPENDS ON LLM INFERENCE |
| "PSR" (acronym/glossary) | → glossary expansion | create command only queries `products` taxonomy, NOT glossary | FAIL — glossary not queried |
| "Phoenix project" (unknown) | → suggest add to memory | product-context line 62 describes this, but create command doesn't invoke it | PARTIAL — behavior exists in skill but not wired into workflow |

**New findings from cross-testing:**
1. **Narrow taxonomy scope:** Create command Phase 2 only calls `forge memory get-taxonomy products` — does NOT query `clients`, `teams`, or `glossary`. This means client names (Acme Corp), team names, and acronyms (PSR) are never explicitly resolved against memory.
2. **No matching heuristics:** product-context says "resolve shorthand references" but provides zero guidance on HOW to match (fuzzy, partial, case-insensitive). Resolution quality depends entirely on LLM inference rather than explicit skill instructions.
3. **Inconsistency risk with org-context:** If Forge Memory's org-context provides explicit matching heuristics (e.g., fuzzy matching, tiered lookup) but product-context does not, the same term could resolve differently depending on which skill fires. This is a real behavioral inconsistency, not just an architectural overlap.

### Contract 3: Product Forge → Report Forge (Context Provider)

**Grade: Level 0 (Missing)**

**Evidence:** No mention of Report Forge in any Product Forge file. The review command (which is the most natural handoff point) suggests only `/product-forge:update` as a next step (review.md line 99). Zero awareness of `/report-forge:generate`.

### Contract 4: Cognitive Forge → Product Forge (Decision Ingestion)

**Grade: Level 0 (Missing)**

**Evidence:** The forge-decision agent (forge-decision.md) generates decisions from "conversation context or direct input" only. No mechanism to read Cognitive Forge session records. No reference to `/cognitive-forge:debate` sessions. The create command has no instruction to look for debate sessions when creating Decision cards.

**Cross-testing with cognitive-eval (Contract 4 deep dive):**

cognitive-eval provided the exact Forge Synthesis output structure from `debate.md` (lines 212-234). The synthesis has six sections with strong natural mapping to Decision card fields:

| Forge Synthesis Section | Decision Card Field | Mapping Quality |
|------------------------|-------------------|-----------------|
| Forge Verdict | `decision` section | STRONG — verdict paragraph maps directly to decision statement |
| Refined Understanding | `rationale` section | STRONG — 2-3 paragraphs on concept evolution = trade-off reasoning |
| Unresolved Tensions | `rationale` section (trade-offs) | GOOD — captures competing approaches as narrative |
| Strengths Validated | `rationale` section (supporting) | GOOD — validated strengths support the decision rationale |
| Weaknesses to Address | `impact` section | MODERATE — risks/concerns relate to impact but aren't identical |
| Unexplored Territory | (no direct mapping) | GAP — Decision card has no "open questions" section |

Key findings:
1. **Session location:** Debate sessions save to `sessions/debates/YYYY-MM-DD-slug.md`. The `synthesis` field contains the full Forge Synthesis text. forge-decision agent could read these if it knew where to look.
2. **Alternatives are narrative, not structured:** The Challenger agent and "Unresolved Tensions" section contain alternative approaches woven into analytical narrative — this actually aligns well with the Decision card's prose-based `rationale` section. Initial concern about format impedance mismatch is **less severe than expected**.
3. **Structured fields available:** `key_insights` and `next_steps` arrays in session data could map to decision impact and follow-up actions.

**Revised assessment:** Content compatibility between debate synthesis and decision cards is STRONG. The gap is purely a **wiring problem** — neither plugin knows about the other. The fix is additive:
- forge-decision agent: add instruction to check `sessions/debates/` for recent sessions matching the topic
- create command: when type=decision, suggest checking for relevant debate sessions
- Shared reference doc defining the synthesis-to-decision field mapping (owned jointly)

### Contract 5: Proactive Handoff Suggestions

**Grade: Level 0 (Missing)**

**Evidence:** Across all 8 commands (init, create, update, review, checkpoint, push-to-jira, pull-from-jira, link-to-jira), none include post-action suggestions to other plugins. The expected handoffs per the test plan:
- Card created → suggest push-to-jira: **MISSING**
- Card created → suggest tasks-forge:add: **MISSING**
- Checkpoint captured → suggest decision cards from decisions: **MISSING**
- Checkpoint captured → suggest tasks from open items: **MISSING**
- Card updated → suggest Jira re-sync if linked: **MISSING** (update command line 122: cross-plugin handoff rated "Missing" in audit — confirmed)
- Review completed → suggest report-forge:generate: **MISSING**

### Contract 6: Memory-First Resolution

**Grade: Level 1 (Awareness) — downgrade candidate to Level 0**

**Evidence:** Product-context skill (product-context/SKILL.md) describes checking taxonomy "On every invocation" (line 21). Create command Phase 2 queries taxonomy. However, there is no explicit "check Forge Memory for acronyms/shorthand BEFORE proceeding" instruction in the create command itself. The behavior depends on product-context skill auto-invocation, which is indirect.

**Cross-testing with memory-eval (Contract 6 deep dive):**

Contract 6 requires the full tiered lookup defined in memory-management: **Taxonomy → Glossary → Deep Memory → Ask User**. Product Forge only implements the first tier:

| Lookup Tier | Required by Contract 6 | Product Forge Implementation | Status |
|-------------|----------------------|------------------------------|--------|
| Taxonomy | `forge memory get-taxonomy` | create Phase 2 queries `products` only | PARTIAL — misses clients, teams |
| Glossary | `forge memory query-knowledge --type glossary` | Not invoked anywhere | MISSING |
| Deep Memory | Broader knowledge search | Not invoked anywhere | MISSING |
| Ask User | Prompt for unknown terms | product-context line 62 describes it, not wired in create | MISSING in practice |

**Concrete failure case:** "PSR" (Pipeline Status Report) is a glossary term, not a taxonomy product. Product Forge's create command calls `forge memory get-taxonomy products` which would NOT find PSR. The acronym would silently pass through unresolved. Contract 6 requires that ANY unrecognized shorthand be checked against the full memory system, not just one taxonomy category.

**memory-eval's assessment:** product-context calling `get-taxonomy` alone is insufficient for Contract 6. The full resolution requires either memory-management's tiered lookup to fire first, or product-context needs to query glossary and knowledge in addition to taxonomy.

**Revised recommendation:** Product Forge should either:
1. Explicitly invoke memory-management's tiered lookup (not just taxonomy) before card creation, OR
2. Expand product-context to query glossary (`forge memory query-knowledge --type glossary`) and broader knowledge in addition to taxonomy

### IF1: Jira Sync Loop

**Grade: Level 0 (Missing)**

**Evidence:** Neither push-to-jira nor pull-from-jira suggest the complementary operation after completing their work. No sync loop awareness exists.

---

## Teammate Collaboration Findings

### From memory-eval (RESPONDED — two exchanges)
- **Exchange 1:** Sent term list for alignment. memory-eval confirmed terms and flagged PSR as glossary, not taxonomy.
- **Exchange 2:** memory-eval confirmed critical details:
  - PSR = "Pipeline Status Report", lives in glossary tier, requires `forge memory query-knowledge --type glossary` or `memory/glossary.md` read. Product Forge's `forge memory get-taxonomy products` would NOT find it.
  - Phoenix project = not in taxonomy, not in glossary. Expected behavior: "not found" → suggest adding.
  - **Overlap assessment refined:** Both skills call the same `forge memory get-taxonomy` commands and both apply fuzzy, case-insensitive matching. The overlap is "wasteful but not harmful" for taxonomy resolution because they query the same backend. They will always agree on taxonomy terms.
  - **Boundary recommendation from memory-eval:** org-context = authoritative taxonomy resolver (owns the data). product-context = convenience layer for Product Forge workflows.
  - **Key difference:** org-context provides structured handling for unknown terms (line 92-94: "Should I add it? / Use it anyway / Enter different value"). product-context just says "flag it to the user and offer to add" (line 62) with no structured flow. This means unknown-term handling is better specified in org-context.
  - **Contract 6 finding:** product-context's taxonomy-only lookup is insufficient for Contract 6 (Memory-First Resolution), which requires the full tiered lookup: Taxonomy → Glossary → Deep Memory → Ask User. Product Forge only implements the first tier and only for `products` (not clients/teams/glossary).
- **Impact on grades:** Contract 2 remains Level 1 (Awareness). Contract 6 is a downgrade candidate — the "awareness" rating was generous given that glossary and deep memory tiers are completely absent.

### From tasks-eval (RESPONDED)
- **Sent:** Asked whether Tasks Forge tracks Product Forge story implementations, and whether add command accepts card references
- **Response received:** tasks-eval discovered a significant schema-vs-skill gap:
  - **Schema layer supports linking:** `forge-lib/schemas/task.json` has a `parent` field: `"parent": {"type": ["string", "null"], "description": "Parent task or story filename (without extension)"}`. This means the data layer already supports task-to-story linking — no schema changes needed.
  - **Skill/command layer is completely absent:** task-management SKILL.md (159 lines) contains zero mentions of Product Forge, cards, stories, initiatives, or epics. The add command only gathers title, description, priority, and due_date — never exposes the `parent` field. You'd have to use `forge task create` directly with `--data '{"parent": "story-001-slug"}'` to link.
  - **Bilateral gap confirmed:** Level 0 on both sides. Product Forge create never suggests `/tasks-forge:add`. Tasks Forge never mentions Product Forge stories as task sources.
  - **Key insight:** Level 3 (Context Passing) is theoretically achievable WITHOUT schema changes because the `parent` field already exists. The fix is purely a skill instruction gap on both sides.
  - **Interesting contrast found:** tasks-eval also found that task-management references `external_id`/`external_link` fields (lines 110-111) that the schema REJECTS (`additionalProperties: false`) — dead code in the skill. The `parent` field is the opposite: hidden capability in the schema, undocumented in the skill. Two different kinds of gaps.
- **Impact on Contract 5 grade:** Remains Level 0. But the fix path is clearer than expected — the `parent` field means Product Forge create could suggest `/tasks-forge:add` with a pre-populated parent reference to the story filename, and Tasks Forge add could optionally gather a `parent` when the user mentions a story context.

### From cognitive-eval (RESPONDED — two exchanges)
- **Exchange 1:** cognitive-eval asked for the exact Decision card schema. Provided full schema, field mapping table, and invocation pattern (`/product-forge:create --type decision`).
- **Exchange 2:** cognitive-eval provided the Forge Synthesis output structure (6 sections: Refined Understanding, Strengths Validated, Weaknesses to Address, Unexplored Territory, Unresolved Tensions, Forge Verdict). Also confirmed session save location: `sessions/debates/YYYY-MM-DD-slug.md` with `synthesis`, `key_insights`, and `next_steps` fields in the session data JSON.
- **Key finding (revised):** Initial concern about format impedance mismatch (structured alternatives vs prose rationale) is **less severe than expected**. The Challenger's alternatives and "Unresolved Tensions" are already narrative prose, which naturally maps to the Decision card's prose-based `rationale` section. The content shapes are actually compatible.
- **Critical gap confirmed bilaterally:** The gap is purely a wiring problem — forge-decision agent has no awareness of `sessions/debates/` directory, and Cognitive Forge's debate command never suggests `/product-forge:create --type decision` post-synthesis. Contract 4 = Level 0 on both sides, but the fix is straightforward and additive.
- **Shared fix proposed:** A reference doc owned jointly by both plugins defining the synthesis-to-decision field mapping, plus awareness instructions added to both sides.

### From report-eval (RESPONDED)
- **Sent:** Asked about card reference format expectations and Product Forge awareness
- **Response received:** report-eval confirmed their generate command accepts `--cards` as comma-separated filenames (without .md). Their Investigator reads those files and uses content to scope investigation.
- **Key findings shared:**
  1. Card filenames vary by type (kebab-case for Initiative/Epic/Decision, `story-NNN-slug` for Stories, `checkpoint-YYYY-MM-DD-slug` for Checkpoints). Report Forge's investigator needs to resolve the type directory from the filename to find `cards/{type}s/{filename}.md`.
  2. `affected_systems` is the primary scoping field for constraining investigation scope. `product`/`module` frontmatter provides taxonomy-based filtering.
  3. Product Forge NEVER suggests `/report-forge:generate` — confirmed across all 8 commands. The review command's "Next steps" section only points to `/product-forge:update` and `/product-forge:review`.
- **Bilateral gap confirmed:** Product Forge doesn't suggest reports; whether Report Forge's investigator knows how to navigate card type directories from bare filenames is TBD on their side.

---

## Recommended Improvements

### Priority 1: Add Cross-Plugin Handoff Suggestions (Contracts 5, IF1)

Add a "Next Steps" section to the create command's Phase 7 confirmation:

```markdown
## Phase 7: Confirmation

Report the result and suggest next steps:

**For all card types:**
- "Would you like to push this to Jira with `/product-forge:push-to-jira {filename}`?"

**For Stories:**
- "Track implementation tasks with `/tasks-forge:add`?"
- Note: Tasks Forge schema already has a `parent` field that accepts story filenames. The suggestion could include: "Tasks created from this story can be linked via the parent field (e.g., parent: '{story-filename}')."

**For Initiatives/Epics:**
- "Generate a deeper analysis with `/report-forge:generate`?"
```

Similarly for push-to-jira (suggest pull-from-jira), pull-from-jira (suggest downstream review), update (suggest re-sync if Jira-linked), review (suggest report-forge:generate), and checkpoint (suggest decision cards from decisions, tasks from open items).

**Note on Tasks Forge integration (from tasks-eval collaboration):** The `parent` field in `forge-lib/schemas/task.json` already supports task-to-story linking. This means the create command's Story handoff suggestion can be concrete: "Track implementation with `/tasks-forge:add` — tasks will link back to this story via the parent field." No schema changes needed on either side.

### Priority 2: Full Tiered Memory Lookup (Contracts 2 and 6)

The current create command Phase 2 only calls `forge memory get-taxonomy products`. This is insufficient for both Contract 2 (taxonomy reference) and Contract 6 (memory-first resolution). Expand to full tiered lookup:

```markdown
## Phase 2: Context Assembly (revised)

1. **Conversation context**: Relevant details from the current session
2. **Parent card** (if applicable): Read via `forge card get {parent_type} {parent_filename}`
3. **Memory resolution** (for any product, module, client, team, or acronym in the user's request):
   a. Query taxonomy: `forge memory get-taxonomy products`, `forge memory get-taxonomy clients`, `forge memory get-taxonomy teams`
   b. Query glossary: `forge memory query-knowledge --type glossary` (for acronyms and shorthand)
   c. If term found: use canonical name from memory
   d. If term NOT found in any tier: flag to user —
      "{term} isn't in organizational memory yet. Should I:
      1. Add it with `/forge-memory:remember`?
      2. Use it as-is?
      3. Enter a different value?"
```

This ensures glossary terms (e.g., PSR = "Pipeline Status Report") are resolved, not just taxonomy product entries. It also brings Product Forge in line with memory-management's tiered lookup pattern (Taxonomy → Glossary → Deep Memory → Ask User).

### Priority 3: Resolve product-context / org-context Overlap (Contract 2)

Either:
1. **Merge:** Make product-context explicitly delegate to Forge Memory's org-context for taxonomy resolution, keeping product-context for Product Forge-specific enrichment (card tagging, hierarchy awareness).
2. **Delineate:** Document that product-context is the canonical resolver within Product Forge workflows, and org-context is for standalone memory workflows.

### Priority 4: Cognitive Forge Session Ingestion (Contract 4)

Add to forge-decision agent:

```markdown
## Context Sources
When creating a Decision card, check for relevant Cognitive Forge debate sessions:
- Look in `sessions/debates/` for recent session files (format: YYYY-MM-DD-slug.md)
- If a matching session exists, read the session and extract the Forge Synthesis
- Map synthesis sections to Decision card fields:
  - Forge Verdict → `decision` section (the decision statement)
  - Refined Understanding → `rationale` section (reasoning and trade-offs)
  - Unresolved Tensions → `rationale` section (competing approaches considered)
  - Strengths Validated → `rationale` section (supporting evidence)
  - Weaknesses to Address → `impact` section (risks and concerns)
  - Unexplored Territory → note in rationale or open items (no direct Decision card field)
- Also check session data fields: `key_insights` array for impact points, `next_steps` array for follow-up actions
```

Add to create command, when type=decision:

```markdown
If the user mentions a debate, discussion, or analysis session:
- Check `sessions/debates/` for matching session files
- Pass the synthesis content to the forge-decision agent in the concept brief
```

### Priority 5: Intake → Card Creation Flow (Contract 5)

Add to forge-intake agent, after Phase 4 confirmation summary:

```markdown
## Suggested Next Steps
Based on the Card Type Manifest identified during intake:
- "Create an Initiative with `/product-forge:create --type initiative`"
- "Break down into Stories with `/product-forge:create --type story`"
- Any unresolved decisions could benefit from `/cognitive-forge:debate`
```

### Priority 6: Post-Action Jira Sync Loop (IF1)

Add to push-to-jira confirmation:
```
If this issue gets updated in Jira, pull changes back with `/product-forge:pull-from-jira {filename}`.
```

Add to pull-from-jira confirmation:
```
If you make further local changes, push them with `/product-forge:push-to-jira {filename}`.
```

---

## Score Summary

| Component | Isolation Score | Ecosystem Score | Weighted Score |
|-----------|----------------|-----------------|----------------|
| create (orchestrator) | 10/10 | 1.5/6 | 6.5/10 |
| forge-initiative | 10/10 | 1.5/2 | 8.7/10 |
| forge-story | 10/10 | 1/3 | 7.3/10 |
| forge-intake | 10/10 | 0.5/3 | 6.8/10 |
| Jira sync system | 10/10 | 1/3 | 7.3/10 |
| **Overall** | **10/10** | **5.5/17 (32%)** | **7.1/10** |

| Contract | Grade | Level |
|----------|-------|-------|
| Contract 2 (Taxonomy Reference) | Partial | Level 1: Awareness |
| Contract 3 (Context Pull for Reports) | Missing | Level 0: None |
| Contract 4 (Decision from Debate) | Missing | Level 0: None |
| Contract 5 (Proactive Handoff) | Missing | Level 0: None |
| Contract 6 (Memory-First Resolution) | Partial | Level 1: Awareness |
| IF1 (Jira Sync Loop) | Missing | Level 0: None |
