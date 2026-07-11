# Product Forge filter panel — standardize to Slack/Outlook pattern

**Date:** 2026-07-08
**Scope:** Mechanism only (open/close behavior + DOM placement + attributes). Panel content/filter logic unchanged.
**Files:** `forge-shell/app/js/product-forge.js`, `forge-shell/app/css/product-forge.css`

## Problem

The Product Forge filter panel (`.pfl-filter-panel`) is visible even when closed — scrolling the board reveals it parked at the right edge. Two divergences from the established Slack/Outlook pattern cause this and a non-standard toggle mechanism.

### Root cause

1. **Wrong DOM context.** The panel is rendered inside `<main class="pfl-detail-panel">` (`product-forge.js:1209`), which is the horizontally-scrollable board surface. With `position: absolute; right: 0`, the panel anchors to that wide scroll content, so the closed-state `transform: translateX(100%)` only shifts it ~280px past the content's far right edge — still reachable by horizontal scroll.
2. **Missing positioning context.** `.pfl-layout` has no `position: relative` (it is missing the declaration that `` has at `:12`), so absolute children do not anchor to the layout grid.

### Reference pattern (Slack/Outlook)

- Panel is a **direct child of `.X-layout`** (`:140`), placed after the detail panel.
- `.X-layout { position: relative }` anchors it.
- Toggle button: `data-X-action="toggle-filter"` (toolbar) plus a second identical-action close button inside the panel header.
- Open state: `.open` class on the panel; tracked by a boolean (`filterPanelOpen`).
- Closed CSS: `top: var(--toolbar-height); right: 0; bottom: 0; transform: translateX(100%);` with `overflow-y: auto`.

## Goal

Make Product Forge's filter panel open/close behave identically to Slack/Outlook: hidden cleanly when closed (unreachable by board scroll), slides in over the detail panel's right side when open, toggled from the toolbar button or the in-panel close button. Standardize the toggle attribute and open-class names to the `data-pfl-action="toggle-filter"` / `.open` convention.

## Design

### `product-forge.css`

- `.pfl-layout`: add `position: relative;` (mirrors ``).
- `.pfl-filter-panel` base rule: replace `top: 0; … height: 100%;` with `top: var(--toolbar-height); right: 0; bottom: 0;` and add `overflow-y: auto;`. Keep `transform: translateX(100%); transition: transform 0.2s ease;` and all other declarations (width, background, border-left, box-shadow, z-index, display/flex).
- Rename the open modifier: `.pfl-filter-panel.pfl-open` → `.pfl-filter-panel.open` (body unchanged: `transform: translateX(0);`).

### `product-forge.js` — render template (`_renderLayout`)

- Toolbar button: change `data-pfl-filter-toggle` to `data-pfl-action="toggle-filter"`. Leave it inside `.pfl-filter-badge` so the active-count badge (`_updateFilterBadge`) keeps working.
- Move the panel element: remove `<div class="pfl-filter-panel" data-pfl-filter-panel></div>` from inside `<main class="pfl-detail-panel">` and append it as a direct child of `.pfl-layout`, immediately after `</main>`. The `data-pfl-filter-panel` attribute is retained as the render hook (selectors that target it stay valid).

### `product-forge.js` — controller

- Toggle handler (currently `~1237`): retarget the lookup from `$q('[data-pfl-filter-toggle]')` to `$q('[data-pfl-action="toggle-filter"]')`. In the click callback, toggle the `.open` class (was `.pfl-open`) instead of `pfl-open`; keep flipping `FilterPanel.open` and calling `ctrl._renderFilterPanel()` when opening.
- Close handler (currently `~1500`, the `.pfl-filter-close-btn` binding): change `classList.remove('pfl-open')` to `classList.remove('open')`; keep setting `FilterPanel.open = false`.

### Unchanged (explicitly out of scope)

- The `FilterPanel` object and all of its methods (`render`, `filterHierarchy`, `filterRecents`, `clearAll`, `getActiveCount`).
- The panel's dynamic content (per-type status filters, filter chips, clear-all).
- The `.pfl-filter-badge` active-count badge and `_updateFilterBadge`.
- `_renderFilterPanel` / `_bindFilterEvents` wiring (selectors still resolve).
- The event-binding style of pfl (direct `addEventListener`, not delegated) — not converted to sf/of delegation in this change.

## Verification

1. Closed: panel is not visible and cannot be revealed by horizontal/vertical scroll of the board.
2. Toolbar filter button toggles the panel open/closed; the slide animation works.
3. The in-panel close button hides the panel.
4. Filter content still renders (status selects, chips, clear-all) and filters still affect the tree.
5. Active-count badge still updates when filters are added/removed.
6. No regressions to the sidebar collapse/resize (the panel is a non-grid absolute child, like sf/of).

## Test plan

Manual QA in the browser/desktop app (no unit tests cover the panel DOM/CSS). Existing `node --test` suite (56 sidebar tests) must remain green — the change does not touch `sidebar.helpers.js`.
