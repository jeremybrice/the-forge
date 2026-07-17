# Design Plans Collapsed-by-Default Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Design Plans sidebar tree load with all initiatives collapsed by default, persist the user's expand/collapse choices to localStorage, and auto-reveal (expand + scroll + flash) a doc's initiative when it is selected from search results.

**Architecture:** Pure storage-shape logic (`parseExpanded`, `pruneExpanded`) lives in `design-plans.helpers.js` (UMD, Node-tested); DOM/controller changes live in `design-plans.js`; a flash animation is added to `design-plans.css` mirroring the PFL `pfl-flash-new` pattern. State flips from `state.collapsed` (default open) to `state.expanded` (default collapsed) so only expanded keys are stored.

**Tech Stack:** Vanilla JS (no build step), `node --test`, localStorage (try/catch-guarded, same pattern as the existing `forge-shell-docs-root`).

**Spec:** `docs/superpowers/specs/2026-07-17-design-plans-collapsed-default-design.md`

## Global Constraints

- All commands run from the `forge-shell/` directory unless noted.
- Full test suite must stay green: `npm test` (node --test; baseline 0 failures).
- Single helper test file: `forge-shell/test/design-plans.helpers.test.js`.
- CSS prefix is `dp-`; no mobile/responsive CSS; no new dependencies.
- Storage key is exactly `forge-shell-dp-expanded`; value is a JSON array of initiative key strings (`date|slug`).
- All `localStorage` access is wrapped in try/catch (existing `readDocsRoot`/`writeDocsRoot` pattern); corrupt stored JSON is treated as an empty set.
- Do not reset `state.expanded` in `destroy()` or `refresh()` — persistence is the point.

---

## Task 1: Helpers — parseExpanded + pruneExpanded

