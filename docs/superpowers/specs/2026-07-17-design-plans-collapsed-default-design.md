# Design Plans — Collapsed-by-Default Tree with Persisted Expansion

**Date:** 2026-07-17
**Status:** Approved
**Scope:** `design-plans` forge-shell plugin only (`app/js/design-plans.js`, `app/js/design-plans.helpers.js`, `app/css/design-plans.css`, `test/design-plans.helpers.test.js`).

## Problem

The Design Plans sidebar tree renders every initiative **expanded** by default
(`open = !state.collapsed[init.key]` with an empty map). As the number of
initiatives grows, the tree becomes a long, noisy list the user must manually
collapse on every visit. Collapse choices are also lost on app restart, and
selecting a doc from search results does not reveal it in the tree once the
query is cleared.

## Goals

1. All initiatives render **collapsed** by default.
2. The user's expand/collapse choices **persist** across tab switches,
   refreshes (manual and file-watcher), and app restarts.
3. Selecting a doc from **search results** reveals it in the tree: the parent
   initiative is expanded (and persisted as expanded), the row is scrolled
   into view and briefly flashed, matching the existing PFL auto-reveal feel.

## Non-Goals

- No expand-all / collapse-all control.
- No change to other plugins' trees (Product Forge, etc.).
- No persistence of the selected doc or detail scroll position (deferred idea).
- No fix for multi-handoff selection (deferred idea).
- No new dependencies, no build step.

## Behavior

### Default state

- An initiative renders expanded **iff** its key is present in the persisted
  expanded-set. On first-ever run (no stored value) the set is empty, so every
  initiative is collapsed.
- The internal state flips from `state.collapsed` (key → true, default open)
  to `state.expanded` (key → true, default collapsed). Rationale: with a
  collapsed default, only expanded keys need storing — the set stays small and
  self-bounding.

### Toggle persistence

- Clicking an initiative header toggles its key in `state.expanded`, re-renders
  the tree, and saves the set to `localStorage`.
- Storage key: `forge-shell-dp-expanded`. Value: JSON array of initiative key
  strings (`date|slug`, as produced by `initiativeKey(doc)`).
- All storage access is wrapped in try/catch (existing `readDocsRoot` /
  `writeDocsRoot` pattern). If storage is unavailable (private mode, quota),
  the in-memory set still works for the session.
- Corrupt/unparseable stored JSON is treated as an empty set.

### Pruning

- After each `_loadDocs()`, the persisted set is pruned against the currently
  known initiative keys and re-saved if it changed. This drops keys for
  deleted/renamed docs so storage does not accumulate stale entries.
- An initiative whose file is renamed gets a new key and falls back to the
  collapsed default — acceptable, self-healing.

### Refresh and tab switches

- `state.expanded` lives at module scope and is not reset by `destroy()` or
  `refresh()`, so in-session state survives tab switches and both refresh
  paths. On cold start it is rehydrated from `localStorage` in `init()`.

### Search reveal

- Clicking a search result (in `_renderSearchResults`) additionally:
  1. adds the doc's initiative key to `state.expanded` and persists it;
  2. sets `state.pendingReveal = { key, type }`.
- The tree is hidden while a query is present, so the reveal is consumed the
  next time `_renderTree()` actually renders the tree with a selection: after
  rendering, if `state.pendingReveal` matches a rendered member row, that row
  is `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`ed and given a
  `dp-flash-new` class that auto-removes after 1.5s; the flag is then cleared.
- This mirrors the PFL pattern (`product-forge.js` `flashFilename` /
  `_revealCard`, `pfl-flash-new` keyframes) with `dp-` prefixed classes.

## Implementation Shape

### Helpers (`design-plans.helpers.js`) — pure, node-tested

- `parseExpanded(raw)` → `string[]`: JSON-parse a stored value; return `[]`
  for null/empty/invalid JSON or non-array results; filter to string entries.
- `pruneExpanded(keys, validKeys)` → `string[]`: return the entries of `keys`
  that exist in `validKeys` (an array), preserving order, deduped.

Storage read/write stays in the controller (DOM-adjacent), per the existing
`readDocsRoot`/`writeDocsRoot` precedent.

### Controller (`design-plans.js`)

- `state.collapsed` → `state.expanded` (object map, key → true).
- `EXPANDED_KEY = 'forge-shell-dp-expanded'`; `readExpanded()` /
  `writeExpanded()` helpers with try/catch, delegating parsing to
  `H.parseExpanded` / `JSON.stringify`.
- `init()`: hydrate `state.expanded` from storage before first tree render.
- `_renderTree()`: `open = !!state.expanded[init.key]`; after binding events,
  consume `state.pendingReveal` (scroll + flash) when applicable.
- Toggle handler in `_bindTreeEvents()`: flip membership in `state.expanded`,
  persist, re-render.
- `_loadDocs()`: after grouping, prune the expanded set via `H.pruneExpanded`
  and persist if changed.
- `_renderSearchResults()` click handler: expand + persist the doc's
  initiative, set `state.pendingReveal` (existing selection logic unchanged).
- `destroy()`: unchanged (does not clear expanded state).

### CSS (`design-plans.css`)

- Add `@keyframes dp-flash-new-keyframes` and `.dp-flash-new` (1.5s ease-out
  background highlight), mirroring `pfl-flash-new` in `product-forge.css`.

## Error Handling

- Storage read/write failures: silent fall-back to in-memory set (try/catch).
- Corrupt stored value: treated as empty set; overwritten on next save.
- `pendingReveal` target not rendered (e.g. filters exclude the doc): flag is
  cleared without scrolling; the doc is still shown in the detail panel.

## Testing

- New node `--test` cases in `test/design-plans.helpers.test.js` for
  `parseExpanded` (valid array, null, invalid JSON, non-array, mixed types)
  and `pruneExpanded` (drops stale keys, preserves order, dedupes).
- Full suite (`npm test` in `forge-shell/`) must stay green.
- Manual QA checklist:
  1. Cold start with cleared storage → all initiatives collapsed.
  2. Expand two initiatives → reload app → those two remain expanded, rest
     collapsed.
  3. Toggle one back → persists collapsed on next load.
  4. Search → click a result in a collapsed initiative → clear query → tree
     shows that initiative expanded, row scrolled into view and flashed.
  5. Manual refresh and file-watcher refresh preserve expansion state.
  6. Rename/delete a spec file → its key is pruned; no errors.
