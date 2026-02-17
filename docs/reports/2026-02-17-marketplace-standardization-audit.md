# Marketplace Standardization Audit Report

**Date:** 2026-02-17
**Scope:** 6 plugins x 12 compliance rules = 72 checks
**Branch:** front-end
**Methodology:** Independent sub-agent per plugin auditing against 12 forge-lib compliance rules, plus cross-plugin consistency analysis.

---

## Executive Summary

- **42 of 72 checks PASS** (58%)
- **13 of 72 checks FAIL** (18%)
- **15 of 72 checks PARTIAL** (21%)
- **2 of 72 checks N/A** (3%)

The marketplace has a clear compliance gradient. Product-forge and cognitive-forge (the first v2 plugins) demonstrate strong forge-lib integration. Report-forge and tasks-forge are solid but have specific architectural leaks. Forge-memory and rovo-forge have fundamental compliance gaps requiring significant remediation.

Three systemic issues affect all or most plugins:
1. **Error handling (R11)** is universally weak — no plugin properly checks `{success, error}` responses from forge-lib
2. **JSON response parsing (R10)** is universally partial — commands assume happy-path responses
3. **forge-shell view controllers** all use direct FS scanning instead of `index.json` (confirmed as intentional refactor in commit `da5080c`)

---

## Compliance Heatmap

| Plugin | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:---:|:---:|:---:|
| product-forge | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | PASS |
| tasks-forge | PASS | FAIL | PASS | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL |
| forge-memory | PARTIAL | FAIL | FAIL | FAIL | PASS | PARTIAL | PASS | PASS | PASS | PARTIAL | FAIL | PASS |
| cognitive-forge | PASS | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | FAIL | PASS |
| report-forge | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | PASS |
| rovo-forge | FAIL | FAIL | FAIL | FAIL | PASS | FAIL | PARTIAL | PASS | PASS | N/A | N/A | PASS |

### Legend
- **PASS** — Fully compliant
- **PARTIAL** — Partially compliant with specific gaps
- **FAIL** — Non-compliant
- **N/A** — Rule does not apply (no forge-lib calls to parse/handle)

---

## Per-Plugin Findings

### product-forge

**Score: 9 PASS / 0 FAIL / 3 PARTIAL**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | PARTIAL | `/init` command uses raw `mkdir -p` and `echo` instead of `forge card init`. All other 10 commands properly delegate to forge-lib. |
| R2 | PASS | All queries go through `forge card query` which reads from `index.json` internally. |
| R3 | PASS | All 7 card types have JSON schemas in `forge-lib/schemas/`. |
| R4 | PASS | All 7 card types have Jinja2 templates in `forge-lib/templates/`. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | PASS | All 11 commands have YAML frontmatter with `description` and workflow phases. |
| R7 | PASS | All 3 skills are reasoning-only with proper frontmatter. |
| R8 | PASS | README covers all required sections: overview, commands, skills, forge-lib usage, data directory, verification. |
| R9 | PASS | All naming patterns match CLAUDE.md specifications. |
| R10 | PARTIAL | Commands reference forge-lib responses but never show explicit `{success, data, error}` envelope parsing. |
| R11 | PARTIAL | Jira commands have error handling. Core card commands (initiative, epic, story, intake, decision, checkpoint) lack error handling for forge-lib failures. |
| R12 | PASS | View controller exists. Uses `scanCardsDir()` (direct FS scanning) rather than `index.json` — consistent with forge-shell refactor. |

**Remediation:**
1. Replace `/init` command's `mkdir -p` / `echo` with `forge card init` CLI call
2. Add explicit JSON response parsing instructions to all commands
3. Add error handling for forge-lib failures to core card commands

---

### tasks-forge

