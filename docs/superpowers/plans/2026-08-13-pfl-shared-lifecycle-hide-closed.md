# Shared Lifecycle + Hide-Closed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Product Forge defaults to hiding closed work, initiatives/epics/stories share one status list, and closing a parent overwrites every descendant after confirm.

**Architecture:** Pure hide/cascade logic lives in `product-forge.helpers.js` (UMD, `node --test`). `card-data.js` publishes the same five-value menu list for initiative/epic/story. `FilterPanel` prunes the tree/recents/pins when `showClosed` is false. Edit-modal save confirms and writes descendants for terminal status changes. forge-lib schemas accept the five plus aliases.

**Tech Stack:** Vanilla JS (UMD helpers), `node --test`, JSON Schema (draft-07), Tauri/browser File System writes via existing `ForgeUtils.FS`.

## Global Constraints

- Canonical menu statuses are exactly `Draft`, `In Progress`, `Completed`, `Cancelled`, `Superseded` — same array for initiative, epic, and story.
- Closed aliases (hidden by default): `completed`, `complete`, `done`, `cancelled`, `canceled`, `superseded`, `archived` (match case-insensitive).
- Terminal (cascade) aliases: `completed`, `complete`, `done`, `cancelled`, `canceled`, `superseded`.
- Open aliases (visible, not in menus): `Submitted`, `Approved`, `Planning`, `Ready`, `On Hold`, `In Review`, `Testing`, `Blocked`.
- Search does not hide closed cards. Tree, Recents, and Pins do.
- Cascade overwrites every descendant. Reopen and active-status edits do not cascade.
- Confirm cancel writes nothing, including the parent.
- `FilterPanel.clearAll` does not reset `showClosed`.
- `localStorage` key is `pfl-show-closed` with values `'1'` / `'0'`. Default when missing or unreadable: hide closed.
- Do not add a `Deleted` status. Do not change intake/checkpoint/decision/release-note enums. Do not implement parent roll-up.
- Follow existing PFL patterns: `ESC()`, `ForgeUtils.Confirm.show`, `ForgeUtils.FS.writeFile`, `CardParser.serialize`.
- Desktop-only. Do not reintroduce `@media (max-width: 768px)`.

---

### Task 1: Lifecycle helpers + tests

**Files:**
- Modify: `forge-shell/app/js/product-forge.helpers.js`
- Test: `forge-shell/test/product-forge.helpers.test.js`

**Interfaces:**
- Consumes: existing card shape `{ filename, frontmatter: { type, title, parent, status, children } }`
- Produces: `SHARED_LIFECYCLE`, `isClosedStatus(status)`, `isTerminalStatus(status)`, `isRelatedChild(parentCard, childCard)`, `collectDescendants(rootCard, allCards)`, `hasClosedAncestor(card, storeGet)`, `cardHiddenByClosed(card, storeGet)`, `pruneClosedHierarchy(hierarchy)`, `summarizeDescendants(descendants)`

- [ ] **Step 1: Write the failing tests** (append after the existing `cardMatchesStatusFilters` tests)

