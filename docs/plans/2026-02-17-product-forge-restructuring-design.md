# Product Forge Restructuring — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Approach:** Full Cognitive-Forge Mirror (Approach A)

## Summary

Restructure product-forge from 11 commands (6 card-type commands + 5 utility commands) to 8 commands + 6 agents. Card-type commands (initiative, epic, story, decision, intake, release-notes) become specialized agents recruited by 3 orchestrator commands (create, update, review). Utility commands (init, checkpoint, link-to-jira, pull-from-jira, push-to-jira) remain unchanged.

This mirrors cognitive-forge's architecture: 2 commands + 5 agents, where commands orchestrate and agents reason.

---

## 1. New Directory Structure

```
product-forge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/                          ← 8 commands (down from 11)
│   ├── init.md                        ← KEEP as-is (setup)
│   ├── create.md                      ← NEW orchestrator
│   ├── update.md                      ← NEW orchestrator
│   ├── review.md                      ← NEW orchestrator
│   ├── checkpoint.md                  ← KEEP as-is (quick capture)
│   ├── link-to-jira.md               ← KEEP as-is
│   ├── pull-from-jira.md             ← KEEP as-is
│   └── push-to-jira.md               ← KEEP as-is
├── agents/                            ← NEW directory (6 agents)
│   ├── forge-initiative.md            ← Executive-tone initiative reasoning
│   ├── forge-epic.md                  ← Planning-tone epic reasoning
│   ├── forge-story.md                 ← Engineering-tone story reasoning
│   ├── forge-decision.md              ← Decision extraction reasoning
│   ├── forge-intake.md                ← Requirements gathering reasoning
│   └── forge-release-notes.md         ← Release documentation reasoning
└── skills/                            ← KEEP as-is (3 skills)
    ├── pm-methodology/SKILL.md
    ├── product-context/SKILL.md
    └── jira-sync/SKILL.md
```

**Net change:** 11 commands → 8 commands + 6 agents. Total file count 14 → 17 (+3), but with clean separation of orchestration from reasoning.

---

## 2. Command Orchestrator Design

The 3 new commands share a pattern: detect card type → recruit agent → collect output → call forge-lib.

### `/product-forge:create` (~50 lines)

1. **Card Type Detection** — Use pm-methodology skill signals:
   - "ROM, estimation, initiative, rough order of magnitude" → forge-initiative
   - "epic, body of work, break down into stories" → forge-epic
   - "story, user story, acceptance tests, sprint work" → forge-story
   - "decision, architectural, scope, priority decision" → forge-decision
   - "intake, requirements, feature request" → forge-intake
   - "release notes, changelog, what shipped" → forge-release-notes
   - Ambiguous → Ask user
   - Override: `--type initiative` escape hatch
2. **Context Assembly** — Gather conversation context, parent card, product taxonomy
3. **Agent Recruitment** — Spawn agent via Task tool with concept brief
4. **User Approval** — Present agent's draft for approval
5. **Persistence** — `forge card create` + `forge relationship link` if parent exists

### `/product-forge:update` (~50 lines)

Same flow but:
- Phase 1: Identify card to update (by filename, title search, or interactive via `forge card query`)
- Phase 2: Read existing card via `forge card get`
- Phase 3: Recruit matching agent with existing content + update instructions
- Phase 4: `forge card update` with revised output

### `/product-forge:review` (~40 lines)

Same flow but:
- Phase 3: Agent runs in review mode — returns quality assessment, not content
- Phase 4: No forge-lib write. Present review as conversation.

**Key principle:** Commands own the forge-lib contract. Agents never call forge-lib directly.

---

## 3. Agent Design

### Shared Agent Template

```yaml
---
name: forge-{type}
description: {role description}
tools:
  - Read
  - Grep
  - Glob
skills:
  - pm-methodology
  - product-context
---

# Forge {Type} Agent

You are the {Role} in Product Forge. {Identity statement}.

## Your Identity
{Tone, audience, reasoning style}

## Input
You receive a concept brief containing:
- User's request or conversation context
- Parent card content (if applicable)
- Product taxonomy (products, modules, clients)
- Mode: create | update | review

## Output Format

### Create Mode
Return structured content:
- **title**: Card title
- **frontmatter**: {type-specific fields as JSON}
- **sections**: {named sections with prose/bullet content}

### Update Mode
Return revised content (same structure, incorporating changes)

### Review Mode
Return quality assessment:
- **strengths**: What's working
- **gaps**: What's missing or weak
- **suggestions**: Specific improvements
- **verdict**: Ready / Needs Work / Major Revision

## Content Guidelines
{Card-type-specific reasoning guidance}
```

### Agent-Specific Details

