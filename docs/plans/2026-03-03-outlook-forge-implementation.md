# Outlook-Forge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the outlook-forge plugin that uses Claude in Chrome to extract calendar and email context from Outlook Web, processing it through the slack-forge harvest pipeline pattern.

**Architecture:** New marketplace plugin with 5 commands, 3 agents, 3 skills, and a forge-shell view controller. Scan command uses Claude in Chrome to navigate `outlook.office.com` and write local transcript files. Capture dispatches harvester subagents. Review and promote mirror slack-forge exactly. No forge-lib changes needed — reuses existing harvest infrastructure.

**Tech Stack:** Claude in Chrome (browser automation), forge-lib CLI (Python), forge-shell (Tauri + vanilla JS/CSS)

**Design Doc:** `docs/plans/2026-03-03-outlook-forge-design.md`

---

## Task 1: Plugin Scaffolding

**Files:**
- Create: `outlook-forge/.claude-plugin/plugin.json`
- Create: `outlook-forge/commands/` (directory)
- Create: `outlook-forge/agents/` (directory)
- Create: `outlook-forge/skills/` (directory)

**Step 1: Create plugin.json**

```json
{
  "name": "outlook-forge",
  "version": "2.1.0-alpha",
  "description": "Outlook intelligence harvester — scans calendar and inbox via Chrome for tasks, knowledge, and meeting context. Creates review-first harvest records. Delegates all file operations to forge-lib.",
  "author": { "name": "Jeremy Brice" }
}
```

**Step 2: Create directory structure**

```bash
mkdir -p outlook-forge/.claude-plugin
mkdir -p outlook-forge/commands
mkdir -p outlook-forge/agents
mkdir -p outlook-forge/skills/email-harvester
mkdir -p outlook-forge/skills/calendar-harvester
mkdir -p outlook-forge/skills/meeting-harvester
```

**Step 3: Write plugin.json**

Write the JSON from step 1 to `outlook-forge/.claude-plugin/plugin.json`.

**Step 4: Commit**

```bash
git add outlook-forge/
git commit -m "feat(outlook-forge): scaffold plugin directory structure"
```

---

## Task 2: Email Harvester Skill

**Files:**
- Create: `outlook-forge/skills/email-harvester/SKILL.md`

**Step 1: Write the skill**

```markdown
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
```

**Step 2: Commit**

```bash
git add outlook-forge/skills/email-harvester/
git commit -m "feat(outlook-forge): add email-harvester skill"
```

---

## Task 3: Calendar Harvester Skill

**Files:**
- Create: `outlook-forge/skills/calendar-harvester/SKILL.md`

**Step 1: Write the skill**

```markdown
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
```

**Step 2: Commit**

```bash
git add outlook-forge/skills/calendar-harvester/
git commit -m "feat(outlook-forge): add calendar-harvester skill"
```

---

## Task 4: Meeting Harvester Skill

**Files:**
- Create: `outlook-forge/skills/meeting-harvester/SKILL.md`

**Step 1: Write the skill**

```markdown
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
```

**Step 2: Commit**

```bash
git add outlook-forge/skills/meeting-harvester/
git commit -m "feat(outlook-forge): add meeting-harvester skill"
```

---

## Task 5: Email Harvester Agent

**Files:**
- Create: `outlook-forge/agents/forge-email-harvester.md`

**Step 1: Write the agent**

Reference: `slack-forge/agents/forge-task-harvester.md` and `slack-forge/agents/forge-knowledge-harvester.md` — this agent combines both roles for email transcripts.

```markdown
---
name: forge-email-harvester
description: Local transcript scanner that identifies actionable tasks and durable knowledge from Outlook email transcripts and creates harvest records.
tools:
  - Read
  - Grep
  - Glob
  - Bash
skills:
  - email-harvester
---

# Forge Email Harvester

You are the Email Harvester in the Outlook Forge capture pipeline.

## Assignment

1. Read local email transcript files under `outlook-forge/transcripts/` provided in the capture brief.
2. Identify actionable tasks and preservable knowledge using `email-harvester` skill rules.
3. Create one harvest record per item via `forge harvest create`.
4. Return a concise summary table of results.

## Input Scope

You must read transcript files only.

Do not navigate Chrome or fetch web data.

## Task Harvest Creation

```bash
forge harvest create "{task_title}" --harvest-type task --data '{
  "source_channel": "{folder_name}",
  "source_channel_id": "{folder_name}",
  "source_author": "{sender_email}",
  "source_timestamp": "{email_timestamp}",
  "scan_timeframe": "{timeframe}",
  "scan_date": "{scan_date}",
  "confidence": "{high|medium|low}",
  "tags": ["{tag1}", "{tag2}"],
  "content": "{extracted task summary}",
  "source_context": "{supporting email quote with attribution}",
  "action_items": ["{verb + responsible person + deliverable}"]
}'
```

## Knowledge Harvest Creation

```bash
forge harvest create "{knowledge_title}" --harvest-type knowledge --data '{
  "source_channel": "{folder_name}",
  "source_channel_id": "{folder_name}",
  "source_author": "{sender_email}",
  "source_timestamp": "{email_timestamp}",
  "scan_timeframe": "{timeframe}",
  "scan_date": "{scan_date}",
  "confidence": "{high|medium|low}",
  "tags": ["{tag1}", "{tag2}"],
  "content": "{knowledge summary with significance}",
  "source_context": "{supporting email quote with attribution}"
}'
```

## Content Quality Requirements — Tasks

The `content` field must be a **narrative paragraph** (2-3 sentences minimum) answering:

1. **What** — the specific task or action required
2. **Who** — who sent the email, who should act
3. **Why** — business context or trigger
4. **When** — deadline or urgency

**Example of good content:**
> Alice sent a high-priority email requesting all department leads submit their Q2 budget estimates by Friday COB. The attached spreadsheet needs to be filled with projected costs for headcount, tools, and travel. This is part of the annual budget cycle; finance needs consolidated numbers by Monday for the board presentation.

**Example of bad content (do NOT produce this):**
> Submit Q2 budget.

The `source_context` field must include a direct quote from the email with sender and date attribution.

The `action_items` array: each item starts with a verb and names a responsible person. Example: `"Submit Q2 budget estimates to Alice by Friday COB"`.

## Content Quality Requirements — Knowledge

The `content` field must contain:

1. **Summary** — paragraph explaining what was decided, announced, or clarified
2. **Significance** — paragraph prefixed with `**Significance:** ` explaining long-term importance

Tags must start with a memory-hint destination tag: `person`, `project`, `glossary`, or `general`.

## Anti-Patterns

- Do NOT paste raw email text as the content summary — synthesize it.
- Do NOT produce one-line summaries without business context.
- Do NOT harvest newsletter or marketing emails.
- Do NOT create separate harvests for each reply in a thread — deduplicate to one harvest per action/decision.
- Do NOT omit `action_items` on task harvests — every task must have at least one.
- Do NOT invent section headers — the template provides `## Extracted Content`, `## Source Context`, and `## Action Items`.

