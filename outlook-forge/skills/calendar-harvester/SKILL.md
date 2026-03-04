---
name: calendar-harvester
description: Guidance for extracting meeting preparation items and scheduling tasks from local Outlook calendar transcript files.
---

# Calendar Harvester

Use this skill when analyzing local calendar transcript snapshots to identify meeting prep needs and scheduling tasks.

## Scope

- Input is transcript text from `outlook-forge/transcripts/*.md` with `source: calendar`.
- Do not navigate Chrome or fetch web data directly.
- Process upcoming events for meeting-prep, past events are handled by meeting-harvester.

## Meeting-Prep Signals

- External attendees (non-company email domains)
- Attached agendas or description with specific topics
- Meetings > 30 minutes with named topics (not generic "sync" or "standup")
- First-time meetings with new contacts
- Meetings with senior leadership or cross-functional stakeholders
- Presentations or demos (user is presenting)

## Task Signals

- Pre-meeting deliverables: "Please prepare...", "Bring your estimates", "Review the doc before"
- Scheduling conflicts that need resolution
- Meetings that need to be rescheduled or confirmed
- Follow-up meetings that need to be booked

## Filter Out

- All-day events (holidays, OOO blocks, reminders)
- Recurring standups with no specific agenda
- Focus time blocks
- Tentative/declined events
- Events that have already passed (routed to meeting-harvester instead)

## Confidence

- `high`: external attendees + agenda, presentation/demo, senior leadership meeting with specific topic
- `medium`: internal meeting with agenda but routine topic, meeting > 30 min with vague description
- `low`: internal sync with no agenda, short meeting with generic title

## Title Rules

- For meeting-prep: "Prepare for {meeting title} with {key attendee}"
- For tasks: "Resolve scheduling conflict: {meeting A} vs {meeting B}"
- Keep concise — max 80 characters

## Provenance Requirements

For each extracted item, preserve:
- `source_channel`: "calendar"
- `source_channel_id`: "calendar"
- `source_author`: meeting organizer name or email
- `source_timestamp`: meeting start time
- Supporting detail from event description/attendees

## Output Quality Rules — Meeting-Prep

Content must include:
1. **Meeting context** — what the meeting is about, who organized it, key attendees
2. **Prep checklist** — specific items to prepare, documents to review, questions to consider
3. **Attendee context** — for external attendees, note their role/company if visible

Action items should be prep-oriented: "Review Q2 budget spreadsheet before meeting", "Prepare 3 slides on migration timeline for Architecture Review".

## Output Quality Rules — Tasks

Same as email-harvester: What, Who, Why, When. 2-3 sentences minimum.

## Temporal Rules

- Only create meeting-prep for future events (today and beyond)
- Past events should be skipped (meeting-harvester handles those)
- For "today" events, only create prep if the event hasn't started yet
