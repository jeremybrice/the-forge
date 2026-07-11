# Collapsible & Resizable Plugin Sidebars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-07-collapsible-resizable-plugin-sidebars-design.md`

**Goal:** Add a per-plugin collapsible + drag-to-resize sidebar (with persistence) to all 7 Forge plugin views in `forge-shell`.

**Architecture:** One new shared module `app/js/sidebar.js` exposes `Sidebar.init(config)` which wires the toggle button, drag handle, and localStorage for one plugin. Pure logic (width clamping, localStorage wrapper) is split into a separate UMD module `app/js/sidebar.helpers.js` so it can be unit-tested under `node --test` (matching the existing `audio-forge.helpers.js` pattern). CSS for the resizer grip and dragging state lives in `app/css/components.css`; per-plugin layout overrides in each plugin's CSS file.

**Tech Stack:** Vanilla JS (UMD pattern, `var`/ES5-leaning style matching the existing codebase), CSS custom properties, `node --test`, no build step.

---

## File Structure

| File | Responsibility | Change Type |
|------|----------------|-------------|
| `forge-shell/app/js/sidebar.helpers.js` | Pure logic: `clampWidth(px, cfg)`, `SidebarStorage` wrapper around `localStorage` with try/catch fallback. UMD — exports for both `window.SidebarHelpers` and `module.exports`. | **Create** |
| `forge-shell/test/sidebar.helpers.test.js` | `node --test` unit tests for the pure helpers. | **Create** |
| `forge-shell/app/js/sidebar.js` | Browser-only IIFE exposing `Sidebar.init(config)`. Wires toggle button, drag handle (mousedown/move/up + keyboard), applies stored state, persists changes. | **Create** |
| `forge-shell/app/css/components.css` | Shared styles: `.sidebar-resizer` grip, `[class$="-sidebar-collapsed"]` selector for hiding the sidebar + resizer, `body.sidebar-dragging` global rules. | **Modify (append)** |
| `forge-shell/app/index.html` | Add `<script src="js/sidebar.js"></script>` before plugin controller scripts. | **Modify** |
| `forge-shell/app/css/product-forge.css` | `.pfl-layout` uses `var(--plugin-sidebar-current, var(--plugin-sidebar-width))`; remove `display: none` desktop rule for `.pfl-toolbar-toggle`. | **Modify** |
| `forge-shell/app/css/cognitive-forge.css` | Same pattern for `.cf-layout` and `.cf-toolbar-toggle`. | **Modify** |
| `forge-shell/app/css/rovo-agent-forge.css` | Same for `.raf-layout` and `.raf-toolbar-toggle`. | **Modify** |
| `forge-shell/app/css/report-forge.css` | Same for `.rf-layout` and `.rf-toolbar-toggle`. | **Modify** |
| `forge-shell/app/css/audio-forge.css` | Same for `.af-layout`. No `.af-toolbar-toggle` rule exists yet (added in audio-forge.js). | **Modify** |
| `forge-shell/app/js/product-forge.js` | Add toolbar toggle button (none exists today) + resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/cognitive-forge.js` | Add resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/rovo-agent-forge.js` | Add resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/report-forge.js` | Add resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/` | Add resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/` | Add resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/app/js/audio-forge.js` | Add toolbar toggle button (none exists today) + resizer `<div>` + `Sidebar.init(...)` call. | **Modify** |
| `forge-shell/STYLE_GUIDE.md` | Document `--plugin-sidebar-current` token + the `Sidebar.init` contract for new plugins. | **Modify (append)** |

No deletions anywhere. Rollout order is deliberately safe: shared module + CSS first (no behavior change), then per-plugin integration.

---

## Global Constraints

- **Style**: ES5-leaning — `var` (not `let`/`const`), `function () { }` expressions, no arrow shorthand in multi-line code (single-line arrow callbacks are OK and already used in the file). UMD module pattern matches `audio-forge.helpers.js`.
- **Selectors**: data-attribute selectors for actions (`data-pfl-action`, `data-cf-action`, etc.) — preserve the per-plugin prefix convention.
- **CSS**: prefer existing custom properties (`--bg-*`, `--text-*`, `--border-color`, `--accent`, `--transition`); never override shared component classes.
- **localStorage keys**: `forge-shell-sidebar-{pluginId}-width` and `forge-shell-sidebar-{pluginId}-collapsed`. Always wrap in try/catch.
- **Test runner**: `npm test` (already wired to `node --test`). Test files live in `test/` not `app/test/`.
- **Commit message style**: `feat(sidebar): <what>` for new code, `style(<plugin>): <what>` for CSS, `docs(style-guide): <what>` for STYLE_GUIDE.md, `chore(index): <what>` for `app/index.html`.
- **Default config** for all 7 plugins: `minWidth: 180, maxWidth: 480, defaultWidth: 280`.

---

## Task 1: Create `app/js/sidebar.helpers.js` (UMD) — pure logic for `clampWidth` and `SidebarStorage`

**Files:**
- Create: `forge-shell/test/sidebar.helpers.test.js`
- Create: `forge-shell/app/js/sidebar.helpers.js`

