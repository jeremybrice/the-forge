# Forge Marketplace Skills Audit — Synthesis & Assessment Report

**Date:** 2026-03-09
**Scope:** All 8 Forge marketplace plugins (14 skills, 25 commands, 15 agents, 10+ reference files)
**Framework:** Skills 2.0 Strategic Framework (Context Engineering & Evaluation Optimization)
**Auditor:** Claude Opus 4.6

---

## Executive Summary

This report presents a structural audit of all skills, commands, and agents across the 8 plugins in the Forge marketplace, scored against a 10-dimension rubric derived from the Skills 2.0 framework. The audit identified **27 full eval candidates** across all plugins, **7 description optimization candidates**, and numerous direct improvement opportunities. The ecosystem is architecturally sound with consistent forge-lib delegation and strong procedural logic, but suffers from three systemic weaknesses: missing reference files, weak cross-plugin handoff awareness, and insufficient description "pushiness" for independent triggering.

---

## Plugin-by-Plugin Verdicts

### 1. Forge Memory (2 skills, 5 commands)
**Verdict:** Structurally solid, operationally well-designed, with ecosystem-level gaps.

The tiered lookup strategy (Taxonomy → Glossary → Deep Memory → Ask User) is architecturally elegant. forge-lib delegation is clean. The biggest gaps are zero reference files (lifecycle scoring rules are duplicated) and weak cross-plugin handoff (the foundational plugin rarely tells downstream consumers how to use its outputs).

**Full eval candidates (3):** memory-management, recall, org-context
**Description optimization (2):** memory-management, org-context

### 2. Tasks Forge (1 skill, 3 commands)
**Verdict:** Lean and focused, with strong state machine design, but operates in near-total isolation.

The five-state workflow with explicit transitions and threshold-based triage reasoning is well-engineered. At only 4 components, it's the most focused plugin. The critical gap: the CLAUDE.md workspace instructions describe a removed harvest plugin → Tasks Forge promotion as a core flow, but the plugin never mentions a removed harvest plugin.

**Full eval candidates (2):** task-management, update (triage mode)
**Description optimization (1):** task-management

### 3. Product Forge (3 skills, 8 commands, 6 agents)
**Verdict:** The most architecturally sophisticated plugin, with an excellent orchestrator/agent pattern, but the largest (2,400+ lines) with duplication and cross-plugin blindness.

The orchestrator/agent separation is the crown jewel of the entire Forge. All six agents are structurally consistent while genuinely differentiated. Jira sync is the most thoroughly documented integration. The gaps: no reference files across 17 components, Jira commands duplicate field mapping tables, product-context overlaps with Forge Memory's org-context, and cross-plugin handoff is the weakest dimension.

**Full eval candidates (5):** create orchestrator, forge-initiative, forge-story, forge-intake, Jira sync system (push/pull/sync together)
**Description optimization (2):** pm-methodology, product-context

### 4. Cognitive Forge (1 skill, 2 commands, 5 agents)
**Verdict:** Production-ready with strong cognitive foundation, but role boundaries and heuristic recruitment need clarification.

The bidirectional architecture (debate for parallel multi-agent analysis, explore for guided conversation) is well-designed with distinct, non-redundant modes. The cognitive-techniques reference file is a genuine strength. Gaps include ambiguous moderator vs. guide role boundaries, heuristic-based agent recruitment with no edge-case guidance, and weak cross-plugin handoff.

**Full eval candidates (3):** debate (orchestration logic), explore (dialogue governance), forge-evaluator (web search and evidence classification)
**Description optimization (1):** cognitive-techniques (if user-invocable)

### 5. Report Forge (1 skill, 3 commands, 3 agents)
**Verdict:** Mature architecture with strong investigator and analyst agents, but conditionally ready due to missing template files and an underspecified synthesizer.

The investigator → analyst → synthesizer pipeline is well-conceived. The Investigator and Analyst agents are near specification-complete. However, the Synthesizer references template files that don't exist, and command duplication inflates the codebase. Conditional on resolving these gaps before full eval.

**Full eval candidates (3, conditional):** forge-investigator, forge-analyst, forge-synthesizer
**Direct fix required first:** Create the 8 missing report type templates referenced by the Synthesizer

### 6. a removed harvest plugin (3 skills, 5 commands, 3 agents)
**Verdict:** Well-architected capture layer with critical blocking gaps that must be resolved before reliable operation.

