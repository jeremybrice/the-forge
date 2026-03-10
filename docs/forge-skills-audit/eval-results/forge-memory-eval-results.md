# Forge Memory — Eval Results

**Date:** 2026-03-09
**Evaluator:** memory-eval (Claude Opus 4.6)
**Eval Candidates:** memory-management (skill), recall (command), org-context (skill)
**Contracts:** 1, 2, 3, 5, 6, IF5

---

## Evaluation Methodology

For each eval candidate, I read the actual SKILL.md and command files, then evaluated each test case by analyzing whether the skill's instructions would produce the expected behavior. Grading uses the 4-level ecosystem scale (Awareness → Specificity → Context Passing → Automatic Flow) for ecosystem assertions, and pass/fail with notes for isolation assertions.

---

## 1. memory-management (Skill)

**File:** `forge-memory/skills/memory-management/SKILL.md` (198 lines)

### Isolation Test Results

| Test ID | Description | Result | Notes |
|---------|-------------|--------|-------|
| isolation-memory-mgmt-001 | Four-tier cascade resolves known glossary terms | **PASS** | Tiers clearly sequenced (lines 30-76). Taxonomy checked first via `forge memory get-taxonomy`, then glossary, then deep memory. Example on lines 80-100 demonstrates exactly this flow with todd/PSR/phoenix. |
| isolation-memory-mgmt-002 | Lifecycle filtering skips sunset, flags probationary | **PASS** | Lines 50-53 explicitly define thresholds: <10 sunset (skip), 10-39 probationary (flag with "(fading)"), 40+ trusted. Lines 63-64 confirm same rules apply to deep memory files. |
| isolation-memory-mgmt-003 | Fuzzy matching resolves partial terms | **PASS** | Lines 128-131 specify: case-insensitive, partial word matching ("phoen" → "Phoenix"), nickname matching. The fuzzy matching principle is clearly stated. |
| isolation-memory-mgmt-004 | Tier 4 checks pending.json before asking user | **PASS** | Lines 70-76 explicitly define the pending.json check: "Before asking the user, check memory/pending.json — the term may already be tracked there." The exact output pattern is specified. |
| isolation-memory-mgmt-005 | Recall boost mechanic | **PASS** | Lines 96-98 in the example show "Boost recalled entries: todd, PSR, phoenix all get +5 importance." Lines 153-157 elaborate the principle. |
| isolation-memory-mgmt-006 | Context assembly from multiple tiers | **PASS** | Lines 139-144 explicitly define the assembly pattern: combine glossary entry with deep memory file to build complete understanding. |

**Isolation Score: 6/6 PASS**

The tiered lookup strategy is thoroughly specified with clear sequencing, thresholds, and examples. This is the strongest isolation performance of the three candidates.

### Ecosystem Test Results

| Test ID | Contract | Description | Result | Level Achieved | Evidence |
|---------|----------|-------------|--------|----------------|----------|
| ecosystem-memory-mgmt-001 | Contract 5 | Downstream consumer notification after decoding | **FAIL** | None | The skill contains NO mention of downstream consumers after decoding. Lines 78-100 show the decoding flow ending with "Now Claude can act with full context" — no suggestion to notify Product Forge or Report Forge. The only cross-plugin reference is line 196: "All file operations delegated to forge-lib" which is about tool delegation, not handoffs. |
| ecosystem-memory-mgmt-002 | Contract 6 | Memory-first resolution as workspace behavior | **PARTIAL** | Awareness | The skill description (line 2) mentions "decoding workplace shorthand, acronyms, and internal language" which COULD trigger on PSR in a Product Forge context. However, the description doesn't use the "pushy" pattern — it wouldn't independently fire on "Create a story for the PSR dashboard" since there's no explicit mention of triggering when other plugins encounter unknown terms. The skill assumes it's already been invoked. |
| ecosystem-memory-mgmt-003 | IF5 | Lifecycle filtering notes downstream impact | **FAIL** | None | Lines 50-53 define sunset filtering but say only "treat as if not found." No mention of notifying downstream consumers when entries are filtered out. The example on line 100 says "consider confirming it's still active" about a fading entry, but nothing about Product Forge cards or reports that reference it. |

