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
- [ ] Reload page (Ctrl+R): previous collapsed state is restored.
- [ ] Drag the right edge of the sidebar right; width grows up to 480px.
- [ ] Drag the right edge of the sidebar left; width shrinks down to 180px.
- [ ] Continue dragging left past minWidth; sidebar auto-collapses; release and click toggle to expand at default width (280px, audio-forge 320px).
- [ ] Reload page: previous custom width is restored.
- [ ] Tab to the resizer handle (yellow focus ring should appear); ←/→ arrows step width by 16px; Home/End jump to min/max.
- [ ] Tab to the resizer; Enter toggles collapse.
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

## If you find a problem

Open an issue or push a fix commit; do not merge until all items pass.
