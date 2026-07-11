# Product Forge — Audit Card

## Plugin Overview
Product Forge is the largest and most architecturally complex plugin in the Forge ecosystem. It implements a full product management card system with six card types (Initiative, Epic, Story, Decision, Intake, Release Notes), an orchestrator/agent delegation pattern for content generation, bidirectional Jira synchronization, and knowledge checkpointing. The plugin uses a clear separation of concerns: orchestrator commands handle workflow and persistence, specialized agents handle content reasoning, and skills provide shared methodology and context.

## Component Inventory

| Component | Type | Lines | Has References |
|-----------|------|-------|----------------|
| pm-methodology | Skill | 81 | No |
| product-context | Skill | 79 | No |
| jira-sync | Skill | 172 | No |
| init | Command | 96 | No |
| create | Command | 184 | No |
| update | Command | 141 | No |
| review | Command | 109 | No |
| checkpoint | Command | 151 | No |
| push-to-jira | Command | 282 | No |
| pull-from-jira | Command | 288 | No |
| link-to-jira | Command | 239 | No |
| forge-initiative | Agent | 89 | No |
| forge-epic | Agent | 92 | No |
| forge-story | Agent | 105 | No |
| forge-decision | Agent | 86 | No |
| forge-intake | Agent | 108 | No |
| forge-release-notes | Agent | 102 | No |

**Total: 3 skills, 8 commands, 6 agents, 0 reference files**
**Combined line count: ~2,404 lines** (the largest plugin by far)

---

## Per-Component Scores

### pm-methodology (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description covers purpose but is generic. Wouldn't independently trigger on prompts like "help me write a story card" or "what's the right format for an initiative." Relies on being auto-invoked by commands. |
| Core Objective | **Strong** | Clear: provide PM reasoning guidance, tone recommendations, and hierarchy enforcement. The three-level Jira hierarchy (Initiative → Epic → Story) is crisply defined with clear audience and purpose for each level. |
| Procedural Logic | **Strong** | Card type selection logic table is well-designed. Planning progression with explicit "do not skip levels" guidance is strong. |
| Human-in-the-Loop | **Strong** | Explicit disambiguation prompt when card type is unclear. "Discussion before execution" principle is explicitly stated. |
| Output Specifications | **Strong** | Tone-by-card-type guidance is precise. Content guidelines (no dashes, no tables, prose for narrative sections) are explicit and actionable. |
| Reference File Utilization | **Missing** | No reference files. The content guidelines and card type selection logic are substantial enough to warrant extraction, especially since all 6 agents reference pm-methodology. |
| Connector/Tool Integration | **Adequate** | Mentions forge-lib delegation but doesn't list specific commands. |
| Progressive Disclosure | **Strong** | 81 lines, very lean for the amount of guidance it provides. |
| Cross-Plugin Handoff | **Weak** | No mention of Forge Memory taxonomy integration (though product-context handles this). No mention of Tasks Forge for tracking card-related work or Report Forge for card-based reporting. |
| Writing Quality | **Strong** | Incorporates user preferences directly (no dashes, no tables, discussion before execution). Clear reasoning for each guideline. |

### product-context (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description is functional but passive. Would benefit from pushy triggering for prompts involving product names, team references, or client mentions. |
| Core Objective | **Strong** | Clear: resolve shorthand references, enrich card generation, provide organizational context. |
| Procedural Logic | **Strong** | Five-step "on every invocation" checklist is actionable. Graceful degradation for missing taxonomy is well-defined. |
| Human-in-the-Loop | **Adequate** | Offers to add unknown values but doesn't define explicit confirmation gates for shorthand resolution. |
| Output Specifications | **Weak** | Describes capabilities but doesn't specify how resolved context should be presented to users. |
| Reference File Utilization | **Missing** | No reference files despite being a context provider. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib taxonomy commands with syntax examples. |
| Progressive Disclosure | **Strong** | 79 lines, lean. |
| Cross-Plugin Handoff | **Adequate** | Mentions integration with Product Forge commands but doesn't reference Forge Memory org-context skill (which provides the same taxonomy resolution). Potential overlap/confusion. |
| Writing Quality | **Strong** | Clear, well-organized. |