**Ecosystem Score: 0/3 PASS, 1/3 PARTIAL**

### memory-management Summary

| Dimension | Score |
|-----------|-------|
| Isolation correctness | **Strong** (6/6) |
| Ecosystem awareness | **Weak** (0/3 pass, 1 partial) |
| Combined | The skill excels at its core job but operates in near-complete ecosystem isolation. |

**Key finding:** The skill's crown jewel — the four-tier lookup strategy — works beautifully in isolation. But it never tells the user (or other plugins) about the decoded context's downstream value. After spending effort to decode "ask todd about PSR for oracle" into full context, the skill just says "Now Claude can act with full context" and stops. No handoff suggestions, no downstream notifications.

---

## 2. recall (Command)

**File:** `forge-memory/commands/recall.md` (175 lines)

### Isolation Test Results

| Test ID | Description | Result | Notes |
|---------|-------------|--------|-------|
| isolation-recall-001 | Taxonomy query returns product list | **PASS** | Phase 2, Tier 1 (lines 36-68) explicitly shows `forge memory get-taxonomy products` with JSON parsing. Phase 3 (lines 98-102) shows the taxonomy result template with "Managed via: forge-lib" source notation. |
| isolation-recall-002 | Person query via knowledge entries | **PASS** | Phase 2, Tier 2 (lines 72-84) shows `forge memory query-knowledge --type person`. Phase 3 (lines 104-110) shows knowledge result template with source path. |
| isolation-recall-003 | Glossary term lookup | **PASS** | Lines 151-155 in keyword extraction show "What does PSR mean?" → search for "PSR" in glossary. Tier 2 handles glossary queries. |
| isolation-recall-004 | Not-found triggers remember suggestion | **PASS** | Phase 4 (lines 119-128) explicitly defines: "I don't have that in memory yet. Would you like me to remember it?" with transition to `/memory:remember` workflow. |
| isolation-recall-005 | Partial matches suggest related entries | **PASS** | Phase 5 (lines 130-139) explicitly shows: "I found these related entries: [list]. Did you mean one of these?" |
| isolation-recall-006 | Progressive disclosure stops at first tier | **PASS** | Lines 143-144 state: "Tiered search: Start with taxonomy (fast), expand to knowledge files as needed." Line 146 confirms "Progressive disclosure: Only search deeper tiers if not found in earlier tiers." |

**Isolation Score: 6/6 PASS**

### Ecosystem Test Results

| Test ID | Contract | Description | Result | Level Achieved | Evidence |
|---------|----------|-------------|--------|----------------|----------|
| ecosystem-recall-001 | Contract 2 | Project info suggests Product Forge card creation | **FAIL** | None | Phase 3 (lines 96-117) shows three output templates (taxonomy, knowledge, context) — none include any handoff suggestion. After presenting project info, the output template just shows content + source path. No mention of Product Forge, `/product-forge:create`, or card creation anywhere in the file. |
| ecosystem-recall-002 | Contract 3 | Substantial results suggest Report Forge generation | **FAIL** | None | Same issue. No mention of Report Forge or `/report-forge:generate` anywhere in the 175-line file. The command never suggests generating a report even when rich context is available. |
| ecosystem-recall-003 | Contract 5 | Person info suggests task/card enrichment | **FAIL** | None | No mention of Tasks Forge, Product Forge, or any downstream consumer after presenting recall results. The only handoff is to `/memory:remember` when entries are NOT found (line 128), which is an internal handoff, not cross-plugin. |

**Ecosystem Score: 0/3 PASS**

### recall Summary

