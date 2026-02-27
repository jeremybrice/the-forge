# Living Memory Migration Runbook

**Audience:** AI agents performing migration
**Scope:** Legacy `.md` files in `memory/people/`, `memory/projects/`, `memory/glossary/` that lack lifecycle fields
**Date:** 2026-02-27

## Purpose

Migrate legacy memory entries to the living memory system by adding five lifecycle fields to each entry's YAML frontmatter:

| Field | Type | Description |
|---|---|---|
| `importance` | integer (0--100) | Relevance score that rises on recall and decays over time |
| `lifecycle_status` | string | One of `trusted`, `probationary`, `sunset` -- derived from importance |
| `source` | string | One of `manual`, `frontmatter`, `auto-matched`, `threshold-promoted` -- how the entry was created |
| `last_recalled` | date (YYYY-MM-DD) | When the entry was last referenced by any plugin |
| `recall_count` | integer (>= 0) | Number of times the entry has been recalled |

After migration, every entry must pass JSON Schema validation against the appropriate schema in `forge-lib/schemas/` (`person.json`, `project-memory.json`, or `glossary.json`).

---

## Prerequisites

Before beginning migration, verify all of the following conditions hold.

1. **forge-lib is installed and functional.** Run:
   ```bash
   python3 forge.py memory decay --help
   ```
   The command must return valid help output without errors. If it fails, install dependencies first:
   ```bash
   cd forge-lib
   pip install -r requirements.txt
   ```

2. **Memory directories exist and contain entries.** At least one `.md` file must exist in one or more of:
   - `memory/people/`
   - `memory/projects/`
   - `memory/glossary/`

   If all three directories are empty or absent, there is nothing to migrate. Abort.

3. **Git working tree is clean.** Run:
   ```bash
   git status --porcelain
   ```
   The output must be empty. If it is not, commit or stash existing changes before proceeding. Migration changes must be committed atomically.

---

## Step 1: Inventory

Scan all `.md` files in the three target directories. For each file, parse the YAML frontmatter block (the content between the opening `---` and closing `---` delimiters).

### 1.1 Identify entries needing migration

An entry **needs migration** if its frontmatter is missing **any** of the five lifecycle fields:

- `importance`
- `lifecycle_status`
- `source`
- `last_recalled`
- `recall_count`

An entry that already contains all five fields does **not** need migration, regardless of the values. Do not modify entries that are already complete.

### 1.2 Produce inventory summary

Before making any changes, output a summary in this format:

```
Migration Inventory
-------------------
memory/people/    : <N> entries need migration (<M> total)
memory/projects/  : <N> entries need migration (<M> total)
memory/glossary/  : <N> entries need migration (<M> total)
-------------------
Total             : <N> entries to migrate
```

If the total is 0, stop here. Migration is already complete.

### 1.3 Record pre-migration state

For each entry needing migration, record its filename and existing frontmatter fields. This provides a rollback reference if migration fails partway through.

---

## Step 2: Classify Source

For each entry needing migration, determine the `source` field value. Examine the entry's content body (everything after the closing `---` of the frontmatter) and its existing frontmatter fields.

### 2.1 Classification rules

Apply the following rules **in order**. Use the first matching condition.

| Priority | Condition | Source Value | Reasoning |
|---|---|---|---|
| 1 | Frontmatter contains a `harvested_from` field, or any field containing provenance metadata (e.g., `matched_from`, `harvest_id`, `signal_source`) | `auto-matched` | Entry was created by the harvester matching a signal from another plugin |
| 2 | Content body contains more than 200 words **and** includes personal observations, narrative prose, or detailed contextual analysis | `manual` | Entry was deliberately written with thought and care |
| 3 | Content body contains fewer than 50 words **and** no `context` field is populated **and** the entry appears to be auto-generated (e.g., only template default text, no personalized content) | `threshold-promoted` | Entry was auto-created from repeated mentions across plugins |
| 4 | All other entries | `frontmatter` | Entry was created from a form or template with structured fields filled in |

