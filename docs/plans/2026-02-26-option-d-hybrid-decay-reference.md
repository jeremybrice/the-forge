# Option D: Hybrid Exponential Decay — Future Reference

**Date:** 2026-02-26
**Status:** Deferred — revisit after 3-6 months of stepped threshold telemetry
**Prerequisite:** Living Memory System (2026-02-26-living-memory-system-design.md) must be operational with telemetry collecting data
**Related debate:** Cognitive Forge session — memory decay approaches

## Overview

Option D replaces the stepped decay intervals from the Living Memory System with an exponential decay engine that produces mathematically smooth score degradation, while preserving the three-tier lifecycle status (trusted/probationary/sunset) as human-readable gates on top of the continuous curve.

This document captures the design as validated by the Cognitive Forge debate so it can be revisited when telemetry data justifies the upgrade.

## Why This Was Deferred

The Cognitive Forge debate (5 agents: Challenger, Explorer, Synthesizer, Decomposer, Evaluator) identified several risks with shipping Option D first:

1. **No usage data to calibrate parameters.** Exponential decay has tunable constants (lambda, half-life) that require empirical data on real entry lifespans and recall patterns. Without data, any parameters are guesses.
2. **Git noise from continuous scoring.** Exponential decay produces floating-point scores that change on every evaluation pass, generating noisy diffs in git-versioned markdown files.
3. **System-read vs. user-recall trap.** In a naive implementation, checking whether an entry should decay counts as recalling it (resetting the curve), creating a self-defeating loop.
4. **Complexity budget.** Option D inherits all of the stepped threshold system's operational requirements (triage, cascade handling, telemetry) plus the exponential math engine, curve-reset logic, and quantization layer.
5. **The cognitive science analogy is weak.** Ebbinghaus's forgetting curve models personal recall probability for memorized items. Organizational knowledge relevance is a fundamentally different quantity — it changes due to events (projects ship, people leave), not clocks.

The Evaluator estimated ~40% of Option D's conceptual foundation is empirically solid. The remaining 60% is reasonable conjecture that needs validation through real usage.

## When to Revisit

Upgrade to Option D when the Living Memory System's telemetry shows at least two of these criteria:

| Criterion | Signal | What It Means |
|-----------|--------|---------------|
| **Triage fatigue** | Users archive 80%+ of triaged entries without reading | Entries should have decayed faster — stepped intervals are too generous |
| **False sunsets** | Users keep 80%+ of triaged entries | Decay is too aggressive for certain source types — need per-source curves |
| **Source divergence** | One source type's avg_lifespan_days differs by 3x+ from another | Stepped intervals can't accommodate both — need continuous, source-aware curves |
| **Volume scaling** | Entry count exceeds 200+ with probationary backlog growing | Coarse tiers create limbo — finer-grained scoring needed for recall ranking |

## The Option D Design

### Core Concept

Replace the stepped decay table (0-30 days: 0, 31-60 days: -10, etc.) with an exponential decay function that calculates the current score based on elapsed time since last recall:

```
current_score = initial_score * e^(-lambda * days_since_last_recall)
```

Where:
- `initial_score` is the score at the time of last recall (or creation if never recalled)
- `lambda` is the decay rate constant (source-specific)
- `days_since_last_recall` is `today - last_recalled`

### Source-Aware Decay Rates

Each source type gets its own lambda value, calibrated from telemetry:

| Source | Lambda (initial guess) | Half-Life (approx) | Rationale |
|--------|----------------------|---------------------|-----------|
| Manual `/remember` | 0.005 | ~139 days | User explicitly stored this — slow decay |
| Structured frontmatter | 0.008 | ~87 days | Deliberately placed, moderate durability |
| Auto-matched | 0.015 | ~46 days | System recognized, faster turnover |
| Threshold-promoted | 0.025 | ~28 days | Earned through repetition, fast to prove or fade |

These lambda values are initial guesses. The actual values should be derived from the `avg_lifespan_days` telemetry data collected by the stepped threshold system.

### Quantized Evaluation

To solve the git noise problem, decay is not computed continuously. It is evaluated only at discrete trigger points:

1. When `forge memory decay` runs (batch sweep)
2. As a pre-step in `forge memory recall` (query-time evaluation)
3. Via scheduled routine

At evaluation time:
1. Read `importance` (integer) and `last_recalled` (date) from frontmatter
2. Compute `days_inactive = today - last_recalled`
3. Apply: `new_score = round(importance * e^(-lambda * days_inactive))`
4. If `new_score != importance`, write the new integer score to frontmatter
5. Update `lifecycle_status` based on new score thresholds

This produces one clean diff per affected file per decay run — not continuous floating-point noise.

### Curve Reset on Recall

When an entry is genuinely recalled (user recall, not system read):

1. Record the current score as the new baseline
2. Reset `last_recalled` to today
3. Apply boost (+5, capped at 2 per day)
4. The decay curve restarts from this new, higher baseline

This means frequently-recalled entries maintain high scores with slow decay from their elevated baseline, while neglected entries follow the full exponential curve downward.

### System Read vs. User Recall

The distinction defined in the stepped threshold system carries forward:

