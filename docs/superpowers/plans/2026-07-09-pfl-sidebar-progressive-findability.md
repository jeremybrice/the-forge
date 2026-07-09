# PFL Sidebar Progressive Findability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Product Forge Local sidebar easier to find cards and stay oriented by shipping Approach A: type chips + More section, pins (max 3), context strip with structural jump, and search results mode.

**Architecture:** Pure logic (pin store, search rank, breadcrumb chain, recents de-dupe) lives in a new `product-forge.helpers.js` module that is both browser-loadable and Node-requireable (same UMD pattern as `sidebar.helpers.js`). `product-forge.js` owns DOM render/bind; `product-forge.css` owns chrome. No changes to `card-data.js`, filter panel mechanism, or recents algorithm beyond pin de-dupe.

**Tech Stack:** Vanilla JS (no framework), plain CSS, `node --test` for unit tests, `node --check` for syntax. Manual QA in the running app for DOM/scroll/sticky strip.

**Spec:** `docs/superpowers/specs/2026-07-09-pfl-sidebar-progressive-findability-design.md`

## Global Constraints

- Desktop-only: do **not** reintroduce `@media (max-width: 768px)` or any mobile CSS.
- Work hierarchy first: Initiatives stay top-level and default-visible; non-work types live under **More** (default collapsed).
- Search is **results list only** while query non-empty — never tree-prune + auto-expand (remove that path).
- Pin cap is **3**; at cap, block + toast `"Unpin one first"` (no silent replace).
- localStorage key for pins is exactly `pfl-pinned` (JSON string array of filenames).
- Type chips reuse existing `.pfl-type-chip` + `CardData.getTypeColor(type)`.
- Recents algorithm, NEW badges, prune horizon, toolbar “N new” stay unchanged except de-dupe with pins.
- Filter panel open/close and `FilterPanel` status logic stay unchanged; results must still honor status filters.
- Do not commit secrets; do not push unless asked.

## File Structure

| File | Responsibility |
|------|----------------|
| Create: `forge-shell/app/js/product-forge.helpers.js` | Pure helpers: `createPinStore`, `rankSearchResults`, `buildBreadcrumb`, `excludePinnedFromRecents`, `cardMatchesStatusFilters` |
| Create: `forge-shell/test/product-forge.helpers.test.js` | Unit tests for helpers |
| Modify: `forge-shell/app/index.html` | Load helpers script before `product-forge.js` |
| Modify: `forge-shell/app/js/product-forge.js` | Wire helpers into tree render, search results, context strip, pin UI, expandAncestors/More |
| Modify: `forge-shell/app/css/product-forge.css` | Context strip, results list, pin icon, More (no mobile rules) |

---

### Task 1: Pure helpers module + unit tests

**Files:**
- Create: `forge-shell/app/js/product-forge.helpers.js`
- Create: `forge-shell/test/product-forge.helpers.test.js`
- Modify: `forge-shell/app/index.html` (script tag only)

**Interfaces:**
- Produces (all exported on `module.exports` / `window.ProductForgeHelpers`):
  - `createPinStore(options?)` → pinStore object (see below)
  - `rankSearchResults(cards, query)` → `card[]` ranked
  - `buildBreadcrumb(card, storeGet)` → `{ segments: { label: string, filename: string|null }[] }`
  - `excludePinnedFromRecents(recents, pinnedFilenames)` → `card[]`
  - `cardMatchesStatusFilters(card, filters)` → `boolean`  
    where `filters` is `{ initiative_status: string[], epic_status: string[], story_status: string[] }`

**pinStore shape:**
```js
{
  filenames: string[],           // max 3, display order
  load(): void,                  // from storage
  save(): void,
  toggle(filename): 'added'|'removed'|'blocked',
  add(filename): 'added'|'blocked'|'exists',
  remove(filename): void,
  pruneMissing(existsFn): void,  // existsFn(filename) => boolean
  list(): string[]               // copy of filenames
}
```
`options`: `{ storage?: Storage-like, key?: string, max?: number, now?: () => number }`  
Default key `"pfl-pinned"`, max `3`. `storage` must implement `getItem`/`setItem` (inject memory object in tests).

- [ ] **Step 1: Write the failing tests**