The five-stage pipeline (init → scan → capture → review → promote) with human-in-the-loop at every stage is well-designed. Cross-plugin integration with Tasks Forge and Forge Memory is explicitly documented. However, the transcript format contract is ambiguous, subagent dispatch mechanics are undefined, and parsing logic is implicit rather than rule-based.

**Full eval candidates (7):** task-harvester skill + agent, knowledge-harvester skill + agent, jira-digest skill + agent, scan command
**Direct fix required first:** Formalize transcript format, document Task tool interface

### 7. Rovo Forge (3 skills, 2 commands, 10+ references)
**Verdict:** The most thoroughly documented plugin with excellent reference architecture, but has gaps in validation remediation, permission modeling, and testing methodology.

The four-tier architecture (foundation → domain specialists → interactive builders → sample configs) is the best progressive disclosure implementation in the Forge. The TCREI framework with anti-pattern guidance is comprehensive. Gaps include no guidance on fixing validation failures, underspecified permission model in the configuration flow, and no defined testing framework for deployed agents.

**Full eval candidates (5):** Validation remediation, permission model configuration, deep research surfacing, automation mode handling, agent testing framework
**Description optimization (1):** rovo-foundation

### 8. Cowork Plugin Management (2 skills)
**Verdict:** Well-architected with strong reference material, but both skills require behavioral verification of file manipulation and MCP configuration claims.

Both skills feature structured 4-5 phase workflows with explicit entry/exit criteria. Reference material includes three example plugins at increasing complexity. Gaps include undefined MCP connection status reporting, unspecified placeholder replacement scope, and no error handling guidance for validation failures.

**Full eval candidates (2):** cowork-plugin-customizer, create-cowork-plugin

---

## Systemic Findings (Cross-Plugin Patterns)

### 1. Missing Reference Files is the #1 Structural Gap
Six of eight plugins have zero reference files (Forge Memory, Tasks Forge, Product Forge, Tasks Forge, Report Forge templates missing, a removed harvest plugin). Only Cognitive Forge (techniques.md) and Rovo Forge (10+ reference files) demonstrate the progressive disclosure pattern that the Skills 2.0 framework prescribes. This causes duplication (Jira field mappings repeated across 3 commands), bloated SKILL.md files, and inconsistent information between components that should share a single source of truth.

### 2. Cross-Plugin Handoff is the #2 Systemic Weakness
Despite the CLAUDE.md workspace instructions describing explicit cross-plugin flows (a removed harvest plugin → Tasks Forge, Product Forge → Forge Memory, etc.), most plugins operate in isolation. Tasks Forge never mentions a removed harvest plugin. Product Forge never suggests push-to-jira after creation. Forge Memory's commands don't suggest how remembered entries enrich other plugins. The ecosystem's value proposition depends on these handoffs, and they're architecturally absent.

### 3. Description Triggering is Consistently Underpowered
Across all plugins, skill descriptions are functional but not "pushy" enough for independent triggering. They work when invoked by commands or other skills, but wouldn't trigger on natural user prompts like "what does PSR mean?" (memory-management), "what should I work on?" (task-management), or "help me write a story card" (pm-methodology). The Skill Creator's description optimization loop (run_loop.py) should be applied systematically.

### 4. forge-lib Delegation is the #1 Systemic Strength
Every plugin cleanly separates reasoning from execution through forge-lib delegation. JSON response parsing is documented at every call site. Error handling follows a consistent pattern (check success, report error, continue or stop). This is the strongest architectural consistency in the ecosystem.

### 5. Agent Architecture Quality is High Where Present
Product Forge's orchestrator/agent pattern, Cognitive Forge's multi-agent debate, Report Forge's investigator pipeline, and a removed harvest plugin's harvester agents all demonstrate sophisticated delegation. Agents are consistently read-only, structurally uniform, and well-differentiated in reasoning. The agent suite is the ecosystem's most mature pattern.

---

## Full Eval Candidate Master List

