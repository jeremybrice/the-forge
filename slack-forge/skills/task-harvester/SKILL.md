---
name: task-harvester
description: Guidance for extracting actionable tasks from local Slack transcript files.
---

# Task Harvester

Use this skill when analyzing local transcript snapshots to identify actionable tasks.

## Scope

- Input is transcript text from `slack-forge/transcripts/*.md`.
- Do not fetch Slack data directly.

## Task Signals

- Direct requests: "Can you...", "Please...", "@name do X"
- Commitments: "I'll handle...", "I'll deliver by..."
- Deadlines/time pressure: "By Friday", "Before launch"
- Explicit markers: "TODO", "Action item", "Next step"
- Clear implied ownership from escalation/follow-up context

## Non-Tasks

- Casual/social chat
- Vague ideas with no action or owner
- Already completed work updates
- Pure information-seeking questions

## Confidence

- `high`: explicit ask with owner/deadline
- `medium`: implied action, weaker assignment
- `low`: speculative or unclear ownership

## Title Rules

- Start with a verb.
- Keep concise.
- Preserve key nouns (project/system names).

## Provenance Requirements

For each extracted task, preserve:
- source channel name and ID
- source author
- source timestamp
- supporting transcript quote/context

## Deduplication

Merge duplicate mentions of the same task across transcript files/windows when core action is identical.