**Score: 7 PASS / 1 FAIL / 4 PARTIAL**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | PASS | All 3 commands delegate to `forge task` CLI. No direct file I/O. |
| R2 | FAIL | forge-shell view controller (`tasks.js:241`) explicitly replaced `index.json` lookup with `ForgeFS.readDir()` directory scanning. Comment: "replacing the old index.json lookup." |
| R3 | PASS | `forge-lib/schemas/task.json` exists with proper validation. |
| R4 | PASS | `forge-lib/templates/task.md.j2` exists. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | PASS | All 3 commands have YAML frontmatter and delegate to forge-lib. |
| R7 | PASS | Skill is reasoning-only with explicit disclaimer: "This skill provides reasoning only." |
| R8 | PARTIAL | Comprehensive README but missing a dedicated "Verification" section. |
| R9 | PARTIAL | **Naming pattern mismatch:** forge-shell regex expects `task-NNN-{slug}.md` but forge-lib CLI creates `task-NNN.md`. Tasks created by CLI will NOT appear in forge-shell UI. |
| R10 | PASS | Commands explicitly document JSON response structure with `{success, data}`. |
| R11 | PARTIAL | Commands handle workflow-level errors but don't explicitly check `success` field from forge-lib responses. |
| R12 | PARTIAL | View controller exists and is full-featured, but uses direct FS scanning instead of `index.json`. |

**Remediation:**
1. **Critical:** Align file naming pattern — either update forge-shell regex to match `task-NNN.md` or update forge-lib to generate `task-NNN-{slug}.md`
2. Add verification section to README
3. Add explicit `success` field checking to commands

---

### forge-memory

**Score: 5 PASS / 5 FAIL / 2 PARTIAL**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | PARTIAL | **Architectural split.** Taxonomy operations (`forge memory init/get-taxonomy/set-taxonomy`) properly delegate to forge-lib. Knowledge operations (`remember.md`) create files directly — acknowledged at line 87: "Creates markdown files directly (not via forge-lib in v2.0.0)." |
| R2 | FAIL | No `memory/index.json` exists. Taxonomy uses YAML frontmatter in context files. Knowledge uses direct directory scanning. |
| R3 | FAIL | No `forge-lib/schemas/memory.json` or related schema exists. |
| R4 | FAIL | No memory-related Jinja2 templates exist. `memory_ops.py` uses inline Python string stubs. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | PARTIAL | All commands have frontmatter with `description`, but `remember.md` and `recall.md` (Tiers 2-4) don't delegate to forge-lib. |
| R7 | PASS | Both skills are reasoning-only with explicit disclaimers. |
| R8 | PASS | README covers all required sections including verification steps. |
| R9 | PASS | File naming conventions are documented and consistent. |
| R10 | PARTIAL | forge-lib returns `{success, data, error}` for memory operations, but no command explicitly parses this structure. |
| R11 | FAIL | No command includes instructions for checking `success` field or presenting forge-lib errors. |
| R12 | PASS | View controller exists (`memory.js`, 912 lines). Reads files directly via `ForgeFS`. |

**Remediation:**
1. **Major:** Extend `memory_ops.py` with knowledge entry CRUD (`create-person`, `create-project`, `add-glossary-term`, `search-knowledge`)
2. Create `forge-lib/schemas/memory.json` (or per-type schemas)
3. Create Jinja2 templates for people, projects, glossary entries
4. Add `memory/index.json` maintained by forge-lib
5. Update `remember.md` and `recall.md` to delegate all operations to forge-lib
6. Add error handling to all commands

---

### cognitive-forge

