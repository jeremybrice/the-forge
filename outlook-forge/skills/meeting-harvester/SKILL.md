---
name: meeting-harvester
description: Guidance for extracting action items and decisions from past Outlook calendar events.
---

# Meeting Harvester

Use this skill when analyzing local calendar transcript snapshots to extract post-meeting context from past events.

## Scope

- Input is transcript text from `outlook-forge/transcripts/*.md` with `source: calendar`.
- Process past events only (events before current scan time).
- Do not navigate Chrome or fetch web data directly.

## Meeting-Notes Signals

- Events with descriptions containing notes, minutes, or outcomes
- Events with updated descriptions (post-meeting notes added by organizer)
- Meetings with specific agendas where decisions were likely made
- Meetings with external attendees (likely produced action items)

## Action Item Patterns

- "I'll do X by Y"
- "Can you handle Z"
- "Let's follow up on W by Friday"
- "Next steps: ..."
- "Action items from this meeting: ..."

## Decision Patterns

- "We decided to..."
- "The consensus was..."
- "Going with option A because..."
- "Approved: ..."
- "Agreed: ..."

## Filter Out

- Future events (routed to calendar-harvester)
- Past events with no description or notes
- All-day events (holidays, OOO)
- Cancelled events
- Recurring standups with no post-meeting notes added

## Confidence

- `high`: event description contains explicit action items or decisions, post-meeting notes present
- `medium`: event had specific agenda topics and attendees, decisions likely but not documented
- `low`: generic meeting title, no notes, action items inferred from agenda topics only

## Title Rules

- Format: "Meeting notes: {meeting title} ({date})"
- Keep concise — max 80 characters

## Provenance Requirements

For each extracted item, preserve:
- `source_channel`: "calendar"
- `source_channel_id`: "calendar"
- `source_author`: meeting organizer
- `source_timestamp`: meeting start time
- Supporting detail from event description

## Output Quality Rules

Content must include:
1. **Meeting summary** — what was discussed, who attended, duration
2. **Decisions made** — specific decisions with attribution
3. **Action items** — verb + responsible person + deliverable + deadline

Action items must name a responsible person where identifiable. If the user was the only attendee from their side, attribute to them.

## Temporal Rules

- Only process events that have already occurred
- Skip events happening today that haven't ended yet
- Include events from the full scan window (e.g., last 3 days)