Create `forge-shell/test/product-forge.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../app/js/product-forge.helpers.js');

function memoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function card(filename, type, title, parent, status) {
  return {
    filename: filename,
    frontmatter: {
      type: type,
      title: title || filename,
      parent: parent || null,
      status: status || 'proposed'
    }
  };
}

/* ── pinStore ── */

test('pinStore: load empty when key absent', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.deepEqual(store.list(), []);
});

test('pinStore: add up to 3 then block fourth', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.equal(store.add('a'), 'added');
  assert.equal(store.add('b'), 'added');
  assert.equal(store.add('c'), 'added');
  assert.equal(store.add('d'), 'blocked');
  assert.deepEqual(store.list(), ['a', 'b', 'c']);
});

test('pinStore: toggle removes existing', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a');
  assert.equal(store.toggle('a'), 'removed');
  assert.deepEqual(store.list(), []);
});

test('pinStore: toggle adds when under cap', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  assert.equal(store.toggle('x'), 'added');
  assert.deepEqual(store.list(), ['x']);
});

test('pinStore: toggle blocks when at cap and filename not pinned', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a'); store.add('b'); store.add('c');
  assert.equal(store.toggle('d'), 'blocked');
  assert.deepEqual(store.list(), ['a', 'b', 'c']);
});

test('pinStore: persist round-trip via storage', () => {
  const mem = memoryStorage();
  const a = H.createPinStore({ storage: mem });
  a.load();
  a.add('one');
  a.add('two');
  a.save();
  const b = H.createPinStore({ storage: mem });
  b.load();
  assert.deepEqual(b.list(), ['one', 'two']);
});

test('pinStore: pruneMissing drops unknown filenames', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('keep');
  store.add('gone');
  store.pruneMissing(function (fn) { return fn === 'keep'; });
  assert.deepEqual(store.list(), ['keep']);
});

test('pinStore: add existing returns exists and does not duplicate', () => {
  const store = H.createPinStore({ storage: memoryStorage() });
  store.load();
  store.add('a');
  assert.equal(store.add('a'), 'exists');
  assert.deepEqual(store.list(), ['a']);
});

test('pinStore: load ignores non-array JSON', () => {
  const mem = memoryStorage();
  mem.setItem('pfl-pinned', '{"nope":1}');
  const store = H.createPinStore({ storage: mem });
  store.load();
  assert.deepEqual(store.list(), []);
});

/* ── rankSearchResults ── */

test('rankSearchResults: empty query returns []', () => {
  assert.deepEqual(H.rankSearchResults([card('a', 'story', 'Alpha')], ''), []);
  assert.deepEqual(H.rankSearchResults([card('a', 'story', 'Alpha')], '   '), []);
});

test('rankSearchResults: starts-with title ranks before contains', () => {
  const cards = [
    card('z-mid', 'story', 'The Truck inventory'),
    card('a-start', 'story', 'Truck inventory waste'),
    card('b-file', 'story', 'Other', null)
  ];
  cards[2].filename = 'truck-notes';
  cards[2].frontmatter.title = 'Other';
  const ranked = H.rankSearchResults(cards, 'truck');
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].filename, 'a-start');
  assert.equal(ranked[1].filename, 'z-mid');
  assert.equal(ranked[2].filename, 'truck-notes');
});

test('rankSearchResults: case-insensitive; filename tie-break ASC within same rank', () => {
  const cards = [
    card('m-b', 'story', 'Alpha tool'),
    card('m-a', 'story', 'Alpha tool')
  ];
  const ranked = H.rankSearchResults(cards, 'alpha');
  assert.equal(ranked[0].filename, 'm-a');
  assert.equal(ranked[1].filename, 'm-b');
});

/* ── excludePinnedFromRecents ── */

test('excludePinnedFromRecents: drops pinned filenames', () => {
  const recents = [card('a', 'story'), card('b', 'story'), card('c', 'story')];
  const out = H.excludePinnedFromRecents(recents, ['b']);
  assert.deepEqual(out.map(function (c) { return c.filename; }), ['a', 'c']);
});

test('excludePinnedFromRecents: empty pins returns same cards', () => {
  const recents = [card('a', 'story')];
  const out = H.excludePinnedFromRecents(recents, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].filename, 'a');
});

/* ── buildBreadcrumb ── */

test('buildBreadcrumb: initiative only', () => {
  const init = card('init-1', 'initiative', 'Big Init');
  const get = function (fn) { return fn === 'init-1' ? init : null; };
  const bc = H.buildBreadcrumb(init, get);
  assert.equal(bc.segments.length, 1);
  assert.equal(bc.segments[0].label, 'Big Init');
  assert.equal(bc.segments[0].filename, 'init-1');
});

test('buildBreadcrumb: story with epic and initiative parents', () => {
  const init = card('init-1', 'initiative', 'Init');
  const epic = card('epic-1', 'epic', 'Epic', 'init-1');
  const story = card('story-1', 'story', 'Story', 'epic-1');
  const map = { 'init-1': init, 'epic-1': epic, 'story-1': story };
  const get = function (fn) { return map[fn] || null; };
  const bc = H.buildBreadcrumb(story, get);
  assert.deepEqual(bc.segments.map(function (s) { return s.label; }), ['Init', 'Epic', 'Story']);
  assert.deepEqual(bc.segments.map(function (s) { return s.filename; }), ['init-1', 'epic-1', 'story-1']);
});

test('buildBreadcrumb: orphan epic uses section prefix', () => {
  const epic = card('epic-o', 'epic', 'Lonely Epic', null);
  const get = function () { return null; };
  const bc = H.buildBreadcrumb(epic, get);
  assert.equal(bc.segments.length, 2);
  assert.equal(bc.segments[0].label, 'Orphan Epics');
  assert.equal(bc.segments[0].filename, null);
  assert.equal(bc.segments[1].label, 'Lonely Epic');
  assert.equal(bc.segments[1].filename, 'epic-o');
});

test('buildBreadcrumb: decision uses section label', () => {
  const d = card('dec-1', 'decision', 'Ship it');
  const bc = H.buildBreadcrumb(d, function () { return null; });
  assert.equal(bc.segments[0].label, 'Decisions');
  assert.equal(bc.segments[0].filename, null);
  assert.equal(bc.segments[1].label, 'Ship it');
  assert.equal(bc.segments[1].filename, 'dec-1');
});

/* ── cardMatchesStatusFilters ── */

test('cardMatchesStatusFilters: empty filters match all', () => {
  const c = card('s1', 'story', 'S', null, 'done');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: []
  }), true);
});

test('cardMatchesStatusFilters: story filtered by story_status', () => {
  const c = card('s1', 'story', 'S', null, 'done');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: ['proposed']
  }), false);
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: [], epic_status: [], story_status: ['done']
  }), true);
});

test('cardMatchesStatusFilters: intake always matches (no status filter key)', () => {
  const c = card('i1', 'intake', 'In', null, 'new');
  assert.equal(H.cardMatchesStatusFilters(c, {
    initiative_status: ['active'], epic_status: [], story_status: []
  }), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `forge-shell/`:
```bash
node --test test/product-forge.helpers.test.js
```
Expected: FAIL — `Cannot find module '../app/js/product-forge.helpers.js'` (or similar).

- [ ] **Step 3: Implement `product-forge.helpers.js`**

Create `forge-shell/app/js/product-forge.helpers.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Product Forge Helpers — pure logic for sidebar findability.
   Importable as <script> (window.ProductForgeHelpers) or Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProductForgeHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_KEY = 'pfl-pinned';
  var DEFAULT_MAX = 3;

  function createPinStore(options) {
    options = options || {};
    var storage = options.storage;
    var key = options.key || DEFAULT_KEY;
    var max = typeof options.max === 'number' ? options.max : DEFAULT_MAX;
    var filenames = [];

    function list() {
      return filenames.slice();
    }

    function load() {
      filenames = [];
      if (!storage || typeof storage.getItem !== 'function') return;
      try {
        var raw = storage.getItem(key);
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        filenames = parsed.filter(function (x) {
          return typeof x === 'string' && x.length > 0;
        }).slice(0, max);
      } catch (e) {
        filenames = [];
      }
    }

    function save() {
      if (!storage || typeof storage.setItem !== 'function') return;
      try {
        storage.setItem(key, JSON.stringify(filenames));
      } catch (e) {
        /* ignore quota / private mode */
      }
    }

    function add(filename) {
      if (!filename) return 'blocked';
      if (filenames.indexOf(filename) !== -1) return 'exists';
      if (filenames.length >= max) return 'blocked';
      filenames.push(filename);
      save();
      return 'added';
    }

    function remove(filename) {
      var i = filenames.indexOf(filename);
      if (i === -1) return;
      filenames.splice(i, 1);
      save();
    }

    function toggle(filename) {
      if (!filename) return 'blocked';
      if (filenames.indexOf(filename) !== -1) {
        remove(filename);
        return 'removed';
      }
      var r = add(filename);
      if (r === 'added') return 'added';
      return 'blocked';
    }

    function pruneMissing(existsFn) {
      if (typeof existsFn !== 'function') return;
      filenames = filenames.filter(function (fn) {
        return existsFn(fn);
      });
      save();
    }

    return {
      get filenames() { return filenames; },
      load: load,
      save: save,
      add: add,
      remove: remove,
      toggle: toggle,
      pruneMissing: pruneMissing,
      list: list
    };
  }

  function rankSearchResults(cards, query) {
    if (!Array.isArray(cards)) return [];
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];

    var ranked = [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var title = ((card.frontmatter && card.frontmatter.title) || '').toLowerCase();
      var fname = (card.filename || '').toLowerCase();
      var rank;
      if (title.indexOf(q) === 0) rank = 0;
      else if (title.indexOf(q) !== -1) rank = 1;
      else if (fname.indexOf(q) !== -1) rank = 2;
      else continue;
      ranked.push({ card: card, rank: rank, filename: card.filename || '' });
    }
    ranked.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.filename < b.filename) return -1;
      if (a.filename > b.filename) return 1;
      return 0;
    });
    return ranked.map(function (e) { return e.card; });
  }

  function excludePinnedFromRecents(recents, pinnedFilenames) {
    if (!Array.isArray(recents)) return [];
    var pinSet = {};
    if (Array.isArray(pinnedFilenames)) {
      for (var i = 0; i < pinnedFilenames.length; i++) {
        pinSet[pinnedFilenames[i]] = true;
      }
    }
    return recents.filter(function (card) {
      return !pinSet[card.filename];
    });
  }

  var SECTION_LABELS = {
    intake: 'Intakes',
    checkpoint: 'Checkpoints',
    decision: 'Decisions',
    'release-note': 'Release Notes'
  };

  function buildBreadcrumb(card, storeGet) {
    var segments = [];
    if (!card || !card.frontmatter) {
      return { segments: segments };
    }
    var type = card.frontmatter.type;
    var title = card.frontmatter.title || card.filename;

    if (type === 'initiative' || type === 'epic' || type === 'story') {
      var chain = [];
      var cursor = card;
      var safety = 16;
      while (cursor && safety-- > 0) {
        chain.unshift({
          label: (cursor.frontmatter && cursor.frontmatter.title) || cursor.filename,
          filename: cursor.filename
        });
        var parentFn = cursor.frontmatter && cursor.frontmatter.parent;
        if (!parentFn || typeof storeGet !== 'function') break;
        cursor = storeGet(parentFn);
      }
      if (type === 'epic' && !(card.frontmatter.parent) && chain.length === 1) {
        segments.push({ label: 'Orphan Epics', filename: null });
      }
      if (type === 'story' && !(card.frontmatter.parent) && chain.length === 1) {
        segments.push({ label: 'Orphan Stories', filename: null });
      }
      for (var i = 0; i < chain.length; i++) segments.push(chain[i]);
      return { segments: segments };
    }

    var section = SECTION_LABELS[type];
    if (section) {
      segments.push({ label: section, filename: null });
    }
    segments.push({ label: title, filename: card.filename });
    return { segments: segments };
  }

  function cardMatchesStatusFilters(card, filters) {
    filters = filters || {};
    var fm = (card && card.frontmatter) || {};
    var type = fm.type;
    var key = type === 'initiative' ? 'initiative_status'
            : type === 'epic' ? 'epic_status'
            : type === 'story' ? 'story_status'
            : null;
    if (!key) return true;
    var arr = filters[key] || [];
    if (arr.length === 0) return true;
    return arr.indexOf(fm.status) !== -1;
  }

  return {
    createPinStore: createPinStore,
    rankSearchResults: rankSearchResults,
    excludePinnedFromRecents: excludePinnedFromRecents,
    buildBreadcrumb: buildBreadcrumb,
    cardMatchesStatusFilters: cardMatchesStatusFilters
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd forge-shell && node --test test/product-forge.helpers.test.js
```
Expected: all tests PASS.

- [ ] **Step 5: Add script tag in `index.html`**

In `forge-shell/app/index.html`, immediately **before** the `product-forge.js` script line, add:

```html
  <script src="js/product-forge.helpers.js"></script>
```

(Keep `card-data.js` and other scripts order; helpers must load before `product-forge.js`.)

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/js/product-forge.helpers.js \
        forge-shell/test/product-forge.helpers.test.js \
        forge-shell/app/index.html
git commit -m "$(cat <<'EOF'
feat(product-forge): pure helpers for pins, search rank, breadcrumbs

Extract pinStore, rankSearchResults, buildBreadcrumb, and related
helpers into a Node-testable module for progressive sidebar findability.
EOF
)"
```

---

### Task 2: Type chips on all rows + More section

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (`treeView` render methods ~88–180, `expandAncestors` ~212–237, initial collapse seeding ~1310–1320, `treeView.render` ~39–73)
- Modify: `forge-shell/app/css/product-forge.css` (optional More header only if needed; prefer reuse)

**Interfaces:**
- Consumes: existing `getTypeColor`, `_renderSection`, `_renderLeafNode`
- Produces: every tree row includes `.pfl-type-chip`; section id `more` wraps intakes/checkpoints/decisions/release-notes; `expandAncestors` opens `more` for those types

- [ ] **Step 1: Add type chip helper used by all node renderers**

Inside `treeView`, add next to `_newBadgeHtml`:

```js
    _typeChipHtml: function (type) {
      var t = type || 'unknown';
      return '<span class="pfl-type-chip" style="background:' + getTypeColor(t) + '" title="' + ESC(t) + '"></span>';
    },
```

In `_renderInitiativeNode`, after the status-dot span and before error icon, insert:
```js
          this._typeChipHtml('initiative') +
```
Same for epic (`'epic'`), story (`fm.type || 'story'`), leaf (`fm.type || 'unknown'`).

In `_renderRecentsRow`, replace the inline type-chip span with `this._typeChipHtml(type)`.

- [ ] **Step 2: Seed `more` collapsed at init; wrap non-work sections**

Where the controller first seeds default collapsed sections (the block that currently does `treeView.collapsedSections.add('release-notes')` etc. on first load ~1310), also ensure:

```js
        treeView.collapsedSections.add('more');
```

Change `treeView.render` so instead of four top-level `_renderSection` calls for intakes/checkpoints/decisions/release-notes, render one **More** section:

```js
      var moreCount = hierarchy.intakes.length + hierarchy.checkpoints.length +
        hierarchy.decisions.length + hierarchy.releaseNotes.length;
      html += this._renderSection('More', 'more', moreCount, function () {
        var inner = '';
        inner += self._renderSection('Intakes', 'intakes', hierarchy.intakes.length, function () {
          return hierarchy.intakes.map(function (c) { return self._renderLeafNode(c, 1); }).join('');
        });
        inner += self._renderSection('Checkpoints', 'checkpoints', hierarchy.checkpoints.length, function () {
          return hierarchy.checkpoints.map(function (c) { return self._renderLeafNode(c, 1); }).join('');
        });
        inner += self._renderSection('Decisions', 'decisions', hierarchy.decisions.length, function () {
          return hierarchy.decisions.map(function (c) { return self._renderLeafNode(c, 1); }).join('');
        });
        inner += self._renderSection('Release Notes', 'release-notes', hierarchy.releaseNotes.length, function () {
          return hierarchy.releaseNotes.map(function (c) { return self._renderLeafNode(c, 1); }).join('');
        });
        return inner;
      });
```

Use `var self = this` at the start of `render` if not already present. Keep Initiatives / Orphan Epics / Orphan Stories / Recents as top-level.

- [ ] **Step 3: Update `expandAncestors` for More**

In `expandAncestors`, after resolving `sectionId` for intake/checkpoint/decision/release-note, also:

```js
      if (sectionId === 'intakes' || sectionId === 'checkpoints' ||
          sectionId === 'decisions' || sectionId === 'release-notes') {
        this.collapsedSections.delete('more');
      }
```

(Keep deleting the inner `sectionId` as today.)

- [ ] **Step 4: Syntax check + unit regression**

```bash
cd forge-shell && node --check app/js/product-forge.js && node --test
```
Expected: syntax OK; all existing tests still PASS (helpers + sidebar).

- [ ] **Step 5: Manual smoke (or note for later QA)**

In app: open PFL → type chips on initiative rows; More collapsed; expand More → four subsections.

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "$(cat <<'EOF'
feat(product-forge): type chips on all rows + More section

Work hierarchy stays top-level; intakes/checkpoints/decisions/release
notes nest under default-collapsed More. expandAncestors opens More.
EOF
)"
```

---

### Task 3: Pin store wiring + pinned section + recents de-dupe

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (module init, `_renderTree`, row render, events, `destroy`, `_pflDebug`)
- Modify: `forge-shell/app/css/product-forge.css` (pin button styles)

**Interfaces:**
- Consumes: `ProductForgeHelpers.createPinStore`, `excludePinnedFromRecents`
- Produces: pinned section above Recents; pin toggle on rows; toast on blocked

- [ ] **Step 1: Instantiate pinStore after helpers are available**

Near `recentsTracker` (top of IIFE after helpers exist), add:

```js
  var H = window.ProductForgeHelpers || {};
  var pinStore = (H.createPinStore || function () {
    return { filenames: [], load: function () {}, save: function () {}, toggle: function () { return 'blocked'; },
      add: function () { return 'blocked'; }, remove: function () {}, pruneMissing: function () {}, list: function () { return []; } };
  })({
    storage: (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null,
    key: 'pfl-pinned',
    max: 3
  });
```

On successful view load (in `init` after layout, before or after `_loadCards`), call `pinStore.load()`.

On `destroy`, do **not** clear localStorage pins (persist across sessions); only in-memory UI state resets as today.

Expose on debug:
```js
  window._pflDebug = { parseDate: parseDate, recentsTracker: recentsTracker, pinStore: pinStore };
```

- [ ] **Step 2: Render pinned section**

Add `treeView._renderPinnedSection(cards)` mirroring recents (section id `pinned`, label `Pinned`, count). Each row uses same chrome as recents + pin control (Step 3).

In `treeView.render`, after recents block setup, **before** Recents:

```js
      if (Array.isArray(hierarchy.pinned) && hierarchy.pinned.length > 0) {
        html += this._renderPinnedSection(hierarchy.pinned);
      }
```

- [ ] **Step 3: Pin affordance on rows**

Add helper:

```js
    _pinButtonHtml: function (filename) {
      var pinned = pinStore.list().indexOf(filename) !== -1;
      return '<button type="button" class="pfl-pin-btn' + (pinned ? ' pinned' : '') +
        '" data-pfl-pin="' + ESC(filename) + '" title="' + (pinned ? 'Unpin' : 'Pin') +
        '" aria-label="' + (pinned ? 'Unpin' : 'Pin') + '">' +
        '<i class="fa-solid fa-thumbtack"></i></button>';
    },
```

Append `_pinButtonHtml(card.filename)` on recents, pinned, initiative/epic/story/leaf headers (and later results).

In `_bindEvents`, stop pin clicks from selecting:

```js
      container.querySelectorAll('[data-pfl-pin]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var fn = btn.dataset.pflPin;
          var result = pinStore.toggle(fn);
          if (result === 'blocked') {
            ForgeUtils.Toast.show('Unpin one first', 'error');
            return;
          }
          ctrl._renderTree();
        });
      });
