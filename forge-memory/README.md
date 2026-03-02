# Forge Memory

Organizational memory and taxonomy management for The Forge Marketplace. Enables Claude to decode workplace shorthand, resolve internal language, and maintain validated taxonomy across all plugins.

## Overview

Forge Memory transforms Claude into a workplace collaborator who speaks your internal language:

```
User: "ask todd about PSR for acme"
              ↓ Claude decodes
"Ask Todd Martinez (Finance lead) to prepare the Pipeline Status Report
 for Acme Corp (enterprise tier, 500+ users)"
```

The plugin manages:
- **Taxonomy** (products, modules, systems, clients, teams, integrations) via forge-lib
- **Knowledge** (people, projects, glossary terms, preferences) via markdown files
- **Tiered lookup** (fast taxonomy queries → detailed knowledge files)

## Architecture

### V2.0.0 Changes

**What's New:**
- Taxonomy operations delegated to `forge-lib` via `forge memory` CLI
- Commands simplified from 150-290 lines to 92-201 lines
- Skills streamlined to reasoning-only (removed file format details)
- Clear separation: taxonomy (forge-lib) vs knowledge (markdown files)

**What Stayed:**
- Tiered lookup strategy (fast → detailed)
- Conversational interview workflows
- Knowledge file structure (people/, projects/, glossary.md)

### Taxonomy vs Knowledge

