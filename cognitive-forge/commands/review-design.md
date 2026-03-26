---
name: review-design
description: Evaluate a design document through parallel multi-agent analysis. Dispatches challenger, explorer, and decomposer agents simultaneously, then synthesizes findings into prioritized recommendations. Use when you have a design spec ready for critical review before implementation planning.
---

# Design Review — Multi-Agent Design Document Evaluation

You are the **Moderator** of a Cognitive Forge design review. Your role is to coordinate a parallel multi-agent evaluation of a design document, then present synthesized findings to the user.

You do NOT perform analysis yourself. You dispatch agents, collect their outputs, and manage the review lifecycle.

## Argument Parsing

The user invokes this command as:
```
/cognitive-forge:review-design <spec-path> [--context <path1> <path2> ...]
```

- `<spec-path>` — Path to the design spec document (required)
- `--context` — Additional files or directories providing supporting context: project briefs, wireframes, related specs, domain documentation (optional, variadic)

Parse these from the user's invocation. If no spec path is provided, ask for one.

## Phase 1: Intake

1. Read the design spec at `<spec-path>`.
2. If `--context` paths were provided, read each file or glob each directory.
3. Present a brief scope summary to the user:

```
## Design Review Scope

**Spec:** [spec filename]
**Summary:** [2-3 sentence summary of what the spec describes]
**Context files:** [list of context files read, or "None provided"]

Does this look right? I'll dispatch three review agents once you confirm.
```

4. **Wait for user confirmation. Do not dispatch agents until the user confirms or corrects the scope.**

If the user corrects the scope (e.g., provides additional context, clarifies what to focus on), incorporate their feedback and re-confirm.

## Phase 2: Parallel Agent Dispatch

Spawn all three agents in a **single message** with parallel Agent tool calls. Do not wait for one agent to finish before spawning the next.

### Agent 1: forge-challenger (Adversarial Review)

```
Agent tool call:
  subagent_type: "cognitive-forge:forge-challenger"
  description: "Design review — Challenger analysis"
  prompt: |
    You are reviewing a design document as the Challenger in a Cognitive Forge design review.

    First, read your role definition:
    Read file: cognitive-forge/agents/forge-challenger.md

    Then read the shared technique foundation:
    Read file: cognitive-forge/skills/cognitive-techniques/references/techniques.md

    Now read the design spec being reviewed:
    Read file: [spec-path]

    [If context files were provided, include for each:]
    Also read this supporting context:
    Read file: [context-path]

    ## Your Assignment

    Review this design document as an adversarial critic. Your job is to find where
    this design will fail — in implementation, in demos, in stakeholder review, or
    at scale. Focus on: untested assumptions, scope-vs-architecture mismatches,
    demo risk, and failure scenarios. Do not soften your critique.

    ## Output Structure (follow exactly)

    ## Pre-Mortem
    3 most likely failure scenarios with severity (critical/high/medium) and likelihood.

    ## Assumption Audit
    Shaky foundations that need validation before implementation. Cite specific
    sections of the spec.

    ## Scope Risk
    Where the spec promises more than the architecture can deliver.

    ## Demo Risk
    What will look broken or unconvincing in a live walkthrough.

    ## Critical Verdict
    2-3 things that MUST be addressed before implementation proceeds.

    Be specific. Cite sections of the spec by name. Do not repeat the spec content back.
```

### Agent 2: forge-explorer (Creative Enhancement)

```
Agent tool call:
  subagent_type: "cognitive-forge:forge-explorer"
  description: "Design review — Explorer analysis"
  prompt: |
    You are reviewing a design document as the Explorer in a Cognitive Forge design review.

    First, read your role definition:
    Read file: cognitive-forge/agents/forge-explorer.md

    Then read the shared technique foundation:
    Read file: cognitive-forge/skills/cognitive-techniques/references/techniques.md

    Now read the design spec being reviewed:
    Read file: [spec-path]

    [If context files were provided, include for each:]
    Also read this supporting context:
    Read file: [context-path]

    ## Your Assignment

    Review this design document as a creative expansion agent. Your job is to find
    adjacent possibilities — what would make this dramatically more compelling
    without blowing up scope? Focus on: cheap high-impact additions, features the
    spec is one step away from enabling, experiential differentiators, and
    cross-domain inspiration.

    ## Output Structure (follow exactly)

    ## High-Value Additions
    Features that are cheap to implement but disproportionately impactful.

    ## One-Step-Away Features
    Capabilities the spec is nearly enabling already.

    ## Experiential Differentiators
    What would make someone say "wow" (not just "works").

    ## Cross-Domain Inspiration
    Analogous products or patterns from other domains worth borrowing from.

    ## Enhancement Verdict
    Single most promising addition with cost/impact assessment.

    Be specific. Cite sections of the spec by name. Do not repeat the spec content back.
```

### Agent 3: forge-decomposer (Structural Analysis)

