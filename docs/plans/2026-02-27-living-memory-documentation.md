# Living Memory Documentation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create two documents — a layered user guide and an AI migration runbook — for the living memory system.

**Architecture:** Two standalone markdown documents in `docs/`. The user guide is concept-first for general audiences with a technical reference appendix. The migration runbook is a sequential checklist for AI agents with intelligent scoring rules and before/after examples.

**Tech Stack:** Markdown documentation only. References `forge-lib` CLI commands and YAML frontmatter schemas.

---

### Task 1: Write the Living Memory User Guide — Conceptual Sections

**Files:**
- Create: `docs/living-memory-user-guide.md`

**Step 1: Write sections 1-6 (conceptual layer)**

Write the following sections in plain, approachable language:

**Section 1 — What is Living Memory?**

Opening paragraph explaining the system. Use the library analogy: your memory system works like a library with an attentive librarian — books checked out regularly stay on the main shelves, books nobody reads gradually move to the back room, and periodically the librarian asks "should we keep this, archive it, or remove it?"

Key points to cover:
- Every memory entry has an importance score (0-100)
- Scores rise when memories are used, fall when they're not
- The system never deletes anything on its own — you always decide

**Section 2 — The Three Tiers**

| Tier | Score | What It Means |
|------|-------|---------------|
| Trusted | 40-100 | Always available in recall. Stable. |
| Probationary | 10-39 | Available but flagged as **(fading)** to signal staleness. |
| Sunset | 0-9 | Hidden from recall. Queued for your review. |

Explain in plain language what each tier means for the user's experience. Trusted memories just work. Probationary memories show up with a warning. Sunset memories are invisible until triage.

**Section 3 — How Memories Stay Alive (Boosting)**

Every time you or a plugin references a memory, it gets stronger:
- +5 importance points per genuine recall
- Maximum 2 boosts per entry per day (prevents gaming)
- Score ceiling at 100
- Each boost resets the 30-day grace period before decay kicks in

Takeaway: frequently used knowledge stays trusted indefinitely without any effort.

**Section 4 — How Memories Fade (Decay)**

Memories that aren't used gradually lose importance. The system uses a stepped decay model:

- **Days 0-30:** Grace period. No decay at all.
- **Days 31-60:** -10 points. Threshold-promoted entries (starting at 15) enter sunset.
- **Days 61-90:** -25 points total. Auto-matched entries (starting at 25) enter sunset.
- **Days 91-180:** -45 points total. Frontmatter entries (starting at 45) enter sunset.
- **Day 180+:** -70 points total. Even manually created entries (starting at 70) enter sunset.

Include survivorship table:

| How It Was Created | Starting Score | Survives Without Use |
|-------------------|---------------|---------------------|
| You wrote it manually | 70 | ~6 months |
| Created from a form | 45 | ~4 months |
| Auto-matched by harvester | 25 | ~3 months |
| Auto-promoted from mentions | 15 | ~2 months |

Explain that decay only runs when explicitly triggered (via CLI command or scheduled routine), not continuously.

**Section 5 — Triage: The Curation Moment**

Run `/memory:triage` periodically (weekly recommended) to review entries needing attention.

The system presents entries grouped by urgency:
- **Sunset** entries (hidden from recall, need action)
- **Approaching sunset** entries (fading, may need attention soon)

Three actions per entry:
- **Keep** — Boost +20 points. Resets the 30-day grace period. Entry returns to active use.
- **Archive** — Move to `memory/archived/`. Preserved in git history but hidden from queries.
- **Delete** — Remove permanently. Cannot be undone.

Emphasize: the system never auto-deletes. Triage is the human-in-the-loop moment where you decide what matters.

Batch actions supported: "keep 1 and 3, archive 2, delete 4"

**Section 6 — How New Memories Form (Harvesting)**

Memories grow organically from your work across plugins:

**Instant track** (reinforcing existing memories):
When a plugin mentions someone or something already in memory, that entry gets a +5 boost automatically. Silent and invisible.

**Threshold track** (discovering new knowledge):
When plugins mention something not yet in memory, the system tracks it silently in a pending list. Once an entity is mentioned 3+ times from 2+ different plugins, it's automatically promoted to a real memory entry (starting at importance 15).

