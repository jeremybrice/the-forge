# Product Forge — shared lifecycle, hide-closed default, downward cascade

**Date:** 2026-08-13
**Scope:** Product Forge Local sidebar + edit-save, `CardData.STATUS_OPTIONS` for initiative/epic/story (Roadmap menus inherit), forge-lib initiative/epic/story schemas.
**Out of scope:** Intake / checkpoint / decision / release-note statuses. Jira sync. Auto roll-up (children completing does not close the parent). Soft-delete status. Bulk migrate existing card files. Roadmap hide-closed. The unfinished UX-consistency `card-write.js` extraction.
**Related:** `docs/superpowers/specs/2026-07-09-pfl-sidebar-progressive-findability-design.md` (filters, search results mode); `docs/plans/2026-03-06-epic-jira-card-attribute.md` (allowlist status chips).

## Problem

The Product Forge tree is unusable because finished work stays in the default view, and closing a ship means walking every epic and story by hand.

Three things compound:

1. **Filter chips are an allowlist.** Empty chips mean show everything. Hiding completed work means adding every *active* status as a chip.
2. **Three disagreeing status lists.** Shell menus, forge-lib schemas, and cards on disk do not share a vocabulary (`Done` vs `Complete` vs `Completed`; initiative `Submitted`/`Approved` vs epic `Planning` vs story `Ready`).
3. **No cascade.** Closing an initiative writes one file. Children stay open.

There is no `Deleted` status. Delete already removes the file, so those cards are already gone.

## Goal

Default Product Forge view shows only live work. Initiatives, epics, and stories share one lifecycle. Closing a parent closes the whole subtree in one confirm.

## Decisions

| ID | Decision |
|----|----------|
| D1 | Shared canonical lifecycle for initiative, epic, and story: `Draft`, `In Progress`, `Completed`, `Cancelled`, `Superseded`. |
| D2 | Default view hides closed work. Closed = canonical terminals plus aliases: `Complete`, `Done`, `Archived`, `Canceled`. |
| D3 | A **Show closed work** toolbar toggle (default off) is the only way to bring closed cards back into the tree, Recents, and Pins. Preference persists in `localStorage` key `pfl-show-closed` (`'1'` / `'0'`). |
| D4 | Search still matches closed cards. You search when you are looking for something, including something to reopen. Status chips still apply to search candidates. |
| D5 | If a parent is closed, hide the entire subtree even when children still have open/legacy statuses. Covers pre-cascade data. |
| D6 | Terminal statuses (`Completed`, `Cancelled`, `Superseded`, plus aliases `Complete`, `Done`, `Canceled`) cascade **down** when the parent’s status **changes** to one of them. Active statuses (`Draft`, `In Progress`) never cascade. Reopen never cascades. |
| D7 | Cascade **overwrites every descendant**, including already-closed children, so the subtree is one status. Confirm first when there is at least one descendant. Cancel aborts the whole save (parent included). |
| D8 | Schemas accept the canonical five **and** known aliases so existing files still validate. Shell menus offer only the five. If the card’s current value is not in the five, prepend it so an unrelated save does not clobber it. |
| D9 | No `Deleted` status. No parent roll-up. No file moves. Intake/checkpoint/decision/release-note lists stay as they are. |

## Shared lifecycle

**Menus and new writes (canonical):**

`Draft` → `In Progress` → `Completed`

Kill switches: `Cancelled`, `Superseded`.

**Accepted aliases (schema + hide/cascade recognition, not offered in menus):**

| Alias | Treated as |
|-------|------------|
| Submitted, Approved, Planning, Ready, On Hold, In Review, Testing, Blocked | open (visible by default) |
| Complete, Done, Archived, Canceled | closed (hidden by default; `Complete`/`Done`/`Canceled` also terminal for cascade) |

`CardData.STATUS_OPTIONS.initiative`, `.epic`, and `.story` all become the canonical five. Roadmap status menus read that object, so they inherit the same list with no extra Roadmap work.

`getStatusColor` already maps `complete`, `done`, `cancelled`, `superseded`, `archived`. Add `completed`.

## Hide-closed

### What is hidden when the toggle is off

| Surface | Rule |
|---------|------|
| Initiative tree | Drop an initiative node if the initiative is closed. Otherwise drop closed child epics (and their stories). Otherwise drop closed stories. A closed parent hides its children even if those children are still open. |
| Orphan epics / orphan stories | Same per-node closed rule. |
| Recents and Pins | Hide a card if it is closed **or** any ancestor (via `parent`) is closed. |
| Search results | Do **not** hide closed cards. Status chips still apply. |
| Detail panel | A selected closed card stays visible if it is already open. Selecting from search still works. |
| Non-work types (intake, checkpoint, decision, release-note) | Unaffected. |

### Toggle

Toolbar button, left of the existing Filter button:

- Icon: `fa-solid fa-box-archive`
- Title when hiding: `Show closed work`
- Title when showing: `Hide closed work`
- `aria-pressed` reflects `showClosed`
- Pressed visual: existing `.plugin-toolbar .btn-icon.rm-active`
- Click flips `FilterPanel.showClosed`, writes `localStorage`, re-renders tree

