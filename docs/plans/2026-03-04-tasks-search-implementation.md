# Tasks Search — Implementation Plan

**Date:** 2026-03-04
**Status:** Draft
**Design Doc:** `docs/plans/2026-03-04-tasks-search-design.md`
**Frontend Spec:** `docs/plans/2026-03-04-tasks-search-frontend-design.md`

## Files to Modify

| File | Changes |
|------|---------|
| `forge-shell/app/js/tasks.js` | Add search state, filter strip DOM, event handlers, filter logic, view renderer integration |
| `forge-shell/app/css/productivity.css` | Add filter strip styles, dimmed/matched card styles, chip styles, animation |

No new files. No changes to `utils.js`, `theme.css`, `components.css`, or `index.html`.

## Implementation Steps

### Step 1: Add CSS for Filter Strip and Card States

**File:** `forge-shell/app/css/productivity.css`

Add at the end of the file (after existing task styles):

1. `.prod-filter-strip` — container with `overflow: hidden`, `max-height: 0`, `transition: max-height 200ms ease-out`
2. `.prod-filter-strip.prod-strip-open` — `max-height: 120px` (enough for wrapped content)
3. `.prod-filter-strip-inner` — flex row with `gap: 16px`, `padding: 8px 16px`, `align-items: center`, `flex-wrap: wrap`
4. `.prod-filter-search` — relative container for icon + input, input `width: 240px`
5. `.prod-filter-search i` — absolute positioned search icon inside input
6. `.prod-filter-search input` — `padding-left: 28px` to make room for icon
7. `.prod-filter-group` — flex row with `gap: 6px`, `align-items: center`
8. `.prod-filter-label` — `font-size: 11px`, `color: var(--text-muted)`, `text-transform: uppercase`, `letter-spacing: 0.5px`
9. `.prod-filter-chip` — `padding: 3px 10px`, `border-radius: 12px`, `font-size: 12px`, `border: 1px solid var(--border-color)`, `background: var(--bg-primary)`, `cursor: pointer`, `transition: all 150ms`
10. `.prod-filter-chip.active` — `background: var(--accent)`, `color: #fff`, `border-color: var(--accent)`
11. `.prod-chip-high.active` — `background: #e74c3c`, `border-color: #e74c3c`
12. `.prod-chip-medium.active` — `background: #f39c12`, `border-color: #f39c12`
13. `.prod-chip-low.active` — `background: #3498db`, `border-color: #3498db`
14. `.prod-filter-meta` — `margin-left: auto`, flex row with gap
15. `.prod-filter-count` — `font-size: 12px`, `color: var(--text-muted)`
16. `.prod-card-dimmed` — `opacity: 0.25`, `pointer-events: none`, `filter: saturate(0.3)`, `transition: opacity 200ms, filter 200ms`
17. `.prod-card-matched` — `border-left: 3px solid var(--accent)`, `transition: border-color 200ms`
18. `.prod-tl-dimmed` — `opacity: 0.15`
19. `.prod-wl-dimmed` — `opacity: 0.25`, `pointer-events: none`
20. `.prod-matrix-dimmed` — `opacity: 0.25`
21. `.prod-filtered-badge` — inline pill style, `font-size: 11px`, `background: var(--bg-tertiary)`, `padding: 2px 8px`, `border-radius: 8px`
22. `.prod-filter-strip select` — compact select styling matching existing form elements

**Verify:** Open the app, confirm no visual regressions (strip is hidden by default).

### Step 2: Add Search State Variables

**File:** `forge-shell/app/js/tasks.js`

Add after the existing `hideDone` state variable (around line 52):

```javascript
/* Search/filter state */
let searchOpen = false;
let searchQuery = '';
let filterPriority = [];
let filterStatus = [];
let filterAssignee = '';
let matchedFilenames = null;
let searchDebounceTimer = null;
```

Add helper functions after the `hashColor`/`getInitial` helpers (around line 161):