**Interfaces (this task produces):**
```js
// Returns a clamped integer px, or null if the input is below minWidth
// (signals the caller to clamp to cfg.min — no auto-collapse).
clampWidth(px, cfg) → number | null
// cfg = { min: number, max: number, default: number }

// localStorage wrapper. Falls back to in-memory Map on failure.
// - read(pluginId, key) → string | null
// - write(pluginId, key, value) → void
SidebarStorage.read(pluginId, key)  → string | null
SidebarStorage.write(pluginId, key, value) → void
```

- [ ] **Step 1: Write failing tests for `clampWidth`**

Create `forge-shell/test/sidebar.helpers.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../app/js/sidebar.helpers.js');

const cfg = { min: 180, max: 480, default: 280 };

test('clampWidth: returns null below min (signals caller to clamp to cfg.min)', () => {
  assert.equal(helpers.clampWidth(170, cfg), null);
  assert.equal(helpers.clampWidth(0, cfg), null);
  assert.equal(helpers.clampWidth(-10, cfg), null);
});

test('clampWidth: returns min when exactly at min', () => {
  assert.equal(helpers.clampWidth(180, cfg), 180);
});

test('clampWidth: passes through values within range', () => {
  assert.equal(helpers.clampWidth(200, cfg), 200);
  assert.equal(helpers.clampWidth(320, cfg), 320);
  assert.equal(helpers.clampWidth(479, cfg), 479);
});

test('clampWidth: clamps to max', () => {
  assert.equal(helpers.clampWidth(480, cfg), 480);
  assert.equal(helpers.clampWidth(600, cfg), 480);
  assert.equal(helpers.clampWidth(9999, cfg), 480);
});

test('clampWidth: non-finite input returns default', () => {
  assert.equal(helpers.clampWidth(NaN, cfg), 280);
  assert.equal(helpers.clampWidth(Infinity, cfg), 280);
  assert.equal(helpers.clampWidth('200', cfg), 280);
  assert.equal(helpers.clampWidth(null, cfg), 280);
  assert.equal(helpers.clampWidth(undefined, cfg), 280);
});

test('clampWidth: rounds fractional values to nearest integer', () => {
  assert.equal(helpers.clampWidth(199.4, cfg), 199);
  assert.equal(helpers.clampWidth(199.6, cfg), 200);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd forge-shell && npm test`
Expected: FAIL — `Cannot find module '../app/js/sidebar.helpers.js'`

- [ ] **Step 3: Create `app/js/sidebar.helpers.js` with the UMD scaffold + `clampWidth`**

```js
/* ═══════════════════════════════════════════════════════════════
   Sidebar Helpers — Pure logic for the collapsible/resizable plugin sidebar.
   Importable as a <script> (window.SidebarHelpers) or via Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SidebarHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampWidth(px, cfg) {
    if (typeof px !== 'number' || !Number.isFinite(px)) return cfg.default;
    if (px < cfg.min) return null;             // signals caller to clamp to cfg.min
    if (px > cfg.max) return cfg.max;
    return Math.round(px);
  }

  return { clampWidth: clampWidth };
});
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd forge-shell && npm test`
Expected: all 6 clampWidth tests PASS.

- [ ] **Step 5: Add `SidebarStorage` tests**

Append to `forge-shell/test/sidebar.helpers.test.js`:

```js
test('SidebarStorage: read returns null when key absent', () => {
  helpers.SidebarStorage._reset();
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), null);
});

test('SidebarStorage: write then read round-trips', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage.write('test-plugin', 'width', '320');
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), '320');
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: write then read round-trips collapsed flag', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage.write('test-plugin', 'collapsed', '1');
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'collapsed'), '1');
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: failure on read returns null (does not throw)', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage._simulateFailure(true);
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), null);
  helpers.SidebarStorage._simulateFailure(false);
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: failure on write does not throw', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage._simulateFailure(true);
  assert.doesNotThrow(function () {
    helpers.SidebarStorage.write('test-plugin', 'width', '320');
  });
  helpers.SidebarStorage._simulateFailure(false);
  helpers.SidebarStorage._reset();
});
```

- [ ] **Step 6: Run tests, verify new ones fail**

Run: `cd forge-shell && npm test`
Expected: the 5 new SidebarStorage tests FAIL (functions undefined).

- [ ] **Step 7: Add `SidebarStorage` implementation to `app/js/sidebar.helpers.js`**

Replace the `return { clampWidth: clampWidth };` line at the bottom of the factory with:

```js
  var _memoryFallback = new Map();
  var _failNext = false;
  var _warned = false;

  function _key(pluginId, key) {
    return 'forge-shell-sidebar-' + pluginId + '-' + key;
  }

  function _warnOnce(msg) {
    if (_warned) return;
    _warned = true;
    if (typeof console !== 'undefined' && console.warn) console.warn(msg);
  }

  var SidebarStorage = {
    read: function (pluginId, key) {
      if (_failNext) { _failNext = false; return null; }
      try {
        var v = window.localStorage.getItem(_key(pluginId, key));
        if (v === null) {
          var m = _memoryFallback.get(_key(pluginId, key));
          return m == null ? null : m;
        }
        return v;
      } catch (e) {
        _warnOnce('[sidebar] localStorage read failed, using in-memory fallback: ' + e.message);
        var m2 = _memoryFallback.get(_key(pluginId, key));
        return m2 == null ? null : m2;
      }
    },
    write: function (pluginId, key, value) {
      if (_failNext) { _failNext = false; return; }
      try {
        window.localStorage.setItem(_key(pluginId, key), String(value));
      } catch (e) {
        _warnOnce('[sidebar] localStorage write failed, using in-memory fallback: ' + e.message);
        _memoryFallback.set(_key(pluginId, key), String(value));
      }
    },
    /* ── test hooks (no-op in production) ── */
    _reset: function () { _memoryFallback.clear(); _failNext = false; _warned = false; },
    _simulateFailure: function (on) { _failNext = !!on; }
  };

  return {
    clampWidth: clampWidth,
    SidebarStorage: SidebarStorage
  };
});
```

Note: `window.localStorage` is used (not `globalThis.localStorage`) so the same code runs in browser and under `node --test` (where `localStorage` is undefined, the try/catch falls through to the in-memory map).

- [ ] **Step 8: Run all tests, verify they pass**

