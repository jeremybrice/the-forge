# Product Forge — Recents Section & Auto-Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-05-product-forge-recents-and-auto-reveal-design.md`

**Goal:** Add a session-scoped Recents section to the Product Forge sidebar, plus auto-reveal of newly-detected card files via the existing 5s refresh poll, both without altering card schema or shared data layer.

**Architecture:** All logic lives in `forge-shell/app/js/product-forge.js`. A new self-contained `recentsTracker` module owns session state (which filenames just appeared, when). `treeView` gains one new render path. `ctrl._doRefresh` feeds the tracker; `ctrl._maybeAutoReveal` decides whether to steal focus or merely pulse a toolbar counter. CSS additions live in `forge-shell/app/css/product-forge.css`. Zero changes to `card-data.js`, forge-lib, or any other view controller.

**Tech Stack:** Vanilla JS (IIFE module pattern), CSS, no build step. The existing project does not use a JS test runner; pure-function tests are written as console-runnable snippets in code comments and verified manually in browser devtools.

---

## File Structure

| File | Responsibility | Change Type |
|------|----------------|-------------|
| `forge-shell/app/js/product-forge.js` | View controller — adds `recentsTracker` IIFE-internal module + integrations into `treeView`, `ctrl._renderTree`, `ctrl._doRefresh`, `ctrl._updateRefreshIndicator`, `ctrl.selectCard`, `ctrl.destroy`. | Modify |
| `forge-shell/app/css/product-forge.css` | Visual styles for Recents section emphasis, NEW badge pill, flash animation, type chip swatch, "N new" toolbar pulse. | Modify (append-only) |

No new files are created. No deletions.

---

## Conventions for All Tasks

- The codebase uses ES5-leaning style (`var`, `function`, no arrow shorthand in many places). New code should match: prefer `var`, prefer `function () { ... }`, no template literals across multiple lines unless surrounding code already uses them. Inline arrow functions for one-liners are acceptable (the file mixes both).
- Use `ESC()` (`ForgeUtils.escapeHTML`) on every interpolated string in HTML.
- Use `ForgeUtils.Toast.show(msg, level)` for any user-visible message.
- Commit after every task. Commit messages: `feat(product-forge): <what>` or `style(product-forge): <what>`.
- After every code task, manually load the forge-shell view in the browser dev environment and confirm no console errors before committing. (`cd forge-shell && npm run tauri dev` if not already running.)

---

## Task 1: Add CSS for Recents section, NEW badge, flash animation, type chip, refresh-new counter

**Files:**
- Modify: `forge-shell/app/css/product-forge.css` (append at end of file)

- [ ] **Step 1: Open the CSS file and scroll to end**

Run: `wc -l forge-shell/app/css/product-forge.css` to know the end line.

- [ ] **Step 2: Append the new style block at end of file**

Append:

```css

/* ═══════════════════════════════════════════════════════════
   Recents section, NEW badges, flash, type chip
   (added 2026-05-05 — recents + auto-reveal feature)
   ═══════════════════════════════════════════════════════════ */

/* Section header emphasis: 2px accent left-border, no bg tint */
.pfl-tree-section[data-pfl-section="recents"] > .pfl-tree-section-header {
  border-left: 2px solid var(--accent);
  padding-left: 10px;          /* 12 - 2 to keep label aligned */
}

/* Type chip — small rounded square shown on Recents rows so the
   user can tell at a glance which kind of card they're looking at
   (Recents is type-mixed). */
.pfl-type-chip {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  display: inline-block;
}

/* "NEW" badge pill — appears on rows whose filename was added
   to the store during this session. Cleared on selection or
   after the recentsTracker prune horizon. */
.pfl-new-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--bg-primary);
  flex-shrink: 0;
  margin-left: 4px;
  text-transform: uppercase;
}

/* Brief flash applied to a tree row when auto-reveal selects it.
   1.5s, fades out — class removed by setTimeout in JS. */
@keyframes pfl-flash-new-keyframes {
  0%   { background: var(--accent-light); }
  100% { background: transparent; }
}
.pfl-flash-new {
  animation: pfl-flash-new-keyframes 1.5s ease-out;
}

/* Toolbar refresh-indicator suffix when one or more cards
   arrived this session and have not been seen yet. */
.pfl-refresh-new-count {
  color: var(--accent);
  font-weight: 600;
  margin-left: 6px;
  cursor: pointer;
  user-select: none;
  animation: pfl-refresh-pulse 1.5s ease-in-out infinite;
}
@keyframes pfl-refresh-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
```

- [ ] **Step 3: Reload forge-shell in dev**