```js
/* ── shared lifecycle ── */

test('SHARED_LIFECYCLE is the five canonical statuses', () => {
  assert.deepEqual(H.SHARED_LIFECYCLE, [
    'Draft', 'In Progress', 'Completed', 'Cancelled', 'Superseded'
  ]);
});

test('isClosedStatus: canonical terminals and aliases, case-insensitive', () => {
  ['Completed', 'complete', 'DONE', 'Cancelled', 'canceled', 'Superseded', 'archived'].forEach((s) => {
    assert.equal(H.isClosedStatus(s), true, s);
  });
  ['Draft', 'In Progress', 'Ready', 'Approved', 'Planning', '', null, undefined].forEach((s) => {
    assert.equal(H.isClosedStatus(s), false, String(s));
  });
});

test('isTerminalStatus: Complete/Done cascade; Archived does not', () => {
  assert.equal(H.isTerminalStatus('Completed'), true);
  assert.equal(H.isTerminalStatus('Done'), true);
  assert.equal(H.isTerminalStatus('Complete'), true);
  assert.equal(H.isTerminalStatus('Cancelled'), true);
  assert.equal(H.isTerminalStatus('Superseded'), true);
  assert.equal(H.isTerminalStatus('Archived'), false);
  assert.equal(H.isTerminalStatus('In Progress'), false);
});

test('isRelatedChild: parent field or children array', () => {
  const init = card('ship', 'initiative', 'Ship');
  const viaParent = card('e1', 'epic', 'E', 'ship');
  const viaChildren = card('e2', 'epic', 'E2');
  init.frontmatter.children = ['e2'];
  assert.equal(H.isRelatedChild(init, viaParent), true);
  assert.equal(H.isRelatedChild(init, viaChildren), true);
  assert.equal(H.isRelatedChild(init, card('e3', 'epic', 'E3', 'other')), false);
});

test('collectDescendants: initiative gathers epics and their stories', () => {
  const init = card('ship', 'initiative', 'Ship');
  const epic = card('e1', 'epic', 'E', 'ship');
  const story = card('s1', 'story', 'S', 'e1');
  const other = card('s2', 'story', 'Other', 'other-epic');
  const desc = H.collectDescendants(init, [init, epic, story, other]);
  assert.deepEqual(desc.map((c) => c.filename).sort(), ['e1', 's1']);
});

test('collectDescendants: epic gathers stories; story gathers none', () => {
  const epic = card('e1', 'epic', 'E');
  epic.frontmatter.children = ['s1'];
  const story = card('s1', 'story', 'S');
  assert.deepEqual(H.collectDescendants(epic, [epic, story]).map((c) => c.filename), ['s1']);
  assert.deepEqual(H.collectDescendants(story, [epic, story]), []);
});

test('hasClosedAncestor / cardHiddenByClosed walk parent chain', () => {
  const init = card('ship', 'initiative', 'Ship', null, 'Completed');
  const epic = card('e1', 'epic', 'E', 'ship', 'In Progress');
  const story = card('s1', 'story', 'S', 'e1', 'Draft');
  const map = { ship: init, e1: epic, s1: story };
  const get = (fn) => map[fn] || null;
  assert.equal(H.hasClosedAncestor(story, get), true);
  assert.equal(H.cardHiddenByClosed(story, get), true);
  assert.equal(H.cardHiddenByClosed(init, get), true);
  init.frontmatter.status = 'In Progress';
  assert.equal(H.cardHiddenByClosed(story, get), false);
  assert.equal(H.cardHiddenByClosed(init, get), false);
});

test('pruneClosedHierarchy drops a closed initiative and its subtree', () => {
  const init = card('ship', 'initiative', 'Ship', null, 'Completed');
  const live = card('live', 'initiative', 'Live', null, 'Draft');
  const epic = card('e1', 'epic', 'E', 'ship', 'In Progress');
  const hierarchy = {
    tree: [
      { card: init, children: [{ card: epic, children: [] }] },
      { card: live, children: [] }
    ],
    orphanEpics: [],
    orphanStories: [],
    intakes: [],
    checkpoints: [],
    decisions: [],
    releaseNotes: []
  };
  const pruned = H.pruneClosedHierarchy(hierarchy);
  assert.equal(pruned.tree.length, 1);
  assert.equal(pruned.tree[0].card.filename, 'live');
});

test('summarizeDescendants counts epics and stories', () => {
  const s = H.summarizeDescendants([
    card('e1', 'epic'), card('e2', 'epic'), card('s1', 'story')
  ]);
  assert.deepEqual(s, { epics: 2, stories: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd forge-shell && node --test test/product-forge.helpers.test.js`
Expected: FAIL because `H.SHARED_LIFECYCLE` / new functions are undefined.

- [ ] **Step 3: Implement the helpers** in `product-forge.helpers.js` and export them on the returned object.

