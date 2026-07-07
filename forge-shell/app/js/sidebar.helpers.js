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
    if (px < cfg.min) return null;             // signals auto-collapse
    if (px > cfg.max) return cfg.max;
    return Math.round(px);
  }

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