**Score: 9 PASS / 1 FAIL / 2 PARTIAL**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | PASS | Commands use `forge session create`. All 5 agents declare only read-only tools (Read, Grep, Glob). `forge-evaluator` adds WebSearch/WebFetch (read-only). No agent has Write, Bash, or Edit. |
| R2 | PARTIAL | Commands don't directly reference `sessions/index.json`. forge-lib manages index updates behind the scenes. forge-shell view controller infers session type from directory names "rather than from an index.json entry." |
| R3 | PASS | `forge-lib/schemas/session.json` exists with proper validation. |
| R4 | PASS | `forge-lib/templates/session.md.j2` exists with conditional rendering. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | PASS | Both commands have YAML frontmatter, orchestrate agents, and delegate persistence to forge-lib. |
| R7 | PASS | Skill is purely reasoning-oriented with no file operations. |
| R8 | PASS | README covers all required sections including agents documentation. |
| R9 | PASS | Sessions use `YYYY-MM-DD-{slug}.md` pattern matching CLAUDE.md. |
| R10 | PARTIAL | Commands mention "file path from JSON response" but don't show explicit parsing of `{success, data, error}` envelope. |
| R11 | FAIL | Neither command contains any instructions for handling forge-lib CLI errors. No error path exists for failed `forge session create`. |
| R12 | PASS | View controller exists (`cognitive-forge.js`, 490 lines). Uses direct FS scanning. |

**Remediation:**
1. Add error handling to both commands for `forge session create` failures
2. Add explicit JSON response parsing examples

---

### report-forge

**Score: 8 PASS / 0 FAIL / 3 PARTIAL**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | PARTIAL | Commands properly delegate to `forge report create/update/query/get`. **However**, the `forge-synthesizer` agent declares `Write` in its tools list (line 6) and is instructed to write report files directly to `reports/{report_type}s/`. This creates a contradictory workflow — the agent writes the file, then the command also calls `forge report create`. |
| R2 | PASS | Commands use `forge report query` which operates against `index.json`. |
| R3 | PASS | `forge-lib/schemas/report.json` exists. |
| R4 | PASS | `forge-lib/templates/report.md.j2` exists. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | PASS | All 3 commands have YAML frontmatter and delegate to forge-lib. |
| R7 | PASS | Skill is purely reasoning guidance. |
| R8 | PASS | README covers all required sections including agents documentation. |
| R9 | PASS | Reports use `YYYY-MM-DD-{slug}.md` pattern. |
| R10 | PARTIAL | `list.md` shows explicit `{success, data}` response structure. `generate.md` and `update.md` do not. |
| R11 | PARTIAL | `list.md` and `update.md` have error handling. `generate.md` has none for `forge report create` failures. |
| R12 | PASS | View controller exists (`report-forge.js`, 771 lines). |

**Remediation:**
1. **Critical:** Remove `Write` from `forge-synthesizer` agent's tools list. Remove direct-write instructions. Agent should return report content; `generate.md` command handles persistence via `forge report create`.
2. Add error handling to `generate.md`
3. Add explicit JSON response parsing to `generate.md` and `update.md`

---

### rovo-forge

**Score: 4 PASS / 5 FAIL / 1 PARTIAL / 2 N/A**

| Rule | Verdict | Finding |
|------|---------|---------|
| R1 | FAIL | Zero forge-lib CLI calls. Both commands create `rovo-agents/{slug}/agent.md` directly via Phase 11 file writes. |
| R2 | FAIL | No `rovo-agents/index.json` exists. forge-shell view controller confirms: "no index.json required." |
| R3 | FAIL | No `forge-lib/schemas/agent.json` exists. |
| R4 | FAIL | No `forge-lib/templates/agent.md.j2` exists. Inline template duplicated across both command files. |
| R5 | PASS | `plugin.json` has all 4 required fields. |
| R6 | FAIL | Neither command has YAML frontmatter. Both start directly with `# /rovo-{type}` heading. |
| R7 | PARTIAL | All 3 skills are reasoning-only (correct), but none have YAML frontmatter (missing `name`, `description`). |
| R8 | PASS | README is comprehensive with all required sections. |
| R9 | PASS | Files follow `{slug}/agent.md` pattern matching CLAUDE.md. |
| R10 | N/A | No forge-lib calls means no JSON responses to parse. |
| R11 | N/A | No forge-lib calls means no errors to handle. |
| R12 | PASS | View controller exists (`rovo-agent-forge.js`, 849 lines). Naming uses old plugin name. |

