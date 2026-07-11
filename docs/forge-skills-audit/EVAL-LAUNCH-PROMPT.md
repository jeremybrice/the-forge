# Forge Ecosystem Evaluation — Agent Teams Launch Prompt

Paste everything below the separator into a Claude Code terminal session. This prompt is designed for the **agent teams** feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` must be enabled in settings.json).

Before launching, ensure:
1. You are in the directory containing the `forge-skills-audit/` folder with files 00 through 10
2. The Forge plugins are accessible at `.local-plugins/cache/the-forge/` and `.local-plugins/cache/knowledge-work-plugins/`
3. Agent teams are enabled in your settings

---

## PROMPT START

You are executing Phase 4 of a Forge marketplace skills audit. The previous phase (structural audit) produced detailed audit files for all 8 Forge marketplace plugins. Your job is to run full behavioral evaluations using the Skill Creator, testing each plugin against both isolation criteria and ecosystem criteria. You will do this by creating an agent team where teammates evaluate individual plugins but actively collaborate to test cross-plugin contracts.

### Background

We audited all 8 Forge marketplace plugins against a 10-dimension rubric derived from the Skills 2.0 framework. The audit identified 27 full eval candidates. The key finding: plugins work reasonably well in isolation but fail to participate in the cross-plugin flows that CLAUDE.md explicitly defines. Evaluating them without the context of how they work together would produce misleading results. That is why this evaluation uses an agent team rather than isolated sub-agents.

### Before You Do Anything Else

Read these two files. They are the foundation for everything that follows:

1. **`forge-skills-audit/09-synthesis-and-assessment.md`** — Synthesis report with the master list of 27 eval candidates, 5 systemic findings, plugin-by-plugin verdicts, and tiered priority order.

2. **`forge-skills-audit/10-ecosystem-test-plan.md`** — Ecosystem test plan defining 6 explicit contracts and 5 implied flows, with testable scenarios per plugin, a 4-level grading scale (awareness → specificity → context passing → automatic flow), a test case template, and a plugin responsibility matrix.

Also read:

3. **`forge-skills-audit/00-audit-rubric.md`** — The 10-dimension scoring rubric.

After reading these three files, confirm your understanding of:
- The 11 ecosystem contracts (6 explicit + 5 implied) and which plugins sit on each side
- The plugin responsibility matrix (Part 3 of the ecosystem test plan)
- The 4-level grading scale for ecosystem assertions
- The test case template format (Part 5)
- The priority scenarios for Tier 1/2 evals (Part 6)

Then invoke `/skill-creator` to load the Skill Creator's eval methodology. You need its pipeline: test case generation, parallel with-skill vs. baseline runs, grading assertions, benchmark aggregation, and the eval-viewer.

Once you have both the ecosystem context and the Skill Creator methodology loaded, proceed to create the team.

### Team Structure

Create an agent team with 8 teammates plus yourself as team lead. Each teammate owns one Forge plugin's evaluation. Use Sonnet for each teammate.

**Teammate assignments:**

| Teammate Name | Plugin | Audit File | Contracts (from responsibility matrix) |
|---|---|---|---|
| memory-eval | Forge Memory | `forge-skills-audit/01-forge-memory-audit.md` | 1, 2, 3, 5, 6, IF5 |
| tasks-eval | Tasks Forge | `forge-skills-audit/02-tasks-forge-audit.md` | 1, 4, 5, 6, IF4 |
| product-eval | Product Forge | `forge-skills-audit/03-product-forge-audit.md` | 2, 3, 4, 5, 6, IF1 |
| cognitive-eval | Cognitive Forge | `forge-skills-audit/04-cognitive-forge-audit.md` | 4, 5, 6, IF2, IF3 |
| report-eval | Report Forge | `forge-skills-audit/05-report-forge-audit.md` | 3, 5, 6, IF3, IF4 |
| rovo-eval | Rovo Forge | `forge-skills-audit/07-rovo-forge-audit.md` | 5, 6 |
| cowork-eval | Cowork Plugin Mgmt | `forge-skills-audit/08-cowork-plugin-mgmt-audit.md` | 5 |

**Spawn prompt for each teammate:**

Each teammate should receive this context in their spawn prompt:

```
You are evaluating the [PLUGIN NAME] plugin as part of the Forge ecosystem skills audit.

