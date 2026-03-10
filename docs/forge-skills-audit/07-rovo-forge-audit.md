# Rovo Forge Audit Card

**Plugin:** Rovo Forge v2.2.0
**Audit Date:** 2026-03-09
**Audit Scope:** Complete skills, references, commands, and sample configs
**Total Files:** 14
**Total Lines:** 2,298

---

## Plugin Overview

Rovo Forge provides comprehensive guidance for building Atlassian Rovo agents (AI assistants for Jira and Confluence automation). The plugin implements a pedagogical three-tier architecture:

1. **Foundation Layer** (`rovo-foundation` skill): Platform knowledge covering the TCREI instruction framework, validation rules, connector inventory, and permission model
2. **Domain-Specialist Layers** (`jira-specialist`, `confluence-specialist`): Issue-tracking and content-creation domain knowledge with design patterns for common use cases
3. **Interactive Builders** (`jira-agent`, `confluence-agent` commands): Guided interview flows that synthesize foundation + specialist knowledge to produce copy-ready agent configurations
4. **Reference Examples** (`sample-configs/`): Complete working agent configurations demonstrating best practices

The plugin's primary behavioral claim is that it can guide users through **guided interview workflows** to produce complete, validated Rovo agent configurations using TCREI framework principles.

---

## Component Inventory

| Component | Type | Lines | Purpose |
|---|---|---|---|
| **rovo-foundation/SKILL.md** | Reference | 75 | Platform overview: taxonomy, instruction framework, knowledge sources, validation, two-tier architecture, automation mode, permissions |
| **instruction-framework.md** | Reference | 165 | TCREI framework specification (Task, Context, Roles, Examples, Implementation), two-tier instruction model, syntax rules, advanced patterns, anti-patterns, quality checklist |
| **knowledge-sources.md** | Reference | 151 | Connector inventory (12 Atlassian + 50+ third-party + 20+ MCP), connector types, scoping strategies, deep research, permission model, teamwork graph |
| **validation-rules.md** | Reference | 112 | Numeric constraints (name/description/behavior/scenario/starters/skills/collaborators), performance impact table, validation checks per component, known limitations (Jira-specific, Confluence-specific, cross-platform), automation mode constraints |
| **jira-specialist/SKILL.md** | Reference | 76 | Jira domain: naming convention, issue type taxonomy (Epic/Story/Task/Bug/Sub-task), skills catalog overview, known limitations, skill selection strategy, design patterns, instruction patterns |
| **jira-patterns.md** | Reference | 159 | 5 pre-built Jira agent patterns (Ticket Generation, Ticket Triage, Sprint Management, Bug Reporting, Work Item Organization) + automation integration patterns |
| **jira-skills-catalog.md** | Reference | 165 | Detailed specs for 9 Jira skills (Create/Search/Update/Comment/Find Similar/Link/Transition/Suggest Assignee/Add to Sprint) + Jira Field Search system skill + Delete Issues + Analysis capabilities + Automation interaction |
| **confluence-specialist/SKILL.md** | Reference | 79 | Confluence domain: naming convention, content type taxonomy (standard/blog/live document/whiteboard), skills catalog overview, known limitations (no bulk ops, no merge, no templates), skill selection strategy, design patterns, instruction patterns |
| **confluence-patterns.md** | Reference | 176 | 5 pre-built Confluence agent patterns (Documentation Generation, Content Summarization, Release Notes, Meeting Notes, Knowledge Base Maintenance) + content lifecycle phases + automation integration patterns |
| **confluence-skills-catalog.md** | Reference | 176 | Detailed specs for 10 Confluence skills (Create/Update/Publish/Archive/Search/Get Content/List Space/Add Comment/Change Owner/Add Restriction) + 2 system skills (Content Retrieval, Space Search) + Automation interaction |
| **commands/jira-agent.md** | Command | 336 | Interactive Jira agent builder: Phase 1-11 flow (assessment > identity > behavior > scenarios > knowledge > skills > starters > governance > automation > assembly > persistence) with validation checks and output formatting |
| **commands/confluence-agent.md** | Command | 340 | Interactive Confluence agent builder: Phase 1-11 flow (assessment > identity > behavior > scenarios > knowledge > skills > starters > governance > automation > assembly > persistence) with validation checks and output formatting |
| **sample-configs/ticket-triage-agent.md** | Example | 129 | Complete working Jira config with 2 scenarios (Ticket Generation + Ticket Triage), skills, knowledge sources, starters, validation summary with warnings |
| **sample-configs/documentation-specialist.md** | Example | 159 | Complete working Confluence config with 3 scenarios (Creation + Review + Maintenance), skills, knowledge sources, starters, validation summary with warnings |

---

## Per-Component Evaluation

### 1. rovo-foundation/SKILL.md

**Trigger & Description Quality:** `Strong`
- Clear metadata (name: rovo-foundation, description covering platform knowledge)
- Self-evident purpose: foundational reference for both Jira and Confluence agents

**Core Objective Clarity:** `Strong`
- States explicitly: "You are an expert in Atlassian Rovo agent configuration"
- Defines primary knowledge areas: taxonomy, TCREI framework, knowledge sources, governance, automation

**Procedural Logic:** `Strong`
- Structured into logical sections (Agent Component Taxonomy > Instruction Framework > Two-Tier Architecture > Knowledge Source Configuration > Validation Rules > Automation Mode > Permission Model > Output Format)
- Each section cross-references detailed reference files for deep learning

**Human-in-the-Loop Gates:** `Strong`
- Emphasizes validation and confirmation requirements as part of the permission model
- Output format specifies "copy-ready clipboard blocks" with validation summary checks

**Output Specifications:** `Strong`
- Output format explicitly stated: "output each section as a copy-ready clipboard block"
- Validation summary flagged as required

**Reference File Utilization:** `Strong`
- All major concepts link to dedicated reference files (instruction-framework.md, knowledge-sources.md, validation-rules.md)
- Cross-references are precise and actionable

**Connector/Tool Integration:** `Strong`
- Deep knowledge of Atlassian product ecosystem (Jira, Confluence, JSM, Atlas, Loom, Bitbucket) + 50+ third-party connectors + MCP
- Permission model and automation mode are well-integrated concepts

**Progressive Disclosure & Size:** `Strong`
- 75 lines is appropriate for a foundational reference
- Layering: high-level taxonomy in SKILL.md, detailed specs in references