```js
var SHARED_LIFECYCLE = ['Draft', 'In Progress', 'Completed', 'Cancelled', 'Superseded'];
var CLOSED = { completed: 1, complete: 1, done: 1, cancelled: 1, canceled: 1, superseded: 1, archived: 1 };
var TERMINAL = { completed: 1, complete: 1, done: 1, cancelled: 1, canceled: 1, superseded: 1 };

function norm(status) {
  return status == null ? '' : String(status).toLowerCase();
}
function isClosedStatus(status) { return !!CLOSED[norm(status)]; }
function isTerminalStatus(status) { return !!TERMINAL[norm(status)]; }
function isRelatedChild(parentCard, childCard) {
  if (!parentCard || !childCard) return false;
  var childFm = childCard.frontmatter || {};
  var parentFm = parentCard.frontmatter || {};
  if (childFm.parent === parentCard.filename) return true;
  return Array.isArray(parentFm.children) && parentFm.children.indexOf(childCard.filename) !== -1;
}
function collectDescendants(rootCard, allCards) {
  if (!rootCard || !Array.isArray(allCards)) return [];
  var type = (rootCard.frontmatter || {}).type;
  var result = [];
  if (type === 'initiative') {
    var epics = allCards.filter(function (c) {
      return (c.frontmatter || {}).type === 'epic' && isRelatedChild(rootCard, c);
    });
    result = result.concat(epics);
    epics.forEach(function (epic) {
      allCards.forEach(function (c) {
        if ((c.frontmatter || {}).type === 'story' && isRelatedChild(epic, c)) result.push(c);
      });
    });
  } else if (type === 'epic') {
    allCards.forEach(function (c) {
      if ((c.frontmatter || {}).type === 'story' && isRelatedChild(rootCard, c)) result.push(c);
    });
  }
  return result;
}
function hasClosedAncestor(card, storeGet) {
  if (!card || typeof storeGet !== 'function') return false;
  var seen = {};
  var cursor = card;
  var safety = 16;
  while (cursor && safety-- > 0) {
    var parentFn = cursor.frontmatter && cursor.frontmatter.parent;
    if (!parentFn || seen[parentFn]) break;
    seen[parentFn] = true;
    var parent = storeGet(parentFn);
    if (!parent) break;
    if (isClosedStatus(parent.frontmatter && parent.frontmatter.status)) return true;
    cursor = parent;
  }
  return false;
}
function cardHiddenByClosed(card, storeGet) {
  if (!card) return false;
  if (isClosedStatus(card.frontmatter && card.frontmatter.status)) return true;
  return hasClosedAncestor(card, storeGet);
}
function pruneClosedHierarchy(hierarchy) {
  hierarchy = hierarchy || {};
  function keepEpic(en) {
    if (isClosedStatus(en.card && en.card.frontmatter && en.card.frontmatter.status)) return null;
    return {
      card: en.card,
      children: (en.children || []).filter(function (s) {
        return !isClosedStatus((s.frontmatter || s).status);
      })
    };
  }
  return {
    tree: (hierarchy.tree || []).filter(function (n) {
      return !isClosedStatus(n.card && n.card.frontmatter && n.card.frontmatter.status);
    }).map(function (n) {
      return {
        card: n.card,
        children: (n.children || []).map(keepEpic).filter(Boolean)
      };
    }),
    orphanEpics: (hierarchy.orphanEpics || []).map(keepEpic).filter(Boolean),
    orphanStories: (hierarchy.orphanStories || []).filter(function (s) {
      return !isClosedStatus((s.frontmatter || s).status);
    }),
    intakes: hierarchy.intakes,
    checkpoints: hierarchy.checkpoints,
    decisions: hierarchy.decisions,
    releaseNotes: hierarchy.releaseNotes,
    pinned: hierarchy.pinned,
    recents: hierarchy.recents
  };
}
function summarizeDescendants(descendants) {
  var epics = 0, stories = 0;
  (descendants || []).forEach(function (c) {
    var t = (c.frontmatter || {}).type;
    if (t === 'epic') epics++;
    else if (t === 'story') stories++;
  });
  return { epics: epics, stories: stories };
}
```

Export every new name next to `cardMatchesStatusFilters`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd forge-shell && node --test test/product-forge.helpers.test.js`
Expected: PASS, existing pin/search/breadcrumb/filter tests still green.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/product-forge.helpers.js forge-shell/test/product-forge.helpers.test.js
git commit -m "$(cat <<'EOF'
feat(pfl): add shared lifecycle and hide-closed helpers

Pure functions for the five-value card lifecycle, closed/terminal
recognition (including legacy aliases), descendant collection, and
hierarchy prune. Tested with node --test.
EOF
)"
```

---

### Task 2: Unify STATUS_OPTIONS + schemas + docs

