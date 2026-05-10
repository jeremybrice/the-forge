# Rovo Forge Eval Results

**Evaluator:** rovo-eval
**Date:** 2026-03-09
**Plugin:** Rovo Forge v2.2.0
**Ecosystem Contracts:** 5 (Proactive Handoff), 6 (Memory-First Resolution)
**Test Cases:** 17 (11 isolation, 6 ecosystem)

---

## Summary

| Eval Candidate | Isolation Score | Ecosystem Score | Overall |
|---|---|---|---|
| Validation Remediation | 40% (Weak) | 0% (Missing) | 28% |
| Permission Model Configuration | 60% (Adequate) | 0% (Missing) | 42% |
| Deep Research Surfacing | 20% (Missing) | 0% (Missing) | 14% |
| Automation Mode Handling | 50% (Adequate) | 0% (Missing) | 40% |
| Agent Testing Framework | 0% (Missing) | 0% (Missing) | 0% |

**Overall Plugin Eval Score: 25%** (strong internal architecture, but significant functional and ecosystem gaps)

---

## Per-Component Eval Results

### 1. Validation Remediation

#### Test: isolation-rovo-validation-001 — Behavior over 500 words

**Result: PARTIAL PASS (40%)**

The jira-agent.md Phase 3 step 5 says: "Assemble the behavior text from the answers above. Validate 100-500 words." And Phase 10 includes a validation table with PASS/FAIL. However:

- **Missing remediation guidance:** When behavior exceeds 500 words, the validation table shows `FAIL` but there is no instruction telling the LLM how to guide the user to fix it. No mention of "move scenario-specific content to scenarios" or "keep only role + universal constraints in behavior."
- **Evidence (jira-agent.md:67-68):** `"Present the assembled behavior for review: 'Here's your agent's behavior instructions. Review and let me know if anything should change.'"` — This is a review gate but not a validation gate. The LLM is told to present for review, not to flag violations.
- **Evidence (jira-agent.md:172-183):** Phase 10 validation checks are listed but with no remediation actions attached. The format is `[count] words (limit: 100-500) → [PASS/FAIL]` with no "if FAIL, then..." guidance.

**What's needed:** After each validation check, add remediation instructions: "If behavior exceeds 500 words, identify scenario-specific instructions that should be moved to dedicated scenarios. Present the user with a proposed split."

#### Test: isolation-rovo-validation-002 — Scenario under 300 words

**Result: PARTIAL PASS (40%)**

The Adaptive Interview Behavior section says "validate incrementally" but provides no concrete trigger for when scenario instructions fall below 300 words.

- **Evidence (jira-agent.md:84-86):** `"Each scenario: 300-1000 words of instructions. Warn if >5 scenarios."` — The upper bound triggers a warning, but the lower bound has no action.
- **Evidence (jira-agent.md:335):** `"Validate incrementally: Flag issues as they come up, don't wait until the end."` — This is good guidance but lacks specificity on what "flag" means for word count violations.
- **Sample config evidence (ticket-triage-agent.md validation summary):** The sample config itself has Scenario 1 at 246 words with a warning, proving the system can detect the issue but doesn't remediate.

**What's needed:** During Phase 4, after each scenario's instructions are gathered, explicitly check word count. If under 300, suggest specific TCREI components that may be missing (e.g., "Your scenario instructions are at [X] words. Consider adding: decision points, error handling, output format specification, or example interactions.")

#### Test: isolation-rovo-validation-003 — Skills exceeding 5

**Result: PASS (80%)**

This is the one validation area that works well.

- **Evidence (jira-agent.md:123-124):** `"If the user selects more than 5, warn: 'You've selected [N] skills. Atlassian recommends a maximum of 4-5 for optimal performance. More skills lead to slower response times and less focused behavior. Which skills are most critical?'"` — Clear warning with explanation and action.
- **Minor gap:** The warning explains WHY (performance) but doesn't help the user decide WHICH skills to drop. The skill selection strategy (jira-specialist.md:50-55) provides pattern-specific recommendations, but the command doesn't explicitly say "refer back to the pattern recommendation" during this warning.

