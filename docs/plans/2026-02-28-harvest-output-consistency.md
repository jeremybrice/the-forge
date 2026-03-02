# Plan: Shore Up Slack-Forge Harvest Output Consistency

> Transcribed to `docs/plans/2026-02-28-harvest-output-consistency.md` during implementation.

## Context

Slack-forge harvest outputs show significant quality drift over time. Comparing early harvests (Feb 18) against recent ones (Feb 26) reveals:

- **Task harvests regressed**: Feb 18 outputs have rich narrative context, clear action items, and full frontmatter. Feb 26 outputs are bare-minimum summaries with missing frontmatter fields (`title`, `type`, `updated`), wrong section headers (`## Task Summary` instead of `## Extracted Content`), and minimal business context.
- **JIRA digests improved structurally** (Feb 26 has executive summaries, tables, action sections) but broke template compliance (frontmatter fields like `ticket_count` not in schema, `jira_events` array stuffed into frontmatter instead of body).
- **Knowledge harvests** are the most consistent but still vary in depth — some have strategic "Significance" sections, others are single sentences.

**Root cause**: The agent briefs tell subagents WHAT fields to populate but not HOW to write quality content. The `content` placeholder says `"{extracted task summary}"` with zero guidance on expected depth, structure, or quality. There are no examples of good output, no minimum quality thresholds, and no warnings about common pitfalls.

## Approach

Enhance the 3 agent briefs and 3 skills with content quality specifications, structural requirements, and anti-pattern warnings. No schema or template changes needed — the Jinja2 template and JSON schema are well-designed; the gap is in LLM guidance.

## Changes

### 1. Task Harvester Agent Brief
**File:** `slack-forge/agents/forge-task-harvester.md`

Add a **Content Quality Requirements** section specifying:
- The `content` field must be a **narrative paragraph** (not a one-liner) that explains: what the task is, who requested/owns it, why it matters, and what triggered it
- The `source_context` field must include: the originating conversation reference (channel, participants, date) and a key supporting quote
- `action_items` array: each item must start with a verb and name a responsible person where known
- **Anti-patterns**: Don't just paste the raw message as the summary. Don't skip business context. Don't use `## Task Summary` — the template uses `## Extracted Content`.

### 2. Knowledge Harvester Agent Brief
**File:** `slack-forge/agents/forge-knowledge-harvester.md`

Add a **Content Quality Requirements** section specifying:
- The `content` field must contain two parts: (1) a summary paragraph of the knowledge item, (2) a "Significance" paragraph explaining why this matters long-term and who it affects
- The `source_context` field must include a direct quote or paraphrase from the transcript with attribution
- Tags must include a memory-hint tag (`person`, `project`, `glossary`, or `general`) as the first tag
- **Anti-patterns**: Don't produce single-sentence summaries. Don't skip the strategic/business importance.

### 3. JIRA Digest Agent Brief
**File:** `slack-forge/agents/forge-jira-digest.md`

Restructure with a **Digest Content Structure** section specifying the required body layout:
- The `content` field must follow a fixed structure:
  1. **Summary stats line** (X tickets, Y events, breakdown by type)
  2. **Items Needing Action** section — one paragraph per actionable item explaining what and why
  3. **Status Transitions** grouped by outcome (Done, In Progress, Fix Required)
  4. **Key Tickets to Watch** — 3-5 strategically important tickets with context
- `jira_events` array goes in `--data` JSON (template renders it in body), NOT in frontmatter
- **Anti-patterns**: Don't list every event flat without grouping. Don't produce 400+ line walls of text. Don't use "Untitled" as the title.

### 4. Task Harvester Skill
**File:** `slack-forge/skills/task-harvester/SKILL.md`

Add an **Output Quality Rules** section:
- Content must answer: What? Who? Why? When?
- Minimum: 2-3 sentences of narrative context
- Action items must be specific and assignable (verb + owner + deliverable)
- Source context must reference the conversation, not just paste a timestamp

### 5. Knowledge Harvester Skill
**File:** `slack-forge/skills/knowledge-harvester/SKILL.md`

Add an **Output Quality Rules** section:
- Content must include both the knowledge fact AND its strategic significance
- Minimum: 1 summary paragraph + 1 significance paragraph
- Include a direct quote where one exists in the transcript
- Tags must start with a memory-hint destination tag

### 6. JIRA Digest Skill
**File:** `slack-forge/skills/jira-digest/SKILL.md`

Add a **Digest Structure** section:
- Lead with actionable items (executive briefing style)
- Group informational events by category (status changes, assignments, comments)
- End with "Key Tickets to Watch" for strategic context
- Summarize high-volume noise rather than listing every event
- Title format: `"JIRA Digest — {date} ({timeframe})"`

## Files to Modify

1. `slack-forge/agents/forge-task-harvester.md`
2. `slack-forge/agents/forge-knowledge-harvester.md`
3. `slack-forge/agents/forge-jira-digest.md`
4. `slack-forge/skills/task-harvester/SKILL.md`
5. `slack-forge/skills/knowledge-harvester/SKILL.md`
6. `slack-forge/skills/jira-digest/SKILL.md`

## Files NOT Modified (already correct)

- `forge-lib/schemas/harvest.json` — schema is well-designed, no changes needed
- `forge-lib/templates/harvest.md.j2` — template sections are correct
- `forge-lib/core/harvest_ops.py` — data layer is solid
- `slack-forge/commands/*.md` — orchestration commands are fine

## Implementation

Step 1: Copy this plan to `docs/plans/2026-02-28-harvest-output-consistency.md`

Step 2: Update the 3 agent briefs (files 1-3) with content quality sections

Step 3: Update the 3 skills (files 4-6) with output quality rules

## Verification

1. Read all 6 modified files and confirm they are internally consistent
2. Verify agent briefs reference the correct template section names (`## Extracted Content`, `## Source Context`, `## Action Items`, `## JIRA Events`)
3. Verify skill quality rules don't contradict agent brief instructions
4. Run `forge harvest create` with test data to confirm the template still renders correctly:
   ```bash
   cd forge-lib && python forge.py harvest create "Test Task" \
     --harvest-type task \
     --data '{"source_channel": "test", "source_channel_id": "C123", "scan_timeframe": "24h", "scan_date": "2026-02-28", "confidence": "high", "content": "Test narrative content.", "source_context": "Test context."}' \
     --directory /tmp/test-harvest
   ```
5. Spot-check by comparing the new agent brief content format requirements against the "good" sample outputs (Feb 18 task harvests, Feb 26 knowledge harvests, Feb 26 JIRA digest body) to confirm alignment
