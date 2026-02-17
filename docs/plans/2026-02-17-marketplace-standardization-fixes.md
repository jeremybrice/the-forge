# Marketplace Standardization Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate all FAIL and PARTIAL findings from the marketplace standardization audit (13 FAILs, 15 PARTIALs across 6 plugins × 12 rules), bringing all plugins to full forge-lib compliance.

**Architecture:** Fixes are organized into 5 phases by effort level — from simple markdown edits through to building entirely new forge-lib subcommands. Phase 1 (quick fixes) can be completed independently. Phases 2-3 require Phase 1 to be done first. Phases 4-5 are the largest efforts (new Python code with TDD) and can run in parallel with each other.

**Tech Stack:** Python (forge-lib CLI), JSON Schema, Jinja2 templates, Claude Code plugin markdown commands/skills, forge-shell JavaScript view controllers.

---

## Phase 1: Quick Fixes (Markdown-Only Edits)

These tasks modify only plugin command/skill/README markdown files. No Python code changes. No tests needed.

---

### Task 1: Remove Write tool from forge-synthesizer agent

**Files:**
- Modify: `report-forge/agents/forge-synthesizer.md:4-6`

**Audit Finding:** C3 — The forge-synthesizer agent declares `Write` in its tools list and writes report files directly to `reports/{report_type}s/`. This bypasses forge-lib.

**Step 1: Edit the tools list**

In `report-forge/agents/forge-synthesizer.md`, change the tools frontmatter from:
```yaml
tools:
  - Read
  - Write
```
to:
```yaml
tools:
  - Read
```

**Step 2: Remove direct-write instructions from the agent**

In the same file, find the "After User Approval" section (around line 269-273) which reads:
```markdown
1. **Generate filename** from topic and today's date following report-routing conventions
2. **Determine output directory** from report_type (e.g., `architecture-review` → `reports/architecture-reviews/`)
3. **Check for collisions** — if filename exists, append time suffix
4. **Write file** to `reports/{report_type}s/{filename}.md`
5. **Confirm save** to user: `Report saved to reports/{report_type}s/{filename}.md`
```

Replace with:
```markdown
1. **Return the complete report** (frontmatter + body) as your final output
2. The calling command (`generate.md`) will handle persistence via `forge report create`
```

**Step 3: Update the "When You're Done" section**

Replace the text about "Ask for approval before writing the file" with:
```markdown
Present the complete draft report to the user. Explain:
- What report type was created
- What the confidence level is and why
- Any notable gaps or limitations

Return the complete report content (YAML frontmatter + markdown body) as your output. The generate command handles file persistence through forge-lib.
```

**Step 4: Commit**

```bash
git add report-forge/agents/forge-synthesizer.md
git commit -m "fix(report-forge): remove Write tool from forge-synthesizer agent

Agent now returns report content to the generate command, which handles
persistence via forge report create. Fixes audit finding C3 (R1 violation)."
```

---

### Task 2: Add YAML frontmatter to rovo-forge commands

**Files:**
- Modify: `rovo-forge/commands/jira-agent.md:1`
- Modify: `rovo-forge/commands/confluence-agent.md:1`

**Audit Finding:** H3 — Neither rovo-forge command has YAML frontmatter. Both start directly with `# /rovo-{type}` heading.

**Step 1: Add frontmatter to jira-agent.md**

Insert at the very top of `rovo-forge/commands/jira-agent.md`, before the existing `# /rovo-jira` heading:

```yaml
---
name: jira-agent
description: "Interactive Rovo agent builder for Jira. Guides through TCREI framework to produce a complete Rovo Studio configuration with validated output."
---

```

**Step 2: Add frontmatter to confluence-agent.md**

Insert at the very top of `rovo-forge/commands/confluence-agent.md`, before the existing `# /rovo-confluence` heading:

```yaml
---
name: confluence-agent
description: "Interactive Rovo agent builder for Confluence. Guides through TCREI framework to produce a complete Rovo Studio configuration with validated output."
---

```

**Step 3: Commit**

```bash
git add rovo-forge/commands/jira-agent.md rovo-forge/commands/confluence-agent.md
git commit -m "fix(rovo-forge): add YAML frontmatter to both commands

Adds name and description frontmatter to jira-agent.md and
confluence-agent.md. Fixes audit finding H3 (R6 violation)."
```

---

### Task 3: Add YAML frontmatter to rovo-forge skills

**Files:**
- Modify: `rovo-forge/skills/rovo-foundation/SKILL.md:1`
- Modify: `rovo-forge/skills/jira-specialist/SKILL.md:1`
- Modify: `rovo-forge/skills/confluence-specialist/SKILL.md:1`

**Audit Finding:** H3 — All 3 rovo-forge skills have no YAML frontmatter (missing `name`, `description`).

**Step 1: Add frontmatter to rovo-foundation/SKILL.md**

Insert at the very top, before `# Rovo Foundation`:
```yaml
---
name: rovo-foundation
description: "Platform knowledge for Rovo agent configuration: TCREI framework, validation rules, knowledge sources, and governance model."
---

```

**Step 2: Add frontmatter to jira-specialist/SKILL.md**

Insert at the very top:
```yaml
---
name: jira-specialist
description: "Jira-specific domain knowledge for Rovo agent building: skills catalog, design patterns, issue types, and automation integration."
---

```

**Step 3: Add frontmatter to confluence-specialist/SKILL.md**

Insert at the very top:
```yaml
---
name: confluence-specialist
description: "Confluence-specific domain knowledge for Rovo agent building: skills catalog, content patterns, space management, and content lifecycle."
---

```

**Step 4: Commit**

```bash
git add rovo-forge/skills/rovo-foundation/SKILL.md rovo-forge/skills/jira-specialist/SKILL.md rovo-forge/skills/confluence-specialist/SKILL.md
git commit -m "fix(rovo-forge): add YAML frontmatter to all 3 skills

Adds name and description frontmatter to rovo-foundation, jira-specialist,
and confluence-specialist skills. Fixes audit finding H3 (R7 violation)."
```

---

### Task 4: Replace raw shell commands in product-forge init.md

**Files:**
- Modify: `product-forge/commands/init.md`

**Audit Finding:** H4 — The `/init` command uses raw `mkdir -p` and `echo` instead of `forge card init`.

**Step 1: Replace the Implementation section**

In `product-forge/commands/init.md`, replace the entire `## Implementation` section (lines 29-52) with:

```markdown
## Implementation

Initialize using forge-lib CLI:

```bash
forge card init --directory .
```

Parse the JSON response:

```json
{
  "success": true,
  "data": {
    "directories_created": [
      "cards/initiatives",
      "cards/epics",
      "cards/stories",
      "cards/intakes",
      "cards/checkpoints",
      "cards/decisions",
      "cards/release-notes"
    ],
    "index_files_created": 7
  }
}
```

### Error Handling

If forge-lib returns an error:
```json
{
  "success": false,
  "data": null,
  "error": "Permission denied: cannot create directory cards/"
}
```

Report the error to the user:
```
Error initializing cards directory: {error message from JSON response}

Check that the working directory is writable and you're running from the project root.
```
```

**Step 2: Update the Key Rules section**

Replace the bullet about index files (line 76):
```markdown
- **Index files:** Each directory gets an empty index.json with `{"entries":[]}` structure for fast querying.
```
with:
```markdown
- **Index files:** forge-lib creates properly structured index.json files in each directory for fast querying.
```

**Step 3: Commit**

```bash
git add product-forge/commands/init.md
git commit -m "fix(product-forge): replace raw mkdir/echo with forge card init

Delegates directory creation and index initialization to forge-lib CLI.
Adds JSON response parsing and error handling. Fixes audit finding H4
(R1 violation)."
```

---

### Task 5: Add Verification section to tasks-forge README

**Files:**
- Modify: `tasks-forge/README.md`

**Audit Finding:** L1 — tasks-forge README missing a Verification section.

**Step 1: Read tasks-forge README**