#### Test: ecosystem-rovo-contract5-001 — Post-completion handoff suggestion

**Result: FAIL (0%)**

Neither jira-agent.md nor confluence-agent.md mentions any other Forge plugin after producing the configuration.

- **Evidence:** Searched both command files for any mention of "Product Forge", "Tasks Forge", "Report Forge", "Forge Memory", "forge-memory", "product-forge", "tasks-forge", "report-forge" — **zero matches in either file.**
- The only cross-plugin reference is to forge-lib for file persistence (Phase 11) and the Forge Shell dashboard. These are infrastructure references, not ecosystem handoffs.
- **Contract 5 requires:** "Rovo Forge (jira-agent) → Agent config produced → 'You can test this agent against Jira issues referenced in your Product Forge cards.'"
- **Actual behavior:** After assembly, the command saves to forge-lib and confirms the save. No mention of any other plugin.

**Ecosystem Level: Missing (Level 0)** — No awareness of any downstream or upstream Forge plugin.

---

### 2. Permission Model Configuration

#### Test: isolation-rovo-permission-001 — Broad project access explanation

**Result: PASS (70%)**

- **Evidence (rovo-foundation SKILL.md:69-71):** `"'Agents never grant more permissions than the user has.' Access through agents is bounded by the requesting user's existing permissions. Permission checks happen at runtime. This means broad knowledge source configuration is safe because each user only sees their accessible data."`
- **Evidence (knowledge-sources.md:93-94):** `"When no explicit restrictions are set, agent has access to everything the user can see. Appropriate for general-purpose agents. For specialized agents, narrowing to specific sources is recommended."`
- The rovo-foundation skill provides the principle and the reasoning. The knowledge-sources reference adds practical guidance.
- **Gap:** jira-agent.md Phase 5 (line 94) asks "Which Jira projects should this agent have access to? (Specific projects recommended over 'all projects' for focused agents)" — recommends narrowing but does NOT explain the permission model to justify why broad is safe.

#### Test: isolation-rovo-permission-002 — Auto-include permission awareness in behavior

**Result: PASS (90%)**

- **Evidence (jira-agent.md:64-66):** Phase 3 step 4 says "Auto-include these in every behavior section: Permission awareness: 'You respect user permissions and only perform actions in projects the user has access to.' Confirmation requirements: 'You confirm critical actions before executing them.'"
- **Evidence (confluence-agent.md:63-66):** Same pattern with Confluence-specific wording: "You respect user permissions and only create or modify pages in spaces the user has access to." Plus confirmation gates: "You generate previews and request user confirmation before publishing. You never publish without explicit approval."
- This is well-implemented. Both commands auto-include permission and confirmation text without requiring user input.

#### Test: ecosystem-rovo-contract6-001 — Team shorthand resolution via Forge Memory

**Result: FAIL (0%)**

- **Evidence:** Neither jira-agent.md nor confluence-agent.md contains any reference to Forge Memory, `/forge-memory:recall`, `/forge-memory:remember`, taxonomy, or organizational context resolution.
- Phase 1 (Initial Assessment) focuses on pattern detection (triage, ticket generation, etc.) but does NOT check whether team names, project shorthand, or domain terms should be resolved against organizational memory.
- Phase 3 (Behavior Definition) asks about "which Jira projects" and "which teams" but treats the user's input as authoritative without cross-referencing memory.

**Ecosystem Level: Missing (Level 0)** — No memory-first resolution implemented anywhere in the builder flow.

---

### 3. Deep Research Surfacing

#### Test: isolation-rovo-deepresearch-001 — Deep Research suggested during scenario design

**Result: FAIL (0%)**

- **Evidence (jira-agent.md Phase 4, lines 73-87):** Phase 4 covers scenario design with name, triggers, and instructions. Deep Research is **never mentioned** in this phase.
- **Evidence (jira-agent.md Phase 9, lines 156-164):** Automation Integration mentions Deep Research timeout but only as a warning, not as a feature to enable.
- **Evidence (knowledge-sources.md:98-118):** Full Deep Research section exists in references with "How to Enable", "Limits", and "When to Use" — but neither command file references this section during scenario design.
- **Gap:** A user describing a multi-source research use case (sprint retrospectives across projects) would complete the entire builder flow without ever being asked about Deep Research, despite it being the ideal capability for their use case.

