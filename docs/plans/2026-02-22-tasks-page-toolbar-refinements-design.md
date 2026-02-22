# Design: Tasks Page Toolbar Refinements

**Date:** 2026-02-22
**Status:** Approved

## Problem

The tasks page toolbar has three issues:

1. The `fa-sliders` icon for field-settings is visually misleading — it reads as a "list view" or "control panel" icon rather than a filter.
2. Field visibility settings only affect board card metadata. The tooltip that appears on hover across Timeline, Workload, and Matrix views is not governed by these settings.
3. There is no way to quickly hide "done" tasks. Users typically work in active views (Board, Timeline, Workload, Matrix) where done tasks add visual noise.

## Goals

- Add a one-tap toggle to hide/show done tasks across all active views.
- Expand field visibility settings to also control tooltip content across all views.
- Swap the field-settings icon to a proper filter icon.

## Non-Goals

- The Summary view is a historical lens and is explicitly excluded from the hide-done behavior.
- This does not introduce a full status filter panel — hide-done is the only status toggle needed.

## Design

### Toolbar Layout

**Current (right side):** `[pen] [sliders] [refresh]`
**New (right side):** `[pen] [filter] [circle-check] [refresh]`

| Button | Icon | Action | Change |
|--------|------|--------|--------|
| View edit mode | `fa-pen` | Hide/show view tabs | Unchanged |
| Field visibility | `fa-filter` | Show/hide fields on cards and tooltips | Icon swap from `fa-sliders` |
| Hide done toggle | `fa-circle-check` | Hide/show done tasks across active views | New |
| Refresh | `fa-rotate` | Reload task files | Unchanged |

### Hide Done Toggle

**State variable:** `let hideDone = false`

**Persistence:** `localStorage` key `forge-shell-tasks-hide-done`

**Active state:** When `hideDone` is true, the button receives the `rm-active` CSS class (same pattern as roadmap's stories toggle), giving it a visual highlight so the current state is always visible.

**Per-view behavior:**

| View | `hideDone = true` behavior |
|------|---------------------------|
| Board | Skip rendering the Done column entirely |
| Timeline | Filter task list to exclude `status === 'done'` before rendering |
| Workload | Filter task list to exclude `status === 'done'` before rendering |
| Matrix | Filter task list to exclude `status === 'done'` before rendering |
| Summary | No change — always renders all tasks regardless of toggle state |

**On toggle:** Flip `hideDone`, persist to localStorage, call `renderActiveView()`.

### Field Visibility Expansion

`buildTooltipHtml(task)` currently hardcodes which fields it shows. It will check `fieldVisibility` before rendering each row:

| Field | Tooltip row shown when... |
|-------|--------------------------|
| priority | `fieldVisibility.priority === true` |
| assignee | `fieldVisibility.assignee === true` |
| due_date | `fieldVisibility.due_date === true` |
| tags | `fieldVisibility.tags === true` (new row) |
| type | `fieldVisibility.type === true` (new row) |

The title row (task name) always shows regardless of field visibility.

The field-settings modal description text updates from:
> "Customize which metadata fields appear on task cards."

To:
> "Customize which metadata fields appear on task cards and hover tooltips."

### Icon Swap

The `data-action="field-settings"` button:
- Icon: `fa-sliders` → `fa-filter`
- Title attribute: `"Customize Fields"` → `"Filter Fields"`

## Files Changed

- `forge-shell/app/js/tasks.js` — all changes are contained here
