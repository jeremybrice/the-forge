# Product Forge — Recents Section & Auto-Reveal on Creation

- **Date:** 2026-05-05
- **Status:** Draft → user approval pending
- **Owner:** Forge Shell (`forge-shell/app/js/product-forge.js`)
- **Related plugin:** product-forge

## 1. Background

The Product Forge view in `forge-shell` displays a hierarchical accordion (Initiatives → Epics → Stories, plus Orphan Epics, Orphan Stories, Intakes, Checkpoints, Decisions, Release Notes). As card volume grows, the user reports that **freshly created cards are hard to locate** — they're buried inside collapsed parent nodes, the substring search requires the user to remember the exact title, and there is no surface that highlights "what just changed."

Two independently-scoped enhancements address this without altering the underlying card schema or the existing structural tree:

- **Idea 1 — Recents section:** a pinned, type-agnostic listing at the top of the tree, sorted by creation date.
- **Idea 5 — Auto-reveal on creation:** when the auto-refresh polling detects newly-added card files, the view brings them to the user's attention immediately.

## 2. Goals

- A new card is **visible without scrolling** within ≤5 seconds of being written to disk by Claude.
- A new card has **at least one persistent visual marker** ("NEW" badge) that lasts long enough for the user to find it after switching back from another window.
- Existing tree behavior, drag-drop reparenting, status filters, and substring search continue to work unchanged.
- Zero schema changes to card frontmatter, forge-lib templates, or `card-data.js` data shapes.

## 3. Non-Goals

- Persisting Recents or NEW state across browser sessions / page reloads. Both are session-scoped.
- Reorganizing the existing structural tree.
- Tag/label support, group-by pivots, fuzzy palette, saved views, or any of ideas 2/3/4 from the brainstorm.
- Changing the auto-refresh cadence (stays at 5s).

## 4. Assumptions Made (no clarifying questions per user directive)

| # | Assumption | Reason / Mitigation |
|---|------------|---------------------|
| A1 | Recents shows the **10 most recent cards** by `frontmatter.created`, fallback to file `lastModified` if `created` is missing or unparseable. | Reasonable default; configurable count is out of scope for v1. |
| A2 | Recents includes **all card types** (initiatives, epics, stories, intakes, checkpoints, decisions, release-notes). Type is shown via a small colored type badge on each row. | The pain point is "any new card I create" — type-agnostic matches that. |
| A3 | Recents is **expanded by default** on first render of the session (the only section that is). | Defeats the purpose if collapsed. |
| A4 | "Session" is defined as the lifetime of one `ctrl.init(rootHandle)` call — destroyed and reset whenever the user re-selects a workspace or the controller re-initialises. | Matches existing module-state lifecycle. |
| A5 | A card is "session-new" (and gets the NEW badge) if its filename appeared in `_doRefresh`'s `changes.added` array during this session. Cards already present at session start are **not** marked NEW even if their `created` date is recent. | Avoids spurious badges on first load of a workspace that has many recent cards. |
| A6 | NEW badges remain visible until either: (a) the user clicks/selects that card, or (b) 10 minutes elapse since the card was added. | Long enough to switch windows and come back; short enough to not accumulate visual noise. |
| A7 | Auto-select-and-scroll fires only when **exactly one** card was added in a single refresh tick AND the user has no current selection AND no search query AND no active status filters. Otherwise the addition is announced via a toolbar "new" indicator instead of stealing focus. | Avoids interrupting the user mid-task and avoids selecting a card that filters would hide. |
| A8 | The toolbar "new" indicator is a small pulsing dot with a count next to the existing refresh-indicator text (e.g. `5 cards · 11:42:08 · 2 new`). Clicking it (a) expands the Recents section, (b) scrolls the sidebar to the top, (c) clears the indicator. | Reuses existing `[data-pfl-refresh-ind]` real estate. |
| A9 | The flash highlight on auto-reveal is a 1.5-second CSS background pulse that fades out, applied via a `pfl-flash-new` class added then removed by a `setTimeout`. | Subtle, non-blocking, no JS animation library needed. |
| A10 | Cards created via the shell's own Edit modal do NOT trigger NEW badges or auto-reveal — those go through `editModal.save()`'s direct `store.set` path, not through `_doRefresh`'s diff. | Correct: the user already knows they edited it. |

If any of these assumptions are wrong, flag during user-review of this spec — they're tagged so they can be revisited individually.

## 5. Architecture Overview

All changes are **scoped to `forge-shell/app/js/product-forge.js` and `forge-shell/app/css/product-forge.css`.** No edits to `card-data.js`, no edits to forge-lib, no schema changes.

The view is already organized around three internal modules — `treeView`, `detailPanel`, `editModal` — plus a `ctrl` controller. We add:

- **`recentsTracker` (new module)** — owns the session-scoped state for "what's new" and computes the recents list.
- Small additions to **`treeView`** (one new render path: `_renderRecentsSection`).
- Small additions to **`ctrl._doRefresh`** to feed `recentsTracker` and orchestrate auto-reveal.
- Small additions to **`ctrl._updateRefreshIndicator`** to render the "N new" suffix.
- One new CSS section in `product-forge.css` for: Recents section visual emphasis, NEW badge, flash-highlight animation.

```
┌───────────── product-forge.js (existing modules) ─────────────┐
│  treeView                                                     │
│   ├─ render(hierarchy)              ← unchanged shape         │
│   └─ _renderRecentsSection(...)     ← NEW                     │
│                                                               │
│  recentsTracker                     ← NEW MODULE              │
│   ├─ sessionAddedAt: Map<filename, ms>                        │
│   ├─ unseenAddedCount: number                                 │
│   ├─ noteAdded(filename), markSeen(filename)                  │
│   ├─ pruneStale()                   ← drops >10min entries    │
│   └─ getRecents(store, n=10): card[]                          │
│                                                               │
│  ctrl._doRefresh                    ← FEED + REVEAL HOOK      │
│  ctrl._updateRefreshIndicator       ← APPEND "N new"          │
└───────────────────────────────────────────────────────────────┘
```

The new module is **self-contained**: no other plugin reads from it; no persistence; no globals. If a future ticket wants to move this to a shared utility, it can be lifted whole.

## 6. Feature 1 — Recents Section

### 6.1 Behavior

- A new accordion section labeled **"Recents"** appears at the top of the sidebar tree, above "Initiatives".
- It displays up to 10 cards, sorted by `frontmatter.created` DESC (fallback: `store.timestamps.get(filename)` DESC).
- Each row renders the same way `_renderLeafNode` already renders for intakes/decisions/etc., **except** with an additional small type indicator (colored dot or short type letter — see 6.3).
- If the row's filename is in `recentsTracker.sessionAddedAt`, a "NEW" badge appears on the right side of the row.
- Clicking a row selects the card and pops the detail panel, exactly like every other tree node.
- The section is **expanded** by default in this session (the only section that is).
- The section is hidden entirely (zero rows) only if the store is empty. Otherwise it always shows up to N rows.

### 6.2 Data Flow

```
store.all()
   │
   ▼
sortByCreatedDesc(cards)
   │
   ▼
take(N=10)
   │
   ▼
treeView._renderRecentsSection(cards, sessionAddedAt)
```

`recentsTracker.getRecents(store, n)`:

```js
getRecents(store, n) {
  return store.all()
    .map(c => ({
      card: c,
      ts: parseDate(c.frontmatter.created) ?? store.timestamps.get(c.filename) ?? 0
    }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, n)
    .map(x => x.card);
}
```

`parseDate` accepts ISO strings (`YYYY-MM-DD` or full timestamps); on failure returns `null`.

### 6.3 Rendering

The Recents row is a variant of `_renderLeafNode` with two additions:

- A **type chip** before the title — a 4×4 colored square using the existing `getTypeColor(type)` palette, giving instant type recognition without crowding the row.
- A trailing **NEW badge** when the filename is in `sessionAddedAt`.

```
[▶ icon]  [status dot]  [type chip]  Card title text...                    [NEW]
```

Indentation: `pfl-indent-1` (matches other leaf sections like Intakes).

### 6.4 Section Placement & Re-render Triggers

- Section is the **first** child of `.pfl-tree-view`, before Initiatives.
- Recents is recomputed on every call to `ctrl._renderTree()` — same lifecycle as existing sections, no new triggers.
- Status filters and substring search filter Recents the same way they filter other sections (recents is just another set of cards passing through `matchCard` / `FilterPanel.filterHierarchy`).

### 6.5 Edge Cases

| Case | Behavior |
|------|----------|
| Store has fewer than 10 cards | Show all of them. |
| All cards have no `created` field | Sort entirely by `store.timestamps`. |
| Two cards have identical `created` date | Tie-break by filename ASC (stable). |
| User searches; no recents match | Section header still renders (count = 0) but body is empty. Consistent with how empty Initiative section already renders. |
| Recents row points to a card that's also visible elsewhere in the tree | Both render. Selecting one highlights *both* (use existing `highlightSelected` selector — already query-all). |

## 7. Feature 2 — Auto-Reveal on Creation

### 7.1 Detection

`ctrl._doRefresh` already builds `changes = { added, modified, deleted }`. The hook is added immediately after the existing `if (hasChanges) { … }` block.