**Files:**
- Modify: `forge-shell/app/js/design-plans.helpers.js`
- Test: `forge-shell/test/design-plans.helpers.test.js`
- Docs (folded into this task's commit): `docs/superpowers/specs/2026-07-17-design-plans-collapsed-default-design.md`, `docs/superpowers/plans/2026-07-17-design-plans-collapsed-default.md`

**Interfaces:**
- Produces: `parseExpanded(raw) → string[]` and `pruneExpanded(keys, validKeys) → string[]`, exported on `window.DesignPlansHelpers` / `module.exports`. Task 2 consumes both.

- [ ] **Step 1: Write the failing tests**

Append to `forge-shell/test/design-plans.helpers.test.js`:

```js
/* ── parseExpanded ── */

test('parseExpanded: valid JSON array of strings round-trips', () => {
  assert.deepEqual(
    H.parseExpanded('["2026-07-09|a","2026-07-08|b"]'),
    ['2026-07-09|a', '2026-07-08|b']
  );
});

test('parseExpanded: null, empty, non-string → []', () => {
  assert.deepEqual(H.parseExpanded(null), []);
  assert.deepEqual(H.parseExpanded(''), []);
  assert.deepEqual(H.parseExpanded(undefined), []);
  assert.deepEqual(H.parseExpanded(42), []);
});

test('parseExpanded: invalid JSON → []', () => {
  assert.deepEqual(H.parseExpanded('{oops'), []);
  assert.deepEqual(H.parseExpanded('["unterminated'), []);
});

test('parseExpanded: non-array JSON → []', () => {
  assert.deepEqual(H.parseExpanded('{"a":true}'), []);
  assert.deepEqual(H.parseExpanded('"just a string"'), []);
  assert.deepEqual(H.parseExpanded('12'), []);
});

test('parseExpanded: filters empty/non-string entries and dedupes', () => {
  assert.deepEqual(
    H.parseExpanded('["a","",3,null,"b","a"]'),
    ['a', 'b']
  );
});

/* ── pruneExpanded ── */

test('pruneExpanded: drops keys not in the valid set, preserves order', () => {
  assert.deepEqual(
    H.pruneExpanded(['b|x', 'a|y', 'c|z'], ['a|y', 'c|z']),
    ['a|y', 'c|z']
  );
});

test('pruneExpanded: dedupes and ignores non-string entries', () => {
  assert.deepEqual(
    H.pruneExpanded(['a', 'a', 3, null, 'b'], ['a', 'b']),
    ['a', 'b']
  );
});

test('pruneExpanded: non-array inputs → []', () => {
  assert.deepEqual(H.pruneExpanded(null, ['a']), []);
  assert.deepEqual(H.pruneExpanded(['a'], null), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/design-plans.helpers.test.js`
Expected: FAIL — `H.parseExpanded is not a function` / `H.pruneExpanded is not a function`.

- [ ] **Step 3: Implement the helpers**

In `forge-shell/app/js/design-plans.helpers.js`, add after `rankDocs` (before the `return { ... }` export block):

```js
  function parseExpanded(raw) {
    if (typeof raw !== 'string' || raw === '') return [];
    var val;
    try { val = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(val)) return [];
    var out = [];
    val.forEach(function (v) {
      if (typeof v === 'string' && v !== '' && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  function pruneExpanded(keys, validKeys) {
    var valid = {};
    (Array.isArray(validKeys) ? validKeys : []).forEach(function (k) { valid[k] = true; });
    var out = [];
    (Array.isArray(keys) ? keys : []).forEach(function (k) {
      if (typeof k === 'string' && valid[k] && out.indexOf(k) === -1) out.push(k);
    });
    return out;
  }
```

Add both to the export object:

```js
    rankDocs: rankDocs,
    parseExpanded: parseExpanded,
    pruneExpanded: pruneExpanded,
    DEFAULT_CLUSTERS: DEFAULT_CLUSTERS
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/design-plans.helpers.test.js`
Expected: PASS (all tests, 0 failures).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 6: Commit (includes spec + plan docs)**

```bash
git add forge-shell/app/js/design-plans.helpers.js forge-shell/test/design-plans.helpers.test.js docs/superpowers/specs/2026-07-17-design-plans-collapsed-default-design.md docs/superpowers/plans/2026-07-17-design-plans-collapsed-default.md
git commit -m "feat(design-plans): expanded-set helpers + spec/plan for collapsed-default tree"
```

---

## Task 2: Controller — collapsed default + persistence

**Files:**
- Modify: `forge-shell/app/js/design-plans.js`

**Interfaces:**
- Consumes: `H.parseExpanded(raw) → string[]`, `H.pruneExpanded(keys, validKeys) → string[]` from Task 1.
- Produces: module-level `state.expanded` (object map, initiativeKey → true) and `readExpanded()` / `writeExpanded()` storage helpers; Task 3 mutates `state.expanded` and calls `writeExpanded()` from the search-results click handler.

- [ ] **Step 1: Flip state to an expanded-set and add storage helpers**

In `forge-shell/app/js/design-plans.js`, replace the state declaration (lines 16-22):

```js
  var state = {
    docsRoot: null, docs: [], initiatives: [],
    selectedKey: null, selectedType: null,
    query: '', skipped: 0,
    filters: { status: [], type: [], topic: [] },
    expanded: {},        // initiativeKey -> true (default: collapsed)
    pendingReveal: null  // { key, type } consumed by _renderTree
  };
```

Add the storage key next to `DOCS_KEY` (line 9-10 area):

```js
  var EXPANDED_KEY = 'forge-shell-dp-expanded';
```

Add storage helpers after `writeDocsRoot` (after line 29):

```js
  function readExpanded() {
    try {
      var out = {};
      H.parseExpanded(localStorage.getItem(EXPANDED_KEY)).forEach(function (k) { out[k] = true; });
      return out;
    } catch (e) { return {}; }
  }
  function writeExpanded() {
    try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(Object.keys(state.expanded))); } catch (e) { /* ignore */ }
  }
```

- [ ] **Step 2: Hydrate expanded state in init()**

In `init()`, immediately after `state.docsRoot = readDocsRoot();` (line 36) add:

```js
      state.expanded = readExpanded();
```

- [ ] **Step 3: Flip the open check in _renderTree()**

In `_renderTree()`, replace `var open = !state.collapsed[init.key];` (line 211) with:

```js
        var open = !!state.expanded[init.key];
```

- [ ] **Step 4: Persist on toggle**

In `_bindTreeEvents()`, replace the toggle handler body (lines 382-386):

```js
        el.addEventListener('click', function () {
          var key = el.getAttribute('data-dp-toggle');
          if (state.expanded[key]) delete state.expanded[key];
          else state.expanded[key] = true;
          writeExpanded();
          ctrl._renderTree();
        });
```

- [ ] **Step 5: Prune stale keys after each load**

In `_loadDocs()`, immediately after `state.initiatives = H.groupInitiatives(docs);` (line 175) add:

```js
      var validKeys = state.initiatives.map(function (i) { return i.key; });
      var pruned = H.pruneExpanded(Object.keys(state.expanded), validKeys);
      if (pruned.length !== Object.keys(state.expanded).length) {
        state.expanded = {};
        pruned.forEach(function (k) { state.expanded[k] = true; });
        writeExpanded();
      }
```

- [ ] **Step 6: Verify no remaining references to state.collapsed**

Run: `grep -n "collapsed" app/js/design-plans.js`
Expected: no matches (the `dp-members hidden` class toggle in `_renderTree` is class-based, not state-based — only `state.collapsed` references must be gone).

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 8: Commit**

```bash
git add forge-shell/app/js/design-plans.js
git commit -m "feat(design-plans): collapsed-by-default tree with persisted expanded-set"
```

---

## Task 3: Search reveal — expand, scroll, flash

**Files:**
- Modify: `forge-shell/app/js/design-plans.js`
- Modify: `forge-shell/app/css/design-plans.css`

**Interfaces:**
- Consumes: `state.expanded`, `writeExpanded()`, `state.pendingReveal` from Task 2.
- Produces: `.dp-flash-new` CSS class (consumed by the controller's reveal path).

- [ ] **Step 1: Expand + persist + flag reveal on search-result click**

In `_renderSearchResults()`, replace the click handler (lines 352-357):

```js
        el.addEventListener('click', function () {
          state.selectedKey = el.getAttribute('data-dp-select');
          state.selectedType = el.getAttribute('data-dp-type');
          state.expanded[state.selectedKey] = true;
          writeExpanded();
          state.pendingReveal = { key: state.selectedKey, type: state.selectedType };
          ctrl._renderTree();   // re-highlights; reveals if tree visible
          ctrl._renderDetail();
        });
```

- [ ] **Step 2: Consume pendingReveal in _renderTree()**

In `_renderTree()`, immediately after `this._bindTreeEvents();` (line 236) add:

```js
      if (state.pendingReveal) {
        var pr = state.pendingReveal;
        state.pendingReveal = null;
        var row = treeEl.querySelector('[data-dp-select="' + pr.key + '"][data-dp-type="' + pr.type + '"]');
        if (row) {
          row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          row.classList.add('dp-flash-new');
          setTimeout(function () { row.classList.remove('dp-flash-new'); }, 1500);
        }
      }
```

Note: `_renderTree()` early-returns into `_renderSearchResults()` while a query is present, so this block only runs when the tree is actually rendered — the flag set in Step 1 is consumed the next time the tree becomes visible (e.g. after the user clears the query).

- [ ] **Step 3: Add the flash animation**

Append to `forge-shell/app/css/design-plans.css`:

```css
/* Brief flash applied to a member row when search reveal selects it.
   1.5s, fades out — class removed by setTimeout in JS. */
@keyframes dp-flash-new-keyframes {
  0%   { background: var(--accent-light); }
  100% { background: transparent; }
}
.dp-flash-new {
  animation: dp-flash-new-keyframes 1.5s ease-out;
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/design-plans.js forge-shell/app/css/design-plans.css
git commit -m "feat(design-plans): search selection auto-reveals doc in tree (expand + scroll + flash)"
```

---

## Task 4: Whole-branch review + manual QA handoff

**Files:** none changed (review only).

- [ ] **Step 1: Re-read the diff**

Run: `git diff main...HEAD --stat && git log --oneline main..HEAD`
Expected: 3 commits; changes confined to `design-plans.js`, `design-plans.helpers.js`, `design-plans.css`, the helper test file, and the two docs.

- [ ] **Step 2: Review the full diff for regressions**

Run: `git diff main...HEAD -- forge-shell/`
Check: no stray references to `state.collapsed`; storage access try/catch-guarded; `destroy()`/`refresh()` do not reset `state.expanded`; no mobile CSS; no unrelated changes.

- [ ] **Step 3: Final full suite**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 4: Manual QA checklist (for the reviewer/user in the browser)**

1. Cold start with cleared storage → all initiatives collapsed.
2. Expand two initiatives → reload app → those two remain expanded, rest collapsed.
3. Collapse one back → persists collapsed on next load.
4. Search → click a result in a collapsed initiative → clear the query → tree shows that initiative expanded, member row scrolled into view and flashed.
5. Manual refresh and file-watcher refresh preserve expansion state.
6. Rename/delete a spec file → its key is pruned; no errors.
