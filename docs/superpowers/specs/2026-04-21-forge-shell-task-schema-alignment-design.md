# Forge Shell — Task Schema Alignment Design

**Date:** 2026-04-21
**Author:** Jeremy (with Claude)
**Repo:** `/Users/jeremybrice/Documents/GitHub/the-forge-feature/`
**Primary file:** `forge-shell/app/js/tasks.js`
**Source work order:** [`docs/forge-shell-schema-alignment.md`](../../forge-shell-schema-alignment.md) — refined here with resolved open decisions.

---

## 1. Problem

Task cards in the sibling `cowork-database/` repo live as `.md` files under `cowork-database/tasks/`. Two competing vocabularies accumulated:

- **forge-lib canonical** (`Open | In Progress | Blocked | Completed | Cancelled`, integer priority 1–5) — defined in `cowork-database/forge-lib/schemas/task.json`, enforced by the Python CLI.
- **Forge shell UI** (`active | waiting | someday | done`, string priority `high | medium | low`) — hardcoded in `forge-shell/app/js/tasks.js` in six places, with silent `active` fallback on parse and silent drop from workload counts.

Every shell edit coerced tasks into the non-canonical vocabulary. `cowork-database` was migrated on 2026-04-20 (175 files normalized, lint guard added at `forge-lib/scripts/check_task_status.py`). **The shell must catch up before the next user edit**, or it will write legacy vocabulary back into freshly-canonicalized files.

## 2. Scope

**In scope:** `forge-shell/app/js/tasks.js` only.

**Out of scope (verified):**
- `card-data.js` uses card lifecycle vocabulary (`complete`, `current`, `superseded`) — different schema, unaffected.
- `` contains no legacy task-vocabulary literals.
- `roadmap.js` does not touch tasks.
- No shared `task-schema.js` module — constants live at top of `tasks.js`. Single-consumer YAGNI.
- Operational safety (banner / launch-block) — sole-user repo, pause edits until fix lands; no mitigation scaffolding.

## 3. Target state

### 3.1 Constants (top of `tasks.js`)

```js
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
// FontAwesome classes — match existing shell icon convention (not emoji).
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
// Reuse the existing 3-class chip palette — no new CSS.
const PRIORITY_CHIP_CLASS = {
  1: 'prod-chip-high',
  2: 'prod-chip-high',
  3: 'prod-chip-medium',
  4: 'prod-chip-low',
  5: 'prod-chip-low',
};
```

### 3.2 UI contract

- **Status dropdown:** 5 options; `value` matches canonical casing exactly; display labels via `STATUS_LABELS`.
- **Priority dropdown:** 6 options — P1–P5 plus a 6th "— (no priority)" that serializes as `null`. Preserves null as a first-class "untriaged" state (11 existing files in `cowork-database/tasks/` use it).
- **Priority chip:** `PRIORITY_CHIP_CLASS[priority]` for 1–5. For `null`, chip is either omitted or rendered with a neutral/muted class (implementation plan picks exact treatment; no new CSS colors).
- **Status filter chips:** 5 chips with `data-value` in canonical casing.

### 3.3 Validation contract (asymmetric)

**Parse time (`parseTaskFile`, ~line 658):** tolerant — warn, don't coerce.

```js
if (!STATUS_VALUES.includes(status)) {
  console.warn(`[forge-shell] Task file has invalid status: ${JSON.stringify(status)}. File: ${filename}. Valid: ${STATUS_VALUES.join(', ')}`);
}
if (priority != null && !PRIORITY_VALUES.includes(priority)) {
  console.warn(`[forge-shell] Task file has invalid priority: ${JSON.stringify(priority)}. File: ${filename}. Valid: 1-5 or null.`);
}
```

Silent coercion is the pattern that caused the original drift. Warnings must surface loudly and let the user see + fix.

**Save time (`serializeTaskFile`, ~line 686):** strict — throw, caught by save flow and surfaced via `ForgeUtils.Toast.show(msg, 'error')` (existing helper at `utils.js:603`).

```js
if (!STATUS_VALUES.includes(fm.status)) {
  throw new Error(`Cannot save task: invalid status ${JSON.stringify(fm.status)}. Must be one of: ${STATUS_VALUES.join(', ')}`);
}
if (fm.priority != null && !PRIORITY_VALUES.includes(fm.priority)) {
  throw new Error(`Cannot save task: invalid priority ${JSON.stringify(fm.priority)}. Must be integer 1-5 or null.`);
}
```

