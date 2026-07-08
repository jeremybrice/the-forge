# PFL Filter Panel Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Product Forge's filter panel hide correctly when closed and standardize its open/close mechanism to the Slack/Outlook pattern.

**Architecture:** Move `.pfl-filter-panel` out of the scrollable `<main class="pfl-detail-panel">` to be a direct child of `.pfl-layout`, add `position: relative` to `.pfl-layout`, and repoint the toggle to `data-pfl-action="toggle-filter"` + `.open` class. Two parallelizable file owners (CSS, JS); filter content/logic unchanged.

**Tech Stack:** Vanilla JS (no framework), plain CSS, `node --test` for the unit suite. No DOM test harness exists — verification is `node --check` (syntax), `npm test` (regression gate), and a manual QA checklist.

**Spec:** `docs/superpowers/specs/2026-07-08-pfl-filter-panel-standardization-design.md`

## Global Constraints

- Open-class name is `.open` (NOT `pfl-open`). Both files must agree.
- Toggle attribute is `data-pfl-action="toggle-filter"` (matches the `data-X-action` convention used by slack/outlook).
- Panel render-hook attribute stays `data-pfl-filter-panel` (do not rename — selectors depend on it).
- The `FilterPanel` object, `_renderFilterPanel`, `_bindFilterEvents`, `_updateFilterBadge`, and the `.pfl-filter-badge` count badge are NOT modified.
- Mobile view was deprecated in `2aa33e1` — do not reintroduce any responsive/`@media` rules.

## File Structure

- **Modify** `forge-shell/app/css/product-forge.css` — `.pfl-layout` + `.pfl-filter-panel` rules. (Task 1 owner)
- **Modify** `forge-shell/app/js/product-forge.js` — render template + toggle/close handlers. (Task 2 owner)
- Tasks 1 and 2 touch **different files** and may run in parallel. Task 3 runs after both and owns the commit.

---

### Task 1: CSS — reposition panel + add layout positioning context

**Files:**
- Modify: `forge-shell/app/css/product-forge.css` (`.pfl-layout` rule at lines 6-13; `.pfl-filter-panel` rule at lines 324-341)

**Interfaces:**
- Produces: `.pfl-layout { position: relative }` (anchors the absolute panel) and `.pfl-filter-panel.open` (the open modifier the JS toggles).

- [ ] **Step 1: Add `position: relative` to `.pfl-layout`**

In `forge-shell/app/css/product-forge.css`, change the `.pfl-layout` rule from:

```css
.pfl-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  height: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.18s ease;
}
```

to:

```css
.pfl-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  height: 100%;
  overflow: hidden;
  position: relative;
  transition: grid-template-columns 0.18s ease;
}
```

- [ ] **Step 2: Reposition `.pfl-filter-panel` base rule + rename open modifier**

Change the `.pfl-filter-panel` block (currently `top: 0; … height: 100%`) and the `.pfl-open` modifier to:

```css
.pfl-filter-panel {
  position: absolute;
  top: var(--toolbar-height);
  right: 0;
  bottom: 0;
  width: 280px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}
.pfl-filter-panel.open {
  transform: translateX(0);
}
```

(Net changes vs. current: `top: 0` → `top: var(--toolbar-height)`; removed `height: 100%`; added `bottom: 0`; added `overflow-y: auto`; `.pfl-open` → `.open`.)

- [ ] **Step 3: Self-check — no stale class references remain in CSS**

Run: `rg -n "pfl-open" forge-shell/app/css/product-forge.css`
Expected: **no output** (the only `.pfl-open` occurrence was the panel modifier, now renamed to `.open`). Then read the `.pfl-filter-panel` rule and confirm it no longer contains `height: 100%` (replaced by `top/bottom`).

- [ ] **Step 4: Stop here — do not commit.**

The commit is owned by Task 3 after the JS task also lands. Leave changes unstaged.

---

### Task 2: JS — move panel DOM + repoint toggle/close to the new contract

**Files:**
- Modify: `forge-shell/app/js/product-forge.js` (toolbar button ~1186; panel element ~1203-1212; toggle handler ~1237-1245; close handler ~1500)

**Interfaces:**
- Consumes: `.pfl-filter-panel.open` class (produced by Task 1) and `.pfl-layout { position: relative }` (anchors the moved panel).
- Produces: a toolbar button carrying `data-pfl-action="toggle-filter"`, the panel as a `.pfl-layout` child, and handlers that toggle/remove the `open` class.

- [ ] **Step 1: Change the toolbar button attribute**

In the render template string, change:

```js
              '<button class="btn-icon" data-pfl-filter-toggle title="Filter"><i class="fa-solid fa-filter"></i></button>' +
```

to:

```js
              '<button class="btn-icon" data-pfl-action="toggle-filter" title="Filter"><i class="fa-solid fa-filter"></i></button>' +
```