| Dimension | Score |
|-----------|-------|
| Isolation correctness | **Strong** (6/6) |
| Ecosystem awareness | **Missing** (0/3) |
| Combined | Excellent search command that never connects its results to the broader ecosystem. |

**Key finding:** Recall is the most natural place for cross-plugin suggestions — when a user asks "tell me about the Phoenix project" and gets rich results, that's the perfect moment to suggest "Would you like to create a Product Forge card for this?" or "There's enough here for a Report Forge deep-dive." This opportunity is completely missed. The command operates as a dead-end information display.

---

## 3. org-context (Skill)

**File:** `forge-memory/skills/org-context/SKILL.md` (170 lines)

### Isolation Test Results

| Test ID | Description | Result | Notes |
|---------|-------------|--------|-------|
| isolation-org-context-001 | Exact taxonomy match resolves | **PASS** | Lines 40-49 show explicit `forge memory get-taxonomy` queries. Lines 53-58 show resolution: "the mobile app" → MobileApp, "Acme" → Acme Corp, "billing stuff" → Billing. |
| isolation-org-context-002 | Fuzzy/informal reference resolves | **PASS** | Lines 154-155 explicitly state fuzzy matching: 'Accept "mobile", "mobile app", "the mobile app" → all resolve to "MobileApp"'. |
| isolation-org-context-003 | Unknown value offers three options | **PASS** | Lines 91-94 explicitly define the three-option pattern: "Should I add it? (Yes / Use it anyway / Enter different value)". On confirmation, calls `forge memory set-taxonomy`. |
| isolation-org-context-004 | Missing taxonomy degrades gracefully | **PASS** | Lines 86-89 explicitly define: accept freeform values, inform about `/memory:setup-org`, offer to add value after workflow. |
| isolation-org-context-005 | Taxonomy suggestion as numbered list | **PASS** | Lines 105-112 show the exact numbered list pattern: "1. WebApp 2. MobileApp 3. API Platform [Enter number or name]". |

**Isolation Score: 5/5 PASS**

### Ecosystem Test Results

| Test ID | Contract | Description | Result | Level Achieved | Evidence |
|---------|----------|-------------|--------|----------------|----------|
| ecosystem-org-context-001 | Contract 2 | Taxonomy addition confirms Product Forge impact | **PARTIAL** | Awareness | Lines 122-127 explicitly name downstream consumers: "Product Forge: Product, module, client fields on cards. Tasks Forge: Related product/module for tasks. Report Forge: Scope reports to specific products/modules." However, this is a static documentation section, not a dynamic output instruction. The skill doesn't instruct the agent to SAY this to the user after adding a taxonomy entry. The missing taxonomy flow (lines 86-94) also doesn't mention Product Forge impact. |
| ecosystem-org-context-002 | Contract 2 | Resolution consistency with product-context | **PASS** | Context Passing | The resolution strategy (lines 53-68) uses the same forge-lib commands and fuzzy matching rules that Product Forge's product-context would use. Both skills call `forge memory get-taxonomy` and apply case-insensitive matching. Since they share the same underlying data source and query mechanism, resolution IS inherently consistent. The overlap concern from the audit is real (both skills do the same thing), but consistency is maintained because they share forge-lib. |
| ecosystem-org-context-003 | IF5 | Taxonomy rename notes downstream impact | **FAIL** | None | The skill covers adding (line 143-145) and removing (line 148-150) taxonomy values but says nothing about propagation impact. No mention of reviewing existing cards, tasks, or reports that reference the old value. |

**Ecosystem Score: 1/3 PASS, 1/3 PARTIAL**

### org-context Summary

| Dimension | Score |
|-----------|-------|
| Isolation correctness | **Strong** (5/5) |
| Ecosystem awareness | **Adequate** (1 pass, 1 partial, 1 fail) |
| Combined | Best ecosystem awareness of the three candidates, but still has gaps in dynamic handoff behavior. |