## 4. Change inventory

All locations below are in `forge-shell/app/js/tasks.js`. Line numbers are from the 2026-04-21 snapshot; prefer searching by string literal if drift occurs.

### 4.1 Structural (collapse six arrays to one constant)

| Area | Line(s) | Change |
|---|---|---|
| Status enum array | 958–959 | reference `STATUS_VALUES` |
| Status dropdown | 1528 | iterate `STATUS_VALUES`, labels via `STATUS_LABELS` |
| Status donut iteration | 2210 | reference `STATUS_VALUES` |
| Status donut legend | 2245 | reference `STATUS_VALUES` |
| Status workload bar | 2429 | reference `STATUS_VALUES` |
| Status matrix grouping | 2485–2486 | reference `STATUS_VALUES` |

### 4.2 Filter chips and lookups

| Area | Line(s) | Change |
|---|---|---|
| Status filter chips | 301–304 | 5 chips with canonical `data-value` |
| Labels/icons map | 960–971 | replace with `STATUS_LABELS` + `STATUS_ICONS` |

### 4.3 Fallback defaults

| Line | Current | Change |
|---|---|---|
| 671 | `status = data.status \|\| 'active'` | `DEFAULT_STATUS` |
| 133, 202, 976, 2145, 2406, 2452 | `'active'` literal | `DEFAULT_STATUS` |
| 672 | `priority = data.priority \|\| 'medium'` | Rewrite to preserve null: `priority = ('priority' in data) ? data.priority : DEFAULT_PRIORITY`. Current `\|\|` coerces `null → 'medium'`, which is the silent-coercion pattern we're removing. New form: only apply `DEFAULT_PRIORITY` when the frontmatter key is entirely absent (new tasks); existing `priority: null` round-trips as null. |

### 4.4 Done-check classification (11 sites)

| Line | Context | Classification |
|---|---|---|
| 144 | `isOverdue` task detail | `!TERMINAL_STATUSES.includes(status)` |
| 1108 | `isOverdue` list row | `!TERMINAL_STATUSES.includes(status)` |
| 1991 | `hideDone` timeline | `!TERMINAL_STATUSES.includes(t.status)` |
| 2049 | `isOverdue` chart prep | `!TERMINAL_STATUSES.includes(status)` |
| 2147 | `done++` / `nonDone` bucket | **Refactor away.** `statusCounts` becomes canonical 5-bucket; sort-to-bottom logic uses `TERMINAL_STATUSES.includes(s)`. |
| 2153 | overdue counter | `!TERMINAL_STATUSES.includes(s)` |
| 2183 | `completedLast30` velocity | **Strict `status === 'Completed'`** — velocity metric excludes cancelled work |
| 2293 | upcoming/due-soon | `!TERMINAL_STATUSES.includes(t.status)` |
| 2346 | `hideDone` workload | `!TERMINAL_STATUSES.includes(t.status)` |
| 2462 | `isOverdue` matrix cell | `!TERMINAL_STATUSES.includes(status)` |
| 2503 | `hideDone` matrix | `!TERMINAL_STATUSES.includes(t.status)` |

Net: 9 terminal-checks, 1 strict Completed, 1 refactor.

### 4.5 Priority

| Line | Change |
|---|---|
| 1529 | Render 6 options (P1–P5 + "— (no priority)"); serialize P1–P5 as integer, no-priority as `null` |
| 1088, 131, 199, 295–297 | Replace string-label branching with `PRIORITY_CHIP_CLASS[p]` lookup; null → neutral/omit |
| 2141, 2150–2151 | `priorityCounts` keyed by 1..5 (drop string buckets); increment only when `p` is in `PRIORITY_VALUES` |

### 4.5.1 `_buildField` helper extension (line 1560)

Current `_buildField` always emits `<option value="">— None —</option>` before rendered options. For status this is invalid (no null-status state); for priority it's reusable as the null-priority slot.

Extend the helper to accept two new opts:
- `nullable: false` → suppress the leading `<option value="">`
- `nullLabel: '— (no priority)'` → customize the blank-option label when `nullable` is truthy

Also extend `options` items to accept `{value, label}` objects (in addition to plain strings) so priority can render `value=1, label='P1 – Critical'`. Keep the existing string-array behavior for back-compat with other call sites.

