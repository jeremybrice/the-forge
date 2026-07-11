# Forge Ecosystem Evaluation Report

**Date:** 2026-03-09
**Phase:** 4 — Behavioral Evaluation (following Phase 3 Structural Audit)
**Methodology:** Agent team with 7 evaluators + team lead, using Skill Creator eval pipeline
**Framework:** 10-dimension rubric + 4-level ecosystem grading scale + bilateral contract verification
**Model:** Claude Opus 4.6

---

## Executive Summary

The Forge marketplace is a collection of **individually excellent plugins that do not talk to each other.** Across 7 plugins, 25 eval candidates, and 166 test cases, isolation quality averages 82% — the plugins do what they claim, with well-specified workflows, strong procedural logic, and clean forge-lib delegation. But ecosystem quality averages **7%**. Of 11 ecosystem contracts defined in CLAUDE.md and implied by architecture, **zero are fully implemented on both sides.** The workspace-level directive "Always check Forge Memory first" (Contract 6) is unimplemented across 5 of 7 plugins. The one contract that appeared functional (Contract 1: Slack → Tasks promotion) was found to have a **runtime bug** — priority type mismatch — that would cause every promoted task to fail validation.

The evaluation surfaced three categories of findings:

1. **Skill-text gaps** (editorial fixes, ~50-100 lines per plugin): Missing handoff suggestions, missing memory-first resolution, missing downstream awareness. These are the majority of findings and the easiest to fix.

2. **Forge-lib schema limitations** (data model changes required): Task schema lacks provenance fields, memory taxonomy is flat (no entity relationships), priority type mismatch between Slack promote and task schema. These require forge-lib changes before downstream skill fixes can be effective.

3. **Missing features** (new code required): Rovo Forge has no agent testing framework, Report Forge references 8 non-existent template files, a removed harvest plugin harvesters have no unresolved-discussion detection.

The agent team methodology proved its value: **12 findings were discovered exclusively through bilateral teammate collaboration** that would have been invisible to isolated evaluation, including the runtime priority type mismatch bug, the hidden `parent` field in the task schema, and the flat taxonomy ceiling that three independent evaluators converged on.

---

## Per-Plugin Eval Scores

| Plugin | Isolation | Ecosystem | Combined (70/30) | Eval Candidates | Test Cases |
|--------|-----------|-----------|-------------------|-----------------|------------|
| **Forge Memory** | 100% (17/17) | 7% (1/9 + 1 partial) | ~72% | 3 | 18 isolation + 9 ecosystem |
| **Tasks Forge** | 80% (8/10) | 0% (0/7) | 47% | 2 | 10 isolation + 7 ecosystem |
| **Product Forge** | 100% (32/32) | 21% (5.5/17) | 71% | 5 | 32 isolation + 15 ecosystem |
| **Cognitive Forge** | 100% (all pass) | 0% (0/6) | ~70% | 3 | 18 isolation + 10 ecosystem |
| **Report Forge** | 88% (avg 8.8/10) | 16% (avg 1.6/10) | 66% | 3 | 15 isolation + 7 ecosystem |
| **a removed harvest plugin** | 83% (avg 8.3/10) | 25% (avg 2.5/10) | 63% | 5 | 19 isolation + 12 ecosystem |
| **Rovo Forge** | 34% (2 pass/4 partial/5 fail) | 0% (0/6) | 25% | 5 | 11 isolation + 6 ecosystem |
| **Ecosystem Average** | **82%** | **7%** | **59%** | **26** | **123 isolation + 66 ecosystem** |

### Isolation Highlights

- **Product Forge** achieves perfect 100% across all 32 isolation test cases — the orchestrator/agent architecture is the crown jewel of the Forge
- **Forge Memory** achieves perfect 100% — the tiered lookup strategy works exactly as specified
- **Cognitive Forge** achieves 100% — debate orchestration, dialogue governance, and evidence grounding all pass
- **Rovo Forge** is the outlier at 34% — missing agent testing framework (0%), unsurfaced deep research capability, validation without remediation guidance

### Ecosystem Highlights

- **a removed harvest plugin promote command** is the only component that achieved Context Passing (Level 3) intent — though this was downgraded after bilateral verification revealed runtime bugs
- **Product Forge** achieves partial credit on Contract 2 (taxonomy reference via product-context skill indirection)
- **Every other plugin** scores Level 0 (Missing) or Level 1 (Awareness) on all ecosystem contracts

