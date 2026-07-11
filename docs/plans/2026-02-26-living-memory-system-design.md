# Living Memory System — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Scope:** forge-memory plugin + forge-lib memory_ops + forge-shell memory view

## Overview

The forge-memory plugin currently stores knowledge (people, projects, glossary terms) and taxonomy (products, modules, teams, clients, integrations) as static markdown files. Entries persist indefinitely at equal standing. As passive harvesting from other plugins feeds the system at volume, the memory directory will become a junk drawer of stale, irrelevant entries that degrade recall quality and erode user trust.

This design introduces two pillars — **Passive Memory Harvesting** and a **Decay & Lifecycle Engine** — that together make memory a living system: it grows organically from normal workflow activity, and it self-curates through time-based decay with human-in-the-loop triage.

## Design Principles

- **No special classes of knowledge.** Taxonomy, people, projects, glossary — all entries play by the same lifecycle rules. Nothing is exempt from decay. If it's important, it will be recalled and reinforced. If it surfaces in triage, the user decides.
- **The triage experience is the product; the decay model is infrastructure.** What happens at the curation moment matters more than the background math.
- **Aggressive intake, fast cleanup.** The harvesting pipeline casts a wide net. Low-confidence entries prove themselves quickly or fade within weeks.
- **Silent growth, visible curation.** Harvesting is invisible during normal workflow. Decay surfaces itself only at triage time.
- **Earn complexity with data.** Ship stepped thresholds now. Collect telemetry. Evolve to exponential decay (Option D) only when real usage data justifies it.

## Section 1: Data Model & Schema Changes

### New Frontmatter Fields

Every memory entry (person, project, glossary) gets these lifecycle fields added to its YAML frontmatter:

```yaml
# Existing fields (unchanged)
name: Todd Martinez
type: person
role: Finance Lead
team: Finance
created: 2026-02-15
updated: 2026-02-26

# New lifecycle fields
importance: 70
lifecycle_status: trusted
source: manual
last_recalled: 2026-02-26
recall_count: 4
```

### Field Definitions

| Field | Type | Values | Default |
|-------|------|--------|---------|
| `importance` | integer | 0-100 | Set by source classification |
| `lifecycle_status` | enum | trusted / probationary / sunset | Computed from importance |
| `source` | enum | manual / frontmatter / auto-matched / threshold-promoted | Set at creation |
| `last_recalled` | date | YYYY-MM-DD | Set to creation date |
| `recall_count` | integer | 0+ | 0 |

### Lifecycle Tiers

| Tier | Score Range | Behavior |
|------|------------|----------|
| **Trusted** | >= 40 | Always included in recall results. Full standing. |
| **Probationary** | 10-39 | Included in recall but visually flagged. Entry hasn't earned permanent standing. |
| **Sunset** | < 10 | Excluded from recall. Queued for triage review. |

### Source-Aware Starting Scores

| Source | Starting Score | Rationale |
|--------|---------------|-----------|
| Manual `/remember` | 70 | Highest human intent signal |
| Structured frontmatter | 45 | Deliberately placed in structured context |
| Auto-matched (instant track) | 25 | System recognized it, user didn't act |
| Threshold-promoted | 15 | Earned through repetition, still unvalidated |

### Threshold Tracking (Pending Entities)

Unknown entities that haven't yet earned promotion are tracked in `memory/pending.json`:

```json
{
  "entities": {
    "phoenix-project": {
      "mentions": 2,
      "first_seen": "2026-02-20",
      "last_seen": "2026-02-25",
      "sources": ["product-forge", "tasks-forge"],
      "context_samples": [
        "Referenced in card: API Redesign",
        "Task assigned to Phoenix workstream"
      ]
    }
  }
}
```

Promotion threshold: `mentions >= 3` AND `sources` contains 2+ distinct plugins.

### Schema Migration

The three existing JSON schemas (`person.json`, `project-memory.json`, `glossary.json`) in forge-lib get the new fields added as optional with defaults:

- Existing entries receive `importance: 45` (frontmatter source assumed), `lifecycle_status: trusted`, `recall_count: 0`, `last_recalled` set to `updated` date, `source: frontmatter`
- No existing entries break. They start in trusted tier and begin their lifecycle from there.

## Section 2: Harvesting Pipeline

### Architecture

Each plugin emits memory signals through existing forge-lib operations. No event bus — harvesting hooks into post-operation flows.

```
Plugin Action → Memory Signal → Harvester → Instant Track (reinforce)
                                          → Threshold Track (count)
                                          → Ignore (no entity detected)
```

### Signal Sources

| Plugin | Fields Harvested | Example |
|--------|-----------------|---------|
| product-forge | product, module, client, assigned people | Card "API Redesign" references product: WebApp, client: Acme Corp |
| tasks-forge | related product/module, assigned person | Task references module: Billing |
| cognitive-forge | agents, topic terms | Debate session about "memory decay" |
| report-forge | scope product/module, stakeholders | Report scoped to product: MobileApp |
| forge-memory | explicit /remember entries | User stores "Todd is Finance Lead" |

