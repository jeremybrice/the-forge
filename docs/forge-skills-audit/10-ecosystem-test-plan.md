# Forge Ecosystem Test Plan

**Date:** 2026-03-09
**Purpose:** Define testable cross-plugin scenarios so that individual skill evals can include ecosystem-aware assertions. Each agent team evaluating a single plugin should reference this document to write test cases that validate not just isolated behavior, but how that plugin participates in the Forge ecosystem.
**Companion to:** 09-synthesis-and-assessment.md (individual plugin audits)

---

## How to Use This Document

Each plugin's eval team receives:
1. Their plugin-specific audit file (01 through 08)
2. This ecosystem test plan

When generating test cases for their plugin, the eval team should include two categories:

**Isolation test cases** test whether the skill does what it claims in a vacuum (e.g., "does recall return the right memory entry?"). These come from the audit file.

**Ecosystem test cases** test whether the skill participates correctly in cross-plugin flows (e.g., "after recall resolves a term, does it suggest enriching a Product Forge card?"). These come from this document.

For grading assertions on ecosystem test cases, the eval team checks for:
- **Handoff suggestion present:** The skill's output includes a suggestion or reference to the downstream plugin
- **Context passed correctly:** The information produced by the skill is in a format consumable by the downstream plugin
- **Upstream awareness:** The skill acknowledges or checks for inputs from upstream plugins when relevant
- **Taxonomy consistency:** Entity names used match Forge Memory canonical names

---

## Part 1: Explicit Ecosystem Contracts (from CLAUDE.md)

These are the five cross-plugin flows that the workspace instructions explicitly define. Every one of these MUST be testable, and failure on these is a critical ecosystem deficiency.

### Contract 1: a removed harvest plugin → Tasks Forge + Forge Memory (Harvest Promotion)

**CLAUDE.md source:** "a removed harvest plugin harvests promote into Tasks Forge (tasks) and Forge Memory (knowledge)"

**What should happen:** When a removed harvest plugin completes a harvest cycle (scan → capture → review → promote), approved task items flow into Tasks Forge as new tasks, and approved knowledge items flow into Forge Memory as new entries.

**Test scenarios by plugin:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| a removed harvest plugin (capture) | Task extraction suggests downstream promotion | "Capture tasks from the #engineering channel transcript" | Output mentions that approved tasks can be promoted to Tasks Forge via `` |
| a removed harvest plugin (promote) | Promotion creates correctly formatted Tasks Forge entries | "Promote the approved harvest items" | Promoted tasks reference Tasks Forge schema (title, status=Open, priority, source=slack-harvest). Promoted knowledge references Forge Memory schema (type, importance, content). |
| Tasks Forge (task-management) | Awareness of a removed harvest plugin as a task source | "What tasks do I have?" or "Triage my tasks" | If tasks originated from Slack harvest, their provenance is visible. The skill acknowledges that tasks can come from a removed harvest plugin promotion. |
| Tasks Forge (add) | Manual task creation suggests Slack as alternative source | "Add a task from the discussion in #product" | Suggests using `` and `` as an alternative to manual entry for Slack-sourced tasks |
| Forge Memory (remember) | Awareness that knowledge can come from Slack harvest | "Remember that Todd owns the billing module" | Output acknowledges this is now available to a removed harvest plugin for context enrichment during future harvests |

**Critical gap found in audit:** Tasks Forge never mentions a removed harvest plugin anywhere. This contract is architecturally absent from one side.

---

### Contract 2: Product Forge → Forge Memory (Taxonomy Reference)

**CLAUDE.md source:** "Product Forge cards reference Forge Memory taxonomy for consistent naming"

**What should happen:** When Product Forge creates or updates cards, it resolves product names, team names, module names, and client names against Forge Memory's taxonomy. Unknown terms trigger a suggestion to add them to memory.