---

## Ecosystem Contract Scorecard

### Grading Scale
- **Level 0 — Missing**: No reference to the contract partner
- **Level 1 — Awareness**: Mentions the partner plugin but without specific commands
- **Level 2 — Specificity**: Names the specific command to invoke with enough context to act
- **Level 3 — Context Passing**: Provides information in a format directly consumable by the downstream plugin
- **Level 4 — Automatic Flow**: Automatically invokes the downstream plugin (with user confirmation)

### Explicit Contracts (from CLAUDE.md)

| Contract | Description | Side A | Level | Side B | Level | Status |
|----------|-------------|--------|-------|--------|-------|--------|
| **C1** | Slack → Tasks (task promotion) | a removed harvest plugin promote | **BROKEN** (runtime bug: priority string/int mismatch) | Tasks Forge | Level 0 (absent) | **Runtime bug + absent** |
| **C1** | Slack → Memory (knowledge promotion) | a removed harvest plugin promote | Level 1 (provenance uncertain, general type gap) | Forge Memory | Level 1 (no receive pathway) | **Weak both sides** |
| **C2** | Memory → Product (taxonomy reference) | Forge Memory org-context | Level 2 (static docs, not dynamic) | Product Forge product-context | Level 1 (queries taxonomy but misses glossary) | **Partial, inconsistent** |
| **C3** | Report → Product+Memory (context pull) | Report Forge investigator | Level 1 (mentions cards, no paths) | Product Forge | Level 0 (no Report Forge mention) | **Weak + absent** |
| **C3** | Report → Memory (taxonomy scoping) | Report Forge investigator | Level 1 (mentions limiting scope) | Forge Memory | Level 1 (single-line mention) | **Weak both sides** |
| **C4** | Cognitive → Product (decision cards) | Cognitive Forge debate | Level 0 (no Product Forge mention) | Product Forge forge-decision | Level 0 (no session ingestion) | **Absent both sides** |
| **C4** | Cognitive → Tasks (task priorities) | Cognitive Forge explore | Level 0 (no Tasks Forge mention) | Tasks Forge | Level 0 + schema blocker | **Absent both sides + blocked** |
| **C5** | Proactive Handoff (all plugins) | — | Level 0-1 across all | — | Level 0 across all | **Systemic failure** |
| **C6** | Memory-First Resolution (all plugins) | Forge Memory (supply) | Level 1 (weak triggering) | All consumers | Level 0 (5 of 6 plugins) | **Systemic failure** |

### Implied Flows (from audit findings)

| Contract | Description | Side A | Level | Side B | Level | Status |
|----------|-------------|--------|-------|--------|-------|--------|
| **IF1** | Jira Sync Loop (Product self) | push-to-jira | Level 0 | pull-from-jira | Level 0 | **Absent (self-contract)** |
| **IF2** | Slack → Cognitive (discussion → debate) | a removed harvest plugin knowledge-harvester | Level 0 | Cognitive Forge debate | Level 0 | **Absent both sides** |
| **IF3** | Report → Cognitive (analysis → exploration) | Report Forge synthesizer | Level 0 | Cognitive Forge | Level 0 | **Absent both sides** |
| **IF4** | Tasks → Report (triage → status reports) | Tasks Forge triage | Level 0 | Report Forge generate | Level 1 (flexible intake) | **Absent + incidental** |
| **IF5** | Memory → All (taxonomy propagation) | Forge Memory | Level 0 | — | — | **Absent** |

### Contract Summary

| Level | Count | Percentage |
|-------|-------|------------|
| Level 0 — Missing | 14 contract-sides | 64% |
| Level 1 — Awareness | 7 contract-sides | 32% |
| Level 2 — Specificity | 1 contract-side | 4% |
| Level 3 — Context Passing | 0 | 0% |
| Level 4 — Automatic Flow | 0 | 0% |

**No contract achieves Level 3 or Level 4 from any side.** 64% of contract-sides are completely absent.

---

## Broken Handoff Inventory

### Critical (Runtime Bugs / Schema Blockers)

