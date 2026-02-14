---
description: Generate product release notes from feature descriptions, Jira stories, or product documents. Produces .docx files and delegates tracking entry creation to forge-lib.
---

# Release Notes Command

## Overview
The `/release-notes` command generates professional product release notes from feature descriptions, Jira stories, or product documents. It produces both Internal and External versions in Word format (.docx) and creates a tracking entry via `forge card create release-note`.

This command handles the conversational workflow, categorization, content drafting, and document generation, while delegating local file persistence to forge-lib.

---

## Conversational Workflow

### Phase 1: Input Acceptance

Accept any of the following input types:

**Jira Story Content:**
- Story key and title, acceptance criteria or description
- Multiple stories separated by line breaks

**Feature Descriptions:**
- Narrative descriptions of new capabilities, enhancement summaries, bug fix descriptions

**Batch Input:**
- Reference previously generated cards
- Combine stories from different epics
- Mix feature types in single input

**Processing:**
- Accept feature descriptions in any format (plain text, copied from Jira, product docs)
- Strip Jira metadata (ticket numbers, assignees) during processing
- If input is ambiguous, prompt user for category clarification

---

### Phase 2: Categorization

For each input item, determine its category using this decision tree:

**Decision Tree:**
1. Did this capability exist before?
   - No → **What's New**
   - Yes → Continue
2. Was something broken that we fixed?
   - Yes → **Bug Fixes**
   - No → **Improvements**

**Category Definitions:**

**What's New:** Brand new capabilities, modules, or features that didn't exist before
- Indicators: "New [system/module]", "Introduced...", "Added support for...", "Now available..."

**Improvements:** Enhancements to existing functionality (performance, streamlined workflows, refined UX)
- Indicators: "Enhanced...", "Improved...", "Updated...", "Streamlined...", performance optimizations

**Bug Fixes:** Corrections to broken or misbehaving functionality
- Indicators: "Fixed...", "Resolved...", "Corrected...", "Issue where..."
- Pattern: "Fixed an issue where [problem]. [Resolution]."

---

### Phase 3: Content Drafting

**Writing Style:**
- **Present tense** for completed work focusing on outcomes
- **User-focused**: Emphasize value and outcomes, not technical implementation
- **Concise**: Bug fixes ~1 paragraph (2-3 sentences), Features 2-3 paragraphs max, Improvements 1-2 paragraphs
- **Accessible**: Write for operators and business users, not developers
- **Standalone**: Each entry complete without referencing other items or tickets
- **Specific**: Include measurable impact when available

**Avoid:**
- Jira ticket numbers (PROJ-1234)
- Internal references ("QA validated", "per ticket XYZ")
- Developer jargon ("microservice architecture", "schema migration")
- Database terminology ("table optimization", "index reorganization")
- Future tense ("will add", "will fix")
- Excessive passive voice ("was improved" vs "we improved")
- Negative framing ("no longer fails" vs "now works reliably")

**Internal vs External Filtering:**
- **Include in BOTH**: Features operators interact with, UI/UX improvements, bug fixes affecting daily operations, performance improvements users notice
- **Internal Only**: API/integration enhancements, backend refactoring, developer tooling, database schema changes, architecture improvements, infrastructure updates

**Decision Test:** Would a non-technical operator care about or notice this change?
- Yes → Include in both versions
- No → Internal only

---

### Phase 4: Document Generation

**File Naming Convention:**
```
Release_Notes_-_{Product}_{Version}_YYMMDD_-_[Internal|External].docx
```

**Version Format:** `{product}-YYMMDD`

**Word Document Structure:**
```
{Product} Release Notes - [Internal|External]

Version: {product}-YYMMDD
Release Date: [Month Day, Year]

What's New

[Entry 1 Title]. [Entry 1 description - 2-3 sentences]
[Entry 2 Title]. [Entry 2 description - 2-3 sentences]

Improvements

[Entry 1 Title]. [Entry 1 description - 1-2 sentences]
[Entry 2 Title]. [Entry 2 description - 1-2 sentences]

Bug Fixes

[Entry 1 Title]. [Entry 1 description - 1-2 sentences]
[Entry 2 Title]. [Entry 2 description - 1-2 sentences]

Helpful Links

Internal Version: [Link to relevant documentation or "See release-notes tracking entry"]
External Version: [None available]

How to Update

[Standard update instructions - typically provided by deployment team]
```

**Word Styles:**
- **Heading 3**: Document title
- **Heading 4**: Section headers (What's New, Improvements, Bug Fixes, Helpful Links, How to Update)
- **List Bullet**: Entry titles (bold) and descriptions
- **Normal**: Version and Release Date lines

**Generation Steps:**
1. Categorize each input item into What's New, Improvements, or Bug Fixes
2. Filter for Internal version (include all) and External version (exclude technical items)
3. Write each entry following the style guide
4. Format entries with consistent structure
5. Create .docx files using docx skill with Word style formatting
6. Generate two documents: one Internal, one External

---

### Phase 5: Tracking Entry Creation

After generating both .docx files, create a tracking entry via forge-lib:

```bash
forge card create release-note "{Product} Release YYMMDD" --data '{
  "release_date": "YYYY-MM-DD",
  "product": "",
  "status": "Draft",
  "version": "{product}-YYMMDD",
  "related_stories": ["story-filename-1", "story-filename-2"],
  "source_conversation": "[Conversation title or context]"
}'
```

**Entry Condensation:**
When writing the card body (passed to forge-lib), condense entries to essential information:
- What's New: List features with brief descriptions (1-2 sentences each)
- Improvements: List improvements with impact (1 sentence each)
- Bug Fixes: List fixes with resolution (1 sentence each)

**After Save:**
Display:
```
Release notes generated:
- Internal: [.docx file path]
- External: [.docx file path]
- Tracking entry: cards/release-notes/{filename}.md
```

---

## Orchestration Pipeline

Uses a two-agent pipeline for clean separation of concerns.

**Agent 1: Draft Agent**
- Categorizes each input item
- Writes user-facing descriptions following the style guide
- Produces BOTH Internal and External versions
- Returns complete drafted content for all categories and both versions

**Agent 2: Publish Agent**
- Generates both Internal and External .docx files using the docx skill
- Creates tracking entry via forge-lib
- Returns .docx file paths and tracking entry filename

**Pipeline Flow:**
```
User provides input → Draft Agent (categorize + write) → Publish Agent (format .docx + forge-lib) → Output
```

---

## Key Behaviors

**Verification Checklist:**
- All entries in correct category (What's New, Improvements, Bug Fixes)
- No Jira ticket numbers present
- No internal references or developer jargon
- Present tense used throughout
- Bug fixes follow "Fixed an issue where..." pattern
- Each entry standalone and complete
- Version format correct ({product}-YYMMDD)
- External version excludes API/integration/backend changes

**Error Handling:**
- If Draft Agent fails, report error and offer to retry categorization
- If Publish Agent fails on .docx generation, present drafted content and offer manual formatting
- If forge-lib file write fails, still deliver .docx files and retry separately

---

## forge-lib Delegation

This command delegates local file operations to forge-lib. YAML frontmatter structure, file path resolution, sequential numbering, and markdown file writing are handled by `forge card create release-note`.

The command focuses on conversational workflow, categorization logic, content drafting, and document generation.