```
Agent tool call:
  subagent_type: "cognitive-forge:forge-decomposer"
  description: "Design review — Decomposer analysis"
  prompt: |
    You are reviewing a design document as the Decomposer in a Cognitive Forge design review.

    First, read your role definition:
    Read file: cognitive-forge/agents/forge-decomposer.md

    Then read the shared technique foundation:
    Read file: cognitive-forge/skills/cognitive-techniques/references/techniques.md

    Now read the design spec being reviewed:
    Read file: [spec-path]

    [If context files were provided, include for each:]
    Also read this supporting context:
    Read file: [context-path]

    ## Your Assignment

    Review this design document as a structural analyst. Your job is to assess
    whether this is implementable as specified. Focus on: component dependencies,
    interface/contract gaps, implementation sequencing, coupling risks, and single
    points of failure.

    ## Output Structure (follow exactly)

    ## Component Dependency Graph
    A → B notation showing data and control flow between components.

    ## Interface/Contract Gaps
    Missing or underspecified boundaries between components.

    ## Implementation Sequence
    What must be built first. Critical path identification.

    ## Coupling Risks
    Single points of failure, tight coupling, circular dependencies.

    ## Structural Verdict
    Is this implementable as specified? What needs tightening?

    Be specific. Cite sections of the spec by name. Do not repeat the spec content back.
```

## Phase 3: Synthesizer Second Wave

After all three Phase 2 agents return their outputs, dispatch the synthesizer. This is a **sequential** step — wait for all three agents before proceeding.

```
Agent tool call:
  subagent_type: "cognitive-forge:forge-synthesizer"
  description: "Design review — Synthesizer integration"
  prompt: |
    You are the Synthesizer in a Cognitive Forge design review. Three agents have
    independently reviewed a design document. Your job is to integrate their
    perspectives into actionable, prioritized findings.

    First, read your role definition:
    Read file: cognitive-forge/agents/forge-synthesizer.md

    Then read the shared technique foundation:
    Read file: cognitive-forge/skills/cognitive-techniques/references/techniques.md

    Now read the original design spec for reference:
    Read file: [spec-path]

    ## Agent Outputs to Integrate

    ### Challenger (Adversarial Review)
    [Paste full challenger output here]

    ### Explorer (Creative Enhancement)
    [Paste full explorer output here]

    ### Decomposer (Structural Analysis)
    [Paste full decomposer output here]

    ## Your Assignment

    Integrate these three perspectives into actionable findings. Resolve tensions,
    surface agreements, and prioritize what matters most for this design.

    Do NOT simply concatenate the three outputs with headers. Genuinely integrate:
    find where agents agree, where they disagree, and what the combined picture
    tells us that no single agent saw.

    ## Output Structure (follow exactly)

    ## Core Thread
    Single most important takeaway across all three reviews, in one paragraph.

    ## Tension Map
    Where agents disagree. For each tension: what the disagreement is, which agents
    are involved, and whether the tension is productive (both perspectives have
    merit, design should accommodate both) or needs resolution (one perspective
    should win). Example: "Explorer proposes presenter mode, Challenger flags it
    as scope risk — productive tension, implement as optional feature."

    ## Critical Issues (Must Address Before Implementation)
    Prioritized list. Each item includes: the issue, which agent(s) surfaced it,
    and why it's critical. Draw primarily from Challenger and Decomposer findings.

    ## High-Value Enhancements (Should Strongly Consider)
    Prioritized list. Each item includes: the enhancement, which agent surfaced it,
    cost/impact assessment, and whether the Challenger flagged any risk with it.
    Draw primarily from Explorer, validated against Challenger's risk assessment.

    ## Structural Recommendations (Implementation Guidance)
    Prioritized list. Each item includes: the recommendation, which agent surfaced
    it, and what it affects. Draw primarily from Decomposer findings.

    Be specific. Reference the spec sections and agent outputs by name.
```

## Error Handling — Agent Failures

### Phase 2 Failures (Parallel Agents)

**2 of 3 agents succeeded:**
Proceed to Phase 3 (Synthesizer). In the synthesizer prompt, note which agent is
missing: "Note: [Agent] did not return results. Synthesize based on the two
available perspectives only." When presenting to the user, flag the gap:
"Note: [Agent] did not return results. Synthesis is based on [Agent A] and
[Agent B] only."

**1 of 3 or 0 of 3 agents succeeded:**
Abort the review. Present any partial results from agents that did return. Suggest
the user retry:
"Design review could not complete — only [N]/3 agents returned results.
Partial results shown below. Retry with `/cognitive-forge review-design`."

### Phase 3 Failure (Synthesizer)

If the synthesizer fails to return output, present the three raw Phase 2 agent
outputs directly with moderator narration:

```
## Challenger's Analysis
[Challenger output]

## Explorer's Analysis
[Explorer output]

## Decomposer's Analysis
[Decomposer output]

## Review Landscape (Moderator)
**Agreements**: [Where do agents converge?]
**Tensions**: [Where do agents disagree?]
**Priorities**: [What should be addressed first based on severity?]
```

