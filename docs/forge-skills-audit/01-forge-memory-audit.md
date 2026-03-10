# Forge Memory — Audit Card

## Plugin Overview
Forge Memory is the foundational plugin in the Forge ecosystem. It provides organizational knowledge storage and retrieval, acting as the "shared brain" that other plugins query for taxonomy validation, shorthand resolution, and contextual enrichment. It manages two layers: structured taxonomy (products, clients, teams, integrations) via forge-lib, and unstructured knowledge (people profiles, glossary terms, project details) via markdown files with importance-based lifecycle management.

## Component Inventory

| Component | Type | Lines | Has References |
|-----------|------|-------|----------------|
| memory-management | Skill | 198 | No |
| org-context | Skill | 170 | No |
| start | Command | 125 | No |
| setup-org | Command | 262 | No |
| remember | Command | 129 | No |
| recall | Command | 175 | No |
| triage | Command | 108 | No |

**Total: 2 skills, 5 commands, 0 agents, 0 reference files**

---

## Per-Component Scores

### memory-management (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description covers the core use case ("decoding workplace shorthand") and gives a concrete example. However, it doesn't use the "pushy" triggering pattern; it wouldn't trigger on prompts like "what does X mean internally" or "help me understand our jargon" unless the user explicitly mentions memory. |
| Core Objective | **Strong** | Clear goal: transform shorthand into full context. The "ask todd about PSR" example makes the end-state immediately concrete. |
| Procedural Logic | **Strong** | Four-tier lookup strategy is well-sequenced with explicit dependencies (Taxonomy → Glossary → Deep Memory → Ask User). Each tier has clear scope and fallback rules. |
| Human-in-the-Loop | **Adequate** | Tier 4 defines when to ask the user, and pending.json check adds nuance. However, there's no explicit gate for confirming decoded context before acting on it. |
| Output Specifications | **Weak** | No formal output template. The decoding flow example shows what output looks like, but there's no specification for how decoded context should be formatted or presented to the user. |
| Reference File Utilization | **Missing** | No reference files at all. The lifecycle filtering rules (importance scoring, decay, boost mechanics) are substantial enough to warrant extraction to a reference doc, which would also benefit the triage command. |
| Connector/Tool Integration | **Adequate** | References forge-lib commands and direct file reads, but doesn't list them as formal dependencies. No fallback behavior specified if forge-lib is unavailable. |
| Progressive Disclosure | **Strong** | At 198 lines, well within the 500-line limit. Content is appropriately scoped to reasoning strategy, with file operations explicitly delegated. |
| Cross-Plugin Handoff | **Weak** | Mentions that other plugins query the same taxonomy but doesn't name specific handoff points. No guidance on when to suggest remembering new terms discovered during other workflows. |
| Writing Quality | **Strong** | Excellent use of examples to explain reasoning. Natural, imperative tone. The "decode before acting" principle is well-motivated. No heavy-handed MUSTs. |

### org-context (Skill)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description explains the purpose well and gives a concrete example. But triggering is passive; it relies on other commands to invoke it rather than triggering independently on user prompts about "our products" or "which teams." |
| Core Objective | **Strong** | Clear: transform informal references into validated taxonomy entities. The "billing module in WebApp" example is crisp. |
| Procedural Logic | **Strong** | Three-step resolution strategy (shorthand resolution → validation → suggestion) is well-ordered. Missing taxonomy handling is explicitly covered with graceful degradation. |
| Human-in-the-Loop | **Strong** | Explicit gates: confirm before saving, ask user to clarify ambiguity, offer to add unknown values. The "Should I add it? / Use it anyway / Enter different value" pattern is well-designed. |
| Output Specifications | **Adequate** | Shows presentation format for suggestions but lacks a formal template for how resolved entities should appear in downstream contexts. |
| Reference File Utilization | **Missing** | No reference files. The taxonomy query patterns and forge-lib command reference could be extracted to a reference doc shared with commands. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib commands with syntax examples. Clear distinction between get-taxonomy and set-taxonomy operations. |
| Progressive Disclosure | **Strong** | 170 lines, lean and focused. |
| Cross-Plugin Handoff | **Strong** | Explicitly names Product Forge, Tasks Forge, and Report Forge as consumers of taxonomy. This is the best cross-plugin awareness in the plugin. |
| Writing Quality | **Strong** | Clear, practical, example-driven. "Growth Over Validation" principle is well-reasoned. |

