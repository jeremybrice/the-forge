# Cognitive Forge Plugin Audit

**Audit Date**: 2026-03-09
**Plugin**: Cognitive Forge 2.2.0
**Plugin Path**: `/sessions/inspiring-amazing-edison/mnt/.local-plugins/cache/the-forge/cognitive-forge/2.2.0/`
**Auditor**: Claude Code Agent
**Status**: Full Evaluation Required

---

## Plugin Overview

Cognitive Forge is a sophisticated multi-component system for concept evaluation and exploration. The plugin orchestrates specialized agents (Challenger, Explorer, Synthesizer, Decomposer, Evaluator) through two primary interaction modes (debate and explore), all grounded in a shared cognitive techniques foundation. The system is designed to move concepts through structured analysis phases, from intake through synthesis and persistence.

The plugin bridges conversational depth (explore mode, dialogically driven) with parallel analysis intensity (debate mode, agent-orchestrated). Both commands support optional agent recruitment based on complexity assessment and both persist session records using forge-lib integration.

**Total Plugin Size**: 1319 lines across 9 components (SKILL.md is non-invocable foundation).

---

## Component Inventory

| Component | Type | Lines | Primary Role | Agent Spawning | Citation |
|-----------|------|-------|--------------|-----------------|----------|
| **SKILL.md** | Foundation Skill | 49 | Preloaded cognitive techniques reference. Classifies concepts and lists 10 techniques for all agents. | None (preloaded) | skills/cognitive-techniques/ |
| **techniques.md** | Reference Doc | 303 | Complete specification of all 10 cognitive techniques with implementation guidance, conversational moves, outputs. | None (reference library) | skills/cognitive-techniques/references/ |
| **debate.md** | Command Protocol | 333 | Moderator orchestration. Intake → spawn core agents (Challenger, Explorer, Synthesizer) + optionally Decomposer/Evaluator → present results → optional cross-exam → synthesis → forge-lib persist. | 3 core + up to 2 conditional | commands/ |
| **explore.md** | Command Protocol | 304 | Guide orchestration. Intake → decomposition → multi-angle exam → adversarial test → creative expansion → synthesis → forge-lib persist. Recruits Decomposer/Evaluator only if complexity warrants. | 0-2 conditional | commands/ |
| **forge-challenger.md** | Agent Role | 62 | Adversarial analyst. Steel opposition, boundary mapping, pre-mortem, inversion. Spawned by debate (always) and potentially called conversationally in explore. | Spawned (debate) or recruited (explore) | agents/ |
| **forge-decomposer.md** | Agent Role | 71 | Structural analyst. Component map, dependency graph, assumption stack, boundary definition. Recruited conditionally (4+ components or nested dependencies). | Spawned conditional | agents/ |
| **forge-evaluator.md** | Agent Role | 74 | Evidence grounding. Claim inventory, evidence assessment, reality gaps, comparables. Recruited for factual/checkable claims. | Spawned conditional | agents/ |
| **forge-explorer.md** | Agent Role | 61 | Creative expansion. Adjacent possibilities, constraint reframe, amplified vision, hybrids. Spawned by debate (always) and embodied conversationally in explore. | Spawned (debate) or embodied (explore) | agents/ |
| **forge-synthesizer.md** | Agent Role | 62 | Integration analyst. Core thread, quality calibration, tension map, refinement proposal. Spawned by debate (always) and embodied conversationally in explore. | Spawned (debate) or embodied (explore) | agents/ |

---

## Per-Component Scores

### SKILL.md (Cognitive Techniques Foundation)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Non-invocable by design. Preloaded into all agents. Taxonomy is clear and foundational. |
| 2. Core Objective | Strong | Foundation for agent cognition is unambiguous: shared analytical toolkit with 10 techniques classified by concept type. |
| 3. Procedural Logic | Strong | Concept classification drives technique selection. Rules are clear (Business → emphasize stakeholders, Philosophical → decomposition/opposition, Framework → boundaries, Creative → expansion). |
| 4. Human-in-Loop Gates | Adequate | No pause points needed (non-invocable), but classification relies on agent judgment. No validation mechanism for misclassification. |
| 5. Output Specifications | Strong | Technique reference list is crisp; output expectations deferred to agents who receive full spec in techniques.md. |
| 6. Reference File Utilization | Strong | Clearly delegates detailed specs to techniques.md. No self-redundancy. |
| 7. Connector/Tool Integration | Adequate | Implicit dependency on agents reading techniques.md. No explicit tool dependencies (skill is information-providing only). |
| 8. Progressive Disclosure | Strong | 49 lines is disciplined. Heavy lifting pushed to techniques.md (303 lines). Clear separation of concerns. |
| 9. Cross-Plugin Handoff | Strong | Taxonomy enables conceptual consistency across Forge Memory (concept type vocabulary matches), Report Forge (classification method), and both commands. |
| 10. Writing Quality | Strong | Explains "why" techniques matter for concept types. Imperative form ("Identify primary mode," "Emphasize stakeholder perspectives"). Avoids MUSTs (uses goal-oriented language). |

**Summary**: Foundational skill is architecturally sound. Acts as the cognitive Rosetta Stone for all agents. No behavioral claims (non-invocable), so limited triage exposure.

---

