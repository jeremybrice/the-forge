# Product Forge sidebar — progressive findability (Approach A)

**Date:** 2026-07-09  
**Scope:** Product Forge Local sidebar only: search results mode, context strip + structural jump, pins, type chips on all rows, and a default-collapsed **More** group for non-work sections.  
**Files:** `forge-shell/app/js/product-forge.js`, `forge-shell/app/css/product-forge.css` (tests under existing product-forge / sidebar test harness if present).  
**Related:** `docs/superpowers/specs/2026-05-05-product-forge-recents-and-auto-reveal-design.md` (Recents / NEW / expandAncestors — retained).

## Problem

The PFL sidebar already has search, Recents (top 10 by `created`), a fixed hierarchy, status dots, and type chips on Recents rows. Finding and staying oriented is still hard because:

1. **Search prunes the tree** (title/filename substring) and auto-expands every section, destroying hierarchy context and producing a noisy expanded mess.
2. **Recents and structure are disconnected.** Selecting a recent expands ancestors in state but does not keep a durable “you are here” signal; deep trees re-collapse away from the active card.
3. **Scannability is uneven.** Type chips exist only on Recents; structural rows are status-dot + long title. Non-work sections (Intakes, Checkpoints, Decisions, Release Notes) compete with Initiatives for vertical space at ~236px width.

## Goal

Ship one coherent **progressive-layer** sidebar model (Approach A) with **work hierarchy first** as the default home base:

| Layer | Purpose |
|-------|---------|
| **Chrome** | Type chip on every row; non-work sections under collapsible **More** (default collapsed) |
| **Orientation** | Sticky context strip under search; Recents/Pin select expands ancestors + scrolls structural row; **Pin** (max 3, persisted) above Recents |
| **Search** | Non-empty query → ranked **results list** (not tree prune); empty query restores structural tree; Recents/Pin hide while searching |

No dual Browse/Find mode toggle. No backend changes.

## Default open state

- **Initiatives** section: expanded on first open in a session (existing collapse state wins after user interaction).
- **Recents**: section present when there are recents; compact list (header open if length > 0).
- **Pinned**: shown only when length > 0; above Recents.
- **Orphan Epics / Orphan Stories**: top-level sections as today.
- **More**: collapsed by default; contains Intakes, Checkpoints, Decisions, Release Notes.
- Collapse state for sections/nodes remains session-sticky via existing `treeView.collapsedSections` / `collapsedNodes` after first interaction.

## Layout (not searching)

```
┌─ Search ─────────────────────────────────┐
├─ Context strip (only when a card is selected)
├─ Pinned (0–3)                            │
├─ Recents (≤10, exclude pins)             │
├─ Initiatives                             │
├─ Orphan Epics / Orphan Stories           │
└─ More ▸ Intakes, Checkpoints, Decisions, Release Notes
```

## Design

### 1. Search → results mode

**Trigger:** `data-pfl-search` input non-empty after trim (case-insensitive).

**While searching:**
- Do **not** render Pinned, Recents, or the structural tree.
- Render a flat **results list** under the search box (context strip may still show the currently selected card if any).
- Do **not** clear `collapsedSections` / `collapsedNodes` (today’s “auto-expand all while searching” is removed).
- Status filters (`FilterPanel`) still apply to the candidate set.

**Match fields (v1):** `frontmatter.title` and `filename` only (same as today). Body/frontmatter full-text is out of scope.

**Rank (stable):**
1. Title starts-with query  
2. Title contains query  
3. Filename contains query  
4. Tie-break: `filename` ascending  

**Result row chrome:** type chip · status dot · title · muted parent breadcrumb (truncated). Same select handler as tree rows (`data-pfl-select`).

**Exit:** empty query or Esc (when focus is in search) restores tree + pin + recents with prior collapse state intact.

### 2. Context strip + structural jump

**Placement:** sticky under `.sidebar-search` inside `.pfl-sidebar`, above the scrollable tree/results body. Hidden when no card is selected.

**Content:** parent chain from root to selected card, joined by ` › `  
- Initiative → epic → story: `InitTitle › EpicTitle › StoryTitle`  
- Leaf types under More: `Decisions › Title` (section label + card title)  
- Orphans: `Orphan Epics › Title` / `Orphan Stories › Title`  

**Interaction:**
- Click a breadcrumb segment (except the last) → select that ancestor filename, expand ancestors, scroll its structural row into view, apply existing `pfl-flash-new` flash.
- Selecting from Recents or Pin always runs: `expandAncestors(filename)` → re-render if needed → scroll structural row into view → flash. (Today expandAncestors mutates collapse state; ensure a render + scroll path runs on every Recents/Pin select.)

**Implementation note:** Prefer a dedicated scroll helper, e.g. `treeView.scrollToFilename(filename)`, using `scrollIntoView({ block: 'nearest' })` on `[data-pfl-filename="…"]` inside `.pfl-tree-view`.

### 3. Pin store

New session+persist helper (same file as other PFL state, pattern like `recentsTracker`):

```
pinStore = {
  filenames: string[],  // max 3, order = display order
  load(), save(),       // localStorage key: "pfl-pinned"
  toggle(filename),     // add if absent; remove if present
  add(filename), remove(filename),
  pruneMissing(store)   // drop filenames not in store
}
```

