# Cognitive Forge

Multi-agent concept evaluation through structured debate and interactive exploration.

## Overview

The Cognitive Forge transforms concept evaluation from casual brainstorming into rigorous intellectual examination. It provides two complementary modes:

- **Debate Mode**: Spawn parallel specialist agents that analyze a concept from adversarial, creative, and integrative angles simultaneously
- **Explore Mode**: Interactive dialogue guided by cognitive techniques, with conditional agent recruitment when complexity demands it

Both modes leverage a shared foundation of 10 structured cognitive techniques and produce persistent session records via forge-lib.

## Commands

### `/cognitive-forge:debate <concept> [--quiet]`

Deep concept evaluation through multi-agent debate.

**When to use:**
- You need comprehensive analysis from multiple perspectives simultaneously
- The concept is well-formed enough to evaluate directly
- You want to see adversarial, creative, and integrative analysis side-by-side
- You prefer parallel agent output over iterative dialogue

**Process:**
1. **Intake** — Classify concept type, confirm understanding
2. **Spawn Agents** — Launch 3-5 specialist agents in parallel
3. **Present Results** — Show each agent's analysis with moderator narration
4. **Cross-Examination** (optional) — Resolve substantive tensions between agents
5. **Synthesis** — Integrated assessment with strengths, weaknesses, and verdict
6. **Persist Session** — Save complete debate to `sessions/debates/YYYY-MM-DD-slug.md`

**Flags:**
- `--quiet`: Run agents silently, show only final synthesis

**Example:**
```
/cognitive-forge:debate "AI-assisted code review integrated into PR workflows"
```

**Agents recruited:**
- **Always**: Challenger (adversarial), Explorer (creative), Synthesizer (integration)
- **Conditional**: Decomposer (structural complexity), Evaluator (factual claims)

---

### `/cognitive-forge:explore <concept>`

Interactive concept exploration through iterative dialogue.

**When to use:**
- You want to co-explore the concept through conversation
- The concept needs development or clarification before evaluation
- You prefer progressive depth over parallel analysis
- You want the Guide to embody multiple perspectives through dialogue

**Process:**
1. **Intake** — Conversational exchange about concept, relationship, constraints
2. **Decomposition** — Break concept into claims, assumptions, dependencies
3. **Multi-Angle Examination** — Apply 2-3 cognitive techniques based on concept type
4. **Adversarial Testing** — Pre-mortem, inversion, stress scenarios
5. **Creative Expansion** (optional) — Adjacent possibilities, constraint removal
6. **Synthesis** — Collaborative summary shaped by dialogue trajectory
7. **Persist Session** — Save narrative summary to `sessions/explorations/YYYY-MM-DD-slug.md`

**Agent recruitment:**
- **Decomposer**: Recruited when concept has 4+ components or nested dependencies
- **Evaluator**: Recruited when factual claims need evidence grounding
- **Never**: Challenger, Explorer, Synthesizer (Guide embodies these through dialogue)

**Example:**
```
/cognitive-forge:explore "Shift code review culture from gatekeeping to collaborative learning"
```

---

## Agents

### Core Debate Agents (always spawned in debate mode)

**forge-challenger** — Adversarial analyst
- Steel opposition: Build the strongest counterargument
- Boundary mapping: Find where the concept breaks
- Pre-mortem: Assume failure, work backwards
- Inversion: What does the opposite reveal?

**forge-explorer** — Creative expansion specialist
- Adjacent possibilities: Map unexplored connections
- Constraint reframing: Turn limitations into opportunities
- Amplified vision: Push concept to its fullest potential
- Hybrid forms: Combine with other ideas

**forge-synthesizer** — Integration analyst
- Core thread identification: Find genuine convergence
- Quality calibration: Establish excellence benchmarks
- Tension mapping: Identify unresolved disagreements
- Refinement pathways: Actionable next steps

### Recruited Agents (conditional)

**forge-decomposer** — Structural analyst
- Component mapping: Identify constituent parts
- Dependency graphs: Map what relies on what
- Assumption stacks: Surface hidden prerequisites
- Boundary definition: Where does this end?

**forge-evaluator** — Evidence specialist
- Claim inventory: What assertions are being made?
- Evidence assessment: What data supports or contradicts?
- Reality gaps: Where do assumptions diverge from facts?
- Verification: Use WebSearch and WebFetch to ground claims

---

## Skills

### cognitive-techniques (not user-invocable)

Foundation knowledge preloaded into all forge agents. Provides:

**Concept Classification:**
- Business (stakeholder perspectives, failure modes, constraints)
- Philosophical (logic, steel opposition, tension exploration)
- Framework (structural integrity, edge cases, boundaries)
- Creative (possibility expansion, excellence calibration)