Reload the running Tauri window (Cmd+R inside the app, or restart `npm run tauri dev`).
Expected: no visual change yet (no JS uses these classes), no console errors.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/css/product-forge.css
git commit -m "style(product-forge): css for recents section, NEW badge, flash, type chip"
```

---

## Task 2: Add `recentsTracker` module skeleton inside the IIFE

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — insert new module immediately after the closing `}` of the `FilterPanel` object (currently around line 588) and before the `editModal` block (currently around line 593).

- [ ] **Step 1: Find the insertion point**

Run: `grep -n "Edit Modal" forge-shell/app/js/product-forge.js | head -3`
Expected: line ~591 (`Edit Modal` banner comment).

- [ ] **Step 2: Insert the module skeleton**

Immediately above the `Edit Modal` banner (line ~590), insert:

```js
  /* ═══════════════════════════════════════════════════════════════
     RecentsTracker — session-scoped state for "what just arrived"
     - sessionAddedAt: filename → ms timestamp when first observed
       in changes.added during this session
     - unseenAddedCount: number of additions not yet acknowledged
       by the user (cleared on click of toolbar "N new" suffix)
     - PRUNE_HORIZON_MS: NEW badges and tracker entries expire after
       this duration without user interaction (spec A6)
     ═══════════════════════════════════════════════════════════════ */
  var PRUNE_HORIZON_MS = 10 * 60 * 1000;  /* 10 minutes */

  var recentsTracker = {
    sessionAddedAt: new Map(),
    unseenAddedCount: 0,

    reset: function () {
      this.sessionAddedAt.clear();
      this.unseenAddedCount = 0;
    },

    noteAdded: function (filename) {
      /* Implemented in Task 5 */
    },

    markSeen: function (filename) {
      /* Implemented in Task 5 */
    },

    forget: function (filename) {
      /* Implemented in Task 5 */
    },

    pruneStale: function () {
      /* Implemented in Task 5 */
    },

    isNew: function (filename) {
      return this.sessionAddedAt.has(filename);
    },

    getRecents: function (store, n) {
      /* Implemented in Task 4 */
      return [];
    }
  };
```

- [ ] **Step 3: Reload and verify no errors**

Reload the Tauri window. Open devtools console. Type: `window.ProductForgeLocalView` — should still be defined.
Expected: no syntax errors, no console errors.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): add recentsTracker module skeleton"
```

---

## Task 3: Add `parseDate` helper

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — add a private function above the `recentsTracker` declaration (just below `PRUNE_HORIZON_MS`).

- [ ] **Step 1: Insert the helper**

Above the `var recentsTracker = {` line, add:

```js
  /* parseDate — accepts ISO date strings like "2026-05-05" or
     full timestamps. Returns ms-since-epoch number, or null on
     failure. Tolerant of null/undefined input.

     Browser-console smoke test (paste into devtools after reload):
       parseDate('2026-05-05')           → e.g. 1762128000000
       parseDate('2026-05-05T14:32:00Z') → e.g. 1762178320000
       parseDate('not a date')           → null
       parseDate(null)                   → null
       parseDate('')                     → null
  */
  function parseDate(s) {
    if (!s || typeof s !== 'string') return null;
    var t = Date.parse(s);
    return isNaN(t) ? null : t;
  }
```

Also expose it for the console smoke test by attaching to a private debug namespace at the bottom of the IIFE (just before `})();` at the very end):

Find the `window.ProductForgeLocalView = ctrl;` line (currently ~line 1438) and immediately after it add:

```js
  /* Debug-only — exposed for manual smoke testing of pure helpers.
     Not part of the public surface; do not depend on this. */
  window._pflDebug = { parseDate: parseDate, recentsTracker: recentsTracker };
```

- [ ] **Step 2: Reload and run smoke test in console**

Reload the Tauri window, open devtools console, run:

```js
_pflDebug.parseDate('2026-05-05')           // expect: a number
_pflDebug.parseDate('2026-05-05T14:32:00Z') // expect: a number
_pflDebug.parseDate('not a date')           // expect: null
_pflDebug.parseDate(null)                   // expect: null
_pflDebug.parseDate('')                     // expect: null
```

Expected: all five return as commented.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): add parseDate helper + debug namespace for smoke tests"
```

---

## Task 4: Implement `recentsTracker.getRecents`

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — replace the `getRecents` stub from Task 2.

- [ ] **Step 1: Replace the stub**

Locate the `getRecents: function (store, n) { ... return []; }` stub. Replace it with:

```js
    /* getRecents — returns up to n most-recently-created cards
       from the store, sorted DESC by frontmatter.created (parsed
       via parseDate). Falls back to store.timestamps (file mtime)
       when frontmatter.created is missing or unparseable.
       Tie-break: filename ASC for stability.

       Browser-console smoke test (after a workspace is loaded):
         _pflDebug.recentsTracker.getRecents(
           _pflDebug.recentsTracker._fakeStore || null, 5
         )
       And manually: pick 5 cards in your workspace whose `created`
       you know, then call this and confirm the order.
    */
    getRecents: function (store, n) {
      if (!store || typeof store.all !== 'function') return [];
      var limit = (typeof n === 'number' && n > 0) ? n : 10;
      var entries = store.all().map(function (card) {
        var ts = parseDate(card.frontmatter && card.frontmatter.created);
        if (ts === null) {
          var fileTs = store.timestamps.get(card.filename);
          ts = (typeof fileTs === 'number') ? fileTs : 0;
        }
        return { card: card, ts: ts, filename: card.filename };
      });
      entries.sort(function (a, b) {
        if (b.ts !== a.ts) return b.ts - a.ts;
        return a.filename < b.filename ? -1 : (a.filename > b.filename ? 1 : 0);
      });
      return entries.slice(0, limit).map(function (e) { return e.card; });
    },
