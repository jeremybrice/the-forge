# Copilot-Forge Plugin Design

**Date:** 2026-03-03
**Status:** Approved
**Plugin:** copilot-forge
**Version:** v2.1.0-alpha (marketplace standard)

## Overview

New plugin for building Microsoft 365 Copilot Declarative Agents through guided conversational workflow. Follows the rovo-forge pattern: the LLM walks users through agent design and produces copy-ready output for the Agent Builder / Copilot Studio UI.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Declarative Agents only | Config-driven, no hosting required. Direct parallel to Rovo agents. Custom Engine Agents are out of scope. |
| Commands | Single: `/copilot-forge:agent` | One platform (M365 Copilot) unlike Rovo's Jira/Confluence split. Pattern detection handles use-case variation. |
| Output | Copy-ready text for Agent Builder UI | Matches rovo-forge philosophy. Users copy sections into the Agent Builder or Copilot Studio UI. |
| API Plugins | Not included | Keeps focus on knowledge-grounded agents. API plugin support (OpenAPI specs, actions) can be added later. |
| Plugin name | copilot-forge | Follows marketplace convention: `{purpose}-forge`. |

## Plugin Structure

```
copilot-forge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   └── agent.md                     # /copilot-forge:agent
├── sample-configs/
│   ├── sharepoint-knowledge-agent.md
│   ├── email-insights-agent.md
│   └── teams-channel-expert.md
└── skills/
    ├── copilot-foundation/
    │   ├── SKILL.md
    │   └── references/
    │       ├── instruction-framework.md
    │       ├── validation-rules.md
    │       └── knowledge-sources.md
    └── m365-specialist/
        ├── SKILL.md
        └── references/
            ├── m365-patterns.md
            └── capabilities-catalog.md
```

Two skills (foundation + one specialist) since we have a single command rather than rovo-forge's two platform-specific commands.

## Data Model

Agents stored in `copilot-agents/{slug}/agent.md` with `copilot-agents/index.json`.

### Frontmatter (YAML)

```yaml
name: "HR Policy Assistant"
platform: copilot
description: "Answers employee questions about HR policies using SharePoint knowledge base"
status: draft  # draft | published | archived
capabilities:
  - name: OneDriveAndSharePoint
    items:
      - "https://contoso.sharepoint.com/sites/HR-Policies"
  - name: WebSearch
    sites:
      - "https://hr.contoso.com"
additional_capabilities:
  - GraphicArt
  - CodeInterpreter
conversation_starters:
  - title: "PTO Policy"
    text: "What is our company's PTO policy?"
  - title: "Benefits"
    text: "Summarize our health insurance benefits"
  - title: "Onboarding"
    text: "What does the new employee onboarding process look like?"
owner: "team-lead"
collaborators: []
visibility: organization  # organization | team | private
created: "2026-03-03"
updated: "2026-03-03"
```

### Body (Markdown)

```markdown
## Instructions

[Agent behavioral instructions — up to 8,000 characters. Structured with
Purpose, General Guidelines, Workflows, Output Format sections using
Markdown headers, bullets, and numbered steps per Microsoft best practices.]

## Knowledge Source Notes

[Optional notes about why specific sources were chosen, scoping decisions,
and expected content coverage.]
```

### Key Differences from Rovo-Forge Data Model

- `capabilities` replaces `skills` + `knowledge_sources` — Copilot unifies these as one concept
- `additional_capabilities` for non-knowledge features (GraphicArt, CodeInterpreter)
- Single `instructions` block instead of rovo-forge's two-tier `behavior` + `scenarios` — Copilot declarative agents use a flat instruction structure
- `conversation_starters` have `title` + `text` (rovo-forge uses plain strings) — maps to Copilot UI clickable chips
- `platform` is always `copilot` (no enum split) — kept for forge-lib consistency

### Validation Constraints

| Field | Constraint |
|-------|-----------|
| name | max 100 chars |
| description | max 1,000 chars |
| instructions (body) | max 8,000 chars |
| conversation_starters | min 3, max 12 items |
| WebSearch sites | max 4 URLs, max 2 path segments each |
| TeamsMessages urls | max 5 |
| collaborators | max 40 |

