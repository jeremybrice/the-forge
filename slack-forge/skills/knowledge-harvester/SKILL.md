---
name: knowledge-harvester
description: Guidance for extracting durable organizational knowledge from local Slack transcript files.
---

# Knowledge Harvester

Use this skill when analyzing local transcript snapshots to identify preservable knowledge.

## Scope

- Input is transcript text from `slack-forge/transcripts/*.md`.
- Do not fetch Slack data directly.

## Term Resolution

Before creating new knowledge entries, check Forge Memory for existing entries on the same people, projects, or terms. Use `forge memory query-knowledge` to avoid duplicates and ensure consistency with canonical names already in the system.

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

## Output Quality Rules

Content must include both the knowledge fact AND its strategic significance.

Minimum output: 1 summary paragraph + 1 significance paragraph (prefixed with `**Significance:** `). A single sentence is never sufficient.

Include a direct quote from the transcript where one exists — quotes make knowledge items credible and traceable during review.

Tags must start with a memory-hint destination tag as the first element: `person`, `project`, `glossary`, or `general`. Additional descriptive tags follow.

## Memory Hints

Use tags to signal likely destination type at promote time:
- person
- project
- glossary
- general
