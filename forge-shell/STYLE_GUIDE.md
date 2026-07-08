# Forge Marketplace Style Guide

## Standardized Toolbar Pattern

All Forge plugin dashboards must use a consistent top toolbar. The **Cognitive Forge** dashboard (`cognitive-forge/dashboard.html`) is the canonical reference implementation.

### Layout Structure

```
[☰ Toggle*] [Icon Title] [📁 folder badge] [tab toggles*] ...spacer... [refresh text] [🔄] [action btns] [🌙] [📁/📄]
```

\* Optional depending on plugin (e.g., no hamburger if no sidebar, no tab toggles if single-view).

### HTML Template

```html
<div id="toolbar">
  <!-- Optional: sidebar toggle -->
  <button class="btn-icon" onclick="toggleSidebar()" title="Toggle sidebar">&#9776;</button>

  <!-- Required: plugin title with icon -->
  <span style="font-weight:700;font-size:15px;">
    <i class="fa-solid fa-icon-name"></i> Plugin Name
  </span>

  <!-- Required: folder/file badge (hidden until selection) -->
  <div class="folder-path hidden" id="folder-path">
    <span><i class="fa-solid fa-folder-open"></i></span>
    <span id="folder-name"></span>
  </div>

  <!-- Optional: tab toggles -->
  <div class="view-toggle">
    <button class="active">Tab 1</button>
    <button>Tab 2</button>
  </div>

  <!-- Required: spacer pushes remaining items right -->
  <div class="spacer"></div>

  <!-- Required: refresh indicator + button -->
  <span class="refresh-indicator" id="refresh-indicator"></span>
  <button class="btn-icon" title="Refresh"><i class="fa-solid fa-rotate"></i></button>

  <!-- Optional: additional action buttons (save, etc.) -->

  <!-- Required: theme toggle -->
  <button class="btn-icon" id="theme-toggle" title="Toggle theme">
    <i class="fa-solid fa-moon"></i>
  </button>

  <!-- Required: file/folder picker -->
  <button class="btn-icon" title="Select folder">
    <i class="fa-solid fa-folder-open"></i>
  </button>
</div>
```

### CSS Rules

```css
#toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 48px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 10;
  flex-shrink: 0;
}

#toolbar .folder-path {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#toolbar .spacer { flex: 1; }

#toolbar .refresh-indicator {
  font-size: 12px;
  color: var(--text-muted);
}

#toolbar .btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--radius-sm);
  font-size: 16px;
}
```

### Key Dimensions

| Property         | Value     |
| ---------------- | --------- |
| Toolbar height   | 48px      |
| Icon button size | 32 x 32px |
| Icon font size   | 16px      |
| Gap between items| 12px      |
| Horizontal padding | 16px   |
| Folder badge font | 13px    |
| Refresh text font | 12px    |

### Mandatory Shared Classes

These CSS classes are defined in `components.css` and **must** be reused by all plugin views. Do not create plugin-prefixed alternatives for these elements.

| Shared Class | Purpose | Defined In |
|---|---|---|
| `.plugin-toolbar` | Top toolbar container (height, gap, padding, bg) | `components.css` |
| `.plugin-toolbar .toolbar-title` | Plugin title text (font-weight: 700, font-size: 15px) | `components.css` |
| `.plugin-toolbar .folder-path` | Folder badge (font-size: 13px, padding: 4px 10px) | `components.css` |
| `.plugin-toolbar .btn-icon` | Icon buttons (32x32px, font-size: 16px, border) | `components.css` |
| `.plugin-toolbar .spacer` | Flex spacer | `components.css` |
| `.plugin-toolbar .refresh-indicator` | Refresh timestamp text (font-size: 12px) | `components.css` |
| `.view-toggle` | Tab/toggle pill group (padding: 4px, border-radius: 8px) | `components.css` |
| `.view-toggle button` | Toggle button (font-size: 13px, padding: 6px 14px) | `components.css` |
| `.view-toggle button.active` | Active toggle state (bg-card, shadow) | `components.css` |
| `.filter-btn` | Sidebar filter buttons | `components.css` |
| `.sidebar-search` | Sidebar search bar (input + icon) | `components.css` |
| `.sidebar-card` | Sidebar list card (column layout, hover/selected states) | `components.css` |
| `.sidebar-card-title` | Card title (13px, 600 weight, ellipsis) | `components.css` |
| `.sidebar-card-meta` | Card meta row (flex, 11px, muted) | `components.css` |
| `.sidebar-card-pill` | Muted pill — set color via inline `style="background: color-mix(in srgb, {color} 12%, transparent); color: {color};"` | `components.css` |

Plugin-specific toolbar additions (e.g., year navigation, filter badges) should be added as extra elements using plugin-prefixed classes (e.g., `.rm-year-nav`, `.rm-filter-badge`) scoped under `.plugin-toolbar`. Never override the base shared styles.