## Rules

1. Use transcript evidence only.
2. Preserve provenance fields for every harvest.
3. Deduplicate across email threads — one harvest per distinct action or decision.
4. Skip newsletters, notifications, acknowledgments, and auto-replies.

## Output

Provide:
- files scanned
- task harvests created
- knowledge harvests created
- skipped/noise counts
- any errors
```

**Step 2: Commit**

```bash
git add outlook-forge/agents/forge-email-harvester.md
git commit -m "feat(outlook-forge): add email harvester agent"
```

---

## Task 6: Calendar Harvester Agent

**Files:**
- Create: `outlook-forge/agents/forge-calendar-harvester.md`

**Step 1: Write the agent**

```markdown
---
name: forge-calendar-harvester
description: Local transcript scanner that identifies meeting preparation needs and scheduling tasks from Outlook calendar transcripts.
tools:
  - Read
  - Grep
  - Glob
  - Bash
skills:
  - calendar-harvester
---

# Forge Calendar Harvester

You are the Calendar Harvester in the Outlook Forge capture pipeline.

## Assignment

1. Read local calendar transcript files under `outlook-forge/transcripts/` provided in the capture brief.
2. Identify upcoming meetings needing preparation and scheduling tasks using `calendar-harvester` skill rules.
3. Create one harvest record per item via `forge harvest create`.
4. Return a concise summary table of results.

## Input Scope

You must read transcript files only. Process **future events only** — past events are handled by the meeting-harvester agent.

Do not navigate Chrome or fetch web data.

## Meeting-Prep Harvest Creation

```bash
forge harvest create "{prep_title}" --harvest-type meeting-prep --data '{
  "source_channel": "calendar",
  "source_channel_id": "calendar",
  "source_author": "{organizer}",
  "source_timestamp": "{meeting_start_time}",
  "scan_timeframe": "{timeframe}",
  "scan_date": "{scan_date}",
  "confidence": "{high|medium|low}",
  "tags": ["{tag1}", "{tag2}"],
  "content": "{meeting context and prep checklist}",
  "source_context": "{event details: attendees, location, description}",
  "action_items": ["{prep item: verb + deliverable}"]
}'
```

## Task Harvest Creation

For scheduling tasks (conflicts, rescheduling needs):

```bash
forge harvest create "{task_title}" --harvest-type task --data '{
  "source_channel": "calendar",
  "source_channel_id": "calendar",
  "source_author": "{organizer}",
  "source_timestamp": "{meeting_start_time}",
  "scan_timeframe": "{timeframe}",
  "scan_date": "{scan_date}",
  "confidence": "{high|medium|low}",
  "tags": ["scheduling", "{tag2}"],
  "content": "{scheduling task summary}",
  "source_context": "{conflicting event details}",
  "action_items": ["{verb + action to resolve}"]
}'
```

## Content Quality Requirements — Meeting-Prep

The `content` field must include:

1. **Meeting context** — what the meeting is about, who organized it, when it is, key attendees and their roles
2. **Prep checklist** — specific items to prepare, documents to review, questions to bring
3. **Attendee context** — for external attendees, note their company/role if visible from the transcript

**Example of good content:**
> Architecture Review with Dave and external partner john@partner.com scheduled for Tuesday March 4 at 11:00 AM (1 hour). The meeting covers proposed API changes for the Q2 migration. Agenda items: current state review, migration timeline, risk assessment.
>
> **Prep items:** Review current API documentation. Prepare migration timeline slide with updated estimates. List top 3 risk factors for discussion. Research partner company's integration requirements.

**Example of bad content (do NOT produce this):**
> Meeting with Dave on Tuesday.

The `action_items` array should contain prep tasks: `"Review Q2 migration timeline document"`, `"Prepare risk assessment summary for Architecture Review"`.

## Anti-Patterns

- Do NOT create meeting-prep for routine standups with no agenda.
- Do NOT create meeting-prep for all-day events, OOO blocks, or focus time.
- Do NOT create meeting-prep for past events — those go to meeting-harvester.
- Do NOT produce one-line summaries — always include attendees and prep items.
- Do NOT invent section headers — the template provides `## Extracted Content`, `## Source Context`, and `## Action Items`.

## Rules

1. Use transcript evidence only.
2. Preserve provenance fields for every harvest.
3. Only process future events (today and beyond, not yet started).
4. Skip all-day events, declined events, cancelled events.

## Output

Provide:
- files scanned
- meeting-prep harvests created
- task harvests created (scheduling)
- skipped/filtered counts
- any errors
```

**Step 2: Commit**

```bash
git add outlook-forge/agents/forge-calendar-harvester.md
git commit -m "feat(outlook-forge): add calendar harvester agent"
```

---

## Task 7: Meeting Harvester Agent

**Files:**
- Create: `outlook-forge/agents/forge-meeting-harvester.md`

**Step 1: Write the agent**

```markdown
---
name: forge-meeting-harvester
description: Local transcript scanner that extracts action items and decisions from past Outlook calendar events.
tools:
  - Read
  - Grep
  - Glob
  - Bash
