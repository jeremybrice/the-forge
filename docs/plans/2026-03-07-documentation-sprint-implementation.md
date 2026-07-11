# Documentation Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 4 cross-cutting reference docs (ARCHITECTURE.md, PATTERNS.md, DATA_FLOW.md, DECISION_LOG.md) and update CLAUDE.md pointers. Optimized for AI agent discoverability.

**Architecture:** Four standalone markdown files in `docs/`, each 70-160 lines, single-topic. Content synthesized from existing plugin READMEs, CLAUDE.md, forge-lib/README.md, and forge-shell docs. No new code — documentation only.

**Tech Stack:** Markdown, Mermaid diagrams

**Design Doc:** `docs/plans/2026-03-07-documentation-sprint-design.md`

---

### Task 1: Create `docs/ARCHITECTURE.md`

**Files:**
- Create: `docs/ARCHITECTURE.md`

**Source material to read first:**
- `CLAUDE.md` (lines 33-47 — Architecture section)
- `README.md` (lines 48-80 — Mermaid architecture diagram)
- `forge-lib/README.md` (lines 1-40 — architecture + directory structure)
- `forge-shell/README.md` (lines 1-50 — architecture description)
- `forge-shell/STYLE_GUIDE.md` (lines 1-30 — standardized patterns)
- `product-forge/README.md` (first 30 lines — plugin anatomy example)

**Step 1: Read all source material**

Read each file listed above. Extract:
- v2 design philosophy and why it exists
- Layer definitions (forge-lib, LLM commands, skills, forge-shell)
- Plugin directory structure conventions
- Validation and schema approach
- forge-shell architecture (ForgeFS, view controllers, PLUGINS array)

**Step 2: Write `docs/ARCHITECTURE.md`**

Target ~100 lines. Structure:

```markdown
# Architecture — The Forge Marketplace v2

## Design Philosophy

[2-3 paragraphs: v2 separation of concerns. forge-lib = deterministic data layer
(file ops, schemas, templates, validation). LLM = reasoning and conversation.
Why: v1 commands were 250-300 lines mixing both concerns, now 80-100 lines.]

## System Layers

| Layer | Technology | Responsibility | Example |
|-------|-----------|---------------|---------|
| forge-lib | Python CLI | File operations, JSON Schema validation, Jinja2 templates, index management | `forge card create --type story --title "..."` |
| Commands | Markdown (80-100 lines) | Conversational workflow, user interaction, orchestration | `product-forge/commands/create.md` |
| Skills | Markdown | Pure reasoning guidance — no file ops, schemas, or templates | `product-forge/skills/jira-sync/SKILL.md` |
| forge-shell | Tauri + JS | Desktop dashboards, direct FS scanning via ForgeFS | `forge-shell/app/js/product-forge.js` |

## Plugin Anatomy

Standard plugin directory structure:
[Show tree of a typical plugin: commands/, skills/, agents/, README.md]
[Explain: command delegates to forge-lib via subprocess → JSON output → LLM interprets]
[Explain: skills guide LLM reasoning without touching data]

## Validation & Schemas

[JSON Schema files in forge-lib/schemas/ — one per entity type]
[Jinja2 templates in forge-lib/templates/ — generate markdown content]
[index.json files — maintained automatically by forge-lib on create/update]

## forge-shell Architecture

[Tauri desktop app — NOT a plugin]
[ForgeFS utility in forge-shell/app/js/utils.js — direct FS scanning]
[View controller pattern — one JS file per plugin dashboard]
[PLUGINS array registration in forge-shell/app/js/app.js]
[Does NOT use index.json — parses markdown frontmatter directly]
```

**Step 3: Verify accuracy**

Run these checks against the written doc:
- Confirm forge-lib/schemas/ contains JSON schema files: `ls forge-lib/schemas/`
- Confirm forge-lib/templates/ contains Jinja2 templates: `ls forge-lib/templates/`
- Confirm ForgeFS is in utils.js: `grep "ForgeFS\|class ForgeFS" forge-shell/app/js/utils.js`
- Confirm PLUGINS array exists: `grep "PLUGINS" forge-shell/app/js/app.js`
- Confirm view controller files exist: `ls forge-shell/app/js/`

**Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add ARCHITECTURE.md — system layers, plugin anatomy, forge-shell"
```

---

### Task 2: Create `docs/PATTERNS.md`

**Files:**
- Create: `docs/PATTERNS.md`

**Source material to read first:**
- `product-forge/README.md` (agents section, command structure)
- `cognitive-forge/README.md` (agent recruitment logic, 5 agents)
- `report-forge/README.md` (orchestration pattern, multi-agent)
- `forge-lib/README.md` (CLI integration patterns, exit codes, JSON output)
- `tasks-forge/README.md` (agent-less architecture — contrast to orchestrator)
- `CLAUDE.md` (file naming patterns table, lines 49-60)

**Step 1: Read all source material**

Read each file. Extract:
- Which plugins use orchestrator pattern vs agent-less
- How commands delegate to forge-lib (subprocess call pattern)
- Skill vs command distinction
- Agent recruitment logic (cognitive-forge's approach)
- Index management: who writes, who reads, when to bypass

**Step 2: Write `docs/PATTERNS.md`**

Target ~130 lines. Structure:

```markdown
# Patterns — The Forge Marketplace v2

## Orchestrator Pattern

**Used by:** product-forge, report-forge, cognitive-forge

[How it works: LLM command orchestrates conversation flow, delegates all
persistence to forge-lib CLI. Command structure: gather input → call forge.py
→ interpret JSON → guide next step.]

**Anti-pattern:** Commands that do file I/O directly instead of through forge-lib.

## Agent-Less Pattern

**Used by:** tasks-forge
[How it works: single command handles full workflow without agent delegation.
Simpler, appropriate when workflow is linear.]

## Skill Design Pattern

[Skills = pure reasoning guidance. No file operations, no schemas, no templates.]
[When to create a skill: reusable reasoning across multiple commands]
[When to embed in command: one-time guidance specific to that workflow]
[File structure: SKILL.md with YAML frontmatter]

## Agent Recruitment Pattern