**Architectural Note:** The README claims rovo-forge needed "ZERO architectural changes" because commands are "pure conversational workflows" with "no file operations." This is **factually stale** — Phase 11 in both commands creates directories, generates YAML frontmatter, and writes markdown files. Rovo-forge has become a data-producing plugin without the corresponding data layer infrastructure.

**Remediation:**
1. **Major:** Create `forge agent` subcommand in forge-lib with `create`, `update`, `query`, `get`
2. Create `forge-lib/schemas/agent.json`
3. Create `forge-lib/templates/agent.md.j2`
4. Add `rovo-agents/index.json` support
5. Add YAML frontmatter to both commands and all 3 skills
6. Update both commands to delegate Phase 11 to forge-lib
7. Update forge-shell view controller to use `index.json`

---

## Cross-Plugin Consistency

### plugin.json Field Consistency
All 6 plugins use identical structure: `name`, `version` (`2.0.0-alpha`), `description`, `author.name` (`Jeremy Brice`). No variations.

### Command Frontmatter Consistency

| Issue | Affected | Recommendation |
|-------|----------|----------------|
| rovo-forge commands have NO frontmatter | 2 commands | Add YAML frontmatter with `description` |
| `name` field used inconsistently | 6/25 commands have it | Standardize: either all commands use `name` or none do |
| `arguments` field used by only 2 plugins | product-forge (3), report-forge (3) | Consider adding to all commands that accept parameters |
| `argument-hint` used by 1 command total | tasks-forge `update.md` only | Either adopt across marketplace or remove |

### Skill Frontmatter Consistency

| Issue | Affected | Recommendation |
|-------|----------|----------------|
| rovo-forge skills have NO frontmatter | 3 skills | Add `name` and `description` frontmatter |
| `user_invocable` used by only 2 skills | product-forge/jira-sync, cognitive-forge/cognitive-techniques | Consider standardizing which skills should be non-invocable |

### Schema and Template Coverage

| Entity Type | Schema | Template | Plugin |
|------------|:------:|:--------:|--------|
| initiative | Yes | Yes | product-forge |
| epic | Yes | Yes | product-forge |
| story | Yes | Yes | product-forge |
| intake | Yes | Yes | product-forge |
| checkpoint | Yes | Yes | product-forge |
| decision | Yes | Yes | product-forge |
| release-note | Yes | Yes | product-forge |
| task | Yes | Yes | tasks-forge |
| session | Yes | Yes | cognitive-forge |
| report | Yes | Yes | report-forge |
| **memory** | **No** | **No** | forge-memory |
| **agent** | **No** | **No** | rovo-forge |

10 entity types have both schema and template. 2 entity types (memory, agent) have neither.

### forge-shell View Controller Coverage

All 6 plugins have view controllers. **All use direct FS scanning** instead of `index.json` (confirmed by commit `da5080c`: "Refactor forge-shell to use direct FS scanning instead of index.json"). This is a documented architectural deviation from CLAUDE.md.

Additional view controllers: `roadmap.js` (cross-plugin timeline), `productivity.js` (cross-plugin dashboard).

Naming note: rovo-forge's view controller is `rovo-agent-forge.js` (old plugin name), not `rovo-forge.js`.

### CLI Verb Consistency

| Verb | product | tasks | memory | cognitive | report | rovo |
|------|:-------:|:-----:|:------:|:---------:|:------:|:----:|
| `init` | raw shell | Yes | Yes | -- | Yes (README) | -- |
| `create` | Yes | Yes | -- | Yes | Yes | -- |
| `query` | Yes | Yes | -- | -- | Yes | -- |
| `get` | Yes | Yes | -- | -- | Yes | -- |
| `update` | Yes | Yes | -- | -- | Yes | -- |
| `relationship link` | Yes | -- | -- | -- | -- | -- |