```

- [ ] **Step 4: Wire `_renderTree` pin resolve + de-dupe**

In the non-search path of `_renderTree` (after status filters, before `treeView.render`):

```js
      pinStore.pruneMissing(function (fn) { return !!store.get(fn); });
      var pinnedCards = pinStore.list().map(function (fn) { return store.get(fn); }).filter(Boolean);
      /* optional: apply FilterPanel.filterRecents-like status filter to pins */
      pinnedCards = FilterPanel.filterRecents(pinnedCards);
      var allRecents = recentsTracker.getRecents(store, 10);
      var filteredRecents = FilterPanel.filterRecents(allRecents);
      if (H.excludePinnedFromRecents) {
        filteredRecents = H.excludePinnedFromRecents(filteredRecents, pinStore.list());
      }
      hierarchy.pinned = pinnedCards;
      hierarchy.recents = filteredRecents;
```

Remove any duplicate recents attachment that contradicts this.

- [ ] **Step 5: CSS for pin button**

Append to `product-forge.css`:

```css
.pfl-pin-btn {
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 4px;
  font-size: 10px;
  line-height: 1;
}
.pfl-tree-node-header:hover .pfl-pin-btn,
.pfl-pin-btn.pinned {
  opacity: 1;
}
.pfl-pin-btn.pinned {
  color: var(--accent);
}
```

Note: if title uses flex growth, ensure `.pfl-node-title` still truncates (`min-width: 0; overflow: hidden; text-overflow: ellipsis` if not already).

- [ ] **Step 6: Verify**

```bash
cd forge-shell && node --check app/js/product-forge.js && node --test
```
Expected: PASS.

Browser: pin 3 cards → fourth toasts; reload → pins remain; pinned excluded from Recents.

- [ ] **Step 7: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "$(cat <<'EOF'
feat(product-forge): pin up to 3 cards above Recents

Persist pins in localStorage (pfl-pinned); block at cap with toast;
de-dupe pinned filenames from the Recents list.
EOF
)"
```