## Command Workflow (11 Phases)

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Pattern Detection | Analyze user's description to suggest a matching pre-built pattern |
| 2 | Identity Configuration | Name (max 100 chars) and description (max 1,000 chars). Purpose-based naming convention. |
| 3 | Knowledge Source Selection | Present catalog of 10 capability types. User picks which apply. |
| 4 | Knowledge Source Scoping | Configure specifics: SharePoint URLs, mailbox addresses, Teams channel URLs, Graph connector IDs, web search domains. |
| 5 | Instruction Authoring | Build instructions (up to 8,000 chars). Guided structure: Purpose → General Guidelines → Workflows → Output Format. |
| 6 | Additional Capabilities | Optional: GraphicArt (image generation) and CodeInterpreter (data analysis). Only offered if relevant. |
| 7 | Conversation Starters | Define 3-12 sample prompts with title + text. |
| 8 | Governance | Owner, collaborators, visibility. |
| 9 | Validation | Check all constraints. Report pass/fail per component. |
| 10 | Copy-Ready Output | Formatted text mapped to Agent Builder / Copilot Studio UI field names. |
| 11 | File Persistence | Save via forge-lib CLI. Store in `copilot-agents/{slug}/agent.md`. |

### Phase 5: Instruction Structure

The command guides users through a structured approach to the flat instruction block:

```markdown
## Purpose
[What the agent does and its domain]

## General Guidelines
[Tone, verbosity, output format, confirmation gates]

## Workflows
### Workflow 1: [Name]
1. Step one...
2. Step two...

### Workflow 2: [Name]
1. Step one...
2. Step two...

## Output Format
[How responses should be structured]
```

## Pre-Built Patterns (5)

### Pattern 1: SharePoint Knowledge Agent
- **Use cases:** HR policies, product documentation, engineering standards, compliance guides, SOPs
- **Primary capability:** OneDriveAndSharePoint
- **Trigger keywords:** "policy", "document", "guide", "standard", "procedure", "handbook"
- **Instruction emphasis:** Cite source documents, maintain factual accuracy, acknowledge when information isn't found
- **Starter examples:** "What does our policy say about...", "Find the documentation for...", "Summarize the guidelines on..."

### Pattern 2: Email Insights Agent
- **Use cases:** Email summarization, action item extraction, thread analysis, communication tracking
- **Primary capability:** Email
- **Trigger keywords:** "email", "inbox", "message", "thread", "communication", "sent"
- **Instruction emphasis:** Privacy-aware summarization, action item identification, chronological threading
- **Starter examples:** "Summarize my emails about...", "What action items came from...", "Find emails related to..."

### Pattern 3: Teams Channel Expert
- **Use cases:** Channel Q&A, discussion summarization, decision tracking, tribal knowledge capture
- **Primary capability:** TeamsMessages
- **Trigger keywords:** "channel", "teams", "discussion", "conversation", "chat"
- **Instruction emphasis:** Attribute statements to participants, distinguish decisions from discussion, surface consensus
- **Starter examples:** "What was decided about...", "Summarize recent discussion in...", "Who mentioned..."

### Pattern 4: Meeting Assistant
- **Use cases:** Meeting summarization, action item extraction, decision logging, follow-up tracking
- **Primary capability:** Meetings
- **Trigger keywords:** "meeting", "transcript", "minutes", "action items", "decisions", "follow-up"
- **Instruction emphasis:** Structured output (attendees, decisions, action items, next steps), speaker attribution
- **Starter examples:** "Summarize my last meeting about...", "What action items came out of...", "What decisions were made in..."

### Pattern 5: Enterprise Knowledge Hub
- **Use cases:** Cross-functional Q&A, organizational knowledge, onboarding, multi-source research
- **Primary capabilities:** OneDriveAndSharePoint + Email + TeamsMessages + WebSearch
- **Trigger keywords:** "enterprise", "organization", "company", "cross-team", "onboarding", "general"
- **Instruction emphasis:** Cross-reference multiple sources, indicate source type in responses, handle conflicting information gracefully
- **Starter examples:** "What does our company do about...", "Help me get up to speed on...", "Find everything related to..."

## Skills

### copilot-foundation

Core platform knowledge:

- **Declarative Agent Anatomy** — Component taxonomy (manifest, instructions, capabilities, starters)
- **Instruction Framework** — Microsoft's best practices: positive language, precise verbs, atomic steps, Markdown formatting, self-evaluation gates, reasoning control cues
- **Validation Rules** — All constraints: character limits, starter limits, URL limits, required fields
- **Knowledge Source Configuration** — How each capability type works, licensing requirements, scoping options

