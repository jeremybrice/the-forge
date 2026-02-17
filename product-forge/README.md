# Product Forge

Product management plugin for Claude Code with orchestrator-agent architecture. Three orchestrator commands detect card types, recruit specialized agents, and handle persistence via forge-lib.

## Commands (8)

| Command | Description |
|---------|-------------|
| `/product-forge:create` | Create cards with auto-detection or `--type` override |
| `/product-forge:update` | Update existing cards with semantic diff |
| `/product-forge:review` | Review cards for quality (read-only) |
| `/product-forge:init` | Initialize cards directory |
| `/product-forge:checkpoint` | Quick knowledge capture |
| `/product-forge:link-to-jira` | Link cards to Jira issues |
| `/product-forge:pull-from-jira` | Pull updates from Jira |
| `/product-forge:push-to-jira` | Push card content to Jira |

## Agents (6)

Specialized reasoning agents recruited by orchestrator commands. Agents are read-only — they return structured content and never write files.

| Agent | Role | Tone |
|-------|------|------|
| `forge-initiative` | Strategic Planner | Executive — business-focused |
| `forge-epic` | Scope Architect | Planning — balances business and technical |
| `forge-story` | Engineering Spec Writer | Engineering — precise, implementable |
| `forge-decision` | Decision Extractor | Analytical — structured reasoning |
| `forge-intake` | Requirements Interviewer | Conversational — adaptive Q&A |
| `forge-release-notes` | Release Documenter | Customer-facing — benefit-focused |

## Architecture

```
User → /product-forge:create "notification system overhaul"
         │
         ▼
    Orchestrator (create.md)
         │
         ├── Detect card type (pm-methodology skill)
         ├── Assemble concept brief
         │
         ├── Task tool → Spawn forge-initiative agent
         │   └── Agent returns {title, frontmatter, sections}
         │
         ├── Present draft → User approves
         │
         ├── forge card create initiative "..." --data '{...}'
         ├── forge relationship link parent.md child.md
         │
         └── "Created: cards/initiatives/notification-system-overhaul.md"
```

**Key principles:**
- Commands orchestrate, agents reason
- Agents never call forge-lib or write files
- User approval gate before any persistence
- Concept brief is the interface contract

## Card Type Detection

The `/product-forge:create` command auto-detects card type from user signals:

| User Signal | Card Type |
|-------------|-----------|
| ROM, estimation, "should we build this" | Initiative |
| Body of work, break down into stories | Epic |
| User story, acceptance tests, sprint work | Story |
| Architectural decision, "we decided" | Decision |
| Requirements, feature request | Intake |
| Changelog, what shipped | Release Notes |

Use `--type <card-type>` to override auto-detection.

## Skills

| Skill | Purpose |
|-------|---------|
| `pm-methodology` | Card-type signals, writing guidelines, content rules |
| `product-context` | Product taxonomy (products, modules, clients) |
| `jira-sync` | Jira integration workflows |

## Data

All cards stored in `cards/` with `index.json` for fast querying. Persistence handled exclusively by forge-lib CLI.
