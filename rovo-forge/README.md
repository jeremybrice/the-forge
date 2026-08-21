# Rovo Forge

Interactive builder for Atlassian Rovo agents. Guides users through creating complete Rovo agent configurations for Jira and Confluence with pattern detection, guided workflows, and copy-ready output for Rovo Studio.

## Overview

Rovo Forge simplifies Rovo agent creation through:

1. **Pattern Detection**: Recognizes common use cases (ticket triage, sprint management, documentation, etc.)
2. **Guided Workflows**: Step-by-step interview process following TCREI framework
3. **Knowledge Integration**: Three specialized skills with comprehensive reference materials
4. **Copy-Ready Output**: Formatted sections that map directly to Rovo Studio UI fields
5. **Built-in Validation**: Checks character limits, word counts, and best practices

## Commands

### `/rovo-jira` - Jira Agent Builder

Build Rovo agents for Jira workflows.

**Use Cases:**
- Ticket triage and prioritization
- Sprint management and planning
- Bug reporting and tracking
- Work item organization
- Custom issue workflows

**Workflow:**
1. Pattern detection from user description
2. Identity configuration (name, description, team)
3. Behavior definition via TCREI framework
4. Scenario design (1-5 workflows per agent)
5. Knowledge source selection
6. Skill configuration (Jira Read, Write, Advanced Search, etc.)
7. Conversation starters and permissions
8. Copy-ready output for Rovo Studio

**Skills Used:**
- `rovo-foundation` - Platform knowledge (TCREI, validation, knowledge sources)
- `jira-specialist` - Jira patterns, skills catalog, issue types

**Output Format:**
- Step-by-step Rovo Studio instructions
- Copy-ready text for each UI field
- Validation summary table
- Agent metadata (name, description, behavior, scenarios, skills, sources)

**Example Patterns:**
- **Ticket Generation**: Create issues from natural language
- **Ticket Triage**: Categorize, prioritize, and route issues
- **Sprint Management**: Backlog grooming, capacity planning
- **Bug Reporting**: Structured defect capture with field validation
- **Work Item Organization**: Epic/story hierarchy, linking, dependencies

---

### `/rovo-confluence` - Confluence Agent Builder

Build Rovo agents for Confluence content and collaboration.

**Use Cases:**
- Documentation generation and updates
- Content search and summarization
- Meeting notes and action items
- Knowledge base Q&A
- Page templates and scaffolding

**Workflow:**
1. Use case identification
2. Identity configuration (name, description, team)
3. Behavior definition via TCREI framework
4. Scenario design (multiple content workflows)
5. Knowledge source selection (spaces, pages, labels)
6. Skill configuration (Confluence Read, Write, Search, etc.)
7. Conversation starters and permissions
8. Copy-ready output for Rovo Studio

**Skills Used:**
- `rovo-foundation` - Platform knowledge (TCREI, validation, knowledge sources)
- `confluence-specialist` - Confluence patterns, skills catalog, content types

**Output Format:**
- Step-by-step Rovo Studio instructions
- Copy-ready text for each UI field
- Validation summary table
- Agent metadata (name, description, behavior, scenarios, skills, sources)

**Example Patterns:**
- **Documentation Generator**: Create/update pages from inputs
- **Content Summarizer**: Digest long pages or spaces
- **Meeting Assistant**: Capture notes, extract action items
- **Knowledge Q&A**: Answer questions from space content
- **Template Builder**: Scaffold pages with predefined structure

---

## Skills

### `rovo-foundation`

Core Rovo platform knowledge applicable to all agent types.

**Topics:**
- **TCREI Framework**: Task, Context, Rules, Examples, Inputs
- **Validation Rules**: Character limits, word counts, scenario counts
- **Knowledge Sources**: Jira, Confluence, Google Drive, Slack, etc.
- **Instruction Framework**: How to write effective agent behaviors

**References:**
- `instruction-framework.md` - TCREI structure and best practices
- `knowledge-sources.md` - Available connectors and configuration
- `validation-rules.md` - Platform limits and constraints

---

### `jira-specialist`

Jira-specific domain knowledge for building Jira agents.

**Topics:**
- **Design Patterns**: Common Jira agent architectures
- **Skills Catalog**: All available Jira Rovo Skills (Read, Write, Search, etc.)
- **Issue Types**: Story, Bug, Task, Epic, etc.
- **Workflow Best Practices**: Field usage, linking, automation triggers

**References:**
- `jira-patterns.md` - 5 pre-built pattern templates
- `jira-skills-catalog.md` - Complete Jira Rovo Skills reference

**Patterns Included:**
1. Ticket Generation Agent
2. Ticket Triage Agent
3. Sprint Management Agent
4. Bug Reporting Agent
5. Work Item Organization Agent

---

### `confluence-specialist`

Confluence-specific domain knowledge for building Confluence agents.

**Topics:**
- **Design Patterns**: Common Confluence agent architectures
- **Skills Catalog**: All available Confluence Rovo Skills (Read, Write, Search, etc.)
- **Content Types**: Pages, blogs, comments, attachments
- **Collaboration Workflows**: Templates, macros, page trees

**References:**
- `confluence-patterns.md` - 5 pre-built pattern templates
- `confluence-skills-catalog.md` - Complete Confluence Rovo Skills reference