---

### Task 4: Context strip + structural scroll/flash

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (`_renderLayout`, `selectCard` / `_revealCard`, new `_updateContextStrip`, `treeView.scrollToFilename`)
- Modify: `forge-shell/app/css/product-forge.css`

**Interfaces:**
- Consumes: `ProductForgeHelpers.buildBreadcrumb`
- Produces: sticky strip under search; breadcrumb clicks select ancestors; Recents/Pin select scroll structural row

- [ ] **Step 1: Layout markup for strip**

In `_renderLayout`, inside `.pfl-sidebar` after `.sidebar-search`, add:

```js
            '<div class="pfl-context-strip hidden" data-pfl-context-strip></div>' +
```

- [ ] **Step 2: CSS**

```css
.pfl-context-strip {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pfl-context-strip.hidden {
  display: none;
}
.pfl-context-strip .pfl-crumb {
  color: var(--text-secondary);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  max-width: 7em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pfl-context-strip .pfl-crumb:hover {
  color: var(--accent);
  text-decoration: underline;
}
.pfl-context-strip .pfl-crumb-current {
  color: var(--text-primary);
  cursor: default;
  max-width: 8em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pfl-context-strip .pfl-crumb-sep {
  color: var(--text-muted);
  flex-shrink: 0;
}
```