Read `tasks-forge/README.md` to find the end of the document where the Verification section should go.

**Step 2: Add Verification section**

Append before the final section (or at the end of the document):

```markdown
## Verification

After installation, verify the plugin is working:

1. **Initialize tasks directory:**
   ```
   /tasks-forge:start
   ```
   Expected: Creates `tasks/` directory with `index.json`

2. **Create a test task:**
   ```
   /tasks-forge:add
   ```
   Expected: Interactive workflow creates `tasks/task-001.md` and updates `tasks/index.json`

3. **Update the test task:**
   ```
   /tasks-forge:update
   ```
   Expected: Can query and update existing tasks via forge-lib

4. **Verify forge-lib integration:**
   ```bash
   python forge-lib/forge.py task query --directory .
   ```
   Expected: Returns JSON with `{"success": true, "data": [...]}`
```

**Step 3: Commit**

```bash
git add tasks-forge/README.md
git commit -m "docs(tasks-forge): add Verification section to README

Fixes audit finding L1 (R8 partial compliance)."
```

---

### Task 6: Update CLAUDE.md to reflect forge-shell FS scanning architecture

**Files:**
- Modify: `CLAUDE.md`

**Audit Finding:** M1 — CLAUDE.md claims forge-shell reads from `index.json` but all view controllers use direct FS scanning since commit `da5080c`.

**Step 1: Update the Forge Shell Desktop App section**

In `CLAUDE.md`, find the line:
```markdown
**Data Loading:** Reads from `index.json` files via `ForgeUtils.readIndex()` in `forge-shell/app/js/utils.js`.
```

Replace with:
```markdown
**Data Loading:** Uses direct filesystem scanning via `ForgeFS` utility in `forge-shell/app/js/utils.js`. Each view controller scans its plugin's data directory and parses markdown frontmatter directly (refactored from index.json in commit `da5080c`).
```

**Step 2: Update the Performance note in the Architecture section**

Find:
```markdown
**Performance:** All queries run against `index.json` files (no directory scanning).
```

Replace with:
```markdown
**Performance:** Plugin commands query via forge-lib which uses `index.json` for fast lookups. forge-shell view controllers use direct FS scanning for real-time accuracy.
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect forge-shell FS scanning architecture

forge-shell view controllers use direct FS scanning since da5080c,
not index.json. Fixes audit finding M1."
```

---

## Phase 2: Tasks-Forge Naming Fix

---

### Task 7: Fix tasks-forge file naming mismatch between forge-lib and forge-shell

**Files:**
- Modify: `forge-shell/app/js/tasks.js:253`
- Modify: `forge-shell/app/js/tasks.js:379`
- Modify: `forge-shell/app/js/tasks.js:740`
- Modify: `forge-shell/app/js/tasks.js:748`

**Audit Finding:** C4 — forge-shell regex expects `task-NNN-{slug}.md` but forge-lib creates `task-NNN.md`. Tasks created by CLI are invisible in the UI.

**Decision:** Update forge-shell to match forge-lib's format (`task-NNN.md`), since forge-lib is the source of truth and CLAUDE.md documents `task-NNN.md` as the naming pattern.

**Step 1: Update the parseTaskFiles regex (line 253)**

Change:
```javascript
if (entry.kind === 'file' && /^task-\d{3}-.*\.md$/.test(entry.name)) {
```
to:
```javascript
if (entry.kind === 'file' && /^task-\d{3}(-.*)?\.md$/.test(entry.name)) {
```

This makes the `-slug` portion optional, matching both `task-001.md` (from forge-lib) and `task-001-slug.md` (from forge-shell inline creation).

**Step 2: Update the watch/polling regex (line 379)**

Change:
```javascript
if (file.kind === 'file' && /^task-\d{3}-.*\.md$/.test(file.name)) {
```
to:
```javascript
if (file.kind === 'file' && /^task-\d{3}(-.*)?\.md$/.test(file.name)) {
```

**Step 3: Update the inline task creation filename (line 740-748)**

Change:
```javascript
var match = t.filename.match(/^task-(\d{3})-/);
```
to:
```javascript
var match = t.filename.match(/^task-(\d{3})/);
```

And change:
```javascript
var newFilename = 'task-' + String(newNum).padStart(3, '0') + '-new-task.md';
```
to:
```javascript
var newFilename = 'task-' + String(newNum).padStart(3, '0') + '.md';
```

**Step 4: Update the parseTaskFiles comment (line 241)**

Change:
```javascript
// matching the task-NNN-*.md pattern, replacing the old index.json lookup.
```
to:
```javascript
// matching the task-NNN.md pattern (with optional slug suffix), replacing the old index.json lookup.
```

**Step 5: Manually test**

Open forge-shell and verify:
1. Existing tasks with slug suffixes still appear
2. Tasks created by forge-lib CLI (without slug) now appear
3. Creating a task inline from forge-shell still works

**Step 6: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "fix(forge-shell): align task filename regex with forge-lib pattern

forge-lib creates task-NNN.md but forge-shell expected task-NNN-slug.md.
Updated regex to accept both formats. Inline creation now uses task-NNN.md
to match forge-lib convention. Fixes audit finding C4 (R9 violation)."
```

---

## Phase 3: Error Handling & JSON Response Parsing Standardization

These tasks add standardized error handling and JSON response parsing instructions to plugin commands. Reference patterns come from tasks-forge `add.md` (R10 best practice) and report-forge `list.md` (R11 best practice).

---

### Task 8: Add error handling and JSON parsing to product-forge commands

**Files:**
- Modify: `product-forge/commands/initiative.md`
- Modify: `product-forge/commands/epic.md`
- Modify: `product-forge/commands/story.md`
- Modify: `product-forge/commands/intake.md`
- Modify: `product-forge/commands/decision.md`
- Modify: `product-forge/commands/checkpoint.md`
- Modify: `product-forge/commands/release-notes.md`

**Audit Finding:** H1/H2 for product-forge — Commands reference forge-lib responses but never show explicit `{success, data, error}` envelope parsing. Core card commands lack error handling.

**Step 1: Define the standard error handling block**

Each command that calls forge-lib should include this pattern after the `forge card create` call:

```markdown
### Parse forge-lib Response

The forge-lib command returns JSON:

```json
{
  "success": true,
  "data": {
    "filename": "{slug}.md",
    "filepath": "cards/{type}s/{slug}.md",
    "card_type": "{type}",
    "title": "{title}",
    "created": "YYYY-MM-DD",
    "updated": "YYYY-MM-DD"
  }
}
```

Extract `data.filename` and `data.filepath` for the confirmation message.

### Error Handling

If forge-lib returns an error response:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report the error to the user:
```
Error creating {type}: {error message from JSON response}
```

Common errors:
- **Validation error**: A required field is missing or has an invalid value. Review the field values and retry.
- **Duplicate filename**: A card with the same title already exists. Suggest a different title or use the update command.
```

**Step 2: Add this block to each of the 7 card commands**

For each command file, find the section where `forge card create` is called and add the response parsing and error handling blocks immediately after. The exact insertion point varies per file — look for the forge-lib CLI call and add the blocks after it.

**Step 3: Commit**

```bash
git add product-forge/commands/initiative.md product-forge/commands/epic.md product-forge/commands/story.md product-forge/commands/intake.md product-forge/commands/decision.md product-forge/commands/checkpoint.md product-forge/commands/release-notes.md
git commit -m "fix(product-forge): add JSON response parsing and error handling to all card commands

Adds explicit {success, data, error} envelope parsing and error handling
instructions to all 7 card commands. Fixes audit findings H1/H2 (R10/R11)."
```

---

### Task 9: Add error handling to cognitive-forge commands

**Files:**
- Modify: `cognitive-forge/commands/debate.md`
- Modify: `cognitive-forge/commands/explore.md`

**Audit Finding:** H1 for cognitive-forge — Neither command contains any instructions for handling forge-lib CLI errors. No error path exists for failed `forge session create`.

**Step 1: Add error handling to debate.md**

In `cognitive-forge/commands/debate.md`, after the `forge session create` call in the "Save Session" section (around line 267), add:

```markdown
### Parse forge-lib Response