Your source files:
- forge-skills-audit/[NN]-[plugin]-audit.md (your plugin's structural audit)
- forge-skills-audit/10-ecosystem-test-plan.md (ecosystem contracts and test scenarios)
- forge-skills-audit/09-synthesis-and-assessment.md (cross-reference for ecosystem context)

The actual plugin skill files are at:
[PLUGIN PATH]

Your ecosystem contracts (from the responsibility matrix): [CONTRACT LIST]

Invoke /skill-creator to load the eval methodology.

Your job has four phases:

PHASE 1 — READ AND UNDERSTAND
Read your audit file and the ecosystem test plan. Identify:
- Which components in your plugin are eval candidates (from the audit's triage section)
- Which ecosystem contracts apply to your plugin (from the responsibility matrix)
- What specific ecosystem test scenarios are defined for your plugin (from Parts 1-2 of the test plan)

PHASE 2 — GENERATE TEST CASES
For each eval candidate, generate both:
- Isolation test cases: Does the skill do what it claims?
- Ecosystem test cases: Does the skill participate correctly in cross-plugin flows?

Use the test case template from Part 5 of the ecosystem test plan. Weight ecosystem assertions at 20-30% for most skills, 50%+ for integration-focused skills.

PHASE 3 — COLLABORATE
Before running evals, message your counterpart teammates on shared contracts to align test expectations. Specifically:

[INCLUDE CONTRACT-SPECIFIC MESSAGING INSTRUCTIONS — see Collaboration Protocol below]

Share your ecosystem test cases with teammates who sit on the other side of your contracts. If a teammate's findings change what you should test for, update your test cases before running.

PHASE 4 — RUN EVALS AND REPORT
Run evals through the Skill Creator pipeline. Write results to:
forge-skills-audit/eval-results/[plugin-name]-eval-results.md

Include:
- Per-component eval scores (isolation + ecosystem, separately)
- Failing test cases with evidence
- Ecosystem contract compliance (per contract, graded on the 4-level scale)
- Recommended improvements based on failures
- Any findings from teammate collaboration that changed your test approach

When done, message the lead with a summary of your results and any broken handoffs you found.
```

**Plugin paths for spawn prompts:**
- Forge Memory: `.local-plugins/cache/the-forge/forge-memory/2.2.0/`
- Tasks Forge: `.local-plugins/cache/the-forge/tasks-forge/2.2.0/`
- Product Forge: `.local-plugins/cache/the-forge/product-forge/2.2.1/`
- Cognitive Forge: `.local-plugins/cache/the-forge/cognitive-forge/2.2.0/`
- Report Forge: `.local-plugins/cache/the-forge/report-forge/2.2.0/`
- a removed harvest plugin: `.local-plugins/cache/the-forge/2.2.0/`
- Rovo Forge: `.local-plugins/cache/the-forge/rovo-forge/2.2.0/`
- Cowork Plugin Mgmt: `.local-plugins/cache/knowledge-work-plugins/cowork-plugin-management/0.2.2/`

### Collaboration Protocol

This is what makes agent teams valuable over sub-agents. Teammates must actively communicate about shared ecosystem contracts. Include these specific messaging instructions in each teammate's spawn prompt based on their contracts:

**memory-eval should message:**
- product-eval: "I'm testing taxonomy resolution. Here are the terms I'm using in my test cases: [list]. Test whether your card creation resolves these same terms consistently. Let me know if you find resolution failures so I can check whether it's a memory-side or product-side issue."
- slack-eval: "I'm testing knowledge storage. What format does your promote command use when pushing knowledge entries to Forge Memory? I need to verify my skill handles that input format."
- tasks-eval: "Contract 1 says you receive promoted tasks from a removed harvest plugin. Do you acknowledge Slack as a task source anywhere? I'm testing whether my taxonomy entries are available when you create tasks."
- report-eval: "Contract 3 says you pull context from memory. What entity resolution do you expect from me? I'll test whether my recall output matches what your investigator needs."

**tasks-eval should message:**
- slack-eval: "Contract 1 says I should receive tasks from your harvest promotion. What schema do you use for promoted tasks? I need to test whether my task-management skill acknowledges Slack as a source."
- cognitive-eval: "Contract 4 says debate outcomes inform task priorities. Do you produce priority recommendations in a format I can consume? I'll test whether my triage reasoning can reference your session records."
- report-eval: "Implied Flow 4 says triage data should suggest status reports. I'm testing whether my triage output mentions Report Forge. What would you need from me to scope a status report?"

**product-eval should message:**
- memory-eval: "Contract 2 says I resolve taxonomy from you. I'm testing card creation with these terms: [list]. Confirm whether these exist in your test taxonomy so I can distinguish 'term not found' (expected) from 'resolution failed' (bug)."
- report-eval: "Contract 3 says you accept my card references. What format do you expect card references in? I'll test whether my create command suggests report generation as a follow-up."
- cognitive-eval: "Contract 4 says your debate outcomes feed into my decision cards. What does your debate synthesis output look like? I need to test whether my create command can ingest it."
- tasks-eval: "Do you track implementation tasks for stories? I'll test whether my card creation suggests creating tasks in Tasks Forge."

**cognitive-eval should message:**
- product-eval: "Contract 4 says my debate outcomes should suggest decision cards. I'll test whether my debate command mentions Product Forge in its post-synthesis output. What fields does a decision card need?"
- tasks-eval: "Contract 4 says my explore sessions should suggest task creation for action items. What schema do you use for tasks? I'll check whether my output is compatible."
- slack-eval: "Implied Flow 2 says complex Slack discussions should suggest debate. Do you flag unresolved discussions during capture? I'll test whether my debate command is discoverable from your output."

**report-eval should message:**
- product-eval: "Contract 3 says I accept card references. I'm testing the generate command with card IDs. Confirm your card format so I can verify my investigator correctly scopes from card content."
- memory-eval: "Contract 3 says I validate entities against your taxonomy. What's the expected response format when I query a taxonomy term? I need to test whether my investigator constrains its scope correctly."
- cognitive-eval: "Implied Flow 3 says my analysis should suggest deeper exploration via Cognitive Forge. I'll test whether my report output mentions debate/explore when it surfaces decision-worthy findings."
- tasks-eval: "Implied Flow 4 says your triage data could trigger status reports. What does your triage summary output look like? I'll test whether my generate command can accept that as input context."

**slack-eval should message:**
- tasks-eval: "Contract 1 says my promote command pushes tasks to you. Here's the schema I'm testing for promoted tasks: [schema]. Verify your side can receive this format."
- memory-eval: "Contract 1 says my promote command pushes knowledge to you. Here's the schema I'm testing for promoted knowledge entries: [schema]. Verify your remember/store pathway handles this."
- cognitive-eval: "Implied Flow 2 says I should flag complex discussions for debate. I'll test whether my knowledge harvester identifies unresolved multi-person discussions and suggests Cognitive Forge."

**rovo-eval should message:**
- memory-eval: "My agent builders reference organizational context for scoping Rovo agents. Does your taxonomy output provide enough context for me to suggest appropriate Jira/Confluence knowledge sources?"

**cowork-eval:** No mandatory cross-plugin messages (standalone plugin), but should message the lead when complete.

### Shared Task List Structure

Create the shared task list with these tasks. Dependencies ensure the right sequencing while maximizing parallelism:

```
PHASE 1 TASKS (no dependencies, all teammates work in parallel):
- [memory-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [tasks-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [product-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [cognitive-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [report-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [slack-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [rovo-eval] Read audit file and ecosystem plan, identify eval candidates and contracts
- [cowork-eval] Read audit file and ecosystem plan, identify eval candidates and contracts

PHASE 2 TASKS (depends on Phase 1 for same teammate):
- [memory-eval] Generate isolation + ecosystem test cases
- [tasks-eval] Generate isolation + ecosystem test cases
- [product-eval] Generate isolation + ecosystem test cases
- [cognitive-eval] Generate isolation + ecosystem test cases
- [report-eval] Generate isolation + ecosystem test cases
- [slack-eval] Generate isolation + ecosystem test cases
- [rovo-eval] Generate isolation + ecosystem test cases
- [cowork-eval] Generate isolation + ecosystem test cases

PHASE 3 TASKS (depends on Phase 2 for ALL teammates involved in shared contracts):
- [memory-eval] Collaborate: exchange test cases with product-eval, slack-eval, tasks-eval, report-eval
- [tasks-eval] Collaborate: exchange test cases with slack-eval, cognitive-eval, report-eval
- [product-eval] Collaborate: exchange test cases with memory-eval, report-eval, cognitive-eval, tasks-eval
- [cognitive-eval] Collaborate: exchange test cases with product-eval, tasks-eval, slack-eval, report-eval
- [report-eval] Collaborate: exchange test cases with product-eval, memory-eval, cognitive-eval, tasks-eval
- [slack-eval] Collaborate: exchange test cases with tasks-eval, memory-eval, cognitive-eval
- [rovo-eval] Collaborate: exchange test cases with memory-eval
- [cowork-eval] (no collaboration needed, can proceed directly to Phase 4)

PHASE 4 TASKS (depends on Phase 3 for same teammate):
- [memory-eval] Run evals and write results to forge-skills-audit/eval-results/forge-memory-eval-results.md
- [tasks-eval] Run evals and write results to forge-skills-audit/eval-results/tasks-forge-eval-results.md
- [product-eval] Run evals and write results to forge-skills-audit/eval-results/product-forge-eval-results.md
- [cognitive-eval] Run evals and write results to forge-skills-audit/eval-results/cognitive-forge-eval-results.md
- [report-eval] Run evals and write results to forge-skills-audit/eval-results/report-forge-eval-results.md
- [rovo-eval] Run evals and write results to forge-skills-audit/eval-results/rovo-forge-eval-results.md
- [cowork-eval] Run evals and write results to forge-skills-audit/eval-results/cowork-plugin-mgmt-eval-results.md

PHASE 5 TASKS (lead only, depends on all Phase 4 tasks):
- [lead] Synthesize: build ecosystem contract scorecard from all 8 result files
- [lead] Synthesize: identify broken handoffs (one side passes, other side fails)
- [lead] Write final report to forge-skills-audit/11-ecosystem-eval-report.md
- [lead] Run description optimization for 7 candidates, write to forge-skills-audit/eval-results/description-optimization-results.md
```

### Lead Responsibilities

As team lead, you:

1. **Read the source files first** (09, 10, 00) and load the Skill Creator before spawning anyone.
2. **Create the team** with the 8 teammates defined above, providing each their spawn prompt with the correct audit file, plugin path, contract list, and collaboration messaging instructions.
3. **Monitor collaboration** during Phase 3. If teammates aren't exchanging messages about shared contracts, nudge them. The collaboration phase is what makes this approach better than isolated sub-agents.
4. **Wait for all teammates** to complete Phase 4 before starting Phase 5. Do not begin synthesis until all 8 result files exist.
5. **Synthesize cross-plugin results** by reading all 8 eval result files and building:

   a) **Ecosystem contract scorecard:** For each of the 11 contracts, grade both sides. Did the producing plugin offer the handoff? Did the consuming plugin acknowledge the source? Use the 4-level scale.

   b) **Broken handoff inventory:** Where one side passes but the other fails. These are the highest-priority fixes.

   c) **Final evaluation report** at `forge-skills-audit/11-ecosystem-eval-report.md` containing:
      - Executive summary of ecosystem health
      - Per-plugin eval scores (isolation and ecosystem separately)
      - Ecosystem contract scorecard (all 11 contracts, both sides graded)
      - Broken handoff inventory with fix recommendations
      - Ranked improvement priorities (maximum ecosystem impact first)
      - Comparison with structural audit findings (confirmed, contradicted, or expanded)
      - Collaboration insights (what did teammates discover by talking to each other that isolated evaluation would have missed?)

6. **Run description optimization** for 7 candidates using the Skill Creator's run_loop.py (60/40 train/test split):
   - forge-memory: memory-management, org-context
   - tasks-forge: task-management
   - product-forge: pm-methodology, product-context
   - cognitive-forge: cognitive-techniques (if user-invocable)
   - rovo-forge: rovo-foundation

   Write results to `forge-skills-audit/eval-results/description-optimization-results.md`.

### Critical Directives

1. **Err on the side of more evaluation, not less.** If unsure whether something needs testing, test it.

2. **Every eval candidate gets ecosystem test cases.** No plugin is evaluated purely in isolation.

3. **Use the 4-level grading scale for ecosystem assertions.** Level 1 (awareness) is the minimum bar. Level 2 (specificity) is expected. Anything below Level 1 is a critical gap.

4. **Collaboration is mandatory, not optional.** The Phase 3 collaboration step is the reason we're using agent teams. If teammates skip it and just run evals in isolation, the results are no better than sub-agents. Monitor and enforce this.

5. **Write output files to `forge-skills-audit/eval-results/`.** Create this directory if needed. The final synthesis goes to `forge-skills-audit/11-ecosystem-eval-report.md`.

### Expected Deliverables

```
forge-skills-audit/
├── 00 through 10                               (existing audit files)
├── 11-ecosystem-eval-report.md                 (NEW — lead's final synthesis)
├── eval-results/
│   ├── forge-memory-eval-results.md            (NEW — from memory-eval teammate)
│   ├── tasks-forge-eval-results.md             (NEW — from tasks-eval teammate)
│   ├── product-forge-eval-results.md           (NEW — from product-eval teammate)
│   ├── cognitive-forge-eval-results.md         (NEW — from cognitive-eval teammate)
│   ├── report-forge-eval-results.md            (NEW — from report-eval teammate)
│   ├── rovo-forge-eval-results.md              (NEW — from rovo-eval teammate)
│   ├── cowork-plugin-mgmt-eval-results.md      (NEW — from cowork-eval teammate)
│   └── description-optimization-results.md     (NEW — from lead)
```

Begin by reading files 09 and 10, then invoke /skill-creator, then create the team.

## PROMPT END