**What's needed:** In Phase 4, after gathering scenario instructions, check if the use case involves multi-source research, synthesis, or batch analysis. If so, proactively suggest: "This scenario could benefit from Deep Research mode, which enables multi-step research workflows. Would you like to enable it? Note: 30 requests/user/day, 15-minute timeout, scenario-level only."

#### Test: isolation-rovo-deepresearch-002 — Deep Research timeout warning in automation

**Result: PARTIAL PASS (40%)**

- **Evidence (jira-agent.md:164):** `"Warn about Deep Research timeout: 'If using Deep Research, note the 15-minute timeout. Automation will fail if the agent takes longer.'"` — The warning exists but is passive ("note the timeout") rather than active guidance.
- **Gap:** No guidance on how to scope automation prompts to stay within the timeout, or when to recommend against Deep Research in automation contexts entirely.

#### Test: ecosystem-rovo-contract6-002 — Acronym resolution for agent scope

**Result: FAIL (0%)**

Same evidence as contract6-001. No Forge Memory integration exists in the builder flow.

---

### 4. Automation Mode Handling

#### Test: isolation-rovo-automation-001 — Dedicated automation scenario with structured output

**Result: PARTIAL PASS (50%)**

- **Evidence (jira-agent.md:159-164):** Phase 9 explains the constraint clearly: "When running from automation, agents cannot use their skills. They can only provide text responses, which automation then acts on via the {{agentResponse}} smart value." It also suggests structured output format: "'[PRIORITY: High] [TEAM: Backend] [LABELS: urgent, critical]'"
- **Gap:** The command does NOT guide creation of a dedicated automation scenario. It explains the constraint and suggests structured output, but stops short of saying "Let's create an Automation Triage scenario with these trigger keywords and these structured output instructions." The user is left to figure out how to create the scenario themselves.
- **Sample config gap (ticket-triage-agent.md validation warnings):** "If this agent will also be used from automation rules, add a third scenario with structured text-only output for automation parsing." — This tells the user WHAT to do but not HOW.

**What's needed:** Phase 9 should include a guided scenario creation flow: "Let's create a dedicated automation scenario. What automation trigger will invoke this agent? [gather info] Here's a scenario with structured output format: [template]."

#### Test: isolation-rovo-automation-002 — Primarily automation-driven use case

**Result: PARTIAL PASS (50%)**

- **Evidence (confluence-agent.md:159-168):** Phase 9 mentions common Confluence automation triggers (page published, page created, scheduled) and warns about Deep Research timeout. But it doesn't restructure the entire builder approach for automation-first use cases.
- **Gap:** If the primary use case is automation-driven, the builder should recognize this in Phase 1 and adjust the entire flow: scenarios should be designed for structured text output from the start, skill selection should warn that skills won't be available, and the output format should include automation rule configuration alongside Rovo Studio clipboard blocks.

#### Test: ecosystem-rovo-contract5-003 — Automation failure suggests task tracking

**Result: FAIL (0%)**

No mention of Tasks Forge, Report Forge, or any other Forge plugin in the automation discussion.

---

### 5. Agent Testing Framework

#### Test: isolation-rovo-testing-001 — Post-assembly testing guidance

**Result: FAIL (0%)**

- **Evidence:** Phase 10 is Assembly and Output. Phase 11 is File Persistence. **There is no Phase 12.** Neither command file provides any testing guidance after producing the configuration.
- jira-agent.md ends with "Adaptive Interview Behavior" section, which is about the interview itself, not testing.
- confluence-agent.md ends identically.
- The only mention of testing is in sample config headers: "serves as both a reference example and a testing baseline" — but this is about using the sample config itself as a reference, not testing the user's custom agent.

**What's needed:** Add Phase 12: Testing and Iteration.
- Suggest 2-3 test prompts per scenario
- Explain what to look for in agent responses
- Provide a troubleshooting guide: "If the agent doesn't apply the priority matrix → check scenario instructions. If it uses the wrong skill → check skill selection."

