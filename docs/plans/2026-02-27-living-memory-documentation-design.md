# Living Memory Documentation — Design

**Date:** 2026-02-27
**Status:** Approved
**Author:** Claude (brainstorming session)

## Overview

Two documents for the living memory system: a layered user guide (conceptual + technical reference) and a structured AI migration runbook for upgrading legacy entries.

## Document 1: User Guide

**File:** `docs/living-memory-user-guide.md`
**Audience:** Both non-technical end users and developers, layered
**Approach:** Concept-first — build mental model with analogies, then add technical reference

### Part 1 — Conceptual (non-technical)

1. **What is Living Memory?** — One paragraph overview. Library analogy: books checked out regularly stay on main shelves, unread books move to back room, librarian periodically asks what to keep/archive/remove.

2. **The Three Tiers** — Plain-language table: Trusted (40+, always available), Probationary (10-39, available but flagged as fading), Sunset (<10, hidden until reviewed).

3. **How Memories Stay Alive** — Boosting: +5 per recall event, daily cap of 2, ceiling at 100. Frequently used knowledge stays trusted indefinitely.

4. **How Memories Fade** — Decay: 30-day grace period, then stepped penalties. Survivorship table by source type (manual ~6mo, frontmatter ~4mo, auto-matched ~3mo, threshold-promoted ~2mo).

5. **Triage: The Curation Moment** — `/memory:triage` as periodic review. Three actions: keep (+20 boost), archive (preserved but hidden), delete (permanent). System never deletes on its own.

6. **How New Memories Form** — Harvest pipeline: plugins detect repeated mentions. 3+ mentions from 2+ plugins triggers auto-promotion to real entry at importance 15.

### Part 2 — Technical Reference (developers)

7. **Lifecycle Fields Reference** — Table of 5 YAML frontmatter fields: importance, lifecycle_status, source, last_recalled, recall_count.

8. **Decay Math** — Exact stepped threshold table with cumulative penalties.

9. **CLI Commands** — Complete reference for all `forge memory` subcommands.

10. **Telemetry** — What `memory/telemetry.json` tracks and how to read it.

## Document 2: AI Migration Runbook

**File:** `docs/living-memory-migration-runbook.md`
**Audience:** AI agents performing migration
**Approach:** Sequential runbook with deterministic steps

### Structure

1. **Purpose & Scope** — Migrate legacy `.md` entries (lacking lifecycle fields) in memory/people/, memory/projects/, memory/glossary/.

2. **Prerequisites** — forge-lib installed, CLI functional, memory directories populated.

3. **Migration Steps:**
   - **Step 1: Inventory** — Scan directories, list entries missing lifecycle fields, output count.
   - **Step 2: Classify Source** — Examine content to determine source value (manual/frontmatter/auto-matched/threshold-promoted) based on content richness and provenance.
   - **Step 3: Score Importance** — Intelligent scoring:
     - Start from source baseline (manual=70, frontmatter=45, auto-matched=25, threshold-promoted=15)
     - Recency bonus: updated within 30 days +10, within 60 days +5
     - Content richness: >200 words +5, >500 words +10
     - Role significance: leadership titles +5
     - Cap at 85 (reserve 86-100 for earned recall)
     - Derive lifecycle_status from final score
   - **Step 4: Set Recall Fields** — last_recalled = updated date, recall_count = 0.
   - **Step 5: Update Entries** — Add 5 lifecycle fields to YAML frontmatter, preserve existing content.
   - **Step 6: Validate** — Run `forge memory decay --directory .` to confirm parsing.
   - **Step 7: Report** — Migration summary with counts by source and status.

4. **Scoring Decision Table** — Quick-reference for mechanical scoring.

5. **Examples: Before & After** — 2-3 concrete entries (person, project, glossary) with legacy/migrated YAML and scoring rationale.

6. **Edge Cases** — Missing updated date (use created), malformed frontmatter (skip and report), partial lifecycle fields (preserve existing, fill missing).