**Cross-Plugin Handoff:** `Strong`
- Foundation skill is designed to support both Jira and Confluence specialist skills
- Clear separation of concerns: platform knowledge (foundation) vs. domain knowledge (specialists)

**Writing Quality:** `Strong`
- Clear, declarative sentences
- Technical terminology used precisely (TCREI, two-tier, knowledge sources, permission model)
- No ambiguity

**Score: 9/10** - Single minor: could strengthen permission model explanation with one example

---

### 2. instruction-framework.md

**Trigger & Description Quality:** `Strong`
- Title clearly states purpose: TCREI Framework specification
- Comprehensive coverage of framework components

**Core Objective Clarity:** `Strong`
- Explicitly teaches the TCREI framework (Task, Context, Roles, Examples, Implementation)
- States each component's purpose with syntax and examples

**Procedural Logic:** `Strong`
- Task section: "Define the ultimate goal or outcome"
- Context section: "Provide essential background that grounds decisions"
- Roles section: "Establish professional identity and responsibility"
- Examples section: "Show the agent how to perform tasks through concrete examples"
- Implementation section: "Articulate the detailed process"

**Human-in-the-Loop Gates:** `Strong`
- Confirmation and guardrail pattern explicitly documented
- Error handling pattern with fallback behavior
- Advanced patterns section covers real-world scenarios

**Output Specifications:** `Strong`
- Syntax rules clearly specified for each component
- Writing style guidelines (clear, declarative, active voice, address as "you")
- Output formatting guidance for both chat and automation

**Reference File Utilization:** `Strong`
- Provides complete reference; stands alone well
- Would benefit from cross-references to how TCREI applies in Jira vs. Confluence context (found in domain-specific files)

**Connector/Tool Integration:** `Strong`
- Entity references section explains how to reference Atlassian products
- Smart variables for automation rule integration covered

**Progressive Disclosure & Size:** `Strong`
- 165 lines provides comprehensive instruction without overwhelming
- Breaks down into Task > Context > Roles > Examples > Implementation
- Advanced Patterns section for users needing deeper complexity
- Anti-Patterns checklist provides defensive guidance

**Cross-Plugin Handoff:** `Strong`
- Framework applies universally (both Jira and Confluence)
- Specialist plugins layer domain-specific examples on top

**Writing Quality:** `Strong`
- Clear examples for each framework component
- Anti-patterns table is excellent pedagogical tool
- Checklist at end provides actionable quality gates

**Score: 10/10** - Exemplary reference material

---

### 3. knowledge-sources.md

**Trigger & Description Quality:** `Strong`
- Title clearly signals scope: Knowledge Sources Reference
- Covers connector inventory comprehensively

**Core Objective Clarity:** `Strong`
- Explains how Rovo agents access information through configured knowledge sources
- Defines what types of connectors are available and how they behave

**Procedural Logic:** `Strong`
- Structured inventory: Atlassian Native Sources > Third-Party Connectors > MCP Connectors
- Connector types table explains Setup, Behavior, Best For each type
- Scoping strategies provide decision framework: Single-Resource > Multiple-Resource > Filtered Subset > Hierarchical > "All Organizational Knowledge"

**Human-in-the-Loop Gates:** `Strong`
- Permission model section clarifies: "Agents never grant additional permissions"
- Deep Research is gated behind scenario-level selection + 30 requests/user/day + 15-min timeout

**Output Specifications:** `Strong`
- Best practices section specifies how to document sources in agent description
- Knowledge source recommendations are decision-making guidance

**Reference File Utilization:** `Strong`
- Comprehensive standalone reference
- Would integrate well with domain-specific patterns (Jira triage examples for filtered subset scoping, Confluence documentation examples for hierarchical scoping)

**Connector/Tool Integration:** `Strong`
- Detailed connector types table explaining setup mechanisms (Synced, Synced Lite, Direct, Smart Link, MCP)
- Teamwork Graph concept explained (contextual search beyond keyword matching)

**Progressive Disclosure & Size:** `Strong`
- 151 lines appropriately sized
- Connector inventory presented with clear categorization
- Deep Research callout warns about limits before users hit them

**Cross-Plugin Handoff:** `Strong`
- Both Jira and Confluence patterns reference this file for scoping strategies
- Allows agents to be built with appropriate source configuration

**Writing Quality:** `Strong`
- Technical but clear
- Examples illuminate each scoping strategy
- Teamwork Graph explanation is sophisticated but accessible

**Score: 9/10** - Very strong. Single minor: Deep Research section could expand on when to recommend vs. when to avoid

---

### 4. validation-rules.md

**Trigger & Description Quality:** `Strong`
- Title precisely signals: validation rules and numeric constraints
- Scope is clear (component constraints, performance impact, validation checks, known limitations)

**Core Objective Clarity:** `Strong`
- Comprehensive numeric validation table with severity levels
- Instruction length performance impact table linking word count to behavior consistency
- Validation checks organized by component (Name, Description, Behavior, Scenario, Skills, Conversation Starters, Governance)

**Procedural Logic:** `Strong`
- Agent Component Constraints table is canonical reference for all limits
- Validation Checks section specifies what to validate for each component
- Known Limitations section provides workarounds (custom fields > use automation rules, automation mode > text-only responses, etc.)

**Human-in-the-Loop Gates:** `Strong`
- Validation required before output (Phase 10 of both command files relies on this)
- Automation mode constraints clearly documented (no skills, text response only)
- Deep Research timeout (15 minutes) is a hard gate

**Output Specifications:** `Strong`
- Comprehensive validation specification table
- Clear pass/fail/warn criteria for each component
- Known limitations section provides workarounds to communicate to users

**Reference File Utilization:** `Strong`
- Standalone authoritative reference
- Commands/jira-agent.md and commands/confluence-agent.md both invoke this during Phase 10

