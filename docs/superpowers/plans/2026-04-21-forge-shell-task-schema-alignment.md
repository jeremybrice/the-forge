# Forge Shell Task Schema Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `forge-shell/app/js/tasks.js` with the forge-lib canonical task schema (5-value status enum, integer priority 1–5 with nullable state) so the shell stops coercing freshly-migrated task files back into legacy vocabulary on save.

**Architecture:** Single-file refactor. Extract one constants block at top of `tasks.js` and reference it everywhere (collapses six hardcoded arrays into one source of truth). Add parse-time warning + save-time throw-on-invalid contract with errors surfaced via the existing `ForgeUtils.Toast` helper. Priority `null` is preserved as a first-class "untriaged" state via a 6th dropdown option.

**Tech Stack:** Vanilla JavaScript (IIFE module pattern), Tauri desktop shell, FontAwesome icons, existing `ForgeUtils.Toast` helper (`utils.js:603`), custom `parseYAML` (`tasks.js:586`).

**Source spec:** `docs/superpowers/specs/2026-04-21-forge-shell-task-schema-alignment-design.md` — read this first; it has the full target state, change inventory, and smoke-test checklist this plan implements.

**Verification mode:** No JS test framework exists (`package.json` has `"test": "echo \"No tests configured yet\""`). All verification is manual — launch the Tauri dev build, load `cowork-database/tasks/`, observe UI + devtools console. Each task's "verify" step gives the exact observation needed.

**Branch:** work on current branch (`memory`). Commit after every task.

---

## Task 1: Extract schema constants at top of `tasks.js`

**Files:**
- Modify: `forge-shell/app/js/tasks.js` (insert new block after the `'use strict'` state declarations, around line 30)

- [ ] **Step 1.1: Add constants block**

Insert immediately after line 28 (`let suppressExternalToasts = false;`) and before line 30 (`/* Active view tab */`):

```js
  /* ══════════════════════════════════════════════════════════
     Task Schema (canonical — see forge-lib/schemas/task.json)
     ══════════════════════════════════════════════════════════ */
  const STATUS_VALUES = ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
  const TERMINAL_STATUSES = ['Completed', 'Cancelled'];
  const PRIORITY_VALUES = [1, 2, 3, 4, 5];
  const DEFAULT_STATUS = 'Open';
  const DEFAULT_PRIORITY = 3;

  const STATUS_LABELS = {
    'Open': 'Open',
    'In Progress': 'In Progress',
    'Blocked': 'Blocked',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled',
  };
  const STATUS_ICONS = {
    'Open': 'fa-regular fa-circle',
    'In Progress': 'fa-regular fa-square-caret-right',
    'Blocked': 'fa-regular fa-circle-pause',
    'Completed': 'fa-regular fa-square-check',
    'Cancelled': 'fa-regular fa-circle-xmark',
  };
  const PRIORITY_LABELS = {
    1: 'P1 – Critical',
    2: 'P2 – High',
    3: 'P3 – Medium',
    4: 'P4 – Low',
    5: 'P5 – Someday',
  };
  // Reuse existing 3-class chip palette — no new CSS.
  const PRIORITY_CHIP_CLASS = {
    1: 'prod-chip-high',
    2: 'prod-chip-high',
    3: 'prod-chip-medium',
    4: 'prod-chip-low',
    5: 'prod-chip-low',
  };
```

- [ ] **Step 1.2: Verify the app still launches**

Run: `cd forge-shell && npm run tauri:dev`
Expected: app opens without JS errors in the devtools console. The tasks view may still render with legacy labels — that's fine for this task.

- [ ] **Step 1.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "refactor(tasks.js): extract canonical schema constants at top of module"
```

---

## Task 2: Replace six hardcoded status arrays with `STATUS_VALUES`

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 957–959, 1528, 2210, 2245, 2429, 2485–2486

- [ ] **Step 2.1: Update grouping array at line 957–959**

Find:
```js
    var statuses = hideDone
      ? ['active', 'waiting', 'someday']
      : ['active', 'waiting', 'someday', 'done'];
```

Replace with:
```js
    var statuses = hideDone
      ? STATUS_VALUES.filter(function (s) { return !TERMINAL_STATUSES.includes(s); })
      : STATUS_VALUES.slice();