**Key finding:** org-context is the only component that explicitly names downstream consumers (Product Forge, Tasks Forge, Report Forge on lines 122-127). This is a genuine strength. However, the naming is in a static "Cross-Plugin Usage" documentation section rather than in the operational instructions. The skill doesn't instruct the agent to inform the user about downstream impact when taxonomy changes occur. The static awareness exists but doesn't translate into dynamic behavior.

---

## Ecosystem Contract Compliance

### Contract 1: Slack Forge → Forge Memory (Harvest Promotion)

**Grade: Awareness**

- **Evidence:** The remember command (lines 114-118) handles knowledge entries generically — it would accept a promoted knowledge entry from Slack Forge since it uses the same `forge memory create-knowledge` interface. Slack-eval confirmed promote calls `forge memory create-knowledge {type} "{name}" --data '...'` with person/project/glossary types that match Forge Memory's supported types.
- **Gap:** No explicit acknowledgment that knowledge can come from Slack harvest. The remember command doesn't mention Slack Forge as an input source. The format compatibility is implicit (shared forge-lib), not explicit. Detailed gaps from slack-eval collaboration: (1) provenance fields (source, harvested_on) may not survive forge-lib schema validation since remember only documents type-specific fields, (2) even if provenance survives storage, memory-management never surfaces it during recall — no indication whether an entry came from Slack harvest vs. manual entry, (3) no importance score set during promotion (relies on forge-lib defaults), (4) Contract 6 broken bilaterally — knowledge flows OUT to Memory via promote but nothing flows back IN during Slack capture. Note: the "general" type gap is resolved — promote defaults general→project.
- **Severity:** Medium-High. The contract works by accident (shared forge-lib interface), not by design. The data path functions but provenance is likely lost, importance is uncontrolled, and the round-trip is broken.
- **Slack-eval assessment:** Downgraded from Context Passing (Level 3) to Awareness (Level 1) on their side. Both evaluators agree on the "works by accident" framing. Notably, the memory-hint tag system in the knowledge-harvester (person/project/glossary tags that map to Forge Memory types) shows *architectural intent* to connect these systems — the implementation stopped at the promote command and never reached into the harvester skills (Contract 6) or the memory skills (source awareness). The architecture is ~70% there; the remaining 30% is skill-level awareness on both sides.

### Contract 2: Forge Memory → Product Forge (Taxonomy Reference)

**Grade: Specificity (Forge Memory side) / Awareness (Product Forge side)**

- **Evidence:** org-context lines 122-127 explicitly name Product Forge as a consumer of taxonomy for "Product, module, client fields on cards." The resolution strategy (get-taxonomy + fuzzy matching) produces output directly consumable by Product Forge.
- **Gap (Forge Memory side):** No dynamic notification when taxonomy changes. The awareness is documented but not operationalized.
- **Gap (Product Forge side, confirmed by product-eval):** product-context lacks matching heuristics that org-context provides (no fuzzy matching rules, no case sensitivity guidance, no partial name handling). product-context only queries `products` taxonomy, missing clients/teams/glossary. Resolution depends on which skill fires — org-context produces reliable results via explicit rules, product-context relies on LLM inference.
- **Resolution inconsistency risk:** If org-context fires, "billing stuff" → Billing (explicit rule). If product-context fires, the same term depends on LLM inference. This is inconsistent duplication, not harmless overlap. Recommended fix: product-context should defer to org-context as the authoritative resolver.
- **Severity:** Medium (upgraded from Low). The contract's Forge Memory side is sound, but the Product Forge consumer side has quality gaps that create inconsistent behavior.

### Contract 3: Forge Memory → Report Forge (Context Pull)

**Grade: Awareness**