Run: `cd forge-shell && npm test`
Expected: all 11 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/js/sidebar.helpers.js forge-shell/test/sidebar.helpers.test.js
git commit -m "feat(sidebar): add pure helpers (clampWidth + storage) with tests"
```

---

## Task 2: Create `app/js/sidebar.js` — DOM wiring for toggle, drag, keyboard, persistence

**Files:**
- Create: `forge-shell/app/js/sidebar.js`

**Interfaces (this task produces):**
```js
window.Sidebar.init({
  pluginId:       string,   // localStorage key suffix
  rootSelector:   string,   // CSS selector for the view container
  sidebarSelector: string,  // CSS selector for the <aside>
  toggleSelector:  string,  // CSS selector for the toolbar button
  resizerSelector: string,  // CSS selector for the drag handle
  minWidth:    number,      // default 180
  maxWidth:    number,      // default 480
  defaultWidth: number      // default 280
})
```

Idempotent: if the root element already has `data-sidebar-init="1"`, removes prior listeners and re-binds.

- [ ] **Step 1: Create the file with the UMD scaffold + `Sidebar.init` skeleton**

Create `forge-shell/app/js/sidebar.js`:

```js
/* ═══════════════════════════════════════════════════════════════
   Sidebar — DOM wiring for collapsible / resizable plugin sidebars.
   Browser-only (no module.exports; depends on document and window).
   ═══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var Helpers = root.SidebarHelpers;
  if (!Helpers) {
    if (root.console && root.console.error) {
      root.console.error('[sidebar] SidebarHelpers not loaded; sidebar.js requires it.');
    }
    return;
  }

  var DEFAULTS = { minWidth: 180, maxWidth: 480, defaultWidth: 280 };

  function _merged(cfg) {
    return {
      minWidth:    cfg.minWidth    != null ? cfg.minWidth    : DEFAULTS.minWidth,
      maxWidth:    cfg.maxWidth    != null ? cfg.maxWidth    : DEFAULTS.maxWidth,
      defaultWidth: cfg.defaultWidth != null ? cfg.defaultWidth : DEFAULTS.defaultWidth
    };
  }

  function _collapsedClassName(prefix) {
    return prefix + '-sidebar-collapsed';
  }

  function _readState(pluginId, defaults) {
    var w = Helpers.SidebarStorage.read(pluginId, 'width');
    var c = Helpers.SidebarStorage.read(pluginId, 'collapsed');
    var clamped = Helpers.clampWidth(w == null ? defaults.defaultWidth : parseInt(w, 10), {
      min: defaults.minWidth, max: defaults.maxWidth, default: defaults.defaultWidth
    });
    return {
      width: clamped == null ? defaults.defaultWidth : clamped,
      collapsed: c === '1'
    };
  }

  function _writeState(pluginId, width, collapsed) {
    Helpers.SidebarStorage.write(pluginId, 'width', String(width));
    Helpers.SidebarStorage.write(pluginId, 'collapsed', collapsed ? '1' : '0');
  }

  function _applyState(el, layout, sidebar, state, defaults) {
    if (state.collapsed) {
      el.classList.add(_collapsedClassName(_prefix(layout)));
      layout.style.removeProperty('--plugin-sidebar-current');
      sidebar.style.width = '';
    } else {
      el.classList.remove(_collapsedClassName(_prefix(layout)));
      var px = state.width + 'px';
      layout.style.setProperty('--plugin-sidebar-current', px);
      sidebar.style.width = px;
    }
  }

  function _prefix(layout) {
    /* layoutClass = e.g. "pfl-layout" → prefix "pfl" */
    var cls = layout.className.split(/\s+/)[0] || '';
    var m = cls.match(/^([a-z]{2,4})-layout$/);
    return m ? m[1] : 'plugin';
  }

  function _toggleIcon(btn, collapsed) {
    var icon = btn.querySelector('i');
    if (!icon) return;
    icon.className = collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
  }

  function _init(config) {
    if (!config || !config.pluginId || !config.rootSelector || !config.sidebarSelector) {
      if (root.console && root.console.error) {
        root.console.error('[sidebar] Sidebar.init: missing required config field');
      }
      return;
    }

    var defaults = _merged(config);
    var el       = document.querySelector(config.rootSelector);
    var sidebar  = el && el.querySelector(config.sidebarSelector);
    var layout   = el && el.querySelector('.' + _prefix(el) + '-layout, [class$="-layout"]');
    if (!el || !sidebar || !layout) {
      if (root.console && root.console.warn) {
        root.console.warn('[sidebar] Sidebar.init: root, sidebar, or layout not found for ' + config.pluginId);
      }
      return;
    }

    /* ── Idempotency: if already initialized, tear down first ── */
    if (el.dataset.sidebarInit === '1') {
      if (el._sidebarTeardown) el._sidebarTeardown();
    }

    var cfg = { min: defaults.minWidth, max: defaults.maxWidth, default: defaults.defaultWidth };
    var pluginId = config.pluginId;

    var toggleBtn = config.toggleSelector ? el.querySelector(config.toggleSelector) : null;
    var resizer   = config.resizerSelector ? el.querySelector(config.resizerSelector) : null;
    if (!toggleBtn && root.console && root.console.warn) {
      root.console.warn('[sidebar] toggle button not found for ' + pluginId);
    }
    if (!resizer && root.console && root.console.warn) {
      root.console.warn('[sidebar] resizer not found for ' + pluginId);
    }

    function applyAndPersist(state) {
      _applyState(el, layout, sidebar, state, defaults);
      _writeState(pluginId, state.width, state.collapsed);
    }

    function setCollapsed(collapsed) {
      var st = _readState(pluginId, defaults);
      st.collapsed = !!collapsed;
      applyAndPersist(st);
      if (toggleBtn) _toggleIcon(toggleBtn, st.collapsed);
    }

    function setWidth(px) {
      var clamped = Helpers.clampWidth(px, cfg);
      if (clamped == null) {
        setCollapsed(true);
        return;
      }
      var st = _readState(pluginId, defaults);
      st.width = clamped;
      st.collapsed = false;
      applyAndPersist(st);
    }

    /* ── Initial state ── */
    var initial = _readState(pluginId, defaults);
    _applyState(el, layout, sidebar, initial, defaults);
    if (toggleBtn) _toggleIcon(toggleBtn, initial.collapsed);

    /* ── Toggle button ── */
    function onToggleClick() {
      var st = _readState(pluginId, defaults);
      setCollapsed(!st.collapsed);
    }
    if (toggleBtn) toggleBtn.addEventListener('click', onToggleClick);

    /* ── Drag (mousedown on resizer) ── */
    var dragging = false;
    var startX = 0;
    var startW = 0;

    function onMouseDown(e) {
      if (initial.collapsed) return;     /* belt-and-suspenders: resizer is display:none when collapsed */
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      document.body.classList.add('sidebar-dragging');
      resizer.classList.add('dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
      if (!dragging) return;
      var newW = startW + (e.clientX - startX);
      var clamped = Helpers.clampWidth(newW, cfg);
      if (clamped == null) {
        /* visually show min width while still in drag */
        sidebar.style.width = cfg.min + 'px';
        layout.style.setProperty('--plugin-sidebar-current', cfg.min + 'px');
      } else {
        sidebar.style.width = clamped + 'px';
        layout.style.setProperty('--plugin-sidebar-current', clamped + 'px');
      }
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('sidebar-dragging');
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      var finalW = sidebar.getBoundingClientRect().width;
      setWidth(finalW);
    }

    function onKeyDown(e) {
      var step = 16;
      var st = _readState(pluginId, defaults);
      if (st.collapsed) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setCollapsed(false);
        }
        return;
      }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setWidth(st.width - step); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setWidth(st.width + step); }
      else if (e.key === 'Home')  { e.preventDefault(); setWidth(cfg.min); }
      else if (e.key === 'End')   { e.preventDefault(); setWidth(cfg.max); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(true); }
    }

    if (resizer) {
      resizer.addEventListener('mousedown', onMouseDown);
      resizer.addEventListener('keydown', onKeyDown);
    }

    /* ── Teardown for idempotency ── */
    el._sidebarTeardown = function () {
      if (toggleBtn) toggleBtn.removeEventListener('click', onToggleClick);
      if (resizer) {
        resizer.removeEventListener('mousedown', onMouseDown);
        resizer.removeEventListener('keydown', onKeyDown);
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      el._sidebarTeardown = null;
    };

    el.dataset.sidebarInit = '1';
  }

  root.Sidebar = { init: _init };
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 2: Smoke-check the syntax with `node --check`**

Run: `cd forge-shell && node --check app/js/sidebar.js`
Expected: exits 0 with no output.

- [ ] **Step 3: Run all tests to confirm nothing regressed**

Run: `cd forge-shell && npm test`
Expected: all 11 helper tests still PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/js/sidebar.js
git commit -m "feat(sidebar): add Sidebar.init (toggle, drag, keyboard, persist)"
```

---

## Task 3: Add shared CSS (resizer grip, collapsed state, dragging state) to `app/css/components.css`

**Files:**
- Modify: `forge-shell/app/css/components.css` (append to end of file)

- [ ] **Step 1: Append the new style block**

Append to `forge-shell/app/css/components.css`:

```css