**Test scenarios by plugin:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Product Forge (create) | Card creation resolves taxonomy terms | "Create a story card for improving the PSR dashboard for Acme Corp" | Skill invokes product-context or org-context to resolve "PSR" and "Acme Corp" against Forge Memory taxonomy. Resolved names appear in the card's affected_systems or related metadata. |
| Product Forge (create) | Unknown terms trigger memory suggestion | "Create an initiative for the Phoenix project" | If "Phoenix project" is not in taxonomy, the skill suggests: "Phoenix project isn't in organizational memory yet. Would you like me to add it with `/forge-memory:remember`?" |
| Product Forge (update) | Card updates re-validate taxonomy | "Update the billing initiative to include the payments team" | Skill validates "payments team" against taxonomy. If it exists, uses canonical name. If not, suggests adding it. |
| Forge Memory (org-context) | Awareness that Product Forge consumes taxonomy | "Add WebApp to our product taxonomy" | Output confirms the addition and notes: "Product Forge cards will now validate against this product name when creating or updating cards." |
| Forge Memory (recall) | Recall results suggest card creation | "Tell me about the Phoenix project" | If recall returns project information, and no Product Forge card exists for it, suggests: "Would you like to create a Product Forge card for this project?" |

**Audit finding:** Product Forge's product-context skill overlaps with Forge Memory's org-context skill. Both claim to resolve taxonomy. The ecosystem test should verify which one actually fires and whether they produce consistent results.

---

### Contract 3: Report Forge → Product Forge + Forge Memory (Context Pull)

**CLAUDE.md source:** "Report Forge pulls context from product cards and memory when generating reports"

**What should happen:** When Report Forge generates a report, it accepts Product Forge card references as scoping inputs and validates entity names against Forge Memory taxonomy. The investigator agent uses this context to narrow its research scope.

**Test scenarios by plugin:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Report Forge (generate) | Report generation accepts card references | "Generate an architecture review for the billing module — here are the relevant cards: INIT-001, EPIC-003" | Investigator agent receives card references and uses them to scope investigation. Report output cites card content where relevant. |
| Report Forge (generate) | Report validates entities against memory | "Generate a performance analysis for the WebApp product" | "WebApp" is resolved against Forge Memory taxonomy. If it resolves, the canonical name is used throughout. If not, the user is asked to clarify before proceeding. |
| Report Forge (forge-investigator) | Investigator uses memory context for scoping | Agent receives brief with product="WebApp", module="Billing" | Investigator constrains its codebase scanning and metric collection to the Billing module of WebApp, as defined by Forge Memory taxonomy entries. |
| Product Forge (review) | Card review suggests report generation | "Review the billing initiative card" | After presenting the review (strengths, gaps, suggestions), the output suggests: "For a deeper analysis, you can generate a report with `/report-forge:generate`." |
| Forge Memory (recall) | Memory recall suggests report context | "What do we know about the payments integration?" | If substantial knowledge exists, suggests: "There's enough context here to generate a focused report with `/report-forge:generate`." |

---

### Contract 4: Cognitive Forge → Product Forge + Tasks Forge (Decision → Action)

**CLAUDE.md source:** "Cognitive Forge debate outcomes inform product card decisions and task priorities"

**What should happen:** When a Cognitive Forge debate or explore session produces a clear decision or recommendation, the system suggests capturing it as a Product Forge decision card and/or adjusting task priorities in Tasks Forge.

**Test scenarios by plugin:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Cognitive Forge (debate) | Debate outcome suggests decision card | "Debate whether we should migrate from REST to GraphQL" | After synthesis completes, output includes: "This debate produced a clear recommendation. Would you like to capture it as a decision card with `/product-forge:create`?" |
| Cognitive Forge (explore) | Exploration insight suggests task creation | "Let's explore the implications of switching to event-driven architecture" | If exploration surfaces actionable items, suggests: "These action items could be tracked as tasks with `/tasks-forge:add`." |
| Product Forge (create) | Decision card references debate session | "Create a decision card from the GraphQL debate" | Card creation pulls context from the Cognitive Forge session record. The decision card's rationale references the debate's synthesis output. |
| Tasks Forge (task-management) | Task priorities informed by debate outcomes | "Reprioritize my tasks based on the architecture decision" | Skill can reference Cognitive Forge session records to justify priority changes (e.g., "Based on the debate outcome favoring GraphQL migration, the REST API cleanup task should be deprioritized"). |

