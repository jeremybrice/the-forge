# forge-lib — Python CLI for The Forge Marketplace v2

Deterministic data layer providing file operations, validation, templating, and indexing for all Forge Marketplace plugins.

## Installation

```bash
cd forge-lib
pip install -r requirements.txt
```

**Dependencies:**
- `pyyaml` — YAML frontmatter parsing
- `jinja2` — Markdown template rendering
- `jsonschema` — Entity validation
- `pytest` (dev) — Unit testing

**Verify installation:**
```bash
python forge.py --help
```

## Architecture

```
forge-lib/
  forge.py                    ← CLI entry point (argparse)
  core/
    __init__.py
    frontmatter.py            ← parse() and dumps() for YAML frontmatter
    slug.py                   ← generate_slug() and sequential numbering
    validator.py              ← JSON Schema validation with caching
    index_ops.py              ← Index CRUD (create, read, update, rebuild)
    card_ops.py               ← Card operations for 7 types
    task_ops.py               ← Task CRUD with status state machine
    memory_ops.py             ← Taxonomy management (6 types)
    session_ops.py            ← Session creation (debates, explorations)
    report_ops.py             ← Report operations (8 types)
    relationship_ops.py       ← Bidirectional parent-child linking
  schemas/                    ← JSON Schema definitions
    initiative.json, epic.json, story.json, intake.json
    checkpoint.json, decision.json, release-note.json
    task.json, session.json, report.json
  templates/                  ← Jinja2 markdown templates
    initiative.md.j2, epic.md.j2, story.md.j2, etc.
  tests/                      ← Unit tests (124 passing)
  requirements.txt
```

## CLI Command Groups

The `forge.py` CLI has 8 command groups:

1. **card** — Product card operations (7 types)
2. **task** — Task management
3. **memory** — Organizational memory and taxonomy
4. **session** — Debate and exploration sessions
5. **report** — Report generation
6. **index** — Index management
7. **relationship** — Parent-child linking
8. **agent** — Rovo agent configuration management

## Output Format

All commands return JSON:

**Success:**
```json
{
  "success": true,
  "data": {
    "filename": "notification-system-overhaul.md",
    "title": "Notification System Overhaul",
    ...
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Validation error: 'InvalidStatus' is not one of ['Draft', 'Submitted', 'Approved', 'Superseded']"
}
```

**Exit codes:**
- `0` — Success
- `1` — General error
- `2` — Validation error
- `3` — Not found

## Card Commands

### card create

Create a new product card (initiative, epic, story, intake, checkpoint, decision, release-note).

**Syntax:**
```bash
python forge.py card create <card_type> \
  --title "Card Title" \
  --data '<JSON>' \
  [--body "Markdown content"] \
  [--parent "parent-filename.md"] \
  [--directory "path/to/cards"]
```

**Examples:**

```bash
# Create an initiative
python forge.py card create initiative \
  --title "Notification System Overhaul" \
  --data '{"status": "Draft", "product": "webapp", "priority": "P1"}' \
  --body "## Background\n\nOur current notification system..."

# Create an epic with parent
python forge.py card create epic \
  --title "Email Notification Engine" \
  --data '{"status": "Planning", "product": "webapp", "team": "Platform"}' \
  --parent "notification-system-overhaul.md"

# Create a story (sequential numbering: story-001-{slug}.md)
python forge.py card create story \
  --title "Notification Template Builder" \
  --data '{"status": "Ready", "estimate": 5}' \
  --parent "email-notification-engine.md"
```

**Card Types:**

| Type | Status Values | Filename Pattern |
|------|--------------|-----------------|
| initiative | Draft, Submitted, Approved, Superseded | `{slug}.md` |
| epic | Planning, In Progress, Complete, Cancelled | `{slug}.md` |
| story | Draft, Ready, In Progress, Done | `story-NNN-{slug}.md` |
| intake | Draft, Complete, Handed Off | `intake-{product}-{feature}.md` |
| checkpoint | Current, Superseded, Archived | `checkpoint-YYYY-MM-DD-{slug}.md` |
| decision | Active, Revised, Reversed | `{slug}.md` |
| release-note | Draft, Published, Internal Only | `release-notes-YYMMDD.md` |

### card get / query / update / init

See main README for full command reference.

## Task Commands

### task create

```bash
python forge.py task create "Implement email notification templates" \
  --data '{"priority": 2, "status": "Open", "due_date": "2026-03-01"}'
```

**Status workflow:** Open → In Progress → Completed (plus Blocked/Cancelled states)

**Priority values:** 1 (highest) through 5 (lowest)

See main README for full command reference.

## Memory Commands

### memory get-taxonomy / set-taxonomy / init

**Taxonomy types:** products, modules, systems, clients, teams, integrations

```bash
python forge.py memory get-taxonomy products
python forge.py memory set-taxonomy products --data '[...]'
```

## Session Commands

### session create

```bash
python forge.py session create debate \
  --title "API Architecture Debate" \
  --data '{"status": "Active", "agents": ["forge-challenger", "forge-synthesizer"]}'
```

**Session types:** debate, exploration

**Filename:** `YYYY-MM-DD-{slug}.md`

## Report Commands

### report create

```bash
python forge.py report create executive-summary \
  --title "Q1 2026 Performance Review" \
  --data '{"status": "Draft", "author": "Product Team"}'
```

**Report types:** executive-summary, technical-deep-dive, competitive-analysis, architecture-review, performance-analysis, incident-postmortem, quarterly-review, feasibility-study

**Filename:** `YYYY-MM-DD-{slug}.md`

## Index Commands

### index read / rebuild

```bash
python forge.py index read cards
python forge.py index rebuild cards
```

Rebuild scans all `.md` files, parses frontmatter, and regenerates `index.json`.

## Relationship Commands

### relationship link

```bash
python forge.py relationship link \
  notification-system-overhaul.md \
  email-notification-engine.md
```

Bidirectionally links parent and child (updates both `parent` field and `children` array).

## Agent Commands

```bash
# Create a new Rovo agent
forge agent create "Ticket Triage Agent" jira --data '{"description": "Triages incoming Jira tickets based on priority.", "skills": ["Search Jira Issues (JQL)"], "knowledge_sources": ["SUPPORT project"], "conversation_starters": ["Triage tickets", "Show queue", "Route ticket"], "owner": "Jeremy Brice", "collaborators": [], "visibility": "organization"}'

# Get agent by slug
forge agent get ticket-triage-agent

# Query all agents
forge agent query

# Query by platform
forge agent query --platform jira

# Query by status
forge agent query --status published

# Update an agent
forge agent update ticket-triage-agent --data '{"status": "published"}'
```

## Testing

Run the full test suite:

```bash
python -m pytest tests/ -v
```

**124 tests** covering all core modules and operations.

## Integration with Plugins

Plugins call `forge.py` via subprocess and parse JSON output.

**Example:**

```python
import subprocess
import json

result = subprocess.run([
    'python', 'forge.py', 'card', 'create', 'initiative',
    '--title', 'Notification System Overhaul',
    '--data', json.dumps({'status': 'Draft', 'product': 'webapp'})
], capture_output=True, text=True)

response = json.loads(result.stdout)

if response['success']:
    filename = response['data']['filename']
    print(f"Created: {filename}")
```

## Version

**v2.2.0** — Complete architectural rebuild with Python data layer.

## Author

Jeremy Brice
