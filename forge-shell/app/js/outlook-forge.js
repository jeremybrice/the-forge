/* ═══════════════════════════════════════════════════════════════
   Outlook Forge View Controller
   Sidebar + detail panel layout with Harvests / Transcripts views.
   Scans outlook-forge/ via FS API. All colors via CSS custom properties.
   ═══════════════════════════════════════════════════════════════ */

window.OutlookForgeView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ── State ── */
  let rootHandle = null;
  let initialized = false;
  let outlookForgeActive = false;
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
  function view() { return document.getElementById('view-outlook-forge'); }
  function $(sel) { return view().querySelector(sel); }
  function ref(name) { return $(`[data-of-ref="${name}"]`); }

  /* ═══════════════════════════════════════════════════════════
     Color Helpers — CSS variables only (no hardcoded hex)
     ═══════════════════════════════════════════════════════════ */
  function harvestTypeColor(type) {
    if (!type) return 'var(--text-muted)';
    const t = type.toLowerCase();
    if (t === 'task') return 'var(--of-type-task)';
    if (t === 'knowledge') return 'var(--of-type-knowledge)';
    if (t === 'meeting-prep') return 'var(--of-type-meeting-prep)';
    if (t === 'meeting-notes') return 'var(--of-type-meeting-notes)';
    return 'var(--text-muted)';
  }

  function statusColor(status) {
    if (!status) return 'var(--text-muted)';
    const s = status.toLowerCase();
    if (s === 'pending')  return 'var(--of-status-pending)';
    if (s === 'approved') return 'var(--of-status-approved)';
    if (s === 'promoted') return 'var(--of-status-promoted)';
    if (s === 'rejected') return 'var(--of-status-rejected)';
    return 'var(--text-muted)';
  }

  function confidenceColor(confidence) {
    if (!confidence) return 'var(--text-muted)';
    const c = confidence.toLowerCase();
    if (c === 'high')   return 'var(--of-confidence-high)';
    if (c === 'medium') return 'var(--of-confidence-medium)';
    if (c === 'low')    return 'var(--of-confidence-low)';
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
      <div class="of-layout">

        <!-- Toolbar -->
        <div class="plugin-toolbar">
          <button class="btn-icon of-toolbar-toggle" data-of-action="toggle-sidebar" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="toolbar-title"><i class="fa-solid fa-envelope"></i> Outlook Forge</span>
          <div class="view-toggle">
            <button data-of-view="harvests" class="active">Harvests</button>
            <button data-of-view="transcripts">Transcripts</button>
          </div>
          <span class="spacer"></span>
          <span class="refresh-indicator" data-of-ref="refresh-indicator"></span>
          <button class="btn-icon" data-of-action="toggle-filter" title="Filters">
            <i class="fa-solid fa-sliders"></i>
          </button>
          <button class="btn-icon" data-of-action="refresh" title="Refresh">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>

        <!-- Sidebar -->
        <div class="of-sidebar">

          <!-- Harvests panel -->
          <div data-of-panel="harvests-sidebar">
            <div class="of-sidebar-header">
              <span class="of-sidebar-header-label">Harvests</span>
              <div class="of-status-badges" data-of-ref="status-badges"></div>
            </div>
            <div class="sidebar-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" placeholder="Search harvests…" data-of-ref="harvest-search">
            </div>
            <div class="filter-bar">
              <button class="filter-btn active" data-of-filter-type="all">All</button>
              <button class="filter-btn" data-of-filter-type="task">Tasks</button>
              <button class="filter-btn" data-of-filter-type="knowledge">Knowledge</button>
              <button class="filter-btn" data-of-filter-type="meeting-prep">Prep</button>
              <button class="filter-btn" data-of-filter-type="meeting-notes">Notes</button>
            </div>
            <div class="of-harvest-list" data-of-ref="harvest-list"></div>
            <div data-of-ref="config-bar"></div>
          </div>

          <!-- Transcripts panel -->
          <div data-of-panel="transcripts-sidebar" class="hidden">
            <div class="of-sidebar-header">
              <span class="of-sidebar-header-label">Transcripts</span>
            </div>
            <div class="sidebar-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" placeholder="Search transcripts…" data-of-ref="transcript-search">
            </div>
            <div class="of-transcript-list" data-of-ref="transcript-list"></div>
          </div>

        </div>

        <!-- Detail Panel -->
        <div class="of-detail-panel" data-of-ref="detail-panel"></div>

        <!-- Filter Panel (slide-out from right) -->
        <div class="of-filter-panel" data-of-ref="filter-panel">
          <div class="of-filter-panel-header">
            <span class="of-filter-panel-title">Filters</span>
            <button class="btn-icon" data-of-action="toggle-filter" title="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="of-filter-section">
            <div class="of-filter-section-label">Status</div>
            <div class="of-filter-group">
              <button class="filter-btn active" data-of-filter-status="all">All</button>
              <button class="filter-btn" data-of-filter-status="pending">Pending</button>
              <button class="filter-btn" data-of-filter-status="approved">Approved</button>
              <button class="filter-btn" data-of-filter-status="rejected">Rejected</button>
              <button class="filter-btn" data-of-filter-status="promoted">Promoted</button>
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
      if (e.target.matches('[data-of-ref="harvest-search"]')) {
        searchQuery = e.target.value.toLowerCase().trim();
        renderHarvestList();
      }
      if (e.target.matches('[data-of-ref="transcript-search"]')) {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTranscriptList();
      }
    });

    view().addEventListener('click', (e) => {

      /* Toolbar actions */
      const action = e.target.closest('[data-of-action]');
      if (action) {
        const act = action.dataset.ofAction;
        if (act === 'refresh') { loadData(); return; }
        if (act === 'toggle-filter') {
          filterPanelOpen = !filterPanelOpen;
          const panel = ref('filter-panel');
          if (panel) panel.classList.toggle('open', filterPanelOpen);
          return;
        }
        if (act === 'toggle-sidebar') {
          const layout = view().querySelector('.of-layout');
          if (layout) layout.classList.toggle('of-sidebar-open');
          return;
        }
      }

      /* View toggle (Harvests / Transcripts) */
      const viewBtn = e.target.closest('[data-of-view]');
      if (viewBtn) {
        const newView = viewBtn.dataset.ofView;
        if (newView === activeView) return;
        activeView = newView;

        view().querySelectorAll('[data-of-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofView === activeView);
        });

        const harvestsPanel   = $('[data-of-panel="harvests-sidebar"]');
        const transcriptsPanel = $('[data-of-panel="transcripts-sidebar"]');
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
      const typeBtn = e.target.closest('[data-of-filter-type]');
      if (typeBtn) {
        filterType = typeBtn.dataset.ofFilterType;
        view().querySelectorAll('[data-of-filter-type]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofFilterType === filterType);
        });
        renderStatusBadges();
        renderHarvestList();
        return;
      }

      /* Status filter */
      const statusBtn = e.target.closest('[data-of-filter-status]');
      if (statusBtn) {
        filterStatus = statusBtn.dataset.ofFilterStatus;
        view().querySelectorAll('[data-of-filter-status]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofFilterStatus === filterStatus);
        });
        renderHarvestList();
        return;
      }

      /* Harvest card click */
      const harvestCard = e.target.closest('.sidebar-card[data-of-filename]');
      if (harvestCard) {
        const filename = harvestCard.dataset.ofFilename;
        const harvest = harvests.find(h => h.filename === filename);
        if (harvest) {
          selectedHarvest = harvest;
          renderHarvestList();
          renderHarvestDetail();
        }
        return;
      }

      /* Transcript card click */
      const transcriptCard = e.target.closest('.sidebar-card[data-of-transcript]');
      if (transcriptCard) {
        const filename = transcriptCard.dataset.ofTranscript;
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
    outlookForgeActive = false;

    if (!rootHandle) {
      renderDetailState();
      return;
    }

    /* 1. Read outlook-forge/ root entries */
    let entries = [];
    try {
      entries = await ForgeFS.readDir(rootHandle, 'outlook-forge');
      outlookForgeActive = true;
    } catch (e) {
      console.warn('[OutlookForge] outlook-forge/ directory not found:', e);
      renderDetailState();
      return;
    }

    /* 2. Parse harvests/ subdirectory if present */
    const hasHarvestDir = entries.some(e => e.kind === 'directory' && e.name === 'harvests');
    if (hasHarvestDir) {
      try {
        const harvestEntries = await ForgeFS.readDir(rootHandle, 'outlook-forge/harvests');
        const mdFiles = harvestEntries.filter(e => e.kind === 'file' && e.name.endsWith('.md'));
        for (const file of mdFiles) {
          try {
            const content = await ForgeFS.readFile(rootHandle, 'outlook-forge/harvests/' + file.name);
            const parsed = ForgeUtils.parseFrontmatter(content);
            if (parsed) {
              harvests.push({
                filename: file.name,
                frontmatter: parsed.frontmatter || {},
                body: parsed.body || ''
              });
            }
          } catch (e) {
            console.warn('[OutlookForge] Failed to parse harvest:', file.name, e);
          }
        }
        harvests.sort((a, b) => {
          const dA = String(a.frontmatter.scan_date || '');
          const dB = String(b.frontmatter.scan_date || '');
          return dB.localeCompare(dA);
        });
      } catch (e) {
        console.warn('[OutlookForge] Failed to read harvests/:', e);
      }
    }

    /* 3. Parse transcripts/ subdirectory if present */
    const hasTxDir = entries.some(e => e.kind === 'directory' && e.name === 'transcripts');
    if (hasTxDir) {
      try {
        const txEntries = await ForgeFS.readDir(rootHandle, 'outlook-forge/transcripts');
        const txMd = txEntries.filter(e => e.kind === 'file' && e.name.endsWith('.md'));
        for (const file of txMd) {
          try {
            const content = await ForgeFS.readFile(rootHandle, 'outlook-forge/transcripts/' + file.name);
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
            console.warn('[OutlookForge] Failed to parse transcript:', file.name, e);
          }
        }
        transcripts.sort((a, b) => {
          const dA = String(a.frontmatter.scan_date || a.filename);
          const dB = String(b.frontmatter.scan_date || b.filename);
          return dB.localeCompare(dA);
        });
      } catch (e) {
        console.warn('[OutlookForge] Failed to read transcripts/:', e);
      }
    }

    /* 4. Parse config.json */
    try {
      const raw = await ForgeFS.readFile(rootHandle, 'outlook-forge/config.json');
      configData = JSON.parse(raw);
    } catch (e) {
      console.log('[OutlookForge] No config.json:', e.message);
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
      .map(s => `<span class="of-status-badge ${s}">${counts[s]}</span>`)
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
        const source  = (h.frontmatter.source_channel || '').toLowerCase();
        const tags    = (Array.isArray(h.frontmatter.tags) ? h.frontmatter.tags.join(' ') : '').toLowerCase();
        return title.includes(searchQuery) || source.includes(searchQuery) || tags.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="of-empty-list">${
        harvests.length === 0
          ? 'No harvests found. Run <code>/outlook-forge:scan</code>.'
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
        <div class="sidebar-card ${isSelected ? 'selected' : ''}" data-of-filename="${esc(h.filename)}">
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
      list.innerHTML = `<div class="of-empty-list">${
        transcripts.length === 0
          ? 'No transcripts found.'
          : 'No transcripts match the search.'
      }</div>`;
      return;
    }

    list.innerHTML = filtered.map(t => {
      const fm = t.frontmatter;
      const label = fm.title || transcriptLabel(t.filename);
      const timeframe = fm.scan_timeframe || fm.timeframe || '';
      const scanDate  = fm.scan_date ? String(fm.scan_date) : '';
      const isSelected = selectedTranscript && selectedTranscript.filename === t.filename;

      return `
        <div class="sidebar-card ${isSelected ? 'selected' : ''}" data-of-transcript="${esc(t.filename)}">
          <div class="sidebar-card-title">${esc(label)}</div>
          <div class="sidebar-card-meta">
            ${timeframe ? `<span class="of-transcript-timeframe">${esc(timeframe)}</span>` : ''}
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
    if (!rootHandle || !outlookForgeActive) {
      panel.innerHTML = `
        <div class="not-active-state">
          <div class="state-icon"><i class="fa-solid fa-envelope"></i></div>
          <h2>Outlook Forge Not Active</h2>
          <p>No <code>outlook-forge/</code> directory found in your project.</p>
          <p>Run <code>/outlook-forge:init</code> then <code>/outlook-forge:scan</code> to get started.</p>
        </div>
      `;
      return;
    }

    /* Empty / no selection */
    if (activeView === 'harvests') {
      if (harvests.length === 0) {
        panel.innerHTML = `
          <div class="empty-state">
            <div class="icon"><i class="fa-solid fa-envelope"></i></div>
            <h2>No Harvests Found</h2>
            <p>Run <code>/outlook-forge:scan</code> to harvest content from Outlook calendar and inbox.</p>
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
            <p>Transcripts appear in <code>outlook-forge/transcripts/</code> after a scan captures raw Outlook content.</p>
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
    const source     = fm.source_channel || '';
    const author     = fm.source_author  || '';
    const scanDate   = fm.scan_date ? String(fm.scan_date) : '';
    const timeframe  = fm.scan_timeframe || fm.timeframe || '';
    const confidence = fm.confidence || '';
    const tags       = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);

    const typeColor = harvestTypeColor(hType);
    const stsColor  = statusColor(status);
    const confColor = confidenceColor(confidence);
    const rendered  = ForgeUtils.MD.render(selectedHarvest.body);

    const metaRows = [
      source     ? `<span class="meta-label">Source</span><span class="meta-value">${esc(source)}</span>` : '',
      author     ? `<span class="meta-label">Author</span><span class="meta-value">${esc(author)}</span>` : '',
      scanDate   ? `<span class="meta-label">Scan Date</span><span class="meta-value">${esc(scanDate)}</span>` : '',
      timeframe  ? `<span class="meta-label">Timeframe</span><span class="meta-value">${esc(timeframe)}</span>` : '',
      confidence ? `<span class="meta-label">Confidence</span><span class="meta-value" style="color:${confColor};font-weight:600;">${esc(confidence)}</span>` : '',
      tags.length ? `<span class="meta-label">Tags</span><span class="meta-value">${tags.map(t => esc(t)).join(', ')}</span>` : ''
    ].filter(Boolean).map(row => `<div style="display:contents;">${row}</div>`).join('');

    panel.innerHTML = `
      <div class="of-harvest-detail">
        <div class="of-title-header">
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
    const timeframe = fm.scan_timeframe || fm.timeframe  || '';
    const source    = fm.source     || '';
    const scanRun   = fm.scan_run   ? String(fm.scan_run) : '';
    const generated = fm.generated  ? String(fm.generated) : '';
    const rendered  = ForgeUtils.MD.render(selectedTranscript.body);

    const metaRows = [
      scanDate  ? `<span class="meta-label">Scan Date</span><span class="meta-value">${esc(scanDate)}</span>`  : '',
      source    ? `<span class="meta-label">Source</span><span class="meta-value">${esc(source)}</span>`       : '',
      timeframe ? `<span class="meta-label">Timeframe</span><span class="meta-value">${esc(timeframe)}</span>` : '',
      scanRun   ? `<span class="meta-label">Scan Run</span><span class="meta-value">#${esc(scanRun)}</span>`   : '',
      generated ? `<span class="meta-label">Generated</span><span class="meta-value">${esc(generated)}</span>` : ''
    ].filter(Boolean).map(row => `<div style="display:contents;">${row}</div>`).join('');

    panel.innerHTML = `
      <div class="of-transcript-detail">
        <div class="of-transcript-title-header">
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
        <div class="of-config-bar">
          <span class="of-config-item">
            <i class="fa-solid fa-circle-info"></i>
            Not configured &mdash; run <code>/outlook-forge:init</code>
          </span>
        </div>
      `;
      return;
    }

    const sources      = configData.sources;
    const sourceCount  = Array.isArray(sources) ? sources.length : 0;
    const monitored    = Array.isArray(sources) ? sources.filter(s => s.monitor).length : 0;
    const updated      = configData.updated || '';

    container.innerHTML = `
      <div class="of-config-bar">
        <div class="of-config-item">
          <i class="fa-solid fa-envelope"></i>
          <strong>${monitored}</strong> source${monitored !== 1 ? 's' : ''} monitored
        </div>
        ${sourceCount > monitored ? `
        <div class="of-config-item">
          <i class="fa-solid fa-folder"></i>
          <strong>${sourceCount}</strong> total configured
        </div>` : ''}
        ${updated ? `
        <div class="of-config-item">
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
        view().querySelectorAll('[data-of-filter-type]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofFilterType === 'all');
        });
        view().querySelectorAll('[data-of-filter-status]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofFilterStatus === 'all');
        });
        view().querySelectorAll('[data-of-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.ofView === 'harvests');
        });
        const harvestsPanel   = $('[data-of-panel="harvests-sidebar"]');
        const transcriptsPanel = $('[data-of-panel="transcripts-sidebar"]');
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
      outlookForgeActive = false;

    },

    refresh() {
      if (initialized) {
        loadData();
      }
    }
  };
})();

Shell.registerController('outlook-forge', window.OutlookForgeView);
