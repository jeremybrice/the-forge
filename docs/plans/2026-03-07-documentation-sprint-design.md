# Documentation Sprint — Design Doc

**Date:** 2026-03-07
**Status:** Draft
**Scope:** repo-wide
**Playbook:** doc-sprint

## Problem

Cross-cutting knowledge — architecture, patterns, data flow, and inter-plugin relationships — is scattered across individual plugin READMEs or exists only as implicit convention. An AI agent modifying one plugin cannot easily determine what it might break in another, which patterns to follow, or where historical decisions are documented.

Plugin-local documentation is strong (8 READMEs, 150-360 lines each). The gap is the connective tissue between them.

## Audience

Primary: AI agents (Claude Code sessions). Documentation should be optimized for:
- **Discoverability** — findable via Grep/Glob by obvious filenames and keywords
- **Conciseness** — dense reference, not narrative prose; each file loadable in full without context pressure
- **Actionability** — answers "what will I break?" and "what pattern should I follow?"

## Approach

Four standalone documents in `docs/`, each 70-160 lines, single-topic. CLAUDE.md updated with 4 pointer lines.

Approach chosen over:
- Single unified reference (too large for focused agent queries)
- Plugin-local additions (cross-cutting knowledge doesn't belong to any single plugin)

## Deliverables

### 1. `docs/ARCHITECTURE.md` (~100 lines)

System architecture reference covering:

- **Design Philosophy** — v2 separation of concerns: forge-lib (deterministic data) vs LLM (reasoning). Why this split exists (v1 commands were 250-300 lines mixing both concerns).
- **System Layers** — forge-lib (Python CLI), LLM Commands (80-100 lines), Skills (pure reasoning), forge-shell (Tauri desktop, direct FS scanning).
- **Plugin Anatomy** — Standard structure: commands/, skills/, agents/, README.md. How a command delegates to forge-lib via subprocess call. How skills guide reasoning without touching data.
- **Validation & Schemas** — JSON Schema validation (forge-lib/schemas/), Jinja2 templates (forge-lib/templates/), index.json as query layer.
- **forge-shell Architecture** — Tauri app, ForgeFS utility, view controller pattern, PLUGINS array registration.

Source material: CLAUDE.md (14 lines), README.md (mermaid diagram), plugin READMEs (architecture sections), forge-shell/README.md, forge-shell/STYLE_GUIDE.md.

### 2. `docs/PATTERNS.md` (~130 lines)

Recurring implementation patterns. Each pattern documented as: what it is, which plugins use it, how it works, anti-patterns to avoid.

- **Orchestrator Pattern** — Used by product-forge, report-forge, cognitive-forge. LLM command orchestrates conversation, delegates persistence to forge-lib CLI.
- **Skill Design Pattern** — Skills = pure reasoning guidance (no file operations, schemas, or templates). When to create a skill vs embed guidance in a command.
- **Agent Recruitment Pattern** — Used by product-forge (6 agents), cognitive-forge (5 agents + recruitment logic). How agents are defined and selected.
- **forge-lib CLI Integration Pattern** — Subprocess call pattern, JSON output parsing, exit codes, error handling. Example: creating a card, querying an index.
- **Index Management Pattern** — Each entity type has index.json for fast queries. forge-lib maintains indexes automatically. forge-shell bypasses indexes (direct FS scan). When to use each.
- **File Naming Conventions** — Reference to CLAUDE.md patterns table. Frontmatter requirements per entity type. Relationship linking via `forge relationship link`.

Source material: Plugin READMEs (command/skill/agent sections), forge-lib/README.md (CLI patterns), CLAUDE.md (file naming table).

### 3. `docs/DATA_FLOW.md` (~140 lines)

Inter-plugin data flow and shared data contracts. Answers: "How does data move?" and "What will I break?"

- **Data Ownership Map** — Table: directory | writer plugin | reader plugins. Covers all 8 plugin data directories.
- **Data Flow Diagram** — Mermaid diagram showing: plugin → data directory → consuming plugins. All plugins route through forge-lib CLI to filesystem.
- **Shared Data Contracts** — Per-directory section documenting: schema shape, who writes, who reads, breaking change risks. Priority directories: cards/, tasks/, sessions/ (read by multiple plugins).
- **forge-shell Data Loading** — Does NOT use index.json. Scans directories via ForgeFS, parses markdown frontmatter directly. Implication: frontmatter key changes affect forge-shell even if index.json is unchanged.
- **Relationship Graph** — Bidirectional parent-child links via `forge relationship link`. Initiative → Epic → Story hierarchy. Task → Story linkage.

Source material: Plugin READMEs (data location sections), CLAUDE.md (data location table), forge-shell/app/js/utils.js (ForgeFS), forge-shell/app/js/card-data.js.

### 4. `docs/DECISION_LOG.md` (~70 lines)

Indexed reference to the 33 existing design docs in `docs/plans/`.

- **Format** — Reverse chronological table: date | one-line decision summary | affected plugins | link to design doc.
- **Grouped by month** — March 2026, February 2026.
- **Maintenance note** — When creating a new design doc, add an entry here.

Source material: All files in docs/plans/.

### 5. CLAUDE.md Update (4 lines added)

Add pointers to the Documentation section:

```markdown
- `docs/ARCHITECTURE.md` — System architecture, layer separation, plugin anatomy
- `docs/PATTERNS.md` — Recurring implementation patterns and conventions
- `docs/DATA_FLOW.md` — Inter-plugin data flow and shared data contracts
- `docs/DECISION_LOG.md` — Indexed design decisions with links to design docs
```

CLAUDE.md grows from 98 to ~102 lines.

## Doc-Sprint Team Mapping

| Role | Responsibility |
|------|---------------|
| **Lead** | Plans doc structure, assigns sections, ensures cross-doc consistency |
| **Writer** | Produces the 4 markdown documents |
| **Code Reader** | Reads actual implementations to provide ground truth for each section |
| **Accuracy Checker** | Verifies every claim in the docs against the codebase |

Guardians enabled: **spec** (docs match design), **convention** (naming patterns, file placement).

## Out of Scope

- Rewriting existing plugin READMEs (already comprehensive)
- Adding migration guides (medium priority, separate effort)
- Formalizing Living Memory algorithm spec (medium priority, separate effort)
- Creating unified TESTING.md (low priority)
- Restructuring CLAUDE.md beyond adding pointers (not needed — only 98 lines)

## Success Criteria

1. An agent can determine which plugins consume `cards/index.json` without reading plugin source code
2. An agent can identify the orchestrator pattern and apply it when modifying a command
3. An agent can find the design doc that explains why forge-memory uses a decay algorithm
4. All claims in the new docs are verified against the actual codebase by the accuracy checker