### 2.2 Word count calculation

Count words in the content body only. Do not count frontmatter fields. A "word" is any whitespace-delimited token. Markdown syntax characters (e.g., `#`, `*`, `-`, `>`) count as words only if they are standalone tokens; ignore them when they are inline formatting markers attached to other words.

### 2.3 Default

When the classification is ambiguous -- for example, the content body is between 50 and 200 words with no distinguishing characteristics -- default to `frontmatter`.

---

## Step 3: Score Importance

For each entry needing migration, calculate the `importance` score using a baseline-plus-bonus system.

### 3.1 Determine baseline from source

| Source | Baseline Score |
|---|---|
| `manual` | 70 |
| `frontmatter` | 45 |
| `auto-matched` | 25 |
| `threshold-promoted` | 15 |

### 3.2 Apply bonuses

Starting from the baseline, apply **all** applicable bonuses cumulatively.

| # | Condition | Bonus | Notes |
|---|---|---|---|
| 1 | Entry has an `updated` field and the date is within the last 30 days (inclusive) relative to today's date | +10 | Recently active |
| 2 | Entry has an `updated` field and the date is 31--60 days ago (inclusive) relative to today's date | +5 | Moderately recent |
| 3 | Content body is more than 500 words | +10 | Very rich knowledge |
| 4 | Content body is more than 200 words but 500 or fewer | +5 | Rich knowledge |
| 5 | Entry is in `memory/people/` **and** the `role` field contains any of these substrings (case-insensitive): `Lead`, `Director`, `VP`, `Manager`, `Owner`, `Head`, `Chief` | +5 | Organizationally significant |

Rules 1 and 2 are mutually exclusive (an entry cannot be both within 30 days and 31--60 days). Rules 3 and 4 are mutually exclusive (an entry cannot be both >500 and 200--500 words). Rule 5 applies only to person entries.

### 3.3 Apply ceiling

Cap the final importance score at **85**. If the sum of baseline + bonuses exceeds 85, set importance to 85.

The range 86--100 is reserved for entries that earn higher scores through active recall over time. No migrated entry should start above 85.

### 3.4 Derive lifecycle_status

Using the final (capped) importance score, set lifecycle_status:

| Importance Score | Lifecycle Status |
|---|---|
| 40 or higher | `trusted` |
| 10 through 39 (inclusive) | `probationary` |
| 9 or lower | `sunset` |

---

## Step 4: Set Recall Fields

For each entry needing migration, set the two recall tracking fields.

### 4.1 last_recalled

Set `last_recalled` to the entry's `updated` date if present. If the entry has no `updated` field, use the `created` date instead. If neither field exists (which should not happen for valid entries), use today's date as a fallback.

The value must be a date string in `YYYY-MM-DD` format.

### 4.2 recall_count

Set `recall_count` to `0`.

No actual recalls have occurred yet. The recall count starts at zero and will increment only through genuine future recall events.

---

## Step 5: Apply Changes

For each entry needing migration, update its YAML frontmatter to include the five lifecycle fields.

### 5.1 Field placement

Insert the lifecycle fields into the frontmatter in this order, immediately before the `created` and `updated` fields:

```yaml
importance: <calculated_score>
lifecycle_status: <derived_status>
source: <classified_source>
last_recalled: <date>
recall_count: 0
```

### 5.2 Preserve existing content

Do not modify any existing frontmatter fields. Do not modify the content body. Only add the five new fields.

If an entry already has some but not all lifecycle fields, add only the missing ones. Do not overwrite existing lifecycle field values.

### 5.3 Validate each entry

After updating frontmatter, validate the entry against its schema:

- `memory/people/*.md` entries validate against `forge-lib/schemas/person.json`
- `memory/projects/*.md` entries validate against `forge-lib/schemas/project-memory.json`
- `memory/glossary/*.md` entries validate against `forge-lib/schemas/glossary.json`