### JS Conventions

- **Folder badge**: Use `#folder-path` (container) and `#folder-name` (text span). Toggle the `hidden` class to show/hide. Set `folderNameEl.textContent` to update the displayed name.
- **Refresh indicator**: Set `#refresh-indicator` textContent with count/timestamp info (e.g., `"5 cards · 12:34:56"` or `"Refreshed · 12:34:56"`).
- **Theme toggle**: Switch `#theme-toggle` innerHTML between `fa-moon` and `fa-sun` icons based on active theme.

### Implemented Plugins

| Plugin              | File                                  | Has Sidebar | Has Tab Toggles |
| ------------------- | ------------------------------------- | ----------- | --------------- |
| Cognitive Forge     | (SPA view in forge-shell)             | Yes         | No              |
| Product Forge Local | (SPA view in forge-shell)             | Yes         | No              |
| Productivity        | (SPA view in forge-shell)             | No          | Yes (Tasks/Memory, Board/List) |
| Roadmap             | (SPA view in forge-shell)             | No          | Yes (Card/Timeline, Quarterly/Monthly) |
| Rovo Agent Forge    | (SPA view in forge-shell)             | Yes         | No              |

### Font Awesome Icons by Plugin

| Plugin              | Title Icon          | Notes                                   |
| ------------------- | ------------------- | --------------------------------------- |
| Cognitive Forge     | `fa-brain`          | Reference implementation                |
| Product Forge Local | `fa-clipboard-list` |                                         |
| Productivity        | `fa-brain`          | Save uses `fa-floppy-disk`              |
| Rovo Agent Forge    | `fa-robot`          | Sidebar + detail panel, prefix `raf-`   |

### CSS Custom Properties (shared across all plugins)

All plugins use the same CSS custom property names for theming:

- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border-color`, `--border-light`
- `--accent`, `--accent-hover`, `--accent-light`
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px)
- `--transition` (0.2s ease)

## Sidebar Contract (collapsible + resizable, added 2026-07-07)

All Forge plugin views that show a left-hand list panel (sidebar) **must** use the shared `Sidebar.init(...)` module to enable collapse and resize. This applies to: product-forge, cognitive-forge, rovo-agent-forge, report-forge, slack-forge, outlook-forge, audio-forge.

### Required HTML structure

```html
<aside class="<prefix>-sidebar"> ... </aside>
<div class="sidebar-resizer" role="separator" tabindex="0"
     aria-orientation="vertical" aria-label="Resize sidebar"></div>
<main class="<prefix>-detail-panel"> ... </main>
```

The resizer must be a **direct sibling** of the sidebar `<aside>` so it lands in the same CSS grid column. The layout root class must be `<prefix>-layout` (e.g. `pfl-layout`, `cf-layout`).

### Required CSS on the layout

```css
.<prefix>-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  transition: grid-template-columns 0.18s ease;
}
```

`--plugin-sidebar-current` is set inline by `Sidebar.init` when the user drags; the fallback `--plugin-sidebar-width` (= 280px) is the default.

> **Exception — audio-forge uses a flex layout.** `audio-forge` is the one plugin whose `.af-layout` is `display: flex` (not CSS grid) because its detail area needs to coexist with a footer player that is a flex sibling. In audio-forge the `--plugin-sidebar-current` variable is applied to `width` on `.af-sidebar` instead of to `grid-template-columns`, and the resizer is a direct flex sibling of the sidebar rather than a grid-column element. The same `Sidebar.init(...)` call still applies; only the CSS shape differs.

### Required JS

At the end of your layout-scaffolding function, call:

```js
window.Sidebar.init({
  pluginId:       '<your-plugin-id>',
  rootSelector:   '#view-<your-plugin-id>',
  sidebarSelector: '.<prefix>-sidebar',
  toggleSelector: '[data-<prefix>-action="toggle-sidebar"]',
  resizerSelector: '.sidebar-resizer',
  minWidth:    180,    // optional, default 180
  maxWidth:    480,    // optional, default 480
  defaultWidth: 280    // optional, default 280
});
```

Defaults: `minWidth: 180`, `maxWidth: 480`, `defaultWidth: 280`. Do not deviate from these without updating the spec.

### Required toolbar button

The toolbar must contain a toggle button with the `data-<prefix>-action="toggle-sidebar"` attribute and a chevron icon (the module swaps the icon between `fa-chevron-left` and `fa-chevron-right` based on state). It must be a `.btn-icon` inside `.plugin-toolbar`. Do **not** add a separate `display: none` rule to hide it on desktop.

### localStorage keys

The module writes to:
- `forge-shell-sidebar-<pluginId>-width` (integer px string)
- `forge-shell-sidebar-<pluginId>-collapsed` (`'1'` or `'0'`)

Both keys are namespaced by `pluginId` so each plugin's layout is independent.
