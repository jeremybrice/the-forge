# Tasks Search — Frontend Design

**Date:** 2026-03-04
**Status:** Draft
**Component:** forge-shell → Tasks View (`tasks.js`)

## Design Direction

**Aesthetic: Industrial Utilitarian** — The search feature is a tool, not a decoration. It extends the existing forge toolbar language with a collapsible filter strip that slides into view on demand. Warm accent tones on the active state tie it to the forge branding. The strip respects the existing DM Sans typography and CSS custom property system.

**Key Principle: Spatial Preservation** — Non-matching cards dim rather than disappear. This preserves column context on the Board, lane context on Workload, and cell context on Matrix. The user always knows where things are.

## Component: The Filter Strip

A horizontal bar that lives between the `plugin-toolbar` and the view content panels. It is hidden by default and slides down with a 200ms ease-out animation when activated.

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [🔍] Tasks    Board│Timeline│Summary│Workload│Matrix    [⚙][✓][↻] │  ← existing toolbar
├──────────────────────────────────────────────────────────────────────┤
│ 🔍 [ Search tasks...          ]  Priority: [H] [M] [L]            │  ← filter strip
│                                  Status:   [Active] [Waiting] ...   │
│                                  Assignee: [name ▾]    12 of 47  ✕ │
└──────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Height: auto (content-driven), approximately 44–52px with chip groups wrapping
- Background: `var(--bg-secondary)` with a 1px `var(--border-color)` bottom border
- When active: bottom border transitions to `var(--accent)` (2px) for a subtle warm glow

### Search Input

- Left-aligned, ~280px width
- Magnifying glass icon (`fa-solid fa-magnifying-glass`) inside the input as a prefix
- Font: `var(--font-sans)` at 13px, matching existing inputs
- Placeholder: "Search tasks..." in `var(--text-muted)`
- Focus state: accent-colored bottom border glow (consistent with existing `input:focus` styles)
- Real-time filtering with 150ms debounce
- Searches across: title, tags (joined), assignee, creator, external_id

### Filter Chips

Three groups positioned inline after the search input:

**Priority chips:** `High` `Medium` `Low`
- Use existing priority colors: `#e74c3c` / `#f39c12` / `#3498db`
- Inactive: outlined, `var(--bg-primary)` background, colored border
- Active: filled with priority color, white text
- Multiple selection allowed (e.g., High AND Medium)

**Status chips:** `Active` `Waiting` `Someday` `Done`
- Inactive: outlined with `var(--border-color)`
- Active: filled with `var(--accent)`, white text
- Multiple selection allowed
- `Done` chip respects the existing `hideDone` toggle (hidden when hideDone is true)

**Assignee dropdown:** A single select dropdown that lists all unique assignees found in the current task set, plus an "All" option at the top.
- Styled as a compact select matching existing form elements
- Dynamic: repopulated on each data refresh

### Match Counter & Clear

- Right-aligned: "12 of 47 tasks" in `var(--text-muted)` at 12px
- Updates in real-time as filters change
- When no filters are active and strip is open, shows total count only (e.g., "47 tasks")
- Clear button (✕): resets all filters and search text. Styled as a small `btn-icon`

### Activation

- **Toolbar button:** New search icon button (`fa-solid fa-magnifying-glass`) added to the toolbar button group, before the existing field-settings button
- **Keyboard shortcut:** `Cmd+F` (macOS) / `Ctrl+F` (Windows/Linux) toggles the strip
- **Escape key:** Closes the strip and clears all filters
- **Strip state:** Persisted to `localStorage` key `forge-shell-tasks-search-open` (open/closed only, not filter values — filters reset on page load)

### Animation

- Strip slides down: `max-height` transition from 0 to content height, 200ms ease-out
- Strip slides up: 150ms ease-in
- Opacity fade-in on the content: 150ms delay after slide starts
- Filter chips: `background-color` transition 150ms on toggle
- Reduced motion: all transitions set to 0.01ms per existing `@media (prefers-reduced-motion)` rule

## Behavior Across Views

