/* ═══════════════════════════════════════════════════════════════
   Slack Forge View Controller
   Sidebar + detail panel layout with Harvests / Transcripts views.
   Scans slack-forge/ via FS API. All colors via CSS custom properties.
   ═══════════════════════════════════════════════════════════════ */

window.SlackForgeView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ── State ── */
  let rootHandle = null;
  let initialized = false;
  let slackForgeActive = false;
  let harvests = [];
  let selectedHarvest = null;
  let transcripts = [];
  let selectedTranscript = null;
  let configData = null;
  let filterType = 'all';
  let filterStatus = 'all';
  let activeView = 'harvests';
  let filterPanelOpen = false;
  let searchQuery = '';

  /* ── DOM helpers ── */
  function view() { return document.getElementById('view-slack-forge'); }
  function $(sel) { return view().querySelector(sel); }
  function ref(name) { return $(`[data-sf-ref="${name}"]`); }

  /* ═══════════════════════════════════════════════════════════
     Color Helpers — CSS variables only (no hardcoded hex)
     ═══════════════════════════════════════════════════════════ */
  function harvestTypeColor(type) {
    if (!type) return 'var(--text-muted)';
    const t = type.toLowerCase();
    if (t === 'task') return 'var(--sf-type-task)';
    if (t === 'knowledge') return 'var(--sf-type-knowledge)';
    if (t === 'jira-digest') return 'var(--sf-type-jira)';
    return 'var(--text-muted)';
  }

  function statusColor(status) {
    if (!status) return 'var(--text-muted)';
    const s = status.toLowerCase();
    if (s === 'pending')  return 'var(--sf-status-pending)';
    if (s === 'approved') return 'var(--sf-status-approved)';
    if (s === 'promoted') return 'var(--sf-status-promoted)';
    if (s === 'rejected') return 'var(--sf-status-rejected)';
    return 'var(--text-muted)';
  }

  function confidenceColor(confidence) {
    if (!confidence) return 'var(--text-muted)';
    const c = confidence.toLowerCase();
    if (c === 'high')   return 'var(--sf-confidence-high)';
    if (c === 'medium') return 'var(--sf-confidence-medium)';
    if (c === 'low')    return 'var(--sf-confidence-low)';
    return 'var(--text-muted)';
  }

  /* ── Humanize transcript filename: strip date prefix, title-case ── */
  function transcriptLabel(filename) {
    const name = filename.replace(/\.md$/, '');
    // Strip leading YYYY-MM-DD- date prefix if present
    const stripped = name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    return stripped.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /* ═══════════════════════════════════════════════════════════
     Scaffold — builds initial DOM (once)
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    view().innerHTML = `
      <div class="sf-layout">

        <!-- Toolbar -->
        <div class="plugin-toolbar">
          <button class="btn-icon sf-toolbar-toggle" data-sf-action="toggle-sidebar" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="toolbar-title"><i class="fa-brands fa-slack"></i> Slack Forge</span>
          <div class="view-toggle">
            <button data-sf-view="harvests" class="active">Harvests</button>
            <button data-sf-view="transcripts">Transcripts</button>
          </div>
          <span class="spacer"></span>
          <span class="refresh-indicator" data-sf-ref="refresh-indicator"></span>
          <button class="btn-icon" data-sf-action="toggle-filter" title="Filters">
            <i class="fa-solid fa-sliders"></i>
          </button>
          <button class="btn-icon" data-sf-action="refresh" title="Refresh">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>

        <!-- Sidebar -->
        <div class="sf-sidebar">

          <!-- Harvests panel -->
          <div data-sf-panel="harvests-sidebar">
            <div class="sf-sidebar-header">
              <span class="sf-sidebar-header-label">Harvests</span>
              <div class="sf-status-badges" data-sf-ref="status-badges"></div>
            </div>
            <div class="sidebar-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" placeholder="Search harvests…" data-sf-ref="harvest-search">
            </div>
            <div class="filter-bar">
              <button class="filter-btn active" data-sf-filter-type="all">All</button>
              <button class="filter-btn" data-sf-filter-type="task">Tasks</button>
              <button class="filter-btn" data-sf-filter-type="knowledge">Knowledge</button>
              <button class="filter-btn" data-sf-filter-type="jira-digest">JIRA</button>
            </div>
            <div class="sf-harvest-list" data-sf-ref="harvest-list"></div>
            <div data-sf-ref="config-bar"></div>
          </div>

          <!-- Transcripts panel -->
          <div data-sf-panel="transcripts-sidebar" class="hidden">
            <div class="sf-sidebar-header">
              <span class="sf-sidebar-header-label">Transcripts</span>
            </div>
            <div class="sidebar-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" placeholder="Search transcripts…" data-sf-ref="transcript-search">
            </div>
            <div class="sf-transcript-list" data-sf-ref="transcript-list"></div>
          </div>

        </div>

        <!-- Detail Panel -->
        <div class="sf-detail-panel" data-sf-ref="detail-panel"></div>

        <!-- Filter Panel (slide-out from right) -->
        <div class="sf-filter-panel" data-sf-ref="filter-panel">
          <div class="sf-filter-panel-header">
            <span class="sf-filter-panel-title">Filters</span>
            <button class="btn-icon" data-sf-action="toggle-filter" title="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="sf-filter-section">
            <div class="sf-filter-section-label">Status</div>
            <div class="sf-filter-group">
              <button class="filter-btn active" data-sf-filter-status="all">All</button>
              <button class="filter-btn" data-sf-filter-status="pending">Pending</button>
              <button class="filter-btn" data-sf-filter-status="approved">Approved</button>
              <button class="filter-btn" data-sf-filter-status="rejected">Rejected</button>
              <button class="filter-btn" data-sf-filter-status="promoted">Promoted</button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Bind Events — single delegated listener on the view
     ═══════════════════════════════════════════════════════════ */
  function bindEvents() {
    view().addEventListener('input', (e) => {
      if (e.target.matches('[data-sf-ref="harvest-search"]')) {
        searchQuery = e.target.value.toLowerCase().trim();
        renderHarvestList();
      }
      if (e.target.matches('[data-sf-ref="transcript-search"]')) {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTranscriptList();
      }
    });

    view().addEventListener('click', (e) => {

      /* Toolbar actions */
      const action = e.target.closest('[data-sf-action]');
      if (action) {
        const act = action.dataset.sfAction;
        if (act === 'refresh') { refresh(); return; }
        if (act === 'toggle-filter') {
          filterPanelOpen = !filterPanelOpen;
          const panel = ref('filter-panel');
          if (panel) panel.classList.toggle('open', filterPanelOpen);
          return;
        }
        if (act === 'toggle-sidebar') {
          const layout = view().querySelector('.sf-layout');
          if (layout) layout.classList.toggle('sf-sidebar-open');
          return;
        }
      }

      /* View toggle (Harvests / Transcripts) */
      const viewBtn = e.target.closest('[data-sf-view]');
      if (viewBtn) {
        const newView = viewBtn.dataset.sfView;
        if (newView === activeView) return;
        activeView = newView;

        view().querySelectorAll('[data-sf-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfView === activeView);
        });

        const harvestsPanel   = $('[data-sf-panel="harvests-sidebar"]');
        const transcriptsPanel = $('[data-sf-panel="transcripts-sidebar"]');
        if (harvestsPanel)   harvestsPanel.classList.toggle('hidden', activeView !== 'harvests');
        if (transcriptsPanel) transcriptsPanel.classList.toggle('hidden', activeView !== 'transcripts');

        selectedHarvest = null;
        selectedTranscript = null;
        searchQuery = '';
        const harvestSearchEl   = ref('harvest-search');
        const transcriptSearchEl = ref('transcript-search');
        if (harvestSearchEl)   harvestSearchEl.value = '';
        if (transcriptSearchEl) transcriptSearchEl.value = '';
        renderDetailState();
        return;
      }

      /* Type filter */
      const typeBtn = e.target.closest('[data-sf-filter-type]');
      if (typeBtn) {
        filterType = typeBtn.dataset.sfFilterType;
        view().querySelectorAll('[data-sf-filter-type]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfFilterType === filterType);
        });
        renderStatusBadges();
        renderHarvestList();
        return;
      }

      /* Status filter */
      const statusBtn = e.target.closest('[data-sf-filter-status]');
      if (statusBtn) {
        filterStatus = statusBtn.dataset.sfFilterStatus;
        view().querySelectorAll('[data-sf-filter-status]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfFilterStatus === filterStatus);
        });
        renderHarvestList();
        return;
      }

      /* Harvest card click */
      const harvestCard = e.target.closest('.sidebar-card[data-sf-filename]');
      if (harvestCard) {
        const filename = harvestCard.dataset.sfFilename;
        const harvest = harvests.find(h => h.filename === filename);
        if (harvest) {
          selectedHarvest = harvest;
          renderHarvestList();
          renderHarvestDetail();
        }
        return;
      }

      /* Transcript card click */
      const transcriptCard = e.target.closest('.sidebar-card[data-sf-transcript]');
      if (transcriptCard) {
        const filename = transcriptCard.dataset.sfTranscript;
        const transcript = transcripts.find(t => t.filename === filename);
        if (transcript) {
          selectedTranscript = transcript;
          renderTranscriptList();
          renderTranscriptDetail();
        }
        return;
      }

    });
  }

  /* ═══════════════════════════════════════════════════════════
     Transcript Fallback Parser
     Handles markdown-heading format written without YAML frontmatter.
     ═══════════════════════════════════════════════════════════ */
  function parseTranscriptFallback(content, filename) {
    const lines = content.split('\n');
    const fm = {};

    // Title from first # heading
    const titleLine = lines.find(l => l.startsWith('# '));
    if (titleLine) fm.title = titleLine.replace(/^#\s+/, '').trim();

    // Metadata from **Key:** Value pairs in first 10 lines
    const header = lines.slice(0, 10).join('\n');
    const m = (pattern) => { const r = header.match(pattern); return r ? r[1].trim() : null; };
    const sd = m(/\*\*Scan Date:\*\*\s*(.+)/);
    const tf = m(/\*\*Timeframe:\*\*\s*(.+)/);
    const gn = m(/\*\*Generated:\*\*\s*(.+)/);

    if (sd) fm.scan_date = sd;
    if (tf) fm.timeframe = tf.replace(/^72\s+hours?.*/i, '72h')
                             .replace(/^24\s+hours?.*/i, '24h')
                             .replace(/^(1\s+week|7\s+days?).*/i, '1w');
    if (gn) fm.generated = gn;
    if (!fm.title) fm.title = transcriptLabel(filename);

    return { frontmatter: fm, body: content };
  }

  /* ═══════════════════════════════════════════════════════════
     Load Data
     ═══════════════════════════════════════════════════════════ */
  async function loadData() {
    harvests = [];
    transcripts = [];
    configData = null;
    slackForgeActive = false;

    if (!rootHandle) {
      renderDetailState();
      return;
    }

    /* 1. Read slack-forge/ root entries */
    let entries = [];
    try {
      entries = await ForgeFS.readDir(rootHandle, 'slack-forge');
      slackForgeActive = true;
    } catch (e) {
      console.warn('[SlackForge] slack-forge/ directory not found:', e);
      renderDetailState();
      return;
    }

    /* 2. Parse root-level .md files → harvests */
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
        console.warn('[SlackForge] Failed to parse harvest:', file.name, e);
      }
    }

    harvests.sort((a, b) => {
      const dA = String(a.frontmatter.scan_date || '');
      const dB = String(b.frontmatter.scan_date || '');
      return dB.localeCompare(dA);
    });

    /* 3. Parse transcripts/ subdirectory if present */
    const hasTxDir = entries.some(e => e.kind === 'directory' && e.name === 'transcripts');
    if (hasTxDir) {
      try {
        const txEntries = await ForgeFS.readDir(rootHandle, 'slack-forge/transcripts');
        const txMd = txEntries.filter(e => e.kind === 'file' && e.name.endsWith('.md'));
        for (const file of txMd) {
          try {
            const content = await ForgeFS.readFile(rootHandle, 'slack-forge/transcripts/' + file.name);
            let parsed = ForgeUtils.parseFrontmatter(content);
            const hasFrontmatter = parsed && Object.keys(parsed.frontmatter || {}).length > 0;
            if (!hasFrontmatter) {
              parsed = parseTranscriptFallback(content, file.name);
            }
            if (parsed) {
              transcripts.push({
                filename: file.name,
                frontmatter: parsed.frontmatter || {},
                body: parsed.body || ''
              });
            }
          } catch (e) {
            console.warn('[SlackForge] Failed to parse transcript:', file.name, e);
          }
        }
        transcripts.sort((a, b) => {
          const dA = String(a.frontmatter.scan_date || a.filename);
          const dB = String(b.frontmatter.scan_date || b.filename);
          return dB.localeCompare(dA);
        });
      } catch (e) {
        console.warn('[SlackForge] Failed to read transcripts/:', e);
      }
    }

    /* 4. Parse config.json */
    try {
      const raw = await ForgeFS.readFile(rootHandle, 'slack-forge/config.json');
      configData = JSON.parse(raw);
    } catch (e) {
      console.log('[SlackForge] No config.json:', e.message);
    }

    /* 5. Render everything */
    renderStatusBadges();
    renderHarvestList();
    renderTranscriptList();
    renderDetailState();
    renderConfigBar();
    updateRefreshIndicator();
  }

  /* ═══════════════════════════════════════════════════════════
     Render Status Badges
     ═══════════════════════════════════════════════════════════ */
  function renderStatusBadges() {
    const container = ref('status-badges');
    if (!container) return;

    /* Count filtered harvests by status */
    let source = harvests;
    if (filterType !== 'all') {
      source = source.filter(h => (h.frontmatter.harvest_type || '').toLowerCase() === filterType);
    }

    const counts = {};
    source.forEach(h => {
      const s = (h.frontmatter.status || '').toLowerCase();
      if (s) counts[s] = (counts[s] || 0) + 1;
    });

    const order = ['pending', 'approved', 'promoted', 'rejected'];
    container.innerHTML = order
      .filter(s => counts[s] > 0)
      .map(s => `<span class="sf-status-badge ${s}">${counts[s]}</span>`)
      .join('');
  }

  /* ═══════════════════════════════════════════════════════════
     Render Harvest List
     ═══════════════════════════════════════════════════════════ */
  function renderHarvestList() {
    const list = ref('harvest-list');
    if (!list) return;

    let filtered = harvests;
    if (filterType !== 'all') {
      filtered = filtered.filter(h => (h.frontmatter.harvest_type || '').toLowerCase() === filterType);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(h => (h.frontmatter.status || '').toLowerCase() === filterStatus);
    }
    if (searchQuery) {
      filtered = filtered.filter(h => {
        const title   = (h.frontmatter.title || '').toLowerCase();
        const channel = (h.frontmatter.source_channel || '').toLowerCase();
        const tags    = (Array.isArray(h.frontmatter.tags) ? h.frontmatter.tags.join(' ') : '').toLowerCase();
        return title.includes(searchQuery) || channel.includes(searchQuery) || tags.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="sf-empty-list">${
        harvests.length === 0
          ? 'No harvests found. Run <code>/slack-forge:scan</code>.'
          : 'No harvests match the current filters.'
      }</div>`;
      return;
    }

    list.innerHTML = filtered.map(h => {
      const fm = h.frontmatter;
      const title = fm.title || h.filename.replace(/\.md$/, '');
      const hType = fm.harvest_type || '';
      const status = fm.status || '';
      const scanDate = fm.scan_date ? String(fm.scan_date) : '';
      const isSelected = selectedHarvest && selectedHarvest.filename === h.filename;
      const typeColor = harvestTypeColor(hType);
      const stsColor  = statusColor(status);

      return `
        <div class="sidebar-card ${isSelected ? 'selected' : ''}" data-sf-filename="${esc(h.filename)}">
          <div class="sidebar-card-title">${esc(title)}</div>
          <div class="sidebar-card-meta">
            ${hType   ? `<span class="sidebar-card-pill" style="background: color-mix(in srgb, ${typeColor} 15%, transparent); color: ${typeColor};">${esc(hType)}</span>` : ''}
            ${status  ? `<span class="sidebar-card-pill" style="background: color-mix(in srgb, ${stsColor} 15%, transparent); color: ${stsColor};">${esc(status)}</span>` : ''}
            ${scanDate ? `<span>${esc(scanDate)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     Render Transcript List
     ═══════════════════════════════════════════════════════════ */
  function renderTranscriptList() {
    const list = ref('transcript-list');
    if (!list) return;

    let filtered = transcripts;
    if (searchQuery) {
      filtered = filtered.filter(t => {
        const label = (t.frontmatter.title || transcriptLabel(t.filename)).toLowerCase();
        return label.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="sf-empty-list">${
        transcripts.length === 0
          ? 'No transcripts found.'
          : 'No transcripts match the search.'
      }</div>`;
      return;
    }

    list.innerHTML = filtered.map(t => {
      const fm = t.frontmatter;
      const label = fm.title || transcriptLabel(t.filename);
      const timeframe = fm.timeframe || '';
      const scanDate  = fm.scan_date ? String(fm.scan_date) : '';
      const isSelected = selectedTranscript && selectedTranscript.filename === t.filename;

      return `
        <div class="sidebar-card ${isSelected ? 'selected' : ''}" data-sf-transcript="${esc(t.filename)}">
          <div class="sidebar-card-title">${esc(label)}</div>
          <div class="sidebar-card-meta">
            ${timeframe ? `<span class="sf-transcript-timeframe">${esc(timeframe)}</span>` : ''}
            ${scanDate  ? `<span>${esc(scanDate)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     Render Detail State (empty / not-active)
     ═══════════════════════════════════════════════════════════ */
  function renderDetailState() {
    /* If something is selected, delegate to the appropriate detail renderer */
    if (activeView === 'harvests' && selectedHarvest) {
      renderHarvestDetail();
      return;
    }
    if (activeView === 'transcripts' && selectedTranscript) {
      renderTranscriptDetail();
      return;
    }

    const panel = ref('detail-panel');
    if (!panel) return;

    /* Not active */
    if (!rootHandle || !slackForgeActive) {
      panel.innerHTML = `
        <div class="not-active-state">
          <div class="state-icon"><i class="fa-brands fa-slack"></i></div>
          <h2>Slack Forge Not Active</h2>
          <p>No <code>slack-forge/</code> directory found in your project.</p>
          <p>Run <code>/slack-forge:init</code> then <code>/slack-forge:scan</code> to get started.</p>
        </div>
      `;
      return;
    }

    /* Empty / no selection */
    if (activeView === 'harvests') {
      if (harvests.length === 0) {
        panel.innerHTML = `
          <div class="empty-state">
            <div class="icon"><i class="fa-brands fa-slack"></i></div>
            <h2>No Harvests Found</h2>
            <p>Run <code>/slack-forge:scan</code> to harvest messages from Slack channels.</p>
          </div>
        `;
      } else {
        panel.innerHTML = `
          <div class="empty-state">
            <div class="icon"><i class="fa-solid fa-arrow-left"></i></div>
            <h2>Select a Harvest</h2>
            <p>Choose a harvest from the sidebar to view its details.</p>
          </div>
        `;
      }
    } else {
      if (transcripts.length === 0) {
        panel.innerHTML = `
          <div class="empty-state">
            <div class="icon"><i class="fa-solid fa-scroll"></i></div>
            <h2>No Transcripts Found</h2>
            <p>Transcripts appear in <code>slack-forge/transcripts/</code> after a scan captures raw channel content.</p>
          </div>
        `;
      } else {
        panel.innerHTML = `
          <div class="empty-state">
            <div class="icon"><i class="fa-solid fa-arrow-left"></i></div>
            <h2>Select a Transcript</h2>
            <p>Choose a transcript from the sidebar to view its content.</p>
          </div>
        `;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Render Harvest Detail
     ═══════════════════════════════════════════════════════════ */
  function renderHarvestDetail() {
    const panel = ref('detail-panel');
    if (!panel || !selectedHarvest) return;

    const fm = selectedHarvest.frontmatter;
    const title      = fm.title || selectedHarvest.filename.replace(/\.md$/, '');
    const hType      = fm.harvest_type || '';
    const status     = fm.status || '';
    const channel    = fm.source_channel || fm.channel || '';
    const author     = fm.source_author  || fm.author  || '';
    const scanDate   = fm.scan_date ? String(fm.scan_date) : '';
    const timeframe  = fm.timeframe || '';
    const confidence = fm.confidence || '';
    const tags       = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);

    const typeColor = harvestTypeColor(hType);
    const stsColor  = statusColor(status);
    const confColor = confidenceColor(confidence);
    const rendered  = ForgeUtils.MD.render(selectedHarvest.body);

    const metaRows = [
      channel    ? `<span class="meta-label">Channel</span><span class="meta-value">${esc(channel)}</span>` : '',
      author     ? `<span class="meta-label">Author</span><span class="meta-value">${esc(author)}</span>` : '',
      scanDate   ? `<span class="meta-label">Scan Date</span><span class="meta-value">${esc(scanDate)}</span>` : '',
      timeframe  ? `<span class="meta-label">Timeframe</span><span class="meta-value">${esc(timeframe)}</span>` : '',
      confidence ? `<span class="meta-label">Confidence</span><span class="meta-value" style="color:${confColor};font-weight:600;">${esc(confidence)}</span>` : '',
      tags.length ? `<span class="meta-label">Tags</span><span class="meta-value">${tags.map(t => esc(t)).join(', ')}</span>` : ''
    ].filter(Boolean).map(row => `<div style="display:contents;">${row}</div>`).join('');

    panel.innerHTML = `
      <div class="sf-harvest-detail">
        <div class="sf-title-header">
          ${hType  ? `<span class="type-badge" style="background:${typeColor};">${esc(hType)}</span>` : ''}
          <h1>${esc(title)}</h1>
          ${status ? `<span class="status-pill" style="background:${stsColor};">${esc(status)}</span>` : ''}
        </div>
        ${metaRows ? `<div class="metadata-grid">${metaRows}</div>` : ''}
        <div class="rendered-body">${rendered}</div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Transcript Detail
     ═══════════════════════════════════════════════════════════ */
  function renderTranscriptDetail() {
    const panel = ref('detail-panel');
    if (!panel || !selectedTranscript) return;

    const fm        = selectedTranscript.frontmatter;
    const label     = fm.title || transcriptLabel(selectedTranscript.filename);
    const scanDate  = fm.scan_date  ? String(fm.scan_date) : '';
    const timeframe = fm.timeframe  || '';
    const scanRun   = fm.scan_run   ? String(fm.scan_run) : '';
    const generated = fm.generated  ? String(fm.generated) : '';
    const rendered  = ForgeUtils.MD.render(selectedTranscript.body);

    const metaRows = [
      scanDate  ? `<span class="meta-label">Scan Date</span><span class="meta-value">${esc(scanDate)}</span>`  : '',
      timeframe ? `<span class="meta-label">Timeframe</span><span class="meta-value">${esc(timeframe)}</span>` : '',
      scanRun   ? `<span class="meta-label">Scan Run</span><span class="meta-value">#${esc(scanRun)}</span>`   : '',
      generated ? `<span class="meta-label">Generated</span><span class="meta-value">${esc(generated)}</span>` : ''
    ].filter(Boolean).map(row => `<div style="display:contents;">${row}</div>`).join('');

    panel.innerHTML = `
      <div class="sf-transcript-detail">
        <div class="sf-transcript-title-header">
          <span class="type-badge" style="background: var(--text-muted);">Transcript</span>
          <h1>${esc(label)}</h1>
        </div>
        ${metaRows ? `<div class="metadata-grid">${metaRows}</div>` : ''}
        <div class="rendered-body">${rendered}</div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Config Bar (sidebar footer for Harvests panel)
     ═══════════════════════════════════════════════════════════ */
  function renderConfigBar() {
    const container = ref('config-bar');
    if (!container) return;

    if (!configData) {
      container.innerHTML = `
        <div class="sf-config-bar">
          <span class="sf-config-item">
            <i class="fa-solid fa-circle-info"></i>
            Not configured &mdash; run <code>/slack-forge:init</code>
          </span>
        </div>
      `;
      return;
    }

    const channels     = configData.channels;
    const channelCount = Array.isArray(channels) ? channels.length : 0;
    const jiraChannel  = configData.jira_channel || '';
    const updated      = configData.updated || '';

    container.innerHTML = `
      <div class="sf-config-bar">
        <div class="sf-config-item">
          <i class="fa-solid fa-hashtag"></i>
          <strong>${channelCount}</strong> channel${channelCount !== 1 ? 's' : ''} monitored
        </div>
        ${jiraChannel ? `
        <div class="sf-config-item">
          <i class="fa-solid fa-ticket"></i>
          JIRA: <strong>${esc(jiraChannel)}</strong>
        </div>` : ''}
        ${updated ? `
        <div class="sf-config-item">
          <i class="fa-regular fa-clock"></i>
          Updated: <strong>${esc(String(updated))}</strong>
        </div>` : ''}
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Update Refresh Indicator
     ═══════════════════════════════════════════════════════════ */
  function updateRefreshIndicator() {
    const indicator = ref('refresh-indicator');
    if (!indicator) return;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

      /* Reset view state on each init */
      harvests = [];
      transcripts = [];
      selectedHarvest = null;
      selectedTranscript = null;
      configData = null;
      filterType = 'all';
      filterStatus = 'all';
      activeView = 'harvests';
      filterPanelOpen = false;
      searchQuery = '';

      /* Reset filter button UI to "All" active */
      if (initialized) {
        view().querySelectorAll('[data-sf-filter-type]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfFilterType === 'all');
        });
        view().querySelectorAll('[data-sf-filter-status]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfFilterStatus === 'all');
        });
        view().querySelectorAll('[data-sf-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.sfView === 'harvests');
        });
        const harvestsPanel   = $('[data-sf-panel="harvests-sidebar"]');
        const transcriptsPanel = $('[data-sf-panel="transcripts-sidebar"]');
        if (harvestsPanel)   harvestsPanel.classList.remove('hidden');
        if (transcriptsPanel) transcriptsPanel.classList.add('hidden');
        ref('filter-panel')?.classList.remove('open');
        const hs = ref('harvest-search');
        const ts = ref('transcript-search');
        if (hs) hs.value = '';
        if (ts) ts.value = '';
      }

      loadData();
    },

    destroy() {
      harvests = [];
      transcripts = [];
      selectedHarvest = null;
      selectedTranscript = null;
      configData = null;
      filterType = 'all';
      filterStatus = 'all';
      activeView = 'harvests';
      filterPanelOpen = false;
      searchQuery = '';
      slackForgeActive = false;
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