| Agent | Identity | Tone | Key Sections | Unique Reasoning |
|-------|----------|------|-------------|-----------------|
| **forge-initiative** | Strategic planner | Executive — clear, concise, business-focused | Background, Proposed Solution, Affected Systems, Potential Requirements, Additional Considerations, Open Questions, Out of Scope | ROM estimation, confidence levels, business value framing |
| **forge-epic** | Scope architect | Planning — balances business value with technical reality | Epic Scope, Goals, Suggested Story Breakdown, Dependencies, Success Criteria | Decomposes initiatives into implementable chunks, story breakdown suggestions |
| **forge-story** | Engineering spec writer | Engineering — precise, implementable | Background/Context, Feature Requirements, Functional Behavior, Acceptance Tests | User story vs directive format selection, acceptance test generation, story point estimation |
| **forge-decision** | Decision extractor | Analytical — structured reasoning | Context, Options Considered, Decision, Rationale, Consequences, Revisit Criteria | Extracts decisions from conversation, classifies as architectural/scope/priority |
| **forge-intake** | Requirements interviewer | Conversational — adaptive Q&A | 7 topic areas (Problem, Users, Scope, Technical, Business, Timeline, Risks) | Adaptive interview flow, skip irrelevant topics, summarize for handoff |
| **forge-release-notes** | Release documenter | Customer-facing — clear, benefit-focused | What's New, Improvements, Bug Fixes | Groups changes by impact, writes for end users not engineers, Word doc generation |

### Agent constraints

- Agents never call forge-lib (no Bash, no Write)
- Agents use Read/Grep/Glob only for context gathering (reading existing cards, parent cards, taxonomy)
- Skills (pm-methodology, product-context) load into agents for tone and taxonomy guidance

---

## 4. Data Flow

```
User: /product-forge:create "notification system overhaul"
│
▼
create.md (Orchestrator)
│
├── pm-methodology skill → Classify as "initiative"
├── product-context skill → Load taxonomy
├── Assemble concept brief
│
├── Task tool → Spawn forge-initiative agent
│   ├── Agent reads brief
│   ├── Agent drafts structured output
│   └── Agent returns {title, frontmatter, sections}
│
├── Present draft to user → Approve / Revise / Cancel
│
├── forge card create initiative "..." --data '{...}' --directory .
├── forge relationship link parent.md child.md (if applicable)
│
└── Present: "Created: cards/initiatives/notification-system-overhaul.md"
```

### Wiring rules

1. Agents never call forge-lib — they return structured data, commands handle persistence
2. Agents never call Write/Bash — read-only tools for context gathering
3. Skills are shared between commands and agents
4. Concept brief is the interface contract — commands build it, agents consume it
5. User approval gate — agent output always presented before forge-lib writes

### Unchanged components

- forge-lib CLI contract (same `forge card` calls)
- JSON schemas (`forge-lib/schemas/`)
- Jinja2 templates (`forge-lib/templates/`)
- index.json files (forge-lib maintains)
- All 3 skills (pm-methodology, product-context, jira-sync)
- forge-shell view controller (reads from same index.json)

---

## 5. Migration Strategy

### File changes

| Old File | Action | New File(s) |
|----------|--------|-------------|
| `commands/initiative.md` | Split → reasoning to agent, orchestration to create.md | `agents/forge-initiative.md` + `commands/create.md` |
| `commands/epic.md` | Split → reasoning to agent | `agents/forge-epic.md` |
| `commands/story.md` | Split → reasoning to agent | `agents/forge-story.md` |
| `commands/decision.md` | Split → reasoning to agent | `agents/forge-decision.md` |
| `commands/intake.md` | Split → reasoning to agent | `agents/forge-intake.md` |
| `commands/release-notes.md` | Split → reasoning to agent | `agents/forge-release-notes.md` |
| `commands/init.md` | Keep | Same |
| `commands/checkpoint.md` | Keep | Same |
| `commands/link-to-jira.md` | Keep | Same |
| `commands/pull-from-jira.md` | Keep | Same |
| `commands/push-to-jira.md` | Keep | Same |
| — | Create | `commands/create.md` |
| — | Create | `commands/update.md` |
| — | Create | `commands/review.md` |

### Files removed after migration

6 files: `commands/initiative.md`, `commands/epic.md`, `commands/story.md`, `commands/decision.md`, `commands/intake.md`, `commands/release-notes.md`

### Breaking changes

**Slash-command names change:**
- `/product-forge:initiative` → `/product-forge:create` (with auto-detection or `--type initiative`)
- `/product-forge:epic` → `/product-forge:create` (with auto-detection or `--type epic`)
- Same for story, decision, intake, release-notes
- Update and review modes accessed via `/product-forge:update` and `/product-forge:review`

### Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Card type detection inaccuracy | pm-methodology skill defines clear signals; orchestrator asks when ambiguous; `--type` override |
| Agent output quality regression | Reasoning content extracted verbatim from current commands into agents; pm-methodology skill unchanged |
| forge-shell breakage | Desktop app reads index.json, not plugin structure — zero impact |
| forge-lib contract change | No change — same CLI calls, just issued by orchestrator commands instead of card-type commands |

### README update

README must be rewritten to reflect new command names, agent descriptions, and updated architecture diagram showing orchestrator → agent → forge-lib flow.
