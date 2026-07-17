# Forge Shell UX Consistency Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight work packages of the forge-shell UX consistency program as nine stacked PRs: stop the Tasks view destroying frontmatter (WP1), unify markdown rendering with tables + safe links (WP7), make every overlay dismissible and `Confirm` keyboard-complete (WP6), standardize failure feedback with optimistic rollback (WP3), extract a shared card write service and give Product Forge inline status / create / delete (WP5), fix freshness end-to-end — watcher mapping, batching, own-write suppression, memory/audio change detection (WP2), repair in-view discovery and add a global Cmd+K palette (WP4), and remove the dead productivity plugin (WP8).

**Architecture:** Pure logic lands in UMD helper modules (`window.*` + `module.exports`) with `node --test` suites — the `roadmap.helpers.js` standard (D1). Two write domains stay separate (D3): cards route through the new `card-write.js` service; tasks serialize through `TasksHelpers`. DOM controllers stay thin consumers. No build step; every change must keep working in all three ForgeFS runtimes (Tauri desktop, Chrome File System Access tab, server/cmux).

**Tech Stack:** Vanilla JS (ES5-flavored, `'use strict'`), `node --test`, shared `ForgeUtils` / `ForgeFS`, Font Awesome, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-forge-shell-ux-consistency-program.md` — WP designs, D1–D9 program decisions, C1–C10 sequencing resolutions (binding), O1–O12 open-question defaults, PR Plan.

## Global Constraints

- All commands run from `forge-shell/` unless noted.
- `npm test` green at every commit; baseline before PR1 is **103/103**. PRs 1–8 each add or extend a `node --test` suite.
- No new npm dependencies. No forge-lib changes (schemas, templates, CLI). No mobile/responsive CSS.
- No `prod-*` class-string renames anywhere (PR9 renames only the file `productivity.css` → `tasks-memory.css`).
- Task writes never route through `card-write.js`; card writes never route through `TasksHelpers` (C7).
- Portable writes only: `ForgeFS.writeFile(handle, 'dir/file.md', content)` — never browser FSA stubs from `store.fileHandles`.
- Overlay z-index ladder (D5): view surfaces ≤ 1200 < palette 1250 < `#confirm-dialog` 1300.
- Feedback convention (D4): errors are always 6s error toasts; the status pill is ambient success only; unreadable files get a banner and are never treated as deleted.
- New helper files use the exact UMD wrapper pattern from `app/js/roadmap.helpers.js`; `<script>` tags load helpers before their consumers in `app/index.html`.
- **Anchors, not line numbers:** line references in this plan are valid at each PR's base (its predecessor's tip). Where an earlier program PR rewrites a region, tasks quote the code landmark "as landed by PRn". Implementers of PR4 onward rebase against the merged tree, never against pre-stack line numbers.

## Stacked-PR mechanics

- Branch per PR: `ux-program/pr-N-<slug>`, branched from the previous PR's branch (PR1 branches from `main`). Diffs vs `main` are cumulative — the repo's #35–#41 convention.
- PRs open against `main` and merge strictly in order 1→9. After each merge, rebase the remaining stack onto `main`.
- Hot-file touch order (rebase planning): `tasks.js` 1→3→4→7 · `memory.js` 2→3→4→5→6 · `product-forge.js` 4→5→6 · `roadmap.js` 2→5→6→7 · `shell.js` 6→8→9 · `utils.js` 2→3→4 (disjoint blocks: MD delegate / Confirm / Toast+ScanBanner) · `productivity.css` 1→4→9 (rename) · `index.html` one-line script inserts in most PRs · `STYLE_GUIDE.md` sections in 2/3/4/5 and table edits in 9 (append-only or hunk-isolated).
- Every PR ends the same way: full suite, three-runtime smoke of its acceptance criteria, push, `gh pr create --base main`.

## Executor notes

- Script load order in `app/index.html` is semantic, not cosmetic: `md.helpers.js` must load **before** `utils.js` (the `ForgeUtils.MD` delegate reads `window.MDHelpers` at script evaluation time), and `shell.helpers.js` loads immediately before `shell.js` (PR8's hooks rely on that placement).
- Where a task quotes a region an earlier program PR landed, keep the landed body verbatim and apply only the described insertions — match quoted landmarks, never pre-stack line numbers.
- Verbatim ports (PR5's roadmap → module moves) must not be reformatted in transit; their review contract is a side-by-side diff of old body vs new module.
- Three-runtime smoke: the Tauri column needs a local Rust toolchain — if unavailable, run the Chrome-FSA and server smokes and say so in the PR body. Server mode (`node server.js`, embedded/cmux browsers) selects projects via a typed-path dialog — use it for the mktemp fixture projects; the native FSA picker only exists in a real Chrome/Edge tab.
- This plan contains fenced blocks whose bodies include `##`-prefixed lines (e.g. Task 5.9's markdown fence) — any TOC or section tooling run over it must be fence-aware.

## New shared modules (one `node --test` suite each)

| Module | PR | Exposes |
|---|---|---|
| `tasks.helpers.js` | 1 | `TasksHelpers.parseTaskFile` / `serializeTaskFile` — shape-preserving frontmatter round-trip |
| `md.helpers.js` | 2 | `MDHelpers.render` — the one markdown renderer (pipe tables, hardened links); `ForgeUtils.MD` becomes a delegate |
| `modal.helpers.js` | 3 | `ModalHelpers` — Escape/backdrop/focus contract behind the keyboard-complete `ForgeUtils.Confirm` |
| `feedback.helpers.js` | 4 | Feedback-convention helpers + `ScanBanner` (unreadable-file surface) |
| `card-write.js` + `status-menu.js` | 5 | `createCardWriteService` (frontmatter patch, status write, `onBeforeWrite` hook) / `createOptimisticGuard` (incl. `hasPending()`) / `ForgeStatusMenu` |
| `shell.helpers.js` | 6 | `WATCH_GROUPS` path→plugins mapping + watcher batching logic |
| `shell-palette.helpers.js` + `shell-palette.js` | 8 | `ShellPalette` — Cmd+K overlay, entity index, fuzzy ranking, `invalidate()` |

---
## PR1 — Tasks data layer: round-trip frontmatter, parent chip, honest drag *(M)*

**Branch:** `ux-program/pr-1-tasks-data-layer` (from `main`) — **Contains:** WP1 (all) — **Depends on:** nothing; first PR in the stack, so all line numbers cite the repo as-is.
**Why:** every Tasks-board write silently deletes `parent`/`source`/unknown frontmatter keys, unconditionally emits keys that `forge-lib/schemas/task.json` (`additionalProperties: false`) forbids, and writes a stale `updated` date; the drag insertion line is fake; modal P1 saves throw. All paths below are relative to `forge-shell/` and all commands run from `forge-shell/`.

### Task 1.1: TasksHelpers module skeleton — constants, splitFrontmatter, small utils

**Files:**
- Create: `app/js/tasks.helpers.js`
- Create: `test/tasks.helpers.test.js`

**Interfaces:**
- Consumes: nothing — dependency-free UMD module, same wrapper as `app/js/roadmap.helpers.js` (window global + `module.exports`).
- Produces: `window.TasksHelpers` / `require('../app/js/tasks.helpers.js')` exposing schema constants (`STATUS_VALUES`, `TERMINAL_STATUSES`, `PRIORITY_VALUES`, `DEFAULT_STATUS`, `DEFAULT_PRIORITY`, `KNOWN_KEYS`, `TASK_FIELD_ORDER`) plus `splitFrontmatter`, `coercePriority`, `stripMdExt`, `isTaskRef`. Consumed by `tasks.js` (Task 1.4) and later by PR4's `writeTaskNow`.

- [ ] **Step 1: Write the failing tests**

Create `test/tasks.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/tasks.helpers.js');

/* ── Constants ── */

test('constants match the canonical task schema', () => {
  assert.deepEqual(H.STATUS_VALUES, ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled']);
  assert.deepEqual(H.TERMINAL_STATUSES, ['Completed', 'Cancelled']);
  assert.deepEqual(H.PRIORITY_VALUES, [1, 2, 3, 4, 5]);
  assert.equal(H.DEFAULT_STATUS, 'Open');
  assert.equal(H.DEFAULT_PRIORITY, 3);
  assert.ok(H.KNOWN_KEYS.includes('parent'));
  assert.ok(H.KNOWN_KEYS.includes('source'));
  assert.ok(Array.isArray(H.TASK_FIELD_ORDER));
});

/* ── splitFrontmatter ── */

test('splitFrontmatter: splits yaml and body at the first closing fence', () => {
  const r = H.splitFrontmatter('---\ntitle: x\n---\n\nbody line\n---\nmore');
  assert.equal(r.yaml, 'title: x');
  assert.ok(r.body.indexOf('body line') !== -1);
  assert.ok(r.body.indexOf('---\nmore') !== -1); // later fences belong to the body
});

test('splitFrontmatter: fewer than 2 fences → null', () => {
  assert.equal(H.splitFrontmatter('# no frontmatter'), null);
  assert.equal(H.splitFrontmatter('---\ntitle: x\nno closing fence'), null);
  assert.equal(H.splitFrontmatter(null), null);
});

test('splitFrontmatter: CRLF fences tolerated', () => {
  const r = H.splitFrontmatter('---\r\ntitle: x\r\n---\r\nbody');
  assert.ok(r !== null);
  assert.equal(r.body, 'body');
});

/* ── coercePriority ── */

test('coercePriority: form-value coercion table', () => {
  assert.equal(H.coercePriority('3'), 3);
  assert.equal(H.coercePriority(''), null);
  assert.equal(H.coercePriority(null), null);
  assert.equal(H.coercePriority(undefined), null);
  assert.equal(H.coercePriority('3abc'), '3abc'); // kept raw for the validator
  assert.equal(H.coercePriority(5), 5);
});

/* ── stripMdExt / isTaskRef ── */

test('stripMdExt removes a trailing .md only', () => {
  assert.equal(H.stripMdExt('task-002.md'), 'task-002');
  assert.equal(H.stripMdExt('story-001-x'), 'story-001-x');
  assert.equal(H.stripMdExt(null), '');
});

test('isTaskRef matches task-NNN with optional slug', () => {
  assert.equal(H.isTaskRef('task-002'), true);
  assert.equal(H.isTaskRef('task-002-slug'), true);
  assert.equal(H.isTaskRef('story-001-x'), false);
  assert.equal(H.isTaskRef('task-2'), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/tasks.helpers.test.js`
Expected: FAIL — `Cannot find module '.../app/js/tasks.helpers.js'`.

- [ ] **Step 3: Implement the module skeleton**

Create `app/js/tasks.helpers.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Tasks Helpers — pure logic for task frontmatter round-trip.
   Importable as <script> (window.TasksHelpers) or Node require().

   Round-trip contract: KNOWN keys are parsed + normalized and re-emitted
   in the file's original order; UNKNOWN keys are captured as verbatim
   raw-line blocks and re-emitted byte-for-byte in their original position.
   Limitation: top-level keys must match /^[A-Za-z_][A-Za-z0-9_-]*\s*:/ —
   exotic YAML (anchors, flow mappings spanning lines) is out of scope, and
   top-level comment lines adjacent to KNOWN keys are dropped on rewrite
   (forge-lib never emits them).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TasksHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── Canonical schema constants (see forge-lib/schemas/task.json) ── */
  var STATUS_VALUES = ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
  var TERMINAL_STATUSES = ['Completed', 'Cancelled'];
  var PRIORITY_VALUES = [1, 2, 3, 4, 5];
  var DEFAULT_STATUS = 'Open';
  var DEFAULT_PRIORITY = 3;

  /* Keys the view understands. parent/source are read-only in the UI but round-tripped. */
  var KNOWN_KEYS = ['title', 'type', 'status', 'priority', 'assignee', 'creator',
    'created', 'updated', 'due_date', 'dependencies', 'tags',
    'external_link', 'external_id', 'parent', 'source'];
  var LIST_KEYS = ['tags', 'dependencies'];

  /* Append order for keys ADDED by the view that were not in the original file
     (template-order first, view extras last). */
  var TASK_FIELD_ORDER = ['title', 'type', 'status', 'priority', 'assignee', 'due_date',
    'tags', 'parent', 'source', 'created', 'updated', 'creator',
    'dependencies', 'external_link', 'external_id'];

  var FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  var KEY_LINE_RE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/;

  function splitFrontmatter(content) {
    if (typeof content !== 'string') return null;
    var m = content.match(FM_RE);
    if (!m) return null;
    return { yaml: m[1], body: m[2] };
  }

  function coercePriority(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return raw;
    var s = String(raw).trim();
    var n = parseInt(s, 10);
    if (!isNaN(n) && String(n) === s) return n;
    return raw; /* garbage kept raw so serializeTaskFile's validator reports it */
  }

  function stripMdExt(name) {
    return String(name || '').replace(/\.md$/i, '');
  }

  function isTaskRef(name) {
    return /^task-\d{3}(-|$)/.test(String(name || ''));
  }

  return {
    STATUS_VALUES: STATUS_VALUES,
    TERMINAL_STATUSES: TERMINAL_STATUSES,
    PRIORITY_VALUES: PRIORITY_VALUES,
    DEFAULT_STATUS: DEFAULT_STATUS,
    DEFAULT_PRIORITY: DEFAULT_PRIORITY,
    KNOWN_KEYS: KNOWN_KEYS,
    TASK_FIELD_ORDER: TASK_FIELD_ORDER,
    splitFrontmatter: splitFrontmatter,
    coercePriority: coercePriority,
    stripMdExt: stripMdExt,
    isTaskRef: isTaskRef
  };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/tasks.helpers.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/tasks.helpers.js test/tasks.helpers.test.js
git commit -m "feat(tasks): TasksHelpers module skeleton - constants, frontmatter split, small utils"
```

### Task 1.2: Full-preserve frontmatter parser (`parseTaskFile`)

**Files:**
- Modify: `app/js/tasks.helpers.js`
- Modify: `test/tasks.helpers.test.js`

**Interfaces:**
- Consumes: `splitFrontmatter` + schema constants (Task 1.1).
- Produces: `TasksHelpers.parseTaskFile(filename, content)` → `null` (fewer than 2 fences) or `{filename, title, type, status, priority, assignee, creator, created, updated, due_date, dependencies, tags, external_link, external_id, parent, source, body, __fm: {keyOrder, unknown, listStyle, warnings}}`. `__fm` is the shape memory the serializer (Task 1.3) replays.

- [ ] **Step 1: Append the failing tests**

Append to the end of `test/tasks.helpers.test.js`:

```js
/* ── parseTaskFile ── */

const FORGE_LIB_FILE = [
  '---',
  'title: "Fix login"',
  'type: task',
  'status: Open',
  'priority: 2',
  'assignee: null',
  'due_date: null',
  'tags:',
  '  - auth',
  '  - backend',
  'parent: story-001-notification-template-builder',
  'created: 2026-07-01',
  'updated: 2026-07-01',
  '---',
  '',
  '## Description',
  '',
  'Do the thing.'
].join('\n');

test('parseTaskFile: forge-lib file — quotes stripped, block tags, parent kept', () => {
  const t = H.parseTaskFile('task-001.md', FORGE_LIB_FILE);
  assert.equal(t.title, 'Fix login'); // quotes stripped
  assert.equal(t.status, 'Open');
  assert.equal(t.priority, 2); // integer
  assert.equal(t.assignee, null);
  assert.deepEqual(t.tags, ['auth', 'backend']); // block list parsed
  assert.equal(t.parent, 'story-001-notification-template-builder');
  assert.equal(t.body, '## Description\n\nDo the thing.');
  assert.equal(t.__fm.listStyle.tags, 'block'); // style recorded
  assert.deepEqual(t.__fm.warnings, []);
});

test('parseTaskFile: view-legacy file parses like the old parser', () => {
  const legacy = '---\ntitle: Plain title\ntype: task\nstatus: In Progress\npriority: 4\nassignee: jbrice\ncreator: null\ncreated: 2026-06-01\nupdated: 2026-06-02\ndue_date: 2026-08-01\ndependencies: []\ntags: [ui, board]\nexternal_link: null\nexternal_id: null\n---\n\nBody.';
  const t = H.parseTaskFile('task-002.md', legacy);
  assert.equal(t.title, 'Plain title');
  assert.equal(t.status, 'In Progress');
  assert.equal(t.priority, 4);
  assert.equal(t.assignee, 'jbrice');
  assert.deepEqual(t.dependencies, []);
  assert.deepEqual(t.tags, ['ui', 'board']);
  assert.equal(t.external_link, null);
  assert.equal(t.parent, null); // absent → null
  assert.equal(t.__fm.listStyle.tags, 'inline');
});

test('parseTaskFile: unknown keys captured verbatim in original position', () => {
  const raw = '---\ntitle: X\ncustom_field: hello # note\nstatus: Open\nweird_block:\n  nested: 1\n  lines: 2\nupdated: 2026-07-01\n---\n\nB';
  const t = H.parseTaskFile('task-003.md', raw);
  assert.deepEqual(t.__fm.unknown.custom_field, ['custom_field: hello # note']);
  assert.deepEqual(t.__fm.unknown.weird_block, ['weird_block:', '  nested: 1', '  lines: 2']);
  assert.deepEqual(t.__fm.keyOrder, ['title', 'custom_field', 'status', 'weird_block', 'updated']);
});

test('parseTaskFile: priority normalization + warnings', () => {
  const mk = (line) => H.parseTaskFile('t.md', '---\ntitle: X\n' + line + '\n---\n\nB');
  assert.equal(mk('status: Open').priority, 3); // key absent → default
  assert.equal(mk('priority: null').priority, null);
  assert.equal(mk('priority: 3').priority, 3);
  const bad = mk('priority: 3abc');
  assert.equal(bad.priority, '3abc'); // kept raw
  assert.equal(bad.__fm.warnings.length, 1);
  assert.match(bad.__fm.warnings[0], /Invalid priority/);
});

test('parseTaskFile: invalid status kept raw + warning', () => {
  const t = H.parseTaskFile('t.md', '---\ntitle: X\nstatus: WIP\n---\n\nB');
  assert.equal(t.status, 'WIP');
  assert.match(t.__fm.warnings[0], /Invalid status/);
});

test('parseTaskFile: fewer than 2 fences → null; body --- preserved', () => {
  assert.equal(H.parseTaskFile('t.md', 'no frontmatter'), null);
  const t = H.parseTaskFile('t.md', '---\ntitle: X\n---\n\nabove\n---\nbelow');
  assert.equal(t.body, 'above\n---\nbelow');
});

test('parseTaskFile: scalar trailing comments stripped, quoted values unescaped', () => {
  const t = H.parseTaskFile('t.md', '---\ntitle: "He said \\"hi\\""\nassignee: jbrice # owner\n---\n\nB');
  assert.equal(t.title, 'He said "hi"');
  assert.equal(t.assignee, 'jbrice');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/tasks.helpers.test.js`
Expected: FAIL — the 7 new tests fail with `TypeError: H.parseTaskFile is not a function` (the 7 Task-1.1 tests still pass).

- [ ] **Step 3: Implement the parser**

In `app/js/tasks.helpers.js`, insert the following immediately above the `return {` export block:

```js
  /* ── Scalar parse helpers ── */

  function unquote(v) {
    if (v.length >= 2 && v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') {
      return v.slice(1, -1).replace(/\\(["\\])/g, '$1');
    }
    if (v.length >= 2 && v.charAt(0) === "'" && v.charAt(v.length - 1) === "'") {
      return v.slice(1, -1).replace(/''/g, "'");
    }
    return v;
  }

  /* One scalar frontmatter value: unquote, strip trailing comment
     (unquoted values only), map ''/null/~ → null. */
  function parseScalar(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (v === '' || v === 'null' || v === '~') return null;
    if (v.charAt(0) === '"' || v.charAt(0) === "'") {
      var u = unquote(v);
      return u === '' ? null : u;
    }
    var hash = v.search(/\s#/);
    if (hash !== -1) v = v.slice(0, hash).trim();
    if (v === '' || v === 'null' || v === '~') return null;
    return v;
  }

  function parseInlineList(v) {
    var inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(function (s) { return unquote(s.trim()); });
  }

  function parseTaskFile(filename, content) {
    var split = splitFrontmatter(content);
    if (!split) return null;

    var fm = {};        /* known key → parsed value */
    var keyOrder = [];  /* every top-level key, original order */
    var unknown = {};   /* unknown key → verbatim raw lines */
    var listStyle = {}; /* list key → 'inline' | 'block' */
    var warnings = [];

    var lines = split.yaml.split('\n');
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].replace(/\r$/, '');
      var m = line.match(KEY_LINE_RE);
      if (!m) { i++; continue; } /* stray top-level line (comment/blank) — skipped */

      var key = m[1];
      var rest = m[2];

      /* Continuation = following lines that are blank or indented,
         up to the next top-level key. Kept RAW for unknown keys. */
      var rawBlock = [lines[i]];
      var cont = [];
      var j = i + 1;
      while (j < lines.length) {
        var next = lines[j].replace(/\r$/, '');
        if (next === '' || /^\s/.test(next)) {
          rawBlock.push(lines[j]);
          cont.push(next);
          j++;
        } else {
          break;
        }
      }

      if (KNOWN_KEYS.indexOf(key) === -1) {
        keyOrder.push(key);
        unknown[key] = rawBlock;
      } else if (LIST_KEYS.indexOf(key) !== -1) {
        keyOrder.push(key);
        var inline = rest.trim();
        var contItems = cont.filter(function (l) { return l.trim() !== ''; });
        if (inline.charAt(0) === '[' && inline.charAt(inline.length - 1) === ']') {
          listStyle[key] = 'inline';
          fm[key] = parseInlineList(inline);
        } else if (contItems.length > 0 &&
                   contItems.every(function (l) { return /^\s+-\s/.test(l); })) {
          listStyle[key] = 'block';
          fm[key] = contItems.map(function (l) {
            return unquote(l.replace(/^\s+-\s*/, '').trim());
          });
        } else {
          if (inline !== '' && inline !== 'null' && inline !== '~') {
            warnings.push('Invalid list value for ' + key + ': ' + JSON.stringify(inline) + '.');
          }
          fm[key] = [];
        }
      } else {
        keyOrder.push(key);
        fm[key] = parseScalar(rest);
        var extra = cont.filter(function (l) { return l.trim() !== ''; });
        if (extra.length > 0) {
          warnings.push('Unexpected continuation lines under key ' + key + ' were ignored.');
        }
      }

      i = j;
    }

    /* ── Normalization (same semantics as the legacy tasks.js parser) ── */
    if (fm.status !== undefined && fm.status !== null && STATUS_VALUES.indexOf(fm.status) === -1) {
      warnings.push('Invalid status ' + JSON.stringify(fm.status) +
        '. Valid: ' + STATUS_VALUES.join(', ') + '.');
    }

    var priority;
    if (keyOrder.indexOf('priority') === -1) {
      priority = DEFAULT_PRIORITY; /* key absent → default */
    } else if (fm.priority === null) {
      priority = null;
    } else {
      var rawP = String(fm.priority).trim();
      var n = parseInt(rawP, 10);
      var fullInt = !isNaN(n) && String(n) === rawP;
      priority = fullInt ? n : fm.priority;
      if (!fullInt || PRIORITY_VALUES.indexOf(n) === -1) {
        warnings.push('Invalid priority ' + JSON.stringify(fm.priority) + '. Valid: 1-5 or null.');
      }
    }

    return {
      filename: filename,
      title: fm.title == null ? '' : fm.title,
      type: fm.type == null ? 'task' : fm.type,
      status: fm.status == null ? DEFAULT_STATUS : fm.status,
      priority: priority,
      assignee: fm.assignee == null ? null : fm.assignee,
      creator: fm.creator == null ? null : fm.creator,
      created: fm.created == null ? '' : fm.created,
      updated: fm.updated == null ? '' : fm.updated,
      due_date: fm.due_date == null ? null : fm.due_date,
      dependencies: fm.dependencies || [],
      tags: fm.tags || [],
      external_link: fm.external_link == null ? null : fm.external_link,
      external_id: fm.external_id == null ? null : fm.external_id,
      parent: fm.parent == null ? null : fm.parent,
      source: fm.source == null ? null : fm.source,
      body: split.body.trim(),
      /* NOTE: __fm is shared by reference through Object.assign copies
         (edit modal). Safe because only serializeTaskFile reads it —
         never mutate __fm through a task copy. */
      __fm: { keyOrder: keyOrder, unknown: unknown, listStyle: listStyle, warnings: warnings }
    };
  }
```

Then register the export — after the line `splitFrontmatter: splitFrontmatter,` add:

```js
    parseTaskFile: parseTaskFile,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/tasks.helpers.test.js`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/tasks.helpers.js test/tasks.helpers.test.js
git commit -m "feat(tasks): full-preserve frontmatter parser with verbatim unknown-key blocks"
```

### Task 1.3: Shape-preserving serializer + round-trip property tests

**Files:**
- Modify: `app/js/tasks.helpers.js`
- Modify: `test/tasks.helpers.test.js`

**Interfaces:**
- Consumes: `__fm` shape memory from `parseTaskFile` (Task 1.2).
- Produces: `TasksHelpers.serializeTaskFile(task)` → markdown string. Known keys re-emitted in the file's original order, unknown blocks verbatim in place, view-added keys appended in `TASK_FIELD_ORDER` only when meaningful, `key: null` re-emitted only for keys present in the original. Throws the **exact legacy messages** on invalid status/priority — PR4's `writeTaskNow` must keep both messages verbatim (program decision C6).

- [ ] **Step 1: Append the failing tests**

Append to the end of `test/tasks.helpers.test.js`:

```js
/* ── serializeTaskFile ── */

test('serializeTaskFile: exact legacy throw messages', () => {
  assert.throws(
    () => H.serializeTaskFile({ title: 'X', status: 'Bogus', priority: 3 }),
    { message: 'Cannot save task: invalid status "Bogus". Must be one of: Open, In Progress, Blocked, Completed, Cancelled' }
  );
  assert.throws(
    () => H.serializeTaskFile({ title: 'X', status: 'Open', priority: '3' }),
    { message: 'Cannot save task: invalid priority "3". Must be integer 1-5 or null.' }
  );
});

test('serializeTaskFile: new task omits absent-and-empty keys (schema-safe)', () => {
  const out = H.serializeTaskFile({
    filename: 'task-009.md', title: 'New Task', type: 'task', status: 'Open',
    priority: 3, assignee: null, creator: null, created: '2026-07-16',
    updated: '2026-07-16', due_date: null, dependencies: [], tags: [],
    external_link: null, external_id: null, body: ''
  });
  assert.ok(!/creator:|dependencies:|external_link:|external_id:|assignee:|due_date:|tags:/.test(out));
  assert.match(out, /^title: "New Task"$/m); // title always quoted
  assert.match(out, /^priority: 3$/m); // integer, unquoted
});

test('serializeTaskFile: null keys present in original re-emit as key: null in place', () => {
  const t = H.parseTaskFile('t.md', '---\ntitle: X\nassignee: null\nstatus: Open\nupdated: 2026-07-01\n---\n\nB');
  const out = H.serializeTaskFile(t);
  const lines = out.split('\n');
  assert.equal(lines[1], 'title: "X"');
  assert.equal(lines[2], 'assignee: null'); // in place, before status
  assert.equal(lines[3], 'status: Open');
});

test('serializeTaskFile: conditional quoting rules', () => {
  const t = H.parseTaskFile('t.md', '---\ntitle: X\nstatus: Open\nassignee: a\nexternal_id: b\nexternal_link: c\nupdated: 2026-07-01\n---\n\nB');
  t.assignee = 'name: with colon';
  t.external_id = '12345';
  t.external_link = 'plain-value';
  const out = H.serializeTaskFile(t);
  assert.match(out, /^assignee: "name: with colon"$/m);
  assert.match(out, /^external_id: "12345"$/m); // all-digits quoted
  assert.match(out, /^external_link: plain-value$/m); // plain stays unquoted
});

test('serializeTaskFile: block list style preserved, new list keys default inline', () => {
  const t = H.parseTaskFile('t.md', '---\ntitle: X\nstatus: Open\ntags:\n  - auth\nupdated: 2026-07-01\n---\n\nB');
  t.tags = ['auth', 'ui board'];
  t.dependencies = ['task-002.md'];
  const out = H.serializeTaskFile(t);
  assert.match(out, /^tags:\n  - auth\n  - ui board$/m); // block preserved
  assert.match(out, /^dependencies: \[task-002\.md\]$/m); // new list inline
});

/* ── Round-trip properties ── */

test('round-trip: status-only mutation of a forge-lib file', () => {
  const t = H.parseTaskFile('task-001.md', FORGE_LIB_FILE);
  t.status = 'In Progress';
  const out = H.serializeTaskFile(t);
  const t2 = H.parseTaskFile('task-001.md', out);
  assert.equal(t2.parent, 'story-001-notification-template-builder');
  assert.deepEqual(t2.tags, ['auth', 'backend']);
  assert.equal(t2.title, 'Fix login'); // not double-quoted
  assert.equal(t2.status, 'In Progress');
  assert.match(out, /^tags:\n  - auth\n  - backend$/m); // block style kept
  assert.ok(!/creator:|dependencies:|external_link:|external_id:/.test(out)); // schema-safe
});

test('round-trip: unknown blocks byte-identical, original order, after title edit', () => {
  const raw = '---\ntitle: X\ncustom_field: hello # note\nstatus: Open\nweird_block:\n  nested: 1\n\n  lines: 2\nupdated: 2026-07-01\n---\n\nB';
  const t = H.parseTaskFile('task-004.md', raw);
  t.title = 'Renamed';
  const out = H.serializeTaskFile(t);
  assert.ok(out.indexOf('custom_field: hello # note') !== -1);
  assert.ok(out.indexOf('weird_block:\n  nested: 1\n\n  lines: 2') !== -1);
  assert.ok(out.indexOf('custom_field') < out.indexOf('status:')); // original relative order
  assert.ok(out.indexOf('status:') < out.indexOf('weird_block'));
});

const CORPUS = [
  FORGE_LIB_FILE,
  '---\ntitle: Plain\nstatus: Open\ntags: [a, b]\nupdated: 2026-07-01\n---\n\nBody',
  '---\ntitle: "Q: colon"\nstatus: Blocked\npriority: 1\nx_custom: 1\n---\n\nB',
  '---\ntitle: X\nstatus: Open\nnotes: |\n  line one\n  line two\nupdated: 2026-07-01\n---\n\nB',
  '---\ntitle: X\nstatus: Open\ntags:\n  - has space\n  - plain\n---\n\nB',
  '---\r\ntitle: X\r\nstatus: Open\r\nupdated: 2026-07-01\r\n---\r\n\r\nCRLF body',
  '---\ntitle: X\nstatus: Open\nparent: story-001-x\nsource: product-forge\n---\n\nB'
];

test('round-trip: serialize∘parse is idempotent byte-for-byte on its own output', () => {
  CORPUS.forEach((raw) => {
    const once = H.serializeTaskFile(H.parseTaskFile('t.md', raw));
    const twice = H.serializeTaskFile(H.parseTaskFile('t.md', once));
    assert.equal(twice, once);
  });
});

test('round-trip: parse→serialize→parse is semantically stable across the corpus', () => {
  CORPUS.forEach((raw) => {
    const a = H.parseTaskFile('t.md', raw);
    const b = H.parseTaskFile('t.md', H.serializeTaskFile(a));
    ['title', 'type', 'status', 'priority', 'assignee', 'created', 'updated',
      'due_date', 'parent', 'source'].forEach(function (k) {
      assert.deepEqual(b[k], a[k], k + ' differs for: ' + raw.slice(0, 40));
    });
    assert.deepEqual(b.tags, a.tags);
    assert.deepEqual(b.dependencies, a.dependencies);
    assert.deepEqual(b.__fm.unknown, a.__fm.unknown);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/tasks.helpers.test.js`
Expected: FAIL — the 9 new tests fail with `TypeError: H.serializeTaskFile is not a function` (14 prior tests still pass).

- [ ] **Step 3: Implement the serializer**

In `app/js/tasks.helpers.js`, insert the following immediately above the `return {` export block:

```js
  /* ── Serialization ── */

  function quoteString(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  /* Quote only when needed: ': ', ' #', leading/trailing whitespace,
     all-digits, or a value that would re-parse as null/quoted/list. */
  function scalarOut(v) {
    var s = String(v);
    if (
      s === '' || s === 'null' || s === '~' ||
      /^\d+$/.test(s) || /: /.test(s) || / #/.test(s) ||
      /^\s|\s$/.test(s) || /^["'\[]/.test(s)
    ) {
      return quoteString(s);
    }
    return s;
  }

  function emitKnown(task, key, listStyle) {
    var v = task[key];
    if (key === 'title') {
      return 'title: ' + quoteString(v == null ? '' : v); /* titles always quoted */
    }
    if (LIST_KEYS.indexOf(key) !== -1) {
      var arr = Array.isArray(v) ? v : (v == null ? [] : [v]);
      if (arr.length === 0) return key + ': []';
      if (listStyle[key] === 'block') {
        return key + ':\n' + arr.map(function (item) {
          return '  - ' + scalarOut(item);
        }).join('\n');
      }
      return key + ': [' + arr.map(scalarOut).join(', ') + ']';
    }
    if (v === null || v === undefined || v === '') return key + ': null';
    if (key === 'priority') return 'priority: ' + v; /* validated integer */
    return key + ': ' + scalarOut(v);
  }

  function isMeaningful(v) {
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  }

  function serializeTaskFile(task) {
    if (STATUS_VALUES.indexOf(task.status) === -1) {
      throw new Error('Cannot save task: invalid status ' + JSON.stringify(task.status) +
        '. Must be one of: ' + STATUS_VALUES.join(', '));
    }
    if (task.priority !== null && task.priority !== undefined &&
        PRIORITY_VALUES.indexOf(task.priority) === -1) {
      throw new Error('Cannot save task: invalid priority ' + JSON.stringify(task.priority) +
        '. Must be integer 1-5 or null.');
    }

    var meta = task.__fm || {};
    var keyOrder = meta.keyOrder || [];
    var unknown = meta.unknown || {};
    var listStyle = meta.listStyle || {};

    var out = [];
    var emitted = {};

    /* 1. Every key from the original file, in original order:
          known keys re-serialized, unknown blocks verbatim. */
    keyOrder.forEach(function (key) {
      if (emitted[key]) return;
      emitted[key] = true;
      if (Object.prototype.hasOwnProperty.call(unknown, key)) {
        unknown[key].forEach(function (rawLine) { out.push(rawLine); });
      } else {
        out.push(emitKnown(task, key, listStyle));
      }
    });

    /* 2. Keys the view added (absent from the original file) — only when
          meaningful, appended in TASK_FIELD_ORDER. Absent-and-empty keys
          are NOT emitted (keeps forge-lib files schema-valid). */
    TASK_FIELD_ORDER.forEach(function (key) {
      if (emitted[key]) return;
      if (!isMeaningful(task[key])) return;
      emitted[key] = true;
      out.push(emitKnown(task, key, listStyle));
    });

    return '---\n' + out.join('\n') + '\n---\n\n' + (task.body || '');
  }
```

Then register the export — after the line `parseTaskFile: parseTaskFile,` add:

```js
    serializeTaskFile: serializeTaskFile,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/tasks.helpers.test.js`
Expected: PASS (23 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/tasks.helpers.js test/tasks.helpers.test.js
git commit -m "feat(tasks): shape-preserving task serializer + round-trip property tests"
```

### Task 1.4: Rewire tasks.js through TasksHelpers; fix stale updated-date + modal priority bugs

**Files:**
- Modify: `app/index.html`
- Modify: `app/js/tasks.js`

**Interfaces:**
- Consumes: `TasksHelpers` (Tasks 1.1–1.3); existing `ForgeFS.writeFile` (portable writes), `ForgeUtils.Toast`, `showStatus` pill.
- Produces: every board read/write routed through the round-trip parser/serializer; the **minimal autoSave reorder** (bump `updated` BEFORE serializing). PR4's `writeTaskNow` supersedes this function but must preserve the ordering fix and TasksHelpers' exact throw messages (C6); PR4 also moves the write-failure pill onto the D4 error-toast channel.

- [ ] **Step 1: Load the helpers script before tasks.js**

In `app/index.html` (script list, lines 126–128), the existing lines:

```html
  <script src="js/product-forge.helpers.js"></script>
  <script src="js/product-forge.js"></script>
  <script src="js/tasks.js"></script>
```

become:

```html
  <script src="js/product-forge.helpers.js"></script>
  <script src="js/product-forge.js"></script>
  <script src="js/tasks.helpers.js"></script>
  <script src="js/tasks.js"></script>
```

- [ ] **Step 2: Alias the schema constants**

In `app/js/tasks.js` (lines 33–37), replace:

```js
  const STATUS_VALUES = ['Open', 'In Progress', 'Blocked', 'Completed', 'Cancelled'];
  const TERMINAL_STATUSES = ['Completed', 'Cancelled'];
  const PRIORITY_VALUES = [1, 2, 3, 4, 5];
  const DEFAULT_STATUS = 'Open';
  const DEFAULT_PRIORITY = 3;
```

with:

```js
  // Aliased from TasksHelpers (app/js/tasks.helpers.js) — single source of truth.
  const STATUS_VALUES = TasksHelpers.STATUS_VALUES;
  const TERMINAL_STATUSES = TasksHelpers.TERMINAL_STATUSES;
  const PRIORITY_VALUES = TasksHelpers.PRIORITY_VALUES;
  const DEFAULT_STATUS = TasksHelpers.DEFAULT_STATUS;
  const DEFAULT_PRIORITY = TasksHelpers.DEFAULT_PRIORITY;
```

- [ ] **Step 3: Delete the three legacy parse/serialize functions**

Delete these three blocks from `app/js/tasks.js` (nothing else in the file defines or uses them after this task):

1. The `YAML Parser` banner comment plus the whole `parseYAML` function (lines 643–678) — the block starting:

```js
  /* ══════════════════════════════════════════════════════════
     YAML Parser (simple key-value parser)
     ══════════════════════════════════════════════════════════ */
  function parseYAML(yamlStr) {
```

through its closing lines `    }` / `    return result;` / `  }`.

2. The whole local `parseTaskFile` function (lines 718–767) — starting:

```js
  function parseTaskFile(filename, content) {
    var parts = content.split('---\n');
    if (parts.length < 3) return null;
```

through its closing lines `      body: body` / `    };` / `  }`.

3. The whole local `serializeTaskFile` function (lines 769–804) — starting:

```js
  function serializeTaskFile(task) {
    if (!STATUS_VALUES.includes(task.status)) {
```

through its closing lines `    return yaml + (task.body || '');` / `  }`.

Keep the `Task File Parser & Serializer` banner (lines 680–682) — it still covers `parseTaskFiles`, which stays.

- [ ] **Step 4: Route parseTaskFiles through the helpers and surface parse warnings**

In `parseTaskFiles` (inside the per-entry `try`), replace:

```js
            var task = parseTaskFile(entry.name, content);
            if (task) resultTasks.push(task);
```

with:

```js
            var task = TasksHelpers.parseTaskFile(entry.name, content);
            if (task) {
              (task.__fm.warnings || []).forEach(function (w) {
                console.warn('[forge-shell] ' + w + ' File: ' + entry.name);
              });
              resultTasks.push(task);
            }
```

- [ ] **Step 5: Fix autoSave ordering (bump `updated` BEFORE serializing)**

Replace the whole `autoSave` function (currently lines 815–848):

```js
  async function autoSave(task) {
    if (!tasksDirHandle || !hasChanges || isSaving) return;
    isSaving = true;
    suppressExternalToasts = true;

    var content;
    try {
      content = serializeTaskFile(task);
    } catch (e) {
      ForgeUtils.Toast.show(e.message, 'error', 6000);
      isSaving = false;
      hasChanges = true;
      suppressExternalToasts = false;
      return;
    }

    try {
      // Update the updated date
      task.updated = new Date().toISOString().split('T')[0];

      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);

      // Update signature to prevent external change detection
      taskSignature = await buildTaskSignature();

      hasChanges = false;
      showStatus('Saved');
    } catch (e) {
      showStatus('Save failed: ' + e.message);
    }

    isSaving = false;
    setTimeout(function () { suppressExternalToasts = false; }, 1000);
  }
```

with:

```js
  async function autoSave(task) {
    if (!tasksDirHandle || !hasChanges || isSaving) return;
    isSaving = true;
    suppressExternalToasts = true;

    // Bump the updated date BEFORE serializing so the written file carries
    // it (the legacy order serialized first and wrote a stale date).
    task.updated = new Date().toISOString().split('T')[0];

    var content;
    try {
      content = TasksHelpers.serializeTaskFile(task);
    } catch (e) {
      ForgeUtils.Toast.show(e.message, 'error', 6000);
      isSaving = false;
      hasChanges = true;
      suppressExternalToasts = false;
      return;
    }

    try {
      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);

      // Update signature to prevent external change detection
      taskSignature = await buildTaskSignature();

      hasChanges = false;
      showStatus('Saved');
    } catch (e) {
      showStatus('Save failed: ' + e.message);
    }

    isSaving = false;
    setTimeout(function () { suppressExternalToasts = false; }, 1000);
  }
```

- [ ] **Step 6: Route addNewTask through the helpers**

In `addNewTask` (line 1335), replace:

```js
      var content = serializeTaskFile(newTask);
```

with:

```js
      var content = TasksHelpers.serializeTaskFile(newTask);
```

- [ ] **Step 7: Coerce the modal's priority string**

In `editModal._getFormData` (lines 1946–1952), after this existing loop:

```js
      $$('[data-ref="edit-body"] [data-task-field]').forEach(function (el) {
        var key = el.dataset.taskField;
        var val = el.value.trim();
        task[key] = val === '' ? null : val;
      });
```

insert:

```js
      // Selects return strings; the validator needs an integer (or null).
      task.priority = TasksHelpers.coercePriority(task.priority);
```

- [ ] **Step 8: Static verification**

Run: `grep -n "parseYAML\|serializeTaskFile\|parseTaskFile" app/js/tasks.js`
Expected: no `parseYAML` hits; the only `parseTaskFile`/`serializeTaskFile` hits are the `parseTaskFiles` definition + its two callers and the three `TasksHelpers.`-prefixed calls (parseTaskFiles, autoSave, addNewTask).

Run: `npm test`
Expected: PASS — 126 tests (103 pre-existing + 23 new), 0 fail.

- [ ] **Step 9: Browser verification (server runtime)**

Create a throwaway fixture project:

```bash
FIX=$(mktemp -d)
mkdir -p "$FIX/tasks" "$FIX/cards"
cat > "$FIX/tasks/task-101-fixture.md" <<'EOF'
---
title: "Fixture with parent"
type: task
status: Open
priority: 2
assignee: null
due_date: null
tags:
  - auth
  - backend
parent: story-001-notification-template-builder
source: product-forge
custom_field: keep-me
created: 2026-07-01
updated: 2026-07-01
---

## Description

Round-trip fixture.
EOF
cat > "$FIX/tasks/task-102-child.md" <<'EOF'
---
title: "Child of a task"
status: Open
parent: task-101-fixture
created: 2026-07-01
updated: 2026-07-01
---

Body.
EOF
cat > "$FIX/cards/story-001-notification-template-builder.md" <<'EOF'
---
title: "Notification Template Builder"
type: story
status: Draft
created: 2026-07-01
updated: 2026-07-01
---

Story body.
EOF
echo "$FIX"
```

Then: `npm run serve` → open `http://127.0.0.1:4173` → "Select Project Folder" (typed-path dialog in server mode) → paste the `$FIX` path → open the Tasks view.

1. Drag "Fixture with parent" from **Open** to **In Progress**, wait ~2s (500 ms debounce + write), then `cat "$FIX/tasks/task-101-fixture.md"`.
   Expected: `status: In Progress`; `updated:` is today; `parent:`, `source:`, `custom_field: keep-me` intact and in their original positions; `tags:` still block style (`  - auth`); title still `"Fixture with parent"`; **no** `creator:`/`dependencies:`/`external_link:`/`external_id:` lines appeared.
2. Open the card's edit modal (pencil icon), set Priority to "P1 – Critical", Save.
   Expected: "Task saved successfully" toast (no invalid-priority error); after ~2s `grep '^priority:' "$FIX/tasks/task-101-fixture.md"` prints `priority: 1` (integer, unquoted).

- [ ] **Step 10: Commit**

```bash
git add app/index.html app/js/tasks.js
git commit -m "refactor(tasks): route board reads/writes through TasksHelpers; fresh updated date; coerce modal priority"
```

### Task 1.5: Parent chip on cards and edit modal + cross-plugin navigation

**Files:**
- Modify: `app/js/tasks.js`
- Modify: `app/css/productivity.css`

**Interfaces:**
- Consumes: `TasksHelpers.stripMdExt` / `isTaskRef`; existing `Shell.selectPlugin('product-forge-local', { selectCard: <extensionless filename> })` — the same contract `roadmap.js`'s `openInProductForge` already uses (Product Forge reveals + flashes the card, or shows its own "Card not found in Product Forge" info toast on a miss).
- Produces: `.prod-parent-chip` on cards and in the edit modal; `openParentCard(task)`. The modal chip is **not** a `data-task-field`, so `_getFormData` and Preview Changes (whose `allKeys` list has no `parent`) never touch the field — saving cannot drop it.

- [ ] **Step 1: Render the chip on cards**

In `createCard` (`app/js/tasks.js`), directly after this existing due-date block (lines 1193–1198):

```js
    if (fieldVisibility.due_date && task.due_date) {
      var today = new Date().toISOString().split('T')[0];
      var isOverdue = task.due_date < today && !TERMINAL_STATUSES.includes(task.status);
      var dueDateColor = isOverdue ? '#e74c3c' : 'var(--text-muted)';
      html += '<div class="prod-card-note" style="margin-top:8px;color:' + dueDateColor + ';"><i class="fa-regular fa-calendar-day"></i> ' + task.due_date + '</div>';
    }
```

insert (always shown when a parent exists — not gated by `fieldVisibility`):

```js
    if (task.parent && task.parent !== 'null') {
      html += '<div class="prod-card-note" style="margin-top:8px;">' +
        '<button type="button" class="prod-parent-chip" data-action="open-parent" ' +
          'title="Open parent: ' + esc(task.parent) + '">' +
          '<i class="fa-solid fa-sitemap"></i> ' + esc(TasksHelpers.stripMdExt(task.parent)) +
        '</button></div>';
    }
```

- [ ] **Step 2: Dispatch the chip click from the card**

In `createCard`'s click listener (lines 1248–1262), the existing dispatch:

```js
      } else if (action === 'edit') {
        editModal.open(task);
      } else if (action === 'delete') {
        deleteTask(task);
      }
```

becomes:

```js
      } else if (action === 'edit') {
        editModal.open(task);
      } else if (action === 'delete') {
        deleteTask(task);
      } else if (action === 'open-parent') {
        e.stopPropagation();
        openParentCard(task);
      }
```

- [ ] **Step 3: Add openParentCard**

Insert after the end of `moveTaskToStatus` and before `deleteTask` (`app/js/tasks.js`, around line 1357):

```js
  /* Opens a task's parent: task-NNN refs open the local edit modal;
     anything else deep-links into Product Forge (same pattern as
     roadmap.js openInProductForge). Misses degrade to Product Forge's
     own "Card not found in Product Forge" toast. */
  function openParentCard(task) {
    var target = TasksHelpers.stripMdExt(task.parent || '');
    if (!target) return;

    if (TasksHelpers.isTaskRef(target)) {
      var parentTask = tasks.find(function (t) {
        return TasksHelpers.stripMdExt(t.filename) === target;
      });
      if (parentTask) { editModal.open(parentTask); return; }
    }

    if (typeof Shell === 'undefined' || typeof Shell.selectPlugin !== 'function') {
      ForgeUtils.Toast.show('Navigation unavailable', 'error');
      return;
    }
    var pluginId = 'product-forge-local';
    if (Shell.visibility && Shell.visibility[pluginId] === false) {
      ForgeUtils.Toast.show('Product Forge is not available', 'error');
      return;
    }
    var result;
    try {
      result = Shell.selectPlugin(pluginId, { selectCard: target });
    } catch (e) {
      try {
        result = Shell.selectPlugin(pluginId);
      } catch (e2) {
        ForgeUtils.Toast.show('Failed to open Product Forge', 'error');
        return;
      }
    }
    /* undefined = current Shell API success; only false means unavailable */
    if (result === false) {
      ForgeUtils.Toast.show('Product Forge is not available', 'error');
    }
  }
```

- [ ] **Step 4: Read-only Parent row in the edit modal**

In `editModal.open` (`app/js/tasks.js`, around lines 1630–1637), between the form-grid close and the body textarea — the existing:

```js
      html += '</div>';

      html += '<div class="form-group full-width">' +
        '<label>Body (Markdown)</label>' +
```

becomes:

```js
      html += '</div>';

      if (task.parent && task.parent !== 'null') {
        html += '<div class="form-group full-width">' +
          '<label>Parent</label>' +
          '<div><button type="button" class="prod-parent-chip" data-action="open-parent-modal">' +
          '<i class="fa-solid fa-sitemap"></i> ' + esc(TasksHelpers.stripMdExt(task.parent)) +
          '</button></div>' +
        '</div>';
      }

      html += '<div class="form-group full-width">' +
        '<label>Body (Markdown)</label>' +
```

(No `data-task-field` attribute — the chip is display-only.)

- [ ] **Step 5: Dispatch the modal chip click**

In `bindToolbarEvents` (`app/js/tasks.js`), the dispatch chain currently ends (line 462):

```js
      else if (action === 'toggle-search') toggleSearchStrip();
      else if (action === 'clear-filters') clearAllFilters();
    });
```

becomes:

```js
      else if (action === 'toggle-search') toggleSearchStrip();
      else if (action === 'clear-filters') clearAllFilters();
      else if (action === 'open-parent-modal') {
        var t = editModal.currentTask;
        editModal.close();
        if (t) openParentCard(t);
      }
    });
```

- [ ] **Step 6: Chip styling**

Append at the end of `app/css/productivity.css` (after the `Reduced Motion` block):

```css
/* ── Parent Chip (Tasks board) ── */
.prod-parent-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
}

.prod-parent-chip:hover {
  text-decoration: underline;
}
```

- [ ] **Step 7: Browser verification**

With the Task 1.4 fixture project still selected (`npm run serve` → `http://127.0.0.1:4173` → Tasks view):

1. "Fixture with parent" shows a chip reading `story-001-notification-template-builder` (sitemap icon, no `.md`); "Child of a task" shows `task-101-fixture`; a card created via "+ Add task" shows no chip.
2. Click the story chip → Shell switches to Product Forge and reveals/flashes the fixture card (a miss would show Product Forge's "Card not found in Product Forge" toast — that path is acceptable wiring proof, but the fixture card should resolve). The task's own edit modal must NOT open.
3. Click the chip on "Child of a task" → the local edit modal opens showing "Fixture with parent".
4. Open the edit modal for "Fixture with parent": a read-only Parent row sits above the Body textarea; click it → modal closes, Product Forge opens.
5. Reopen the modal, click "Preview Changes" without editing → no `parent` row in the diff; Save → after ~2s `grep '^parent:' <fixture>/tasks/task-101-fixture.md` still prints the parent line.

Run: `npm test`
Expected: PASS — 126 tests, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add app/js/tasks.js app/css/productivity.css
git commit -m "feat(tasks): navigable parent chip on cards and edit modal"
```

### Task 1.6: Honest whole-column drag highlight + same-status no-op guard

**Files:**
- Modify: `app/js/tasks.js`
- Modify: `app/css/productivity.css`

**Interfaces:**
- Consumes: existing per-card `dragstart` (sets `text/plain` = filename, adds `.prod-dragging`) — unchanged.
- Produces: NEW class `.prod-column.prod-col-drag-over` (so PR9 never edits the ghost-shared rules); `clearColumnDragOver()`; `moveTaskToStatus` same-status guard. **Do NOT delete** `.prod-cards.prod-drag-over` (productivity.css lines 100–107) or `.prod-drop-indicator` (lines 285–290) — the unloaded ghost `app/js/productivity.js` still references them; PR9 owns their deletion.

- [ ] **Step 1: Add the global highlight clearer**

In `app/js/tasks.js`, insert immediately before `function createColumn(...)` (around line 1074):

```js
  /* Clears the whole-column drag highlight everywhere
     (used on drop, and on dragend to cover Escape-cancelled drags). */
  function clearColumnDragOver() {
    document.querySelectorAll('#view-tasks .prod-column.prod-col-drag-over').forEach(function (c) {
      c.classList.remove('prod-col-drag-over');
    });
  }
```

- [ ] **Step 2: Replace the fake drop-indicator machinery with whole-column listeners**

In `createColumn`, delete the entire drag region (lines 1105–1156): from the comment `/* Card drag-and-drop into column */` and the helper `var getDropPosition = function (e) {` … through `var showDropIndicator = function (e) {` … and the three `col.addEventListener('dragover'|'dragleave'|'drop', ...)` listeners, ending with the `});` right after `moveTaskToStatus(taskFilename, colId);` (the next kept line is the `/* Add task button */` comment). This also removes all three `[DRAG-DROP]` console lines. Replace the deleted region with:

```js
    /* Card drag-and-drop into column — honest whole-column highlight */
    col.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#view-tasks .prod-column.prod-col-drag-over').forEach(function (c) {
        if (c !== col) c.classList.remove('prod-col-drag-over');
      });
      col.classList.add('prod-col-drag-over');
    });

    col.addEventListener('dragleave', function (e) {
      if (!col.contains(e.relatedTarget)) col.classList.remove('prod-col-drag-over');
    });

    col.addEventListener('drop', function (e) {
      e.preventDefault();
      clearColumnDragOver();
      var taskFilename = e.dataTransfer.getData('text/plain');
      if (!taskFilename) return;
      moveTaskToStatus(taskFilename, colId);
    });
```

- [ ] **Step 3: Simplify dragend cleanup**

In `createCard` (lines 1241–1246), replace:

```js
    card.addEventListener('dragend', function () {
      card.classList.remove('prod-dragging');
      // Global cleanup: remove ALL drop indicators and drag-over classes
      document.querySelectorAll('.prod-drop-indicator').forEach(function (el) { el.remove(); });
      document.querySelectorAll('.prod-drag-over').forEach(function (el) { el.classList.remove('prod-drag-over'); });
    });
```

with:

```js
    card.addEventListener('dragend', function () {
      card.classList.remove('prod-dragging');
      clearColumnDragOver(); // also covers Escape-cancelled drags
    });
```

- [ ] **Step 4: Same-status drops are a no-op**

In `moveTaskToStatus` (lines 1348–1356), replace:

```js
    var task = tasks.find(function (t) { return t.filename === filename; });
    if (!task) return;
```

with:

```js
    var task = tasks.find(function (t) { return t.filename === filename; });
    if (!task || task.status === newStatus) return; // same-column drop = no write
```

- [ ] **Step 5: Highlight styling (new class only)**

Append at the end of `app/css/productivity.css`:

```css
/* ── Whole-column drag highlight (honest drop affordance) ──
   NOTE: .prod-cards.prod-drag-over and .prod-drop-indicator earlier in this
   file are intentionally untouched — the unloaded ghost productivity.js still
   references them; PR9 deletes both. */
.prod-column.prod-col-drag-over {
  box-shadow: 0 0 0 2px var(--accent);
  background: rgba(74, 108, 247, 0.08);
}

[data-theme="dark"] .prod-column.prod-col-drag-over {
  background: rgba(102, 129, 255, 0.1);
}
```

- [ ] **Step 6: Static verification**

Run: `grep -c 'DRAG-DROP' app/js/tasks.js`
Expected: `0` (grep exits non-zero on zero matches — the printed count must be 0).

Run: `grep -n 'getDropPosition\|showDropIndicator\|prod-drop-indicator' app/js/tasks.js`
Expected: no output.

Run: `grep -n 'prod-drop-indicator\|prod-cards.prod-drag-over' app/css/productivity.css`
Expected: both ghost rules still present (lines ~100 and ~285) — untouched.

- [ ] **Step 7: Browser verification**

With the fixture project (`npm run serve` → `http://127.0.0.1:4173` → Tasks view):

1. Drag a card over each column: the **whole column** under the pointer gets an accent ring + tint; no thin insertion line ever appears; moving between columns highlights exactly one column at a time.
2. Toggle dark mode (theme switch in the shell): highlight tint is visible in dark too.
3. Start a drag, press Escape: highlight clears (dragend path).
4. Same-column drop: `stat -f %m "$FIX/tasks/task-102-child.md"`, drop the card back into its own column, wait 2s, re-run `stat` — mtime unchanged (no write, no "Moved to" pill).
5. Cross-column drop still moves the card and persists (pill "Moved to …", then "Saved").

Run: `npm test`
Expected: PASS — 126 tests, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add app/js/tasks.js app/css/productivity.css
git commit -m "feat(tasks): honest whole-column drag highlight; remove fake drop indicator + debug logs"
```

### Task 1.7: Full-suite verification + open PR 1

**Files:**
- No source changes — verification + PR only.

**Interfaces:**
- Consumes: everything this PR built.
- Produces: pushed branch `ux-program/pr-1-tasks-data-layer` + open PR against `main`.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: everything passing, including the 23 new tests this PR adds — 126 tests total (103 pre-existing + 23 in `test/tasks.helpers.test.js`), 0 fail.

- [ ] **Step 2: Three-runtime smoke checklist**

Server runtime is `npm run serve` → `http://127.0.0.1:4173` (typed-path folder dialog, as in cmux); Chrome FSA is the same URL in a real Chrome/Edge tab picking the folder natively; Tauri is `npm run tauri:dev` (requires local Rust toolchain — if unavailable, note it in the PR body and have a reviewer run the Tauri column).

| Smoke check (fixture project from Task 1.4) | Server (cmux) | Chrome FSA | Tauri |
|---|---|---|---|
| Drag task with parent → file keeps `parent`/`source`/`custom_field`, block tags, gains today's `updated`, no schema-forbidden keys | required | required | required |
| Edit modal: set P1 → "Task saved successfully", file shows `priority: 1` | required | spot-check | spot-check |
| Parent chip: story parent → Product Forge reveal; `task-NNN` parent → local modal; no chip without parent | required | spot-check | spot-check |
| Whole-column highlight (light + dark), clears on drop/leave/Escape; same-column drop leaves file mtime unchanged | required | spot-check | spot-check |
| Timeline / Summary / Workload / Matrix tabs render unchanged | required | — | — |
| 5s external watcher still detects an out-of-band edit made after a UI save | — | — | required (Tauri-only check) |

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin ux-program/pr-1-tasks-data-layer
gh pr create --base main \
  --title "PR1: Tasks data layer - round-trip frontmatter, parent chip, honest drag" \
  --body "Replaces the Tasks board's lossy frontmatter parser/serializer with the round-trip TasksHelpers UMD module: parent/source/unknown keys now survive every drag and edit, schema-forbidden keys are no longer emitted, and the written updated date is fresh (autoSave now bumps before serializing). Adds a navigable parent chip (card + edit modal, deep-links into Product Forge) and an honest whole-column drag highlight (fake insertion indicator, [DRAG-DROP] debug logs, and same-status writes removed). New node:test suite: 23 parse/serialize/round-trip tests.

Stacked PR 1/9 - merge after PR (none, first in stack)"
```

Expected: PR URL printed; CI (if configured) runs `cd forge-shell && npm test` green.

---

## PR2 — Unified markdown renderer: MDHelpers (tables + safe links), memory on shared renderer *(M)*

**Branch:** `ux-program/pr-2-markdown-renderer` (from `ux-program/pr-1-tasks-data-layer`) — **Contains:** WP7 (all) — **Depends on:** PR1 (stacking order only; PR1 touched only tasks-owned files, so none of this PR's files were modified by it).

One shared, hardened markdown renderer: the `ForgeUtils.MD` block moves out of `utils.js` into a new UMD module `md.helpers.js` (node-tested), gains pipe tables + double-quote escaping + an href scheme whitelist + `toPlainText()`; `utils.js` keeps `ForgeUtils.MD` as a thin delegate so no call site changes. memory.js's private `renderMarkdownToHtml` is deleted (3 call sites switch to the shared renderer, containers swap `prod-markdown-content` → `rendered-body` — complete, since PR9 purges the old class), and roadmap's drawer excerpt stops leaking markdown tokens. tasks.js is deliberately untouched (body is only ever edited in a textarea, never displayed read-only).

### Task 2.1: MDHelpers module — ported renderer + XSS hardening (TDD)

**Files:**
- Create: `forge-shell/app/js/md.helpers.js`
- Create: `forge-shell/test/md.helpers.test.js`

**Interfaces:**
- Consumes: nothing (fully self-contained — no `ForgeUtils`/`window` references, so `require()` works under `node --test`).
- Produces: `MDHelpers.render(src: string|null) → string` (HTML; `''` for falsy); test-exported internals `_parseBlocks`, `_renderBlock`, `_inline`, `_safeHref(url) → string|null` (null = disallowed scheme).

The parser/renderer is ported from `utils.js:227-316` on main (block structure, regexes, and output bytes preserved), with exactly two hardening changes: inline `esc()` additionally escapes `"` (matching `ForgeUtils.escapeHTML`, closing the href attribute-injection hole), and link hrefs are gated by a `safeHref()` scheme whitelist — unsafe schemes degrade to plain text (URL dropped, no anchor).

- [ ] **Step 1: Create the branch**

Run:
```bash
git checkout ux-program/pr-1-tasks-data-layer
git checkout -b ux-program/pr-2-markdown-renderer
```
Expected: `Switched to a new branch 'ux-program/pr-2-markdown-renderer'`.

- [ ] **Step 2: Write the failing tests**

Create `forge-shell/test/md.helpers.test.js`:

````js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const MD = require('../app/js/md.helpers.js');

const FENCE = '```';

/* ── render: blocks ── */

test('render: falsy input renders empty string', () => {
  assert.equal(MD.render(''), '');
  assert.equal(MD.render(null), '');
  assert.equal(MD.render(undefined), '');
});

test('render: headings h1-h6', () => {
  assert.equal(MD.render('# H1'), '<h1>H1</h1>');
  assert.equal(MD.render('### H3'), '<h3>H3</h3>');
  assert.equal(MD.render('###### H6'), '<h6>H6</h6>');
});

test('render: consecutive lines join into one paragraph', () => {
  assert.equal(MD.render('line one\nline two'), '<p>line one line two</p>');
});

test('render: blank line separates paragraphs', () => {
  assert.equal(MD.render('one\n\ntwo'), '<p>one</p>\n<p>two</p>');
});

test('render: unordered lists via -, *, +', () => {
  assert.equal(MD.render('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(MD.render('* a\n+ b'), '<ul><li>a</li><li>b</li></ul>');
});

test('render: ordered list', () => {
  assert.equal(MD.render('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('render: multi-line blockquote', () => {
  assert.equal(MD.render('> a\n> b'), '<blockquote><p>a</p><p>b</p></blockquote>');
});

test('render: horizontal rule', () => {
  assert.equal(MD.render('---'), '<hr>');
});

test('render: fenced code preserves emphasis markers and escapes html', () => {
  const html = MD.render(FENCE + '\n**not bold** <script>alert(1)</script>\n' + FENCE);
  assert.equal(html, '<pre><code>**not bold** &lt;script&gt;alert(1)&lt;/script&gt;</code></pre>');
});

/* ── inline formatting ── */

test('inline: bold via ** and __', () => {
  assert.equal(MD.render('**b**'), '<p><strong>b</strong></p>');
  assert.equal(MD.render('__b__'), '<p><strong>b</strong></p>');
});

test('inline: emphasis via * and _ with lookarounds', () => {
  assert.equal(MD.render('*i*'), '<p><em>i</em></p>');
  assert.equal(MD.render('_i_'), '<p><em>i</em></p>');
  assert.equal(MD.render('**bold**'), '<p><strong>bold</strong></p>'); /* no <em> leak */
});

test('inline: code span', () => {
  assert.equal(MD.render('`x`'), '<p><code>x</code></p>');
});

test('inline: double quotes escaped in text', () => {
  assert.equal(MD.render('say "hi"'), '<p>say &quot;hi&quot;</p>');
});

/* ── links: scheme whitelist ── */

test('links: safe schemes render anchors with target/rel', () => {
  assert.equal(
    MD.render('[t](https://e.com)'),
    '<p><a href="https://e.com" target="_blank" rel="noopener">t</a></p>'
  );
  assert.ok(MD.render('[m](mailto:a@b.c)').includes('<a href="mailto:a@b.c"'));
  assert.ok(MD.render('[f](#section)').includes('<a href="#section"'));
  assert.ok(MD.render('[r](./doc.md)').includes('<a href="./doc.md"'));
});

test('links: javascript: renders as plain text, no anchor', () => {
  const html = MD.render('[click](javascript:alert(1))');
  assert.ok(!html.includes('<a '));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('click'));
});

test('links: data: and vbscript: are rejected', () => {
  const d = MD.render('[x](data:text/html;base64,PHNjcmlwdD4)');
  assert.ok(!d.includes('<a ') && !d.includes('data:'));
  const v = MD.render('[x](vbscript:msgbox)');
  assert.ok(!v.includes('<a ') && !v.includes('vbscript:'));
});

test('links: whitespace-obfuscated scheme is rejected', () => {
  const html = MD.render('[x](java\tscript:alert(1))');
  assert.ok(!html.includes('<a '));
});

test('links: double quote in URL cannot break out of href attribute', () => {
  const html = MD.render('[x](https://a.com/" onmouseover="alert(1))');
  assert.ok(!html.includes('" onmouseover="'));
  assert.ok(html.includes('&quot;'));
});

/* ── hostile raw HTML ── */

test('xss: raw script tag in a paragraph is entity-escaped', () => {
  const html = MD.render('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('xss: event-handler html in headings and list items is escaped', () => {
  const h = MD.render('# <img src=x onerror=alert(1)>');
  assert.ok(!h.includes('<img'));
  assert.ok(h.includes('&lt;img'));
  const li = MD.render('- <div onclick="x">hi</div>');
  assert.ok(!li.includes('<div'));
  assert.ok(!li.includes('onclick="x"')); /* quotes escaped to &quot; */
});
````

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/md.helpers.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/md.helpers.js'`.

- [ ] **Step 4: Create the module**

Create `forge-shell/app/js/md.helpers.js` (UMD wrapper identical in shape to `roadmap.helpers.js:5-11`):

````js
/* ═══════════════════════════════════════════════════════════════
   MD Helpers — the shell's single markdown renderer.
   Ported from ForgeUtils.MD (utils.js) and hardened:
   - esc() also escapes double quotes (attribute-injection fix)
   - link hrefs gated by a scheme whitelist (_safeHref)
   Importable as <script> (window.MDHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MDHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Runs on already-escaped URLs; strips whitespace/control chars first to
     defeat "java\nscript:" obfuscation. Returns null when disallowed. */
  function safeHref(url) {
    var probe = String(url).replace(/[\s\x00-\x1f]+/g, '').toLowerCase();
    return /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/.test(probe) ? url : null;
  }

  function inline(t) {
    t = esc(t);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__(.+?)__/g, '<strong>$1</strong>');
    t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    t = t.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
    t = t.replace(/`(.+?)`/g, '<code>$1</code>');
    t = t.replace(/\[(.+?)\]\((.+?)\)/g, function (m, text, url) {
      var h = safeHref(url);
      return h
        ? '<a href="' + h + '" target="_blank" rel="noopener">' + text + '</a>'
        : text;
    });
    return t;
  }

  function parseBlocks(lines) {
    var blocks = [];
    var cur = null;
    var push = function () { if (cur) { blocks.push(cur); cur = null; } };

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (cur && cur.type === 'code') {
        if (line.trim().startsWith('```')) { push(); }
        else cur.lines.push(line);
        continue;
      }

      if (line.trim().startsWith('```')) {
        push();
        cur = { type: 'code', lang: line.trim().slice(3).trim(), lines: [] };
        continue;
      }

      var hm = line.match(/^(#{1,6})\s+(.+)$/);
      if (hm) { push(); blocks.push({ type: 'heading', level: hm[1].length, text: hm[2] }); continue; }

      if (/^(\s*[-*_]){3,}\s*$/.test(line)) { push(); blocks.push({ type: 'hr' }); continue; }

      var bq = line.match(/^>\s?(.*)$/);
      if (bq) {
        if (!cur || cur.type !== 'blockquote') { push(); cur = { type: 'blockquote', lines: [] }; }
        cur.lines.push(bq[1]);
        continue;
      }

      var ul = line.match(/^(\s*)([-*+])\s+(.+)$/);
      if (ul) {
        if (!cur || cur.type !== 'ul') { push(); cur = { type: 'ul', items: [] }; }
        cur.items.push(ul[3]);
        continue;
      }

      var ol = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (ol) {
        if (!cur || cur.type !== 'ol') { push(); cur = { type: 'ol', items: [] }; }
        cur.items.push(ol[3]);
        continue;
      }

      if (!line.trim()) { push(); continue; }

      if (!cur || cur.type !== 'paragraph') { push(); cur = { type: 'paragraph', lines: [] }; }
      cur.lines.push(line);
    }
    push();
    return blocks;
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'heading':
        return '<h' + b.level + '>' + inline(b.text) + '</h' + b.level + '>';
      case 'paragraph':
        return '<p>' + b.lines.map(function (l) { return inline(l); }).join(' ') + '</p>';
      case 'ul':
        return '<ul>' + b.items.map(function (it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ul>';
      case 'ol':
        return '<ol>' + b.items.map(function (it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ol>';
      case 'hr':
        return '<hr>';
      case 'blockquote':
        return '<blockquote>' + b.lines.map(function (l) { return '<p>' + inline(l) + '</p>'; }).join('') + '</blockquote>';
      case 'code': {
        var code = b.lines.join('\n')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<pre><code>' + code + '</code></pre>';
      }
      default:
        return '';
    }
  }

  function render(src) {
    if (!src) return '';
    var lines = src.split('\n');
    var blocks = parseBlocks(lines);
    return blocks.map(function (b) { return renderBlock(b); }).join('\n');
  }

  return {
    render: render,
    /* underscore-prefixed internals exported for unit tests */
    _parseBlocks: parseBlocks,
    _renderBlock: renderBlock,
    _inline: inline,
    _safeHref: safeHref
  };
});
````

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/md.helpers.test.js`
Expected: PASS (20 tests).

- [ ] **Step 6: Commit**

```bash
git add app/js/md.helpers.js test/md.helpers.test.js
git commit -m "feat(md): MDHelpers UMD renderer with quote escaping + href scheme whitelist"
```

---

### Task 2.2: MDHelpers — pipe-table block support (TDD)

**Files:**
- Modify: `forge-shell/app/js/md.helpers.js`
- Modify: `forge-shell/test/md.helpers.test.js`

**Interfaces:**
- Consumes: Task 2.1's `parseBlocks` / `renderBlock` / `inline`.
- Produces: `table` block type — a table starts only when a `|…|` row is immediately followed by a strict separator row (`|---|`, alignment colons recognized and ignored); `splitRow` preserves empty interior cells; body rows are padded/truncated to header width; cells go through `inline`. No CSS work: `.rendered-body` table rules pre-exist at `components.css:343-352`.

- [ ] **Step 1: Add failing tests**

Append to `test/md.helpers.test.js`:

```js
/* ── tables ── */

test('table: header + separator + rows render thead/tbody', () => {
  const html = MD.render('| a | b |\n|---|---|\n| 1 | 2 |');
  assert.equal(
    html,
    '<table><thead><tr><th>a</th><th>b</th></tr></thead>' +
    '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
  );
});

test('table: empty interior cell keeps column count', () => {
  const html = MD.render('| a |  | c |\n|---|---|---|\n| 1 | 2 | 3 |');
  assert.match(html, /<thead><tr><th>a<\/th><th><\/th><th>c<\/th><\/tr><\/thead>/);
});

test('table: body rows padded/truncated to header width', () => {
  const short = MD.render('| a | b |\n|---|---|\n| only |');
  assert.ok(short.includes('<tr><td>only</td><td></td></tr>'));
  const long = MD.render('| a | b |\n|---|---|\n| 1 | 2 | 3 |');
  assert.ok(long.includes('<tr><td>1</td><td>2</td></tr>'));
  assert.ok(!long.includes('<td>3</td>'));
});

test('table: terminated by blank line; following text is a paragraph', () => {
  const html = MD.render('| a |\n|---|\n| 1 |\n\nafter');
  assert.ok(html.includes('</table>'));
  assert.ok(html.includes('<p>after</p>'));
});

test('table: pipe row without separator stays a paragraph', () => {
  const html = MD.render('| a | b |\njust text');
  assert.ok(!html.includes('<table>'));
  assert.ok(html.includes('<p>'));
});

test('table: alignment-colon separators recognized', () => {
  const html = MD.render('| a | b |\n|:---|---:|\n| 1 | 2 |');
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<td>1</td><td>2</td>'));
});

test('table: inline formatting applied inside cells', () => {
  const html = MD.render('| **b** | [t](https://e.com) |\n|---|---|\n| `c` | x |');
  assert.ok(html.includes('<th><strong>b</strong></th>'));
  assert.ok(html.includes('<a href="https://e.com" target="_blank" rel="noopener">t</a>'));
  assert.ok(html.includes('<td><code>c</code></td>'));
});

test('table: hostile html and javascript: links inside cells are neutralized', () => {
  const html = MD.render('| <script>x</script> | [c](javascript:alert(1)) |\n|---|---|\n| a | b |');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<a '));
});

test('table: end-to-end unstructured memory fixture', () => {
  const fixture = [
    'Working agreements for the team.',
    '',
    '**Owner:** Jeremy',
    '',
    '## Conventions',
    '',
    '| Area | Rule |',
    '|------|------|',
    '| Commits | Conventional |',
    '| Reviews |  |',
    '',
    '- Keep PRs small',
    '- [Style guide](https://example.com/style)'
  ].join('\n');
  const html = MD.render(fixture);
  assert.equal((html.match(/<table>/g) || []).length, 1);
  assert.ok(html.includes('<h2>Conventions</h2>'));
  assert.ok(html.includes('<strong>Owner:</strong>'));
  assert.ok(html.includes('<a href="https://example.com/style"'));
  assert.ok(!html.includes('**'));
  assert.ok(!html.includes('|'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/md.helpers.test.js`
Expected: FAIL — 7 of the 9 new table tests fail (pipe rows currently render as paragraphs, so the `<table>` assertions miss). Two pass both before and after, by design: the false-positive guard (`pipe row without separator stays a paragraph`) and the hostile-cells test (Task 2.1's escaping + link gating already neutralize hostile content even when the row renders as a paragraph). The 20 Task 2.1 tests stay green.

- [ ] **Step 3: Implement the table block**

Three edits to `app/js/md.helpers.js`.

**Edit A** — add the table helpers between `safeHref` and `inline` (immediately after the closing `}` of `function safeHref`):

```js
  /* ── Pipe-table detection ── */
  function isTableRow(l) { return /^\s*\|.*\|\s*$/.test(l); }
  function isTableSep(l) { return /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(l); }
  /* Split preserves EMPTY interior cells (fixes memory's .filter() misalignment). */
  function splitRow(l) {
    var t = l.trim().replace(/^\|/, '').replace(/\|$/, '');
    return t.split('|').map(function (c) { return c.trim(); });
  }
```

**Edit B** — in `parseBlocks`, insert the table branches after the code-fence-open branch and **before** the heading match. Replace:

````js
      if (line.trim().startsWith('```')) {
        push();
        cur = { type: 'code', lang: line.trim().slice(3).trim(), lines: [] };
        continue;
      }

      var hm = line.match(/^(#{1,6})\s+(.+)$/);
````

with:

````js
      if (line.trim().startsWith('```')) {
        push();
        cur = { type: 'code', lang: line.trim().slice(3).trim(), lines: [] };
        continue;
      }

      if (cur && cur.type === 'table') {
        if (isTableRow(line) && !isTableSep(line)) { cur.rows.push(splitRow(line)); continue; }
        push();
      }

      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        push();
        cur = { type: 'table', header: splitRow(line), rows: [] };
        i++; /* consume the separator row (alignment colons recognized, ignored) */
        continue;
      }

      var hm = line.match(/^(#{1,6})\s+(.+)$/);
````

**Edit C** — in `renderBlock`, insert a `table` case between the closing `}` of `case 'code': {` and `default:`. Replace:

```js
        return '<pre><code>' + code + '</code></pre>';
      }
      default:
        return '';
```

with:

```js
        return '<pre><code>' + code + '</code></pre>';
      }
      case 'table': {
        var head = b.header.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('');
        var body = b.rows.map(function (r) {
          var cells = b.header.map(function (_, ci) {
            return '<td>' + inline(r[ci] != null ? r[ci] : '') + '</td>';
          }).join('');
          return '<tr>' + cells + '</tr>';
        }).join('');
        return '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
      }
      default:
        return '';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/md.helpers.test.js`
Expected: PASS (29 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/md.helpers.js test/md.helpers.test.js
git commit -m "feat(md): pipe-table block support with strict separator detection"
```

---

### Task 2.3: MDHelpers — toPlainText for excerpts (TDD)

**Files:**
- Modify: `forge-shell/app/js/md.helpers.js`
- Modify: `forge-shell/test/md.helpers.test.js`

**Interfaces:**
- Produces: `MDHelpers.toPlainText(src: string|null) → string` — markdown-stripped, whitespace-collapsed prose. **Not** HTML-escaped; callers escape. Consumer lands in Task 2.6 (roadmap drawer); also available for future card-preview excerpts (PR8 palette results).

- [ ] **Step 1: Add failing tests**

Append to `test/md.helpers.test.js`:

```js
/* ── toPlainText ── */

test('toPlainText: falsy input', () => {
  assert.equal(MD.toPlainText(null), '');
  assert.equal(MD.toPlainText(''), '');
});

test('toPlainText: strips heading and emphasis markers', () => {
  assert.equal(MD.toPlainText('## Goal\n**Key:** value'), 'Goal Key: value');
});

test('toPlainText: links become their text', () => {
  assert.equal(MD.toPlainText('see [docs](https://e.com) now'), 'see docs now');
});

test('toPlainText: fenced code contents removed', () => {
  assert.equal(
    MD.toPlainText('before\n' + FENCE + 'js\nconst x = 1;\n' + FENCE + '\nafter'),
    'before after'
  );
});

test('toPlainText: list and blockquote markers stripped', () => {
  assert.equal(MD.toPlainText('- item one\n> quoted\n1. numbered'), 'item one quoted numbered');
});

test('toPlainText: table pipes and separator rows removed', () => {
  assert.equal(MD.toPlainText('| a | b |\n|---|---|\n| 1 | 2 |'), 'a b 1 2');
});

test('toPlainText: backticks stripped, whitespace collapsed', () => {
  assert.equal(MD.toPlainText('use `npm test`   here\n\n\nplease'), 'use npm test here please');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/md.helpers.test.js`
Expected: FAIL — `MD.toPlainText is not a function` (7 new failures; 29 existing tests green).

- [ ] **Step 3: Implement toPlainText**

In `app/js/md.helpers.js`, add this function immediately after the closing `}` of `function render(src)`:

```js
  /* Markdown-stripped, whitespace-collapsed prose for one-line excerpts.
     NOT HTML-escaped — callers escape before inserting into HTML. */
  function toPlainText(src) {
    if (!src) return '';
    var t = String(src);
    /* fenced code blocks, contents included */
    t = t.replace(/```[\s\S]*?```/g, ' ');
    /* table separator rows */
    t = t.replace(/^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/gm, ' ');
    /* leading heading / blockquote / list markers, per line */
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    t = t.replace(/^\s*>\s?/gm, '');
    t = t.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '');
    /* [text](url) -> text */
    t = t.replace(/\[(.+?)\]\((.+?)\)/g, '$1');
    /* emphasis / backtick markers */
    t = t.replace(/(\*\*|__|\*|_|`)/g, '');
    /* pipes -> space; collapse all whitespace */
    t = t.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }
```

Then add it to the exports object. Replace:

```js
  return {
    render: render,
```

with:

```js
  return {
    render: render,
    toPlainText: toPlainText,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/md.helpers.test.js`
Expected: PASS (36 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/md.helpers.js test/md.helpers.test.js
git commit -m "feat(md): toPlainText for markdown-stripped excerpts"
```

---

### Task 2.4: Wire-up — utils.js delegate + index.html load order

**Files:**
- Modify: `forge-shell/app/js/utils.js`
- Modify: `forge-shell/app/index.html`

**Interfaces:**
- Consumes: `window.MDHelpers` (Tasks 2.1–2.3).
- Produces: `ForgeUtils.MD` as a thin delegate — every existing `ForgeUtils.MD.render` call site (product-forge.js:649, cognitive-forge.js:387/394, report-forge.js:457/476, rovo-agent-forge.js:437/444) keeps working with zero changes.

- [ ] **Step 1: Replace the ForgeUtils.MD block with a delegate**

In `app/js/utils.js`, delete lines 224–316 — the entire region from the banner comment

```js
/* ═══════════════════════════════════════════════════════════════
   MD — Markdown-to-HTML Renderer
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.MD = {
  render(src) {
```

down through the closing of the `_inline(t)` method:

```js
    t = t.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return t;
  }
};
```

(the very next lines must remain: the banner `Diff — Line-diff for edit previews` followed by `ForgeUtils.Diff = {`). In its place, insert:

```js
/* ═══════════════════════════════════════════════════════════════
   MD — Markdown renderer. Implementation lives in md.helpers.js
   (UMD, node-testable). Load order is load-bearing: index.html
   loads js/md.helpers.js BEFORE js/utils.js so window.MDHelpers
   exists when this line runs.
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.MD = window.MDHelpers;
```

- [ ] **Step 2: Insert the script tag before utils.js**

In `app/index.html`, replace:

```html
  <!-- Scripts -->
  <script src="js/fs-adapter.js"></script>
  <script src="js/utils.js"></script>
```

with:

```html
  <!-- Scripts -->
  <script src="js/fs-adapter.js"></script>
  <script src="js/md.helpers.js"></script>
  <script src="js/utils.js"></script>
```

(As landed by PR1 the script list also contains `<script src="js/tasks.helpers.js"></script>` next to `js/tasks.js`, lower in the list — untouched here.)

- [ ] **Step 3: Verify wiring by grep and test suite**

Run: `grep -n "MDHelpers" app/index.html app/js/utils.js && grep -cn "ForgeUtils.MD = {" app/js/utils.js || true`
Expected: index.html shows `js/md.helpers.js` on the line before `js/utils.js`; utils.js shows exactly one `MDHelpers` hit (`ForgeUtils.MD = window.MDHelpers;`); the old object-literal opener is gone (grep count 0).

Run: `npm test`
Expected: all green (utils.js has no Node suite; the 36 md.helpers tests cover the moved logic).

- [ ] **Step 4: Browser verification**

Run: `npm run serve`, open `http://127.0.0.1:4173` in Chrome, select the usual project folder.
- Open **Product Forge**, click any card: the detail body renders exactly as before (headings, lists, bold).
- DevTools console: `ForgeUtils.MD === window.MDHelpers` → `true`; `ForgeUtils.MD.render('| a |\n|---|\n| 1 |')` → returns a `<table>…</table>` string.
- No console errors on load.

- [ ] **Step 5: Commit**

```bash
git add app/js/utils.js app/index.html
git commit -m "refactor(utils): ForgeUtils.MD delegates to MDHelpers; load md.helpers.js first"
```

---

### Task 2.5: memory.js on the shared renderer + `.rendered-body` containers

**Files:**
- Modify: `forge-shell/app/js/memory.js`

**Interfaces:**
- Consumes: `ForgeUtils.MD.render` (Task 2.4 delegate).
- Produces: nothing new — memory's 3 unstructured-markdown surfaces (Overview fallback, per-file fallback, directory-file modal) now render through the shared pipeline inside `.rendered-body` (`components.css:307-352`). The container swap is **complete**: after this task `prod-markdown-content` has zero occurrences in memory.js, clearing the way for PR9's CSS purge. Sibling classes (`prod-file-card-content prod-expanded`) and inline styles stay. The structured path (`renderParsedFlatTables`) is untouched.

- [ ] **Step 1: Delete the private renderer**

In `app/js/memory.js`, delete the entire `renderMarkdownToHtml` function (lines 335–368) — from:

```js
  function renderMarkdownToHtml(md) {
    var html = esc(md);
```

through its closing:

```js
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
  }
```

(the file resumes with the `MEMORY — Loading` banner comment; the `esc` alias at the top of the file stays — it has many other consumers).

- [ ] **Step 2: Switch the Overview fallback (renderMemoryOverview)**

Replace:

```js
      var rendered = renderMarkdownToHtml(memoryData.claudeMd.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(memoryData.claudeMd.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded prod-markdown-content">' + rendered + '</div>' +
      '</div>';
```

with:

```js
      var rendered = ForgeUtils.MD.render(memoryData.claudeMd.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(memoryData.claudeMd.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded rendered-body">' + rendered + '</div>' +
      '</div>';
```

- [ ] **Step 3: Switch the per-file fallback (renderMemoryFile)**

Replace:

```js
      var rendered = renderMarkdownToHtml(file.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(file.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded prod-markdown-content">' + rendered + '</div>' +
      '</div>';
```

with:

```js
      var rendered = ForgeUtils.MD.render(file.content);
      contentHtml = '<div class="prod-file-card" data-search="' + esc(file.content.toLowerCase()) + '" style="margin-bottom:16px;">' +
        '<div class="prod-file-card-content prod-expanded rendered-body">' + rendered + '</div>' +
      '</div>';
```

- [ ] **Step 4: Switch the directory-file modal (openFileModal)**

Replace:

```js
      '<div class="prod-markdown-content" style="margin-bottom:20px;">' +
        renderMarkdownToHtml(file.content) +
      '</div>' +
```

with:

```js
      '<div class="rendered-body" style="margin-bottom:20px;">' +
        ForgeUtils.MD.render(file.content) +
      '</div>' +
```

- [ ] **Step 5: Verify the swap is complete**

Run: `grep -rn "renderMarkdownToHtml" app/js/ ; grep -n "prod-markdown-content" app/js/memory.js || echo "memory.js clean"`
Expected: `renderMarkdownToHtml` hits **only** in `app/js/productivity.js` (the unloaded ghost — deliberately untouched, removed by PR9); memory.js prints `memory.js clean`.

- [ ] **Step 6: Browser verification**

With `<project>` being the folder Forge Shell points at, create fixture files (this content deliberately avoids `**Key:**` fields, `## ` sections, and plain `|---|` separators so memory's structured-content detector — `hasStructuredContent`, memory.js:237 — routes it to the fallback renderer):

```bash
mkdir -p "<project>/memory/fixtures"
cat > "<project>/memory/render-fixture.md" <<'EOF'
Team working agreements captured during onboarding. PRs stay **small**.

### Conventions

| Area | Rule |
|:-----|:-----|
| Commits | Conventional messages |
| Reviews |  |

- Keep PRs focused
- [Style guide](https://example.com/style)
- [hostile](javascript:alert(1))
EOF
cp "<project>/memory/render-fixture.md" "<project>/memory/fixtures/render-fixture.md"
```

Run: `npm run serve`, open `http://127.0.0.1:4173` → **Memory** view.
- Click the **Render Fixture** file tab: a styled `<table>` with the empty Reviews cell keeping column alignment; `### Conventions` as a real heading; **small** bold; "Style guide" is a real link (inspect: `target="_blank" rel="noopener"` — links previously rendered as literal text); "hostile" renders as plain text — no anchor, no `javascript:` in the DOM, no console errors.
- Open the **fixtures** directory, click the fixture file: the modal shows the same rendered result above the raw-markdown edit box.
- Overview tab still renders (if the project's CLAUDE.md is structured it takes the untouched `renderParsedFlatTables` path; its fallback branch is code-identical to the per-file branch just verified).

Delete both fixture files afterwards.

- [ ] **Step 7: Commit**

```bash
git add app/js/memory.js
git commit -m "refactor(memory): shared MD renderer, .rendered-body containers"
```

---

### Task 2.6: roadmap.js drawer excerpt via toPlainText + STYLE_GUIDE.md

**Files:**
- Modify: `forge-shell/app/js/roadmap.js`
- Modify: `forge-shell/STYLE_GUIDE.md`

**Interfaces:**
- Consumes: `ForgeUtils.MD.toPlainText` (Tasks 2.3/2.4).
- Produces: nothing new — the drawer stays excerpt-only (summary surface with an "Open in Product Forge" CTA; it does **not** gain full markdown rendering). Downstream escaping (`ESC(excerpt)` into `.rm-drawer-excerpt`, roadmap.js:1482) is unchanged and required, since `toPlainText` output is not HTML-escaped.

- [ ] **Step 1: Strip markdown from both excerpt branches**

In `app/js/roadmap.js`, replace the whole `_descriptionExcerpt` method (lines 1336–1346):

```js
    /** Description excerpt: fm.description or first ~280 chars of body. */
    _descriptionExcerpt: function (card) {
      var fm = card.frontmatter || {};
      if (fm.description && String(fm.description).trim()) {
        var d = String(fm.description).trim();
        return d.length > 280 ? d.slice(0, 280) + '\u2026' : d;
      }
      var body = (card.body || '').replace(/\s+/g, ' ').trim();
      if (!body) return '';
      return body.length > 280 ? body.slice(0, 280) + '\u2026' : body;
    },
```

with:

```js
    /** Description excerpt: fm.description or body, markdown-stripped, first ~280 chars. */
    _descriptionExcerpt: function (card) {
      var fm = card.frontmatter || {};
      var src = (fm.description && String(fm.description).trim())
        ? String(fm.description)
        : (card.body || '');
      var body = ForgeUtils.MD.toPlainText(src);
      if (!body) return '';
      return body.length > 280 ? body.slice(0, 280) + '…' : body;
    },
```

- [ ] **Step 2: Document the single-renderer rule**

Append to the end of `forge-shell/STYLE_GUIDE.md` (append-only — this file also gains sections in PR3/PR4/PR5):

```markdown

## Markdown Rendering (added 2026-07-16)

All read-only markdown in the shell goes through the single shared renderer:

- **Render with `ForgeUtils.MD.render(src)`** (implementation: `app/js/md.helpers.js`, UMD `MDHelpers`, node-tested in `test/md.helpers.test.js`). Never hand-roll regex renderers inside view controllers.
- **Wrap output in a `.rendered-body` container** (`components.css`) — it styles headings, paragraphs, lists, code, blockquote, hr, and tables. Do not add per-plugin markdown CSS.
- **One-line excerpts use `ForgeUtils.MD.toPlainText(src)`** — markdown-stripped, whitespace-collapsed prose. It is NOT HTML-escaped; callers must escape (`ForgeUtils.escapeHTML`) before inserting into HTML.
- **Link safety:** hrefs are whitelisted to `http(s)://`, `mailto:`, `#`, and relative paths (`/`, `./`, `../`). Unsafe schemes (`javascript:`, `data:`, …) render as plain text with the URL dropped. Safe links get `target="_blank" rel="noopener"`.
- **Raw HTML in content is always escaped** — the renderer never passes through author HTML; `<script>` tags, inline event handlers, etc. are entity-escaped in every block type, including table cells.
```

- [ ] **Step 3: Browser verification**

Run: `npm run serve`, open `http://127.0.0.1:4173` → **Roadmap**.
- Click a card whose body is markdown-heavy (any card starting `## Goal` / `**Key:** value` lines) to open the drawer.
- The Description section shows clean prose: no `#`, `*`, backtick, or `[]()` tokens.
- The drawer still shows only the excerpt plus the "Open in Product Forge" button — no full body rendering.
- **Tasks** view: open a task's edit modal, change the body, confirm the diff preview still shows raw source (tasks.js diff shows zero changes in `git status`).

- [ ] **Step 4: Commit**

```bash
git add app/js/roadmap.js STYLE_GUIDE.md
git commit -m "feat(roadmap): drawer excerpt via MD.toPlainText; document markdown rendering"
```

---

### Task 2.7: Full-suite verification + open PR 2

**Files:**
- None (verification + PR only).

- [ ] **Step 1: Full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: everything passing, including the 36 new md.helpers tests this PR adds (the suite grows through the stack — the exact total is main's 103 plus PR1's additions plus 36).

- [ ] **Step 2: Acceptance greps**

Run:
```bash
grep -rn "renderMarkdownToHtml" app/js/
grep -n "prod-markdown-content" app/js/memory.js || echo "memory.js clean"
grep -n "MDHelpers" app/index.html app/js/utils.js
```
Expected: `renderMarkdownToHtml` only in `app/js/productivity.js` (unloaded ghost, PR9's problem); `memory.js clean`; index.html loads `js/md.helpers.js` before `js/utils.js`; utils.js contains only the one-line delegate.

- [ ] **Step 3: Three-runtime smoke checklist**

Use the memory fixture from Task 2.5 Step 6 (recreate it, delete when done). Server mode: `npm run serve` → `http://127.0.0.1:4173`; Chrome FSA: same URL in real Chrome with "Select Project Folder" native picker; Tauri: `npm run tauri:dev`.

| Check | Tauri | Chrome FSA | Server (cmux) |
|---|---|---|---|
| Memory per-file tab: fixture renders styled table (empty cell keeps alignment), real heading, bold, anchor with `target="_blank" rel="noopener"` | ☐ | ☐ | ☐ |
| Memory directory-file modal: same rendering above the raw-edit textarea | ☐ | ☐ | ☐ |
| XSS fixture: `[hostile](javascript:alert(1))` renders inert text — no anchor, no console errors | ☐ | ☐ | ☐ |
| Four pre-existing `.rendered-body` views (Product Forge detail, Cognitive session, Report, Rovo agent): content unchanged; a pipe-table body now renders as a table | ☐ (all four) | ☐ (spot-check one) | ☐ (spot-check one) |
| Roadmap drawer: Description excerpt is clean prose; drawer stays excerpt-only | ☐ | ☐ | ☐ |
| Tasks edit modal: diff preview still shows raw source (no rendering) | ☐ (any one runtime suffices — pure JS path) | — | — |
| Edit fixture file on disk → memory view live-refreshes with new rendering (file watcher = **Tauri-only**) | ☐ | n/a | n/a |
| Safe link click opens externally (Tauri `target="_blank"` handling — pre-existing behavior of the other 4 views, note-only, not a blocker) | ☐ | ☐ | ☐ |

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin ux-program/pr-2-markdown-renderer
gh pr create --base main --title "Unified markdown renderer: MDHelpers with tables + safe links" --body "Extracts ForgeUtils.MD into UMD md.helpers.js (36 node tests) and hardens it: double-quote escaping, href scheme whitelist (javascript:/data: links degrade to text), pipe tables. memory.js drops its private renderer — 3 call sites move to the shared renderer inside .rendered-body (prod-markdown-content fully vacated for PR9's purge). Roadmap drawer excerpts go through new MD.toPlainText; tasks.js untouched by design. Note: memory fallback views now use standard paragraph semantics (consecutive lines join) instead of per-line <p>. Stacked PR 2/9 - merge after PR1"
```
Expected: PR created against `main` with the stacked-merge note.

---

## PR3 — Overlay dismissal contract: keyboard-complete Confirm, Escape/backdrop for tasks, memory, rovo *(M)*

**Branch:** `ux-program/pr-3-overlay-dismissal` (from `ux-program/pr-2-markdown-renderer`) — **Contains:** WP6 (all): a node-tested `modal.helpers.js`, the rebuilt truly-modal keyboard-complete `ForgeUtils.Confirm` at z-1300, the canonical tasks `bindKeyboard()` (C1 — WP4's duplicate `bindGlobalKeys` is dropped), Escape + guarded backdrop dismissal for tasks/rovo/memory, and the STYLE_GUIDE "Overlay Dismissal Contract".
**Depends on:** PR2 (utils.js markdown block already deleted — anchor the Confirm rewrite by code, never by line number; memory.js renderer call sites already swapped) and PR1 (tasks.js parse/serialize/autoSave already restructured onto `TasksHelpers` — none of PR3's tasks.js blocks overlap it). Downstream: PR5 adds new Confirm consumers and migrates `memory.js`'s native `window.confirm` (C5 — leave it ALONE here); PR7 reuses `bindKeyboard()` unchanged.
**Review focus (per design doc):** Confirm keyboard semantics; Escape hierarchy ordering. Zero diff allowed to `product-forge.js`, `roadmap.js`, `roadmap.css`, `product-forge.css`.

---

### Task 3.1: ModalHelpers — pure keyboard/dismissal decision logic

**Files:**
- Create: `forge-shell/app/js/modal.helpers.js`
- Create: `forge-shell/test/modal.helpers.test.js`

**Interfaces:**
- Produces: `ModalHelpers.confirmKeyAction(key, activeTag) → 'cancel'|'confirm'|'trap'|null`; `ModalHelpers.tasksEscapeTarget({editOpen, settingsOpen, searchOpen}) → 'edit'|'settings'|'search'|null`. UMD (window global + CommonJS), no DOM access.

- [ ] **Step 1: Write the failing tests**

Create `forge-shell/test/modal.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/modal.helpers.js');

/* ── confirmKeyAction ── */

test('confirmKeyAction: Escape always cancels, regardless of focus', () => {
  assert.equal(H.confirmKeyAction('Escape', null), 'cancel');
  assert.equal(H.confirmKeyAction('Escape', 'BUTTON'), 'cancel');
  assert.equal(H.confirmKeyAction('Escape', 'INPUT'), 'cancel');
});

test('confirmKeyAction: Enter on a button defers to native click (null)', () => {
  assert.equal(H.confirmKeyAction('Enter', 'BUTTON'), null);
});

test('confirmKeyAction: Enter in a textarea keeps the newline (null)', () => {
  assert.equal(H.confirmKeyAction('Enter', 'TEXTAREA'), null);
});

test('confirmKeyAction: Enter confirms everywhere else', () => {
  assert.equal(H.confirmKeyAction('Enter', 'INPUT'), 'confirm');
  assert.equal(H.confirmKeyAction('Enter', null), 'confirm');
  assert.equal(H.confirmKeyAction('Enter', 'DIV'), 'confirm');
});

test('confirmKeyAction: Tab traps regardless of focus', () => {
  assert.equal(H.confirmKeyAction('Tab', 'BUTTON'), 'trap');
  assert.equal(H.confirmKeyAction('Tab', 'INPUT'), 'trap');
  assert.equal(H.confirmKeyAction('Tab', null), 'trap');
});

test('confirmKeyAction: other keys are ignored', () => {
  assert.equal(H.confirmKeyAction('a', 'INPUT'), null);
  assert.equal(H.confirmKeyAction('ArrowDown', null), null);
  assert.equal(H.confirmKeyAction('f', 'BUTTON'), null);
});

/* ── tasksEscapeTarget ── */

test('tasksEscapeTarget: edit modal wins over everything', () => {
  assert.equal(H.tasksEscapeTarget({ editOpen: true, settingsOpen: true, searchOpen: true }), 'edit');
  assert.equal(H.tasksEscapeTarget({ editOpen: true, settingsOpen: false, searchOpen: false }), 'edit');
});

test('tasksEscapeTarget: settings beats search', () => {
  assert.equal(H.tasksEscapeTarget({ editOpen: false, settingsOpen: true, searchOpen: true }), 'settings');
});

test('tasksEscapeTarget: search only', () => {
  assert.equal(H.tasksEscapeTarget({ editOpen: false, settingsOpen: false, searchOpen: true }), 'search');
});

test('tasksEscapeTarget: nothing open → null', () => {
  assert.equal(H.tasksEscapeTarget({ editOpen: false, settingsOpen: false, searchOpen: false }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/modal.helpers.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/modal.helpers.js'`.

- [ ] **Step 3: Create the helpers module**

Create `forge-shell/app/js/modal.helpers.js` (UMD wrapper identical to `app/js/roadmap.helpers.js`):

```js
/* ═══════════════════════════════════════════════════════════════
   Modal Helpers — pure keyboard/dismissal decision logic for the
   Overlay Dismissal Contract (see STYLE_GUIDE.md). No DOM access.
   Importable as <script> (window.ModalHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ModalHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Decide what a keypress inside the Confirm dialog does.
   * key: e.key; activeTag: document.activeElement.tagName or null.
   * Returns 'cancel' | 'confirm' | 'trap' | null.
   */
  function confirmKeyAction(key, activeTag) {
    if (key === 'Escape') return 'cancel';
    if (key === 'Enter') {
      /* Buttons keep native Enter=click (so Enter on the pre-focused
         Cancel button cancels); textareas keep newline; everything
         else confirms. */
      if (activeTag === 'BUTTON' || activeTag === 'TEXTAREA') return null;
      return 'confirm';
    }
    if (key === 'Tab') return 'trap';
    return null;
  }

  /** Tasks-view Escape hierarchy: exactly one surface closes per press. */
  function tasksEscapeTarget(state) {
    if (state.editOpen) return 'edit';
    if (state.settingsOpen) return 'settings';
    if (state.searchOpen) return 'search';
    return null;
  }

  return {
    confirmKeyAction: confirmKeyAction,
    tasksEscapeTarget: tasksEscapeTarget
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/modal.helpers.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/modal.helpers.js test/modal.helpers.test.js
git commit -m "feat(modal): ModalHelpers — pure keyboard/dismissal decision logic"
```

---

### Task 3.2: Rebuild ForgeUtils.Confirm — keyboard-complete, focus-managed, truly modal, z-1300

**Files:**
- Modify: `forge-shell/app/js/utils.js`
- Modify: `forge-shell/app/index.html`
- Modify: `forge-shell/app/css/components.css`
- Modify: `forge-shell/test/modal.helpers.test.js`

**Interfaces:**
- Consumes: `ModalHelpers.confirmKeyAction` (Task 3.1).
- Produces: `ForgeUtils.Confirm.show(title, message, details) → Promise<boolean>` — signature unchanged; now modal (capture-phase key interception), keyboard-complete, focus-managed. All four existing consumers (`fs-adapter.js` pickDirectory server branch, `product-forge.js` reparent + unparent, `tasks.js` deleteTask) inherit with **zero call-site changes**. PR5 adds more consumers.

> **Anchoring:** PR2 deleted utils.js's markdown block, so main's line numbers (623–638) are stale. Locate the Confirm block by searching for `ForgeUtils.Confirm = {` — it sits between the Toast section and `ForgeUtils.escapeHTML`.

- [ ] **Step 1: Give the Confirm buttons ids in index.html**

In `forge-shell/app/index.html`, inside `#confirm-dialog` → `.confirm-actions`, replace:

```html
        <button onclick="ForgeUtils.Confirm.resolve(false)">Cancel</button>
        <button class="primary" onclick="ForgeUtils.Confirm.resolve(true)">Confirm</button>
```

with (inline onclicks kept as-is; only ids added):

```html
        <button id="confirm-cancel" onclick="ForgeUtils.Confirm.resolve(false)">Cancel</button>
        <button id="confirm-ok" class="primary" onclick="ForgeUtils.Confirm.resolve(true)">Confirm</button>
```

- [ ] **Step 2: Load modal.helpers.js before utils.js**

In the script block at the bottom of `forge-shell/app/index.html`, find the line

```html
  <script src="js/utils.js"></script>
```

and insert directly ABOVE it:

```html
  <script src="js/modal.helpers.js"></script>
```

(As landed by PR2 there may be a `js/md.helpers.js` script nearby — order among the helper files does not matter; `modal.helpers.js` just has to precede `js/utils.js`.)

- [ ] **Step 3: Replace the Confirm object in utils.js**

In `forge-shell/app/js/utils.js`, replace this entire block (from its section header through the closing `};`, immediately before the `Helpers` section header / `ForgeUtils.escapeHTML`):

```js
/* ═══════════════════════════════════════════════════════════════
   Confirm — Promise-based confirm dialog
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Confirm = {
  _resolve: null,

  show(title, message, details) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-details').innerHTML = details || '';
    document.getElementById('confirm-dialog').classList.add('visible');
    return new Promise(r => { this._resolve = r; });
  },

  resolve(val) {
    document.getElementById('confirm-dialog').classList.remove('visible');
    if (this._resolve) { this._resolve(val); this._resolve = null; }
  }
};
```

with:

```js
/* ═══════════════════════════════════════════════════════════════
   Confirm — Promise-based confirm dialog
   Keyboard-complete + focus-managed (Overlay Dismissal Contract):
   - truly modal: while visible, a CAPTURE-phase document keydown
     stops propagation for ALL keys, so no view-level handler
     (roadmap/product-forge/tasks/memory/rovo) fires underneath;
   - Escape = cancel; Enter = confirm unless focus is on a BUTTON
     (native Enter=click wins, so Enter on the pre-focused Cancel
     cancels) or TEXTAREA (keeps newline) — see ModalHelpers;
   - Tab is trapped inside #confirm-dialog;
   - initial focus: first [autofocus] inside #confirm-details
     (fs-adapter path picker) else #confirm-cancel; prior focus
     restored on resolve.
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.Confirm = {
  _resolve: null,
  _keyHandler: null,
  _prevFocus: null,

  show(title, message, details) {
    this._unbind();  /* defensive: re-entrant show() */
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-details').innerHTML = details || '';
    const dialog = document.getElementById('confirm-dialog');
    dialog.classList.add('visible');

    this._prevFocus = document.activeElement;
    /* [autofocus] inside innerHTML-injected content never auto-focuses
       (the attribute only acts during page parse), so focus it here. */
    const target = dialog.querySelector('#confirm-details [autofocus]') ||
                   document.getElementById('confirm-cancel');
    if (target) target.focus();

    this._keyHandler = (e) => this._onKeydown(e, dialog);
    document.addEventListener('keydown', this._keyHandler, true); /* capture */
    return new Promise(r => { this._resolve = r; });
  },

  _onKeydown(e, dialog) {
    if (!dialog.classList.contains('visible')) return;
    e.stopPropagation();  /* modal: view-level handlers never fire */
    const tag = document.activeElement && document.activeElement.tagName;
    const action = window.ModalHelpers.confirmKeyAction(e.key, tag);
    if (action === 'cancel') { e.preventDefault(); this.resolve(false); }
    else if (action === 'confirm') { e.preventDefault(); this.resolve(true); }
    else if (action === 'trap') { this._trapTab(e, dialog); }
  },

  _trapTab(e, dialog) {
    const f = dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !dialog.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !dialog.contains(a))) { e.preventDefault(); first.focus(); }
  },

  _unbind() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
  },

  /* Keep resolve() the LAST method in this object:
     test/modal.helpers.test.js source-guards that nothing after the
     `resolve(val)` signature touches #confirm-details. */
  resolve(val) {
    document.getElementById('confirm-dialog').classList.remove('visible');
    this._unbind();
    /* Do NOT clear #confirm-details here: fs-adapter.js reads the
       path-picker input's value AFTER this promise resolves
       (server-mode folder picker). Clearing innerHTML would silently
       break "Select Project Folder" in server mode. */
    if (this._prevFocus && typeof this._prevFocus.focus === 'function') {
      try { this._prevFocus.focus(); } catch (ignore) { /* detached node */ }
    }
    this._prevFocus = null;
    if (this._resolve) { this._resolve(val); this._resolve = null; }
  }
};
```

- [ ] **Step 4: Stacking fix + focus ring in components.css**

In `forge-shell/app/css/components.css`, directly after the rule

```css
.modal-overlay.visible {
  display: flex;
}
```

insert:

```css
/* Shared Confirm dialog stacks above every view overlay.
   Documented ladder (STYLE_GUIDE.md): views ≤1200 < palette 1250
   < Confirm 1300. 1300 is the reserved ceiling for this dialog. */
#confirm-dialog { z-index: 1300; }
```

Then find the line

```css
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
```

and insert directly below it (verified: `theme.css` styles buttons with no `:focus-visible` rule of its own, so this guarantees a consistent accent ring on the pre-focused Cancel button; the accent custom property in `theme.css` is `--accent`):

```css
.confirm-actions button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Add the source-guard regression test**

Append to `forge-shell/test/modal.helpers.test.js`:

```js
/* ── Confirm source guard (regression: server-mode folder picker) ──
   utils.js is window-bound and cannot be require()d under Node, so
   guard the load-bearing invariant at source level: fs-adapter.js
   reads the path-picker input's value AFTER Confirm's promise
   resolves — resolve() must never clear #confirm-details. */

const fs = require('node:fs');
const path = require('node:path');

test('Confirm.resolve() must not clear #confirm-details (fs-adapter reads it after resolve)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'utils.js'), 'utf8');
  const start = src.indexOf('ForgeUtils.Confirm =');
  assert.notEqual(start, -1, 'ForgeUtils.Confirm block not found in utils.js');
  const end = src.indexOf('ForgeUtils.escapeHTML', start);
  const confirmSrc = src.slice(start, end === -1 ? src.length : end);
  assert.match(confirmSrc, /Do NOT clear #confirm-details/,
    'load-bearing warning comment missing from Confirm.resolve()');
  /* resolve(val) is the LAST method in the Confirm object, so
     everything after its signature is the resolve body. */
  const resolveSrc = confirmSrc.slice(confirmSrc.indexOf('resolve(val)'));
  assert.doesNotMatch(resolveSrc, /getElementById\(['"]confirm-details['"]\)/,
    'resolve() must not touch #confirm-details — fs-adapter reads the path input after the promise resolves');
});
```

- [ ] **Step 6: Run tests**

Run: `node --test test/modal.helpers.test.js`
Expected: PASS (11 tests).

- [ ] **Step 7: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173` in Chrome, open DevTools console, and drive the shared dialog directly (works regardless of which backend the picker uses):

```js
ForgeUtils.Confirm.show(
  'Keyboard check', 'Escape=false, Tab wraps, Enter in input=true',
  '<input id="kb-check" autofocus style="width:100%" />'
).then(v => console.log('resolved:', v, '| details readable after resolve:', document.getElementById('kb-check') !== null));
```

Expected, across repeated runs of the snippet:
- On open, the injected input has focus (autofocus honored programmatically).
- Press Escape → `resolved: false | details readable after resolve: true`.
- Re-run; press Tab repeatedly → focus cycles input → Cancel → Confirm → input (never leaves the dialog); Shift+Tab wraps in reverse.
- Re-run; with the input focused press Enter → `resolved: true`.
- Run `ForgeUtils.Confirm.show('Destructive check', 'Bare Enter must cancel', '').then(v => console.log('resolved:', v))` → the **Cancel** button is focused with a visible accent ring; press Enter → `resolved: false` (native click on the focused Cancel).
- Click a toolbar button first (to give it focus), run the snippet again, close the dialog → focus returns to that toolbar button.
- Run `getComputedStyle(document.getElementById('confirm-dialog')).zIndex` → `"1300"`.

- [ ] **Step 8: Commit**

```bash
git add app/js/utils.js app/index.html app/css/components.css test/modal.helpers.test.js
git commit -m "feat(confirm): keyboard-complete, focus-managed, truly modal Confirm at z-1300"
```

---

### Task 3.3: tasks.js — canonical bindKeyboard() with Escape hierarchy + backdrop close

**Files:**
- Modify: `forge-shell/app/js/tasks.js`

**Interfaces:**
- Consumes: `ModalHelpers.tasksEscapeTarget` (Task 3.1); existing `editModal.close()`, `closeSettingsPanel()`, `toggleSearchStrip()`, `clearAllFilters()`, module state `searchOpen`, module var `_keydownHandler` (already declared in the state block), scoped `$()` helper.
- Produces: `bindKeyboard()` (module-private, called from `init()` every activation) — **canonical per C1**; PR7 relies on it unchanged; WP4's duplicate `bindGlobalKeys` is dropped.

> **Anchoring:** as landed by PR1, tasks.js's parse/serialize/autoSave were rewritten onto `TasksHelpers` and `bindToolbarEvents`' data-action dispatch gained parent-chip branches (`open-parent`, `open-parent-modal`). None of that overlaps the blocks quoted below — anchor every edit on the quoted code, not on line numbers. The module var `var _keydownHandler = null;` already exists in the state block (after `let searchDebounceTimer = null;`) and `destroy()` already removes and nulls it — both stay exactly as-is.

- [ ] **Step 1: Move the keydown out of scaffold-once bindToolbarEvents**

This fixes the latent lifecycle bug: `destroy()` (run by `shell.js` on **every** view switch) permanently removed the handler, while `bindToolbarEvents()` (scaffold-once) never re-ran — so Cmd+F/Escape were dead after navigating away from Tasks and back.

In `bindToolbarEvents()`, DELETE this entire block:

```js
    /* Keyboard shortcut: Cmd/Ctrl+F */
    _keydownHandler = function (e) {
      var tasksView = document.getElementById('view-tasks');
      if (!tasksView || !tasksView.classList.contains('active')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchStrip();
      }
      if (e.key === 'Escape' && searchOpen) {
        clearAllFilters();
        toggleSearchStrip();
      }
    };
    document.addEventListener('keydown', _keydownHandler);
```

- [ ] **Step 2: Add bindKeyboard() with the Escape hierarchy**

Immediately after the closing `}` of `bindToolbarEvents()` (it ends with the "Matrix cell expand" listener), and before the `Active View State` section header, insert:

```js
  /* ══════════════════════════════════════════════════════════
     Keyboard — one document-level handler, bound from init() on
     every activation (Overlay Dismissal Contract, STYLE_GUIDE.md).
     Escape hierarchy: edit modal > settings > search — exactly one
     surface closes per keypress.
     ══════════════════════════════════════════════════════════ */
  function bindKeyboard() {
    if (_keydownHandler) return;  /* idempotent across re-inits */
    _keydownHandler = function (e) {
      var tasksView = document.getElementById('view-tasks');
      if (!tasksView || !tasksView.classList.contains('active')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchStrip();
        return;
      }
      if (e.key !== 'Escape') return;
      var editOverlay = $('[data-ref="edit-overlay"]');
      var settingsOverlay = $('[data-ref="settings-overlay"]');
      var target = ModalHelpers.tasksEscapeTarget({
        editOpen: !!(editOverlay && editOverlay.style.display === 'flex'),
        settingsOpen: !!(settingsOverlay && settingsOverlay.style.display === 'flex'),
        searchOpen: searchOpen
      });
      if (target === 'edit') editModal.close();
      else if (target === 'settings') closeSettingsPanel();
      else if (target === 'search') { clearAllFilters(); toggleSearchStrip(); }
    };
    document.addEventListener('keydown', _keydownHandler);
  }
```

Note: the pre-existing quirk where Escape inside the inline title editor also reaches this document handler is deliberately left unchanged (same behavior as today when no modal is open).

- [ ] **Step 3: Call bindKeyboard() from init() every activation**

In `async function init(handle)`, the scaffold-once block currently reads:

```js
    if (!initialized) {
      scaffold();
      loadFieldVisibility();
      loadViewVisibility();
      loadActiveView();
      loadHideDone();
      initialized = true;
    }

    /* Reset state */
```

Insert `bindKeyboard();` between the block and the `/* Reset state */` comment:

```js
    if (!initialized) {
      scaffold();
      loadFieldVisibility();
      loadViewVisibility();
      loadActiveView();
      loadHideDone();
      initialized = true;
    }

    /* Rebind on every activation — destroy() removes the handler on
       every view switch (Overlay Dismissal Contract). Keep this call
       before any await/early-return. */
    bindKeyboard();

    /* Reset state */
```

`destroy()` stays exactly as-is (it already removes and nulls `_keydownHandler`).

- [ ] **Step 4: Backdrop click with pointerdown guard for both overlays**

At the END of `bindToolbarEvents()`, directly after its last existing listener block (quoted here as the anchor):

```js
    /* Matrix cell expand */
    view.addEventListener('click', function (e) {
      var expandBtn = e.target.closest('.prod-matrix-expand');
      if (!expandBtn) return;
      var cell = expandBtn.closest('.prod-matrix-cell');
      if (cell) cell.classList.toggle('prod-matrix-cell-expanded');
    });
```

append (still inside `bindToolbarEvents`, before its closing `}`; scaffold-once binding is correct here — the overlay elements are created once by `scaffold()` and never replaced):

```js
    /* Backdrop click-to-close for the settings + edit overlays.
       pointerdown guard: only close when BOTH the initiating
       pointerdown AND the click landed on the backdrop itself, so a
       text-selection drag out of the edit textarea released over the
       backdrop never closes the modal (Overlay Dismissal Contract). */
    ['edit-overlay', 'settings-overlay'].forEach(function (ref) {
      var overlay = $('[data-ref="' + ref + '"]');
      if (!overlay) return;
      var armed = false;
      overlay.addEventListener('pointerdown', function (e) { armed = (e.target === overlay); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay && armed) {
          if (ref === 'edit-overlay') editModal.close();
          else closeSettingsPanel();
        }
        armed = false;
      });
    });
```

- [ ] **Step 5: Browser verification**

Run: `npm run serve` → `http://127.0.0.1:4173` in Chrome → select a project folder containing `tasks/` (e.g. the `the-forge` repo root) → open the Tasks view.
Expected:
- Cmd/Ctrl+F toggles the search strip; with search open and no modal, Escape clears filters and closes the strip.
- Open a task's edit modal **with the search strip open**: Escape #1 closes only the modal (filters/strip untouched); Escape #2 clears filters and closes the strip.
- Open Field Visibility Settings (toolbar gear): Escape closes it.
- Backdrop: clicking the dark backdrop closes the edit modal and the settings overlay; clicking inside modal content does not. Drag test: start a text selection inside the edit modal's body textarea, drag out, release over the backdrop → modal stays open.
- Lifecycle fix: switch Tasks → Memory → Tasks; Cmd+F and Escape still work (previously dead after the round trip).
- Confirm consumer + modality: on a disposable task, trigger Delete → the Confirm renders **above** everything; Escape → task NOT deleted; while the dialog is up, Cmd+F does NOT toggle search (capture-phase modality); re-trigger, press Enter with the pre-focused Cancel → not deleted; re-trigger, Tab to Confirm + Enter → task deleted.
- DevTools listener-leak check: `getEventListeners(document).keydown.length` is stable across 5× Tasks↔Memory switches.

- [ ] **Step 6: Commit**

```bash
git add app/js/tasks.js
git commit -m "feat(tasks): canonical bindKeyboard() with Escape hierarchy + guarded backdrop close"
```

---

### Task 3.4: rovo-agent-forge.js — Escape + backdrop dismissal for the edit modal

**Files:**
- Modify: `forge-shell/app/js/rovo-agent-forge.js`

**Interfaces:**
- Consumes: existing `editModal.close()`, `$q()` helper, `VIEW_ID` const, `raf-visible` class convention.
- Produces: `bindKeyboard()` (module-private, bound from `init()`, removed in `destroy()`).

- [ ] **Step 1: Add the module state var**

In the `/* ── State ── */` block, after:

```js
  var initialized = false;
  var prevSignature = '';
```

add:

```js
  var _keydownHandler = null;
```

- [ ] **Step 2: Add bindKeyboard() and backdrop close**

Replace the whole `bindModalActions` function:

```js
  function bindModalActions() {
    $qa('[data-raf-modal-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = el.dataset.rafModalAction;
        if (action === 'close') editModal.close();
        else if (action === 'toggle-diff') editModal.toggleDiff();
        else if (action === 'save') editModal.save();
      });
    });
  }
```

with:

```js
  function bindModalActions() {
    $qa('[data-raf-modal-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = el.dataset.rafModalAction;
        if (action === 'close') editModal.close();
        else if (action === 'toggle-diff') editModal.toggleDiff();
        else if (action === 'save') editModal.save();
      });
    });

    /* Backdrop click-to-close, pointerdown-guarded so a text-selection
       drag released over the backdrop never closes the modal
       (Overlay Dismissal Contract; element listener, bound once at
       scaffold — the overlay element is never replaced). */
    var overlay = $q('[data-raf-ref="modal-overlay"]');
    if (overlay) {
      var armed = false;
      overlay.addEventListener('pointerdown', function (e) { armed = (e.target === overlay); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay && armed) editModal.close();
        armed = false;
      });
    }
  }

  /* One document-level keydown per activation (Overlay Dismissal
     Contract, STYLE_GUIDE.md): Escape closes the edit modal only
     while it is visible. */
  function bindKeyboard() {
    if (_keydownHandler) return;  /* idempotent across re-inits */
    _keydownHandler = function (e) {
      var view = document.getElementById(VIEW_ID);
      if (!view || !view.classList.contains('active')) return;
      if (e.key !== 'Escape') return;
      var overlay = $q('[data-raf-ref="modal-overlay"]');
      if (overlay && overlay.classList.contains('raf-visible')) editModal.close();
    };
    document.addEventListener('keydown', _keydownHandler);
  }
```

- [ ] **Step 3: Bind from init(), unbind in destroy()**

In `async function init(handle)`, the scaffold-once block currently reads:

```js
    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Reset state for fresh init */
```

Insert the call between them (before any await/early-return in `init` — this placement is load-bearing, since `destroy()` removes the handler on every view switch):

```js
    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Rebind on every activation — destroy() removes the handler. */
    bindKeyboard();

    /* Reset state for fresh init */
```

Then replace:

```js
  function destroy() {
    stopAutoRefresh();
  }
```

with:

```js
  function destroy() {
    stopAutoRefresh();
    if (_keydownHandler) {
      document.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
  }
```

- [ ] **Step 4: Browser verification**

Run: `npm run serve` → `http://127.0.0.1:4173` → select a project containing `rovo-agents/` → open the Rovo Agent Forge view.
Expected:
- Select an agent → Edit → Escape closes the modal (exactly once); Escape with no modal open does nothing.
- Backdrop click closes the modal; clicking inside `.raf-modal-content` does not; a text-selection drag from a modal field released over the backdrop keeps it open.
- Switch to another view and back: Escape still works; opening/closing repeatedly closes exactly once per Escape (no duplicate handlers).

- [ ] **Step 5: Commit**

```bash
git add app/js/rovo-agent-forge.js
git commit -m "feat(rovo): Escape + guarded backdrop dismissal for the edit modal"
```

---

### Task 3.5: memory.js — document-level Escape + drag-out-guarded backdrop close

**Files:**
- Modify: `forge-shell/app/js/memory.js`

**Interfaces:**
- Consumes: existing `closeModal()`, scoped `$()` helper, `prod-visible` class convention.
- Produces: `bindKeyboard()` (module-private, bound from `init()`, removed in `destroy()`).

> **Anchoring:** PR2 swapped memory.js's markdown-renderer call sites — those are in the render functions, far from these blocks. Anchor every edit on the quoted code, not on line numbers. **Do NOT touch `deleteMemoryFile`'s native `window.confirm(...)`** — it migrates to `ForgeUtils.Confirm` in PR5 (C5).

- [ ] **Step 1: Add the module state var**

In the state block near the top, after:

```js
  let memorySortMode = 'name'; // 'name' | 'importance' | 'last_recalled'
```

add:

```js
  let _keydownHandler = null;
```

- [ ] **Step 2: Replace the vulnerable backdrop close and delete the broken view-scoped Escape**

In `bindToolbarEvents()`, replace this entire block:

```js
    /* Modal overlay click-outside */
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    /* Escape to close modal */
    view.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
```

with (the old Escape handler was bound to the `#view-memory` element, so it never fired when focus sat on `body` — macOS WebKit does not focus buttons on click; its replacement is the document-level `bindKeyboard()` below):

```js
    /* Modal overlay click-outside — pointerdown-guarded: a
       text-selection drag out of the file modal's edit textarea
       released over the backdrop must NOT close the modal
       (Overlay Dismissal Contract). */
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay) {
      var armed = false;
      overlay.addEventListener('pointerdown', function (e) { armed = (e.target === overlay); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay && armed) closeModal();
        armed = false;
      });
    }
```

- [ ] **Step 3: Add bindKeyboard() after bindToolbarEvents**

Immediately after the closing `}` of `bindToolbarEvents()`, insert:

```js
  /* One document-level keydown per activation (Overlay Dismissal
     Contract, STYLE_GUIDE.md). Document-level, not view-scoped:
     macOS WebKit leaves focus on <body> after a mouse-only open, so
     a view-scoped keydown never saw the Escape. */
  function bindKeyboard() {
    if (_keydownHandler) return;  /* idempotent across re-inits */
    _keydownHandler = function (e) {
      var memView = document.getElementById('view-memory');
      if (!memView || !memView.classList.contains('active')) return;
      if (e.key !== 'Escape') return;
      var overlay = $('[data-ref="modal-overlay"]');
      if (overlay && overlay.classList.contains('prod-visible')) closeModal();
    };
    document.addEventListener('keydown', _keydownHandler);
  }
```

- [ ] **Step 4: Bind from init(), unbind in destroy()**

In `async function init(handle)`, the scaffold-once block currently reads:

```js
    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Reset state */
```

Insert the call between them (before the `if (!rootHandle) { return; }` early-return further down — placement before any await/return is load-bearing):

```js
    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Rebind on every activation — destroy() removes the handler. */
    bindKeyboard();

    /* Reset state */
```

Then replace:

```js
  function destroy() {
    stopMemoryWatching();
  }
```

with:

```js
  function destroy() {
    stopMemoryWatching();
    if (_keydownHandler) {
      document.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }
  }
```

- [ ] **Step 5: Browser verification**

Run: `npm run serve` → `http://127.0.0.1:4173` → select a project containing `memory/` → open the Memory view.
Expected:
- Click a memory file card **with the mouse only** (no keyboard focus anywhere) → modal opens; press Escape immediately → modal closes even though focus is on `body` (this was broken before). Escape with no modal open does nothing.
- Backdrop click closes the modal; clicks inside content don't; a text-selection drag from the edit textarea released over the backdrop keeps it open.
- Delete a memory file → the prompt is still the **native** `window.confirm` (unchanged — PR5 migrates it).
- Switch views away and back: Escape still works; no duplicate closes.

- [ ] **Step 6: Commit**

```bash
git add app/js/memory.js
git commit -m "fix(memory): document-level Escape + drag-out-guarded backdrop close"
```

---

### Task 3.6: STYLE_GUIDE.md — codify the Overlay Dismissal Contract + layering ladder

**Files:**
- Modify: `forge-shell/STYLE_GUIDE.md`

**Interfaces:**
- Produces: the "Overlay Dismissal Contract" section — the normative reference for PR5 (Confirm adoption, `window.confirm` migration), PR7 (keyboard affordances), and PR8 (palette tier 1250; PR8 touches no docs, so the palette tier is recorded HERE).

- [ ] **Step 1: Append the contract section**

Append at the very END of `forge-shell/STYLE_GUIDE.md` (on main the file ends with the Sidebar Contract's "localStorage keys" subsection; as landed by PR2 a renderer section follows it — append after whatever is last, keeping edits append-only):

```md

## Overlay Dismissal Contract (added 2026-07-16)

Every modal/overlay owned by a view must support three dismissal paths:

1. **Close controls** — an × button in the header and a Cancel button in the
   footer, routed through the view's `data-<prefix>-action` dispatch.
2. **Escape** — one document-level `keydown` handler per view (module var
   `_keydownHandler`, bound by a `bindKeyboard()` called from `init()` with an
   `if (_keydownHandler) return;` guard, removed and nulled in `destroy()`).
   The handler must:
   - bail unless the view root (`#view-<pluginId>`) has `.active`;
   - implement an explicit Escape hierarchy, top-most surface first
     (menu → picker → modal → drawer → search/filter), closing exactly one
     surface per keypress (`return`/else-if after each branch);
   - never call `preventDefault()` for keys it does not consume.
3. **Backdrop click** — clicking the overlay backdrop closes the surface.
   Guard against text-selection drag-out: track `pointerdown` on the overlay
   and only close when BOTH the pointerdown and the click landed on the
   backdrop itself (`e.target === overlay`). Never close on events
   originating inside the modal content.

Confirmation prompts must use `ForgeUtils.Confirm.show()` — never
`window.confirm()`. The shared dialog is fully modal: while visible it binds
a capture-phase document keydown that stops propagation, so view-level
handlers never fire underneath it. It provides Escape = cancel,
Enter = confirm (unless focus is on a button or textarea — Enter on the
pre-focused Cancel button cancels), a Tab focus trap, initial focus on
`[autofocus]` inside the details HTML (form-style confirms) or the Cancel
button (destructive confirms), and focus restoration on close. If a future
global shortcut must work while a Confirm is up, it needs its own
capture-phase listener registered before Confirm's.

### Overlay layering ladder

| Tier | z-index | Owner |
|------|---------|-------|
| View surfaces (overlays, drawers, menus) | ≤ 1200 | each view's CSS |
| Command palette (reserved tier) | 1250 | shell chrome |
| `#confirm-dialog` (shared Confirm) | 1300 | `components.css` |

`z-index: 1300` is the documented ceiling, reserved for the shared dialog;
new view surfaces must stay at or below 1200.

Do not add per-overlay document listeners; extend the view's single keydown
handler instead. Reference implementations: `product-forge.js _bindKeyboard`
(view hierarchy) and `roadmap.js` (multi-surface hierarchy — do not modify).
```

- [ ] **Step 2: Commit**

```bash
git add STYLE_GUIDE.md
git commit -m "docs(style-guide): Overlay Dismissal Contract + overlay layering ladder"
```

---

### Task 3.7: Full-suite verification + open PR 3

**Files:**
- No new edits — verification and PR creation only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: everything passing, including the 11 new tests this PR adds (10 ModalHelpers + 1 Confirm source guard) on top of the suites landed by PR1 (`tasks.helpers`) and PR2 (`md.helpers`) and the pre-existing helper suites. Zero failures, zero skips.

- [ ] **Step 2: Zero-diff guard on untouched views**

Run: `git diff ux-program/pr-2-markdown-renderer...HEAD --stat -- app/js/product-forge.js app/js/roadmap.js app/css/roadmap.css app/css/product-forge.css app/css/productivity.css`
Expected: empty output (this PR touches none of them; the z-index fix lives in `components.css`).

- [ ] **Step 3: Three-runtime smoke checklist**

Chrome (FSA) via `npm run serve` + a real Chrome tab is the primary gate; server-mode (embedded/cmux browser, where `showDirectoryPicker` is unavailable) is REQUIRED for the path-picker row; Tauri (`npm run tauri:dev`) is a spot-check if the toolchain is available.

| Check | Tauri | Chrome (FSA) | server (cmux) |
|---|---|---|---|
| Confirm keyboard: Escape=false; bare Enter on pre-focused Cancel=false; Tab/Shift+Tab wrap inside `#confirm-dialog`; Tab→Confirm+Enter=true | spot-check | ✓ | ✓ |
| Confirm focus: Cancel focused with visible accent ring on open; prior focus restored on close | — | ✓ | — |
| fs-adapter path picker: input auto-focused; typed path + Enter resolves true and value still readable after resolve; Escape → same AbortError as Cancel | n/a (native dialog) | n/a (native picker) | ✓ **required** |
| Confirm modality: Cmd+F dead while a Confirm is up (tasks); Escape over an open roadmap filter panel closes only the dialog | — | ✓ | — |
| `#confirm-dialog` computed z-index = 1300; renders above the z-150 tasks overlays | — | ✓ | — |
| Tasks Escape hierarchy (edit > settings > search) + Cmd+F toggle + lifecycle round-trip (Tasks→Memory→Tasks) | spot-check | ✓ | ✓ |
| Backdrop close + drag-out guard: tasks edit, tasks settings, rovo modal, memory modal | — | ✓ | ✓ |
| Rovo + memory Escape: closes when open, no-ops when closed, survives view round trips (no duplicate handlers); memory closes on Escape with focus on `body` | — | ✓ | — |
| memory delete prompt still native `window.confirm` (PR5 migrates it) | — | ✓ | — |
| Each Confirm consumer resolves exactly once per show (Escape after Cancel-click does nothing) | — | ✓ | — |

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin ux-program/pr-3-overlay-dismissal
gh pr create --base main --title "Overlay dismissal contract: keyboard-complete Confirm + Escape/backdrop for tasks, memory, rovo" --body "Rebuilds ForgeUtils.Confirm as a truly modal, keyboard-complete dialog (Escape/Enter/Tab-trap, focus management, z-1300 ceiling) that all four existing call sites inherit unchanged, and brings the tasks/rovo/memory overlays onto the new Overlay Dismissal Contract: per-view document-level bindKeyboard() with an explicit Escape hierarchy, plus pointerdown-guarded backdrop close. Fixes the tasks lifecycle bug that permanently killed Cmd+F/Escape after a view round-trip and memory's view-scoped Escape that never fired on mouse-only opens. Contract + overlay layering ladder codified in STYLE_GUIDE.md; adds node-tested modal.helpers.js. Stacked PR 3/9 - merge after PR2"
```

Run: the two commands above (from `forge-shell/`; `git push` from anywhere in the repo).
Expected: PR created against `main` with the stacked-PR note; CI/`npm test` green.

---

## PR4 — Unified failure feedback: error-toast convention, rollback (writeTaskNow), scan-error banner *(L)*

**Branch:** `ux-program/pr-4-failure-feedback` (from `ux-program/pr-3-overlay-dismissal`) — **Contains:** WP3 (all): the severity-channel convention (every failed user-initiated write is a 6s error toast; the status pill is ambient-success only), snapshot/rollback for task writes via a new `writeTaskNow`, write-then-commit ordering in Memory, a dismissible per-view scan-error banner backed by a new `FeedbackHelpers` module + `ForgeUtils.ScanBanner`, and Product Forge `_doRefresh` resilience (a failed read is never treated as a deleted file).
**Depends on:** PR1 (`TasksHelpers.serializeTaskFile`/`parseTaskFile` and the richer task shape incl. `parent`/`source`/`__fm`) and PR3 (rewritten `ForgeUtils.Confirm` block in utils.js — `ScanBanner` is appended immediately after it). Must merge before PR5, which builds Product Forge write flows on this convention and on the resilient `_doRefresh`.

### Task 4.1: `FeedbackHelpers` module (TDD) + script tag

**Files:**
- Create: `app/js/feedback.helpers.js`, `test/feedback.helpers.test.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: nothing (pure logic, no DOM, no ForgeFS).
- Produces: `FeedbackHelpers` (window global + CommonJS export) — `scanErrorSignature(errors): string`, `scanBannerMessage(count, noun): string`, `shouldShowBanner(errors, dismissedSig): boolean`, `snapshotTask(task): object`, `restoreTask(task, snap): object`. Consumed by `ForgeUtils.ScanBanner` (Task 4.2) and the tasks.js rollback paths (Tasks 4.4, 4.5).

- [ ] **Step 1: Write failing tests**

Create `test/feedback.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/feedback.helpers.js');

/* ── scanErrorSignature ── */

test('scanErrorSignature: empty-safe', () => {
  assert.equal(H.scanErrorSignature([]), '');
  assert.equal(H.scanErrorSignature(null), '');
  assert.equal(H.scanErrorSignature(undefined), '');
});

test('scanErrorSignature: order-insensitive, path-based', () => {
  const a = [
    { path: 'tasks/task-001.md', message: 'EACCES' },
    { path: 'tasks/task-002.md', message: 'EIO' }
  ];
  const b = [a[1], a[0]];
  assert.equal(H.scanErrorSignature(a), H.scanErrorSignature(b));
  assert.equal(H.scanErrorSignature(a), 'tasks/task-001.md|tasks/task-002.md');
});

/* ── shouldShowBanner ── */

test('shouldShowBanner: empty error set -> false', () => {
  assert.equal(H.shouldShowBanner([], ''), false);
  assert.equal(H.shouldShowBanner(null, undefined), false);
});

test('shouldShowBanner: dismissed identical set -> false', () => {
  const errors = [{ path: 'memory/notes/a.md', message: 'boom' }];
  const sig = H.scanErrorSignature(errors);
  assert.equal(H.shouldShowBanner(errors, sig), false);
});

test('shouldShowBanner: changed set -> true', () => {
  const errors = [{ path: 'memory/notes/a.md', message: 'boom' }];
  const sig = H.scanErrorSignature(errors);
  const grown = errors.concat([{ path: 'memory/notes/b.md', message: 'boom' }]);
  assert.equal(H.shouldShowBanner(grown, sig), true);
  assert.equal(H.shouldShowBanner(errors, undefined), true);
});

/* ── scanBannerMessage ── */

test('scanBannerMessage: pluralizes the noun', () => {
  assert.equal(H.scanBannerMessage(1, 'task file'), '1 task file could not be read');
  assert.equal(H.scanBannerMessage(3, 'task file'), '3 task files could not be read');
  assert.equal(H.scanBannerMessage(2, 'card file'), '2 card files could not be read');
});

/* ── snapshotTask / restoreTask ── */

test('snapshotTask: deep-copies arrays (mutating live task leaves snapshot intact)', () => {
  const task = {
    filename: 'task-001.md', title: 'A', status: 'Open', priority: 3,
    tags: ['ui'], dependencies: ['task-002.md'],
    __fm: { keyOrder: ['title', 'status'], unknown: { source: ['source: jira'] }, listStyle: { tags: 'inline' }, warnings: [] }
  };
  const snap = H.snapshotTask(task);
  task.tags.push('backend');
  task.__fm.keyOrder.push('priority');
  assert.deepEqual(snap.tags, ['ui']);
  assert.deepEqual(snap.__fm.keyOrder, ['title', 'status']);
  assert.notEqual(snap.tags, task.tags);
});

test('restoreTask: round-trips a full task back to the snapshot', () => {
  const task = {
    filename: 'task-001.md', title: 'Original', status: 'Open', priority: 2,
    assignee: 'jb', creator: null, created: '2026-07-01', updated: '2026-07-10',
    due_date: null, dependencies: ['task-002.md'], tags: ['ui'],
    external_link: null, external_id: null, parent: 'story-001-x.md', source: 'jira',
    body: 'Body text',
    __fm: { keyOrder: ['title'], unknown: {}, listStyle: {}, warnings: [] }
  };
  const snap = H.snapshotTask(task);
  task.title = 'Changed';
  task.status = 'In Progress';
  task.priority = 5;
  task.tags = ['ui', 'backend'];
  task.dependencies = [];
  task.updated = '2026-07-16';
  const restored = H.restoreTask(task, snap);
  assert.equal(restored, task);
  assert.equal(task.title, 'Original');
  assert.equal(task.status, 'Open');
  assert.equal(task.priority, 2);
  assert.deepEqual(task.tags, ['ui']);
  assert.deepEqual(task.dependencies, ['task-002.md']);
  assert.equal(task.updated, '2026-07-10');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `forge-shell/`):
```bash
node --test test/feedback.helpers.test.js
```
Expected: failure — `Error: Cannot find module '../app/js/feedback.helpers.js'` (all tests fail to load).

- [ ] **Step 3: Implement the module**

Create `app/js/feedback.helpers.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Feedback Helpers — pure logic for failure feedback
   Scan-banner signatures/messages + optimistic-write snapshots.
   UMD: window.FeedbackHelpers in the browser, module.exports for
   node --test. No DOM, no ForgeFS.
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FeedbackHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Stable signature of an error set — order-insensitive. errors: [{path, message}] */
  function scanErrorSignature(errors) {
    return (errors || []).map(function (e) { return e.path; }).sort().join('|');
  }

  /** 'N <noun>(s) could not be read' */
  function scanBannerMessage(count, noun) {
    return count + ' ' + noun + (count === 1 ? '' : 's') + ' could not be read';
  }

  /** Show banner? false when empty or when the current set was already dismissed. */
  function shouldShowBanner(errors, dismissedSig) {
    if (!errors || errors.length === 0) return false;
    return scanErrorSignature(errors) !== dismissedSig;
  }

  /** Deep snapshot of a plain task/record object (JSON-safe values only). */
  function snapshotTask(task) {
    return JSON.parse(JSON.stringify(task));
  }

  /** Restore snapshot fields onto the live object (task shape is fixed;
      keys added after the snapshot are not expected). Returns the live object. */
  function restoreTask(task, snap) {
    Object.keys(snap).forEach(function (k) { task[k] = snap[k]; });
    return task;
  }

  return {
    scanErrorSignature: scanErrorSignature,
    scanBannerMessage: scanBannerMessage,
    shouldShowBanner: shouldShowBanner,
    snapshotTask: snapshotTask,
    restoreTask: restoreTask
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
node --test test/feedback.helpers.test.js
```
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Load the module in the browser**

In `app/index.html`, the script block currently begins (with `md.helpers.js` as landed by PR2 and `modal.helpers.js` as landed by PR3):

```html
  <script src="js/fs-adapter.js"></script>
  <script src="js/md.helpers.js"></script>
  <script src="js/modal.helpers.js"></script>
  <script src="js/utils.js"></script>
```

Insert the new script immediately before `js/utils.js` (ScanBanner in utils.js references `window.FeedbackHelpers` at call time, but keeping helpers-before-utils is the house convention):

```html
  <script src="js/fs-adapter.js"></script>
  <script src="js/md.helpers.js"></script>
  <script src="js/modal.helpers.js"></script>
  <script src="js/feedback.helpers.js"></script>
  <script src="js/utils.js"></script>
```

- [ ] **Step 6: Commit**

Run:
```bash
git add app/js/feedback.helpers.js test/feedback.helpers.test.js app/index.html
git commit -m "Add FeedbackHelpers module: scan-banner signatures + task snapshot/restore (TDD)"
```
Expected: commit created on `ux-program/pr-4-failure-feedback`.

### Task 4.2: Toast hardening + `ForgeUtils.ScanBanner` + banner CSS

**Files:**
- Modify: `app/js/utils.js`, `app/css/components.css`, `app/css/productivity.css`

**Interfaces:**
- Consumes: `window.FeedbackHelpers` (Task 4.1).
- Produces: `ForgeUtils.ScanBanner.update(bannerEl: Element|null, errors: Array<{path, message}>, noun: string): void` — consumed by tasks.js (Task 4.6), memory.js (Task 4.7), product-forge.js (Task 4.8). `ForgeUtils.Toast.show` keeps its exact signature; all existing call sites are unaffected.

- [ ] **Step 1: Harden Toast (ARIA role + click-to-dismiss)**

In `app/js/utils.js`, find the Toast block (untouched by PR1-PR3):

```js
ForgeUtils.Toast = {
  show(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};
```

Replace it with:

```js
ForgeUtils.Toast = {
  show(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    el.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');
    el.title = 'Click to dismiss';
    el.addEventListener('click', function () { el.remove(); });
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};
```

- [ ] **Step 2: Append `ForgeUtils.ScanBanner` after the Confirm block**

In `app/js/utils.js`, locate the closing `};` of the `ForgeUtils.Confirm = { ... };` object (rewritten in place by PR3 — it now ends with the `resolve(val)` method). Immediately after that `};`, and BEFORE the `Helpers` section banner comment (`/* ═══ ... Helpers ... ═══ */` above `ForgeUtils.escapeHTML`), insert:

```js
/* ═══════════════════════════════════════════════════════════════
   ScanBanner — per-view dismissible "N files could not be read"
   Dismissal is remembered per error-set signature on the element's
   dataset: an identical error set stays dismissed across re-renders,
   any changed set re-shows, an empty set clears banner + dismissal.
   ═══════════════════════════════════════════════════════════════ */
ForgeUtils.ScanBanner = {
  /**
   * Render/refresh a scan-error banner.
   * @param {Element|null} bannerEl — the view's .scan-error-banner div
   * @param {Array<{path:string,message:string}>} errors — [] clears + resets dismissal
   * @param {string} noun — e.g. 'task file', 'memory file', 'card file'
   */
  update: function (bannerEl, errors, noun) {
    if (!bannerEl) return;
    var FH = window.FeedbackHelpers;
    errors = errors || [];
    if (errors.length === 0) {
      bannerEl.classList.add('hidden');
      bannerEl.innerHTML = '';
      delete bannerEl.dataset.dismissedSig;
      bannerEl.removeAttribute('title');
      return;
    }
    var sig = FH.scanErrorSignature(errors);
    if (!FH.shouldShowBanner(errors, bannerEl.dataset.dismissedSig)) return; /* stays dismissed */
    bannerEl.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation scan-banner-icon"></i>' +
      '<span class="scan-banner-text">' + ForgeUtils.escapeHTML(FH.scanBannerMessage(errors.length, noun)) + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn-icon scan-banner-dismiss" data-scan-dismiss title="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
    bannerEl.title = errors.map(function (e) { return e.path + ' — ' + e.message; }).join('\n');
    bannerEl.setAttribute('role', 'alert');
    bannerEl.querySelector('[data-scan-dismiss]').addEventListener('click', function () {
      bannerEl.dataset.dismissedSig = sig;
      bannerEl.classList.add('hidden');
    });
    bannerEl.classList.remove('hidden');
  }
};
```

- [ ] **Step 3: Banner CSS in components.css**

In `app/css/components.css`, find the end of the Toast section:

```css
@keyframes toastIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Empty State (generic) ── */
```

Insert between the `@keyframes toastIn` rule and the `/* ── Empty State (generic) ── */` comment:

```css
/* ── Scan Error Banner (per-view, dismissible) ── */
.scan-error-banner {
  position: absolute;
  top: var(--toolbar-height);
  left: 0; right: 0;
  z-index: 60;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 16px;
  font-size: 12.5px;
  color: var(--text-primary);
  background: color-mix(in srgb, #e74c3c 14%, var(--bg-secondary));
  border-bottom: 1px solid color-mix(in srgb, #e74c3c 35%, var(--border-color));
}

.scan-error-banner.hidden { display: none; }
.scan-error-banner .scan-banner-icon { color: #e74c3c; }
.scan-error-banner .spacer { flex: 1; }
.scan-error-banner .scan-banner-dismiss { width: 24px; height: 24px; font-size: 13px; }
```

- [ ] **Step 4: Anchor the banner in .prod-layout**

In `app/css/productivity.css`, find (lines 7-12; PR1 only appended rules to this file, this block is untouched):

```css
.prod-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
```

Replace with:

```css
.prod-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;   /* anchors .scan-error-banner */
}
```

(`.pfl-layout` already has `position: relative` — no product-forge.css change needed.)

- [ ] **Step 5: Browser verification**

Run:
```bash
npm run serve
```
Expected: `http://127.0.0.1:4173` serving. Open it in Chrome, select the project folder, then in DevTools console:

```js
ForgeUtils.Toast.show('Injected failure', 'error', 6000)
```
Expected: red toast, stays ~6s, `role="alert"` in the inspector, clicking it dismisses immediately.

```js
var d = document.createElement('div');
d.className = 'scan-error-banner hidden';
document.querySelector('#view-tasks .prod-layout').appendChild(d);
ForgeUtils.ScanBanner.update(d, [{ path: 'tasks/task-001.md', message: 'EACCES injected' }], 'task file');
```
Expected (Tasks view active): red strip directly under the toolbar reading "1 task file could not be read", hover tooltip `tasks/task-001.md — EACCES injected`, the × hides it; calling `update` again with the same array keeps it hidden; calling with `[]` clears it. Remove the scratch div afterwards (`d.remove()`).

- [ ] **Step 6: Commit**

Run:
```bash
git add app/js/utils.js app/css/components.css app/css/productivity.css
git commit -m "Harden Toast (role, click-to-dismiss); add ForgeUtils.ScanBanner + banner CSS"
```
Expected: commit created.

### Task 4.3: `scanCardsDir` gains a backward-compatible `outErrors` out-param

**Files:**
- Modify: `app/js/card-data.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `async scanCardsDir(cardsHandle, outErrors?)` — when `outErrors` (an array) is provided, `{path, message}` entries are pushed for each read failure; directory-level failures use a trailing-`'/'` path so callers can tell them apart. Roadmap's call sites (`roadmap.js:2897`, `roadmap.js:2952`) pass no second argument and are untouched. Consumed by product-forge.js in Task 4.8.

- [ ] **Step 1: Replace the function**

`card-data.js` is first-touch in this stack (no earlier PR modifies it). Find the whole `scanCardsDir` function (lines 171-218 on the merged tree):

```js
  async function scanCardsDir(cardsHandle) {
    const files = new Map();
    if (!cardsHandle) return files;

    try {
      // List directories in cards/ folder
      const entries = await ForgeFS.readDir(cardsHandle, '');

      for (const entry of entries) {
        if (entry.kind !== 'directory') continue;
        if (!EXPECTED_DIRS.includes(entry.name)) continue;

        try {
          // List .md files in this subdirectory
          const subEntries = await ForgeFS.readDir(cardsHandle, entry.name);

          for (const fileEntry of subEntries) {
            if (fileEntry.kind !== 'file' || !fileEntry.name.endsWith('.md')) continue;

            const filename = fileEntry.name.replace(/\.md$/, '');
            try {
              // Read file content using ForgeFS
              const content = await ForgeFS.readFile(cardsHandle, `${entry.name}/${fileEntry.name}`);
              const meta = await ForgeFS.getFileMeta(cardsHandle, `${entry.name}/${fileEntry.name}`);

              files.set(filename, {
                handle: typeof cardsHandle === 'string'
                  ? `${cardsHandle}/${entry.name}/${fileEntry.name}`
                  : fileEntry,
                dirName: entry.name,
                fileName: fileEntry.name,
                lastModified: meta.modified,
                content: content
              });
            } catch (e) {
              console.warn('Failed to read ' + fileEntry.name + ':', e);
            }
          }
        } catch (e) {
          console.warn('Failed to scan ' + entry.name + ':', e);
        }
      }
    } catch (e) {
      console.error('Failed to scan cards directory:', e);
    }

    return files;
  }
```

Replace it with (only the signature and the three catch blocks change — all console output is preserved):

```js
  /**
   * Scan cards/ for .md files.
   * @param {*} cardsHandle
   * @param {Array<{path:string,message:string}>} [outErrors] — optional out-param;
   *   when provided, one entry is pushed per read failure. Directory-level
   *   failures use a trailing-'/' path by convention.
   */
  async function scanCardsDir(cardsHandle, outErrors) {
    const files = new Map();
    if (!cardsHandle) return files;

    try {
      // List directories in cards/ folder
      const entries = await ForgeFS.readDir(cardsHandle, '');

      for (const entry of entries) {
        if (entry.kind !== 'directory') continue;
        if (!EXPECTED_DIRS.includes(entry.name)) continue;

        try {
          // List .md files in this subdirectory
          const subEntries = await ForgeFS.readDir(cardsHandle, entry.name);

          for (const fileEntry of subEntries) {
            if (fileEntry.kind !== 'file' || !fileEntry.name.endsWith('.md')) continue;

            const filename = fileEntry.name.replace(/\.md$/, '');
            try {
              // Read file content using ForgeFS
              const content = await ForgeFS.readFile(cardsHandle, `${entry.name}/${fileEntry.name}`);
              const meta = await ForgeFS.getFileMeta(cardsHandle, `${entry.name}/${fileEntry.name}`);

              files.set(filename, {
                handle: typeof cardsHandle === 'string'
                  ? `${cardsHandle}/${entry.name}/${fileEntry.name}`
                  : fileEntry,
                dirName: entry.name,
                fileName: fileEntry.name,
                lastModified: meta.modified,
                content: content
              });
            } catch (e) {
              console.warn('Failed to read ' + fileEntry.name + ':', e);
              if (outErrors) outErrors.push({ path: entry.name + '/' + fileEntry.name, message: e.message || String(e) });
            }
          }
        } catch (e) {
          console.warn('Failed to scan ' + entry.name + ':', e);
          if (outErrors) outErrors.push({ path: entry.name + '/', message: e.message || String(e) });
        }
      }
    } catch (e) {
      console.error('Failed to scan cards directory:', e);
      if (outErrors) outErrors.push({ path: 'cards/', message: e.message || String(e) });
    }

    return files;
  }
```

- [ ] **Step 2: Regression check**

Run:
```bash
npm test
```
Expected: all tests green (this file has no unit suite; the change is exercised in the browser in Task 4.8, and this run guards the roadmap/product-forge helper suites against accidental breakage).

- [ ] **Step 3: Commit**

Run:
```bash
git add app/js/card-data.js
git commit -m "card-data: scanCardsDir optional outErrors out-param (dir-level failures use trailing-/ paths)"
```
Expected: commit created.

### Task 4.4: tasks.js — `writeTaskNow` + snapshot rollback (autoSave, markChanged, inline edit, modal save)

**Files:**
- Modify: `app/js/tasks.js`

**Interfaces:**
- Consumes: `TasksHelpers.serializeTaskFile(task)` (as landed by PR1 — throws `'Cannot save task: invalid status ...'` / `'Cannot save task: invalid priority ... Must be integer 1-5 or null.'` before any IO); `FeedbackHelpers.snapshotTask` / `FeedbackHelpers.restoreTask` (Task 4.1). Snapshots automatically cover the richer PR1 task shape (`parent`, `source`, `__fm` unknown-key raw blocks) because they deep-copy whatever fields exist.
- Produces: module-private `async writeTaskNow(task)` — sets `task.updated`, serializes (throws on invalid), writes via `ForgeFS.writeFile`, rebuilds `taskSignature`, manages the `suppressExternalToasts` window. The snapshot-restore pattern is the contract PR5 builds on for cards.

- [ ] **Step 1: Add module state**

Near the top of the tasks.js IIFE, find the module variable (present on main; PR3's `bindKeyboard` reuses it):

```js
  var _keydownHandler = null;
```

Add directly below it:

```js
  var pendingRollback = null;   /* { filename, snapshot } — FIRST snapshot per debounce window */
  var scanErrors = [];          /* [{path, message}] from the last parseTaskFiles scan */
  var tagsDirty = false;        /* tags.md write failed; retry on next tag add / refresh */
```

(`scanErrors` is consumed in Task 4.6, `tagsDirty` in Task 4.5 — declared here once so this state block is touched a single time.)

- [ ] **Step 2: Extend `markChanged` to capture the first snapshot per debounce window**

Find (unchanged by PR1/PR3):

```js
  function markChanged(task) {
    hasChanges = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function () { autoSave(task); }, 500);
  }
```

Replace with:

```js
  function markChanged(task, snapshot) {
    /* Capture the FIRST pre-mutation snapshot per debounce window so a
       failed write rolls back to the state before the first edit. */
    if (snapshot && !pendingRollback) {
      pendingRollback = { filename: task.filename, snapshot: snapshot };
    }
    hasChanges = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function () { autoSave(task); }, 500);
  }
```

- [ ] **Step 3: Replace `autoSave` with `writeTaskNow` + a thin rollback wrapper**

Find the entire `async function autoSave(task) { ... }` as landed by PR1. Landmarks: it guards on `if (!tasksDirHandle || !hasChanges || isSaving) return;`, sets `task.updated = new Date().toISOString().split('T')[0];` immediately BEFORE `TasksHelpers.serializeTaskFile(task)` (PR1's ordering fix), toasts serialize errors, calls `ForgeFS.writeFile` + `buildTaskSignature`, shows the `showStatus('Save failed: ' + e.message)` pill on write failure, and ends with the `setTimeout(... suppressExternalToasts = false ..., 1000)` window.

Replace that whole function with these two functions (the `updated`-before-serialize fix is preserved inside `writeTaskNow`; `TasksHelpers.serializeTaskFile` keeps its exact throw messages):

```js
  /* Immediate write shared by autoSave + moveTaskToStatus.
     Sets task.updated BEFORE serializing (PR1 ordering fix preserved);
     serializeTaskFile validation throws BEFORE any IO. Manages the
     suppressExternalToasts window exactly as autoSave did. Throws on
     serialize/write failure — callers own the feedback + rollback. */
  async function writeTaskNow(task) {
    task.updated = new Date().toISOString().split('T')[0];
    var content = TasksHelpers.serializeTaskFile(task);
    suppressExternalToasts = true;
    try {
      await ForgeFS.writeFile(tasksDirHandle, task.filename, content);
      taskSignature = await buildTaskSignature();
    } finally {
      setTimeout(function () { suppressExternalToasts = false; }, 1000);
    }
  }

  async function autoSave(task) {
    if (!tasksDirHandle || !hasChanges || isSaving) return;
    isSaving = true;
    try {
      await writeTaskNow(task);
      hasChanges = false;
      showStatus('Saved');
    } catch (e) {
      if (pendingRollback && pendingRollback.filename === task.filename) {
        FeedbackHelpers.restoreTask(task, pendingRollback.snapshot);
        hasChanges = false;   /* memory matches disk again */
        renderTasks();
        ForgeUtils.Toast.show('Save failed — changes reverted: ' + (e.message || e), 'error', 6000);
      } else {
        hasChanges = true;    /* no snapshot -> legacy keep-dirty behavior */
        ForgeUtils.Toast.show('Save failed: ' + (e.message || e), 'error', 6000);
      }
    }
    pendingRollback = null;
    isSaving = false;
  }
```

- [ ] **Step 4: Inline title edit passes a pre-mutation snapshot**

In the card click dispatch, find:

```js
      if (action === 'edit-title') {
        startInlineEdit(target, task.title, function (val) {
          if (val && val !== task.title) { task.title = val; markChanged(task); }
          renderTasks();
        });
      }
```

Replace with:

```js
      if (action === 'edit-title') {
        startInlineEdit(target, task.title, function (val) {
          if (val && val !== task.title) {
            var snap = FeedbackHelpers.snapshotTask(task);
            task.title = val;
            markChanged(task, snap);
          }
          renderTasks();
        });
      }
```

- [ ] **Step 5: `editModal.save` — snapshot before mutation, drop the premature success toast**

Find (unchanged by PR1/PR3 — PR1 only touched `_getFormData`):

```js
    save: async function () {
      if (!this.currentTask) return;
      var newTask = this._getFormData();

      try {
        // Find task in array and update it
        var task = tasks.find(function (t) { return t.filename === newTask.filename; });
        if (!task) {
          ForgeUtils.Toast.show('Task not found', 'error');
          return;
        }

        // Update all fields
        Object.keys(newTask).forEach(function (key) {
          task[key] = newTask[key];
        });

        // Trigger auto-save
        markChanged(task);
        renderTasks();
        this.close();
        ForgeUtils.Toast.show('Task saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    }
```

Replace with (the real outcome is now reported by `autoSave` — 'Saved' pill on success, rollback + error toast on failure — so the premature `'Task saved successfully'` toast is deleted):

```js
    save: async function () {
      if (!this.currentTask) return;
      var newTask = this._getFormData();

      var task = tasks.find(function (t) { return t.filename === newTask.filename; });
      if (!task) {
        ForgeUtils.Toast.show('Task not found', 'error');
        return;
      }

      /* Snapshot BEFORE mutation so a failed write rolls everything back */
      var snap = FeedbackHelpers.snapshotTask(task);

      // Update all fields
      Object.keys(newTask).forEach(function (key) {
        task[key] = newTask[key];
      });

      // Trigger auto-save; autoSave restores `snap` and toasts on failure
      markChanged(task, snap);
      renderTasks();
      this.close();
    }
```

- [ ] **Step 6: Browser verification**

Run:
```bash
npm run serve
```
Open `http://127.0.0.1:4173`, select the project folder, go to Tasks. In DevTools:

```js
const _w = ForgeFS.writeFile.bind(ForgeFS);
ForgeFS.writeFile = () => Promise.reject(new Error('EACCES injected'));
```

- Double-click a card title, change it, press Enter. Expected: after the 500ms debounce the title reverts to the original, the board re-renders, and a red toast "Save failed — changes reverted: EACCES injected" shows for ~6s. No 'Save failed' status pill.
- Open a card's edit modal, change title + priority, Save. Expected: modal closes, then all edited fields revert; same red toast; NO 'Task saved successfully' toast at any point.
- Restore writes (`ForgeFS.writeFile = _w`), edit a title again. Expected: 'Saved' pill only; the task file on disk has the new title and today's `updated:` date; `parent:`/`source:`/unknown frontmatter keys are still present in the file (PR1 round-trip preserved through rollback plumbing).

- [ ] **Step 7: Commit**

Run:
```bash
git add app/js/tasks.js
git commit -m "tasks: extract writeTaskNow; snapshot rollback for autoSave (inline + modal edits)"
```
Expected: commit created.

### Task 4.5: tasks.js — immediate board-move write, toast error channels, tags dirty-retry

**Files:**
- Modify: `app/js/tasks.js`

**Interfaces:**
- Consumes: `writeTaskNow` (Task 4.4), `FeedbackHelpers.snapshotTask`/`restoreTask`, `TasksHelpers.serializeTaskFile` (as landed by PR1, in `addNewTask`).
- Produces: nothing new — brings tasks.js fully onto the severity-channel convention.

- [ ] **Step 1: `moveTaskToStatus` becomes an immediate awaited write with rollback**

Find `moveTaskToStatus` as landed by PR1 (landmarks: it has PR1's no-op guard `if (!task || task.status === newStatus) return;`, then mutates `task.status`, calls `renderTasks()`, `showStatus('Moved to ' + newStatus)`, and `markChanged(task)`):

```js
  async function moveTaskToStatus(filename, newStatus) {
    var task = tasks.find(function (t) { return t.filename === filename; });
    if (!task || task.status === newStatus) return; // same-column drop = no write

    task.status = newStatus;
    renderTasks();
    showStatus('Moved to ' + newStatus);
    markChanged(task);
  }
```

Replace with (mirrors roadmap's `assignRelease`: optimistic paint -> awaited write -> success pill; failure -> restore + re-render + error toast; no debounce):

```js
  async function moveTaskToStatus(filename, newStatus) {
    var task = tasks.find(function (t) { return t.filename === filename; });
    if (!task || task.status === newStatus) return;

    var snap = FeedbackHelpers.snapshotTask(task);
    task.status = newStatus;
    renderTasks();                                 /* optimistic paint */
    try {
      await writeTaskNow(task);
      showStatus('Moved to ' + newStatus);
    } catch (e) {
      FeedbackHelpers.restoreTask(task, snap);
      renderTasks();                               /* card returns to its original column */
      ForgeUtils.Toast.show('Move failed — reverted: ' + (e.message || e), 'error', 6000);
    }
  }
```

- [ ] **Step 2: `addNewTask` failure/success move to toasts**

Inside `addNewTask`, find the try/catch as landed by PR1 (only `TasksHelpers.serializeTaskFile` differs from main):

```js
    try {
      suppressExternalToasts = true;
      var content = TasksHelpers.serializeTaskFile(newTask);
      await ForgeFS.writeFile(tasksDirHandle, newFilename, content);
      tasks.push(newTask);
      taskSignature = await buildTaskSignature();
      renderTasks();
      showStatus('Task created');
      setTimeout(function () { suppressExternalToasts = false; }, 1000);
    } catch (e) {
      showStatus('Error creating task: ' + e.message);
      suppressExternalToasts = false;
    }
```

Replace with (create is a discrete lifecycle op -> success toast, consistent with `deleteTask`'s existing 'Task deleted' toast; failure is an error toast — note `tasks.push` only runs after the write succeeds, so no ghost card):

```js
    try {
      suppressExternalToasts = true;
      var content = TasksHelpers.serializeTaskFile(newTask);
      await ForgeFS.writeFile(tasksDirHandle, newFilename, content);
      tasks.push(newTask);
      taskSignature = await buildTaskSignature();
      renderTasks();
      ForgeUtils.Toast.show('Task created', 'success');
      setTimeout(function () { suppressExternalToasts = false; }, 1000);
    } catch (e) {
      ForgeUtils.Toast.show('Error creating task: ' + (e.message || e), 'error', 6000);
      suppressExternalToasts = false;
    }
```

- [ ] **Step 3: `saveTags` dirty-retry**

Find:

```js
  async function saveTags() {
    try {
      var content = '# Available Tags\n\n' + allTags.join('\n') + '\n';
      await ForgeFS.writeFile(tasksDirHandle, 'tags.md', content);
    } catch (e) {
      console.warn('Failed to save tags.md:', e);
    }
  }
```

Replace with (the tag stays in `allTags` — `saveTags` always writes the full list, so any later successful write includes previously-failed tags; the toast fires once, on the transition into dirty, and silent retries don't re-toast):

```js
  async function saveTags() {
    try {
      var content = '# Available Tags\n\n' + allTags.join('\n') + '\n';
      await ForgeFS.writeFile(tasksDirHandle, 'tags.md', content);
      tagsDirty = false;
    } catch (e) {
      console.warn('Failed to save tags.md:', e);
      if (!tagsDirty) {
        tagsDirty = true;
        ForgeUtils.Toast.show('Failed to save tags.md — will retry: ' + (e.message || e), 'error', 6000);
      }
    }
  }
```

(`addNewTag` directly below is unchanged — every call already re-runs `saveTags` with the full list, which is the retry.)

- [ ] **Step 4: Toolbar refresh retries a dirty tags.md**

Find `handleRefresh`:

```js
  async function handleRefresh() {
    await checkForExternalChanges();
    showStatus('Tasks refreshed');
    var indicator = $('[data-ref="refresh-indicator"]');
    if (indicator) {
      var now = new Date();
      indicator.textContent = 'Refreshed · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
```

Replace with:

```js
  async function handleRefresh() {
    await checkForExternalChanges();
    if (tagsDirty) await saveTags();   /* silent retry of a previously-failed tags.md write */
    showStatus('Tasks refreshed');
    var indicator = $('[data-ref="refresh-indicator"]');
    if (indicator) {
      var now = new Date();
      indicator.textContent = 'Refreshed · ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
```

- [ ] **Step 5: Background poller logs instead of staying fully silent**

In `checkForExternalChanges`, find the tail:

```js
    } catch (e) {
      /* ignore */
    } finally {
      taskRefreshRunning = false;
    }
```

Replace with (pollers never toast — console.warn only, per the convention):

```js
    } catch (e) {
      console.warn('Tasks refresh error:', e);
    } finally {
      taskRefreshRunning = false;
    }
```

- [ ] **Step 6: Browser verification**

Run:
```bash
npm run serve
```
Open `http://127.0.0.1:4173` -> Tasks (board view). In DevTools:

```js
const _w = ForgeFS.writeFile.bind(ForgeFS);
ForgeFS.writeFile = () => Promise.reject(new Error('EACCES injected'));
```

- Drag a card to another column. Expected: the card paints in the new column, then snaps back to its original column with a red toast "Move failed — reverted: EACCES injected". No 'Moved to X' pill.
- Click "+ Add Task" in a column. Expected: red toast "Error creating task: EACCES injected"; no ghost card appears in the column (re-render shows the original set).
- In the edit modal, add a new tag to a task. Expected: ONE red toast "Failed to save tags.md — will retry: ..."; the tag chip still shows on the task; adding a second tag produces no additional tags.md toast.
- Restore writes (`ForgeFS.writeFile = _w`), add one more tag. Expected: no toast; `tasks/tags.md` on disk now contains BOTH the previously-failed tag and the new one.
- Drag a card between columns. Expected: 'Moved to <Status>' pill, file's `status:` and `updated:` changed on disk.

- [ ] **Step 7: Commit**

Run:
```bash
git add app/js/tasks.js
git commit -m "tasks: immediate rollback board moves, toast error channels, tags.md dirty-retry"
```
Expected: commit created.

### Task 4.6: tasks.js — scan-error banner

**Files:**
- Modify: `app/js/tasks.js`

**Interfaces:**
- Consumes: `ForgeUtils.ScanBanner.update` (Task 4.2), `scanErrors` module state (declared in Task 4.4), `TasksHelpers.parseTaskFile` (as landed by PR1).
- Produces: `.scan-error-banner` div with `data-ref="scan-banner"` in the tasks scaffold.

- [ ] **Step 1: Scaffold the banner div**

In the tasks `scaffold()` template, find the toolbar close / filter strip boundary:

```js
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Filter Strip */
        '<div class="prod-filter-strip" data-ref="filter-strip">' +
```

Replace with:

```js
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Scan-error banner (absolute overlay under the toolbar) */
        '<div class="scan-error-banner hidden" data-ref="scan-banner"></div>' +

        /* Filter Strip */
        '<div class="prod-filter-strip" data-ref="filter-strip">' +
```

- [ ] **Step 2: `parseTaskFiles` collects scan errors**

Find the whole `parseTaskFiles` function as landed by PR1 (landmarks: loops `ForgeFS.readDir(tasksDirHandle, '.')`, filters `/^task-\d{3}(-.*)?\.md$/`, loop body calls `TasksHelpers.parseTaskFile(entry.name, content)` and forwards `task.__fm.warnings` to console.warn, per-file catch logs `'Failed to parse task file:'`, dir-level catch logs `'Failed to read tasks directory:'`, then sorts by filename and returns). Replace the whole function with:

```js
  async function parseTaskFiles() {
    if (!tasksDirHandle) return [];

    var resultTasks = [];
    scanErrors = [];

    try {
      var entries = await ForgeFS.readDir(tasksDirHandle, '.');

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];

        if (entry.kind === 'file' && /^task-\d{3}(-.*)?\.md$/.test(entry.name)) {
          try {
            var content = await ForgeFS.readFile(tasksDirHandle, entry.name);
            var task = TasksHelpers.parseTaskFile(entry.name, content);
            if (task) {
              (task.__fm.warnings || []).forEach(function (w) {
                console.warn('[forge-shell] ' + w + ' File: ' + entry.name);
              });
              resultTasks.push(task);
            }
          } catch (e) {
            console.warn('Failed to parse task file:', entry.name, e);
            scanErrors.push({ path: 'tasks/' + entry.name, message: e.message || String(e) });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read tasks directory:', e);
      scanErrors.push({ path: 'tasks/', message: e.message || String(e) });
    }

    /* Sort by filename (task number) */
    resultTasks.sort(function (a, b) {
      return a.filename.localeCompare(b.filename);
    });

    return resultTasks;
  }
```

(If the merged PR1 function body differs cosmetically — comments, blank lines — keep PR1's inner loop body verbatim and only add the `scanErrors = [];` reset and the two `scanErrors.push(...)` lines inside the existing catches.)

- [ ] **Step 3: `renderTasks` refreshes the banner**

Find:

```js
  function renderTasks() {
    renderActiveView();
  }
```

Replace with:

```js
  function renderTasks() {
    ForgeUtils.ScanBanner.update($('[data-ref="scan-banner"]'), scanErrors, 'task file');
    renderActiveView();
  }
```

- [ ] **Step 4: Browser verification**

In the selected project, make one task file unreadable, then exercise the banner:

Run:
```bash
chmod 000 ../<your-project>/tasks/task-001.md 2>/dev/null || chmod 000 "$(ls ../*/tasks/task-*.md 2>/dev/null | head -1)"
```
(Adjust the path to the project folder you selected in the app; any one `tasks/task-NNN.md` works.)

Open `http://127.0.0.1:4173` -> Tasks, click the toolbar Refresh button. Expected: red banner under the toolbar "1 task file could not be read"; hover shows `tasks/task-001.md — <error>`; × dismisses it; clicking Refresh again keeps it dismissed (same failing set). `chmod 000` a second task file, Refresh: banner reappears with "2 task files could not be read".

Run:
```bash
chmod 644 <both files you changed>
```
Refresh in the app. Expected: banner clears; the two tasks are back on the board.

- [ ] **Step 5: Commit**

Run:
```bash
git add app/js/tasks.js
git commit -m "tasks: scan-error banner (parseTaskFiles collects per-file read failures)"
```
Expected: commit created.

### Task 4.7: memory.js — write-then-commit, toast error channels, scan-error banner

**Files:**
- Modify: `app/js/memory.js`

**Interfaces:**
- Consumes: `ForgeUtils.ScanBanner.update` (Task 4.2), `ForgeUtils.Toast`. No snapshots needed — write-then-commit ordering makes the cache correct by construction.
- Produces: `.scan-error-banner` div with `data-ref="scan-banner"` in the memory scaffold. `deleteMemoryFile` keeps its native `confirm()` — PR5 migrates it to `ForgeUtils.Confirm` (C5); this PR only changes the failure channel.

- [ ] **Step 1: Add module state**

In the memory state block, find:

```js
  let memorySortMode = 'name'; // 'name' | 'importance' | 'last_recalled'
```

Add directly below it:

```js
  let memoryScanErrors = [];   // [{path, message}] from the last loadMemory scan
```

- [ ] **Step 2: Scaffold the banner div**

In the memory `scaffold()` template, find the toolbar close / panel boundary:

```js
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Memory Panel */
```

Replace with:

```js
          '<button class="btn-icon" data-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
        '</div>' +

        /* Scan-error banner (absolute overlay under the toolbar) */
        '<div class="scan-error-banner hidden" data-ref="scan-banner"></div>' +

        /* Memory Panel */
```

- [ ] **Step 3: `loadMemory` — reset + collect scan errors, update the banner**

Four sub-edits inside `loadMemory` (PR3 did not touch this function). The `/* no CLAUDE.md */` and `/* no memory/ directory */` catches are expected-missing and stay silent.

(a) Find the first line of the function body:

```js
  async function loadMemory() {
    memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
```

Replace with:

```js
  async function loadMemory() {
    memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
    memoryScanErrors = [];
```

(b) Find the top-level `.md` file catch (the one following the `memoryData.memoryFiles.push`):

```js
            memoryData.memoryFiles.push({
              name: entry.name,
              content: content,
              fileHandle: fileHandle
            });
          } catch (e) { /* skip */ }
```

Replace with:

```js
            memoryData.memoryFiles.push({
              name: entry.name,
              content: content,
              fileHandle: fileHandle
            });
          } catch (e) {
            console.warn('Failed to read memory file:', entry.name, e);
            memoryScanErrors.push({ path: 'memory/' + entry.name, message: e.message || String(e) });
          }
```

(c) Find the subdirectory-file catch (the one following the `memoryData.memoryDirs[entry.name].push`):

```js
                  memoryData.memoryDirs[entry.name].push({
                    name: subEntry.name,
                    content: subContent,
                    fileHandle: subFileHandle,
                    dirHandle: subDirHandle,
                    parsed: parseMemoryMarkdown(subContent)
                  });
                } catch (e) { /* skip */ }
```

Replace with:

```js
                  memoryData.memoryDirs[entry.name].push({
                    name: subEntry.name,
                    content: subContent,
                    fileHandle: subFileHandle,
                    dirHandle: subDirHandle,
                    parsed: parseMemoryMarkdown(subContent)
                  });
                } catch (e) {
                  console.warn('Failed to read memory file:', entry.name + '/' + subEntry.name, e);
                  memoryScanErrors.push({ path: 'memory/' + entry.name + '/' + subEntry.name, message: e.message || String(e) });
                }
```

(d) Find the subdirectory-listing catch directly below it:

```js
          } catch (e) { /* skip subdirectory */ }
```

Replace with (trailing-`'/'` path marks a directory-level failure):

```js
          } catch (e) {
            console.warn('Failed to scan memory directory:', entry.name, e);
            memoryScanErrors.push({ path: 'memory/' + entry.name + '/', message: e.message || String(e) });
          }
```

(e) Find the end of the function:

```js
    } else {
      if (emptyEl) emptyEl.style.display = '';
      if (mainEl) mainEl.style.display = 'none';
    }
  }
```

Replace with:

```js
    } else {
      if (emptyEl) emptyEl.style.display = '';
      if (mainEl) mainEl.style.display = 'none';
    }

    ForgeUtils.ScanBanner.update($('[data-ref="scan-banner"]'), memoryScanErrors, 'memory file');
  }
```

- [ ] **Step 4: `saveModal` — write-then-commit + toast channels**

Find the whole `async function saveModal() { ... }` (PR3 did not touch it; landmarks: branches on `modalState.type` — `'claudeMd'`, `'memoryFile'`, `'dirFile'`, `'newDirFile'` — and its catch shows `showStatus('Error saving: ' + e.message)`). Replace it with (each existing-file branch now awaits the write BEFORE mutating `memoryData`; `newDirFile` already wrote first; validation becomes a warning toast; the catch becomes an error toast — the modal stays open with the user's content because `closeModal()` sits after the awaited writes in the `try`):

```js
  async function saveModal() {
    var contentEl = $('[data-ref="modal-edit-content"]');
    var content = contentEl ? contentEl.value : '';

    try {
      if (modalState.type === 'claudeMd') {
        await ForgeUtils.FS.writeFile(memoryData.claudeMd.fileHandle, content);
        memoryData.claudeMd.content = content;   /* commit only after the write succeeds */
        showStatus('Saved CLAUDE.md');

      } else if (modalState.type === 'memoryFile') {
        var fileName = modalState.data.fileName;
        var file = memoryData.memoryFiles.find(function (f) { return f.name === fileName; });
        if (file) {
          await ForgeUtils.FS.writeFile(file.fileHandle, content);
          file.content = content;                /* commit only after the write succeeds */
          showStatus('Saved ' + fileName);
        }

      } else if (modalState.type === 'dirFile') {
        var dirName = modalState.data.dirName;
        var fn = modalState.data.fileName;
        var dirFiles = memoryData.memoryDirs[dirName];
        var df = dirFiles ? dirFiles.find(function (f) { return f.name === fn; }) : null;
        if (df) {
          await ForgeUtils.FS.writeFile(df.fileHandle, content);
          df.content = content;                  /* commit only after the write succeeds */
          df.parsed = parseMemoryMarkdown(content);
          showStatus('Saved ' + fn);
        }

      } else if (modalState.type === 'newDirFile') {
        var dName = modalState.data.dirName;
        var nameInput = $('[data-ref="modal-new-filename"]');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) { ForgeUtils.Toast.show('Please enter a filename', 'warning'); return; }
        if (!newName.endsWith('.md')) newName += '.md';

        // Ensure directory exists
        await ForgeFS.createDirectory(memoryDirHandle, 'memory/' + dName);

        // Write the file
        var filePath = 'memory/' + dName + '/' + newName;
        await ForgeFS.writeFile(memoryDirHandle, filePath, content);

        var fileHandle = typeof memoryDirHandle === 'string'
          ? memoryDirHandle + '/' + filePath
          : filePath;
        var dirHandle = typeof memoryDirHandle === 'string'
          ? memoryDirHandle + '/memory/' + dName
          : 'memory/' + dName;

        memoryData.memoryDirs[dName].push({
          name: newName,
          content: content,
          fileHandle: fileHandle,
          dirHandle: dirHandle,
          parsed: parseMemoryMarkdown(content)
        });
        showStatus('Created ' + newName);
      }

      closeModal();
      renderMemoryTabs();
      renderMemoryContent();

    } catch (e) {
      ForgeUtils.Toast.show('Save failed: ' + (e.message || e), 'error', 6000);
    }
  }
```

- [ ] **Step 5: `deleteMemoryFile` failure channel**

Inside `deleteMemoryFile` (keep the native `confirm()` on its first line — PR5 migrates it), find the catch:

```js
    } catch (e) {
      showStatus('Error deleting: ' + e.message);
    }
```

Replace with:

```js
    } catch (e) {
      ForgeUtils.Toast.show('Error deleting: ' + (e.message || e), 'error', 6000);
    }
```

(The success pill `showStatus('Deleted ' + getDisplayName(fileName))` above it is unchanged.)

- [ ] **Step 6: Browser verification**

Run:
```bash
npm run serve
```
Open `http://127.0.0.1:4173` -> Memory. In DevTools (existing-file saves go through the legacy `ForgeUtils.FS.writeFile`):

```js
const _wl = ForgeUtils.FS.writeFile.bind(ForgeUtils.FS);
ForgeUtils.FS.writeFile = () => Promise.reject(new Error('EACCES injected'));
```

- Open CLAUDE.md (or any memory file) in the edit modal, change text, Save. Expected: red toast "Save failed: EACCES injected"; the modal STAYS OPEN with your edited text still in the textarea. Press Escape to close, reopen the same file. Expected: the ORIGINAL content renders (cache was never mutated — no phantom save).
- Restore (`ForgeUtils.FS.writeFile = _wl`), save again. Expected: 'Saved ...' pill, modal closes, content persisted on disk.
- In a memory directory tab, start a new file, leave the filename empty, Save. Expected: orange warning toast "Please enter a filename"; modal stays open.
- `chmod 000` one `memory/<dir>/<file>.md` in the project, click Refresh. Expected: banner "1 memory file could not be read" with path tooltip; dismiss works; `chmod 644` + Refresh clears it.

- [ ] **Step 7: Commit**

Run:
```bash
git add app/js/memory.js
git commit -m "memory: write-then-commit saves, toast error channels, scan-error banner"
```
Expected: commit created.

### Task 4.8: product-forge.js — scan errors, `_doRefresh` resilience, banner

**Files:**
- Modify: `app/js/product-forge.js`

**Interfaces:**
- Consumes: `scanCardsDir(cardsHandle, outErrors)` (Task 4.3), `ForgeUtils.ScanBanner.update` (Task 4.2).
- Produces: `.scan-error-banner` div with `data-pfl-scan-banner` in the Product Forge scaffold; `_updateScanBanner()` controller method; a `_doRefresh` in which a failed read is NEVER treated as a deleted file (PR5 rebases onto this function).

product-forge.js is first-touch in this stack — main anchors are valid.

- [ ] **Step 1: Add module state**

Find the module state block (~lines 1303-1309):

```js
  var keydownHandler = null;
  var overflowPointerdownHandler = null;
```

Replace with:

```js
  var keydownHandler = null;
  var overflowPointerdownHandler = null;
  var pfScanErrors = [];   /* [{path, message}] from the last cards scan */
```

- [ ] **Step 2: Scaffold the banner div**

In `_renderLayout`, find the toolbar close / filter-chips boundary (~lines 1430-1435):

```js
            '<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
            '<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +

          /* Active status filter chips (layout row 2 when has-filter-chips) */
          '<div class="pfl-active-filters hidden" data-pfl-active-filters></div>' +
```

Replace with (the banner is an absolute overlay, so it takes no grid row — the `.pfl-layout.has-filter-chips` row CSS is untouched):

```js
            '<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
            '<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +

          /* Scan-error banner (absolute overlay under the toolbar; takes no grid row) */
          '<div class="scan-error-banner hidden" data-pfl-scan-banner></div>' +

          /* Active status filter chips (layout row 2 when has-filter-chips) */
          '<div class="pfl-active-filters hidden" data-pfl-active-filters></div>' +
```

- [ ] **Step 3: `_loadCards` opts into scan errors**

In `_loadCards` (~line 1525), find the single line:

```js
      var files = await scanCardsDir(cardsHandle);
```

Replace with:

```js
      pfScanErrors = [];
      var files = await scanCardsDir(cardsHandle, pfScanErrors);
```

Then find the `this._updateRefreshIndicator();` call at the END of `_loadCards` (the other occurrence is inside `_doRefresh`, which the next step replaces wholesale):

```js
      this._updateRefreshIndicator();
```

Replace with:

```js
      this._updateRefreshIndicator();
      this._updateScanBanner();
```

- [ ] **Step 4: Replace `_doRefresh` with the resilient version**

Find the entire `async _doRefresh() { ... },` method (~lines 1919-1977, including the explanatory comment above it) and replace it with:

```js
    // Change detection: re-scans the cards directory and compares file
    // timestamps and handle identity against the in-memory store to
    // detect added, modified, and deleted cards without a full reload.
    // A file that FAILED to read is never treated as deleted; a
    // directory-level scan failure skips the deletion pass entirely.
    async _doRefresh() {
      if (refreshRunning || !cardsHandle) return;
      refreshRunning = true;
      try {
        var errs = [];
        var files = await scanCardsDir(cardsHandle, errs);
        pfScanErrors = errs;
        var changes = { added: [], modified: [], deleted: [] };

        for (var entry of files) {
          var filename = entry[0];
          var fileData = entry[1];
          var oldTs = store.timestamps.get(filename);
          if (oldTs === undefined) {
            changes.added.push(filename);
          } else if (fileData.lastModified !== oldTs) {
            changes.modified.push(filename);
          }
          var card = CardParser.parse(filename, fileData.content, fileData.dirName);
          store.set(filename, card, fileData.lastModified, fileData.handle);
        }

        var dirLevelFailure = errs.some(function (e) { return e.path.slice(-1) === '/'; });
        var failedNames = new Set(errs.map(function (e) {
          return (e.path.split('/').pop() || '').replace(/\.md$/, '');
        }));
        if (!dirLevelFailure) {
          for (var fn of store.cards.keys()) {
            if (!files.has(fn) && !failedNames.has(fn)) {
              changes.deleted.push(fn);
              store.delete(fn);
              recentsTracker.forget(fn);
            }
          }
        }

        /* Feed the tracker with new arrivals BEFORE re-rendering so
           NEW badges appear in the same render pass. */
        for (var addedIdx = 0; addedIdx < changes.added.length; addedIdx++) {
          recentsTracker.noteAdded(changes.added[addedIdx]);
        }
        recentsTracker.pruneStale();

        var hasChanges = changes.added.length + changes.modified.length + changes.deleted.length > 0;
        if (hasChanges) {
          taxonomy = discoverTaxonomy(store.all());
          this._renderTree();
          if (selectedCard) {
            var sc = store.get(selectedCard);
            if (sc) {
              if (changes.modified.includes(selectedCard)) detailPanel.renderCard(sc);
            } else {
              selectedCard = null;
              detailPanel.renderCard(null);
            }
          }
        }
        if (changes.added.length > 0) {
          this._maybeAutoReveal(changes.added);
        }
        this._updateRefreshIndicator();
        this._updateScanBanner();
      } catch (e) {
        console.warn('Product Forge refresh error:', e);
      } finally {
        refreshRunning = false;
      }
    },
```

- [ ] **Step 5: Add `_updateScanBanner`**

Immediately after the replaced `_doRefresh` method's closing `},` (before the `/* ─── Reparent / Unparent ─── */` comment), insert:

```js
    _updateScanBanner() {
      ForgeUtils.ScanBanner.update($q('[data-pfl-scan-banner]'), pfScanErrors, 'card file');
    },
```

- [ ] **Step 6: Browser verification**

Run:
```bash
npm run serve
```
Open `http://127.0.0.1:4173` -> Product Forge. Select a card in the tree, note the tree contents. Then make one card unreadable in the project folder:

```bash
chmod 000 <project>/cards/<subdir>/<some-card>.md
```

Click the toolbar Refresh (or wait for the 30s auto-refresh). Expected:
- Banner "1 card file could not be read" appears under the toolbar; tooltip shows `<subdir>/<some-card>.md — <error>`.
- The unreadable card is STILL in the tree (no deleted flash), and if it was selected, the selection and detail panel are unchanged — a failed read is not a delete.
- Enable a status filter so chips show (`has-filter-chips`): the chips row, sidebar, and detail panel do not shift while the banner is visible.
- Dismiss the banner, Refresh again: stays dismissed (same failing set).

Run:
```bash
chmod 644 <the same file>
```
Refresh in the app. Expected: banner clears; card content readable again; nothing was forgotten from recents.

- [ ] **Step 7: Commit**

Run:
```bash
git add app/js/product-forge.js
git commit -m "product-forge: scan-error banner; _doRefresh never treats a failed read as a delete"
```
Expected: commit created.

### Task 4.9: STYLE_GUIDE.md — severity-channel convention

**Files:**
- Modify: `STYLE_GUIDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the documented Feedback & Error Handling contract that PR5+ build against (errors = 6s error toast, pill = ambient success).

- [ ] **Step 1: Append the new section**

Append the following at the very end of `STYLE_GUIDE.md` (after the `## Overlay Dismissal Contract (added 2026-07-16)` section that PR3 added at the end of the file):

```markdown
## Feedback & Error Handling (added 2026-07-16)

Every view gives failure feedback through the shared toast, and a failed write must
never leave the UI showing unsaved state as if it were saved.

### Severity channels

| Channel | Use for | API |
|---|---|---|
| Error toast | Any failed user-initiated read/write (save, move, create, delete) | `ForgeUtils.Toast.show('<Action> failed: ' + (e.message \|\| e), 'error', 6000)` |
| Warning toast | Validation problems ("Please enter a filename") | `ForgeUtils.Toast.show(msg, 'warning')` |
| Success toast | Discrete user-initiated lifecycle ops (create, delete, settings saved) | `ForgeUtils.Toast.show(msg, 'success')` |
| Status pill | High-frequency ambient success/progress (auto-save "Saved", drag "Moved to X", "Refreshed") | per-view `showStatus(msg)` |
| Scan banner | Persistent per-view "N files could not be read" from directory scans | `ForgeUtils.ScanBanner.update(el, errors, noun)` |
| console.warn only | Background pollers (watch intervals), best-effort metadata reads | — |
| Silent | Expected-missing resources (no `tags.md`, no `memory/`, no `tasks/`), `localStorage` access | — |

### Rules

1. **Errors are ALWAYS error toasts (6000 ms).** The local status pill must never carry a
   failure — it is monochrome and gone in 2 s.
2. **Optimistic writes snapshot before mutating** and on write failure restore the snapshot,
   re-render, and toast an error that says the change was reverted. Reference
   implementations: `assignRelease` (roadmap.js) and `writeTaskNow` + `pendingRollback`
   (tasks.js).
3. **Write-then-commit for caches:** in-memory caches (e.g. memory.js `memoryData`) are
   only mutated after the awaited write succeeds, unless a snapshot-restore is in place.
4. **Scan loops surface partial failure.** Directory scans collect `{path, message}` per
   unreadable file and feed the view's `.scan-error-banner` via
   `ForgeUtils.ScanBanner.update`. Dismissal is remembered per error-set signature; a
   different failure set re-shows the banner. Never treat a file that failed to read as
   deleted.
5. **Success toasts vs. pills:** pills are for high-frequency ambient feedback; toasts are
   for discrete lifecycle operations (create, delete, settings saved). When in doubt,
   prefer the pill for anything that can fire many times per minute.
```

- [ ] **Step 2: Commit**

Run:
```bash
git add STYLE_GUIDE.md
git commit -m "STYLE_GUIDE: Feedback & Error Handling severity-channel convention"
```
Expected: commit created.

### Task 4.10: Full-suite verification + open PR 4

**Files:**
- None (verification + PR only).

**Interfaces:**
- Consumes: everything above.
- Produces: `ux-program/pr-4-failure-feedback` pushed, PR 4/9 opened against `main`.

- [ ] **Step 1: Run the full test suite**

Run (from `forge-shell/`):
```bash
npm test
```
Expected: everything passing, including the 8 new tests this PR adds in `test/feedback.helpers.test.js` (the suite has grown through the stack — tasks.helpers/md.helpers/modal.helpers suites from PR1-PR3 must also be green).

- [ ] **Step 2: Three-runtime smoke checklist**

Launch each runtime and walk the rows (Tauri: `npm run tauri:dev`; Chrome FSA: `npm run serve` then open in real Chrome and pick the folder via the native picker; server/cmux: `node server.js` in an embedded browser with the typed-path dialog):

| Check | Tauri | Chrome FSA | server (cmux) |
|---|---|---|---|
| Healthy board drag: 'Moved to X' pill, `status:`+`updated:` changed on disk, unknown frontmatter keys preserved | ✓ | ✓ | ✓ |
| Board-move rollback (DevTools: stub `ForgeFS.writeFile` to reject): card snaps back + 'Move failed — reverted' toast | — | ✓ (any one runtime suffices) | ✓ |
| Inline/modal edit rollback + NO 'Task saved successfully' toast on success ('Saved' pill only) | ✓ | — | ✓ |
| Memory modal save failure: modal stays open, cache not committed; success pills unchanged | — | — | ✓ |
| Scan banner in all three views via `chmod 000` (count, tooltip, dismiss-persists, changed-set re-shows, clean-scan clears) | ✓ | — | ✓ |
| Product Forge: unreadable card NOT dropped during 30s auto-refresh (store/recents/selection intact) | ✓ | — | ✓ |
| Banner overlay does not shift `.pfl-layout` rows with filter chips active; legible in light AND dark theme | — | — | ✓ |
| Toasts: error/warning carry `role="alert"`, others `role="status"`; click dismisses | — | — | ✓ |
| Native fs watcher still refreshes views after external file edits (watcher = Tauri-only) | ✓ | n/a | n/a |

- [ ] **Step 3: Push and open the PR**

Run:
```bash
git push -u origin ux-program/pr-4-failure-feedback
gh pr create --base main --title "Unified failure feedback: error-toast convention, write rollback, scan-error banner" --body "Establishes the severity-channel convention (all failed user-initiated writes are 6s error toasts; the status pill is ambient-success only) and documents it in STYLE_GUIDE.md.
Tasks gains writeTaskNow with snapshot rollback (board moves, inline + modal edits revert on failure); Memory saves become write-then-commit; a dismissible scan-error banner surfaces unreadable files in Tasks/Memory/Product Forge; product-forge _doRefresh never treats a failed read as a deleted card.
Stacked PR 4/9 - merge after PR3"
```
Expected: push succeeds; `gh pr create` prints the new PR URL.

---

## PR5 — Shared card write service + status menu; Product Forge inline status, create, delete *(L)*

**Branch:** `ux-program/pr-5-card-write-service` (from `ux-program/pr-4-failure-feedback`) — **Contains:** WP5 in full (new shared `card-write.js` + `status-menu.js` modules, verbatim roadmap migration, Product Forge inline status / New Card / Delete Card), plus the `memory.js` `window.confirm` → `ForgeUtils.Confirm` migration (C5) and the `hasPending()` guard accessor (C3). — **Depends on:** PR3's keyboard-complete Confirm at z-1300 (delete dialog inherits it) and PR4's toast convention + resilient `_doRefresh` rewrite in product-forge.js (the guard check lands inside PR4's per-file loop). Must merge before PR6 (C4: PR6 threads own-write suppression through this PR's `onBeforeWrite` hook and consumes `hasPending()`).

Anchoring note for the executor: product-forge.js quotes below reflect the tree **as landed by PR4** (`_doRefresh` was rewritten there); roadmap.js write/menu bodies are untouched by PRs 1–4, so those quotes match both main and your base branch. Never re-derive anchors from pre-stack line numbers — search for the quoted code.

### Task 5.1: `CardWrite` module — optimistic guard + portable card write service (TDD)

**Files:**
- Create: `forge-shell/app/js/card-write.js`
- Create: `forge-shell/test/card-write.test.js`

**Interfaces:**
- Consumes: `CardData.CardParser` / `ForgeFS.writeFile` / `ForgeUtils.todayISO` / `CardData.STATUS_OPTIONS` — all as **lazy browser defaults only**; every dependency is injectable so Node tests need zero globals.
- Produces: `CardWrite.createOptimisticGuard() -> { mark(filename, {expectedContent, writtenAt}), clear(filename), get(filename) -> entry|null, clearAll(), hasPending() -> boolean }` and `CardWrite.createCardWriteService({ store, getCardsHandle, guard?, relPathFn?, onBeforeWrite?, serialize?, parse?, writeFile?, todayISO?, statusOptions? }) -> { patchCardFrontmatter(filename, mutatorFn(fm, card)) -> Promise<reparsedCard>, setCardStatus(filename, status) -> Promise<reparsedCard> }`. Consumed by Tasks 5.3/5.5–5.8 (roadmap + product-forge); `hasPending()` and `onBeforeWrite` are consumed by PR6.

The service is a behavior-identical extraction of roadmap's private `CardWriteService` (roadmap.js) with three additive changes from the design: the mutator is invoked as `mutatorFn(frontmatter, card)` so callers may also set `card.body`; the error path restores **both** previous frontmatter and previous body; and an `onBeforeWrite(filename, content)` no-op hook fires before the guard mark (PR6 threads own-write suppression through it once — do NOT wire it per call site in this PR).

- [ ] **Step 1: Write failing tests**

Create `forge-shell/test/card-write.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CW = require('../app/js/card-write.js');

/* ─── Fakes (no window/DOM globals) ─── */

function makeCard(filename, type, status) {
  return {
    filename: filename,
    dirName: type + 's',
    frontmatter: { title: filename, type: type, status: status },
    body: 'original body',
    raw: '',
    error: null
  };
}

function makeStore(cards) {
  const store = {
    cards: new Map(),
    timestamps: new Map(),
    fileHandles: new Map(),
    setCalls: [],
    get(fn) { return this.cards.get(fn) || null; },
    set(fn, card, ts, handle) {
      this.cards.set(fn, card);
      this.timestamps.set(fn, ts);
      if (handle) this.fileHandles.set(fn, handle);
      this.setCalls.push({ filename: fn, card: card, handle: handle });
    },
    delete(fn) {
      this.cards.delete(fn);
      this.timestamps.delete(fn);
      this.fileHandles.delete(fn);
    }
  };
  (cards || []).forEach(c => store.cards.set(c.filename, c));
  return store;
}

const STATUS_OPTIONS = {
  epic: ['Planning', 'In Progress', 'Complete', 'Cancelled'],
  story: ['Draft', 'Ready', 'In Progress', 'Done']
};

/* Builds a service over fully faked deps. `log` records writeFile calls. */
function makeService(overrides) {
  overrides = overrides || {};
  const store = overrides.store || makeStore([makeCard('my-epic', 'epic', 'Planning')]);
  const log = [];
  const deps = Object.assign({
    store: store,
    getCardsHandle: () => 'HANDLE',
    guard: CW.createOptimisticGuard(),
    serialize: (fm, body) => JSON.stringify(fm) + '\n' + body,
    parse: (filename, content, dirName) => ({
      filename: filename,
      dirName: dirName,
      reparsed: true,
      frontmatter: JSON.parse(content.split('\n')[0]),
      body: content.split('\n').slice(1).join('\n')
    }),
    writeFile: (root, relPath, content) => {
      log.push({ op: 'write', relPath: relPath, content: content });
      return Promise.resolve();
    },
    todayISO: () => '2026-07-16',
    statusOptions: STATUS_OPTIONS
  }, overrides);
  return { svc: CW.createCardWriteService(deps), store: store, log: log };
}

/* ─── createOptimisticGuard ─── */

test('createOptimisticGuard: mark/get/clear/clearAll semantics', () => {
  const g = CW.createOptimisticGuard();
  assert.equal(g.get('a'), null);
  g.mark('a', { expectedContent: 'x', writtenAt: 1 });
  assert.deepEqual(g.get('a'), { expectedContent: 'x', writtenAt: 1 });
  g.clear('a');
  assert.equal(g.get('a'), null);
  g.mark('a', { expectedContent: 'x', writtenAt: 1 });
  g.mark('b', { expectedContent: 'y', writtenAt: 2 });
  g.clearAll();
  assert.equal(g.get('a'), null);
  assert.equal(g.get('b'), null);
});

test('createOptimisticGuard: hasPending reflects pending entries (PR6 consumes this)', () => {
  const g = CW.createOptimisticGuard();
  assert.equal(g.hasPending(), false);
  g.mark('a', { expectedContent: 'x', writtenAt: 1 });
  assert.equal(g.hasPending(), true);
  g.clear('a');
  assert.equal(g.hasPending(), false);
});

/* ─── patchCardFrontmatter ─── */

test('patchCardFrontmatter: marks guard with exact serialized content BEFORE awaiting writeFile', async () => {
  const order = [];
  const guard = {
    mark: (fn, entry) => order.push({ op: 'mark', filename: fn, content: entry.expectedContent }),
    clear: () => order.push({ op: 'clear' }),
    get: () => null,
    clearAll: () => {},
    hasPending: () => false
  };
  const { svc } = makeService({
    guard: guard,
    writeFile: (root, relPath, content) => {
      order.push({ op: 'write', content: content });
      return Promise.resolve();
    }
  });
  await svc.patchCardFrontmatter('my-epic', fm => { fm.status = 'Complete'; });
  assert.deepEqual(order.map(o => o.op), ['mark', 'write']);
  assert.equal(order[0].content, order[1].content);
});

test('patchCardFrontmatter: stamps frontmatter.updated via injected todayISO', async () => {
  const { svc } = makeService();
  const reparsed = await svc.patchCardFrontmatter('my-epic', fm => { fm.status = 'Complete'; });
  assert.equal(reparsed.frontmatter.updated, '2026-07-16');
});

test('patchCardFrontmatter: reparses and store.sets, preserving existing fileHandle', async () => {
  const store = makeStore([makeCard('my-epic', 'epic', 'Planning')]);
  store.fileHandles.set('my-epic', 'FH-TOKEN');
  const { svc } = makeService({ store: store });
  const reparsed = await svc.patchCardFrontmatter('my-epic', fm => { fm.status = 'Complete'; });
  assert.equal(reparsed.reparsed, true);
  assert.equal(store.setCalls.length, 1);
  assert.equal(store.setCalls[0].handle, 'FH-TOKEN');
  assert.equal(store.get('my-epic'), reparsed);
});

test('patchCardFrontmatter: mutator receives (fm, card) and body mutations serialize', async () => {
  const { svc, log } = makeService();
  await svc.patchCardFrontmatter('my-epic', (fm, card) => {
    fm.title = 'New Title';
    card.body = 'edited body';
  });
  assert.equal(log.length, 1);
  assert.ok(log[0].content.indexOf('New Title') !== -1);
  assert.ok(log[0].content.indexOf('edited body') !== -1);
});

test('patchCardFrontmatter: default relPathFn is dirName/filename.md', async () => {
  const { svc, log } = makeService();
  await svc.patchCardFrontmatter('my-epic', fm => { fm.status = 'Complete'; });
  assert.equal(log[0].relPath, 'epics/my-epic.md');
});

test('patchCardFrontmatter: write failure restores frontmatter AND body, clears guard, rethrows', async () => {
  const guard = CW.createOptimisticGuard();
  const store = makeStore([makeCard('my-epic', 'epic', 'Planning')]);
  const { svc } = makeService({
    store: store,
    guard: guard,
    writeFile: () => Promise.reject(new Error('disk full'))
  });
  await assert.rejects(
    () => svc.patchCardFrontmatter('my-epic', (fm, card) => {
      fm.status = 'Complete';
      card.body = 'changed';
    }),
    /disk full/
  );
  const card = store.get('my-epic');
  assert.equal(card.frontmatter.status, 'Planning');
  assert.equal(card.frontmatter.updated, undefined);
  assert.equal(card.body, 'original body');
  assert.equal(guard.get('my-epic'), null);
  assert.equal(store.setCalls.length, 0);
});

test('patchCardFrontmatter: unknown card throws Card not writable', async () => {
  const { svc } = makeService();
  await assert.rejects(
    () => svc.patchCardFrontmatter('nope', fm => {}),
    /Card not writable: nope/
  );
});

test('patchCardFrontmatter: null cardsHandle throws Card not writable', async () => {
  const { svc } = makeService({ getCardsHandle: () => null });
  await assert.rejects(
    () => svc.patchCardFrontmatter('my-epic', fm => {}),
    /Card not writable: my-epic/
  );
});

/* ─── setCardStatus ─── */

test('setCardStatus: invalid status for type throws exact message and performs no write', async () => {
  const { svc, log } = makeService();
  await assert.rejects(
    () => svc.setCardStatus('my-epic', 'Done'),
    err => err.message === 'Invalid status "Done" for type epic'
  );
  assert.equal(log.length, 0);
});

test('setCardStatus: unknown card throws Card not found', async () => {
  const { svc } = makeService();
  await assert.rejects(() => svc.setCardStatus('nope', 'Done'), /Card not found: nope/);
});

test('setCardStatus: valid status delegates to patchCardFrontmatter and writes fm.status', async () => {
  const { svc, log } = makeService();
  const reparsed = await svc.setCardStatus('my-epic', 'Complete');
  assert.equal(reparsed.frontmatter.status, 'Complete');
  assert.equal(log.length, 1);
});

/* ─── onBeforeWrite hook (PR6 threads own-write suppression here) ─── */

test('onBeforeWrite: fires once per write with (filename, content)', async () => {
  const calls = [];
  const { svc, log } = makeService({
    onBeforeWrite: (filename, content) => calls.push({ filename: filename, content: content })
  });
  await svc.patchCardFrontmatter('my-epic', fm => { fm.status = 'Complete'; });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filename, 'my-epic');
  assert.equal(calls[0].content, log[0].content);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/card-write.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/card-write.js'`

- [ ] **Step 3: Implement `card-write.js`**

Create `forge-shell/app/js/card-write.js`. This is a verbatim behavior port of roadmap.js's private `OptimisticGuard` (the `_pending` Map becomes closure-private) and `CardWriteService`, with the injected-deps seam. UMD wrapper identical to `app/js/roadmap.helpers.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   CardWrite — shared optimistic guard + portable card write service.
   Verbatim behavior port of Roadmap's private OptimisticGuard and
   CardWriteService with dependency injection. Additions vs the
   roadmap original: mutator receives (fm, card) so body edits are
   possible; error path restores body too; onBeforeWrite hook (PR6).
   Importable as <script> (window.CardWrite) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CardWrite = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Pending-writes registry keyed by filename.
   * Entry shape: { expectedContent: string, writtenAt: epochMs }.
   * Refresh loops reconcile via RoadmapHelpers.guardDecision.
   */
  function createOptimisticGuard() {
    var pending = new Map();
    return {
      mark: function (filename, entry) {
        pending.set(filename, entry);
      },
      clear: function (filename) {
        pending.delete(filename);
      },
      get: function (filename) {
        return pending.has(filename) ? pending.get(filename) : null;
      },
      clearAll: function () {
        pending.clear();
      },
      /** True while any optimistic write awaits scan confirmation (PR6 consumes). */
      hasPending: function () {
        return pending.size > 0;
      }
    };
  }

  var NOOP_GUARD = {
    mark: function () {},
    clear: function () {},
    get: function () { return null; },
    clearAll: function () {},
    hasPending: function () { return false; }
  };

  /**
   * deps:
   *   store          (required) CardData.CardStore-shaped store
   *   getCardsHandle (required) () -> cards dir handle/path or null
   *   guard          optional optimistic guard (default: no-op)
   *   relPathFn      optional (card) -> relPath (default dirName/filename.md)
   *   onBeforeWrite  optional (filename, content) hook — fires once per
   *                  write, before the guard mark (own-write suppression, PR6)
   *   serialize/parse/writeFile/todayISO/statusOptions — lazy browser
   *   defaults (CardData / ForgeFS / ForgeUtils) so Node tests inject all
   */
  function createCardWriteService(deps) {
    if (!deps || !deps.store || typeof deps.getCardsHandle !== 'function') {
      throw new Error('createCardWriteService requires { store, getCardsHandle }');
    }
    var guard = deps.guard || NOOP_GUARD;
    var relPathFn = deps.relPathFn || function (card) {
      return (card.dirName || '') + '/' + (card.filename || '') + '.md';
    };
    var onBeforeWrite = deps.onBeforeWrite || function () {};
    var serialize = deps.serialize || function (fm, body) {
      return CardData.CardParser.serialize(fm, body);
    };
    var parse = deps.parse || function (filename, content, dirName) {
      return CardData.CardParser.parse(filename, content, dirName);
    };
    var writeFile = deps.writeFile || function (rootHandle, relPath, content) {
      return ForgeFS.writeFile(rootHandle, relPath, content);
    };
    var todayISO = deps.todayISO || function () { return ForgeUtils.todayISO(); };

    function getStatusOptions() {
      return deps.statusOptions || CardData.STATUS_OPTIONS || {};
    }

    /**
     * Mutate card frontmatter (and optionally body), serialize, write via
     * portable FS path. Marks the guard BEFORE the awaited write so a
     * concurrent refresh cannot clobber the optimistic state.
     * @param {string} filename
     * @param {function(object, object): void} mutatorFn — (frontmatter, card)
     * @returns {Promise<object>} reparsed card
     */
    async function patchCardFrontmatter(filename, mutatorFn) {
      var card = deps.store.get(filename);
      var handle = deps.getCardsHandle();
      if (!card || !handle) throw new Error('Card not writable: ' + filename);

      var prevFm = JSON.parse(JSON.stringify(card.frontmatter));
      var prevBody = card.body;
      try {
        mutatorFn(card.frontmatter, card);
        card.frontmatter.updated = todayISO();

        var content = serialize(card.frontmatter, card.body);
        var relPath = relPathFn(card);

        onBeforeWrite(filename, content);
        /* mark BEFORE await write so concurrent refresh cannot win the race */
        guard.mark(filename, { expectedContent: content, writtenAt: Date.now() });

        await writeFile(handle, relPath, content);
        var reparsed = parse(filename, content, card.dirName);
        /* Keep existing handle map entry if any */
        deps.store.set(filename, reparsed, Date.now(), deps.store.fileHandles.get(filename));
        /* Keep pending until a scan sees matching content (or TTL force-apply) */
        return reparsed;
      } catch (e) {
        /* Restore on mutator/serialize/write failure (any error after mutation) */
        card.frontmatter = prevFm;
        card.body = prevBody;
        guard.clear(filename);
        throw e;
      }
    }

    /**
     * Set card status if value is in statusOptions[type].
     */
    async function setCardStatus(filename, status) {
      var card = deps.store.get(filename);
      if (!card) throw new Error('Card not found: ' + filename);
      var type = card.frontmatter.type;
      var options = getStatusOptions()[type] || [];
      if (options.indexOf(status) === -1) {
        throw new Error('Invalid status "' + status + '" for type ' + type);
      }
      return patchCardFrontmatter(filename, function (fm) {
        fm.status = status;
      });
    }

    return {
      patchCardFrontmatter: patchCardFrontmatter,
      setCardStatus: setCardStatus
    };
  }

  return {
    createOptimisticGuard: createOptimisticGuard,
    createCardWriteService: createCardWriteService
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/card-write.test.js` (from `forge-shell/`)
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add app/js/card-write.js test/card-write.test.js
git commit -m "feat(card-write): shared optimistic guard + portable card write service"
```

### Task 5.2: `ForgeStatusMenu` module — shared status popover (TDD for `buildModel`) + shared styles + script wiring

**Files:**
- Create: `forge-shell/app/js/status-menu.js`
- Create: `forge-shell/test/status-menu.test.js`
- Modify: `forge-shell/app/css/components.css`
- Modify: `forge-shell/app/index.html`

**Interfaces:**
- Consumes: `ForgeUtils.escapeHTML` / `ForgeUtils.Toast` (browser only, referenced inside `create()`); caller-injected `getOptions(type)`, `getColor(status)`, `onChoose(ctx)`.
- Produces: `ForgeStatusMenu.buildModel(options, currentStatus) -> [{value, current, foreign}]` (pure, node-tested) and `ForgeStatusMenu.create({ getOptions, getColor, onChoose }) -> { open(anchorBtn, {filename, type, currentStatus}), close(), isOpen() }`. Consumed by Task 5.3 (roadmap) and Task 5.5 (product-forge).

`create()` is a **verbatim behavior port** of roadmap.js's private `StatusMenu` object (the `var StatusMenu = { ... }` literal between the `StatusMenu — anchored type-aware status popover (PR3)` banner and the `RoadmapConfigManager` banner). Reviewers will diff the two side-by-side. Exactly three kinds of change are allowed: (1) class renames `rm-status-menu*` → `forge-status-menu*`, `rm-status-dot` → `forge-status-dot` (menu-internal dots only), `data-rm-status-value` → `data-status-value`; (2) `CardData.STATUS_OPTIONS[type]` / `CardData.getStatusColor` become `opts.getOptions(type)` / `opts.getColor(status)`; (3) `_choose` no longer writes — it builds `ctx` and awaits `opts.onChoose(ctx)` under the same `_busy` lock. Everything else — busy re-open toast, same-anchor toggle-close, foreign-row rendering, roving tabindex, Arrow/Home/End/Enter/Space/Escape handling, capture-phase `pointerdown`/`scroll`/`resize` closers attached in `setTimeout(0)`, viewport clamp + flip-above positioning math — moves **unchanged**.

- [ ] **Step 1: Write failing tests**

Create `forge-shell/test/status-menu.test.js` (DOM behavior is covered by the Task 5.3/5.5 browser steps; only the pure model is node-tested):

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SM = require('../app/js/status-menu.js');

test('buildModel: flags the current option', () => {
  assert.deepEqual(SM.buildModel(['Draft', 'Ready'], 'Ready'), [
    { value: 'Draft', current: false, foreign: false },
    { value: 'Ready', current: true, foreign: false }
  ]);
});

test('buildModel: prepends a disabled foreign row when current status is not in options', () => {
  const model = SM.buildModel(['Draft', 'Ready'], 'Legacy');
  assert.deepEqual(model[0], { value: 'Legacy', current: true, foreign: true });
  assert.equal(model.length, 3);
  assert.deepEqual(model.slice(1).map(r => r.value), ['Draft', 'Ready']);
  assert.equal(model.slice(1).some(r => r.current), false);
});

test('buildModel: empty options yields empty model', () => {
  assert.deepEqual(SM.buildModel([], null), []);
});

test('buildModel: null current status sets no current flags and no foreign row', () => {
  const model = SM.buildModel(['Draft', 'Ready'], null);
  assert.equal(model.length, 2);
  assert.equal(model.some(r => r.current || r.foreign), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/status-menu.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/status-menu.js'`

- [ ] **Step 3: Implement `status-menu.js`**

Create `forge-shell/app/js/status-menu.js`. Port the roadmap `StatusMenu` body verbatim per the rules above (open roadmap.js beside this file while porting):

```js
/* ═══════════════════════════════════════════════════════════════
   ForgeStatusMenu — shared anchored type-aware status popover.
   Verbatim behavior port of Roadmap's private StatusMenu; the
   write/optimistic-DOM logic is injected via onChoose. Classes:
   .forge-status-menu* (components.css).
   Importable as <script> (window.ForgeStatusMenu) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ForgeStatusMenu = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Pure render model: [{ value, current, foreign }].
   * A disabled foreign row is prepended when currentStatus is set
   * but not present in options.
   */
  function buildModel(options, currentStatus) {
    var model = [];
    options = options || [];
    if (currentStatus && options.indexOf(currentStatus) === -1) {
      model.push({ value: currentStatus, current: true, foreign: true });
    }
    options.forEach(function (opt) {
      model.push({ value: opt, current: opt === currentStatus, foreign: false });
    });
    return model;
  }

  /**
   * opts: {
   *   getOptions(type) -> string[],
   *   getColor(status) -> css color,
   *   onChoose(ctx {filename, type, status, prevStatus, anchor}) -> Promise
   * }
   * Returns { open(anchorBtn, {filename, type, currentStatus}), close(), isOpen() }.
   * One singleton popover per created instance.
   */
  function create(opts) {
    var StatusMenu = {
      _el: null,
      _anchor: null,
      _filename: null,
      _type: null,
      _currentStatus: null,
      _docCloser: null,
      _scrollCloser: null,
      _resizeCloser: null,
      _keyHandler: null,
      _busy: false,

      isOpen: function () {
        return !!this._el;
      },

      close: function () {
        if (this._el) {
          this._el.remove();
          this._el = null;
        }
        if (this._anchor) {
          this._anchor.setAttribute('aria-expanded', 'false');
          this._anchor = null;
        }
        if (this._docCloser) {
          document.removeEventListener('pointerdown', this._docCloser, true);
          this._docCloser = null;
        }
        if (this._scrollCloser) {
          document.removeEventListener('scroll', this._scrollCloser, true);
          this._scrollCloser = null;
        }
        if (this._resizeCloser) {
          window.removeEventListener('resize', this._resizeCloser);
          this._resizeCloser = null;
        }
        if (this._keyHandler) {
          document.removeEventListener('keydown', this._keyHandler, true);
          this._keyHandler = null;
        }
        this._filename = null;
        this._type = null;
        this._currentStatus = null;
      },

      open: function (anchorBtn, ctx) {
        var self = this;
        var ESC = ForgeUtils.escapeHTML;
        ctx = ctx || {};

        /* Refuse open while a status write is in flight */
        if (this._busy) {
          if (ForgeUtils.Toast) {
            ForgeUtils.Toast.show('Status update in progress', 'info', 2000);
          }
          return;
        }

        if (this._el && this._anchor === anchorBtn) {
          this.close();
          return;
        }
        this.close();

        this._anchor = anchorBtn;
        this._filename = ctx.filename;
        this._type = ctx.type;
        this._currentStatus = ctx.currentStatus || '';
        anchorBtn.setAttribute('aria-expanded', 'true');

        var options = opts.getOptions(this._type) || [];
        var model = buildModel(options, this._currentStatus);
        var menu = document.createElement('div');
        menu.className = 'forge-status-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Change status');
        menu.setAttribute('tabindex', '-1');

        var html = '';
        model.forEach(function (row) {
          if (row.foreign) {
            /* Foreign status: disabled menuitem so user sees what will be overwritten */
            html += '<button type="button" role="menuitemradio" class="forge-status-menu-item forge-status-menu-foreign" ' +
              'disabled aria-checked="true" aria-disabled="true" tabindex="-1">' +
              ESC(row.value) + ' (current)</button>';
            return;
          }
          html += '<button type="button" role="menuitemradio" class="forge-status-menu-item' +
            (row.current ? ' forge-status-menu-current' : '') + '" ' +
            'data-status-value="' + ESC(row.value) + '" ' +
            'aria-checked="' + (row.current ? 'true' : 'false') + '" tabindex="-1">' +
            '<span class="forge-status-dot" style="background:' + opts.getColor(row.value) + '"></span>' +
            '<span>' + ESC(row.value) + '</span>' +
            (row.current ? '<span class="forge-status-menu-check" aria-hidden="true">✓</span>' : '') +
            '</button>';
        });
        menu.innerHTML = html;

        menu.addEventListener('click', function (e) {
          e.stopPropagation();
          var item = e.target.closest('[data-status-value]');
          if (!item || item.disabled) return;
          self._choose(item.getAttribute('data-status-value'));
        });

        document.body.appendChild(menu);
        this._el = menu;
        this._position(anchorBtn, menu);

        /* Focus checked option, else first enabled item */
        var focusTarget = menu.querySelector('.forge-status-menu-item.forge-status-menu-current') ||
          menu.querySelector('[data-status-value]');
        if (focusTarget) {
          focusTarget.setAttribute('tabindex', '0');
          focusTarget.focus();
        } else {
          menu.focus();
        }

        this._docCloser = function (e) {
          if (self._el && self._el.contains(e.target)) return;
          if (self._anchor && self._anchor.contains(e.target)) return;
          self.close();
        };
        /* Close when board scrolls or viewport resizes (fixed menu would detach) */
        this._scrollCloser = function () { self.close(); };
        this._resizeCloser = function () { self.close(); };
        this._keyHandler = function (e) { self._onKeydown(e); };

        /* Defer so the opening click does not immediately close */
        setTimeout(function () {
          if (!self._el) return;
          document.addEventListener('pointerdown', self._docCloser, true);
          document.addEventListener('scroll', self._scrollCloser, true);
          window.addEventListener('resize', self._resizeCloser);
          document.addEventListener('keydown', self._keyHandler, true);
        }, 0);
      },

      _enabledItems: function () {
        if (!this._el) return [];
        return Array.prototype.slice.call(this._el.querySelectorAll('[data-status-value]:not([disabled])'));
      },

      _onKeydown: function (e) {
        if (!this._el) return;
        var key = e.key;

        if (key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          var anchor = this._anchor;
          this.close();
          if (anchor) anchor.focus();
          return;
        }

        /* Only handle nav keys when focus is inside the menu */
        if (!this._el.contains(document.activeElement)) return;

        var items = this._enabledItems();
        if (!items.length) return;

        var idx = items.indexOf(document.activeElement);
        if (idx < 0) idx = 0;

        if (key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          this._focusItem(items, (idx + 1) % items.length);
        } else if (key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          this._focusItem(items, (idx - 1 + items.length) % items.length);
        } else if (key === 'Home') {
          e.preventDefault();
          e.stopPropagation();
          this._focusItem(items, 0);
        } else if (key === 'End') {
          e.preventDefault();
          e.stopPropagation();
          this._focusItem(items, items.length - 1);
        } else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          var active = document.activeElement;
          if (active && active.getAttribute('data-status-value')) {
            this._choose(active.getAttribute('data-status-value'));
          }
        }
      },

      _focusItem: function (items, index) {
        for (var i = 0; i < items.length; i++) {
          items[i].setAttribute('tabindex', i === index ? '0' : '-1');
        }
        items[index].focus();
      },

      _position: function (anchor, menu) {
        var rect = anchor.getBoundingClientRect();
        var menuW = menu.offsetWidth || 160;
        var menuH = menu.offsetHeight || 120;
        var left = rect.left;
        var top = rect.bottom + 4;
        if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
        if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4);
        menu.style.left = Math.round(left) + 'px';
        menu.style.top = Math.round(top) + 'px';
      },

      _choose: async function (status) {
        if (this._busy) {
          this.close();
          if (ForgeUtils.Toast) {
            ForgeUtils.Toast.show('Status update in progress', 'info', 2000);
          }
          return;
        }
        var filename = this._filename;
        var prev = this._currentStatus;
        if (!filename) return;

        /* Same value: close without write */
        if (status === prev) {
          this.close();
          return;
        }

        var ctx = {
          filename: filename,
          type: this._type,
          status: status,
          prevStatus: prev,
          anchor: this._anchor
        };

        this.close();
        this._busy = true;
        try {
          await opts.onChoose(ctx);
        } finally {
          this._busy = false;
        }
      }
    };

    return StatusMenu;
  }

  return {
    buildModel: buildModel,
    create: create
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/status-menu.test.js` (from `forge-shell/`)
Expected: PASS (4 tests)

- [ ] **Step 5: Add shared menu styles to `components.css`**

Append at the end of `forge-shell/app/css/components.css`. Values are copied **verbatim** (unchanged) from the `.rm-status-menu*` block in `app/css/roadmap.css` and the `.rm-status-dot` rule — only the selectors are renamed; do not delete the roadmap.css originals yet (Task 5.3 does that after the migration):

```css
/* ─── Shared status menu + dot (PR5) — ported verbatim from roadmap.css ─── */
.forge-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.forge-status-menu {
  position: fixed;
  z-index: 40;
  min-width: 160px;
  max-width: 240px;
  padding: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
.forge-status-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.forge-status-menu-item:hover:not(:disabled) {
  background: var(--bg-hover);
}
.forge-status-menu-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.forge-status-menu-item.forge-status-menu-current {
  font-weight: 600;
}
.forge-status-menu-item.forge-status-menu-foreign,
.forge-status-menu-item:disabled {
  opacity: 0.65;
  cursor: default;
  font-style: italic;
}
.forge-status-menu-check {
  margin-left: auto;
  color: var(--accent);
  font-size: 12px;
}
```

- [ ] **Step 6: Load the new modules in `index.html`**

In `forge-shell/app/index.html`, find the script block line:

```html
  <script src="js/card-data.js"></script>
```

and insert immediately after it:

```html
  <script src="js/card-write.js"></script>
  <script src="js/status-menu.js"></script>
```

Both must load before `js/product-forge.js` and `js/roadmap.js` (they do, given the insertion point).

- [ ] **Step 7: Browser sanity check**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, select the project folder.
Expected: all views load with zero console errors; `window.CardWrite` and `window.ForgeStatusMenu` are defined in DevTools; behavior everywhere is unchanged (modules are not consumed yet).

- [ ] **Step 8: Commit**

```bash
git add app/js/status-menu.js test/status-menu.test.js app/css/components.css app/index.html
git commit -m "feat(status-menu): shared status popover component, styles, and script wiring"
```

### Task 5.3: Roadmap migration — adopt `CardWrite` + `ForgeStatusMenu` (zero behavior change)

**Files:**
- Modify: `forge-shell/app/js/roadmap.js`
- Modify: `forge-shell/app/css/roadmap.css`

**Interfaces:**
- Consumes: `CardWrite.createOptimisticGuard` / `CardWrite.createCardWriteService` (Task 5.1), `ForgeStatusMenu.create` (Task 5.2), `RH.cardRelativePath` and `RH.guardDecision` (roadmap.helpers.js, unchanged).
- Produces: nothing new — `OptimisticGuard`, `CardWriteService`, and `StatusMenu` keep their names and call-site contracts inside roadmap.js, so `ctrl.setCardStatus` (quick-assign), the scan `guardDecision` loop, `destroy()`'s `StatusMenu.close()` / `OptimisticGuard.clearAll()`, and the Escape chain's `StatusMenu.isOpen()` all compile untouched.

This task deletes three roadmap-private bodies and replaces them with instantiations of the shared modules. The reviewer's job is a side-by-side diff proving the port is verbatim; your job is to change **nothing else**. Note roadmap.js was not touched by PRs 1–4 in these regions, so the quotes below match your base branch exactly.

- [ ] **Step 1: Replace the OptimisticGuard/CardWriteService/StatusMenu definitions**

In `forge-shell/app/js/roadmap.js`, the three private objects sit contiguously between the end of `TimeUtils` and the `RoadmapConfigManager` banner. Delete everything from (and including) the banner:

```js
  /* ═══════════════════════════════════════════════════════════════
     OptimisticGuard — pending writes vs auto-refresh (TTL 15s)
     ═══════════════════════════════════════════════════════════════ */
```

down to (and including) the closing `};` of the `var StatusMenu = { ... }` object literal — i.e. the `};` on the line immediately before:

```js
  /* ═══════════════════════════════════════════════════════════════
     RoadmapConfigManager — Load/save cards/roadmap.md
     ═══════════════════════════════════════════════════════════════ */
```

and replace the deleted region with:

```js
  /* ═══════════════════════════════════════════════════════════════
     Module handles + shared card write plumbing (card-write.js).
     store/cardsHandle are declared here — hoisted up from the
     Module State section — so the injected getter closes over them.
     ═══════════════════════════════════════════════════════════════ */
  var store = new CardData.CardStore();
  var cardsHandle = null;

  var OptimisticGuard = CardWrite.createOptimisticGuard();

  var CardWriteService = CardWrite.createCardWriteService({
    store: store,
    getCardsHandle: function () { return cardsHandle; },
    guard: OptimisticGuard,
    relPathFn: RH.cardRelativePath
  });

  /* ═══════════════════════════════════════════════════════════════
     StatusMenu — shared popover (status-menu.js). onChoose below
     reproduces the old StatusMenu._choose tail verbatim.
     ═══════════════════════════════════════════════════════════════ */
  var StatusMenu = ForgeStatusMenu.create({
    getOptions: function (type) {
      return (CardData.STATUS_OPTIONS && CardData.STATUS_OPTIONS[type]) || [];
    },
    getColor: function (status) {
      return CardData.getStatusColor(status);
    },
    onChoose: async function (ctx) {
      applyStatusToDom(ctx.filename, ctx.status);
      try {
        await CardWriteService.setCardStatus(ctx.filename, ctx.status);
        if (ForgeUtils.Toast) {
          ForgeUtils.Toast.show('Status updated to ' + ctx.status, 'success', 2500);
        }
        /* Keep drawer status row in sync when it is open for this card */
        if (drawerOpen && selectedFilename === ctx.filename) {
          DetailDrawer.render();
        }
      } catch (e) {
        applyStatusToDom(ctx.filename, ctx.prevStatus);
        console.warn('Roadmap status write failed:', e);
        if (ForgeUtils.Toast) {
          ForgeUtils.Toast.show('Failed to update status: ' + (e.message || e), 'error');
        }
      }
    }
  });
```

Notes: `RH.cardRelativePath` being `undefined` (helpers missing) falls through to the service's default `dirName/filename.md` path — the same fallback the old inline code had. `drawerOpen` / `selectedFilename` / `applyStatusToDom` / `DetailDrawer` are referenced lazily at click time, so their later declaration positions are fine (var hoisting).

- [ ] **Step 2: Remove the now-duplicate declarations from Module State**

Still in roadmap.js, in the `Module State` section, replace:

```js
  var store = new CardData.CardStore();
  var cardsHandle = null;
  var refreshInterval = null;
```

with:

```js
  var refreshInterval = null;
```

Then run a whole-file check that no other `store =` / `cardsHandle =` *declaration* remains (assignments like `cardsHandle = await ForgeUtils.FS.getSubDir(...)` in `ctrl.init` must remain):

Run: `grep -n "var store\|var cardsHandle" app/js/roadmap.js` (from `forge-shell/`)
Expected: exactly one hit each, both in the new plumbing block from Step 1.

- [ ] **Step 3: Update the three `StatusMenu.open` call sites to the ctx signature**

Call site 1 — drawer (`DetailDrawer._bindEvents`): replace

```js
          StatusMenu.open(statusBtn, filename, type, status);
```

with

```js
          StatusMenu.open(statusBtn, { filename: filename, type: type, currentStatus: status });
```

Call site 2 — card view (`_bindCardViewEvents`, under the `/* Inline status change (PR3) — stopPropagation so drawer open is not triggered */` comment): replace

```js
          StatusMenu.open(btn, filename, type, status);
```

with

```js
          StatusMenu.open(btn, { filename: filename, type: type, currentStatus: status });
```

Call site 3 — table view (`_bindTableViewEvents`, under the `/* Inline status change — stopPropagation so row click does not open drawer */` comment): replace

```js
          if (typeof StatusMenu !== 'undefined' && StatusMenu.open) {
            StatusMenu.open(btn, filename, type, status);
          }
```

with

```js
          if (typeof StatusMenu !== 'undefined' && StatusMenu.open) {
            StatusMenu.open(btn, { filename: filename, type: type, currentStatus: status });
          }
```

Everything else stays untouched: `renderStatusHit`, `applyStatusToDom`, `ctrl.setCardStatus` + `statusInFlight` (quick-assign path calls `CardWriteService.patchCardFrontmatter` directly and still resolves), the `_doRefresh` scan loop (`OptimisticGuard.get/clear` + `RH.guardDecision`), `destroy()`'s `StatusMenu.close()` / `OptimisticGuard.clearAll()`, and the Escape chain's `StatusMenu.isOpen()` / `StatusMenu.close()` leading rung.

- [ ] **Step 4: Delete the superseded menu styles from `roadmap.css`**

In `forge-shell/app/css/roadmap.css`, delete the block starting at:

```css
/* ─── Status menu popover (PR3) ─── */
.rm-status-menu {
```

through the closing brace of:

```css
.rm-status-menu-check {
  margin-left: auto;
  color: var(--accent);
  font-size: 12px;
}
```

KEEP `.rm-status-dot` (used by card/table/QA-menu markup) and `.rm-status-hit` (roadmap-specific trigger) exactly as they are.

- [ ] **Step 5: Grep for stragglers**

Run: `grep -rn "rm-status-menu" app/` (from `forge-shell/`)
Expected: no output (exit code 1). `rm-status-dot` and `rm-status-hit` still have hits — that is correct.

- [ ] **Step 6: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: PASS — all suites green (roadmap.helpers tests unchanged; 18 new tests from Tasks 5.1–5.2 included).

- [ ] **Step 7: Browser regression pass (roadmap must be behaviorally identical)**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, go to Roadmap. Verify against the old behavior point by point:

- Click a card's status hit → menu opens anchored below (flips above near the viewport bottom), current option checked/bold, focus on it.
- Foreign status (edit a card file on disk to `status: Bogus`, refresh): disabled italic "Bogus (current)" row on top.
- Arrow/Home/End cycle items; Enter/Space chooses; Escape closes and refocuses the anchor; clicking the same anchor again toggles closed; outside pointerdown/scroll/resize close it.
- Choosing a status: dot + label update instantly, toast `Status updated to <X>` (success), file on disk changes only `status:` + `updated:`; with the detail drawer open on that card, the drawer row updates.
- Rapid re-open while a write is in flight → info toast `Status update in progress`.
- Simulate failure (DevTools: `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))`, then choose a status): dot/label revert, error toast `Failed to update status: boom`. Reload to restore.
- Quick-assign menu status write still shows `Status set to <X>` and re-renders.
- Within 5s of a status write the auto-refresh does not flash the old value (15s optimistic guard).
- Escape hierarchy unchanged: menu closes first, then quick-assign, picker, modal, drawer, filter.

- [ ] **Step 8: Commit**

```bash
git add app/js/roadmap.js app/css/roadmap.css
git commit -m "refactor(roadmap): adopt shared CardWrite + ForgeStatusMenu (verbatim port)"
```

### Task 5.4: Card creation helpers (TDD) + `CardData.TYPE_DIR_MAP`

**Files:**
- Modify: `forge-shell/app/js/product-forge.helpers.js`
- Modify: `forge-shell/app/js/card-data.js`
- Modify: `forge-shell/test/product-forge.helpers.test.js`

**Interfaces:**
- Consumes: nothing (pure functions; `fieldOrder` is passed in so the helper never touches `CardData`).
- Produces: `ProductForgeHelpers.slugifyTitle(title) -> slug`, `nextStoryNumber(filenames) -> 'NNN'`, `uniqueCardFilename(base, existsFn) -> filename`, `buildNewCardFrontmatter(fieldOrder, type, {title, status, parent}, todayStr) -> fm`, `scaffoldBodyFor(type) -> markdown`; `CardData.TYPE_DIR_MAP` (programmatic inverse of `DIR_TYPE_MAP`). Consumed by Task 5.7.

The helpers mirror forge-lib exactly: `slugifyTitle` reproduces `forge-lib/core/slug.py generate_slug` (lowercase → spaces to hyphens → strip non `[a-z0-9-]` → collapse hyphen runs → trim hyphens → truncate to 50 chars stripping a trailing hyphen), except it returns `'untitled'` where Python raises on empty. `nextStoryNumber` mirrors `get_next_sequential_number` (max existing + 1, `zfill(3)`). Scaffold headings must match the unconditional sections of `forge-lib/templates/{initiative,epic,story}.md.j2` **exactly** — conditional sections (Out of Scope, Related Epics/Dependencies, Technical Constraints, epic Open Questions, story Implementation Context) are omitted, matching what the templates render with empty inputs.

- [ ] **Step 1: Write failing tests**

Append to the end of `forge-shell/test/product-forge.helpers.test.js` (existing file; keep everything above unchanged):

```js
/* ═══ PR5: card creation helpers ═══ */

test('slugifyTitle: basic title slugging', () => {
  assert.equal(H.slugifyTitle('My Login Epic!'), 'my-login-epic');
});

test('slugifyTitle: collapses spaces and punctuation runs (forge-lib parity)', () => {
  assert.equal(H.slugifyTitle('Update JIRA & sync w/ team!!!'), 'update-jira-sync-w-team');
  assert.equal(H.slugifyTitle('  Send   PSR to Todd (Phoenix)  '), 'send-psr-to-todd-phoenix');
});

test('slugifyTitle: empty or symbol-only input falls back to untitled', () => {
  assert.equal(H.slugifyTitle(''), 'untitled');
  assert.equal(H.slugifyTitle('!!!'), 'untitled');
  assert.equal(H.slugifyTitle(null), 'untitled');
});

test('slugifyTitle: truncates to 50 chars without trailing hyphen', () => {
  const slug = H.slugifyTitle('a'.repeat(48) + ' bc');
  assert.ok(slug.length <= 50);
  assert.ok(!/-$/.test(slug));
});

test('nextStoryNumber: empty list starts at 001', () => {
  assert.equal(H.nextStoryNumber([]), '001');
});

test('nextStoryNumber: max + 1 across gaps, ignoring non-story filenames', () => {
  assert.equal(H.nextStoryNumber(['story-001-a', 'story-007-b', 'task-003']), '008');
});

test('nextStoryNumber: zero-pads and rolls 099 to 100', () => {
  assert.equal(H.nextStoryNumber(['story-009-x']), '010');
  assert.equal(H.nextStoryNumber(['story-099-x']), '100');
});

test('uniqueCardFilename: returns base, then -2, -3 on collisions', () => {
  const existing = new Set();
  const exists = fn => existing.has(fn);
  assert.equal(H.uniqueCardFilename('my-epic', exists), 'my-epic');
  existing.add('my-epic');
  assert.equal(H.uniqueCardFilename('my-epic', exists), 'my-epic-2');
  existing.add('my-epic-2');
  assert.equal(H.uniqueCardFilename('my-epic', exists), 'my-epic-3');
});

/* Copies of CardData.FIELD_ORDER (card-data.js is window-scoped, not
   requirable from Node — keep these in sync if the field orders change). */
const STORY_FIELD_ORDER = ['title', 'type', 'status', 'product', 'module', 'client',
  'team', 'parent', 'story_points', 'jira_card', 'source_conversation', 'created', 'updated'];
const EPIC_FIELD_ORDER = ['title', 'type', 'status', 'release', 'product', 'module',
  'client', 'team', 'jira_card', 'parent', 'children', 'description', 'source_intake',
  'source_conversation', 'created', 'updated'];

test('buildNewCardFrontmatter: story contains every field-order key, nulls for unset', () => {
  const fm = H.buildNewCardFrontmatter(STORY_FIELD_ORDER, 'story',
    { title: 'My Story', status: 'Draft', parent: 'epic-x' }, '2026-07-16');
  STORY_FIELD_ORDER.forEach(key => assert.ok(key in fm, 'missing key: ' + key));
  assert.equal(fm.title, 'My Story');
  assert.equal(fm.type, 'story');
  assert.equal(fm.status, 'Draft');
  assert.equal(fm.parent, 'epic-x');
  assert.equal(fm.product, null);
  assert.equal(fm.story_points, null);
  assert.equal(fm.created, '2026-07-16');
  assert.equal(fm.updated, '2026-07-16');
  assert.ok(!('children' in fm), 'story must not gain a children key');
});

test('buildNewCardFrontmatter: epic gets children [] and empty description', () => {
  const fm = H.buildNewCardFrontmatter(EPIC_FIELD_ORDER, 'epic',
    { title: 'My Epic', status: 'Planning', parent: null }, '2026-07-16');
  assert.deepEqual(fm.children, []);
  assert.equal(fm.description, '');
  assert.equal(fm.parent, null);
  assert.equal(fm.release, null);
});

test('scaffoldBodyFor: headings exactly match the forge-lib templates', () => {
  const init = H.scaffoldBodyFor('initiative');
  ['## Background', '## Proposed Solution', '## Affected Systems',
    '## Potential Requirements', '## Additional Considerations', '## Open Questions']
    .forEach(h => assert.ok(init.indexOf(h) !== -1, 'initiative missing: ' + h));
  const epic = H.scaffoldBodyFor('epic');
  ['## Background/Context', '## Epic Scope', '## Affected Systems',
    '## Functional Capabilities', '## Suggested Story Breakdown', '## Success Criteria']
    .forEach(h => assert.ok(epic.indexOf(h) !== -1, 'epic missing: ' + h));
  const story = H.scaffoldBodyFor('story');
  ['## Background / Context', '## Feature Requirements / Functional Behavior', '## Acceptance Tests']
    .forEach(h => assert.ok(story.indexOf(h) !== -1, 'story missing: ' + h));
  assert.equal(H.scaffoldBodyFor('unknown'), '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/product-forge.helpers.test.js` (from `forge-shell/`)
Expected: FAIL — 12 new failures, `TypeError: H.slugifyTitle is not a function` (and siblings); pre-existing tests still pass.

- [ ] **Step 3: Implement the helpers**

In `forge-shell/app/js/product-forge.helpers.js`, insert the following block immediately before the module's `return {` export block (after the `cardMatchesStatusFilters` function):

```js
  /* ─── Card creation helpers (PR5) ─── */

  /** Mirror of forge-lib core/slug.py generate_slug; returns 'untitled'
      instead of raising on empty/symbol-only input. */
  function slugifyTitle(title, maxLength) {
    maxLength = typeof maxLength === 'number' ? maxLength : 50;
    var slug = String(title == null ? '' : title).toLowerCase();
    slug = slug.replace(/ /g, '-');
    slug = slug.replace(/[^a-z0-9-]/g, '');
    slug = slug.replace(/-+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');
    if (slug.length > maxLength) {
      slug = slug.slice(0, maxLength).replace(/-+$/g, '');
    }
    return slug || 'untitled';
  }

  /** Next story number: max over /^story-(\d+)-/ plus 1, zero-padded to 3
      (mirrors forge-lib core/slug.py get_next_sequential_number). */
  function nextStoryNumber(filenames) {
    var max = 0;
    (filenames || []).forEach(function (fn) {
      var m = /^story-(\d+)-/.exec(fn);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return String(max + 1).padStart(3, '0');
  }

  /** base, base-2, base-3, ... until existsFn(candidate) is falsy. */
  function uniqueCardFilename(base, existsFn) {
    if (!existsFn(base)) return base;
    var n = 2;
    while (existsFn(base + '-' + n)) n++;
    return base + '-' + n;
  }

  /**
   * Full-field frontmatter for a new card. fieldOrder is passed in
   * (CardData.FIELD_ORDER[type]) to keep this helper pure. Every key is
   * present — null when unset — so YAML serialization emits 'field: null'
   * exactly like the forge-lib Jinja templates do.
   */
  function buildNewCardFrontmatter(fieldOrder, type, values, todayStr) {
    values = values || {};
    var fm = {};
    (fieldOrder || []).forEach(function (key) { fm[key] = null; });
    fm.title = values.title || '';
    fm.type = type;
    if ('status' in fm) fm.status = values.status || null;
    if ('parent' in fm) fm.parent = values.parent || null;
    if (type === 'initiative' || type === 'epic') {
      fm.children = [];
      fm.description = '';
    }
    fm.created = todayStr;
    fm.updated = todayStr;
    return fm;
  }

  /* Section headings + TODO copy mirror the unconditional sections of
     forge-lib/templates/{initiative,epic,story}.md.j2 exactly. */
  var CARD_SCAFFOLDS = {
    initiative: [
      '## Background', '',
      'TODO: Describe the current state and problem. Include market context, user pain points, or business drivers that make this Initiative relevant now.', '',
      '## Proposed Solution', '',
      'TODO: Describe the high-level solution. What are we building? How does it solve the problem?', '',
      '## Affected Systems', '',
      'TODO: List systems impacted by this Initiative (both primary and secondary systems).', '',
      '## Potential Requirements', '',
      'TODO: List 4-6 high-level capabilities that need to be built for engineering estimation.', '',
      '## Additional Considerations', '',
      'TODO: List cross-cutting concerns, migration needs, or constraints that affect estimation.', '',
      '## Open Questions', '',
      'TODO: List unknowns or decisions that haven\'t been made.'
    ].join('\n'),
    epic: [
      '## Background/Context', '',
      'TODO: Describe why this Epic is needed, what parent Initiative it belongs to, and how it fits into the larger picture.', '',
      '## Epic Scope', '',
      'TODO: Describe what this Epic will deliver and what is explicitly excluded from scope.', '',
      '## Affected Systems', '',
      'TODO: List systems impacted by this Epic.', '',
      '## Functional Capabilities', '',
      'TODO: List the key functional capabilities this Epic delivers.', '',
      '## Suggested Story Breakdown', '',
      'TODO: Suggest how this Epic could be broken down into Stories.', '',
      '## Success Criteria', '',
      'TODO: Define measurable success criteria for this Epic.'
    ].join('\n'),
    story: [
      '## Background / Context', '',
      'TODO: Describe why this Story is needed, what parent Epic it belongs to, and the problem it solves.', '',
      '## Feature Requirements / Functional Behavior', '',
      'TODO: Describe the UI behavior, business rules, and functional requirements for this Story.', '',
      '## Acceptance Tests', '',
      'TODO: Define testable acceptance criteria with steps and expected results.'
    ].join('\n')
  };

  /** Markdown scaffold whose headings exactly match the forge-lib template. */
  function scaffoldBodyFor(type) {
    return CARD_SCAFFOLDS[type] || '';
  }
```

Then extend the export block. Replace:

```js
  return {
    createPinStore: createPinStore,
    rankSearchResults: rankSearchResults,
    excludePinnedFromRecents: excludePinnedFromRecents,
    buildBreadcrumb: buildBreadcrumb,
    cardMatchesStatusFilters: cardMatchesStatusFilters
  };
```

with:

```js
  return {
    createPinStore: createPinStore,
    rankSearchResults: rankSearchResults,
    excludePinnedFromRecents: excludePinnedFromRecents,
    buildBreadcrumb: buildBreadcrumb,
    cardMatchesStatusFilters: cardMatchesStatusFilters,
    slugifyTitle: slugifyTitle,
    nextStoryNumber: nextStoryNumber,
    uniqueCardFilename: uniqueCardFilename,
    buildNewCardFrontmatter: buildNewCardFrontmatter,
    scaffoldBodyFor: scaffoldBodyFor
  };
```

- [ ] **Step 4: Add `TYPE_DIR_MAP` to `card-data.js`**

In `forge-shell/app/js/card-data.js`, immediately after:

```js
  const DIR_TYPE_MAP = {
    'initiatives': 'initiative', 'epics': 'epic', 'stories': 'story',
    'intakes': 'intake', 'checkpoints': 'checkpoint',
    'decisions': 'decision', 'release-notes': 'release-note'
  };
```

insert:

```js
  /* Inverse of DIR_TYPE_MAP (type -> directory), built programmatically
     so the two can never drift (PR5). */
  const TYPE_DIR_MAP = {};
  Object.keys(DIR_TYPE_MAP).forEach(function (dir) { TYPE_DIR_MAP[DIR_TYPE_MAP[dir]] = dir; });
```

Then in the Public API return block at the bottom of the file, after the line `DIR_TYPE_MAP,` add:

```js
    TYPE_DIR_MAP,
```

(`card-data.js` is window-scoped and not Node-requirable by design — `TYPE_DIR_MAP` is asserted in the Task 5.7 browser step instead of a unit test.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/product-forge.helpers.test.js` (from `forge-shell/`)
Expected: PASS — all tests including the 12 new ones.

- [ ] **Step 6: Commit**

```bash
git add app/js/product-forge.helpers.js app/js/card-data.js test/product-forge.helpers.test.js
git commit -m "feat(product-forge): card creation helpers + CardData.TYPE_DIR_MAP"
```

### Task 5.5: Product Forge inline status — pill button, shared menu, guard-aware refresh

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`
- Modify: `forge-shell/app/css/product-forge.css`

**Interfaces:**
- Consumes: `CardWrite.createOptimisticGuard` / `createCardWriteService` (Task 5.1), `ForgeStatusMenu.create` (Task 5.2), `RoadmapHelpers.guardDecision` (existing helper — looked up **lazily at runtime only**, because `roadmap.helpers.js` loads after `product-forge.js` in index.html).
- Produces: module-level `pflGuard`, `cardWriter`, `pflStatusMenu` consumed by Tasks 5.6–5.8.

Surface decision (per design): the interactive status control lives in the **detail header only**. The tree-row status dot stays a passive indicator (tree rows dispatch card selection).

- [ ] **Step 1: Instantiate the shared write plumbing**

In `forge-shell/app/js/product-forge.js`, find the Module State block (as landed by PR4 it contains `var pfScanErrors = [];` in addition to the main vars):

```js
  var store = new CardStore();
  var cardsHandle = null;
```

Immediately after the **end of that Module State block** (after the last `var` declaration in it, before the `Controller (public interface)` banner), insert:

```js
  /* ═══ Shared write plumbing (PR5): optimistic guard + portable writes ═══ */
  var PFL_OPTIMISTIC_TTL_MS = 15000;
  var pflGuard = CardWrite.createOptimisticGuard();
  var cardWriter = CardWrite.createCardWriteService({
    store: store,
    getCardsHandle: function () { return cardsHandle; },
    guard: pflGuard
  });
  var pflStatusMenu = ForgeStatusMenu.create({
    getOptions: function (type) { return STATUS_OPTIONS[type] || []; },
    getColor: getStatusColor,
    onChoose: async function (ctx) {
      try {
        await cardWriter.setCardStatus(ctx.filename, ctx.status);
        if (selectedCard === ctx.filename) detailPanel.renderCard(store.get(ctx.filename));
        ctrl._renderTree();
        ForgeUtils.Toast.show('Status updated to ' + ctx.status, 'success', 2500);
      } catch (e) {
        /* Service already rolled the store back — re-render from truth */
        if (selectedCard === ctx.filename) detailPanel.renderCard(store.get(ctx.filename));
        ForgeUtils.Toast.show('Failed to update status: ' + (e.message || e), 'error');
      }
    }
  });
```

(`detailPanel`/`ctrl` are referenced lazily inside `onChoose`, so their declaration positions don't matter.)

- [ ] **Step 2: Make the detail-header pill an interactive button**

In `detailPanel.renderCard`, replace:

```js
      if (fm.status) {
        html += '<span class="status-pill" style="background:' + getStatusColor(fm.status) + '">' + ESC(fm.status) + '</span>';
      }
```

with:

```js
      const statusOpts = STATUS_OPTIONS[type] || [];
      if (statusOpts.length > 0) {
        html += '<button type="button" class="status-pill pfl-status-pill" data-pfl-action="status" ' +
          'aria-haspopup="menu" aria-expanded="false" ' +
          'style="background:' + getStatusColor(fm.status) + '">' +
          ESC(fm.status || 'Set status') + '</button>';
      } else if (fm.status) {
        html += '<span class="status-pill" style="background:' + getStatusColor(fm.status) + '">' + ESC(fm.status) + '</span>';
      }
```

(A status-less card of a known type shows a "Set status" affordance; unknown types with a legacy status keep the old static span.)

- [ ] **Step 3: Dispatch the new action**

In `detailPanel._bindDetailEvents`, the `[data-pfl-action]` click dispatch ends with:

```js
          } else if (action === 'toggle-meta') {
            self.toggleMeta();
          }
```

Replace with:

```js
          } else if (action === 'toggle-meta') {
            self.toggleMeta();
          } else if (action === 'status') {
            pflStatusMenu.open(el, {
              filename: card.filename,
              type: card.frontmatter.type,
              currentStatus: card.frontmatter.status || ''
            });
          }
```

- [ ] **Step 4: Guard-aware auto-refresh + teardown**

In `_doRefresh` — **as landed by PR4** (resilient rewrite: `scanCardsDir(cardsHandle, errs)`, `dirLevelFailure`, `failedNames`) — the per-file loop begins:

```js
        for (var entry of files) {
          var filename = entry[0];
          var fileData = entry[1];
```

Insert immediately after those two declarations, at the very top of the loop body:

```js
          /* Optimistic-guard reconciliation (PR5): don't let a scan that
             raced a just-written PFL change flash stale disk content.
             RoadmapHelpers is looked up lazily at runtime only —
             roadmap.helpers.js loads after this file in index.html. */
          var pflPending = pflGuard.get(filename);
          if (pflPending) {
            var pflGuardFn = (typeof RoadmapHelpers !== 'undefined' && RoadmapHelpers.guardDecision) || null;
            var pflDecision = pflGuardFn
              ? pflGuardFn(pflPending, fileData.content, Date.now(), PFL_OPTIMISTIC_TTL_MS)
              : 'apply';
            if (pflDecision === 'skip') continue;
            if (pflDecision === 'apply-and-clear' || pflDecision === 'force-apply-ttl') {
              pflGuard.clear(filename);
            }
          }
```

In the same method's deleted-files pass — as landed by PR4 it is gated on `!dirLevelFailure` and calls `store.delete(fn); recentsTracker.forget(fn);` — add `pflGuard.clear(fn);` immediately after `store.delete(fn);`.

Then in `ctrl.destroy()`, replace:

```js
    destroy() {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      detailPanel.closeOverflow();
```

with:

```js
    destroy() {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      pflStatusMenu.close();
      pflGuard.clearAll();
      detailPanel.closeOverflow();
```

- [ ] **Step 5: Escape ladder — status menu closes first**

In `ctrl._bindKeyboard`, replace:

```js
        if (e.key === 'Escape') {
          var overlay = $q('.pfl-modal-overlay');
```

with:

```js
        if (e.key === 'Escape') {
          /* Status menu closes before anything else (menu also handles its
             own Escape on a capture listener; this keeps the ladder explicit) */
          if (pflStatusMenu.isOpen()) {
            pflStatusMenu.close();
            return;
          }
          var overlay = $q('.pfl-modal-overlay');
```

- [ ] **Step 6: Pill affordance styles**

Append to `forge-shell/app/css/product-forge.css`:

```css
/* ─── Inline status pill trigger (PR5) ─── */
.pfl-status-pill {
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.pfl-status-pill:hover {
  filter: brightness(1.08);
}
.pfl-status-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: PASS — no regressions (this task adds no unit tests; the guard/service logic is covered by Task 5.1's suite).

- [ ] **Step 8: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, go to Product Forge, select a card:

- Header pill is a focusable `<button>` (`aria-haspopup="menu"`; `aria-expanded` toggles). Click/Enter opens the shared menu (same look as Roadmap's).
- Choose a new status: pill text/color and tree dot update, toast `Status updated to <X>`; open the `.md` on disk — only `status:` and `updated:` changed and the field order is preserved.
- Click a status again within 5 seconds: the auto-refresh does NOT flash the old value back (guardDecision skip path).
- Failure path: in DevTools run `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))`, choose a status → pill and tree dot revert, error toast `Failed to update status: boom`; reload the page to restore.
- A card whose type has no configured status (edit a file to `status:` empty): pill reads `Set status`; choosing one writes a valid status.
- Escape closes the menu (and refocuses the pill); a second Escape then clears search/closes modals per the existing ladder.
- Roadmap still behaves as in Task 5.3 (both views now share one menu implementation).

- [ ] **Step 9: Commit**

```bash
git add app/js/product-forge.js app/css/product-forge.css
git commit -m "feat(product-forge): inline status pill via shared status menu + optimistic guard"
```

### Task 5.6: Route the edit modal's save through the card write service

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`

**Interfaces:**
- Consumes: `cardWriter.patchCardFrontmatter` (Task 5.5 wiring); `editModal._getFormData()` (existing — returns `{ frontmatter, body }` with `updated` already stamped).
- Produces: nothing new; `editModal.save` gains optimistic-guard coverage and portable path-based writes.

This retires the last legacy 2-arg handle write in the card layer (`ForgeUtils.FS.writeFile(handle, content)`) for saves. `_reparentCard`/`_unparentCard` deliberately stay on the legacy handle path this PR (deferred migration) and get a comment saying so.

- [ ] **Step 1: Replace the save body**

In `forge-shell/app/js/product-forge.js`, `editModal.save` is still the legacy version (PR4 did not touch it). Replace the whole method:

```js
    async save() {
      if (!this.currentFilename || !this.originalCard) return;
      var data = this._getFormData();
      var content = CardParser.serialize(data.frontmatter, data.body);
      var handle = store.fileHandles.get(this.currentFilename);

      if (!handle) {
        ForgeUtils.Toast.show('Cannot find file handle for writing', 'error');
        return;
      }

      try {
        await ForgeUtils.FS.writeFile(handle, content);
        var card = CardParser.parse(this.currentFilename, content, this.originalCard.dirName);
        store.set(this.currentFilename, card, Date.now(), handle);
        ctrl._renderTree();
        if (selectedCard === this.currentFilename) {
          detailPanel.renderCard(card);
        }
        this.close();
        ForgeUtils.Toast.show('Card saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    },
```

with:

```js
    async save() {
      if (!this.currentFilename || !this.originalCard) return;
      var data = this._getFormData();

      try {
        /* Portable path-based write with optimistic-guard coverage (PR5).
           The mutator replaces the frontmatter wholesale from the form and
           sets the body; the service stamps `updated`, marks pflGuard
           before the write, and rolls back fm+body on failure. */
        var card = await cardWriter.patchCardFrontmatter(this.currentFilename, function (fm, c) {
          Object.keys(fm).forEach(function (k) { delete fm[k]; });
          Object.assign(fm, data.frontmatter);
          c.body = data.body;
        });
        ctrl._renderTree();
        if (selectedCard === this.currentFilename) {
          detailPanel.renderCard(card);
        }
        this.close();
        ForgeUtils.Toast.show('Card saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    },
```

Note the deliberate failure-mode change: a missing/stale handle no longer produces `Cannot find file handle for writing` — the service throws `Card not writable: <filename>`, surfaced as `Save failed: Card not writable: <filename>` (error toast, 6s per the PR4 convention baked into `ForgeUtils.Toast`).

- [ ] **Step 2: Mark the deferred legacy writers**

Find the `_reparentCard` method (search `_reparentCard(` in product-forge.js) and add this comment line directly above its definition:

```js
    /* NOTE (PR5): _reparentCard/_unparentCard still use legacy handle-based
       writes and silently skip cards without a fileHandle — a card created
       in the Shell has a null handle until the next 5s scan, so drag-reparent
       within ~5s of creation is a no-op. Migration to cardWriter is deferred. */
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: PASS — unchanged (service behavior covered by Task 5.1 tests).

- [ ] **Step 4: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173` → Product Forge:

- Edit a card (E or Edit button), change title/status/body, Preview Changes still diffs, Save → `Card saved successfully`, tree + detail re-render; on disk the frontmatter is re-serialized in FIELD_ORDER with the body change.
- Save then watch one 5s refresh tick: no flash of the old content (guard now covers modal saves).
- Failure path: DevTools `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))`, Save → `Save failed: boom`, modal stays open, in-memory card content still matches disk (service rollback). Reload to restore.

- [ ] **Step 5: Commit**

```bash
git add app/js/product-forge.js
git commit -m "refactor(product-forge): route edit-modal save through shared card write service"
```

### Task 5.7: New Card flow — toolbar button, create modal, `n` shortcut

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`

**Interfaces:**
- Consumes: `H.slugifyTitle` / `H.nextStoryNumber` / `H.uniqueCardFilename` / `H.buildNewCardFrontmatter` / `H.scaffoldBodyFor` (Task 5.4), `CardData.TYPE_DIR_MAP` (Task 5.4), `pflGuard` / `cardWriter` (Task 5.5), `ForgeFS.writeFile` (parent directories auto-created by all three backends), `ctrl._revealCard` (existing — renders the tree itself and flashes the row).
- Produces: `createModal` (module object) consumed by the Escape ladder and the `n` shortcut.

Fields are deliberately minimal — Type (Initiative/Epic/Story only), Title (required), Status (defaults to the type's first option), Parent (epic → initiatives, story → epics, optional). Everything else is set via Edit after creation. The new card's `fileHandle` is stored as `null` until the next 5s scan repopulates it — accepted for this PR (see the Task 5.6 comment).

- [ ] **Step 1: Add the toolbar button**

In `ctrl._renderLayout`, replace the toolbar tail:

```js
            '<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
            '<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
```

with:

```js
            '<span class="refresh-indicator" data-pfl-refresh-ind></span>' +
            '<button class="btn-icon" data-pfl-action="new-card" title="New card (N)"><i class="fa-solid fa-plus"></i></button>' +
            '<button class="btn-icon" data-pfl-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
```

- [ ] **Step 2: Add the create-modal markup**

Still in `_renderLayout`, the view HTML ends with the edit modal:

```js
        /* Edit Modal (local to this view) */
        '<div class="pfl-modal-overlay">' +
```

…(unchanged)… down to its final line `'</div>';`. Replace that final line:

```js
        '</div>';
```

with:

```js
        '</div>' +

        /* Create Modal (PR5) — reuses .pfl-modal-* styling; its own
           data-pfl-create-* namespace so editModal's .pfl-modal-overlay
           and [data-pfl-field] queries (first match / edit fields only)
           are unaffected. It must come AFTER the edit modal in the DOM. */
        '<div class="pfl-modal-overlay" data-pfl-create-overlay>' +
          '<div class="pfl-modal-content">' +
            '<div class="pfl-modal-header">' +
              '<h3>New Card</h3>' +
              '<button class="pfl-modal-close" data-pfl-create-action="close">&times;</button>' +
            '</div>' +
            '<div class="pfl-modal-body"></div>' +
            '<div class="pfl-modal-footer">' +
              '<button data-pfl-create-action="close">Cancel</button>' +
              '<button class="primary" data-pfl-create-action="save">Create</button>' +
            '</div>' +
          '</div>' +
        '</div>';
```

- [ ] **Step 3: Bind the new controls**

Still in `_renderLayout`, after the existing edit-modal binding block:

```js
      /* Bind modal actions */
      $qa('[data-pfl-modal-action]').forEach(function (el) {
        el.addEventListener('click', function () {
          var action = el.dataset.pflModalAction;
          if (action === 'close') editModal.close();
          else if (action === 'toggle-diff') editModal.toggleDiff();
          else if (action === 'save') editModal.save();
        });
      });
```

insert:

```js
      /* Bind create-modal actions (PR5) */
      $qa('[data-pfl-create-action]').forEach(function (el) {
        el.addEventListener('click', function () {
          var action = el.dataset.pflCreateAction;
          if (action === 'close') createModal.close();
          else if (action === 'save') createModal.save();
        });
      });
      var newCardBtn = $q('[data-pfl-action="new-card"]');
      if (newCardBtn) {
        newCardBtn.addEventListener('click', function () { createModal.open(); });
      }
```

- [ ] **Step 4: Add the `createModal` object**

Insert the following as a sibling of `editModal`, immediately after `editModal`'s closing `};` (before the `Module State` banner):

```js
  /* ═══════════════════════════════════════════════════════════════
     Create Modal (PR5) — minimal New Card flow.
     Type/Title/Status/Parent only; everything else via Edit later.
     ═══════════════════════════════════════════════════════════════ */
  const createModal = {
    isOpen() {
      const overlay = $q('[data-pfl-create-overlay]');
      return !!(overlay && overlay.classList.contains('pfl-visible'));
    },

    open() {
      detailPanel.closeOverflow();
      const overlay = $q('[data-pfl-create-overlay]');
      const bodyEl = $q('[data-pfl-create-overlay] .pfl-modal-body');
      if (!overlay || !bodyEl) return;
      bodyEl.innerHTML = this._buildForm('initiative');
      overlay.classList.add('pfl-visible');
      this._bindTypeChange();
      const titleInput = $q('[data-pfl-create-field="title"]');
      if (titleInput) titleInput.focus();
    },

    close() {
      const overlay = $q('[data-pfl-create-overlay]');
      if (overlay) overlay.classList.remove('pfl-visible');
    },

    _buildForm(type) {
      let html = '<div class="form-grid">';
      html += '<div class="form-group"><label>Type</label>' +
        '<select data-pfl-create-field="type">' +
        ['initiative', 'epic', 'story'].map(function (t) {
          return '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
            t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
        }).join('') +
        '</select></div>';
      html += '<div class="form-group full-width"><label>Title</label>' +
        '<input type="text" data-pfl-create-field="title" placeholder="Card title" required></div>';
      html += this._buildTypeFields(type);
      html += '</div>';
      return html;
    },

    /* Status (per-type options, first preselected) + Parent (epic/story only) */
    _buildTypeFields(type) {
      const statuses = STATUS_OPTIONS[type] || [];
      let html = '<div data-pfl-create-typefields style="display:contents">';
      html += '<div class="form-group"><label>Status</label>' +
        '<select data-pfl-create-field="status">' +
        statuses.map(function (s, i) {
          return '<option value="' + ESC(s) + '"' + (i === 0 ? ' selected' : '') + '>' + ESC(s) + '</option>';
        }).join('') +
        '</select></div>';
      if (type === 'epic' || type === 'story') {
        const parents = type === 'epic' ? store.getByType('initiative') : store.getByType('epic');
        html += '<div class="form-group"><label>' +
          (type === 'epic' ? 'Parent Initiative' : 'Parent Epic') + '</label>' +
          '<select data-pfl-create-field="parent">' +
          '<option value="">&mdash; None &mdash;</option>' +
          parents.map(function (p) {
            return '<option value="' + ESC(p.filename) + '">' + ESC(p.frontmatter.title || p.filename) + '</option>';
          }).join('') +
          '</select></div>';
      }
      html += '</div>';
      return html;
    },

    _bindTypeChange() {
      const typeSelect = $q('[data-pfl-create-field="type"]');
      if (!typeSelect) return;
      const self = this;
      typeSelect.addEventListener('change', function () {
        const wrap = $q('[data-pfl-create-typefields]');
        if (!wrap) return;
        const temp = document.createElement('div');
        temp.innerHTML = self._buildTypeFields(typeSelect.value);
        wrap.replaceWith(temp.firstChild);
      });
    },

    async save() {
      const typeEl = $q('[data-pfl-create-field="type"]');
      const titleEl = $q('[data-pfl-create-field="title"]');
      const statusEl = $q('[data-pfl-create-field="status"]');
      const parentEl = $q('[data-pfl-create-field="parent"]');
      if (!typeEl || !titleEl) return;

      const type = typeEl.value;
      const title = titleEl.value.trim();
      if (!title) {
        ForgeUtils.Toast.show('Title is required', 'error');
        titleEl.focus();
        return;
      }
      const status = statusEl ? statusEl.value : null;
      const parentFilename = parentEl && parentEl.value ? parentEl.value : null;

      /* Filename: story-NNN-{slug} for stories, plain slug otherwise
         (mirrors forge-lib core/slug.py numbering + slugging) */
      let filename;
      if (type === 'story') {
        const storyFilenames = store.getByType('story').map(function (c) { return c.filename; });
        filename = 'story-' + H.nextStoryNumber(storyFilenames) + '-' + H.slugifyTitle(title);
      } else {
        filename = H.slugifyTitle(title);
      }
      filename = H.uniqueCardFilename(filename, function (fn) { return store.get(fn) !== null; });

      const dirName = CardData.TYPE_DIR_MAP[type];
      const fm = H.buildNewCardFrontmatter(FIELD_ORDER[type], type,
        { title: title, status: status, parent: parentFilename }, ForgeUtils.todayISO());
      const body = H.scaffoldBodyFor(type);
      const content = CardParser.serialize(fm, body);

      try {
        /* Guard first so the 5s auto-refresh cannot race the new file */
        pflGuard.mark(filename, { expectedContent: content, writtenAt: Date.now() });
        /* Parent dirs auto-created by all three ForgeFS backends
           (Tauri create_dir_all / FSA {create:true} walk / server mkdirSync) */
        await ForgeFS.writeFile(cardsHandle, dirName + '/' + filename + '.md', content);
        /* fileHandle is null until the next 5s scan repopulates it (PR5 accepted risk) */
        store.set(filename, CardParser.parse(filename, content, dirName), Date.now(), null);

        if (parentFilename) {
          await cardWriter.patchCardFrontmatter(parentFilename, function (pfm) {
            pfm.children = pfm.children || [];
            if (pfm.children.indexOf(filename) === -1) pfm.children.push(filename);
          });
        }

        taxonomy = discoverTaxonomy(store.all());
        this.close();
        ctrl._revealCard(filename);
        ForgeUtils.Toast.show('Card created', 'success');
      } catch (e) {
        /* Roll back the in-memory card; modal stays open for retry */
        pflGuard.clear(filename);
        store.delete(filename);
        ForgeUtils.Toast.show('Failed to create card: ' + (e.message || e), 'error');
      }
    }
  };
```

- [ ] **Step 5: `n` shortcut + Escape rung**

In `ctrl._bindKeyboard`, the Escape ladder now starts with the Task 5.5 status-menu rung. Replace:

```js
          if (pflStatusMenu.isOpen()) {
            pflStatusMenu.close();
            return;
          }
          var overlay = $q('.pfl-modal-overlay');
```

with:

```js
          if (pflStatusMenu.isOpen()) {
            pflStatusMenu.close();
            return;
          }
          if (createModal.isOpen()) {
            createModal.close();
            return;
          }
          var overlay = $q('.pfl-modal-overlay');
```

Then, below the input-focus guard, the `e` shortcut reads:

```js
        if (e.key === 'e' && selectedCard) {
          detailPanel.closeOverflow();
          editModal.open(selectedCard);
          return;
        }
```

Insert after it:

```js
        if (e.key === 'n') {
          detailPanel.closeOverflow();
          createModal.open();
          return;
        }
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: PASS — unchanged (creation logic is covered by the Task 5.4 helper tests).

- [ ] **Step 7: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173` → Product Forge:

- Toolbar `+` and the `n` key open the New Card modal, focus in Title; Type offers only Initiative/Epic/Story; Status defaults to Draft/Planning/Draft per type; Parent appears only for epic (initiatives) / story (epics); DevTools: `CardData.TYPE_DIR_MAP` maps all 7 types.
- Create blocked with `Title is required` when Title empty.
- Create epic "My Login Epic" → `cards/epics/my-login-epic.md` on disk; frontmatter has **every** epic FIELD_ORDER key (`field: null` for unset, `children: []`, `description: ""`, quoted title, created/updated = today); body headings match the forge-lib epic template; card revealed + flashed in the tree; toast `Card created`.
- Create it again → `my-login-epic-2.md`.
- Create a story with a Parent epic → filename `story-NNN-...` where NNN = max existing + 1 (zero-padded); parent epic's `children:` on disk now lists the story; story nests under it in the tree.
- Delete the `cards/stories/` directory, create a story → directory auto-created.
- Escape closes the create modal first; modal reopens cleanly; no flash of the new card being reverted by the next 5s scan.
- Roadmap picks up the new cards within one 5s scan without console errors.
- CLI round-trip: `python ../forge-lib/forge.py index rebuild --directory <project>/cards --plugin product-forge` succeeds and lists the new cards.

- [ ] **Step 8: Commit**

```bash
git add app/js/product-forge.js
git commit -m "feat(product-forge): New Card modal for initiative/epic/story with forge-lib naming parity"
```

### Task 5.8: Delete Card — overflow action + Confirm-guarded, parent-first deletion

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`
- Modify: `forge-shell/app/css/product-forge.css`

**Interfaces:**
- Consumes: `ForgeUtils.Confirm.show(title, message, detailsHTML) -> Promise<boolean>` (as landed by PR3: keyboard-complete, Cancel default-focused so bare Enter cancels, `#confirm-dialog` at z-1300 above everything in this view); `cardWriter.patchCardFrontmatter` (parent update); `ForgeFS.deleteFile`; `pinStore.remove`.
- Produces: `ctrl._deleteCard(filename)`.

Order of operations is parent-first: if updating the parent's `children` list fails, **nothing** is deleted. No cascade — child files are never modified; `buildHierarchy` already routes missing-parent epics/stories into the Orphan sections. A deleted initiative may leave a stale filename in `roadmap.md` bucket lists; roadmap renders buckets via store lookups and skips missing entries, and it converges on its own 5s scan (verify in the browser step — if a bucket render path throws on a missing filename, add a one-line `store.get` guard there as part of this task).

- [ ] **Step 1: Add the overflow menu item**

In `detailPanel.renderCard`, replace:

```js
      html += '<button type="button" role="menuitem" data-pfl-action="copy-filename">Copy Filename</button>';
      html += '</div></div></div></header>';
```

with:

```js
      html += '<button type="button" role="menuitem" data-pfl-action="copy-filename">Copy Filename</button>';
      html += '<button type="button" role="menuitem" class="pfl-overflow-danger" data-pfl-action="delete">Delete Card&hellip;</button>';
      html += '</div></div></div></header>';
```

- [ ] **Step 2: Dispatch the action**

In `detailPanel._bindDetailEvents`, the dispatch chain now ends with the Task 5.5 status branch. Replace:

```js
          } else if (action === 'status') {
            pflStatusMenu.open(el, {
              filename: card.filename,
              type: card.frontmatter.type,
              currentStatus: card.frontmatter.status || ''
            });
          }
```

with:

```js
          } else if (action === 'status') {
            pflStatusMenu.open(el, {
              filename: card.filename,
              type: card.frontmatter.type,
              currentStatus: card.frontmatter.status || ''
            });
          } else if (action === 'delete') {
            self.closeOverflow();
            ctrl._deleteCard(card.filename);
          }
```

- [ ] **Step 3: Implement `ctrl._deleteCard`**

In the `ctrl` object, insert a new method immediately after the closing `},` of `selectCard(filename) { ... }` (right before the `/* ─── Internal ─── */` comment):

```js
    /* Delete a card file with a Confirm dialog. Parent-first: the parent's
       children list is updated before the file is removed; if that write
       fails, nothing is deleted. No cascade — children are never modified
       (buildHierarchy routes them to the Orphan sections). (PR5) */
    async _deleteCard(filename) {
      var card = store.get(filename);
      if (!card) return;
      var fm = card.frontmatter;
      var title = fm.title || filename;
      var children = store.getChildren(filename);
      var parentCard = fm.parent ? store.get(fm.parent) : null;

      var details = '<div style="text-align:left">';
      details += '<p><code>' + ESC(card.dirName + '/' + filename + '.md') +
        '</code> &mdash; will be permanently deleted.</p>';
      if (parentCard) {
        details += '<p><code>' + ESC(fm.parent + '.md') + '</code> &mdash; "' +
          ESC(filename) + '" will be removed from its children list.</p>';
      }
      if (children.length > 0) {
        details += '<p>&#9888; ' + children.length + ' child card(s) reference this card ' +
          'as their parent. They will move to the Orphan sections; their files are NOT modified.</p>';
      }
      details += '</div>';

      var confirmed = await ForgeUtils.Confirm.show(
        'Delete Card',
        'Permanently delete "' + title + '"? This cannot be undone.',
        details
      );
      if (!confirmed) return;

      /* Parent first — abort everything if this write fails */
      if (parentCard) {
        try {
          await cardWriter.patchCardFrontmatter(fm.parent, function (pfm) {
            pfm.children = (pfm.children || []).filter(function (c) { return c !== filename; });
          });
        } catch (e) {
          ForgeUtils.Toast.show('Delete aborted: could not update parent: ' + (e.message || e), 'error');
          return;
        }
      }

      try {
        await ForgeFS.deleteFile(cardsHandle, card.dirName + '/' + filename + '.md');
      } catch (e) {
        ForgeUtils.Toast.show('Failed to delete card: ' + (e.message || e), 'error');
        return;
      }

      store.delete(filename);
      pflGuard.clear(filename);
      pinStore.remove(filename);
      if (selectedCard === filename) {
        selectedCard = null;
        detailPanel.renderCard(null); /* shows the empty state */
      }
      taxonomy = discoverTaxonomy(store.all());
      this._renderTree();
      ForgeUtils.Toast.show('Card deleted', 'success');
    },
```

- [ ] **Step 4: Danger styling for the overflow item**

Append to `forge-shell/app/css/product-forge.css`:

```css
/* ─── Destructive overflow action (PR5) ─── */
.pfl-overflow-danger {
  color: var(--status-red, #e5484d);
}
.pfl-overflow-danger:hover {
  background: rgba(229, 72, 77, 0.12);
}
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: PASS — unchanged.

- [ ] **Step 6: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173` → Product Forge:

- Overflow menu (⋯) shows red `Delete Card…` under Copy Filename.
- On an epic that has stories and a parent: the Confirm dialog lists the file path, the parent file to update, and the orphan warning with the child count; focus starts on Cancel (bare Enter cancels); Escape cancels; Cancel is a full no-op.
- Confirm on a leaf story: file gone from disk, parent epic's `children:` updated on disk, pin cleared if pinned, detail panel shows the empty state if it was selected, tree re-renders.
- Confirm on an epic with stories: its stories move to the Orphan section; their files untouched.
- Parent-failure abort: DevTools `ForgeFS.writeFile = () => Promise.reject(new Error('boom'))` (leave `deleteFile` intact), delete a card that has a parent → toast `Delete aborted: could not update parent: boom` and the file still exists. Reload to restore.
- With the same card open in the Roadmap drawer: after deletion, roadmap converges within one 5s scan (drawer closes, no console errors) — including a bucketed initiative (bucket renders skip the missing filename).

- [ ] **Step 7: Commit**

```bash
git add app/js/product-forge.js app/css/product-forge.css
git commit -m "feat(product-forge): guarded card delete via Confirm with parent-first children update"
```

### Task 5.9: Riders — memory.js Confirm migration (C5) + STYLE_GUIDE documentation

**Files:**
- Modify: `forge-shell/app/js/memory.js`
- Modify: `forge-shell/STYLE_GUIDE.md`

**Interfaces:**
- Consumes: `ForgeUtils.Confirm.show` (as landed by PR3).
- Produces: STYLE_GUIDE contract section for `ForgeStatusMenu` + `CardWrite` (append-only; PR6/PR7 append after it).

- [ ] **Step 1: Replace the last `window.confirm` in the app**

In `forge-shell/app/js/memory.js`, inside `deleteMemoryFile` (already `async`; as landed by PR4 its catch shows a 6s error toast — leave the catch alone), replace:

```js
    if (!confirm('Delete "' + getDisplayName(fileName) + '"?')) return;
```

with:

```js
    var confirmed = await ForgeUtils.Confirm.show(
      'Delete Memory File',
      'Delete "' + getDisplayName(fileName) + '"?',
      ''
    );
    if (!confirmed) return;
```

(Both call sites of `deleteMemoryFile` fire-and-forget the promise — no caller changes needed.)

- [ ] **Step 2: Grep for stragglers**

Run: `grep -rn "window.confirm\|[^.]confirm(" app/js/ | grep -v "Confirm\." | grep -v confirmed` (from `forge-shell/`)
Expected: no raw `confirm(` calls remain in any view controller.

- [ ] **Step 3: Document the shared contracts**

Append to the **end** of `forge-shell/STYLE_GUIDE.md` (after PR4's `## Feedback & Error Handling` section — keep this strictly append-only):

```markdown

## Shared Status Menu + Card Write Service (added 2026-07-16)

Two shared UMD modules own inline card status changes and card file writes.
Script order: `card-data.js` → `card-write.js` → `status-menu.js` → view controllers.

### ForgeStatusMenu (`app/js/status-menu.js`)

- `ForgeStatusMenu.create({ getOptions(type), getColor(status), onChoose(ctx) })`
  returns `{ open(anchorBtn, {filename, type, currentStatus}), close(), isOpen() }`.
- The component owns rendering, keyboard nav, capture-phase dismissal, and the
  `_busy` lock; the **view** owns writes, optimistic DOM, toasts, and rollback
  inside `onChoose(ctx)` (`ctx = {filename, type, status, prevStatus, anchor}`).
- Classes `.forge-status-menu*` / `.forge-status-dot` live in `components.css`
  (CSS custom properties only). Do not re-create per-view status menu styles.

### CardWrite (`app/js/card-write.js`)

- `CardWrite.createOptimisticGuard()` — pending-write registry:
  `mark(filename, {expectedContent, writtenAt})`, `clear`, `get`, `clearAll`,
  `hasPending()`.
- `CardWrite.createCardWriteService({ store, getCardsHandle, guard?, relPathFn?, onBeforeWrite?, serialize?, parse?, writeFile?, todayISO?, statusOptions? })`
  — `patchCardFrontmatter(filename, mutatorFn(fm, card))`, `setCardStatus(filename, status)`.
- **Guard-before-write rule:** the service marks the guard with the exact
  serialized content BEFORE awaiting `ForgeFS.writeFile`; refresh loops must
  reconcile via `RoadmapHelpers.guardDecision` before applying disk content.
  Never write a card file outside the service without marking the guard first
  (see the New Card flow in `product-forge.js`).
- On failure the service restores the previous frontmatter AND body, clears the
  guard, and rethrows — call sites only add an error toast + re-render.

### index.json

Shell writes intentionally bypass `cards/index.json`. Run
`forge index rebuild --directory <project>/cards --plugin product-forge`
to reconcile the CLI index after creating or deleting cards in the Shell.
```

- [ ] **Step 4: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173` → Memory:

- Delete a memory file: the styled Confirm dialog appears (not the native browser confirm), Cancel/Escape are no-ops, Enter on the default-focused Cancel cancels, confirming deletes the file and shows the `Deleted …` status pill as before.

- [ ] **Step 5: Commit**

```bash
git add app/js/memory.js STYLE_GUIDE.md
git commit -m "chore(ux): memory delete uses ForgeUtils.Confirm; document shared card-write contracts"
```

### Task 5.10: Full-suite verification + open PR 5

**Files:** none (verification + PR only)

- [ ] **Step 1: Run the complete test suite**

Run: `npm test` (from `forge-shell/`)
Expected: everything passing, including the 30 new tests this PR adds (14 card-write + 4 status-menu + 12 product-forge.helpers), alongside the suites accumulated through PR1–PR4.

- [ ] **Step 2: Three-runtime smoke pass**

Run each runtime — Tauri: `npm run tauri:dev`; Chrome FSA: `npm run serve` opened in a real Chrome/Edge tab (folder via `showDirectoryPicker`); server/cmux: `npm run serve` in an embedded browser (typed-path folder dialog) — and check:

| Check | Tauri | Chrome FSA | Server/cmux |
|---|---|---|---|
| Roadmap status change (card hit + quick-assign): optimistic update, identical toast copy, drawer sync, rollback on forced failure | ✓ | ✓ | ✓ |
| PFL detail-header pill: change status; on disk only `status` + `updated` change, FIELD_ORDER preserved | ✓ | ✓ | ✓ |
| No stale flash within 5s of any PFL write (guard vs auto-refresh; polling in all runtimes) | ✓ | ✓ | ✓ |
| Edit modal save round-trips via the service | ✓ | ✓ | ✓ |
| Create initiative/epic/story — incl. story `NNN` numbering, duplicate-title `-2` suffix, parent `children:` update on disk | ✓ | ✓ | ✓ |
| Create a story with `cards/stories/` missing → directory auto-created | ✓ | ✓ | ✓ |
| Delete: Confirm details (file/parent/orphan count), cancel no-op, parent-failure aborts, orphans re-homed | ✓ | ✓ | ✓ |
| Roadmap reflects PFL create/delete within one 5s scan; drawer auto-closes on deleted card | ✓ | ✓ | ✓ |
| Memory delete uses the styled Confirm (no native confirm anywhere) | ✓ | ✓ | ✓ |
| `grep -rn "rm-status-menu" app/` returns nothing | — | (one runtime is enough) | — |
| CLI reconciliation: `python ../forge-lib/forge.py index rebuild --directory <project>/cards --plugin product-forge` succeeds after create+delete | — | — | ✓ (any runtime) |

(No watcher-dependent rows: PR2's file watcher is Tauri-only, but every PR5 freshness path rides the 5s polling scan, which runs in all three runtimes.)

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin ux-program/pr-5-card-write-service
gh pr create --base main --title "Shared card write service + status menu; Product Forge inline status, create, delete" --body "Extracts roadmap's optimistic guard, card write service, and status menu into shared UMD modules (card-write.js, status-menu.js) with a verbatim-port roadmap migration, then gives Product Forge an inline status pill, a New Card flow with forge-lib naming/template parity, and a Confirm-guarded delete. Also migrates memory.js off window.confirm (C5) and adds the guard hasPending() accessor for PR6 (C3). 30 new node tests.

Stacked PR 5/9 - merge after PR4"
```

---

## PR6 — Freshness: watcher batching + multi-plugin cards/ mapping, memory change detection, audio poller, own-write suppression *(M)*

**Branch:** `ux-program/pr-6-freshness` (from `ux-program/pr-5-card-write-service`) — **Contains:** WP2 in full: declarative `WATCH_GROUPS` (shipped WITHOUT the legacy `TASKS.md` token, C2) + batched watcher toasts in shell.js with multi-plugin `cards/` mapping; memory external-change detection + honest Refresh; audio-forge 5s poller with `destroy()`; own-write toast suppression wired through PR5's service/guard (C3/C4). — **Depends on:** PR5 (`CardWrite.createOptimisticGuard().hasPending()`, `createCardWriteService` `onBeforeWrite` hook, migrated write paths in roadmap.js/product-forge.js) and PR4's write-then-commit memory.js bodies. This PR makes **ZERO changes to tasks.js** — its existing 1000ms suppress window stays valid because suppression is evaluated at event-receipt time, not at the 1.5s flush.

PR6 is the **first PR in the stack to touch shell.js** (main anchors valid there). PR8 will hook palette `invalidate()` into `_onFileChanged` at receipt time (C9) and PR9 will remove the `_onDirectoryReady` TASKS.md/memory probe — do not touch that probe here, and keep both regions clean.

---

### Task 6.1: `shell.helpers.js` — watch-group mapping + toast summarization (TDD)

**Files:**
- Create: `app/js/shell.helpers.js`
- Create: `test/shell.helpers.test.js`
- Modify: `app/index.html` (one script tag)

**Interfaces:**
- Consumes: nothing (pure module — no DOM, no ForgeFS)
- Produces: `ShellHelpers.WATCH_GROUPS` (declarative token→plugins table), `ShellHelpers.matchWatchGroup(path, rootPath) → {label, plugins}` (never null), `ShellHelpers.summarizeChanges(label, filenames) → string`, `ShellHelpers.basename(path) → string` — consumed by Task 6.2 and by node tests

- [ ] **Step 1: Write failing tests**

Create `test/shell.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/shell.helpers.js');

/* ── matchWatchGroup ── */

test('matchWatchGroup: cards/ maps to BOTH product-forge-local and roadmap', () => {
  const g = H.matchWatchGroup('/p/cards/epics/notification-system.md', '/p');
  assert.equal(g.label, 'cards/');
  assert.deepEqual(g.plugins, ['product-forge-local', 'roadmap']);
});

test('matchWatchGroup: every WATCH_GROUPS token maps to its label and plugins', () => {
  for (const grp of H.WATCH_GROUPS) {
    const g = H.matchWatchGroup('/p' + grp.token + 'file.md', '/p');
    assert.equal(g.label, grp.label);
    assert.deepEqual(g.plugins, grp.plugins);
  }
});

test('matchWatchGroup: WATCH_GROUPS has no legacy TASKS.md token', () => {
  assert.equal(H.WATCH_GROUPS.some((g) => g.token.includes('TASKS.md')), false);
});

test('matchWatchGroup: root-level TASKS.md falls through to project fallback', () => {
  const g = H.matchWatchGroup('/p/TASKS.md', '/p');
  assert.equal(g.label, 'project');
  assert.deepEqual(g.plugins, []);
});

test('matchWatchGroup: exact root CLAUDE.md maps to memory', () => {
  const g = H.matchWatchGroup('/p/CLAUDE.md', '/p');
  assert.equal(g.label, 'memory/');
  assert.deepEqual(g.plugins, ['memory']);
});

test('matchWatchGroup: nested CLAUDE.md is NOT the memory overview', () => {
  const g = H.matchWatchGroup('/p/sub/CLAUDE.md', '/p');
  assert.equal(g.label, 'sub/');
  assert.deepEqual(g.plugins, []);
});

test('matchWatchGroup: dead roadmap-data mapping falls through to fallback', () => {
  const g = H.matchWatchGroup('/p/roadmap-data/x.md', '/p');
  assert.equal(g.label, 'roadmap-data/');
  assert.deepEqual(g.plugins, []);
});

test('matchWatchGroup: unmatched directory labels by first segment under root', () => {
  const g = H.matchWatchGroup('/p/docs/notes.md', '/p');
  assert.equal(g.label, 'docs/');
  assert.deepEqual(g.plugins, []);
});

test('matchWatchGroup: root-level file labels as project', () => {
  const g = H.matchWatchGroup('/p/README.md', '/p');
  assert.equal(g.label, 'project');
  assert.deepEqual(g.plugins, []);
});

/* ── summarizeChanges ── */

test('summarizeChanges: single file preserves the existing toast format', () => {
  assert.equal(H.summarizeChanges('cards/', ['a.md']), 'File updated: a.md');
});

test('summarizeChanges: multiple files summarize under the group label', () => {
  assert.equal(H.summarizeChanges('cards/', ['a.md', 'b.md', 'c.md']), '3 files updated in cards/');
});

/* ── basename ── */

test('basename: posix separators', () => {
  assert.equal(H.basename('/p/cards/epics/a.md'), 'a.md');
});

test('basename: windows separators', () => {
  assert.equal(H.basename('C:\\p\\cards\\a.md'), 'a.md');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/shell.helpers.test.js` (from `forge-shell/`)

Expected: FAIL — `Cannot find module '../app/js/shell.helpers.js'`

- [ ] **Step 3: Implement `app/js/shell.helpers.js`**

Create `app/js/shell.helpers.js` (UMD wrapper identical to `app/js/roadmap.helpers.js`):

```js
/* ═══════════════════════════════════════════════════════════════
   Shell — Pure helpers (UMD-style)
   Importable as a <script> (window.ShellHelpers) or via Node require().
   Declarative watch-group table + watcher toast summarization.
   No DOM, no ForgeFS.
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShellHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Path token → plugin group. cards/ intentionally maps to BOTH
     product-forge-local and roadmap (both read cards/). The legacy
     root TASKS.md token is gone (C2) — tasks/ is the only tasks source.
     The dead /roadmap-data/ mapping is likewise not carried over. */
  var WATCH_GROUPS = [
    { token: '/cards/',       label: 'cards/',       plugins: ['product-forge-local', 'roadmap'] },
    { token: '/sessions/',    label: 'sessions/',    plugins: ['cognitive-forge'] },
    { token: '/rovo-agents/', label: 'rovo-agents/', plugins: ['rovo-agent-forge'] },
    { token: '/tasks/',       label: 'tasks/',       plugins: ['tasks'] },
    { token: '/memory/',      label: 'memory/',      plugins: ['memory'] },
    { token: '/reports/',     label: 'reports/',     plugins: ['report-forge'] },
    { token: '/audio-forge/', label: 'audio-forge/', plugins: ['audio-forge'] }
  ];

  /** Last path segment, posix or windows separators. */
  function basename(path) {
    var parts = String(path || '').split(/[\\/]/);
    return parts[parts.length - 1];
  }

  /** First directory segment of path under rootPath, or '' when the file
      sits directly at the root (or the root is unknown). */
  function firstSegmentUnderRoot(path, rootPath) {
    if (!rootPath) return '';
    if (path.indexOf(rootPath + '/') !== 0) return '';
    var rel = path.slice(rootPath.length + 1);
    var idx = rel.indexOf('/');
    return idx === -1 ? '' : rel.slice(0, idx);
  }

  /**
   * Map a changed file path to its plugin group.
   * @param {string} path absolute changed path (from the Tauri watcher)
   * @param {string} rootPath Shell.rootHandle when it is a string, else ''
   * @returns {{label: string, plugins: string[]}} — never null
   * Order: exact root CLAUDE.md → memory group (the Memory view renders
   * CLAUDE.md as its Overview tab); then FIRST WATCH_GROUPS token match
   * (substring, preserving current semantics); else a plugin-less fallback
   * labeled by the first directory segment under the root ('project' for
   * files directly at the root).
   */
  function matchWatchGroup(path, rootPath) {
    var p = String(path || '').replace(/\\/g, '/');
    var r = String(rootPath || '').replace(/\\/g, '/').replace(/\/$/, '');
    if (r && p === r + '/CLAUDE.md') {
      return { label: 'memory/', plugins: ['memory'] };
    }
    for (var i = 0; i < WATCH_GROUPS.length; i++) {
      if (p.indexOf(WATCH_GROUPS[i].token) !== -1) {
        return { label: WATCH_GROUPS[i].label, plugins: WATCH_GROUPS[i].plugins.slice() };
      }
    }
    var seg = firstSegmentUnderRoot(p, r);
    return { label: seg ? seg + '/' : 'project', plugins: [] };
  }

  /**
   * 1 file  → 'File updated: story-001-foo.md'  (existing single-file format)
   * n files → '3 files updated in cards/'
   */
  function summarizeChanges(label, filenames) {
    var files = filenames || [];
    if (files.length === 1) return 'File updated: ' + files[0];
    return files.length + ' files updated in ' + label;
  }

  return {
    WATCH_GROUPS: WATCH_GROUPS,
    basename: basename,
    matchWatchGroup: matchWatchGroup,
    summarizeChanges: summarizeChanges
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/shell.helpers.test.js` (from `forge-shell/`)

Expected: PASS (13 tests)

- [ ] **Step 5: Load the module in `app/index.html`**

In `app/index.html`, find the script tag pair (line numbers have shifted through the stack — anchor on the tags):

```html
  <script src="js/sidebar.js"></script>
  <script src="js/shell.js"></script>
```

Insert the helpers script immediately BEFORE `js/shell.js`:

```html
  <script src="js/sidebar.js"></script>
  <script src="js/shell.helpers.js"></script>
  <script src="js/shell.js"></script>
```

Script order is otherwise unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/js/shell.helpers.js test/shell.helpers.test.js app/index.html
git commit -m "feat(shell): add ShellHelpers watch-group mapping + change summarization"
```

---

### Task 6.2: shell.js — batched `_onFileChanged` with multi-plugin cards/ mapping

**Files:**
- Modify: `app/js/shell.js`

**Interfaces:**
- Consumes: `ShellHelpers.matchWatchGroup` / `summarizeChanges` / `basename` (Task 6.1); the existing `controller.isSuppressingToasts() → boolean` contract (implemented today only by tasks.js; Tasks 6.3–6.5 add the rest)
- Produces: the rewritten `_onFileChanged` — the receipt-time point PR8 hooks palette `invalidate()` into (C9) — plus `Shell._flushFileChanges()`

- [ ] **Step 1: Add batching state to the Shell object literal**

In `app/js/shell.js`, in the `Shell` object literal (top of the file), find:

```js
  _controllers: {},
  _watcherCleanup: null,
```

Replace with:

```js
  _controllers: {},
  _watcherCleanup: null,
  _pendingChanges: new Map(),   // label → { plugins, files:Set, suppressedCount }
  _changeFlushTimer: null,
  FILE_CHANGE_FLUSH_MS: 1500,   // fixed window from the FIRST event — not a resetting debounce
```

- [ ] **Step 2: Replace `_onFileChanged` with the batch-and-flush pair**

Still in `app/js/shell.js`, find the entire existing handler (between `_setupFileWatcher` and `/* ── Boot ── */`):

```js
  /* ── Handle file change events ── */
  // Maps changed file paths to the owning plugin by matching known data
  // directories (e.g. /cards/ → product-forge-local). This lets each
  // controller refresh only when its own data changes.
  _onFileChanged(path) {
    console.log('[Shell] File changed:', path);

    // Determine which plugin should refresh based on the changed path
    let pluginToRefresh = null;

    if (path.includes('/cards/')) {
      pluginToRefresh = 'product-forge-local';
    } else if (path.includes('/sessions/')) {
      pluginToRefresh = 'cognitive-forge';
    } else if (path.includes('/rovo-agents/')) {
      pluginToRefresh = 'rovo-agent-forge';
    } else if (path.includes('/tasks/') || path.includes('TASKS.md')) {
      pluginToRefresh = 'tasks';
    } else if (path.includes('/memory/')) {
      pluginToRefresh = 'memory';
    } else if (path.includes('/roadmap-data/')) {
      pluginToRefresh = 'roadmap';
    } else if (path.includes('/reports/')) {
      pluginToRefresh = 'report-forge';
    } else if (path.includes('/audio-forge/')) {
      pluginToRefresh = 'audio-forge';
    }

    // If a relevant plugin is active, refresh it
    if (pluginToRefresh && pluginToRefresh === this.activePlugin) {
      const ctrl = this._controllers[pluginToRefresh];
      if (ctrl && ctrl.refresh) {
        console.log(`[Shell] Refreshing ${pluginToRefresh} view`);
        ctrl.refresh();
      }
    }

    // Check if plugin is suppressing toasts (internal change)
    let shouldShowToast = true;
    if (pluginToRefresh) {
      const ctrl = this._controllers[pluginToRefresh];
      if (ctrl && typeof ctrl.isSuppressingToasts === 'function') {
        shouldShowToast = !ctrl.isSuppressingToasts();
      }
    }

    // Show toast notification only if not suppressed
    if (shouldShowToast) {
      ForgeUtils.Toast.show(`File updated: ${path.split('/').pop()}`, 'info', 3000);
    } else {
      console.log('[Shell] Toast suppressed for internal change');
    }
  },
```

Replace the whole block (comment included) with:

```js
  /* ── Handle file change events ── */
  // Batches watcher events into one flush per FILE_CHANGE_FLUSH_MS window.
  // The window is FIXED from the FIRST event — later events do NOT reset the
  // timer, so a sustained write stream cannot starve the flush (the Rust
  // watcher already coalesces at 500ms, so one window catches a multi-file
  // forge-lib operation). Paths map to plugin groups declaratively via
  // ShellHelpers.WATCH_GROUPS — cards/ maps to BOTH product-forge-local and
  // roadmap. Own-write suppression is evaluated at RECEIPT time, not flush
  // time, so short controller suppress windows (e.g. tasks.js's 1000ms)
  // remain correct despite the 1.5s flush delay.
  _onFileChanged(path) {
    console.log('[Shell] File changed:', path);

    const group = ShellHelpers.matchWatchGroup(
      path,
      typeof this.rootHandle === 'string' ? this.rootHandle : ''
    );

    // Receipt-time suppression: any controller mapped to this group that
    // reports an in-flight own write silences this event's toast.
    const suppressed = group.plugins.some(pid => {
      const c = this._controllers[pid];
      return c && typeof c.isSuppressingToasts === 'function' && c.isSuppressingToasts();
    });

    let entry = this._pendingChanges.get(group.label);
    if (!entry) {
      entry = { plugins: group.plugins, files: new Set(), suppressedCount: 0 };
      this._pendingChanges.set(group.label, entry);
    }
    if (suppressed) {
      entry.suppressedCount++;
    } else {
      entry.files.add(ShellHelpers.basename(path));
    }

    if (this._changeFlushTimer == null) {
      this._changeFlushTimer = setTimeout(() => this._flushFileChanges(), this.FILE_CHANGE_FLUSH_MS);
    }
  },

  /* ── Flush batched file changes ── */
  // NOTE: PR8 hooks command-palette invalidation into _onFileChanged at
  // receipt time (C9), not here.
  _flushFileChanges() {
    this._changeFlushTimer = null;
    const groups = this._pendingChanges;
    this._pendingChanges = new Map();

    // Refresh the active plugin at most once, even when several groups (or
    // a multi-plugin group like cards/) map to it. refresh() is safe
    // unawaited — every controller has its own reentry guard
    // (isMemoryRefreshing / taskRefreshRunning / refreshRunning / pollRunning)
    // and is already invoked fire-and-forget today.
    const refreshed = new Set();
    for (const [, entry] of groups) {
      if (entry.plugins.includes(this.activePlugin) && !refreshed.has(this.activePlugin)) {
        refreshed.add(this.activePlugin);
        const ctrl = this._controllers[this.activePlugin];
        if (ctrl && ctrl.refresh) {
          console.log(`[Shell] Refreshing ${this.activePlugin} view`);
          ctrl.refresh();
        }
      }
    }

    // One toast per changed directory group.
    for (const [label, entry] of groups) {
      if (entry.files.size > 0) {
        ForgeUtils.Toast.show(ShellHelpers.summarizeChanges(label, [...entry.files]), 'info', 3000);
      } else if (entry.suppressedCount > 0) {
        console.log(`[Shell] ${entry.suppressedCount} internal change(s) in ${label} — toast suppressed`);
      }
    }
  },
```

Do NOT touch anything else in shell.js — in particular leave the `_onDirectoryReady` TASKS.md/memory probe (`this.pluginDirStatus['productivity'] = ...`) exactly as-is; PR9 removes it.

- [ ] **Step 3: Run the test suite**

Run: `npm test` (from `forge-shell/`)

Expected: PASS — all tests green (shell.js has no unit-test coverage; this guards against accidental breakage of tested helpers)

- [ ] **Step 4: Browser verification (server mode regression)**

Run: `npm run serve` (from `forge-shell/`)

Open `http://127.0.0.1:4173` in a browser. The watcher is Tauri-only (server mode gets the no-op), so this is a boot/regression check:
- App boots to the last-selected project with no console errors (`ShellHelpers is not defined` would appear here if the index.html insert is wrong).
- Click through all views in the sidebar — each renders normally.

Full watcher behavior (batching, multi-plugin refresh, suppression) is verified in Tauri in Task 6.6's smoke checklist.

- [ ] **Step 5: Commit**

```bash
git add app/js/shell.js
git commit -m "feat(shell): batch watcher events into summarized toasts with multi-plugin cards/ mapping"
```

---

### Task 6.3: memory.js — external-change detection, honest Refresh, own-write suppression

**Files:**
- Modify: `app/js/memory.js`

**Interfaces:**
- Consumes: `ForgeFS.getFileMeta` / `readDir` / `listMarkdownFiles` (all three backends); the write-then-commit `saveModal` branch bodies as landed by PR4 and the `ForgeUtils.Confirm`-based `deleteMemoryFile` as landed by PR5
- Produces: `MemoryView.isSuppressingToasts() → boolean` — consumed by `Shell._onFileChanged` (Task 6.2)

All edits below are line-local additions inside bodies PR4 reordered and PR5 migrated — anchor on the quoted landmarks, not line numbers.

- [ ] **Step 1: Add own-write suppression state**

In the State block at the top of the IIFE, find:

```js
  let memorySortMode = 'name'; // 'name' | 'importance' | 'last_recalled'
```

Replace with:

```js
  let memorySortMode = 'name'; // 'name' | 'importance' | 'last_recalled'
  let suppressToastsUntil = 0;

  /* Mark our own writes so the Tauri watcher toast is suppressed.
     2500ms covers the Rust watcher's 500ms debounce plus delivery. */
  function markOwnWrite() { suppressToastsUntil = Date.now() + 2500; }
```

- [ ] **Step 2: Rewrite `buildMemorySignature` to re-list from disk**

Find the existing function (it begins `async function buildMemorySignature() {` with `var promises = [];` and only stats the files captured at last load) and replace the ENTIRE function with:

```js
  /* Signature re-lists from disk on EVERY call, so files created or deleted
     outside the app change the signature (the old version only stat'ed the
     files captured at last load, making external adds/removes invisible).
     NOTE: listMarkdownFiles recurses arbitrarily deep while loadMemory
     renders only 2 levels — a deeper change triggers one harmless reload
     that renders nothing new (the signature is stable afterwards; no loop). */
  async function buildMemorySignature() {
    var parts = [];
    try {
      var meta = await ForgeFS.getFileMeta(memoryDirHandle, 'CLAUDE.md');
      parts.push('CLAUDE.md:' + meta.modified);
    } catch (e) { /* no CLAUDE.md */ }
    try {
      var entries = await ForgeFS.readDir(memoryDirHandle, 'memory');
      /* Directory names catch a new, still-empty tab dir */
      entries.forEach(function (en) {
        if (en.kind === 'directory') parts.push('dir:' + en.name);
      });
    } catch (e) { /* no memory/ directory */ }
    try {
      var files = await ForgeFS.listMarkdownFiles(memoryDirHandle, 'memory');
      files.forEach(function (f) { parts.push('memory/' + f.path + ':' + f.modified); });
    } catch (e) { /* ignore */ }
    parts.sort();
    return parts.join('|');
  }
```

- [ ] **Step 3: Give `checkForMemoryChanges` a `force` param and a boolean return**

Find the existing `async function checkForMemoryChanges() {` and replace the ENTIRE function with (the modal-open overlay guard, `isMemoryRefreshing` gate, and tab/search save-restore block are retained verbatim):

```js
  /** @returns {boolean} true when a reload actually ran */
  async function checkForMemoryChanges(force) {
    if (!memoryDirHandle || isMemoryRefreshing) return false;
    var overlay = $('[data-ref="modal-overlay"]');
    if (overlay && overlay.classList.contains('prod-visible')) return false;

    isMemoryRefreshing = true;
    try {
      var newSignature = await buildMemorySignature();

      if (!force && newSignature === memorySignature) return false;
      memorySignature = newSignature;
      var savedTabId = activeMemoryTab;
      var searchInput = $('[data-ref="memory-search"]');
      var savedSearch = searchInput ? searchInput.value : '';

      await loadMemory();

      /* Restore active tab */
      if (savedTabId) {
        var tabs = $$('.prod-memory-tab');
        tabs.forEach(function (t) { t.classList.remove('prod-active'); });
        var tabToRestore = $('[data-mem-tab="' + savedTabId + '"]');
        if (tabToRestore) {
          tabToRestore.classList.add('prod-active');
          activeMemoryTab = savedTabId;
          renderMemoryContent();
        }
      }

      /* Restore search */
      var newSearchInput = $('[data-ref="memory-search"]');
      if (newSearchInput && savedSearch) {
        newSearchInput.value = savedSearch;
        filterMemoryContent(savedSearch);
      }

      return true;
    } catch (e) {
      console.warn('Memory refresh error:', e);
      return false;
    } finally {
      isMemoryRefreshing = false;
    }
  }
```

The 5s poller (`startMemoryWatching`'s `setInterval(checkForMemoryChanges, 5000)`) needs no change — it calls with `force` undefined, keeping today's signature-gated silent reload.

- [ ] **Step 4: Make `handleRefresh` honest**

Find:

```js
  async function handleRefresh() {
    await checkForMemoryChanges();
    showStatus('Memory refreshed');
```

Replace with:

```js
  async function handleRefresh() {
    var reloaded = await checkForMemoryChanges(true);
    showStatus(reloaded ? 'Memory refreshed' : 'Refresh already in progress');
```

(The refresh-indicator timestamp lines below stay unchanged. The 'Refresh already in progress' branch fires when `isMemoryRefreshing` or the modal-open guard blocked the forced reload — cosmetic, not a failure state.)

- [ ] **Step 5: Start watching unconditionally in `loadMemory`**

In `loadMemory`'s tail, the `hasAny` branch currently ends with the signature + watch calls:

```js
    if (hasAny) {
      if (emptyEl) emptyEl.style.display = 'none';
      if (mainEl) mainEl.style.display = 'flex';
      renderMemoryTabs();
      renderMemoryContent();
      memorySignature = await buildMemorySignature();
      startMemoryWatching();
    } else {
      if (emptyEl) emptyEl.style.display = '';
      if (mainEl) mainEl.style.display = 'none';
    }
```

Delete the two lines `memorySignature = await buildMemorySignature();` and `startMemoryWatching();` from inside the `hasAny` branch, and add them AFTER the if/else — as the last statements of `loadMemory`, i.e. after the `ForgeUtils.ScanBanner.update($('[data-ref="scan-banner"]'), memoryScanErrors, 'memory file');` line that closes the function as landed by PR4:

```js
    /* Signature + watching run unconditionally so a memory/ directory
       created after init (empty-state project) is still detected within 5s. */
    memorySignature = await buildMemorySignature();
    startMemoryWatching();
```

- [ ] **Step 6: Own-write hygiene in `saveModal` and `deleteMemoryFile`**

In `saveModal` (as landed by PR4, each branch writes first, then commits to in-memory state), insert `markOwnWrite();` immediately ABOVE the awaited write in each of the four branches:

- claudeMd branch — above `await ForgeUtils.FS.writeFile(memoryData.claudeMd.fileHandle, content);`
- memoryFile branch — above `await ForgeUtils.FS.writeFile(file.fileHandle, content);`
- dirFile branch — above `await ForgeUtils.FS.writeFile(df.fileHandle, content);`
- newDirFile branch — above `await ForgeFS.createDirectory(memoryDirHandle, 'memory/' + dName);` (one flag covers the createDirectory + writeFile pair)

Then, after the branch chain and still inside the `try`, find:

```js
      closeModal();
```

Replace with:

```js
      /* Re-sync so our own write doesn't trigger a full reload on the
         next 5s poll (mirrors tasks.js autoSave). */
      memorySignature = await buildMemorySignature();

      closeModal();
```

In `deleteMemoryFile` (as landed by PR5 the confirm is `await ForgeUtils.Confirm.show(...)` — the anchor is the delete call), find:

```js
      await ForgeFS.deleteFile(memoryDirHandle, 'memory/' + dirName + '/' + fileName);
```

Replace with:

```js
      markOwnWrite();
      await ForgeFS.deleteFile(memoryDirHandle, 'memory/' + dirName + '/' + fileName);
      memorySignature = await buildMemorySignature();
```

- [ ] **Step 7: Export `isSuppressingToasts`**

Find the public API return block at the bottom of the IIFE:

```js
  return {
    init: init,
    destroy: destroy,
    refresh: refresh
  };
```

Replace with (if an earlier PR added keys here, keep them and append):

```js
  return {
    init: init,
    destroy: destroy,
    refresh: refresh,
    isSuppressingToasts: function () { return Date.now() < suppressToastsUntil; }
  };
```

- [ ] **Step 8: Run the test suite**

Run: `npm test` (from `forge-shell/`)

Expected: PASS — all tests green (memory.js has no unit harness; this protects the helpers suites)

- [ ] **Step 9: Browser verification (server mode — pollers work in all backends)**

Run: `npm run serve` (from `forge-shell/`)

Open `http://127.0.0.1:4173`, select a project with a `memory/` dir, open the Memory view:
- From a terminal: `echo '# New Person' > <project>/memory/people/new-person.md` — the card and updated tab count appear within 5s, with NO toast from the poll path.
- Delete that file from the terminal — the entry disappears within 5s.
- Click toolbar Refresh — reloads and shows the status pill 'Memory refreshed'; active tab and any in-progress search text survive the reload.
- Save a file via the memory edit modal — no full view reload on the next 5s poll (watch the Network/console: no reload churn), content persists.
- Empty-state check: point at a project WITHOUT `memory/`, then `mkdir -p <project>/memory/glossary && echo '# Term' > <project>/memory/glossary/term.md` — the view leaves the empty state within 5s.

- [ ] **Step 10: Commit**

```bash
git add app/js/memory.js
git commit -m "fix(memory): detect external changes, honest refresh, own-write suppression"
```

---

### Task 6.4: audio-forge — 5s external-change poller, `destroy()`, suppression (helper via TDD)

**Files:**
- Modify: `app/js/audio-forge.helpers.js`
- Modify: `test/audio-forge.helpers.test.js`
- Modify: `app/js/audio-forge.js`

**Interfaces:**
- Consumes: `ForgeFS.listMarkdownFiles`; `machineState.status` from `AudioForgeReducer` (`'idle' | 'starting' | 'recording' | 'stopping' | 'creating' | 'transcribing'`)
- Produces: `AudioForgeHelpers.fileListSignature(files) → string`; `AudioForgeView.destroy() → void` (clears ONLY the poll interval — consumed by `Shell.selectPlugin` on view switch); `AudioForgeView.isSuppressingToasts() → boolean`

- [ ] **Step 1: Write failing tests for `fileListSignature`**

Append to `test/audio-forge.helpers.test.js`:

```js
/* ── fileListSignature ── */

test('fileListSignature: empty and null inputs', () => {
  assert.equal(helpers.fileListSignature([]), '');
  assert.equal(helpers.fileListSignature(null), '');
  assert.equal(helpers.fileListSignature(undefined), '');
});

test('fileListSignature: order-independent', () => {
  const a = { path: 'a.md', modified: 100 };
  const b = { path: 'b.md', modified: 200 };
  assert.equal(helpers.fileListSignature([a, b]), helpers.fileListSignature([b, a]));
});

test('fileListSignature: mtime bump changes the signature', () => {
  const before = helpers.fileListSignature([{ path: 'a.md', modified: 100 }]);
  const after = helpers.fileListSignature([{ path: 'a.md', modified: 101 }]);
  assert.notEqual(before, after);
});

test('fileListSignature: same path with different mtimes stays distinct', () => {
  const sig = helpers.fileListSignature([
    { path: 'a.md', modified: 100 },
    { path: 'a.md', modified: 200 },
  ]);
  assert.equal(sig, 'a.md:100|a.md:200');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/audio-forge.helpers.test.js` (from `forge-shell/`)

Expected: FAIL — 4 new tests fail with `helpers.fileListSignature is not a function` (the existing tests stay green)

- [ ] **Step 3: Implement the helper**

In `app/js/audio-forge.helpers.js`, add above the module's return block:

```js
  /** Sorted 'path:modified' signature for a listMarkdownFiles result.
      Cheap mtime-level change detection for the 5s poller. */
  function fileListSignature(files) {
    return (files || [])
      .map((f) => `${f.path}:${f.modified}`)
      .sort()
      .join('|');
  }
```

And add it to the export object — find:

```js
  return {
    formatDuration,
    formatTimestamp,
    deriveTitle,
    parseFrontmatter,
    statusBadge,
  };
```

Replace with:

```js
  return {
    formatDuration,
    formatTimestamp,
    deriveTitle,
    parseFrontmatter,
    statusBadge,
    fileListSignature,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/audio-forge.helpers.test.js` (from `forge-shell/`)

Expected: PASS (all tests in the file, including the 4 new ones)

- [ ] **Step 5: Add poller state + `markOwnWrite` to the controller**

In `app/js/audio-forge.js`, in the `/* ── State ── */` block, find:

```js
  let searchQuery = '';
```

Replace with:

```js
  let searchQuery = '';

  /* ── External-change poller / own-write suppression ── */
  let pollInterval = null;
  let diskSignature = '';
  let pollRunning = false;
  let retryInFlight = false;
  let suppressToastsUntil = 0;

  /* 2500ms covers the Rust watcher's 500ms debounce plus delivery. */
  function markOwnWrite() { suppressToastsUntil = Date.now() + 2500; }
```

- [ ] **Step 6: Sync the signature inside `scanRecordings` (zero extra IO)**

In `scanRecordings`, find:

```js
      const files = await ForgeFS.listMarkdownFiles(rootHandle, SUBDIR);
```

Replace with:

```js
      const files = await ForgeFS.listMarkdownFiles(rootHandle, SUBDIR);
      // Signature from the list we already fetched — an explicit refresh()
      // never causes a redundant poll-triggered refresh afterwards.
      diskSignature = helpers.fileListSignature(files);
```

- [ ] **Step 7: Add the poller functions**

Immediately ABOVE the `/* ═══ refresh ═══ */` section header (the one preceding `async function refresh() {`), insert:

```js
  /* ═══════════════════════════════════════════════════════════
     External-change poller (5s)
     The record → create → transcribe pipeline calls refresh()
     explicitly and its writes must not double-trigger, so the poll
     skips entirely while the machine is busy (status !== 'idle').
     ═══════════════════════════════════════════════════════════ */
  async function checkForExternalChanges() {
    if (!rootHandle || pollRunning) return;
    if (machineState.status !== 'idle') return; // pipeline refreshes explicitly
    pollRunning = true;
    try {
      const files = await ForgeFS.listMarkdownFiles(rootHandle, 'audio-forge/recordings');
      const sig = helpers.fileListSignature(files);
      if (sig !== diskSignature) {
        diskSignature = sig;
        await refresh();
      }
    } catch (e) {
      console.warn('[AudioForge] poll error', e);
    } finally {
      pollRunning = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(checkForExternalChanges, 5000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }
```

- [ ] **Step 8: Flag own writes in `deleteRecording` and `retryTranscribe`**

In `deleteRecording`, find:

```js
    try {
      await invokeDelete(relativePath);
```

Replace with:

```js
    try {
      markOwnWrite();
      await invokeDelete(relativePath);
```

In `retryTranscribe`, find:

```js
  async function retryTranscribe(id) {
    if (!id) return;
```

Replace with:

```js
  async function retryTranscribe(id) {
    if (!id) return;
    // Covers minutes-long transcriptions whose frontmatter write lands at
    // the very end — the flag holds until the finally below completes.
    retryInFlight = true;
```

and in that function's existing `finally` block, find:

```js
    } finally {
      await refresh();
      selectedId = id;
      renderList();
      renderDetail();
    }
```

Replace with:

```js
    } finally {
      await refresh();
      selectedId = id;
      renderList();
      renderDetail();
      retryInFlight = false;
    }
```

- [ ] **Step 9: Start the poller in `init` and extend the public API**

In the controller's return block, find:

```js
    init(handle) {
      setProjectRoot(handle);
      if (!initialized) {
        scaffold();
        initialized = true;
      }
      ensureListeners();
      renderToolbar();
      refresh();
      reconcileStatus();
```

Replace with:

```js
    init(handle) {
      setProjectRoot(handle);
      if (!initialized) {
        scaffold();
        initialized = true;
      }
      ensureListeners();
      renderToolbar();
      refresh();
      startPolling();
      reconcileStatus();
```

Then find the end of the return block:

```js
    refresh,
  };
```

Replace with:

```js
    refresh,
    /* Clears ONLY the poll interval. Tauri listeners and machineState are
       deliberately untouched so an in-progress recording survives view
       switches — reconcileStatus re-syncs the toolbar on return.
       Shell.selectPlugin calls destroy() on the outgoing view. */
    destroy() { stopPolling(); },
    isSuppressingToasts: () =>
      machineState.status !== 'idle' || retryInFlight || Date.now() < suppressToastsUntil,
  };
```

- [ ] **Step 10: Run the test suite**

Run: `npm test` (from `forge-shell/`)

Expected: PASS — all tests green

- [ ] **Step 11: Browser verification (server mode)**

Run: `npm run serve` (from `forge-shell/`)

Open `http://127.0.0.1:4173`, select a project with `audio-forge/recordings/`, open Audio Forge:
- From a terminal, copy an existing recording .md to a new name inside `audio-forge/recordings/` — the list updates within 5s.
- Remove it — the entry disappears within 5s.
- Switch to another view (e.g. Tasks) — no further poll activity for audio (in server mode, watch the terminal running `server.js`: `/api/fs/*` list calls for `audio-forge/recordings` stop).
- Click through all 8 views once — no init/destroy console errors from the new `destroy()`.

Recording-pipeline interactions (poll pause while `status !== 'idle'`, recording surviving a view switch) are Tauri-only — covered in Task 6.6's smoke checklist.

- [ ] **Step 12: Commit**

```bash
git add app/js/audio-forge.helpers.js test/audio-forge.helpers.test.js app/js/audio-forge.js
git commit -m "feat(audio-forge): 5s external-change poller, destroy(), own-write suppression"
```

---

### Task 6.5: roadmap.js + product-forge.js — own-write suppression via PR5's service/guard

**Files:**
- Modify: `app/js/roadmap.js`
- Modify: `app/js/product-forge.js`

**Interfaces:**
- Consumes: `CardWrite.createOptimisticGuard().hasPending() → boolean` (as landed by PR5, C3); `CardWrite.createCardWriteService` `onBeforeWrite` deps hook — invoked by the service as `onBeforeWrite(filename, content)` immediately before each write (as landed by PR5, C4; the `markOwnWrite` wiring ignores the arguments); `isPrefsWritePending()` in roadmap.js (true while the debounced roadmap.md prefs timer is pending or a prefs save is in flight)
- Produces: `RoadmapView.isSuppressingToasts()`, `ProductForgeLocalView.isSuppressingToasts()` — consumed by `Shell._onFileChanged` (Task 6.2); cards/ suppression is checked across BOTH mapped plugins, so either controller reporting `true` silences the group

- [ ] **Step 1: roadmap.js — one ctrl method, nothing else**

In `app/js/roadmap.js`, inside the `ctrl` object, find the `refresh` method:

```js
    refresh: async function () {
      if (!cardsHandle) return;
      await this._doRefresh();
    },
```

Replace with:

```js
    refresh: async function () {
      if (!cardsHandle) return;
      await this._doRefresh();
    },

    /* True while our own card/prefs writes may still generate watcher
       events — consumed by Shell's receipt-time toast suppression.
       Pending guard entries clear on the next confirming scan (≤5s poll)
       or the 15s TTL; isPrefsWritePending covers roadmap.md prefs writes. */
    isSuppressingToasts: function () {
      return OptimisticGuard.hasPending() || isPrefsWritePending();
    },
```

(`OptimisticGuard` is the `CardWrite.createOptimisticGuard()` instance and `isPrefsWritePending` the function declared earlier in the same IIFE, as landed by PR5 — both already in scope. No other roadmap.js changes: `ctrl.refresh()` → `_doRefresh` is already safe for the watcher path via the `refreshRunning` flag and per-file `guardDecision`.)

- [ ] **Step 2: product-forge.js — `markOwnWrite` threaded ONCE through the write service**

In `app/js/product-forge.js`, find the service wiring as landed by PR5 (immediately after the Module State block):

```js
  var pflGuard = CardWrite.createOptimisticGuard();
  var cardWriter = CardWrite.createCardWriteService({
    store: store,
    getCardsHandle: function () { return cardsHandle; },
    guard: pflGuard
  });
```

Replace with:

```js
  var suppressToastsUntil = 0;
  /* Mark our own writes so the Tauri watcher toast is suppressed.
     2500ms covers the Rust watcher's 500ms debounce plus delivery. */
  function markOwnWrite() { suppressToastsUntil = Date.now() + 2500; }

  var pflGuard = CardWrite.createOptimisticGuard();
  var cardWriter = CardWrite.createCardWriteService({
    store: store,
    getCardsHandle: function () { return cardsHandle; },
    guard: pflGuard,
    onBeforeWrite: markOwnWrite
  });
```

The single `onBeforeWrite` hook covers every migrated write (editModal save, status changes, delete's parent update, create's parent update) — no per-call-site flags on service paths (C4).

- [ ] **Step 3: product-forge.js — inline flags on the still-unmigrated reparent/unparent writers**

`_reparentCard` and `_unparentCard` still write via legacy handles (not migrated by PR5). Insert `markOwnWrite();` immediately ABOVE each of their five `await ForgeUtils.FS.writeFile(...)` call sites:

In `_reparentCard` — three sites:

```js
        if (cardHandle) await ForgeUtils.FS.writeFile(cardHandle, cardContent);
```
```js
          if (oldHandle) await ForgeUtils.FS.writeFile(oldHandle, oldContent);
```
```js
        if (newHandle) await ForgeUtils.FS.writeFile(newHandle, newContent);
```

In `_unparentCard` — two sites:

```js
        if (cardHandle) await ForgeUtils.FS.writeFile(cardHandle, cardContent);
```
```js
          if (oldHandle) await ForgeUtils.FS.writeFile(oldHandle, oldContent);
```

Each becomes, e.g.:

```js
        markOwnWrite();
        if (cardHandle) await ForgeUtils.FS.writeFile(cardHandle, cardContent);
```

Also in `_deleteCard` (as landed by PR5): the card file itself is removed via a direct non-service write, so C4's no-per-call-site-flags rule (which applies only to service-covered paths) is not violated. Insert `markOwnWrite();` immediately ABOVE:

```js
        await ForgeFS.deleteFile(cardsHandle, card.dirName + '/' + filename + '.md');
```

- [ ] **Step 4: product-forge.js — export `isSuppressingToasts` on the controller**

In the `ctrl` object, find:

```js
    async refresh() {
      if (!cardsHandle) return;
      await this._doRefresh();
    },
```

Replace with:

```js
    async refresh() {
      if (!cardsHandle) return;
      await this._doRefresh();
    },

    /* Consumed by Shell's receipt-time toast suppression (cards/ group).
       pflGuard.hasPending() covers New Card, which marks the guard before
       its direct (non-service) write. */
    isSuppressingToasts() {
      return pflGuard.hasPending() || Date.now() < suppressToastsUntil;
    },
```

- [ ] **Step 5: Run the test suite**

Run: `npm test` (from `forge-shell/`)

Expected: PASS — all tests green, including the existing `roadmap.helpers` guardDecision tests and PR5's `card-write` / `status-menu` suites (unchanged by this task)

- [ ] **Step 6: Browser verification (server mode regression)**

Run: `npm run serve` (from `forge-shell/`)

Open `http://127.0.0.1:4173`:
- Roadmap: drag a card to a different period — the reschedule persists, no console errors; open Settings and toggle a pref — saves without errors (`isPrefsWritePending` path untouched).
- Product Forge: edit and save a card via the modal; reparent a story via drag onto another card and confirm — both succeed with their normal success toasts and no console errors.

Suppression itself is only observable under the Tauri watcher — covered in Task 6.6's smoke checklist.

- [ ] **Step 7: Commit**

```bash
git add app/js/roadmap.js app/js/product-forge.js
git commit -m "feat(roadmap,product-forge): own-write toast suppression via guard/service hook"
```

---

### Task 6.6: Full-suite verification + open PR 6

**Files:**
- No file changes — verification and PR only

**Interfaces:**
- Consumes: everything landed in Tasks 6.1–6.5
- Produces: pushed branch + stacked PR 6/9

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from `forge-shell/`)

Expected: everything passing, including the 17 new tests this PR adds (13 in `test/shell.helpers.test.js`, 4 new `fileListSignature` tests in `test/audio-forge.helpers.test.js`)

- [ ] **Step 2: Three-runtime smoke checklist**

Tauri (`npm run tauri:dev` from `forge-shell/`) — watcher rows are Tauri-only:
- [ ] Burst: `for f in <project>/cards/epics/*.md; do touch "$f"; done` (3+ files within ~1s) → exactly ONE toast: `3 files updated in cards/` (count matching), flush ~1.5s after the first event even while events keep arriving.
- [ ] Single external `touch` of one card → toast `File updated: <basename>` (format preserved).
- [ ] Roadmap active + external card edit → Roadmap visibly refreshes (previously dead mapping); Product Forge active + same edit → PF refreshes; the inactive sibling is NOT refreshed.
- [ ] Roadmap drag-reschedule → NO `File updated` toast; console shows `[Shell] N internal change(s) in cards/ — toast suppressed`.
- [ ] Product Forge card save via modal → no toast; tasks inline edit → still no toast (regression); a genuinely external cards/ edit while both views are quiescent DOES toast.
- [ ] Memory: modal save → no toast and no reload on the next 5s poll; external change while the memory edit modal is OPEN does not reload (overlay guard).
- [ ] Audio: start a recording, switch to Tasks, return → recording still live (destroy only cleared the poller; reconcileStatus restores the toolbar); during transcription no poll-driven refresh and no `File updated` toast for the transcript write; after switching away, no further `list_md_files` invocations in Tauri logs.

Chrome FSA (real Chrome tab via `showDirectoryPicker`):
- [ ] Memory + Audio Forge pollers detect an external add/delete within 5s; no exceptions thrown from the recursive `listMarkdownFiles` signature calls (watcher does not exist here).

Server / cmux (`npm run serve` → `http://127.0.0.1:4173`):
- [ ] Watcher no-op — no watcher errors on boot; memory and audio-forge external changes still detected within 5s via their pollers.
- [ ] Click through all 8 views once — no controller init/destroy errors.

- [ ] **Step 3: Push and open the stacked PR**

```bash
git push -u origin ux-program/pr-6-freshness
gh pr create --base main --title "Freshness: batched watcher, multi-plugin cards/ mapping, memory/audio external-change detection, own-write suppression" --body "Batches Tauri watcher events into one summarized toast per data directory (fixed 1.5s window, receipt-time own-write suppression) and maps cards/ to both Product Forge and Roadmap, replacing the dead /roadmap-data/ branch and the legacy TASKS.md token. Memory now detects externally created/deleted files (signature re-lists from disk), gains an honest force-Refresh, and suppresses its own writes; Audio Forge gains the standard 5s poller with destroy() and pipeline-aware suppression. Suppression threads once through PR5's CardWrite service hook and guard.hasPending(); tasks.js is untouched. Stacked PR 6/9 - merge after PR5"
```

Run: the two commands above (from `forge-shell/`)

Expected: branch pushed; PR created against `main` with the stacking note in the body.

---

## PR7 — In-view discovery: Tasks filter-icon rebind + Roadmap text search *(M)*

**Branch:** `ux-program/pr-7-in-view-discovery` (from `ux-program/pr-6-freshness`) — **Contains:** WP4 parts (a) Tasks toolbar rebind (magnifier deleted, `fa-filter` → toggle-search, `fa-table-columns` → field settings, active-state sync, restore-inversion fix) and (b) Roadmap text search (three pure helpers + toolbar affordance + hierarchy-pipeline filter + keyboard). The `bindGlobalKeys` extraction is dropped (C1) — PR3's `bindKeyboard` already owns the tasks keydown lifecycle. — **Depends on:** PR3 (tasks `bindKeyboard`, `ModalHelpers` Escape hierarchy), PR4 (scan-banner scaffold adjacent to the tasks toolbar), PR5/PR6 (roadmap Escape ladder left intact; search rung appends last). WP4 part (c), the Cmd+K palette, is PR8 — nothing palette-related (code or CSS) lands here.

### Task 7.1: Roadmap search helpers — `cardMatchesQuery`, `filterHierarchyBySearch`, `countHierarchyCards` (TDD)

**Files:**
- Modify: `forge-shell/app/js/roadmap.helpers.js`
- Modify: `forge-shell/test/roadmap.helpers.test.js`

**Interfaces:**
- Consumes: the `CardData.buildHierarchy()` shape — `{ tree, orphanEpics, orphanStories, intakes, checkpoints, decisions, releaseNotes }`, where `tree` entries are `{ card, children: [{ card, children: [storyCard] }] }`, `orphanEpics` entries are `{ card, children: [storyCard] }`, and the four flat collections are card arrays. A card is `{ filename, frontmatter, ... }`; `frontmatter.release` is a string or null.
- Produces: `RoadmapHelpers.cardMatchesQuery(card, q) -> boolean` (case-insensitive substring over title/filename/client/module/product/status/release, tolerant of missing frontmatter); `RoadmapHelpers.filterHierarchyBySearch(hierarchy, query) -> hierarchy` (new object; identity when query empty; ancestor-preserving; never mutates input); `RoadmapHelpers.countHierarchyCards(hierarchy) -> number` (tree initiatives+epics+stories, orphan epics + their stories, orphan stories — flat collections excluded).

- [ ] **Step 1: Write failing tests**

Append to the end of `forge-shell/test/roadmap.helpers.test.js` (after the last existing test; the file already opens with `const H = require('../app/js/roadmap.helpers.js');`):

```js
/* ═══════════════════════════════════════════════════════════
   Text search helpers (PR7)
   ═══════════════════════════════════════════════════════════ */

function mkCard(filename, fm) {
  return { filename: filename, frontmatter: fm || {} };
}

function mkHierarchy(overrides) {
  return Object.assign({
    tree: [],
    orphanEpics: [],
    orphanStories: [],
    intakes: [],
    checkpoints: [],
    decisions: [],
    releaseNotes: []
  }, overrides || {});
}

function searchFixture() {
  const story1 = mkCard('story-001-login', { type: 'story', title: 'Login flow' });
  const story2 = mkCard('story-002-billing', { type: 'story', title: 'Billing export' });
  const story3 = mkCard('story-003-audit', { type: 'story', title: 'Audit trail' });
  const epicA = mkCard('epic-auth', { type: 'epic', title: 'Auth Epic' });
  const epicB = mkCard('epic-reports', { type: 'epic', title: 'Reports Epic' });
  const init1 = mkCard('platform-hardening', { type: 'initiative', title: 'Platform Hardening' });
  return mkHierarchy({
    tree: [{
      card: init1,
      children: [
        { card: epicA, children: [story1, story2] },
        { card: epicB, children: [story3] }
      ]
    }],
    orphanEpics: [{
      card: mkCard('epic-orphan', { type: 'epic', title: 'Orphan Epic' }),
      children: [mkCard('story-010-stray', { type: 'story', title: 'Stray child story' })]
    }],
    orphanStories: [mkCard('story-020-standalone', { type: 'story', title: 'Standalone story' })],
    intakes: [mkCard('intake-idea', { type: 'intake', title: 'Raw intake idea' })],
    checkpoints: [mkCard('checkpoint-2026-07-01-review', { type: 'checkpoint', title: 'July review' })],
    decisions: [mkCard('use-tauri', { type: 'decision', title: 'Use Tauri' })],
    releaseNotes: [mkCard('v2-notes', { type: 'release-note', title: 'v2 release notes' })]
  });
}

/* ── cardMatchesQuery ── */

test('cardMatchesQuery: matches on every searchable field', () => {
  assert.equal(H.cardMatchesQuery(mkCard('x', { title: 'Notification Overhaul' }), 'overhaul'), true);
  assert.equal(H.cardMatchesQuery(mkCard('story-001-builder', {}), 'builder'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { client: 'Acme Corp' }), 'acme'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { module: 'Billing' }), 'bill'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { product: 'Platform' }), 'platform'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { status: 'In Progress' }), 'progress'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { release: 'Q3 2026' }), 'q3'), true);
});

test('cardMatchesQuery: case-insensitive in both directions', () => {
  assert.equal(H.cardMatchesQuery(mkCard('x', { title: 'ROADMAP Redesign' }), 'roadmap'), true);
  assert.equal(H.cardMatchesQuery(mkCard('x', { title: 'roadmap redesign' }), 'ROADMAP'), true);
});

test('cardMatchesQuery: missing frontmatter/fields never throws, returns false', () => {
  assert.equal(H.cardMatchesQuery({ filename: 'x' }, 'y'), false);
  assert.equal(H.cardMatchesQuery(mkCard('x', { title: null, release: null }), 'y'), false);
  assert.equal(H.cardMatchesQuery(null, 'y'), false);
  assert.equal(H.cardMatchesQuery(mkCard('x', { title: 'A' }), ''), false);
});

test('cardMatchesQuery: non-matching query returns false', () => {
  assert.equal(H.cardMatchesQuery(mkCard('story-001', { title: 'Alpha', status: 'Idea' }), 'zeta'), false);
});

/* ── filterHierarchyBySearch ── */

test('filterHierarchyBySearch: empty or whitespace query returns the same object (identity)', () => {
  const h = searchFixture();
  assert.equal(H.filterHierarchyBySearch(h, ''), h);
  assert.equal(H.filterHierarchyBySearch(h, '   '), h);
  assert.equal(H.filterHierarchyBySearch(h, null), h);
});

test('filterHierarchyBySearch: initiative match keeps the whole subtree', () => {
  const out = H.filterHierarchyBySearch(searchFixture(), 'hardening');
  assert.equal(out.tree.length, 1);
  assert.equal(out.tree[0].children.length, 2);
  assert.equal(out.tree[0].children[0].children.length, 2);
  assert.equal(out.tree[0].children[1].children.length, 1);
});

test('filterHierarchyBySearch: story match keeps initiative+epic, prunes non-matching siblings', () => {
  const out = H.filterHierarchyBySearch(searchFixture(), 'billing');
  assert.equal(out.tree.length, 1);
  assert.equal(out.tree[0].card.filename, 'platform-hardening');
  assert.equal(out.tree[0].children.length, 1);
  assert.equal(out.tree[0].children[0].card.filename, 'epic-auth');
  assert.equal(out.tree[0].children[0].children.length, 1);
  assert.equal(out.tree[0].children[0].children[0].filename, 'story-002-billing');
});

test('filterHierarchyBySearch: epic match keeps all of its stories', () => {
  const out = H.filterHierarchyBySearch(searchFixture(), 'reports epic');
  assert.equal(out.tree.length, 1);
  assert.equal(out.tree[0].children.length, 1);
  assert.equal(out.tree[0].children[0].card.filename, 'epic-reports');
  assert.equal(out.tree[0].children[0].children.length, 1);
  assert.equal(out.tree[0].children[0].children[0].filename, 'story-003-audit');
});

test('filterHierarchyBySearch: orphan epics get epic-level logic', () => {
  /* epic title match → children kept whole */
  let out = H.filterHierarchyBySearch(searchFixture(), 'orphan epic');
  assert.equal(out.orphanEpics.length, 1);
  assert.equal(out.orphanEpics[0].children.length, 1);
  /* story-only match → epic kept, children pruned to the match */
  out = H.filterHierarchyBySearch(searchFixture(), 'stray');
  assert.equal(out.orphanEpics.length, 1);
  assert.equal(out.orphanEpics[0].children.length, 1);
  assert.equal(out.orphanEpics[0].children[0].filename, 'story-010-stray');
  /* no match in the orphan subtree → orphan epic dropped */
  out = H.filterHierarchyBySearch(searchFixture(), 'billing');
  assert.equal(out.orphanEpics.length, 0);
});

test('filterHierarchyBySearch: flat collections filtered directly', () => {
  let out = H.filterHierarchyBySearch(searchFixture(), 'standalone');
  assert.equal(out.orphanStories.length, 1);
  assert.equal(out.tree.length, 0);
  out = H.filterHierarchyBySearch(searchFixture(), 'intake');
  assert.equal(out.intakes.length, 1);
  out = H.filterHierarchyBySearch(searchFixture(), 'july');
  assert.equal(out.checkpoints.length, 1);
  out = H.filterHierarchyBySearch(searchFixture(), 'tauri');
  assert.equal(out.decisions.length, 1);
  out = H.filterHierarchyBySearch(searchFixture(), 'v2');
  assert.equal(out.releaseNotes.length, 1);
});

test('filterHierarchyBySearch: never mutates the input hierarchy', () => {
  const h = searchFixture();
  const before = JSON.stringify(h);
  H.filterHierarchyBySearch(h, 'billing');
  H.filterHierarchyBySearch(h, 'orphan epic');
  assert.equal(JSON.stringify(h), before);
});

test('filterHierarchyBySearch: no match anywhere returns empty collections', () => {
  const out = H.filterHierarchyBySearch(searchFixture(), 'zzz-nothing');
  assert.equal(out.tree.length, 0);
  assert.equal(out.orphanEpics.length, 0);
  assert.equal(out.orphanStories.length, 0);
  assert.equal(out.intakes.length, 0);
  assert.equal(out.checkpoints.length, 0);
  assert.equal(out.decisions.length, 0);
  assert.equal(out.releaseNotes.length, 0);
});

/* ── countHierarchyCards ── */

test('countHierarchyCards: counts tree initiatives + epics + stories', () => {
  const h = mkHierarchy({ tree: searchFixture().tree });
  /* 1 initiative + 2 epics + 3 stories */
  assert.equal(H.countHierarchyCards(h), 6);
});

test('countHierarchyCards: includes orphan epics (+ stories) and orphan stories, not flat collections', () => {
  /* full fixture: 6 (tree) + 2 (orphan epic + its story) + 1 (orphan story) = 9 */
  assert.equal(H.countHierarchyCards(searchFixture()), 9);
});

test('countHierarchyCards: empty hierarchy counts zero', () => {
  assert.equal(H.countHierarchyCards(mkHierarchy()), 0);
  assert.equal(H.countHierarchyCards(null), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/roadmap.helpers.test.js` (from `forge-shell/`)

Expected: FAIL — 15 new tests fail with `TypeError: H.cardMatchesQuery is not a function` / `H.filterHierarchyBySearch is not a function` / `H.countHierarchyCards is not a function`; the 26 pre-existing tests still pass.

- [ ] **Step 3: Implement the three helpers**

In `forge-shell/app/js/roadmap.helpers.js`, insert the following immediately after the `cardRelativePath` function (the last function before the `return {` export block):

```js
  /* ═══ Text search (PR7) ═══ */

  /** Case-insensitive substring match over a card's searchable fields. */
  function cardMatchesQuery(card, q) {
    if (!card || !q) return false;
    var needle = String(q).toLowerCase();
    var fm = card.frontmatter || {};
    var fields = [fm.title, card.filename, fm.client, fm.module, fm.product, fm.status, fm.release];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] == null) continue;
      if (String(fields[i]).toLowerCase().indexOf(needle) !== -1) return true;
    }
    return false;
  }

  /**
   * Filter a CardData.buildHierarchy() result by text query.
   * Ancestor-preserving: a story match keeps its initiative + epic visible;
   * an initiative or epic match keeps its whole subtree. Returns the input
   * object untouched for an empty/whitespace query; otherwise a NEW
   * hierarchy — input nodes and arrays are never mutated.
   */
  function filterHierarchyBySearch(hierarchy, query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return hierarchy;

    function epicNodeMatch(en) {
      if (cardMatchesQuery(en.card, q)) return { card: en.card, children: en.children.slice() };
      var kids = en.children.filter(function (s) { return cardMatchesQuery(s, q); });
      return kids.length ? { card: en.card, children: kids } : null;
    }

    var tree = hierarchy.tree.map(function (n) {
      if (cardMatchesQuery(n.card, q)) return n; /* keep whole subtree */
      var epics = n.children.map(epicNodeMatch).filter(Boolean);
      return epics.length ? { card: n.card, children: epics } : null;
    }).filter(Boolean);

    function matches(c) { return cardMatchesQuery(c, q); }

    return {
      tree: tree,
      orphanEpics: hierarchy.orphanEpics.map(epicNodeMatch).filter(Boolean),
      orphanStories: hierarchy.orphanStories.filter(matches),
      intakes: hierarchy.intakes.filter(matches),
      checkpoints: hierarchy.checkpoints.filter(matches),
      decisions: hierarchy.decisions.filter(matches),
      releaseNotes: hierarchy.releaseNotes.filter(matches)
    };
  }

  /**
   * Total initiative+epic+story cards across tree, orphan epics
   * (nodes + their stories), and orphan stories — the match counter.
   */
  function countHierarchyCards(hierarchy) {
    if (!hierarchy) return 0;
    var count = 0;
    (hierarchy.tree || []).forEach(function (n) {
      count += 1; /* initiative */
      (n.children || []).forEach(function (en) {
        count += 1 + ((en.children || []).length);
      });
    });
    (hierarchy.orphanEpics || []).forEach(function (en) {
      count += 1 + ((en.children || []).length);
    });
    count += (hierarchy.orphanStories || []).length;
    return count;
  }
```

Then extend the export block at the bottom of the file — replace:

```js
  return {
    nameEqualsRelease: nameEqualsRelease,
    clearReleaseFm: clearReleaseFm,
    releaseOverlapsPeriod: releaseOverlapsPeriod,
    releasesOverlappingPeriod: releasesOverlappingPeriod,
    resolveDropToRelease: resolveDropToRelease,
    periodLabelsForRelease: periodLabelsForRelease,
    guardDecision: guardDecision,
    cardRelativePath: cardRelativePath
  };
```

with:

```js
  return {
    nameEqualsRelease: nameEqualsRelease,
    clearReleaseFm: clearReleaseFm,
    releaseOverlapsPeriod: releaseOverlapsPeriod,
    releasesOverlappingPeriod: releasesOverlappingPeriod,
    resolveDropToRelease: resolveDropToRelease,
    periodLabelsForRelease: periodLabelsForRelease,
    guardDecision: guardDecision,
    cardRelativePath: cardRelativePath,
    cardMatchesQuery: cardMatchesQuery,
    filterHierarchyBySearch: filterHierarchyBySearch,
    countHierarchyCards: countHierarchyCards
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/roadmap.helpers.test.js` (from `forge-shell/`)

Expected: PASS — 41 tests (26 existing + 15 new), 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/js/roadmap.helpers.js test/roadmap.helpers.test.js
git commit -m "feat(roadmap): add text-search helpers to RoadmapHelpers (TDD)"
```

Run: the two commands above (from `forge-shell/`)

Expected: clean commit on `ux-program/pr-7-in-view-discovery`.

---

### Task 7.2: Tasks toolbar — filter-icon rebind, honest field-settings icon, active-state sync, idempotent restore

**Files:**
- Modify: `forge-shell/app/js/tasks.js`

**Interfaces:**
- Consumes: PR3's `bindKeyboard()` (Cmd/Ctrl+F → `toggleSearchStrip()`, Escape via `ModalHelpers.tasksEscapeTarget` — **do not touch it**; per C1 there is no `bindGlobalKeys` extraction in this PR); the existing `bindToolbarEvents` dispatch entries `'toggle-search' → toggleSearchStrip()` and `'field-settings' → openSettingsPanel()` (**zero dispatch changes**); the cross-plugin `.plugin-toolbar .btn-icon.rm-active` rule in `roadmap.css` (same active pattern hide-done already uses).
- Produces: no new APIs — HTML-string and two small logic edits only.

- [ ] **Step 1: Rebind the toolbar icons (HTML-string-only diff)**

In `scaffold()`'s toolbar right cluster (as landed by PR4, the line immediately after this cluster's closing `'</div>' +` is the scan-banner div — leave it and everything below untouched), replace:

```js
          '<button class="btn-icon" data-action="toggle-search" title="Search (Cmd+F)"><i class="fa-solid fa-magnifying-glass"></i></button>' +
          '<button class="btn-icon" data-action="view-edit-mode" title="Customize Views"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon" data-action="field-settings" title="Filter Fields"><i class="fa-solid fa-filter"></i></button>' +
```

with:

```js
          '<button class="btn-icon" data-action="toggle-search" title="Filter (Cmd+F)"><i class="fa-solid fa-filter"></i></button>' +
          '<button class="btn-icon" data-action="view-edit-mode" title="Customize Views"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon" data-action="field-settings" title="Card Fields"><i class="fa-solid fa-table-columns"></i></button>' +
```

This deletes the magnifier (the `fa-filter` button takes over its existing `toggle-search` action) and gives field settings an honest columns icon. Final right-cluster order: refresh-indicator, toggle-search (`fa-filter`), view-edit-mode (`fa-pen`), field-settings (`fa-table-columns`), hide-done, refresh. Note: `fa-table-columns` also appears on the Board view tab in the left cluster — accepted (different cluster; `fa-sliders` is the drop-in alternative if a reviewer objects).

- [ ] **Step 2: Sync the toggle button's active state**

In `toggleSearchStrip()`, replace:

```js
    strip.classList.toggle('prod-strip-open', searchOpen);
```

with:

```js
    strip.classList.toggle('prod-strip-open', searchOpen);
    var toggleBtn = $('[data-action="toggle-search"]');
    if (toggleBtn) toggleBtn.classList.toggle('rm-active', searchOpen);
```

Same pattern as the hide-done button (`btn.classList.toggle('rm-active', hideDone)`); no new CSS — `.plugin-toolbar .btn-icon.rm-active` in `roadmap.css` is unscoped and already styles tasks toolbar buttons. (Promoting `rm-active` to `components.css` is a noted follow-up, **not** in this PR.)

- [ ] **Step 3: Fix the restore inversion**

In `init()` (as landed by PR3/PR4 — the block sits after `startTaskWatching()`), replace:

```js
      /* Restore search strip open/closed state */
      try {
        var storedSearch = localStorage.getItem('forge-shell-tasks-search-open');
        if (storedSearch === '1') toggleSearchStrip();
      } catch (ignore) { /* ignore */ }
```

with:

```js
      /* Restore search strip open/closed state (idempotent: state + DOM
         survive the scaffold-once guard, so only toggle on mismatch) */
      try {
        var storedSearch = localStorage.getItem('forge-shell-tasks-search-open');
        var shouldOpen = storedSearch === '1';
        if (shouldOpen !== searchOpen) toggleSearchStrip();
      } catch (ignore) { /* ignore */ }
```

Previously, returning to the view with the strip open called `toggleSearchStrip()` again and inverted it closed. The mismatch guard also syncs the new button active state on restore.

- [ ] **Step 4: Browser verification**

Run: `npm run serve` (from `forge-shell/`), then open `http://127.0.0.1:4173` and select a project folder containing `tasks/` (typed-path dialog in server mode).

Expected, in the Tasks view:
- The magnifier button is gone; the `fa-filter` button (title "Filter (Cmd+F)") toggles the filter strip and shows the accent `rm-active` state while open.
- The `fa-table-columns` button (title "Card Fields") still opens the "Field Visibility Settings" modal; saving works unchanged.
- Cmd/Ctrl+F toggles the strip; Escape with the strip open clears filters and closes it, exactly as before (no dispatch or `bindKeyboard` changes were made).
- Open the strip, switch to Roadmap, switch back to Tasks: the strip is still open (not inverted) and the filter button still shows the active state; Cmd+F still works after the round-trip.
- Reload the page with the strip open: it restores open.

- [ ] **Step 5: Commit**

```bash
git add app/js/tasks.js
git commit -m "feat(tasks): rebind fa-filter to the filter strip, honest Card Fields icon, idempotent strip restore"
```

Run: the two commands above (from `forge-shell/`)

Expected: clean commit.

---

### Task 7.3: Roadmap search state, toolbar affordance (expanding input), and CSS

**Files:**
- Modify: `forge-shell/app/js/roadmap.js`
- Modify: `forge-shell/app/css/roadmap.css`

**Interfaces:**
- Consumes: existing `$q` helper, `RH` alias (`var RH = typeof RoadmapHelpers !== 'undefined' ? RoadmapHelpers : {};`), the `.plugin-toolbar .btn-icon.rm-active` rule (roadmap.css).
- Produces: module vars `searchQuery` / `searchOpen` / `searchDebounceTimer` (ephemeral — **never** written to `roadmap.md`; `_applyToolbarPrefsToConfig` and the prefs save payload are untouched); ctrl methods `_toggleSearch(forceOpen)`, `_onSearchInput(value)`, `_updateSearchCount(hierarchy)`; toolbar cluster `[data-rm-search]` with toggle / input / count.

- [ ] **Step 1: Add module state**

In the module State block, replace:

```js
  var selectedFilename = null;  /* drawer selection */
  var drawerOpen = false;
```

with:

```js
  var selectedFilename = null;  /* drawer selection */
  var drawerOpen = false;
  /* Text search (PR7) — ephemeral; never persisted to roadmap.md */
  var searchQuery = '';
  var searchOpen = false;
  var searchDebounceTimer = null;
```

- [ ] **Step 2: Reset search state in `destroy()`**

In `destroy()`, replace the tail:

```js
      prefsSaveInFlight = false;
      store.clear();
      cardsHandle = null;
      rmConfig = null;
      dragOccurred = false;
    },
```

with:

```js
      prefsSaveInFlight = false;
      store.clear();
      cardsHandle = null;
      rmConfig = null;
      dragOccurred = false;
      searchQuery = '';
      searchOpen = false;
      if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
    },
```

- [ ] **Step 3: Insert the search cluster into the toolbar HTML**

In `_renderLayout`, replace:

```js
            '<div class="spacer"></div>' +

            /* Year nav */
            '<div class="rm-year-nav">' +
```

with:

```js
            '<div class="spacer"></div>' +

            /* Text search (PR7) */
            '<div class="rm-search" data-rm-search>' +
              '<button class="btn-icon" data-rm-search-toggle title="Search (Cmd+F)"><i class="fa-solid fa-magnifying-glass"></i></button>' +
              '<input type="text" data-rm-search-input placeholder="Search roadmap…" aria-label="Search roadmap">' +
              '<span class="rm-search-count" data-rm-search-count role="status"></span>' +
            '</div>' +

            /* Year nav */
            '<div class="rm-year-nav">' +
```

- [ ] **Step 4: Add the three controller methods**

In the ctrl object, insert after the full `_updateFilterBadge` method (i.e. between its closing `},` and the `// Uses the shared CardData.scanCardsDir() helper for consistency with` comment above `async _loadCards()`):

```js
    /* ── Text search (PR7) ── */
    _toggleSearch: function (forceOpen) {
      var next = (typeof forceOpen === 'boolean') ? forceOpen : !searchOpen;
      var wrap = $q('[data-rm-search]');
      var btn = $q('[data-rm-search-toggle]');
      var input = $q('[data-rm-search-input]');
      searchOpen = next;
      if (wrap) wrap.classList.toggle('rm-open', next);
      if (btn) btn.classList.toggle('rm-active', next);
      if (next) {
        if (input) setTimeout(function () { input.focus(); }, 50);
      } else {
        if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
        if (input) { input.value = ''; input.blur(); }
        if (searchQuery) { searchQuery = ''; this._renderView(); }
        else this._updateSearchCount(null);
      }
    },

    _onSearchInput: function (value) {
      var self = this;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function () {
        searchDebounceTimer = null;
        searchQuery = (value || '').trim();
        self._renderView();
      }, 150);
    },

    _updateSearchCount: function (hierarchy) {
      var count = $q('[data-rm-search-count]');
      if (!count) return;
      if (searchQuery && hierarchy) {
        count.textContent = RH.countHierarchyCards(hierarchy) + ' matches';
      } else {
        count.textContent = '';
      }
    },
```

- [ ] **Step 5: Wire the toggle click in `_bindToolbar`**

In `_bindToolbar`, replace the year-nav "next" wiring:

```js
      if (nextBtn) nextBtn.addEventListener('click', function () {
        currentYear++;
        self._updateYearLabel();
        self._renderView();
        self.schedulePrefsSave();
      });
```

with:

```js
      if (nextBtn) nextBtn.addEventListener('click', function () {
        currentYear++;
        self._updateYearLabel();
        self._renderView();
        self.schedulePrefsSave();
      });

      /* Text search (PR7) */
      var searchToggleBtn = $q('[data-rm-search-toggle]');
      if (searchToggleBtn) searchToggleBtn.addEventListener('click', function () {
        self._toggleSearch();
      });
```

- [ ] **Step 6: Add the search CSS**

In `forge-shell/app/css/roadmap.css`, in the "Roadmap-specific toolbar additions" section, replace:

```css
.plugin-toolbar .btn-icon.rm-active {
  background: var(--accent);
  color: #fff;
}
```

with:

```css
.plugin-toolbar .btn-icon.rm-active {
  background: var(--accent);
  color: #fff;
}

.plugin-toolbar .rm-search {
  display: flex;
  align-items: center;
  gap: 6px;
}
.plugin-toolbar .rm-search input {
  display: none;
  width: 0;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  transition: width .15s ease;
}
.plugin-toolbar .rm-search.rm-open input {
  display: block;
  width: 200px;
}
.plugin-toolbar .rm-search-count {
  display: none;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.plugin-toolbar .rm-search.rm-open .rm-search-count {
  display: inline;
}
```

(Token names verified against `theme.css`: `--border-color`, `--bg-card`, `--text-primary`, `--text-muted` exist in both light and dark themes. The toggle button's active state reuses the existing `.plugin-toolbar .btn-icon.rm-active` rule above — kept in `roadmap.css`; promotion to `components.css` is a noted follow-up outside this PR.)

- [ ] **Step 7: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, select a project with `cards/`, open Roadmap.

Expected:
- A magnifier toggle sits between the toolbar spacer and the year nav.
- Clicking it expands a 200px input (focused) and the toggle shows the accent active state; clicking again collapses and clears it. Typing does nothing yet (wired in Task 7.4).
- No console errors.

- [ ] **Step 8: Commit**

```bash
git add app/js/roadmap.js app/css/roadmap.css
git commit -m "feat(roadmap): toolbar search affordance with expanding input"
```

Run: the two commands above (from `forge-shell/`)

Expected: clean commit.

---

### Task 7.4: Wire search into the hierarchy render pipeline + live match count

**Files:**
- Modify: `forge-shell/app/js/roadmap.js`

**Interfaces:**
- Consumes: `RH.filterHierarchyBySearch(hierarchy, query)` and `RH.countHierarchyCards(hierarchy)` from Task 7.1; the single `_renderView` hierarchy pipeline (`CardData.buildHierarchy` → `FilterPanel.filterHierarchy` → CardView/TimelineView/TableView, events rebound per mode).
- Produces: search results that AND with FilterPanel selections and cover all three view modes from one insertion point; live "N matches" counter.

- [ ] **Step 1: Filter the hierarchy in `_renderView`**

In `_renderView` (region intact through PR5/PR6 — only status-write internals changed), replace:

```js
      var hierarchy = CardData.buildHierarchy(store);
      hierarchy = FilterPanel.filterHierarchy(hierarchy);
```

with:

```js
      var hierarchy = CardData.buildHierarchy(store);
      hierarchy = FilterPanel.filterHierarchy(hierarchy);
      hierarchy = RH.filterHierarchyBySearch(hierarchy, searchQuery);
```

Because all three modes render from this hierarchy and rebind their events after each render, card/timeline/table filtering plus DnD, inline status, and drawer interactivity need no further changes (drop targets are period columns, unaffected by filtering).

- [ ] **Step 2: Update the match count at the end of `_renderView`**

Replace:

```js
      this._updateRefreshIndicator();
      this._updateFilterBadge();
    },
```

with:

```js
      this._updateRefreshIndicator();
      this._updateFilterBadge();
      this._updateSearchCount(hierarchy);
    },
```

- [ ] **Step 3: Wire the input event in `_bindToolbar`**

Replace the block added in Task 7.3:

```js
      /* Text search (PR7) */
      var searchToggleBtn = $q('[data-rm-search-toggle]');
      if (searchToggleBtn) searchToggleBtn.addEventListener('click', function () {
        self._toggleSearch();
      });
```

with:

```js
      /* Text search (PR7) */
      var searchToggleBtn = $q('[data-rm-search-toggle]');
      if (searchToggleBtn) searchToggleBtn.addEventListener('click', function () {
        self._toggleSearch();
      });
      var searchInput = $q('[data-rm-search-input]');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          self._onSearchInput(searchInput.value);
        });
      }
```

- [ ] **Step 4: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, Roadmap view, project with seeded initiative/epic/story cards.

Expected:
- Open search and type a story's title: within ~150ms the card view prunes to that story with its initiative and epic still visible; non-matching sibling epics/stories disappear; the count reads "N matches".
- Switch to Timeline and Table with the query active: the same subset renders in both.
- Open the FilterPanel and add a client filter: results are the intersection (search ANDs with FilterPanel); the filter badge and match count both update.
- Clear the query (select-all + delete): the full view returns and the count clears.
- Drag a filtered story card to another period column: the drop works; a card whose status/schedule changes while search is active may filter out of view — **accepted behavior**.
- Searching never writes to `roadmap.md`: run `git diff --stat` in the project folder afterward — no change.

- [ ] **Step 5: Commit**

```bash
git add app/js/roadmap.js
git commit -m "feat(roadmap): text search filters card/timeline/table via the hierarchy pipeline"
```

Run: the two commands above (from `forge-shell/`)

Expected: clean commit.

---

### Task 7.5: Keyboard — Cmd/Ctrl+F, two-stage Escape in the input, lowest-priority ladder rung

**Files:**
- Modify: `forge-shell/app/js/roadmap.js`

**Interfaces:**
- Consumes: the existing `_bindKeyboard` document-level Escape ladder (menu → quick-assign → picker → modal → drawer → filter), in place as left intact by PR5's verbatim ports — **append only, never reorder**.
- Produces: view-active guard on the roadmap handler (mirrors tasks.js); Cmd/Ctrl+F opens + focuses search; input-level Escape (first press clears query keeping focus, second collapses) that never double-fires the global ladder; one new lowest-priority ladder rung.

- [ ] **Step 1: Add the view-active guard and Cmd+F branch to `_bindKeyboard`**

In `_bindKeyboard`, replace the handler head:

```js
      keydownHandler = function (e) {
        if (e.key === 'Escape') {
          /* Escape hierarchy: menu → qa → picker → modal → drawer → filter */
```

with:

```js
      keydownHandler = function (e) {
        /* Only act while the roadmap view is active (mirrors tasks.js) */
        var v = document.getElementById('view-roadmap');
        if (!v || !v.classList.contains('active')) return;

        /* Cmd/Ctrl+F opens + focuses search (PR7) */
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault();
          self._toggleSearch(true);
          return;
        }

        if (e.key === 'Escape') {
          /* Escape hierarchy: menu → qa → picker → modal → drawer → filter → search */
```

(Note: Cmd+F now shadows native browser find while the roadmap view is active — matches existing Tasks behavior.)

- [ ] **Step 2: Append the lowest-priority search rung**

Still in `_bindKeyboard`, replace the final FilterPanel branch:

```js
          if (FilterPanel.open) {
            FilterPanel.open = false;
            var panel = $q('[data-rm-filter-panel]');
            if (panel) panel.classList.remove('rm-open');
            return;
          }
        }
```

with:

```js
          if (FilterPanel.open) {
            FilterPanel.open = false;
            var panel = $q('[data-rm-filter-panel]');
            if (panel) panel.classList.remove('rm-open');
            return;
          }
          /* Lowest-priority rung: dismiss search last (PR7) */
          if (searchOpen || searchQuery) {
            self._toggleSearch(false);
            return;
          }
        }
```

The existing order (status menu → quick-assign → release picker → config modal → drawer → filter panel) is untouched; search dismisses only when nothing above it is open.

- [ ] **Step 3: Two-stage Escape inside the input**

In `_bindToolbar`, replace the input wiring from Task 7.4:

```js
      var searchInput = $q('[data-rm-search-input]');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          self._onSearchInput(searchInput.value);
        });
      }
```

with:

```js
      var searchInput = $q('[data-rm-search-input]');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          self._onSearchInput(searchInput.value);
        });
        searchInput.addEventListener('keydown', function (e) {
          if (e.key !== 'Escape') return;
          /* Own the key: the global ladder must not double-fire */
          e.stopPropagation();
          if (searchInput.value) {
            /* First press clears the query, keeps focus */
            searchInput.value = '';
            if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
            if (searchQuery) { searchQuery = ''; self._renderView(); }
            else self._updateSearchCount(null);
            searchInput.focus();
          } else {
            /* Second press collapses the box */
            self._toggleSearch(false);
          }
        });
      }
```

(Two Escape presses to fully dismiss a search containing text is intentional command-bar UX — call it out in the PR description.)

- [ ] **Step 4: Browser verification**

Run: `npm run serve` (from `forge-shell/`), open `http://127.0.0.1:4173`, Roadmap view.

Expected:
- Cmd/Ctrl+F (roadmap view active) expands and focuses the search input; pressing it again while open just re-focuses.
- Type a query → Escape once: query clears, results restore, input stays open and focused; Escape again: box collapses, toggle active state clears.
- Full ladder with search open underneath: open a card's status menu → Escape closes only the menu; open the drawer → Escape closes only the drawer; open the filter panel → Escape closes only the panel; only then does Escape dismiss search.
- Switch to Tasks and back to Roadmap: Cmd+F still works (handler is rebound in `init` → `_bindKeyboard`); search state was reset by `destroy()` (search is ephemeral).
- Cmd+F while the Tasks view is active still toggles the tasks strip only (each handler has its own view-active guard).

- [ ] **Step 5: Commit**

```bash
git add app/js/roadmap.js
git commit -m "feat(roadmap): Cmd+F opens search; Escape clears then collapses; lowest-priority ladder rung"
```

Run: the two commands above (from `forge-shell/`)

Expected: clean commit.

---

### Task 7.6: Full-suite verification + open PR 7

**Files:**
- None (verification + PR only).

**Interfaces:**
- Consumes: everything landed in Tasks 7.1–7.5, on top of the merged PR1–PR6 stack.
- Produces: PR 7 of 9.

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from `forge-shell/`)

Expected: everything passing, including the 15 new tests this PR adds to `test/roadmap.helpers.test.js` (the suite grows through the stack — all suites from PRs 1–6 must be green too). No suite skipped, 0 failures.

- [ ] **Step 2: Three-runtime smoke checklist**

| Check | Tauri (`npm run tauri:dev`) | Chrome FSA (`npm run serve` → real Chrome tab, native picker) | server/cmux (`node server.js`, typed-path dialog) |
|---|---|---|---|
| Boot with no console errors; project with all data dirs and project with none | ✓ | ✓ | ✓ |
| Tasks: fa-filter toggles strip w/ active state; magnifier gone; fa-table-columns opens Field Visibility modal | ✓ | ✓ | ✓ |
| Tasks: Cmd+F + Escape semantics; strip state survives reload and plugin round-trips without inverting | ✓ | ✓ | ✓ |
| Roadmap: search filters card/timeline/table within 150ms; "N matches" count; ANDs with FilterPanel; ancestor-preserving | ✓ | ✓ | ✓ |
| Roadmap: Cmd+F, two-stage input Escape, ladder order unchanged with search last | ✓ | ✓ | ✓ |
| Roadmap: DnD / inline status / drawer / bucket toggles work on filtered renders | ✓ | ✓ | ✓ |
| Roadmap: `git diff` in the project shows `roadmap.md` unchanged after searching + reload (search not persisted) | ✓ | ✓ | ✓ |
| External card-file edit while a query is active → watcher refresh re-applies the filter | ✓ (watcher = Tauri-only) | n/a (poller/manual refresh) | n/a (poller/manual refresh) |

- [ ] **Step 3: Push the branch**

Run: `git push -u origin ux-program/pr-7-in-view-discovery` (from `forge-shell/`)

Expected: branch published, tracking set.

- [ ] **Step 4: Open the PR**

Run:

```bash
gh pr create --base main --title "In-view discovery: Tasks filter-icon rebind + Roadmap text search" --body "Rebinds the Tasks fa-filter icon to actually toggle the filter strip (magnifier removed, field settings gets an honest fa-table-columns icon), syncs its active state, and fixes the strip-restore inversion. Adds ephemeral text search to Roadmap that filters card/timeline/table through the shared hierarchy pipeline (ancestor-preserving, ANDs with FilterPanel), with Cmd+F, a live match count, two-stage Escape in the input, and one new lowest-priority Escape-ladder rung. 15 new node --test cases on RoadmapHelpers; search is never written to roadmap.md. Stacked PR 7/9 - merge after PR6"
```

Expected: PR created against `main`, titled as above, body ending with the stacking note.

---

## PR8 — Global Cmd+K palette: fuzzy search across all plugin entities *(M)*

**Branch:** `ux-program/pr-8-command-palette` (from `ux-program/pr-7-in-view-discovery`) — **Contains:** WP4 part (c) only (parts a/b landed in PR7): a shell-chrome Cmd/Ctrl+K palette that fuzzy-searches `*.md` entities across all seven plugin data dirs, at z-index **1250** (C10), plus two one-line `shell.js` hooks that invalidate the palette index at watcher-receipt time and on project switch (C9). — **Depends on:** PR6's rewritten batch/flush `_onFileChanged` (the receipt-time hook target) and PR3's capture-phase Confirm keydown (Confirm keys beat the palette by construction). Deep-linking is limited to `product-forge-local` `selectCard`; every other entry plain-switches views. Empty query shows a "Type to search" hint (MRU recents are follow-up).

### Task 8.1: Ranking helpers — `fuzzyScore` + `rankEntries` (TDD)

**Files:**
- Create: `forge-shell/app/js/shell-palette.helpers.js`
- Create: `forge-shell/test/shell-palette.helpers.test.js`

**Interfaces:**
- Produces: `ShellPaletteHelpers.fuzzyScore(query, text) → number` (-1 = no match; contiguous substrings outrank in-order subsequences; earlier and word-boundary starts score higher); `ShellPaletteHelpers.rankEntries(query, entries, limit=20) → entries` (scores `max(title×2, filename)`, drops misses, sorts score desc with title tie-break).

- [ ] **Step 1: Write the failing tests**

Create `forge-shell/test/shell-palette.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/shell-palette.helpers.js');

/* ── fuzzyScore ── */

test('fuzzyScore: contiguous substring outranks in-order subsequence', () => {
  const substring = H.fuzzyScore('card', 'discard-pile'); // 'card' contiguous at index 3
  const subsequence = H.fuzzyScore('card', 'c-a-r-d');    // chars in order, not adjacent
  assert.ok(substring > 0);
  assert.ok(subsequence > 0);
  assert.ok(substring > subsequence);
});

test('fuzzyScore: earlier substring start outranks later start', () => {
  const atStart = H.fuzzyScore('task', 'task-001');
  const later = H.fuzzyScore('task', 'my-task-001');
  assert.ok(atStart > later);
});

test('fuzzyScore: word-boundary start outranks earlier mid-word start', () => {
  const boundary = H.fuzzyScore('road', 'my-roadmap'); // starts after '-'
  const midWord = H.fuzzyScore('road', 'abroad');      // earlier index, mid-word
  assert.ok(boundary > midWord);
});

test('fuzzyScore: -1 when characters are not present in order', () => {
  assert.equal(H.fuzzyScore('xyz', 'card'), -1);
  assert.equal(H.fuzzyScore('drac', 'card'), -1); // right chars, wrong order
});

test('fuzzyScore: -1 on empty/missing query or text', () => {
  assert.equal(H.fuzzyScore('', 'card'), -1);
  assert.equal(H.fuzzyScore('card', ''), -1);
  assert.equal(H.fuzzyScore(null, 'card'), -1);
  assert.equal(H.fuzzyScore('card', null), -1);
});

test('fuzzyScore: case-insensitive', () => {
  assert.ok(H.fuzzyScore('CARD', 'Card-Data') > 0);
  assert.equal(H.fuzzyScore('CARD', 'Card-Data'), H.fuzzyScore('card', 'card-data'));
});

/* ── rankEntries ── */

function entry(title, filename) {
  return { title, filename, type: 't', plugin: 'p', subtitle: 's' };
}

test('rankEntries: respects default limit 20 and explicit limit', () => {
  const entries = [];
  for (let i = 1; i <= 25; i++) entries.push(entry('match ' + String(i).padStart(2, '0'), 'm' + i + '.md'));
  assert.equal(H.rankEntries('match', entries).length, 20);
  assert.equal(H.rankEntries('match', entries, 5).length, 5);
});

test('rankEntries: title match (weighted 2x) outranks equal filename match', () => {
  const byTitle = entry('Notification Overhaul', 'zzz.md');
  const byFilename = entry('Zzz', 'notification-overhaul.md');
  const ranked = H.rankEntries('notification', [byFilename, byTitle]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0], byTitle);
});

test('rankEntries: entries with no match are excluded', () => {
  const ranked = H.rankEntries('zebra', [entry('apples', 'apples.md'), entry('zebra plan', 'z.md')]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'zebra plan');
});

test('rankEntries: deterministic tie-break by title ascending', () => {
  const b = entry('entry b', 'b.md');
  const a = entry('entry a', 'a.md');
  const ranked = H.rankEntries('entry', [b, a]);
  assert.deepEqual(ranked.map(e => e.title), ['entry a', 'entry b']);
});

test('rankEntries: empty/whitespace query returns []', () => {
  assert.deepEqual(H.rankEntries('', [entry('a', 'a.md')]), []);
  assert.deepEqual(H.rankEntries('   ', [entry('a', 'a.md')]), []);
});

test('rankEntries: missing title/filename fields never throw, entry dropped', () => {
  const ranked = H.rankEntries('x', [{ title: null, filename: undefined }, entry('x-ray', 'x.md')]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, 'x-ray');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/shell-palette.helpers.test.js` (from `forge-shell/`)
Expected: FAIL — `Cannot find module '../app/js/shell-palette.helpers.js'`.

- [ ] **Step 3: Create the helpers file**

Create `forge-shell/app/js/shell-palette.helpers.js` (UMD wrapper identical to `app/js/roadmap.helpers.js`):

```js
/* ═══════════════════════════════════════════════════════════════
   Shell Palette Helpers — pure fuzzy-ranking logic for the Cmd+K palette.
   Importable as <script> (window.ShellPaletteHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShellPaletteHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Fuzzy-match score of query against text. -1 = no match.
   * Contiguous substrings (1000-band) outrank in-order subsequences
   * (500-band); earlier starts and word-boundary starts score higher.
   * Case-insensitive.
   */
  function fuzzyScore(query, text) {
    if (!query || !text) return -1;
    var q = String(query).toLowerCase();
    var t = String(text).toLowerCase();
    var idx = t.indexOf(q);
    if (idx !== -1) {
      return 1000 - idx * 2 + ((idx === 0 || /[^a-z0-9]/.test(t[idx - 1])) ? 50 : 0);
    }
    var ti = 0, first = -1, last = -1, bonus = 0;
    for (var qi = 0; qi < q.length; qi++) {
      ti = t.indexOf(q[qi], ti);
      if (ti === -1) return -1;
      if (first === -1) first = ti;
      if (ti === 0 || /[^a-z0-9]/.test(t[ti - 1])) bonus += 10;
      last = ti;
      ti++;
    }
    return 500 - (last - first) - first + bonus;
  }

  /**
   * Rank palette index entries against a query.
   * Score = max(fuzzyScore(q, title) * 2, fuzzyScore(q, filename)); the
   * 2x weight applies only to non-miss title scores. Misses (< 0) are
   * dropped; sort is score desc with title-ascending tie-break; result
   * is sliced to limit (default 20). Empty/whitespace query → [].
   */
  function rankEntries(query, entries, limit) {
    var max = (typeof limit === 'number' && limit > 0) ? limit : 20;
    var q = (query == null ? '' : String(query)).trim();
    if (!q) return [];
    var scored = [];
    (entries || []).forEach(function (entry) {
      var titleScore = fuzzyScore(q, entry.title);
      var fileScore = fuzzyScore(q, entry.filename);
      var score = Math.max(titleScore >= 0 ? titleScore * 2 : -1, fileScore);
      if (score < 0) return;
      scored.push({ entry: entry, score: score });
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.entry.title).localeCompare(String(b.entry.title));
    });
    return scored.slice(0, max).map(function (s) { return s.entry; });
  }

  return {
    fuzzyScore: fuzzyScore,
    rankEntries: rankEntries
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/shell-palette.helpers.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add app/js/shell-palette.helpers.js test/shell-palette.helpers.test.js
git commit -m "feat(palette): fuzzy ranking helpers (fuzzyScore, rankEntries)"
```

---

### Task 8.2: Palette overlay styles in `shell.css` (z-index 1250)

**Files:**
- Modify: `forge-shell/app/css/shell.css`

**Interfaces:**
- Produces: `.shell-palette-*` component styles. Overlay stacks at **1250** — above every view surface (roadmap tops out at 1200, `roadmap.css` drawer overlay) and below the shared Confirm at 1300 (as landed by PR3).

The palette is shell chrome, so its styles live in `shell.css` (already linked from `index.html`), not a plugin sheet. The CSS is inert until Task 8.3 lands the DOM; visual verification happens there.

- [ ] **Step 1: Append the palette styles**

Append to the END of `forge-shell/app/css/shell.css` (after the closing brace of the `@media (max-width: 700px)` block that currently ends the file):

```css

/* ═══ Shell Palette (Cmd+K) ═══
   Layer ladder: view surfaces ≤ 1200 < palette 1250 < Confirm 1300. */
.shell-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1250;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 15vh;
}

/* The class rule above would beat the UA [hidden] rule — restate it. */
.shell-palette-overlay[hidden] {
  display: none;
}

.shell-palette {
  width: min(560px, calc(100vw - 32px));
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.shell-palette-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-muted);
}

.shell-palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 15px;
}

.shell-palette-results {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.shell-palette-results li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.shell-palette-results li.active {
  background: var(--bg-hover);
}

.shell-palette-results li.shell-palette-hint {
  color: var(--text-muted);
  cursor: default;
  justify-content: center;
  padding: 16px 10px;
}

.shell-palette-icon {
  color: var(--text-muted);
  width: 18px;
  text-align: center;
  flex: none;
}

.shell-palette-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-palette-sub {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  flex: none;
}

.shell-palette-footer {
  padding: 8px 16px;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
}
```

Note the token names: `theme.css` defines `--border-color`, `--text-primary`, `--text-muted`, `--bg-card`, and `--bg-hover` (both light and dark blocks) — do not use `--border`/`--text`, which do not exist.

- [ ] **Step 2: Verify the suite is untouched and the app still boots**

Run: `npm test`
Expected: all suites pass (CSS-only change; the 12 palette-helper tests from Task 8.1 included).

Run: `npm run serve`, open `http://127.0.0.1:4173` in a browser
Expected: app boots with no console errors; no visual change anywhere (no `.shell-palette-*` DOM exists yet).

- [ ] **Step 3: Commit**

```bash
git add app/css/shell.css
git commit -m "style(shell): palette overlay styles at z-index 1250"
```

---

### Task 8.3: `ShellPalette` singleton — DOM, keyboard, entity index, selection routing

**Files:**
- Create: `forge-shell/app/js/shell-palette.js`
- Modify: `forge-shell/app/index.html`

**Interfaces:**
- Consumes: `ShellPaletteHelpers.rankEntries` (Task 8.1); `CardData.scanCardsDir(cardsHandle) → Map filename→{content, dirName, fileName, ...}` and `CardData.DIR_TYPE_MAP`; `ForgeFS.readDir(root, rel) → [{name, kind}]` (throws on missing dir) and `ForgeFS.readFile(root, rel)`; `ForgeUtils.FS.getSubDir` (null on missing), `ForgeUtils.parseFrontmatter` (`{frontmatter, body}` or null), `ForgeUtils.escapeHTML`, `ForgeUtils.Toast.show(message, type, duration)`; `Shell.selectPlugin(pluginId, options)` (returns `false` when hidden/unknown; `{selectCard}` is consumed only by `product-forge.js` `init`); the script-global `PLUGINS` const (icons/labels).
- Produces: `window.ShellPalette` — `{ open(): Promise<void>, close(), isOpen(): boolean, invalidate() }`, self-wired to a document-level Cmd/Ctrl+K listener (no-op until `Shell.rootHandle` exists). Not a registered plugin controller.

Index policy (binding): only `*.md` under the seven data dirs (`cards/` via `CardData.scanCardsDir`; flat scans of `tasks/`, `sessions/`, `reports/`, `audio-forge/recordings/`; `memory/` top-level + one-level subdirs — the exact `memory.js` load pattern; `rovo-agents/*/agent.md`). Built on first open, cached 60s, `invalidate()` nulls it. Missing dirs contribute nothing (per-source catch). While Confirm is visible, its capture-phase keydown (as landed by PR3) stops propagation, so Cmd+K cannot open the palette over a Confirm — intended.

- [ ] **Step 1: Create the palette singleton**

Create `forge-shell/app/js/shell-palette.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Shell Palette — global Cmd/Ctrl+K fuzzy search across plugin entities.
   Shell chrome (singleton overlay appended to <body>), NOT a registered
   plugin view controller. Index covers *.md under the seven data dirs;
   cached 60s; invalidated by shell.js at watcher receipt time and on
   project switch. Deep-links only into product-forge (selectCard) —
   every other entry plain-switches to the owning view.
   ═══════════════════════════════════════════════════════════════ */
window.ShellPalette = (function () {
  'use strict';

  var CACHE_TTL_MS = 60000;
  var MAX_RESULTS = 20;

  var _index = null;      /* Array<{title, type, plugin, filename, subtitle}> */
  var _builtAt = 0;
  var _building = false;
  var _results = [];
  var _activeIndex = 0;
  var _overlay = null;

  /* ── Plugin metadata (icon/label) from shell.js's PLUGINS const.
       Guarded so a future shell modularization degrades to icon-less
       rows instead of crashing. ── */
  function pluginMeta(pluginId) {
    if (typeof PLUGINS !== 'undefined') {
      for (var i = 0; i < PLUGINS.length; i++) {
        if (PLUGINS[i].id === pluginId) return PLUGINS[i];
      }
    }
    return { id: pluginId, label: pluginId, icon: 'fa-solid fa-file' };
  }

  /* ── Title fallback chain: fm.title → first '# ' heading → filename sans .md ── */
  function titleFromContent(content, filename) {
    var parsed = ForgeUtils.parseFrontmatter(content || '');
    if (parsed && parsed.frontmatter && parsed.frontmatter.title) {
      return String(parsed.frontmatter.title);
    }
    var lines = (content || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^#\s+(.+?)\s*$/);
      if (m) return m[1].trim();
    }
    return String(filename || '').replace(/\.md$/i, '');
  }

  function makeEntry(title, type, pluginId, filename) {
    return {
      title: title,
      type: type,
      plugin: pluginId,
      filename: filename,
      subtitle: type + ' · ' + pluginMeta(pluginId).label
    };
  }

  /* ── Source scanners. Each job is .catch()-wrapped by the caller, so a
       missing data dir (readDir throws) contributes nothing. ── */

  async function _scanCards(root, out) {
    var cardsHandle = await ForgeUtils.FS.getSubDir(root, 'cards');
    if (!cardsHandle) return;
    var files = await CardData.scanCardsDir(cardsHandle);
    files.forEach(function (info, filename) {
      var parsed = ForgeUtils.parseFrontmatter(info.content || '');
      var fm = parsed ? parsed.frontmatter : null;
      var title = (fm && fm.title) ? String(fm.title) : titleFromContent(info.content, info.fileName);
      var type = (fm && fm.type) ? String(fm.type) : (CardData.DIR_TYPE_MAP[info.dirName] || 'card');
      /* filename is the extension-less store key — the exact value
         product-forge's { selectCard } deep link expects. */
      out.push(makeEntry(title, type, 'product-forge-local', filename));
    });
  }

  async function _scanFlat(root, subdir, type, pluginId, out) {
    var entries = await ForgeFS.readDir(root, subdir);
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (en.kind !== 'file' || !/\.md$/i.test(en.name)) continue;
      try {
        var content = await ForgeFS.readFile(root, subdir + '/' + en.name);
        out.push(makeEntry(titleFromContent(content, en.name), type, pluginId, en.name));
      } catch (e) { /* unreadable file — skip */ }
    }
  }

  /* memory/: top-level *.md plus one-level subdir *.md — mirrors the
     load pattern in memory.js (readDir 'memory', then readDir each
     'memory/<dir>'); deeper nesting is not indexed. */
  async function _scanMemory(root, out) {
    var entries = await ForgeFS.readDir(root, 'memory');
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (en.kind === 'file' && /\.md$/i.test(en.name)) {
        try {
          var content = await ForgeFS.readFile(root, 'memory/' + en.name);
          out.push(makeEntry(titleFromContent(content, en.name), 'memory', 'memory', en.name));
        } catch (e) { /* skip */ }
      } else if (en.kind === 'directory') {
        try {
          var subEntries = await ForgeFS.readDir(root, 'memory/' + en.name);
          for (var j = 0; j < subEntries.length; j++) {
            var sub = subEntries[j];
            if (sub.kind !== 'file' || !/\.md$/i.test(sub.name)) continue;
            try {
              var subContent = await ForgeFS.readFile(root, 'memory/' + en.name + '/' + sub.name);
              out.push(makeEntry(titleFromContent(subContent, sub.name), 'memory', 'memory', en.name + '/' + sub.name));
            } catch (e) { /* skip */ }
          }
        } catch (e) { /* skip subdirectory */ }
      }
    }
  }

  async function _scanRovo(root, out) {
    var entries = await ForgeFS.readDir(root, 'rovo-agents');
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (en.kind !== 'directory') continue;
      try {
        var content = await ForgeFS.readFile(root, 'rovo-agents/' + en.name + '/agent.md');
        var parsed = ForgeUtils.parseFrontmatter(content || '');
        var title = (parsed && parsed.frontmatter && parsed.frontmatter.title)
          ? String(parsed.frontmatter.title) : en.name;
        out.push(makeEntry(title, 'agent', 'rovo-agent-forge', en.name + '/agent.md'));
      } catch (e) { /* no agent.md in this dir — skip */ }
    }
  }

  async function _buildIndex() {
    var root = Shell.rootHandle;
    var out = [];
    var jobs = [
      _scanCards(root, out),
      _scanFlat(root, 'tasks', 'task', 'tasks', out),
      _scanFlat(root, 'sessions', 'session', 'cognitive-forge', out),
      _scanFlat(root, 'reports', 'report', 'report-forge', out),
      _scanFlat(root, 'audio-forge/recordings', 'recording', 'audio-forge', out),
      _scanMemory(root, out),
      _scanRovo(root, out)
    ];
    await Promise.all(jobs.map(function (p) {
      return p.catch(function () { /* missing dir — contributes nothing */ });
    }));
    return out;
  }

  async function _rebuild() {
    if (_building) return;
    _building = true;
    try {
      _index = await _buildIndex();
      _builtAt = Date.now();
    } finally {
      _building = false;
    }
  }

  /* ── DOM ── */

  function _ensureDom() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.className = 'shell-palette-overlay';
    _overlay.hidden = true;
    _overlay.innerHTML =
      '<div class="shell-palette" role="dialog" aria-label="Search">' +
        '<div class="shell-palette-input-row">' +
          '<i class="fa-solid fa-magnifying-glass"></i>' +
          '<input type="text" class="shell-palette-input" placeholder="Search across Forge…" aria-label="Search across Forge">' +
        '</div>' +
        '<ul class="shell-palette-results" role="listbox"></ul>' +
        '<div class="shell-palette-footer">↑↓ navigate · ↵ open · esc close</div>' +
      '</div>';
    document.body.appendChild(_overlay);

    /* Backdrop click closes; clicks inside the dialog do not. */
    _overlay.addEventListener('click', function (e) {
      if (e.target === _overlay) close();
    });

    /* Palette-scoped keys. stopPropagation + preventDefault on every key
       we consume so no view-level document handler (roadmap ladder,
       tasks bindKeyboard, product-forge) ever sees a palette keystroke.
       Confirm's capture-phase handler (PR3) still wins over these
       bubble-phase listeners while a Confirm is visible — by design. */
    _overlay.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        _moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        _moveActive(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (_results[_activeIndex]) _select(_results[_activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });

    var input = _overlay.querySelector('.shell-palette-input');
    input.addEventListener('input', function () {
      _onQuery(input.value);
    });

    var list = _overlay.querySelector('.shell-palette-results');
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-palette-index]');
      if (!li) return;
      var i = parseInt(li.getAttribute('data-palette-index'), 10);
      if (_results[i]) _select(_results[i]);
    });
    list.addEventListener('mouseover', function (e) {
      var li = e.target.closest('li[data-palette-index]');
      if (!li) return;
      _activeIndex = parseInt(li.getAttribute('data-palette-index'), 10);
      _syncActive();
    });
  }

  /* ── Rendering ── */

  function _onQuery(value) {
    var q = (value || '').trim();
    _results = q ? ShellPaletteHelpers.rankEntries(q, _index || [], MAX_RESULTS) : [];
    _activeIndex = 0;
    _renderResults(q);
  }

  function _renderResults(q) {
    var list = _overlay.querySelector('.shell-palette-results');
    if (_building && !_index) {
      list.innerHTML = '<li class="shell-palette-hint">Indexing…</li>';
      return;
    }
    if (!q) {
      list.innerHTML = '<li class="shell-palette-hint">Type to search</li>';
      return;
    }
    if (!_results.length) {
      list.innerHTML = '<li class="shell-palette-hint">No matches</li>';
      return;
    }
    var html = '';
    for (var i = 0; i < _results.length; i++) {
      var entry = _results[i];
      var meta = pluginMeta(entry.plugin);
      html += '<li role="option" data-palette-index="' + i + '"' +
        (i === _activeIndex ? ' class="active"' : '') + '>' +
        '<span class="shell-palette-icon"><i class="' + meta.icon + '"></i></span>' +
        '<span class="shell-palette-title">' + ForgeUtils.escapeHTML(entry.title) + '</span>' +
        '<span class="shell-palette-sub">' + ForgeUtils.escapeHTML(entry.subtitle) + '</span>' +
        '</li>';
    }
    list.innerHTML = html;
  }

  function _moveActive(delta) {
    if (!_results.length) return;
    _activeIndex = (_activeIndex + delta + _results.length) % _results.length;
    _syncActive();
  }

  function _syncActive() {
    var items = _overlay.querySelectorAll('.shell-palette-results li[data-palette-index]');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', i === _activeIndex);
    }
    var active = items[_activeIndex];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  /* ── Selection routing. Deep-link map: product-forge-local is the ONLY
       controller consuming init options today ({ selectCard }); adding a
       future plugin deep link is one line here. ── */
  function _select(entry) {
    close();
    var options = (entry.plugin === 'product-forge-local')
      ? { selectCard: entry.filename }
      : undefined;
    var ok = Shell.selectPlugin(entry.plugin, options);
    if (ok === false) {
      ForgeUtils.Toast.show(
        pluginMeta(entry.plugin).label + ' is hidden — enable it in the sidebar', 'info');
    }
  }

  /* ── Public API ── */

  function isOpen() {
    return !!(_overlay && !_overlay.hidden);
  }

  async function open() {
    if (typeof Shell === 'undefined' || !Shell.rootHandle) return;
    _ensureDom();
    _overlay.hidden = false;
    var input = _overlay.querySelector('.shell-palette-input');
    input.value = '';
    _results = [];
    _activeIndex = 0;
    var stale = !_index || (Date.now() - _builtAt > CACHE_TTL_MS);
    if (stale) {
      var job = _rebuild();
      _renderResults('');       /* 'Indexing…' while the first build runs */
      input.focus();
      await job;
      if (isOpen()) _onQuery(input.value); /* rank anything typed mid-build */
    } else {
      _renderResults('');       /* 'Type to search' hint */
      input.focus();
    }
  }

  function close() {
    if (!_overlay || _overlay.hidden) return;
    _overlay.hidden = true;
    var input = _overlay.querySelector('.shell-palette-input');
    if (input) input.blur();
  }

  function invalidate() {
    _index = null;
  }

  /* ── Self-wired global shortcut. No-op until a project is loaded. ── */
  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        if (typeof Shell === 'undefined' || !Shell.rootHandle) return;
        e.preventDefault();
        if (isOpen()) close(); else open();
      }
    });
  });

  return { open: open, close: close, isOpen: isOpen, invalidate: invalidate };
})();
```

- [ ] **Step 2: Load the two scripts after `shell.js`**

In `forge-shell/app/index.html`, in the script block at the bottom of `<body>`, find (note: `<script src="js/shell.helpers.js"></script>` sits immediately above `shell.js`, as landed by PR6):

```html
  <script src="js/shell.js"></script>
  <script src="js/cognitive-forge.js"></script>
```

Replace with:

```html
  <script src="js/shell.js"></script>
  <script src="js/shell-palette.helpers.js"></script>
  <script src="js/shell-palette.js"></script>
  <script src="js/cognitive-forge.js"></script>
```

All palette dependencies (`ForgeFS`, `ForgeUtils`, `CardData`, `Shell`/`PLUGINS`) load earlier; view controllers load later and are only reached at runtime via `Shell.selectPlugin`. No CSS `<link>` change — `shell.css` is already linked.

- [ ] **Step 3: Verify in the browser (server mode)**

Run: `npm run serve`, open `http://127.0.0.1:4173` in Chrome (from `forge-shell/`; use a project containing several data dirs, e.g. the-forge root)

Expected, in order:
1. On the welcome screen (clear the saved project via "Change directory" → Escape, or use a fresh browser profile): Cmd/Ctrl+K does nothing.
2. With the project loaded: Cmd/Ctrl+K opens a centered overlay above the active view; results area shows "Type to search" (first open may show "Indexing…" for a moment).
3. Type a card title fragment (e.g. `notification`): up to 20 ranked rows appear, each with the owning plugin's icon, the entity title, and a "type · Plugin" subtitle (e.g. "epic · Product Forge"). Verify hits from at least `cards/`, `tasks/`, and `sessions/` with suitable queries.
4. ArrowDown/ArrowUp move the active row and wrap past both ends; mouse hover also moves it.
5. Enter on a card row: palette closes, Product Forge opens with that card revealed.
6. Cmd+K again, Enter on a task row: plain switch to the Tasks view (no deep link).
7. Hide a plugin (sidebar pen icon → eye toggle → done), Cmd+K, select one of its entries: info toast "<Plugin> is hidden — enable it in the sidebar", no navigation.
8. Escape closes the palette; backdrop click closes it. With the Roadmap view active and its detail drawer open underneath, Cmd+K then Escape closes ONLY the palette — the drawer stays open (no key leak).
9. Cmd/Ctrl+K while open toggles it closed. No console errors throughout; also load a project with NO data dirs and confirm Cmd+K opens with an empty index and no errors.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all suites pass (no Node-side change in this task; guards regressions).

- [ ] **Step 5: Commit**

```bash
git add app/js/shell-palette.js app/index.html
git commit -m "feat(shell): Cmd+K palette singleton with cross-plugin entity index"
```

---

### Task 8.4: `shell.js` invalidation hooks — watcher receipt + project switch

**Files:**
- Modify: `forge-shell/app/js/shell.js`

**Interfaces:**
- Consumes: `window.ShellPalette.invalidate()` (Task 8.3); `Shell._onFileChanged` batch/flush shape as landed by PR6.

Two one-line hooks, guarded with `if (window.ShellPalette)` so shell.js keeps working if the palette script is ever absent. Per C9, invalidation happens at EVENT RECEIPT time in `_onFileChanged` — not on the debounced flush — so the index is never fresher than the change. Invalidation is deliberately unconditional (own-writes that are toast-suppressed still change file contents, so the index must drop too).

- [ ] **Step 1: Hook `_onFileChanged` at receipt time**

In `forge-shell/app/js/shell.js`, in `_onFileChanged` as landed by PR6 (the batch/flush rewrite), find the opening lines:

```js
  _onFileChanged(path) {
    console.log('[Shell] File changed:', path);
```

Replace with:

```js
  _onFileChanged(path) {
    console.log('[Shell] File changed:', path);
    // Receipt-time palette invalidation (C9): the entity index must never
    // be fresher than the change, so this runs before batching/suppression.
    if (window.ShellPalette) window.ShellPalette.invalidate();
```

Do not touch the rest of the method (the `ShellHelpers.matchWatchGroup` call, suppression check, `_pendingChanges` batching, and flush timer stay exactly as PR6 left them).

- [ ] **Step 2: Hook `_onDirectoryReady` for project switches**

Still in `shell.js`, in `_onDirectoryReady`, find the plugin-directory probe loop at the top of the method:

```js
    for (const p of PLUGINS) {
      if (p.requiredDir) {
        this.pluginDirStatus[p.id] = await ForgeUtils.FS.dirExists(this.rootHandle, p.requiredDir);
      } else {
        this.pluginDirStatus[p.id] = true;
      }
    }
```

Replace with:

```js
    for (const p of PLUGINS) {
      if (p.requiredDir) {
        this.pluginDirStatus[p.id] = await ForgeUtils.FS.dirExists(this.rootHandle, p.requiredDir);
      } else {
        this.pluginDirStatus[p.id] = true;
      }
    }

    // New project root — drop any cached palette index from the old project.
    if (window.ShellPalette) window.ShellPalette.invalidate();
```

(The legacy productivity probe that follows this loop is removed later by PR9; keeping our line attached to the loop above means PR9's deletion hunk does not touch it.)

- [ ] **Step 3: Verify invalidation behavior**

Run: `npm test`
Expected: all suites pass (no helper behavior changed).

Run: `npm run serve`, open `http://127.0.0.1:4173`
Expected: (project switch path — all runtimes) open the palette and run a query; close it; use the sidebar folder button to switch to a DIFFERENT project; Cmd+K → results now come from the new project only (old entries gone, no 60s wait).

Run (Tauri only — watcher receipt path): `npm run tauri:dev`
Expected: open the palette, search for an existing card, close it; from a terminal edit that card's `title:` frontmatter; after the watcher toast fires, Cmd+K and search again → the NEW title appears immediately (no 60s staleness wait). In browser/server modes there is no watcher — the 60s TTL from Task 8.3 remains the freshness backstop there.

- [ ] **Step 4: Commit**

```bash
git add app/js/shell.js
git commit -m "feat(shell): invalidate palette index on watcher receipt and project switch"
```

---

### Task 8.5: Full-suite verification + open PR 8

**Files:**
- No new edits — verification and PR only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: everything passing, including the 12 new `shell-palette.helpers` tests this PR adds (the suite has grown through PR1–PR7; every prior suite must remain green).

- [ ] **Step 2: Three-runtime smoke checklist**

Launch each runtime and walk the rows (Tauri: `npm run tauri:dev`; Chrome FSA: `npm run serve` → `http://127.0.0.1:4173` in a real Chrome tab, pick the project via the native `showDirectoryPicker`; server/cmux: same URL in an embedded browser without FSA, pick the project via the typed-path dialog):

| Check | Tauri | Chrome FSA | Server (cmux) |
|---|---|---|---|
| Cmd/Ctrl+K no-ops on welcome screen; opens overlay once a project is loaded | ✓ | ✓ | ✓ |
| Overlay renders above the active view's surfaces (open Roadmap drawer first — palette sits on top, z 1250) | ✓ | ✓ | ✓ |
| Empty query shows "Type to search"; queries hit entities from all seven data dirs; max 20 rows with icon / title / "type · Plugin" subtitle | ✓ | ✓ | ✓ |
| Arrow keys wrap; Enter opens active row; Escape and backdrop click close; no keystroke leaks to underlying view handlers | ✓ | ✓ | ✓ |
| Card entry → Product Forge with card revealed; deliberately-missing filename → "Card not found in Product Forge" toast | ✓ | ✓ | ✓ |
| Non-card entry → plain view switch; hidden-plugin entry → info toast, no navigation | ✓ | ✓ | ✓ |
| Missing data dirs skipped silently (empty project: palette opens, no console errors) | ✓ | ✓ | ✓ |
| Index refreshes immediately after an external file edit (watcher receipt) | ✓ | — (no watcher) | — (no watcher) |
| Index refreshes after >60s staleness (edit file, wait, reopen palette) | ✓ | ✓ | ✓ |
| Project switch drops the old index (results from new project only) | ✓ | ✓ | ✓ |
| No console errors on boot with a fully-populated project and with an empty one | ✓ | ✓ | ✓ |

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin ux-program/pr-8-command-palette
gh pr create --base main --title "Global Cmd+K palette: fuzzy search across all plugin entities" --body "Adds a shell-chrome Cmd/Ctrl+K palette (window.ShellPalette) that fuzzy-searches *.md entities across all seven plugin data dirs and jumps to the owning view, deep-linking into Product Forge via selectCard. Pure ranking logic lives in shell-palette.helpers.js (UMD, 12 node tests); overlay stacks at z-1250 (views <=1200 < palette < Confirm 1300); index is cached 60s and invalidated at watcher receipt time and on project switch via two one-line hooks in shell.js.

Stacked PR 8/9 - merge after PR7"
```

---

## PR9 — Productivity ghost cleanup: delete dead controller, rename CSS, docs sync *(S)*

**Branch:** `ux-program/pr-9-productivity-cleanup` (from `ux-program/pr-8-command-palette`) — **Contains:** WP8 (all): delete the never-loaded `productivity.js`, `git mv productivity.css → tasks-memory.css`, purge dead CSS rules (original 13-class list expanded with PR1's and PR2's hand-offs), remove the unread `_onDirectoryReady` productivity probe in `shell.js` (the TASKS.md watcher token is already gone, as landed by PR6 — C2), and sync `STYLE_GUIDE.md` + `README.md`. — **Depends on:** PR1 (removed the fake drop-indicator usage and added `.prod-col-drag-over`/`.prod-parent-chip`), PR2 (memory switched off `prod-markdown-content`), PR4 (added `position: relative` to `.prod-layout`), PR6/PR8 (final `shell.js` shape). Lands last (C8) so the purge list is verified against the merged tree.

Five ordered, independently revertible commits (delete js → `git mv` + href → purge → shell probe → docs), then full-suite verification. No new `node --test` suite — this PR is deletion/rename-only with no new logic (D1 does not apply; there is no new pure-logic module). No `prod-*` class **strings** are renamed anywhere (D9).

---

### Task 9.1: Delete the dead ProductivityView controller

**Files:**
- Delete: `forge-shell/app/js/productivity.js` (2,049 lines)

**Interfaces:**
- Consumes: nothing — the file registers `Shell.registerController('productivity', …)` but `'productivity'` is not in the shell.js `PLUGINS` array, `index.html` has never had a `<script>` tag for it, and no `#view-productivity` container exists.
- Produces: nothing. Side effect already accounted for upstream: PR2's renderer consolidation correctly did **not** count `productivity.js` as a consumer of `MDHelpers` (its private duplicate `renderMarkdownToHtml` dies with this file).

- [ ] **Step 1: Verify the file is truly dead on this branch**

Run: `grep -rn "ProductivityView" app/ test/ server.js` (from `forge-shell/`)
Expected: every hit is inside `app/js/productivity.js` itself (its own IIFE and the `registerController` call at the bottom). Zero hits in any other file.

Run: `grep -n "productivity.js" app/index.html`
Expected: no output — there is no script tag for it (there never was one; nothing to remove from `index.html` in this commit).

Run: `grep -rn "'productivity'" app/js/shell.js`
Expected: exactly one hit — the `pluginDirStatus['productivity']` assignment inside `_onDirectoryReady()`. That is removed by Task 9.4, not here (severable commits).

- [ ] **Step 2: Delete the file**

```bash
git rm app/js/productivity.js
```

Run: `ls app/js/ | grep productivity`
Expected: no output.

- [ ] **Step 3: Confirm the suite and app are unaffected**

Run: `npm test` (from `forge-shell/`)
Expected: all tests pass (no existing test references the file).

Run: `npm run serve` then open `http://127.0.0.1:4173` in a browser, select a project folder, click through Tasks and Memory.
Expected: no console errors; both views render exactly as before (the file was never loaded, so nothing changes).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(forge-shell): remove dead ProductivityView controller"
```

---

### Task 9.2: Rename productivity.css → tasks-memory.css, update href, rewrite provenance comments

**Files:**
- Rename: `forge-shell/app/css/productivity.css` → `forge-shell/app/css/tasks-memory.css` (via `git mv` — preserves blame)
- Modify: `forge-shell/app/css/tasks-memory.css` (header comment + one stale section comment)
- Modify: `forge-shell/app/index.html` (one-line href)

**Interfaces:**
- Consumes: the stylesheet as landed by PR1 (new `.prod-col-drag-over` and `.prod-parent-chip` rules) and PR4 (`.prod-layout` now has `position: relative;`).
- Produces: `tasks-memory.css` — same selectors, new file name. Consumers unchanged: `index.html` link tag; class consumers in `tasks.js` (226 `prod-` usages) and `memory.js` (57).

- [ ] **Step 1: Rename the file (rename, not copy)**

```bash
git mv app/css/productivity.css app/css/tasks-memory.css
```

Run: `git status --short`
Expected: one line: `R  app/css/productivity.css -> app/css/tasks-memory.css`.

- [ ] **Step 2: Update the stylesheet link in index.html**

In `forge-shell/app/index.html`, in the `<head>` link block (line 17 on pre-stack main, between the `product-forge.css` and `roadmap.css` links), replace:

```html
  <link rel="stylesheet" href="css/productivity.css">
```

with:

```html
  <link rel="stylesheet" href="css/tasks-memory.css">
```

This must land in the same commit as the `git mv` so the app never references a missing file.

- [ ] **Step 3: Replace the file header comment**

At the top of `forge-shell/app/css/tasks-memory.css`, replace the existing 4-line header:

```css
/* ═══════════════════════════════════════════════════════════
   Productivity View — Layout, Board, List, Memory, Modal
   All classes prefixed with prod-
   ═══════════════════════════════════════════════════════════ */
```

with (this comment is the **only** sanctioned place the word "productivity" survives in `forge-shell/app`, and its last two content lines are the allowlist that protects the dynamically-built class families from future "unused CSS" sweeps):

```css
/* ═══════════════════════════════════════════════════════
   Tasks + Memory shared styles (formerly productivity.css)
   Consumed by tasks.js (#view-tasks) and memory.js (#view-memory).
   The `prod-` prefix is a historical artifact of the retired
   combined Productivity view; kept to avoid mass churn. Rules for
   these two views should continue to use the prod- prefix here.
   Note: .prod-tl-{high|medium|low} and .prod-wl-status-* are
   built dynamically in tasks.js — do not remove as "unused".
   ═══════════════════════════════════════════════════════ */
```

- [ ] **Step 4: Fix the stale modal section comment**

Still in `tasks-memory.css`, locate the section comment immediately above the `.prod-modal-overlay` rule (line ~1633 on pre-stack main; find it with `grep -n "view-productivity" app/css/tasks-memory.css`) and replace:

```css
/* ── Local Modal (scoped inside #view-productivity) ── */
```

with:

```css
/* ── Local Modal (tasks + memory edit modals) ── */
```

- [ ] **Step 5: Verify no dangling references to the old name**

Run: `grep -rni "productivity" app/ test/ server.js src-tauri/ 2>/dev/null`
Expected: hits **only** in `app/css/tasks-memory.css` (the "formerly productivity.css" / "retired combined Productivity view" header comment) and in `app/js/shell.js` (the `_onDirectoryReady` probe — removed by Task 9.4).

- [ ] **Step 6: Browser verification**

Run: `npm run serve` → open `http://127.0.0.1:4173` with DevTools Network open, select a project with `tasks/` and `memory/`.
Expected: `tasks-memory.css` loads with status 200; **no** request for `productivity.css` (no 404); Tasks board and Memory tabs render styled exactly as before in both light and dark themes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(forge-shell): rename productivity.css to tasks-memory.css"
```

Run: `git log --follow --oneline -- app/css/tasks-memory.css | tail -3`
Expected: history continues through the old `productivity.css` commits (rename detected).

---

### Task 9.3: Purge dead CSS rules (keep-list guarded, verified against the merged tree)

**Files:**
- Modify: `forge-shell/app/css/tasks-memory.css`

**Interfaces:**
- Consumes: PR1's hand-off (tasks.js no longer references `.prod-drop-indicator` or toggles `.prod-cards.prod-drag-over` — as landed by PR1) and PR2's hand-off (memory.js containers switched from `prod-markdown-content` to `rendered-body` — as landed by PR2).
- Produces: a purged `tasks-memory.css`. **Keep-list (must survive):** `.prod-status-bar` (+ `.prod-status-bar.prod-visible`); `.prod-layout` including PR4's `position: relative;`; `.prod-col-drag-over` and `.prod-parent-chip` rules as landed by PR1; the dynamic families `.prod-tl-high/.prod-tl-medium/.prod-tl-low` incl. `[data-theme="dark"]` variants and **all** `.prod-wl-status-*` rules (built via string concat in tasks.js: `'prod-tl-' + …` and `'prod-wl-status-' + …`).

- [ ] **Step 1: Run the dead-class verification script against the merged tree (paste output into the PR)**

Run (from `forge-shell/app/`):

```bash
for c in prod-add-section-col prod-card-subtasks prod-checkbox prod-checked \
         prod-column-drop-indicator prod-dragging-column prod-file-card-header \
         prod-file-card-title prod-memory-card-meta prod-new-task-input \
         prod-show-on-hover prod-subtask prod-summary-no-data \
         prod-drop-indicator prod-markdown-content; do
  grep -rn "$c" js/tasks.js js/memory.js index.html && echo "LIVE: $c"
done; echo "verification complete"
```

Expected: only `verification complete` — no `LIVE:` lines. (On pre-stack main, `prod-drop-indicator` and `prod-markdown-content` WERE live; PR1 and PR2 removed those usages. If any `LIVE:` line prints, STOP — the branch is not correctly stacked on PR8.)

- [ ] **Step 2: Run the stripped-fragment check (catches string-concatenated class construction)**

Run (from `forge-shell/app/`):

```bash
for f in add-section-col card-subtasks column-drop-indicator dragging-column \
         file-card-header file-card-title memory-card-meta new-task-input \
         show-on-hover summary-no-data drop-indicator markdown-content; do
  grep -rn "$f" js/tasks.js js/memory.js && echo "FRAGMENT: $f"
done; echo "fragment check complete"
```

Expected: only `fragment check complete`. (The fragments `checkbox`/`checked`/`subtask` are excluded here because they collide with generic DOM attribute/identifier text; for those three, rely on the full-name check in Step 1 — the WP8 audit already confirmed zero concat construction for all 13.)

- [ ] **Step 3: Delete the dead rule blocks**

In `forge-shell/app/css/tasks-memory.css`, delete each block below **in its entirety** (open brace to closing brace, plus the section comment where noted). Locate by selector, not line number — PR1/PR4 shifted lines. Where a selector list is comma-separated with a live class (none are, per audit — every block below is standalone), you would remove only the dead selector.

Board/drag region:

```css
.prod-column.prod-dragging-column {
  opacity: 0.5;
}

.prod-column-drop-indicator {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  margin: 0 -2px;
  min-height: 100px;
}
```

(PR1 hand-off — the `.prod-cards { … }` base rule directly above these stays; only the drag-over variants go:)

```css
.prod-cards.prod-drag-over {
  background: rgba(74, 108, 247, 0.08);
  border-radius: var(--radius-md);
}

[data-theme="dark"] .prod-cards.prod-drag-over {
  background: rgba(102, 129, 255, 0.1);
}
```

Card region (the `.prod-task-card.prod-dragging` rule stays — `prod-dragging` is live):

```css
.prod-task-card .prod-show-on-hover {
  display: none;
}

.prod-task-card:hover .prod-show-on-hover {
  display: block;
}
```

Subtask/checkbox region (delete the `/* ── Checkbox ── */` section comment with its rules):

```css
.prod-card-subtasks {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-secondary);
}

.prod-subtask {
  padding: 3px 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* ── Checkbox ── */
.prod-checkbox { … }
.prod-checkbox:hover { … }
.prod-checkbox.prod-checked { … }
.prod-checkbox.prod-checked::after { … }
[data-theme="dark"] .prod-checkbox { … }
```

Add-card region (the `/* ── Add Card ── */` comment and `.prod-add-card` rules stay; delete only):

```css
.prod-new-task-input { … }
.prod-new-task-input:focus { … }
.prod-new-task-input::placeholder { … }

.prod-drop-indicator {
  height: 3px;
  background: var(--accent);
  border-radius: 2px;
  margin: 5px 0;
}

/* ── Add Section (board) ── */
.prod-add-section-col { … }
.prod-add-section-col:hover { … }
```

(`.prod-drop-indicator` is the PR1 hand-off; the `/* ── Add Section (board) ── */` comment goes with its two rules.)

Summary region:

```css
.prod-summary-no-data {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}
```

Memory region:

```css
.prod-memory-card-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
```

File-card region (the `.prod-file-card` base rule and `.prod-file-card-content` stay — live in memory.js; delete only):

```css
.prod-file-card-header { … }
.prod-file-card-header:hover { … }
.prod-file-card-title { … }
```

Markdown region (PR2 hand-off — delete the `/* ── Markdown Content (memory rendering) ── */` section comment and the entire family, ~40 lines ending just before the `/* ── Local Modal … ── */` comment):

```css
/* ── Markdown Content (memory rendering) ── */
.prod-markdown-content { … }
.prod-markdown-content h1 { … }
.prod-markdown-content h2 { … }
.prod-markdown-content h3 { … }
.prod-markdown-content p { … }
.prod-markdown-content ul, .prod-markdown-content ol { … }
.prod-markdown-content li { … }
.prod-markdown-content code { … }
.prod-markdown-content pre { … }
.prod-markdown-content table { … }
.prod-markdown-content th, .prod-markdown-content td { … }
.prod-markdown-content th { … }
```

- [ ] **Step 4: Post-purge greps — purge complete, keep-list intact**

Run (from repo root `the-forge/`):

```bash
for c in prod-add-section-col prod-card-subtasks prod-checkbox prod-checked \
         prod-column-drop-indicator prod-dragging-column prod-file-card-header \
         prod-file-card-title prod-memory-card-meta prod-new-task-input \
         prod-show-on-hover prod-subtask prod-summary-no-data \
         prod-drop-indicator prod-markdown-content; do
  grep -rn "$c" forge-shell/app && echo "SURVIVOR: $c"
done; echo "purge check complete"
```

Expected: only `purge check complete` — zero `SURVIVOR:` lines.

Run (from `forge-shell/`):

```bash
grep -c "prod-tl-high\|prod-wl-status-open" app/css/tasks-memory.css
grep -n "prod-status-bar\|position: relative\|prod-col-drag-over\|prod-parent-chip" app/css/tasks-memory.css | head -20
```

Expected: first command prints a count > 0 (dynamic families survived). Second command shows: the `.prod-status-bar` block (+ `.prod-visible` variant), `position: relative` inside `.prod-layout` (PR4's addition), and the `.prod-col-drag-over` + `.prod-parent-chip` rules (PR1's additions) — all present.

- [ ] **Step 5: Browser verification (the purge touches `[data-theme="dark"]` blocks — check both themes)**

Run: `npm run serve` → `http://127.0.0.1:4173`, select a project with `tasks/` and `memory/`.
Expected, Tasks view: all six sub-views render — Board (drag a card between columns: whole-column accent highlight `.prod-col-drag-over` appears, no styling glitch), List, **Timeline** (priority bars still colored red/orange/blue — `prod-tl-*`), Summary, **Workload** (status pills still tinted per status — `prod-wl-status-*`), Matrix. A task with a parent still shows its parent chip. Saving a task still flashes the bottom status pill (`.prod-status-bar`).
Expected, Memory view: directory tabs, cards, and the file modal open/edit/save all render styled.
Toggle dark theme (moon icon): timeline bars and workload pills keep their dark-variant colors; no unstyled elements anywhere.

- [ ] **Step 6: Commit**

```bash
git add app/css/tasks-memory.css
git commit -m "chore(forge-shell): purge CSS rules only the dead Productivity view used"
```

---

### Task 9.4: Remove the productivity probe from Shell._onDirectoryReady

**Files:**
- Modify: `forge-shell/app/js/shell.js`

**Interfaces:**
- Consumes: `shell.js` as landed by PR6 (batch/flush `_onFileChanged`, `WATCH_GROUPS` shipped **without** any TASKS.md token — C2) and PR8 (palette hooks). The probe block itself is untouched by both — locate it by its code landmark, not by pre-stack line numbers (~266–269).
- Produces: `Shell._onDirectoryReady()` — unchanged signature; no longer writes `pluginDirStatus['productivity']`; drops two wasted async FS calls per directory open. The sole `pluginDirStatus` reader (the home-view status-card loop) iterates `PLUGINS`, which never contained `'productivity'` — behavior is identical.

- [ ] **Step 1: Delete the probe block**

In `forge-shell/app/js/shell.js`, inside `_onDirectoryReady()`, after the `for (const p of PLUGINS) { … }` loop that populates `this.pluginDirStatus` and the palette-invalidation line PR8 attached to it, delete these four lines outright (comment and all — nothing replaces them):

```js
    // For productivity, check TASKS.md and memory/ directory
    const tasksFile = await ForgeUtils.FS.getFile(this.rootHandle, 'TASKS.md');
    const memoryDir = await ForgeUtils.FS.getSubDir(this.rootHandle, 'memory');
    this.pluginDirStatus['productivity'] = !!(tasksFile || memoryDir);
```

After the deletion, the method flows from the `PLUGINS` loop through PR8's `window.ShellPalette.invalidate()` line to the Tauri file-watcher setup block (as landed by PR6).

- [ ] **Step 2: Grep verification**

Run: `grep -n "TASKS.md" app/js/shell.js` (from `forge-shell/`)
Expected: no output — the probe was the last TASKS.md reference in shell.js (the watcher token was already removed by PR6 per C2; `shell.helpers.js` retains one comment mentioning the removed token — that is expected).

Run: `grep -n "productivity" app/js/shell.js`
Expected: no output.

- [ ] **Step 3: Boot-path verification**

Run: `npm run serve` → `http://127.0.0.1:4173` with DevTools open (Console + Network), re-select the project directory.
Expected: no console errors from `_onDirectoryReady`; no request/read of `TASKS.md` appears; the Forge Shell home view still shows its **8** plugin status cards (one per `PLUGINS` entry except `forge-shell` itself — Productivity never rendered there); Tasks and Memory nav entries appear as before.

- [ ] **Step 4: Run the suite and commit**

Run: `npm test`
Expected: all tests pass (the shell.helpers suite, as landed by PR6, does not cover `_onDirectoryReady`).

```bash
git add app/js/shell.js
git commit -m "chore(forge-shell): drop unread productivity probe from _onDirectoryReady"
```

---

### Task 9.5: Docs sync — STYLE_GUIDE.md tables + prod- exception, README.md plugin table + file tree

**Files:**
- Modify: `forge-shell/STYLE_GUIDE.md` (three small hunks)
- Modify: `forge-shell/README.md` (two hunks)

**Interfaces:**
- Consumes: the `PLUGINS` array in `app/js/shell.js` (authoritative — copy verbatim); the merged-tree `app/js/` file listing (PRs 1–8 each added files).
- Produces: docs matching reality; the sanctioned `prod-` prefix exception (D9). Note: PRs 2/3/4/5 appended **sections** to STYLE_GUIDE.md — the two plugin tables and the plugin-prefix paragraph are untouched by them; locate by heading/quoted text, not pre-stack line numbers (~145/157/167). Dated historical docs under `docs/plans/`, `docs/reports/`, `docs/superpowers/plans/` that mention productivity.css/js must **not** be edited.

- [ ] **Step 1: STYLE_GUIDE — sanction the prod- prefix exception**

In `forge-shell/STYLE_GUIDE.md`, find the plugin-prefix rule paragraph:

```markdown
Plugin-specific toolbar additions (e.g., year navigation, filter badges) should be added as extra elements using plugin-prefixed classes (e.g., `.rm-year-nav`, `.rm-filter-badge`) scoped under `.plugin-toolbar`. Never override the base shared styles.
```

Append this new paragraph immediately after it (blank line between):

```markdown
Exception: the Tasks and Memory views share `tasks-memory.css` (formerly `productivity.css`) and use the legacy `prod-` prefix throughout; keep using `prod-` for rules in that file rather than introducing a second prefix.
```

- [ ] **Step 2: STYLE_GUIDE — replace the Productivity row in the Implemented Plugins table**

In the `### Implemented Plugins` table, replace the row:

```markdown
| Productivity        | (SPA view in forge-shell)             | No          | Yes (Tasks/Memory, Board/List) |
```

with these two rows (in place, keeping the table's column padding style):

```markdown
| Tasks               | (SPA view in forge-shell)             | No          | Yes (Board/List/Timeline/Summary/Workload/Matrix) |
| Memory              | (SPA view in forge-shell)             | No          | Yes (per-directory memory tabs) |
```

- [ ] **Step 3: STYLE_GUIDE — replace the Productivity row in the icon table**

In the `### Font Awesome Icons by Plugin` table, replace the row:

```markdown
| Productivity        | `fa-brain`          | Save uses `fa-floppy-disk`              |
```

with (icons taken from the shell.js `PLUGINS` array):

```markdown
| Tasks               | `fa-list-check`     | Shares `tasks-memory.css`, prefix `prod-` (legacy) |
| Memory              | `fa-brain`          | Shares `tasks-memory.css`, prefix `prod-` (legacy) |
```

- [ ] **Step 4: README — replace the stale PLUGINS snippet**

In `forge-shell/README.md`, under `## Plugin Registration`, replace the entire stale `const PLUGINS = [ … ];` code block (6 entries, includes a `productivity` row and the wrong cognitive-forge icon) with the current 9-entry array copied verbatim from `app/js/shell.js`:

```javascript
const PLUGINS = [
  { id: 'forge-shell',         label: 'Forge Shell',      icon: 'fa-solid fa-terminal',       requiredDir: null },
  { id: 'cognitive-forge',     label: 'Cognitive Forge',  icon: 'fa-solid fa-scale-balanced', requiredDir: 'sessions' },
  { id: 'product-forge-local', label: 'Product Forge',    icon: 'fa-solid fa-clipboard-list', requiredDir: 'cards' },
  { id: 'roadmap',             label: 'Roadmap',          icon: 'fa-solid fa-road',           requiredDir: 'cards' },
  { id: 'tasks',               label: 'Tasks',            icon: 'fa-solid fa-list-check',     requiredDir: 'tasks' },
  { id: 'memory',              label: 'Memory',           icon: 'fa-solid fa-brain',          requiredDir: 'memory' },
  { id: 'rovo-agent-forge',    label: 'Rovo Agent Forge', icon: 'fa-solid fa-robot',          requiredDir: 'rovo-agents' },
  { id: 'report-forge',        label: 'Report Forge',     icon: 'fa-solid fa-file-lines',     requiredDir: 'reports' },
  { id: 'audio-forge',         label: 'Audio Forge',      icon: 'fa-solid fa-microphone',     requiredDir: 'audio-forge' },
];
```

Before pasting, diff against the real array: `sed -n '/^const PLUGINS = \[/,/^\];/p' app/js/shell.js`
Expected: byte-identical to the block above (if PR6/PR8 touched the array, the file wins — copy from the file).

- [ ] **Step 5: README — sync the Directory Structure file tree**

In `forge-shell/README.md`, under `## Directory Structure`, replace the js/ portion of the tree (which lists 8 files including `productivity.js` and omits ~20 real ones) so the fence reads:

````markdown
```
forge-shell/
├── app/
│   ├── index.html              # SPA entry point
│   ├── css/
│   │   ├── theme.css           # CSS custom properties for theming
│   │   ├── shell.css           # Core shell layout
│   │   ├── components.css      # Shared components
│   │   ├── tasks-memory.css    # Tasks + Memory shared styles (formerly productivity.css)
│   │   └── {plugin}.css        # Plugin-specific styles
│   └── js/
│       ├── fs-adapter.js       # ForgeFS backend adapter (Tauri / browser / server)
│       ├── md.helpers.js       # Markdown renderer (UMD, node-tested)
│       ├── utils.js            # Shared utilities (YAML, theme, toast, confirm)
│       ├── card-data.js        # Shared card parsing
│       ├── modal.helpers.js    # Modal dismissal contract (UMD, node-tested)
│       ├── feedback.helpers.js # Failure-feedback logic (UMD, node-tested)
│       ├── card-write.js       # Shared card write service
│       ├── status-menu.js      # Shared inline status menu
│       ├── sidebar.helpers.js  # Sidebar logic (UMD, node-tested)
│       ├── sidebar.js          # Shared sidebar component
│       ├── shell.helpers.js    # Watcher grouping logic (UMD, node-tested)
│       ├── shell.js            # Shell core + ForgeShellView controller
│       ├── shell-palette.helpers.js # Cmd+K palette logic (UMD, node-tested)
│       ├── shell-palette.js    # Cmd+K palette (shell chrome)
│       ├── cognitive-forge.js  # CognitiveForgeView controller
│       ├── product-forge.helpers.js # Product Forge logic (UMD, node-tested)
│       ├── product-forge.js    # ProductForgeLocalView controller
│       ├── tasks.helpers.js    # Task frontmatter round-trip (UMD, node-tested)
│       ├── tasks.js            # TasksView controller
│       ├── memory.js           # MemoryView controller
│       ├── roadmap.helpers.js  # Roadmap logic (UMD, node-tested)
│       ├── roadmap.js          # RoadmapView controller
│       ├── rovo-agent-forge.js # RovoAgentForgeView controller
│       ├── report-forge.js     # ReportForgeView controller
│       ├── audio-forge.helpers.js # Audio Forge logic (UMD, node-tested)
│       ├── audio-forge.reducer.js # Audio Forge state reducer (UMD, node-tested)
│       └── audio-forge.js      # AudioForgeView controller
```
````

Cross-check before committing — Run: `ls app/js/`
Expected: exactly the 27 files listed above (19 pre-stack files minus `productivity.js`, plus the 9 modules added by PRs 1–8). If PR6/PR8 named a file differently, the disk wins — adjust the tree, never the code. (The css/ section keeps the `{plugin}.css` placeholder; the one named addition is `tasks-memory.css` since it no longer follows the `{plugin}` pattern.)

- [ ] **Step 6: Grep verification**

Run: `grep -ni "productivity" README.md STYLE_GUIDE.md` (from `forge-shell/`)
Expected: hits only in the sanctioned exception/provenance sentences — the STYLE_GUIDE exception paragraph ("formerly `productivity.css`" / "retired … Productivity view" if worded so) and the README tree's "(formerly productivity.css)" annotation. No table row lists Productivity as a plugin; no file tree lists `productivity.js` or `productivity.css` as files.

Run: `git diff --stat HEAD -- ../docs/`
Expected: no output — dated historical docs untouched.

- [ ] **Step 7: Commit**

```bash
git add STYLE_GUIDE.md README.md
git commit -m "docs(forge-shell): sync STYLE_GUIDE and README after Productivity removal"
```

---

### Task 9.6: Full-suite verification + open PR 9

**Files:**
- No file changes — verification and PR creation only.

**Interfaces:**
- Consumes: the complete PR1–PR9 stack.
- Produces: PR 9/9 against `main`.

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from `forge-shell/`)
Expected: everything passing, including all new suites the stack added (tasks.helpers, md.helpers, modal.helpers, feedback.helpers, card-write, status-menu, shell.helpers, shell-palette.helpers, plus the extended pre-existing suites). This PR adds **no** new tests — the count must match PR8's tip exactly, with zero failures and zero modifications to existing tests.

- [ ] **Step 2: Run the acceptance grep checklist (paste output into the PR description)**

Run (from repo root `the-forge/`):

```bash
grep -rni productivity forge-shell/app forge-shell/test forge-shell/server.js forge-shell/src-tauri
grep -ni productivity forge-shell/README.md forge-shell/STYLE_GUIDE.md
grep -n "tasks-memory.css" forge-shell/app/index.html
grep -n "TASKS.md" forge-shell/app/js/shell.js
```

Expected: (1) hits only in `forge-shell/app/css/tasks-memory.css`'s header comment; (2) only the sanctioned exception/provenance sentences; (3) exactly one link tag; (4) no output.

- [ ] **Step 3: Three-runtime smoke checklist**

| Check | Server (cmux) `npm run serve` → `http://127.0.0.1:4173` | Chrome FSA (real Chrome tab, `showDirectoryPicker`) | Tauri `npm run tauri:dev` |
|---|---|---|---|
| Boot: select project, no console errors, no `productivity.css` 404, `tasks-memory.css` 200 | required | required | required |
| Home view shows 8 plugin status cards | required | required | required |
| Tasks: all six sub-views; timeline bars red/orange/blue (`prod-tl-*`); workload pills tinted (`prod-wl-status-*`); board drag shows whole-column highlight; save flashes status pill | required | required | required |
| Memory: tabs, cards, file modal open/edit/save; markdown renders via `rendered-body` (as landed by PR2) | required | required | required |
| Dark theme toggle: timeline bars + workload pills keep dark-variant colors | required | required | required |
| No TASKS.md read on directory open (DevTools Network/Console) | required | required | required |
| Watcher: touch a file under `tasks/` → Tasks view auto-refreshes with summary toast (as landed by PR6) | n/a (Tauri-only) | n/a (Tauri-only) | required |
| Cmd+K palette still opens and navigates (as landed by PR8 — regression guard for the shell.js hunk) | required | required | required |

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin ux-program/pr-9-productivity-cleanup
gh pr create --base main --title "forge-shell: remove Productivity ghost — delete dead controller, rename CSS, sync docs" --body "Deletes the never-loaded productivity.js (2,049 lines, zero salvage), renames productivity.css to tasks-memory.css (git mv, blame preserved) with a keep-list-guarded purge of rules only dead code used, removes the unread productivity probe from Shell._onDirectoryReady, and syncs STYLE_GUIDE.md/README.md (Tasks+Memory rows, sanctioned prod- prefix exception, accurate plugin table and file tree).
Five severable commits: delete js -> rename+href -> purge -> shell probe -> docs; dead-class verification output for the merged tree is pasted below.
No behavior change; no new tests (deletion/rename only).
Stacked PR 9/9 - merge after PR8"
```

Expected: PR opens against `main` with the stacked-merge note; CI (if any) green.
