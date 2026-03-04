# Outlook-Forge Fixes Design

**Date:** 2026-03-04
**Status:** Approved
**Trigger:** Code review of PR #17 identified 7 issues
**PR:** https://github.com/jeremybrice/the-forge/pull/17

## Problem Statement

The outlook-forge plugin was built under the assumption that forge-lib's harvest and transcript infrastructure could be reused unchanged. Code review revealed this assumption was wrong — the infrastructure is hardcoded for slack-forge in three ways:

1. Directory paths hardcoded to `slack-forge/`
2. Harvest types limited to `task`, `knowledge`, `jira-digest`
3. Transcript types limited to `public-channels`, `dms`, `jira-bot`

Additionally, two pre-existing JS bugs were found in the forge-shell view controllers, and CLAUDE.md was not updated.

## Issues to Fix

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | `--plugin` flag doesn't exist on harvest subcommands | Blocker | forge-lib |
| 2 | `meeting-prep`/`meeting-notes` not valid harvest types | Blocker | forge-lib |
| 3 | `harvest_ops` hardcodes `slack-forge/` directory | Blocker | forge-lib |
| 4 | Invalid transcript `--type` values (calendar, inbox, sent) | Blocker | forge-lib |
| 5 | `fm.timeframe` vs `scan_timeframe` field mismatch in view | Bug | forge-shell |
| 6 | CLAUDE.md plugins table and view controllers not updated | Documentation | docs |
| 7 | `refresh()` undefined reference in view controller bindEvents | Bug | forge-shell |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multi-plugin strategy | Add `--plugin` flag with default `slack-forge` | Backwards-compatible, matches design doc intent, clean API |
| Pre-existing bugs | Fix in both slack-forge.js and outlook-forge.js | Both files have identical bugs; fix once, apply to both |
| Schema changes | Extend harvest.json enum in place | Additive change, no migration needed |
| Transcript types | Add calendar/inbox/sent/folder to type map | Direct mapping, keeps type system simple |

## Section 1: Harvest Infrastructure (Issues 1, 2, 3)

### harvest_ops.py

Rename `_get_slack_forge_directory(directory)` to `_get_plugin_directory(directory, plugin='slack-forge')`:

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
```

Add `plugin` parameter (default `'slack-forge'`) to all public functions that currently call `_get_slack_forge_directory()`:
- `create_harvest(data, directory='.', plugin='slack-forge', validate=True)`
- `get_harvest(filename, directory='.', plugin='slack-forge')`
- `query_harvests(filters, directory='.', plugin='slack-forge')`
- `update_harvest(filename, updates, directory='.', plugin='slack-forge')`
- `get_config(directory='.', plugin='slack-forge')`
- `set_config(directory='.', plugin='slack-forge')`
- `init_harvest(directory='.', plugin='slack-forge')`

Extend `HARVEST_TYPE_FILENAME_MAP`:

```python
HARVEST_TYPE_FILENAME_MAP = {
    'task': 'task-harvest',
    'knowledge': 'knowledge-harvest',
    'jira-digest': 'jira-digest',
    'meeting-prep': 'meeting-prep-harvest',
    'meeting-notes': 'meeting-notes-harvest',
}
```

### forge.py harvest subparsers

Add `--plugin` argument to all 5 harvest subcommands (`init`, `create`, `query`, `update`, `config`):

```python
parser.add_argument("--plugin", default="slack-forge", help="Plugin name (default: slack-forge)")
```

Extend `--harvest-type` choices on `create` and `query`:

```python
choices=["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"]
```

Pass `args.plugin` through all harvest handler functions to the corresponding `harvest_ops` calls.

### schemas/harvest.json

Extend `harvest_type` enum:

```json
"harvest_type": {
    "type": "string",
    "enum": ["task", "knowledge", "jira-digest", "meeting-prep", "meeting-notes"],
    "description": "Classification of harvested content"
}
```

### Backwards Compatibility

All existing slack-forge commands continue working unchanged — `--plugin` defaults to `slack-forge`. No migration needed.

## Section 2: Transcript Infrastructure (Issue 4)

### transcript_ops.py

Extend `TRANSCRIPT_TYPE_FILENAME_MAP`:

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

### forge.py transcript subparser

Extend `--type` choices:

```python
choices=['public-channels', 'dms', 'jira-bot', 'calendar', 'inbox', 'sent', 'folder']
```

Change `--dir` default from `slack-forge/transcripts` to no default (require explicit `--dir`), or keep the default and document that outlook-forge must pass `--dir outlook-forge/transcripts` explicitly. The outlook-forge scan command already specifies `--dir outlook-forge/transcripts`, so no command changes needed.

## Section 3: Outlook-Forge Command Fixes (Issue 1)

With Sections 1 and 2 implemented, the existing outlook-forge commands become valid:

- `--plugin outlook-forge` — now a real flag, resolves to `outlook-forge/` directory
- `--harvest-type meeting-prep` / `meeting-notes` — now valid choices
- `forge transcript filename --type calendar` — now valid

**No changes needed to outlook-forge command files.** The forge-lib changes make their existing CLI invocations correct.

The only potential adjustment: verify that `forge harvest config --set-channels` semantics work for outlook-forge sources (the flag name says "channels" but outlook-forge has "sources"). If the underlying storage is just JSON, the field naming is cosmetic and works unchanged.

## Section 4: Forge-Shell JS Fixes (Issues 5, 7)

### `refresh()` scope bug — both files

**Files:** `forge-shell/app/js/outlook-forge.js` (line 185), `forge-shell/app/js/slack-forge.js` (line 183)

The `refresh()` method is defined as a property on the returned IIFE object (ES6 method shorthand), not as a closure variable. The bare `refresh()` call in `bindEvents()` throws `ReferenceError` at runtime.

**Fix:** Replace `refresh()` with `loadData()` in the click handler. `loadData()` is the private closure function that `refresh()` delegates to.

```javascript
// Before:
if (act === 'refresh') { refresh(); return; }

