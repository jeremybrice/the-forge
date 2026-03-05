# Outlook-Forge Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 issues from the PR #17 code review by making forge-lib's harvest/transcript infrastructure plugin-agnostic, fixing two pre-existing forge-shell JS bugs, and updating CLAUDE.md.

**Architecture:** Add `--plugin` flag (default `slack-forge`) to all harvest CLI subcommands. Extend harvest type and transcript type registries. Fix JS scope and field-name bugs in both view controllers. All changes are backwards-compatible.

**Tech Stack:** Python (forge-lib CLI), JavaScript (forge-shell Tauri app), JSON Schema

**Design Doc:** `docs/plans/2026-03-04-outlook-forge-fixes-design.md`

---

## Task 1: Extend harvest type registry

**Files:**
- Modify: `forge-lib/core/harvest_ops.py:41-45`
- Modify: `forge-lib/schemas/harvest.json:32-35`
- Modify: `forge-lib/forge.py:1270-1271` and `1287-1288`
- Test: `forge-lib/tests/test_memory_harvest.py`

**Step 1: Write failing tests**

Add to `forge-lib/tests/test_memory_harvest.py`:

```python
def test_create_harvest_meeting_prep_type(tmp_path):
    """Verify meeting-prep is a valid harvest type."""
    harvest_dir = tmp_path / 'slack-forge' / 'harvests'
    harvest_dir.mkdir(parents=True)
    data = {
        'title': 'Prepare for Architecture Review',
        'harvest_type': 'meeting-prep',
        'source_channel': 'calendar',
        'source_channel_id': 'calendar',
        'scan_timeframe': 'custom',
        'scan_date': '2026-03-04',
        'confidence': 'high',
    }
    result = harvest_ops.create_harvest(data, directory=str(tmp_path))
    assert result['harvest_type'] == 'meeting-prep'
    assert 'meeting-prep-harvest' in result['filename']


def test_create_harvest_meeting_notes_type(tmp_path):
    """Verify meeting-notes is a valid harvest type."""
    harvest_dir = tmp_path / 'slack-forge' / 'harvests'
    harvest_dir.mkdir(parents=True)
    data = {
        'title': 'Meeting notes: Architecture Review',
        'harvest_type': 'meeting-notes',
        'source_channel': 'calendar',
        'source_channel_id': 'calendar',
        'scan_timeframe': 'custom',
        'scan_date': '2026-03-04',
        'confidence': 'high',
    }
    result = harvest_ops.create_harvest(data, directory=str(tmp_path))
    assert result['harvest_type'] == 'meeting-notes'
    assert 'meeting-notes-harvest' in result['filename']
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py::test_create_harvest_meeting_prep_type tests/test_memory_harvest.py::test_create_harvest_meeting_notes_type -v`
Expected: FAIL with "Invalid harvest_type: meeting-prep"

**Step 3: Extend HARVEST_TYPE_FILENAME_MAP**

In `forge-lib/core/harvest_ops.py:41-45`, change:

```python
HARVEST_TYPE_FILENAME_MAP = {
    'task': 'task-harvest',
    'knowledge': 'knowledge-harvest',
    'jira-digest': 'jira-digest',
    'meeting-prep': 'meeting-prep-harvest',
    'meeting-notes': 'meeting-notes-harvest',
}
```

**Step 4: Extend harvest.json schema**

In `forge-lib/schemas/harvest.json:32-35`, change:

```json
"harvest_type": {
    "type": "string",
    "enum": ["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"],
    "description": "Classification of harvested content"
}
```

Also extend `scan_timeframe` enum at line 62-65 to accept outlook-forge timeframes:

```json
"scan_timeframe": {
    "type": "string",
    "description": "Time window used for the channel scan"
}
```

Remove the enum constraint entirely — timeframes are freeform strings (`24h`, `72h`, `1w`, `1d`, `3d`, `custom`, etc.).

**Step 5: Extend CLI argparse choices**

In `forge-lib/forge.py:1270-1271`, change:

```python
harvest_create.add_argument("--harvest-type", dest="harvest_type", required=True,
                            choices=["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"], help="Type of harvest")
```

In `forge-lib/forge.py:1287-1288`, change:

```python
harvest_query.add_argument("--harvest-type", dest="harvest_type",
                           choices=["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"], help="Filter by harvest type")
```