- [ ] **Step 3: `treeView.scrollToFilename` + flash helper**

```js
    scrollToFilename: function (filename) {
      if (!filename) return;
      var rows = $qa('[data-pfl-select="' + filename + '"]');
      if (!rows || rows.length === 0) return;
      /* Prefer structural row over Recents/Pin: last match is usually deeper in DOM after pinned/recents */
      var structural = null;
      for (var i = 0; i < rows.length; i++) {
        var node = rows[i].closest('.pfl-tree-section');
        var sec = node && node.getAttribute('data-pfl-section');
        if (sec && sec !== 'recents' && sec !== 'pinned') {
          structural = rows[i];
          break;
        }
      }
      var target = structural || rows[rows.length - 1] || rows[0];
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return target;
    },

    flashFilename: function (filename) {
      var rows = $qa('[data-pfl-select="' + filename + '"]');
      rows.forEach(function (row) {
        row.classList.add('pfl-flash-new');
        setTimeout(function () { row.classList.remove('pfl-flash-new'); }, 1500);
      });
    },
```

- [ ] **Step 4: `_updateContextStrip`**

```js
    _updateContextStrip: function () {
      var el = $q('[data-pfl-context-strip]');
      if (!el) return;
      if (!selectedCard) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      var card = store.get(selectedCard);
      if (!card || !H.buildBreadcrumb) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      var bc = H.buildBreadcrumb(card, function (fn) { return store.get(fn); });
      var parts = [];
      bc.segments.forEach(function (seg, idx) {
        if (idx > 0) parts.push('<span class="pfl-crumb-sep">›</span>');
        var isLast = idx === bc.segments.length - 1;
        if (!isLast && seg.filename) {
          parts.push('<button type="button" class="pfl-crumb" data-pfl-crumb="' +
            ESC(seg.filename) + '">' + ESC(seg.label) + '</button>');
        } else {
          parts.push('<span class="pfl-crumb-current">' + ESC(seg.label) + '</span>');
        }
      });
      el.innerHTML = parts.join('');
      el.classList.remove('hidden');
      el.querySelectorAll('[data-pfl-crumb]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var fn = btn.dataset.pflCrumb;
          treeView.expandAncestors(fn);
          ctrl.selectCard(fn);
          ctrl._renderTree();
          requestAnimationFrame(function () {
            treeView.scrollToFilename(fn);
            treeView.flashFilename(fn);
          });
        });
      });
    },
```