**Files:**
- Modify: `forge-shell/app/js/card-data.js` (`STATUS_OPTIONS`, `getStatusColor`)
- Modify: `forge-lib/schemas/initiative.json`, `epic.json`, `story.json`
- Modify: `forge-lib/README.md` (status table + create examples)
- Modify: `product-forge/agents/forge-epic.md` (default status `Draft`)
- Modify: `docs/DECISION_LOG.md`

**Interfaces:**
- Consumes: Task 1 `SHARED_LIFECYCLE` (duplicated in `card-data.js` because that file loads before helpers)
- Produces: `CardData.STATUS_OPTIONS.initiative === epic === story ===` the five canonical values

- [ ] **Step 1: Change `STATUS_OPTIONS` and add `completed` to `getStatusColor`**

```js
const SHARED_LIFECYCLE = ['Draft','In Progress','Completed','Cancelled','Superseded'];
const STATUS_OPTIONS = {
  initiative: SHARED_LIFECYCLE.slice(),
  epic: SHARED_LIFECYCLE.slice(),
  story: SHARED_LIFECYCLE.slice(),
  intake: ['Draft','Complete','Handed Off'],
  checkpoint: ['Current','Superseded','Archived'],
  decision: ['Active','Revised','Reversed'],
  'release-note': ['Draft','Published','Internal Only']
};
```

In `getStatusColor` map add `'completed': 'var(--status-green)'`.

- [ ] **Step 2: Set all three schema `status.enum` arrays to**

```json
["Draft", "In Progress", "Completed", "Cancelled", "Superseded",
 "Submitted", "Approved", "Planning", "Ready", "Complete", "Done",
 "On Hold", "In Review", "Testing", "Blocked", "Archived"]
```

- [ ] **Step 3: Update docs**

`forge-lib/README.md`:
- Epic create example status `"In Progress"` (was `"Planning"`).
- Story create example status `"Draft"` (was `"Ready"`).
- Table rows for initiative/epic/story: `Draft, In Progress, Completed, Cancelled, Superseded`.

`product-forge/agents/forge-epic.md`: `status`: `"Draft"`.

`docs/DECISION_LOG.md` add an August 2026 section row pointing at `docs/superpowers/specs/2026-08-13-pfl-shared-lifecycle-hide-closed-design.md`.

- [ ] **Step 4: Run schema-touching tests**

Run: `cd forge-lib && python -m pytest tests/test_card_ops.py tests/test_relationship_ops.py tests/test_validator.py -q`
Expected: PASS (`Approved` / `Ready` remain in the alias half of the enum).

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/card-data.js forge-lib/schemas/initiative.json forge-lib/schemas/epic.json forge-lib/schemas/story.json forge-lib/README.md product-forge/agents/forge-epic.md docs/DECISION_LOG.md
git commit -m "$(cat <<'EOF'
feat: unify initiative/epic/story status vocabulary

Shell menus offer Draft / In Progress / Completed / Cancelled /
Superseded. Schemas accept those plus legacy aliases so existing
cards still validate.
EOF
)"
```

---

### Task 3: Hide-closed default + Show-closed toggle

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (`FilterPanel`, `_renderLayout`, `_renderTree`, toolbar bind)
- Modify: `forge-shell/app/css/product-forge.css` (optional empty-hint only; pressed state reuses `.rm-active`)

**Interfaces:**
- Consumes: `ProductForgeHelpers.pruneClosedHierarchy`, `cardHiddenByClosed`, `isClosedStatus`
- Produces: `FilterPanel.showClosed` (boolean), `FilterPanel.loadShowClosed()`, `FilterPanel.persistShowClosed()`, toolbar `data-pfl-action="toggle-closed"`

- [ ] **Step 1: Extend FilterPanel**

```js
showClosed: false,
loadShowClosed: function () {
  try {
    this.showClosed = window.localStorage.getItem('pfl-show-closed') === '1';
  } catch (e) {
    this.showClosed = false;
  }
},
persistShowClosed: function () {
  try {
    window.localStorage.setItem('pfl-show-closed', this.showClosed ? '1' : '0');
  } catch (e) { /* ignore */ }
},
```

Do not reset `showClosed` in `clearAll`.

- [ ] **Step 2: Prune in `_renderTree`**

After `hierarchy = FilterPanel.filterHierarchy(hierarchy)` (and after recents/pins are filtered by chips), if `!FilterPanel.showClosed` and `H.pruneClosedHierarchy`:

```js
hierarchy = H.pruneClosedHierarchy(hierarchy);
var get = function (fn) { return store.get(fn); };
filteredRecents = filteredRecents.filter(function (c) { return !H.cardHiddenByClosed(c, get); });
pinnedCards = pinnedCards.filter(function (c) { return !H.cardHiddenByClosed(c, get); });
```

Do **not** apply `cardHiddenByClosed` to search candidates.

- [ ] **Step 3: Toolbar button** in `_renderLayout`, immediately before the filter badge:

```html
<button class="btn-icon" data-pfl-action="toggle-closed" title="Show closed work" aria-pressed="false">
  <i class="fa-solid fa-box-archive"></i>
