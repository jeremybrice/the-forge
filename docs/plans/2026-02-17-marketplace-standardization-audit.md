# Marketplace Standardization Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Validate that all 6 plugins in The Forge marketplace consistently follow forge-lib rules, then produce a findings report with specific remediation actions.

**Architecture:** Dispatch one sub-agent per plugin to audit against a shared compliance checklist derived from the forge-lib contract. A final aggregation task synthesizes findings into a single standardization report at `docs/reports/2026-02-17-marketplace-standardization-audit.md`.

**Tech Stack:** Claude Code sub-agents (Grep, Glob, Read), forge-lib Python CLI for validation, markdown report output.

---

## Compliance Dimensions

Every plugin is audited against these 12 standardization rules derived from forge-lib's v2 architecture contract:

| # | Rule | Source of Truth |
|---|------|----------------|
| R1 | **forge-lib CLI Delegation** — All file create/read/update/delete operations go through `forge` CLI, never direct file I/O | `CLAUDE.md` v2 architecture |
| R2 | **index.json Usage** — Plugin's data directory has `index.json` for fast queries (no directory scanning) | `CLAUDE.md` performance rule |
| R3 | **Schema Validation** — Entity types have a corresponding JSON schema in `forge-lib/schemas/` | `forge-lib/schemas/*.json` |
| R4 | **Template Usage** — Content generation uses Jinja2 templates from `forge-lib/templates/` | `forge-lib/templates/*.md.j2` |
| R5 | **plugin.json Structure** — `.claude-plugin/plugin.json` has `name`, `version`, `description`, `author` | All existing plugin.json files |
| R6 | **Command Structure** — Commands have YAML frontmatter (`description`, optionally `argument-hint`), workflow phases, and delegate to forge-lib | Consistent across product-forge, tasks-forge |
| R7 | **Skill Structure** — Skills are reasoning-only (no file operations, no `forge` CLI calls in skill body), have YAML frontmatter (`name`, `description`) | `CLAUDE.md` v2 architecture |
| R8 | **README Coverage** — README.md covers: overview, commands table, skills table, forge-lib CLI usage, data directory structure, verification steps | All existing READMEs |
| R9 | **File Naming Patterns** — Files follow documented naming conventions per entity type | `CLAUDE.md` naming table |
| R10 | **JSON Response Parsing** — Commands parse forge-lib JSON responses (`{success, data, error}`) and present results to user | forge-lib `output_json()` contract |
| R11 | **Error Handling** — Commands handle forge-lib errors gracefully (check `success` field, present `error` message) | forge-lib error contract |
| R12 | **forge-shell View Controller** — Plugin has a corresponding view controller in `forge-shell/app/js/` that reads from `index.json` | `forge-shell/` architecture |

---

## Task 1: Audit product-forge

**Files:**
- Read: `product-forge/commands/*.md` (all 11 commands)
- Read: `product-forge/skills/*/SKILL.md` (3 skills)
- Read: `product-forge/.claude-plugin/plugin.json`
- Read: `product-forge/README.md`
- Read: `forge-shell/app/js/product-forge.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Dispatch a sub-agent with the following prompt:

```
Audit product-forge against these 12 compliance rules:
R1-R12 (full list above).

For each rule, report:
- PASS / FAIL / PARTIAL / N/A
- Evidence (file:line or quote)
- Remediation (if not PASS)

