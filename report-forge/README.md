# Report Forge v2

Multi-agent report generation system that orchestrates specialized agents to research topics and produce structured markdown reports.

## Overview

Report Forge automates comprehensive report generation through a sequential agent pipeline:

1. **Investigator** gathers raw data and metrics from the codebase
2. **Analyst** interprets findings and identifies patterns (for most report types)
3. **Synthesizer** assembles a cohesive narrative report
4. **forge-lib** handles all file operations and report persistence

This architecture separates concerns: agents focus on reasoning and research, while forge-lib manages data storage, validation, and formatting.

## Report Types

Report Forge supports 8 report types, each optimized for a specific audience and purpose:

| Report Type | Audience | Agent Pipeline | Use Case |
|-------------|----------|----------------|----------|
| **executive-summary** | Leadership, executives | Investigator → Synthesizer | High-level overview for decision-makers |
| **technical-deep-dive** | Engineers, architects | Investigator → Analyst → Synthesizer | Detailed technical analysis |
| **competitive-analysis** | Product managers, strategy | Investigator → Analyst → Synthesizer | Market and competitor research |
| **architecture-review** | Architects, tech leads | Investigator → Analyst → Synthesizer | System design evaluation |
| **performance-analysis** | Engineers, SREs | Investigator → Analyst → Synthesizer | Performance metrics and optimization |
| **incident-postmortem** | Engineering teams, SREs | Investigator → Analyst → Synthesizer | Post-incident analysis and learning |
| **quarterly-review** | Teams, leadership | Investigator → Synthesizer | Periodic progress assessment |
| **feasibility-study** | Product, engineering leads | Investigator → Analyst → Synthesizer | New initiative evaluation |

## Commands

### `/report-forge:generate`

Generate a new report through multi-agent investigation.

**Usage:**
```bash
/report-forge:generate <topic> [options]

Options:
  --type <type>              Report type (executive-summary, technical-deep-dive, etc.)
  --category <category>      Primary category (architecture, performance, security, etc.)
  --coverage-start <date>    Coverage period start (YYYY-MM-DD)
  --coverage-end <date>      Coverage period end (YYYY-MM-DD)
  --products <list>          Comma-separated product names
  --modules <list>           Comma-separated module names
  --clients <list>           Comma-separated client names
  --teams <list>             Comma-separated team names
  --cards <list>             Comma-separated Product Forge card filenames
```

**Examples:**
```bash
# Interactive (prompts for type and category)
/report-forge:generate "Notification System Architecture"

# With explicit parameters
/report-forge:generate "Q1 2026 Performance Review" \
  --type quarterly-review \
  --category performance \
  --coverage-start 2026-01-01 \
  --coverage-end 2026-03-31

# With related entities
/report-forge:generate "Mobile App Architecture" \
  --type architecture-review \
  --category architecture \
  --products mobile-app \
  --modules auth,api-client
```

**Workflow:**
1. Validates parameters (prompts for missing type/category)
2. Spawns agents sequentially (investigator → analyst → synthesizer or investigator → synthesizer)
3. Each agent receives prior agent outputs
4. Creates report via `forge report create` CLI
5. Returns file path and metadata

### `/report-forge:list`

List and filter existing reports.

**Usage:**
```bash
/report-forge:list [options]

Options:
  --type <type>         Filter by report type
  --category <category> Filter by category
  --status <status>     Filter by status (Draft, In Review, Published, Archived)
  --since <date>        Filter by creation date (YYYY-MM-DD)
  --product <name>      Filter by related product
  --module <name>       Filter by related module
  --client <name>       Filter by related client
```

**Examples:**
```bash
# List all reports
/report-forge:list

# Filter by type
/report-forge:list --type architecture-review

# Combine filters
/report-forge:list --type technical-deep-dive --status Published --since 2026-01-01
```

**Workflow:**
1. Builds `forge report query` command with provided filters
2. Executes query and parses JSON results
3. Displays formatted table or detailed list

### `/report-forge:update`

Update an existing report with new findings.

**Usage:**
```bash
/report-forge:update [filename]
```

**Examples:**
```bash
# Update by filename
/report-forge:update 2026-02-14-notification-system-arch.md

# Interactive selection (no filename)
/report-forge:update
```

**Workflow:**
1. Locates report (interactive selection if no filename provided)
2. Displays current report summary
3. Prompts for update type:
   - **Add new findings**: Re-runs agent pipeline with update context
   - **Update metadata only**: Changes status, confidence, dates, etc.
4. Updates report via `forge report update` CLI

## Agents

### forge-investigator

**Role:** Primary research and data gathering

**Tools:** Read, Grep, Glob, Bash

**Responsibilities:**
- Scan codebase systematically within defined scope
- Collect metrics (file counts, LOC, dependencies, git stats)
- Review documentation and configuration files
- Assemble raw findings without interpretation

**Output:** Structured investigation report with:
- Scope summary
- Data sources examined
- Key observations (organized by category)
- Metrics collected
- Gaps identified

### forge-analyst

**Role:** Interpretation and pattern recognition

**Tools:** Read, Grep, Glob

**Responsibilities:**
- Interpret raw findings from Investigator
- Identify patterns, trends, and anomalies
- Assess risks and opportunities
- Provide context and implications

