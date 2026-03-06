# Mission Brief

**Playbook:** feature-build
**Design Doc:** `docs/plans/2026-03-04-tasks-search-design.md`
**Frontend Spec:** `docs/plans/2026-03-04-tasks-search-frontend-design.md`
**Implementation Plan:** `docs/plans/2026-03-04-tasks-search-implementation.md`
**Created:** 2026-03-04

## Requirements Summary

1. **Filter strip UI** — Collapsible horizontal bar between the `plugin-toolbar` and content panels. Contains: search text input, priority chips (High/Medium/Low), status chips (Active/Waiting/Someday/Done), assignee dropdown, match counter, and clear button.
2. **Dim-not-hide filtering** — Non-matching cards dim (opacity 0.25, pointer-events: none, saturate 0.3) rather than disappear, preserving spatial context across all five views.
3. **Board view integration** — Matching cards get accent left border, non-matching dim. Column counts show "X / Y" format. Drag-drop blocked on dimmed cards. Empty columns show "No matching tasks" message.
4. **Timeline view integration** — Non-matching task bars dim (opacity 0.15). Today line stays visible regardless of filter state.
5. **Summary view integration** — All stats recompute from filtered task set only. "Filtered (X of Y)" badge appears when filters are active.
6. **Workload view integration** — Lane status bars recompute from filtered set. Non-matching mini-cards dim. Lane header counts show "X / Y" when filtered.
7. **Matrix view integration** — Cell counts and heat coloring recompute from filtered set. Non-matching mini-cards dim.
8. **Keyboard shortcuts** — Cmd/Ctrl+F toggles strip, Escape closes and clears all filters, Tab navigates through controls.
9. **hideDone interaction** — Done chip hidden when hideDone is true. Done filter clears automatically if hideDone toggles on.
10. **State persistence** — Strip open/closed state persisted to localStorage. Filter values reset on page load.
11. **External file changes** — Re-run filter computation after task reload to keep matches current.

## Key Files

| File | Role |
|------|------|
| `forge-shell/app/js/tasks.js` | Tasks view controller — all JS additions (~210 lines new/modified) |
| `forge-shell/app/css/productivity.css` | Task view styles — all CSS additions (~80 lines new) |

## Test Command

Manual verification only. No automated test framework in forge-shell. The developer will test after implementation.

## Developer Callouts

None specified. No special constraints.

## Success Criteria

1. Filter strip toggles open/closed via toolbar button and Cmd/Ctrl+F keyboard shortcut
2. Text search dims non-matching cards in real-time with 150ms debounce
3. Priority chips support multi-select and filter cards correctly
4. Status chips support multi-select and filter across columns
5. Assignee dropdown dynamically populated and filters correctly
6. Clear button resets all filters and restores all cards
7. Filtering works correctly across all 5 views (Board, Timeline, Summary, Workload, Matrix)
8. hideDone toggle correctly interacts with Done chip visibility
9. Strip open/closed state persists across page loads via localStorage
10. External file changes re-apply active filters
11. Works in both light and dark themes
12. No visual regressions to existing task views