```

- [ ] **Step 2.2: Update donut iteration at line 2210**

Search for the next literal `['active', 'waiting', 'someday', 'done']` (donut iteration) and replace with `STATUS_VALUES.slice()`.

- [ ] **Step 2.3: Update donut legend at line 2245**

Next occurrence of `['active', 'waiting', 'someday', 'done']` → `STATUS_VALUES.slice()`.

- [ ] **Step 2.4: Update workload bar at line 2429**

Next occurrence → `STATUS_VALUES.slice()`.

- [ ] **Step 2.5: Update matrix grouping at line 2485–2486**

Next occurrence → `STATUS_VALUES.slice()`.

Search command to verify no literal legacy arrays remain:
```bash
grep -n "'active'.*'waiting'.*'someday'" forge-shell/app/js/tasks.js
```
Expected: no results.

- [ ] **Step 2.6: Launch and verify**

Run: `npm run tauri:dev` (from `forge-shell/`).
Open the tasks view. Expected: no new JS errors in console. The column/donut/workload/matrix views will show empty buckets (because actual task data has canonical values like `Open` but code is still keyed by legacy strings for status display). That's expected; later tasks fix display.

- [ ] **Step 2.7: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "refactor(tasks.js): reference STATUS_VALUES in six iteration sites"
```

---

## Task 3: Rewrite status filter chips and `statusLabels`/`statusIcons` lookups

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 301–304 (filter chips) and 960–971 (labels/icons maps)

- [ ] **Step 3.1: Replace filter chip HTML at 301–304**

Find the current block:
```js
              '<button class="prod-filter-chip" data-filter="status" data-value="active" aria-pressed="false">Active</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="waiting" aria-pressed="false">Waiting</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="someday" aria-pressed="false">Someday</button>' +
              '<button class="prod-filter-chip" data-filter="status" data-value="done" data-ref="chip-done" aria-pressed="false">Done</button>' +
```

Replace with (keep the surrounding `<div class="prod-filter-group">` wrapper — do not touch it):
```js
              STATUS_VALUES.map(function (s) {
                var refAttr = (s === 'Completed') ? ' data-ref="chip-done"' : '';
                return '<button class="prod-filter-chip" data-filter="status" data-value="' + esc(s) + '"' + refAttr + ' aria-pressed="false">' + esc(STATUS_LABELS[s]) + '</button>';
              }).join('') +
```

Rationale: `data-ref="chip-done"` was used by code elsewhere (grep confirms) to reference the "done" chip specifically — preserve it, mapped to the canonical `Completed` status.

- [ ] **Step 3.2: Replace `statusLabels` / `statusIcons` blocks at 960–971**

Find:
```js
    var statusLabels = {
      'active': 'Active',
      'waiting': 'Waiting On',
      'someday': 'Someday',
      'done': 'Done'
    };
    var statusIcons = {
      'active': 'fa-regular fa-square-caret-right',
      'waiting': 'fa-regular fa-circle-pause',
      'someday': 'fa-regular fa-calendar',
      'done': 'fa-regular fa-square-check'
    };
```

Delete both blocks. References to `statusLabels`/`statusIcons` in the surrounding rendering code must be updated to `STATUS_LABELS`/`STATUS_ICONS`. Use a grep to find every reference in-file:

```bash
grep -n "statusLabels\|statusIcons" forge-shell/app/js/tasks.js
```

For each match, replace the local-var name with the module-level constant.

- [ ] **Step 3.3: Verify `data-ref="chip-done"` still resolves**

```bash
grep -n "chip-done" forge-shell/app/js/tasks.js
```
Expected: the new filter-chip line AND the existing consumer (should be around 2100–2300 range, likely a visibility toggle). Consumer code still works because it queries by `data-ref`, which we preserved.

- [ ] **Step 3.4: Launch and verify**

Run: `npm run tauri:dev`.
Open tasks view. Expected:
- 5 filter chips render: "Open", "In Progress", "Blocked", "Completed", "Cancelled"
- Clicking each filter chip filters the task list (task data in `cowork-database/tasks/` is canonical, so filters work against canonical `data-value` attributes)
- Kanban column headers show 5 buckets with canonical labels + updated FA icons
- No JS console errors

- [ ] **Step 3.5: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): render 5 canonical status filter chips and column headers"
```

---

## Task 4: Extend `_buildField` helper with `nullable` / `nullLabel` / object options

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 1560–1581

- [ ] **Step 4.1: Replace the select branch**

Find lines 1566–1573:
```js
      if (type === 'select') {
        var options = opts.options || [];
        input = '<select data-task-field="' + key + '">' +
          '<option value="">&mdash; None &mdash;</option>' +
          options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') +
        '</select>';
      }