The forge-lib command returns JSON:

```json
{
  "success": true,
  "data": {
    "filename": "YYYY-MM-DD-slug.md",
    "filepath": "sessions/debates/YYYY-MM-DD-slug.md",
    "session_type": "debate",
    "title": "Concept Title",
    "created": "YYYY-MM-DD"
  }
}
```

Extract `data.filepath` and use it in the confirmation message: "Session saved to {filepath}"

### Error Handling

If `forge session create` fails:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report to user:
```
Warning: Session analysis is complete but could not be saved: {error}

The debate results are still available in this conversation. You can retry saving with:
forge session create debate "{title}" "{topic}" --status Completed --data '{...}'
```

Do not let a persistence failure invalidate the debate analysis. The user already has the results.
```

**Step 2: Add the same pattern to explore.md**

Add identical error handling in the "Save Session" section of `explore.md`, adjusting `debate` → `exploration` and `debates/` → `explorations/`.

**Step 3: Commit**

```bash
git add cognitive-forge/commands/debate.md cognitive-forge/commands/explore.md
git commit -m "fix(cognitive-forge): add error handling for forge session create

Adds JSON response parsing and graceful error handling to both debate
and explore commands. Persistence failure doesn't invalidate analysis.
Fixes audit finding H1 (R11 violation)."
```

---

### Task 10: Add error handling to report-forge generate.md

**Files:**
- Modify: `report-forge/commands/generate.md`

**Audit Finding:** H1/H2 for report-forge — `generate.md` has no error handling for `forge report create` failures and no explicit JSON response parsing.

**Step 1: Read the full generate.md file**

Read `report-forge/commands/generate.md` to find where `forge report create` is called.

**Step 2: Add JSON response parsing after forge report create**

After the `forge report create` call, add:

```markdown
### Parse forge-lib Response

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

### Error Handling

If `forge report create` fails:

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
forge report create {type} "{title}" --data '{...}'
```
```

**Step 3: Commit**

```bash
git add report-forge/commands/generate.md
git commit -m "fix(report-forge): add error handling to generate command

Adds JSON response parsing and error handling for forge report create.
Fixes audit findings H1/H2 (R10/R11 partial for generate.md)."
```

---

### Task 11: Add explicit success field checking to tasks-forge commands

**Files:**
- Modify: `tasks-forge/commands/start.md`
- Modify: `tasks-forge/commands/add.md`
- Modify: `tasks-forge/commands/update.md`

**Audit Finding:** H1 for tasks-forge — Commands handle workflow-level errors but don't explicitly check `success` field from forge-lib responses.

**Step 1: Read each command to find forge-lib call sites**

Read all 3 commands and locate each forge-lib CLI call.

**Step 2: Add success field checking after each forge-lib call**

After each `forge task` call, add:

```markdown
Check the `success` field in the JSON response. If `success` is `false`, report the `error` field to the user and do not proceed with subsequent steps.
```

**Step 3: Commit**

```bash
git add tasks-forge/commands/start.md tasks-forge/commands/add.md tasks-forge/commands/update.md
git commit -m "fix(tasks-forge): add explicit success field checking to all commands

Commands now verify success field from forge-lib JSON responses before
proceeding. Fixes audit finding H1 (R11 partial)."
```

---

### Task 12: Add error handling to forge-memory commands

**Files:**
- Modify: `forge-memory/commands/start.md`
- Modify: `forge-memory/commands/setup-org.md`
- Modify: `forge-memory/commands/remember.md`
- Modify: `forge-memory/commands/recall.md`

**Audit Finding:** H1/H2 for forge-memory — No command explicitly parses `{success, data, error}` structure. No command checks `success` field.

**Step 1: Read all 4 commands**

Read each command file to find forge-lib call sites (memory init, get-taxonomy, set-taxonomy).

**Step 2: Add JSON response parsing and error handling**

After each `forge memory` CLI call in start.md and setup-org.md, add the standard response parsing pattern:

```markdown
### Parse Response

```json
{
  "success": true,
  "data": { ... }
}
```

If `success` is `false`:
```
Error: {error message from JSON response}
```
```

For remember.md and recall.md, add a note about future forge-lib integration:
```markdown
**Note:** Knowledge file operations (people, projects, glossary) currently use direct file creation. Once forge-lib memory CRUD operations are available, these operations should delegate to `forge memory create-person`, `forge memory create-project`, etc.
```

**Step 3: Commit**

```bash
git add forge-memory/commands/start.md forge-memory/commands/setup-org.md forge-memory/commands/remember.md forge-memory/commands/recall.md
git commit -m "fix(forge-memory): add error handling and JSON parsing to commands

Adds explicit JSON response parsing for taxonomy operations and
documents future forge-lib integration path for knowledge operations.
Fixes audit findings H1/H2 (R10/R11 violations)."
```

---

## Phase 4: Rovo-Forge forge-lib Integration

This phase creates the `forge agent` subcommand in forge-lib, adds schema and template, then updates rovo-forge commands to delegate Phase 11 to forge-lib instead of writing files directly.

**Reference implementation:** Follow `card_ops.py` for the CRUD pattern, `task_ops.py` for sequential operations.

---

### Task 13: Write failing tests for agent_ops.py

**Files:**
- Create: `forge-lib/tests/test_agent_ops.py`

**Step 1: Write the test file**