skills:
  - meeting-harvester
---

# Forge Meeting Harvester

You are the Meeting Harvester in the Outlook Forge capture pipeline.

## Assignment

1. Read local calendar transcript files under `outlook-forge/transcripts/` provided in the capture brief.
2. Identify past events with meaningful content using `meeting-harvester` skill rules.
3. Create meeting-notes harvest records via `forge harvest create`.
4. Return a concise summary table of results.

## Input Scope

You must read transcript files only. Process **past events only** — future events are handled by the calendar-harvester agent.

Do not navigate Chrome or fetch web data.

## Meeting-Notes Harvest Creation

```bash
forge harvest create "{title}" --harvest-type meeting-notes --data '{
  "source_channel": "calendar",
  "source_channel_id": "calendar",
  "source_author": "{organizer}",
  "source_timestamp": "{meeting_start_time}",
  "scan_timeframe": "{timeframe}",
  "scan_date": "{scan_date}",
  "confidence": "{high|medium|low}",
  "tags": ["{tag1}", "{tag2}"],
  "content": "{meeting summary with decisions and action items}",
  "source_context": "{event details and any notes from description}",
  "action_items": ["{verb + responsible person + deliverable + deadline}"]
}'
```

## Content Quality Requirements

The `content` field must include:

1. **Meeting summary** — what was discussed, who attended, duration, key topics covered
2. **Decisions made** — specific decisions with attribution (who decided what)
3. **Action items** — verb + responsible person + deliverable + deadline where available

**Example of good content:**
> Architecture Review held Tuesday March 4 at 11:00 AM with Dave, john@partner.com, and 3 internal team members (1 hour). Reviewed proposed API changes for Q2 migration. Key topics: current state gaps, revised timeline, risk factors.
>
> **Decisions:** Agreed to extend migration timeline by 2 weeks to accommodate partner integration testing. Selected REST over GraphQL for the new endpoints based on partner's existing tooling.
>
> **Follow-ups:** Dave to update the migration timeline document by Wednesday. Jeremy to schedule partner integration testing kickoff. John to share API test suite documentation by end of week.

**Example of bad content (do NOT produce this):**
> Had architecture meeting. Discussed migration.

The `action_items` array must name responsible people: `"Dave to update migration timeline document by Wednesday"`, `"Jeremy to schedule partner integration testing kickoff"`.

## Anti-Patterns

- Do NOT create meeting-notes for future events — those go to calendar-harvester.
- Do NOT create meeting-notes for events with no description or meaningful content.
- Do NOT create meeting-notes for all-day events, OOO, or cancelled events.
- Do NOT invent decisions or action items — only extract what's in the transcript.
- Do NOT invent section headers — the template provides `## Extracted Content`, `## Source Context`, and `## Action Items`.

## Rules

1. Use transcript evidence only.
2. Preserve provenance fields for every harvest.
3. Only process past events (events that have already ended).
4. Skip events with empty descriptions and no post-meeting notes.
5. Attribute action items to specific people where identifiable.

## Output

Provide:
- files scanned
- meeting-notes harvests created
- skipped/filtered counts
- any errors
```

**Step 2: Commit**

```bash
git add outlook-forge/agents/forge-meeting-harvester.md
git commit -m "feat(outlook-forge): add meeting harvester agent"
```

---

## Task 8: Init Command

**Files:**
- Create: `outlook-forge/commands/init.md`

**Step 1: Write the command**

```markdown
---
description: Discover Outlook folders and calendars via Chrome and configure what to monitor for intelligence harvesting
---

# Init Command

Initialize outlook-forge and configure scan sources using Claude in Chrome and forge-lib.

**Requires:** Chrome connection (`claude --chrome` or `/chrome`)

## Instructions

### 1. Check Current State

Check if `outlook-forge/` directory exists in the current working directory.

If it exists, load current config:

```bash
forge harvest config --get --plugin outlook-forge
```

Check the `success` field in the JSON response. If `success` is `true` and sources are configured, inform the user:

```
Outlook Forge already initialized.
- Sources monitored: {count}
- Last updated: {updated}

Would you like to update your source configuration? (yes/no)
```

If user says no, show next steps and exit:
```
- To scan: /outlook-forge:scan
- To capture harvests from transcripts: /outlook-forge:capture
- To review harvests: /outlook-forge:review
```

If user says yes, proceed to step 3 (source discovery).

If `outlook-forge/` does not exist, proceed to step 2.

### 2. Initialize Directory

Run forge-lib to create the outlook-forge directory structure:

```bash
forge harvest init --plugin outlook-forge
```

Check the `success` field. If `success` is `false`, report the `error` field and stop.

Also create the transcripts directory:

```bash
mkdir -p outlook-forge/transcripts
```

### 3. Verify Chrome Connection

Check that Chrome is connected:
- If Chrome is not connected, prompt: `Chrome connection required. Run /chrome to connect, then retry /outlook-forge:init.`
- If Chrome is connected, proceed.

### 4. Discover Sources via Chrome

Navigate to `outlook.office.com` in Chrome.

**Discover mail folders:**
1. Navigate to `outlook.office.com/mail`
2. Read the folder list from the left sidebar (Inbox, Sent Items, Drafts, etc.)
3. Note any custom folders the user has created

**Discover calendars:**
1. Navigate to `outlook.office.com/calendar`
2. Read the calendar list from the left sidebar (Calendar, shared calendars, etc.)

Collect all discovered sources.

### 5. Present Source List

```
Found sources in your Outlook account:

Mail Folders:
  1. Inbox
  2. Sent Items
  3. Drafts
  4. {custom folder 1}
  5. {custom folder 2}
  ...

Calendars:
  6. Calendar (default)
  7. {shared calendar}
  ...

Which sources would you like to monitor? (enter numbers, comma-separated)
Default recommendation: Inbox + Calendar
```

