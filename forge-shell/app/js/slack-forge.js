/* ═══════════════════════════════════════════════════════════════
   Slack Forge View Controller
   Scans slack-forge/ directory via FS API, renders a harvest
   dashboard with status counts, filter dropdowns, and harvest cards
   inside #view-slack-forge.
   ═══════════════════════════════════════════════════════════════ */

window.SlackForgeView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ── State ── */
  let rootHandle = null;
  let initialized = false;
  let harvests = [];
  let configData = null;
  let filterType = 'all';
  let filterStatus = 'all';

  /* ── DOM scope helper ── */
  function $(sel) {
    return document.querySelector('#view-slack-forge ' + sel);
  }

  /* ═══════════════════════════════════════════════════════════
     Color Helpers
     ═══════════════════════════════════════════════════════════ */
  function harvestTypeColor(type) {
    if (!type) return 'var(--text-muted)';
    const t = type.toLowerCase();
    if (t === 'task') return '#3498db';
    if (t === 'knowledge') return '#9b59b6';
    if (t === 'jira-digest') return '#e67e22';
    return 'var(--text-muted)';
  }

  function statusColor(status) {
    if (!status) return 'var(--text-muted)';
    const s = status.toLowerCase();
    if (s === 'pending') return '#f39c12';
    if (s === 'approved') return '#27ae60';
    if (s === 'promoted') return '#3498db';
    if (s === 'rejected') return '#e74c3c';
    return 'var(--text-muted)';
  }

  function confidenceColor(confidence) {
    if (!confidence) return 'var(--text-muted)';
    const c = confidence.toLowerCase();
    if (c === 'high') return '#27ae60';
    if (c === 'medium') return '#f39c12';
    if (c === 'low') return '#e74c3c';
    return 'var(--text-muted)';
  }

  /* ═══════════════════════════════════════════════════════════
     Scaffold — builds the initial DOM inside the view
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    const view = document.getElementById('view-slack-forge');
    view.innerHTML = `
      <div class="sf-layout">
        <!-- Toolbar -->
        <div class="plugin-toolbar">
          <span class="toolbar-title"><i class="fa-brands fa-slack"></i> Slack Forge</span>
          <select class="sf-filter-select" data-ref="filter-type" title="Filter by harvest type">
            <option value="all">All Types</option>
            <option value="task">Tasks</option>
            <option value="knowledge">Knowledge</option>
            <option value="jira-digest">JIRA Digest</option>
          </select>
          <select class="sf-filter-select" data-ref="filter-status" title="Filter by status">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="promoted">Promoted</option>
          </select>
          <span class="spacer"></span>
          <span class="refresh-indicator" data-ref="refresh-indicator"></span>
          <button class="btn-icon" data-action="refresh" title="Refresh">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>

        <!-- Status Counts Bar -->
        <div class="sf-status-counts" data-ref="status-counts">
          <!-- Rendered by renderStatusCounts -->
        </div>

        <!-- Harvest Cards Area -->
        <div class="sf-harvest-grid" data-ref="harvest-grid">
          <!-- Rendered by renderHarvests -->
        </div>

        <!-- Config Summary -->
        <div class="sf-config-summary" data-ref="config-summary">
          <!-- Rendered by renderConfigSummary -->
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Bind Events
     ═══════════════════════════════════════════════════════════ */
  function bindEvents() {
    const refreshBtn = $('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refresh());
    }

    const typeSelect = $('[data-ref="filter-type"]');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        filterType = e.target.value;
        renderHarvests();
      });
    }

    const statusSelect = $('[data-ref="filter-status"]');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        filterStatus = e.target.value;
        renderHarvests();
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Load Data — reads slack-forge/ directory + config.json
     ═══════════════════════════════════════════════════════════ */
  async function loadData() {
    harvests = [];
    configData = null;

    if (!rootHandle) {
      render();
      return;
    }

    /* Read slack-forge/ directory entries */
    let entries = [];
    try {
      entries = await ForgeFS.readDir(rootHandle, 'slack-forge');
    } catch (e) {
      console.warn('[SlackForge] slack-forge/ directory not found:', e);
      render();
      return;
    }

    /* Parse each .md file */
    const mdFiles = entries.filter(e => e.kind === 'file' && e.name.endsWith('.md'));
    for (const file of mdFiles) {
      try {
        const content = await ForgeFS.readFile(rootHandle, 'slack-forge/' + file.name);
        const parsed = ForgeUtils.parseFrontmatter(content);
        if (parsed) {
          harvests.push({
            filename: file.name,
            frontmatter: parsed.frontmatter || {},
            body: parsed.body || ''
          });
        }
      } catch (e) {
        console.warn('[SlackForge] Failed to parse:', file.name, e);
      }
    }

    /* Sort by scan_date descending */
    harvests.sort((a, b) => {
      const dateA = a.frontmatter.scan_date || '';
      const dateB = b.frontmatter.scan_date || '';
      return String(dateB).localeCompare(String(dateA));
    });

    /* Try to read config.json */
    try {
      const configRaw = await ForgeFS.readFile(rootHandle, 'slack-forge/config.json');
      configData = JSON.parse(configRaw);
    } catch (e) {
      console.log('[SlackForge] No config.json found or parse error:', e.message);
    }

    render();
  }

  /* ═══════════════════════════════════════════════════════════
     Render — orchestrates all sub-renders
     ═══════════════════════════════════════════════════════════ */
  function render() {
    renderStatusCounts();
    renderHarvests();
    renderConfigSummary();
    updateRefreshIndicator();
  }

  /* ═══════════════════════════════════════════════════════════
     Render Status Counts
     ═══════════════════════════════════════════════════════════ */
  function renderStatusCounts() {
    const container = $('[data-ref="status-counts"]');
    if (!container) return;

    const counts = { pending: 0, approved: 0, promoted: 0, rejected: 0 };
    harvests.forEach(h => {
      const s = (h.frontmatter.status || '').toLowerCase();
      if (s in counts) counts[s]++;
    });

    container.innerHTML = `
      <div class="sf-count-box" style="border-left: 4px solid #f39c12;">
        <div class="sf-count-number" style="color: #f39c12;">${counts.pending}</div>
        <div class="sf-count-label">Pending</div>
      </div>
      <div class="sf-count-box" style="border-left: 4px solid #27ae60;">
        <div class="sf-count-number" style="color: #27ae60;">${counts.approved}</div>
        <div class="sf-count-label">Approved</div>
      </div>
      <div class="sf-count-box" style="border-left: 4px solid #3498db;">
        <div class="sf-count-number" style="color: #3498db;">${counts.promoted}</div>
        <div class="sf-count-label">Promoted</div>
      </div>
      <div class="sf-count-box" style="border-left: 4px solid #e74c3c;">
        <div class="sf-count-number" style="color: #e74c3c;">${counts.rejected}</div>
        <div class="sf-count-label">Rejected</div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Harvests — filtered card grid
     ═══════════════════════════════════════════════════════════ */
  function renderHarvests() {
    const grid = $('[data-ref="harvest-grid"]');
    if (!grid) return;

    /* Apply filters */
    let filtered = harvests;

    if (filterType !== 'all') {
      filtered = filtered.filter(h => {
        const t = (h.frontmatter.harvest_type || '').toLowerCase();
        return t === filterType;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(h => {
        const s = (h.frontmatter.status || '').toLowerCase();
        return s === filterStatus;
      });
    }

    if (filtered.length === 0) {
      if (harvests.length === 0) {
        grid.innerHTML = `
          <div class="sf-empty-state">
            <div class="sf-empty-icon"><i class="fa-brands fa-slack"></i></div>
            <h2>No Harvests Found</h2>
            <p>No <code>slack-forge/</code> data found in your project.</p>
            <p>Run <code>/slack-forge:scan</code> to harvest messages from Slack channels.</p>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="sf-empty-state">
            <div class="sf-empty-icon"><i class="fa-solid fa-filter"></i></div>
            <h2>No Matching Harvests</h2>
            <p>No harvests match the current filter criteria. Try adjusting the filters above.</p>
          </div>
        `;
      }
      return;
    }

    grid.innerHTML = filtered.map(h => createHarvestCard(h)).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     Create Harvest Card
     ═══════════════════════════════════════════════════════════ */
  function createHarvestCard(harvest) {
    const fm = harvest.frontmatter;
    const title = fm.title || 'Untitled Harvest';
    const harvestType = fm.harvest_type || '';
    const status = fm.status || '';
    const confidence = fm.confidence || '';
    const sourceChannel = fm.source_channel || '';
    const sourceAuthor = fm.source_author || '';
    const scanDate = fm.scan_date || '';

    /* Content preview — first ~100 chars of body */
    let preview = harvest.body || '';
    if (preview.length > 100) {
      preview = preview.substring(0, 100) + '...';
    }

    const typeClr = harvestTypeColor(harvestType);
    const statusClr = statusColor(status);
    const confClr = confidenceColor(confidence);

    return `
      <div class="sf-harvest-card" style="border-top: 3px solid ${statusClr};">
        <div class="sf-card-header">
          <div class="sf-card-title">${esc(title)}</div>
          <div class="sf-card-badges">
            ${harvestType ? `<span class="sf-badge" style="background: ${typeClr}; color: #fff;">${esc(harvestType)}</span>` : ''}
            ${status ? `<span class="sf-badge" style="background: ${statusClr}; color: #fff;">${esc(status)}</span>` : ''}
          </div>
        </div>
        ${confidence ? `
          <div class="sf-card-confidence">
            <span class="sf-confidence-pill" style="color: ${confClr}; border-color: ${confClr};">
              <i class="fa-solid fa-signal"></i> ${esc(confidence)}
            </span>
          </div>
        ` : ''}
        <div class="sf-card-meta">
          ${sourceChannel ? `<span><i class="fa-solid fa-hashtag"></i> ${esc(sourceChannel)}</span>` : ''}
          ${sourceAuthor ? `<span><i class="fa-regular fa-user"></i> ${esc(sourceAuthor)}</span>` : ''}
          ${scanDate ? `<span><i class="fa-regular fa-calendar"></i> ${esc(String(scanDate))}</span>` : ''}
        </div>
        ${preview ? `<div class="sf-card-preview">${esc(preview)}</div>` : ''}
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Config Summary
     ═══════════════════════════════════════════════════════════ */
  function renderConfigSummary() {
    const container = $('[data-ref="config-summary"]');
    if (!container) return;

    if (configData) {
      const channels = configData.channels;
      const channelCount = Array.isArray(channels) ? channels.length : 0;
      const updated = configData.updated || 'Unknown';
      const jiraChannel = configData.jira_channel || 'Not configured';

      container.innerHTML = `
        <div class="sf-config-bar">
          <span class="sf-config-item">
            <i class="fa-solid fa-hashtag"></i>
            <strong>${channelCount}</strong> channel${channelCount !== 1 ? 's' : ''} monitored
          </span>
          <span class="sf-config-item">
            <i class="fa-regular fa-clock"></i>
            Last updated: <strong>${esc(String(updated))}</strong>
          </span>
          <span class="sf-config-item">
            <i class="fa-solid fa-ticket"></i>
            JIRA channel: <strong>${esc(jiraChannel)}</strong>
          </span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="sf-config-bar sf-config-empty">
          <i class="fa-solid fa-circle-info"></i>
          <span>Not configured &mdash; run <code>/slack-forge:init</code> to set up Slack Forge</span>
        </div>
      `;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Update Refresh Indicator
     ═══════════════════════════════════════════════════════════ */
  function updateRefreshIndicator() {
    const indicator = $('[data-ref="refresh-indicator"]');
    if (!indicator) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    indicator.textContent = `Updated ${timeStr}`;
  }

  /* ═══════════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════════ */
  return {
    init(handle) {
      rootHandle = handle;

      if (!initialized) {
        scaffold();
        bindEvents();
        initialized = true;
      }

      loadData();
    },

    destroy() {
      harvests = [];
      configData = null;
      filterType = 'all';
      filterStatus = 'all';
      initialized = false;
    },

    refresh() {
      if (initialized) {
        loadData();
      }
    }
  };
})();

Shell.registerController('slack-forge', window.SlackForgeView);