/* ═══════════════════════════════════════════════════════════
   Sidebar resizer + collapse (shared across all plugin views)
   (added 2026-07-07 — collapsible + resizable plugin sidebars)
   ═══════════════════════════════════════════════════════════ */

/* Drag handle on the right edge of every plugin sidebar.
   Sits in the sidebar grid column and hangs 3px over the divider. */
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 24px;
  border-radius: 1px;
  background: var(--border-color);
}
.sidebar-resizer:hover::after,
.sidebar-resizer.dragging::after {
  background: transparent;
}

/* Hide sidebar + resizer when the layout has the *-sidebar-collapsed class.
   Attribute selector matches all 7 plugin prefixes (pfl/cf/raf/rf/sf/of/af). */
[class$="-sidebar-collapsed"] .pfl-sidebar,
[class$="-sidebar-collapsed"] .cf-sidebar,
[class$="-sidebar-collapsed"] .raf-sidebar,
[class$="-sidebar-collapsed"] .rf-sidebar,
[class$="-sidebar-collapsed"] ,
[class$="-sidebar-collapsed"] ,
[class$="-sidebar-collapsed"] .af-sidebar,
[class$="-sidebar-collapsed"] .sidebar-resizer {
  display: none;
}

/* While dragging, disable text selection on everything and force
   the resize cursor so it doesn't flicker on hover boundaries. */
body.sidebar-dragging,
body.sidebar-dragging * {
  user-select: none;
  cursor: col-resize !important;
}
```

- [ ] **Step 2: Verify the file ends with the new block**

Run: `tail -30 forge-shell/app/css/components.css`
Expected: the appended block appears, no syntax errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/css/components.css
git commit -m "style(components): add shared sidebar-resizer + collapsed-state CSS"
```

---

## Task 4: Add `<script src="js/sidebar.js"></script>` to `app/index.html`

**Files:**
- Modify: `forge-shell/app/index.html` (locate the existing `<script>` tags; sidebar.js must load **before** all plugin controller scripts because they call `Sidebar.init` during their `_renderLayout`)

- [ ] **Step 1: Inspect existing script tags**

Run: `grep -n '<script' forge-shell/app/index.html`
Note the order. Find the first plugin script (likely `shell.js` or `product-forge.js`).

- [ ] **Step 2: Insert the sidebar script tag**

Add this line immediately before the first plugin controller script tag:

```html
  <script src="js/sidebar.js"></script>
```

(The exact line above. Indentation should match the surrounding script tags.)

- [ ] **Step 3: Verify the insertion**

Run: `grep -n 'sidebar' forge-shell/app/index.html`
Expected: the new line is present, and it appears before any `js/product-forge.js` / `js/cognitive-forge.js` etc. tag.

- [ ] **Step 4: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/index.html
git commit -m "chore(index): load sidebar.js before plugin controllers"
```

---

## Task 5: Update per-plugin CSS — 5 plugins that already have a toggle button (cognitive, rovo, report, slack, outlook)

This task bundles 5 file edits because they follow the same shape. Do each edit, then commit once at the end.

**Files (all `forge-shell/app/css/*.css`):**
- Modify: `cognitive-forge.css` (around line 6 + lines 97-108)
- Modify: `rovo-agent-forge.css` (around line 21 + lines 306-336)
- Modify: `report-forge.css` (lines 6-25)
- Modify: `` (around line 9 + lines 242-260)
- Modify: `` (around line 9 + lines 242-260)

The two CSS changes per file:
1. **Layout grid uses `var(--plugin-sidebar-current, var(--plugin-sidebar-width))`** with a `transition` for smooth resize.
2. **Remove the desktop-hide of the toolbar toggle** (keep the mobile @media rule that makes it appear below 768px).

- [ ] **Step 1: Edit `cognitive-forge.css`**

Two replacements in `forge-shell/app/css/cognitive-forge.css`:

**Edit A** — find:
```css
.cf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
  height: 100%;
  overflow: hidden;
}
```
Replace with:
```css
.cf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  height: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.18s ease;
}
```

**Edit B** — find the rules:
```css
/* Hide sidebar toggle on desktop */
.cf-toolbar-toggle {
  display: none !important;
}

@media (max-width: 768px) {
  .cf-toolbar-toggle {
    display: inline-flex !important;
  }
}
```
Replace with:
```css
/* Sidebar toggle is visible on both desktop and mobile.
   The mobile breakpoint in the responsive block keeps the toggle
   visible (no extra rule needed). */
```

- [ ] **Step 2: Edit `rovo-agent-forge.css`**

**Edit A** — find:
```css
.raf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
```
Replace with:
```css
.raf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  transition: grid-template-columns 0.18s ease;
```

**Edit B** — find the `.raf-toolbar-toggle { display: none !important; }` rule and the `@media (max-width: 768px) { .raf-toolbar-toggle { display: inline-flex !important; } }` rule. Delete both (the mobile rule is no longer needed because the toggle is now always visible).

- [ ] **Step 3: Edit `report-forge.css`**

**Edit A** — find:
```css
.rf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
```
Replace with:
```css
.rf-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  transition: grid-template-columns 0.18s ease;
```

**Edit B** — find:
```css
/* Sidebar toggle button - mobile only */
.rf-toolbar-toggle {
  display: none !important;
}