Call-site usage:
- Status (1528): `{ options: STATUS_VALUES, nullable: false }` (values and labels coincide, so plain strings still work — `STATUS_LABELS` only matters for filter chips and status-bucket display)
- Priority (1529): `{ options: Object.entries(PRIORITY_LABELS).map(([v, l]) => ({value: Number(v), label: l})), nullable: true, nullLabel: '— (no priority)' }`

### 4.5.2 Priority parse coercion (parseTaskFile, line 672)

`parseYAML` returns strings, not numbers — `priority: 3` parses to `"3"`. To preserve null AND coerce integers AND let invalid values fall through for validator warning:

```js
var priority;
if (!('priority' in frontmatter)) {
  priority = DEFAULT_PRIORITY;
} else if (frontmatter.priority === null) {
  priority = null;
} else {
  var n = parseInt(frontmatter.priority, 10);
  priority = (isNaN(n) || String(n) !== String(frontmatter.priority).trim())
    ? frontmatter.priority  // preserve raw invalid value so validator can warn
    : n;
}
```

### 4.6 Parse / save guards

| Function | Line | Change |
|---|---|---|
| `parseTaskFile` | ~658 | Add warn-only validator (§3.3) |
| `serializeTaskFile` | ~686 | Add throw-on-invalid guard (§3.3); save flow catches and calls `ForgeUtils.Toast.show(e.message, 'error')` |

## 5. Smoke test checklist

Every item must pass before the change is called done.

1. **Dropdowns.** Load `cowork-database/tasks/`. Status dropdown shows 5 options; priority dropdown shows 6 (P1–P5 + no-priority).
2. **Filter chips.** 5 chips render. Click each — filters correctly. Devtools shows `data-value` in canonical casing.
3. **Workload view.** "Unassigned" bucket contains only genuinely unassigned tasks (no status-drift noise).
4. **Status round-trip.** For each of {Open, In Progress, Blocked, Completed, Cancelled}: pick a task, set status, save, close, re-open → frontmatter persists with exact canonical value.
5. **Priority round-trip.** For each of {1, 2, 3, 4, 5}: set priority, save, reload → frontmatter is integer. Chip class: 1,2 → `prod-chip-high`; 3 → `prod-chip-medium`; 4,5 → `prod-chip-low`.
6. **Null-priority round-trip.** Pick a task with `priority: null`, confirm dropdown shows "— (no priority)" selected and chip is neutral/hidden. Set another task to "— (no priority)", save, reload → `priority: null` persists.
7. **Parse-time warning.** Hand-edit a task file to `status: banana`, reload shell → console shows `[forge-shell]` warning naming the file and value. Task loads (no crash).
8. **Save-time guard.** Via devtools, force `fm.status = 'banana'` on an in-memory task, click save → save is rejected, toast shows error, file on disk unchanged.
9. **Terminal-state filters.** Toggle "hide done" → both `Completed` and `Cancelled` tasks hide. Toggle off → both reappear.
10. **Velocity metric.** Cancelled tasks in the last 30 days do **not** increment `completedLast30`.
11. **No visual regression.** Priority chip colors identical to pre-change palette.

## 6. Done criteria

- All 5 canonical status values accepted + persisted.
- Priority persisted as integer 1–5, or `null` for untriaged tasks.
- No silent coercion in parse or save path.
- Existing 3-class chip CSS reused; no new chip styles or colors.
- Parse-time warnings + save-time guards in place; errors surface as toasts.
- All smoke-test items pass.

## 7. Reference — cowork-database changes already shipped

For context when reviewing:

- `forge-lib/core/task_ops.py` — `normalize_status()`, `normalize_priority()`, `_STATUS_NORMALIZATION`, `_PRIORITY_NORMALIZATION`, `VALID_PRIORITIES`. `create_task` / `update_task` normalize on input, reject unknowns.
- `forge-lib/scripts/migrate_task_statuses.py` — one-shot migration (already run; kept for future drift mop-up).
- `forge-lib/scripts/check_task_status.py` — lint guard, non-zero exit on off-canonical values.
- `tasks/task-*.md` — 175 files canonical: 38 Open, 1 In Progress, 114 Completed, 22 Cancelled. Priority: 25 P1, 79 P2, 50 P3, 10 P4, 11 null.
- `tasks/index.json` — rebuilt, in sync.

Unchanged (already canonical): `.claude/commands/tasks-forge/*`, `.claude/skills/tasks-forge/`, `.claude/agents/forge-outlook-capture.md`.