**Patterns Included:**
1. Documentation Generator Agent
2. Content Summarizer Agent
3. Meeting Assistant Agent
4. Knowledge Q&A Agent
5. Template Builder Agent

---

## Sample Configs

The `sample-configs/` directory contains complete agent configurations for reference:

- **ticket-triage-agent.md** - Jira triage agent with prioritization rules
- **documentation-specialist.md** - Confluence documentation generator

These serve as examples of well-structured agent configurations following best practices.

---

## Architecture: V2 vs V1

### V1 (Current)
```
rovo-agent-forge/
├── commands/
│   ├── jira-agent.md (319 lines) - Interactive builder
│   └── confluence-agent.md (323 lines) - Interactive builder
├── skills/
│   ├── rovo-foundation/ (428 lines) - Platform knowledge
│   ├── jira-specialist/ (395 lines) - Jira domain knowledge
│   └── confluence-specialist/ (426 lines) - Confluence domain knowledge
└── sample-configs/ (2 files)
```

**Total:** 1,891 lines

### V2 (This Plugin)
```
rovo-forge/
├── commands/
│   ├── jira-agent.md (319 lines) - UNCHANGED
│   └── confluence-agent.md (323 lines) - UNCHANGED
├── skills/
│   ├── rovo-foundation/ (428 lines) - UNCHANGED
│   ├── jira-specialist/ (395 lines) - UNCHANGED
│   └── confluence-specialist/ (426 lines) - UNCHANGED
├── sample-configs/ (2 files) - UNCHANGED
├── plugin.json (57 lines)
└── README.md (this file)
```

**Total:** 1,948 lines (+57 from plugin.json)

### Key Insight

**Rovo Forge needed ZERO architectural changes.**

Why? The commands were already pure conversational workflows:
- No file operations (output is copy-ready text for Rovo Studio UI)
- No YAML frontmatter generation
- No markdown file writing
- Skills are pure reasoning and reference materials

This plugin exemplifies the ideal: commands guide conversations, skills provide domain knowledge, and the user copies output to external tools (Rovo Studio).

The entire plugin migrated 1:1 from v1 to v2 with only metadata additions (plugin.json, README.md).

---

## Usage Examples

### Example 1: Create a Ticket Triage Agent

```
User: /rovo-jira
Agent: What should this Jira agent do? Tell me about the use case...

User: I need an agent to triage incoming support tickets

Agent: I've detected a Ticket Triage use case. Here's a starting configuration:
- Name: "Support Ticket Triage Agent"
- Role: Categorizes, prioritizes, and routes support tickets
- Scenarios: Triage workflow, Priority Assessment
- Skills: Jira Read, Jira Write, Jira Advanced Search

Would you like to use this as a starting point?

User: Yes

Agent: [Proceeds through guided workflow, collecting details]
Agent: [Outputs copy-ready configuration for Rovo Studio]
```

### Example 2: Create a Documentation Generator

```
User: /rovo-confluence
Agent: What should this Confluence agent do?

User: Generate API documentation from code comments

Agent: [Guides through identity, behavior, scenarios, knowledge sources]
Agent: [Outputs complete configuration with:
  - Agent name and description
  - Behavior instructions
  - Scenario workflows
  - Knowledge sources (GitHub, Confluence spaces)
  - Skills (Confluence Write, Search)
  - Conversation starters
]
```

---

## Integration with Rovo Studio

Rovo Forge outputs map directly to Rovo Studio UI:

| Rovo Forge Output | Rovo Studio Field |
|-------------------|-------------------|
| Agent Name | Name field |
| Agent Description | Description field |
| Behavior Instructions | Behavior / Global Instructions |
| Scenario Name | Scenario Name |
| Scenario Keywords | Trigger Keywords |
| Scenario Instructions | Scenario Instructions |
| Knowledge Sources | Knowledge Sources panel |
| Skills to Enable | Skills panel (checkboxes) |
| Conversation Starters | Conversation Starters (3 max) |
| Owner/Visibility | Permissions settings |

Users copy-paste each section into the corresponding Rovo Studio field, eliminating manual configuration and reducing errors.

---

## Key Features

1. **Pattern Detection**: Recognizes 10+ common patterns across Jira and Confluence
2. **TCREI Framework**: Ensures consistent, high-quality agent instructions
3. **Validation**: Checks character limits, word counts, scenario counts
4. **Skills Catalog**: Complete reference for all Jira/Confluence Rovo Skills
5. **Pre-filled Templates**: Jump-start agent creation with proven patterns
6. **Knowledge Source Guidance**: Helps select appropriate data sources
7. **Conversation Starters**: Suggests natural language prompts for users
8. **Permissions Guidance**: Recommends owner, collaborators, visibility settings

---

## Related Plugins

- **product-forge** - Card-based product management (initiatives, epics, stories)
- **forge-memory** - Organizational taxonomy and knowledge management
- **tasks-forge** - Task tracking and prioritization
- **cognitive-forge** - Multi-agent debates and explorations
- **report-forge** - Multi-agent report generation

---

## Version History

- **v2.0.0** (2026-02-14)
  - Migrated from v1 rovo-agent-forge
  - Zero architectural changes (already pure conversational workflows)
  - Added plugin.json registration
  - Added comprehensive README documentation
  - Renamed plugin from rovo-agent-forge to rovo-forge

---

## License

Part of The Forge plugin suite v2.