- **Evidence:** org-context line 125 mentions "Report Forge: Scope reports to specific products/modules." Recall's tiered search produces structured output that a report investigator could theoretically consume.
- **Gap (Forge Memory side):** Recall never suggests generating a report. Memory management never mentions Report Forge. The awareness is a single line in org-context's documentation section.
- **Gap (Report Forge side, confirmed by report-eval):** Report Forge does NOT actively call any Forge Memory commands. The generate command accepts --products, --modules, --clients, --teams as raw string arguments and passes them through to agents as-is with no resolution step. The forge-investigator has zero Forge Memory awareness — it treats entity names as plain strings for filesystem scoping. The only memory references in the entire plugin are vague: forge-analyst line 61 ("organization's own standards if known from memory files") and forge-synthesizer line 131 ("Validate taxonomy — Check related_entities against memory files if they exist") — instructions exist but with no mechanism specified.
- **Bilateral status:** Contract 3 is broken on BOTH sides. Forge Memory doesn't push suggestions to Report Forge, and Report Forge doesn't pull from Forge Memory. The contract exists in CLAUDE.md but is unimplemented by either party.
- **Severity:** Medium-High (upgraded from Medium). "Report Forge pulls context from memory" is entirely aspirational — neither side has any mechanism to fulfill this contract.

### Contract 5: Proactive Handoff Suggestions

**Grade: Missing (for most components) / Awareness (for org-context)**

- **Evidence:** org-context's cross-plugin section (lines 122-127) is the only proactive mention of downstream consumers. Remember, recall, triage, and setup-org have zero handoff suggestions.
- **Gap per component:**
  - **remember:** No mention of downstream availability after saving (should say "now available for Product Forge card enrichment")
  - **recall:** No suggestion to create cards or reports from rich results
  - **setup-org:** Final report (line 237) says "Your taxonomy is now available to all commands" but doesn't name specific plugins
  - **triage:** No mention of downstream impact when archiving/deleting entries
- **Severity:** High. This is the #1 ecosystem gap. The foundational plugin — whose entire purpose is to serve other plugins — never tells users how its outputs connect to the rest of the Forge.

### Contract 6: Memory-First Resolution

**Grade: Awareness**

- **Evidence:** memory-management's description mentions "decoding workplace shorthand, acronyms, and internal language" which covers the memory-first resolution intent. The tiered lookup strategy is exactly what Contract 6 requires.
- **Gap:** The description isn't "pushy" enough to independently trigger when other plugins encounter unknown terms. It works when explicitly invoked but wouldn't reliably fire on "Create a story for the PSR dashboard" — the model would more likely trigger Product Forge directly.
- **Bilateral confirmation from tasks-eval:** Tasks Forge has zero memory awareness — no taxonomy queries, no recall checks, no mention of Forge Memory anywhere in ~484 lines. Contract 6 graded Level 0 (Absent) on the Tasks Forge side. Even if memory-management's triggering were fixed, Tasks Forge has no mechanism to consume the resolved context.
- **Bilateral confirmation from slack-eval:** Neither task-harvester nor knowledge-harvester checks Forge Memory during extraction. Contract 6 broken on the Slack Forge side as well.
- **Severity:** High. This is both a triggering issue (Forge Memory side) AND an implementation absence (Tasks Forge, Slack Forge sides). Contract 6 is the most broadly broken contract in the ecosystem — the directive exists in CLAUDE.md but is unimplemented across most plugins.

### IF5: Taxonomy Change Propagation

**Grade: Missing**

- **Evidence:** No component mentions downstream propagation when taxonomy is modified, renamed, or archived. setup-org, org-context, and triage all modify taxonomy without noting impact on existing content in other plugins.
- **Gap:** After renaming "Payments" to "Payment Processing," no mention of reviewing Product Forge cards or Tasks Forge tasks that reference the old name.
- **Severity:** Medium. This is an implied flow (not explicit in CLAUDE.md) but is important for data consistency.

---

## Cross-Teammate Findings

### Collaboration Status

Messages sent to all four counterpart teammates:
- **product-eval:** Shared taxonomy resolution terms for cross-testing (WebApp, billing stuff, mobile app, Acme, PSR, Phoenix project)
- **slack-eval:** Asked about promote command format for knowledge entries
- **tasks-eval:** Asked about Slack source acknowledgment and taxonomy query behavior
- **report-eval:** Asked about entity resolution format expectations