Let the user select sources. Default to Inbox + Calendar if user says "default" or presses enter.

### 6. Configure Defaults

Ask the user for scan defaults:

```
Configure scan defaults:

Calendar scan window (days forward): [3]
Inbox scan window (days back): [1]
Max items per scan: [20]

Press Enter to accept defaults, or type new values.
```

### 7. Save Configuration

Build the sources configuration. For each selected source:
```json
{"id": "inbox", "name": "Inbox", "type": "mail", "monitor": true}
```
```json
{"id": "calendar", "name": "Calendar", "type": "calendar", "monitor": true}
```

For custom mail folders:
```json
{"id": "folder:project-x", "name": "Project X", "type": "mail", "monitor": true}
```

Save via forge-lib:

```bash
forge harvest config --set-channels '[{sources_array_json}]' --plugin outlook-forge
```

Check `success`. If `false`, report error and stop.

### 8. Confirm Setup

```
Outlook Forge configured:
- Monitored sources: {count}
- Calendar window: {days}d forward
- Inbox window: {days}d back
- Max items per scan: {max}
- Config saved: outlook-forge/config.json

Next steps:
- Scan Outlook: /outlook-forge:scan
- Capture harvests: /outlook-forge:capture
- CLI: forge harvest --help
```

## Notes

- Initialization is idempotent (safe to run multiple times)
- Requires Chrome connected to a browser logged into outlook.office.com
- Config can be updated by re-running this command
```

**Step 2: Commit**

```bash
git add outlook-forge/commands/init.md
git commit -m "feat(outlook-forge): add init command"
```

---

## Task 9: Scan Command

**Files:**
- Create: `outlook-forge/commands/scan.md`

This is the most complex and unique command — it drives Chrome to navigate Outlook Web.

**Step 1: Write the command**

```markdown
---
description: Scan Outlook calendar and inbox via Chrome and write local transcript files
---

# Scan Command

You are the **primary-agent orchestrator** for Outlook Forge scanning. This command uses Claude in Chrome to navigate Outlook Web (`outlook.office.com`) and writes local transcript files under `outlook-forge/transcripts/`.

This command **does not** create harvest records.

**Requires:** Chrome connection (`claude --chrome` or `/chrome`)

## Instructions

### 1. Check Prerequisites

Check if `outlook-forge/` directory exists. If not:
```
Outlook Forge not initialized. Run /outlook-forge:init first.
```

Load configuration:

```bash
forge harvest config --get --plugin outlook-forge
```

If config is missing or sources are empty:
```
No sources configured. Run /outlook-forge:init to set up Outlook monitoring.
```

Ensure transcript directory exists:
```bash
mkdir -p outlook-forge/transcripts
```

Verify Chrome is connected. If not:
```
Chrome connection required. Run /chrome to connect, then retry /outlook-forge:scan.
```

### 2. Determine Scan Parameters

Parse command arguments. Supported parameters:

- `--source calendar|inbox|sent|folder:{name}` — which source to scan (required)
- `--days N` — number of days to scan (default: from config, typically 3 for calendar, 1 for inbox)
- `--max-items N` — max items to open and read in detail (default: from config, typically 20)
- `--unread-only` — for mail sources, only read unread messages

If no `--source` provided, prompt:

```
What would you like to scan?

1. Calendar (next {calendar_days} days)
2. Inbox (last {inbox_days} days)
3. Sent Items (last {inbox_days} days)
4. Specific folder
5. All monitored sources

Select (1-5):
```

If option 5 ("All monitored sources"), run scans sequentially for each source with `monitor: true` in config.

### 3. Ask Scan Execution Mode

```
How should I run this scan?

1. Scan only
2. Scan then ask before capture
3. Scan and auto-run capture

Select (1-3):
```

### 4. Present Scan Brief

```
Scan Brief:
- Source: {source}
- Time window: {days} days
- Max items: {max_items}
- Unread only: {yes/no}
- Mode: {scan_only | scan_then_ask | scan_and_auto_capture}

Proceed? (yes/no)
```

### 5. Execute Chrome Scan — Calendar

If source is `calendar`:

**Before writing the transcript, resolve its filename:**

```bash
forge transcript filename --scan-date {YYYY-MM-DD} --timeframe {N}d --type calendar --dir outlook-forge/transcripts
```

Use the returned filename exactly.

**Chrome navigation steps:**

1. Navigate to `outlook.office.com/calendar`
2. Ensure the view shows the correct date range:
   - For 1-3 days: use Day or Work Week view
   - For 7+ days: use Week or Month view
3. Read visible events from the calendar grid
4. For each event (up to `--max-items`):
   - Click on the event to open the detail popup/panel
   - Extract: title, start time, end time, attendees, location, description/body
   - Close the popup and move to the next event
5. Navigate forward if the date range extends beyond the visible view

**Write transcript with YAML frontmatter:**

```markdown
---
scan_date: {YYYY-MM-DD}
source: calendar
timeframe: {N}d
scan_run: {NNN from filename}
generated: {ISO 8601 timestamp}
---

## {Day of Week}, {Month Day, Year}

### {Start Time} - {End Time} | {Event Title}
- **Organizer:** {organizer name/email}
- **Attendees:** {comma-separated list}
- **Location:** {location or "Teams Meeting" or "No location"}
- **Description:** {event body/description, or "No description"}

### {Start Time} - {End Time} | {Event Title}
...

## {Next Day}
...
```

### 6. Execute Chrome Scan — Inbox/Sent/Folder

If source is `inbox`, `sent`, or `folder:{name}`:

**Resolve filename:**

```bash
forge transcript filename --scan-date {YYYY-MM-DD} --timeframe {N}d --type {source} --dir outlook-forge/transcripts
```

**Chrome navigation steps:**