```

- [ ] **Step 2: Reload and run smoke test in console**

Reload, open a workspace with cards, then run:

```js
_pflDebug.recentsTracker.getRecents(null, 5)         // expect: []
// After workspace is loaded:
var s = window.ProductForgeLocalView; // not directly the store, see below
```

Note: the `store` is not directly exposed. To smoke-test against real data:

```js
// Enable temporary store exposure: paste this once
window._pflDebug.recentsTracker.getRecents(
  // Reach into the controller's closure via a known render call:
  // (skip if too hard — manual visual verification in Task 6 covers this)
);
```

If reaching into the closure is awkward, skip this step and rely on visual verification once Task 6 wires the section up.

Run instead the **type-only sanity test**:

```js
_pflDebug.recentsTracker.getRecents({}, 5)           // expect: [] (early return)
_pflDebug.recentsTracker.getRecents({ all: function () { return []; }, timestamps: new Map() }, 5)  // expect: []
```

Expected: both return `[]` with no errors.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): implement recentsTracker.getRecents with date fallback"
```

---

## Task 5: Implement `noteAdded`, `markSeen`, `forget`, `pruneStale`

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — replace the four stubs from Task 2.

- [ ] **Step 1: Replace `noteAdded` stub**

Replace:

```js
    noteAdded: function (filename) {
      /* Implemented in Task 5 */
    },
```

With:

```js
    /* noteAdded — record that this filename arrived (via
       changes.added in _doRefresh) at the current wall-clock time.
       If already present, leave the original timestamp (do not
       extend lifetime on subsequent modifications).
       Increments unseenAddedCount only on first observation. */
    noteAdded: function (filename) {
      if (!filename) return;
      if (!this.sessionAddedAt.has(filename)) {
        this.sessionAddedAt.set(filename, Date.now());
        this.unseenAddedCount += 1;
      }
    },
```

- [ ] **Step 2: Replace `markSeen` stub**

Replace:

```js
    markSeen: function (filename) {
      /* Implemented in Task 5 */
    },
```

With:

```js
    /* markSeen — user has acknowledged this card (clicked it).
       Removes the NEW badge for this filename and decrements
       the unseen counter (clamped at 0). */
    markSeen: function (filename) {
      if (!filename) return;
      if (this.sessionAddedAt.has(filename)) {
        this.sessionAddedAt.delete(filename);
        this.unseenAddedCount = Math.max(0, this.unseenAddedCount - 1);
      }
    },
```

- [ ] **Step 3: Replace `forget` stub**

Replace:

```js
    forget: function (filename) {
      /* Implemented in Task 5 */
    },
```

With:

```js
    /* forget — used when a tracked filename is detected in
       changes.deleted; same effect as markSeen but semantically
       different (no user acknowledgement, the card is gone). */
    forget: function (filename) {
      this.markSeen(filename);
    },
```

- [ ] **Step 4: Replace `pruneStale` stub**

Replace:

```js
    pruneStale: function () {
      /* Implemented in Task 5 */
    },
```

With:

```js
    /* pruneStale — drop tracker entries older than PRUNE_HORIZON_MS.
       For each pruned entry, decrement the unseen counter (these
       are NEW badges the user never clicked but are now expired). */
    pruneStale: function () {
      var now = Date.now();
      var self = this;
      var toDelete = [];
      this.sessionAddedAt.forEach(function (ts, filename) {
        if (now - ts > PRUNE_HORIZON_MS) toDelete.push(filename);
      });
      toDelete.forEach(function (filename) {
        self.sessionAddedAt.delete(filename);
        self.unseenAddedCount = Math.max(0, self.unseenAddedCount - 1);
      });
    },
```

- [ ] **Step 5: Reload and run state smoke test in console**

Reload, then:

```js
var rt = _pflDebug.recentsTracker;
rt.reset();
rt.noteAdded('foo'); rt.noteAdded('bar'); rt.noteAdded('foo');
rt.unseenAddedCount             // expect: 2 (foo deduped)
rt.isNew('foo')                 // expect: true
rt.markSeen('foo');
rt.unseenAddedCount             // expect: 1
rt.isNew('foo')                 // expect: false
rt.forget('bar');
rt.unseenAddedCount             // expect: 0
rt.sessionAddedAt.size          // expect: 0
```

Expected: all match.

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): implement recentsTracker note/seen/forget/prune"
```

---

## Task 6: Add `treeView._renderRecentsSection` and integrate into `treeView.render`

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`
  - Add new method on `treeView` after `_renderLeafNode` (currently line ~154) and before `_bindEvents` (currently line ~156).
  - Modify `treeView.render` (currently lines 39-68) to render Recents as the first section.

- [ ] **Step 1: Add the `_renderRecentsSection` method**

Insert this new method on the `treeView` object, after `_renderLeafNode`:

```js
    /* _renderRecentsSection — renders the type-mixed Recents
       section at the top of the tree. Each row is a leaf-style
       node with: toggle stub, status dot, type chip, title,
       optional NEW badge. */
    _renderRecentsSection: function (cards) {
      var self = this;
      var collapsed = this.collapsedSections.has('recents');
      var inner = cards.map(function (card) { return self._renderRecentsRow(card); }).join('');
      return '<div class="pfl-tree-section" data-pfl-section="recents">' +
        '<div class="pfl-tree-section-header" data-pfl-toggle-section="recents">' +
          '<span class="pfl-toggle ' + (collapsed ? '' : 'open') + '">&#9654;</span>' +
          '<span>Recents</span>' +
          '<span class="pfl-count">' + cards.length + '</span>' +
        '</div>' +
        '<div class="pfl-tree-children' + (collapsed ? ' pfl-collapsed' : '') + '" data-pfl-section-body="recents">' + inner + '</div>' +
      '</div>';
    },

    /* _renderRecentsRow — a leaf row with type chip + optional
       NEW badge. Uses pfl-indent-1 to match other leaf sections. */
    _renderRecentsRow: function (card) {
      var fm = card.frontmatter;
      var type = fm.type || 'unknown';
      var newBadge = recentsTracker.isNew(card.filename)
        ? '<span class="pfl-new-badge">NEW</span>'
        : '';
      return '<div class="pfl-tree-node pfl-indent-1" data-pfl-filename="' + ESC(card.filename) + '" data-pfl-type="' + ESC(type) + '">' +
        '<div class="pfl-tree-node-header" data-pfl-select="' + ESC(card.filename) + '">' +
          '<span class="pfl-toggle"></span>' +
          '<span class="pfl-status-dot" style="background:' + getStatusColor(fm.status) + '"></span>' +
          '<span class="pfl-type-chip" style="background:' + getTypeColor(type) + '" title="' + ESC(type) + '"></span>' +
          (card.error ? '<span class="pfl-error-icon">&#9888;</span>' : '') +
          '<span class="pfl-node-title">' + ESC(fm.title || card.filename) + '</span>' +
          newBadge +
        '</div>' +
      '</div>';
    },
```

- [ ] **Step 2: Modify `treeView.render` to render Recents first**

Find the current `render` method (lines 39-68). Replace its body:

```js
    render(hierarchy) {
      const container = $q('.pfl-tree-view');
      if (!container) return;
      let html = '';

      html += this._renderSection('Initiatives', 'initiatives', hierarchy.tree.length, () => {
        let inner = '';
        for (const initNode of hierarchy.tree) inner += this._renderInitiativeNode(initNode);
        return inner;
      });
      // ...rest unchanged...
```

With:

```js
    render(hierarchy) {
      const container = $q('.pfl-tree-view');
      if (!container) return;
      let html = '';

      /* Recents always renders first when provided */
      if (Array.isArray(hierarchy.recents)) {
        html += this._renderRecentsSection(hierarchy.recents);
      }

      html += this._renderSection('Initiatives', 'initiatives', hierarchy.tree.length, () => {
        let inner = '';
        for (const initNode of hierarchy.tree) inner += this._renderInitiativeNode(initNode);
        return inner;
      });

      html += this._renderSection('Orphan Epics', 'orphan-epics', hierarchy.orphanEpics.length, () =>
        hierarchy.orphanEpics.map(en => this._renderEpicNode(en)).join(''), 'unparent-epic');

      html += this._renderSection('Orphan Stories', 'orphan-stories', hierarchy.orphanStories.length, () =>
        hierarchy.orphanStories.map(c => this._renderStoryNode(c, 1)).join(''), 'unparent-story');

      html += this._renderSection('Intakes', 'intakes', hierarchy.intakes.length, () =>
        hierarchy.intakes.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Checkpoints', 'checkpoints', hierarchy.checkpoints.length, () =>
        hierarchy.checkpoints.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Decisions', 'decisions', hierarchy.decisions.length, () =>
        hierarchy.decisions.map(c => this._renderLeafNode(c, 1)).join(''));
      html += this._renderSection('Release Notes', 'release-notes', hierarchy.releaseNotes.length, () =>
        hierarchy.releaseNotes.map(c => this._renderLeafNode(c, 1)).join(''));

      container.innerHTML = html;
      this._bindEvents(container);
      this._setupDragDrop(container);
    },
```

(Only difference: the `if (Array.isArray(hierarchy.recents))` block is added at the top.)

- [ ] **Step 3: Reload — Recents will not appear yet**

Reload the Tauri window. Recents will not appear because `_renderTree` doesn't yet attach `recents` to hierarchy. That's the next task. Verify no console errors.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): treeView renders Recents section when provided"
```

---

## Task 7: Wire Recents into `ctrl._renderTree` (compute, filter, default-expand)

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`
  - Add a helper on `FilterPanel` for filtering recents by per-type status (insert after `filterHierarchy`, currently line ~545).
  - Modify `ctrl._renderTree` (currently lines 1034-1120) to: compute recents, attach to hierarchy, filter by search/status, ensure Recents is default-expanded on first render.

- [ ] **Step 1: Add `FilterPanel.filterRecents` helper**

Locate the closing `}` of `FilterPanel.filterHierarchy` (line ~545). Immediately after it, before the closing `}` of FilterPanel itself (line ~588), add:

```js
    /* filterRecents — apply per-type status filters to a flat
       recents array. Cards whose type is not initiative/epic/story
       are unaffected by the panel's status filters. */
    filterRecents: function (recents) {
      if (this.getActiveCount() === 0) return recents;
      var self = this;
      return recents.filter(function (card) {
        var fm = card.frontmatter || {};
        var type = fm.type;
        var key = type === 'initiative' ? 'initiative_status'
                : type === 'epic'       ? 'epic_status'
                : type === 'story'      ? 'story_status'
                : null;
        if (!key) return true;
        return self._cardMatchesTypeStatus(card, key, self.filters[key]);
      });
    },
```

- [ ] **Step 2: Modify `ctrl._renderTree`**

Find the current `_renderTree` method (line ~1034). Find the block at lines 1037-1063 that pre-collapses sections on first render. Modify it so Recents is **NOT** pre-collapsed:

Locate this block:

```js
      // On first render, collapse all sections and parent nodes by default
      if (treeView.collapsedSections.size === 0 && treeView.collapsedNodes.size === 0) {
        treeView.collapsedSections.add('initiatives');
        treeView.collapsedSections.add('orphan-epics');
        treeView.collapsedSections.add('orphan-stories');
        treeView.collapsedSections.add('intakes');
        treeView.collapsedSections.add('checkpoints');
        treeView.collapsedSections.add('decisions');
        treeView.collapsedSections.add('release-notes');
        // ...
```

Leave it unchanged — Recents is intentionally absent from this list, so it will start expanded.

Now find the search-filter block (lines ~1071-1106). Immediately after it (before `// Apply status filters`, line ~1108), add the recents-build-and-filter block:

```js
      /* Build Recents (after structural search filter so titles
         that don't match are not in the recents either). The
         recents themselves are then filtered by search query
         and per-type status filters. */
      var allRecents = recentsTracker.getRecents(store, 10);
      if (searching) {
        var matchCardLocal = function (card) {
          var title = (card.frontmatter.title || '').toLowerCase();
          var fname = (card.filename || '').toLowerCase();
          return title.indexOf(query) !== -1 || fname.indexOf(query) !== -1;
        };
        allRecents = allRecents.filter(matchCardLocal);
      }
      hierarchy.recents = FilterPanel.filterRecents(allRecents);
```

(The `var matchCardLocal` duplicates the local `matchCard` already declared inside the `if (searching)` block above — re-declared here because the outer `matchCard` is scoped inside the earlier `if`. We could hoist it, but keeping changes local is safer for now.)

After the existing `hierarchy = FilterPanel.filterHierarchy(hierarchy);` line (currently line 1109), `hierarchy.recents` will already have been set above and will be passed through unchanged.

- [ ] **Step 3: Reload and verify Recents appears**

Reload the Tauri window. Open a workspace with cards.

Expected:
- A "Recents" section appears at the top of the sidebar, expanded by default, showing up to 10 cards sorted by `created` DESC.
- Each row has: status dot, small colored type chip, title.
- No NEW badges (initial load — `recentsTracker` is empty).
- Existing tree sections (Initiatives, etc.) are still collapsed by default.
- Click any Recents row → detail panel opens for that card.
- Type a search query → Recents respects the filter (rows that don't match disappear).
- Open the status filter panel and add an Epic Status filter → Recents shows only matching epics (other types still shown).

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): _renderTree computes + filters recents, default-expanded"
```

---

## Task 8: Hook `_doRefresh` `changes.added` and `changes.deleted` into `recentsTracker`

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — modify `ctrl._doRefresh` (currently lines 1214-1261).

- [ ] **Step 1: Locate the change-application block**

Find the section inside `_doRefresh`:

```js
        for (var fn of store.cards.keys()) {
          if (!files.has(fn)) {
            changes.deleted.push(fn);
            store.delete(fn);
          }
        }

        var hasChanges = changes.added.length + changes.modified.length + changes.deleted.length > 0;
```

- [ ] **Step 2: Insert tracker hooks**

Modify the deleted-loop to also forget tracker entries, and insert a noteAdded loop after the hasChanges check but before the `if (hasChanges)` body. Replace the block above with:

```js
        for (var fn of store.cards.keys()) {
          if (!files.has(fn)) {
            changes.deleted.push(fn);
            store.delete(fn);
            recentsTracker.forget(fn);
          }
        }

        /* Feed the tracker with new arrivals BEFORE re-rendering so
           NEW badges appear in the same render pass. */
        for (var addedIdx = 0; addedIdx < changes.added.length; addedIdx++) {
          recentsTracker.noteAdded(changes.added[addedIdx]);
        }
        recentsTracker.pruneStale();

        var hasChanges = changes.added.length + changes.modified.length + changes.deleted.length > 0;
```

(Note: `pruneStale` is called every refresh tick — cheap, walks a small Map.)

After the existing `if (hasChanges) { ... }` block, but inside the `try` block, add:

```js
        if (changes.added.length > 0) {
          this._maybeAutoReveal(changes.added);
        }