```javascript
function isTaskMatched(task) {
  if (matchedFilenames === null) return true;
  return matchedFilenames.has(task.filename);
}

function getFilteredTasks() {
  if (matchedFilenames === null) return tasks;
  return tasks.filter(function (t) { return matchedFilenames.has(t.filename); });
}

function computeFilteredSet() {
  var noFilters = !searchQuery && filterPriority.length === 0 &&
                  filterStatus.length === 0 && !filterAssignee;
  if (noFilters) {
    matchedFilenames = null;
    return;
  }

  matchedFilenames = new Set();
  var q = searchQuery.toLowerCase();

  tasks.forEach(function (task) {
    if (filterPriority.length > 0) {
      if (filterPriority.indexOf((task.priority || 'medium').toLowerCase()) === -1) return;
    }
    if (filterStatus.length > 0) {
      if (filterStatus.indexOf((task.status || 'active').toLowerCase()) === -1) return;
    }
    if (filterAssignee) {
      if ((task.assignee || '').toLowerCase() !== filterAssignee.toLowerCase()) return;
    }
    if (q) {
      var haystack = [
        task.title || '',
        (task.tags || []).join(' '),
        task.assignee || '',
        task.creator || '',
        task.external_id || ''
      ].join(' ').toLowerCase();
      if (haystack.indexOf(q) === -1) return;
    }

    matchedFilenames.add(task.filename);
  });
}

function updateFilterCount() {
  var el = $('[data-ref="filter-count"]');
  if (!el) return;
  if (matchedFilenames === null) {
    el.textContent = tasks.length + ' tasks';
  } else {
    el.textContent = matchedFilenames.size + ' of ' + tasks.length + ' tasks';
  }
}

function populateAssigneeDropdown() {
  var select = $('[data-ref="assignee-filter"]');
  if (!select) return;
  var assignees = [];
  tasks.forEach(function (t) {
    if (t.assignee && t.assignee !== 'null' && assignees.indexOf(t.assignee) === -1) {
      assignees.push(t.assignee);
    }
  });
  assignees.sort();
  var html = '<option value="">All</option>';
  assignees.forEach(function (a) {
    html += '<option value="' + esc(a) + '"' +
            (filterAssignee === a ? ' selected' : '') + '>' + esc(a) + '</option>';
  });
  select.innerHTML = html;
}
```

**Verify:** No runtime errors. State variables initialized.

### Step 3: Add Filter Strip DOM to Scaffold

**File:** `forge-shell/app/js/tasks.js`

In the `scaffold()` function, insert the filter strip HTML between the closing `</div>` of the toolbar and the opening of the first `prod-tab-panel`. This is between lines 190 and 193 in the current file.

Insert this HTML string:

```javascript
/* Filter Strip */
'<div class="prod-filter-strip" data-ref="filter-strip">' +
  '<div class="prod-filter-strip-inner">' +
    '<div class="prod-filter-search">' +
      '<i class="fa-solid fa-magnifying-glass"></i>' +
      '<input type="text" placeholder="Search tasks…" data-ref="search-input" aria-label="Search tasks">' +
    '</div>' +
    '<div class="prod-filter-group">' +
      '<span class="prod-filter-label">Priority</span>' +
      '<button class="prod-filter-chip prod-chip-high" data-filter="priority" data-value="high" aria-pressed="false">High</button>' +
      '<button class="prod-filter-chip prod-chip-medium" data-filter="priority" data-value="medium" aria-pressed="false">Medium</button>' +
      '<button class="prod-filter-chip prod-chip-low" data-filter="priority" data-value="low" aria-pressed="false">Low</button>' +
    '</div>' +
    '<div class="prod-filter-group">' +
      '<span class="prod-filter-label">Status</span>' +
      '<button class="prod-filter-chip" data-filter="status" data-value="active" aria-pressed="false">Active</button>' +
      '<button class="prod-filter-chip" data-filter="status" data-value="waiting" aria-pressed="false">Waiting</button>' +
      '<button class="prod-filter-chip" data-filter="status" data-value="someday" aria-pressed="false">Someday</button>' +
      '<button class="prod-filter-chip" data-filter="status" data-value="done" data-ref="chip-done" aria-pressed="false">Done</button>' +
    '</div>' +
    '<div class="prod-filter-group">' +
      '<span class="prod-filter-label">Assignee</span>' +
      '<select data-ref="assignee-filter" aria-label="Filter by assignee"><option value="">All</option></select>' +
    '</div>' +
    '<div class="prod-filter-meta">' +
      '<span class="prod-filter-count" data-ref="filter-count" role="status"></span>' +
      '<button class="btn-icon prod-filter-clear" data-action="clear-filters" title="Clear all filters"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>' +
  '</div>' +
'</div>' +
```

Also add the search toggle button to the toolbar, before the existing `field-settings` button:

```javascript
'<button class="btn-icon" data-action="toggle-search" title="Search (Cmd+F)"><i class="fa-solid fa-magnifying-glass"></i></button>' +
```

**Verify:** Filter strip DOM renders (hidden). Search icon appears in toolbar.

### Step 4: Add Event Handlers

**File:** `forge-shell/app/js/tasks.js`