- [ ] **Step 2: Move the panel element out of `<main class="pfl-detail-panel">`**

Change the detail-panel block from:

```js
          '<main class="pfl-detail-panel">' +
            '<div class="pfl-empty-state empty-state">' +
              '<div class="icon"><i class="fa-solid fa-file-lines"></i></div>' +
              '<div>Select a card from the tree to view details</div>' +
            '</div>' +
            '<div class="pfl-card-detail hidden"></div>' +
            '<div class="pfl-filter-panel" data-pfl-filter-panel></div>' +
          '</main>' +
```

to:

```js
          '<main class="pfl-detail-panel">' +
            '<div class="pfl-empty-state empty-state">' +
              '<div class="icon"><i class="fa-solid fa-file-lines"></i></div>' +
              '<div>Select a card from the tree to view details</div>' +
            '</div>' +
            '<div class="pfl-card-detail hidden"></div>' +
          '</main>' +
          '<div class="pfl-filter-panel" data-pfl-filter-panel></div>' +
```

(The panel line moves from inside `<main>` to immediately after `</main>`, still inside `.pfl-layout` which closes with the next `'</div>' +`.)

- [ ] **Step 3: Retarget the toggle handler selector + rename the class**

Change the toggle binding from:

```js
      /* Bind filter toggle */
      var filterBtn = $q('[data-pfl-filter-toggle]');
      if (filterBtn) {
        filterBtn.addEventListener('click', function () {
          FilterPanel.open = !FilterPanel.open;
          var panel = $q('[data-pfl-filter-panel]');
          if (panel) panel.classList.toggle('pfl-open', FilterPanel.open);
          if (FilterPanel.open) ctrl._renderFilterPanel();
        });
      }
```

to:

```js
      /* Bind filter toggle */
      var filterBtn = $q('[data-pfl-action="toggle-filter"]');
      if (filterBtn) {
        filterBtn.addEventListener('click', function () {
          FilterPanel.open = !FilterPanel.open;
          var panel = $q('[data-pfl-filter-panel]');
          if (panel) panel.classList.toggle('open', FilterPanel.open);
          if (FilterPanel.open) ctrl._renderFilterPanel();
        });
      }
```

- [ ] **Step 4: Rename the class in the close handler**

In `_bindFilterEvents`, change the close-button handler's class removal from:

```js
          FilterPanel.open = false;
          var panel = $q('[data-pfl-filter-panel]');
          if (panel) panel.classList.remove('pfl-open');
```

to:

```js
          FilterPanel.open = false;
          var panel = $q('[data-pfl-filter-panel]');
          if (panel) panel.classList.remove('open');
```

- [ ] **Step 5: Syntax check**

Run: `node --check forge-shell/app/js/product-forge.js`
Expected: no output (exit 0).

- [ ] **Step 6: Self-check — no stale references remain in JS**

Run: `rg -n "pfl-filter-toggle|pfl-open" forge-shell/app/js/product-forge.js`
Expected: **no output** (old attribute and old class fully removed from JS).

- [ ] **Step 7: Stop here — do not commit.**

The commit is owned by Task 3.

---

### Task 3: Verify + commit (runs after Task 1 and Task 2)

**Files:**
- None modified (verification + commit of Task 1 + Task 2 output).

- [ ] **Step 1: Confirm both files changed, nothing else**

Run: `git status --short && git diff --stat`
Expected: exactly two modified files — `forge-shell/app/css/product-forge.css` and `forge-shell/app/js/product-forge.js`.

- [ ] **Step 2: Confirm no stale references repo-wide**

Run: `rg -n "pfl-filter-toggle|pfl-open" forge-shell/app/`
Expected: **no output**.

- [ ] **Step 3: Run the unit-test regression gate**

Run: `npm test` (in `forge-shell`)
Expected: `tests 56 … pass 56 … fail 0`.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/css/product-forge.css forge-shell/app/js/product-forge.js
git commit -m "fix(product-forge): hide filter panel when closed; standardize toggle

Move .pfl-filter-panel to a .pfl-layout child and add position: relative so
the closed-state translateX(100%) hides it past the viewport edge instead of
past the scrollable board content (it was visible on board scroll). Repoint
the toggle to data-pfl-action=\"toggle-filter\" + .open to match slack/outlook.
Filter content/logic unchanged."
```

- [ ] **Step 5: Manual QA checklist (browser/desktop app)**

Verify in the running app:
1. With the filter closed, scroll the Product Forge board horizontally and vertically — the panel must NOT appear.
2. Click the toolbar Filter button — panel slides in from the right.
3. Click the toolbar Filter button again — panel slides out / hides.
4. Open the panel, click the in-panel close button — panel hides.
5. Panel content still renders (status selects per type); choosing a status filters the tree.
6. Active-count badge on the toolbar Filter button updates when filters are added/cleared.
7. Sidebar collapse/resize still works (panel is a non-grid absolute child).