Call `_updateContextStrip()` at end of `_renderTree` and from `selectCard` after selection changes.

- [ ] **Step 5: Strengthen select path from tree rows**

Existing click handler already calls `expandAncestors` + `selectCard` + `_renderTree`. After `_renderTree` in that handler, add:

```js
          requestAnimationFrame(function () {
            treeView.scrollToFilename(filename);
            treeView.flashFilename(filename);
          });
```

Refactor `_revealCard` scroll/flash block to use `treeView.scrollToFilename` + `flashFilename` instead of duplicating.

- [ ] **Step 6: Verify**

```bash
cd forge-shell && node --check app/js/product-forge.js && node --test
```

Manual: select deep story → strip shows chain; click ancestor → jumps; select Recents row → structural expands and scrolls.

- [ ] **Step 7: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "$(cat <<'EOF'
feat(product-forge): context strip and structural scroll on select

Sticky breadcrumb under search; crumb clicks and Recents/Pin select
expand ancestors, scroll the structural row, and flash.
EOF
)"
```

---

### Task 5: Search results mode (replace tree prune)

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (`_renderTree` search branch, layout results container, Esc binding)
- Modify: `forge-shell/app/css/product-forge.css` (results list styles)

**Interfaces:**
- Consumes: `rankSearchResults`, `cardMatchesStatusFilters`, pin/type chip render helpers
- Produces: flat ranked results when query non-empty; tree restored when cleared; collapse state never cleared for search

- [ ] **Step 1: Add results container in layout**

In `.pfl-sidebar` after context strip:

```js
            '<div class="pfl-search-results hidden" data-pfl-search-results></div>' +
            '<div class="pfl-tree-view"></div>' +
