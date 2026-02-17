/* ═══════════════════════════════════════════════════════════════
   Cognitive Forge View Controller
   Scans sessions/debates/ and sessions/explorations/ via FS API,
   renders a sidebar + detail panel inside #view-cognitive-forge.
   ═══════════════════════════════════════════════════════════════ */

window.CognitiveForgeView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ── State ── */
  let rootHandle = null;
  let sessionsHandle = null;
  let allSessions = [];
  let activeFilter = 'all';
  let selectedSession = null;
  let refreshTimer = null;
  let initialized = false;

  /* ── DOM scope helper ── */
  function $(sel) {
    return document.querySelector('#view-cognitive-forge ' + sel);
  }

  /* ═══════════════════════════════════════════════════════════
     Color Helpers
     ═══════════════════════════════════════════════════════════ */
  function typeColor(type) {
    if (type === 'debate') return 'var(--type-debate)';
    if (type === 'explore') return 'var(--type-explore)';
    return 'var(--text-muted)';
  }

  function categoryColor(cat) {
    if (!cat) return 'var(--text-muted)';
    const map = {
      business: 'var(--cat-business)',
      philosophical: 'var(--cat-philosophical)',
      framework: 'var(--cat-framework)',
      creative: 'var(--cat-creative)'
    };
    return map[cat.toLowerCase()] || 'var(--text-muted)';
  }

  function agentColor(name) {
    const map = {
      challenger: '#e74c3c',
      explorer: '#27ae60',
      synthesizer: '#3498db',
      decomposer: '#f59e0b',
      evaluator: '#8b5cf6'
    };
    return map[name] || '#6c6c80';
  }

  function statusColor(status) {
    if (!status) return 'var(--text-muted)';
    if (status === 'complete') return 'var(--status-complete)';
    if (status === 'partial') return 'var(--status-partial)';
    return 'var(--text-muted)';
  }

  /* ═══════════════════════════════════════════════════════════
     Scaffolding — builds the initial DOM inside the view
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    const view = document.getElementById('view-cognitive-forge');
    view.innerHTML = `
      <div class="cf-layout">
        <!-- Toolbar -->
        <div class="plugin-toolbar" style="grid-column: 1 / -1;">
          <button class="btn-icon cf-toolbar-toggle" data-action="toggle-sidebar" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="toolbar-title"><i class="fa-solid fa-scale-balanced"></i> Cognitive Forge</span>
          <div class="folder-path hidden" data-ref="folder-path">
            <i class="fa-solid fa-folder-open"></i>
            <span data-ref="folder-name"></span>
          </div>
          <span class="spacer"></span>
          <span class="refresh-indicator" data-ref="refresh-indicator"></span>
          <button class="btn-icon" data-action="refresh" title="Refresh">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>

        <!-- Sidebar -->
        <div class="cf-sidebar">
          <div class="cf-filter-bar">
            <div class="filter-btn active" data-filter="all">All</div>
            <div class="filter-btn" data-filter="debate">Debates</div>
            <div class="filter-btn" data-filter="explore">Explorations</div>
          </div>
          <div class="cf-session-list" data-ref="session-list"></div>
        </div>

        <!-- Detail Panel -->
        <div class="cf-detail-panel" data-ref="detail-panel">
          <!-- States rendered dynamically -->
        </div>
      </div>
    `;

    bindToolbar();
    bindFilters();
  }

  /* ═══════════════════════════════════════════════════════════
     Event Binding
     ═══════════════════════════════════════════════════════════ */
  function bindToolbar() {
    const view = document.getElementById('view-cognitive-forge');
    view.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'refresh') refresh();
      if (action === 'toggle-sidebar') {
        view.querySelector('.cf-layout').classList.toggle('cf-sidebar-open');
      }
    });
  }

  function bindFilters() {
    const bar = document.querySelector('#view-cognitive-forge .cf-filter-bar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderSessionList();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Scanning — read sessions from FS
     ═══════════════════════════════════════════════════════════ */
  async function findSessionsHandle() {
    if (!rootHandle) return null;
    const cfDir = await ForgeUtils.FS.getSubDir(rootHandle, 'sessions');
    return cfDir;
  }

  // Scans the debates/ and explorations/ subdirectories under sessions/,
  // inferring the session type from the directory name rather than from
  // an index.json entry.
  async function scanSessions() {
    if (!sessionsHandle) return [];

    const sessions = [];
    const dirs = [
      { name: 'debates', type: 'debate' },
      { name: 'explorations', type: 'explore' }
    ];

    for (const dir of dirs) {
      const subDir = await ForgeUtils.FS.getSubDir(sessionsHandle, dir.name);
      if (!subDir) continue;

      const files = await ForgeUtils.FS.readAllMd(subDir);
      for (const f of files) {
        const parsed = ForgeUtils.parseFrontmatter(f.text);
        if (!parsed) continue;
        if (!parsed.frontmatter.type) parsed.frontmatter.type = dir.type;
        sessions.push({
          filename: f.name,
          frontmatter: parsed.frontmatter,
          body: parsed.body,
          lastModified: f.lastModified
        });
      }
    }

    sessions.sort(function (a, b) {
      var da = a.frontmatter.created || '';
      var db = b.frontmatter.created || '';
      return db.localeCompare(da);
    });

    return sessions;
  }

  /* ═══════════════════════════════════════════════════════════
     Loading — orchestrator for scan + render
     ═══════════════════════════════════════════════════════════ */
  async function loadSessions() {
    allSessions = await scanSessions();
    renderSessionList();
    renderDetailState();
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Session List
     ═══════════════════════════════════════════════════════════ */
  function renderSessionList() {
    var listEl = $('[data-ref="session-list"]');
    if (!listEl) return;

    var filtered = activeFilter === 'all'
      ? allSessions
      : allSessions.filter(function (s) { return s.frontmatter.type === activeFilter; });

    if (allSessions.length === 0) {
      listEl.innerHTML = '<div class="cf-empty-list">No sessions yet</div>';
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="cf-empty-list">No ' + esc(activeFilter) + ' sessions</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (s) {
      var fm = s.frontmatter;
      var tc = typeColor(fm.type);
      var cc = categoryColor(fm.category);
      var sel = selectedSession && selectedSession.filename === s.filename;
      return '<div class="cf-session-item' + (sel ? ' selected' : '') + '" data-filename="' + esc(s.filename) + '">' +
        '<div class="cf-session-type-bar" style="background:' + tc + '"></div>' +
        '<div class="cf-session-item-content">' +
          '<div class="cf-session-item-title">' + esc(fm.title || s.filename) + '</div>' +
          '<div class="cf-session-item-meta">' +
            '<span class="cf-session-category-pill" style="background:' + cc + '">' + esc(fm.category || 'Unknown') + '</span>' +
            '<span>' + esc(fm.created || '') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.cf-session-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var fn = el.dataset.filename;
        selectedSession = allSessions.find(function (s) { return s.filename === fn; }) || null;
        renderSessionList();
        renderDetail();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Detail State (empty / not-active / select prompt)
     ═══════════════════════════════════════════════════════════ */
  function renderDetailState() {
    var panel = $('[data-ref="detail-panel"]');
    if (!panel) return;

    if (!sessionsHandle) {
      // Not active state
      panel.innerHTML =
        '<div class="not-active-state">' +
          '<div class="state-icon"><i class="fa-solid fa-puzzle-piece"></i></div>' +
          '<h2>Cognitive Forge Not Active</h2>' +
          '<p>No <code>sessions/</code> directory found in the current project. ' +
          'Run <code>/cognitive-forge:debate</code> or <code>/cognitive-forge:explore</code> to generate your first session, then refresh.</p>' +
        '</div>';
      return;
    }

    if (allSessions.length === 0) {
      panel.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon"><i class="fa-solid fa-inbox"></i></div>' +
          '<h2>No Sessions Found</h2>' +
          '<p>Run <code>/cognitive-forge:debate</code> or <code>/cognitive-forge:explore</code> to generate your first session, then refresh.</p>' +
        '</div>';
      return;
    }

    if (!selectedSession) {
      panel.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon"><i class="fa-solid fa-brain"></i></div>' +
          '<h2>Select a Session</h2>' +
          '<p>Choose a debate or exploration from the sidebar to view its details.</p>' +
        '</div>';
      return;
    }

    renderDetail();
  }

  /* ═══════════════════════════════════════════════════════════
     Render — Session Detail
     ═══════════════════════════════════════════════════════════ */
  function renderDetail() {
    var panel = $('[data-ref="detail-panel"]');
    if (!panel || !selectedSession) return;

    var fm = selectedSession.frontmatter;
    var tc = typeColor(fm.type);
    var typeLabel = fm.type === 'debate' ? 'Debate' : 'Exploration';

    var metaRows = '';

    // Category
    if (fm.category) {
      metaRows +=
        '<div class="meta-label">Category</div>' +
        '<div class="meta-value"><span class="cf-session-category-pill" style="background:' + categoryColor(fm.category) + '">' + esc(fm.category) + '</span></div>';
    }

    // Date
    if (fm.created) {
      metaRows += '<div class="meta-label">Date</div><div class="meta-value">' + esc(fm.created) + '</div>';
    }

    // Status
    if (fm.status) {
      metaRows +=
        '<div class="meta-label">Status</div>' +
        '<div class="meta-value"><span class="status-pill" style="background:' + statusColor(fm.status) + '">' + esc(fm.status) + '</span></div>';
    }

    // Concept
    if (fm.concept) {
      metaRows += '<div class="meta-label">Concept</div><div class="meta-value">' + esc(fm.concept) + '</div>';
    }

    // Debate-specific
    if (fm.type === 'debate') {
      if (fm.agents && fm.agents.length) {
        var agentChips = fm.agents.map(function (a) {
          return '<span class="agent-chip" style="background:' + agentColor(a) + '">' + esc(a) + '</span>';
        }).join('');
        metaRows += '<div class="meta-label">Agents</div><div class="meta-value"><div class="agent-chips">' + agentChips + '</div></div>';
      }
      if (fm.cross_examination !== undefined) {
        metaRows += '<div class="meta-label">Cross-Exam</div><div class="meta-value">' + (fm.cross_examination ? 'Yes' : 'No') + '</div>';
      }
    }

    // Explore-specific
    if (fm.type === 'explore') {
      if (fm.relationship) {
        metaRows += '<div class="meta-label">Relationship</div><div class="meta-value">' + esc(fm.relationship) + '</div>';
      }
      if (fm.agents_recruited && fm.agents_recruited.length) {
        var recruitedChips = fm.agents_recruited.map(function (a) {
          return '<span class="agent-chip" style="background:' + agentColor(a) + '">' + esc(a) + '</span>';
        }).join('');
        metaRows += '<div class="meta-label">Recruited</div><div class="meta-value"><div class="agent-chips">' + recruitedChips + '</div></div>';
      }
      if (fm.techniques_applied && fm.techniques_applied.length) {
        var techChips = fm.techniques_applied.map(function (t) {
          return '<span class="technique-chip">' + esc(t) + '</span>';
        }).join(' ');
        metaRows += '<div class="meta-label">Techniques</div><div class="meta-value">' + techChips + '</div>';
      }
    }

    var renderedBody = ForgeUtils.MD.render(selectedSession.body);

    panel.innerHTML =
      '<div class="cf-session-detail">' +
        '<div class="type-badge" style="background:' + tc + '">' + esc(typeLabel) + '</div>' +
        '<div class="cf-title-header">' + esc(fm.title || selectedSession.filename) + '</div>' +
        '<div class="metadata-grid">' + metaRows + '</div>' +
        '<div class="rendered-body">' + renderedBody + '</div>' +
      '</div>';

    panel.scrollTop = 0;
  }

  /* ═══════════════════════════════════════════════════════════
     Auto-Refresh — 5-second polling
     ═══════════════════════════════════════════════════════════ */
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(async function () {
      if (!sessionsHandle) return;
      try {
        var newSessions = await scanSessions();
        var newSig = newSessions.map(function (s) { return s.filename + ':' + s.lastModified; }).join('|');
        var oldSig = allSessions.map(function (s) { return s.filename + ':' + s.lastModified; }).join('|');

        if (newSig !== oldSig) {
          allSessions = newSessions;
          if (selectedSession) {
            selectedSession = allSessions.find(function (s) {
              return s.filename === selectedSession.filename;
            }) || null;
          }
          renderSessionList();
          if (selectedSession) {
            renderDetail();
          } else {
            renderDetailState();
          }
          var indicator = $('[data-ref="refresh-indicator"]');
          if (indicator) {
            indicator.textContent = 'Updated ' + new Date().toLocaleTimeString();
          }
        }
      } catch (e) {
        console.warn('Cognitive Forge auto-refresh error:', e);
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
     Public API
     ═══════════════════════════════════════════════════════════ */
  async function init(handle) {
    rootHandle = handle;

    if (!initialized) {
      scaffold();
      initialized = true;
    }

    // Reset state for fresh init
    sessionsHandle = null;
    allSessions = [];
    selectedSession = null;
    activeFilter = 'all';

    // Reset filter buttons
    var bar = document.querySelector('#view-cognitive-forge .cf-filter-bar');
    if (bar) {
      bar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.filter === 'all');
      });
    }

    // Try to find sessions/ directory
    if (rootHandle) {
      sessionsHandle = await findSessionsHandle();
      if (sessionsHandle) {
        var folderPath = $('[data-ref="folder-path"]');
        var folderName = $('[data-ref="folder-name"]');
        if (folderPath && folderName) {
          folderPath.classList.remove('hidden');
          // Handle both FileSystemDirectoryHandle (browser) and path string (Tauri)
          var dirName = typeof rootHandle === 'string'
            ? rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle
            : rootHandle.name;
          folderName.textContent = dirName + '/sessions';
        }
        await loadSessions();
        startAutoRefresh();
        return;
      }
    }

    // No sessions/ directory — show not-active state
    var folderPath = $('[data-ref="folder-path"]');
    if (folderPath) folderPath.classList.add('hidden');
    renderSessionList();
    renderDetailState();
  }

  function destroy() {
    stopAutoRefresh();
  }

  async function refresh() {
    if (!sessionsHandle && rootHandle) {
      // Re-check in case sessions/ was just created
      sessionsHandle = await findSessionsHandle();
    }
    if (sessionsHandle) {
      await loadSessions();
      var indicator = $('[data-ref="refresh-indicator"]');
      if (indicator) {
        indicator.textContent = 'Refreshed ' + new Date().toLocaleTimeString();
      }
    } else {
      renderDetailState();
    }
  }

  return {
    init: init,
    destroy: destroy,
    refresh: refresh
  };
})();

Shell.registerController('cognitive-forge', window.CognitiveForgeView);