Read all files in product-forge/commands/, product-forge/skills/,
product-forge/.claude-plugin/plugin.json, product-forge/README.md.
Also check forge-shell/app/js/product-forge.js exists.
Also check forge-lib/schemas/card.json and forge-lib/templates/card.md.j2 exist.
```

**Step 2: Record findings**

Capture the sub-agent's structured output (12 rule verdicts + evidence + remediations).

---

## Task 2: Audit tasks-forge

**Files:**
- Read: `tasks-forge/commands/*.md` (3 commands)
- Read: `tasks-forge/skills/task-management/SKILL.md`
- Read: `tasks-forge/.claude-plugin/plugin.json`
- Read: `tasks-forge/README.md`
- Read: `forge-shell/app/js/tasks.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Dispatch a sub-agent with the same 12-rule checklist, scoped to tasks-forge.

Check for:
- `forge task init/create/query/update` usage in commands
- `tasks/index.json` reference
- `forge-lib/schemas/task.json` exists
- `forge-lib/templates/task.md.j2` exists
- View controller in forge-shell

**Step 2: Record findings**

---

## Task 3: Audit forge-memory

**Files:**
- Read: `forge-memory/commands/*.md` (4 commands)
- Read: `forge-memory/skills/*/SKILL.md` (2 skills)
- Read: `forge-memory/.claude-plugin/plugin.json`
- Read: `forge-memory/README.md`
- Read: `forge-shell/app/js/memory.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Known deviations to investigate:
- **R1 (forge-lib delegation):** `/memory:remember` creates `memory/people/`, `memory/projects/`, `memory/glossary.md` files DIRECTLY — not through forge-lib. This is a likely FAIL.
- **R2 (index.json):** forge-memory does NOT use index.json for any queries. Taxonomy is stored in YAML frontmatter of context files. Is this intentional or a gap?
- **R3 (schema):** Check if `forge-lib/schemas/memory.json` exists.
- **R4 (templates):** Check if `forge-lib/templates/memory*.md.j2` exists.

**Step 2: Record findings**

---

## Task 4: Audit cognitive-forge

