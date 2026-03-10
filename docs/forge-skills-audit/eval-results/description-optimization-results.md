# Description Optimization Results — Phase 5b

**Date:** 2026-03-10
**Model:** claude-sonnet-4-20250514
**Method:** Skill Creator `run_loop.py` with 60/40 train/test split, 5 max iterations, 3 runs per query
**Skills tested:** 6 (cognitive-techniques dropped — not user-invocable)

## Summary

| Skill | Original Test Score | Best Test Score | Iterations | Exit Reason | Recommendation |
|-------|-------------------|-----------------|------------|-------------|----------------|
| memory-management | 57% (4/7) | 57% (4/7) | 5 | max_iterations | KEEP |
| org-context | 50% (4/8) | 50% (4/8) | 5 | max_iterations | KEEP |
| task-management | 50% (4/8) | 50% (4/8) | 5 | max_iterations | KEEP |
| pm-methodology | 50% (4/8) | 50% (4/8) | 5 | max_iterations | KEEP |
| product-context | 57% (4/7) | 57% (4/7) | 5 | max_iterations | KEEP |
| rovo-foundation | 57% (4/7) | 57% (4/7) | 5 | max_iterations | KEEP |

**Result:** No description changes applied. All skills retained their original descriptions.

## Key Finding: Architectural Trigger Ceiling

The optimizer generated diverse, high-quality candidate descriptions across 30 total iterations but **could not improve trigger rates for any skill**. Scores remained flat within ±1 across all iterations.

### Failure Pattern

For every skill, every iteration showed the same pattern:
- **Should-NOT-trigger queries:** ~100% correct (no false positives)
- **Should-trigger queries:** ~0% trigger rate (near-total false negatives)

This means Claude does not consult skills for natural-language queries like "what should I work on next?" or "who is todd on the finance team?" regardless of how the skill description is written. The description is being read and correctly prevents false positives, but it cannot cause Claude to proactively invoke a skill when no explicit skill reference is present.

### Root Cause Analysis

The trigger ceiling is architectural, not textual:

1. **No skill awareness at query time:** When a user sends a bare query like "triage my overdue tasks," Claude processes it as a general question. It doesn't scan available skills for potential matches unless prompted to do so.

2. **Description ≠ trigger:** The description serves as a *filter* (preventing false positives) rather than a *trigger* (causing invocation). Even perfect descriptions can't overcome this asymmetry.

3. **The superpowers workaround works:** The `using-superpowers` system prompt in this project forces Claude to check skills before every response. This is the effective solution — it changes Claude's behavior from passive skill matching to active skill scanning.

### Implication

Description optimization is valuable for reducing false positives but cannot improve independent trigger rates. For skills that need to activate on natural language, the solution is:
- System prompts that mandate skill checking (current `superpowers` approach)
- Explicit user invocation via `/skill-name` commands
- Preloading skills into agent context (as `cognitive-techniques` already does)

## Per-Skill Details

### memory-management
- **Original description:** Decodes workplace shorthand, acronyms, nicknames, and internal language into full context using a tiered lookup strategy. Use this skill when the user mentions people, projects, or terms by informal names — even if they don't explicitly ask for a definition. Also activates when any plugin encounters unrecognized entity names that need resolution against organizational memory.
- **Best optimizer attempt (Iter 5):** "Use when users encounter workplace-specific references they don't understand: colleague names/nicknames, internal acronyms and terms, team roles and responsibilities, company processes, and messages containing organizational jargon or shorthand that needs translation or clarification."
- **Score delta:** 0% (4/7 → 4/7 test)

### org-context
- **Original description:** Resolves informal product, team, client, and module references to canonical names using organizational taxonomy. Use this skill when any command needs to validate an entity name against the org's vocabulary — even if the user doesn't explicitly mention taxonomy or org context. Triggers on shorthand like "the mobile app", "billing stuff", or "Acme" in any plugin context.
- **Best optimizer attempt:** Multiple variants tried (231-372 chars), all achieving identical 4/8 test scores.
- **Score delta:** 0%

### task-management
- **Original description:** Task management workflow guidance for status transitions, priority assignment, and triage reasoning. Use when helping users manage task lifecycles and make decisions about task updates.
- **Best optimizer attempt (Iter 2):** "Use for checking task status (blocked, in-progress, overdue), changing task priorities, getting work recommendations, and triaging tasks. Handles task queries, status updates, and workflow decisions."
- **Score delta:** 0% (4/8 → 4/8 test)

### pm-methodology
- **Original description:** Provides PM reasoning guidance, tone recommendations, and methodology principles for Product Forge workflows. All file operations delegated to forge-lib.
- **Best optimizer attempt:** Multiple variants tried (153-340 chars), all achieving identical 4/8 test scores.
- **Score delta:** 0%

### product-context
- **Original description:** Provides domain knowledge about the organization's product ecosystem, client relationships, integration landscape, and team structure. Reads taxonomy from memory/context/ files via forge-lib.
- **Best optimizer attempt:** Multiple variants tried (191-391 chars), all achieving identical 4/7 test scores.
- **Score delta:** 0%

### rovo-foundation
- **Original description:** Platform knowledge for Rovo agent configuration: TCREI framework, validation rules, knowledge sources, and governance model.
- **Best optimizer attempt (Iter 5):** "Use this skill when working with Rovo agents. Create, build, set up, configure, or design AI agents for Jira and Confluence including instructions, knowledge sources, skills, validation rules, and deployment."
- **Score delta:** 0% test (4/7 → 4/7), +1 train only on Iter 5 (8/13)

## Methodology Notes

- Eval sets were user-reviewed and edited via HTML review template before optimization
- The `run_loop.py` script was patched for Python 3.9 compatibility (`from __future__ import annotations`) and to use `claude -p` CLI instead of the Anthropic SDK for the improvement step (avoiding API key requirement)
- Raw optimization output is stored in `description-opt/{skill-name}/` subdirectories