| # | Handoff | Finding | Fix Required | Discovered By |
|---|---------|---------|-------------|---------------|
| 1 | **Slack promote → Tasks Forge** | Priority passed as string ("High") but schema requires integer (1-5). Every promoted task fails validation. | Fix promote command mapping: high→2, medium→3, low→4 | tasks-eval + slack-eval |
| 2 | **Task schema provenance** | `additionalProperties: false` with no `source`/`provenance` field. Cross-plugin task origin tracking is structurally impossible. `external_id`/`external_link` in SKILL.md are dead code (rejected by schema). | Add `source` and `provenance` fields to forge-lib task schema | tasks-eval + cognitive-eval |
| 3 | **Slack promote → Memory** | `general` memory-hint type has no target in Memory. Provenance fields (`source`, `harvested_on`) may be silently dropped. | Verify forge-lib preserves extra fields; document general→project fallback | slack-eval + memory-eval |

### High Priority (Systemic Ecosystem Gaps)

| # | Handoff | Finding | Fix Required | Impact |
|---|---------|---------|-------------|--------|
| 4 | **Contract 6 — Memory-First Resolution** | CLAUDE.md directive unimplemented across 5 of 7 plugins. Both supply-side (Memory triggering too weak) and demand-side (consumers don't query). | Bilateral: pushier Memory descriptions + memory-first instructions in all consumer plugins | All plugins |
| 5 | **Contract 5 — Proactive Handoff** | Zero plugins suggest downstream actions after completing work. Every command is a dead end. | Add post-action next-step suggestions to all command confirmation templates | All plugins |
| 6 | **Contract 4 — Decision → Action** | Cognitive Forge debate synthesis maps naturally to decision cards and tasks, but neither side connects. forge-decision agent can't read session files. Task schema blocks provenance. | Handoff text in Cognitive commands + session reading in forge-decision agent | Cognitive + Product + Tasks |
| 7 | **Contract 1 — Tasks Forge side** | Tasks Forge has zero awareness of a removed harvest plugin as a task source across ~484 lines. Even the `parent` field (which could link to stories) is undocumented in the skill. | Add ecosystem connections section to task-management SKILL.md | Tasks Forge |

### Medium Priority (Data Model Limitations)

| # | Handoff | Finding | Fix Required | Impact |
|---|---------|---------|-------------|--------|
| 8 | **Flat taxonomy ceiling** | Memory taxonomy stores flat lists with no entity relationships. Can't express team→project, product→module, or team→Jira-space mappings. | Extend forge-lib taxonomy to support entity relationships | All downstream consumers |
| 9 | **Report Forge missing templates** | Synthesizer references 8 template files and a `report-routing` skill that don't exist. Implicit fallback works but creates confusion. | Create templates OR formalize Synthesis Strategies as primary guide | Report Forge |
| 10 | **product-context / org-context overlap** | Both skills claim taxonomy resolution. Both use same forge-lib interface. Consistent results but unclear which fires when. PSR (glossary term) missed by product-context. | Merge or explicitly delineate roles | Product Forge + Forge Memory |

### Low Priority (Missing Features)

| # | Handoff | Finding | Fix Required | Impact |
|---|---------|---------|-------------|--------|
| 11 | **Rovo Forge agent testing** | No Phase 12 for testing. Users create agent configs with zero guidance on verification. | Add testing framework to both builder commands | Rovo Forge |
| 12 | **IF2 — unresolved discussion detection** | Slack knowledge-harvester can't distinguish resolved decisions from unresolved debates. No Cognitive Forge suggestion. | Add detection heuristic + `/cognitive-forge:debate` suggestion | Slack + Cognitive |
| 13 | **Triage structured output** | Tasks Forge triage discards forge-lib's structured JSON and outputs only summary counts. No pattern detection. | Add pattern detection + structured findings + Report Forge suggestion | Tasks + Report |

---

## Forge-lib Schema Improvements Required

These findings are **not addressable through skill-text changes alone**. They require forge-lib data model updates.

| # | Schema | Change | Rationale | Blocking |
|---|--------|--------|-----------|----------|
| 1 | `task.json` | Add `source` field (string, optional) | Enable cross-plugin provenance tracking | Contract 1, Contract 4 |
| 2 | `task.json` | Add `provenance` object (optional, with `plugin`, `entity_id`, `timestamp`) | Rich provenance for promoted/generated tasks | Contract 1, Contract 4 |
| 3 | `task.json` | Either add `external_id`/`external_link` to schema or remove from SKILL.md | Resolve dead code inconsistency | Task-management skill integrity |
| 4 | `taxonomy` | Add relationship support (team→projects, product→modules) | Enable intelligent downstream consumption beyond name resolution | IF5, Rovo Forge, Report Forge scoping |
| 5 | `knowledge` schema | Verify preservation of arbitrary `--data` fields | Determine if Slack promote provenance survives storage | Contract 1 (knowledge side) |

---

## Ranked Improvement Priorities

Ordered by maximum ecosystem impact, accounting for fix effort and dependency chains.

### Tier 1: Fix Before Anything Else (Blockers)

| Priority | Fix | Effort | Impact | Plugins Affected |
|----------|-----|--------|--------|-----------------|
| **P1** | Fix Slack promote priority type mismatch (string→integer) | Trivial (1 line) | Unblocks entire task promotion pipeline | a removed harvest plugin |
| **P2** | Add `source` field to task schema in forge-lib | Low (schema change) | Unblocks provenance tracking for Contracts 1, 4 | forge-lib → all |
| **P3** | Verify forge-lib preserves extra `--data` fields in knowledge creation | Investigation | Determines if Contract 1 knowledge provenance is preserved or lost | forge-lib |

### Tier 2: Highest ROI Skill-Text Fixes

| Priority | Fix | Effort | Impact | Plugins Affected |
|----------|-----|--------|--------|-----------------|
| **P4** | Add post-action handoff suggestions to all command confirmations (Contract 5) | Medium (~30 lines per plugin) | Addresses the most broadly broken contract across all 7 plugins | All |
| **P5** | Add memory-first resolution instructions to all consumer plugins (Contract 6) | Medium (~10 lines per plugin) | Implements the most widely violated CLAUDE.md directive | Tasks, Slack, Cognitive, Report, Rovo |
| **P6** | Optimize memory-management and org-context descriptions for independent triggering | Low (description text) | Enables Contract 6 supply-side (Memory actually fires when needed) | Forge Memory |
| **P7** | Add post-synthesis handoff blocks to Cognitive Forge debate + explore | Low (~30 lines total) | Creates Contract 4 pathway (decision→cards, actions→tasks) | Cognitive Forge |

### Tier 3: Important Structural Fixes

| Priority | Fix | Effort | Impact | Plugins Affected |
|----------|-----|--------|--------|-----------------|
| **P8** | Add Jira sync loop suggestions to push/pull commands (IF1) | Low (~4 lines total) | Completes the bidirectional sync awareness | Product Forge |
| **P9** | Resolve product-context / org-context overlap | Medium (delineation or merge) | Eliminates inconsistent taxonomy resolution | Product + Memory |
| **P10** | Create Report Forge templates OR formalize fallback | Medium (8 files or edit existing) | Fixes synthesizer's broken primary instruction path | Report Forge |
| **P11** | Add Rovo Forge agent testing framework (Phase 12) | Medium (~50 lines per command) | Addresses 0% score on agent testing | Rovo Forge |
| **P12** | Document `parent` field in task-management skill | Low (~5 lines) | Enables Product Forge→Tasks Forge story linking with zero schema changes | Tasks Forge |

### Tier 4: Data Model Enhancements

| Priority | Fix | Effort | Impact | Plugins Affected |
|----------|-----|--------|--------|-----------------|
| **P13** | Extend taxonomy to support entity relationships | High (forge-lib redesign) | Removes flat taxonomy ceiling for all downstream consumers | forge-lib → all |
| **P14** | Add unresolved-discussion detection to Slack knowledge-harvester | Medium (~15 lines) | Creates IF2 pathway (complex discussions → debate) | Slack + Cognitive |
| **P15** | Add pattern detection to Tasks Forge triage | Medium (~20 lines) | Creates IF4 pathway (systemic issues → status reports) | Tasks + Report |

---

## Comparison with Structural Audit Findings

The behavioral evaluation **confirms, expands, and in one case contradicts** the structural audit's findings.

### Confirmed

| Structural Audit Finding | Behavioral Evidence |
|--------------------------|-------------------|
| "Cross-plugin handoff is the #2 systemic weakness" | **Confirmed and promoted to #1.** Ecosystem scores average 7%. Zero contracts at Level 3+. |
| "Description triggering is consistently underpowered" | **Confirmed.** memory-management won't trigger on "what does PSR mean?", task-management won't trigger on "what should I work on?" |
| "forge-lib delegation is the #1 systemic strength" | **Confirmed.** Every plugin cleanly separates reasoning from execution. All isolation passes depend on correct forge-lib delegation. |
| "Missing reference files is the #1 structural gap" | **Confirmed.** Report Forge's 8 missing templates are a real functional gap. Transcript format lives inline in scan command with no shared reference. |
| "Agent architecture quality is high" | **Confirmed.** Product Forge orchestrator/agent pattern, Cognitive Forge multi-agent debate, Report Forge investigator pipeline all pass isolation at 90%+. |

### Expanded

| Structural Audit Finding | Behavioral Expansion |
|--------------------------|---------------------|
| "Tasks Forge operates in near-total isolation" | **Expanded:** Not just missing handoff text — the task schema structurally blocks provenance tracking. `external_id`/`external_link` in SKILL.md are dead code rejected by schema. But `parent` field exists undocumented. |
| "a removed harvest plugin cross-plugin integration is documented" | **Expanded then contradicted:** The promote command's integration appeared to be Level 3, but bilateral verification revealed priority type mismatch (runtime bug), uncertain provenance preservation, and `general` type gap. The "best" ecosystem integration is actually broken. |
| "product-context overlaps with org-context" | **Expanded:** Both use same forge-lib interface (consistent results), but product-context only queries `products` taxonomy — misses glossary terms like PSR. A user asking about "PSR" gets different behavior depending on which skill fires. |

### Contradicted

| Structural Audit Finding | Behavioral Contradiction |
|--------------------------|------------------------|
| "a removed harvest plugin has critical blocking gaps that must be resolved before reliable operation" | **Partially contradicted.** Isolation scores are 83-90% for the harvesters — they operate reliably for their core extraction job. The "critical" gaps are ecosystem gaps (no memory resolution, no cognitive handoff), not operational ones. The one true operational blocker is the promote command's priority type mismatch, which the structural audit did not identify. |

### New Findings (not in structural audit)

| Finding | Source | Significance |
|---------|--------|-------------|
| Priority string/int mismatch in promote→task | tasks-eval + slack-eval collaboration | **Highest-severity finding** — runtime bug causing silent data loss |
| Task schema has undocumented `parent` field | tasks-eval + product-eval collaboration | **Positive finding** — enables story linking with zero schema changes |
| Flat taxonomy limits all downstream consumers | memory-eval + rovo-eval + report-eval | **Systemic finding** — data model ceiling on ecosystem integration |
| forge-decision agent can't read session files | cognitive-eval + product-eval | **Contract 4 is blocked** at Level 2 until agent gains file reading |
| Triage discards structured data in summary | tasks-eval + report-eval | **IF4 requires three changes** — pattern detection, structured output, Report Forge suggestion |

---

## Collaboration Insights

### What Agent Teams Discovered That Isolated Evaluation Would Have Missed

The team approach produced **12 bilateral findings** that no single evaluator could have identified:

1. **Priority type mismatch** (tasks-eval + slack-eval): Slack sends strings, schema requires integers. Neither side's isolated tests would catch this — Slack's promote tests pass (correct CLI call), and Tasks' schema tests pass (correct validation). Only comparing the actual values across the boundary reveals the bug.

2. **Hidden `parent` field** (tasks-eval + product-eval): Product-eval asked about story linking, tasks-eval investigated the schema and found an undocumented field. Isolated Task evaluation would never test for Product Forge features.

3. **Flat taxonomy ceiling** (memory-eval + rovo-eval + report-eval): Three independent evaluators hit the same data model limit from different angles (agent scoping, report scoping, and entity relationships). Convergence from three directions gives high confidence this is a real architectural constraint.

4. **PSR glossary gap** (memory-eval + product-eval): Memory-eval confirmed PSR is a glossary term. Product-eval confirmed product-context only queries `products` taxonomy, not glossary. The resolution failure only manifests at the boundary.

5. **General type gap** (slack-eval + memory-eval): Slack promote defaults `general` to `project` — a fallback invisible to the Slack side alone (it just works) and invisible to the Memory side alone (it never receives `general` type).

6. **Provenance field uncertainty** (slack-eval + memory-eval): Whether `source` and `harvested_on` survive forge-lib storage depends on schema strictness — a question neither evaluator could answer alone but both identified as critical.

7. **Dead code in task schema** (tasks-eval + cognitive-eval): Cognitive-eval asked about task compatibility, tasks-eval checked the actual schema and found `external_id`/`external_link` are rejected. The skill documents features the schema prohibits.

8. **Contract 4 bilateral block** (cognitive-eval + product-eval): Debate synthesis maps naturally to decision card fields, but forge-decision agent can only read conversation context, not session files. Both sides have the right *shapes* but no *connection*.

9. **org-context aspirational claims** (memory-eval + tasks-eval): org-context claims Tasks Forge consumes taxonomy. Tasks-eval confirmed this is aspirational — zero implementation on the Tasks Forge side. Adding handoff suggestions to Memory would make promises Tasks Forge can't fulfill.

10. **IF4 deeper than expected** (tasks-eval + report-eval): Triage discards structured forge-lib JSON into summary counts. Report Forge has no task-aware investigation strategy. Fixing IF4 requires changes on both sides plus potentially a new forge-lib aggregation feature.

11. **Contract 3 card path gap** (report-eval + product-eval): Report Forge's investigator is told to "read cards for context" but has no directory paths, field names, or parsing guidance. Product-eval provided the actual path structure (`cards/{type}s/{filename}.md`), revealing the operational gap.

12. **IF3 easiest fix** (report-eval + cognitive-eval): cognitive-eval confirmed debate/explore accept freeform topics. Simply adding a suggestion text to Report Forge recommendations creates a functional one-way handoff with zero changes on the Cognitive Forge side.

### Methodology Validation

The agent team approach costs more than isolated sub-agents (7 full evaluators × 4 phases + extensive messaging) but produced categorically different results:

- **Isolated evaluation** would have scored a removed harvest plugin's promote command at Level 3 (Context Passing) and called it the ecosystem's success story. Bilateral verification revealed it's broken at runtime.
- **Isolated evaluation** would have recommended "add handoff text" for Contract 4 without discovering the task schema blocker that makes Level 3 structurally impossible.
- **Isolated evaluation** would have missed the `parent` field entirely — a positive finding that enables Product→Tasks linking with zero schema changes.

The collaboration overhead (Phase 3 messaging) added approximately 20% to total evaluation time but surfaced 100% of the cross-boundary findings. For ecosystem evaluation specifically, this is a strong ROI.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Plugins evaluated | 7 |
| Eval candidates tested | 26 |
| Total test cases | 189 (123 isolation + 66 ecosystem) |
| Isolation pass rate | 82% |
| Ecosystem pass rate | 7% |
| Contracts at Level 0 (Missing) | 64% of contract-sides |
| Contracts at Level 3+ | 0% |
| Bilateral findings from collaboration | 12 |
| Runtime bugs discovered | 1 (priority type mismatch) |
| Schema blockers discovered | 2 (task provenance, flat taxonomy) |
| Forge-lib changes required | 5 |
| Skill-text fixes (editorial) | ~42 across all plugins |
| Estimated total fix effort for P1-P7 | Low-Medium (~200 lines of skill text + 2 schema changes) |

---

## Appendix: Individual Eval Result Files

| Plugin | Results | Test Cases |
|--------|---------|------------|
| Forge Memory | `eval-results/forge-memory-eval-results.md` | `eval-results/forge-memory-test-cases.json` |
| Tasks Forge | `eval-results/tasks-forge-eval-results.md` | `eval-results/tasks-forge-test-cases.json` |
| Product Forge | `eval-results/product-forge-eval-results.md` | `eval-results/product-forge-test-cases.json` |
| Cognitive Forge | `eval-results/cognitive-forge-eval-results.md` | `eval-results/cognitive-forge-test-cases.json` |
| Report Forge | `eval-results/report-forge-eval-results.md` | `eval-results/report-forge-test-cases.json` |
| Rovo Forge | `eval-results/rovo-forge-eval-results.md` | `eval-results/rovo-forge-test-cases.json` |
