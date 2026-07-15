/* ═══════════════════════════════════════════════════════════════
   Design Plans View — browse superpowers specs/plans by initiative.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ESC = ForgeUtils.escapeHTML;
  var VIEW_ID = 'view-design-plans';
  var H = window.DesignPlansHelpers;
  var DOCS_KEY = 'forge-shell-docs-root';
  var DOCS_SUBDIR = 'docs/superpowers';

  function $view() { return document.getElementById(VIEW_ID); }
  function $q(sel) { var v = $view(); return v ? v.querySelector(sel) : null; }
  function $qa(sel) { var v = $view(); return v ? v.querySelectorAll(sel) : []; }

  var state = {
    docsRoot: null, docs: [], initiatives: [],
    selectedKey: null, selectedType: null,
    query: '', skipped: 0,
    filters: { status: [], type: [], topic: [] },
    collapsed: {}   // initiativeKey -> true
  };

  function readDocsRoot() {
    try { return localStorage.getItem(DOCS_KEY) || null; } catch (e) { return null; }
  }
  function writeDocsRoot(p) {
    try { localStorage.setItem(DOCS_KEY, p); } catch (e) { /* ignore */ }
  }

  var ctrl = {
    async init(rootHandle, options) {
      this.destroy();
      var view = $view();
      if (!view) return;
      state.docsRoot = readDocsRoot();
      this._renderLayout(view);
      if (window.Sidebar) {
        window.Sidebar.init({
          pluginId: 'design-plans',
          rootSelector: '#' + VIEW_ID,
          sidebarSelector: '.dp-sidebar',
          toggleSelector: '[data-dp-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }
      if (state.docsRoot) {
        await this._loadDocs();
      } else {
        this._renderEmptyState();
      }
    },

    destroy() {
      state.selectedKey = null;
      state.selectedType = null;
    },

    async refresh() {
      if (state.docsRoot) await this._loadDocs();
    },

    _renderLayout(view) {
      view.innerHTML =
        '<div class="dp-layout">' +
          '<div class="plugin-toolbar">' +
            '<button class="btn-icon" data-dp-action="toggle-sidebar" title="Toggle sidebar"><i class="fa-solid fa-chevron-left"></i></button>' +
            '<span class="toolbar-title"><i class="fa-solid fa-diagram-project"></i> Design Plans</span>' +
            '<div class="folder-path"><span><i class="fa-solid fa-folder-open"></i></span><span class="dp-docs-path">—</span></div>' +
            '<div class="spacer"></div>' +
            '<button class="btn-icon" data-dp-action="toggle-filter" title="Filter"><i class="fa-solid fa-filter"></i></button>' +
            '<button class="btn-icon" data-dp-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>' +
          '</div>' +
          '<div class="dp-active-filters hidden" data-dp-active-filters></div>' +
          '<aside class="dp-sidebar">' +
            '<div class="sidebar-search"><input type="text" data-dp-search placeholder="Search specs & plans…" /></div>' +
            '<div class="dp-tree-view" data-dp-tree></div>' +
            '<div class="dp-search-results hidden" data-dp-search-results></div>' +
          '</aside>' +
          '<div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>' +
          '<main class="dp-detail-panel" data-dp-detail></main>' +
          '<div class="dp-filter-panel" data-dp-filter-panel></div>' +
        '</div>';
      this._updateDocsPath();
      this._bindChrome();
    },

    _updateDocsPath() {
      var el = $q('.dp-docs-path');
      if (el) el.textContent = state.docsRoot ? (state.docsRoot + '/' + DOCS_SUBDIR) : 'no docs root set';
    },

    _bindChrome() {
      var refreshBtn = $q('[data-dp-action="refresh"]');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { ctrl.refresh(); });
      var filterBtn = $q('[data-dp-action="toggle-filter"]');
      if (filterBtn) filterBtn.addEventListener('click', function () {
        var panel = $q('[data-dp-filter-panel]');
        if (panel) panel.classList.toggle('open');
      });
      var search = $q('[data-dp-search]');
      if (search) search.addEventListener('input', function () {
        state.query = search.value;
        ctrl._renderTree();
      });
    },

    _renderEmptyState() {
      var tree = $q('[data-dp-tree]');
      var detail = $q('[data-dp-detail]');
      if (tree) tree.innerHTML = '';
      var msg = '<div class="dp-empty-state">' +
        '<div class="state-icon"><i class="fa-solid fa-diagram-project" style="font-size:40px;color:var(--text-muted);"></i></div>' +
        '<h2>Design Plans</h2>' +
        '<p>Point this tab at a repo containing <code>docs/superpowers/</code> (specs, plans, handoffs).</p>' +
        '<button class="primary" data-dp-action="pick-root">Choose docs root…</button>' +
        '<p class="note" style="color:var(--text-muted);">The path is stored separately from your Forge project folder.</p>' +
      '</div>';
      if (detail) detail.innerHTML = msg;
      var pick = $q('[data-dp-action="pick-root"]');
      if (pick) pick.addEventListener('click', function () { ctrl._pickRoot(); });
    },

    async _pickRoot() {
      try {
        var picked = await ForgeFS.pickDirectory();
        if (!picked) return;
        if (ForgeFS.usesPathStrings()) {
          writeDocsRoot(picked);
          state.docsRoot = picked;
        } else {
          // Browser mode: store the handle in IndexedDB like the project dir.
          await ForgeUtils.DB.save('dp-docs-root', picked);
          state.docsRoot = picked;
        }
        this._updateDocsPath();
        await this._loadDocs();
      } catch (e) {
        if (e && e.name !== 'AbortError') {
          ForgeUtils.Toast.show('Could not set docs root: ' + (e.message || e), 'error', 5000);
        }
      }
    }
  };

  // _loadDocs / _renderTree / _renderDetail are added in later tasks.
  ctrl._loadDocs = async function () { state.docs = []; state.initiatives = []; };
  ctrl._renderTree = function () {};

  window.DesignPlansView = ctrl;
  Shell.registerController('design-plans', window.DesignPlansView);
})();