### start (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Description is functional but brief. |
| Core Objective | **Strong** | Unambiguous: initialize the memory system. |
| Procedural Logic | **Strong** | Four-phase workflow with clear sequencing and explicit error handling at each step. |
| Human-in-the-Loop | **Adequate** | Gathers context conversationally but the handoff between "minimal setup" and "full bootstrap" isn't gated by an explicit user choice. |
| Output Specifications | **Strong** | Clear reporting template with file paths and entry counts. |
| Reference File Utilization | **Missing** | N/A for a simple init command. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib commands with JSON response parsing documented. |
| Progressive Disclosure | **Strong** | 125 lines, appropriately sized. |
| Cross-Plugin Handoff | **Adequate** | Mentions setup-org, remember, and recall as next steps but doesn't suggest broader ecosystem bootstrapping. |
| Writing Quality | **Strong** | Clean, imperative, well-structured. |

### setup-org (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief description. |
| Core Objective | **Strong** | Clear: configure organizational taxonomy through interactive interview. |
| Procedural Logic | **Strong** | Seven-phase interview workflow. Well-sequenced by taxonomy type with optional phases explicitly marked. |
| Human-in-the-Loop | **Strong** | Excellent gating: confirms before saving, shows current state, allows skipping sections, provides re-run capability. |
| Output Specifications | **Strong** | Clear reporting template with counts per taxonomy type. |
| Reference File Utilization | **Missing** | The conversational interview templates are substantial. Could extract "taxonomy interview questions" to a reference doc for reuse. |
| Connector/Tool Integration | **Strong** | Thorough: every forge-lib call has explicit syntax and response parsing. |
| Progressive Disclosure | **Adequate** | 262 lines; getting longer but still within limits. The repetitive response-parsing blocks inflate the line count. |
| Cross-Plugin Handoff | **Weak** | Doesn't suggest that after setup, the user should populate knowledge (remember), or that Product Forge cards will now validate against taxonomy. |
| Writing Quality | **Strong** | Natural conversational tone in the interview templates. Good use of examples. |

### remember (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief but functional. |
| Core Objective | **Strong** | Clear: add knowledge entries to the memory system. |
| Procedural Logic | **Strong** | Four-phase workflow with type detection and appropriate detail gathering per type. |
| Human-in-the-Loop | **Adequate** | Gathers details conversationally but doesn't explicitly confirm the assembled entry before saving. Only confirms after the fact. |
| Output Specifications | **Adequate** | Confirmation template exists but is minimal. |
| Reference File Utilization | **Missing** | No reference files. The knowledge entry templates (person, term, project, preference) could be extracted. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib create-knowledge commands with JSON parsing. |
| Progressive Disclosure | **Strong** | 129 lines, lean. |
| Cross-Plugin Handoff | **Missing** | No mention of how remembered entries flow into other plugins. Should suggest "This person/project is now available for Product Forge card creation and Report Forge scoping." |
| Writing Quality | **Adequate** | Functional but less personality than other components. Could benefit from explaining why progressive capture matters. |

### recall (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief. |
| Core Objective | **Strong** | Clear: search organizational memory using tiered lookup. |
| Procedural Logic | **Strong** | Five-phase workflow with three-tier search strategy. Progressive disclosure is built into the search approach. |
| Human-in-the-Loop | **Strong** | Offers to transition to /memory:remember if not found. Suggests related entries for disambiguation. |
| Output Specifications | **Adequate** | Three output templates (taxonomy, knowledge, context) but formatting is minimal. |
| Reference File Utilization | **Missing** | No reference files. |
| Connector/Tool Integration | **Strong** | Explicit forge-lib commands for both taxonomy and knowledge queries. |
| Progressive Disclosure | **Strong** | 175 lines, well-scoped. |
| Cross-Plugin Handoff | **Weak** | Should note that recall results can seed Product Forge card creation or Report Forge context. |
| Writing Quality | **Strong** | Clear, well-exemplified. Keyword extraction section is a nice touch. |

### triage (Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Trigger & Description | **Adequate** | Brief. |
| Core Objective | **Strong** | Clear: review aging entries, take batch keep/archive/delete actions. |
| Procedural Logic | **Strong** | Five-phase workflow with clean batch action parsing. |
| Human-in-the-Loop | **Strong** | Excellent: numbered entry references, batch action syntax, "no silent deletes" principle, graceful error handling. |
| Output Specifications | **Strong** | Clear presentation template for entries needing attention and summary report. |
| Reference File Utilization | **Missing** | The decay/importance scoring mechanics referenced here overlap with memory-management. A shared reference doc would reduce duplication. |
| Connector/Tool Integration | **Strong** | Explicit triage-specific forge-lib commands (triage-report, triage-keep, triage-archive, triage-delete). |
| Progressive Disclosure | **Strong** | 108 lines, compact. |
| Cross-Plugin Handoff | **Missing** | No mention that triaged-out entries might affect Product Forge cards or Report Forge context. |
| Writing Quality | **Strong** | Clean, imperative, well-structured. |