**Used by:** product-forge (6 agents), cognitive-forge (5 agents + recruitment)
[How agents are defined in agents/ directory]
[Selection: command chooses agent based on task type or user input]
[cognitive-forge's recruitment: dynamic selection from 5 specialists]

## forge-lib CLI Integration

[Subprocess call: `python forge.py <entity> <action> --flags`]
[JSON output on stdout, errors on stderr]
[Exit codes: 0 = success, 1 = validation error, 2 = not found]
[Example: creating a card]
```python
result = subprocess.run(
    ["python", "forge.py", "card", "create", "--type", "story", "--title", title],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
```

## Index Management

[Each entity type: index.json for fast queries]
[forge-lib maintains indexes automatically on create/update/delete]
[forge-shell bypasses indexes — direct FS scan via ForgeFS]
[Rule: use index for plugin queries, use ForgeFS for dashboard display]

## File Naming Conventions

[Reference CLAUDE.md File Naming Patterns table — do not duplicate]
[Frontmatter: YAML block at top of every .md entity file]
[Relationships: `forge relationship link --parent <path> --child <path>`]
```

**Step 3: Verify accuracy**

- Confirm product-forge has agents/: `ls product-forge/agents/`
- Confirm cognitive-forge has agents/: `ls cognitive-forge/agents/`
- Confirm tasks-forge does NOT have agents/: `ls tasks-forge/`
- Confirm forge-lib exit codes: `grep -n "sys.exit\|exit(" forge-lib/forge.py | head -10`
- Confirm skill file structure: `head -10 product-forge/skills/jira-sync/SKILL.md`

**Step 4: Commit**

```bash
git add docs/PATTERNS.md
git commit -m "docs: add PATTERNS.md — orchestrator, skill, agent, CLI integration patterns"
```

---

### Task 3: Create `docs/DATA_FLOW.md`

**Files:**
- Create: `docs/DATA_FLOW.md`

**Source material to read first:**
- `CLAUDE.md` (Plugins table — data locations, lines 22-31)
- `forge-shell/app/js/utils.js` (ForgeFS implementation)
- `forge-shell/app/js/card-data.js` (how forge-shell reads cards/)
- `forge-shell/app/js/product-forge.js` (view controller data loading)
- `forge-shell/app/js/tasks.js` (view controller data loading)
- `report-forge/README.md` (which data it aggregates)
- `forge-lib/schemas/` (list all schema files for contract reference)

**Step 1: Read all source material**

Read each file. Extract:
- Which directories each plugin writes to
- Which directories each plugin reads from
- How forge-shell loads data (ForgeFS patterns)
- Frontmatter keys that forge-shell parses
- Which index.json files exist and their consumers
- Relationship linkage mechanics

**Step 2: Write `docs/DATA_FLOW.md`**

Target ~140 lines. Structure:

```markdown
# Data Flow — The Forge Marketplace v2

## Data Ownership Map

| Directory | Writer | Readers | Index File |
|-----------|--------|---------|------------|
| `cards/` | product-forge (via forge-lib) | forge-shell, report-forge | `cards/index.json` |
| `tasks/` | tasks-forge (via forge-lib) | forge-shell, report-forge | `tasks/index.json` |
| `memory/` | forge-memory (via forge-lib) | forge-shell | None (CLAUDE.md) |
| `sessions/` | cognitive-forge (via forge-lib) | forge-shell, report-forge | `sessions/index.json` |
| `reports/` | report-forge (via forge-lib) | forge-shell | `reports/index.json` |
| `rovo-agents/` | rovo-forge (via forge-lib) | forge-shell | `rovo-agents/index.json` |

## Data Flow Diagram

```mermaid
[Mermaid flowchart: plugins → forge-lib CLI → filesystem directories → forge-shell]
[Show report-forge reading from cards/, tasks/, sessions/]
[Show all plugins routing through forge-lib]
```

## Shared Data Contracts

### cards/ (highest cross-plugin impact)

[Frontmatter keys parsed by forge-shell: title, type, status, jira_card, parent, children]
[Schema: forge-lib/schemas/initiative.json, epic.json, story.json, decision.json]
[Breaking change risks: adding/removing/renaming frontmatter keys affects forge-shell]

### tasks/

[Frontmatter keys: title, status, priority, assignee, story]
[Schema: forge-lib/schemas/task.json]

### sessions/

[Frontmatter keys: title, type, status, participants]
[Schema: forge-lib/schemas/session.json]

## forge-shell Data Loading

[CRITICAL: forge-shell does NOT use index.json]
[Scans directories via ForgeFS utility (forge-shell/app/js/utils.js)]
[Parses markdown frontmatter from .md files directly]
[Implication: index.json changes do NOT affect forge-shell displays]
[Implication: frontmatter key changes DO affect forge-shell — update view controllers]

## Relationship Graph

[Hierarchy: Initiative → Epic → Story (parent-child in cards/)]
[Cross-entity: Task → Story (task references a story)]
[Managed by: `forge relationship link --parent <path> --child <path>`]
[Storage: `parent` and `children` fields in frontmatter]
[Bidirectional: forge-lib updates both sides automatically]
```

**Step 3: Verify accuracy**

- Confirm all data directories exist: `ls -d cards/ tasks/ memory/ sessions/ reports/ rovo-agents/   2>/dev/null`
- Confirm index.json files: `find . -name "index.json" -not -path "*/node_modules/*" | sort`
- Confirm ForgeFS parses frontmatter: `grep -n "frontmatter\|parseFrontmatter\|parseMarkdown" forge-shell/app/js/utils.js | head -5`
- Confirm card-data.js reads specific frontmatter keys: `grep -n "status\|type\|title\|jira_card\|parent\|children" forge-shell/app/js/card-data.js | head -10`
- Confirm relationship link command exists: `grep -n "relationship" forge-lib/forge.py | head -5`

**Step 4: Commit**

```bash
git add docs/DATA_FLOW.md
git commit -m "docs: add DATA_FLOW.md — ownership map, shared contracts, forge-shell loading"
```

---

### Task 4: Create `docs/DECISION_LOG.md`

**Files:**
- Create: `docs/DECISION_LOG.md`

**Source material to read first:**
- All filenames in `docs/plans/` (already listed below)
- Read the first 5-10 lines of each design doc to extract a one-line summary and scope

**Step 1: Read design doc headers**

For each of the 33 existing design docs in `docs/plans/`, read the first 10 lines to extract:
- Title/topic
- Affected plugins (from scope, title, or content)
- One-line summary of the decision

**Step 2: Write `docs/DECISION_LOG.md`**

Target ~70 lines. Structure:

```markdown
# Decision Log — The Forge Marketplace v2

Index of design decisions. Each entry links to the full design doc in `docs/plans/`.

**Maintenance:** When creating a new design doc, add an entry here.

## March 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-03-07 | Documentation sprint — 4 cross-cutting reference docs | repo-wide | [link](plans/2026-03-07-documentation-sprint-design.md) |
| 2026-03-06 | Add jira_card attribute to Epics | product-forge, forge-lib | [link](plans/2026-03-06-epic-jira-card-attribute.md) |
| 2026-03-05 | Tasks search bugfixes | tasks-forge, forge-shell | [link](plans/2026-03-05-tasks-search-bugfixes.md) |
| 2026-03-04 | Tasks search frontend design | tasks-forge, forge-shell | [link](plans/2026-03-04-tasks-search-frontend-design.md) |
| 2026-03-04 | Tasks search backend design | tasks-forge, forge-lib | [link](plans/2026-03-04-tasks-search-design.md) |
| 2026-03-03 | Copilot forge plugin design | copilot-forge | [link](plans/2026-03-03-copilot-forge-design.md) |
| 2026-03-03 | Forge shell sidebar scroll/filter fix | forge-shell | [link](plans/2026-03-03-forge-shell-sidebar-scroll-filter-fix.md) |

## February 2026

| Date | Decision | Scope | Design Doc |
|------|----------|-------|------------|
| 2026-02-28 | PR #14 code review fixes | repo-wide | [link](plans/2026-02-28-pr14-cr-fixes.md) |
| 2026-02-27 | Living memory documentation | forge-memory | [link](plans/2026-02-27-living-memory-documentation-design.md) |
| 2026-02-26 | Living memory system design | forge-memory | [link](plans/2026-02-26-living-memory-system-design.md) |
| 2026-02-26 | Option D hybrid decay reference | forge-memory | [link](plans/2026-02-26-option-d-hybrid-decay-reference.md) |
| 2026-02-22 | README rebrand | repo-wide | [link](plans/2026-02-22-readme-rebrand-design.md) |
| 2026-02-22 | Tasks page toolbar refinements | forge-shell | [link](plans/2026-02-22-tasks-page-toolbar-refinements-design.md) |
| 2026-02-19 | Jira transcript cleanup | product-forge | [link](plans/2026-02-19-jira-transcript-cleanup-design.md) |
| 2026-02-17 | Marketplace standardization audit | repo-wide | [link](plans/2026-02-17-marketplace-standardization-audit.md) |
| 2026-02-17 | Product forge restructuring | product-forge | [link](plans/2026-02-17-product-forge-restructuring-design.md) |
```

Note: Implementation docs (e.g., `*-implementation.md`, `*-fixes.md`) are grouped with their parent design doc rather than listed separately, unless they represent a standalone decision.

**Step 3: Verify accuracy**

- Confirm all linked files exist: `ls docs/plans/2026-03-06-epic-jira-card-attribute.md` (spot check 3-4 links)
- Confirm relative links resolve correctly from `docs/` directory

**Step 4: Commit**

```bash
git add docs/DECISION_LOG.md
git commit -m "docs: add DECISION_LOG.md — indexed reference to 33 design docs"
```

---

### Task 5: Update CLAUDE.md Documentation section

**Files:**
- Modify: `CLAUDE.md:90-94` (Documentation section)

**Step 1: Add pointer lines**

Add 4 lines to the existing Documentation section:

```markdown
## Documentation

- `README.md` — Architecture overview, installation, verification plan
- `forge-lib/README.md` — CLI reference, usage patterns, examples
- `{plugin}/README.md` — Plugin-specific workflows and command details
- `docs/ARCHITECTURE.md` — System architecture, layer separation, plugin anatomy
- `docs/PATTERNS.md` — Recurring implementation patterns and conventions
- `docs/DATA_FLOW.md` — Inter-plugin data flow and shared data contracts
- `docs/DECISION_LOG.md` — Indexed design decisions with links to design docs
```

**Step 2: Verify the edit**

- Confirm CLAUDE.md is still ~102 lines (was 98, added 4)
- Confirm no other sections were affected

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add cross-cutting doc pointers to CLAUDE.md Documentation section"
```

---

### Task 6: Final accuracy verification

**Files:**
- Read: all 4 new docs + CLAUDE.md

**Step 1: Cross-reference verification**

For each new doc, verify 3 claims against the actual codebase:

ARCHITECTURE.md:
- Verify command line count claim (~80-100 lines): `wc -l product-forge/commands/create.md`
- Verify ForgeFS location: `grep -n "ForgeFS" forge-shell/app/js/utils.js`
- Verify schema directory: `ls forge-lib/schemas/`

PATTERNS.md:
- Verify orchestrator plugins have agents/: `ls product-forge/agents/ cognitive-forge/agents/ report-forge/agents/ 2>/dev/null`
- Verify tasks-forge is agent-less: `ls tasks-forge/` (no agents/ dir)
- Verify skill structure: `head -5 product-forge/skills/jira-sync/SKILL.md`

DATA_FLOW.md:
- Verify data directories exist: `ls -d cards/ tasks/ memory/ sessions/ reports/`
- Verify forge-shell does NOT import index.json: `grep -rn "index.json" forge-shell/app/js/ | head -5`
- Verify frontmatter parsing: `grep -n "frontmatter" forge-shell/app/js/utils.js`

DECISION_LOG.md:

**Step 2: Success criteria check**

Verify each criterion from the design doc:
1. Can an agent find which plugins consume cards/index.json? → Search DATA_FLOW.md
2. Can an agent identify the orchestrator pattern? → Search PATTERNS.md
3. Can an agent find the decay algorithm design doc? → Search DECISION_LOG.md
4. Are claims verified? → Step 1 above

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A docs/ARCHITECTURE.md docs/PATTERNS.md docs/DATA_FLOW.md docs/DECISION_LOG.md
git commit -m "docs: accuracy fixes from final verification pass"
```