**Responses received from:** product-eval, slack-eval, report-eval, rovo-eval.

### Collaboration Finding 1: org-context / product-context Overlap (product-eval)

The audit flagged that Product Forge's product-context skill and Forge Memory's org-context skill both claim to resolve taxonomy. Initial analysis suggested the overlap was "wasteful but not harmful." **Product-eval's detailed term-by-term analysis revealed the gap is worse than expected — the inconsistency is real, not theoretical.**

**org-context has explicit matching heuristics:**
- Fuzzy matching: "billing stuff" → Billing (line 58)
- Case-insensitive, partial word matching (line 115)
- Concrete examples: "mobile", "mobile app", "the mobile app" → all resolve to "MobileApp" (lines 154-155)
- Queries ALL six taxonomy types (products, modules, systems, clients, teams, integrations)

**product-context lacks these heuristics (confirmed by product-eval):**
- No fuzzy matching rules — relies entirely on LLM inference
- No case sensitivity guidance
- No partial name handling
- Only queries `products` taxonomy in the create command, NOT clients/teams/glossary

**Concrete inconsistency scenario:** User says "Create a story for billing stuff for Acme." If org-context fires: "billing stuff" → Billing (explicit rule), "Acme" → Acme Corp (explicit partial match). If product-context fires: both terms depend on LLM inference with no guarantee of the same result, and "Acme" is missed entirely since product-context only queries products taxonomy (not clients).

**This is worse than simple duplication — it's inconsistent duplication.** The outcome depends on which skill activates, which the user cannot control.