**Audit finding:** Cognitive Forge has weak cross-plugin handoff. Neither debate nor explore commands mention Product Forge or Tasks Forge as downstream consumers.

---

### Contract 5: Behavioral Directive — Proactive Handoff Suggestions

**CLAUDE.md source:** "When finishing work in one plugin, consider whether the output should flow into another. Suggest the connection — don't wait for the user to ask."

**What should happen:** Every plugin command that produces output should evaluate whether that output is relevant to another plugin and proactively suggest the handoff.

**Test scenarios (applies to ALL plugins):**

| Completing Plugin | Completed Action | Expected Handoff Suggestion |
|---|---|---|
| Forge Memory (remember) | New person/project/term added | "This is now available for Product Forge card enrichment and Report Forge scoping." |
| Forge Memory (setup-org) | Taxonomy configured | "Product Forge cards and Report Forge reports will now validate against this taxonomy." |
| Tasks Forge (add) | New task created | "If this relates to a Product Forge story, you can link them." |
| Tasks Forge (update, triage mode) | Triage completed | "Consider generating a status report with `/report-forge:generate` to share triage outcomes." |
| Product Forge (create) | Card created | "Would you like to push this to Jira with `/product-forge:push-to-jira`?" and "Should we track implementation tasks in `/tasks-forge:add`?" |
| Product Forge (checkpoint) | Knowledge captured | "Any decisions in this checkpoint could become decision cards. Any open items could become tasks." |
| Cognitive Forge (debate) | Debate completed | Suggest decision card and/or task creation (see Contract 4). |
| Report Forge (generate) | Report generated | "Action items in this report could be tracked as tasks. Recommendations could inform product card updates." |
| a removed harvest plugin (capture) | Harvest completed | "Review pending items with ``, then promote to Tasks Forge and Forge Memory." |
| Rovo Forge (jira-agent) | Agent config produced | "You can test this agent against Jira issues referenced in your Product Forge cards." |

---

### Contract 6: Behavioral Directive — Memory-First Resolution

**CLAUDE.md source:** "Always check Forge Memory first when the user uses shorthand, acronyms, or names you don't recognize."

**What should happen:** Any plugin that encounters unrecognized shorthand, acronyms, or informal names should check Forge Memory before proceeding. This is not optional; it's a workspace-level behavior requirement.

**Test scenarios (applies to ALL plugins that process user-provided entity names):**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Product Forge (create) | Acronym in card request | "Create a story for the PSR v2 migration" | Checks Forge Memory for "PSR" before proceeding. If found, uses canonical expansion. If not found, asks user to clarify and offers to remember it. |
| Tasks Forge (add) | Shorthand in task description | "Add a task: fix the WPA auth bug for Acme" | Checks Forge Memory for "WPA" and "Acme" before creating the task. Uses canonical names in the task description. |
| Report Forge (generate) | Informal reference in report request | "Generate a deep-dive on the mobile app performance issues" | Checks Forge Memory to resolve "mobile app" to canonical product name before scoping the investigation. |
| Cognitive Forge (debate) | Domain term in debate topic | "Debate whether we should sunset the legacy SOAP endpoints" | Checks Forge Memory for "SOAP endpoints" and any related product/module context to inform the debate. |
| a removed harvest plugin (capture) | Shorthand in transcript content | Transcript contains "Todd mentioned the CRM is down" | During harvest, checks Forge Memory to resolve "Todd" (person) and "CRM" (product/module) for proper attribution and categorization. |

---