### jira-sync (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Strong** | Description is clear and specific. Marked `user_invocable: false`, which is appropriate since it's consumed by commands. |
| Core Objective | **Strong** | Clear: provide reasoning guidance for bidirectional Jira synchronization. |
| Procedural Logic | **Strong** | Field mapping tables are precise. Conflict resolution strategy is well-defined with three resolution options. Parent relationship validation has a clear four-step flow. |
| Human-in-the-Loop | **Strong** | Conflict presentation template is detailed and actionable. Three resolution options give the user meaningful control. |
| Output Specifications | **Strong** | Conflict presentation template, error message templates, and batch sync summary format are all well-defined. |
| Reference File Utilization | **Missing** | No reference files. The field mapping tables and MCP error patterns are substantial enough to warrant extraction, especially since three Jira commands all reference this skill. |
| Connector/Tool Integration | **Strong** | Explicit MCP tool patterns, error handling signatures, and forge-lib card commands. Best tool integration documentation in the entire Forge ecosystem. |
| Progressive Disclosure | **Strong** | 172 lines, well within limits despite comprehensive content. |
| Cross-Plugin Handoff | **Adequate** | Implicitly consumed by push/pull/link commands. Doesn't reference Forge Memory for taxonomy enrichment during sync. |
| Writing Quality | **Strong** | Precise, technical, well-structured. The "Status Independence Principle" section is a particularly clear piece of reasoning about why local and Jira statuses should remain decoupled. |

### init (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief but functional. |
| Core Objective | **Strong** | Clear: create cards directory structure. |
| Procedural Logic | **Strong** | Simple, clean, idempotent. |
| Human-in-the-Loop | **Strong** | No prompts needed (correct for an init command), clear error guidance. |
| Output Specifications | **Strong** | Success message template is clean. |
| Reference File Utilization | **Missing** | N/A for init. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib init command with JSON parsing. |
| Progressive Disclosure | **Strong** | 96 lines. |
| Cross-Plugin Handoff | **Adequate** | Points to create command. Could suggest /memory:start if memory isn't initialized. |
| Writing Quality | **Strong** | Clean and concise. |

### create (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Strong** | Description lists all six card types and mentions "intelligent card-type detection." Arguments are well-defined with optional type override. |
| Core Objective | **Strong** | Clear: detect card type, recruit agent, get approval, persist. |
| Procedural Logic | **Strong** | Seven-phase orchestrator workflow is the most sophisticated in the Forge. Clean separation: orchestrator handles flow, agents handle reasoning, forge-lib handles persistence. Agent recruitment prompt template is well-structured. |
| Human-in-the-Loop | **Strong** | Phase 4 approval gate is excellent: shows draft, allows revision loops, supports cancel. Ambiguous card type triggers explicit disambiguation. |
| Output Specifications | **Strong** | Draft preview template, batch story output, and confirmation templates are all defined. |
| Reference File Utilization | **Missing** | No reference files. Agent prompt templates could be extracted if they get more complex. |
| Connector/Tool Integration | **Strong** | forge-lib card create, relationship link, and JSON response parsing all documented. |
| Progressive Disclosure | **Strong** | 184 lines, reasonable for a 7-phase orchestrator. |
| Cross-Plugin Handoff | **Weak** | No mention of Forge Memory for taxonomy enrichment (though product-context skill handles this). No mention of Tasks Forge for tracking card implementation. No suggestion to push to Jira after creation. |
| Writing Quality | **Strong** | Exceptionally well-structured. "Agents never write files" rule is a clear, well-reasoned architectural principle. |