---

## Strengths

1. **Procedural logic is consistently strong.** Every command follows a clear phased workflow with explicit sequencing and error handling. This is the most structurally consistent plugin in terms of operational flow.

2. **forge-lib delegation is thorough.** Every component cleanly separates reasoning (the skill/command's job) from execution (forge-lib's job). JSON response parsing is documented at every call site.

3. **The tiered lookup strategy is the plugin's crown jewel.** The memory-management skill's four-tier progressive disclosure approach (Taxonomy → Glossary → Deep Memory → Ask User) is architecturally elegant and well-explained. The importance scoring with decay, boost, and lifecycle filtering (trusted/probationary/sunset) is a sophisticated knowledge management pattern.

4. **Human-in-the-loop design is generally strong.** Triage's batch action parsing and setup-org's section-skipping are particularly well-designed interactive patterns.

5. **Writing quality is above average.** The plugin consistently explains reasoning rather than issuing rigid mandates. The "decode before acting" principle in memory-management is a good example of motivating behavior through understanding.

## Critical Gaps

1. **No reference files anywhere.** This is the most significant structural gap. The lifecycle scoring rules (importance decay, boost mechanics, sunset/probationary thresholds) appear in memory-management but are also needed by triage and recall. This should be a shared reference doc. The forge-lib command catalog could also be a reference rather than repeated inline in every command.

2. **Cross-plugin handoff awareness is weak to missing.** org-context is the only component that explicitly names downstream consumers. The commands (remember, recall, triage) operate in isolation despite being foundational to every other plugin. After remembering a person or project, the system should suggest how that knowledge enriches Product Forge card creation, Report Forge scoping, and Slack Forge context.

3. **Skill descriptions need "pushy" triggering improvements.** Both memory-management and org-context have descriptions that work when other commands invoke them, but they wouldn't independently trigger on user prompts like "what does [acronym] mean?" or "who is [person]?" The descriptions should explicitly capture these natural-language patterns.

4. **Output specifications are inconsistent.** Triage and setup-org have clear output templates; memory-management, remember, and recall do not formally specify how their outputs should be structured for the user.

5. **Remember command lacks pre-save confirmation gate.** Unlike setup-org which confirms before saving, remember only confirms after the fact. For a knowledge system, validating the assembled entry before persisting it is important.

## Triage Recommendation

**Full eval candidates (3):**

- **memory-management** — The tiered lookup strategy is the most complex behavioral logic in the plugin. Structural review confirms the design is sound, but reading well and performing well are different things. Test cases should validate: Does the four-tier cascade produce correct decoded context? Does fuzzy matching resolve partial terms? Does importance-based lifecycle filtering (trusted/probationary/sunset) produce sensible results? Does the boost-on-recall mechanic work as intended? These are behavioral questions that only running the skill against realistic prompts can answer.

- **recall** — This is the user-facing execution of the tiered lookup strategy. Test cases like "who is todd," "what does PSR mean," and "tell me about the phoenix project" would directly validate whether tiered search, keyword extraction, progressive disclosure, and result presentation work as designed. The transition to /memory:remember on "not found" is also worth testing for smoothness.

- **org-context** — The shorthand resolution and validation logic ("billing stuff" → Billing module) makes behavioral claims that deserve testing. Does fuzzy matching actually resolve informal references? Does the "offer to add unknown values" flow work? Does taxonomy suggestion formatting help or confuse? The cross-plugin integration claim (Product Forge, Tasks Forge, Report Forge all consume this) makes behavioral quality especially important since failures here cascade.

**Description optimization candidates (2):**
- **memory-management** and **org-context** — both would benefit from the Skill Creator's description optimization loop (run_loop.py) to improve independent triggering accuracy on natural-language prompts.

**Direct improvement candidates (edit without full eval):**
- Extract a shared `references/lifecycle-scoring.md` covering importance decay, boost, and threshold rules
- Extract a shared `references/forge-lib-commands.md` cataloging all memory-related forge-lib commands
- Add cross-plugin handoff suggestions to remember, recall, and triage
- Add pre-save confirmation gate to remember command