</button>
```

Bind click: flip `showClosed`, persist, `_syncClosedToggle()`, `_renderTree()`.
`ctrl.init` calls `FilterPanel.loadShowClosed()` then `_syncClosedToggle()`.
`_syncClosedToggle` sets `aria-pressed`, `title` (`Show closed work` / `Hide closed work`), and `rm-active`.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "$(cat <<'EOF'
feat(pfl): hide closed work by default

Tree, Recents, and Pins drop completed/cancelled/superseded cards
(and anything under a closed parent). Search still finds them.
Toolbar archive toggle reveals closed work and persists the choice.
EOF
)"
```

---

### Task 4: Cascade terminal status on edit-save

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (`editModal.open` status options, `editModal.save`)

**Interfaces:**
- Consumes: `isTerminalStatus`, `collectDescendants`, `summarizeDescendants`
- Produces: confirm-then-write path in `editModal.save`

- [ ] **Step 1: Prepend foreign current status** when building the status `<select>` so a `Done` story does not snap to empty/None.

```js
var statuses = (STATUS_OPTIONS[type] || []).slice();
if (fm.status && statuses.indexOf(fm.status) === -1) statuses.unshift(fm.status);
```

- [ ] **Step 2: Replace `editModal.save` with async cascade**

After `_getFormData()`, compare `this.originalCard.frontmatter.status` to `data.frontmatter.status`. If changed and `H.isTerminalStatus(newStatus)`:

```js
var descendants = H.collectDescendants(this.originalCard, store.all());
if (descendants.length) {
  var sum = H.summarizeDescendants(descendants);
  var details = sum.epics + ' epics, ' + sum.stories + ' stories → ' + ESC(newStatus) + '<br><br>';
  descendants.forEach(function (c) { details += '- ' + ESC(c.filename) + '.md<br>'; });
  var ok = await ForgeUtils.Confirm.show(
    'Close subtree',
    'This will mark every child with the same status.',
    details
  );
  if (!ok) return;
}
```

Write the parent as today. Then for each descendant: set `status` + `updated`, `CardParser.serialize`, `ForgeUtils.FS.writeFile` if a handle exists, `store.set` reparsed card. Count updated vs skipped. Toast `Card saved; N children updated` (append `, M skipped` when M > 0). Re-render tree + selected detail. Close modal.

If status did not change to terminal, keep the existing single-file save + `Card saved successfully` toast.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "$(cat <<'EOF'
feat(pfl): cascade terminal status down the card subtree

Closing an initiative or epic overwrites every related epic and
story after confirm. Cancel leaves the parent unchanged. Active
status edits do not cascade.
EOF
)"
```

---

### Task 5: Verify suite + spec commit

**Files:**
- Already created: `docs/superpowers/specs/2026-08-13-pfl-shared-lifecycle-hide-closed-design.md`
- Already created: `docs/superpowers/plans/2026-08-13-pfl-shared-lifecycle-hide-closed.md`

- [ ] **Step 1: Run the suites**

```bash
cd forge-shell && node --test
cd ../forge-lib && python -m pytest -q
```

Expected: all green.

- [ ] **Step 2: Commit the spec and plan if not already on the branch**

```bash
git add docs/superpowers/specs/2026-08-13-pfl-shared-lifecycle-hide-closed-design.md \
        docs/superpowers/plans/2026-08-13-pfl-shared-lifecycle-hide-closed.md
git commit -m "$(cat <<'EOF'
docs: spec and plan for shared card lifecycle and hide-closed
EOF
)"
```