### update (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description covers the basics. Arguments include card-reference and update-context, which is good. |
| Core Objective | **Strong** | Clear: identify card, recruit agent for revision, present diff, persist. |
| Procedural Logic | **Strong** | Six-phase workflow mirrors create with appropriate modifications (card identification, semantic diff). |
| Human-in-the-Loop | **Strong** | Diff presentation with approve/adjust/cancel is well-designed. "Never silently overwrite" principle is stated. |
| Output Specifications | **Adequate** | Diff template exists but the format is left to the agent ("semantic diff showing modified, added, removed, unchanged sections"). Could be more prescriptive. |
| Reference File Utilization | **Missing** | No reference files. |
| Connector/Tool Integration | **Strong** | Partial updates via forge-lib (only changed fields) is a good pattern. |
| Progressive Disclosure | **Strong** | 141 lines. |
| Cross-Plugin Handoff | **Missing** | No mention of notifying downstream consumers (e.g., if a Story is updated, should linked Jira issues be re-synced?). |
| Writing Quality | **Strong** | Clean, consistent with create command's architecture. |

### review (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description specifies read-only, which is important. |
| Core Objective | **Strong** | Clear: read-only quality assessment of existing cards. |
| Procedural Logic | **Strong** | Four-phase workflow is appropriate for a read-only operation. |
| Human-in-the-Loop | **Adequate** | Review output has clear next steps, but no gate needed since it's read-only. |
| Output Specifications | **Strong** | Strengths/Gaps/Suggestions/Verdict template with clear next-step commands. |
| Reference File Utilization | **Missing** | No reference files. |
| Connector/Tool Integration | **Adequate** | forge-lib card get and query for identification. |
| Progressive Disclosure | **Strong** | 109 lines. |
| Cross-Plugin Handoff | **Adequate** | Points to update command for applying improvements. Could also suggest push-to-jira if card is linked. |
| Writing Quality | **Strong** | Concise and appropriate. |

### checkpoint (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description is functional. |
| Core Objective | **Strong** | Clear: capture conversation knowledge as a persistent checkpoint card. |
| Procedural Logic | **Strong** | Four-phase workflow (extract → classify → structure → create) with clear domain classification list. |
| Human-in-the-Loop | **Adequate** | Infers classifications from context and only prompts for values that can't be inferred. But doesn't explicitly confirm the checkpoint content before saving (the "automatic save" behavior is noted, but it might benefit from a preview). |
| Output Specifications | **Strong** | Clear markdown template with Summary, Key Points, Decisions & Conclusions, Open Items, Context sections. |
| Reference File Utilization | **Missing** | No reference files. Domain classification list could be extracted. |
| Connector/Tool Integration | **Strong** | forge-lib card create with checkpoint-specific schema, taxonomy integration. |
| Progressive Disclosure | **Strong** | 151 lines. |
| Cross-Plugin Handoff | **Adequate** | References forge-memory taxonomy integration. Could suggest creating Decision cards from checkpoint decisions, or Tasks from open items. |
| Writing Quality | **Strong** | Clean, well-motivated. |

### push-to-jira (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description is clear but brief. |
| Core Objective | **Strong** | Clear: one-way push from card to Jira (create or update mode). |
| Procedural Logic | **Strong** | Clean mode branching (create vs. update) with distinct phase numbering (3A/3B pattern). Parent resolution logic is well-handled. |
| Human-in-the-Loop | **Strong** | Update mode requires confirmation with clear overwrite description. Parent-not-linked warning lets user decide to proceed or exit. Force flag available for power users. |
| Output Specifications | **Strong** | Confirmation templates for both create and update modes. Error templates for all failure cases. |
| Reference File Utilization | **Adequate** | References jira-sync skill for field mapping and MCP patterns rather than duplicating. Good use of cross-skill reference. |
| Connector/Tool Integration | **Strong** | MCP create/update calls, forge-lib card read/update, JSON response handling all explicit. |
| Progressive Disclosure | **Adequate** | 282 lines, getting long. Some content could be extracted to a reference doc, particularly the type mapping table which duplicates jira-sync. |
| Cross-Plugin Handoff | **Missing** | No mention of updating linked Tasks Forge items or notifying via a removed harvest plugin after a push. |
| Writing Quality | **Strong** | Clear destructive operation warnings. Well-structured mode branching. |