```

- [ ] **Step 3: Reload and verify**

Reload. From a separate terminal:

```bash
# Touch a card via Claude in another window OR manually create:
cat > cards/decisions/test-recents-auto.md <<'EOF'
---
title: Test recents auto
type: decision
status: Active
decision_date: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
---
Smoke test card.
EOF
```

Within ~5s, the Recents section should show the new card with a "NEW" badge. (Auto-reveal is not yet implemented — that's Task 10 — so the toolbar counter and focus-stealing behaviors are not yet exercised; the call to `this._maybeAutoReveal` will throw "is not a function" until Task 10. Apply the workaround below for this commit.)

**Workaround for this task only:** Wrap the call in a guard so the file loads cleanly until Task 10 lands:

```js
        if (changes.added.length > 0 && typeof this._maybeAutoReveal === 'function') {
          this._maybeAutoReveal(changes.added);
        }
```

Use this guarded form. We can drop the `typeof` guard later (or leave it — defensive).

Reload again and re-do the smoke test above.
Expected: Recents shows new card with NEW badge within ~5s; no console errors.

Clean up:

```bash
rm cards/decisions/test-recents-auto.md
```

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): _doRefresh feeds recentsTracker on add/delete"
```

---

## Task 9: Implement `ctrl._revealCard` helper

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — add new method on `ctrl`, near other private helpers (after `_unbindKeyboard` at the end of `ctrl`, currently line ~1432).

- [ ] **Step 1: Add the method**

Inside the `ctrl` object literal, before its closing `}` (currently line ~1433), add:

```js
,

    /* _revealCard — given a filename known to be in the store,
       expand all ancestors + the section containing it (and the
       Recents section), select it, scroll into view, and apply a
       brief flash class to the row that auto-removes after 1.5s.
       Idempotent and safe to call multiple times. */
    _revealCard: function (filename) {
      var card = store.get(filename);
      if (!card) return;

      /* 1. Walk parent chain and uncollapse each ancestor. */
      var cursor = card;
      var safety = 16;  /* defensive against cyclic parent chains */
      while (cursor && cursor.frontmatter && cursor.frontmatter.parent && safety-- > 0) {
        treeView.collapsedNodes.delete(cursor.frontmatter.parent);
        cursor = store.get(cursor.frontmatter.parent);
      }

      /* 2. Uncollapse the section that owns this card. */
      var type = card.frontmatter.type;
      var sectionId = null;
      if (type === 'initiative') sectionId = 'initiatives';
      else if (type === 'epic') sectionId = card.frontmatter.parent ? 'initiatives' : 'orphan-epics';
      else if (type === 'story') sectionId = card.frontmatter.parent ? 'initiatives' : 'orphan-stories';
      else if (type === 'intake') sectionId = 'intakes';
      else if (type === 'checkpoint') sectionId = 'checkpoints';
      else if (type === 'decision') sectionId = 'decisions';
      else if (type === 'release-note') sectionId = 'release-notes';
      if (sectionId) treeView.collapsedSections.delete(sectionId);
      treeView.collapsedSections.delete('recents');  /* always show recents on reveal */

      /* 3. Select and re-render so the expanded state is visible. */
      this.selectCard(filename);

      /* 4. Scroll + flash on next animation frame so the new DOM
         is in place. There may be multiple rows (Recents + structural)
         — flash both. */
      requestAnimationFrame(function () {
        var rows = $qa('[data-pfl-select="' + filename + '"]');
        if (rows && rows.length > 0) {
          rows[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        rows.forEach(function (row) {
          row.classList.add('pfl-flash-new');
          setTimeout(function () { row.classList.remove('pfl-flash-new'); }, 1500);
        });
      });
    }
```

(Note the leading comma — added because `_unbindKeyboard` was the previous trailing method.)

- [ ] **Step 2: Reload and console-test**

Reload, then in console (with a workspace open):

```js
// Pick a real filename from your sidebar:
window.ProductForgeLocalView._revealCard('story-001-some-real-filename')
```

Expected: section + ancestors expand, row scrolls into view, brief background flash.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): ctrl._revealCard helper expands ancestors + scrolls + flashes"
```

---

## Task 10: Implement `ctrl._maybeAutoReveal` with gating logic

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — add new method on `ctrl`, immediately after `_revealCard` (added in Task 9).

- [ ] **Step 1: Add the method**

Inside `ctrl`, after the `_revealCard` method, add (with leading comma):

```js
,

    /* _maybeAutoReveal — decides whether a batch of newly-added
       filenames is safe to auto-select and scroll to (single-add,
       no current selection, no search, no active filters). Otherwise
       leaves the unseen counter to be shown in the toolbar. */
    _maybeAutoReveal: function (addedFilenames) {
      var searchEl = $q('[data-pfl-search]');
      var hasSearch = !!(searchEl && searchEl.value && searchEl.value.trim().length > 0);
      var hasFilters = FilterPanel.getActiveCount() > 0;

      if (hasSearch || hasFilters) return;       /* user is filtering — don't steal */
      if (addedFilenames.length !== 1) return;   /* batch — surface via counter only */
      if (selectedCard) return;                  /* user is on something — preserve */

      var fn = addedFilenames[0];
      this._revealCard(fn);
      recentsTracker.markSeen(fn);
    }
