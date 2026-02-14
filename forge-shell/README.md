# Forge Shell

**Desktop visualization app** for browsing project data created by Forge Marketplace plugins. Provides a unified single-page application (SPA) with built-in view controllers for all plugin views. No iframes.

> **Note:** Forge Shell is a standalone desktop application, not a Claude Code plugin. Other plugins (Product Forge, Cognitive Forge, etc.) create the content; Forge Shell provides a visual interface for browsing it.

## Desktop App Installation

### Development Mode

```bash
cd forge-shell
npm install
npm run tauri:dev
```

This launches the Tauri desktop app in development mode with hot reload.

### Production Build

```bash
npm run tauri:build
```

This creates a platform-specific installer in `src-tauri/target/release/bundle/`.

## Key Files

- `app/index.html` — The SPA entry point with all plugin view containers pre-rendered
- `app/js/shell.js` — Core shell logic with hardcoded PLUGINS array and navigation
- `app/js/{plugin}.js` — View controllers for each plugin (cognitive-forge.js, product-forge.js, etc.)
- `app/css/` — Shared styling and plugin-specific CSS

## Architecture

- **Unified SPA** — All plugins embedded in a single HTML document (app/index.html)
- **Hardcoded PLUGINS array** — Plugin registration happens in shell.js (lines 6-13), not via plugin discovery
- **View controllers** — Each plugin has a dedicated JavaScript module that implements `init(rootHandle)` and `destroy()` methods
- **Hash-based routing** — Uses URL hash (#plugin-id) for navigation without page reloads
- **File System Access API** — Users select their project root directory once; handle persisted in IndexedDB
- **Pre-rendered view containers** — Each plugin has a `<div id="view-{plugin-id}">` container; only one visible at a time
- **Shared theming** — Dark/light mode via CSS custom properties; theme toggle updates all views

## Plugin Registration

All plugins are registered in the PLUGINS array in `app/js/shell.js`:

```javascript
const PLUGINS = [
  { id: 'forge-shell',         label: 'Forge Shell',     icon: 'fa-solid fa-terminal',       requiredDir: null },
  { id: 'cognitive-forge',     label: 'Cognitive Forge',  icon: 'fa-solid fa-brain',          requiredDir: 'sessions' },
  { id: 'product-forge-local', label: 'Product Forge',    icon: 'fa-solid fa-clipboard-list', requiredDir: 'cards' },
  { id: 'roadmap',             label: 'Roadmap',          icon: 'fa-solid fa-road',           requiredDir: 'cards' },
  { id: 'productivity',        label: 'Productivity',     icon: 'fa-solid fa-list-check',     requiredDir: null },
  { id: 'rovo-agent-forge',    label: 'Rovo Agent Forge', icon: 'fa-solid fa-robot',          requiredDir: 'rovo-agents' },
];
```

Each plugin specifies:

- `id`: unique identifier used in routing
- `label`: displayed in sidebar navigation
- `icon`: Font Awesome class for sidebar icon
- `requiredDir`: which directory must exist for the plugin to be "active" (null = always available)

## View Controller Pattern

Each plugin implements a view controller that:

1. Defines `init(rootHandle)` to render UI when the plugin is activated
2. Optionally defines `destroy()` for cleanup when switching away
3. Registers itself via `Shell.registerController(pluginId, controller)`
4. Scopes all DOM queries to its view container (#view-{plugin-id})

Example structure from `cognitive-forge.js`:

```javascript
window.CognitiveForgeView = (function () {
  'use strict';

  let rootHandle = null;
  let initialized = false;

  // Scoped query helper
  function $(sel) {
    return document.querySelector('#view-cognitive-forge ' + sel);
  }

  function init(handle) {
    rootHandle = handle;
    // Render UI inside #view-cognitive-forge container
    scaffold();
    loadSessions();
    initialized = true;
  }

  function destroy() {
    // Cleanup timers, event listeners, etc.
    initialized = false;
  }

  return { init, destroy };
})();

Shell.registerController('cognitive-forge', window.CognitiveForgeView);
```

## Directory Structure

```
forge-shell/
├── app/
│   ├── index.html              # SPA entry point
│   ├── css/
│   │   ├── theme.css           # CSS custom properties for theming
│   │   ├── shell.css           # Core shell layout
│   │   ├── components.css      # Shared components
│   │   └── {plugin}.css        # Plugin-specific styles
│   └── js/
│       ├── utils.js            # Shared utilities (FS API, YAML, theme, toast)
│       ├── card-data.js        # Shared card parsing
│       ├── shell.js            # Shell core + ForgeShellView controller
│       ├── cognitive-forge.js  # CognitiveForgeView controller
│       ├── product-forge.js    # ProductForgeLocalView controller
│       ├── productivity.js     # ProductivityView controller
│       ├── roadmap.js          # RoadmapView controller
│       └── rovo-agent-forge.js # RovoAgentForgeView controller
```

## Usage

1. Launch the desktop app via `npm run tauri:dev` (development) or the installed app (production)
2. Select your project root directory when prompted
3. Use the sidebar to navigate between plugin views
4. Toggle dark/light theme with the moon/sun icon
5. Use "Change Directory" to switch to a different project

The directory handle is persisted in IndexedDB, so you won't need to reselect it on subsequent visits.

## Edit Mode

Click the pencil icon at the bottom of the sidebar to enter edit mode. In edit mode, you can:

- Toggle plugin visibility using the eye icons next to each plugin
- Hidden plugins are remembered across sessions
- Exit edit mode by clicking the checkmark icon

Plugins cannot be removed from the SPA (they are hardcoded), but they can be hidden from the sidebar when not needed.