**Connector/Tool Integration:** `Strong`
- System skills section notes auto-configuration (don't count against manual skill limit)
- Automation mode section explains skill availability changes

**Progressive Disclosure & Size:** `Strong`
- 112 lines appropriately sized for reference
- Performance impact table (word count to consistency) is valuable guidance
- Optimization strategy recommends behavior conciseness + scenario splitting + knowledge sources supplementation

**Cross-Plugin Handoff:** `Strong`
- Commands use this for validation
- Both Jira and Confluence patterns reference constraints
- Works with reference files (instruction-framework for length recommendations)

**Writing Quality:** `Strong`
- Technical precision with clear tables
- Workarounds are specific and actionable
- Known limitations categorized (Jira-specific, Confluence-specific, cross-platform)

**Score: 10/10** - Essential reference, comprehensive and authoritative

---

### 5. jira-specialist/SKILL.md

**Trigger & Description Quality:** `Strong`
- Metadata clear: Jira-specific domain knowledge
- States expertise: "You are an expert in Jira-specific Rovo agent configuration"

**Core Objective Clarity:** `Strong`
- Defines scope: issue types, workflows, field requirements, JQL, Jira skills catalog
- States command activation: use this knowledge with `/rovo-jira`

**Procedural Logic:** `Strong`
- Naming convention section (action-verb convention)
- Issue type taxonomy with explicit definitions (Epic = multi-sprint initiative, Story = user-facing feature, Task = internal work, Bug = defect, Sub-task = technical breakdown)
- Skills catalog with 9 manually-enabled skills + 1 system skill
- Known limitations tied to workarounds
- Skill selection strategy provides pattern-specific recommendations
- Design patterns reference section

**Human-in-the-Loop Gates:** `Strong`
- Mentions confirmation requirements (users always asked to confirm before skill execution in chat)
- Automation mode constraints explicitly noted (cannot use skills)

**Output Specifications:** `Strong`
- Design patterns reference clarifies that configurations are "copy-ready"

**Reference File Utilization:** `Strong`
- All major sections cross-reference detailed files (jira-patterns.md for pre-built configs, jira-skills-catalog.md for skill details)

**Connector/Tool Integration:** `Strong`
- Jira Field Search system skill noted as auto-configured
- Skill selection strategy aligned with Jira architectural concerns (workflow transitions, field validation, priority assessment)

**Progressive Disclosure & Size:** `Strong`
- 76 lines provides domain overview without overwhelming
- Naming convention, issue taxonomy, skill catalog overview, design patterns structure logically

**Cross-Plugin Handoff:** `Strong`
- Designed to support `/rovo-jira` command
- References foundation skill for framework guidance
- Issue type taxonomy feeds into pattern-specific requirements

**Writing Quality:** `Strong`
- Clear issue type definitions
- Skill names are action-oriented ("Create Jira Work Item," not "WorkItemCreationSkill")
- Known limitations are specific with workarounds

**Score: 9/10** - Strong domain overview. Minor: could expand "Known Limitations" with one example showing the workaround in action

---

### 6. jira-patterns.md

**Trigger & Description Quality:** `Strong`
- Title clearly signals: Jira Agent Design Patterns
- Five pre-built patterns with purpose, name, description template

**Core Objective Clarity:** `Strong`
- Each pattern provides a complete working template: name, description, behavior, scenarios, skills, knowledge sources, starters
- Two automation integration patterns show real-world use

**Procedural Logic:** `Strong`
- Ticket Generation pattern: step-by-step creation process with field requirements per issue type
- Ticket Triage pattern: impact x urgency matrix with priority mapping, team routing logic, field validation
- Sprint Management pattern: three scenarios (Planning, Blocker Detection, Board State)
- Bug Reporting pattern: interview flow for gathering bug information
- Work Item Organization pattern: epic/story/linking workflows

**Human-in-the-Loop Gates:** `Strong`
- Behavior templates include confirmation requirements and permission awareness
- Scenario processes include "Present summary for confirmation" steps

**Output Specifications:** `Strong`
- Each pattern specifies skills, knowledge sources, conversation starters, and behavior template
- Automation integration patterns show structured output format for parsing

**Reference File Utilization:** `Strong`
- Builds on rovo-foundation concepts (TCREI, validation rules, knowledge sources)
- Assumes knowledge of Jira issue types and workflows

**Connector/Tool Integration:** `Strong`
- Knowledge sources specified per pattern (e.g., Triage uses "Recently Triaged Tickets" filter + team responsibility matrix)
- Automation integration patterns show {{agentResponse}} smart value usage

**Progressive Disclosure & Size:** `Strong`
- 159 lines: 5 patterns (approx 30-32 lines each) leaves room for detail
- Automation patterns add practical integration guidance

**Cross-Plugin Handoff:** `Strong`
- Designed to be inserted as pre-filled templates in `/rovo-jira` command (Phase 1: Pattern Detection)
- Each pattern references foundation concepts (TCREI, confirmation gates, permission awareness)

**Writing Quality:** `Strong`
- Behavior templates are concrete and immediately usable
- Priority matrix and team routing logic are explicit decision frameworks
- Automation patterns model complex workflows

**Score: 10/10** - Five well-developed patterns with clear templates and automation integration

---

### 7. jira-skills-catalog.md

**Trigger & Description Quality:** `Strong`
- Title clearly states: Jira Skills Catalog
- Each skill has "What it does" opening statement

**Core Objective Clarity:** `Strong`
- Each of 9 skills documented with What it does, Parameters, Limitations, Recommended for
- Additional Analysis Capabilities section shows emergent behaviors from skill combinations
- Automation interaction section explains skills behavior when invoked from rules

**Procedural Logic:** `Strong`
- Create Jira Work Item: parameters and workaround for custom fields/labels
- Search Jira Issues: natural language or JQL translation
- Update Issue Fields: modification with limitations
- Add Issue Comment: posting with attribution
- Find Similar Issues: semantic matching
- Link Issues: relationship creation
- Transition Issue Status: workflow compliance
- Suggest Assignee: recommendation engine
- Add to Sprint: sprint inclusion
- Jira Field Search (system): auto-configured metadata lookup
- Delete Issues: rarely-recommended cleanup skill

**Human-in-the-Loop Gates:** `Strong`
- Confirmation requirements noted for all skills in chat
- Automation mode disables skills entirely (text response only)
- Safety for Delete Issues: "Multiple confirmation dialogs (safety feature, cannot be disabled in chat)"

**Output Specifications:** `Strong`
- Parameters clearly specified per skill
- Limitations include specific workarounds (e.g., "use post-creation Jira automation rules to move data from description to proper fields")

**Reference File Utilization:** `Strong`
- Builds on validation-rules.md (skill limits, automation constraints)
- Referenced by jira-patterns.md for skill selection strategy
- Used by jira-agent.md Phase 6 for skill presentation

**Connector/Tool Integration:** `Strong`
- Jira Field Search is automatically enabled as a system skill
- Custom field writing workaround through automation rules
- Smart values ({{agentResponse}}) for automation contexts

**Progressive Disclosure & Size:** `Strong`
- 165 lines for 11 skills (10 + system) = ~15 lines per skill
- Additional Analysis Capabilities section reveals emergent properties
- Automation interaction section explains behavior shift

**Cross-Plugin Handoff:** `Strong`
- Used by jira-patterns.md (Pattern 1 recommends skills 1,2,3; Pattern 2 recommends 2,3,4,5, etc.)
- Presented in jira-agent.md Phase 6

**Writing Quality:** `Strong`
- Clear parameter specifications
- Limitations are specific (custom fields, workaround provided)
- Recommended for sections tie skills to use cases

**Score: 9/10** - Strong catalog. Minor: Suggest Assignee and Delete Issues could expand on behavioral details

---

### 8. confluence-specialist/SKILL.md

**Trigger & Description Quality:** `Strong`
- Metadata clear: Confluence-specific domain knowledge
- States expertise: "You are an expert in Confluence-specific Rovo agent configuration"

**Core Objective Clarity:** `Strong`
- Defines scope: content types, page hierarchies, publishing workflows, skills catalog
- States command activation: use with `/rovo-confluence`

**Procedural Logic:** `Strong`
- Naming convention section (role-based convention)
- Content type taxonomy (standard page, blog post, live document, whiteboard)
- Skills catalog with 10 manually-enabled skills + 2 system skills
- Known limitations (no bulk ops, no merge, no templates, no workflow state management)
- Skill selection strategy provides pattern-specific recommendations
- Design patterns reference section
- Confluence-specific instruction patterns (content type selection, audience targeting, page hierarchy, metadata, publishing workflow, content lifecycle, quality emphasis)

**Human-in-the-Loop Gates:** `Strong`
- Mentions confirmation gates for review and publishing
- Automation mode constraints noted

**Output Specifications:** `Strong`
- Design patterns reference clarifies configurations are "copy-ready"

**Reference File Utilization:** `Strong`
- All major sections cross-reference detailed files (confluence-patterns.md, confluence-skills-catalog.md)

**Connector/Tool Integration:** `Strong`
- Confluence Content Retrieval and Space Search Optimization system skills noted as auto-configured
- Skill selection strategy aligned with content lifecycle phases

**Progressive Disclosure & Size:** `Strong`
- 79 lines provides domain overview appropriately scoped
- Content type taxonomy, skills catalog overview, design patterns structure logically

**Cross-Plugin Handoff:** `Strong`
- Designed to support `/rovo-confluence` command
- References foundation skill for framework guidance
- Content type taxonomy feeds into pattern-specific requirements

**Writing Quality:** `Strong`
- Clear content type definitions with use cases
- Skill names are role-oriented ("Create Confluence Page," not "PageCreationSkill")
- Known limitations are specific and candid about constraints

**Score: 10/10** - Strong domain overview with candid limitation assessment

---

### 9. confluence-patterns.md

**Trigger & Description Quality:** `Strong`
- Title clearly signals: Confluence Agent Design Patterns
- Five pre-built patterns with purpose, name, description template

**Core Objective Clarity:** `Strong`
- Each pattern provides complete working template: name, description, behavior, scenarios, skills, knowledge sources, starters
- Content lifecycle integration table aligns patterns to authoring > review > publishing > maintenance phases
- Two automation integration patterns show real-world use

**Procedural Logic:** `Strong`
- Documentation Generation: content type selection, audience targeting, outline > approval > generation > metadata > cross-linking > review > publish
- Content Summarization: three scenarios (Executive Summary, Technical Summary, Quick Reference)
- Release Notes: category organization, customer-centric language, breaking change handling
- Meeting Notes: metadata capture, decision/action item documentation with owner/deadline
- Knowledge Base Maintenance: audit (outdated, duplicates, orphans, metadata) > organize > archive

**Human-in-the-Loop Gates:** `Strong`
- Behavior templates emphasize "request user confirmation before publishing"
- Scenario processes include "Get user approval on outline" and "Confirm and publish"
- Knowledge Base Maintenance: "wait for explicit user approval before executing" per page

**Output Specifications:** `Strong`
- Each pattern specifies skills, knowledge sources, conversation starters, behavior template
- Content Lifecycle Integration table aligns phases to skills
- Automation integration patterns show expected behaviors

**Reference File Utilization:** `Strong`
- Builds on rovo-foundation concepts (TCREI, validation rules, knowledge sources)
- Assumes knowledge of Confluence content types and hierarchy

**Connector/Tool Integration:** `Strong`
- Knowledge sources specified per pattern (e.g., Release Notes uses Jira project + Confluence space + GitHub optional)
- Automation patterns show Confluence automation rule triggers (page published, page created, scheduled)

**Progressive Disclosure & Size:** `Strong`
- 176 lines: 5 patterns + content lifecycle table + automation patterns
- Content lifecycle integration table is excellent organizational reference

**Cross-Plugin Handoff:** `Strong`
- Designed to be inserted as pre-filled templates in `/rovo-confluence` command
- Each pattern references foundation concepts (TCREI, confirmation gates, permission awareness)

**Writing Quality:** `Strong`
- Behavior templates are concrete and immediately usable
- Content type guidance is detailed (API docs, User guides, Architecture docs, Runbooks)
- Quality requirements for Meeting Notes are explicit (owner, deadline, decision rationale)

**Score: 10/10** - Five well-developed patterns with content lifecycle integration and automation guidance

---

### 10. confluence-skills-catalog.md

**Trigger & Description Quality:** `Strong`
- Title clearly states: Confluence Skills Catalog
- Each skill has "What it does" opening with parameters

**Core Objective Clarity:** `Strong`
- 10 manually-enabled skills documented with What it does, Parameters, Limitations, Best practice workflow, Recommended for
- 2 system skills (Content Retrieval, Space Search Optimization) documented
- Automation interaction section explains skill behavior from rules
- Common automation patterns provided

**Procedural Logic:** `Strong`
- Create Confluence Page: no bulk ops, no template application, requires outline approval
- Update Confluence Page Content: section replacement preferred, no merge capability, requires content retrieval first
- Publish Confluence Page: publication timing/notification options
- Archive Confluence Page: soft-delete with per-page user confirmation
- Search Confluence Content: full-text or semantic (algorithm details unclear per notes)
- Get Page Content: retrieval for analysis/editing, doesn't auto-refresh on updates
- List Space Content: hierarchy enumeration with optional filtering
- Add Comment to Confluence Page: feedback without direct page modification
- Change Page Owner: ownership reassignment (requires admin)
- Add Page Restriction: access control modification (requires careful governance)

**Human-in-the-Loop Gates:** `Strong`
- Archive requires explicit per-page user confirmation
- All skills disabled in automation mode (text response only)
- Change Page Owner and Add Page Restriction flagged as sensitive operations requiring governance

**Output Specifications:** `Strong`
- Parameters clearly specified per skill
- Limitations include specific best practices (e.g., "Retrieve current content first > identify what needs to change > suggest specific edits")
- Best practice workflows provided for each skill

**Reference File Utilization:** `Strong`
- Builds on validation-rules.md (automation constraints)
- Referenced by confluence-patterns.md for skill selection strategy
- Used by confluence-agent.md Phase 6 for skill presentation

**Connector/Tool Integration:** `Strong`
- Confluence Content Retrieval system skill auto-enabled when Confluence is knowledge source
- Space Search Optimization system skill prioritizes configured spaces
- Smart values for automation contexts

**Progressive Disclosure & Size:** `Strong`
- 176 lines for 12 skills (10 + 2 system)
- Best practice workflows illuminate how to use skills effectively
- Automation interaction section explains behavior shift
- Common automation patterns provided (Content Creation on Trigger, Content Review on Creation, Scheduled Maintenance)

**Cross-Plugin Handoff:** `Strong`
- Used by confluence-patterns.md (Pattern 1 recommends skills 1,2,3,5; Pattern 2 recommends 1,5,6,8, etc.)
- Presented in confluence-agent.md Phase 6

**Writing Quality:** `Strong`
- Clear parameter specifications
- Best practice workflows are detailed and actionable
- Limitations are specific with guidance on how to work around them
- Automation patterns provide integration templates

**Score: 10/10** - Excellent catalog with best practice workflows

---

### 11. commands/jira-agent.md

**Trigger & Description Quality:** `Strong`
- Metadata clear: Jira Agent Builder interactive command
- States purpose: "Interactive Rovo agent builder for Jira"
- Guides through TCREI framework to produce copy-ready configuration

**Core Objective Clarity:** `Strong`
- Phase 1: Assessment and Pattern Detection (match to 5 Jira patterns)
- Phase 2: Identity Configuration (name, description, authoring team)
- Phase 3: Behavior Definition (TCREI role/scope/style/permissions/confirmation)
- Phase 4: Scenario Design (distinct workflows, triggers, instructions)
- Phase 5: Knowledge Source Selection (Jira projects, Confluence spaces, external sources, per-scenario scoping)
- Phase 6: Skill Selection (catalog with recommendations, enforcement of max 5, limitation flagging)
- Phase 7: Conversation Starters (3 action-oriented starters)
- Phase 8: Governance (owner, collaborators, visibility)
- Phase 9: Automation Integration (optional, explains constraints, guides structured output)
- Phase 10: Assembly and Output (validation checks, output format, clipboard blocks)
- Phase 11: File Persistence (forge-lib integration for saving)

**Procedural Logic:** `Strong`
- Phase 1 pattern detection: 5 patterns with keywords, proposes pre-filled configuration
- Phase 2-9: Guided interview with conversational tone ("Don't ask every question if context already provides answers")
- Phase 10: Silent validation checks with Validation Summary table output
- Phase 11: forge agent create command with response parsing and error handling

**Human-in-the-Loop Gates:** `Strong`
- Phase 1: User chooses pre-filled pattern or builds from scratch
- Phase 3: User confirmation of behavior text ("Review and let me know if anything should change")
- Phase 5: Confirmation questions for knowledge source decisions
- Phase 6: User selection of skills with warnings if >5
- Phase 7: User adjustment of conversation starters
- Phase 8: Owner, collaborator, visibility confirmation
- Phase 10: Validation summary before output (not a gate, just reporting)

**Output Specifications:** `Strong`
- Phase 10 output format shows exactly what will be copied into Rovo Studio
- Markdown format with clearly delineated sections (Name, Description, Behavior, Scenarios, Starters, Permissions)
- Validation Summary table with PASS/FAIL/WARN status
- Warnings section highlights limitations and workarounds
- Phase 11 shows forge-lib command syntax and response parsing

**Reference File Utilization:** `Strong`
- Uses jira-specialist skill for pattern detection and domain knowledge
- Uses rovo-foundation skill for TCREI framework and validation rules
- Cross-references patterns, patterns reference skills catalog, skills catalog references validation-rules

**Connector/Tool Integration:** `Strong`
- Phase 5 knowledge sources configured with Jira projects and Confluence spaces
- Phase 9 automation integration explains {{agentResponse}} smart value usage
- Phase 11 forge-lib integration for persistence

**Progressive Disclosure & Size:** `Strong`
- 336 lines: 11 phases with clear break points
- Adaptive interview behavior section (end of file) provides conversational guidance: "be conversational, batch questions, show your work, validate incrementally, offer pattern refinement"

**Cross-Plugin Handoff:** `Strong`
- Phase 11 saves to `rovo-agents/{slug}/agent.md` for Rovo Forge dashboard access
- Hands off validated configuration to user for testing in Rovo Studio

**Writing Quality:** `Strong`
- Clear phase structure with italicized guidance
- Conversational tone despite technical content
- Pattern detection keywords are practical ("create" OR "generate" OR "make" OR "new" OR "write")
- Error handling for forge-lib failures provided

**Score: 9/10** - Excellent interactive builder. Minor: Phase 10 validation checks could explain WHY each constraint matters (e.g., "Skills >5 degrades focus and performance")

---

### 12. commands/confluence-agent.md

**Trigger & Description Quality:** `Strong`
- Metadata clear: Confluence Agent Builder interactive command
- States purpose: "Interactive Rovo agent builder for Confluence"
- Guides through TCREI framework to produce copy-ready configuration

**Core Objective Clarity:** `Strong`
- Phase 1: Assessment and Pattern Detection (match to 5 Confluence patterns)
- Phase 2: Identity Configuration (name, description, authoring team)
- Phase 3: Behavior Definition (TCREI role/scope/content quality emphasis/permissions/confirmation gates/quality)
- Phase 4: Scenario Design (distinct workflows, triggers, instructions)
- Phase 5: Knowledge Source Selection (Confluence spaces, page hierarchies, Jira projects, external sources)
- Phase 6: Skill Selection (catalog with recommendations, enforcement of max 5, limitation flagging with Confluence-specific notes)
- Phase 7: Conversation Starters (3 role-based starters with Confluence vocabulary)
- Phase 8: Governance (owner, collaborators, visibility)
- Phase 9: Automation Integration (optional, explains constraints, common triggers)
- Phase 10: Assembly and Output (validation checks, output format, clipboard blocks)
- Phase 11: File Persistence (forge-lib integration for saving)

**Procedural Logic:** `Strong`
- Phase 1 pattern detection: 5 patterns with keywords, proposes pre-filled configuration
- Phase 2-9: Guided interview with Confluence-specific emphasis on content quality and lifecycle
- Phase 3 Behavior Definition emphasizes confirmation gates: "You generate previews and request user confirmation before publishing. You never publish without explicit approval."
- Phase 6 Skill Selection flags Confluence limitations: "Note: Confluence has no bulk operations. Pages must be created/updated/archived one at a time."
- Phase 10: Silent validation checks with Validation Summary table output

**Human-in-the-Loop Gates:** `Strong`
- Phase 1: User chooses pre-filled pattern or builds from scratch
- Phase 3: User confirmation of behavior text with emphasis on publication gates
- Phase 5: Confirmation questions for knowledge source decisions (spaces, hierarchies, Jira data, external)
- Phase 6: User selection of skills with Confluence-specific limitation warnings
- Phase 7: User adjustment of conversation starters (role-based language emphasized)
- Phase 9: Automation integration explanation (page published, page created, scheduled)

**Output Specifications:** `Strong`
- Phase 10 output format maps to Rovo Studio UI fields
- Markdown format with clearly delineated sections
- Validation Summary table with PASS/FAIL/WARN status
- Warnings section highlights limitations: no bulk ops, no templates, archive confirmation

**Reference File Utilization:** `Strong`
- Uses confluence-specialist skill for pattern detection and domain knowledge
- Uses rovo-foundation skill for TCREI framework and validation rules
- Cross-references patterns, patterns reference skills catalog, skills catalog references validation-rules

**Connector/Tool Integration:** `Strong`
- Phase 5 knowledge sources configured with Confluence spaces, Jira projects (optional), external sources
- Phase 9 automation integration explains Confluence automation triggers
- Phase 11 forge-lib integration for persistence

**Progressive Disclosure & Size:** `Strong`
- 340 lines: 11 phases with clear break points
- Adaptive interview behavior section provides Confluence-specific guidance: "emphasize content quality"

**Cross-Plugin Handoff:** `Strong`
- Phase 11 saves to `rovo-agents/{slug}/agent.md` for Rovo Forge dashboard access
- Hands off validated configuration to user for testing in Rovo Studio

**Writing Quality:** `Strong`
- Clear phase structure with italicized guidance
- Conversational tone with Confluence-specific vocabulary (document, review, summarize, archive, publish)
- Emphasis on content lifecycle and quality throughout
- Pattern detection keywords are practical (create docs, write documentation, API docs, user guide, runbook, etc.)

**Score: 10/10** - Excellent interactive builder with strong emphasis on content quality and publishing gates

---

### 13. sample-configs/ticket-triage-agent.md

**Trigger & Description Quality:** `Strong`
- Title signals: Complete Rovo agent configuration for Jira
- Explicitly states purpose: "serves as both a reference example and a testing baseline"

**Core Objective Clarity:** `Strong`
- Combined Ticket Generation and Ticket Triage agent
- Two scenarios demonstrating pattern specialization

**Procedural Logic:** `Strong`
- Scenario 1 (Ticket Generation): 9-step process with field gathering, duplicate checking, confirmation, creation, follow-up
- Scenario 2 (Ticket Triage): 9-step process with impact/urgency assessment, priority matrix, team routing, label selection, update execution

**Human-in-the-Loop Gates:** `Strong`
- Scenario 1: "Present a summary to the user for confirmation"
- Scenario 2: "Update the issue" implies user approval from Phase 10

**Output Specifications:** `Strong`
- Full Step 1-5 output ready for Rovo Studio clipboard
- Validation Summary table at end showing all constraints met
- Warnings section flags known limitations (custom fields workaround, Scenario 1 slightly under-word, automation scenario missing)

**Reference File Utilization:** `Strong`
- Demonstrates application of foundation concepts (two scenarios, TCREI framework, knowledge sources, skills)
- Demonstrates application of jira-patterns.md templates (Pattern 1 + Pattern 2 combined)

**Connector/Tool Integration:** `Strong`
- Knowledge sources: PLATFORM, APPS, SUPPORT Jira projects + Engineering Handbook Confluence space + "Recently Triaged Tickets" filter
- Skills selection: 5 skills across scenarios (Create, Search, Find Similar, Update Fields, Add Comment)

**Progressive Disclosure & Size:** `Strong`
- 129 lines: appropriate for a working example
- Shows how two patterns can be combined in one agent
- Warnings section is constructive (identifies what could be improved)

**Cross-Plugin Handoff:** `Strong`
- Serves as reference example for users building their own agents
- Could be used as a testing baseline for the `/rovo-jira` command

**Writing Quality:** `Strong`
- Clear, professional configuration
- Behavior instructions are concrete (issue type taxonomy explicit, impact/urgency matrix explicit)
- Scenario instructions are detailed with step numbers and decision logic
- Warnings are constructive: "Scenario 1 is slightly under the 300-word recommended minimum"

**Score: 9/10** - Strong working example. Minor: Scenario 1 instructions are 246 words (per validation summary), slightly below 300-word floor; could expand to reach target range

---

### 14. sample-configs/documentation-specialist.md

**Trigger & Description Quality:** `Strong`
- Title signals: Complete Rovo agent configuration for Confluence
- Explicitly states purpose: "serves as both a reference example and a testing baseline"

**Core Objective Clarity:** `Strong`
- Documentation specialist agent with three lifecycle scenarios
- Demonstrates content creation, review, and maintenance workflows

**Procedural Logic:** `Strong`
- Scenario 1 (Documentation Creation): 9-step process with content type selection, audience targeting, outline approval, section generation, metadata application, cross-linking, review, confirmation, publication
- Scenario 2 (Documentation Review): 7-step process with content retrieval, structure assessment, completeness assessment, audience alignment assessment, metadata assessment, currency assessment, feedback composition
- Scenario 3 (Documentation Maintenance): 8-step process with space enumeration, outdated content identification, duplicate detection, orphan identification, metadata completeness check, report generation, action execution

**Human-in-the-Loop Gates:** `Strong`
- Scenario 1: "Present the complete page to the user for confirmation"
- Scenario 2: "Do not modify the page directly. Post all feedback as comments"
- Scenario 3: "For each recommended action, wait for explicit user approval before executing"

**Output Specifications:** `Strong`
- Full Step 1-5 output ready for Rovo Studio clipboard
- Validation Summary table showing all constraints met
- Warnings section flags known limitations (no bulk ops, no templates, archive confirmation, automation scenario missing)

**Reference File Utilization:** `Strong`
- Demonstrates application of foundation concepts (three scenarios, TCREI framework, knowledge sources, skills, content lifecycle)
- Demonstrates application of confluence-patterns.md templates (Pattern 1 + Pattern 2 + Pattern 5 combined)

**Connector/Tool Integration:** `Strong`
- Knowledge sources: Engineering Documentation space + Engineering Standards space + GitHub (optional) for Creation scenario; same for Review; full space for Maintenance
- Skills selection: 4-9 skills depending on scenario (Create, Get Content, Add Comment, Search, List Space, Archive)

**Progressive Disclosure & Size:** `Strong`
- 159 lines: appropriate for a complex three-scenario agent
- Shows how lifecycle phases map to scenarios
- Warnings section is constructive

**Cross-Plugin Handoff:** `Strong`
- Serves as reference example for users building their own Confluence agents
- Could be used as a testing baseline for the `/rovo-confluence` command

**Writing Quality:** `Strong`
- Clear, professional configuration
- Behavior instructions emphasize publication gates and content quality
- Scenario instructions are detailed with step numbers and decision frameworks
- Review scenario emphasizes constructive feedback approach ("Instead of 'this section is unclear,' say 'this section would benefit from a concrete example'")
- Warnings are constructive: "Scenario 1 is slightly under 300 words; could expand..."

**Score: 10/10** - Excellent working example demonstrating content lifecycle and multiple scenarios

---

## Strengths

1. **Comprehensive Architecture**: Foundation + Domain Specialists + Commands + Examples create a complete ecosystem for building Rovo agents

2. **TCREI Framework Rigor**: instruction-framework.md provides authoritative, teachable specification with concrete examples, anti-patterns, and quality checklist

3. **Domain-Specific Depth**: Jira and Confluence specialists provide issue type taxonomy, skills catalog, and 10 pre-built design patterns across both platforms

4. **Validation Completeness**: validation-rules.md provides authoritative numeric constraints, performance impact guidance, known limitations with workarounds, and automation mode differences

5. **Interactive Builder Design**: Both jira-agent.md and confluence-agent.md commands implement sophisticated guided interview flows (11 phases each) with pattern detection, incremental validation, and copy-ready output

6. **Working Examples**: Two complete, well-documented sample configs (Ticket Triage Agent, Documentation Specialist) serve as both reference and testing baselines

7. **Human-in-the-Loop Gates**: Confirmation requirements, publication gates, and per-page approval for sensitive actions are consistently emphasized

8. **Automation Integration**: Both command files and sample configs address automation mode constraints (no skills, text response only, structured output requirements)

9. **Cross-Reference Strategy**: Files link to each other strategically (commands reference patterns, patterns reference skills, skills reference validation rules)

10. **Writing Quality**: Technical precision without losing accessibility; examples illuminate concepts; checklists and tables organize information effectively

---

## Critical Gaps

### 1. Behavioral Claims Not Fully Validated

**Issue**: The plugin **claims** to guide users through "complete" agent configuration with "validated output," but does not explicitly:
- Demonstrate that Phase 10 validation actually prevents common configuration errors
- Show what happens when validation FAILS (e.g., behavior too long, too many skills)
- Provide examples of incorrect configurations and how the validation catches them
- Specify remediation workflows (if validation fails, what does user do?)

**Impact**: Users might not know how to fix validation failures. Example: "Scenario 1 is slightly under 300 words" (sample-configs warning) tells the user there's a problem but doesn't guide remediation.

**Triage**: **Full evaluation candidate** - This is a functional requirement of the claim "produces validated output"

---

### 2. Permission Model Underspecified

**Issue**:
- knowledge-sources.md states "Agents never grant more permissions than the user has" but provides no examples
- jira-agent.md Phase 1 does not check permission-related questions (e.g., "Does the user have edit access to the projects you're configuring?")
- confluence-agent.md Phase 5 asks about spaces but doesn't warn about permission implications
- No guidance on what happens if user configures knowledge sources they cannot access

**Impact**: Users might build agents that fail silently at runtime if they lack permissions.

**Triage**: **Full evaluation candidate** - Permission model is a safety-critical feature

---

### 3. Deep Research Configuration Guidance Missing

**Issue**:
- validation-rules.md warns about 30 requests/user/day and 15-min timeout
- knowledge-sources.md explains how to enable at scenario level
- **But**: Neither jira-agent.md nor confluence-agent.md asks about Deep Research in Phase 4 (Scenario Design) or Phase 9 (Automation Integration)
- No guidance on when to recommend Deep Research vs. when to avoid it
- Sample configs do not demonstrate Deep Research configuration

**Impact**: Users might not enable Deep Research when beneficial, or might enable it when it will cause automation failures (15-min timeout in automation mode).

**Triage**: **Full evaluation candidate** - Deep Research is a significant capability that should be surfaced during configuration

---

### 4. Automation Mode Workaround Incomplete

**Issue**:
- jira-skills-catalog.md and confluence-skills-catalog.md state "When agents run from automation rules: Cannot use any skills listed above. Can only provide text responses."
- jira-agent.md Phase 9 explains this constraint but does NOT guide creation of a dedicated automation-mode scenario
- confluence-agent.md Phase 9 mentions "structured text output format" but doesn't provide a template
- Sample configs warn "If this agent will also be used from automation rules, add a third scenario" but do not show what that scenario looks like

**Impact**: Users might build automation that invokes an agent expecting structured output, but the agent's behavior and scenarios are optimized for interactive mode.

**Triage**: **Full evaluation candidate** - Users need a working automation scenario template or clearer guidance on what to do

---

### 5. Skill Interaction Effects Undocumented

**Issue**:
- Skill catalogs document individual skills well, but do not explain interaction effects
- Example: If agent has both "Create Jira Work Item" and "Find Similar Issues," does it automatically check for duplicates before creating? The Ticket Generation pattern says it does (in process steps), but the skill catalog doesn't explain this as a pattern
- Confluence maintenance scenario uses "List Space Content" + "Search Confluence" + "Get Page Content" together; catalog doesn't explain these as a coordinated pattern

**Impact**: Users might select skills and assume they work together, but unclear how they should be orchestrated in agent instructions.

**Triage**: **Description optimization candidate** - Skills catalog could add "Common Skill Combinations" section

---

### 6. Error Handling for Command Execution Minimal

**Issue**:
- jira-agent.md Phase 11 shows forge-lib success and failure responses
- But: What if forge-lib returns "slug already exists"? Code example shows "If the agent slug already exists, forge-lib will return an error. In that case: (1) Ask the user if they want to update the existing agent, (2) If yes, use `forge agent update "{slug}" --data '{...}'`"
- This guidance is correct but **not actionable** - it doesn't show the actual forge agent update command or confirm it works the same way as create
- No guidance on testing the created agent in Rovo Studio before considering configuration "complete"

**Impact**: Users might create an agent successfully but not know how to test it or iterate if it doesn't work as expected.

**Triage**: **Direct improvement candidate** - Add Phase 12: Testing and Iteration guidance

---

### 7. Scenario Trigger Matching Behavior Unclear

**Issue**:
- jira-agent.md Phase 4 and confluence-agent.md Phase 4 ask for "trigger keywords" but don't explain how Rovo matches user input to triggers
- Example: Jira Ticket Triage agent has triggers "triage, analyze, route, priority, assign, categorize" but what if user types "please categorize this issue"? Does it need exact word match or substring?
- validation-rules.md warns "if >5 scenarios (diminishes trigger matching accuracy)" but doesn't explain the diminishing mechanism
- Patterns use lowercase keywords (jira-patterns.md: "triage" OR "analyze") but don't clarify case sensitivity or partial matching

**Impact**: Users might configure triggers and be surprised by matching behavior (e.g., expected scenario doesn't activate).

**Triage**: **Description optimization candidate** - Trigger matching behavior needs clarification in command files

---

### 8. Knowledge Source Scoping in Multi-Scenario Agents Unclear

**Issue**:
- jira-agent.md Phase 5 and confluence-agent.md Phase 5 ask "Should different scenarios have access to different knowledge sources?"
- But: The command files don't explain what "different knowledge sources per scenario" means in practice
- Sample configs show all scenarios accessing same knowledge sources (ticket-triage-agent.md shows both scenarios using same Jira projects + Confluence space)
- confluence-specialist.md and patterns show Knowledge Sources listed at scenario level, but command guidance on per-scenario configuration is vague

**Impact**: Users might not understand whether they need multiple knowledge sources or if they should use the same across scenarios.

**Triage**: **Description optimization candidate** - Per-scenario knowledge source configuration needs clarification with examples

---

### 9. Conversation Starters Quality Not Validated

**Issue**:
- validation-rules.md specifies starters must be 5-10 words and exactly 3
- But: There's no guidance on QUALITY of starters (e.g., "do they reflect agent's primary use cases?")
- jira-agent.md Phase 7 proposes starters but doesn't validate them
- confluence-agent.md Phase 7 emphasizes "role-based language" but doesn't provide a rubric for quality
- Sample configs show good starters but don't explain why they're good

**Impact**: Users might accept auto-generated starters that don't accurately reflect agent's capabilities.

**Triage**: **Description optimization candidate** - Add conversation starter quality guidance

---

### 10. Agent Testing Framework Absent

**Issue**:
- Commands output copy-ready configuration but don't provide a testing framework
- No guidance on how to test agent behavior against configuration
- Example: Ticket Triage Agent is configured with priority matrix, but how does user verify the agent applies it correctly?
- Sample configs don't show expected vs. actual behavior
- No guidance on what to do if agent doesn't behave as configured

**Impact**: Users might deploy agents that are misconfigured in ways that don't show up until runtime.

**Triage**: **Full evaluation candidate** - Agent testing framework is critical for quality assurance

---

## Triage Recommendation

### Full Evaluation Candidates (5)

1. **Behavioral Claims Validation** - Verify that Phase 10 validation actually prevents common errors and that remediation workflows are clear
2. **Permission Model** - Specify permission-related configuration questions and runtime permission checking behavior
3. **Deep Research Configuration** - Ensure Deep Research is surfaced during scenario design with clear enable/disable guidance
4. **Automation Mode Workarounds** - Provide working automation scenario templates and clear guidance on text response formatting
5. **Agent Testing Framework** - Define how users should test agent behavior before deploying

### Description Optimization Candidates (4)

1. **Skill Interaction Effects** - Add "Common Skill Combinations" section to both Jira and Confluence skill catalogs explaining how skills work together
2. **Trigger Matching Behavior** - Clarify how Rovo matches user input to scenario triggers (exact word, substring, case-sensitive, etc.)
3. **Per-Scenario Knowledge Sources** - Explain when and how to use different knowledge sources per scenario with examples
4. **Conversation Starter Quality** - Provide rubric for evaluating starter quality (reflection of use cases, action-oriented language, etc.)

### Direct Improvement Candidates (2)

1. **Command Error Handling** - Add Phase 12: Testing and Iteration guidance showing how to test created agent in Rovo Studio
2. **Automation Mode Example** - Provide working automation-mode scenario example showing structured text output format

---

## Overall Assessment

**Plugin Quality:** Strong
**Behavioral Completeness:** 75% (5 full evaluation candidates)
**Documentation Clarity:** 85% (4 optimization candidates + 2 improvement candidates)
**Integration Readiness:** 90% (cross-references work, but permission and testing gaps limit production readiness)

The plugin provides a well-structured, comprehensive system for building Rovo agents with strong pedagogical design (TCREI framework, design patterns, working examples). The critical gaps are functional and safety-related:

- **Validation output** should show remediation pathways for failures
- **Permission model** should be surfaced in configuration and explained in agent behavior
- **Deep Research** should be explicitly offered during scenario design
- **Automation mode** needs working templates, not just constraints
- **Agent testing** needs a defined framework

With these evaluations and improvements, Rovo Forge would be production-ready for guiding users through safe, effective agent configuration.

