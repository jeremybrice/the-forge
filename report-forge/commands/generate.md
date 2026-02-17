---
name: generate
description: "Generate a new report through agent-based investigation. Spawns investigator, analyst, and synthesizer agents sequentially to research a topic and produce a structured markdown report."
arguments:
  - name: topic
    description: "The subject to investigate and report on"
    required: true
  - name: "--type"
    description: "Report type (executive-summary, technical-deep-dive, competitive-analysis, architecture-review, performance-analysis, incident-postmortem, quarterly-review, feasibility-study)"
    required: false
  - name: "--category"
    description: "Primary category (architecture, performance, security, integration, feature-analysis, operations, technical-debt, competitive, user-research, business-metrics)"
    required: false
  - name: "--coverage-start"
    description: "Coverage period start date (YYYY-MM-DD format, optional)"
    required: false
  - name: "--coverage-end"
    description: "Coverage period end date (YYYY-MM-DD format, optional)"
    required: false
  - name: "--products"
    description: "Comma-separated list of product names"
    required: false
  - name: "--modules"
    description: "Comma-separated list of module names"
    required: false
  - name: "--clients"
    description: "Comma-separated list of client names"
    required: false
  - name: "--teams"
    description: "Comma-separated list of team names"
    required: false
  - name: "--cards"
    description: "Comma-separated list of Product Forge card filenames (without .md)"
    required: false
---

# Report Forge — Generate Command

You are the **Moderator** for Report Forge generation. You orchestrate a multi-agent investigation pipeline that researches a topic and produces a structured report using the forge-lib CLI.

## Valid Report Types

```
executive-summary       High-level overview for leadership
technical-deep-dive     Detailed technical analysis
competitive-analysis    Market/competitor research
architecture-review     System design evaluation
performance-analysis    Performance metrics and optimization
incident-postmortem     Post-incident analysis
quarterly-review        Periodic progress assessment
feasibility-study       New initiative evaluation
```

## Valid Categories

```
architecture            System design, patterns, technical decisions
performance             Speed, scalability, resource usage
security                Vulnerabilities, compliance, best practices
integration             Third-party systems, APIs, data flows
feature-analysis        Feature evaluation, user impact
operations              DevOps, deployment, monitoring
technical-debt          Code quality, refactoring needs
competitive             Market analysis, competitor features
user-research           User behavior, feedback analysis
business-metrics        KPIs, ROI, business impact
```

## Phase 1: Intake and Validation

Before spawning agents, establish parameters:

1. **Extract topic** from the required `topic` argument
2. **Prompt for report_type** if not provided via `--type` flag
   - Display the 8 valid report types with descriptions
   - Wait for user selection
3. **Prompt for category** if not provided via `--category` flag
   - Display the 10 valid categories with descriptions
   - Wait for user selection
4. **Collect optional metadata** from flags:
   - coverage_period: `--coverage-start` and `--coverage-end`
   - related_entities: `--products`, `--modules`, `--clients`, `--teams`, `--cards`

5. **Confirm scope** with user:
   ```
   ## Report Brief

   **Topic**: {topic}
   **Type**: {report_type}
   **Category**: {category}
   **Coverage**: {start} to {end} (if provided)
   **Related Entities**:
     - Products: {products}
     - Modules: {modules}
     - Clients: {clients}
     - Teams: {teams}
     - Cards: {cards}

   Proceed with investigation? (yes/no)
   ```

## Phase 2: Multi-Agent Investigation

Launch agents sequentially using the Task tool. Each agent receives the report brief and builds on prior agent outputs.

### Agent Selection by Report Type

**Executive Summary** (efficiency-focused):
1. Investigator (data gathering)
2. Synthesizer (skip analyst, go straight to synthesis)

**All Other Reports** (full pipeline):
1. Investigator (data gathering)
2. Analyst (interpretation and analysis)
3. Synthesizer (integration and conclusions)

### Step 1: Launch Investigator

```
Use the Task tool to spawn the forge-investigator agent.

Prompt:
You are conducting research for a {report_type} report on "{topic}".

**Report Brief:**
- Category: {category}
- Coverage Period: {coverage_start} to {coverage_end}
- Related Entities:
  - Products: {products}
  - Modules: {modules}
  - Clients: {clients}
  - Teams: {teams}
  - Product Forge Cards: {cards}

**Your Assignment:**
Gather data, examine the codebase, collect metrics, and assemble raw findings. Focus your investigation on the related entities listed above. Produce a structured investigation report with:
- Scope summary
- Data sources examined
- Raw findings (organized by category)
- Key metrics and statistics

**Output Format:**
Return your complete investigation findings as a markdown document.
```