```

Replace with:
```js
      if (type === 'select') {
        var options = opts.options || [];
        var nullable = opts.nullable !== false;  // default true for back-compat
        var nullLabel = opts.nullLabel || '— None —';
        var nullOpt = nullable
          ? '<option value=""' + ((value === null || value === undefined || value === '') ? ' selected' : '') + '>' + esc(nullLabel) + '</option>'
          : '';
        input = '<select data-task-field="' + key + '">' +
          nullOpt +
          options.map(function (o) {
            var v = (o !== null && typeof o === 'object') ? o.value : o;
            var l = (o !== null && typeof o === 'object') ? o.label : o;
            var sel = (String(v) === String(value)) ? ' selected' : '';
            return '<option value="' + esc(String(v)) + '"' + sel + '>' + esc(l) + '</option>';
          }).join('') +
        '</select>';
      }
```

- [ ] **Step 4.2: Verify back-compat with other call sites**

Other `_buildField(..., 'select', ...)` calls in this file? Check:
```bash
grep -n "_buildField.*'select'" forge-shell/app/js/tasks.js
```
Expected: only lines 1528 and 1529 use `'select'`. Both are refactored in Tasks 5 and 8. No other consumers — extension is safe.

- [ ] **Step 4.3: Launch and verify**

Run: `npm run tauri:dev`. Edit a task. Status and priority dropdowns still render in their pre-Task-5 form (legacy options). No JS errors.

- [ ] **Step 4.4: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "refactor(tasks.js): extend _buildField with nullable and object options"
```

---

## Task 5: Rewrite status dropdown (line 1528)

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at line 1528

- [ ] **Step 5.1: Replace the status field call**

Find:
```js
      html += this._buildField('status', 'Status', 'select', task.status, { options: ['active', 'waiting', 'someday', 'done'] });
```

Replace with:
```js
      html += this._buildField('status', 'Status', 'select', task.status, { options: STATUS_VALUES, nullable: false });
```

- [ ] **Step 5.2: Launch and verify**

Run: `npm run tauri:dev`. Open a task editor. Expected:
- Status dropdown shows exactly 5 options: `Open`, `In Progress`, `Blocked`, `Completed`, `Cancelled`
- No leading "— None —" option
- The currently-saved status is selected
- Changing status and clicking Save does NOT yet validate — that's Task 14 — but the field value round-trips correctly through the form

- [ ] **Step 5.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): status dropdown renders 5 canonical options"
```

---

## Task 6: Swap all `'active'` fallback literals to `DEFAULT_STATUS`

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 133, 202, 671, 976, 2145, 2406, 2452

- [ ] **Step 6.1: Find all legacy-literal fallbacks**

```bash
grep -n "|| 'active'\|=== 'active'\|: 'active'\|= 'active'" forge-shell/app/js/tasks.js
```

- [ ] **Step 6.2: Replace each fallback site**

For each match where the intent is "use Open as the default when status is missing/falsy", change `'active'` → `DEFAULT_STATUS`.

Specifically:
- Line 133: `var s = task.status || 'active';` → `var s = task.status || DEFAULT_STATUS;`
- Line 202: same pattern
- Line 671 (`parseTaskFile`): `status: frontmatter.status || 'active',` → `status: frontmatter.status || DEFAULT_STATUS,`
- Line 976: `var status = task.status || 'active';` → `DEFAULT_STATUS`
- Line 2145: `var s = t.status || 'active';` → `DEFAULT_STATUS`
- Line 2406: `var s = t.status || 'active';` → `DEFAULT_STATUS`
- Line 2452: `var status = t.status || 'active';` → `DEFAULT_STATUS`

Do **not** touch `=== 'done'` or other comparison literals here — those belong to Tasks 10–12.

- [ ] **Step 6.3: Verify**

```bash
grep -n "|| 'active'" forge-shell/app/js/tasks.js
```
Expected: no results.

- [ ] **Step 6.4: Launch and verify**

Run: `npm run tauri:dev`. Load tasks. No JS errors. Tasks with missing status default to Open (visible in filters / column grouping).

- [ ] **Step 6.5: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "refactor(tasks.js): use DEFAULT_STATUS for all status fallbacks"
```

---

## Task 7: Rewrite priority parse in `parseTaskFile` (line 672)

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 667–683

- [ ] **Step 7.1: Replace the `return { ... }` block**

Find the current block at 667–683:
```js
    return {
      filename: filename,
      title: frontmatter.title || '',
      type: frontmatter.type || 'task',
      status: frontmatter.status || DEFAULT_STATUS,
      priority: frontmatter.priority || 'medium',
      ...
    };
```

