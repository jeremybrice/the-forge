# Tasks Search — Design Document

**Date:** 2026-03-04
**Status:** Draft
**Component:** forge-shell → Tasks View Controller (`tasks.js`, `productivity.css`)

## Overview

Add search and filtering to the Tasks page in forge-shell. Users can search by text across task fields and apply faceted filters (priority, status, assignee) via a collapsible filter strip below the toolbar. Non-matching cards dim rather than hide, preserving spatial context across all five views.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Filter placement | Collapsible strip below toolbar | Non-intrusive, keyboard-accessible, doesn't alter existing layout structure |
| Non-match behavior | Dim (opacity 0.25) | Preserves column/lane/cell spatial context. Users always know where cards are. |
| Search scope | title, tags, assignee, creator, external_id | Covers the fields users are most likely to search. Body text excluded (too heavy for real-time). |
| Filter model | Multi-select chips + text | Chips for structured fields (priority, status), free text for everything else. Simple and fast. |
| Persistence | Strip open/closed state only | Filter values reset on page load. Avoids stale filter confusion. |
| Analytics views | Recompute from filtered set | Summary/Workload/Matrix stats reflect what the user is looking at. More useful than dimming stats. |
| Assignee filter | Dynamic dropdown | Populated from current task data. No hardcoded list to maintain. |

## Data Flow

```
User types / clicks chip
       │
       ▼
updateFilters()          ← debounced 150ms for text, immediate for chips
       │
       ▼
computeFilteredSet()     ← returns { matched: Set<filename>, query, filters }
       │
       ├──► Board:     renderBoard() checks matched set, adds .prod-card-dimmed class
       ├──► Timeline:  renderTimeline() checks matched set, adds .prod-tl-dimmed class
       ├──► Summary:   renderSummary(filteredTasks) recomputes stats
       ├──► Workload:  renderWorkload() checks matched set for dimming + recomputes lane stats
       └──► Matrix:    renderMatrix() checks matched set for dimming + recomputes cell counts
```

## State Model

New state variables added to the TasksView IIFE:

```javascript
/* Search/filter state */
let searchOpen = false;          // strip visibility
let searchQuery = '';             // free text input
let filterPriority = [];          // e.g., ['high', 'medium']
let filterStatus = [];            // e.g., ['active', 'waiting']
let filterAssignee = '';          // single assignee or '' for all
let matchedFilenames = null;      // Set<string> or null (null = no filter active)
```

### Filter Logic

```javascript
function computeFilteredSet() {
  const noFilters = !searchQuery && filterPriority.length === 0 &&
                    filterStatus.length === 0 && !filterAssignee;
  if (noFilters) {
    matchedFilenames = null;  // null signals "show all"
    return;
  }

  matchedFilenames = new Set();
  const q = searchQuery.toLowerCase();

  tasks.forEach(task => {
    // Priority filter
    if (filterPriority.length > 0) {
      if (!filterPriority.includes((task.priority || 'medium').toLowerCase())) return;
    }
    // Status filter
    if (filterStatus.length > 0) {
      if (!filterStatus.includes((task.status || 'active').toLowerCase())) return;
    }
    // Assignee filter
    if (filterAssignee) {
      if ((task.assignee || '').toLowerCase() !== filterAssignee.toLowerCase()) return;
    }
    // Text search
    if (q) {
      const haystack = [
        task.title,
        (task.tags || []).join(' '),
        task.assignee || '',
        task.creator || '',
        task.external_id || ''
      ].join(' ').toLowerCase();
      if (!haystack.includes(q)) return;
    }

    matchedFilenames.add(task.filename);
  });
}
```

### Integration Points

**`isTaskMatched(task)`** — helper used by all view renderers:
```javascript
function isTaskMatched(task) {
  if (matchedFilenames === null) return true;  // no filter active
  return matchedFilenames.has(task.filename);
}
```

**`getFilteredTasks()`** — returns filtered subset for analytics views:
```javascript
function getFilteredTasks() {
  if (matchedFilenames === null) return tasks;
  return tasks.filter(t => matchedFilenames.has(t.filename));
}
```

## DOM Structure

New HTML inserted between toolbar and view panels in `scaffold()`:

```html
<!-- Filter Strip (hidden by default) -->
<div class="prod-filter-strip" data-ref="filter-strip" style="display:none;">
  <div class="prod-filter-strip-inner">
    <!-- Search input -->
    <div class="prod-filter-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" placeholder="Search tasks..."
             data-ref="search-input" aria-label="Search tasks">
    </div>

    <!-- Priority chips -->
    <div class="prod-filter-group">
      <span class="prod-filter-label">Priority:</span>
      <button class="prod-filter-chip prod-chip-high"
              data-filter="priority" data-value="high" aria-pressed="false">High</button>
      <button class="prod-filter-chip prod-chip-medium"
              data-filter="priority" data-value="medium" aria-pressed="false">Medium</button>
      <button class="prod-filter-chip prod-chip-low"
              data-filter="priority" data-value="low" aria-pressed="false">Low</button>
    </div>

    <!-- Status chips -->
    <div class="prod-filter-group">
      <span class="prod-filter-label">Status:</span>
      <button class="prod-filter-chip"
              data-filter="status" data-value="active" aria-pressed="false">Active</button>
      <button class="prod-filter-chip"
              data-filter="status" data-value="waiting" aria-pressed="false">Waiting</button>
      <button class="prod-filter-chip"
              data-filter="status" data-value="someday" aria-pressed="false">Someday</button>
      <button class="prod-filter-chip" data-ref="chip-done"
              data-filter="status" data-value="done" aria-pressed="false">Done</button>
    </div>

    <!-- Assignee dropdown -->
    <div class="prod-filter-group">
      <span class="prod-filter-label">Assignee:</span>
      <select data-ref="assignee-filter" aria-label="Filter by assignee">
        <option value="">All</option>
        <!-- dynamically populated -->
      </select>
    </div>

    <!-- Match counter & clear -->
    <div class="prod-filter-meta">
      <span class="prod-filter-count" data-ref="filter-count" role="status"></span>
      <button class="btn-icon prod-filter-clear" data-action="clear-filters"
              title="Clear all filters"><i class="fa-solid fa-xmark"></i></button>
    </div>
  </div>
</div>
```

## CSS Classes (New)

| Class | Purpose |
|-------|---------|
| `.prod-filter-strip` | Container for the filter strip, handles slide animation |
| `.prod-filter-strip.prod-strip-open` | Active state, triggers slide-down |
| `.prod-filter-strip-inner` | Flex row layout for filter content |
| `.prod-filter-search` | Search input wrapper with icon |
| `.prod-filter-group` | Groups label + chips/dropdown |
| `.prod-filter-label` | Small muted label text |
| `.prod-filter-chip` | Toggle button for filter values |
| `.prod-filter-chip.active` | Filled/active state |
| `.prod-chip-high` | Priority-specific color when active |
| `.prod-chip-medium` | Priority-specific color when active |
| `.prod-chip-low` | Priority-specific color when active |
| `.prod-filter-count` | Match counter text |
| `.prod-filter-clear` | Clear all button |
| `.prod-card-dimmed` | Applied to non-matching board cards |
| `.prod-card-matched` | Applied to matching board cards (accent left border) |
| `.prod-tl-dimmed` | Applied to non-matching timeline bars |
| `.prod-matrix-dimmed` | Applied to non-matching matrix mini-cards |
| `.prod-wl-dimmed` | Applied to non-matching workload mini-cards |
| `.prod-filtered-badge` | "Filtered" pill for summary view |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl+F` | Toggle filter strip open/closed |
| `Escape` | Close strip + clear all filters |
| `Tab` | Navigate through search input → chips → dropdown → clear button |
| `Space/Enter` | Toggle chip, activate button |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No tasks loaded | Filter strip is disabled (search input grayed out) |
| All tasks filtered out | Board shows "No matching tasks" per column, other views show empty state |
| hideDone + status filter | Done chip hidden from strip when hideDone is true |
| External file change during filter | Re-run `computeFilteredSet()` after task reload to update matches |
| Filter strip open + view switch | Strip stays open, filters apply to new view |
| Drag-drop on dimmed card | Blocked (`pointer-events: none` on `.prod-card-dimmed`) |
| New task added while filtered | New task appears un-dimmed (not filtered yet), next render cycle applies filter |

## Performance

- `computeFilteredSet()` iterates tasks array once per filter change — O(n) where n = task count
- Text search uses simple `String.includes()` — sufficient for typical task counts (<500)
- Debounce on text input (150ms) prevents excessive re-renders during typing
- No DOM queries during filter computation — operates on in-memory task objects
- View renderers check `isTaskMatched()` per card, which is a Set lookup — O(1)

## Testing Strategy

Manual verification only (no automated test framework in forge-shell):

1. Toggle strip open/closed via button and keyboard shortcut
2. Type in search input — verify cards dim/highlight in real-time
3. Click priority chips — verify multi-select and card filtering
4. Click status chips — verify filtering across columns
5. Select assignee — verify dropdown filtering
6. Clear all — verify everything resets
7. Switch views while filtered — verify filter applies to each view
8. Verify hideDone interaction with Done chip
9. Verify drag-drop blocked on dimmed cards
10. Verify external file change re-applies filters
11. Test both light and dark themes
12. Test with 0 tasks, 1 task, and many tasks