**Recommended fix:** org-context should be the authoritative taxonomy resolver (Option A: product-context defers to org-context for all resolution). This avoids maintaining two sets of matching rules. Option B (aligning product-context to org-context's heuristics) creates ongoing sync burden.

Additionally, product-eval confirmed that PSR (a glossary term) would NOT be found by product-context's `get-taxonomy` call alone — full tiered lookup via memory-management is required for Contract 6 compliance with acronyms.

### Collaboration Finding 2: Contract 1 Schema Alignment (slack-eval)

Slack Forge's promote command calls `forge memory create-knowledge {type} "{name}" --data '{"source": "slack-forge harvest from #{channel}", "harvested_on": "{date}"}'`. Detailed schema from slack-eval's second message:

- **Type mapping:** The knowledge-harvester sets the FIRST tag as a memory-hint destination (person, project, glossary, or general). The promote command maps: person→person, project→project, glossary→glossary, **general→defaults to project**. This resolves the "general has no target" gap — the promote command handles the fallback itself.
- **All 4 type mappings now accounted for:** 3 direct matches + general→project fallback
- **No importance score set:** Promote relies entirely on forge-lib defaults. Unlike task promotion (which maps confidence→priority), knowledge promotion has no confidence→importance mapping. New entries start at whatever forge-lib's default importance is.
- **Provenance fields (source, harvested_on) are uncertain:** Forge Memory's remember command only documents type-specific fields (role/team/context for person, description/status/people for project, definition/context for glossary). Whether `create-knowledge` accepts and preserves arbitrary extra fields depends on forge-lib's schema validation — if strict, provenance is silently dropped.
- **Provenance surfacing gap:** Even if source/harvested_on survive storage, memory-management's recall flow (lines 78-100) never mentions surfacing provenance metadata. When a user asks "who is Todd?" and gets a recalled entry, there's no indication it came from a Slack harvest vs. manual entry.
- **Bilateral Contract 6 gap confirmed:** Slack harvesters don't check Memory during extraction (no round-trip). Knowledge flows OUT to Forge Memory via promote, but nothing flows back IN during capture.
- **One-sided awareness risk:** If Forge Memory adds Slack Forge acknowledgments but Slack harvesters aren't fixed, the ecosystem has asymmetric awareness — Memory knows about Slack but Slack doesn't know about Memory.

### Collaboration Finding 3: Flat Taxonomy Limitation (rovo-eval, report-eval)

Both rovo-eval and report-eval independently hit the same data model ceiling: taxonomy stores flat lists with no entity relationships. Rovo Forge cannot determine which Jira projects belong to a team. Report Forge's Investigator cannot scope by product-to-module ownership. This is a systemic finding affecting any plugin that needs organizational structure beyond name resolution. (Details in Priority 6 recommendation below.)

### Collaboration Finding 4: Report Forge Handoff Absent (report-eval)

Report-eval confirmed that their Investigator agent needs taxonomy data for scoping. Forge Memory's recall and remember commands have zero Report Forge handoff suggestions — confirmed as a bilateral gap. The data format (JSON arrays) is consumable, but the proactive suggestion is absent.

### Collaboration Finding 5: Tasks Forge Has Zero Memory Awareness (tasks-eval)

Tasks-eval confirmed the handoff is completely broken on the Tasks Forge side:
- **Zero mentions** of "Memory", "taxonomy", "recall", "acronym", or any `/forge-memory:*` command in the entire Tasks Forge plugin (~484 lines across skill + 3 commands)
- **add command does NOT query taxonomy:** Gathers title/description/priority/due_date interactively, calls `forge task create` directly with no memory lookup
- **Contract 6 graded Level 0 (Absent)** by tasks-eval — the CLAUDE.md behavioral directive for memory-first resolution is completely unimplemented

This means org-context's claim that "Tasks Forge: Related product/module for tasks" (line 122) is **aspirational, not actual**. The claim documents an intended design, but Tasks Forge has no mechanism to consume taxonomy. This is a bilateral broken handoff:
- Forge Memory side: org-context claims Tasks Forge is a consumer (correct intent, no enforcement)
- Tasks Forge side: No code or instructions to query taxonomy (zero implementation)

**Impact on Forge Memory test cases:**
- ecosystem-remember-001 (remember notes availability for Tasks Forge) — even if Forge Memory adds this suggestion, Tasks Forge cannot act on it
- org-context's cross-plugin section would be making a promise that Tasks Forge cannot fulfill

---

## Recommended Improvements

### Priority 1: Add Cross-Plugin Handoff Suggestions (All Components)

**remember command** — After saving, add:
```
This [person/project/term] is now available for:
- Product Forge card enrichment
- Report Forge scoping
- Slack Forge context during harvests
- Rovo Forge agent scoping (team/product context)
```

**recall command** — After presenting results, add conditional suggestions:
- Project info → "Would you like to create a Product Forge card? → /product-forge:create"
- Rich multi-source results → "Enough context for a focused report → /report-forge:generate"
- Person info → "This person's context is available for tasks and cards"

**setup-org command** — In the final report, change "available to all commands" to name specific plugins:
```
Product Forge cards and Report Forge reports will now validate against this taxonomy.
Tasks Forge task creation can reference these products and modules.
Rovo Forge agent builders can use team and product names for scoping.
```

**org-context Cross-Plugin Usage section** (lines 122-127) — Add Rovo Forge to the consumer list:
```
- Rovo Forge: Team and product context for agent scoping
```
Currently lists Product Forge, Tasks Forge, and Report Forge but omits Rovo Forge entirely. This is a quick win — adding one line to acknowledge an existing consumer.

**triage command** — After archive/delete actions, add:
```
Note: Reports or cards referencing [archived entry] may need updating.
```

### Priority 2: Description Optimization for Independent Triggering

**memory-management** — Current description:
> "Tiered memory lookup strategy for decoding workplace shorthand, acronyms, and internal language."

Suggested improvement:
> "Decodes workplace shorthand, acronyms, nicknames, and internal language into full context. Activates when the user mentions people, projects, or terms by informal names — even if they don't explicitly ask for a definition. Also triggers when other plugins encounter unrecognized entity names that need resolution."

**org-context** — Current description:
> "Organizational taxonomy provides validated vocabulary for all commands."

Suggested improvement:
> "Resolves informal product, team, client, and module references to canonical names using organizational taxonomy. Activates when any command needs to validate an entity name — even if the user doesn't explicitly mention taxonomy or org context."

### Priority 3: Extract Shared Reference Files

Create `forge-memory/skills/memory-management/references/lifecycle-scoring.md` containing:
- Importance score ranges (0-100)
- Decay mechanics
- Boost-on-recall (+5)
- Threshold definitions (sunset <10, probationary 10-39, trusted 40+)
- Triage-keep boost (+20)

This content is duplicated between memory-management and triage, and would also benefit recall's lifecycle-aware search.

### Priority 4: Add Pre-Save Confirmation to Remember

The remember command (Phase 3) goes directly from gathering details to saving via forge-lib. Add a confirmation gate:
```
Here's what I'll remember:

**Todd Martinez** (Person)
- Role: Finance lead
- Team: Finance
- Context: Owns PSR process, prefers Slack

Save this? (Yes / Edit / Cancel)
```

### Priority 5: IF5 — Taxonomy Change Propagation

Add to org-context and setup-org: when taxonomy values are renamed or removed, note which plugin content may reference the old value and suggest reviewing it.

### Priority 6: Flat Taxonomy Data Model Limitation

**Discovered via rovo-eval collaboration.** Forge Memory's taxonomy stores flat lists with no entity relationships. Teams, products, modules, and integrations are independent arrays with no cross-references (e.g., no mapping from "Payments Team" → Jira project PAY → Confluence space /payments). This means:

- Rovo Forge cannot determine which Jira projects or Confluence spaces belong to a team
- Product Forge cannot determine which modules belong to which product
- Report Forge cannot scope investigations by team ownership

The knowledge tier (people profiles, project files in `memory/`) contains some of this relationship data as unstructured markdown, but it's not programmatically queryable via forge-lib. org-context's downstream consumer list (lines 122-127) also omits Rovo Forge entirely.

**Impact:** Any plugin needing organizational *structure* beyond name resolution hits a data model ceiling. This is a structural limitation, not a skill-level failure, but it bounds how much value downstream plugins can extract from Forge Memory.

**Possible fix:** Extend taxonomy to support entity relationships (e.g., team-to-module ownership, product-to-Jira-project mappings). This would be a forge-lib schema change, not a skill change.

---

## Summary Scorecard

| Component | Isolation Score | Ecosystem Score | Overall |
|-----------|----------------|-----------------|---------|
| memory-management | **Strong** (6/6) | **Weak** (0/3 pass) | Excellent core, ecosystem-blind |
| recall | **Strong** (6/6) | **Missing** (0/3) | Dead-end information display |
| org-context | **Strong** (5/5) | **Adequate** (1/3 pass, 1 partial) | Best ecosystem awareness, still has gaps |

| Contract | Grade | Key Gap |
|----------|-------|---------|
| 1 (Slack → Memory) | Awareness | No acknowledgment of Slack as input source |
| 2 (Memory → Product) | Specificity | Static docs, not dynamic behavior |
| 3 (Memory → Report) | Awareness | Single line mention, no active handoff |
| 5 (Proactive Handoff) | Missing/Awareness | #1 gap — foundational plugin never connects outputs |
| 6 (Memory-First) | Awareness | Triggering too weak for independent activation |
| IF5 (Taxonomy Propagation) | Missing | No downstream impact notification |

**Bottom line:** Forge Memory's core competency — the tiered lookup strategy — is excellent. Every isolation test passes. The plugin knows how to decode, resolve, search, and manage knowledge. But it operates as an island: it never tells users how its outputs flow into Product Forge cards, Report Forge reports, Tasks Forge tasks, or Slack Forge harvests. For the "shared brain" of the ecosystem, this isolation is the critical gap to fix.