**Files:**
- Read: `cognitive-forge/commands/*.md` (2 commands: debate, explore)
- Read: `cognitive-forge/agents/*.md` (5 agents)
- Read: `cognitive-forge/skills/cognitive-techniques/SKILL.md`
- Read: `cognitive-forge/skills/cognitive-techniques/references/techniques.md`
- Read: `cognitive-forge/.claude-plugin/plugin.json`
- Read: `cognitive-forge/README.md`
- Read: `forge-shell/app/js/cognitive-forge.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Additional checks:
- Verify `forge session create` is used (not direct file writes)
- Verify agents don't write files directly
- Check `forge-lib/schemas/session.json` exists
- Check `forge-lib/templates/session.md.j2` exists
- Check `sessions/index.json` is referenced

**Step 2: Record findings**

---

## Task 5: Audit report-forge

**Files:**
- Read: `report-forge/commands/*.md` (3 commands)
- Read: `report-forge/agents/*.md` (3 agents)
- Read: `report-forge/skills/report-methodology/SKILL.md`
- Read: `report-forge/.claude-plugin/plugin.json`
- Read: `report-forge/README.md`
- Read: `forge-shell/app/js/report-forge.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Known deviations to investigate:
- **R1 (forge-lib delegation):** The `forge-synthesizer` agent uses `Write` tool to create report files directly (at `reports/{report_type}s/{filename}.md`). Commands also call `forge report create`. Is the agent bypassing forge-lib, or does the command handle it?
- **R3 (schema):** Check if `forge-lib/schemas/report.json` exists.
- **R4 (templates):** Check if `forge-lib/templates/report.md.j2` exists.
- **R12 (forge-shell):** Check if view controller reads from `reports/index.json`.

**Step 2: Record findings**

---

## Task 6: Audit rovo-forge

**Files:**
- Read: `rovo-forge/commands/*.md` (2 commands)
- Read: `rovo-forge/skills/*/SKILL.md` (3 skills)
- Read: `rovo-forge/.claude-plugin/plugin.json`
- Read: `rovo-forge/README.md`
- Read: `forge-shell/app/js/rovo-agent-forge.js`
- Output: Append findings to working doc

**Step 1: Launch sub-agent audit**

Known deviations to investigate:
- **R1 (forge-lib delegation):** rovo-forge has ZERO forge-lib calls. Commands write `rovo-agents/{slug}/agent.md` directly in Phase 11. LIKELY FAIL.
- **R2 (index.json):** No index.json exists for rovo-agents. LIKELY FAIL.
- **R3 (schema):** No `forge-lib/schemas/agent.json` exists. LIKELY FAIL.
- **R4 (templates):** No `forge-lib/templates/agent.md.j2` exists. LIKELY FAIL.
- **R10/R11 (JSON response/error):** No forge-lib calls means no JSON parsing. LIKELY N/A.
- **Architectural question:** Is rovo-forge intentionally outside forge-lib's scope (external Rovo Studio configs), or should it be brought into compliance?

**Step 2: Record findings**

---

## Task 7: Cross-plugin consistency check

**Files:**
- Read: All 6 `plugin.json` files
- Read: All 6 `README.md` files
- Read: `forge-lib/schemas/*.json` (list all)
- Read: `forge-lib/templates/*.md.j2` (list all)
- Read: `forge-shell/app/js/*.js` (list all view controllers)
- Output: Cross-reference matrix

**Step 1: Launch sub-agent for cross-plugin analysis**

Check:
1. **plugin.json field consistency** — Do all have identical field structure?
2. **Command frontmatter consistency** — Do all commands use `description` and `argument-hint`?
3. **Skill frontmatter consistency** — Do all skills use `name`, `description`, and optionally `user_invocable`?
4. **Schema coverage** — Which entity types have schemas vs. which are missing?
5. **Template coverage** — Which entity types have templates vs. which are missing?
6. **forge-shell coverage** — Which plugins have view controllers vs. which are missing?
7. **README section coverage** — Compare README sections across plugins (which sections are present/absent per plugin?)
8. **CLI verb consistency** — Are forge-lib subcommands (`init`, `create`, `query`, `get`, `update`) used consistently across plugins?

**Step 2: Build cross-reference matrix**

---

## Task 8: Aggregate findings into standardization report

**Files:**
- Create: `docs/reports/2026-02-17-marketplace-standardization-audit.md`

**Step 1: Compile all sub-agent findings**

Structure the report:

```markdown
# Marketplace Standardization Audit Report
**Date:** 2026-02-17
**Scope:** 6 plugins × 12 compliance rules = 72 checks

## Executive Summary
- X of 72 checks PASS
- Y of 72 checks FAIL
- Z of 72 checks PARTIAL
- W of 72 checks N/A

## Compliance Heatmap

| Plugin | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|--------|----|----|----|----|----|----|----|----|----|----|-----|-----|
| product-forge | | | | | | | | | | | | |
| tasks-forge | | | | | | | | | | | | |
| forge-memory | | | | | | | | | | | | |
| cognitive-forge | | | | | | | | | | | | |
| report-forge | | | | | | | | | | | | |
| rovo-forge | | | | | | | | | | | | |

## Per-Plugin Findings
### product-forge
[12 rule verdicts with evidence]

### tasks-forge
[12 rule verdicts with evidence]

... (all 6 plugins)

## Cross-Plugin Consistency
[Matrix from Task 7]

## Remediation Roadmap
### Critical (R1 violations — forge-lib delegation)
1. forge-memory: Move /remember file creation to forge-lib
2. report-forge: Move synthesizer file writes to forge-lib
3. rovo-forge: Decide whether to integrate or exempt

### High (R2-R4 violations — index/schema/template gaps)
...

### Medium (R5-R12 inconsistencies)
...
```

**Step 2: Write the report**

Run: Write the aggregated markdown to `docs/reports/2026-02-17-marketplace-standardization-audit.md`

**Step 3: Commit**

```bash
git add docs/reports/2026-02-17-marketplace-standardization-audit.md docs/plans/2026-02-17-marketplace-standardization-audit.md
git commit -m "audit: marketplace standardization compliance report across 6 plugins"
```

---

## Execution Notes

**Parallelism:** Tasks 1-6 (per-plugin audits) can all run in parallel as independent sub-agents. Task 7 (cross-plugin) can also run in parallel with 1-6 since it reads different files. Task 8 (aggregation) must wait for Tasks 1-7 to complete.

**Sub-agent prompt template for Tasks 1-6:**

Each sub-agent receives:
1. The 12-rule compliance checklist (full text from Compliance Dimensions table)
2. The specific plugin directory to audit
3. Instructions to return structured verdicts: `{rule, verdict, evidence, remediation}`

**Expected deviations (pre-identified):**
- `forge-memory`: R1 FAIL (direct file I/O in remember), R2 FAIL (no index.json)
- `report-forge`: R1 PARTIAL (synthesizer agent writes directly)
- `rovo-forge`: R1/R2/R3/R4 FAIL (zero forge-lib integration)