If validation fails for any entry, log the filename and validation error, revert that entry's changes, and continue with the remaining entries. Do not let one invalid entry block the entire migration.

---

## Step 6: Verify and Commit

### 6.1 Produce migration report

After processing all entries, output a summary:

```
Migration Complete
------------------
memory/people/    : <N> migrated, <M> skipped, <E> errors
memory/projects/  : <N> migrated, <M> skipped, <E> errors
memory/glossary/  : <N> migrated, <M> skipped, <E> errors
------------------
Total migrated    : <N>
Total skipped     : <M> (already had lifecycle fields)
Total errors      : <E>

Score Distribution:
  Trusted (40-85)       : <count>
  Probationary (10-39)  : <count>
  Sunset (0-9)          : <count>

Source Distribution:
  manual                : <count>
  frontmatter           : <count>
  auto-matched          : <count>
  threshold-promoted    : <count>
```

### 6.2 Commit atomically

If any entries were successfully migrated and there are no uncommitted errors to resolve:

```bash
git add memory/people/ memory/projects/ memory/glossary/
git commit -m "feat(memory): migrate legacy entries to living memory lifecycle

Adds importance, lifecycle_status, source, last_recalled, and recall_count
fields to <N> memory entries across people, projects, and glossary."
```

Replace `<N>` with the actual count of migrated entries.

### 6.3 Handle errors

If any entries failed validation and were reverted:

1. List each failed entry with its specific validation error.
2. These entries remain in their pre-migration state and are safe.
3. Report them for manual review. Do not retry automatically -- a validation failure indicates a structural issue that requires human inspection.

---

## Examples — Before and After

Three concrete examples showing legacy entries and their migrated versions with scoring rationale.

### Example 1 — Person (manual source)

**BEFORE:**

```yaml
---
name: "Jane Smith"
type: person
role: "Principal Engineer"
team: "Platform"
context: "Leads architecture decisions for API gateway, deep expertise in distributed systems. Has mentored 5+ engineers on the team."
created: "2025-10-15"
updated: "2026-02-10"
---

## Jane Smith

**Role:** Principal Engineer
**Team:** Platform

## Context

Leads architecture decisions for API gateway, deep expertise in distributed systems. Has mentored 5+ engineers on the team. Primary reviewer for all infrastructure PRs. Introduced event sourcing pattern to the payment pipeline.
```

**AFTER:**

```yaml
---
name: "Jane Smith"
type: person
role: "Principal Engineer"
team: "Platform"
context: "Leads architecture decisions for API gateway, deep expertise in distributed systems. Has mentored 5+ engineers on the team."
importance: 80
lifecycle_status: "trusted"
source: "manual"
last_recalled: "2026-02-10"
recall_count: 0
created: "2025-10-15"
updated: "2026-02-10"
---
```

(Body content unchanged)

**Scoring rationale:**

- Source: `manual` — rich narrative with personal observations (>200 words)
- Baseline: 70
- Recency bonus: +10 (updated 17 days ago, within 30 days)
- Final: 80 (trusted)

### Example 2 — Project (frontmatter source)

**BEFORE:**

```yaml
---
name: "API Modernization Initiative"
type: project
description: "Refactoring legacy monolith to microservices. Phase 1: API gateway extraction."
status: "in-progress"
people:
  - "Jane Smith"
  - "Bob Chen"
created: "2025-08-20"
updated: "2025-12-03"
---

## API Modernization Initiative

Refactoring legacy monolith to microservices. Phase 1: API gateway extraction. Expected completion Q2 2026.

**Status:** in-progress

## People

- Jane Smith
- Bob Chen
```

**AFTER:**