Replace the `priority` line with explicit coercion (note: keep all other fields unchanged):
```js
    var priority;
    if (!('priority' in frontmatter)) {
      priority = DEFAULT_PRIORITY;
    } else if (frontmatter.priority === null) {
      priority = null;
    } else {
      var _rawP = String(frontmatter.priority).trim();
      var _n = parseInt(_rawP, 10);
      // Coerce only if the string fully represents the integer (rejects "3abc").
      priority = (isNaN(_n) || String(_n) !== _rawP) ? frontmatter.priority : _n;
    }

    return {
      filename: filename,
      title: frontmatter.title || '',
      type: frontmatter.type || 'task',
      status: frontmatter.status || DEFAULT_STATUS,
      priority: priority,
      assignee: frontmatter.assignee || null,
      creator: frontmatter.creator || null,
      created: frontmatter.created || '',
      updated: frontmatter.updated || '',
      due_date: frontmatter.due_date || null,
      dependencies: frontmatter.dependencies || [],
      tags: frontmatter.tags || [],
      external_link: frontmatter.external_link || null,
      external_id: frontmatter.external_id || null,
      body: body
    };
```

- [ ] **Step 7.2: Verify via devtools**

Run: `npm run tauri:dev`. Load `cowork-database/tasks/`. In devtools console:
```js
// Pick a task known to have priority: null (e.g., inspect any of the 11 null-priority files)
TasksView._tasks?.find(t => t.priority === null)
```
Expected: returns a task object (not undefined). Null priority is preserved, not coerced to 3.

For an integer-priority task:
```js
TasksView._tasks?.find(t => typeof t.priority === 'number')
```
Expected: returns a task with `priority: 1` (integer, not string).

Note: `TasksView._tasks` may not be the actual accessor — inspect how to reach the module's task array. If no public accessor, add a `window._DEBUG_tasks = tasks;` line temporarily (remove before commit) or re-verify via the kanban rendering.

- [ ] **Step 7.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "fix(tasks.js): preserve null priority and coerce integer priorities on parse"
```

---

## Task 8: Rewrite priority dropdown (line 1529)

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at line 1529

- [ ] **Step 8.1: Replace the priority field call**

Find:
```js
      html += this._buildField('priority', 'Priority', 'select', task.priority, { options: ['high', 'medium', 'low'] });
```

Replace with:
```js
      var priorityOptions = PRIORITY_VALUES.map(function (v) {
        return { value: v, label: PRIORITY_LABELS[v] };
      });
      html += this._buildField('priority', 'Priority', 'select', task.priority, {
        options: priorityOptions,
        nullable: true,
        nullLabel: '— (no priority)'
      });
```

- [ ] **Step 8.2: Launch and verify**

Run: `npm run tauri:dev`. Edit a task. Expected:
- Priority dropdown shows 6 options: "— (no priority)", "P1 – Critical", "P2 – High", "P3 – Medium", "P4 – Low", "P5 – Someday"
- For a task with `priority: 2`, "P2 – High" is selected
- For a task with `priority: null`, "— (no priority)" is selected
- Selecting "— (no priority)" and saving will (once Task 14 lands the save guard) write `priority: null` to YAML; for now it writes `priority: ` (empty) — Task 9 normalizes the serializer

- [ ] **Step 8.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): priority dropdown renders P1-P5 + null option"
```

---

## Task 9: Priority chip rendering + `priorityCounts` bucket refactor

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 131, 199, 295–297, 1088, 2141, 2150–2151

- [ ] **Step 9.1: Replace priority chip class lookups**

For each site that currently branches on `priority === 'high' | 'medium' | 'low'` to pick a CSS class, replace with `PRIORITY_CHIP_CLASS[priority]` or a null-safe variant. Find with:
```bash
grep -n "prod-chip-high\|prod-chip-medium\|prod-chip-low" forge-shell/app/js/tasks.js
```

Example pattern replacement. Before:
```js
var cls = task.priority === 'high' ? 'prod-chip-high'
        : task.priority === 'medium' ? 'prod-chip-medium'
        : 'prod-chip-low';
```
After:
```js
var cls = PRIORITY_CHIP_CLASS[task.priority] || 'prod-chip-muted';
```

For null priorities, the fallback `'prod-chip-muted'` tells the render layer to render nothing distinctive. If `prod-chip-muted` isn't already a defined class, handle null by omitting the chip entirely:
```js
var cls = PRIORITY_CHIP_CLASS[task.priority];
if (!cls) {
  // skip chip for null/unknown priority
  return '';
}
```
Pick the form that matches the surrounding code pattern — at each site, match what's idiomatic for the caller.

