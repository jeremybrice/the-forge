---
name: task-harvester
description: Guidance for extracting actionable tasks from Slack conversations. Use when analyzing channel history or thread content to identify commitments, requests, action items, and deadlines that should be tracked as tasks.
---

# Task Harvester

Guidance for identifying and extracting tasks from Slack conversation context.

## What Constitutes a Task

Look for these patterns in Slack messages:

**Direct Requests:**
- "Can you..." / "Could you..." / "Would you mind..."
- "Please [verb]..." / "We need you to..."
- "@person [verb]..." (directed at a specific person)

**Commitments:**
- "I'll have that by..." / "I'll get it done..."
- "I can take care of that" / "I'll handle it"
- "Let me follow up on..." / "I'll circle back on..."

**Deadlines and Time Pressure:**
- "By end of day..." / "Before the sprint ends..."
- "This needs to happen before launch"
- "Due on [date]" / "Deadline is [date]"

**Meeting Action Items:**
- "Action item: [person] will [verb]..."
- Bulleted lists following a meeting recap
- "Takeaways from today's sync..."

**Explicit Markers:**
- "TODO" / "TO-DO" / "to do"
- "Action item" / "Follow-up" / "Next step"
- Checkbox syntax in Slack messages

**Implicit Requests:**
- Questions that imply work: "Has anyone started on the migration?"
- Status requests that imply ownership: "Where are we on the API docs?"
- Escalations: "This is still broken" (implies someone needs to fix it)

## Distinguishing Tasks from Casual Conversation

Not every statement that sounds like work is an actual task. Apply these filters:

**IS a task (has specificity):**
- Clear action (what needs to be done)
- Identifiable owner or requestor (who)
- Implied or explicit timeline (when, even if vague)
- Example: "Hey @sarah can you update the staging environment config before Wednesday?" -- Clear what, who, when.

**NOT a task:**
- **Vague aspirations**: "We should really clean up the codebase someday" -- No who, no when, no specific what.
- **Rhetorical questions**: "Wouldn't it be nice if we had better tests?" -- Not a request for action.
- **Social chat**: Greetings, jokes, lunch plans, weekend recaps, emoji reactions.
- **Opinions without action**: "I think the new design looks great" -- Commentary, not a task.
- **Already completed actions**: "I just pushed the fix" -- Done, not pending.
- **Questions seeking information only**: "What version of Node are we using?" -- Unless the answer reveals needed work.

**Gray areas (use medium confidence):**
- "We should probably..." -- Might be a task if followed by agreement.
- "Someone needs to..." -- Task exists but no owner.
- "It would be great if..." -- Aspiration or soft request? Context matters.

## Confidence Scoring

Assign a confidence level to each extracted task:

**High Confidence:**
- Explicit ask directed at a specific person
- Contains a deadline or timeframe
- Direct request from a manager, lead, or stakeholder
- Uses imperative language: "Please do X by Y"
- Follows a decision: "Okay, so @mike will handle the deployment"
- Contains explicit markers: "TODO", "Action item"

**Medium Confidence:**
- Implied action item from a discussion
- "Someone should..." or "We need to..." without specific assignment
- Action emerges from context but is not directly stated
- Request without a clear deadline
- Follow-up implied but not explicitly assigned
- Agreement on work without naming who does it

**Low Confidence:**
- Might be a task but could also be idle speculation
- "We could..." / "Maybe we should..." / "At some point..."
- Unclear if anyone actually owns it or intends to act
- Mentioned in passing during an unrelated discussion
- Old message that may no longer be relevant

## Task Attribution

**Requester (who asked):**
- The person who sent the message containing the request
- In threaded discussions, the person who first raised the need
- For meeting recaps, the person who led the meeting or posted the summary

**Assignee (who is responsible):**
- Directly mentioned: "@person can you..." -- assignee is that person
- Self-assigned: "I'll take care of it" -- assignee is the speaker
- Unassigned: "Someone needs to..." -- mark as "unassigned" and note this
- Implied by role: "The frontend team should..." -- note the team, leave individual unassigned

**When attribution is ambiguous:**
- Note both possible assignees rather than guessing
- Prefer the person who acknowledged the work ("Sure, I'll do it")
- If a manager delegates, the delegatee is the assignee, the manager is the requester

## Clean Title Extraction

Convert conversational Slack messages into clear, actionable task titles:

**Rules:**
- Start with a verb (Review, Update, Fix, Create, Deploy, Investigate, etc.)
- Remove filler words (hey, just, really, actually, maybe, I think)
- Remove social preamble ("Hey team," / "Quick question --")
- Keep concise: under 100 characters
- Preserve key nouns: project names, system names, feature names
- Do not editorialize or add interpretation

**Examples:**
- "Hey can you review the auth flow changes?" --> "Review authentication flow changes"
- "We really need to update the staging env before Friday" --> "Update staging environment configuration"
- "Someone should probably look into why the CI pipeline keeps failing" --> "Investigate CI pipeline failures"
- "I'll have the API docs ready by end of week" --> "Complete API documentation"
- "@design-team the new onboarding mockups need to be finalized" --> "Finalize onboarding mockups"
- "TODO: migrate the old user table to the new schema" --> "Migrate user table to new schema"

**Avoid:**
- Titles that are too vague: "Do the thing" / "Handle it"
- Titles that are too long: the full Slack message copy-pasted
- Titles with Slack-specific formatting artifacts (emoji codes, channel refs)

## Deduplication

The same task may surface in multiple channels or threads. Before creating a harvest record:

**Check for duplicates by:**
- **Title similarity**: Compare extracted titles for overlapping key terms (same verb + same noun phrase)
- **People overlap**: Same requester or assignee discussing the same topic
- **Project/system overlap**: References to the same project, repo, or system component
- **Timeframe**: Tasks mentioned within the same week are more likely duplicates
- **Ticket references**: Same JIRA ticket, PR number, or external ID mentioned

**When duplicates are found:**
- Create only one harvest record for the task
- Use the version with the most detail (clearest description, explicit deadline, named assignee)
- Note the additional channels/threads where it was mentioned for context
- If conflicting details exist (different deadlines), note both and flag for user review

**Not duplicates:**
- Similar but distinct work: "Update staging config" vs "Update production config"
- Same area, different tasks: "Fix login bug" vs "Add login rate limiting"
- Recurring tasks: "Deploy this week" mentioned each week is a new instance

## Notes

- All file operations handled by forge-lib (`forge harvest create`)
- This skill provides reasoning only, not implementation details
- When in doubt about confidence, err on the side of medium
- Better to capture a potential task than miss a real one
- Slack display names and real names may differ -- use whatever is available in the message
- Thread context matters: read the full thread before extracting tasks from a single message
