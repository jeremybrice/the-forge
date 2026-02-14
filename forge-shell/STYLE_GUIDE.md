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