```

- [ ] **Step 2: CSS**

```css
.pfl-search-results {
  padding: 8px 0;
}
.pfl-search-results.hidden {
  display: none;
}
.pfl-search-result-meta {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.pfl-search-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Replace search branch in `_renderTree`**

Remove the entire block that filters hierarchy leaves/tree by query and clears `collapsedSections` (~1346–1381 and restore ~1406–1409).

Replace with:

```js
      var searchEl = $q('[data-pfl-search]');
      var query = searchEl ? searchEl.value.trim().toLowerCase() : '';
      var searching = query.length > 0;
      var resultsEl = $q('[data-pfl-search-results]');
      var treeEl = $q('.pfl-tree-view');

      if (searching) {
        var candidates = store.all().filter(function (c) {
          return H.cardMatchesStatusFilters
            ? H.cardMatchesStatusFilters(c, FilterPanel.filters)
            : true;
        });
        var ranked = H.rankSearchResults
          ? H.rankSearchResults(candidates, query)
          : candidates;
        if (treeEl) treeEl.classList.add('hidden');
        if (resultsEl) {
          resultsEl.classList.remove('hidden');
          resultsEl.innerHTML = this._renderSearchResults(ranked);
          this._bindSearchResultEvents(resultsEl);
        }
        if (selectedCard) treeView.highlightSelected(selectedCard);
        this._updateContextStrip();
        this._updateFilterBadge();
        return;
      }

      if (treeEl) treeEl.classList.remove('hidden');
      if (resultsEl) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
      }

      /* existing non-search path: buildHierarchy → filters → pin/recents → treeView.render */
```

Implement on `ctrl`:

```js
    _renderSearchResults: function (cards) {
      if (!cards || cards.length === 0) {
        return '<div class="pfl-search-empty">No cards match</div>';
      }
      var self = this;
      return cards.map(function (card) {
        var fm = card.frontmatter || {};
        var type = fm.type || 'unknown';
        var parentLabel = '';
        if (fm.parent && store.get(fm.parent)) {
          var p = store.get(fm.parent);
          parentLabel = (p.frontmatter && p.frontmatter.title) || p.filename;
        }
        return '<div class="pfl-tree-node pfl-indent-1" data-pfl-filename="' + ESC(card.filename) +
          '" data-pfl-type="' + ESC(type) + '">' +
          '<div class="pfl-tree-node-header" data-pfl-select="' + ESC(card.filename) + '">' +
            '<span class="pfl-toggle"></span>' +
            '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
            treeView._typeChipHtml(type) +
            '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
            (parentLabel ? '<span class="pfl-search-result-meta">' + ESC(parentLabel) + '</span>' : '') +
            treeView._pinButtonHtml(card.filename) +
          '</div></div>';
      }).join('');
    },

    _bindSearchResultEvents: function (container) {
      var self = this;
      container.querySelectorAll('[data-pfl-select]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-pfl-pin]')) return;
          var filename = el.dataset.pflSelect;
          self.selectCard(filename);
          self._updateContextStrip();
          treeView.highlightSelected(filename);
        });
      });
      container.querySelectorAll('[data-pfl-pin]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var fn = btn.dataset.pflPin;
          var result = pinStore.toggle(fn);
          if (result === 'blocked') {
            ForgeUtils.Toast.show('Unpin one first', 'error');
            return;
          }
          self._renderTree();
        });
      });
    },
```

- [ ] **Step 4: Esc clears search when focus in search input**

In `_bindKeyboard` keydown handler, add:

```js
        if (e.key === 'Escape') {
          var s = $q('[data-pfl-search]');
          if (s && document.activeElement === s && s.value) {
            s.value = '';
            ctrl._renderTree();
            e.preventDefault();
            return;
          }
        }
```

(Integrate carefully with any existing Escape handling.)

- [ ] **Step 5: Verify**

```bash
cd forge-shell && node --check app/js/product-forge.js && node --test
```

Manual checklist:
1. Type query → tree hidden, ranked results shown; Recents/Pin not shown.
2. Clear / Esc → tree restored; collapse state unchanged (More still collapsed if it was).
3. Status filters still limit results.
4. Select result → detail + strip; clear search → structural highlight works after expand on next tree select.

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css
git commit -m "$(cat <<'EOF'
feat(product-forge): search results mode instead of tree prune

Non-empty query shows ranked flat results; empty query restores the
structural tree without clearing collapse state.
EOF
)"
```

---

### Task 6: Final verification + regression gate

**Files:** none required (docs only if something drifted)

- [ ] **Step 1: Full unit suite**

```bash
cd forge-shell && node --test
```
Expected: all tests PASS (sidebar + product-forge.helpers).

- [ ] **Step 2: Syntax**

```bash
node --check app/js/product-forge.js
node --check app/js/product-forge.helpers.js
```
Expected: no output (exit 0).

- [ ] **Step 3: Manual QA against spec verification list**

Walk every item in the spec “Verification” section (default More collapsed, type chips, pin cap/persist/de-dupe, Recents scroll+flash, context strip crumbs, search round-trip, filters, NEW/toolbar new, no mobile CSS, sidebar resize OK).

- [ ] **Step 4: Grep guardrails**

```bash
rg -n "max-width:\\s*768px" forge-shell/app/css/product-forge.css
rg -n "collapsedSections\\.clear" forge-shell/app/js/product-forge.js
rg -n "pfl-pinned" forge-shell/app/js/
```
Expected:
- first: no matches  
- second: no search-path clear (only acceptable if unrelated; search must not clear collapse)  
- third: helpers + product-forge references present  

- [ ] **Step 5: Commit only if Step 3 found small fixes**

If fixes were needed, commit them:

```bash
git add -A forge-shell/app/js/product-forge.js forge-shell/app/css/product-forge.css forge-shell/app/js/product-forge.helpers.js forge-shell/test/product-forge.helpers.test.js
git commit -m "fix(product-forge): progressive findability QA follow-ups"
```

If nothing to fix, stop — no empty commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Type chip on all rows | Task 2 |
| More section default collapsed; nested four sections | Task 2 |
| expandAncestors opens More | Task 2 |
| pinStore max 3, localStorage `pfl-pinned`, block+toast | Tasks 1, 3 |
| Pinned above Recents; de-dupe recents | Task 3 |
| Context strip sticky; crumb jump | Task 4 |
| Recents/Pin select → expand + scroll + flash | Task 4 |
| Search → ranked results; no tree prune; no collapse clear | Task 5 |
| Esc clears search | Task 5 |
| Status filters on results | Task 5 (`cardMatchesStatusFilters`) |
| Recents/NEW/toolbar new unchanged except de-dupe | Tasks 3 (only de-dupe) |
| No mobile CSS | Global + Task 6 grep |
| Unit tests for rank/pin/breadcrumb/de-dupe | Task 1 |

## Placeholder / consistency notes

- Helper names are fixed: `createPinStore`, `rankSearchResults`, `buildBreadcrumb`, `excludePinnedFromRecents`, `cardMatchesStatusFilters`.
- Toast copy is exactly `Unpin one first`.
- Storage key is exactly `pfl-pinned`.
- Section id for More is exactly `more`.