```python
"""Tests for agent operations (rovo-forge integration)."""
import json
import os
import pytest
from pathlib import Path
from unittest.mock import patch
from datetime import date


@pytest.fixture
def temp_dir(tmp_path):
    """Create a temporary directory for tests."""
    return tmp_path


@pytest.fixture
def agent_dir(temp_dir):
    """Create and return the rovo-agents directory."""
    d = temp_dir / 'rovo-agents'
    d.mkdir()
    return d


class TestCreateAgent:
    """Tests for create_agent function."""

    def test_create_jira_agent(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Ticket Triage Agent',
            'platform': 'jira',
            'description': 'Triages incoming Jira tickets based on priority and team routing rules.',
            'skills': ['Search Jira Issues (JQL)', 'Update Issue Fields'],
            'knowledge_sources': ['SUPPORT project'],
            'conversation_starters': ['Triage new tickets', 'Show untriaged issues', 'Route this ticket'],
            'owner': 'Jeremy Brice',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['filename'] == 'agent.md'
        assert result['slug'] == 'ticket-triage-agent'
        assert result['dirpath'] == str(temp_dir / 'rovo-agents' / 'ticket-triage-agent')
        assert (temp_dir / 'rovo-agents' / 'ticket-triage-agent' / 'agent.md').exists()

    def test_create_confluence_agent(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Documentation Specialist',
            'platform': 'confluence',
            'description': 'Creates and maintains technical documentation in Confluence spaces.',
            'skills': ['Create Confluence Page', 'Update Confluence Page Content'],
            'knowledge_sources': ['Engineering space'],
            'conversation_starters': ['Create new docs', 'Review this page', 'Update the runbook'],
            'owner': 'Jeremy Brice',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['slug'] == 'documentation-specialist'
        assert 'platform: confluence' in (temp_dir / 'rovo-agents' / 'documentation-specialist' / 'agent.md').read_text()

    def test_create_agent_validates_against_schema(self, temp_dir):
        from core.agent_ops import create_agent
        from core.validator import ValidationError
        data = {
            'name': 'X',  # Too short (schema should require minLength)
            'platform': 'invalid',
        }
        with pytest.raises((ValidationError, Exception)):
            create_agent(data, directory=str(temp_dir))

    def test_create_agent_generates_slug(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Ticket Generation and Triage Agent',
            'platform': 'jira',
            'description': 'Generates and triages tickets for the support team.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Generate tickets', 'Triage queue', 'Show stats'],
            'owner': 'Test User',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['slug'] == 'ticket-generation-and-triage-agent'

    def test_create_agent_updates_index(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Test Agent',
            'platform': 'jira',
            'description': 'A test agent for verifying index updates work correctly.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Test me', 'Run check', 'Show status'],
            'owner': 'Test User',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        index_path = temp_dir / 'rovo-agents' / 'index.json'
        assert index_path.exists()
        index_data = json.loads(index_path.read_text())
        assert len(index_data['entries']) == 1
        assert index_data['entries'][0]['name'] == 'Test Agent'

    def test_create_duplicate_agent_raises(self, temp_dir):
        from core.agent_ops import create_agent, AgentError
        data = {
            'name': 'Duplicate Agent',
            'platform': 'jira',
            'description': 'This agent tests that duplicates are properly rejected.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Test', 'Check', 'Run'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        with pytest.raises(AgentError):
            create_agent(data, directory=str(temp_dir))


class TestGetAgent:
    """Tests for get_agent function."""

    def test_get_existing_agent(self, temp_dir):
        from core.agent_ops import create_agent, get_agent
        data = {
            'name': 'Fetchable Agent',
            'platform': 'jira',
            'description': 'An agent that can be fetched after creation for testing.',
            'skills': ['Search Jira Issues (JQL)'],
            'knowledge_sources': [],
            'conversation_starters': ['Fetch me', 'Get info', 'Show details'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        result = get_agent('fetchable-agent', directory=str(temp_dir))
        assert result['name'] == 'Fetchable Agent'
        assert result['platform'] == 'jira'

    def test_get_nonexistent_agent_raises(self, temp_dir):
        from core.agent_ops import get_agent, AgentError
        with pytest.raises(AgentError):
            get_agent('nonexistent-agent', directory=str(temp_dir))


class TestQueryAgents:
    """Tests for query_agents function."""

    def test_query_all_agents(self, temp_dir):
        from core.agent_ops import create_agent, query_agents
        for name, platform in [('Agent A', 'jira'), ('Agent B', 'confluence'), ('Agent C', 'jira')]:
            create_agent({
                'name': name,
                'platform': platform,
                'description': f'Test agent {name} for query testing across platforms.',
                'skills': [],
                'knowledge_sources': [],
                'conversation_starters': ['Start', 'Go', 'Run'],
                'owner': 'Test',
                'collaborators': [],
                'visibility': 'organization',
            }, directory=str(temp_dir))
        results = query_agents(directory=str(temp_dir))
        assert len(results) == 3

    def test_query_by_platform(self, temp_dir):
        from core.agent_ops import create_agent, query_agents
        for name, platform in [('Jira Agent', 'jira'), ('Confluence Agent', 'confluence')]:
            create_agent({
                'name': name,
                'platform': platform,
                'description': f'Test {platform} agent for platform filtering tests.',
                'skills': [],
                'knowledge_sources': [],
                'conversation_starters': ['Start', 'Go', 'Run'],
                'owner': 'Test',
                'collaborators': [],
                'visibility': 'organization',
            }, directory=str(temp_dir))
        results = query_agents(directory=str(temp_dir), filters={'platform': 'jira'})
        assert len(results) == 1
        assert results[0]['name'] == 'Jira Agent'


class TestUpdateAgent:
    """Tests for update_agent function."""

    def test_update_agent_status(self, temp_dir):
        from core.agent_ops import create_agent, update_agent
        create_agent({
            'name': 'Updatable Agent',
            'platform': 'jira',
            'description': 'An agent that will be updated to test status changes.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Start', 'Go', 'Run'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }, directory=str(temp_dir))
        result = update_agent('updatable-agent', {'status': 'published'}, directory=str(temp_dir))
        assert result['status'] == 'published'
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python -m pytest tests/test_agent_ops.py -v`
Expected: All tests FAIL with `ModuleNotFoundError: No module named 'core.agent_ops'`

**Step 3: Commit**

```bash
git add forge-lib/tests/test_agent_ops.py
git commit -m "test(forge-lib): add failing tests for agent_ops module

Tests for create, get, query, and update operations for rovo-forge
agent entities. All tests fail pending implementation."
```

---

### Task 14: Create agent.json schema

**Files:**
- Create: `forge-lib/schemas/agent.json`

**Step 1: Write the schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://forge-lib.local/schemas/agent.json",
  "title": "Rovo Agent",
  "description": "Schema for Rovo agent configurations created by rovo-forge",
  "type": "object",
  "required": ["name", "platform", "description", "status", "created", "updated"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Agent display name",
      "minLength": 10,
      "maxLength": 100
    },
    "platform": {
      "type": "string",
      "description": "Target Atlassian platform",
      "enum": ["jira", "confluence"]
    },
    "description": {
      "type": "string",
      "description": "Agent description",
      "minLength": 50,
      "maxLength": 500
    },
    "status": {
      "type": "string",
      "description": "Agent lifecycle status",
      "enum": ["draft", "published", "archived"],
      "default": "draft"
    },
    "skills": {
      "type": "array",
      "description": "List of Rovo skills enabled for this agent",
      "items": { "type": "string" },
      "default": []
    },
    "knowledge_sources": {
      "type": "array",
      "description": "List of knowledge sources the agent can access",
      "items": { "type": "string" },
      "default": []
    },
    "conversation_starters": {
      "type": "array",
      "description": "Suggested conversation starters (exactly 3)",
      "items": { "type": "string" },
      "minItems": 3,
      "maxItems": 3
    },
    "owner": {
      "type": ["string", "null"],
      "description": "Agent owner",
      "default": null
    },
    "collaborators": {
      "type": "array",
      "description": "List of collaborators who can edit this agent",
      "items": { "type": "string" },
      "default": []
    },
    "visibility": {
      "type": "string",
      "description": "Agent visibility scope",
      "enum": ["organization", "team", "private"],
      "default": "organization"
    },
    "created": {
      "type": "string",
      "format": "date",
      "description": "Creation date in YYYY-MM-DD format"
    },
    "updated": {
      "type": "string",
      "format": "date",
      "description": "Last update date in YYYY-MM-DD format"
    }
  },
  "additionalProperties": false
}
```

**Step 2: Commit**

```bash
git add forge-lib/schemas/agent.json
git commit -m "feat(forge-lib): add agent.json schema for rovo-forge entities"
```

---

### Task 15: Create agent.md.j2 template

**Files:**
- Create: `forge-lib/templates/agent.md.j2`

**Step 1: Write the template**

Extract the inline template from `rovo-forge/commands/jira-agent.md` (Phase 11, lines 267-305) and convert to Jinja2:

```jinja2
---
name: "{{ name }}"
platform: {{ platform }}
description: "{{ description }}"
status: {{ status }}
skills:
{%- if skills and skills|length > 0 %}
{% for skill in skills %}
  - "{{ skill }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
knowledge_sources:
{%- if knowledge_sources and knowledge_sources|length > 0 %}
{% for source in knowledge_sources %}
  - "{{ source }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
conversation_starters:
{%- if conversation_starters and conversation_starters|length > 0 %}
{% for starter in conversation_starters %}
  - "{{ starter }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
owner: {{ owner if owner else 'null' }}
collaborators:
{%- if collaborators and collaborators|length > 0 %}
{% for collab in collaborators %}
  - "{{ collab }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
visibility: {{ visibility }}
created: {{ created }}
updated: {{ updated }}
---

{% if behavior %}
## Behavior

{{ behavior }}
{% endif %}

{% if scenarios and scenarios|length > 0 %}
## Scenarios

{% for scenario in scenarios %}
### {{ 'Default: ' if loop.first else 'Scenario ' ~ loop.index ~ ': ' }}{{ scenario.name }}

{{ scenario.instructions }}

**Trigger keywords**: {{ scenario.triggers if scenario.triggers else '(none — default scenario)' }}

