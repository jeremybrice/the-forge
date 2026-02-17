# slack-forge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the slack-forge plugin — a Slack intelligence harvester that scans channels for tasks, knowledge, and JIRA activity, creating review-first harvest records in the standard forge pattern.

**Architecture:** Four plugin commands (init, scan, review, promote) backed by a new `harvest_ops.py` module in forge-lib. The scan command orchestrates three sequential sub-agents via skills. Data stored as markdown with YAML frontmatter in `slack-forge/` data directory with `index.json`.

**Tech Stack:** Python (forge-lib), Jinja2 templates, JSON Schema validation, Claude AI Slack MCP tools, Tauri/JS (forge-shell view controller)

**Design Doc:** `docs/plans/2026-02-17-slack-forge-design.md`

---

## Task 1: Create harvest JSON Schema

**Files:**
- Create: `forge-lib/schemas/harvest.json`

**Step 1: Write the schema file**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://theforge.dev/schemas/harvest.json",
  "title": "Harvest Record Schema",
  "description": "JSON Schema for slack-forge harvest records (tasks, knowledge, JIRA digests)",
  "type": "object",
  "required": ["title", "type", "harvest_type", "status", "source_channel", "source_channel_id", "scan_timeframe", "scan_date", "confidence", "created", "updated"],
  "properties": {
    "title": {
      "type": "string",
      "description": "Extracted title or summary of the harvest item",
      "minLength": 1,
      "maxLength": 300
    },
    "type": {
      "type": "string",
      "const": "harvest",
      "description": "Entity type identifier"
    },
    "harvest_type": {
      "type": "string",
      "enum": ["task", "knowledge", "jira-digest"],
      "description": "Type of harvested content"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "approved", "rejected", "promoted"],
      "description": "Review workflow status"
    },
    "source_channel": {
      "type": "string",
      "description": "Slack channel name where content was found",
      "minLength": 1
    },
    "source_channel_id": {
      "type": "string",
      "description": "Slack channel ID",
      "minLength": 1
    },
    "source_timestamp": {
      "type": ["string", "null"],
      "description": "ISO 8601 timestamp of the source message",
      "default": null
    },
    "source_author": {
      "type": ["string", "null"],
      "description": "Slack username of the message author",
      "default": null
    },
    "scan_timeframe": {
      "type": "string",
      "enum": ["24h", "72h", "1w", "custom"],
      "description": "Time window used for this scan"
    },
    "scan_date": {
      "type": "string",
      "format": "date",
      "description": "Date the scan was performed"
    },
    "confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Extraction confidence level"
    },
    "tags": {
      "type": "array",
      "description": "Tags for categorization",
      "items": { "type": "string" },
      "default": []
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

**Step 2: Verify schema is valid JSON**

Run: `cd forge-lib && python -c "import json; json.load(open('schemas/harvest.json')); print('Valid JSON')"`
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add forge-lib/schemas/harvest.json
git commit -m "feat(forge-lib): add harvest JSON schema for slack-forge"
```

---

## Task 2: Create harvest Jinja2 template

**Files:**
- Create: `forge-lib/templates/harvest.md.j2`
- Reference: `forge-lib/templates/task.md.j2` (pattern to follow)

**Step 1: Write the template file**

```jinja2
---
title: "{{ title }}"
type: harvest
harvest_type: {{ harvest_type }}
status: {{ status }}
source_channel: "{{ source_channel }}"
source_channel_id: "{{ source_channel_id }}"
source_timestamp: {{ source_timestamp if source_timestamp else 'null' }}
source_author: {{ source_author if source_author else 'null' }}
scan_timeframe: {{ scan_timeframe }}
scan_date: {{ scan_date }}
confidence: {{ confidence }}
tags:
{%- if tags and tags|length > 0 %}
{% for tag in tags %}
  - {{ tag }}
{%- endfor %}
{%- else %}
  []
{%- endif %}
created: {{ created }}
updated: {{ updated }}
---

## Extracted Content

{{ content if content else 'No content extracted.' }}

{% if source_context -%}
## Source Context

{{ source_context }}
{% endif %}

{% if action_items and action_items|length > 0 -%}
## Action Items

{%- for item in action_items %}
- {{ item }}
{%- endfor %}
{% endif %}

{% if jira_events and jira_events|length > 0 -%}
## JIRA Events

{%- for event in jira_events %}
- **{{ event.ticket }}** — {{ event.event_type }}: {{ event.summary }}{% if event.needs_action %} *(action needed)*{% endif %}
{%- endfor %}
{% endif %}
```

**Step 2: Verify template renders**

Run: `cd forge-lib && python -c "import jinja2; env = jinja2.Environment(loader=jinja2.FileSystemLoader('templates')); t = env.get_template('harvest.md.j2'); print(t.render(title='Test', type='harvest', harvest_type='task', status='pending', source_channel='engineering', source_channel_id='C01', scan_timeframe='24h', scan_date='2026-02-17', confidence='high', tags=[], created='2026-02-17', updated='2026-02-17')[:100])"`
Expected: First 100 chars of rendered template starting with `---`

**Step 3: Commit**

```bash
git add forge-lib/templates/harvest.md.j2
git commit -m "feat(forge-lib): add harvest Jinja2 template for slack-forge"
```

---

## Task 3: Create harvest_ops.py core module

**Files:**
- Create: `forge-lib/core/harvest_ops.py`
- Reference: `forge-lib/core/task_ops.py` (primary pattern — init, create, get, query, update)

This is the largest task. Follow the exact patterns from `task_ops.py`.

**Step 1: Write harvest_ops.py**

The module needs these functions, mirroring `task_ops.py`:

1. `HarvestError` exception class (like `TaskError` at task_ops.py:18-20)
2. `VALID_STATUS_TRANSITIONS` dict (pending→approved|rejected, approved→promoted)
3. `_normalize_dates()` (copy from task_ops.py:35-55)
4. `_get_harvest_directory()` → returns `Path(directory) / 'slack-forge'`
5. `_generate_harvest_filename(directory, harvest_type)` — scans for `YYYY-MM-DD-{harvest_type}-NNN.md`, returns next sequential
6. `_load_template()` — loads `harvest.md.j2` (copy pattern from task_ops.py:99-123)
7. `_validate_status_transition()` (copy pattern from task_ops.py:126-138)
8. `harvest_init(directory)` — creates `slack-forge/` dir (pattern: task_ops.py:141-174)
9. `create_harvest(data, directory, validate=True)` — creates harvest record (pattern: task_ops.py:177-302)
10. `get_harvest(filename, directory)` — reads harvest file (pattern: task_ops.py:305-336)
11. `query_harvests(filters, directory)` — queries index (pattern: task_ops.py:338-395)
12. `update_harvest(filename, updates, directory, validate=True)` — updates harvest (pattern: task_ops.py:419-531)
13. `get_config(directory)` — reads `slack-forge/config.json`
14. `set_config(directory, config_data)` — writes `slack-forge/config.json`

Key differences from task_ops.py:
- Directory is `slack-forge/` not `tasks/`
- Filename pattern is `YYYY-MM-DD-{harvest_type}-NNN.md` not `task-NNN.md`
- Schema name is `'harvest'` not `'task'`
- Status values are `pending/approved/rejected/promoted` not `Open/In Progress/etc.`
- Config file management (get_config/set_config) is new — tasks don't have this

**Step 2: Run basic import test**

Run: `cd forge-lib && python -c "from core import harvest_ops; print('Import OK')"`
Expected: `Import OK`

**Step 3: Commit**

```bash
git add forge-lib/core/harvest_ops.py
git commit -m "feat(forge-lib): add harvest_ops module for slack-forge CRUD"
```

---

## Task 4: Register harvest commands in forge.py

**Files:**
- Modify: `forge-lib/forge.py:24` (add import)
- Modify: `forge-lib/forge.py:33` (add error import)
- Modify: `forge-lib/forge.py:534-535` (add handler functions, after handle_report_update)
- Modify: `forge-lib/forge.py:961-962` (add subparser, after report section, before index section)

**Step 1: Add imports at forge.py:24 and forge.py:33**

At line 24, add `harvest_ops` to the import:
```python
from core import card_ops, index_ops, relationship_ops, memory_ops, task_ops, session_ops, report_ops, agent_ops, harvest_ops, frontmatter
```

At line 33, add:
```python
from core.harvest_ops import HarvestError
```

**Step 2: Add handler functions after line 533 (after handle_report_update)**

Add these handlers following the exact pattern of handle_task_* (forge.py:176-245):

```python
def handle_harvest_init(args):
    """Initialize slack-forge directory structure"""
    try:
        result = harvest_ops.harvest_init(directory=args.directory)
        output_json(result, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_create(args):
    """Create a new harvest record"""
    try:
        data = json.loads(args.data) if args.data else {}
        data['title'] = args.title
        if args.harvest_type:
            data['harvest_type'] = args.harvest_type
        result = harvest_ops.create_harvest(data, directory=args.directory)
        output_json(result, success=True)
    except (HarvestError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_get(args):
    """Get a harvest record by filename"""
    try:
        result = harvest_ops.get_harvest(args.filename, directory=args.directory)
        output_json(result, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_NOT_FOUND)


def handle_harvest_query(args):
    """Query harvest records with filters"""
    try:
        filters = {}
        if args.status:
            filters['status'] = args.status
        if args.harvest_type:
            filters['harvest_type'] = args.harvest_type
        result = harvest_ops.query_harvests(filters if filters else None, directory=args.directory)
        output_json({"harvests": result}, success=True)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_update(args):
    """Update a harvest record"""
    try:
        updates = json.loads(args.data)
        result = harvest_ops.update_harvest(args.filename, updates, directory=args.directory)
        output_json(result, success=True)
    except (HarvestError, ValidationError) as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_VALIDATION_ERROR if isinstance(e, ValidationError) else EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON data: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)


def handle_harvest_config(args):
    """Get or set slack-forge channel config"""
    try:
        if args.get:
            result = harvest_ops.get_config(directory=args.directory)
            output_json(result, success=True)
        elif args.set_channels:
            channels = json.loads(args.set_channels)
            config = harvest_ops.get_config(directory=args.directory)
            config['channels'] = channels
            harvest_ops.set_config(args.directory, config)
            output_json({"message": "Channels updated", "count": len(channels)}, success=True)
        elif args.set_jira_channel:
            config = harvest_ops.get_config(directory=args.directory)
            config['jira_channel'] = args.set_jira_channel
            harvest_ops.set_config(args.directory, config)
            output_json({"message": "JIRA channel set", "channel": args.set_jira_channel}, success=True)
        else:
            output_json(None, success=False, error="Must specify --get, --set-channels, or --set-jira-channel")
            sys.exit(EXIT_ERROR)
    except HarvestError as e:
        output_json({"error": str(e)}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
    except json.JSONDecodeError as e:
        output_json({"error": f"Invalid JSON: {e}"}, success=False, error=str(e))
        sys.exit(EXIT_ERROR)
```

**Step 3: Add subparser after line 961 (after report section, before index section)**

Insert before the `# ==================== INDEX COMMANDS ====================` line:

```python
    # ==================== HARVEST COMMANDS ====================
    harvest_parser = subparsers.add_parser("harvest", help="Harvest operations (slack-forge)")
    harvest_subparsers = harvest_parser.add_subparsers(dest="harvest_command", required=True)

    # harvest init
    harvest_init = harvest_subparsers.add_parser("init", help="Initialize slack-forge directory")
    harvest_init.add_argument("--directory", default=".", help="Target directory")
    harvest_init.set_defaults(func=handle_harvest_init)

    # harvest create
    harvest_create = harvest_subparsers.add_parser("create", help="Create a harvest record")
    harvest_create.add_argument("title", help="Harvest item title")
    harvest_create.add_argument("--harvest-type", dest="harvest_type", required=True,
                                choices=["task", "knowledge", "jira-digest"], help="Type of harvest")
    harvest_create.add_argument("--directory", default=".", help="Target directory")
    harvest_create.add_argument("--data", help="JSON harvest data")
    harvest_create.set_defaults(func=handle_harvest_create)

    # harvest get
    harvest_get = harvest_subparsers.add_parser("get", help="Get a harvest record by filename")
    harvest_get.add_argument("filename", help="Harvest filename")
    harvest_get.add_argument("--directory", default=".", help="Target directory")
    harvest_get.set_defaults(func=handle_harvest_get)

    # harvest query
    harvest_query = harvest_subparsers.add_parser("query", help="Query harvest records")
    harvest_query.add_argument("--directory", default=".", help="Target directory")
    harvest_query.add_argument("--status", choices=["pending", "approved", "rejected", "promoted"],
                               help="Filter by status")
    harvest_query.add_argument("--harvest-type", dest="harvest_type",
                               choices=["task", "knowledge", "jira-digest"], help="Filter by harvest type")
    harvest_query.set_defaults(func=handle_harvest_query)

    # harvest update
    harvest_update = harvest_subparsers.add_parser("update", help="Update a harvest record")
    harvest_update.add_argument("filename", help="Harvest filename")
    harvest_update.add_argument("--directory", default=".", help="Target directory")
    harvest_update.add_argument("--data", required=True, help="JSON update data")
    harvest_update.set_defaults(func=handle_harvest_update)

    # harvest config
    harvest_config = harvest_subparsers.add_parser("config", help="Manage channel config")
    harvest_config.add_argument("--directory", default=".", help="Target directory")
    harvest_config_group = harvest_config.add_mutually_exclusive_group(required=True)
    harvest_config_group.add_argument("--get", action="store_true", help="Get current config")
    harvest_config_group.add_argument("--set-channels", dest="set_channels", help="Set channels JSON array")
    harvest_config_group.add_argument("--set-jira-channel", dest="set_jira_channel", help="Set JIRA bot channel ID")
    harvest_config.set_defaults(func=handle_harvest_config)
```

**Step 4: Add 'harvest' to SUPPORTED_SCHEMAS in validator.py**

Modify `forge-lib/core/validator.py:180-191` — add `"harvest"` to the SUPPORTED_SCHEMAS list.

**Step 5: Verify CLI registration**

Run: `cd forge-lib && python forge.py harvest --help`
Expected: Help output showing init, create, get, query, update, config subcommands

**Step 6: Commit**

```bash
git add forge-lib/forge.py forge-lib/core/validator.py
git commit -m "feat(forge-lib): register harvest CLI commands in forge.py"
```

---

## Task 5: Create slack-forge plugin structure

**Files:**
- Create: `slack-forge/.claude-plugin/plugin.json`
- Create: `slack-forge/README.md`

**Step 1: Write plugin.json**

Pattern: `tasks-forge/.claude-plugin/plugin.json`

```json
{
  "name": "slack-forge",
  "version": "2.0.0-alpha",
  "description": "Slack intelligence harvester — scans channels for tasks, knowledge, and JIRA activity. Creates review-first harvest records. Delegates all file operations to forge-lib.",
  "author": { "name": "Jeremy Brice" }
}
```

**Step 2: Write README.md**

Follow the pattern of `tasks-forge/README.md`. Cover:
- Overview (Slack intelligence harvester, review-first model)
- Commands table (init, scan, review, promote)
- Scan orchestration flow (3 sequential sub-agents)
- Data model (harvest records, config.json)
- File naming patterns
- forge-lib CLI commands
- Workflow example (init → scan → review → promote)
- Time frame options

**Step 3: Commit**

```bash
git add slack-forge/.claude-plugin/plugin.json slack-forge/README.md
git commit -m "feat(slack-forge): create plugin structure with metadata and README"
```

---

## Task 6: Write init command

**Files:**
- Create: `slack-forge/commands/init.md`
- Reference: `tasks-forge/commands/start.md` (pattern — 92 lines)

**Step 1: Write init.md**

The command should instruct the LLM to:

1. Check if `slack-forge/` directory exists. If exists, load existing config and offer to update.
2. Run `forge harvest init` to create directory.
3. Use `slack_search_channels` MCP tool to discover all accessible channels.
4. Use `slack_search_users` MCP tool to discover DMs.
5. Present the full channel list organized by type (public, private, DMs).
6. Let user select which channels to monitor (multi-select).
7. Ask user to identify the JIRA bot feed channel.
8. Save config via `forge harvest config --set-channels '[...]'` and `forge harvest config --set-jira-channel "..."`.
9. Confirm setup with channel count and next steps.

Keep it to ~80-100 lines following the numbered section pattern from `tasks-forge/commands/add.md`.

**Step 2: Commit**

```bash
git add slack-forge/commands/init.md
git commit -m "feat(slack-forge): add init command for channel discovery and config"
```

---

## Task 7: Write scan command (orchestrator)

**Files:**
- Create: `slack-forge/commands/scan.md`

**Step 1: Write scan.md**

This is the most complex command. It orchestrates three sequential sub-agents. The command should instruct the LLM to:

1. Check prerequisites: `slack-forge/` exists, config.json exists with channels.
2. Ask user for time frame: 24h / 72h / 1 week / custom date.
3. Calculate cutoff timestamp from current system time.
4. Load config via `forge harvest config --get`.
5. Extract monitored channels (all `monitor: true` except `role: "jira"`).
6. Extract JIRA channel (the one with `role: "jira"` or `jira_channel` field).
7. **Agent 1: Task Harvester** — Instruct the LLM to:
   - Read each monitored channel via `slack_read_channel` MCP tool with the time window
   - Apply the `task-harvester` skill reasoning to identify potential tasks
   - For each task found, run `forge harvest create "title" --harvest-type task --data '{...}'`
   - Report count of tasks found
8. **Agent 2: Knowledge Harvester** — Same pattern with `knowledge-harvester` skill
9. **Agent 3: JIRA Digest** — Read JIRA channel, apply `jira-digest` skill, create one `jira-digest` record
10. Present unified summary with counts and prompt user to run `/slack-forge:review`.

**Step 2: Commit**

```bash
git add slack-forge/commands/scan.md
git commit -m "feat(slack-forge): add scan command with sequential sub-agent orchestration"
```

---

## Task 8: Write review command

**Files:**
- Create: `slack-forge/commands/review.md`

**Step 1: Write review.md**

The command should instruct the LLM to:

1. Query pending harvests: `forge harvest query --status pending`
2. If no pending items, inform user and exit.
3. Group items by harvest_type (tasks, knowledge, JIRA digests).
4. Present items one at a time or in batches, showing:
   - Title, harvest_type, source_channel, source_author, confidence
   - Extracted content preview
5. For each item, ask: Approve / Reject / Edit / Skip
   - Approve: `forge harvest update {filename} --data '{"status": "approved"}'`
   - Reject: `forge harvest update {filename} --data '{"status": "rejected"}'`
   - Edit: Let user modify title/content, then approve
   - Skip: Move to next (stays pending)
6. After all items reviewed, show summary (X approved, Y rejected, Z skipped).
7. If any approved, prompt user to run `/slack-forge:promote`.

**Step 2: Commit**

```bash
git add slack-forge/commands/review.md
git commit -m "feat(slack-forge): add review command for harvest curation"
```

---

## Task 9: Write promote command

**Files:**
- Create: `slack-forge/commands/promote.md`

**Step 1: Write promote.md**

The command should instruct the LLM to:

1. Query approved harvests: `forge harvest query --status approved`
2. If no approved items, inform user and exit.
3. For each approved item, route by harvest_type:
   - **task**: Map fields → run `forge task create "title" --data '{...}'`
   - **knowledge**: Determine memory type (person/project/glossary) → run `forge memory create-knowledge {type} "name" --data '{...}'`
   - **jira-digest**: No promotion needed — digests are informational. Mark as promoted directly.
4. After each successful promotion, mark as promoted: `forge harvest update {filename} --data '{"status": "promoted"}'`
5. Show summary of promoted items with links to created tasks/memory entries.

**Step 2: Commit**

```bash
git add slack-forge/commands/promote.md
git commit -m "feat(slack-forge): add promote command for cross-plugin routing"
```

---

## Task 10: Write sub-agent skills

**Files:**
- Create: `slack-forge/skills/task-harvester/SKILL.md`
- Create: `slack-forge/skills/knowledge-harvester/SKILL.md`
- Create: `slack-forge/skills/jira-digest/SKILL.md`

**Step 1: Write task-harvester skill**

Pure reasoning guidance covering:
- What constitutes a task in Slack conversation (direct asks, commitments, deadlines, "can you...", "we need to...")
- Distinguishing real tasks from casual conversation
- Confidence scoring criteria (high/medium/low)
- How to attribute tasks (who asked, who's responsible)
- Clean title extraction from conversational context
- Deduplication logic (same task mentioned in multiple channels)

**Step 2: Write knowledge-harvester skill**

Pure reasoning guidance covering:
- What constitutes preservable organizational knowledge
- Mapping to forge-memory types: person (new info), project (updates), glossary (terms/acronyms), general (decisions)
- When to update existing memory vs create new
- Confidence scoring criteria
- Noise filtering (social chat, off-topic, repetitive standups)

**Step 3: Write jira-digest skill**

Pure reasoning guidance covering:
- JIRA bot message pattern recognition (assignments, transitions, comments, mentions)
- Grouping events by ticket
- Identifying actionable vs informational events
- Structured item extraction format
- Summary writing approach (chronological, highlight action-needed items)

**Step 4: Commit**

```bash
git add slack-forge/skills/
git commit -m "feat(slack-forge): add task-harvester, knowledge-harvester, and jira-digest skills"
```

---

## Task 11: Create forge-shell view controller

**Files:**
- Create: `forge-shell/app/js/slack-forge.js`
- Modify: `forge-shell/app/js/shell.js:17-18` (add plugin entry)

**Step 1: Write slack-forge.js**

Follow the exact pattern of `forge-shell/app/js/tasks.js`:

- IIFE module pattern: `window.SlackForgeView = (function() { ... })();`
- State: `rootHandle`, `initialized`, `harvestDirHandle`, `harvests[]`
- DOM helpers scoped to `#view-slack-forge`
- `scaffold()` — builds toolbar (title, filter dropdowns, refresh button) + harvest cards area + status bar
- `parseHarvestFiles()` — scans `slack-forge/` via ForgeFS, filters for `*-harvest-*.md` and `*-digest-*.md` patterns, parses YAML frontmatter
- `renderHarvests()` — status count bar at top (pending/approved/promoted/rejected), filter by harvest_type and status, card list
- `createHarvestCard(harvest)` — shows title, harvest_type badge, source_channel, confidence pill, source_author
- `init(handle)` / `destroy()` / `refresh()` public API
- Register: `Shell.registerController('slack-forge', window.SlackForgeView);`

**Step 2: Add plugin entry in shell.js**

At line 17 (after report-forge entry), add:
```js
{ id: 'slack-forge', label: 'Slack Forge', icon: 'fa-brands fa-slack', requiredDir: 'slack-forge' },
```

**Step 3: Add view container in index.html**

Check `forge-shell/app/index.html` for the view containers pattern. Add:
```html
<div id="view-slack-forge" class="shell-view"></div>
```

**Step 4: Add script tag in index.html**

Add `<script src="js/slack-forge.js"></script>` alongside the other view controller scripts.

**Step 5: Commit**

```bash
git add forge-shell/app/js/slack-forge.js forge-shell/app/js/shell.js forge-shell/app/index.html
git commit -m "feat(forge-shell): add slack-forge view controller and dashboard"
```

---

## Task 12: Update CLAUDE.md with slack-forge

**Files:**
- Modify: `CLAUDE.md` (add slack-forge to plugins table, file naming patterns, architecture notes)

**Step 1: Add to plugins table**

Add row:
```
| **slack-forge** | `/slack-forge:init`, `/slack-forge:scan`, `/slack-forge:review`, `/slack-forge:promote` | `slack-forge/` + `slack-forge/index.json` + `slack-forge/config.json` |
```

**Step 2: Add to file naming patterns table**

Add row:
```
| Harvest | `YYYY-MM-DD-{harvest_type}-NNN.md` | `2026-02-17-task-harvest-001.md` |
```

**Step 3: Add to forge-shell view controllers**

Add:
```
- `slack-forge.js` — Harvest dashboard with review workflow
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add slack-forge to CLAUDE.md plugins table and file patterns"
```

---

## Task 13: End-to-end integration test

**Files:** No new files — manual verification

**Step 1: Test forge-lib CLI**

```bash
cd forge-lib

# Init
python forge.py harvest init --directory /tmp/test-forge

# Create harvest records
python forge.py harvest create "Review API auth" --harvest-type task --directory /tmp/test-forge --data '{"source_channel": "engineering", "source_channel_id": "C01", "scan_timeframe": "24h", "confidence": "high"}'

python forge.py harvest create "PSR process update" --harvest-type knowledge --directory /tmp/test-forge --data '{"source_channel": "product-team", "source_channel_id": "C02", "scan_timeframe": "72h", "confidence": "medium"}'

# Query
python forge.py harvest query --directory /tmp/test-forge --status pending
python forge.py harvest query --directory /tmp/test-forge --harvest-type task

# Update status
python forge.py harvest update 2026-02-17-task-harvest-001.md --directory /tmp/test-forge --data '{"status": "approved"}'

# Config
python forge.py harvest config --get --directory /tmp/test-forge
python forge.py harvest config --set-channels '[{"id":"C01","name":"engineering","type":"public","monitor":true}]' --directory /tmp/test-forge
python forge.py harvest config --set-jira-channel "C04" --directory /tmp/test-forge
python forge.py harvest config --get --directory /tmp/test-forge
```

Expected: All commands return `{"success": true, ...}` JSON

**Step 2: Verify files on disk**

```bash
ls /tmp/test-forge/slack-forge/
cat /tmp/test-forge/slack-forge/2026-02-17-task-harvest-001.md
cat /tmp/test-forge/slack-forge/index.json
cat /tmp/test-forge/slack-forge/config.json
```

Expected: Markdown files with correct frontmatter, index.json with entries, config.json with channels

**Step 3: Clean up**

```bash
rm -rf /tmp/test-forge
```

**Step 4: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix(forge-lib): integration test fixes for harvest operations"
```

---

## Summary

| Task | Component | Estimated Complexity |
|------|-----------|---------------------|
| 1 | Schema (harvest.json) | Small |
| 2 | Template (harvest.md.j2) | Small |
| 3 | Core module (harvest_ops.py) | Large — primary implementation |
| 4 | CLI registration (forge.py) | Medium |
| 5 | Plugin structure (plugin.json, README) | Small |
| 6 | Init command | Medium |
| 7 | Scan command (orchestrator) | Large — most complex command |
| 8 | Review command | Medium |
| 9 | Promote command | Medium |
| 10 | Sub-agent skills (3 files) | Medium |
| 11 | Forge-shell view controller | Large |
| 12 | CLAUDE.md update | Small |
| 13 | Integration test | Medium |

**Total: 13 tasks, ~15-20 new files**

Dependencies: Tasks 1-4 must be done in order (schema → template → ops → CLI). Tasks 5-10 can be done in any order after Task 4. Task 11 can be done independently. Task 12-13 should be last.