**4a.** In `bindToolbarEvents()`, add to the existing action click handler (around line 275):

```javascript
else if (action === 'toggle-search') toggleSearchStrip();
else if (action === 'clear-filters') clearAllFilters();
```

**4b.** Add new event listeners in `bindToolbarEvents()`:

```javascript
/* Search input */
view.addEventListener('input', function (e) {
  if (!e.target.matches('[data-ref="search-input"]')) return;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(function () {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  }, 150);
});

/* Filter chips */
view.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-filter]');
  if (!chip) return;
  var filterType = chip.dataset.filter;
  var value = chip.dataset.value;

  if (filterType === 'priority') {
    var idx = filterPriority.indexOf(value);
    if (idx === -1) filterPriority.push(value);
    else filterPriority.splice(idx, 1);
    chip.classList.toggle('active');
    chip.setAttribute('aria-pressed', chip.classList.contains('active'));
  } else if (filterType === 'status') {
    var idx = filterStatus.indexOf(value);
    if (idx === -1) filterStatus.push(value);
    else filterStatus.splice(idx, 1);
    chip.classList.toggle('active');
    chip.setAttribute('aria-pressed', chip.classList.contains('active'));
  }
  applyFilters();
});

/* Assignee dropdown */
view.addEventListener('change', function (e) {
  if (!e.target.matches('[data-ref="assignee-filter"]')) return;
  filterAssignee = e.target.value;
  applyFilters();
});

/* Keyboard shortcut: Cmd/Ctrl+F */
document.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    /* Only intercept when tasks view is active */
    var tasksView = document.getElementById('view-tasks');
    if (tasksView && !tasksView.classList.contains('hidden')) {
      e.preventDefault();
      toggleSearchStrip();
    }
  }
  /* Escape to close strip */
  if (e.key === 'Escape' && searchOpen) {
    clearAllFilters();
    toggleSearchStrip();
  }
});
```

**4c.** Add the toggle/clear/apply functions:

```javascript
function toggleSearchStrip() {
  searchOpen = !searchOpen;
  var strip = $('[data-ref="filter-strip"]');
  if (!strip) return;
  strip.classList.toggle('prod-strip-open', searchOpen);
  if (searchOpen) {
    strip.style.display = '';
    populateAssigneeDropdown();
    updateFilterCount();
    syncHideDoneChip();
    /* Focus search input */
    var input = $('[data-ref="search-input"]');
    if (input) setTimeout(function () { input.focus(); }, 50);
  } else {
    strip.style.display = 'none';
  }
  try { localStorage.setItem('forge-shell-tasks-search-open', searchOpen ? '1' : '0'); }
  catch (e) { /* ignore */ }
}

function clearAllFilters() {
  searchQuery = '';
  filterPriority = [];
  filterStatus = [];
  filterAssignee = '';
  matchedFilenames = null;

  var input = $('[data-ref="search-input"]');
  if (input) input.value = '';

  $$('[data-filter]').forEach(function (chip) {
    chip.classList.remove('active');
    chip.setAttribute('aria-pressed', 'false');
  });

  var select = $('[data-ref="assignee-filter"]');
  if (select) select.value = '';

  updateFilterCount();
  renderTasks();
}

function applyFilters() {
  computeFilteredSet();
  updateFilterCount();
  renderTasks();
}

function syncHideDoneChip() {
  var doneChip = $('[data-ref="chip-done"]');
  if (doneChip) {
    doneChip.style.display = hideDone ? 'none' : '';
    /* Remove done from active filters if hideDone is toggled on */
    if (hideDone) {
      var idx = filterStatus.indexOf('done');
      if (idx !== -1) {
        filterStatus.splice(idx, 1);
        doneChip.classList.remove('active');
        doneChip.setAttribute('aria-pressed', 'false');
      }
    }
  }
}
```

**Verify:** Click search icon → strip opens. Type text → cards dim. Click chips → cards filter. Escape → strip closes and filters clear.

### Step 5: Integrate Filtering into Board View

**File:** `forge-shell/app/js/tasks.js`

**5a.** In `createColumn()`, update the column count to show filtered format:

After `'<span class="prod-count">' + items.length + '</span>'`, replace with logic that checks if filters are active:

```javascript
var matchedCount = matchedFilenames !== null
  ? items.filter(function (t) { return isTaskMatched(t); }).length
  : items.length;
var countLabel = matchedFilenames !== null
  ? matchedCount + ' / ' + items.length
  : '' + items.length;
```

Use `countLabel` in the count span.

