---
description: "List and filter existing reports. Browse reports by type, category, status, or date range using forge-lib queries."
arguments:
  - name: "--type"
    description: "Filter by report type (executive-summary, technical-deep-dive, etc.)"
    required: false
  - name: "--category"
    description: "Filter by category (architecture, performance, security, etc.)"
    required: false
  - name: "--status"
    description: "Filter by status (Draft, In Review, Published, Archived)"
    required: false
  - name: "--since"
    description: "Filter by creation date (reports created on or after this date, YYYY-MM-DD)"
    required: false
  - name: "--product"
    description: "Filter by related product name"
    required: false
  - name: "--module"
    description: "Filter by related module name"
    required: false
  - name: "--client"
    description: "Filter by related client name"
    required: false
---

# Report Forge — List Command

Lists all reports with optional filtering using the forge-lib CLI.

## Usage Examples

```bash
# List all reports
/report-forge:list

# Filter by report type
/report-forge:list --type architecture-review

# Filter by category
/report-forge:list --category performance

# Filter by status
/report-forge:list --status Published

# Filter by date (reports created on or after this date)
/report-forge:list --since 2026-01-01

# Filter by related entity
/report-forge:list --product webapp
/report-forge:list --module notification-engine
/report-forge:list --client enterprise-client-a

# Combine filters
/report-forge:list --type technical-deep-dive --category architecture --status Published
```

## Implementation

### Step 1: Build Query

Construct the forge report query command from provided arguments:

```bash
forge report query \
  [--report-type {type}] \
  [--status {status}] \
  [--created-after {since}] \
  [--created-before {until}] \
  [--product {product}] \
  --directory .
```

**IMPORTANT**: Only include flags for arguments that were actually provided by the user. Omit flags with no values.

### Step 2: Execute Query

Run the forge report query command using Bash and capture the JSON output.

Example:
```bash
forge report query --report-type architecture-review --status Published --directory .
```

### Step 3: Parse Results

Parse the JSON response. Expected structure:
```json
{
  "success": true,
  "data": [
    {
      "file": "reports/2026-02-14-notification-system-arch.md",
      "title": "Notification System Architecture",
      "report_type": "architecture-review",
      "category": "architecture",
      "status": "Published",
      "topic": "Notification System Architecture",
      "created": "2026-02-14",
      "updated": "2026-02-14",
      "confidence": "High",
      "related_entities": {
        "products": ["webapp"],
        "modules": ["notification-engine"]
      },
      "coverage_period": {
        "start": "2026-01-01",
        "end": "2026-02-14"
      }
    },
    ...
  ]
}
```

### Step 4: Display Results

**If no reports found:**
```
No reports found matching your criteria.

Create your first report with /report-forge:generate
```

**If reports found**, display a formatted table:

```
## Reports ({count} found)

| Date       | Title                                  | Type              | Category     | Status    |
|------------|----------------------------------------|-------------------|--------------|-----------|
| 2026-02-14 | Notification System Architecture       | arch-review       | architecture | Published |
| 2026-02-12 | Mobile App Performance Analysis        | perf-analysis     | performance  | Draft     |
| 2026-02-08 | Q1 2026 Product Progress               | quarterly-review  | business     | Published |
...

**Filter Applied:**
{list any filters that were applied}

**Commands:**
- View details: /report-forge:update {filename}
- Filter further: /report-forge:list [additional filters]
```

**For enhanced readability**, include related entities and coverage period in the output if space permits:

```
1. **Notification System Architecture** (2026-02-14)
   - Type: architecture-review | Category: architecture | Status: Published
   - Coverage: 2026-01-01 to 2026-02-14
   - Related: Products: webapp | Modules: notification-engine
   - File: reports/2026-02-14-notification-system-arch.md

2. **Mobile App Performance Analysis** (2026-02-12)
   - Type: performance-analysis | Category: performance | Status: Draft
   - Coverage: 2026-02-01 to 2026-02-12
   - Related: Products: mobile-app
   - File: reports/2026-02-12-mobile-app-performance.md

...
```

Choose the format that best fits the number of results and user context.

### Error Handling

**If forge command not found:**
```
Error: forge-lib CLI not found. Ensure forge-lib is installed and in your PATH.
```

**If query fails:**
```
Error executing report query: {error message from JSON response}
```

**If JSON parsing fails:**
```
Error: Unable to parse report query results. Check forge-lib installation.
```