- [ ] **Step 9.2: Rewrite the priority filter chips at 295–297**

Find:
```js
              '<button class="prod-filter-chip prod-chip-high" data-filter="priority" data-value="high" aria-pressed="false">High</button>' +
              '<button class="prod-filter-chip prod-chip-medium" data-filter="priority" data-value="medium" aria-pressed="false">Medium</button>' +
              '<button class="prod-filter-chip prod-chip-low" data-filter="priority" data-value="low" aria-pressed="false">Low</button>' +
```

Replace with:
```js
              PRIORITY_VALUES.map(function (p) {
                return '<button class="prod-filter-chip ' + PRIORITY_CHIP_CLASS[p] + '" data-filter="priority" data-value="' + p + '" aria-pressed="false">' + esc(PRIORITY_LABELS[p]) + '</button>';
              }).join('') +
```

Note: `data-value` is now integer (`1`–`5`). The filter consumer code reads `data-value` as a string; matching logic will need to compare loosely (`==`) or coerce the task's priority to string. If the consumer does strict `===`, update it to `Number(chipValue) === task.priority`. Search:
```bash
grep -n "data-value\|data-filter.*priority" forge-shell/app/js/tasks.js
```
And verify the consumer handles integers correctly. Fix if needed.

- [ ] **Step 9.3: Refactor `priorityCounts` at lines 2141, 2150–2151**

Find:
```js
    var priorityCounts = { high: 0, medium: 0, low: 0 };
    ...
    var p = (t.priority || 'medium').toLowerCase();
    if (priorityCounts[p] !== undefined) priorityCounts[p]++;
```

Replace with:
```js
    var priorityCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, null: 0 };
    ...
    var p = (t.priority === null || t.priority === undefined) ? 'null' : t.priority;
    if (priorityCounts[p] !== undefined) priorityCounts[p]++;
```

Then update any downstream consumer that reads `priorityCounts.high / .medium / .low` to read `priorityCounts[1] + priorityCounts[2]`, `priorityCounts[3]`, `priorityCounts[4] + priorityCounts[5]` respectively (preserves the 3-band grouping for existing UI). Grep for consumers:
```bash
grep -n "priorityCounts" forge-shell/app/js/tasks.js
```

- [ ] **Step 9.4: Launch and verify**

Run: `npm run tauri:dev`. Expected:
- 5 priority filter chips ("P1 – Critical" … "P5 – Someday") render with correct color bands (P1/P2 red, P3 yellow, P4/P5 green or whatever the palette is)
- Priority chips in the task list render with matching colors
- Tasks with `priority: null` show no chip (or a muted one, depending on the Step 9.1 choice)
- Priority-band stats match expected totals (e.g., from spec §7: 25 P1 + 79 P2 in the "high" band, 50 in medium, 10 + 11 in low — though the 11 nulls are in the null bucket, not low)

- [ ] **Step 9.5: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): integer-keyed priority chips and bucket counts"
```

---

## Task 10: Done-check audit — 9 terminal-state sites

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 144, 1108, 1991, 2049, 2153, 2293, 2346, 2462, 2503

- [ ] **Step 10.1: Replace each site**

For each of the 9 sites below, replace the legacy expression with the canonical form. Pattern:
- `status !== 'done'` → `!TERMINAL_STATUSES.includes(status)`
- `t.status !== 'done'` → `!TERMINAL_STATUSES.includes(t.status)`
- `s !== 'done'` → `!TERMINAL_STATUSES.includes(s)`

Exact sites (line numbers from pre-refactor snapshot — if line numbers drift, search the surrounding snippet):

| Line | Before | After |
|---|---|---|
| 144 | `task.due_date < today && task.status !== 'done'` | `task.due_date < today && !TERMINAL_STATUSES.includes(task.status)` |
| 1108 | same | same |
| 1991 | `hideDone ? tasks.filter(function (t) { return t.status !== 'done'; }) : tasks` | `hideDone ? tasks.filter(function (t) { return !TERMINAL_STATUSES.includes(t.status); }) : tasks` |
| 2049 | `t.due_date < today && t.status !== 'done'` | `t.due_date < today && !TERMINAL_STATUSES.includes(t.status)` |
| 2153 | `t.due_date < today && s !== 'done'` | `t.due_date < today && !TERMINAL_STATUSES.includes(s)` |
| 2293 | `t.due_date && t.due_date !== 'null' && t.status !== 'done'` | `t.due_date && t.due_date !== 'null' && !TERMINAL_STATUSES.includes(t.status)` |
| 2346 | `hideDone ? tasks.filter(...t.status !== 'done'...)` | same replacement as 1991 |
| 2462 | `t.due_date < ... && status !== 'done'` | `... && !TERMINAL_STATUSES.includes(status)` |
| 2503 | `hideDone ? tasks.filter(...t.status !== 'done'...)` | same replacement as 1991 |

Do **not** touch lines 2147 or 2183 in this task — those are Tasks 11 and 12.

- [ ] **Step 10.2: Verify**

```bash
grep -n "!== 'done'\|=== 'done'" forge-shell/app/js/tasks.js
```
Expected: only lines ~2147 and ~2183 remain. All nine sites from the table are replaced.

- [ ] **Step 10.3: Launch and verify**

Run: `npm run tauri:dev`. Expected:
- "Hide done" toggle now hides both `Completed` **and** `Cancelled` tasks (confirm by picking a cancelled task and toggling)
- Cancelled tasks no longer appear in "overdue" counts or "upcoming" lists
- No JS errors

- [ ] **Step 10.4: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "fix(tasks.js): overdue and hide-done treat Cancelled as terminal"
```