**Rules:**
- Max **3** pins. If at cap and user pins another: **block** and toast “Unpin one first” (no silent replace).
- Persist JSON array in `localStorage` under `pfl-pinned`.
- On load/refresh: `pruneMissing(store)` before render.
- Pins that appear in Recents are **excluded from the Recents list** (no duplicate rows).
- Pin affordance: hover icon on tree/recents/results rows (star or thumbtack); toggles `pinStore`; aria/title “Pin” / “Unpin”.

**Render:** `_renderPinnedSection(cards)` above Recents; row chrome matches Recents (type chip + status + title + optional NEW).

### 4. Type-aware chrome + More

**Type chip on all rows:** reuse `.pfl-type-chip` + `getTypeColor(type)` currently used only in `_renderRecentsRow`. Apply in `_renderInitiativeNode`, `_renderEpicNode`, `_renderStoryNode`, `_renderLeafNode`, pinned rows, and search result rows.

**More section:**
- New section id: `more`.
- Header label: `More`; count = sum of intakes + checkpoints + decisions + release-notes lengths.
- Children: the four existing section blocks (or equivalent nested headers) for Intakes, Checkpoints, Decisions, Release Notes — same row renderers and drop behavior as today for those leaves.
- Default: seed `treeView.collapsedSections` with `'more'` at controller init (so first paint is collapsed). After the user toggles More, session stickiness applies as for any other section. Do not re-seed on every refresh.
- Nested structure: More body’s children are the four existing section headers (Intakes, Checkpoints, Decisions, Release Notes) with the same leaf row renderers as today — not a flat unlabelled list.
- Selecting a card under More: `expandAncestors` deletes `'more'` from `collapsedSections` and opens the inner section id (`intakes` / `checkpoints` / `decisions` / `release-notes`) so the structural row is visible after jump.

**Orphans remain top-level** (work path, not under More).

### 5. Controller / data flow

`_renderTree` pipeline:

1. Read search query from `data-pfl-search`.
2. **If searching:**  
   - Candidates = `store.all()` → status-filter equivalent for flat cards → match title/filename → sort by rank → render results list.  
   - Skip hierarchy build for display (may still use store for selection/detail).
3. **Else:**  
   - `buildHierarchy(store)`  
   - Apply existing structural search? **No** — search is results-only; tree path never substring-filters.  
   - `FilterPanel.filterHierarchy` + `filterRecents`  
   - `pinStore.pruneMissing`; resolve pin cards; filter recents to exclude pin filenames  
   - Attach `hierarchy.pinned`, `hierarchy.recents`  
   - `treeView.render(hierarchy)` including More wrapper  
4. If `selectedCard`: update context strip; `highlightSelected`.

Selection path (tree, results, pin, recents): set selection → detail panel → context strip → expandAncestors (tree mode) → scroll + flash when coming from pin/recents or breadcrumb.

### 6. CSS

- Sticky context strip under search: compact single-line, muted text, clickable segments, ellipsis overflow.
- Results list container: reuse tree row styles where possible; breadcrumb secondary text smaller/muted.
- Pin icon: muted until hover/pinned; pinned state uses accent.
- More section header: same `.pfl-tree-section-header` pattern as other sections.
- Type chip spacing: keep 8×8 chip; ensure title still truncates cleanly at narrow sidebar widths.
- No new `@media (max-width: 768px)` rules (desktop-only app).

## Unchanged (explicitly out of scope)

- Recents algorithm (`getRecents` by `created` / file timestamp, limit 10), NEW badge, prune horizon, toolbar “N new” — except de-dupe with pins.
- Filter panel content/status filter logic (mechanism already standardized).
- Card edit modal, drag-drop reparent rules, detail panel.
- Full-text body search, cross-plugin pins, dual Browse/Find mode, changing default sort of Initiatives.
- Mobile/responsive CSS.

## Edge cases

| Case | Behavior |
|------|----------|
| Pin target deleted on disk | Dropped by `pruneMissing` on next load/refresh |
| Pin at cap (3) | Block + toast; no add |
| Search + active status filters | Results only include status-matching cards (init/epic/story rules same as `filterRecents`; other types always eligible) |
| Empty query after search | Full tree restored; collapse state unchanged from before search |
| Select result while searching | Detail opens; strip updates; tree not shown until query cleared (then structural row highlighted) |
| Unknown type in expandAncestors | Keep existing console.warn; strip shows title only |

## Verification

1. Default open: Initiatives visible; More collapsed; non-work cards not flooding the sidebar.
2. Type chips visible on initiative/epic/story/leaf rows, not only Recents.
3. Pin up to 3; persist across reload; fourth pin toasts and does not add; pinned rows excluded from Recents.
4. Select Recents/Pin row → structural ancestors expand, row scrolls into view, flash runs.
5. Context strip shows chain; clicking an ancestor selects and scrolls to it.
6. Typing in search replaces tree with ranked results; clearing restores tree and prior collapse.
7. Status filters still affect tree and results; filter panel open/close unchanged.
8. Existing recents NEW / toolbar “N new” still work.
9. No mobile CSS reintroduced; sidebar collapse/resize unaffected.

## Test plan

- Extend or add unit tests for: search rank order, pin cap/persist/prune, parent-chain breadcrumb builder, recents de-dupe vs pins.
- `node --check` on `product-forge.js`.
- Manual QA: pin persist, search round-trip, More default collapsed, context strip + scroll.

## Implementation order (suggested)

1. Type chips on all rows + More section (chrome; low risk).  
2. pinStore + pinned section + de-dupe recents.  
3. Context strip + scroll-to-structural on Recents/Pin/breadcrumb.  
4. Search results mode (replace tree-prune path).  
5. Tests + manual QA.