### Harvester Logic (Per Entity Detected)

1. Fuzzy-match against existing memory entries (case-insensitive, partial word)
2. **Match found** → Instant track: update `last_recalled` and increment `recall_count` on the existing entry, apply boost (+5, max 2 boosts per entry per day)
3. **No match found** → Threshold track: upsert into `memory/pending.json`, increment mention count and record source plugin
4. **Threshold crossed** (3+ mentions, 2+ plugins) → Auto-promote: create a real memory entry at starting score 15, remove from pending.json

### Boost Mechanics

- +5 per genuine recall event
- Maximum 2 boosts per entry per day (prevents burst gaming from bulk operations)
- Boost cannot push score above 100

### What the Harvester Does NOT Do

- Parse free-text content for named entities (only structured frontmatter fields)
- Create entries for every mention (threshold track filters noise)
- Interrupt the user's workflow (completely silent)

## Section 3: Decay Engine

### When Decay Runs

Decay is not continuous. It evaluates only when explicitly triggered:

1. `forge memory decay` — dedicated batch command that sweeps all entries
2. As a pre-step inside `forge memory recall` — recalculate scores before returning results
3. Via routines-forge scheduled routine (e.g., weekly)

### System Reads vs. User Recalls

| Operation | Type | Effect |
|-----------|------|--------|
| `forge memory recall "Todd"` | User recall | Boosts matched entries |
| `forge memory decay` | System read | Applies decay, never boosts |
| `forge memory query-knowledge` | System read | No score changes |
| Plugin harvesting a reference | User recall | Boosts matched entries |
| Forge-shell rendering memory view | System read | No score changes |

### Decay Calculation

At each evaluation, for every non-sunset entry:

```
days_inactive = today - last_recalled
```

Stepped drops based on cumulative inactivity:

| Inactivity Period | Score Drop | Cumulative | Effect on Entry Sources |
|-------------------|-----------|------------|------------------------|
| 0-30 days | 0 | 0 | Grace period. All entries stable. |
| 31-60 days | -10 | -10 | Threshold-promoted (15) approaching sunset. |
| 61-90 days | -15 | -25 | Threshold-promoted (15) sunset. Auto-matched (25) sunset. |
| 91-180 days | -20 | -45 | Frontmatter (45) sunset. |
| 180+ days | -25 | -70 | Manual (70) sunset if never reinforced. |

### Key Behaviors

- **Threshold-promoted entry** (score 15): hits sunset at ~60 days without recall
- **Auto-matched entry** (score 25): survives ~90 days without recall
- **Frontmatter entry** (score 45): survives ~120 days without recall
- **Manual entry** (score 70): survives ~180 days without recall
- **Any entry with regular recall**: never decays (30-day grace period resets on each recall)

### Decay Properties

- **Idempotent.** Running `forge memory decay` twice in the same day produces the same result. Calculation is always based on `last_recalled`, not time since last decay run.
- **Quantized.** Scores only change when a CLI command explicitly runs decay evaluation, not on every read.
- **Floor at 0.** Entries never go negative. They stay at 0/sunset until triaged. Never auto-deleted.

### Tier Transitions

| Transition | Score Trigger | What Happens |
|------------|--------------|--------------|
| Trusted → Probationary | Drops below 40 | `lifecycle_status` updated. Entry still in recall, but flagged. |
| Probationary → Sunset | Drops below 10 | `lifecycle_status` updated. Excluded from recall. Queued for triage. |
| Score hits 0 | Floor | Entry stays at 0/sunset until triaged. |

### Git Hygiene

Decay runs on explicit command invocation, so frontmatter changes are batched into a single moment. A weekly decay run produces one set of file changes, committable as a single `chore: weekly memory decay` commit.

## Section 4: Triage Experience

### `/memory:triage` Command

When invoked:

1. Runs `forge memory decay` to ensure scores are current
2. Queries all entries with `lifecycle_status: sunset` or probationary entries approaching sunset (score 10-15)
3. Presents entries grouped by urgency

### Triage Presentation

```
## Memory Triage — 7 entries need attention

### Sunset (excluded from recall)
1. **Todd Martinez** (person) — score: 3, last recalled 142 days ago
   Source: manual | Created: 2026-01-05
2. **Phoenix Project** (project) — score: 0, last recalled 195 days ago
   Source: threshold-promoted | Created: 2025-09-10

### Approaching Sunset
3. **PSR acronym** (glossary) — score: 12, last recalled 58 days ago
   Source: auto-matched | Created: 2026-01-20
```

### User Actions Per Entry

| Action | Effect |
|--------|--------|
| **Keep** | Boost score by +20, reset `last_recalled` to today. Entry returns to probationary or trusted. |
| **Merge** | Combine with another entry. Content merged, higher score kept. |
| **Archive** | Move to `memory/archived/`. Preserved in git history, excluded from queries. Cross-references updated. |
| **Delete** | Remove file entirely. User confirms irrelevance. |