### Board View
- **Matching cards:** Normal appearance + subtle accent-colored left border (3px) as a highlight indicator
- **Non-matching cards:** `opacity: 0.25`, `pointer-events: none`, slight grayscale via `filter: saturate(0.3)`
- **Column counts:** Update to show "X / Y" format (matching / total) when filters are active
- **Drag-and-drop:** Disabled on dimmed cards (`pointer-events: none`), still works on matching cards
- **Empty columns after filter:** Show a subtle "No matching tasks" message in muted text

### Timeline View
- **Matching task bars:** Normal appearance
- **Non-matching task bars:** `opacity: 0.15`, no hover interaction
- **"No due date" section:** Same dim/highlight behavior
- **Today line:** Remains fully visible regardless of filter state

### Summary View
- **Stats recompute** using only the filtered task set
- **"Filtered" badge:** A small pill next to the stat cards header reading "Filtered (12 of 47)" in `var(--text-muted)` when filters are active
- **All charts/tables:** Render from filtered set only (donut, bar chart, sparkline, upcoming table, top tags)

### Workload View
- **Matching tasks:** Normal mini-card appearance
- **Non-matching tasks:** Dimmed in their lanes
- **Lane status bars:** Recompute segments from filtered set
- **Lane header counts:** Show "X / Y" format when filtered
- **Imbalance detection:** Based on filtered set

### Matrix View
- **Cell counts:** Recompute from filtered set
- **Heat coloring:** Based on filtered counts
- **Mini-cards in cells:** Matching ones normal, non-matching dimmed
- **"+X more" indicators:** Count only matching tasks

## Visual Mockup — Dark Theme

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☰ Tasks  tasks/   Board│Timeline│Summary│Workload│Matrix    🔍 ⚙ ✓ ↻     │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 [_Search tasks..._____]  [High] [Med] [Low]  [Active][Wait][Some][Done]│
│                               ▼ Assignee: All              12 of 47    ✕   │
╞═════════════════════════════════════════════════════════════════════════════╡
│                                                                             │
│  Active (3/8)         Waiting On (2/4)     Someday (5/12)    Done (2/23)   │
│  ┌──────────────┐    ┌──────────────┐     ┌──────────────┐   ┌───────────┐│
│  │▌Fix auth bug │    │░░░░░░░░░░░░░░│     │▌Update docs  │   │░░░░░░░░░░││
│  │  🔴 High     │    │░ dimmed card ░│     │  🔵 Low      │   │░ dimmed  ░││
│  │  👤 Jeremy   │    │░░░░░░░░░░░░░░│     │  🏷 docs,api │   │░░░░░░░░░░││
│  └──────────────┘    └──────────────┘     └──────────────┘   └───────────┘│
│  ┌──────────────┐    ┌──────────────┐     ┌──────────────┐                 │
│  │░░░░░░░░░░░░░░│    │▌Review PR    │     │░░░░░░░░░░░░░░│                 │
│  │░ dimmed card ░│    │  🟡 Medium   │     │░ dimmed card ░│                 │
│  │░░░░░░░░░░░░░░│    │  👤 Sarah    │     │░░░░░░░░░░░░░░│                 │
│  └──────────────┘    └──────────────┘     └──────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ▌= accent left-border highlight on matching cards
  ░ = dimmed non-matching card (25% opacity)
```

## CSS Custom Properties (New)

```css
/* Tasks Search Filter Strip */
--ts-strip-bg: var(--bg-secondary);
--ts-strip-border: var(--border-color);
--ts-strip-border-active: var(--accent);
--ts-chip-bg: var(--bg-primary);
--ts-chip-border: var(--border-color);
--ts-chip-active-bg: var(--accent);
--ts-chip-active-text: #ffffff;
--ts-match-highlight: var(--accent);
--ts-dim-opacity: 0.25;
--ts-dim-saturate: 0.3;
```

## Accessibility

- All filter chips are `<button>` elements with `aria-pressed` state
- Search input has `aria-label="Search tasks"`
- Match counter is a `role="status"` live region for screen readers
- Keyboard: Tab navigates through chips, Space/Enter toggles, Escape closes strip
- All color indicators have text labels (not color-only)
- Respects `prefers-reduced-motion`
