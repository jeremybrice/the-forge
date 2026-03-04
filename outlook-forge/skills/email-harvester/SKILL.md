---
name: email-harvester
description: Guidance for extracting actionable tasks and durable knowledge from local Outlook email transcript files.
---

# Email Harvester

Use this skill when analyzing local email transcript snapshots to identify actionable tasks and preservable knowledge.

## Scope

- Input is transcript text from `outlook-forge/transcripts/*.md` with `source: inbox` or `source: sent`.
- Do not navigate Chrome or fetch web data directly.

## Task Signals

- Direct requests: "Please...", "Can you...", "Action needed:", "I need you to..."
- Deadlines: "By Friday", "Before end of day", "Due date:", "Deadline:"
- Approval requests: "Please review and approve", "Waiting for your sign-off"
- Escalations: "Urgent:", "High priority", "ASAP", forwarded chains with "FYI — thoughts?"
- Commitments from the user: "I'll handle...", "I'll send by..."
- Clear ownership: email addressed directly to user with specific ask

## Knowledge Signals

- Decisions communicated: "We've decided to...", "Going forward, we will..."
- Policy or process changes: "New process:", "Updated procedure:", "Effective immediately"
- Organizational changes: role changes, team restructures, reporting line updates
- Project scope or milestone updates: "Scope change:", "Milestone reached:", "Phase complete"
- Technical decisions: architecture choices, vendor selections, tool adoptions

## Filter Out

- Newsletter and marketing emails
- Automated notifications without actionable content (system alerts, CI/CD, shipping confirmations)
- CC'd FYI threads where the user has no action
- Calendar invites (handled by calendar-harvester)
- Thread replies that are pure acknowledgments ("Thanks!", "Got it", "Sounds good")
- Out-of-office auto-replies

## Confidence

- `high`: explicit request with deadline or owner, sent directly to user
- `medium`: implied action, user CC'd but content is relevant, forwarded with "thoughts?"
- `low`: informational email that might contain buried action items, long thread with unclear ownership

## Title Rules

- Start with a verb for tasks: "Submit Q2 budget estimates", "Review API migration proposal"
- Start with a noun for knowledge: "Q2 budget process change", "API migration decision"
- Keep concise — max 80 characters
- Preserve key nouns (project names, people, systems)

## Provenance Requirements

For each extracted item, preserve:
- `source_channel`: the mail folder name (e.g., "inbox", "sent")
- `source_channel_id`: same as source_channel
- `source_author`: sender email address
- `source_timestamp`: email date/time from transcript
- Supporting quote from email body

## Output Quality Rules — Tasks

Content must answer: **What?** (the action), **Who?** (sender and intended owner), **Why?** (business context), **When?** (deadline or urgency).

Minimum: 2-3 sentences of narrative context. A one-liner is never sufficient.

Action items must be specific: verb + responsible person + deliverable.

## Output Quality Rules — Knowledge

Content must include a summary paragraph AND a significance paragraph prefixed with `**Significance:** `.

Tags must start with a memory-hint destination tag: `person`, `project`, `glossary`, or `general`.

## Deduplication

Merge duplicate mentions across email threads. A reply chain about the same action item = one harvest, not three.