| Operation | Type | Effect on Curve |
|-----------|------|----------------|
| `forge memory recall "Todd"` | User recall | Resets curve, applies boost |
| `forge memory decay` | System read | Evaluates curve position, never resets |
| Plugin harvesting a reference | User recall | Resets curve, applies boost |
| Forge-shell rendering | System read | No effect |
| `forge memory triage-report` | System read | No effect |

### Threshold Gates (The Hybrid Part)

The exponential score maps to the same three lifecycle tiers:

| Tier | Score Range | Behavior |
|------|------------|----------|
| **Trusted** | >= 40 | Full recall inclusion |
| **Probationary** | 10-39 | Included but flagged |
| **Sunset** | < 10 | Excluded, queued for triage |

The tiers are identical to the stepped threshold system. The only difference is how the score arrives at these boundaries — smooth curve vs. stepped drops.

### What Option D Adds Over Stepped Thresholds

1. **Proportional decay.** High-scoring entries decay slowly in absolute terms (e^(-0.005 * 30) ≈ 0.86, so a score-70 entry loses ~10 points in 30 days). Low-scoring entries decay to sunset faster. This matches the intuition that well-established knowledge should be more durable.

2. **Source-specific half-lives.** Instead of one set of stepped intervals for all sources, each source type has its own decay curve. Auto-harvested entries can have aggressive 28-day half-lives while manual entries get 139-day half-lives — without changing the tier thresholds.

3. **Smoother recall ranking.** With continuous scores, recall results can be ranked by exact importance rather than just tier membership. Two trusted entries can be distinguished: score 85 surfaces before score 42.

4. **Predictable long-tail behavior.** Exponential decay never reaches zero (it asymptotically approaches it), which means the system naturally produces a long tail of low-but-nonzero entries. Combined with the sunset threshold at 10, this means entries get a gradual farewell rather than an abrupt cliff.

### What Option D Costs

1. **Math complexity.** The decay function requires `math.exp()` calculations per entry per evaluation. At 200 entries this is negligible; at 2000 entries it's still fast but measurably slower than integer subtraction.

2. **Parameter tuning.** Four lambda values must be calibrated. Wrong lambdas produce either aggressive decay (false sunsets) or sluggish decay (accumulation). This is why telemetry data is prerequisite.

3. **Debugging opacity.** When a user asks "why did this entry go probationary?", the answer is "because e^(-0.015 * 47) * 25 = 12.3, which rounds to 12, which is below 40" — harder to explain than "because it wasn't recalled for 60 days."

4. **Boost-curve interaction.** Boost resets the decay curve, which creates complex dynamics. An entry that is recalled frequently but with long gaps between recalls may oscillate between trusted and probationary in ways that are hard to predict without simulation.

### Implementation Approach

If/when Option D is approved:

1. **Keep all existing infrastructure.** Triage, cascade handling, telemetry, pending.json, harvest pipeline — none of this changes.
2. **Replace the decay calculation only.** Swap the stepped interval table in `memory_ops.py` with the exponential function.
3. **Add `decay_rate` field to frontmatter.** Store the lambda value per entry so it's visible and debuggable.
4. **Add `score_at_last_recall` field.** Store the baseline score at curve reset time, needed for accurate exponential calculation.
5. **Calibrate lambdas from telemetry.** Use `avg_lifespan_days` by source to compute lambda = ln(2) / desired_half_life.
6. **A/B test internally.** Run both stepped and exponential decay in parallel for 2 weeks, compare which produces more accurate triage recommendations.

### New Frontmatter Fields (Option D Only)

```yaml
# Added to existing lifecycle fields
decay_rate: 0.015
score_at_last_recall: 25
```

### Architectural Notes from the Debate

**Challenger's warning:** "Start with Option C and earn your way to complexity. The risk of starting with D is that you're optimizing a function you haven't yet measured."

**Explorer's reframe:** "The problem is garbage collection, not cognitive science. The Ebbinghaus curve is solving the wrong problem." If telemetry shows that stepped thresholds handle garbage collection adequately, Option D may never be needed.

**Synthesizer's refinement:** If Option D is adopted, compress the low-end starting scores further (auto-matched = 20, threshold-promoted = 10) to account for the exponential curve's slower absolute decay at low scores.

**Decomposer's structural trap:** The system-read vs. user-recall distinction is even more critical in Option D than in stepped thresholds, because a curve reset is a much larger effect than a stepped boost. A single accidental "recall" can resurrect an entry that should have been sunset.

**Evaluator's evidence gap:** The +5 flat boost is arbitrary. If Option D is adopted, consider proportional boosts: `boost = max(5, round(current_score * 0.1))` — a 10% boost that scales with the entry's current standing. This matches published reinforcement models (FSRS) more closely than flat increments.

## References

- Ebbinghaus Forgetting Curve — foundational research on exponential memory decay
- FSRS (Free Spaced Repetition Scheduler) — modern Anki algorithm, 17 tunable parameters
- SM-2 — original SuperMemo algorithm with multiplicative reinforcement
- Graphiti (Zep) — temporal knowledge graph with event-driven invalidation
- OpenClaw — file-based system with exponential time-decay and pinning
