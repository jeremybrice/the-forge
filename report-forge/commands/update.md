---
description: "Update an existing report with new findings. Re-runs investigation agents with additional context and updates the report via forge-lib."
arguments:
  - name: filename
    description: "Report filename (with or without .md extension)"
    required: false
---

# Report Forge — Update Command

Updates an existing report with new findings by re-running relevant agents and merging content via forge-lib.

## Usage Examples

```bash
# Update by filename
/report-forge:update 2026-02-14-notification-system-architecture.md

# Update by filename (without extension)
/report-forge:update 2026-02-14-notification-system-architecture

# Interactive selection (no filename provided)
/report-forge:update
```

## Implementation

### Step 1: Locate Report

**If filename provided:**
1. Run forge report query to find the report:
   ```bash
   forge report query --directory .
   ```
2. Parse results and match on filename (with or without `.md`)
3. If not found: "Report not found: {filename}. List reports with /report-forge:list"

**If no filename provided:**
1. Run `forge report query --directory .` to get all reports
2. Display interactive selection menu:
   ```
   Select a report to update:

   1. [2026-02-14] Notification System Architecture (arch-review, Published)
   2. [2026-02-12] Mobile App Performance (perf-analysis, Draft)
   3. [2026-02-08] Q1 2026 Progress Review (quarterly-review, Published)
   ...

   Enter number or 'q' to quit:
   ```
3. Wait for user selection

### Step 2: Read Existing Report

Use forge report get to retrieve the report:
```bash
forge report get {filename}
```

Parse the JSON response to extract:
- title, report_type, category, topic
- related_entities, coverage_period
- status, confidence, investigators
- created, updated dates
- current content

Display current report summary:
```
## Current Report

**Title**: {title}
**Type**: {report_type}
**Category**: {category}
**Status**: {status}
**Created**: {created} | **Updated**: {updated}
**Confidence**: {confidence}
**Coverage**: {coverage_start} to {coverage_end}
**Related Entities**:
  - Products: {products}
  - Modules: {modules}
  - Clients: {clients}
  - Teams: {teams}

**File**: {file_path}
```

### Step 3: Determine Update Scope

Ask the user what type of update they want:

```
What would you like to update?

1. Add new findings (re-run investigation with new context)
2. Update metadata only (change status, confidence, dates, etc.)
3. Cancel

Enter number:
```

### Update Type 1: Add New Findings (Re-run Investigation)

**Step 3a: Gather Update Context**

Ask the user:
```
What new context or scope should the investigation cover?

Examples:
- "Recent performance improvements to the notification system"
- "New findings from production metrics in February"
- "Integration with the new queue system"

Enter update context:
```

Capture the update context from user input.

**Step 3b: Extend Coverage Period (Optional)**

If the report has a coverage period, ask:
```
Current coverage: {coverage_start} to {coverage_end}

Do you want to extend the coverage period? (yes/no)
```

If yes, prompt for new end date:
```
Enter new coverage end date (YYYY-MM-DD):
```

**Step 3c: Re-run Agents**

Use the same multi-agent pipeline as /report-forge:generate, but provide additional context:

For Investigator:
```
You are conducting updated research for a {report_type} report on "{topic}".

**Original Report Created**: {created}
**Update Context**: {user-provided update context}

**Report Brief:**
- Category: {category}
- Coverage Period: {coverage_start} to {coverage_end}
- Related Entities: {same as original}

**Your Assignment:**
Focus on the update context described above. Gather new data, examine recent changes, and collect updated metrics. Your findings will be merged with the existing report.

Produce a structured investigation report with new findings.
```

Then run Analyst and Synthesizer as in generate command.

**Step 3d: Merge Content**

Present the user with a choice:
```
## Update Strategy

The agents have completed their investigation. How should the new findings be integrated?

1. Append new findings to existing report (adds a "Recent Updates" section)
2. Full rewrite (replace entire report content with new synthesis)

Enter number:
```

**If append (option 1):**
Concatenate existing content + new section:
```markdown
{existing report content}

---

## Recent Updates ({current_date})

{new synthesized findings}

**Update Context**: {user-provided context}
**Additional Investigation By**: {agent names}
```

**If full rewrite (option 2):**
Use the new synthesized report content directly.

**Step 3e: Update via forge-lib**

```bash
forge report update {filename} \
  --status {status} \
  --agents {agent names} \
  --data '{"coverage_end": "{new end date}"}' \
  --directory .
```

### Update Type 2: Update Metadata Only

Prompt for each updatable field:

```
Update metadata (press Enter to keep current value):

Status [{current_status}]: ___
Confidence [{current_confidence}]: ___
Coverage End [{current_coverage_end}]: ___
```

Then update via forge-lib:
```bash
forge report update {filename} \
  [--status {new_status}] \
  [--data '{"coverage_end": "{new_coverage_end}"}'] \
  --directory .
```

## Phase 4: Present Results

Display the update summary:

```
✓ Report Updated

**File**: {file_path}
**Title**: {title}
**Status**: {new_status}
**Updated**: {new_updated_date}

The report has been updated successfully.

Commands:
- View the file: {file_path}
- List all reports: /report-forge:list
```

### Error Handling

**If report not found:**
```
Error: Report not found: {filename}

List all reports with /report-forge:list
```

**If update fails:**
```
Error updating report: {error message from forge-lib}
```

**If agent spawning fails:**
```
Error: Unable to spawn investigation agents. Check agent availability.
```
