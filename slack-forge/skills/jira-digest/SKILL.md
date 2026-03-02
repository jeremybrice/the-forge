---
name: jira-digest
description: Guidance for parsing JIRA bot activity from local transcript files and producing actionable digests.
---

# JIRA Digest

Use this skill when analyzing local JIRA transcript snapshots.

## Scope

- Input is transcript text from `slack-forge/transcripts/*jira*.md`.
- Do not fetch JIRA/Slack data directly.

## Event Types

- assignment
- status_change
- comment
- mention
- created
- priority_change
- sprint_change
- resolution

## Extraction

For each event capture:
- `ticket`
- `event_type`
- `summary`
- `needs_action`

## Prioritization

- Surface actionable items first.
- Group events by ticket.
- Summarize high-volume/noisy changes.

## Actionability Rules

`needs_action: true` for:
- direct assignment to user/team
- explicit mentions/review requests
- blockers requiring intervention

Default informational events to `false`.

## Confidence

- `high`: clear ticket reference with full event context
- `medium`: partial parse — ticket identified but event type or summary unclear
- `low`: ambiguous message, no clear ticket reference, or noise that could be JIRA-related

## Digest Structure

Structure the digest content as an executive briefing:

1. **Lead with actionable items** — tickets needing user decisions, blocked items, assignments directed at the user. One paragraph per item explaining what and why.
2. **Group informational events** by category — status transitions (grouped by outcome: Done, In Progress, rework), assignments, comments. Use bullet lists.
3. **End with "Key Tickets to Watch"** — 3-5 strategically important tickets with a sentence of business context each (external dependencies, cross-team impact, product decisions).
4. **Summarize high-volume noise** rather than listing every event — "12 QA Subtasks created for sprint validation" is better than listing all 12.

Title format: `"JIRA Digest — {date} ({timeframe})"`

Never use "Untitled" as the title.

## Provenance Requirements

For each digest record, preserve:
- source channel name and ID
- source author (bot username that posted the event)
- source timestamp (timestamp of first event in the digest window)
- transcript evidence mapping each `jira_event` entry to a specific message