**Step 6: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py::test_create_harvest_meeting_prep_type tests/test_memory_harvest.py::test_create_harvest_meeting_notes_type -v`
Expected: PASS

**Step 7: Run full test suite**

Run: `cd forge-lib && python3 -m pytest`
Expected: All tests pass (317+ tests)

**Step 8: Commit**

```bash
git add forge-lib/core/harvest_ops.py forge-lib/schemas/harvest.json forge-lib/forge.py forge-lib/tests/test_memory_harvest.py
git commit -m "feat(forge-lib): add meeting-prep and meeting-notes harvest types"
```

---

## Task 2: Make harvest_ops plugin-agnostic

**Files:**
- Modify: `forge-lib/core/harvest_ops.py:71-92` and all functions with `directory` param
- Modify: `forge-lib/forge.py:630-704` (handlers) and `1259-1305` (subparsers)
- Test: `forge-lib/tests/test_memory_harvest.py`

**Step 1: Write failing tests**

Add to `forge-lib/tests/test_memory_harvest.py`:

```python
def test_create_harvest_with_plugin_parameter(tmp_path):
    """Verify plugin parameter routes to correct directory."""
    harvest_dir = tmp_path / 'outlook-forge' / 'harvests'
    harvest_dir.mkdir(parents=True)
    data = {
        'title': 'Submit Q2 budget estimates',
        'harvest_type': 'task',
        'source_channel': 'inbox',
        'source_channel_id': 'inbox',
        'scan_timeframe': '1d',
        'scan_date': '2026-03-04',
        'confidence': 'high',
    }
    result = harvest_ops.create_harvest(data, directory=str(tmp_path), plugin='outlook-forge')
    assert result['filename'].endswith('.md')
    # Verify file was created in outlook-forge/harvests/
    assert (harvest_dir / result['filename']).exists()


def test_query_harvests_with_plugin_parameter(tmp_path):
    """Verify query respects plugin parameter."""
    harvest_dir = tmp_path / 'outlook-forge' / 'harvests'
    harvest_dir.mkdir(parents=True)
    data = {
        'title': 'Test harvest',
        'harvest_type': 'task',
        'source_channel': 'inbox',
        'source_channel_id': 'inbox',
        'scan_timeframe': '1d',
        'scan_date': '2026-03-04',
        'confidence': 'high',
    }
    harvest_ops.create_harvest(data, directory=str(tmp_path), plugin='outlook-forge')
    results = harvest_ops.query_harvests(None, directory=str(tmp_path), plugin='outlook-forge')
    assert len(results) == 1
    assert results[0]['title'] == 'Test harvest'


def test_get_plugin_directory_default(tmp_path):
    """Verify default plugin is slack-forge."""
    from core.harvest_ops import _get_plugin_directory
    result = _get_plugin_directory(str(tmp_path))
    assert result == Path(str(tmp_path)) / 'slack-forge'


def test_get_plugin_directory_custom(tmp_path):
    """Verify custom plugin directory."""
    from core.harvest_ops import _get_plugin_directory
    result = _get_plugin_directory(str(tmp_path), plugin='outlook-forge')
    assert result == Path(str(tmp_path)) / 'outlook-forge'
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py::test_create_harvest_with_plugin_parameter tests/test_memory_harvest.py::test_get_plugin_directory_default -v`
Expected: FAIL (no `plugin` parameter, no `_get_plugin_directory`)

**Step 3: Rename directory helper and add plugin parameter**

In `forge-lib/core/harvest_ops.py`, replace lines 71-92:

```python
def _get_plugin_directory(directory: str = '.', plugin: str = 'slack-forge') -> Path:
    """Get the plugin root directory path.

    Args:
        directory: Base directory containing plugin directory
        plugin: Plugin name (default: slack-forge)

    Returns:
        Path to plugin directory
    """
    return Path(directory) / plugin


def _get_harvest_directory(directory: str = '.', plugin: str = 'slack-forge') -> Path:
    """Get the plugin harvests directory path.

    Args:
        directory: Base directory containing plugin directory
        plugin: Plugin name (default: slack-forge)

    Returns:
        Path to plugin/harvests directory
    """
    return _get_plugin_directory(directory, plugin) / 'harvests'
