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
      if (!state.docsRoot && !ForgeFS.usesPathStrings()) {
        try { state.docsRoot = await ForgeUtils.DB.get('dp-docs-root'); } catch (e) { /* ignore */ }
      }
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
    },

    async _loadDocs() {
      var entries = [];
      try {
        entries = await ForgeFS.listMarkdownFiles(state.docsRoot, DOCS_SUBDIR);
      } catch (e) { entries = []; }

      var docs = [];
      var skipped = 0;
      for (var i = 0; i < entries.length; i++) {
        var ent = entries[i];
        if (!/\.md$/i.test(ent.name)) continue;
        var rel = DOCS_SUBDIR + '/' + ent.path;
        var raw;
        try { raw = await ForgeFS.readFile(state.docsRoot, rel); }
        catch (err) { skipped++; continue; }
        try { docs.push(H.parseDoc(ent.path, raw, H.DEFAULT_CLUSTERS)); }
        catch (perr) { skipped++; }
      }
      state.docs = docs;
      state.skipped = skipped;
      state.initiatives = H.groupInitiatives(docs);
      this._renderTree();
      if (skipped > 0) {
        ForgeUtils.Toast.show('Skipped ' + skipped + ' unreadable doc(s)', 'warning', 4000);
      }
    },

    _statusColor(bucket) {
      return 'var(--dp-status-' + (bucket || 'unknown').toLowerCase().replace(/\s+/g, '') + ', var(--text-muted))';
    },

    _typeIcon(type) {
      if (type === 'spec') return '<i class="fa-regular fa-file-lines" title="spec"></i>';
      if (type === 'plan') return '<i class="fa-solid fa-list-check" title="plan"></i>';
      if (type === 'handoff') return '<i class="fa-solid fa-hand" title="handoff"></i>';
      return '<i class="fa-regular fa-file"></i>';
    },

    _renderTree() {
      var treeEl = $q('[data-dp-tree]');
      if (!treeEl) return;
      treeEl.classList.remove('hidden');
      var resEl = $q('[data-dp-search-results]');
      if (resEl) resEl.classList.add('hidden');

      if (!state.initiatives.length) {
        treeEl.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No docs found.</div>';
        return;
      }
      var html = '';
      state.initiatives.forEach(function (init) {
        var open = !state.collapsed[init.key];
        var members = [];
        if (init.spec) members.push(init.spec);
        if (init.plan) members.push(init.plan);
        init.handoffs.forEach(function (h) { members.push(h); });
        html +=
          '<div class="dp-initiative">' +
            '<div class="dp-initiative-header" data-dp-toggle="' + ESC(init.key) + '">' +
              '<span class="dp-toggle"><i class="fa-solid fa-chevron-' + (open ? 'down' : 'right') + '"></i></span>' +
              '<span class="dp-status-dot" style="background:' + ctrl._statusColor(init.statusBucket) + '"></span>' +
              '<span class="dp-init-date">' + ESC(init.date || '') + '</span>' +
              '<span class="dp-init-title">' + ESC(init.title || init.slug) + '</span>' +
            '</div>' +
            '<div class="dp-members' + (open ? '' : ' hidden') + '">' +
              members.map(function (d) { return ctrl._memberRow(init.key, d); }).join('') +
            '</div>' +
          '</div>';
      });
      treeEl.innerHTML = html;
      this._bindTreeEvents();
    },

    _memberRow(initKey, doc) {
      var selected = (state.selectedKey === initKey && state.selectedType === doc.type);
      var prog = '';
      if (doc.type === 'plan' && doc.progress && doc.progress.percent != null) {
        prog = '<span class="dp-progress" title="' + doc.progress.done + '/' + doc.progress.total + ' done">' +
                 '<span class="dp-progress-bar"><span style="width:' + doc.progress.percent + '%"></span></span>' +
                 doc.progress.percent + '%' +
               '</span>';
      }
      return '<div class="dp-member' + (selected ? ' selected' : '') + '" ' +
        'data-dp-select="' + ESC(initKey) + '" data-dp-type="' + doc.type + '">' +
        '<span class="dp-member-type">' + this._typeIcon(doc.type) + '</span>' +
        '<span class="dp-status-dot" style="background:' + this._statusColor(doc.statusBucket) + '"></span>' +
        '<span class="dp-member-title">' + ESC(doc.title || doc.slug) + '</span>' +
        prog +
        '</div>';
    },

    _bindTreeEvents() {
      $qa('[data-dp-toggle]').forEach(function (el) {
        el.addEventListener('click', function () {
          var key = el.getAttribute('data-dp-toggle');
          if (state.collapsed[key]) delete state.collapsed[key];
          else state.collapsed[key] = true;
          ctrl._renderTree();
        });
      });
      $qa('[data-dp-select]').forEach(function (el) {
        el.addEventListener('click', function () {
          state.selectedKey = el.getAttribute('data-dp-select');
          state.selectedType = el.getAttribute('data-dp-type');
          ctrl._renderTree();
          ctrl._renderDetail();
        });
      });
    }
  };

  // _renderDetail is added in a later task.
  ctrl._renderDetail = function () {};

  window.DesignPlansView = ctrl;
  Shell.registerController('design-plans', window.DesignPlansView);
})();