### techniques.md (Cognitive Techniques Reference)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Not user-invocable directly, but agents explicitly read this file. 10 techniques are described with purpose, implementation, conversational moves, output format. |
| 2. Core Objective | Strong | Each technique has crisp purpose statement and implementation sections. Success = agent internalizes technique patterns and applies them contextually. |
| 3. Procedural Logic | Strong | Implementation sections provide step-by-step logic (e.g., Steel Opposition: identify credible critic → articulate worldview → build case → present charitably). Decomposition technique lists explicit substeps. |
| 4. Human-in-Loop Gates | Adequate | Technique library itself has no gates. Pause points depend on agents executing techniques conversationally. Techniques like "Sequential Deepening" explicitly call for layered structure, which is agent-responsibility. |
| 5. Output Specifications | Strong | Each technique specifies expected output form (e.g., "Output: A structural map both parties can reference"). Conversational moves show how to transition into technique. |
| 6. Reference File Utilization | Strong | Self-contained reference. No internal backrefs needed. Cited by agents in prompts. Cited by commands in agent spawn templates. |
| 7. Connector/Tool Integration | Adequate | No tools invoked. Pure cognitive methods. Agents receive tool permissions independently (Read/Grep/Glob for Challenger/Decomposer/Explorer/Synthesizer; WebSearch/WebFetch for Evaluator). |
| 8. Progressive Disclosure | Strong | 303 lines is disciplined for a reference library. Detailed but not bloated. Table of contents, clear sections, stopping conditions where appropriate (e.g., Iterative Refinement). |
| 9. Cross-Plugin Handoff | Adequate | Techniques are self-contained. Could be repurposed in other plugins (Report Forge could use Boundary Mapping, Perspective Synthesis). Current integration shows only one-way citation (agents read, commands cite). No backward links. |
| 10. Writing Quality | Strong | "Why" is front-and-center ("Purpose:" sections). Conversational moves show imperative phrasing. "When to Use" establishes context before implementation. Avoids rhetoric; uses concrete moves. |

**Summary**: Reference library is exemplary. Depth without digression. Behavioral responsibility is correctly placed on agents who read and apply techniques. No direct execution claims (non-invocable).

---