Example: You mention "Phoenix Project" in product-forge, then reference it in tasks-forge, then discuss it in cognitive-forge — the system creates a memory entry for it.

**Step 2: Commit**

```bash
git add docs/living-memory-user-guide.md
git commit -m "docs: add living memory user guide — conceptual sections"
```

---

### Task 2: Write the Living Memory User Guide — Technical Reference

**Files:**
- Modify: `docs/living-memory-user-guide.md`

**Step 1: Add sections 7-10 (technical reference layer)**

Add a horizontal rule and "Technical Reference" header after the conceptual sections.

**Section 7 — Lifecycle Fields Reference**

Every memory entry carries these YAML frontmatter fields:

| Field | Type | Range | Default | Purpose |
|-------|------|-------|---------|---------|
| `importance` | integer | 0-100 | 45 | Score determining tier status and decay rate |
| `lifecycle_status` | enum | trusted / probationary / sunset | trusted | Computed from importance score |
| `source` | enum | manual / frontmatter / auto-matched / threshold-promoted | frontmatter | How the entry originated |
| `last_recalled` | date (YYYY-MM-DD) or null | — | null | Last time entry was boosted |
| `recall_count` | integer | 0+ | 0 | Cumulative count of successful recalls |

Show a complete example entry with all fields:

```yaml
---
name: "Jane Smith"
type: person
role: "Principal Engineer"
team: "Platform"
context: "Leads API gateway architecture"
importance: 72
lifecycle_status: "trusted"
source: "manual"
last_recalled: "2026-02-25"
recall_count: 12
created: "2025-10-15"
updated: "2026-02-25"
---
```

**Section 8 — Decay Math**

Exact stepped threshold table:

| Days Since Last Recall | Cumulative Penalty | Score from 70 | Score from 45 | Score from 25 | Score from 15 |
|----------------------|-------------------|---------------|---------------|---------------|---------------|
| 0-30 | 0 | 70 (trusted) | 45 (trusted) | 25 (probationary) | 15 (probationary) |
| 31-60 | -10 | 60 (trusted) | 35 (probationary) | 15 (probationary) | 5 (sunset) |
| 61-90 | -25 | 45 (trusted) | 20 (probationary) | 0 (sunset) | 0 (sunset) |
| 91-180 | -45 | 25 (probationary) | 0 (sunset) | 0 (sunset) | 0 (sunset) |
| 180+ | -70 | 0 (sunset) | 0 (sunset) | 0 (sunset) | 0 (sunset) |

Status derivation:
```
importance >= 40 → trusted
importance >= 10 → probationary
importance < 10  → sunset
```

Note: decay is idempotent — running it twice produces the same result because it's calculated from `last_recalled`, not from time since last decay run.

**Section 9 — CLI Commands**

Complete reference for all `forge memory` subcommands:

```
forge memory decay [--directory DIR]
```
Run decay across all entries. Updates importance scores and lifecycle statuses in place.

```
forge memory harvest --entity NAME --source PLUGIN --type {person|project|glossary} [--context TEXT] [--directory DIR]
```
Process a signal from a plugin. Instant track (boost existing) or threshold track (track in pending.json).

```
forge memory triage-report [--directory DIR]
```
Generate report of entries needing attention. Runs decay internally first.

```
forge memory triage-keep FILEPATH [--directory DIR]
```
Keep action: boost +20, reset last_recalled to today.

```
forge memory triage-archive FILEPATH [--directory DIR]
```
Archive action: move to `memory/archived/`, leave stub at original path.

```
forge memory triage-delete FILEPATH [--directory DIR]
```
Delete action: remove file permanently.

```
forge memory promote [--check] [--directory DIR]
```
Check pending entities and promote qualifying ones (3+ mentions, 2+ sources). Use `--check` for dry run.

All commands return JSON for programmatic consumption.

**Section 10 — Telemetry**

The system tracks aggregate statistics in `memory/telemetry.json`:

```json
{
  "last_decay_run": "2026-02-27",
  "total_entries": 47,
  "by_status": { "trusted": 31, "probationary": 12, "sunset": 4 },
  "by_source": { "manual": 15, "frontmatter": 18, "auto-matched": 9, "threshold-promoted": 5 },
  "pending_count": 23,
  "triage_history": [
    { "date": "2026-02-24", "reviewed": 6, "kept": 2, "archived": 2, "deleted": 1 }
  ]
}
```

Use this data to tune the system: check if decay intervals feel right, whether promotion thresholds are too aggressive or too lenient, and whether triage is happening regularly.

**Step 2: Commit**

```bash
git add docs/living-memory-user-guide.md
git commit -m "docs: add technical reference sections to living memory user guide"
```

---

### Task 3: Write the AI Migration Runbook — Steps 1-4

**Files:**
- Create: `docs/living-memory-migration-runbook.md`

**Step 1: Write the header, prerequisites, and migration steps 1-4**

**Header:**
- Title: "Living Memory Migration Runbook"
- Purpose statement: instructions for an AI agent to migrate legacy memory entries to the living memory system
- Scope: existing `.md` files in `memory/people/`, `memory/projects/`, `memory/glossary/` that lack lifecycle fields

**Prerequisites section:**
- forge-lib installed and working (`python3 forge.py memory decay --help` returns valid output)
- Memory directories exist with entries to migrate
- Git working tree is clean (so migration changes can be committed atomically)

**Step 1: Inventory**

Scan all `.md` files in:
- `memory/people/`
- `memory/projects/`
- `memory/glossary/`

For each file, parse YAML frontmatter. Flag as "needs migration" if missing any of: `importance`, `lifecycle_status`, `source`, `last_recalled`, `recall_count`.

Output: count of entries needing migration, grouped by directory.

**Step 2: Classify Source**

For each entry needing migration, determine the `source` value:

| Condition | Source | Reasoning |
|-----------|--------|-----------|
| Entry has rich narrative (>200 words), personal observations, or detailed context | `manual` | Someone deliberately wrote this with thought |
| Entry has structured fields filled but minimal prose | `frontmatter` | Created from a form or template |
| Entry has a `harvested_from` field or provenance metadata | `auto-matched` | Created by the harvester matching a signal |
| Entry has minimal content (<50 words), no context field, or appears auto-generated | `threshold-promoted` | Likely auto-created from repeated mentions |

When in doubt, default to `frontmatter` (the safest middle ground).

**Step 3: Score Importance**

Start from source baseline, then apply bonuses:

| Source | Baseline |
|--------|----------|
| manual | 70 |
| frontmatter | 45 |
| auto-matched | 25 |
| threshold-promoted | 15 |

Apply bonuses (cumulative):

| Condition | Bonus | Notes |
|-----------|-------|-------|
| `updated` within last 30 days | +10 | Recently active |
| `updated` within last 60 days (but not 30) | +5 | Moderately recent |
| Content body >200 words | +5 | Rich knowledge |
| Content body >500 words | +10 | Very rich (replaces +5) |
| Person with leadership title (Lead, Director, VP, Manager, Owner, Head, Chief) | +5 | Organizationally significant |

Cap final score at 85. Reserve 86-100 for entries that earn it through active recall post-migration.

Derive `lifecycle_status` from final score:
- >= 40 → `trusted`
- 10-39 → `probationary`
- < 10 → `sunset`

**Step 4: Set Recall Fields**

- `last_recalled`: Use the entry's `updated` date. If no `updated` date, use `created`. This is the best available proxy for last interaction.
- `recall_count`: 0 (no actual recalls have occurred in the new system).

**Step 2: Commit**

```bash
git add docs/living-memory-migration-runbook.md
git commit -m "docs: add migration runbook — inventory, classification, and scoring steps"
```

---

### Task 4: Write the AI Migration Runbook — Steps 5-7, Scoring Table, Examples, Edge Cases

**Files:**
- Modify: `docs/living-memory-migration-runbook.md`

**Step 1: Add remaining sections**

**Step 5: Update Entries**

For each entry, add the 5 lifecycle fields to the YAML frontmatter. Place them after existing fields but before `created` and `updated`:

```yaml
---
name: "Jane Smith"
type: person
role: "Principal Engineer"
team: "Platform"
context: "Leads API gateway architecture"
importance: 80        # ← ADD
lifecycle_status: "trusted"  # ← ADD
source: "manual"      # ← ADD
last_recalled: "2026-02-10"  # ← ADD
recall_count: 0       # ← ADD
created: "2025-10-15"
updated: "2026-02-10"
---
```

Rules:
- Preserve ALL existing fields and body content
- Do not reorder existing fields
- Do not modify any values except adding the 5 new fields
- If an entry already has some lifecycle fields, preserve them and only fill missing ones

**Step 6: Validate**

Run decay to confirm all entries parse correctly:
```bash
cd forge-lib && python3 forge.py memory decay --directory ..
```

Check output for errors. If any entries fail validation, report the filepath and error. Do not attempt to fix malformed entries — flag them for manual review.

**Step 7: Report**

Output a migration summary:

```
Migration Complete
==================
Total entries migrated: {count}

By source:
  manual:             {count}
  frontmatter:        {count}
  auto-matched:       {count}
  threshold-promoted: {count}

By lifecycle status:
  trusted:      {count}
  probationary: {count}
  sunset:       {count}

Validation: {PASS/FAIL}
Errors: {count} (see details below)
```

**Scoring Decision Table (quick reference):**

Provide a compact decision table the AI can reference mechanically:

```
1. Determine source:
   Rich narrative + details → manual (baseline 70)
   Structured fields, minimal prose → frontmatter (baseline 45)
   Has harvested_from metadata → auto-matched (baseline 25)
   Minimal content, appears auto-generated → threshold-promoted (baseline 15)
   Unsure → frontmatter (baseline 45)

2. Apply bonuses:
   Updated ≤30 days ago? → +10
   Updated ≤60 days ago? → +5
   Body >500 words? → +10
   Body >200 words? → +5 (skip if >500 already applied)
   Person + leadership title? → +5

3. Cap at 85

4. Derive status:
   Score ≥40 → trusted
   Score ≥10 → probationary
   Score <10 → sunset
```

**Examples: Before & After**

Include 3 examples:

**Example 1 — Person (manual source):**
Before: person entry with rich context, "Principal Engineer" role, updated 17 days ago. No lifecycle fields.
After: source=manual (70), recency +10, but cap at 85 → importance=80, trusted.
Show complete YAML frontmatter for both.

**Example 2 — Project (frontmatter source):**
Before: project entry with standard fields, updated 86 days ago. No lifecycle fields.
After: source=frontmatter (45), recency +5 → importance=50, trusted.
Show complete YAML frontmatter for both.

**Example 3 — Glossary (auto-matched source):**
Before: glossary entry with short definition, updated 52 days ago. No lifecycle fields.
After: source=auto-matched (25), recency +5 → importance=30, probationary.
Show complete YAML frontmatter for both.

**Edge Cases:**

| Situation | Resolution |
|-----------|------------|
| Entry has no `updated` date | Use `created` date for `last_recalled` |
| Entry has no `created` date either | Use today's date; flag for manual review |
| Entry has malformed YAML frontmatter | Skip entirely; include in error report |
| Entry already has `importance` but missing other fields | Preserve existing `importance`; fill missing fields; derive `lifecycle_status` from existing score |
| Entry already has all 5 lifecycle fields | Skip — no migration needed |
| Entry has `importance` > 85 | Preserve as-is (may have been manually set) |
| Duplicate entries (same name, different files) | Migrate both; flag for manual review |
| Entry in `memory/archived/` directory | Skip — already archived |

**Step 2: Commit**

```bash
git add docs/living-memory-migration-runbook.md
git commit -m "docs: complete migration runbook with examples and edge cases"
```

---

### Task 5: Final Review and Commit

**Step 1: Review both documents**

Read both documents end-to-end. Check:
- User guide: concepts flow logically, technical reference is accurate against actual code
- Migration runbook: steps are unambiguous, scoring rules are consistent, examples match rules
- Cross-reference CLI commands against `forge.py` argument definitions
- Cross-reference field definitions against schemas

**Step 2: Fix any issues found in review**

**Step 3: Final commit if any fixes were needed**

```bash
git add docs/living-memory-user-guide.md docs/living-memory-migration-runbook.md
git commit -m "docs: finalize living memory documentation"
```