---

## Task 11: Velocity metric — strict `=== 'Completed'` at line 2183

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at line 2183

- [ ] **Step 11.1: Replace**

Find:
```js
      if (t.status === 'done' && t.updated && t.updated >= thirtyAgoStr) {
        completedLast30++;
        dailyCompletions[t.updated] = (dailyCompletions[t.updated] || 0) + 1;
      }
```

Replace with:
```js
      if (t.status === 'Completed' && t.updated && t.updated >= thirtyAgoStr) {
        completedLast30++;
        dailyCompletions[t.updated] = (dailyCompletions[t.updated] || 0) + 1;
      }
```

Rationale: velocity counts shipped work only. Cancelled work is excluded by design.

- [ ] **Step 11.2: Verify**

Pick a task with `status: Cancelled` and `updated` in the last 30 days. Load the dashboard. Confirm `completedLast30` does NOT include it (inspect via devtools or the UI's velocity number before/after).

- [ ] **Step 11.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "fix(tasks.js): velocity metric excludes Cancelled work"
```

---

## Task 12: `statusCounts` refactor at 2140–2148

**Files:**
- Modify: `forge-shell/app/js/tasks.js` at lines 2140–2148

- [ ] **Step 12.1: Rewrite the status-count loop**

Find:
```js
    var statusCounts = { active: 0, waiting: 0, someday: 0, done: 0 };
    var priorityCounts = { high: 0, medium: 0, low: 0 };
    var tagCounts = {};

    sourceTasks.forEach(function (t) {
      var s = t.status || 'active';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
      if (s === 'done') done++;
      else nonDone.push(t);
      ...
    });
```

Replace with (note: `priorityCounts` was already rewritten in Task 9.3 — do not re-touch it here; this task touches only the `statusCounts` and `done`/`nonDone` bisection):

```js
    var statusCounts = {};
    STATUS_VALUES.forEach(function (s) { statusCounts[s] = 0; });
    // priorityCounts already initialized in Task 9.3 above
    var tagCounts = {};

    sourceTasks.forEach(function (t) {
      var s = t.status || DEFAULT_STATUS;
      if (statusCounts[s] !== undefined) statusCounts[s]++;
      if (TERMINAL_STATUSES.includes(s)) {
        done++;
      } else {
        nonDone.push(t);
      }
      ...
    });
```

- [ ] **Step 12.2: Audit consumers of `statusCounts.active | .waiting | .someday | .done`**

```bash
grep -n "statusCounts\." forge-shell/app/js/tasks.js
```

For each consumer that reads `statusCounts.done`, replace with `(statusCounts.Completed + statusCounts.Cancelled)` or `statusCounts['Completed']` alone, depending on semantic (consult spec §4.4 classification). For `statusCounts.active`, replace with `statusCounts['Open'] + statusCounts['In Progress']` (closest semantic mapping) or the appropriate canonical key.

Best practice: where a consumer was doing `statusCounts.done`, ask "does this consumer mean 'completed-only' or 'terminal'?". The sidebar "done count" KPI is likely terminal (both). A "shipped velocity" counter is Completed-only. Apply spec §4.4 judgment.

- [ ] **Step 12.3: Launch and verify**

Run: `npm run tauri:dev`. Expected:
- Status-count stats in the analytics panel show 5 buckets with correct totals
- "Unassigned" / "drift" noise is gone (this is the key signal that the whole refactor worked — per spec §7, for example, 38 Open + 1 In Progress + 114 Completed + 22 Cancelled should match the 175-task total)

- [ ] **Step 12.4: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "refactor(tasks.js): canonical 5-bucket statusCounts with terminal bisection"
```

---

## Task 13: Parse-time validator (warn, don't coerce)

**Files:**
- Modify: `forge-shell/app/js/tasks.js` inside `parseTaskFile` around line 665 (after `var frontmatter = parseYAML(yamlStr);`)

- [ ] **Step 13.1: Insert validators**

After the existing line `var frontmatter = parseYAML(yamlStr);` and BEFORE the `priority` coercion block added in Task 7, insert:

```js
    if (frontmatter.status !== undefined && frontmatter.status !== null && !STATUS_VALUES.includes(frontmatter.status)) {
      console.warn('[forge-shell] Task file has invalid status: ' + JSON.stringify(frontmatter.status) + '. File: ' + filename + '. Valid: ' + STATUS_VALUES.join(', '));
    }
    if (frontmatter.priority !== undefined && frontmatter.priority !== null) {
      var _testN = parseInt(String(frontmatter.priority).trim(), 10);
      if (isNaN(_testN) || !PRIORITY_VALUES.includes(_testN) || String(_testN) !== String(frontmatter.priority).trim()) {
        console.warn('[forge-shell] Task file has invalid priority: ' + JSON.stringify(frontmatter.priority) + '. File: ' + filename + '. Valid: 1-5 or null.');
      }
    }
```

Do **not** coerce the value to a default here. The warning surfaces the problem; the rest of the parse path handles the invalid value by passing it through (or Task 7's coercion turns it into a recoverable form).

- [ ] **Step 13.2: Verify**

Hand-edit one task file in `cowork-database/tasks/` — for example, temporarily change a `status:` line to `status: banana`. Reload the shell.

Expected in the devtools console:
```
[forge-shell] Task file has invalid status: "banana". File: task-XXX.md. Valid: Open, In Progress, Blocked, Completed, Cancelled
```

The task still loads (no crash). Revert the edit in the file.

- [ ] **Step 13.3: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): parse-time warning for off-canonical status and priority"
```

---

## Task 14: Save-time guard with toast error surface

**Files:**
- Modify: `forge-shell/app/js/tasks.js` inside `serializeTaskFile` at line 686 AND the save call site (wrap with try/catch + toast)

- [ ] **Step 14.1: Add guard at top of `serializeTaskFile`**

Find line 686:
```js
  function serializeTaskFile(task) {
    var yaml = '---\n';
```

Replace with:
```js
  function serializeTaskFile(task) {
    if (!STATUS_VALUES.includes(task.status)) {
      throw new Error('Cannot save task: invalid status ' + JSON.stringify(task.status) + '. Must be one of: ' + STATUS_VALUES.join(', '));
    }
    if (task.priority !== null && task.priority !== undefined && !PRIORITY_VALUES.includes(task.priority)) {
      throw new Error('Cannot save task: invalid priority ' + JSON.stringify(task.priority) + '. Must be integer 1-5 or null.');
    }
    var yaml = '---\n';
```

- [ ] **Step 14.2: Fix priority serialization for null**

Find line 691:
```js
    yaml += 'priority: ' + task.priority + '\n';
```

Replace with:
```js
    yaml += 'priority: ' + (task.priority === null || task.priority === undefined ? 'null' : task.priority) + '\n';
```

Rationale: JS `null` coerces to string `"null"` via `+`, so the current line happens to produce the right YAML, but this is fragile — undefined coerces to `"undefined"` which is invalid YAML. Explicit null serialization removes the ambiguity.

- [ ] **Step 14.3: Wrap the save flow with try/catch + toast**

Find the save code path (around line 727, `async function saveTask` or similar — grep `writeFile(tasksDirHandle`):

```bash
grep -n "ForgeFS.writeFile(tasksDirHandle" forge-shell/app/js/tasks.js
```

At that call site, the serialization probably looks like:
```js
      var content = serializeTaskFile(task);
      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);
```

Wrap with:
```js
      var content;
      try {
        content = serializeTaskFile(task);
      } catch (e) {
        ForgeUtils.Toast.show(e.message, 'error', 6000);
        return;  // abort save; leave disk file unchanged
      }
      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);
```

Ensure any surrounding state flags (`isSaving`, `hasChanges`) are reset on the error branch so the UI isn't stuck. Inspect the surrounding function and adjust accordingly — if `isSaving = true` was set before the serialize call, reset it to `false` in the catch.

- [ ] **Step 14.4: Verify**

Run: `npm run tauri:dev`. Load tasks. In devtools console, grab a task reference and force an invalid status:

```js
// Find the tasks array (adjust accessor based on module exposure)
var badTask = TasksView._tasks[0];
badTask.status = 'banana';
// Trigger save through the UI — e.g., click a save button on an open editor
```

Expected:
- Toast appears: "Cannot save task: invalid status "banana". Must be one of: Open, In Progress, Blocked, Completed, Cancelled"
- The task file on disk is unchanged (verify via `cat cowork-database/tasks/task-XXX.md`)

Same with priority: set `badTask.priority = 99`, trigger save, confirm toast + unchanged file.

- [ ] **Step 14.5: Commit**

```bash
git add forge-shell/app/js/tasks.js
git commit -m "feat(tasks.js): save-time guard rejects off-canonical status/priority via toast"
```

---

## Task 15: Full smoke-test pass

**Files:** none (verification only).

Run every item in the spec's §5 smoke-test checklist. For each, confirm pass before proceeding.

- [ ] **Step 15.1: Dropdowns (§5.1)**
  Status dropdown shows 5 options; priority dropdown shows 6 (P1–P5 + "— (no priority)").

- [ ] **Step 15.2: Filter chips (§5.2)**
  5 status chips render. Clicking each filters correctly. Devtools shows `data-value` in canonical casing.

- [ ] **Step 15.3: Workload view (§5.3)**
  "Unassigned" bucket contains only genuinely unassigned tasks.

- [ ] **Step 15.4: Status round-trip (§5.4)**
  For each of {Open, In Progress, Blocked, Completed, Cancelled}: set status via UI, save, reload shell, confirm frontmatter has canonical value.

- [ ] **Step 15.5: Priority round-trip (§5.5)**
  For each of {1, 2, 3, 4, 5}: set priority, save, reload, confirm frontmatter has integer. Chip class: 1,2→high; 3→medium; 4,5→low.

- [ ] **Step 15.6: Null-priority round-trip (§5.6)**
  Pick a `priority: null` task → dropdown shows "— (no priority)" selected, chip is neutral/omitted. Set another task to "— (no priority)", save, reload, confirm `priority: null` persists.

- [ ] **Step 15.7: Parse-time warning (§5.7)**
  Hand-edit a task to `status: banana`, reload → console warning names file and invalid value. Task loads (no crash). Revert edit.

- [ ] **Step 15.8: Save-time guard (§5.8)**
  Via devtools, force `fm.status = 'banana'`, click save → toast shows error, file unchanged.

- [ ] **Step 15.9: Terminal-state filters (§5.9)**
  Toggle "hide done" → Completed AND Cancelled both hide. Toggle off → both reappear.

- [ ] **Step 15.10: Velocity metric (§5.10)**
  Cancelled tasks updated in last 30 days do NOT increment `completedLast30`.

- [ ] **Step 15.11: Visual regression (§5.11)**
  Priority chip colors identical to pre-change (same 3-class palette, same hex).

- [ ] **Step 15.12: Clean up commit log**
  Review `git log --oneline` on branch — each commit message clear, no WIP debris.

- [ ] **Step 15.13: Final commit (only if any smoke-test revealed a fix)**

If a smoke test revealed a bug, fix it and commit with a descriptive message. Otherwise this task ends with no additional commit.

---

## Notes for the engineer

- **Line numbers drift.** After Task 1 inserts the constants block, every line below shifts down by ~40 lines. Always search by string literal instead of trusting the numbers in this plan.
- **Devtools reachability.** The `TasksView` module is an IIFE — internal state isn't publicly reachable by default. For verification steps that need to poke state, you may need to temporarily add `window._DEBUG_TASKSVIEW = { tasks, /* etc */ }` inside the IIFE. Remove those hooks before the final smoke-test commit.
- **Do not touch other `.js` files.** This plan is scoped to `tasks.js`. If you find yourself editing `card-data.js`, `outlook-forge.js`, `productivity.js`, or anything else, stop and re-read the spec's §2 scope section.
- **Don't skip manual verification steps.** No test framework means the manual checks are the only safety net. Take 30 seconds per verify step to actually observe the thing; don't guess.
- **Data at risk.** Task files live in `cowork-database/tasks/` (sibling repo). A bug in the save path could corrupt migrated files. After Task 14 lands, try the save flow on a deliberately-invalid task first (devtools force-set) before letting real edits flow through — that confirms the guard fires before any real write.