**10 Cognitive Techniques:**
1. Cognitive Decomposition — Break into constituent parts
2. Perspective Synthesis — Examine through multiple lenses
3. Steel Opposition — Build strongest counterargument
4. Boundary Mapping — Find where concepts break
5. Possibility Expansion — Push into unexplored territory
6. Evidence Anchoring — Ground in verifiable reality
7. Iterative Refinement — Evolve through improvements
8. Excellence Calibration — Establish quality benchmarks
9. Sequential Deepening — Build structured layers
10. Constraint Shaping — Use limitations analytically

**Core Principles:**
- Genuine inquiry (every concept worthy of serious examination)
- Intellectual honesty (share reservations directly)
- Progressive depth (each exchange deepens understanding)
- Appropriate rigor (match intensity to complexity)

See `skills/cognitive-techniques/references/techniques.md` for complete specifications.

---

## Integration with forge-lib

### Session Persistence

Both commands delegate session file creation to forge-lib CLI:

**Debate sessions:**
```bash
forge session create debate "Concept title" "Topic being debated" \
  --agents challenger,explorer,synthesizer \
  --status Completed \
  --data '{"category": "Business"}'
```

**Exploration sessions:**
```bash
forge session create exploration "Concept title" "Topic being explored" \
  --agents decomposer,evaluator \
  --status Completed \
  --data '{"category": "Philosophical", "techniques": ["perspective-synthesis", "boundary-mapping"]}'
```

forge-lib handles:
- Date-based filename generation (YYYY-MM-DD-slug.md)
- Directory structure (sessions/debates/, sessions/explorations/)
- Frontmatter assembly and validation
- Index updates
- File path confirmation

---

## Workflow Patterns

### When to use Debate vs. Explore

**Use Debate when:**
- Concept is well-formed and ready for evaluation
- You want comprehensive parallel analysis
- Multiple perspectives simultaneously is valuable
- You prefer synthesis over iterative discovery

**Use Explore when:**
- Concept needs development through dialogue
- You want to co-create understanding progressively
- Your relationship to the concept matters (creator/evaluator/inheritor)
- You prefer guided conversation over parallel agents

### Concept Types and Technique Mapping

**Business concepts** → Perspective synthesis, evidence anchoring, boundary mapping
**Philosophical positions** → Steel opposition, boundary mapping, constraint shaping
**Frameworks/models** → Boundary mapping, excellence calibration, perspective synthesis
**Creative directions** → Possibility expansion, excellence calibration, iterative refinement

### Agent Recruitment Triggers

**Always recruit in debate mode:**
- Challenger (adversarial analysis)
- Explorer (creative expansion)
- Synthesizer (integration)

**Conditionally recruit in debate mode:**
- Decomposer (4+ interacting components, nested dependencies)
- Evaluator (checkable factual claims, empirical assumptions)

**Only recruit in explore mode:**
- Decomposer (structural complexity beyond conversational decomposition)
- Evaluator (factual claims needing verification)

**Never recruit in explore mode:**
- Challenger, Explorer, Synthesizer (Guide embodies these through dialogue)

---

## File Structure

```
cognitive-forge/
├── commands/
│   ├── debate.md           # Multi-agent debate orchestration
│   └── explore.md          # Interactive guided exploration
├── agents/
│   ├── forge-challenger.md  # Adversarial analyst
│   ├── forge-decomposer.md  # Structural analyst
│   ├── forge-evaluator.md   # Evidence specialist
│   ├── forge-explorer.md    # Creative expansion
│   └── forge-synthesizer.md # Integration analyst
├── skills/
│   └── cognitive-techniques/
│       ├── SKILL.md         # Foundation skill (preloaded to agents)
│       └── references/
│           └── techniques.md # Detailed technique specs
├── plugin.json
└── README.md
```

---

## Anti-Patterns

### Debate Mode
- **Technique Theater**: Going through motions without genuine insight
- **False Balance**: Treating weak objections as equivalent to strong ones
- **Premature Synthesis**: Concluding before agents have fully explored
- **Debate for Debate's Sake**: Cross-examining when agents fundamentally agree
- **Moderator Bias**: Injecting your own analysis when agents have covered it

### Explore Mode
- **Monologue Mode**: Delivering analysis without pausing for user input
- **Technique Theater**: Applying methods performatively without insight
- **Premature Agent Recruitment**: Spawning agents when conversation suffices
- **Passive User Treatment**: Treating user as audience rather than co-explorer
- **Phase Rigidity**: Following phases when dialogue wants to go elsewhere
- **Analysis Paralysis**: Never reaching synthesis

---

## Version History

**v2.0.0** (Current)
- Session persistence delegated to forge-lib CLI
- Date-based session filenames (YYYY-MM-DD-slug.md)
- Index integration for session tracking
- Removed inline YAML frontmatter assembly
- Streamlined commands (~25% reduction from v1)

**v1.0.0**
- Original implementation with inline file operations
- Manual YAML frontmatter assembly
- Commands directly wrote session files