```js
// Inside _doRefresh, after the existing render block:
for (const filename of changes.added) {
  recentsTracker.noteAdded(filename);
}
if (changes.added.length > 0) {
  this._maybeAutoReveal(changes.added);
}
```

### 7.2 Auto-Reveal Decision Logic

```
function _maybeAutoReveal(addedFilenames):
  recentsTracker.pruneStale()
  if filters or search active:
    recentsTracker.unseenAddedCount += addedFilenames.length
    return
  if addedFilenames.length !== 1:
    recentsTracker.unseenAddedCount += addedFilenames.length
    return
  if selectedCard !== null:
    recentsTracker.unseenAddedCount += 1
    return
  // safe to steal focus
  const fn = addedFilenames[0]
  this._revealCard(fn)
  recentsTracker.markSeen(fn)
```

### 7.3 Reveal Behavior

`ctrl._revealCard(filename)`:

1. Walk the parent chain (`fm.parent → fm.parent → …`) and remove each ancestor from `treeView.collapsedNodes`.
2. Also un-collapse the section that contains the card (e.g. `'initiatives'`, `'orphan-stories'`, etc.). For new cards, also un-collapse `'recents'`.
3. Call `ctrl.selectCard(filename)`.
4. On the next animation frame, query for the row's DOM element by `[data-pfl-select="<filename>"]` and call `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`.
5. Add `pfl-flash-new` class to the row; `setTimeout(() => remove class, 1500)`.

### 7.4 Toolbar "N new" Indicator

When `recentsTracker.unseenAddedCount > 0`:

- `_updateRefreshIndicator` appends ` · <count> new` to the indicator text in an accent color (use `var(--accent)`), with a subtle pulse animation.
- A small click-target wraps the suffix; click handler:
  1. Un-collapse the Recents section (`treeView.collapsedSections.delete('recents')`).
  2. Scroll the sidebar (`.pfl-sidebar`) to top.
  3. `recentsTracker.unseenAddedCount = 0`; re-render.

### 7.5 NEW Badge Behavior

- The badge is a small uppercase pill (`<span class="pfl-new-badge">NEW</span>`).
- Rendered on Recents rows AND on the same card if it appears elsewhere in the tree (its structural location).
- `recentsTracker.markSeen(filename)` is called on `selectCard(filename)` — so clicking any instance clears all instances of that card's NEW badge on next render.
- `recentsTracker.pruneStale()` removes entries older than 10 minutes; runs each refresh tick and on each tree render.

### 7.6 Edge Cases

| Case | Behavior |
|------|----------|
| User has search active when 1 card is added | No auto-reveal. Counter increments. (A8 / 7.2) |
| User has filters active when 1 card is added | No auto-reveal. Counter increments. |
| User has a card selected | No auto-reveal. Counter increments. Their selection is preserved. |
| 5 cards added in one refresh tick | No auto-reveal. Counter goes to 5. |
| Same filename added → modified → modified within session | NEW badge once, doesn't re-trigger on `modified`. Stays until 10min or user-click. |
| Card added, then deleted before user sees it | `noteAdded` ran; in next refresh, `changes.deleted` includes filename. Add `recentsTracker.markSeen(filename)` cleanup in the delete branch so we don't keep stale entries pointing at gone files. |
| User clicks "N new" while the Recents row is already visible | Still un-collapses (no-op) and scrolls; counter clears. |
| Recents section was manually collapsed by user, new card arrives | If single auto-reveal fires, we DO re-expand Recents (the user wanted to see it). For multi-add, only the toolbar counter pulses; Recents remains in user-controlled state until they click the counter. |
| Card has `parent` that doesn't exist in store | Walk gracefully terminates; ancestor expansion just stops at the broken link. |

### 7.7 Race-Free Refresh Coupling

`_doRefresh` is gated by `refreshRunning` — the auto-reveal piggybacks on the existing critical section. The `setTimeout` for class removal does not need to be cancelled on next refresh because the row may be re-rendered (CSS class is on a transient DOM node).

## 8. Files Modified

| File | Change |
|------|--------|
| `forge-shell/app/js/product-forge.js` | Add `recentsTracker` module; add `treeView._renderRecentsSection` + integration into `treeView.render`; modify `ctrl._doRefresh` to feed tracker on `changes.added`, clean tracker on `changes.deleted`, and call `_maybeAutoReveal`; modify `ctrl._updateRefreshIndicator` to render "N new" suffix; add `ctrl._maybeAutoReveal` + `ctrl._revealCard`; modify `ctrl.selectCard` to call `recentsTracker.markSeen`; modify `ctrl._renderTree` to apply search/filter to Recents; modify `ctrl.destroy` to reset `recentsTracker`. |
| `forge-shell/app/css/product-forge.css` | Add `.pfl-recents-section` emphasis (a 2px `var(--accent)` left-border on the section header, no background tint); add `.pfl-new-badge` pill style; add `.pfl-flash-new` 1.5s keyframe animation; add `.pfl-type-chip` 8×8 rounded color swatch; add `.pfl-refresh-new-count` accent-color pulse style. |
| `docs/superpowers/specs/2026-05-05-product-forge-recents-and-auto-reveal-design.md` | This document. |