Wait for the Investigator to complete. Capture the investigation findings.

### Step 2: Launch Analyst (skip for executive-summary)

If report_type is NOT executive-summary:

```
Use the Task tool to spawn the forge-analyst agent.

Prompt:
You are analyzing investigative findings for a {report_type} report on "{topic}".

**Report Brief:**
- Category: {category}
- Coverage Period: {coverage_start} to {coverage_end}

**Investigation Findings:**
{paste investigator's complete output here}

**Your Assignment:**
Interpret the raw findings, identify patterns, assess implications, and draw insights. Produce a structured analysis with:
- Pattern identification (what trends or themes emerge)
- Risk assessment (what concerns or vulnerabilities exist)
- Opportunity identification (what possibilities or strengths exist)
- Gap analysis (what's missing or incomplete)

**Output Format:**
Return your complete analysis as a markdown document.
```

Wait for the Analyst to complete. Capture the analysis output.

### Step 3: Launch Synthesizer

For executive-summary (no analyst):
```
Use the Task tool to spawn the forge-synthesizer agent.

Prompt:
You are synthesizing a {report_type} report on "{topic}".

**Report Brief:**
- Category: {category}
- Coverage Period: {coverage_start} to {coverage_end}

**Investigation Findings:**
{paste investigator's complete output here}

**Your Assignment:**
Integrate the findings into a cohesive executive summary. Produce:
- Executive Summary (one paragraph overview)
- Key Findings (3-5 bullet points)
- Recommendations (actionable next steps)
- Next Steps (timeline and ownership)

**Tone**: Business-focused, clear, concise, minimal technical jargon.

**Output Format:**
Return the complete report content as a markdown document (NO frontmatter, just the report body).
```

For all other reports (with analyst):
```
Use the Task tool to spawn the forge-synthesizer agent.

Prompt:
You are synthesizing a {report_type} report on "{topic}".

**Report Brief:**
- Category: {category}
- Coverage Period: {coverage_start} to {coverage_end}

**Investigation Findings:**
{paste investigator's complete output here}

**Analysis:**
{paste analyst's complete output here}

**Your Assignment:**
Integrate the findings and analysis into a cohesive {report_type} report following the appropriate structure for this report type (see report-methodology skill). Produce a complete markdown document with all standard sections.

**Output Format:**
Return the complete report content as a markdown document (NO frontmatter, just the report body).
```

Wait for the Synthesizer to complete. Capture the synthesized report content.

## Phase 3: Report Creation via forge-lib

Now create the report using the forge-lib CLI:

```bash
forge report create {report_type} "{title}" "{topic}" \
  --directory . \
  --status Draft \
  --product {product} \
  --module {module} \
  --agents {comma-separated agent names used} \
  --data '{"category": "{category}", "coverage_start": "{coverage_start}", "coverage_end": "{coverage_end}"}'
```

Example:
```bash
forge report create architecture-review \
  "Notification System Architecture" \
  "Notification System Architecture" \
  --status Draft \
  --product webapp \
  --module notification-engine \
  --agents investigator,analyst,synthesizer \
  --data '{"coverage_start": "2026-01-01", "coverage_end": "2026-02-14"}'
```

### Parse forge-lib Response

The `forge report create` command returns a JSON response:

```json
{
  "success": true,
  "data": {
    "filename": "YYYY-MM-DD-slug.md",
    "filepath": "reports/{type}s/YYYY-MM-DD-slug.md",
    "report_type": "{type}",
    "title": "Report Title",
    "created": "YYYY-MM-DD"
  }
}
```

Extract the `filepath` and `filename` from `data` for use in Phase 4.

### Error Handling

If `forge report create` fails, the response will be:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report to user:
```
Error saving report: {error message}

The synthesized report content is still available. You can retry with:
forge report create {type} "{title}" "{topic}" --directory . --status Draft --data '{...}'
```

Do NOT proceed to Phase 4 on failure. Instead, display the error and offer the retry command with the original arguments so the user can attempt again.

## Phase 4: Present Results

Display the report creation summary:

```
✓ Report Generated

**File**: {file_path from JSON response}
**Title**: {title}
**Type**: {report_type}
**Status**: Draft
**Investigators**: {agent names}

The report has been created. You can:
- Update it: /report-forge:update {filename}
- List all reports: /report-forge:list
- View the file directly: {file_path}
```

**Do not display the full report content** (it's already saved to file).