1. Navigate to the appropriate URL:
   - `inbox` → `outlook.office.com/mail`
   - `sent` → `outlook.office.com/mail/sentitems`
   - `folder:{name}` → navigate to the named folder via the sidebar
2. Read the message list, noting subjects, senders, dates, and read/unread status
3. Apply time window filter: only process messages within the `--days` range
4. If `--unread-only`, skip read messages
5. For each message (up to `--max-items`):
   - Click on the message to open it in the reading pane
   - Extract: subject, sender, recipients (To/CC), date, priority, body text
   - Move to the next message
6. Scroll down the message list if more messages exist within the time window

**Write transcript with YAML frontmatter:**

```markdown
---
scan_date: {YYYY-MM-DD}
source: {inbox|sent|folder:{name}}
timeframe: {N}d
scan_run: {NNN from filename}
generated: {ISO 8601 timestamp}
---

## Unread ({count})

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
**To:** {recipients}
**CC:** {cc_recipients or omit if none}
**Priority:** {High|Normal|Low}
**Body:**
{email body text — first ~500 characters for long emails, full text for short ones}

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
...

## Read ({count} most recent)

### [{YYYY-MM-DD HH:MM}] From: {sender_email} | Subject: {subject}
...
```

### 7. Present Scan Summary

```
Scan complete:
- Source: {source}
- Time window: {days} days
- Items scanned: {count}
- Transcript: {filename}

No harvest records created in scan mode.
```

### 8. Optional Capture Chaining

If mode `scan_then_ask`:
```
Transcripts are ready. Run /outlook-forge:capture now? (yes/no)
```
If yes, invoke `/outlook-forge:capture`.

If mode `scan_and_auto_capture`:
- Invoke `/outlook-forge:capture` immediately.

If mode `scan_only`:
```
To harvest tasks/knowledge/meeting items from these transcripts, run /outlook-forge:capture.
```

## Chrome Navigation Tips

- If Outlook prompts for re-authentication, pause and ask the user to log in manually, then continue.
- If a CAPTCHA appears, pause and ask the user to complete it.
- If the page is slow to load, wait for content to appear before extracting.
- Use visible text content — do not try to parse HTML or DOM structure directly.
- If an email is too long, capture the first ~500 characters and note "[truncated]".

## Notes

- `scan` is Chrome navigation + transcript generation only.
- Re-running scan is safe — sequential filenames prevent overwriting.
- Review and promotion happen after capture (`/outlook-forge:review`, `/outlook-forge:promote`).
```

**Step 2: Commit**

```bash
git add outlook-forge/commands/scan.md
git commit -m "feat(outlook-forge): add scan command with Chrome navigation"
```

---

## Task 10: Capture Command

**Files:**
- Create: `outlook-forge/commands/capture.md`

**Step 1: Write the command**

```markdown
---
description: Harvest tasks, knowledge, meeting prep, and meeting notes from local Outlook transcript files
---

# Capture Command

You are the orchestrator for local Outlook transcript harvesting. This command reads files in `outlook-forge/transcripts/` and creates harvest records via `forge harvest create`.

This command **must not** use Chrome or navigate web pages.

## Instructions

### 1. Check Prerequisites

Check `outlook-forge/` exists and is initialized.

Ensure transcript files exist:
- `outlook-forge/transcripts/`
- At least one `*.md` transcript

If transcripts are missing:
```
No transcript files found for capture. Run /outlook-forge:scan first.
```

### 2. Ask for Capture Scope

```
Which transcripts should I capture?

1. Most recent scan
2. Select by date

Select (1-2):
```

Resolve "most recent scan" by selecting transcript files with the most recent date prefix (`outlook-forge/transcripts/YYYY-MM-DD-*`). If multiple dates, use the latest. Within the same date and timeframe, select files with the highest `-NNN` sequence number.

Identify available transcripts by source type:
- Calendar transcripts (source: calendar)
- Inbox transcripts (source: inbox)
- Sent transcripts (source: sent)
- Folder transcripts (source: folder:*)

### 3. Dispatch Local-Only Subagents

Dispatch each sub-agent sequentially using the **Task tool** (`subagent_type: general-purpose`). In each brief, include:
- The agent name and its markdown path
- The resolved transcript file path(s)
- The scan timeframe label and scan date

Dispatch order:

1. **Email Harvester** (`forge-email-harvester`) — only if inbox/sent/folder transcripts exist
   - Agent file: `outlook-forge/agents/forge-email-harvester.md`
   - Reads inbox, sent, and folder transcript files
   - Creates `harvest_type: task` and `harvest_type: knowledge` records

2. **Calendar Harvester** (`forge-calendar-harvester`) — only if calendar transcript exists
   - Agent file: `outlook-forge/agents/forge-calendar-harvester.md`
   - Reads calendar transcript, processes future events only
   - Creates `harvest_type: meeting-prep` and `harvest_type: task` records

3. **Meeting Harvester** (`forge-meeting-harvester`) — only if calendar transcript exists
   - Agent file: `outlook-forge/agents/forge-meeting-harvester.md`
   - Reads calendar transcript, processes past events only
   - Creates `harvest_type: meeting-notes` records

Each subagent must:
- Parse transcript text only
- Create records using `forge harvest create`
- Include provenance fields (`source_channel`, `source_channel_id`, `source_author`, `source_timestamp`, `scan_timeframe`, `scan_date`)

### 4. Present Summary

```
Capture complete:
- Task harvests: {task_count}
- Knowledge harvests: {knowledge_count}
- Meeting-prep harvests: {prep_count}
- Meeting-notes harvests: {notes_count}
- Total harvest records created: {total}

All records are pending review.
Run /outlook-forge:review to approve or reject.
```

## Notes

