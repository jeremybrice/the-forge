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
      if (finalW <= cfg.min + 1) {
        /* dragged below threshold → auto-collapse + reset to default on re-expand */
        setCollapsed(true);
      } else {
        setWidth(finalW);
      }
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