| # | Plugin | Component | Rationale |
|---|--------|-----------|-----------|
| 1 | Forge Memory | memory-management | Tiered lookup behavioral validation |
| 2 | Forge Memory | recall | User-facing search execution |
| 3 | Forge Memory | org-context | Shorthand resolution and validation |
| 4 | Tasks Forge | task-management | Triage reasoning and workflow prompts |
| 5 | Tasks Forge | update (triage mode) | Complex interactive triage workflow |
| 6 | Product Forge | create (orchestrator) | Most complex workflow in the Forge |
| 7 | Product Forge | forge-initiative | Executive-tone reasoning quality |
| 8 | Product Forge | forge-story | Engineering spec quality (highest stakes) |
| 9 | Product Forge | forge-intake | Adaptive interview with red flag probing |
| 10 | Product Forge | Jira sync system | Bidirectional sync integration test |
| 11 | Cognitive Forge | debate | Multi-agent orchestration logic |
| 12 | Cognitive Forge | explore | Dialogue governance and recruitment |
| 13 | Cognitive Forge | forge-evaluator | Web search and evidence classification |
| 14 | Report Forge | forge-investigator | Data gathering completeness (conditional) |
| 15 | Report Forge | forge-analyst | Pattern identification accuracy (conditional) |
| 16 | Report Forge | forge-synthesizer | Narrative assembly quality (conditional) |
| 17 | a removed harvest plugin | task-harvester (skill + agent) | Task extraction from transcripts |
| 18 | a removed harvest plugin | knowledge-harvester (skill + agent) | Knowledge capture from transcripts |
| 19 | a removed harvest plugin | jira-digest (skill + agent) | JIRA event parsing from transcripts |
| 20 | a removed harvest plugin | scan command | MCP retrieval and transcript writing |
| 21 | Rovo Forge | Validation remediation | Fixing validation failures |
| 22 | Rovo Forge | Permission model config | Safety-critical feature |
| 23 | Rovo Forge | Deep research surfacing | Capability not surfaced in config flow |
| 24 | Rovo Forge | Automation mode handling | Constraints documented, templates missing |
| 25 | Rovo Forge | Agent testing framework | No testing methodology defined |
| 26 | Cowork Plugin Mgmt | cowork-plugin-customizer | File manipulation and MCP config claims |
| 27 | Cowork Plugin Mgmt | create-cowork-plugin | Plugin packaging behavioral claims |

---

## Description Optimization Candidates (7)

| Plugin | Skill | Issue |
|--------|-------|-------|
| Forge Memory | memory-management | Won't trigger on "what does X mean?" |
| Forge Memory | org-context | Won't trigger on product/team informal references |
| Tasks Forge | task-management | Won't trigger on "what should I work on?" |
| Product Forge | pm-methodology | Won't trigger on "help me write a card" |
| Product Forge | product-context | Won't trigger on informal product mentions |
| Cognitive Forge | cognitive-techniques | If user-invocable, needs natural triggers |
| Rovo Forge | rovo-foundation | Won't trigger on "build me a Rovo agent" |

---

## Recommended Eval Priority Order

Given that full evals are resource-intensive, the recommended priority order balances impact, dependency, and risk:

**Tier 1 (Highest Impact, Do First):**
Product Forge create orchestrator, forge-story, forge-intake. These are the most-used, highest-stakes workflows. Story quality directly affects engineering execution.

**Tier 2 (Foundational, Do Next):**
Forge Memory memory-management, recall, org-context. Everything depends on memory resolution working correctly. Failures here cascade across all plugins.

**Tier 3 (Integration, Do After Fixing Blockers):**
a removed harvest plugin harvesters (after formalizing transcript format). Product Forge Jira sync system. These are integration-heavy flows where environmental errors and behavioral errors must be distinguished.

**Tier 4 (Specialized, Do When Ready):**
Cognitive Forge debate and explore. Report Forge pipeline (after creating missing templates). Rovo Forge gaps. Cowork Plugin Management.

**Tier 5 (Optimization):**
Description optimization loop for all 7 candidates. Tasks Forge triage mode. These are refinement rather than validation.

---

## Immediate Direct Improvements (No Eval Needed)

These are structural fixes that can be made without running evals:

1. **Extract shared reference files** across all plugins (lifecycle scoring, forge-lib command catalog, Jira field mapping, card identification patterns, triage thresholds)
2. **Add cross-plugin handoff suggestions** to every command that produces output consumable by other plugins
3. **Add pre-save confirmation gates** to Forge Memory remember and Product Forge checkpoint
4. **Clarify product-context vs. org-context boundary** (merge or explicitly delineate)
5. **Create 8 missing report type templates** for Report Forge synthesizer
6. **Formalize a removed harvest plugin transcript format** as a parseable specification
7. **Add error handling guidance** to Cowork Plugin Management for validation failures