```yaml
---
name: "API Modernization Initiative"
type: project
description: "Refactoring legacy monolith to microservices. Phase 1: API gateway extraction."
status: "in-progress"
people:
  - "Jane Smith"
  - "Bob Chen"
importance: 45
lifecycle_status: "trusted"
source: "frontmatter"
last_recalled: "2025-12-03"
recall_count: 0
created: "2025-08-20"
updated: "2025-12-03"
---
```

(Body unchanged)

**Scoring rationale:**

- Source: `frontmatter` — structured fields, minimal narrative prose
- Baseline: 45
- Recency bonus: +0 (updated 86 days ago, outside both recency windows)
- Final: 45 (trusted)

### Example 3 — Glossary (frontmatter source)

**BEFORE:**

```yaml
---
term: "Event Sourcing"
type: glossary
definition: "Architectural pattern where state changes are stored as immutable sequence of events."
context: "Core pattern used in API Modernization Initiative"
created: "2026-01-05"
updated: "2026-01-05"
---

## Event Sourcing

Architectural pattern where state changes are stored as immutable sequence of events. System state rebuilt by replaying events.

**Used in:** Core pattern used in API Modernization Initiative
```

**AFTER:**

```yaml
---
term: "Event Sourcing"
type: glossary
definition: "Architectural pattern where state changes are stored as immutable sequence of events."
context: "Core pattern used in API Modernization Initiative"
importance: 50
lifecycle_status: "trusted"
source: "frontmatter"
last_recalled: "2026-01-05"
recall_count: 0
created: "2026-01-05"
updated: "2026-01-05"
---
```

(Body unchanged)

**Scoring rationale:**

- Source: `frontmatter` — structured fields with definition and context, no harvesting provenance metadata
- Baseline: 45
- Recency bonus: +5 (updated 53 days ago, within 31-60 day window)
- Final: 50 (trusted)

---

## Edge Cases

| Situation | Resolution |
|---|---|
| Entry has no `updated` date | Use `created` date for `last_recalled` |
| Entry has no `created` date either | Use today's date as fallback; flag for manual review |
| Entry has malformed YAML frontmatter | Skip entirely; include in error report |
| Entry already has `importance` but missing other fields | Preserve existing `importance`; fill only missing fields; derive `lifecycle_status` from existing score |
| Entry already has all 5 lifecycle fields | Skip — no migration needed |
| Entry has `importance` > 85 | Preserve as-is (may have been manually set or earned through recall) |
| Duplicate entries (same name, different files) | Migrate both independently; flag for manual review |
| Entry in `memory/archived/` directory | Skip — already archived, outside migration scope |
| Entry file is empty or has no frontmatter | Skip entirely; include in error report |

---

## Decision Reference

This section consolidates all decision tables for quick reference during implementation.

### Source classification (ordered by priority)

| Priority | Condition | Source |
|---|---|---|
| 1 | Has `harvested_from` or provenance metadata | `auto-matched` |
| 2 | Content body >200 words with narrative prose | `manual` |
| 3 | Content body <50 words, no context, appears auto-generated | `threshold-promoted` |
| 4 | Default | `frontmatter` |

### Importance scoring

| Component | Value |
|---|---|
| Baseline: manual | 70 |
| Baseline: frontmatter | 45 |
| Baseline: auto-matched | 25 |
| Baseline: threshold-promoted | 15 |
| Bonus: updated within 30 days | +10 |
| Bonus: updated 31--60 days ago | +5 |
| Bonus: content >500 words | +10 |
| Bonus: content 201--500 words | +5 |
| Bonus: person with leadership title | +5 |
| Ceiling | 85 |

### Lifecycle status thresholds

| Score Range | Status |
|---|---|
| 40--100 | `trusted` |
| 10--39 | `probationary` |
| 0--9 | `sunset` |

### Schema validation targets

| Directory | Schema File |
|---|---|
| `memory/people/` | `forge-lib/schemas/person.json` |
| `memory/projects/` | `forge-lib/schemas/project-memory.json` |
| `memory/glossary/` | `forge-lib/schemas/glossary.json` |