## Part 2: Implied Ecosystem Flows (from Audit Findings)

These flows are not explicitly stated in CLAUDE.md but were identified during the audit as natural connections that *should* exist based on the plugins' purposes.

### Implied Flow 1: Product Forge → Jira → Back to Product Forge (Sync Loop)

**Source:** Product Forge audit, jira-sync skill analysis

**What should happen:** After creating a card, the system should suggest pushing to Jira. After pushing to Jira, it should note that future Jira changes can be pulled back. This creates a bidirectional sync awareness loop.

**Test scenarios:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Product Forge (create) | Post-creation Jira suggestion | "Create an epic for the authentication overhaul" | After card creation, suggests: "Push to Jira with `/product-forge:push-to-jira`?" |
| Product Forge (push-to-jira) | Post-push pull reminder | "Push EPIC-005 to Jira" | After successful push, notes: "If this issue gets updated in Jira, you can pull changes back with `/product-forge:pull-from-jira`." |
| Product Forge (update) | Post-update re-sync suggestion | "Update STORY-012 with revised acceptance criteria" | If the story is linked to Jira, suggests: "This card is linked to PROJ-456 in Jira. Would you like to push the updates?" |

---

### Implied Flow 2: a removed harvest plugin → Cognitive Forge (Complex Discussions → Debate)

**Source:** Cross-referencing a removed harvest plugin's knowledge harvester with Cognitive Forge's debate capability

**What should happen:** When a removed harvest plugin's knowledge harvester identifies a complex, unresolved discussion (multiple viewpoints, no clear consensus), it should suggest a Cognitive Forge debate to properly analyze the topic.

**Test scenarios:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| a removed harvest plugin (capture) | Complex discussion flagged | Transcript contains a multi-person debate about architecture choices | Knowledge harvester tags the item as "unresolved discussion" and suggests: "This looks like a decision that could benefit from structured analysis with `/cognitive-forge:debate`." |

---

### Implied Flow 3: Report Forge → Cognitive Forge (Analysis → Deeper Exploration)

**Source:** Report Forge analyst agent's pattern identification combined with Cognitive Forge's exploration capability

**What should happen:** When a report identifies a pattern or risk that warrants deeper analysis, it should suggest a Cognitive Forge explore or debate session.

**Test scenarios:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Report Forge (generate) | Report surfaces decision-worthy finding | Report analysis identifies a significant architectural risk | Report recommendations include: "This risk warrants deeper evaluation. Consider `/cognitive-forge:debate` to analyze alternatives." |

---

### Implied Flow 4: Tasks Forge → Report Forge (Task Status → Status Reports)

**Source:** Tasks Forge triage data combined with Report Forge's quarterly review and executive summary types

**What should happen:** After a triage session surfaces patterns (many blocked tasks, overdue items piling up), the system suggests generating a status report.

**Test scenarios:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Tasks Forge (update, triage) | Triage reveals systemic issues | Triage surfaces 5+ blocked tasks or 10+ overdue items | Post-triage summary suggests: "There are several systemic blockers. Consider generating a status report with `/report-forge:generate` to surface these to leadership." |

---

### Implied Flow 5: Forge Memory → All Plugins (Taxonomy Change Propagation)

**Source:** Forge Memory's role as the "shared brain" and the fact that taxonomy changes affect every downstream consumer

**What should happen:** When taxonomy is modified (new product added, team renamed, module reorganized), the system should note which plugins will be affected and suggest reviewing dependent content.

**Test scenarios:**

| Plugin Under Test | Test Scenario | User Prompt | Ecosystem Assertion |
|---|---|---|---|
| Forge Memory (setup-org) | Taxonomy reorganization | "Rename the Payments module to Payment Processing" | After rename, notes: "Existing Product Forge cards referencing 'Payments' should be reviewed. Existing tasks with this module should be checked." |
| Forge Memory (triage) | Knowledge entry archived | "Archive the entry about the legacy SOAP integration" | After archiving, notes: "Report Forge reports referencing this integration may need updating." |