### debate.md (Moderator Protocol Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Adequate | Description reads well ("Deep concept evaluation through multi-agent debate") but description is somewhat passive. Strong trigger would emphasize "When concepts need rigorous adversarial testing and multi-angle synthesis" or similar urgency language. Current description triggers on technical phrase, not user intent. |
| 2. Core Objective | Strong | End-state is crystal clear: phase-driven orchestration from intake through synthesis to forge-lib persist. Moderator role is explicitly defined (recruit agents, manage debate, synthesize, not analyze). |
| 3. Procedural Logic | Strong | 6 phases explicitly named and sequenced: Intake (classify, confirm, assess complexity) → Spawn Agents (parallel Task calls with concept briefs) → Present Results (show agent outputs) → Cross-Exam (optional targeted exchange) → Synthesis (Moderator integration) → Persist (forge-lib). Each phase has substeps. |
| 4. Human-in-Loop Gates | Strong | Critical pause points: (1) Step 2, Intake—wait for user confirmation before spawning agents; (2) Phase 4, Cross-Exam—only if tension merits engagement; (3) Phase 5, Synthesis—Moderator re-engages with explicit reasoning rules (don't average, honor strongest critique, preserve surprise). Clear governance. |
| 5. Output Specifications | Strong | Synthesis section specifies exact structure: Refined Understanding (2-3 paras) → Strengths Validated (bullets) → Weaknesses to Address (bullets with recommendations) → Unexplored Territory (bullets) → Unresolved Tensions (narrative) → Forge Verdict (one para). Templates provided. |
| 6. Reference File Utilization | Strong | Debate.md explicitly references agent role files (forge-challenger, -explorer, -synthesizer, -decomposer, -evaluator) and techniques.md. Concept brief template is passed to all agents. No self-redundancy. |
| 7. Connector/Tool Integration | Strong | Task tool is explicitly invoked for agent spawning. forge-lib CLI is specified for session persistence with parameter templates. Error handling included (parse response JSON, handle failure gracefully). |
| 8. Progressive Disclosure | Adequate | 333 lines is on the edge of the 500-line bar. Longest single component. Could have pushed Phase 6 (Persist Session) to separate reference or template file; persistence details (forge-lib parameters, error handling) consume ~70 lines and are operational rather than conceptual. Debate logic itself is under 260 lines. |
| 9. Cross-Plugin Handoff | Strong | Explicit handoff to forge-lib for session persistence. Session structure includes references to Memory taxonomy (category field), concept classification (type field). Implies flow from Debate → report authoring (someone will read the persisted synthesis). |
| 10. Writing Quality | Strong | "Why" is embedded in role descriptions and phase intros ("Intake" section explains "Before spawning any agents, establish understanding"). Imperative form throughout ("Spawn these three agents simultaneously," "Wait for user confirmation"). Avoids MUSTs; uses "should," "ensure," "present as" where appropriate. |

**Behavioral Claims**: (A) "deep concept evaluation through multi-agent debate" — agent orchestration with adversarial + creative + synthesis perspectives; (B) "spawns specialized agents...simultaneously" — parallel Task invocation; (C) "synthesize their perspectives" — Moderator integration logic with conflict resolution. **Triage**: Full evaluation needed. Orchestration logic is non-trivial; parallel execution semantics need validation. Synthesis rules (don't average, honor strongest) are claims about integration strategy.

---

### explore.md (Guide Protocol Command)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Interactive concept exploration through iterative dialogue") emphasizes user co-exploration and conversational depth, differentiating from debate. Trigger is clear: user wants iterative refinement, not parallel analysis. |
| 2. Core Objective | Strong | End-state: user co-explorer moves through structured discovery, Moderator embodies Challenger/Explorer/Synthesizer perspectives conversationally, recruits Decomposer/Evaluator only if complexity warrants. Clear contrast with debate mode. |
| 3. Procedural Logic | Strong | 7 phases explicitly named: Intake (weave understanding naturally, then confirm with Exploration Map) → Decomposition (apply technique conversationally, optionally recruit Decomposer) → Multi-Angle Exam (apply 2-3 concept-type-specific techniques, pause after each, optionally recruit Evaluator) → Adversarial Testing (pre-mortem, inversion, stress scenarios) → Creative Expansion (adjacent, constraint removal, hybrids—optional) → Synthesis (collaborative summary, flexible format) → Persist (forge-lib). |
| 4. Human-in-Loop Gates | Strong | Explicit pause points: (1) After Exploration Map, wait for confirmation; (2) After each technique application in Phase 3, pause for user response ("Do not chain techniques without pausing"); (3) Phase 4 framed collaboratively ("you and the user are stress-testing together"); (4) Phase 5 is optional ("skip if concept needs confirmation rather than expansion"). Clear governance of dialogue flow. |
| 5. Output Specifications | Adequate | Phase 6 (Synthesis) is deliberately flexible: "Output format follows from concept type and dialogue trajectory" with examples (Business = recommendations + next steps; Philosophical = narrative exploration; etc.). This is intentional (dialogue-driven, not template-driven), but creates variability in output structure. No template. User will see heterogeneous synthesis formats depending on concept type. Trade-off is explicitly acknowledged ("Do not force a format"). |
| 6. Reference File Utilization | Strong | Explicitly references techniques.md for technique selection guidance (by concept type in Phase 3). Agent recruitment sections (Decomposer in Phase 2, Evaluator in Phase 3) specify which file to read in spawn prompt. No self-redundancy. |
| 7. Connector/Tool Integration | Strong | Task tool invoked for optional Decomposer and Evaluator recruitment. Spawn prompts include dialogue context (not just concept brief), which is necessary for agent grounding in exploratory conversation. forge-lib CLI specified in Phase 7 with parameter templates and error handling. |
| 8. Progressive Disclosure | Strong | 304 lines is disciplined. Phase 7 (Persist) mirrors debate.md's persistence logic (could be shared), but current duplication is acceptable (readability > DRY for command-level guidance). Anti-Patterns section (295-305) is valuable guidance that prevents common failures. |
| 9. Cross-Plugin Handoff | Strong | Phase 7 explicitly persists to forge-lib with session_type "exploration" (vs. "debate"). Session structure includes relationship (creator/evaluator/inheritor), techniques_applied array, and flags indicating Decomposer/Evaluator if recruited. Enables downstream use (Report Forge could summarize explorations, Memory could extract glossary items discovered). |
| 10. Writing Quality | Strong | "Why" is embedded throughout. Phase 1 says "Weave naturally, do not interrogate" and explains why (establishing genuine understanding). Anti-Patterns section is written as explanatory warnings, not prescriptive rules. "Dialogue Principles" section is values-driven (Genuine Inquiry, Intellectual Honesty, Collaborative Discovery) rather than technique-driven. Avoids MUSTs; uses "should," "consider," "invite" for dialogue guidance. |

**Behavioral Claims**: (A) "interactive concept exploration through iterative dialogue" — user co-explorer, Guide embodies perspectives; (B) "recruiting specialist agents only when complexity demands it" — Decomposer trigger = 4+ components, Evaluator trigger = checkable factual claims; (C) "progressive depth" (Dialogue Principles) — each exchange deepens understanding; (D) anti-pattern warnings suggest common failure modes (Monologue Mode, Premature Recruitment, etc.) that imply causal understanding of dialogue failure. **Triage**: Full evaluation needed. Recruitment decision-making is rule-based (4+ components, checkable claims), but edge cases require judgment. Anti-patterns suggest sophisticated dialogue model that needs behavioral validation.

---

### forge-challenger.md (Agent Role)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Adversarial analyst...builds strongest possible case against...identifies weaknesses") is crisp and action-oriented. Role is always spawned in debate mode; occasionally referenced conversationally in explore. Trigger is clear. |
| 2. Core Objective | Strong | End-state: produce structured adversarial analysis (Steel Opposition + Failure Boundaries + Pre-Mortem + Inversion Insight + Critical Verdict). Objective is unambiguous. |
| 3. Procedural Logic | Strong | Output structure specifies exact sections (lines 37-54). Each section has clear purpose and scope. Pre-Mortem asks agent to assume failure and work backward (specific), not generic criticism. Inversion asks what opposite reveals about hidden assumptions (specific interrogation). |
| 4. Human-in-Loop Gates | Adequate | No gates within agent execution. Agent receives concept brief, produces analysis, returns output. Pause points are in the Moderator's hands (debate.md Phase 4 gates cross-examination). Within agent, "Critical Verdict" section directs agent to name "2-3 things that MUST be addressed"—this is bounded guidance. |
| 5. Output Specifications | Strong | Output structure is specified with exact section headings and expected content. Rules section (lines 56-63) prohibits softening, requires grounding in specific reasoning, distinguishes fatal flaws from manageable weaknesses. Prevents vague criticism. |
| 6. Reference File Utilization | Strong | References cognitive-techniques skill (line 9) for detailed technique specs. Four techniques are cited (Steel Opposition, Boundary Mapping, Pre-Mortem, Inversion). Agent is expected to internalize techniques and apply to concept. |
| 7. Connector/Tool Integration | Adequate | Tools: Read, Grep, Glob (lines 5-7). Minimal tool use suggested. Tools would be employed if agent needs to reference external materials (e.g., read a concept spec if it's long). Typical debate use likely depends on concept brief only, not file reads. |
| 8. Progressive Disclosure | Strong | 62 lines is very tight. Identity section (16-20) establishes tone. Primary Techniques (22-29) name the four techniques and brief purpose. Output Structure (31-54) is the heavy section. Rules (56-63) ensure execution quality. No bloat. |
| 9. Cross-Plugin Handoff | Weak | No explicit handoff references. Challenger's output is consumed by Moderator in debate mode (synthesized into final report). In explore mode, Challenger perspective is conversationally embodied (agent not spawned). No downstream connections to Memory, Product Forge, or other plugins specified. |
| 10. Writing Quality | Strong | Identity section explains tone and philosophy ("You respect the concept enough to attack it seriously"). "Why" is embedded in technique choices. Rules are directive without being rigid ("Never soften...Intellectual honesty is highest form of respect"). Avoids MUSTs; uses imperative ("Do not repeat the brief back"). |

**Behavioral Claims**: (A) "adversarial analysis — you exist to make ideas stronger" — philosophical claim about adversarial testing function; (B) "Steel Opposition must be strong enough that reasonable person could adopt it" — evaluates quality of opposition logic; (C) "Pre-Mortem" and "Inversion" — specific technique applications. **Triage**: Moderate evaluation. Behavioral claims are about technique application (techniques are specified in references). Risk is in agent judgment (does Challenger actually build steel opposition or construct straw man?). This is a quality-of-reasoning test, not a logic test.

---

### forge-decomposer.md (Agent Role)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Structural analysis agent...breaks complex wholes into navigable maps") is precise. Agent is recruited conditionally (triggered by Moderator or Guide complexity assessment: 4+ components, nested dependencies, structural complexity). |
| 2. Core Objective | Strong | End-state: produce structural decomposition (Component Map + Dependency Graph + Assumption Stack + Boundary Definition + Structural Verdict). Objective is sharp. |
| 3. Procedural Logic | Strong | Output structure specifies sections (41-63). Dependency Graph section includes notation examples (A → B, A ↔ B, A ⊃ B) and explicit warning about single points of failure and circular dependencies. Assumption Stack is prioritized by criticality ("most foundational" to "nice to have"). Boundary Definition is clear (what's inside, outside, crosses boundary). |
| 4. Human-in-Loop Gates | Adequate | No gates within agent. Recruitment decision is gated by Moderator/Guide (debate.md Phase 1 Step 3, explore.md Phase 2 Agent Trigger). Once recruited, agent executes and returns. No within-agent pause points. |
| 5. Output Specifications | Strong | Output structure is specified with section names and expected content format. Rules (66-72) emphasize clarity over completeness, explicit naming of dependencies (not just "related"), and distinction between structural vs. accidental complexity. Prevents armchair decomposition. |
| 6. Reference File Utilization | Strong | References cognitive-techniques skill (line 9) for detailed specs. Two techniques cited: Cognitive Decomposition and Sequential Deepening. Agent applies these to break apart structural complexity. |
| 7. Connector/Tool Integration | Adequate | Tools: Read, Grep, Glob (lines 5-7). Tools would be used to inspect complex concept specifications if provided as files. Typical recruitment scenario likely provides concept brief only; structural analysis is conceptual, not file-inspection heavy. |
| 8. Progressive Disclosure | Strong | 71 lines is tight. Identity (16-20) explains structural thinking philosophy. When Recruited (22-27) clarifies optional status and trigger conditions. Primary Techniques (29-34) names two techniques. Output Structure (36-63) is largest section. Rules (66-72) ensure clarity discipline. No excess. |
| 9. Cross-Plugin Handoff | Weak | No explicit handoff. Decomposer's output is consumed by Moderator (debate.md) or integrated conversationally by Guide (explore.md Phase 2). No downstream references to Product Forge (component mapping could inform epic breakdown), Memory (components could establish taxonomy), or other plugins. |
| 10. Writing Quality | Strong | Identity section is clear ("You make the implicit explicit and the tangled clear"). "Why" is embedded in section purposes and rules. Rules use active guidance ("Prioritize clarity," "Name dependencies explicitly") without rigid MUSTs. Avoids jargon in output structure (uses "Component Map," not "Ontology" or "Graph"). |

**Behavioral Claims**: (A) "breaks complex concepts into clear, navigable maps" — decomposition quality claim; (B) "circular dependencies or single points of failure" — agent identifies structural fragility; (C) "structural vs. accidental complexity" — agent distinguishes real complexity from confusion. **Triage**: Moderate evaluation. Quality depends on agent judgment (is decomposition actually navigable?). Technique specifications are clear, but execution quality is hard to assess without seeing agent outputs in practice.

---

### forge-evaluator.md (Agent Role)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Evidence grounding agent...anchors analysis in verifiable reality") is precise. Agent is recruited conditionally by Moderator (debate.md Phase 1 Step 3) or Guide (explore.md Phase 3 Agent Trigger) when factual claims or checkable assumptions surface. |
| 2. Core Objective | Strong | End-state: produce evidence-grounded assessment (Claim Inventory + Evidence Assessment + Reality Gaps + Comparable Evidence + Evidence Verdict). Objective is crisp. |
| 3. Procedural Logic | Strong | Output structure specifies sections (42-65). Claim Inventory asks agent to classify claims (Verified / Plausible / Speculative / Contested). Evidence Assessment requires disclosure of supporting + contradicting evidence + confidence level + impact of falsity. Reality Gaps asks "what would the user need to learn or test" (actionable). Comparable Evidence asks for precedents. Evidence Verdict asks percentage estimate of solid ground vs. conjecture. |
| 4. Human-in-Loop Gates | Adequate | Recruitment is gated (Moderator or Guide decides if claims warrant evaluation). Within agent, no pause points. Agent searches, assesses, produces verdict. Verdict structure ("What percentage...") invites human interpretation but agent doesn't pause for confirmation. |
| 5. Output Specifications | Strong | Output structure is specific. Claim Inventory has classification system (4 classes). Evidence Assessment requires three elements per claim (support, contradiction, confidence). Reality Gaps asks "what would the user need to test" (actionable next steps). Evidence Verdict asks for percentage estimate + single key verification (bounded query). |
| 6. Reference File Utilization | Strong | References cognitive-techniques skill (line 11). Two techniques cited: Evidence Anchoring and Excellence Calibration. Agent applies Evidence Anchoring to each claim; Excellence Calibration to ground quality judgments in exemplars. |
| 7. Connector/Tool Integration | Strong | Tools: Read, Grep, Glob, WebSearch, WebFetch (lines 5-9). Web tools are explicitly available for evidence gathering. Rules (68-75) specify how to use WebSearch/WebFetch: search for evidence relevant to concept's claims (not generic searches), disclose when evidence cannot be found, distinguish "no evidence exists" from "I could not find evidence." Prevents fishing expeditions. |
| 8. Progressive Disclosure | Strong | 74 lines is tight. Identity (16-22) establishes empiricist mindset. When Recruited (24-29) clarifies optional status and triggers (factual claims, checkable assumptions). Primary Techniques (31-36) names two techniques. Output Structure (38-65) is largest section. Rules (68-75) ensure search discipline and epistemic honesty. No excess. |
| 9. Cross-Plugin Handoff | Weak | No explicit downstream handoff. Evaluator's evidence assessment is consumed by Moderator (synthesized into Forge Verdict) or integrated by Guide. Findings could feed Memory (if discovery reveals new domain knowledge) or Product Forge (if claims about product viability are verified/disputed), but no explicit mention. |
| 10. Writing Quality | Strong | Identity establishes tone ("empiricist who respects evidence over elegance"). "Why" is embedded in section purposes and recruitment triggers. Rules are directive and measured ("Do not dismiss ideas for lack of evidence," "Always disclose when you cannot find evidence"). Avoids rigid language; uses "should," "present neutrally," "do not cherry-pick." |

**Behavioral Claims**: (A) "anchors analysis in verifiable reality" — web search + evidence assessment; (B) "distinguish knowledge from assumption" — classification system (Verified vs. Plausible vs. Speculative); (C) "present evidence without editorializing" — neutrality claim; (D) Rules prohibit cherry-picking (evidence presentation quality claim). **Triage**: Full evaluation needed. Web search behavior is observable (which queries, which sources), evidence assessment is judgmental (is evidence correctly classified?), neutrality is subjective. Agent has tool access (WebSearch/WebFetch) and claims about evidentiary rigor; behavior needs validation.

---

### forge-explorer.md (Agent Role)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Creative expansion agent...pushes concepts into unexplored territory...discovers adjacent possibilities") is energetic and clear. Agent is spawned by debate (always); embodied conversationally by Guide in explore mode. Trigger is clear. |
| 2. Core Objective | Strong | End-state: produce structured creative expansion (Adjacent Possibilities + Constraint Reframe + Amplified Vision + Hybrid Opportunities + Expansion Verdict). Objective is vivid and unambiguous. |
| 3. Procedural Logic | Strong | Output structure specifies sections (35-53). Adjacent Possibilities asks for 3-4 concepts one step away. Constraint Reframe analyzes 2-3 significant constraints (fixed vs. negotiable, real vs. assumed). Amplified Vision asks "what does maximalist version look like" (be specific and vivid). Hybrid Opportunities proposes 2-3 unexpected combinations. Expansion Verdict asks for single most promising direction. Each section is generative but bounded. |
| 4. Human-in-Loop Gates | Adequate | No gates within agent. Recruitment is unbounded (Explorer spawned for all debates; embodied for all explorations). No within-execution pause points. In explore mode, Guide pauses conversationally after techniques, but not specifically after Explorer-type thinking. |
| 5. Output Specifications | Strong | Output structure is specified with section headings and scope. Adjacent Possibilities must be grounded ("3-4 adjacent concepts"). Constraint Reframe must analyze each constraint (not just list). Amplified Vision must be "specific and vivid" (not vague aspiration). Hybrid Opportunities must explain what each hybrid "unlocks" (actionable connection). Expansion Verdict must be specific about direction. |
| 6. Reference File Utilization | Strong | References cognitive-techniques skill (line 9) for technique specs. Three techniques cited: Possibility Expansion, Constraint Shaping, Perspective Synthesis. Agent applies these to push beyond current form. |
| 7. Connector/Tool Integration | Adequate | Tools: Read, Grep, Glob (lines 5-7). Tool use is minimal. Expansion is generative (thinking beyond current), not research-heavy. Tools would be used only if exploring adjacent domains requires reading reference material (uncommon). |
| 8. Progressive Disclosure | Strong | 61 lines is very tight. Identity (16-20) establishes generative stance. Primary Techniques (22-28) names three techniques. Output Structure (30-53) is largest section. Rules (55-62) enforce grounding ("Every possibility...must be grounded in something real"). Clear governance against unfounded speculation. |
| 9. Cross-Plugin Handoff | Weak | No explicit downstream handoff. Explorer's output (adjacent possibilities, hybrids, expansion direction) is consumed by Moderator (synthesized into Forge Verdict) or integrated conversationally by Guide. Findings could inform Product Forge (new feature ideas, epic directions) or Memory (emerging patterns), but no explicit mention. |
| 10. Writing Quality | Strong | Identity explains philosophy ("refuses to let assumed limitations close doors prematurely"). "Why" is embedded in technique choices and rules. Rules are grounding directives ("Every possibility you propose must be grounded," "Distinguish between near-term and long-term," "If concept is already at natural limits, say so"). Tone is energetic without being naive. |

**Behavioral Claims**: (A) "creative expansion...discovers adjacent possibilities" — generative cognition claim; (B) "constraint shaping — use limitations as creative tools" — philosophical claim about constraint value; (C) "Adjacent Possibilities...one step from current idea" — proximity claim; (D) Rules say "Every possibility...grounded in something real" — realism constraint. **Triage**: Moderate evaluation. Behavior is about quality of generative thinking (are possibilities plausible? grounded? novel?). Subjective assessment required. Low risk of failure (generation is hard to get wrong as long as possibilities exist), but success quality is variable.

---

### forge-synthesizer.md (Agent Role)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| 1. Trigger & Description | Strong | Description ("Integration agent...weaves multiple analytical threads...resolves tensions...refines concepts") is precise. Agent is spawned by debate (always); embodied conversationally by Guide in explore mode. Trigger is clear. |
| 2. Core Objective | Strong | End-state: produce structured synthesis (Core Thread + Quality Calibration + Tension Map + Refinement Proposal + Integration Verdict). Objective is sharp. |
| 3. Procedural Logic | Strong | Output structure specifies sections (36-54). Core Thread asks for essential insight (strip away implementation, one paragraph). Quality Calibration asks agent to identify exemplars in category and extract excellence markers. Tension Map asks for 2-3 specific tensions and assessment (productive vs. destructive). Refinement Proposal asks for specific improvements (targeted, not rewrite). Integration Verdict asks for maturity level assessment + highest-leverage improvement. Each section is bounded and actionable. |
| 4. Human-in-Loop Gates | Adequate | No gates within agent. Synthesis is final phase in both debate (Moderator does synthesis) and explore (Guide does synthesis). Synthesizer agent is spawned in debate but doesn't gate execution. In explore, Synthesizer perspective is conversationally embodied without pauses. |
| 5. Output Specifications | Strong | Output structure is specific. Core Thread must be one paragraph (bounded). Quality Calibration must use real exemplars (not abstract ideals). Tension Map must name specific tensions + assess productivity (binary judgment per tension). Refinement Proposal must be "specific enough to act on" (actionable constraint). Integration Verdict must name maturity level + single highest-leverage improvement (bounded scope). |
| 6. Reference File Utilization | Strong | References cognitive-techniques skill (line 9). Four techniques cited: Iterative Refinement, Perspective Synthesis, Sequential Deepening, Excellence Calibration. Agent applies these to find integration points and refinement directions. |
| 7. Connector/Tool Integration | Adequate | Tools: Read, Grep, Glob (lines 5-7). Tool use minimal. Synthesis is conceptual (integrating existing analysis), not research-heavy. Tools would be used if exemplar research is needed (potential use for Excellence Calibration). |
| 8. Progressive Disclosure | Strong | 62 lines is tight. Identity (16-20) establishes systems thinking philosophy. Primary Techniques (22-29) names four techniques. Output Structure (31-54) is largest section. Rules (56-63) prevent false compromise and enforce groundedness. Clear discipline. |
| 9. Cross-Plugin Handoff | Weak | No explicit downstream handoff. Synthesizer's output is consumed by Moderator (final synthesis in debate is Moderator's responsibility, drawing on Synthesizer input). In explore, Synthesizer perspective is conversationally embodied. No explicit references to Product Forge (refined concepts could become cards), Memory (patterns could become taxonomy), or other plugins. |
| 10. Writing Quality | Strong | Identity establishes philosophy ("Where others see contradictions, you find productive tensions"). "Why" is embedded throughout. Rules are directive about integration quality ("Never flatten tensions into false compromises," "Ground your quality calibration in real exemplars," "Your refinement proposals must be specific enough to act on"). Avoids MUSTs; uses imperative with justification. |

**Behavioral Claims**: (A) "weaves multiple analytical threads into coherent understanding" — integration quality claim; (B) "resolves tensions between perspectives" — conflict resolution claim; (C) Tension Map distinguishes productive vs. destructive tension (categorical judgment); (D) Refinement Proposal must be actionable (specificity claim). **Triage**: Moderate evaluation. Integration quality is subjective (does agent find genuine integration or just compromise?). Tension classification is dichotomous (productive vs. destructive) but edge cases may exist. Refinement specificity is observable (can user act on proposal?).

---

## Strengths (Top 5)

1. **Cognitive Foundation Clarity**: The cognitive-techniques skill + techniques.md reference create a shared analytical language across all agents and both command modes. Concept classification (Business/Philosophical/Framework/Creative) is used consistently to drive technique selection. This vertical integration prevents agents from operating in silos and enables the Moderator/Guide to speak coherently about what analysis has occurred.

2. **Bidirectional Command Architecture**: debate.md and explore.md offer genuinely different interaction models (parallel agent-orchestrated analysis vs. conversational co-exploration) without redundancy or false choice. Both spawn agents conditionally based on complexity assessment (4+ components = Decomposer, checkable claims = Evaluator). The same recruitment logic gates both modes, ensuring consistency in when escalation occurs.

3. **Human-in-Loop Governance**: Both commands explicitly specify pause points where user confirmation is required (Intake confirmation in debate Phase 1, Exploration Map confirmation in explore Phase 1; Phase 3 pauses after each technique in explore). Gates are not retrofitted—they're part of the phase design. This prevents runaway analysis and maintains user agency.

4. **Reference-First Architecture**: Heavy-duty content (technique specifications, agent role specs) is in separate reference files, not embedded in commands. This enables agents to read techniques.md independently, commands to cite techniques.md consistently, and future plugins to potentially share the same foundation. 303-line techniques.md is the cognitive load carrier; 333-line debate.md is orchestration logic; 304-line explore.md is dialogue governance. Clear separation of concerns.

5. **Anti-Pattern Guidance & Dialogue Principles**: explore.md includes explicit "Anti-Patterns" and "Dialogue Principles" sections that encode wisdom about failure modes and values. This goes beyond specification into philosophy (Genuine Inquiry, Intellectual Honesty, Progressive Depth). These sections help future implementers understand not just "what" to do but "why" the guidance matters. Prevents performative application of techniques.

---

## Critical Gaps (Top 5)

1. **Trigger & Description Optimization Needed (debate, explore)**: Both commands have competent but passive descriptions. debate.md says "Deep concept evaluation through multi-agent debate" (technical, functional). A pushier description might be "When a concept needs rigorous adversarial testing and multi-angle synthesis before commitment" (user-intent-focused). Similarly, explore.md says "Interactive concept exploration through iterative dialogue" (good, but could emphasize "When you're building a concept and need collaborative refinement" or "When you're uncertain and want structured discovery"). Current descriptions work for users who already know what they want; they don't pull users who have unformed concepts. **Severity**: Moderate (existing descriptions are functional; improvement is optimization, not fix).

2. **Moderator vs. Guide Role Clarity Ambiguity**: debate.md says the Moderator "does not analyze the concept yourself" (line 8) and "you personally conduct the exploration" in explore.md (line 8, Guide). But the Moderator in debate DOES conduct synthesis (Phase 5: "This is YOUR output as Moderator"), and the Guide in explore embodies Challenger/Explorer/Synthesizer perspectives (lines 274: "Guide embodies those perspectives"). The boundary between "orchestrating other agents" and "being an agent yourself" is blurry. This creates ambiguity about what kind of computational resources are needed (does Moderator need to do its own reasoning in synthesis, or just aggregate agent outputs?). **Severity**: High (ambiguity affects implementation understanding and resource planning).

3. **No Formal Cross-Plugin Handoff Specification**: All agent roles and both commands have "weak" ratings for Cross-Plugin Handoff. The plugin persists sessions via forge-lib (debate.md/explore.md Phase 6/7), but nowhere does the system document what downstream plugins should expect. Example: If Debate produces a Forge Synthesis, what should Report Forge do with it? If Explore produces a Refined Understanding, should Product Forge auto-create a product card? Current system assumes human review between stages. This limits automation potential and leaves integration points ambiguous. **Severity**: High (blocks ecosystem integration and automation opportunities).

4. **Decomposer & Evaluator Recruitment Triggers Are Heuristic, Not Deterministic**: debate.md Phase 1 Step 3 says "Recruit Decomposer if the concept has 4+ interacting components, nested dependencies...or layered structural complexity." The phrase "or layered structural complexity" is vague. "4+ components" is objective; "nested dependencies" is semi-objective; "layered structural complexity" is subjective judgment. Similarly, Evaluator recruitment is triggered by "makes specific factual claims" or "relies on checkable assumptions"—both require agent judgment about what counts as "factual" or "checkable." No heuristic guidance for edge cases (e.g., "If you're unsure, err toward recruitment" vs. "If you're unsure, continue without agent"). This creates variability in when agents are spawned. **Severity**: Moderate (affects consistency; heuristics are reasonable but not fully deterministic).

5. **Exploration Synthesis Format is Intentionally Flexible, But Lacks Output Validation**: explore.md Phase 6 says "Do not force a format. Let the conversation determine the appropriate synthesis shape" and provides concept-type-specific examples (Business = recommendations, Philosophical = narrative exploration, etc.). This is intentionally flexible, but creates a risk: different exploration sessions will have heterogeneous synthesis structures. No validation mechanism ensures synthesis actually addresses "What has been learned? How has concept evolved? What tensions remain? Refined understanding? Next steps?" (lines 177-182). The Moderator in debate has a strict Synthesis Structure (lines 213-234); the Guide in explore has example formats but no enforcement. **Severity**: Moderate (flexibility is intentional, but lack of validation structure creates quality variability).

---

## Triage Recommendation

### Full Evaluation Candidates (Behavioral Claims Requiring Validation)

These components make specific claims about reasoning, decision-making, or output quality that need behavioral testing:

1. **debate.md** (Moderator Protocol)
   - Claim: "Spawns specialized agents...simultaneously" and "orchestrates a multi-agent debate"
   - Claim: "Synthesis is YOUR output as Moderator" with specific rules (don't average, honor strongest critique, preserve surprise)
   - Claim: Cross-examination logic (Phase 4) triggers only when tension is "substantive"
   - **Eval Focus**: Test if Task tool calls are truly parallel; validate that synthesis actually integrates rather than summarizes; test cross-exam trigger logic edge cases
   - **Expected Effort**: High (complex orchestration logic, validation requires test scenarios)

2. **explore.md** (Guide Protocol)
   - Claim: "Progressive Depth" — each exchange deepens understanding
   - Claim: Recruitment rules trigger on "4+ components" (Decomposer) and "checkable factual claims" (Evaluator)
   - Claim: "Do not chain techniques without pausing"—dialogue must pause after each technique application
   - Claim: Anti-Pattern warnings (Monologue Mode, Premature Recruitment, etc.) describe actual failure modes
   - **Eval Focus**: Test if dialogue actually deepens understanding across exchange sequences; validate pause point enforcement; test recruitment edge cases; validate anti-pattern predictions against exploratory dialogues
   - **Expected Effort**: High (dialogue quality is subjective; requires conversation-level testing)

3. **forge-evaluator.md** (Agent Role)
   - Claim: "Evidence grounding" with WebSearch/WebFetch; "distinguish knowledge from assumption"
   - Claim: Evidence classification (Verified/Plausible/Speculative/Contested) is accurate and useful
   - Claim: "Prevent cherry-picking" and "present evidence neutrally"
   - **Eval Focus**: Test evidence searches (are they relevant to claims?); validate classification accuracy; audit for selection bias in evidence presentation
   - **Expected Effort**: High (requires web search validation and content analysis)

### Description Optimization Candidates (Trigger Enhancement Without Behavior Change)

These components are functionally sound but could be optimized to trigger on user intent more effectively:

1. **debate.md** — Enhance description to emphasize "when you need rigorous testing from multiple angles before commitment" rather than just technical capability
2. **explore.md** — Enhance description to emphasize "when building a concept and want collaborative refinement" or "when uncertain and need structured discovery" (current description is good but could be more inviting)

### Direct Improvement Candidates (Non-Behavioral, Implementable Fixes)

1. **Clarify Moderator vs. Guide Role Boundary** (debate.md line 8 vs. explore.md line 8, and debate.md Phase 5 vs. explore.md Phase 6)
   - Current state: "Moderator does not analyze" but "Moderator produces synthesis"; "Guide conducts exploration" but "Guide embodies perspectives"
   - Improvement: Explicitly state whether Moderator/Guide does its own reasoning or aggregates agent reasoning only. Add computational model clarity.
   - **Effort**: Low (editorial clarification, ~10 lines added)

2. **Formalize Cross-Plugin Handoff Expectations** (affects all components)
   - Current state: forge-lib persistence is specified, but downstream expectations are implicit
   - Improvement: Create brief "Integration Points" section documenting what other plugins should expect from persisted sessions (category field for Memory, synthesis for Report Forge, etc.)
   - **Effort**: Low (editorial, ~15 lines added to a new reference section)

3. **Add Deterministic Recruitment Heuristics** (debate.md Phase 1, explore.md Phases 2 & 3)
   - Current state: Recruitment triggers include subjective judgment ("layered structural complexity," "checkable assumptions")
   - Improvement: Add edge-case guidance ("If uncertain, recruit Decomposer" or "If uncertain, continue conversationally first")
   - **Effort**: Low (editorial, ~5 lines per trigger)

4. **Validation Template for Explore Synthesis** (explore.md Phase 6)
   - Current state: "Do not force a format" with flexible examples
   - Improvement: Add optional checklist for Guide (Does synthesis address: What was learned? How did concept evolve? Tensions? Refined understanding? Next steps?) without enforcing template structure
   - **Effort**: Low (editorial, ~10 lines, non-prescriptive)

5. **Cross-Reference forge-lib Session Metadata** (debate.md & explore.md Phase 6/7)
   - Current state: forge-lib is called with specific --data JSON fields (category, session_log, synthesis, etc.)
   - Improvement: Create separate reference document defining session metadata schema (what fields are expected, what data types, downstream plugin expectations) and cite it from both commands
   - **Effort**: Medium (requires new reference document, ~30 lines)

---

## Summary Assessment

**Overall Maturity**: The Cognitive Forge plugin is architecturally sophisticated and well-structured. Cognitive techniques are clearly specified, command protocols are detailed and phase-driven, and both debate and explore modes offer genuinely different interaction models. The plugin successfully avoids redundancy by pushing shared content (techniques) to reference files and allowing each command to compose from references.

**Readiness for Production**: The plugin is production-ready for debate mode (agent orchestration is well-specified, synthesis logic is clear, forge-lib integration is documented). The explore mode is also production-ready but carries higher behavioral variability (dialogue depth is subjective, synthesis format is intentionally flexible).

**Primary Risks**:
- Moderator/Guide role clarity could confuse implementers about computational boundaries
- Recruitment triggers are heuristic and could create implementation inconsistency
- No explicit cross-plugin integration spec limits ecosystem automation
- Explorer/Synthesizer output quality is subjective (optimization over correctness)

**Recommended Action Priority**:
1. Conduct Full Evaluation on debate.md (orchestration logic), explore.md (dialogue + recruitment), and forge-evaluator.md (web search behavior)
2. Clarify Moderator vs. Guide role boundary (low effort, high clarity impact)
3. Add deterministic heuristics to recruitment triggers (low effort, consistency improvement)
4. Formalize cross-plugin handoff expectations (enables ecosystem integration)

The plugin demonstrates strong intentional design (Anti-Patterns section, Dialogue Principles, phase-driven architecture) and respects human agency through explicit pause points. The cognitive techniques foundation is sound and reusable. Improvements are optimization- and integration-focused, not correctness-focused.
