/* ═══════════════════════════════════════════════════════════════
   Rovo Agent Forge — View Controller
   Scans rovo-agents/ subdirectories for agent.md files,
   renders a sidebar + detail panel inside #view-rovo-agent-forge.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Scoped helpers ── */
  var ESC = ForgeUtils.escapeHTML;
  var VIEW_ID = 'view-rovo-agent-forge';

  function $view() { return document.getElementById(VIEW_ID); }
  function $q(sel) { var v = $view(); return v ? v.querySelector(sel) : null; }
  function $qa(sel) { var v = $view(); return v ? v.querySelectorAll(sel) : []; }

  /* ── Constants ── */
  var PLATFORM_OPTIONS = ['jira', 'confluence'];
  var STATUS_OPTIONS = ['draft', 'ready', 'deployed'];
  var FIELD_ORDER = [
    'name', 'platform', 'status', 'description',
    'skills', 'knowledge_sources', 'conversation_starters',
    'owner', 'collaborators', 'visibility',
    'created', 'updated'
  ];

  /* ── State ── */
  var rootHandle = null;
  var agentsHandle = null;
  var allAgents = [];
  var selectedAgent = null;
  var activeFilter = 'all';
  var refreshTimer = null;
  var refreshRunning = false;
  var initialized = false;
  var prevSignature = '';

  /* ═══════════════════════════════════════════════════════════
     Utility — slugify
     ═══════════════════════════════════════════════════════════ */
  function slugify(name) {
    return String(name)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* ═══════════════════════════════════════════════════════════
     Color Helpers
     ═══════════════════════════════════════════════════════════ */
  function platformColor(platform) {
    if (platform === 'jira') return 'var(--raf-platform-jira)';
    if (platform === 'confluence') return 'var(--raf-platform-confluence)';
    return 'var(--text-muted)';
  }

  function statusColor(status) {
    if (status === 'draft') return 'var(--status-draft)';
    if (status === 'ready') return 'var(--status-blue)';
    if (status === 'deployed') return 'var(--status-green)';
    return 'var(--text-muted)';
  }

  /* ═══════════════════════════════════════════════════════════
     Scanning — read agents from FS
     Uses ForgeFS abstraction for dual-mode (browser/Tauri) support
     ═══════════════════════════════════════════════════════════ */
  async function scanAgents() {
    if (!rootHandle) return [];

    // V2: Load from index.json instead of scanning directories
    try {
      var indexData = await ForgeUtils.readIndex(rootHandle, 'rovo-agents');
      if (!indexData || !indexData.entries) {
        return [];
      }

      var agents = indexData.entries.map(function(entry) {
        var slug = entry.slug || entry.subdirectory;
        var agentPath = typeof rootHandle === 'string'
          ? rootHandle + '/rovo-agents/' + slug
          : slug;

        return {
          slug: slug,
          frontmatter: entry.frontmatter || {},
          body: entry.body || '',
          lastModified: entry.metadata?.lastModified || Date.now(),
          dirHandle: agentPath,
          fileHandle: entry.path || (slug + '/agent.md')
        };
      });

      // Sort by updated/created date (newest first)
      agents.sort(function (a, b) {
        var da = a.frontmatter.updated || a.frontmatter.created || '';
        var db = b.frontmatter.updated || b.frontmatter.created || '';
        return db.localeCompare(da);
      });

      return agents;
    } catch (e) {
      console.warn('Rovo Agent Forge scan error:', e);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Scaffolding — build DOM structure inside the view
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    var view = $view();
    if (!view) return;

    view.innerHTML =
      '<div class="raf-layout">' +
        /* Toolbar */
        '<div class="plugin-toolbar" style="grid-column: 1 / -1;">' +
          '<button class="btn-icon raf-toolbar-toggle" data-raf-action="toggle-sidebar" title="Toggle sidebar">' +
            '<i class="fa-solid fa-bars"></i>' +
          '</button>' +
          '<span class="toolbar-title"><i class="fa-solid fa-robot"></i> Rovo Agent Forge</span>' +
          '<div class="folder-path hidden" data-raf-ref="folder-path">' +
            '<i class="fa-solid fa-folder-open"></i>' +
            '<span data-raf-ref="folder-name"></span>' +
          '</div>' +
          '<span class="spacer"></span>' +
          '<span class="refresh-indicator" data-raf-ref="refresh-indicator"></span>' +
          '<button class="btn-icon" data-raf-action="refresh" title="Refresh">' +
            '<i class="fa-solid fa-rotate"></i>' +
          '</button>' +
        '</div>' +

        /* Sidebar */
        '<div class="raf-sidebar">' +
          '<div class="raf-filter-bar">' +
            '<div class="filter-btn active" data-raf-filter="all">All</div>' +
            '<div class="filter-btn" data-raf-filter="jira">Jira</div>' +
            '<div class="filter-btn" data-raf-filter="confluence">Confluence</div>' +
          '</div>' +
          '<div class="raf-agent-list" data-raf-ref="agent-list"></div>' +
        '</div>' +

        /* Detail Panel */
        '<div class="raf-detail-panel" data-raf-ref="detail-panel"></div>' +
      '</div>' +

      /* Edit Modal */
      '<div class="raf-modal-overlay" data-raf-ref="modal-overlay">' +
        '<div class="raf-modal-content">' +
          '<div class="raf-modal-header">' +
            '<h3 data-raf-ref="modal-title">Edit Agent</h3>' +
            '<button class="raf-modal-close" data-raf-modal-action="close">&times;</button>' +
          '</div>' +
          '<div class="raf-modal-body" data-raf-ref="modal-body"></div>' +
          '<div class="raf-modal-footer">' +
            '<button data-raf-modal-action="close">Cancel</button>' +
            '<button data-raf-modal-action="toggle-diff">Preview Changes</button>' +
            '<button class="primary" data-raf-modal-action="save">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindToolbar();
    bindFilters();
    bindModalActions();
  }

  /* ═══════════════════════════════════════════════════════════
     Event Binding
     ═══════════════════════════════════════════════════════════ */
  function bindToolbar() {
    var view = $view();
    if (!view) return;
    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-raf-action]');
      if (!btn) return;
      var action = btn.dataset.rafAction;
      if (action === 'refresh') refresh();
      if (action === 'toggle-sidebar') {
        view.querySelector('.raf-layout').classList.toggle('raf-sidebar-open');
      }
    });
  }

  function bindFilters() {
    var bar = $q('.raf-filter-bar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.dataset.rafFilter;
      renderAgentList();
    });
  }

  function bindModalActions() {
    $qa('[data-raf-modal-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = el.dataset.rafModalAction;
        if (action === 'close') editModal.close();
        else if (action === 'toggle-diff') editModal.toggleDiff();
        else if (action === 'save') editModal.save();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Agent List (sidebar)
     ═══════════════════════════════════════════════════════════ */
  function renderAgentList() {
    var listEl = $q('[data-raf-ref="agent-list"]');
    if (!listEl) return;

    var filtered = activeFilter === 'all'
      ? allAgents
      : allAgents.filter(function (a) {
          return String(a.frontmatter.platform || '').toLowerCase() === activeFilter;
        });

    if (allAgents.length === 0) {
      listEl.innerHTML = '<div class="raf-empty-list">No agents yet</div>';
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="raf-empty-list">No ' + ESC(activeFilter) + ' agents</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (a) {
      var fm = a.frontmatter;
      var platform = String(fm.platform || 'unknown').toLowerCase();
      var pc = platformColor(platform);
      var sc = statusColor(fm.status);
      var sel = selectedAgent && selectedAgent.slug === a.slug;
      return '<div class="raf-agent-item' + (sel ? ' selected' : '') + '" data-raf-slug="' + ESC(a.slug) + '">' +
        '<div class="raf-agent-platform-bar" style="background:' + pc + '"></div>' +
        '<div class="raf-agent-item-content">' +
          '<div class="raf-agent-item-title">' + ESC(fm.name || a.slug) + '</div>' +
          '<div class="raf-agent-item-meta">' +
            '<span class="raf-platform-pill" style="background:' + pc + '">' + ESC(platform) + '</span>' +
            '<span class="raf-status-dot" style="background:' + sc + '"></span>' +
            '<span>' + ESC(fm.status || '') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.raf-agent-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var slug = el.dataset.rafSlug;
        selectedAgent = allAgents.find(function (a) { return a.slug === slug; }) || null;
        renderAgentList();
        renderDetail();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Detail State (empty / not-active / select prompt)
     ═══════════════════════════════════════════════════════════ */
  function renderDetailState() {
    var panel = $q('[data-raf-ref="detail-panel"]');
    if (!panel) return;

    if (!agentsHandle) {
      panel.innerHTML =
        '<div class="raf-not-active">' +
          '<div class="raf-state-icon"><i class="fa-solid fa-robot"></i></div>' +
          '<h2>Rovo Agent Forge Not Active</h2>' +
          '<p>No <code>rovo-agents/</code> directory found in the current project. ' +
          'Create one and add agent definitions to get started, then refresh.</p>' +
        '</div>';
      return;
    }

    if (allAgents.length === 0) {
      panel.innerHTML =
        '<div class="raf-not-active">' +
          '<div class="raf-state-icon"><i class="fa-solid fa-inbox"></i></div>' +
          '<h2>No Agents Found</h2>' +
          '<p>No agent definitions found in <code>rovo-agents/</code>. ' +
          'Each agent should be in its own subdirectory with an <code>agent.md</code> file.</p>' +
        '</div>';
      return;
    }

    if (!selectedAgent) {
      panel.innerHTML =
        '<div class="raf-not-active">' +
          '<div class="raf-state-icon"><i class="fa-solid fa-robot"></i></div>' +
          '<h2>Select an Agent</h2>' +
          '<p>Choose an agent from the sidebar to view its configuration and details.</p>' +
        '</div>';
      return;
    }

    renderDetail();
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Agent Detail
     ═══════════════════════════════════════════════════════════ */
  function renderDetail() {
    var panel = $q('[data-raf-ref="detail-panel"]');
    if (!panel || !selectedAgent) return;

    var fm = selectedAgent.frontmatter;
    var platform = String(fm.platform || 'unknown').toLowerCase();
    var pc = platformColor(platform);

    var metaRows = '';

    /* Platform */
    metaRows +=
      '<div class="meta-label">Platform</div>' +
      '<div class="meta-value"><span class="raf-platform-pill" style="background:' + pc + '">' + ESC(platform) + '</span></div>';

    /* Status */
    if (fm.status) {
      metaRows +=
        '<div class="meta-label">Status</div>' +
        '<div class="meta-value"><span class="status-pill" style="background:' + statusColor(fm.status) + '">' + ESC(fm.status) + '</span></div>';
    }

    /* Description */
    if (fm.description) {
      metaRows += '<div class="meta-label">Description</div><div class="meta-value">' + ESC(fm.description) + '</div>';
    }

    /* Skills */
    if (Array.isArray(fm.skills) && fm.skills.length > 0) {
      var skillChips = fm.skills.map(function (s) {
        return '<span class="raf-skill-chip">' + ESC(s) + '</span>';
      }).join('');
      metaRows += '<div class="meta-label">Skills</div><div class="meta-value"><div class="raf-chip-list">' + skillChips + '</div></div>';
    }

    /* Knowledge Sources */
    if (Array.isArray(fm.knowledge_sources) && fm.knowledge_sources.length > 0) {
      var knowledgeChips = fm.knowledge_sources.map(function (k) {
        return '<span class="raf-knowledge-chip">' + ESC(k) + '</span>';
      }).join('');
      metaRows += '<div class="meta-label">Knowledge</div><div class="meta-value"><div class="raf-chip-list">' + knowledgeChips + '</div></div>';
    }

    /* Conversation Starters */
    if (Array.isArray(fm.conversation_starters) && fm.conversation_starters.length > 0) {
      var startersHtml = '<ol class="raf-starters-list">' +
        fm.conversation_starters.map(function (s) {
          return '<li>' + ESC(s) + '</li>';
        }).join('') +
        '</ol>';
      metaRows += '<div class="meta-label">Starters</div><div class="meta-value">' + startersHtml + '</div>';
    }

    /* Owner */
    if (fm.owner) {
      metaRows += '<div class="meta-label">Owner</div><div class="meta-value">' + ESC(fm.owner) + '</div>';
    }

    /* Collaborators */
    if (fm.collaborators) {
      metaRows += '<div class="meta-label">Collaborators</div><div class="meta-value">' + ESC(fm.collaborators) + '</div>';
    }

    /* Visibility */
    if (fm.visibility) {
      metaRows += '<div class="meta-label">Visibility</div><div class="meta-value">' + ESC(fm.visibility) + '</div>';
    }

    /* Dates */
    if (fm.created) {
      metaRows += '<div class="meta-label">Created</div><div class="meta-value">' + ESC(fm.created) + '</div>';
    }
    if (fm.updated) {
      metaRows += '<div class="meta-label">Updated</div><div class="meta-value">' + ESC(fm.updated) + '</div>';
    }

    /* Folder path */
    metaRows += '<div class="meta-label">Folder</div><div class="meta-value"><code>' + ESC(selectedAgent.slug) + '/</code></div>';

    var renderedBody = ForgeUtils.MD.render(selectedAgent.body);

    panel.innerHTML =
      '<div class="raf-agent-detail">' +
        '<span class="type-badge" style="background:' + pc + '">' + ESC(platform) + '</span>' +
        '<div class="raf-title-header">' + ESC(fm.name || selectedAgent.slug) + '</div>' +
        '<div class="metadata-grid">' + metaRows + '</div>' +
        (renderedBody ? '<div class="rendered-body">' + renderedBody + '</div>' : '') +
        '<div class="raf-agent-actions">' +
          '<button class="primary" data-raf-detail-action="edit">Edit Agent</button>' +
        '</div>' +
      '</div>';

    /* Bind edit button */
    var editBtn = panel.querySelector('[data-raf-detail-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        if (selectedAgent) editModal.open(selectedAgent.slug);
      });
    }

    panel.scrollTop = 0;
  }

  /* ═══════════════════════════════════════════════════════════
     Edit Modal
     ═══════════════════════════════════════════════════════════ */
  var editModal = {
    currentSlug: null,
    originalAgent: null,
    showingDiff: false,

    open: function (slug) {
      var agent = allAgents.find(function (a) { return a.slug === slug; });
      if (!agent) return;
      this.currentSlug = slug;
      this.originalAgent = agent;
      this.showingDiff = false;

      var overlay = $q('[data-raf-ref="modal-overlay"]');
      var titleEl = $q('[data-raf-ref="modal-title"]');
      var bodyEl = $q('[data-raf-ref="modal-body"]');
      var diffBtn = $q('[data-raf-modal-action="toggle-diff"]');
      if (!overlay || !bodyEl) return;

      if (titleEl) titleEl.textContent = 'Edit: ' + (agent.frontmatter.name || slug);
      if (diffBtn) diffBtn.textContent = 'Preview Changes';

      var fm = agent.frontmatter;
      var html = '';

      /* Identity Section */
      html += '<div class="raf-form-section-title">Identity</div>';
      html += '<div class="form-grid">';
      html += this._field('name', 'Name', 'text', fm.name, { fullWidth: true });
      html += this._field('platform', 'Platform', 'select', fm.platform, { options: PLATFORM_OPTIONS });
      html += this._field('status', 'Status', 'select', fm.status, { options: STATUS_OPTIONS });
      html += this._field('description', 'Description', 'text', fm.description, { fullWidth: true });
      html += '</div>';

      /* Behavior & Scenarios Section */
      html += '<div class="raf-form-section-title">Behavior &amp; Scenarios</div>';
      html += '<div class="form-group full-width">' +
        '<label>Body (Markdown)</label>' +
        '<textarea data-raf-field-body style="min-height:200px;font-family:monospace;font-size:13px">' + ESC(agent.body) + '</textarea>' +
      '</div>';

      /* Skills Section */
      html += '<div class="raf-form-section-title">Skills</div>';
      html += '<div class="form-group full-width">' +
        '<label>Skills (one per line)</label>' +
        '<textarea data-raf-field="skills" style="min-height:80px;font-family:monospace;font-size:13px">' +
          ESC(Array.isArray(fm.skills) ? fm.skills.join('\n') : '') +
        '</textarea>' +
      '</div>';

      /* Knowledge Sources Section */
      html += '<div class="raf-form-section-title">Knowledge Sources</div>';
      html += '<div class="form-group full-width">' +
        '<label>Knowledge Sources (one per line)</label>' +
        '<textarea data-raf-field="knowledge_sources" style="min-height:80px;font-family:monospace;font-size:13px">' +
          ESC(Array.isArray(fm.knowledge_sources) ? fm.knowledge_sources.join('\n') : '') +
        '</textarea>' +
      '</div>';

      /* Conversation Starters Section */
      html += '<div class="raf-form-section-title">Conversation Starters</div>';
      html += '<div class="form-grid">';
      var starters = Array.isArray(fm.conversation_starters) ? fm.conversation_starters : [];
      html += this._field('starter_1', 'Starter 1', 'text', starters[0] || '', { fullWidth: true });
      html += this._field('starter_2', 'Starter 2', 'text', starters[1] || '', { fullWidth: true });
      html += this._field('starter_3', 'Starter 3', 'text', starters[2] || '', { fullWidth: true });
      html += '</div>';

      /* Governance Section */
      html += '<div class="raf-form-section-title">Governance</div>';
      html += '<div class="form-grid">';
      html += this._field('owner', 'Owner', 'text', fm.owner);
      html += this._field('visibility', 'Visibility', 'text', fm.visibility);
      html += this._field('collaborators', 'Collaborators', 'text', fm.collaborators, { fullWidth: true });
      html += '</div>';

      /* Hidden diff container */
      html += '<div data-raf-diff-container class="hidden"></div>';

      bodyEl.innerHTML = html;
      overlay.classList.add('raf-visible');
    },

    _field: function (key, label, type, value, opts) {
      opts = opts || {};
      var fullWidth = opts.fullWidth ? ' full-width' : '';
      var input = '';

      if (type === 'select') {
        var options = opts.options || [];
        input = '<select data-raf-field="' + key + '">' +
          '<option value="">&mdash; None &mdash;</option>' +
          options.map(function (o) {
            return '<option value="' + ESC(o) + '"' + (o === value ? ' selected' : '') + '>' + ESC(o) + '</option>';
          }).join('') +
        '</select>';
      } else {
        input = '<input type="text" data-raf-field="' + key + '" value="' + ESC(value || '') + '">';
      }

      return '<div class="form-group' + fullWidth + '"><label>' + ESC(label) + '</label>' + input + '</div>';
    },

    _getFormData: function () {
      var fm = {};
      var origFm = this.originalAgent.frontmatter;

      /* Copy over all original fields as base */
      var keys = Object.keys(origFm);
      for (var i = 0; i < keys.length; i++) {
        fm[keys[i]] = origFm[keys[i]];
      }

      /* Read simple fields */
      $qa('[data-raf-field]').forEach(function (el) {
        var key = el.dataset.rafField;
        if (key === 'skills' || key === 'knowledge_sources') {
          var lines = el.value.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l !== ''; });
          fm[key] = lines.length > 0 ? lines : [];
        } else if (key === 'starter_1' || key === 'starter_2' || key === 'starter_3') {
          /* Handled below as conversation_starters */
        } else {
          var val = el.value.trim();
          fm[key] = val === '' ? null : val;
        }
      });

      /* Assemble conversation starters */
      var s1El = $q('[data-raf-field="starter_1"]');
      var s2El = $q('[data-raf-field="starter_2"]');
      var s3El = $q('[data-raf-field="starter_3"]');
      var starters = [];
      if (s1El && s1El.value.trim()) starters.push(s1El.value.trim());
      if (s2El && s2El.value.trim()) starters.push(s2El.value.trim());
      if (s3El && s3El.value.trim()) starters.push(s3El.value.trim());
      fm.conversation_starters = starters.length > 0 ? starters : [];

      /* Remove temporary starter fields */
      delete fm.starter_1;
      delete fm.starter_2;
      delete fm.starter_3;

      fm.updated = ForgeUtils.todayISO();

      var bodyEl = $q('[data-raf-field-body]');
      var body = bodyEl ? bodyEl.value : '';

      return { frontmatter: fm, body: body };
    },

    toggleDiff: function () {
      var container = $q('[data-raf-diff-container]');
      if (!container) return;
      this.showingDiff = !this.showingDiff;
      var diffBtn = $q('[data-raf-modal-action="toggle-diff"]');
      if (diffBtn) diffBtn.textContent = this.showingDiff ? 'Hide Preview' : 'Preview Changes';

      if (!this.showingDiff) {
        container.classList.add('hidden');
        return;
      }

      var data = this._getFormData();
      var newFm = data.frontmatter;
      var newBody = data.body;
      var oldFm = this.originalAgent.frontmatter;
      var oldBody = this.originalAgent.body;
      var html = '';

      /* Frontmatter changes */
      var fieldChanges = [];
      var allKeys = Object.keys(oldFm);
      var newKeys = Object.keys(newFm);
      for (var ki = 0; ki < newKeys.length; ki++) {
        if (allKeys.indexOf(newKeys[ki]) === -1) allKeys.push(newKeys[ki]);
      }

      for (var fi = 0; fi < allKeys.length; fi++) {
        var key = allKeys[fi];
        if (key === 'updated') continue;
        var oldVal = JSON.stringify(oldFm[key] !== undefined ? oldFm[key] : null);
        var newVal = JSON.stringify(newFm[key] !== undefined ? newFm[key] : null);
        if (oldVal !== newVal) {
          fieldChanges.push({ key: key, old: oldFm[key], 'new': newFm[key] });
        }
      }

      if (fieldChanges.length > 0) {
        html += '<div class="raf-diff-container"><div class="diff-header">Frontmatter Changes</div><div class="diff-body">';
        for (var ci = 0; ci < fieldChanges.length; ci++) {
          var ch = fieldChanges[ci];
          var oldStr = ch.old === null || ch.old === undefined ? 'null' : Array.isArray(ch.old) ? ch.old.join(', ') : String(ch.old);
          var newStr = ch['new'] === null || ch['new'] === undefined ? 'null' : Array.isArray(ch['new']) ? ch['new'].join(', ') : String(ch['new']);
          html += '<div class="diff-field">' +
            '<span class="field-name">' + ESC(ch.key) + '</span>' +
            '<span class="old-val">' + ESC(oldStr) + '</span>' +
            '<span>&rarr;</span>' +
            '<span class="new-val">' + ESC(newStr) + '</span>' +
          '</div>';
        }
        html += '</div></div>';
      }

      /* Body changes */
      if (oldBody !== newBody) {
        var diff = ForgeUtils.Diff.compute(oldBody, newBody);
        var hasRealChanges = diff.some(function (d) { return d.type !== 'same'; });
        if (hasRealChanges) {
          html += '<div class="raf-diff-container" style="margin-top:12px"><div class="diff-header">Body Changes</div><div class="diff-body">';
          for (var di = 0; di < diff.length; di++) {
            var line = diff[di];
            var prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
            html += '<div class="diff-line ' + line.type + '">' + prefix + ' ' + ESC(line.text) + '</div>';
          }
          html += '</div></div>';
        }
      }

      if (!html) {
        html = '<div style="padding:16px;color:var(--text-muted);text-align:center">No changes detected</div>';
      }

      container.innerHTML = html;
      container.classList.remove('hidden');
    },

    save: async function () {
      if (!this.currentSlug || !this.originalAgent) return;
      var data = this._getFormData();
      var fm = data.frontmatter;

      /* Validation */
      if (!fm.name || String(fm.name).length < 10) {
        ForgeUtils.Toast.show('Agent name must be at least 10 characters', 'error');
        return;
      }
      if (!fm.platform) {
        ForgeUtils.Toast.show('Platform is required', 'error');
        return;
      }

      /* Serialize YAML frontmatter + body */
      var yamlStr = ForgeUtils.YAML.stringify(fm, FIELD_ORDER);
      var content = '---\n' + yamlStr + '\n---\n' + (data.body ? '\n' + data.body : '');

      try {
        await ForgeUtils.FS.writeFile(this.originalAgent.fileHandle, content);

        /* Update in-memory state */
        var parsed = ForgeUtils.parseFrontmatter(content);
        if (parsed) {
          this.originalAgent.frontmatter = parsed.frontmatter;
          this.originalAgent.body = parsed.body;
          this.originalAgent.lastModified = Date.now();
        }

        /* Re-render */
        renderAgentList();
        if (selectedAgent && selectedAgent.slug === this.currentSlug) {
          selectedAgent = this.originalAgent;
          renderDetail();
        }

        this.close();
        ForgeUtils.Toast.show('Agent saved successfully', 'success');
      } catch (e) {
        ForgeUtils.Toast.show('Save failed: ' + e.message, 'error');
      }
    },

    close: function () {
      var overlay = $q('[data-raf-ref="modal-overlay"]');
      if (overlay) overlay.classList.remove('raf-visible');
      this.currentSlug = null;
      this.originalAgent = null;
      this.showingDiff = false;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Auto-Refresh — 5-second polling
     ═══════════════════════════════════════════════════════════ */
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(async function () {
      if (!agentsHandle || refreshRunning) return;
      refreshRunning = true;
      try {
        var newAgents = await scanAgents();
        var newSig = newAgents.map(function (a) { return a.slug + ':' + a.lastModified; }).join('|');

        if (newSig !== prevSignature) {
          allAgents = newAgents;
          prevSignature = newSig;

          if (selectedAgent) {
            selectedAgent = allAgents.find(function (a) {
              return a.slug === selectedAgent.slug;
            }) || null;
          }

          renderAgentList();
          if (selectedAgent) {
            renderDetail();
          } else {
            renderDetailState();
          }

          var indicator = $q('[data-raf-ref="refresh-indicator"]');
          if (indicator) {
            indicator.textContent = 'Updated ' + new Date().toLocaleTimeString();
          }
        }
      } catch (e) {
        console.warn('Rovo Agent Forge auto-refresh error:', e);
      } finally {
        refreshRunning = false;
      }
    }, 5000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Loading — orchestrator for scan + render
     ═══════════════════════════════════════════════════════════ */
  async function loadAgents() {
    allAgents = await scanAgents();
    prevSignature = allAgents.map(function (a) { return a.slug + ':' + a.lastModified; }).join('|');
    renderAgentList();
    renderDetailState();
  }

  /* ═══════════════════════════════════════════════════════════
     Controller — Public API
     ═══════════════════════════════════════════════════════════ */
  async function init(handle) {
    rootHandle = handle;

    if (!initialized) {
      scaffold();
      initialized = true;
    }

    /* Reset state for fresh init */
    agentsHandle = null;
    allAgents = [];
    selectedAgent = null;
    activeFilter = 'all';
    prevSignature = '';

    /* Reset filter buttons */
    var bar = $q('.raf-filter-bar');
    if (bar) {
      bar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.rafFilter === 'all');
      });
    }

    /* Try to find rovo-agents/ directory */
    if (rootHandle) {
      agentsHandle = await ForgeUtils.FS.getSubDir(rootHandle, 'rovo-agents');
      if (agentsHandle) {
        var folderPath = $q('[data-raf-ref="folder-path"]');
        var folderName = $q('[data-raf-ref="folder-name"]');
        if (folderPath && folderName) {
          folderPath.classList.remove('hidden');
          // Handle both FileSystemDirectoryHandle (browser) and path string (Tauri)
          var dirName = typeof rootHandle === 'string'
            ? rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle
            : rootHandle.name;
          folderName.textContent = dirName + '/rovo-agents';
        }
        await loadAgents();
        startAutoRefresh();
        return;
      }
    }

    /* No rovo-agents/ directory — show not-active state */
    var folderPath = $q('[data-raf-ref="folder-path"]');
    if (folderPath) folderPath.classList.add('hidden');
    renderAgentList();
    renderDetailState();
  }

  function destroy() {
    stopAutoRefresh();
  }

  async function refresh() {
    if (!agentsHandle && rootHandle) {
      agentsHandle = await ForgeUtils.FS.getSubDir(rootHandle, 'rovo-agents');
    }
    if (agentsHandle) {
      await loadAgents();
      var indicator = $q('[data-raf-ref="refresh-indicator"]');
      if (indicator) {
        indicator.textContent = 'Refreshed ' + new Date().toLocaleTimeString();
      }
    } else {
      renderDetailState();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Expose & Register
     ═══════════════════════════════════════════════════════════ */
  var ctrl = { init: init, destroy: destroy, refresh: refresh };
  window.RovoAgentForgeView = ctrl;
  Shell.registerController('rovo-agent-forge', ctrl);

})();