---

## Part 3: Plugin Responsibility Matrix

This matrix shows which ecosystem contracts each plugin participates in. Eval teams should use this to identify which contracts apply to their plugin.

| Plugin | Produces For | Consumes From | Contracts Involved |
|---|---|---|---|
| **Forge Memory** | All plugins (taxonomy, knowledge) | a removed harvest plugin (promoted knowledge) | 1, 2, 3, 5, 6, IF5 |
| **Tasks Forge** | Report Forge (status data) | a removed harvest plugin (promoted tasks), Cognitive Forge (priority input) | 1, 4, 5, 6, IF4 |
| **Product Forge** | Report Forge (card references), Tasks Forge (implementation work) | Forge Memory (taxonomy) | 2, 3, 4, 5, 6, IF1 |
| **Cognitive Forge** | Product Forge (decisions), Tasks Forge (priorities) | Forge Memory (domain context) | 4, 5, 6, IF2, IF3 |
| **Report Forge** | Tasks Forge (action items), Product Forge (card updates) | Product Forge (cards), Forge Memory (taxonomy) | 3, 5, 6, IF3, IF4 |
| **a removed harvest plugin** | Tasks Forge (harvested tasks), Forge Memory (harvested knowledge) | Forge Memory (context for harvesting) | 1, 5, 6, IF2 |
| **Rovo Forge** | External (Rovo agent configs) | Forge Memory (org context for agent scoping) | 5, 6 |
| **Cowork Plugin Mgmt** | External (plugin packages) | None (standalone) | 5 |

*IF = Implied Flow*

---

## Part 4: Ecosystem Grading Criteria

When grading ecosystem test cases, use these assertion types:

### Level 1: Awareness (Minimum Bar)
The skill's output **mentions** the relevant downstream plugin or upstream source. Even a generic mention counts.

**Example passing assertion:** After creating a card, output includes any reference to Jira sync, Tasks Forge, or Forge Memory.
**Example failing assertion:** Card is created with no mention of any other plugin.

### Level 2: Specificity (Expected Bar)
The skill's output names the **specific command** to invoke and provides enough context for the user to act on it.

**Example passing assertion:** "Push this card to Jira with `/product-forge:push-to-jira STORY-012`"
**Example failing assertion:** "You might want to sync this with Jira" (no specific command)

### Level 3: Context Passing (Ideal Bar)
The skill's output provides information in a format that the downstream plugin can **directly consume** without re-entry.

**Example passing assertion:** After a debate, the output structures the decision in a format that maps to Product Forge's decision card schema (decision type, rationale, alternatives considered, impact).
**Example failing assertion:** Debate produces a narrative summary that would require the user to manually restructure it for a decision card.

### Level 4: Automatic Flow (Aspirational Bar)
The skill **automatically invokes** the downstream plugin (with user confirmation) rather than just suggesting it.

**Example passing assertion:** After creating a card, the system asks "Would you like me to push this to Jira now?" and on confirmation, executes the push.
**Example failing assertion:** System only suggests the command but doesn't offer to execute it.

---

## Part 5: Test Case Template for Eval Teams