Batch actions supported: "archive 1 and 2, keep 3" processed in a single response.

### Cascade Handling

When an entry is archived or deleted:

1. `forge memory triage` checks for inbound relationships via `forge relationship` before presenting actions
2. If references exist, triage shows: "Referenced by: card API-Redesign, task-003"
3. **Archive** preserves a stub file with `status: archived` so relationship links resolve to "this entry was archived on YYYY-MM-DD" rather than breaking
4. **Delete** warns: "This will break 2 references. Proceed?"

### Routines-Forge Integration

A default routine ships with the updated forge-memory:

```yaml
name: weekly-memory-triage
schedule: monday 9:00
action: forge memory decay && forge memory triage-report
description: Run decay and generate triage summary for review
```

`forge memory triage-report` is a non-interactive variant that outputs the triage summary to stdout for asynchronous review.

### Forge-Shell Integration

The memory dashboard adds:

- **Heatmap coloring** — entries colored by lifecycle status (bright = trusted, muted = probationary, dimmed = sunset)
- **Triage badge** — count of entries needing triage shown on the memory tab
- **Score display** — importance score visible on each entry card
- **Sort by importance** — option to sort entries by score

## Section 5: Telemetry & Future Evolution

### Aggregate Telemetry

Stored in `memory/telemetry.json`:

```json
{
  "last_decay_run": "2026-02-26",
  "total_entries": 47,
  "by_status": { "trusted": 31, "probationary": 12, "sunset": 4 },
  "by_source": { "manual": 15, "frontmatter": 18, "auto-matched": 9, "threshold-promoted": 5 },
  "pending_count": 23,
  "triage_history": [
    {
      "date": "2026-02-24",
      "reviewed": 6,
      "kept": 2,
      "merged": 1,
      "archived": 2,
      "deleted": 1
    }
  ],
  "promotions": {
    "total": 8,
    "avg_days_to_promote": 12
  },
  "archives": {
    "total": 14,
    "avg_lifespan_days": 67,
    "by_source": { "threshold-promoted": 8, "auto-matched": 4, "frontmatter": 2 }
  }
}
```

### What This Data Answers

| Question | Data Source | Insight |
|----------|-----------|---------|
| Are decay intervals right? | avg_lifespan_days by source | Adjust intervals if entries survive too long or die too fast |
| Is promotion threshold correct? | avg_days_to_promote, pending count | Growing pending = threshold too high. Junk promoting = too low. |
| Do users actually triage? | triage_history frequency | If triage stops, system needs more autonomy |
| Which sources produce lasting knowledge? | archives.by_source vs totals | If 90% of threshold-promoted entries archive, raise the bar |
| Is stepped decay too coarse? | Score distribution at triage time | Clustering at 0 suggests finer granularity needed |

### Evolution Trigger Criteria

Consider upgrading to Option D (exponential decay with threshold gates) when telemetry shows at least two of:

1. **Triage fatigue** — users archive 80%+ without reading, suggesting faster decay needed
2. **False sunsets** — users keep 80%+ of triaged entries, suggesting decay is too aggressive
3. **Source divergence** — one source type has dramatically different optimal lifespans
4. **Volume scaling** — entry counts exceed 200+ and coarse tiers create probationary limbo

See companion document: `2026-02-26-option-d-hybrid-decay-reference.md`

## New CLI Commands

| Command | Purpose |
|---------|---------|
| `forge memory decay` | Batch decay evaluation across all entries |
| `forge memory harvest --entity "name" --source "plugin" --type "person"` | Process a memory signal from a plugin |
| `forge memory triage-report` | Non-interactive triage summary to stdout |
| `forge memory promote --check` | Check pending.json and promote qualifying entities |

## New Plugin Commands

| Command | Purpose |
|---------|---------|
| `/memory:triage` | Interactive triage curation session |

## Files Created/Modified

| File | Change |
|------|--------|
| `forge-lib/schemas/person.json` | Add lifecycle fields (optional, with defaults) |
| `forge-lib/schemas/project-memory.json` | Add lifecycle fields (optional, with defaults) |
| `forge-lib/schemas/glossary.json` | Add lifecycle fields (optional, with defaults) |
| `forge-lib/forge_lib/memory_ops.py` | Add decay, harvest, promote, triage-report operations |
| `forge-lib/forge.py` | Register new CLI subcommands |
| `forge-memory/commands/triage.md` | New triage command |
| `forge-memory/skills/memory-management.md` | Update 4-tier lookup to respect lifecycle_status |
| `forge-shell/app/js/memory.js` | Add heatmap, triage badge, score display, sort |
| `memory/pending.json` | New file for threshold tracking |
| `memory/telemetry.json` | New file for aggregate telemetry |
| `memory/archived/` | New directory for archived entries |