References:
- `instruction-framework.md` — Writing guidance with examples and anti-patterns
- `validation-rules.md` — Constraint tables and validation checks
- `knowledge-sources.md` — Complete capability catalog with configuration details

### m365-specialist

M365-specific domain knowledge:

- **Capabilities Catalog** — All 10 knowledge source types with configuration options, scoping strategies, licensing notes
- **Pre-Built Patterns** — The 5 patterns fully fleshed out with instruction templates, capability configs, starter sets
- **Instruction Patterns** — Reusable building blocks: purpose statements, guideline templates, workflow structures, output format specs
- **Agent Builder / Copilot Studio Mapping** — How each piece maps to UI fields for copy-ready output

References:
- `m365-patterns.md` — Complete pattern templates
- `capabilities-catalog.md` — Detailed capability reference with examples

## Forge-lib Integration

### New Files

**`forge-lib/core/copilot_agent_ops.py`** — CRUD module:
- `create_copilot_agent(data, directory)` — Validate, render template, write file, update index
- `get_copilot_agent(slug, directory)` — Read agent by slug
- `query_copilot_agents(directory, filters)` — List with optional filters (status, capability type)
- `update_copilot_agent(slug, updates, directory)` — Update frontmatter + body, auto-timestamp

**`forge-lib/schemas/copilot_agent.json`** — JSON Schema validation

**`forge-lib/templates/copilot_agent.md.j2`** — Jinja2 template for markdown rendering

### CLI Commands

```bash
forge copilot-agent create "HR Policy Assistant" --data '{...}'
forge copilot-agent get "hr-policy-assistant"
forge copilot-agent query --filters '{"status": "draft"}'
forge copilot-agent update "hr-policy-assistant" --data '{...}'
```

## Sample Configs (3)

1. **sharepoint-knowledge-agent.md** — "IT Support Knowledge Base" grounded in SharePoint IT docs. Demonstrates OneDriveAndSharePoint scoping, structured troubleshooting workflows, citation patterns.

2. **email-insights-agent.md** — "Sales Email Summarizer" grounded in shared sales mailbox. Demonstrates Email capability, action item extraction, privacy-aware summarization.

3. **teams-channel-expert.md** — "Engineering Decisions Tracker" grounded in engineering Teams channels. Demonstrates TeamsMessages capability, decision attribution, consensus surfacing.

## Forge-Shell View

New view controller `copilot-forge.js` in forge-shell for the desktop dashboard — displays copilot agents with capability badges, status filtering, and instruction preview. Follows the `ForgeFS` direct-scanning pattern.

## M365 Copilot Agent Reference

### Capability Types (Knowledge Sources)

| Capability | Description | Licensing |
|-----------|-------------|-----------|
| WebSearch | Bing search, optionally scoped to 4 URLs | No license required |
| OneDriveAndSharePoint | SharePoint sites/folders/files, OneDrive | M365 Copilot license |
| GraphConnectors | External indexed data via Copilot connectors | M365 Copilot license |
| Email | Personal/shared mailboxes and folders | M365 Copilot license |
| TeamsMessages | Channels, group chats, 1:1 chats, meeting chats (max 5) | M365 Copilot license |
| Meetings | Meeting metadata, transcripts, chats (max 5) | M365 Copilot license |
| People | User profiles, org hierarchy, collaborator insights | M365 Copilot license |
| Dataverse | CRM/business data from Dataverse tables | M365 Copilot license |
| GraphicArt | Image generation from text prompts (DALL-E) | No license required |
| CodeInterpreter | Python code execution for data analysis, math, charts | No license required |

### Instruction Best Practices (Microsoft Guidance)

- Focus on what to do, not what to avoid
- Use precise verbs: "ask", "search", "send", "check", "use"
- Make tasks atomic (one action per step)
- Use Markdown headers for structure, bullets for parallel tasks, numbered steps for sequential
- Define domain vocabulary explicitly
- Reference capabilities and knowledge sources by name
- Include self-evaluation gates ("Before finalizing, confirm all items appear in the summary")
- Specify tone, verbosity, and output format explicitly

### Deployment Targets

Copy-ready output maps to these UI tools:
- **Agent Builder** (in M365 Copilot) — Simpler/faster for basic agents
- **Copilot Studio** — More customization (topics, orchestration, advanced actions)
- **Agents Toolkit** (VS Code/Visual Studio) — Pro-code, generates actual JSON files