**5b.** In `createCard()`, after the card element is created and populated with HTML, add the dimmed/matched class:

```javascript
if (matchedFilenames !== null) {
  if (isTaskMatched(task)) {
    card.classList.add('prod-card-matched');
  } else {
    card.classList.add('prod-card-dimmed');
    card.draggable = false;
  }
}
```

**Verify:** Board view shows matching cards highlighted, non-matching dimmed. Column counts show "X / Y" format.

### Step 6: Integrate Filtering into Timeline View

**File:** `forge-shell/app/js/tasks.js`

In the timeline renderer, when creating task bar elements, add dimmed class for non-matching tasks:

```javascript
if (matchedFilenames !== null && !isTaskMatched(task)) {
  barEl.classList.add('prod-tl-dimmed');
}
```

Same for the "no due date" chips at the bottom.

**Verify:** Timeline bars dim for non-matching tasks. Today line stays visible.

### Step 7: Integrate Filtering into Summary View

**File:** `forge-shell/app/js/tasks.js`

In `renderSummary()`, replace `tasks` with `getFilteredTasks()` for all stat computations. Add a filtered badge when filters are active:

```javascript
var sourceTasks = getFilteredTasks();
var isFiltered = matchedFilenames !== null;
// ... use sourceTasks instead of tasks for all stats
// Add badge: if (isFiltered) { headerHtml += '<span class="prod-filtered-badge">Filtered (' + sourceTasks.length + ' of ' + tasks.length + ')</span>'; }
```

**Verify:** Summary stats reflect filtered set. Badge appears when filtered.

### Step 8: Integrate Filtering into Workload View

**File:** `forge-shell/app/js/tasks.js`

In workload renderer:
- Lane status bars: compute from filtered tasks only
- Mini-cards: add `.prod-wl-dimmed` class for non-matching
- Lane header counts: show "X / Y" when filtered

**Verify:** Workload lanes show dimmed cards. Status bars reflect filtered set.

### Step 9: Integrate Filtering into Matrix View

**File:** `forge-shell/app/js/tasks.js`

In matrix renderer:
- Cell counts: compute from filtered tasks only
- Heat coloring: based on filtered counts
- Mini-cards: add `.prod-matrix-dimmed` class for non-matching

**Verify:** Matrix cells reflect filtered counts. Non-matching mini-cards dimmed.

### Step 10: Wire Up hideDone ↔ Search Interaction

**File:** `forge-shell/app/js/tasks.js`

In the existing `toggleHideDone()` function, add a call to `syncHideDoneChip()` after toggling `hideDone`:

```javascript
syncHideDoneChip();
if (matchedFilenames !== null) applyFilters();
```

**Verify:** Toggle hideDone while search is open → Done chip hides/shows. Done filter clears if hideDone turns on.

### Step 11: Restore Search Strip State on Init

**File:** `forge-shell/app/js/tasks.js`

In the `init()` function, after scaffold and data load, restore search strip visibility:

```javascript
try {
  var stored = localStorage.getItem('forge-shell-tasks-search-open');
  if (stored === '1') toggleSearchStrip();
} catch (e) { /* ignore */ }
```

Also call `populateAssigneeDropdown()` after tasks are loaded.

**Verify:** Close and reopen app with strip open → strip restores.

### Step 12: Handle External File Changes

**File:** `forge-shell/app/js/tasks.js`

In the existing external change handler (the function that re-parses task files), add after tasks are reloaded:

```javascript
if (matchedFilenames !== null) {
  computeFilteredSet();
  updateFilterCount();
}
populateAssigneeDropdown();
```

**Verify:** Edit a task file externally while filtered → filter re-applies correctly.

## Estimated Scope

- **CSS additions:** ~80 lines in `productivity.css`
- **JS additions:** ~180 lines in `tasks.js` (state, helpers, DOM, events)
- **JS modifications:** ~30 lines across existing view renderers (adding dimmed/matched checks)
- **Total:** ~290 lines of new/modified code across 2 files

## Risks

| Risk | Mitigation |
|------|------------|
| CSS transition conflicts with existing card animations | Filter strip uses `max-height` (not `height`), card dimming uses `opacity`/`filter` — no overlap with existing `box-shadow` transitions |
| Performance with many tasks | Set-based lookup is O(1), full filter computation is O(n) with 150ms debounce — no concern under 500 tasks |
| Keyboard shortcut conflicts | `Cmd+F` only intercepted when tasks view is active; falls through to browser default otherwise |
| View renderers get complex | Each renderer adds 3-5 lines max for the matched/dimmed check — minimal complexity increase |