```

**Step 4: Add `plugin` parameter to all public functions**

Update every public function signature to include `plugin: str = 'slack-forge'` and pass it through:

- `harvest_init(directory='.', plugin='slack-forge')` — line 184
- `create_harvest(data, directory='.', plugin='slack-forge', validate=True)` — line 221
- `get_harvest(filename, directory='.', plugin='slack-forge')` — line 388
- `query_harvests(filters, directory='.', plugin='slack-forge')` — line 421
- `update_harvest(filename, updates, directory='.', plugin='slack-forge')` — line 514
- `get_config(directory='.', plugin='slack-forge')` — line 635
- `set_config(...)` — line 675

For each, find internal calls to `_get_harvest_directory(directory)` or `_get_slack_forge_directory(directory)` and change to `_get_harvest_directory(directory, plugin)` or `_get_plugin_directory(directory, plugin)`.

**Step 5: Add `--plugin` to all harvest CLI subparsers**

In `forge-lib/forge.py`, add to each harvest subparser (lines 1263-1305):

```python
# Add after each --directory argument:
parser.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
```

Add to: `harvest_init` (after line 1264), `harvest_create` (after line 1272), `harvest_get` (after line 1279), `harvest_query` (after line 1284), `harvest_update` (after line 1294), `harvest_config` (after line 1300).

**Step 6: Pass `plugin` through all handlers**

Update each handler (lines 630-704) to pass `args.plugin`:

- `handle_harvest_init`: `harvest_ops.harvest_init(directory=args.directory, plugin=args.plugin)`
- `handle_harvest_create`: `harvest_ops.create_harvest(data, directory=args.directory, plugin=args.plugin)`
- `handle_harvest_get`: `harvest_ops.get_harvest(args.filename, directory=args.directory, plugin=args.plugin)`
- `handle_harvest_query`: `harvest_ops.query_harvests(filters, directory=args.directory, plugin=args.plugin)`
- `handle_harvest_update`: `harvest_ops.update_harvest(args.filename, updates, directory=args.directory, plugin=args.plugin)`
- `handle_harvest_config`: `harvest_ops.get_config(directory=args.directory, plugin=args.plugin)` and `set_config(...)` calls

**Step 7: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_memory_harvest.py -v`
Expected: All new and existing tests pass

**Step 8: Run full test suite**

Run: `cd forge-lib && python3 -m pytest`
Expected: All tests pass (existing tests use default `plugin='slack-forge'`)

**Step 9: Commit**

```bash
git add forge-lib/core/harvest_ops.py forge-lib/forge.py forge-lib/tests/test_memory_harvest.py
git commit -m "feat(forge-lib): add --plugin flag to harvest commands for multi-plugin support"
```

---

## Task 3: Extend transcript type registry

**Files:**
- Modify: `forge-lib/core/transcript_ops.py:22-26`
- Modify: `forge-lib/forge.py:1352-1356`
- Test: `forge-lib/tests/test_transcript_ops.py`

**Step 1: Write failing tests**

Add to `forge-lib/tests/test_transcript_ops.py`:

```python
def test_generate_transcript_filename_calendar(tmp_path):
    """Verify calendar is a valid transcript type."""
    result = generate_transcript_filename(
        directory=tmp_path,
        scan_date='2026-03-04',
        timeframe='3d',
        transcript_type='calendar',
    )
    assert result == '2026-03-04-3d-calendar-001.md'


def test_generate_transcript_filename_inbox(tmp_path):
    """Verify inbox is a valid transcript type."""
    result = generate_transcript_filename(
        directory=tmp_path,
        scan_date='2026-03-04',
        timeframe='1d',
        transcript_type='inbox',
    )
    assert result == '2026-03-04-1d-inbox-001.md'


def test_generate_transcript_filename_sent(tmp_path):
    """Verify sent is a valid transcript type."""
    result = generate_transcript_filename(
        directory=tmp_path,
        scan_date='2026-03-04',
        timeframe='1d',
        transcript_type='sent',
    )
    assert result == '2026-03-04-1d-sent-001.md'


def test_generate_transcript_filename_folder(tmp_path):
    """Verify folder is a valid transcript type."""
    result = generate_transcript_filename(
        directory=tmp_path,
        scan_date='2026-03-04',
        timeframe='1d',
        transcript_type='folder',
    )
    assert result == '2026-03-04-1d-folder-001.md'
```

**Step 2: Run tests to verify they fail**

Run: `cd forge-lib && python3 -m pytest tests/test_transcript_ops.py::test_generate_transcript_filename_calendar tests/test_transcript_ops.py::test_generate_transcript_filename_inbox -v`
Expected: FAIL with "Invalid transcript_type: calendar"

**Step 3: Extend TRANSCRIPT_TYPE_FILENAME_MAP**

In `forge-lib/core/transcript_ops.py:22-26`, change:

```python
TRANSCRIPT_TYPE_FILENAME_MAP = {
    'public-channels': 'public-channels',
    'dms': 'dms',
    'jira-bot': 'jira-bot',
    'calendar': 'calendar',
    'inbox': 'inbox',
    'sent': 'sent',
    'folder': 'folder',
}
```

