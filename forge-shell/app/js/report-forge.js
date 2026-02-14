/* ═══════════════════════════════════════════════════════════════
   Report Forge View Controller
   Scans reports/{type}/ via FS API, renders a sidebar + detail panel
   inside #view-report-forge with search, category pills, visualization
   ═══════════════════════════════════════════════════════════════ */

window.ReportForgeView = (function () {
  'use strict';

  const esc = ForgeUtils.escapeHTML;

  /* ── State ── */
  let rootHandle = null;
  let reportsHandle = null;
  let allReports = [];
  let filteredReports = [];
  let searchQuery = '';
  let selectedReport = null;
  let activeDetailView = 'description';
  let refreshTimer = null;
  let initialized = false;

  /* ── DOM scope helper ── */
  function $(sel) {
    return document.querySelector('#view-report-forge ' + sel);
  }

  /* ═══════════════════════════════════════════════════════════
     Report Subdirectories (8 types)
     ═══════════════════════════════════════════════════════════ */
  const REPORT_SUBDIRS = [
    'executive-summaries',
    'technical-deep-dives',
    'competitive-analyses',
    'architecture-reviews',
    'performance-analyses',
    'incident-postmortems',
    'quarterly-reviews',
    'feasibility-studies'
  ];

  /* ═══════════════════════════════════════════════════════════
     Color Helpers
     ═══════════════════════════════════════════════════════════ */
  function categoryColor(category) {
    if (!category) return 'var(--text-muted)';
    const map = {
      'architecture': 'var(--rf-cat-architecture)',
      'performance': 'var(--rf-cat-performance)',
      'security': 'var(--rf-cat-security)',
      'integration': 'var(--rf-cat-integration)',
      'feature-analysis': 'var(--rf-cat-feature)',
      'operations': 'var(--rf-cat-operations)',
      'technical-debt': 'var(--rf-cat-debt)',
      'competitive': 'var(--rf-cat-competitive)',
      'user-research': 'var(--rf-cat-user)',
      'business-metrics': 'var(--rf-cat-business)'
    };
    return map[category] || 'var(--text-muted)';
  }

  function statusColor(status) {
    if (!status) return 'var(--text-muted)';
    const s = status.toLowerCase();
    if (s === 'complete') return '#27ae60';
    if (s === 'draft') return '#e67e22';
    if (s === 'in-progress' || s === 'in progress') return '#3498db';
    if (s === 'archived') return '#95a5a6';
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

  function reportTypeLabel(type) {
    if (!type) return 'Report';
    const map = {
      'executive-summary': 'Executive Summary',
      'technical-deep-dive': 'Technical Deep Dive',
      'competitive-analysis': 'Competitive Analysis',
      'architecture-review': 'Architecture Review',
      'performance-analysis': 'Performance Analysis',
      'incident-postmortem': 'Incident Postmortem',
      'quarterly-review': 'Quarterly Review',
      'feasibility-study': 'Feasibility Study'
    };
    return map[type] || type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /* ═══════════════════════════════════════════════════════════
     Scaffolding — builds the initial DOM inside the view
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    const view = document.getElementById('view-report-forge');
    view.innerHTML = `
      <div class="rf-layout">
        <!-- Toolbar -->
        <div class="plugin-toolbar" style="grid-column: 1 / -1;">
          <button class="btn-icon rf-toolbar-toggle" data-action="toggle-sidebar" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="toolbar-title"><i class="fa-solid fa-file-lines"></i> Report Forge</span>
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
        <div class="rf-sidebar">
          <div class="rf-search-bar">
            <i class="fa-solid fa-search"></i>
            <input type="text" class="rf-search-input" placeholder="Search reports..." data-ref="search-input">
          </div>
          <div class="rf-report-list" data-ref="report-list"></div>
        </div>

        <!-- Detail Panel -->
        <div class="rf-detail-panel" data-ref="detail-panel">
          <!-- States rendered dynamically -->
        </div>
      </div>
    `;
    initialized = true;
  }

  /* ═══════════════════════════════════════════════════════════
     Bind Toolbar
     ═══════════════════════════════════════════════════════════ */
  function bindToolbar() {
    const refreshBtn = $('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refresh());
    }

    const toggleBtn = $('[data-action="toggle-sidebar"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const sidebar = $('.rf-sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed');
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Bind Search
     ═══════════════════════════════════════════════════════════ */
  function bindSearch() {
    const input = $('[data-ref="search-input"]');
    if (!input) return;

    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
        renderReportList();
      }, 300);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Bind View Toggle
     ═══════════════════════════════════════════════════════════ */
  function bindViewToggle() {
    document.querySelectorAll('#view-report-forge [data-rf-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeDetailView = btn.dataset.rfView;
        document.querySelectorAll('#view-report-forge [data-rf-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.rfView === activeDetailView);
        });

        const descContainer = $('[data-rf-container="description"]');
        const vizContainer = $('[data-rf-container="visualization"]');
        if (descContainer) descContainer.classList.toggle('hidden', activeDetailView !== 'description');
        if (vizContainer) vizContainer.classList.toggle('hidden', activeDetailView !== 'visualization');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Find reports/ handle
     ═══════════════════════════════════════════════════════════ */
  async function findReportsHandle() {
    if (!rootHandle) return null;
    return await ForgeUtils.FS.getSubDir(rootHandle, 'reports');
  }

  /* ═══════════════════════════════════════════════════════════
     Scan Reports — scans root level + all subdirectories
     ═══════════════════════════════════════════════════════════ */
  async function scanReports() {
    if (!rootHandle) return [];

    // V2: Load from index.json instead of scanning directories
    try {
      const indexData = await ForgeUtils.readIndex(rootHandle, 'reports');
      if (!indexData || !indexData.entries) {
        return [];
      }

      const results = indexData.entries.map(function(entry) {
        return {
          filename: entry.filename,
          frontmatter: entry.frontmatter || {},
          body: entry.body || '',
          lastModified: entry.metadata?.lastModified || Date.now(),
          subdirectory: entry.subdirectory || 'root'
        };
      });

      // Sort by created date (newest first)
      results.sort((a, b) => {
        const dateA = a.frontmatter.created || '';
        const dateB = b.frontmatter.created || '';
        return dateB.localeCompare(dateA);
      });

      return results;
    } catch (e) {
      console.warn('[ReportForge] Failed to read reports index:', e);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Load Reports
     ═══════════════════════════════════════════════════════════ */
  async function loadReports() {
    reportsHandle = await findReportsHandle();

    if (!reportsHandle) {
      allReports = [];
      filteredReports = [];
      renderDetailState('not-active');
      renderReportList();
      return;
    }

    allReports = await scanReports();
    applyFilters();
    renderReportList();

    if (allReports.length === 0) {
      renderDetailState('empty');
    } else if (!selectedReport) {
      renderDetailState('no-selection');
    }

    updateRefreshIndicator();
  }

  /* ═══════════════════════════════════════════════════════════
     Apply Filters
     ═══════════════════════════════════════════════════════════ */
  function applyFilters() {
    let results = allReports;

    // Search filter (title + topic + category)
    if (searchQuery) {
      results = results.filter(r => {
        const title = (r.frontmatter.title || '').toLowerCase();
        const topic = (r.frontmatter.topic || '').toLowerCase();
        const category = (r.frontmatter.category || '').toLowerCase();
        return title.includes(searchQuery) ||
               topic.includes(searchQuery) ||
               category.includes(searchQuery);
      });
    }

    filteredReports = results;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Report List
     ═══════════════════════════════════════════════════════════ */
  function renderReportList() {
    const list = $('[data-ref="report-list"]');
    if (!list) return;

    if (filteredReports.length === 0) {
      if (allReports.length === 0) {
        list.innerHTML = `
          <div class="rf-empty-list">
            <i class="fa-solid fa-inbox"></i>
            No reports found
          </div>
        `;
      } else {
        list.innerHTML = `
          <div class="rf-empty-list">
            <i class="fa-solid fa-search"></i>
            No reports match your search criteria
          </div>
        `;
      }
      return;
    }

    let html = '';
    filteredReports.forEach(report => {
      const fm = report.frontmatter;
      const title = fm.title || 'Untitled Report';
      const category = fm.category || '';
      const reportType = fm.report_type || '';
      const created = fm.created || '';
      const isSelected = selectedReport && selectedReport.filename === report.filename;
      const catColor = categoryColor(category);

      html += `
        <div class="rf-report-item ${isSelected ? 'selected' : ''}" data-filename="${esc(report.filename)}">
          <div class="rf-report-category-bar" style="background: ${catColor};"></div>
          <div class="rf-report-item-content">
            <div class="rf-report-item-title">${esc(title)}</div>
            <div class="rf-report-item-meta">
              ${category ? `<span class="rf-category-pill" style="background: ${catColor};">${esc(category)}</span>` : ''}
              <span class="rf-report-type-label">${esc(reportTypeLabel(reportType))}</span>
              ${created ? `<span>${created}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;

    // Bind clicks
    list.querySelectorAll('.rf-report-item').forEach(item => {
      item.addEventListener('click', () => {
        const filename = item.dataset.filename;
        const report = filteredReports.find(r => r.filename === filename);
        if (report) {
          selectedReport = report;
          renderReportList();
          renderDetail();
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Render Detail State (not-active, empty, no-selection)
     ═══════════════════════════════════════════════════════════ */
  function renderDetailState(state) {
    const panel = $('[data-ref="detail-panel"]');
    if (!panel) return;

    if (state === 'not-active') {
      panel.innerHTML = `
        <div class="not-active-state">
          <div class="state-icon"><i class="fa-solid fa-file-lines"></i></div>
          <h2>Report Forge Not Active</h2>
          <p>No <code>reports/</code> directory found in your project.</p>
          <p>Run <code>/report-forge:generate &lt;topic&gt;</code> to create your first report.</p>
        </div>
      `;
    } else if (state === 'empty') {
      panel.innerHTML = `
        <div class="empty-state">
          <div class="icon"><i class="fa-solid fa-inbox"></i></div>
          <h2>No Reports Found</h2>
          <p>Run <code>/report-forge:generate &lt;topic&gt;</code> to create a report.</p>
        </div>
      `;
    } else if (state === 'no-selection') {
      panel.innerHTML = `
        <div class="empty-state">
          <div class="icon"><i class="fa-solid fa-file-lines"></i></div>
          <h2>Select a Report</h2>
          <p>Choose a report from the sidebar to view its details.</p>
        </div>
      `;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Render Detail
     ═══════════════════════════════════════════════════════════ */
  function renderDetail() {
    const panel = $('[data-ref="detail-panel"]');
    if (!panel || !selectedReport) return;

    const fm = selectedReport.frontmatter;
    const title = fm.title || 'Untitled Report';
    const status = fm.status || 'Draft';
    const confidence = fm.confidence || '';
    const category = fm.category || '';
    const reportType = fm.report_type || '';

    const statusClr = statusColor(status);
    const confidenceClr = confidenceColor(confidence);

    // Build metadata rows
    const metadataRows = buildMetadataRows(fm);

    // Render markdown body
    const renderedBody = ForgeUtils.MD.render(selectedReport.body);

    panel.innerHTML = `
      <div class="rf-report-detail">
        <div class="rf-title-header">
          <h1>${esc(title)}</h1>
          <span class="status-pill" style="background: ${statusClr};">${esc(status)}</span>
        </div>

        <div class="view-toggle rf-view-toggle">
          <button data-rf-view="description" class="active">Description</button>
          <button data-rf-view="visualization">Visualization</button>
        </div>

        <div class="metadata-grid">
          ${metadataRows}
        </div>

        <div class="rf-content-container" data-rf-container="description">
          <div class="rendered-body">${renderedBody}</div>
        </div>

        <div class="rf-content-container hidden" data-rf-container="visualization">
          ${renderVisualizationPlaceholder(fm)}
        </div>
      </div>
    `;

    // Bind view toggle
    bindViewToggle();
  }

  /* ═══════════════════════════════════════════════════════════
     Build Metadata Rows
     ═══════════════════════════════════════════════════════════ */
  function buildMetadataRows(fm) {
    let html = '';

    // Confidence
    if (fm.confidence) {
      const clr = confidenceColor(fm.confidence);
      html += `
        <div class="metadata-row">
          <span class="meta-label">Confidence</span>
          <span class="meta-value" style="color: ${clr}; font-weight: 600;">${esc(fm.confidence)}</span>
        </div>
      `;
    }

    // Category
    if (fm.category) {
      const clr = categoryColor(fm.category);
      html += `
        <div class="metadata-row">
          <span class="meta-label">Category</span>
          <span class="meta-value" style="color: ${clr}; font-weight: 600;">${esc(fm.category)}</span>
        </div>
      `;
    }

    // Report Type
    if (fm.report_type) {
      html += `
        <div class="metadata-row">
          <span class="meta-label">Type</span>
          <span class="meta-value">${esc(reportTypeLabel(fm.report_type))}</span>
        </div>
      `;
    }

    // Coverage Period
    if (fm.coverage_period && (fm.coverage_period.start || fm.coverage_period.end)) {
      const start = fm.coverage_period.start || 'N/A';
      const end = fm.coverage_period.end || 'N/A';
      html += `
        <div class="metadata-row">
          <span class="meta-label">Coverage Period</span>
          <span class="meta-value">${esc(start)} → ${esc(end)}</span>
        </div>
      `;
    }

    // Related Entities
    if (fm.related_entities) {
      const entities = [];
      if (fm.related_entities.products && fm.related_entities.products.length > 0) {
        entities.push(`Products: ${fm.related_entities.products.join(', ')}`);
      }
      if (fm.related_entities.modules && fm.related_entities.modules.length > 0) {
        entities.push(`Modules: ${fm.related_entities.modules.join(', ')}`);
      }
      if (fm.related_entities.teams && fm.related_entities.teams.length > 0) {
        entities.push(`Teams: ${fm.related_entities.teams.join(', ')}`);
      }
      if (entities.length > 0) {
        html += `
          <div class="metadata-row">
            <span class="meta-label">Related Entities</span>
            <span class="meta-value">${esc(entities.join(' • '))}</span>
          </div>
        `;
      }
    }

    // Investigators
    if (fm.investigators && fm.investigators.length > 0) {
      html += `
        <div class="metadata-row">
          <span class="meta-label">Investigators</span>
          <span class="meta-value">${esc(fm.investigators.join(', '))}</span>
        </div>
      `;
    }

    // Created / Updated
    if (fm.created || fm.updated) {
      html += `
        <div class="metadata-row">
          <span class="meta-label">Dates</span>
          <span class="meta-value">
            ${fm.created ? `Created: ${esc(fm.created)}` : ''}
            ${fm.created && fm.updated ? ' • ' : ''}
            ${fm.updated ? `Updated: ${esc(fm.updated)}` : ''}
          </span>
        </div>
      `;
    }

    return html;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Visualization Placeholder
     ═══════════════════════════════════════════════════════════ */
  function renderVisualizationPlaceholder(fm) {
    return `
      <div class="rf-visualization-placeholder">
        <div class="rf-viz-header">
          <i class="fa-solid fa-lightbulb"></i>
          Visualization Preview
        </div>

        <div class="rf-viz-mockup">
          <!-- Bar Chart Section -->
          <div class="rf-mockup-section">
            <h3>Key Metrics</h3>
            <div class="rf-chart-bars">
              <div class="rf-chart-bar" style="height: 60%;">
                <span class="bar-label">Metric A</span>
              </div>
              <div class="rf-chart-bar" style="height: 80%;">
                <span class="bar-label">Metric B</span>
              </div>
              <div class="rf-chart-bar" style="height: 45%;">
                <span class="bar-label">Metric C</span>
              </div>
              <div class="rf-chart-bar" style="height: 90%;">
                <span class="bar-label">Metric D</span>
              </div>
            </div>
          </div>

          <!-- Timeline Section -->
          <div class="rf-mockup-section">
            <h3>Coverage Timeline</h3>
            <div class="rf-timeline">
              ${renderTimelineItems(fm)}
            </div>
          </div>

          <!-- Pie Chart Section -->
          <div class="rf-mockup-section">
            <h3>Coverage Analysis</h3>
            <div class="rf-pie-container">
              <svg class="rf-pie-chart" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--rf-cat-architecture)" stroke-width="20" opacity="0.3" stroke-dasharray="188.4 0"></circle>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--rf-cat-performance)" stroke-width="20" opacity="0.3" stroke-dasharray="141.3 47.1" transform="rotate(-90 50 50)"></circle>
              </svg>
              <div class="rf-pie-legend">
                <div><span style="background: var(--rf-cat-architecture); opacity: 0.3;"></span> 75%</div>
                <div><span style="background: var(--rf-cat-performance); opacity: 0.3;"></span> 25%</div>
              </div>
            </div>
          </div>
        </div>

        <div class="rf-viz-footer">
          <i class="fa-solid fa-info-circle"></i>
          Interactive charts and drill-down capabilities coming soon
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════════════════
     Render Timeline Items
     ═══════════════════════════════════════════════════════════ */
  function renderTimelineItems(fm) {
    const items = [];

    if (fm.coverage_period && fm.coverage_period.start && fm.coverage_period.end) {
      const start = new Date(fm.coverage_period.start);
      const end = new Date(fm.coverage_period.end);
      const diff = end - start;

      for (let i = 0; i < 5; i++) {
        const date = new Date(start.getTime() + (diff / 4) * i);
        const dateStr = date.toISOString().split('T')[0];
        items.push(`
          <div class="rf-timeline-item">
            <div class="rf-timeline-bar" style="background: var(--rf-cat-architecture); opacity: 0.3;"></div>
            <span>${dateStr}</span>
          </div>
        `);
      }
    } else {
      // Default placeholder items
      for (let i = 0; i < 5; i++) {
        items.push(`
          <div class="rf-timeline-item">
            <div class="rf-timeline-bar" style="background: var(--rf-cat-architecture); opacity: 0.3;"></div>
            <span>Week ${i + 1}</span>
          </div>
        `);
      }
    }

    return items.join('');
  }

  /* ═══════════════════════════════════════════════════════════
     Auto-Refresh
     ═══════════════════════════════════════════════════════════ */
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(async () => {
      if (!reportsHandle) return;

      const newReports = await scanReports();

      // Signature: filename:lastModified
      const newSig = newReports.map(r => `${r.filename}:${r.lastModified}`).join('|');
      const oldSig = allReports.map(r => `${r.filename}:${r.lastModified}`).join('|');

      if (newSig !== oldSig) {
        allReports = newReports;
        applyFilters();
        renderReportList();

        // Preserve selection if still exists
        if (selectedReport) {
          const found = allReports.find(r => r.filename === selectedReport.filename);
          if (found) {
            selectedReport = found;
            renderDetail();
          } else {
            selectedReport = null;
            renderDetailState('no-selection');
          }
        }

        updateRefreshIndicator();
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
    init(rh) {
      rootHandle = rh;

      if (!initialized) scaffold();

      bindToolbar();
      bindSearch();
      loadReports();
      startAutoRefresh();

      // Update folder path
      const folderPathDiv = $('[data-ref="folder-path"]');
      const folderNameSpan = $('[data-ref="folder-name"]');
      if (folderPathDiv && folderNameSpan && rootHandle) {
        let dirName = 'reports';
        if (typeof rootHandle === 'string') {
          dirName = rootHandle.split('/').pop() || rootHandle.split('\\').pop() || rootHandle;
        } else if (rootHandle.name) {
          dirName = rootHandle.name;
        }
        folderNameSpan.textContent = `${dirName}/reports`;
        folderPathDiv.classList.remove('hidden');
      }
    },

    destroy() {
      stopAutoRefresh();
      selectedReport = null;
      searchQuery = '';
      activeDetailView = 'description';
    },

    refresh() {
      loadReports();
    }
  };
})();

Shell.registerController('report-forge', window.ReportForgeView);
