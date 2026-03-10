# Forge Skills Audit Rubric

## Source Framework
Derived from "Strategic Framework for Claude Skills 2.0: Context Engineering & Evaluation Optimization" and the Skill Creator SKILL.md writing guide.

## Rating Scale
Each dimension is rated on a four-point scale:

- **Strong**: Fully realized, follows best practices, no meaningful gaps
- **Adequate**: Functional but with room for improvement
- **Weak**: Present but significantly deficient; likely causes quality or triggering issues
- **Missing**: Not present at all; a gap that should be addressed

## Audit Dimensions

### 1. Trigger & Description Quality
Does the skill's YAML frontmatter description clearly define when to activate? Is it "pushy" enough to avoid under-triggering? Does it cover edge cases and adjacent use cases?

Scoring criteria:
- Strong: Description covers primary triggers, edge cases, and explicitly calls out non-obvious activation scenarios. Uses the "even if they don't explicitly ask for X" pattern where appropriate.
- Adequate: Description covers the primary use case but misses edge cases or competing triggers.
- Weak: Description is vague, too short, or relies on jargon the triggering model may not associate with user prompts.
- Missing: No description or a placeholder only.

### 2. Core Objective Clarity
Is the end-state of the skill clearly and granularly defined? Can someone reading the skill immediately understand what "done" looks like?

Scoring criteria:
- Strong: Explicit statement of what the skill produces, in what format, for what purpose. No ambiguity about success.
- Adequate: Objective is implied but not crisply stated; requires reading the full skill to understand the goal.
- Weak: Objective is buried, vague, or conflated with procedural steps.
- Missing: No discernible objective statement.

### 3. Procedural Logic
Does the skill provide a clear step-by-step operational sequence? Is the ordering logical? Are dependencies between steps explicit?

Scoring criteria:
- Strong: Numbered or clearly sequenced steps with explicit dependencies. Each step is actionable and unambiguous.
- Adequate: Steps are present but some ordering is implicit, or some steps are too coarse-grained.
- Weak: Instructions are narrative-style without clear sequencing, or steps are contradictory/overlapping.
- Missing: No procedural guidance; skill is purely declarative without workflow structure.

### 4. Human-in-the-Loop Gates
Does the skill define explicit points where the agent must halt for user input, confirmation, or review?

Scoring criteria:
- Strong: Explicit gates at decision points, with clear instructions on what to present to the user and what to wait for.
- Adequate: Some gates exist but are inconsistently placed or vaguely defined.
- Weak: Mentions user interaction but doesn't define when or how to pause.
- Missing: No human-in-the-loop consideration; fully autonomous with no review points.

### 5. Output Specifications
Does the skill define what the output should look like? File types, structural markers, formatting requirements, templates?

Scoring criteria:
- Strong: Explicit output format, structure template, required sections, and file type specifications.
- Adequate: Output format is mentioned but lacks structural detail or templates.
- Weak: Output is implied from context but never formally specified.
- Missing: No output specification at all.

### 6. Reference File Utilization
Does the skill leverage external reference files (in references/ or elsewhere) to provide context? Are those references clearly pointed to with guidance on when to read them?

Scoring criteria:
- Strong: References are organized, clearly linked from SKILL.md, with guidance on when each is needed. Progressive disclosure is used well.
- Adequate: References exist but pointers from SKILL.md are vague or incomplete.
- Weak: References exist but are orphaned (no clear path from the skill to the reference).
- Missing: No reference files where they would clearly add value.

### 7. Connector / Tool Integration
Does the skill specify which MCP tools, sub-agents, or external integrations it depends on? Are tool dependencies explicit?

Scoring criteria:
- Strong: Explicit tool/MCP requirements listed with fallback behavior if tools are unavailable.
- Adequate: Tools are referenced in procedural steps but not listed as formal dependencies.
- Weak: Tool usage is implicit; you have to read the entire skill to discover what it needs.
- Missing: No tool references where tools are clearly required.

### 8. Progressive Disclosure & Size Management
Does the skill follow the three-level loading system (metadata → SKILL.md body → bundled resources)? Is the SKILL.md under 500 lines with heavier content pushed to references?

Scoring criteria:
- Strong: SKILL.md is lean (<500 lines), heavy content lives in references, clear pointers guide the model to load what it needs when it needs it.
- Adequate: Skill is reasonably sized but could benefit from extracting some content to references.
- Weak: Skill is bloated (approaching or exceeding 500 lines) with content that should be in references.
- Missing: N/A (this dimension doesn't have a "missing" state; rate as Weak if oversized with no reference structure).

### 9. Cross-Plugin Handoff Awareness
Does the skill reference or suggest connections to other Forge plugins where appropriate? Does it know about upstream inputs and downstream consumers?

Scoring criteria:
- Strong: Explicit references to related plugins with guidance on when to hand off (e.g., "after creating a card, suggest storing taxonomy in Forge Memory").
- Adequate: Some awareness of adjacent plugins but handoffs are not explicitly guided.
- Weak: Operates in isolation despite clear opportunities for cross-plugin flow.
- Missing: No awareness of the broader Forge ecosystem.

### 10. Writing Quality & Tone
Does the skill follow the "explain the why" principle? Does it avoid heavy-handed MUSTs and rigid structures in favor of reasoning-based instructions? Is it written in imperative form?

Scoring criteria:
- Strong: Instructions explain reasoning behind requirements. Imperative form. Natural tone that treats the executing model as intelligent. No unnecessary rigidity.
- Adequate: Mostly well-written but some sections are rigid or lack reasoning context.
- Weak: Heavy use of ALL CAPS, MUST/NEVER without explanation, or overly mechanical tone.
- Missing: N/A (rate as Weak for poor writing quality).

---

## Audit Card Template

For each plugin, the audit produces a card with:

1. **Plugin Overview**: What it does, its role in the Forge ecosystem
2. **Component Inventory**: Skills, commands, agents, references (with line counts)
3. **Per-Component Scores**: Each SKILL.md, command.md, and agent.md rated on applicable dimensions
4. **Strengths**: What the plugin does well structurally
5. **Critical Gaps**: Dimensions scoring Weak or Missing that most impact quality
6. **Triage Recommendation**: Whether any components warrant full eval runs, and why