**No changes** to: `card-data.js`, any forge-lib file, any plugin command file, any other view controller.

## 9. Testing Approach

The forge-shell project does not currently have a JS unit-test harness for view controllers (verified by the lack of any `*.test.js` under `forge-shell/`). Testing is therefore manual + observational, with tightly-scripted scenarios:

### Manual test plan

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Open Product Forge in a workspace with ≥10 cards | Recents section is the top section, expanded, showing 10 most-recent cards by `created` date, each with type chip + status dot + title. No NEW badges (initial load). |
| T2 | In a separate process, write a new file to `cards/stories/story-NNN-foo.md` with valid frontmatter | Within ~5s, the new card appears in Recents with a NEW badge; if no other selection/filter/search, the card is auto-selected and scrolled into view; row briefly flashes. |
| T3 | Repeat T2 but first type a query into the search input | New card appears in Recents (if it matches the search) with NEW badge; **no** auto-select; the toolbar shows ` · 1 new` suffix. Click the suffix → Recents un-collapses, sidebar scrolls top, suffix clears. |
| T4 | Repeat T2 but first add a status filter | Same as T3. |
| T5 | Have a card already selected; new card arrives | Selection is preserved; toolbar shows ` · 1 new`; new card is in Recents with NEW badge. |
| T6 | In one refresh tick, add 3 new files (stage them in a single file-system batch) | No auto-select; toolbar shows ` · 3 new`; all 3 appear in Recents with NEW badges. |
| T7 | Click the new card in Recents | Detail panel opens; NEW badge is removed on next render from the Recents row AND from the card's structural location elsewhere in the tree. |
| T8 | Wait 10 minutes after a NEW card arrives without clicking | NEW badge auto-clears on next refresh tick. |
| T9 | Edit a card via the shell's Edit modal and Save | No NEW badge applied; Recents order may shift if `created` was changed (it shouldn't be — `editModal._getFormData` only writes `updated`). |
| T10 | Delete a card that currently has a NEW badge | Card is removed from store and from Recents; tracker entry is cleaned (no orphan). |
| T11 | Reload the workspace (forces `ctrl.destroy + ctrl.init`) | All NEW badges and counter cleared (session-scoped). |
| T12 | Existing drag-drop reparent of an Epic | Works unchanged. (Regression check.) |
| T13 | Existing status filter panel | Works unchanged; Recents respects filters. (Regression check.) |
| T14 | Existing keyboard nav (Arrow Up/Down, `e` to edit) | Works unchanged; Arrow nav now also visits Recents rows. |

### Lightweight unit-style sanity

For pure functions with no DOM dependency, add inline `if (typeof window === 'undefined') { … }` self-tests in `recentsTracker` that the dev can manually invoke from a Node REPL or browser console — not auto-run. The two pure functions worth this treatment:

- `getRecents(store, n)` — sort and slice correctness, fallback ordering when `created` is missing.
- `parseDate(s)` — ISO-only acceptance.

This is a pragmatic concession to the project's existing testing posture; introducing a JS test runner is out of scope.

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Auto-reveal feels intrusive even with the gating in 7.2 | Conservative gates (single-add, no selection, no search, no filters). If still intrusive, demote to "indicator only, no auto-select" via a one-line change in `_maybeAutoReveal`. |
| Recents re-renders on every refresh tick (5s) — wasted work if nothing changed | `_doRefresh` already early-returns when `hasChanges === false`. Recents is only re-built inside the existing `_renderTree` call, so no new redundant work. |
| NEW badges accumulate visually if the user is away for a long time | 10-minute auto-prune (A6) caps this. |
| Test plan is manual | Acknowledged. The view layer has no existing test infrastructure; introducing one is a separate, larger ticket. |

## 11. Out of Scope (Explicit)

- Persistent (cross-reload) Recents or NEW state.
- Configurable Recents count or sort field.
- Group-by pivots (idea 2).
- Cmd+K palette (idea 3).
- Saved smart views (idea 4).
- Tag/label support.
- Any change to forge-lib or plugin command files.
- Any change to other view controllers (tasks, memory, roadmap, etc.).
- Localization.

## 12. Open Questions for Reviewer

None blocking — the assumptions in §4 cover all decisions. If the reviewer disagrees with any A1–A10, they can be revisited before plan-writing without invalidating the architecture.