- `capture` is local-file-only and safe for subagents.
- Use `/outlook-forge:scan` first to refresh transcript snapshots.
- `capture` can be run independently or chained from `scan`.
```

**Step 2: Commit**

```bash
git add outlook-forge/commands/capture.md
git commit -m "feat(outlook-forge): add capture command"
```

---

## Task 11: Review Command

**Files:**
- Create: `outlook-forge/commands/review.md`

**Step 1: Write the command**

This mirrors `slack-forge/commands/review.md` with adjusted harvest type grouping.

```markdown
---
description: Review pending harvest records — approve, reject, edit, or skip each item
---

# Review Command

Present pending harvest records for human review and disposition.

## Instructions

### 1. Query Pending Harvests

```bash
forge harvest query --status pending --plugin outlook-forge
```

Check `success`. If `false`, report `error` and stop.

If empty:
```
No pending harvest records found.
- To scan Outlook: /outlook-forge:scan
- To check all harvests: forge harvest query --plugin outlook-forge
```

### 2. Group by Harvest Type

Organize pending items into groups:
- **Tasks** — harvest_type: "task"
- **Knowledge** — harvest_type: "knowledge"
- **Meeting Prep** — harvest_type: "meeting-prep"
- **Meeting Notes** — harvest_type: "meeting-notes"

Present summary:
```
{total} pending harvest records to review:
- {task_count} tasks
- {knowledge_count} knowledge items
- {prep_count} meeting prep items
- {notes_count} meeting notes

Reviewing in order: Tasks → Knowledge → Meeting Prep → Meeting Notes
```

### 3. Review Each Item

For each pending item:

```
[{harvest_type}] {title}
- Source: {source_channel} from {source_author}
- Confidence: {confidence}
- Scanned: {scan_date} ({scan_timeframe})
- File: {filename}

{extracted content preview — first 3-5 lines of body}

Action? (A)pprove / (R)eject / (E)dit / (S)kip
```

Handle choices:

#### Approve
```bash
forge harvest update {filename} --data '{"status": "approved"}' --plugin outlook-forge
```

#### Reject
```bash
forge harvest update {filename} --data '{"status": "rejected"}' --plugin outlook-forge
```

#### Edit
Prompt for title and content changes, then:
```bash
forge harvest update {filename} --data '{"status": "approved", "title": "{new_title}"}' --plugin outlook-forge
```

#### Skip
Leave as pending. Move to next item.

### 4. Present Summary

```
Review complete:
- {approved_count} approved
- {rejected_count} rejected
- {skipped_count} skipped (still pending)

{if approved_count > 0}
Run /outlook-forge:promote to push approved items to tasks-forge, forge-memory, and product-forge.
{/if}
```

## Notes

- Review is interactive and requires user confirmation for each item
- Skipped items remain pending for next review
- Rejected items are terminal
- All transitions go through forge-lib for validation
```

**Step 2: Commit**

```bash
git add outlook-forge/commands/review.md
git commit -m "feat(outlook-forge): add review command"
```

---

## Task 12: Promote Command

**Files:**
- Create: `outlook-forge/commands/promote.md`

**Step 1: Write the command**

```markdown
---
description: Promote approved harvest records to tasks-forge, forge-memory, and product-forge
---

# Promote Command

Push approved harvest items to their destination plugins via forge-lib commands.

## Instructions

### 1. Query Approved Harvests

```bash
forge harvest query --status approved --plugin outlook-forge
```

Check `success`. If `false`, report `error` and stop.

If empty:
```
No approved harvest records found.
- To review pending items: /outlook-forge:review
- To scan Outlook: /outlook-forge:scan
```

### 2. Present Promotion Plan

```
{total} approved items ready for promotion:
- {task_count} tasks → tasks-forge
- {knowledge_count} knowledge items → forge-memory
- {prep_count} meeting prep → product-forge (prep cards)
- {notes_count} meeting notes → tasks-forge (follow-up tasks)

Proceed with promotion? (yes/no)
```

If no, exit without changes.

### 3. Promote Task Harvests

For each approved item with `harvest_type: "task"`:

1. Map fields:
   - `title` → task title
   - `confidence` → priority (high → "High", medium → "Medium", low → "Low")
   - `source_channel` + `source_author` → description provenance
   - `tags` → task tags

2. Create task:
   ```bash
   forge task create "{title}" --data '{
     "priority": "{mapped_priority}",
     "status": "Open",
     "description": "Harvested from Outlook {source_channel} by {source_author} on {scan_date}.\n\n{extracted_content}",
     "tags": [{tags}]
   }'
   ```
   Check `success`. If `false`, report error and skip (do not mark promoted).

3. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

4. Report: `[Task] "{title}" → {task_filename} (Open, {priority})`

### 4. Promote Knowledge Harvests

For each approved item with `harvest_type: "knowledge"`:

1. Determine knowledge type from content and tags:
   - First tag is memory-hint: `person`, `project`, `glossary`, or `general`
   - Default to `project` if no hint

2. Build knowledge entry name from title

3. Create:
   ```bash
   forge memory create-knowledge {type} "{name}" --data '{
     "source": "outlook-forge harvest from {source_channel}",
     "harvested_on": "{scan_date}"
   }'
   ```
   Check `success`. If `false`, report error and skip.

4. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

5. Report: `[Knowledge] "{title}" → memory/{type}/{slug}.md`

### 5. Promote Meeting-Prep Harvests

For each approved item with `harvest_type: "meeting-prep"`:

1. Create a product-forge card with the prep content:
   ```bash
   forge card create "{title}" --data '{
     "type": "decision",
     "status": "In Progress",
     "description": "Meeting preparation card.\n\n{extracted_content}\n\n**Source:** Outlook calendar, {source_author}, {source_timestamp}",
     "tags": ["meeting-prep", {tags}]
   }'
   ```
   Check `success`. If `false`, report error and skip.

2. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

3. Report: `[Meeting Prep] "{title}" → {card_filename}`

### 6. Promote Meeting-Notes Harvests

For each approved item with `harvest_type: "meeting-notes"`:

1. Create tasks for each action item in the harvest:
   ```bash
   forge task create "{action_item_title}" --data '{
     "priority": "Medium",
     "status": "Open",
     "description": "Follow-up from meeting: {harvest_title}\n\n{action_item_detail}\n\n**Source:** {source_timestamp}, organizer: {source_author}",
     "tags": ["meeting-followup", {tags}]
   }'
   ```
   Check `success`. If `false`, report error and continue with next action item.

2. Mark promoted:
   ```bash
   forge harvest update {filename} --data '{"status": "promoted"}' --plugin outlook-forge
   ```

3. Report: `[Meeting Notes] "{title}" → {count} follow-up tasks created`

### 7. Present Summary

```
Promotion complete:
- {task_promoted} tasks created in tasks-forge
- {knowledge_promoted} knowledge entries in forge-memory
- {prep_promoted} meeting prep cards in product-forge
- {notes_promoted} meeting follow-ups in tasks-forge
- {failed_count} items failed (still approved, retry with /outlook-forge:promote)

{if task_promoted > 0}
View tasks: forge task query --status Open
{/if}
{if knowledge_promoted > 0}
View knowledge: forge memory query-knowledge
{/if}
```

## Notes

- Promotion only processes approved items — run `/outlook-forge:review` first
- Failed promotions remain in "approved" status for retry
- Meeting-notes may create multiple tasks (one per action item)
- Meeting-prep creates product-forge decision cards for pre-meeting preparation
- All operations go through forge-lib for schema validation
```

**Step 2: Commit**

```bash
git add outlook-forge/commands/promote.md
git commit -m "feat(outlook-forge): add promote command"
```

---

## Task 13: Plugin README

**Files:**
- Create: `outlook-forge/README.md`

**Step 1: Write the README**

```markdown
# Outlook Forge

Outlook intelligence harvester for The Forge Marketplace. Scans your Outlook calendar and inbox via **Claude in Chrome** browser automation, extracts actionable tasks, knowledge, and meeting context, then routes approved items to downstream forge plugins.

## Requirements

- Claude in Chrome extension installed and connected
- Logged into `outlook.office.com` in Chrome
- Claude Code with `--chrome` flag or `/chrome` enabled
- forge-lib installed (`pip install -r forge-lib/requirements.txt`)

## Commands

| Command | Description |
|---------|-------------|
| `/outlook-forge:init` | Discover Outlook folders/calendars and configure scan sources |
| `/outlook-forge:scan` | Navigate Outlook Web via Chrome and write transcript files |
| `/outlook-forge:capture` | Dispatch harvester agents on local transcripts |
| `/outlook-forge:review` | Interactive review of pending harvests (A/R/E/S) |
| `/outlook-forge:promote` | Push approved items to tasks-forge, forge-memory, product-forge |

## Architecture

```
/outlook-forge:scan  (Chrome-primary, requires browser)
    └── Chrome navigates outlook.office.com
    └── Reads calendar events, inbox emails
    └── Writes outlook-forge/transcripts/*.md
    └── Optional: chains to /outlook-forge:capture

/outlook-forge:capture  (local orchestrator, no Chrome)
    └── Reads outlook-forge/transcripts/*.md
    └── Dispatches: forge-email-harvester (tasks + knowledge)
    └── Dispatches: forge-calendar-harvester (meeting-prep + scheduling tasks)
    └── Dispatches: forge-meeting-harvester (meeting-notes)
    └── All harvests created with status: pending

/outlook-forge:review  (interactive)
    └── forge harvest query --status pending
    └── A=approve / R=reject / E=edit / S=skip

/outlook-forge:promote  (routes by harvest type)
    └── task → forge task create (tasks-forge)
    └── knowledge → forge memory create-knowledge (forge-memory)
    └── meeting-prep → forge card create (product-forge)
    └── meeting-notes → forge task create per action item (tasks-forge)
```

## Harvest Types

| Type | Source | Content |
|------|--------|---------|
| `task` | emails, calendar | Action items with deadlines and owners |
| `knowledge` | emails | Decisions, policy changes, reference info |
| `meeting-prep` | calendar (future) | Preparation checklists for upcoming meetings |
| `meeting-notes` | calendar (past) | Post-meeting action items and decisions |

## Scan Parameters

```
/outlook-forge:scan --source calendar --days 3
/outlook-forge:scan --source inbox --days 1
/outlook-forge:scan --source inbox --days 1 --unread-only
/outlook-forge:scan --source sent --days 7
/outlook-forge:scan --source folder:project-x --days 3
```

## Skills

| Skill | Purpose |
|-------|---------|
| `email-harvester` | Email signal identification: action items, deadlines, decisions, knowledge |
| `calendar-harvester` | Calendar extraction: meeting prep, scheduling tasks, attendee context |
| `meeting-harvester` | Post-meeting extraction: action items, decisions, follow-ups |

## Data Model

Reuses the forge-lib harvest schema. The `source_channel` field holds the Outlook folder name (inbox, sent, calendar, folder:{name}). The `source_author` field holds the sender email or meeting organizer.

## Status Workflow

```
pending → approved → promoted   (terminal)
        → rejected              (terminal)
```

## CLI Reference

```bash
# Harvest management
forge harvest query --status pending --plugin outlook-forge
forge harvest query --harvest-type task --plugin outlook-forge
forge harvest update {filename} --data '{"status": "approved"}' --plugin outlook-forge

# Transcript management
forge transcript filename --scan-date 2026-03-03 --timeframe 3d --type calendar --dir outlook-forge/transcripts
```

## Verification