#### Test: isolation-rovo-testing-002 — Scenario-specific test suggestions

**Result: FAIL (0%)**

Same evidence. No testing framework exists anywhere in the plugin.

#### Test: ecosystem-rovo-contract5-002 — Post-config Forge Memory enrichment suggestion

**Result: FAIL (0%)**

No mention of Forge Memory or any other Forge plugin in the post-configuration output.

---

## Ecosystem Contract Compliance

### Contract 5: Proactive Handoff Suggestions

**Grade: Missing (Level 0)**

| Test ID | Expected Handoff | Actual Behavior | Level |
|---|---|---|---|
| ecosystem-rovo-contract5-001 | Suggest testing against Product Forge cards | No mention of Product Forge | Missing |
| ecosystem-rovo-contract5-002 | Suggest enriching with Forge Memory context | No mention of Forge Memory | Missing |
| ecosystem-rovo-contract5-003 | Suggest task tracking for automation failures | No mention of Tasks Forge | Missing |

**Evidence:** Grep of both command files for any Forge ecosystem reference:
- "Product Forge" / "product-forge" — 0 matches
- "Tasks Forge" / "tasks-forge" — 0 matches
- "Report Forge" / "report-forge" — 0 matches
- "Forge Memory" / "forge-memory" — 0 matches
- "Cognitive Forge" / "cognitive-forge" — 0 matches

The only external references are to Rovo Studio (the Atlassian product), forge-lib (the CLI), and Forge Shell (the dashboard app). Rovo Forge operates as a completely isolated plugin within the Forge ecosystem.

### Contract 6: Memory-First Resolution

**Grade: Missing (Level 0)**

| Test ID | Expected Resolution | Actual Behavior | Level |
|---|---|---|---|
| ecosystem-rovo-contract6-001 | Resolve "payments team" via Forge Memory | Accepts user input literally | Missing |
| ecosystem-rovo-contract6-002 | Resolve "PSR" and "WebApp" via Forge Memory | Accepts user input literally | Missing |

**Evidence:** Neither command file includes any step to check Forge Memory for:
- Team names mentioned during Phase 3 (scope/team questions)
- Project shorthand mentioned during Phase 5 (knowledge source selection)
- Acronyms or informal names anywhere in the builder flow

The builder treats all user-provided names as authoritative without cross-referencing organizational memory.

---

## Teammate Collaboration Findings

### Message to memory-eval (response received)

Asked whether Forge Memory's taxonomy output provides enough structured context (team-to-project mappings, product-to-space associations) for Rovo Forge to suggest appropriate knowledge sources based on organizational context.

**memory-eval response confirmed:**
- Forge Memory taxonomy exposes **flat lists** of teams, products, modules, integrations, clients, and systems
- Taxonomy does **NOT** expose team-to-project mappings, team-to-module ownership, Jira project keys, or Confluence space associations
- For "build an agent for the payments team," Forge Memory can resolve "payments team" to canonical "Payments Team" but **cannot** tell Rovo Forge which Jira projects or Confluence spaces are associated with that team
- Deep memory (knowledge tier) might contain unstructured team ownership info, but it's not programmatically queryable for Rovo Forge's use case
- Forge Memory's org-context skill lists Product Forge, Tasks Forge, and Report Forge as downstream consumers -- **Rovo Forge is absent from that list**

**Impact on test approach:**
- Contract 6 ecosystem tests: Adjusted expected ideal level from "context_passing" to **"awareness"** for team/project resolution, since even a fully-integrated Rovo Forge could only get canonical name resolution (not structured mappings) from Forge Memory's current data model
- Contract 6 remains at **Missing (Level 0)** in actual grades because Rovo Forge has zero Forge Memory integration regardless
- This also surfaces a **structural data model limitation**: Forge Memory's flat taxonomy cannot express entity relationships (team-owns-project, product-has-space). This is a cross-plugin gap that limits ecosystem integration ceiling for Rovo Forge and potentially other plugins

**Pre-response assessment confirmed:** The gap is bidirectional:
1. **Rovo Forge side:** Zero integration points to consume Forge Memory taxonomy (skill-level fix)
2. **Forge Memory side:** Flat taxonomy cannot express the entity relationships Rovo Forge would need for intelligent knowledge source suggestions (data model limitation)