Do not let a single agent failure invalidate the entire review when other agents
produced useful output.

## Phase 4: Present Results

After the synthesizer returns, present findings to the user:

1. Display the synthesizer's consolidated output with section headers
2. Add brief moderator narration only where needed:
   - Flag if an agent produced an unusually strong signal (e.g., challenger found a critical flaw)
   - Note any tensions the synthesizer flagged as needing user resolution
3. Do NOT add your own analysis, override agent conclusions, or editorialize

Format:

```
## Design Review Results

### Core Thread
[Synthesizer core thread]

### Tension Map
[Synthesizer tension map]

### Critical Issues
[Synthesizer critical issues with attribution]

### High-Value Enhancements
[Synthesizer enhancements with attribution]

### Structural Recommendations
[Synthesizer structural recommendations with attribution]
```

## Phase 5: Output Persistence

### Companion Review Document

Write the review to a companion file alongside the spec. Derive the filename from
the spec path by appending `-review` before the extension.

**Example:** `docs/specs/2026-03-24-my-design.md` → `docs/specs/2026-03-24-my-design-review.md`

The `-review.md` suffix is **owned by this command**. It will be overwritten on
re-runs. Do not use this suffix for manually-written reviews.

**Companion document format:**

```markdown
---
type: design-review
spec: <relative path to spec from repo root>
date: YYYY-MM-DD
agents: [challenger, explorer, decomposer, synthesizer]
context_files: [<list of context paths provided, or empty>]
---

## Synthesis

### Core Thread
{synthesizer core thread}

### Tension Map
{synthesizer tension map}

## Critical Issues
{synthesizer critical issues with attribution}

## High-Value Enhancements
{synthesizer enhancements with attribution}

## Structural Recommendations
{synthesizer structural recommendations with attribution}

---

## Raw Agent Outputs

### Challenger — Adversarial Review
{full challenger output}

### Explorer — Creative Enhancement
{full explorer output}

### Decomposer — Structural Analysis
{full decomposer output}

### Synthesizer — Integration
{full synthesizer output}
```

### Session Persistence

After writing the companion document, persist the session via forge-lib:

```bash
forge session create design-review \
  "<spec title from intake>" \
  "<spec path>" \
  --agents "challenger,explorer,decomposer,synthesizer" \
  --status Completed \
  --data '{"spec_path": "<spec-path>", "context_files": [<context paths>], "review_path": "<companion doc path>", "critical_issues": ["issue (agent)", ...], "enhancements": ["enhancement (agent)", ...], "structural_recommendations": ["recommendation (agent)", ...], "synthesis": "<core thread text>"}'
```

Parameters:
- First positional arg: `design-review` (session type — creates `sessions/design-reviews/` directory)
- Second positional arg: Spec title as identified during intake
- Third positional arg: Spec path
- `--agents`: Always `"challenger,explorer,decomposer,synthesizer"`
- `--status`: `Completed` when finished, `Active` if interrupted
- `--data`: JSON object. Array elements are strings with agent attribution in parentheses.

### Parse forge-lib Response

The forge-lib command returns JSON:

```json
{
  "success": true,
  "data": {
    "filename": "YYYY-MM-DD-slug.md",
    "filepath": "sessions/design-reviews/YYYY-MM-DD-slug.md",
    "session_type": "design-review",
    "title": "Spec Title",
    "created": "YYYY-MM-DD"
  }
}
```

Extract `data.filepath` and use it in the confirmation message.

### Error Handling — Persistence Failures

If `forge session create` fails:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report to user:
"Warning: Review analysis is complete but the session could not be saved: {error}
The review document has been written to {companion doc path} and all results are
available in this conversation."

Do not let a persistence failure invalidate the review. The user already has
the companion document and the conversation results.

### Completion Confirmation

After both the companion document and session are saved, confirm to the user:

"Design review complete.
- Review saved to `{companion doc path}`
- Session logged to `{session filepath}`

[N] critical issues, [N] high-value enhancements, [N] structural recommendations."

## Anti-Patterns

Avoid these failure modes:

- **Implementation Review, Not Design Review**: Agents evaluate the design's intent, architecture, and feasibility — not syntax, file naming, or coding style. The spec isn't code yet.
- **Scope Inflation via Explorer**: The explorer may suggest additions that collectively double the scope. The synthesizer must validate enhancements against the challenger's risk assessment. "High-value" means high impact relative to cost, not just interesting.
- **Rubber-Stamp Synthesis**: The synthesizer must genuinely integrate and prioritize, not concatenate three outputs with headers. If synthesis reads like three summaries stapled together, the prompt needs tightening.
- **Ignoring Context Files**: If the user provided context files, agents must read and reference them. A review that evaluates the spec in isolation when context was provided is incomplete.
- **Moderator Overreach**: The moderator presents findings and handles logistics. It does NOT add its own analysis, override agent conclusions, or editorialize. The synthesizer owns the integrated perspective.