1. Run `/outlook-forge:init` — should discover folders and calendars via Chrome
2. Run `/outlook-forge:scan --source calendar --days 1` — should create a calendar transcript
3. Run `/outlook-forge:scan --source inbox --days 1` — should create an inbox transcript
4. Run `/outlook-forge:capture` — should create harvest records from transcripts
5. Run `/outlook-forge:review` — should present harvests for interactive review
6. Run `/outlook-forge:promote` — should create tasks/knowledge/cards from approved harvests
```

**Step 2: Commit**

```bash
git add outlook-forge/README.md
git commit -m "docs(outlook-forge): add plugin README"
```

---

## Task 14: Forge-Shell — Outlook Forge View Controller

**Files:**
- Create: `forge-shell/app/js/outlook-forge.js`
- Create: `forge-shell/app/css/outlook-forge.css`
- Modify: `forge-shell/app/index.html` (add CSS link + script tag + view div)

**Reference:** `forge-shell/app/js/slack-forge.js` (814 lines) and `forge-shell/app/css/slack-forge.css` (252 lines)

**Step 1: Read the full slack-forge.js to understand the exact pattern**

Read `forge-shell/app/js/slack-forge.js` and `forge-shell/app/css/slack-forge.css` in full. The outlook-forge view controller follows the same structure with these changes:

- CSS prefix: `of-` instead of `sf-`
- Harvest types: `task`, `knowledge`, `meeting-prep`, `meeting-notes` instead of `task`, `knowledge`, `jira-digest`
- Type color variables: `--of-type-task`, `--of-type-knowledge`, `--of-type-meeting-prep`, `--of-type-meeting-notes`
- Data directories: `outlook-forge/harvests/`, `outlook-forge/transcripts/`, `outlook-forge/config.json`
- Source metadata: show email sender or meeting organizer instead of Slack channel
- Controller name: `outlook-forge` registered via `Shell.registerController('outlook-forge', ...)`

**Step 2: Create outlook-forge.css**

Copy `forge-shell/app/css/slack-forge.css`, replace all `sf-` prefixes with `of-`, and update the type color variable names. Add `--of-type-meeting-prep` and `--of-type-meeting-notes` variables. Keep all layout and component patterns identical.

**Step 3: Create outlook-forge.js**

Copy `forge-shell/app/js/slack-forge.js`, replace:
- All `sf-` CSS class prefixes → `of-`
- `slack-forge` → `outlook-forge` in directory paths
- `slackForgeActive` → `outlookForgeActive`
- `SlackForgeView` → `OutlookForgeView`
- `view-slack-forge` → `view-outlook-forge`
- Harvest type labels: add `meeting-prep` and `meeting-notes`
- Type color function: add cases for `meeting-prep` and `meeting-notes`
- Status badges: same pattern
- Config bar: show sources instead of channels

Register as: `Shell.registerController('outlook-forge', window.OutlookForgeView);`

**Step 4: Update index.html**

Add to CSS includes (after the slack-forge.css line):
```html
<link rel="stylesheet" href="css/outlook-forge.css">
```

Add the view div (after the slack-forge view div):
```html
<div id="view-outlook-forge" class="shell-view">
  <!-- Rendered by OutlookForgeView controller -->
</div>
```

Add to script includes (after the slack-forge.js line):
```html
<script src="js/outlook-forge.js"></script>
```

**Step 5: Add theme color variables**

Check `forge-shell/app/css/theme.css` for where slack-forge variables are defined (`--sf-type-task`, etc.) and add corresponding outlook-forge variables:
```css
--of-type-task: var(--sf-type-task);
--of-type-knowledge: var(--sf-type-knowledge);
--of-type-meeting-prep: #8B5CF6;  /* purple for meeting prep */
--of-type-meeting-notes: #F59E0B; /* amber for meeting notes */
```

**Step 6: Verify locally**

```bash
cd forge-shell && npm run tauri dev
```

Navigate to the Outlook Forge view. Verify:
- View loads without JS errors
- "Outlook Forge not active" message shows when no data directory exists
- Sidebar and detail panel layout renders correctly

**Step 7: Commit**

```bash
git add forge-shell/app/js/outlook-forge.js forge-shell/app/css/outlook-forge.css forge-shell/app/index.html forge-shell/app/css/theme.css
git commit -m "feat(forge-shell): add outlook-forge view controller and styles"
```

---

## Task 15: Update CLAUDE.md Plugin Table

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add outlook-forge to the plugins table**

Add a new row to the Plugins table in CLAUDE.md:

```markdown
| **outlook-forge** | `/outlook-forge:init`, `/outlook-forge:scan`, `/outlook-forge:capture`, `/outlook-forge:review`, `/outlook-forge:promote` | `outlook-forge/harvests/` + `outlook-forge/harvests/index.json` |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add outlook-forge to CLAUDE.md plugin table"
```

---

## Task 16: End-to-End Verification

**Step 1: Verify plugin is discoverable**

```bash
ls outlook-forge/.claude-plugin/plugin.json
```

Expected: file exists with correct JSON.

**Step 2: Verify all commands exist**

```bash
ls outlook-forge/commands/
```

Expected: `init.md`, `scan.md`, `capture.md`, `review.md`, `promote.md`

**Step 3: Verify all agents exist**

```bash
ls outlook-forge/agents/
```

Expected: `forge-email-harvester.md`, `forge-calendar-harvester.md`, `forge-meeting-harvester.md`

**Step 4: Verify all skills exist**

```bash
ls outlook-forge/skills/*/SKILL.md
```

Expected: `email-harvester/SKILL.md`, `calendar-harvester/SKILL.md`, `meeting-harvester/SKILL.md`

**Step 5: Verify forge-shell integration**

```bash
ls forge-shell/app/js/outlook-forge.js forge-shell/app/css/outlook-forge.css
```

Expected: both files exist.

```bash
grep "outlook-forge" forge-shell/app/index.html
```

Expected: CSS link, view div, and script tag all present.

**Step 6: Run init to test Chrome flow**

```bash
claude --chrome
```

Then: `/outlook-forge:init`

Verify Chrome navigates to Outlook Web and discovers sources.

**Step 7: Run scan to test transcript generation**

`/outlook-forge:scan --source calendar --days 1`

Verify transcript file created in `outlook-forge/transcripts/`.

**Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(outlook-forge): verification fixes"
```