### pull-from-jira (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Clear but brief. |
| Core Objective | **Strong** | Clear: one-way pull from Jira to local card. |
| Procedural Logic | **Strong** | Five-phase workflow with semantic diff comparison. Handles both filename and Jira key lookup. "No changes detected" early exit is a good pattern. |
| Human-in-the-Loop | **Strong** | Diff presentation with line-by-line comparison before applying. Force flag for power users. Truncation handling for long descriptions. |
| Output Specifications | **Strong** | Diff format with +/- prefixes, field change listing, truncation rules all specified. Field mapping table is clear. |
| Reference File Utilization | **Adequate** | References jira-sync skill appropriately. |
| Connector/Tool Integration | **Strong** | MCP get_issue, forge-lib card update, field mapping with unit conversion (seconds → hours). |
| Progressive Disclosure | **Weak** | 288 lines, the longest command in the entire Forge. The field mapping table duplicates jira-sync content. Should extract to reference or rely entirely on jira-sync. |
| Cross-Plugin Handoff | **Missing** | No mention of updating related tasks or notifying other plugins of content changes. |
| Writing Quality | **Strong** | Thorough, well-structured. Status independence principle is reinforced appropriately. |

### link-to-jira (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Clear, mentions both create-new and link-existing workflows. |
| Core Objective | **Strong** | Clear: establish bidirectional link between card and Jira issue. |
| Procedural Logic | **Strong** | Five-phase workflow with search → present options → handle selection. JQL query construction is explicit. Already-linked re-link flow is well-handled. |
| Human-in-the-Loop | **Strong** | Options presentation with numbered selection. Re-link confirmation. Never silently creates Jira issues. |
| Output Specifications | **Strong** | Search results presentation, confirmation template, error messages all defined. |
| Reference File Utilization | **Adequate** | References jira-sync skill. |
| Connector/Tool Integration | **Strong** | MCP search and create, forge-lib card update. |
| Progressive Disclosure | **Adequate** | 239 lines, getting long. |
| Cross-Plugin Handoff | **Missing** | Could suggest push-to-jira or pull-from-jira as next steps after linking. |
| Writing Quality | **Strong** | Non-destructive operation clearly stated. Well-structured options flow. |

### forge-initiative (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Strong** | Clear agent identity and description. Tools and skills explicitly listed in frontmatter. |
| Core Objective | **Strong** | Clear: generate Initiative cards with executive-tone reasoning. |
| Procedural Logic | **Strong** | Three modes (create/update/review) with distinct output formats for each. Create mode sections are well-defined with guidance on content depth (e.g., "2-3 paragraphs"). |
| Human-in-the-Loop | **Adequate** | States assumptions when brief is ambiguous rather than guessing silently. But the agent doesn't define its own review gates; it relies on the orchestrator. |
| Output Specifications | **Strong** | Detailed frontmatter schema and section definitions with content guidance per section. Review mode has explicit criteria. |
| Reference File Utilization | **Adequate** | References pm-methodology and product-context skills via frontmatter. No standalone reference files. |
| Connector/Tool Integration | **Strong** | Read-only tools explicitly listed. "Never call forge-lib, Bash, or Write" rule is clear. |
| Progressive Disclosure | **Strong** | 89 lines. |
| Cross-Plugin Handoff | **Weak** | No mention of how Initiatives flow into Epics or how taxonomy should be used for affected_systems. Relies on orchestrator for this. |
| Writing Quality | **Strong** | Executive tone guidance is well-crafted. |

### forge-epic (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| All dimensions follow same pattern as forge-initiative | **Strong** overall | Same architectural quality. Key differentiator: review criteria are Epic-specific ("Could an engineering team use this to plan a sprint?"). Suggested stories section is a good structural feature. |

