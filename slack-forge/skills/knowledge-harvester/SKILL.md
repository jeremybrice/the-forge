---
name: knowledge-harvester
description: Guidance for extracting organizational knowledge from Slack conversations. Use when analyzing channel history to identify decisions, process changes, people context, project updates, and terminology that should be preserved in forge-memory.
---

# Knowledge Harvester

Guidance for identifying and extracting preservable organizational knowledge from Slack conversations.

## What Constitutes Preservable Knowledge

Look for information that has lasting value to the organization:

**Decisions Made:**
- "We decided to..." / "The team agreed to..."
- "Going forward, we'll use..." / "We're going with option B"
- Architecture or technology choices: "We're switching from X to Y"
- Hiring decisions, vendor selections, tool adoptions

**Process Changes:**
- "From now on, we'll..." / "New process:"
- "We're changing how we handle..." / "Updated workflow:"
- Approval processes, deployment procedures, review requirements
- Changes to team ceremonies (standup time, sprint length)

**People Context:**
- Role changes: "Sarah is now leading the platform team"
- Expertise: "Talk to Mike about Kubernetes -- he set up our clusters"
- Responsibilities: "The data team owns the ETL pipeline"
- New hires, departures, team restructuring
- Who to contact for what

**Project Updates:**
- Milestones reached: "We shipped v2.0 to production"
- Status changes: "The migration is now blocked on the vendor"
- Key dates: "Launch is scheduled for March 15"
- Scope changes: "We're descoping the mobile app for this quarter"

**Terminology and Definitions:**
- Acronyms: "RBAC = Role-Based Access Control"
- Internal jargon: "When we say 'the monolith' we mean the legacy Rails app"
- Project codenames: "Project Phoenix is the rewrite of the billing system"
- Domain-specific terms explained for newcomers

**Architecture and Technical Decisions:**
- "We chose Postgres over Mongo because..."
- "The auth service is the source of truth for user data"
- Infrastructure decisions, API design choices, data model changes
- Security policies, compliance requirements

## Mapping to forge-memory Types

Classify extracted knowledge into the appropriate memory type:

**person:**
- New information about a specific team member
- Role, title, or responsibility changes
- Areas of expertise or ownership
- Contact preferences or availability
- Example: "@david is now the tech lead for the payments team" --> person memory for David

**project:**
- Updates about a named project, product, or initiative
- Status, milestones, blockers, decisions specific to a project
- Team assignments to projects
- Example: "Project Phoenix is moving to beta next week" --> project memory for Project Phoenix

**glossary:**
- Acronym definitions
- Internal terminology explanations
- Project codenames and what they refer to
- Domain-specific vocabulary
- Example: "SLA = Service Level Agreement, we target 99.9% uptime" --> glossary memory

**general:**
- Organizational decisions that span multiple projects
- Process changes that affect the whole team
- Policy updates (PTO, remote work, security)
- Cultural norms and conventions
- Anything that does not fit cleanly into person, project, or glossary
- Example: "Starting next sprint, all PRs need two approvals" --> general memory

## Update vs Create Logic

**Update an existing memory when:**
- The knowledge relates to a person or project already tracked in forge-memory
- New information supplements or modifies existing knowledge
- A status change occurs for a known entity (project moved from alpha to beta)
- A person's role or responsibilities change

**Create a new memory when:**
- The subject (person, project, term) is not yet tracked
- A brand new project, initiative, or process is announced
- A new team member is introduced
- A new term or acronym appears for the first time

**When unsure:**
- Default to creating a new memory entry
- Deduplication is easier than recovering lost knowledge
- Note the Slack channel and timestamp for traceability
- A human can merge duplicates later; they cannot recover missed knowledge

## Confidence Scoring

**High Confidence:**
- Explicit announcements: "FYI everyone..." / "Announcement:"
- Formal decisions: "After discussion, we've decided..."
- Process documentation shared in a channel
- Leadership communications about org changes
- Official project status updates

**Medium Confidence:**
- Useful context emerging from a discussion thread
- Project updates mentioned in passing during a broader conversation
- Expertise revealed through someone answering questions
- Informal but informative: "Oh yeah, the billing service uses Stripe webhooks"

**Low Confidence:**
- Might be worth saving but uncertain
- Informal mention that could change soon: "I think we might switch to..."
- Speculative or tentative: "We're considering..." (not yet decided)
- Context from a heated discussion where positions may shift

## Noise Filtering

**Skip these -- they are not knowledge:**
- Social chat: greetings, jokes, weekend plans, lunch coordination
- Off-topic tangents in work channels
- Repetitive standup updates that contain no new information ("Same as yesterday, still working on X")
- Thread replies that are just acknowledgments: "thanks", "ok", "got it", "sounds good"
- Emoji reactions without substantive text
- Bot notifications that are routine and repetitive (build passed, deploy succeeded)
- Complaints without actionable content: "Ugh, the VPN is slow again"
- Questions that were answered in the same thread (the answer may be knowledge; the question alone is not)

**Pay attention to these -- they often contain knowledge:**
- Messages with many reactions (indicates importance to the team)
- Pinned messages
- Messages from leadership or senior team members
- Messages that start threads with many replies (indicates discussion)
- Messages shared across multiple channels

## Knowledge Quality

Apply a durability test before extracting:

**Will this be useful in 2+ weeks?**
- YES: Architecture decisions, role changes, process updates, project milestones, terminology
- NO: Today's build status, current blocker that will resolve tomorrow, meeting time change for this week

**Is this specific enough to be actionable?**
- YES: "The payments API rate limit is 100 req/sec" -- specific, referenceable
- NO: "The API has some limits" -- too vague to be useful later

**Would a new team member benefit from knowing this?**
- YES: Who owns what, how systems connect, what acronyms mean, why decisions were made
- NO: Inside jokes, temporary workarounds already resolved, outdated information

**Prefer knowledge that:**
- Explains WHY, not just WHAT (decisions with rationale are more valuable)
- Identifies ownership (who is responsible for what)
- Has permanence (will not change next week)
- Reduces the need to ask someone again

## Notes

- All file operations handled by forge-lib (`forge harvest create`)
- This skill provides reasoning only, not implementation details
- When in doubt about confidence, err on the side of medium
- Better to capture potentially useful knowledge than miss a real insight
- Preserve the original speaker's attribution -- who said it matters for credibility
- A single Slack message can yield multiple knowledge items (e.g., a project update that also reveals a person's new role)
- Thread context is critical: a message may only make sense in the context of its parent thread