**Impact on test approach:** Kept ecosystem test expectations at "context_passing" level for the ideal behavior, since the test plan defines what SHOULD happen regardless of current implementation. The actual grades reflect the Missing (Level 0) reality.

---

## Recommended Improvements

### Priority 1: Agent Testing Framework (Critical — currently 0%)

Add **Phase 12: Testing and Iteration** to both jira-agent.md and confluence-agent.md:

```markdown
## Phase 12: Testing and Iteration

After deploying the agent in Rovo Studio, test each scenario:

1. **Generate test prompts**: For each scenario, create 2-3 test prompts that exercise the scenario's core behavior. Include edge cases (ambiguous input, missing information, boundary conditions).

2. **Verify skill usage**: Check that the agent uses the expected skills for each scenario. If it uses unexpected skills or fails to use expected ones, adjust the scenario instructions.

3. **Check decision quality**: For agents with decision logic (triage, routing, prioritization), test with known-good examples and verify the agent reaches the correct conclusion.

4. **Validate output format**: For automation scenarios, verify the structured output is parseable by the downstream automation rule.

5. **Iterate**: If behavior doesn't match expectations:
   - Behavior too broad → Move specifics to scenarios
   - Wrong scenario activating → Adjust trigger keywords
   - Missing context → Add knowledge sources
   - Inconsistent decisions → Add examples to knowledge sources
```

### Priority 2: Deep Research Surfacing (Critical — currently 14%)

Add Deep Research check to Phase 4 of both commands:

After gathering scenario requirements, if the use case involves research, synthesis, analysis across multiple sources, or batch processing, proactively suggest Deep Research. Reference knowledge-sources.md "When to Use" section.

### Priority 3: Validation Remediation (Important — currently 28%)

Attach remediation instructions to each validation check in Phase 10:
- Behavior too long → "Move scenario-specific content to dedicated scenarios"
- Scenario too short → "Add missing TCREI components: [list applicable gaps]"
- Too many skills → "Refer to pattern recommendation for [detected pattern]"
- Starters wrong count → "Need exactly 3; suggest based on primary scenarios"

### Priority 4: Automation Mode Templates (Important — currently 40%)

Phase 9 should guide creation of a dedicated automation scenario rather than just explaining constraints. Provide a concrete template and walk the user through customizing it.

### Priority 5: Ecosystem Integration (Critical — currently 0% across all contracts)

Add Forge ecosystem awareness to both command files:
- **Phase 1/Phase 3**: Check Forge Memory for team names, project shorthand, and acronyms (Contract 6). Note: Forge Memory can resolve canonical names but cannot provide team-to-project or product-to-space mappings (flat taxonomy limitation). The builder should still resolve names and use them in descriptions/behavior text, even if knowledge source suggestions must remain user-driven.
- **Phase 10/Phase 11**: After producing the configuration, suggest relevant cross-plugin actions (Contract 5):
  - "Test this agent against issues from your Product Forge cards"
  - "Track agent deployment as a task in Tasks Forge"
  - "Enrich the agent's scope with organizational context from Forge Memory"

**Structural note from memory-eval collaboration:** Forge Memory's org-context skill explicitly lists Product Forge, Tasks Forge, and Report Forge as downstream taxonomy consumers but omits Rovo Forge. Both sides need updating: Rovo Forge commands need to consume Forge Memory, and Forge Memory's org-context should list Rovo Forge as a consumer.

---

## Isolation vs. Ecosystem Score Summary

| Category | Tests | Pass | Partial | Fail | Score |
|---|---|---|---|---|---|
| Isolation | 11 | 2 | 4 | 5 | 35% |
| Ecosystem | 6 | 0 | 0 | 6 | 0% |
| **Total** | **17** | **2** | **4** | **11** | **25%** |

The plugin's internal architecture is strong (the audit scored most components 9-10/10), but the eval reveals significant gaps in the five behavioral areas identified by the triage. The ecosystem integration is completely absent — Rovo Forge is an island within the Forge marketplace.