// After:
if (act === 'refresh') { loadData(); return; }
```

Apply to both `outlook-forge.js` and `slack-forge.js`.

### `fm.timeframe` field mismatch — both files

**Files:** `forge-shell/app/js/outlook-forge.js` (lines 523, 623, 664), `forge-shell/app/js/slack-forge.js` (lines 521, 621, 662)

Harvest frontmatter uses `scan_timeframe` (per schema). Transcript frontmatter uses `timeframe` (no prefix). The view controller reads `fm.timeframe` everywhere, which works for transcripts but may not resolve for harvests.

**Fix:** In harvest detail rendering sections, use `fm.scan_timeframe || fm.timeframe` to handle both harvest and transcript frontmatter:

```javascript
const timeframe = fm.scan_timeframe || fm.timeframe || '';
```

Apply to both files in the harvest detail rendering functions only. Transcript rendering can continue using `fm.timeframe`.

## Section 5: CLAUDE.md Updates (Issue 6)

Add `outlook-forge` to the plugins table:

```markdown
| **outlook-forge** | `/outlook-forge:init`, `/outlook-forge:scan`, `/outlook-forge:capture`, `/outlook-forge:review`, `/outlook-forge:promote` | `outlook-forge/harvests/` + `outlook-forge/harvests/index.json` + `outlook-forge/config.json` + `outlook-forge/transcripts/` |
```

Add `outlook-forge.js` to the view controllers list:

```markdown
- `outlook-forge.js` — Harvest and transcript dashboard
```

## Section 6: Tests

### Existing tests

All 317 existing tests must continue passing. The `--plugin` default of `slack-forge` ensures backwards compatibility.

### New tests

**harvest_ops tests:**
- `test_create_harvest_with_plugin_parameter` — verifies `plugin='outlook-forge'` creates files in `outlook-forge/harvests/`
- `test_create_harvest_meeting_prep_type` — verifies `meeting-prep` is accepted
- `test_create_harvest_meeting_notes_type` — verifies `meeting-notes` is accepted
- `test_query_harvests_with_plugin_parameter` — verifies query against non-default plugin directory
- `test_get_plugin_directory_default` — verifies default returns `slack-forge`
- `test_get_plugin_directory_custom` — verifies custom returns correct path

**transcript_ops tests:**
- `test_generate_transcript_filename_calendar` — verifies `calendar` type
- `test_generate_transcript_filename_inbox` — verifies `inbox` type
- `test_generate_transcript_filename_sent` — verifies `sent` type
- `test_generate_transcript_filename_folder` — verifies `folder` type

**CLI integration tests:**
- `test_harvest_create_with_plugin_flag` — verifies `--plugin outlook-forge` is accepted
- `test_transcript_filename_with_new_types` — verifies new `--type` values work

## File Change Summary

| File | Change |
|------|--------|
| `forge-lib/core/harvest_ops.py` | Rename function, add `plugin` param, extend type map |
| `forge-lib/core/transcript_ops.py` | Extend type map |
| `forge-lib/forge.py` | Add `--plugin` flag, extend type choices, pass plugin to handlers |
| `forge-lib/schemas/harvest.json` | Extend `harvest_type` enum |
| `forge-shell/app/js/outlook-forge.js` | Fix `refresh()` scope, fix `fm.timeframe` |
| `forge-shell/app/js/slack-forge.js` | Fix `refresh()` scope, fix `fm.timeframe` |
| `CLAUDE.md` | Add outlook-forge to plugins table and view controllers |
| `forge-lib/tests/test_harvest_ops.py` | New tests for plugin parameter and new types |
| `forge-lib/tests/test_transcript_ops.py` | New tests for new transcript types |
| `forge-lib/tests/test_forge_cli.py` | New CLI integration tests |