Each eval team should produce ecosystem test cases in this format (compatible with the Skill Creator's evals.json structure):

```json
{
  "id": "ecosystem-[plugin]-[contract]-[number]",
  "description": "Brief description of what this tests",
  "contract": "Contract N or Implied Flow N",
  "user_prompt": "The exact user message that triggers the scenario",
  "setup_context": "Any preconditions (e.g., taxonomy must contain 'WebApp', card STORY-012 must exist)",
  "grading": {
    "ecosystem_awareness": {
      "assertion": "What the output should contain regarding cross-plugin behavior",
      "level": "awareness | specificity | context_passing | automatic_flow",
      "weight": 0.3
    },
    "isolation_correctness": {
      "assertion": "What the output should contain for the skill's own behavior",
      "weight": 0.7
    }
  }
}
```

**Weighting guidance:** Ecosystem assertions should carry 20-30% of the total grade for most test cases. The primary grade (70-80%) still goes to whether the skill does its own job correctly. The exception is skills whose primary job IS cross-plugin flow (like a removed harvest plugin promote or Product Forge push-to-jira), where ecosystem assertions should carry 50%+ weight.

---

## Part 6: Priority Ecosystem Scenarios for Tier 1 Evals

These are the highest-priority ecosystem test cases to include when evaluating Tier 1 candidates (Product Forge create, forge-story, forge-intake) and Tier 2 candidates (Forge Memory memory-management, recall, org-context).

### For Product Forge create (orchestrator):
1. Card creation with a taxonomy term that exists in Forge Memory → verify resolution
2. Card creation with an unknown term → verify suggestion to add to memory
3. Card creation completes → verify Jira push suggestion
4. Card creation completes → verify Tasks Forge tracking suggestion
5. Ambiguous card type with domain shorthand → verify memory lookup before type detection

### For Product Forge forge-story (agent):
1. Story references a product module from taxonomy → verify canonical name usage
2. Story acceptance tests reference a team → verify team name matches taxonomy
3. Story batch generation for a known product → verify consistent taxonomy usage across all stories
4. Story created → verify handoff suggestion for implementation tasks

### For Product Forge forge-intake (agent):
1. Intake interview mentions an existing project → verify memory recall for context enrichment
2. Intake red-flag probing encounters domain-specific term → verify memory lookup
3. Intake completes → verify suggestion to create Product Forge cards from requirements
4. Intake identifies unresolved decision → verify suggestion for Cognitive Forge debate

### For Forge Memory memory-management (skill):
1. Term decoded → verify downstream consumer notification ("Product Forge and Report Forge can now use this term")
2. Fuzzy match on term used in a Product Forge context → verify consistent resolution
3. Lifecycle filtering removes a term → verify downstream impact notification

### For Forge Memory recall (command):
1. Recall returns project info → verify suggestion to create Product Forge card if none exists
2. Recall returns person info → verify suggestion for enriching related tasks or cards
3. Recall fails (not found) → verify suggestion to add via remember, not just fail silently

### For Forge Memory org-context (skill):
1. Taxonomy query from Product Forge context → verify resolution matches product-context behavior
2. Unknown entity in a multi-plugin context → verify add suggestion with downstream impact noted
3. Taxonomy used for Report Forge scoping → verify consistent entity resolution

---

## Appendix: Ecosystem Contract Summary

| Contract | Source Plugin | Target Plugin(s) | CLAUDE.md Reference | Audit Status |
|---|---|---|---|---|
| 1. Harvest Promotion | a removed harvest plugin | Tasks Forge, Forge Memory | Explicit | Tasks Forge side is MISSING |
| 2. Taxonomy Reference | Forge Memory | Product Forge | Explicit | product-context/org-context overlap |
| 3. Context Pull | Product Forge, Forge Memory | Report Forge | Explicit | Partially implemented |
| 4. Decision → Action | Cognitive Forge | Product Forge, Tasks Forge | Explicit | MISSING on Cognitive Forge side |
| 5. Proactive Handoff | All | All | Explicit directive | WEAK across most plugins |
| 6. Memory-First Resolution | All | Forge Memory | Explicit directive | Only Product Forge partially implements |
| IF1. Jira Sync Loop | Product Forge | Product Forge (self) | Implied | Post-action suggestions MISSING |
| IF2. Complex Discussion → Debate | a removed harvest plugin | Cognitive Forge | Implied | Not implemented |
| IF3. Analysis → Exploration | Report Forge | Cognitive Forge | Implied | Not implemented |
| IF4. Status → Reports | Tasks Forge | Report Forge | Implied | Not implemented |
| IF5. Taxonomy Propagation | Forge Memory | All | Implied | Not implemented |
