---
name: weekly-memory-triage
schedule: monday 9:00
action: forge memory decay && forge memory triage-report
description: Run decay and generate triage summary for review
enabled: true
created: 2026-02-26
---

# Weekly Memory Triage

Runs every Monday at 9:00 AM. Applies decay to all memory entries and generates
a triage report of entries needing attention.

Review the report output and run `/memory:triage` to curate entries.