{% endfor %}
{% endif %}
```

**Step 2: Commit**

```bash
git add forge-lib/templates/agent.md.j2
git commit -m "feat(forge-lib): add agent.md.j2 template for rovo-forge entities"
```

---

### Task 16: Implement agent_ops.py

**Files:**
- Create: `forge-lib/core/agent_ops.py`

**Step 1: Write the implementation**

Follow the pattern from `card_ops.py` and `task_ops.py`:

```python
"""Agent operations for forge-lib.

This module provides operations for creating, reading, querying, and updating
Rovo agent configurations stored in rovo-agents/{slug}/agent.md.
"""

import json
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import jinja2

from . import frontmatter, index_ops, validator


class AgentError(Exception):
    """Raised when an agent operation fails."""
    pass


def _get_agents_directory(directory: str = '.') -> Path:
    """Get the rovo-agents directory path.

    Args:
        directory: Base directory (default: current directory)

    Returns:
        Path to rovo-agents directory
    """
    return Path(directory) / 'rovo-agents'


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from an agent name.

    Matches the algorithm in rovo-forge commands:
    - Convert to lowercase
    - Replace spaces with hyphens
    - Strip non-alphanumeric/hyphen characters
    - Collapse consecutive hyphens
    - Trim leading/trailing hyphens

    Args:
        name: Agent display name

    Returns:
        URL-safe slug string
    """
    slug = name.lower()
    slug = slug.replace(' ', '-')
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


def _load_template() -> jinja2.Template:
    """Load Jinja2 template for agents.

    Returns:
        Jinja2 Template object

    Raises:
        AgentError: If template loading fails
    """
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_path = templates_dir / 'agent.md.j2'

    if not template_path.exists():
        raise AgentError(f"Agent template not found: {template_path}")

    try:
        template_loader = jinja2.FileSystemLoader(str(templates_dir))
        template_env = jinja2.Environment(loader=template_loader)
        return template_env.get_template('agent.md.j2')
    except Exception as e:
        raise AgentError(f"Failed to load agent template: {e}")


def create_agent(data: Dict[str, Any], directory: str = '.') -> Dict[str, Any]:
    """Create a new Rovo agent configuration.

    Args:
        data: Agent data dictionary with required fields
        directory: Base directory (default: current directory)

    Returns:
        Dictionary with agent metadata:
        {
            'filename': 'agent.md',
            'slug': 'ticket-triage-agent',
            'dirpath': '/full/path/to/rovo-agents/ticket-triage-agent',
            'name': 'Ticket Triage Agent',
            'platform': 'jira',
            'status': 'draft',
            'created': '2026-02-17',
            'updated': '2026-02-17'
        }

    Raises:
        AgentError: If creation fails
        validator.ValidationError: If data fails schema validation
    """
    # Add defaults
    today = date.today().strftime('%Y-%m-%d')
    if 'status' not in data:
        data['status'] = 'draft'
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate against schema
    try:
        validator.validate(data, 'agent')
    except Exception as e:
        raise validator.ValidationError(str(e))

    # Generate slug from name
    slug = _generate_slug(data['name'])
    if not slug:
        raise AgentError(f"Cannot generate slug from agent name: {data['name']}")

    # Create directory structure
    agents_dir = _get_agents_directory(directory)
    agent_dir = agents_dir / slug
    if agent_dir.exists():
        raise AgentError(f"Agent already exists: {agent_dir}")

    agent_dir.mkdir(parents=True, exist_ok=True)

    # Load template and render
    template = _load_template()
    try:
        content = template.render(**data)
    except Exception as e:
        # Clean up directory on failure
        agent_dir.rmdir()
        raise AgentError(f"Template rendering failed: {e}")

    # Write agent file
    filepath = agent_dir / 'agent.md'
    filepath.write_text(content)

    # Update index
    try:
        entry = {
            'file': f'{slug}/agent.md',
            'name': data['name'],
            'platform': data['platform'],
            'status': data['status'],
            'description': data.get('description', ''),
            'created': data['created'],
            'updated': data['updated'],
        }
        index_ops.create_index_entry(str(agents_dir), entry)
    except Exception:
        pass  # Index update failure is non-fatal

    return {
        'filename': 'agent.md',
        'slug': slug,
        'dirpath': str(agent_dir),
        'name': data['name'],
        'platform': data['platform'],
        'status': data['status'],
        'created': data['created'],
        'updated': data['updated'],
    }


def get_agent(slug: str, directory: str = '.') -> Dict[str, Any]:
    """Get an agent's frontmatter by slug.

    Args:
        slug: Agent directory slug
        directory: Base directory

    Returns:
        Dictionary of agent frontmatter fields

    Raises:
        AgentError: If agent not found
    """
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise AgentError(f"Agent not found: {slug}")

    content = filepath.read_text()
    fm, _ = frontmatter.parse(content)
    return fm


def query_agents(directory: str = '.', filters: Optional[Dict] = None) -> List[Dict]:
    """Query agents from index.

    Args:
        directory: Base directory
        filters: Optional filters (platform, status)

    Returns:
        List of matching agent index entries
    """
    agents_dir = _get_agents_directory(directory)
    try:
        results = index_ops.query_index(str(agents_dir), filters=filters)
        return results
    except Exception:
        return []


def update_agent(slug: str, updates: Dict[str, Any], directory: str = '.') -> Dict[str, Any]:
    """Update an existing agent's frontmatter.

    Args:
        slug: Agent directory slug
        updates: Dictionary of fields to update
        directory: Base directory

    Returns:
        Updated frontmatter dictionary

    Raises:
        AgentError: If agent not found or update fails
    """
    agents_dir = _get_agents_directory(directory)
    filepath = agents_dir / slug / 'agent.md'

    if not filepath.exists():
        raise AgentError(f"Agent not found: {slug}")

    content = filepath.read_text()
    fm, body = frontmatter.parse(content)

    # Apply updates
    fm.update(updates)
    fm['updated'] = date.today().strftime('%Y-%m-%d')

    # Write back
    new_content = frontmatter.dumps(fm, body)
    filepath.write_text(new_content)

    # Update index
    try:
        entry = {
            'file': f'{slug}/agent.md',
            'name': fm.get('name', ''),
            'platform': fm.get('platform', ''),
            'status': fm.get('status', ''),
            'description': fm.get('description', ''),
            'created': fm.get('created', ''),
            'updated': fm['updated'],
        }
        index_ops.update_index_entry(str(agents_dir), f'{slug}/agent.md', entry)
    except Exception:
        pass  # Index update failure is non-fatal

    return fm
```

**Step 2: Run tests**

Run: `cd forge-lib && python -m pytest tests/test_agent_ops.py -v`
Expected: Most tests should PASS now.

**Step 3: Fix any failing tests**

Iterate until all tests pass.

**Step 4: Commit**

```bash
git add forge-lib/core/agent_ops.py
git commit -m "feat(forge-lib): implement agent_ops module for rovo-forge

CRUD operations for Rovo agent configurations: create, get, query, update.
Agents stored in rovo-agents/{slug}/agent.md with index.json support."
```

---

### Task 17: Register forge agent subcommand in forge.py

**Files:**
- Modify: `forge-lib/forge.py`

**Step 1: Add import**

At the top of forge.py, add to the imports section:
```python
from core import agent_ops
from core.agent_ops import AgentError
```

**Step 2: Add handler functions**

Add these handler functions after the existing report handlers (around line 500):

```python
def handle_agent_create(args):
    """Create a new Rovo agent configuration."""
    try:
        data = {'name': args.name, 'platform': args.platform}
        if args.data:
            data.update(json.loads(args.data))
        result = agent_ops.create_agent(data, directory=args.directory)
        output_json(result)
    except validator.ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_get(args):
    """Get a Rovo agent configuration by slug."""
    try:
        result = agent_ops.get_agent(args.slug, directory=args.directory)
        output_json(result)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_query(args):
    """Query Rovo agent configurations."""
    try:
        filters = {}
        if args.platform:
            filters['platform'] = args.platform
        if args.status:
            filters['status'] = args.status
        results = agent_ops.query_agents(directory=args.directory, filters=filters)
        output_json(results)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_agent_update(args):
    """Update a Rovo agent configuration."""
    try:
        updates = json.loads(args.data) if args.data else {}
        result = agent_ops.update_agent(args.slug, updates, directory=args.directory)
        output_json(result)
    except AgentError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json(None, success=False, error=f"Invalid JSON in --data: {e}")
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)
```

**Step 3: Register the parser**

In the `create_parser()` function, add the agent subcommand group after the existing groups:

```python
# Agent commands
agent_parser = subparsers.add_parser('agent', help='Rovo agent operations')
agent_subparsers = agent_parser.add_subparsers(dest='agent_command', required=True)

# agent create
agent_create = agent_subparsers.add_parser('create', help='Create a new Rovo agent')
agent_create.add_argument('name', help='Agent display name')
agent_create.add_argument('platform', choices=['jira', 'confluence'], help='Target platform')
agent_create.add_argument('--data', help='Additional agent data as JSON')
agent_create.add_argument('--directory', default='.', help='Base directory')
agent_create.set_defaults(func=handle_agent_create)

# agent get
agent_get = agent_subparsers.add_parser('get', help='Get agent by slug')
agent_get.add_argument('slug', help='Agent directory slug')
agent_get.add_argument('--directory', default='.', help='Base directory')
agent_get.set_defaults(func=handle_agent_get)

# agent query
agent_query = agent_subparsers.add_parser('query', help='Query agents')
agent_query.add_argument('--platform', choices=['jira', 'confluence'], help='Filter by platform')
agent_query.add_argument('--status', choices=['draft', 'published', 'archived'], help='Filter by status')
agent_query.add_argument('--directory', default='.', help='Base directory')
agent_query.set_defaults(func=handle_agent_query)

# agent update
agent_update = agent_subparsers.add_parser('update', help='Update an agent')
agent_update.add_argument('slug', help='Agent directory slug')
agent_update.add_argument('--data', help='Update data as JSON')
agent_update.add_argument('--directory', default='.', help='Base directory')
agent_update.set_defaults(func=handle_agent_update)
```

**Step 4: Verify CLI works**

Run: `cd forge-lib && python forge.py agent --help`
Expected: Shows agent subcommand help with create, get, query, update.

**Step 5: Run all tests**

Run: `cd forge-lib && python -m pytest tests/ -v`
Expected: All tests pass including the new agent_ops tests.

**Step 6: Commit**

```bash
git add forge-lib/forge.py
git commit -m "feat(forge-lib): register forge agent subcommand in CLI

Adds create, get, query, update operations for rovo-forge agents.
Completes forge-lib integration for rovo-forge plugin."
```

---

### Task 18: Update rovo-forge commands to delegate Phase 11 to forge-lib

**Files:**
- Modify: `rovo-forge/commands/jira-agent.md`
- Modify: `rovo-forge/commands/confluence-agent.md`

**Step 1: Replace Phase 11 in jira-agent.md**

Replace the entire Phase 11 section (lines 257-310) with:

```markdown
## Phase 11: File Persistence

After presenting the assembled configuration output to the user, persist the agent configuration using forge-lib.

### Save Agent Configuration

```bash
forge agent create "{Agent Name}" jira \
  --data '{
    "description": "{Agent Description}",
    "skills": ["{Skill 1}", "{Skill 2}"],
    "knowledge_sources": ["{Source 1}"],
    "conversation_starters": ["{Starter 1}", "{Starter 2}", "{Starter 3}"],
    "owner": "{Owner}",
    "collaborators": [],
    "visibility": "{Visibility}",
    "behavior": "{Full behavior text}",
    "scenarios": [{"name": "{Scenario Name}", "instructions": "{Instructions}", "triggers": "{Keywords}"}]
  }'
```

### Parse forge-lib Response

```json
{
  "success": true,
  "data": {
    "filename": "agent.md",
    "slug": "ticket-triage-agent",
    "dirpath": "rovo-agents/ticket-triage-agent",
    "name": "Ticket Triage Agent",
    "platform": "jira",
    "status": "draft",
    "created": "YYYY-MM-DD"
  }
}
```

Confirm to user: "Agent configuration saved to `rovo-agents/{slug}/agent.md`. You can view and edit it in the Forge Shell Rovo Agent Forge dashboard."

### Error Handling

If `forge agent create` fails:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

Report to user:
```
Error saving agent configuration: {error}

The agent configuration is still available in this conversation.
You can retry or manually create the file.
```

### Updating Existing Agents

If the agent slug already exists, forge-lib will return an error. In that case:
1. Ask the user if they want to update the existing agent
2. If yes, use `forge agent update "{slug}" --data '{...}'` instead
```

**Step 2: Replace Phase 11 in confluence-agent.md**

Apply the same replacement, changing `jira` to `confluence` in the forge-lib command.

**Step 3: Commit**

```bash
git add rovo-forge/commands/jira-agent.md rovo-forge/commands/confluence-agent.md
git commit -m "fix(rovo-forge): delegate Phase 11 to forge-lib instead of direct file writes

Both commands now use forge agent create for persistence instead of
writing files directly. Includes JSON response parsing and error handling.
Fixes audit finding C1 (R1 violation)."
```

---

### Task 19: Update CLAUDE.md and forge-lib README for agent subcommand

**Files:**
- Modify: `CLAUDE.md`
- Modify: `forge-lib/README.md`

**Step 1: Add rovo-forge data location to CLAUDE.md plugin table**

In the CLAUDE.md plugins table, update the rovo-forge row's "Primary Commands" column if needed, and confirm the Data Location shows `rovo-agents/` + `rovo-agents/index.json`.

**Step 2: Add agent to forge-lib README CLI Command Groups**

Add to the list:
```markdown
8. **agent** — Rovo agent configuration management
```

**Step 3: Add Agent Commands section**

Add a new section documenting the agent commands (create, get, query, update) with syntax examples following the pattern of existing command documentation.

**Step 4: Commit**

```bash
git add CLAUDE.md forge-lib/README.md
git commit -m "docs: add agent subcommand to CLAUDE.md and forge-lib README

Documents the new forge agent CLI commands for rovo-forge integration."
```

---

## Phase 5: Forge-Memory Knowledge CRUD

This phase extends forge-memory's forge-lib integration from taxonomy-only to include knowledge entry CRUD operations (people, projects, glossary). This is the largest remediation effort.

**Note:** This phase can run in parallel with Phase 4 since they modify different files.

---

### Task 20: Write failing tests for memory knowledge operations

**Files:**
- Create: `forge-lib/tests/test_memory_knowledge.py`

**Step 1: Write tests for knowledge CRUD**

```python
"""Tests for memory knowledge operations (people, projects, glossary)."""
import json
import pytest
from pathlib import Path
from datetime import date


@pytest.fixture
def temp_dir(tmp_path):
    return tmp_path


@pytest.fixture
def initialized_memory(temp_dir):
    """Initialize memory directory structure."""
    from core.memory_ops import init_memory
    init_memory(str(temp_dir))
    return temp_dir


class TestCreatePerson:

    def test_create_person(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'Jane Smith',
            'role': 'Engineering Manager',
            'team': 'Backend',
            'context': 'Reports to VP of Engineering. Owns API platform.',
        }
        result = create_knowledge_entry('person', data, directory=str(initialized_memory))
        assert result['filename'] == 'jane-smith.md'
        assert (initialized_memory / 'memory' / 'people' / 'jane-smith.md').exists()

    def test_create_person_updates_index(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'John Doe',
            'role': 'Developer',
            'team': 'Frontend',
            'context': 'Joined recently.',
        }
        create_knowledge_entry('person', data, directory=str(initialized_memory))
        index_path = initialized_memory / 'memory' / 'index.json'
        assert index_path.exists()
        index_data = json.loads(index_path.read_text())
        assert any(e['name'] == 'John Doe' for e in index_data['entries'])


class TestCreateProject:

    def test_create_project(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'name': 'API Platform',
            'description': 'Core API infrastructure serving all products.',
            'status': 'in-progress',
            'people': ['Jane Smith'],
        }
        result = create_knowledge_entry('project', data, directory=str(initialized_memory))
        assert result['filename'] == 'api-platform.md'
        assert (initialized_memory / 'memory' / 'projects' / 'api-platform.md').exists()


class TestCreateGlossaryTerm:

    def test_create_glossary_term(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry
        data = {
            'term': 'TCREI',
            'definition': 'Task, Context, Rules, Examples, Identity — Rovo agent instruction framework.',
            'context': 'Used in rovo-forge agent building.',
        }
        result = create_knowledge_entry('glossary', data, directory=str(initialized_memory))
        assert result['filename'] == 'tcrei.md'


class TestQueryKnowledge:

    def test_query_all_knowledge(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry, query_knowledge
        create_knowledge_entry('person', {
            'name': 'Alice', 'role': 'Dev', 'team': 'A', 'context': 'Test.'
        }, directory=str(initialized_memory))
        create_knowledge_entry('project', {
            'name': 'Project X', 'description': 'Test project.', 'status': 'active', 'people': []
        }, directory=str(initialized_memory))
        results = query_knowledge(directory=str(initialized_memory))
        assert len(results) >= 2

    def test_query_by_type(self, initialized_memory):
        from core.memory_ops import create_knowledge_entry, query_knowledge
        create_knowledge_entry('person', {
            'name': 'Bob', 'role': 'Dev', 'team': 'B', 'context': 'Test.'
        }, directory=str(initialized_memory))
        results = query_knowledge(directory=str(initialized_memory), filters={'type': 'person'})
        assert all(r.get('type') == 'person' for r in results)
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python -m pytest tests/test_memory_knowledge.py -v`
Expected: FAIL with `ImportError` (functions don't exist yet)

**Step 3: Commit**

```bash
git add forge-lib/tests/test_memory_knowledge.py
git commit -m "test(forge-lib): add failing tests for memory knowledge operations

Tests for create_knowledge_entry and query_knowledge covering people,
projects, and glossary entries. All tests fail pending implementation."
```

---

### Task 21: Create memory knowledge schemas

**Files:**
- Create: `forge-lib/schemas/person.json`
- Create: `forge-lib/schemas/project-memory.json`
- Create: `forge-lib/schemas/glossary.json`

**Step 1: Write person schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://forge-lib.local/schemas/person.json",
  "title": "Person",
  "description": "Schema for person entries in organizational memory",
  "type": "object",
  "required": ["name", "type", "role", "created", "updated"],
  "properties": {
    "name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "type": { "type": "string", "const": "person" },
    "role": { "type": "string", "minLength": 1 },
    "team": { "type": ["string", "null"], "default": null },
    "context": { "type": ["string", "null"], "default": null },
    "created": { "type": "string", "format": "date" },
    "updated": { "type": "string", "format": "date" }
  },
  "additionalProperties": false
}
```

**Step 2: Write project-memory schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://forge-lib.local/schemas/project-memory.json",
  "title": "Project Memory",
  "description": "Schema for project entries in organizational memory",
  "type": "object",
  "required": ["name", "type", "description", "created", "updated"],
  "properties": {
    "name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "type": { "type": "string", "const": "project" },
    "description": { "type": "string", "minLength": 1 },
    "status": { "type": "string", "enum": ["planning", "active", "in-progress", "launched", "archived"], "default": "active" },
    "people": { "type": "array", "items": { "type": "string" }, "default": [] },
    "created": { "type": "string", "format": "date" },
    "updated": { "type": "string", "format": "date" }
  },
  "additionalProperties": false
}
```

**Step 3: Write glossary schema**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://forge-lib.local/schemas/glossary.json",
  "title": "Glossary Term",
  "description": "Schema for glossary entries in organizational memory",
  "type": "object",
  "required": ["term", "type", "definition", "created", "updated"],
  "properties": {
    "term": { "type": "string", "minLength": 1, "maxLength": 200 },
    "type": { "type": "string", "const": "glossary" },
    "definition": { "type": "string", "minLength": 1 },
    "context": { "type": ["string", "null"], "default": null },
    "created": { "type": "string", "format": "date" },
    "updated": { "type": "string", "format": "date" }
  },
  "additionalProperties": false
}
```

**Step 4: Commit**

```bash
git add forge-lib/schemas/person.json forge-lib/schemas/project-memory.json forge-lib/schemas/glossary.json
git commit -m "feat(forge-lib): add schemas for memory knowledge entries

Adds JSON schemas for person, project, and glossary knowledge types."
```

---

### Task 22: Create memory knowledge templates

**Files:**
- Create: `forge-lib/templates/person.md.j2`
- Create: `forge-lib/templates/project-memory.md.j2`
- Create: `forge-lib/templates/glossary.md.j2`

**Step 1: Write person template**

```jinja2
---
name: "{{ name }}"
type: person
role: "{{ role }}"
team: {{ team if team else 'null' }}
context: {{ ('"' ~ context ~ '"') if context else 'null' }}
created: {{ created }}
updated: {{ updated }}
---

## {{ name }}

**Role:** {{ role }}
{% if team %}**Team:** {{ team }}{% endif %}

{% if context %}
## Context

{{ context }}
{% endif %}
```

**Step 2: Write project-memory template**

```jinja2
---
name: "{{ name }}"
type: project
description: "{{ description }}"
status: {{ status }}
people:
{%- if people and people|length > 0 %}
{% for person in people %}
  - "{{ person }}"
{%- endfor %}
{%- else %}
  []
{%- endif %}
created: {{ created }}
updated: {{ updated }}
---

## {{ name }}

{{ description }}

**Status:** {{ status }}

{% if people and people|length > 0 %}
## People

{% for person in people %}
- {{ person }}
{% endfor %}
{% endif %}
```

**Step 3: Write glossary template**

```jinja2
---
term: "{{ term }}"
type: glossary
definition: "{{ definition }}"
context: {{ ('"' ~ context ~ '"') if context else 'null' }}
created: {{ created }}
updated: {{ updated }}
---

## {{ term }}

{{ definition }}

{% if context %}
**Used in:** {{ context }}
{% endif %}
```

**Step 4: Commit**

```bash
git add forge-lib/templates/person.md.j2 forge-lib/templates/project-memory.md.j2 forge-lib/templates/glossary.md.j2
git commit -m "feat(forge-lib): add Jinja2 templates for memory knowledge entries

Adds templates for person, project, and glossary knowledge types."
```

---

### Task 23: Implement knowledge CRUD in memory_ops.py

**Files:**
- Modify: `forge-lib/core/memory_ops.py`

**Step 1: Read the existing memory_ops.py**

Read the full file to understand current structure and find where to add new functions.

**Step 2: Add knowledge entry functions**

Add these functions to memory_ops.py:

```python
# Knowledge entry type mappings
KNOWLEDGE_TYPES = {
    'person': {'directory': 'people', 'schema': 'person', 'template': 'person', 'name_field': 'name'},
    'project': {'directory': 'projects', 'schema': 'project-memory', 'template': 'project-memory', 'name_field': 'name'},
    'glossary': {'directory': 'glossary', 'schema': 'glossary', 'template': 'glossary', 'name_field': 'term'},
}


def create_knowledge_entry(entry_type, data, directory='.'):
    """Create a new knowledge entry (person, project, or glossary term).

    Args:
        entry_type: Type of knowledge entry ('person', 'project', 'glossary')
        data: Entry data dictionary
        directory: Base directory

    Returns:
        Dictionary with entry metadata
    """
    if entry_type not in KNOWLEDGE_TYPES:
        raise MemoryError(f"Unknown knowledge type: {entry_type}. Valid types: {list(KNOWLEDGE_TYPES.keys())}")

    config = KNOWLEDGE_TYPES[entry_type]
    today = date.today().strftime('%Y-%m-%d')

    # Set defaults
    data['type'] = entry_type
    if 'created' not in data:
        data['created'] = today
    if 'updated' not in data:
        data['updated'] = today

    # Validate
    try:
        validator.validate(data, config['schema'])
    except Exception as e:
        raise validator.ValidationError(str(e))

    # Generate filename from name/term field
    name_value = data[config['name_field']]
    slug_module = __import__('core.slug', fromlist=['generate_slug'])
    filename_slug = slug_module.generate_slug(name_value)
    filename = f"{filename_slug}.md"

    # Create directory
    memory_dir = Path(directory) / 'memory'
    entry_dir = memory_dir / config['directory']
    entry_dir.mkdir(parents=True, exist_ok=True)

    filepath = entry_dir / filename
    if filepath.exists():
        raise MemoryError(f"Knowledge entry already exists: {filepath}")

    # Render template
    core_dir = Path(__file__).parent
    templates_dir = core_dir.parent / 'templates'
    template_loader = jinja2.FileSystemLoader(str(templates_dir))
    template_env = jinja2.Environment(loader=template_loader)
    template = template_env.get_template(f'{config["template"]}.md.j2')
    content = template.render(**data)

    filepath.write_text(content)

    # Update index
    memory_index_dir = memory_dir
    try:
        entry = {
            'file': f'{config["directory"]}/{filename}',
            'type': entry_type,
            'name': name_value,
            'created': data['created'],
            'updated': data['updated'],
        }
        index_ops.create_index_entry(str(memory_index_dir), entry)
    except Exception:
        pass  # Non-fatal

    return {
        'filename': filename,
        'filepath': str(filepath),
        'type': entry_type,
        'name': name_value,
        'created': data['created'],
        'updated': data['updated'],
    }


def query_knowledge(directory='.', filters=None):
    """Query knowledge entries from the memory index.

    Args:
        directory: Base directory
        filters: Optional filters (type, etc.)

    Returns:
        List of matching knowledge entries
    """
    memory_dir = Path(directory) / 'memory'
    try:
        return index_ops.query_index(str(memory_dir), filters=filters)
    except Exception:
        return []
```

**Step 3: Add necessary imports at the top of memory_ops.py**

Ensure `jinja2`, `index_ops`, `validator`, and `date` are imported.

**Step 4: Run tests**

Run: `cd forge-lib && python -m pytest tests/test_memory_knowledge.py -v`
Expected: All tests PASS.

**Step 5: Run full test suite**

Run: `cd forge-lib && python -m pytest tests/ -v`
Expected: All tests PASS (no regressions).

**Step 6: Commit**

```bash
git add forge-lib/core/memory_ops.py
git commit -m "feat(forge-lib): add knowledge CRUD to memory_ops

Implements create_knowledge_entry and query_knowledge for people,
projects, and glossary entries. Fixes audit finding C2 (R1 violation)."
```

---

### Task 24: Register memory knowledge subcommands in forge.py

**Files:**
- Modify: `forge-lib/forge.py`

**Step 1: Add handler functions for knowledge operations**

Add after existing memory handlers:

```python
def handle_memory_create_knowledge(args):
    """Create a new knowledge entry."""
    try:
        data = json.loads(args.data) if args.data else {}
        if args.name:
            name_field = 'term' if args.type == 'glossary' else 'name'
            data[name_field] = args.name
        result = memory_ops.create_knowledge_entry(args.type, data, directory=args.directory)
        output_json(result)
    except validator.ValidationError as e:
        output_json(None, success=False, error=f"Validation error: {e}")
        sys.exit(EXIT_VALIDATION_ERROR)
    except memory_ops.MemoryError as e:
        output_json(None, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)


def handle_memory_query_knowledge(args):
    """Query knowledge entries."""
    try:
        filters = {}
        if args.type:
            filters['type'] = args.type
        results = memory_ops.query_knowledge(directory=args.directory, filters=filters)
        output_json(results)
    except Exception as e:
        output_json(None, success=False, error=f"Unexpected error: {e}")
        sys.exit(EXIT_ERROR)
```

**Step 2: Register the parsers**

Add to the memory subparsers:

```python
# memory create-knowledge
mem_create_knowledge = memory_subparsers.add_parser('create-knowledge', help='Create a knowledge entry')
mem_create_knowledge.add_argument('type', choices=['person', 'project', 'glossary'], help='Knowledge type')
mem_create_knowledge.add_argument('name', nargs='?', help='Entry name (or term for glossary)')
mem_create_knowledge.add_argument('--data', help='Additional data as JSON')
mem_create_knowledge.add_argument('--directory', default='.', help='Base directory')
mem_create_knowledge.set_defaults(func=handle_memory_create_knowledge)

# memory query-knowledge
mem_query_knowledge = memory_subparsers.add_parser('query-knowledge', help='Query knowledge entries')
mem_query_knowledge.add_argument('--type', choices=['person', 'project', 'glossary'], help='Filter by type')
mem_query_knowledge.add_argument('--directory', default='.', help='Base directory')
mem_query_knowledge.set_defaults(func=handle_memory_query_knowledge)
```

**Step 3: Verify**

Run: `cd forge-lib && python forge.py memory create-knowledge --help`
Expected: Shows help for create-knowledge subcommand.

**Step 4: Commit**

```bash
git add forge-lib/forge.py
git commit -m "feat(forge-lib): register memory knowledge subcommands in CLI

Adds create-knowledge and query-knowledge operations for people,
projects, and glossary entries."
```

---

### Task 25: Update forge-memory commands to delegate to forge-lib

**Files:**
- Modify: `forge-memory/commands/remember.md`
- Modify: `forge-memory/commands/recall.md`

**Step 1: Update remember.md Phase 3**

Replace the direct file creation instructions in Phase 3 with forge-lib delegation:

```markdown
### Phase 3: Save to Memory via forge-lib

**For a Person:**
```bash
forge memory create-knowledge person "{Name}" \
  --data '{"role": "{role}", "team": "{team}", "context": "{context}"}'
```

**For a Project:**
```bash
forge memory create-knowledge project "{Name}" \
  --data '{"description": "{description}", "status": "{status}", "people": ["{person1}"]}'
```

**For a Term:**
```bash
forge memory create-knowledge glossary "{Term}" \
  --data '{"definition": "{definition}", "context": "{context}"}'
```

### Parse forge-lib Response

```json
{
  "success": true,
  "data": {
    "filename": "jane-smith.md",
    "filepath": "memory/people/jane-smith.md",
    "type": "person",
    "name": "Jane Smith"
  }
}
```

### Error Handling

If forge-lib returns an error:
```
Error saving memory entry: {error message}
```
```

**Step 2: Remove the note about direct file creation**

Remove lines like: "Creates markdown files directly (not via forge-lib in v2.0.0)" and "Knowledge file operations are direct markdown creation in v2.0.0."

**Step 3: Update recall.md to use forge-lib query**

Update the recall command to use `forge memory query-knowledge` for searching.

**Step 4: Commit**

```bash
git add forge-memory/commands/remember.md forge-memory/commands/recall.md
git commit -m "fix(forge-memory): delegate knowledge operations to forge-lib

Remember and recall commands now use forge memory create-knowledge and
query-knowledge instead of direct file creation. Fixes audit finding C2
(R1/R6 violations)."
```

---

## Summary

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|-------------|
| **Phase 1: Quick Fixes** | Tasks 1-6 | Low | None |
| **Phase 2: Naming Fix** | Task 7 | Medium | Phase 1 |
| **Phase 3: Error Handling** | Tasks 8-12 | Medium | Phase 1 |
| **Phase 4: Rovo-Forge Integration** | Tasks 13-19 | High | Phase 1 |
| **Phase 5: Memory Knowledge CRUD** | Tasks 20-25 | High | Phase 1 |

**Total:** 25 tasks across 5 phases.

**Expected audit improvement:** From 42/72 PASS (58%) to ~65/72 PASS (90%+). The remaining items (M2 cross-plugin frontmatter standardization, M3 README template standardization) are deferred as they require a marketplace-wide convention decision.