### forge-story (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Strong** | Description mentions batch generation, which is a key feature. |
| Core Objective | **Strong** | Clear: generate Story cards with engineering-precise specs. |
| Procedural Logic | **Strong** | Two title format options (user story vs. directive) with guidance on when to use each. Validation rules before returning content are a good defensive pattern. |
| Human-in-the-Loop | **Adequate** | Relies on orchestrator for approval gates. |
| Output Specifications | **Strong** | Most detailed of all agents. Acceptance test format (Named Test / Steps / Expected Result) is well-specified. Batch generation output format defined. |
| Reference File Utilization | **Adequate** | References pm-methodology and product-context. |
| Connector/Tool Integration | **Strong** | Read-only tool constraints clearly defined. |
| Progressive Disclosure | **Strong** | 105 lines. |
| Cross-Plugin Handoff | **Weak** | No mention of how Stories relate to Tasks Forge items or how Jira sync should be considered. |
| Writing Quality | **Strong** | Engineering tone guidance is excellent. "Describe 'what' not 'how'" is well-reasoned. |

### forge-decision (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Core Objective | **Strong** | Clear: extract and classify decisions from conversation context. Decision type classification with five categories is well-defined. |
| Output Specifications | **Strong** | Title guidance with good/bad examples is a nice touch. |
| Writing Quality | **Strong** | "Enough context to be understood months later by someone who wasn't in the room" is an excellent motivating principle. |
| Other dimensions | **Adequate to Strong** | Follows same strong patterns as other agents. |

### forge-intake (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Core Objective | **Strong** | Clear: structured requirements gathering through adaptive Q&A. |
| Procedural Logic | **Strong** | Four-phase progressive interview with seven topic areas. Red flag probing section is the most sophisticated behavioral guidance in any Forge agent. |
| Human-in-the-Loop | **Strong** | Inherently interactive. 3-4 questions per batch avoids overwhelming. "Handle I don't know gracefully" is good guidance. |
| Output Specifications | **Strong** | Comprehensive intake card structure with 10+ sections. |
| Writing Quality | **Strong** | "Without making them feel interrogated" is great tone guidance. |

### forge-release-notes (Agent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Core Objective | **Strong** | Clear: categorize changes and draft customer-facing release notes. |
| Procedural Logic | **Strong** | Two-phase (categorize → draft) with clear decision tree for categorization. Internal vs. external filter logic is well-defined. |
| Output Specifications | **Strong** | Writing style, avoid lists, and internal/external filter rules are all explicit and actionable. |
| Writing Quality | **Strong** | "Avoid" list (no Jira numbers, no developer jargon, no negative framing) is practical and well-reasoned. |

---

## Strengths

1. **The orchestrator/agent architecture is Product Forge's greatest structural achievement.** The clean separation between orchestrator commands (workflow + persistence), specialized agents (content reasoning), and skills (shared methodology) is sophisticated and well-executed. Each component has a clear responsibility boundary, and the "agents never write files" rule prevents architectural drift.

2. **The agent suite is remarkably consistent.** All six agents follow the same structural pattern (identity → input → output format per mode → content guidelines → rules) while each brings genuinely differentiated reasoning guidance. The forge-intake red flag probing and forge-decision type classification are standout features.

3. **Jira synchronization is the most thoroughly documented integration in the Forge.** The jira-sync skill provides comprehensive field mapping, conflict resolution strategies, error handling patterns, and the status independence principle. The three Jira commands (push/pull/link) reference this skill effectively rather than duplicating.

4. **Human-in-the-loop design is consistently strong across commands.** The create command's approval gate, the pull-from-jira diff presentation, and the link-to-jira options flow all demonstrate careful interactive design.

5. **pm-methodology directly encodes user preferences.** The no-dashes, no-tables, and discussion-before-execution rules are explicitly stated, ensuring all downstream agents and commands respect these preferences.

## Critical Gaps

1. **No reference files anywhere across 17 components.** This is the most significant structural gap given the plugin's size. The Jira field mapping tables are partially duplicated between jira-sync and pull-from-jira. The card type selection logic in pm-methodology could be a shared reference for create command and all agents. Agent prompt templates in the create/update/review commands contain substantial inline content that could be extracted.