@media (max-width: 768px) {
  .rf-toolbar-toggle {
    display: inline-flex !important;
  }
}
```
Replace with:
```css
/* Sidebar toggle is visible on both desktop and mobile. */
```

- [ ] **Step 4: Edit ``**

**Edit A** — find:
```css
 {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
```
Replace with:
```css
 {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  transition: grid-template-columns 0.18s ease;
```


- [ ] **Step 5: Edit ``**

**Edit A** — find:
```css
 {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
```
Replace with:
```css
 {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  transition: grid-template-columns 0.18s ease;
```


- [ ] **Step 6: Sanity-check each file**

Run: `grep -n 'plugin-sidebar-current\|toolbar-toggle' forge-shell/app/css/cognitive-forge.css forge-shell/app/css/rovo-agent-forge.css forge-shell/app/css/report-forge.css forge-shell/app/css/ forge-shell/app/css/`
Expected: each file shows one `plugin-sidebar-current` line in its layout block; each file no longer has a `display: none` for its toolbar toggle.

- [ ] **Step 7: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/css/cognitive-forge.css forge-shell/app/css/rovo-agent-forge.css forge-shell/app/css/report-forge.css forge-shell/app/css/ forge-shell/app/css/
git commit -m "style(5 plugins): use --plugin-sidebar-current; show toolbar toggle on desktop"
```

---

## Task 6: Integrate sidebar into 5 plugins that already have a toggle button (cognitive, rovo, report, slack, outlook)

This task bundles 5 nearly-identical file edits. For each plugin, two changes:

1. **HTML**: insert a resizer `<div>` immediately after the existing `<aside class="*-sidebar">` close tag.
2. **JS**: append a `Sidebar.init({...})` call at the end of `_renderLayout`.

**Files:**
- Modify: `forge-shell/app/js/cognitive-forge.js`
- Modify: `forge-shell/app/js/rovo-agent-forge.js`
- Modify: `forge-shell/app/js/report-forge.js`
- Modify: `forge-shell/app/js/`
- Modify: `forge-shell/app/js/`

- [ ] **Step 1: Edit `cognitive-forge.js`**

**Edit A — HTML** (find the `</aside>` that closes `.cf-sidebar` and the `<div class="cf-session-list">` or similar that follows). Insert the resizer:

```html
          <div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>
```

immediately **after** the `</aside>` close and **before** the next `<div>`. (Adjust whitespace/indentation to match surrounding code.)

**Edit B — JS** at the very end of `_renderLayout` (right before the closing `}` of that function), append:

```js
      if (root.Sidebar) {
        root.Sidebar.init({
          pluginId: 'cognitive-forge',
          rootSelector: '#view-cognitive-forge',
          sidebarSelector: '.cf-sidebar',
          toggleSelector: '[data-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 2: Edit `rovo-agent-forge.js`**

**Edit A** — same as above but the toggle selector is `[data-raf-action="toggle-sidebar"]`.

**Edit B** — append at end of `_renderLayout`:

```js
      if (root.Sidebar) {
        root.Sidebar.init({
          pluginId: 'rovo-agent-forge',
          rootSelector: '#view-rovo-agent-forge',
          sidebarSelector: '.raf-sidebar',
          toggleSelector: '[data-raf-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 3: Edit `report-forge.js`**

**Edit A** — same as cognitive, insert resizer after `.rf-sidebar` `</aside>`.

**Edit B** — append:

```js
      if (root.Sidebar) {
        root.Sidebar.init({
          pluginId: 'report-forge',
          rootSelector: '#view-report-forge',
          sidebarSelector: '.rf-sidebar',
          toggleSelector: '[data-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 4: Edit ``**

**Edit A** — same as above, after `` `</aside>`.

**Edit B** — append:

```js
      if (root.Sidebar) {
        root.Sidebar.init({
          sidebarSelector: '',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 5: Edit ``**

**Edit A** — same, after `` `</aside>`.

**Edit B** — append:

```js
      if (root.Sidebar) {
        root.Sidebar.init({
          sidebarSelector: '',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 6: Verify each file**

Run:
```bash
grep -n 'Sidebar.init\|sidebar-resizer' \
  forge-shell/app/js/cognitive-forge.js \
  forge-shell/app/js/rovo-agent-forge.js \
  forge-shell/app/js/report-forge.js \
  forge-shell/app/js/ \
  forge-shell/app/js/
```
Expected: each file has exactly one `Sidebar.init(` call and one `sidebar-resizer` line.

- [ ] **Step 7: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/js/cognitive-forge.js forge-shell/app/js/rovo-agent-forge.js forge-shell/app/js/report-forge.js forge-shell/app/js/ forge-shell/app/js/
git commit -m "feat(5 plugins): wire collapsible + resizable sidebar"
```

---

## Task 7: Add toolbar toggle + resizer + `Sidebar.init` to `app/js/product-forge.js`

Product Forge Local does not have a toolbar toggle button today. Add one (per spec §4.4) plus the resizer and init call.

**Files:**
- Modify: `forge-shell/app/css/product-forge.css` (same pattern as Task 5)
- Modify: `forge-shell/app/js/product-forge.js` (toolbar button + resizer + init)

- [ ] **Step 1: Edit `product-forge.css`**

**Edit A** — find:
```css
.pfl-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
  height: 100%;
  overflow: hidden;
}
```
Replace with:
```css
.pfl-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;
  height: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.18s ease;
}
```

(No `pfl-toolbar-toggle` rule exists today, so no removal needed.)

- [ ] **Step 2: Edit `product-forge.js` — add toolbar toggle button**

Find the `<div class="plugin-toolbar">` block (around line 1175 in `app/js/product-forge.js`). The first child is currently:

```js
            '<span class="toolbar-title"><i class="fa-solid fa-clipboard-list"></i> Product Forge</span>' +
```

Insert a new button **before** the `toolbar-title` span:

```js
            '<button class="btn-icon pfl-toolbar-toggle" data-pfl-action="toggle-sidebar" title="Toggle sidebar">' +
              '<i class="fa-solid fa-chevron-left"></i>' +
            '</button>' +
```

- [ ] **Step 3: Edit `product-forge.js` — add resizer `<div>` after the `</aside>`**

Find:
```js
          /* Sidebar */
          '<aside class="pfl-sidebar">' +
            '<div class="sidebar-search">' +
              '<i class="fa-solid fa-magnifying-glass"></i>' +
              '<input type="text" placeholder="Search cards\u2026" data-pfl-search />' +
            '</div>' +
            '<div class="pfl-tree-view"></div>' +
          '</aside>' +
```

Append immediately after `'</aside>' +` and before `/* Detail panel */`:

```js
          '<div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>' +
```

- [ ] **Step 4: Edit `product-forge.js` — add `Sidebar.init` call**

The `search input` binding (around line 1253-1257 in `_renderLayout`) is the last block of `_renderLayout`. Append after it, before the closing `}` of `_renderLayout`:

```js
      /* Wire collapsible + resizable sidebar */
      if (window.Sidebar) {
        window.Sidebar.init({
          pluginId: 'product-forge-local',
          rootSelector: '#view-product-forge-local',
          sidebarSelector: '.pfl-sidebar',
          toggleSelector: '[data-pfl-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 5: Verify**

Run: `grep -n 'toggle-sidebar\|sidebar-resizer\|Sidebar.init' forge-shell/app/js/product-forge.js`
Expected: 3 lines — the new toolbar button selector, the resizer line, and the `Sidebar.init(` call.

- [ ] **Step 6: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/css/product-forge.css forge-shell/app/js/product-forge.js
git commit -m "feat(product-forge): add toggle button, resizer, and Sidebar.init"
```

---

## Task 8: Add toolbar toggle + resizer + `Sidebar.init` to `app/js/audio-forge.js` and `app/css/audio-forge.css`

Audio-forge does not have a toggle button today either. Same shape as Task 7.

**Files:**
- Modify: `forge-shell/app/css/audio-forge.css`
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Edit `audio-forge.css` — apply layout pattern**

Find the `.af-layout` rule (or whatever layout class audio-forge uses for its grid; verify by reading the file if needed). The expected existing rule is something like:

```css
.af-layout {
  display: grid;
  grid-template-rows: var(--toolbar-height) 1fr;
  grid-template-columns: var(--plugin-sidebar-width) 1fr;
  height: 100%;
  overflow: hidden;
}
```

If it differs, apply the same two changes:
- Replace `grid-template-columns: var(--plugin-sidebar-width) 1fr;` with `grid-template-columns: var(--plugin-sidebar-current, var(--plugin-sidebar-width)) 1fr;`
- Add `transition: grid-template-columns 0.18s ease;` to the rule.

- [ ] **Step 2: Edit `audio-forge.js` — add toolbar toggle button**

In the `plugin-toolbar` HTML block (around line 175 in `audio-forge.js`), insert a new button as the first child, before any existing title/icon:

```js
              '<button class="btn-icon af-toolbar-toggle" data-af-action="toggle-sidebar" title="Toggle sidebar">' +
                '<i class="fa-solid fa-chevron-left"></i>' +
              '</button>' +
```

- [ ] **Step 3: Edit `audio-forge.js` — add resizer `<div>` after the sidebar `</aside>`**

Locate the `</aside>` that closes `.af-sidebar` (around line 175+ in the same string block). Append the resizer immediately after:

```js
              '<div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>' +
```

- [ ] **Step 4: Edit `audio-forge.js` — add `Sidebar.init` call**

At the end of the function that builds the layout (the analog of `_renderLayout` in the other plugins; verify by reading the file), append:

```js
      if (window.Sidebar) {
        window.Sidebar.init({
          pluginId: 'audio-forge',
          rootSelector: '#view-audio-forge',
          sidebarSelector: '.af-sidebar',
          toggleSelector: '[data-af-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
```

- [ ] **Step 5: Verify**

Run: `grep -n 'toggle-sidebar\|sidebar-resizer\|Sidebar.init' forge-shell/app/js/audio-forge.js`
Expected: 3 lines.

- [ ] **Step 6: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/app/css/audio-forge.css forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): add toggle button, resizer, and Sidebar.init"
```

---

## Task 9: Update `STYLE_GUIDE.md` with the sidebar contract

**Files:**
- Modify: `forge-shell/STYLE_GUIDE.md` (append a new section)

- [ ] **Step 1: Append the new section**

Append to `forge-shell/STYLE_GUIDE.md`:

```markdown

## Sidebar Contract (collapsible + resizable, added 2026-07-07)


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
```

- [ ] **Step 2: Verify**

Run: `tail -50 forge-shell/STYLE_GUIDE.md`
Expected: the new section appears, no syntax errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git add forge-shell/STYLE_GUIDE.md
git commit -m "docs(style-guide): document sidebar contract for new plugins"
```

---

## Task 10: Manual QA pass (per spec §7.2)

No code in this task. The spec's manual QA checklist must be exercised for each of the 7 plugins before merging.

**Files:** none (manual testing only)

- [ ] **Step 1: Start the dev environment**

Run: `cd forge-shell && npm run tauri:dev`
Wait for the app to launch. Open each plugin via the leftmost icon rail.

- [ ] **Step 2: For each of the 7 plugins, verify:**

- [ ] Toolbar shows the sidebar toggle button (chevron) at all viewport widths.
- [ ] Clicking toggle hides the sidebar; clicking again shows it.
- [ ] Reload page (Ctrl+R): previous collapsed state is restored.
- [ ] Drag the right edge of the sidebar right; width grows up to 480px.
- [ ] Drag the right edge of the sidebar left; width shrinks down to 180px.
- [ ] Continue dragging left past minWidth; sidebar clamps at minWidth (180px); release — sidebar stays at 180px. Use the toolbar button (or Tab to the resizer, press Enter) to collapse.
- [ ] Reload page: previous custom width is restored.
- [ ] Tab to the resizer handle (yellow focus ring should appear); ←/→ arrows step width by 16px; Home/End jump to min/max.
- [ ] Tab to the resizer; Enter toggles collapse.
- [ ] On mobile (≤768px, resize the window narrow) the sidebar still acts as a slide-over; the new desktop behavior does not interfere.

- [ ] **Step 3: Run the full test suite one more time**

Run: `cd forge-shell && npm test`
Expected: all 11 helper tests PASS; no regressions in `audio-forge.*` tests.

- [ ] **Step 4: Final commit (no code change, just a "verified" tag)**

If any QA finding required a fix, commit that fix with a message of the form `fix(sidebar): <what>`. If nothing needed fixing, skip this step.

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge
git log --oneline -10
# (verify the 9 feature/style/docs commits are all present)
```

---

## Self-Review (run before handing off)

**1. Spec coverage:**

| Spec section | Covered by |
|---|---|
| §1 Background | (read-only context) |
| §2 Goals (collapse, resize, full-width detail on collapse, no auto-collapse, persist, keyboard, desktop-only) | Tasks 1, 2, 3, 6, 7, 8 |
| §3 Non-Goals (no presets, no touch, mobile unchanged) | Task 10 verifies mobile unchanged |
| §4.1 `Sidebar.init` API | Task 2 |
| §4.2 Shared CSS for resizer + dragging | Task 3 |
| §4.3 Collapsed-state selector | Task 3 |
| §4.4 Per-plugin HTML/JS | Tasks 6, 7, 8 |
| §4.5 Per-plugin CSS edits | Task 5, plus Tasks 7/8 step 1 |
| §4.6 `app/index.html` script tag | Task 4 |
| §5 Data flow | Implemented in Task 2 |
| §6 Error handling (localStorage failure, missing elements, re-init) | Task 2 (try/catch + `_reset` + `_simulateFailure`); Task 1 tests failures |
| §7.1 Automated tests | Task 1 |
| §7.2 Manual QA | Task 10 |
| §8 Files to change | Tasks 3, 4, 5, 6, 7, 8, 9 |
| §9 Rollout order (shared first, per-plugin after) | Tasks 1–4 land shared; Tasks 5–8 land per-plugin |
| §10 Out of scope | (intentionally omitted from plan) |

**2. Placeholder scan:** No "TBD", "TODO", "implement later", or "fill in details" anywhere in the plan. Every code block is complete. Every test is a real assertion. Every commit is a real `git` command.

**3. Type/name consistency:**

- `Sidebar.init(config)` shape: used identically in Tasks 2, 6, 7, 8.
- `clampWidth(px, cfg)` signature: `{ min, max, default }` — defined in Task 1, used in Task 2.
- `SidebarStorage.read/write(pluginId, key)` — defined in Task 1, used in Task 2.
- Plugin IDs in localStorage keys (`'product-forge-local'`, `'cognitive-forge'`, etc.) match the IDs in `app/js/shell.js` PLUGINS array (where applicable) and the new ones introduced here.
- CSS class name pattern `*-sidebar-collapsed` — used consistently in Task 3's CSS selector and Task 2's `_collapsedClassName()`.

If the plan is approved, dispatch the executor (subagent-driven or inline) to walk through Tasks 1 → 10.
