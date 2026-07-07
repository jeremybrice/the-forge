# Collapsible & Resizable Plugin Sidebars

- **Date:** 2026-07-07
- **Status:** Draft → user approval pending
- **Owner:** Forge Shell (`forge-shell/app/js/sidebar.js` + per-plugin integration)
- **Related plugins:** product-forge, cognitive-forge, rovo-agent-forge, report-forge, slack-forge, outlook-forge, audio-forge

## 1. Background

Every Forge plugin view (7 plugins) renders a left-hand list panel and a right-hand detail panel inside a 2-column CSS grid. The list column width is fixed at `var(--plugin-sidebar-width)` = 280px (`app/css/theme.css:27`). Users with wide monitors want more room for card titles, while users with smaller windows or who want to focus on a single document want to push the list out of the way entirely.

Today there is no way to either:

- **Collapse** the list (it always occupies 280px of horizontal space).
- **Resize** it (the width is hardcoded to a single CSS variable).
- **Persist** a user's preferred width/collapsed state across sessions.

Five of the seven plugins (cognitive-forge, rovo-agent-forge, report-forge, slack-forge, outlook-forge) already have a `data-*-action="toggle-sidebar"` button in their toolbar, but it is hidden on desktop (`display: none !important` in each plugin's CSS) and only used as a mobile slide-over toggle below 768px (`@media (max-width: 768px)`). The remaining two — **product-forge-local** and **audio-forge** — do not yet have a toggle button at all and need one added. (Verified by grepping for `toggle-sidebar` in `app/js/*.js`: present in cognitive, raf, rf, sf, of; absent in pfl and af.)

This change makes the collapse + resize behavior work on desktop, makes the toggle button visible on desktop, and wires a draggable right-edge handle for resizing.

## 2. Goals

- Every plugin sidebar can be **collapsed** (hidden entirely) or **expanded** with a single click.
- Every plugin sidebar can be **resized** by dragging its right edge, within sane bounds.
- A drag below the minimum width **auto-collapses** the sidebar (matches macOS panel behavior).
- Collapsed and width state **persists per plugin** in `localStorage`, so each plugin remembers its own layout.
- Works with **keyboard only**: the resizer is focusable as `role="separator"`, ←/→ step 16px, Home/End jump to min/max, Enter/Space toggles.
- Mobile behavior (≤768px sidebar-as-overlay) is **unchanged** — this change is desktop-focused.

## 3. Non-Goals

- Animated collapse/expand transitions beyond the existing CSS `transition` on `grid-template-columns`.
- Floating / detached sidebars, or a global sidebar that lives outside the per-plugin view.
- Saving/loading named "view presets" (e.g. "compact / wide / hidden").
- Touch-device gestures for resizing (desktop drag only; mobile keeps overlay behavior).
- Changing the existing mobile (≤768px) slide-over behavior in any of the 7 plugins.

## 4. Design

### 4.1 New shared module: `app/js/sidebar.js`

Exposes a single function on the global `Sidebar` object:

```js
window.Sidebar = {
  init(config)         // wire up one plugin's sidebar; idempotent
  _clampWidth(px, cfg) // internal: returns integer px or null (= auto-collapse)
  _storage(pluginId, k)// internal: safe localStorage wrapper
}
```

`Sidebar.init(config)` config:

| Field | Type | Required | Description |
|---|---|---|---|
| `pluginId` | string | yes | localStorage key suffix (e.g. `'product-forge-local'`) |
| `rootSelector` | string | yes | view container (`'#view-product-forge-local'`) |
| `sidebarSelector` | string | yes | the `<aside>` to resize/collapse (`'.pfl-sidebar'`) |
| `toggleSelector` | string | yes | the toolbar toggle button (`'[data-pfl-action="toggle-sidebar"]'`) |
| `resizerSelector` | string | yes | the drag handle `<div>` (`'.pfl-sidebar-resizer'`) |
| `minWidth` | number | yes (default 180) | minimum px before auto-collapse |
| `maxWidth` | number | yes (default 480) | maximum px |
| `defaultWidth` | number | yes (default 280) | reset width after auto-collapse |

Behavior:

1. **Idempotency**: if `config.rootSelector` element already has `data-sidebar-init="1"`, remove old listeners first.
2. **Read state** from `localStorage` keys:
   - `forge-shell-sidebar-{pluginId}-width` → integer string or null
   - `forge-shell-sidebar-{pluginId}-collapsed` → `'1'` | `'0'`
3. **Apply state** to DOM:
   - If `collapsed === '1'`: add class `*-sidebar-collapsed` to the root layout element; clear `aside.style.width`; clear `--plugin-sidebar-current` inline.
   - Otherwise: remove class; set `aside.style.width = storedWidth + 'px'`; set `layoutEl.style.setProperty('--plugin-sidebar-current', storedWidth + 'px')`.
4. **Wire toggle button**: on click, flip the class, flip the localStorage flag, swap the icon (`fa-chevron-left` ↔ `fa-chevron-right`), and clear/sync `--plugin-sidebar-current` + `aside.style.width`.
5. **Wire resizer**:
   - On `mousedown`: capture pointer, set `document.body.classList.add('sidebar-dragging')`, `document.body.style.cursor = 'col-resize'`.
   - On `mousemove` (bound on `document`): compute `newWidth = e.clientX - aside.getBoundingClientRect().left`; clamp via `_clampWidth`; if `null`, ignore (handled on mouseup); else set `aside.style.width` and `--plugin-sidebar-current` to the same px value.
   - On `mouseup`: if width ≤ minWidth, call the same code path as the toggle button, then set `aside.style.width = defaultWidth + 'px'` and write that to storage (so re-expand restores default). Otherwise write the final width to storage. Remove `sidebar-dragging` class, restore cursor.
   - On `keydown` (resizer is `tabindex=0`):
     - `ArrowLeft` / `ArrowRight`: adjust by ±16px, clamp, persist.
     - `Home`: jump to minWidth, persist.
     - `End`: jump to maxWidth, persist.
     - `Enter` / `Space`: toggle collapse (same as button).
6. **localStorage failure**: wrap reads/writes in `try/catch`; on failure, fall back to in-memory `Map` for the session and `console.warn` once. Never throw.

### 4.2 New CSS in `app/css/components.css`

```css
/* Sidebar resizer grip — sits in the sidebar grid column, hangs over the divider */
.sidebar-resizer {
  grid-row: 2;
  grid-column: 1;
  justify-self: end;
  width: 6px;
  margin-right: -3px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 2;
  transition: background 0.15s ease;
}
.sidebar-resizer:hover,
.sidebar-resizer:focus-visible,
.sidebar-resizer.dragging {
  background: var(--accent);
  outline: none;
}
.sidebar-resizer::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 2px; height: 24px;
  border-radius: 1px;
  background: var(--border-color);
}
.sidebar-resizer:hover::after,
.sidebar-resizer.dragging::after { background: transparent; }

/* Disable text selection and force resize cursor while dragging */
body.sidebar-dragging,
body.sidebar-dragging * {
  user-select: none;
  cursor: col-resize !important;
}
```

Each plugin's layout class (`.pfl-layout`, `.cf-layout`, `.raf-layout`, `.rf-layout`, `.sf-layout`, `.of-layout`, `.af-layout`) gets:

```css
grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
transition: grid-template-columns 0.18s ease;
```

(This is set in the per-plugin CSS file, not in `components.css`, to keep plugin layout grids co-located with the rest of that plugin's layout styles.)

### 4.3 Collapsed-state selector

Rather than enumerate seven plugin classes, a single attribute selector covers all of them:

```css
[class$="-sidebar-collapsed"] .pfl-sidebar,
[class$="-sidebar-collapsed"] .cf-sidebar,
[class$="-sidebar-collapsed"] .raf-sidebar,
[class$="-sidebar-collapsed"] .rf-sidebar,
[class$="-sidebar-collapsed"] .sf-sidebar,
[class$="-sidebar-collapsed"] .of-sidebar,
[class$="-sidebar-collapsed"] .af-sidebar,
[class$="-sidebar-collapsed"] .sidebar-resizer {
  display: none;
}
```

The class name pattern `<plugin-prefix>-sidebar-collapsed` (e.g. `pfl-sidebar-collapsed`) is what `Sidebar.init` adds/toggles on the layout root.

### 4.4 Per-plugin HTML changes

Each plugin's `_renderLayout` adds the resizer `<div>` immediately after the existing `<aside class="*-sidebar">` block:

```html
<div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>
```

Then, at the end of `_renderLayout`, after the existing event-listener wiring:

```js
Sidebar.init({
  pluginId: 'product-forge-local',
  rootSelector: '#view-product-forge-local',
  sidebarSelector: '.pfl-sidebar',
  toggleSelector: '[data-pfl-action="toggle-sidebar"]',
  resizerSelector: '.pfl-sidebar-resizer',
});
```

`product-forge.js` and `audio-forge.js` are the two plugins without a toolbar toggle button today; both get one added to match the pattern of the other five. The product-forge toolbar (currently lines 1175–1187) gains a new button as the first child of `.plugin-toolbar` (before the title), so it sits at the far left of the toolbar consistent with the other five plugins:

```html
<button class="btn-icon pfl-toolbar-toggle" data-pfl-action="toggle-sidebar" title="Toggle sidebar">
  <i class="fa-solid fa-chevron-left"></i>
</button>
```

The audio-forge toolbar gains the analogous `af-toolbar-toggle` button.

### 4.5 Per-plugin CSS edits

In each of the seven `app/css/*-forge.css` files:

1. Remove the rule that hides the toolbar toggle on desktop, e.g. for `product-forge.css`:
   ```css
   /* REMOVE:
   .pfl-toolbar-toggle { display: none !important; }
   @media (max-width: 768px) { .pfl-toolbar-toggle { display: inline-flex !important; } }
   */
   ```
   Keep the `@media (max-width: 768px)` rules that make the sidebar act as a slide-over (those are about mobile, not desktop visibility of the toggle).
2. Add `grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;` and `transition: grid-template-columns 0.18s ease;` to the layout class.

### 4.6 `app/index.html`

Add `<script src="js/sidebar.js"></script>` before the plugin controller scripts (i.e. before `shell.js`).

## 5. Data flow

```
                ┌──────────────────────────────────────┐
                │  localStorage                         │
                │  forge-shell-sidebar-{id}-width       │
                │  forge-shell-sidebar-{id}-collapsed   │
                └──────────────┬───────────────────────┘
                               │ read on init
                               ▼
        ┌────────────────────────────────────────────┐
        │ Sidebar.init(config)                       │
        │  - clamp width to [min, max]               │
        │  - set <aside>.style.width                 │
        │  - set --plugin-sidebar-current on layout  │
        │  - toggle *-sidebar-collapsed class        │
        │  - wire toggle button click                │
        │  - wire resizer mousedown/move/up/keydown  │
        └──────────────┬─────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
   user clicks toggle             user drags resizer
        │                              │
        ▼                              ▼
   flip class, persist         set width, on mouseup
   collapsed flag              persist width (or
                               auto-collapse + reset)
```

## 6. Error handling

- **localStorage unavailable / quota exceeded**: every read/write wrapped in `try/catch`. Failures fall back to an in-memory `Map` keyed by `pluginId`; one `console.warn` on first failure. No thrown errors reach the user.
- **No toggle button at init**: log a `console.warn`, skip toggle wiring; resize still works.
- **No resizer at init**: log a `console.warn`, skip resize wiring; toggle still works.
- **Re-init** (e.g. plugin view re-renders): `Sidebar.init` checks `data-sidebar-init="1"` on the root element, tears down prior listeners, then re-binds. Prevents double-fires.
- **Drag start while already collapsed**: `Sidebar.init` skips the drag listener while the layout has the `*-sidebar-collapsed` class. The resizer is also `display: none` in that state, so this is mostly belt-and-suspenders.
- **Window resize below `minWidth`**: the drag clamps at minWidth; the sidebar is never narrower than the configured minimum. We do not auto-collapse on window resize alone (user intent is clearer with explicit drag past min).

## 7. Testing

### 7.1 Automated (`npm test`)

New file `app/test/sidebar.test.js` using `node --test` + `jsdom`. Tests cover pure logic only (no DOM wiring):

- `clampWidth(170, {min:180,max:480,default:280})` → `null` (signals auto-collapse)
- `clampWidth(180, ...)` → `180`
- `clampWidth(200, ...)` → `200`
- `clampWidth(600, ...)` → `480`
- `storageRoundTrip({pluginId:'x', width:320, collapsed:false})` → write, read, expect same
- `storageRoundTrip({pluginId:'x', width:280, collapsed:true})` → write, read, expect same
- `storageFailure`: monkey-patch `localStorage.getItem` to throw; expect `Sidebar._storage('x','width')` returns `null` and warns
- `clampWidth(NaN, ...)` → returns `default`

### 7.2 Manual QA checklist (run after implementation)

For each of the 7 plugins:

- [ ] Toolbar shows the sidebar toggle button (chevron) at all viewport widths.
- [ ] Clicking toggle hides the sidebar; clicking again shows it.
- [ ] Reload page: previous collapsed state is restored.
- [ ] Drag the right edge of the sidebar right; width grows up to 480px.
- [ ] Drag the right edge of the sidebar left; width shrinks down to 180px.
- [ ] Continue dragging left past minWidth; sidebar auto-collapses; release and click toggle to expand at default width (280px).
- [ ] Reload page: previous custom width is restored.
- [ ] Tab to the resizer handle; ←/→ arrows step width by 16px; Home/End jump to min/max.
- [ ] Tab to the resizer; Enter toggles collapse.
- [ ] On mobile (≤768px) the sidebar still acts as a slide-over; the new desktop behavior does not interfere.

## 8. Files to change

| File | Change | Approx LOC |
|---|---|---|
| `app/js/sidebar.js` | **NEW** | +150 |
| `app/test/sidebar.test.js` | **NEW** | +60 |
| `app/index.html` | +1 script tag | +1 |
| `app/css/components.css` | +resizer + dragging rules | +35 |
| `app/css/product-forge.css` | layout uses `--plugin-sidebar-current`; remove desktop-hide of toggle | +3 / −3 |
| `app/css/cognitive-forge.css` | same | +3 / −3 |
| `app/css/rovo-agent-forge.css` | same | +3 / −3 |
| `app/css/report-forge.css` | same | +3 / −3 |
| `app/css/slack-forge.css` | same | +3 / −3 |
| `app/css/outlook-forge.css` | same | +3 / −3 |
| `app/css/audio-forge.css` | same | +3 / −3 |
| `app/js/product-forge.js` | add toolbar toggle button (see §4.4); resizer `<div>`; call `Sidebar.init` | +18 |
| `app/js/cognitive-forge.js` | same | +10 |
| `app/js/rovo-agent-forge.js` | same | +10 |
| `app/js/report-forge.js` | same | +10 |
| `app/js/slack-forge.js` | same | +10 |
| `app/js/outlook-forge.js` | same | +10 |
| `app/js/audio-forge.js` | add toolbar toggle button + resizer + `Sidebar.init` | +15 |
| `STYLE_GUIDE.md` | document `--plugin-sidebar-current` token + sidebar contract | +20 |

Net: ~340 lines added, ~15 lines removed.

## 9. Rollout

1. Land `sidebar.js` + `components.css` + `index.html` script tag (no behavior change yet).
2. Land per-plugin changes in a single PR (or 7 small PRs, one per plugin) so regressions are easy to bisect.
3. Update `STYLE_GUIDE.md` so future plugins follow the same contract.
4. No migration: existing users start with default state (expanded, 280px). No data loss.

## 10. Out of scope (deferred)

- Detachable / floating sidebars.
- Per-plugin multiple saved layouts ("presets").
- Animated collapse-from-the-side (a snap, not a slide).
- Touch-based resizing on tablets.