2. **Cross-plugin handoff awareness is weak to missing.** Despite being the central planning plugin, Product Forge rarely suggests connections to other Forge plugins:
   - No suggestion to push to Jira after card creation
   - No mention of Tasks Forge for tracking card implementation work
   - No mention of Report Forge for card-based reporting
   - No mention of a removed harvest plugin for notifications or context
   - No suggestion to create Forge Memory entries when new products/teams are mentioned

3. **The three Jira commands are long (239-288 lines each) and could benefit from extraction.** Common patterns like card identification, forge-lib response handling, and Jira error handling are repeated across all three commands. A shared `references/jira-command-patterns.md` would reduce duplication and line counts.

4. **product-context skill overlaps with Forge Memory's org-context skill.** Both provide taxonomy resolution and shorthand mapping. The boundary between them is unclear: when does an agent use product-context vs. org-context? This could cause inconsistent behavior depending on which skill triggers.

5. **Checkpoint command lacks a pre-save review gate.** Unlike create/update which present drafts for approval, checkpoint auto-saves. Given that checkpoints capture conversation understanding (which could be wrong), a preview before persistence would improve quality.

## Triage Recommendation

**Full eval candidates (5):**

- **create (orchestrator workflow)** — This is the most complex workflow in the entire Forge ecosystem: card type detection → context assembly → agent recruitment → approval loop → persistence → relationship linking. Does the card type detection logic correctly classify ambiguous prompts? Does the agent recruitment produce coherent drafts? Does the revision loop work smoothly? Does relationship linking handle parent-not-synced edge cases? The seven-phase flow has many potential failure points that only running real test cases can validate.

- **forge-initiative (agent)** — Does the executive-tone reasoning actually produce leadership-appropriate content? Are ROM estimations reasonable? Does the affected_systems section correctly reference taxonomy? Is the "2-3 paragraphs" guidance for Background and Proposed Solution producing the right level of detail? Agent output quality directly determines card quality.

- **forge-story (agent)** — The engineering spec writer is arguably the highest-stakes agent because engineers work from Stories directly. Do acceptance tests follow the Named Test / Steps / Expected Result format reliably? Are business rules written from business perspective rather than implementation? Is the atomic scope guidance (1-3 days) producing correctly scoped stories? Does batch generation produce consistent quality across multiple stories?

- **forge-intake (agent)** — The adaptive interview with red flag probing is the most complex interactive behavior in any Forge agent. Does the seven-topic coverage produce comprehensive requirements? Does the red flag probing actually trigger on vague language ("just a simple toggle")? Does the 3-4 questions per batch pacing feel natural? This agent's quality directly determines how well features are scoped.

- **jira-sync (skill) + push-to-jira + pull-from-jira (tested together)** — The bidirectional sync is the most integration-heavy workflow in the Forge. Does field mapping produce correct conversions (markdown ↔ Jira markup, seconds → hours)? Does conflict detection correctly identify when both systems changed? Does the status independence principle hold in practice? These components should be evaluated as a system since they depend on each other.

**Description optimization candidates (2):**
- **pm-methodology** — should trigger independently on prompts about card formatting, hierarchy questions, or tone guidance
- **product-context** — should trigger on prompts referencing products, modules, or clients by informal names

**Direct improvement candidates (edit without full eval):**
- Extract shared `references/jira-field-mapping.md` from jira-sync to reduce duplication in pull-from-jira
- Extract shared `references/card-identification.md` with the common card lookup pattern used by update, review, push-to-jira, pull-from-jira, and link-to-jira
- Clarify the boundary between product-context and Forge Memory org-context (possibly merge or clearly delineate)
- Add cross-plugin handoff suggestions (especially create → push-to-jira, checkpoint → decision card, update → Jira re-sync)
- Add a preview/confirm gate to the checkpoint command before auto-saving
