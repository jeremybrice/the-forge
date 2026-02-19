---
name: knowledge-harvester
description: Guidance for extracting durable organizational knowledge from local Slack transcript files.
---

# Knowledge Harvester

Use this skill when analyzing local transcript snapshots to identify preservable knowledge.

## Scope

- Input is transcript text from `slack-forge/transcripts/*.md`.
- Do not fetch Slack data directly.

## Knowledge Signals

- Decisions and rationale
- Process or policy changes
- Ownership/responsibility changes
- Project milestone/scope updates
- Terminology/acronym definitions
- Durable architecture/technical context

## Filter Out

- Social/casual chat
- Ephemeral status chatter
- Acknowledgments without content
- Repetitive bot noise with no decision context

## Durability Test

Keep items likely useful in 2+ weeks.

## Confidence

- `high`: explicit decision/announcement
- `medium`: strong contextual insight
- `low`: tentative/speculative statements

## Provenance Requirements

For each extracted knowledge item, preserve:
- source channel name and ID
- source author
- source timestamp
- supporting transcript quote/context

## Memory Hints

Use tags to signal likely destination type at promote time:
- person
- project
- glossary
- general