**Step 4: Extend CLI argparse choices**

In `forge-lib/forge.py:1352-1356`, change:

```python
filename_parser.add_argument(
    '--type',
    required=True,
    choices=['public-channels', 'dms', 'jira-bot', 'calendar', 'inbox', 'sent', 'folder'],
    help='Transcript type'
)
```

**Step 5: Run tests to verify they pass**

Run: `cd forge-lib && python3 -m pytest tests/test_transcript_ops.py -v`
Expected: All new and existing tests pass

**Step 6: Run full test suite**

Run: `cd forge-lib && python3 -m pytest`
Expected: All tests pass

**Step 7: Commit**

```bash
git add forge-lib/core/transcript_ops.py forge-lib/forge.py forge-lib/tests/test_transcript_ops.py
git commit -m "feat(forge-lib): add calendar, inbox, sent, folder transcript types"
```

---

## Task 4: Fix refresh() scope bug in view controllers

**Files:**
- Modify: `forge-shell/app/js/outlook-forge.js:185`
- Modify: `forge-shell/app/js/slack-forge.js:183`

**Step 1: Fix outlook-forge.js**

In `forge-shell/app/js/outlook-forge.js:185`, change:

```javascript
// Before:
if (act === 'refresh') { refresh(); return; }

// After:
if (act === 'refresh') { loadData(); return; }
```

**Step 2: Fix slack-forge.js**

In `forge-shell/app/js/slack-forge.js:183`, change:

```javascript
// Before:
if (act === 'refresh') { refresh(); return; }

// After:
if (act === 'refresh') { loadData(); return; }
```

**Step 3: Commit**

```bash
git add forge-shell/app/js/outlook-forge.js forge-shell/app/js/slack-forge.js
git commit -m "fix(forge-shell): call loadData() instead of undefined refresh() in view controllers"
```

---

## Task 5: Fix fm.timeframe field mismatch in view controllers

**Files:**
- Modify: `forge-shell/app/js/outlook-forge.js:523,623,664`
- Modify: `forge-shell/app/js/slack-forge.js:521,621,662`

**Step 1: Fix outlook-forge.js harvest detail rendering**

In each location where `fm.timeframe` is used for harvest detail rendering, change to use fallback:

At line 523 (and 623, 664):
```javascript
// Before:
const timeframe = fm.timeframe || '';

// After:
const timeframe = fm.scan_timeframe || fm.timeframe || '';
```

Apply this pattern at all three lines (523, 623, 664).

**Step 2: Fix slack-forge.js harvest detail rendering**

Apply the same change at lines 521, 621, 662:

```javascript
// Before:
const timeframe = fm.timeframe || '';

// After:
const timeframe = fm.scan_timeframe || fm.timeframe || '';
```

**Step 3: Commit**

```bash
git add forge-shell/app/js/outlook-forge.js forge-shell/app/js/slack-forge.js
git commit -m "fix(forge-shell): read scan_timeframe with timeframe fallback in harvest detail"
```

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md:22-30` (plugins table)
- Modify: `CLAUDE.md:69-77` (view controllers)

**Step 1: Add outlook-forge to plugins table**

After the `slack-forge` row (around line 29), add:

```markdown
| **outlook-forge** | `/outlook-forge:init`, `/outlook-forge:scan`, `/outlook-forge:capture`, `/outlook-forge:review`, `/outlook-forge:promote` | `outlook-forge/harvests/` + `outlook-forge/harvests/index.json` + `outlook-forge/config.json` + `outlook-forge/transcripts/` |
```

**Step 2: Add outlook-forge.js to view controllers list**

After `slack-forge.js` (around line 76), add:

```markdown
- `outlook-forge.js` — Harvest and transcript dashboard
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add outlook-forge to CLAUDE.md plugins table and view controllers"
```

---

## Task 7: Final verification

**Step 1: Run full test suite**

Run: `cd forge-lib && python3 -m pytest -v`
Expected: All tests pass (317 existing + ~8 new)

**Step 2: Verify forge-lib CLI accepts new flags**

```bash
python3 forge-lib/forge.py harvest create "test" --harvest-type meeting-prep --plugin outlook-forge --help
python3 forge-lib/forge.py transcript filename --scan-date 2026-03-04 --timeframe 3d --type calendar --dir outlook-forge/transcripts --help
```

Expected: No argument errors

**Step 3: Push and update PR**

```bash
git push origin memory
```