```

- [ ] **Step 2: Drop the typeof guard from Task 8**

Find the line added in Task 8 step 2:

```js
        if (changes.added.length > 0 && typeof this._maybeAutoReveal === 'function') {
          this._maybeAutoReveal(changes.added);
        }
```

Simplify to:

```js
        if (changes.added.length > 0) {
          this._maybeAutoReveal(changes.added);
        }
```

- [ ] **Step 3: Reload and run scripted scenarios**

Reload. Run each scenario, cleaning up between:

**Scenario A — auto-reveal fires:**
With nothing selected, no search, no filters, create one new card file via shell:

```bash
cat > cards/decisions/auto-reveal-a.md <<'EOF'
---
title: Auto reveal A
type: decision
status: Active
decision_date: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
---
EOF
```

Within ~5s: the new card auto-selects (detail panel pops), the row briefly flashes, no NEW badge (markSeen was called).

**Scenario B — selection blocks reveal:**
Select any existing card first. Then create another file:

```bash
cat > cards/decisions/auto-reveal-b.md <<'EOF'
---
title: Auto reveal B
type: decision
status: Active
decision_date: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
---
EOF
```

Within ~5s: selection is preserved; new card appears in Recents WITH NEW badge; (toolbar counter is implemented in Task 11).

**Scenario C — search blocks reveal:**
Type something into the search box. Create one more file:

```bash
cat > cards/decisions/auto-reveal-c.md <<'EOF'
---
title: Auto reveal C
type: decision
status: Active
decision_date: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
---
EOF
```

Within ~5s: no auto-reveal; if search matches, card appears in Recents with NEW badge.

Clean up:

```bash
rm cards/decisions/auto-reveal-a.md cards/decisions/auto-reveal-b.md cards/decisions/auto-reveal-c.md
```

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): ctrl._maybeAutoReveal with selection/search/filter gating"
```

---

## Task 11: Update `_updateRefreshIndicator` with "N new" suffix + click handler

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` — replace `ctrl._updateRefreshIndicator` (currently lines 1122-1129).

- [ ] **Step 1: Replace the method body**

Find:

```js
    _updateRefreshIndicator() {
      var el = $q('[data-pfl-refresh-ind]');
      if (!el) return;
      var count = store.cards.size;
      var now = new Date();
      var time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.textContent = count + ' cards · ' + time;
    },
```

Replace with:

```js
    _updateRefreshIndicator() {
      var el = $q('[data-pfl-refresh-ind]');
      if (!el) return;
      var count = store.cards.size;
      var now = new Date();
      var time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var unseen = recentsTracker.unseenAddedCount;

      /* Build via DOM rather than HTML so we can attach a click
         handler to just the suffix without re-binding every refresh. */
      el.textContent = '';
      el.appendChild(document.createTextNode(count + ' cards · ' + time));
      if (unseen > 0) {
        var sep = document.createTextNode(' · ');
        el.appendChild(sep);
        var span = document.createElement('span');
        span.className = 'pfl-refresh-new-count';
        span.textContent = unseen + ' new';
        span.title = 'Click to show recent additions';
        span.addEventListener('click', function () {
          treeView.collapsedSections.delete('recents');
          var sidebar = $q('.pfl-sidebar');
          if (sidebar) sidebar.scrollTop = 0;
          /* Clearing all unseen acknowledges the batch but does
             NOT remove individual NEW badges from rows — those
             still expire by click or by pruneStale (10min). */
          recentsTracker.unseenAddedCount = 0;
          ctrl._renderTree();
          ctrl._updateRefreshIndicator();
        });
        el.appendChild(span);
      }
    },
```

- [ ] **Step 2: Reload and run scenario**

Reload. With nothing selected, no search, no filters: create 3 files in one batch:

```bash
for i in 1 2 3; do
  cat > cards/decisions/n-new-$i.md <<EOF
---
title: N new $i
type: decision
status: Active
decision_date: 2026-05-05
created: 2026-05-05
updated: 2026-05-05
---
EOF
done
```

Within ~5s:
- No auto-reveal (batch > 1).
- Toolbar shows ` · 3 new` in accent color, gently pulsing.
- All 3 cards appear in Recents with NEW badges.

Click the "3 new" suffix:
- Recents un-collapses (was already expanded — no visible change here).
- Sidebar scrolls to top.
- Suffix disappears.
- NEW badges remain on the 3 rows (will clear on click of each row, or after 10min).

Clean up:

```bash
rm cards/decisions/n-new-1.md cards/decisions/n-new-2.md cards/decisions/n-new-3.md
```

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): refresh indicator shows pulsing 'N new' suffix"
```

---

## Task 12: Wire `selectCard` markSeen + `destroy` reset

**Files:**
- Modify: `forge-shell/app/js/product-forge.js`
  - `ctrl.selectCard` (currently lines 900-905)
  - `ctrl.destroy` (currently lines 887-893)

- [ ] **Step 1: Modify `selectCard`**

Find:

```js
    selectCard(filename) {
      selectedCard = filename;
      var card = store.get(filename);
      detailPanel.renderCard(card);
      treeView.highlightSelected(filename);
    },
```

Replace with:

```js
    selectCard(filename) {
      selectedCard = filename;
      var card = store.get(filename);
      detailPanel.renderCard(card);
      treeView.highlightSelected(filename);

      /* Acknowledging a card via click clears its NEW badge.
         Re-render so the badge disappears from Recents and from
         any structural duplicate. Cheap — render is fast. */
      if (recentsTracker.isNew(filename)) {
        recentsTracker.markSeen(filename);
        this._renderTree();
        this._updateRefreshIndicator();
      }
    },
```

- [ ] **Step 2: Modify `destroy`**

Find:

```js
    destroy() {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      selectedCard = null;
      store.clear();
      cardsHandle = null;
    },
```

Replace with:

```js
    destroy() {
      this._stopAutoRefresh();
      this._unbindKeyboard();
      selectedCard = null;
      store.clear();
      cardsHandle = null;
      recentsTracker.reset();
      treeView.collapsedSections.clear();
      treeView.collapsedNodes.clear();
    },
```

(Also clearing tree collapse state so re-init starts fresh — matches existing first-render behavior.)

- [ ] **Step 3: Reload + verify**

Reload. Create one new file (with no selection/search/filter so auto-reveal fires); confirm NEW badge appears, then doesn't (markSeen during reveal). Then manually create another file, this time WITH a card selected; confirm NEW badge appears; click the card in Recents; confirm NEW badge disappears immediately (not just on next refresh).

Re-select the workspace from the file menu; confirm Recents starts fresh and unseen counter is 0.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): selectCard markSeen + destroy resets recents state"
```

---

## Task 13: Full manual test pass against spec §9 (T1–T14)

**Files:**
- None modified.

- [ ] **Step 1: Run each scenario from the spec**

Open `docs/superpowers/specs/2026-05-05-product-forge-recents-and-auto-reveal-design.md` to §9.

Walk through T1–T14 in order. For each, write down ✅ or ❌ in a scratch note. Use the same external-file-creation approach used in earlier tasks for T2/T3/T4/T5/T6/T8/T10. For T9 (Edit modal), open the modal, change title, save — confirm Recents order is unchanged.

- [ ] **Step 2: Investigate any failing scenario**

If any T-case fails, do NOT mark this task complete. Capture the failure:
- Which T-case
- Observed behavior vs. expected
- Console errors (open devtools, copy them)

Open a follow-up: re-read the failing path in `product-forge.js`, fix, commit with `fix(product-forge): <what>`, re-run the scenario, then continue.

- [ ] **Step 3: Cleanup any test artifacts**

```bash
git status
# remove any leftover test cards from cards/decisions/, cards/stories/, etc.
```

- [ ] **Step 4: Commit (only if any test artifacts were committed by accident)**

If no artifacts, skip. Otherwise:

```bash
git rm cards/path/to/leftover.md
git commit -m "chore: remove smoke-test fixtures"
```

---

## Self-Review Checklist (run before handoff)

**Spec coverage:**
- §6.1 Recents behavior → Tasks 6, 7 ✅
- §6.2 Data flow / getRecents → Task 4 ✅
- §6.3 Type chip + NEW badge rendering → Tasks 1 (CSS), 6 (HTML) ✅
- §6.4 Re-render triggers → Task 7 ✅
- §6.5 Edge cases → covered by Task 4 (sort tie-break, missing dates) and Task 7 (search/filter on Recents) ✅
- §7.1 Detection in `_doRefresh` → Task 8 ✅
- §7.2 Auto-reveal gates → Task 10 ✅
- §7.3 Reveal behavior (expand ancestors, scroll, flash) → Task 9 ✅
- §7.4 "N new" toolbar indicator → Task 11 ✅
- §7.5 NEW badge behavior + 10-min prune → Tasks 5 (`pruneStale`), 6 (badge render), 12 (markSeen on click) ✅
- §7.6 Edge cases (added-then-deleted, parent missing, etc.) → Task 5 (`forget`), Task 9 (safety counter on parent walk) ✅
- §7.7 Race-free coupling → naturally inherited; no extra task needed ✅
- §8 Files modified — only the two listed files are touched across all tasks ✅
- §9 Test plan T1–T14 → Task 13 ✅

**Placeholder scan:** No "TBD", "implement later", "similar to". All code blocks contain real, paste-ready code. ✅

**Type/name consistency:**
- `recentsTracker.sessionAddedAt` (Map) used consistently ✅
- `recentsTracker.unseenAddedCount` (number) used consistently ✅
- `recentsTracker.noteAdded / markSeen / forget / pruneStale / isNew / getRecents / reset` — all defined in Task 2/4/5, called in Tasks 6/7/8/10/11/12 with matching arity ✅
- `_revealCard(filename)` (Task 9), called by `_maybeAutoReveal` (Task 10) ✅
- `_maybeAutoReveal(addedFilenames)` (Task 10), called by `_doRefresh` (Task 8) ✅
- CSS class names: `pfl-new-badge`, `pfl-flash-new`, `pfl-type-chip`, `pfl-refresh-new-count` — defined Task 1, used Tasks 6/9/11 ✅
- `data-pfl-section="recents"` attribute referenced in CSS (Task 1) and HTML (Task 6) ✅

No issues found.
