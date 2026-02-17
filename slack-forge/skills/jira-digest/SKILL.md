---
name: jira-digest
description: Guidance for parsing JIRA bot messages from Slack channels and producing structured digests. Use when analyzing JIRA notification channels to extract ticket events, identify actionable items, and summarize activity.
---

# JIRA Digest

Guidance for parsing JIRA bot notifications in Slack and producing structured, actionable digests.

## JIRA Bot Message Patterns

Recognize and classify these common JIRA bot notification formats:

**Assignments:**
- "X assigned PROJ-123 to Y"
- "PROJ-123 was assigned to Y"
- Assignment changes: "PROJ-123 reassigned from X to Y"

**Status Transitions:**
- "X moved PROJ-123 from In Progress to Done"
- "X transitioned PROJ-123 to Code Review"
- "PROJ-123 status changed: Open --> In Progress"

**Comments:**
- "X commented on PROJ-123"
- "X added a comment to PROJ-123: [preview text]"
- Comment previews may be truncated -- extract what is available

**Mentions:**
- "X mentioned you in PROJ-123"
- "You were mentioned in a comment on PROJ-123"

**Ticket Creation:**
- "X created PROJ-123: [ticket title]"
- "New issue: PROJ-123 - [ticket title]"

**Priority Changes:**
- "X changed priority of PROJ-123 from Medium to High"
- "PROJ-123 priority updated to Critical"

**Sprint Events:**
- "PROJ-123 added to Sprint 42"
- "PROJ-123 removed from Sprint 42"
- "X moved PROJ-123 to the backlog"

**Other Events:**
- "X linked PROJ-123 to PROJ-456"
- "X added attachment to PROJ-123"
- "X updated the description of PROJ-123"
- "X changed the fix version of PROJ-123 to 2.1.0"
- "X resolved PROJ-123 as Won't Fix"

**Bot Variations:**
- Different JIRA-Slack integrations format messages differently
- Some use rich embeds with fields; others use plain text
- Look for the ticket ID pattern (2-10 uppercase letters, hyphen, 1-5 digits) as the anchor

## Grouping Events by Ticket

When multiple events reference the same ticket:

- Collect all events for a given ticket ID together
- Present events chronologically within each ticket group
- Identify the narrative arc: was the ticket created, worked on, and completed all in one digest period?
- Note the most recent state: if a ticket moved from Open to In Progress to Done, the current state is Done

**Grouping hierarchy:**
1. First, separate actionable items from informational items
2. Within each category, group by ticket ID
3. Within each ticket, order events chronologically
4. If a ticket has many events (5+), summarize the progression rather than listing each one

## Identifying Actionable vs Informational

**Actionable (needs_action: true):**
- Ticket assigned TO the user (they need to work on it)
- User mentioned in a comment requesting input or review
- Review requests directed at the user
- Blockers reported on tickets the user owns
- High/Critical priority tickets assigned to the user
- Tickets moved to a status that implies the user's involvement (e.g., "Ready for QA" when user is QA)

**Informational (needs_action: false):**
- Status updates made BY others on tickets the user watches
- Comments added for general awareness
- Sprint additions or removals (unless it changes the user's workload)
- Priority changes made by others (worth noting but not requiring action)
- Ticket creation notifications for projects the user follows
- Resolution of tickets the user is not assigned to
- Link additions, attachment uploads, description edits by others

**Context-dependent (requires judgment):**
- Comments on tickets the user is assigned to -- could be informational or could request changes
- Status transitions on tickets the user is watching -- might need follow-up
- When unsure, lean toward actionable (better to flag something unnecessary than miss something important)

## Structured Item Extraction

For each JIRA event identified, extract these fields:

**ticket:**
- The JIRA ticket ID (e.g., "PROJ-123")
- Normalize format: uppercase project key, hyphen, number
- If the ticket title is available, include it

**event_type:**
- Classify into: assignment, status_change, comment, mention, created, priority_change, sprint_change, resolution, link, attachment, description_update
- Use the most specific type available
- If an event does not fit a known type, use "update" as a fallback

**summary:**
- Brief, human-readable description of what happened
- Include the actor (who did it) and the outcome
- Example: "Alice moved from In Progress to Code Review"
- Example: "Bob commented: 'Can we add error handling for the edge case?'"
- Keep to one sentence

**needs_action:**
- Boolean: does this event require the digest recipient to do something?
- Apply the actionable vs informational rules above
- When context is ambiguous, default to true for assignments and mentions, false for everything else

## Summary Writing

Produce a digest summary that is scannable and prioritized:

**Structure:**
1. Lead with a count overview: "12 JIRA events across 7 tickets. 3 items need your attention."
2. Present actionable items first, clearly marked
3. Follow with informational items grouped by ticket
4. End with a brief pattern summary if applicable

**Actionable Items Section:**
- List each item that needs the user's attention
- Include the ticket ID, what happened, and what the user should do
- Be direct: "PROJ-123 assigned to you -- new feature request for user export"
- Order by priority (Critical/High first, then by recency)

**Informational Section:**
- Group by ticket for readability
- Summarize ticket arcs where possible: "PROJ-456: moved through Code Review to Done (completed by Alice)"
- For tickets with single events, a one-liner is sufficient

**Pattern Highlights:**
- Call out notable patterns at the end of the summary
- "5 tickets moved to Done today -- productive sprint"
- "3 new tickets assigned to you this morning"
- "PROJ-789 has had 8 updates -- high activity, may need attention"
- "No actionable items -- all events are informational"

**Tone and Length:**
- Executive overview style: concise, not exhaustive
- Assume the reader is busy and wants to know what needs their attention
- Full detail is in the structured items; the summary is for quick scanning
- A typical digest summary should be 5-15 lines, not a wall of text

## Edge Cases

**Empty scan (no new JIRA messages):**
- Report clearly: "No JIRA activity found in #channel for the scanned period"
- Do not fabricate events or pad the digest

**Malformed bot messages:**
- If a message looks like a JIRA notification but cannot be parsed, skip it
- Note in the digest: "1 JIRA notification could not be parsed"
- Do not guess at the content of unparseable messages

**Unknown bot format:**
- Different JIRA integrations (official Atlassian app, third-party bots, custom webhooks) format differently
- Look for the ticket ID pattern as the universal anchor
- Extract what you can; skip what you cannot parse reliably

**Duplicate events:**
- The same event may appear multiple times (bot retries, cross-posted channels)
- Deduplicate by ticket ID + event type + actor + timestamp proximity
- If two events for the same ticket have the same actor and type within 5 minutes, treat as one

**Bulk operations:**
- Sprint planning may generate dozens of "added to Sprint" events at once
- Summarize bulk operations: "15 tickets added to Sprint 42" rather than listing each one
- Identify the actor: "Alice added 15 tickets to Sprint 42 during sprint planning"

**Non-JIRA bot messages in the channel:**
- JIRA notification channels may contain other bot messages (GitHub, CI/CD, etc.)
- Ignore non-JIRA messages entirely; they are out of scope for this skill
- Identify JIRA messages by the presence of a ticket ID pattern and JIRA-specific language

## Notes

- All file operations handled by forge-lib (`forge harvest create`)
- This skill provides reasoning only, not implementation details
- The ticket ID regex pattern is typically: `[A-Z]{2,10}-\d{1,5}`
- When summarizing, always separate what needs action from what is just informational
- Preserve ticket IDs exactly as they appear -- do not normalize project keys you are unsure about
- If the user has preferences about which projects to track or ignore, respect those filters
- A digest with zero actionable items is a valid and useful digest -- it tells the user they have nothing requiring attention