`FilterPanel.clearAll` does **not** reset `showClosed`. That toggle is a view preference, not a status chip.

### Filter chips

Unchanged allowlist, applied **after** hide-closed prune. Empty chips still mean “all statuses that survived the hide-closed pass.”

## Downward cascade

Trigger: Product Forge edit-modal Save, when `frontmatter.status` **changed** and the new value is terminal.

1. Collect descendants the same way `buildHierarchy` relates cards: `child.parent === parent.filename` **or** `parent.children` contains `child.filename`.
   - Initiative → child epics + those epics’ stories
   - Epic → child stories
   - Story → none
2. If descendants is empty, save the parent as today.
3. If descendants is non-empty, `ForgeUtils.Confirm.show`:
   - Title: `Close subtree`
   - Message: `This will mark every child with the same status.`
   - Details: counts + filenames, e.g. `3 epics, 12 stories → Completed` and a list of `filename.md` lines.
4. Cancel → return without writing the parent.
5. Confirm → write parent, then each descendant (`status` + `updated = todayISO()` only). Missing file handle on a descendant skips that file and continues. Toast: `Card saved; N children updated` or `Card saved; N children updated, M skipped`.

Reparent / unparent / delete are unchanged.

## Data layer

### Helpers (`product-forge.helpers.js`)

Pure functions, node-testable:

```js
SHARED_LIFECYCLE = ['Draft', 'In Progress', 'Completed', 'Cancelled', 'Superseded']

isClosedStatus(status) -> boolean
isTerminalStatus(status) -> boolean
isRelatedChild(parentCard, childCard) -> boolean
collectDescendants(rootCard, allCards) -> Card[]
hasClosedAncestor(card, storeGet) -> boolean
cardHiddenByClosed(card, storeGet) -> boolean  // own status closed OR ancestor closed
pruneClosedHierarchy(hierarchy) -> hierarchy   // drops closed parents and their subtrees
summarizeDescendants(descendants) -> { epics: number, stories: number }
```

`cardMatchesStatusFilters` stays an allowlist. Hide-closed is a separate pass.

### Schemas

`forge-lib/schemas/initiative.json`, `epic.json`, `story.json` `status.enum` becomes the same list:

```
Draft, In Progress, Completed, Cancelled, Superseded,
Submitted, Approved, Planning, Ready, Complete, Done,
On Hold, In Review, Testing, Blocked, Archived
```

First five are the workflow. The rest keep existing cards and current tests (`Approved`, `Submitted`, `Ready`) valid.

### Docs / agent defaults

- `forge-lib/README.md` status table: one shared list for initiative/epic/story.
- `product-forge/agents/forge-epic.md` default `status`: `"Draft"` (was `"Planning"`).
- `docs/DECISION_LOG.md` July/August 2026 row pointing at this spec.

Jira sync remains independent (`local status` ≠ `jira_status`).

## Error handling

- Confirm cancel: no writes.
- Parent write fails: existing error toast; no descendant writes.
- Descendant write fails or has no handle: skip, count as skipped, continue.
- `localStorage` unavailable: in-memory default `showClosed = false`.

## Testing

`node --test` in `forge-shell/test/product-forge.helpers.test.js` covers every helper above, including:

- alias recognition (case-insensitive)
- hierarchy prune of a closed initiative that still has open stories
- `collectDescendants` via `parent` and via `children[]`
- `hasClosedAncestor` walking `parent`
- `summarizeDescendants` counts

Schema change is covered by existing `forge-lib` create/update tests that already use `Draft` / `Approved` / `Ready`. Update `forge-lib/README.md` examples that tell people to create epics as `Planning` and stories as `Ready`.

No DOM tests. Filter/cascade wiring is exercised by the helper contracts plus a manual checklist:

1. Default tree hides `Completed` / `Done` / `Cancelled` / `Superseded` initiatives and their children.
2. Show-closed toggle reveals them; reload keeps the preference.
3. Search for a completed card still returns it.
4. Edit an initiative to `Completed` → confirm lists children → save updates every child file.
5. Confirm cancel leaves every file unchanged.
6. Edit initiative Draft → In Progress does not touch children.
7. Status `<select>` for a `Done` story still shows `Done` selected.

## PR Plan

### PR 1: Shared lifecycle, hide-closed default, downward cascade

- **Description:** Unify initiative/epic/story statuses, hide closed work by default in Product Forge, cascade terminal status down the subtree on edit-save.
- **Files/components affected:** `forge-shell/app/js/product-forge.helpers.js`, `forge-shell/app/js/product-forge.js`, `forge-shell/app/js/card-data.js`, `forge-shell/app/css/product-forge.css`, `forge-shell/test/product-forge.helpers.test.js`, `forge-lib/schemas/initiative.json`, `forge-lib/schemas/epic.json`, `forge-lib/schemas/story.json`, `forge-lib/README.md`, `product-forge/agents/forge-epic.md`, `docs/DECISION_LOG.md`, this spec, the implementation plan
- **Dependencies:** None