**Output:** Structured analysis with:
- Pattern identification
- Risk assessment
- Opportunity identification
- Gap analysis

**Note:** Skipped for executive-summary and quarterly-review report types for efficiency.

### forge-synthesizer

**Role:** Report assembly and narrative construction

**Tools:** Read, Write

**Responsibilities:**
- Integrate findings and analysis (if available)
- Construct cohesive narrative following report type structure
- Apply appropriate tone and content depth for audience
- Produce final markdown report content

**Output:** Complete report content (markdown body, no frontmatter)

## Skills

### report-methodology

**Purpose:** Defines reasoning standards for report generation

**Content:**
- 8 report type definitions (purpose, audience, length, tone, key themes)
- 10 category taxonomy definitions
- Agent recruitment logic (which agents for which report types)
- Confidence level guidance
- Tone and style standards by report type
- Content depth guidance by audience

**Note:** This is a reasoning-only skill. All formatting, templates, and file operations are handled by forge-lib.

## Integration with forge-lib

Report Forge delegates all file operations to the forge-lib CLI:

### Initialization
```bash
forge report init
```
Creates `reports/` directory structure at project root.

### Creation
```bash
forge report create {report_type} "{title}" "{topic}" \
  [--directory DIR] \
  [--status {status}] \
  [--product {product}] \
  [--module {module}] \
  [--authors {authors}] \
  [--agents {agents}] \
  [--data '{...}']
```

Creates a report file with:
- Date-based filename: `YYYY-MM-DD-slug.md`
- YAML frontmatter (validated against schema)
- Markdown body content
- Index entry in `reports/index.json`

### Querying
```bash
forge report query \
  [--report-type <type>] \
  [--status <status>] \
  [--product <product>] \
  [--created-after <date>] \
  [--created-before <date>]
```

Returns filtered list of reports with metadata.

### Updates
```bash
forge report update <filename> \
  [--status <status>] \
  [--product <product>] \
  [--module <module>] \
  [--authors <authors>] \
  [--agents <agents>] \
  [--data '{...}']
```

Updates existing report and refreshes index.

## Directory Structure

```
report-forge/
├── commands/
│   ├── generate.md          (254 lines) - Multi-agent orchestration
│   ├── list.md              (150 lines) - Query and display
│   └── update.md            (190 lines) - Re-investigation workflow
├── agents/
│   ├── forge-investigator.md (276 lines) - Data gathering agent
│   ├── forge-analyst.md      (301 lines) - Analysis agent
│   └── forge-synthesizer.md  (295 lines) - Assembly agent
├── skills/
│   └── report-methodology/
│       └── SKILL.md          (172 lines) - Reasoning-only methodology
├── plugin.json               (60 lines)
└── README.md                 (this file)
```

**Total Line Count:**
- Commands: 594 lines (down from 1207 in v1, 51% reduction)
- Agents: 872 lines (unchanged, already pure reasoning)
- Skills: 172 lines (down from 618 in v1, 72% reduction via report-routing elimination)
- Plugin metadata: 60 lines
- **Total: 1698 lines** (down from 2699 in v1, 37% reduction)

## Key Changes from v1

### Architecture Improvements
1. **File operations eliminated**: All read/write/scan operations delegated to forge-lib
2. **Skill simplification**: report-routing skill eliminated entirely (logic moved to forge-lib)
3. **Template handling**: Templates now managed by forge-lib Jinja2 engine, not in skill instructions
4. **Command focus**: Commands now orchestrate agents and delegate to CLI, not manage files

### Preserved Functionality
1. **Agent reasoning**: Investigator, Analyst, Synthesizer agents unchanged (pure reasoning)
2. **Multi-agent pipeline**: Sequential agent spawning workflow preserved
3. **Report types**: All 8 report types supported with same purposes and audiences
4. **Metadata**: Same frontmatter structure (title, type, category, related_entities, etc.)

### Benefits
1. **Maintainability**: Schema changes only require updating forge-lib, not prompt instructions
2. **Performance**: Index-based queries faster than directory scans
3. **Reliability**: Python validation prevents malformed YAML/markdown
4. **Consistency**: Template rendering ensures uniform formatting

## Usage Patterns

### Basic Report Generation
```bash
# 1. Initialize reports directory (first time only)
forge report init

# 2. Generate report through command
/report-forge:generate "Notification System Performance" \
  --type performance-analysis \
  --category performance

# Command will:
# - Spawn investigator agent (gathers metrics, scans code)
# - Spawn analyst agent (interprets findings, identifies bottlenecks)
# - Spawn synthesizer agent (assembles report)
# - Create report file via forge-lib
```

### Updating Reports
```bash
# Re-investigate with new context
/report-forge:update 2026-02-14-notification-perf.md

# Command will:
# - Display current report summary
# - Prompt for update type
# - Re-run agent pipeline if adding findings
# - Update via forge-lib
```

### Browsing Reports
```bash
# List all published architecture reviews
/report-forge:list --type architecture-review --status Published

# Find reports about specific product
/report-forge:list --product webapp --module notification-engine
```

## Dependencies

- **forge-lib**: Python CLI for all file operations
- **Claude Agent SDK**: For Task tool (agent spawning)
- **Skills**: report-methodology (reasoning guidance)

## Version

**v2.0.0** - Complete rebuild with forge-lib integration