product-forge uses the broadest verb set. cognitive-forge uses only `create`. forge-memory and rovo-forge use no standard CRUD verbs.

---

## Remediation Roadmap

### Critical (Architectural Violations)

| # | Plugin | Issue | Effort |
|---|--------|-------|--------|
| C1 | **rovo-forge** | Zero forge-lib integration. Create `forge agent` subcommand + schema + template + index.json. Update both commands to delegate Phase 11. | High |
| C2 | **forge-memory** | Knowledge operations bypass forge-lib. Extend `memory_ops.py` with knowledge CRUD. Add schema, templates, index.json. | High |
| C3 | **report-forge** | `forge-synthesizer` agent has Write tool, bypasses forge-lib. Remove Write, make agent return content to command. | Low |
| C4 | **tasks-forge** | File naming mismatch: forge-shell expects `task-NNN-{slug}.md`, CLI creates `task-NNN.md`. Tasks created by CLI invisible in UI. | Medium |

### High (Systemic Gaps)

| # | Plugin | Issue | Effort |
|---|--------|-------|--------|
| H1 | **All 6** | R11 Error Handling: No plugin properly checks `{success, error}` from forge-lib responses. | Medium |
| H2 | **All 6** | R10 JSON Parsing: Commands assume happy-path responses without showing `{success, data, error}` envelope parsing. | Low |
| H3 | **rovo-forge** | No YAML frontmatter on commands or skills. | Low |
| H4 | **product-forge** | `/init` command uses raw `mkdir`/`echo` instead of `forge card init`. | Low |

### Medium (Consistency Issues)

| # | Plugin | Issue | Effort |
|---|--------|-------|--------|
| M1 | **CLAUDE.md** | forge-shell architecture documentation claims `index.json` usage, but all view controllers use direct FS scanning since commit `da5080c`. Documentation should reflect actual architecture. | Low |
| M2 | **Cross-plugin** | Command frontmatter fields (`name`, `arguments`, `argument-hint`) used inconsistently. Standardize or deprecate. | Low |
| M3 | **Cross-plugin** | README sections (Verification, Dependencies, License) present in some plugins but not others. Standardize template. | Low |
| M4 | **rovo-forge** | View controller named `rovo-agent-forge.js` (old name) instead of `rovo-forge.js`. | Low |

### Low (Documentation)

| # | Plugin | Issue | Effort |
|---|--------|-------|--------|
| L1 | **tasks-forge** | README missing Verification section. | Low |
| L2 | **cognitive-forge** | Commands mention "file path from JSON response" without showing actual parsing. | Low |

---

## Appendix: Rule Definitions

| # | Rule | Source of Truth |
|---|------|----------------|
| R1 | forge-lib CLI Delegation — All file CRUD through `forge` CLI | CLAUDE.md v2 architecture |
| R2 | index.json Usage — Fast queries via index, no directory scanning | CLAUDE.md performance rule |
| R3 | Schema Validation — Entity types have JSON schemas | `forge-lib/schemas/*.json` |
| R4 | Template Usage — Content via Jinja2 templates | `forge-lib/templates/*.md.j2` |
| R5 | plugin.json Structure — Required fields: name, version, description, author | Existing plugin.json files |
| R6 | Command Structure — YAML frontmatter + workflow phases + forge-lib delegation | Cross-plugin pattern |
| R7 | Skill Structure — Reasoning-only, no file ops, YAML frontmatter | CLAUDE.md v2 architecture |
| R8 | README Coverage — Overview, commands, skills, forge-lib, data dir, verification | Existing READMEs |
| R9 | File Naming Patterns — Per-entity naming conventions | CLAUDE.md naming table |
| R10 | JSON Response Parsing — Parse `{success, data, error}` from forge-lib | forge-lib `output_json()` |
| R11 | Error Handling — Check `success` field, present `error` message | forge-lib error contract |
| R12 | forge-shell View Controller — View controller reads from `index.json` | forge-shell architecture |
