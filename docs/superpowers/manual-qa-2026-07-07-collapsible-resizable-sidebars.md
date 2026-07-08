# Manual QA Checklist — Collapsible + Resizable Plugin Sidebars

**For:** the human reviewer before merging `feat/collapsible-resizable-sidebars`.

This is the spec's §7.2 manual checklist. I could not run a browser from my sandbox; please exercise these for each of the 7 plugins before merging.

## Pre-flight

```bash
cd forge-shell
npm run tauri:dev
```

Wait for the app to launch. Click each of the 7 plugin icons in the leftmost rail (Product Forge, Cognitive Forge, Rovo Agent Forge, Report Forge, Slack Forge, Outlook Forge, Audio Forge). Verify the sidebars render as before — no layout regressions from the CSS changes.

## For each of the 7 plugins, verify:

- [ ] Toolbar shows the sidebar toggle button (chevron or hamburger icon) at all viewport widths.
- [ ] Clicking toggle hides the sidebar; clicking again shows it.
- [ ] **When the sidebar is collapsed, the detail panel takes the FULL viewport width** — no empty space on the left where the sidebar was. The detail content can flow edge-to-edge (e.g., the title shifts left to fill the freed space). This was a bug in the first PR; verify the fix.
- [ ] Reload page (Ctrl+R): previous collapsed state is restored.
- [ ] Drag the right edge of the sidebar right; width grows up to 480px.
- [ ] Drag the right edge of the sidebar left; width shrinks down to 180px.
- [ ] **Continue dragging left past minWidth (180px); sidebar clamps at 180px and does NOT auto-collapse.** To collapse, use the toolbar button (or Tab to the resizer and press Enter). This was a UX change from the first PR; verify the fix.
- [ ] Reload page: previous custom width is restored.
- [ ] Tab to the resizer handle (yellow focus ring should appear); ←/→ arrows step width by 16px; Home/End jump to min/max. (ArrowLeft at min is a no-op; ArrowRight at max is a no-op.)
- [ ] Tab to the resizer; Enter toggles collapse (this is the only way to collapse via keyboard now that drag doesn't auto-collapse).
- [ ] On mobile (≤768px, resize the window narrow) the sidebar still acts as a slide-over; the new desktop behavior does not interfere.

## Spot-checks specific to one plugin

- [ ] **Product Forge** — toggle button now appears in the toolbar (it did not exist before this change). It must be the LEFTMOST button in the toolbar, before the title.
- [ ] **Audio Forge** — sidebar resizes via the right edge (the layout is flex, not grid; the variable is on `.af-sidebar`'s `width`, not on `grid-template-columns`). The toggle button uses `fa-bars` icon (not `fa-chevron-left` like the other 6 plugins).
- [ ] **Cognitive/Rovo/Report/Slack/Outlook** — the existing mobile slide-over behavior still works below 768px (toggle should slide the sidebar in from the left, not collapse it).

## Quick regression check

```bash
cd forge-shell
npm test
```

Expected: 56/56 tests pass (45 pre-existing + 11 new sidebar helpers tests). Run this AFTER the manual browser QA.

## What changed in this revision

The first PR had two regressions that this revision fixes:

1. **Detail panel didn't expand on collapse** — the per-plugin `grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr` reserved the first column at 280px even when the sidebar was `display: none`. Fix: a new `[class$="-sidebar-collapsed"] > [class$="-layout"]` rule overrides `grid-template-columns` to `0 1fr` so the detail panel takes the full viewport.

2. **Auto-collapse on drag below min was jarring** — the user explicitly asked for collapse to only happen via the toolbar button (or keyboard Enter/Space). Fix: `setWidth` now clamps to `cfg.min` instead of returning null and triggering collapse; the auto-collapse check in `onMouseUp` is removed. The same fix means keyboard ArrowLeft at min is a no-op (no accidental collapse).

## If you find a problem

Open an issue or push a fix commit; do not merge until all items pass.