| Type | Managed By | Storage | Query Method |
|------|-----------|---------|--------------|
| **Taxonomy** | forge-lib | memory/context/*.md YAML | `forge memory get-taxonomy` |
| **Knowledge** | Direct files | memory/people/, projects/, glossary.md | File reads |

**Taxonomy** (6 types): Products, modules, systems, clients, teams, integrations
**Knowledge** (4 types): People, projects, terms, preferences

## Commands

### `/memory:start`
Initialize the organizational memory system.

**What it does:**
- Creates `memory/` directory structure via `forge memory init`
- Optionally bootstraps taxonomy through conversational interview
- Sets up context files (products, clients, teams, integrations)

**Example:**
```
/memory:start

> I'm setting up your organizational memory. Let's start with some basics:
> 1. What are the main products or projects you work on?
> 2. Who are your primary clients?
> ...
```

**Delegates to forge-lib:**
- `forge memory init --directory .`
- `forge memory set-taxonomy [type] --add "..."`

---

### `/memory:setup-org`
Configure organizational taxonomy through interactive interview.

**What it does:**
- Loads current taxonomy via `forge memory get-taxonomy`
- Interviews user about products, modules, systems, clients, teams, integrations
- Saves entries via `forge memory set-taxonomy`

**Example:**
```
/memory:setup-org

> I found existing taxonomy. Current products: [list]
> What would you like to add or update?
```

**Delegates to forge-lib:**
- `forge memory get-taxonomy [type]` (reads)
- `forge memory set-taxonomy [type] --add "..."` (writes)

---

### `/memory:remember`
Store knowledge entries (people, terms, projects, preferences).

**What it does:**
- Asks what to remember
- Gathers details conversationally
- Creates markdown files in memory/ directory

**Example:**
```
/memory:remember

> What would you like me to remember?

User: "Todd is our finance lead"

> Tell me about Todd:
> - Full name
> - Role or title
> - Team
> ...

> Remembered: Todd Martinez, Finance Lead
> Added to: memory/people/todd-martinez.md
```

**Note:** Knowledge operations (people, projects, terms) create markdown files directly in v2.0.0.

---

### `/memory:recall`
Query memory using tiered lookup strategy.

**What it does:**
- Tier 1: Query taxonomy via forge-lib (fast)
- Tier 2: Search glossary.md for terms
- Tier 3: Search people/, projects/ directories
- Tier 4: Ask user if not found

**Example:**
```
/memory:recall

> What would you like to recall?

User: "What products do we have?"

> Products:
> - WebApp (Core SaaS platform)
> - MobileApp (Field operations app)
> - API Platform (Developer tools)
>
> Managed via: forge-lib
```

**Delegates to forge-lib:**
- `forge memory get-taxonomy [type]` (for taxonomy queries)
- Direct file reads for knowledge queries

## Skills

### memory-management
Tiered memory lookup strategy for decoding workplace shorthand.

**Provides:**
- 4-tier lookup flow (taxonomy → glossary → deep memory → ask user)
- Fuzzy matching and cross-reference reasoning
- Progressive disclosure principles

**Key concept:** Start with fast lookups (taxonomy), expand to detailed files only when needed.

---

### org-context
Organizational taxonomy resolution and validation.

**Provides:**
- Taxonomy query patterns via forge-lib
- Shorthand resolution strategy
- Validation and suggestion workflows
- Missing taxonomy handling

**Key concept:** Accept freeform values, offer to add to taxonomy, grow organically.

## Directory Structure

```
forge-memory/
├── commands/
│   ├── start.md              (92 lines)
│   ├── setup-org.md          (201 lines)
│   ├── remember.md           (102 lines)
│   └── recall.md             (155 lines)
├── skills/
│   ├── memory-management/
│   │   └── SKILL.md          (178 lines)
│   └── org-context/
│       └── SKILL.md          (169 lines)
├── plugin.json
└── README.md

Generated memory/ structure (in working directory):
memory/
├── context/
│   ├── products.md           (YAML: products, modules, systems)
│   ├── clients.md            (YAML: clients)
│   ├── integrations.md       (YAML: integrations)
│   └── company.md            (YAML: teams + org identity)
├── people/
│   └── [name].md
├── projects/
│   └── [name].md
└── glossary.md
```

## Forge-lib Integration

### Memory Operations

```bash
# Initialize memory structure
forge memory init --directory .

# Query taxonomy
forge memory get-taxonomy products --directory .
forge memory get-taxonomy clients --directory .
forge memory get-taxonomy teams --directory .
forge memory get-taxonomy integrations --directory .
forge memory get-taxonomy modules --directory .
forge memory get-taxonomy systems --directory .

# Update taxonomy
forge memory set-taxonomy products --add "WebApp" --directory .
forge memory set-taxonomy clients --remove "Acme Corp" --directory .
```

**Returns:** JSON arrays for programmatic consumption.

## Cross-Plugin Usage

Other plugins query Forge Memory taxonomy:

**Product Forge:**
- Product, module, client fields on cards
- Validates against taxonomy
- Enriches descriptions

**Tasks Forge:**
- Related product/module for tasks
- Client references

**Report Forge:**
- Scope reports to products/modules
- Client-specific reports

**Shared taxonomy ensures consistency across all plugins.**

## Validation Checkpoint 3

Phase 3 validation criteria:

- ✓ Taxonomy CRUD returns valid JSON
- ✓ `/memory:setup-org` creates taxonomy files via forge-lib
- ✓ Product Forge commands can query taxonomy
- ✓ Tiered lookup strategy works (taxonomy → glossary → deep memory)

## Comparison: V1 vs V2

| Aspect | V1 (memory) | V2 (forge-memory) |
|--------|-------------|-------------------|
| Command length | 150-290 lines | 92-201 lines |
| Skill focus | File format + reasoning | Reasoning only |
| Taxonomy storage | Direct YAML writes | forge-lib operations |
| Taxonomy query | YAML parsing | `forge memory get-taxonomy` |
| File operations | Commands handle | forge-lib handles |
| Knowledge storage | Same (markdown) | Same (markdown) |

**Result:** 30-40% reduction in command complexity while maintaining full functionality.

## Usage Pattern

1. **Initialize:** `/memory:start` to create structure
2. **Configure taxonomy:** `/memory:setup-org` to set products, clients, teams, integrations
3. **Add knowledge:** `/memory:remember` for people, terms, projects
4. **Query:** `/memory:recall` for lookups
5. **Other plugins query taxonomy automatically** via forge-lib

All taxonomy operations delegated to forge-lib for consistency.

## Living Memory System

The Living Memory System adds lifecycle management, passive harvesting, and periodic triage so that organizational memory stays current without manual curation.

### Lifecycle and Importance Scores

Every memory entry carries an `importance` score (0--100) that determines its lifecycle tier:

| Tier | Score Range | Behavior |
|------|-------------|----------|
| **Trusted** | >= 40 | Stable entries; slow decay (1 pt / 30 days) |
| **Probationary** | 10--39 | Under observation; moderate decay (2 pts / 30 days) |
| **Sunset** | < 10 | Candidates for removal; fast decay (5 pts / 30 days) |

New entries start at **importance 15** (probationary tier). Scores change through reinforcement (mentions in conversations and harvests), manual triage actions, and automatic time-based decay.

### Passive Harvesting

Memory grows organically through harvest signals collected during normal plugin usage. Signals arrive on one of two tracks:

- **Instant track** -- When a signal matches an existing memory entry, its importance is reinforced immediately (+5 per mention, capped at 100).
- **Threshold track** -- When a signal references something not yet in memory, it enters `memory/pending.json`. Once a pending item accumulates **3 or more mentions from at least 2 distinct sources**, it is automatically promoted to a full memory entry at importance 15.

Run `forge memory harvest --entity "<name>" --source "<plugin>" --type <person|project|glossary> --directory .` to record a signal. Use `--context "<text>"` to attach optional context. The `forge memory promote --directory .` command checks pending items against the promotion threshold.

### Triage Workflow

Use `/forge-memory:triage` (or `forge memory triage-report --directory .`) to review entries that need attention -- sunset-tier items, recently decayed entries, and pending items near their promotion threshold. For each item you can:

| Action | Effect |
|--------|--------|
| **Keep** | Boost importance by +20 (moves entry back toward trusted tier) |
| **Archive** | Set importance to 0 and mark `archived: true`; entry is preserved but hidden from recall |
| **Delete** | Remove the entry entirely |

CLI equivalents: `forge memory triage-keep`, `forge memory triage-archive`, `forge memory triage-delete`.

### New CLI Commands

```bash
# Run decay across all entries (intended for periodic/scheduled use)
forge memory decay --directory .

# Record a harvest signal
forge memory harvest --entity "Todd" --source "slack-forge" --type person --context "mentioned Acme renewal" --directory .

# Promote pending items that meet the threshold
forge memory promote --directory .

# Generate a triage report (sunset + pending items needing review)
forge memory triage-report --directory .

# Triage actions on a specific entry
forge memory triage-keep   <entry-id> --directory .
forge memory triage-archive <entry-id> --directory .
forge memory triage-delete  <entry-id> --directory .
```

### Telemetry

Aggregate statistics are tracked in `memory/telemetry.json`:

- **decay_runs** -- number of times decay has executed, with timestamps
- **harvests** -- total signals processed, broken down by source
- **promotions** -- count of pending items promoted to full entries
- **triage_actions** -- counts of keep, archive, and delete actions
- **score_distribution** -- snapshot of how many entries fall in each tier

Telemetry is append-only and helps surface trends during triage (e.g., "12 entries decayed to sunset since last triage").
