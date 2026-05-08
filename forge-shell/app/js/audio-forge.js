/* ═══════════════════════════════════════════════════════════════
   Audio Forge View Controller
   Records system + mic via Tauri sidecar, browses + transcribes recordings.
   Pattern matches slack-forge.js / outlook-forge.js.
   ═══════════════════════════════════════════════════════════════ */
window.AudioForgeView = (function () {
  'use strict';

  const helpers = window.AudioForgeHelpers;
  const { reduce, initialState } = window.AudioForgeReducer;
  const esc = (window.ForgeUtils && ForgeUtils.escapeHTML) || ((s) => String(s));

  function tauriCore() { return (window.__TAURI__ && window.__TAURI__.core) || null; }
  function tauriEvent() { return (window.__TAURI__ && window.__TAURI__.event) || null; }

  /**
   * Resolve a project-relative WAV path into a webview-loadable src.
   * Uses Tauri's convertFileSrc (asset:// scheme) so the audio element
   * can play files outside the bundled app.
   */
  function audioSrc(relPath) {
    if (!relPath) return '';
    if (!projectRoot) return '';
    const abs = `${projectRoot}/${relPath}`.replace(/\\/g, '/');
    const core = tauriCore();
    if (core && typeof core.convertFileSrc === 'function') {
      return core.convertFileSrc(abs);
    }
    // Browser-mode fallback (read-only): not supported, leave blank.
    return '';
  }

  /* ── State ── */
  let initialized = false;
  let rootHandle = null;
  let projectRoot = null;
  let machineState = initialState;
  let recordings = [];
  let selectedId = null;
  let listenersAttached = false;
  let unlisteners = [];
  let searchQuery = '';

  /* ── DOM helpers ── */
  function view() { return document.getElementById('view-audio-forge'); }
  function $(sel) { return view().querySelector(sel); }
  function ref(name) { return $(`[data-af-ref="${name}"]`); }

  /* ═══════════════════════════════════════════════════════════
     Scaffold
     ═══════════════════════════════════════════════════════════ */
  function scaffold() {
    view().innerHTML = `
      <div class="af-layout">

        <div class="plugin-toolbar">
          <span class="toolbar-title"><i class="fa-solid fa-microphone"></i> Audio Forge</span>

          <div class="af-source-checkboxes" data-af-ref="sources">
            <label><input type="checkbox" data-af-source="system" checked> system</label>
            <label><input type="checkbox" data-af-source="mic" checked> mic</label>
          </div>

          <button class="af-record-btn" data-af-action="toggle-record">
            <span class="af-record-dot"></span>
            <span data-af-ref="record-label">Record</span>
          </button>

          <span class="af-elapsed" data-af-ref="elapsed">0:00</span>

          <div class="af-meter" data-af-ref="meter" style="display:none">
            <div class="af-meter-bar"><div data-af-meter-bar="system"></div></div>
            <div class="af-meter-bar"><div data-af-meter-bar="mic"></div></div>
          </div>

          <span class="af-toolbar-spacer"></span>

          <span class="refresh-indicator" data-af-ref="refresh-indicator"></span>
          <button class="btn-icon" data-af-action="refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
        </div>

        <div data-af-ref="recovery-banner"></div>

        <div class="af-main">
          <div class="af-sidebar">
            <div class="af-sidebar-header">Recordings (<span data-af-ref="count">0</span>)</div>
            <div class="af-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" placeholder="Search recordings…" data-af-ref="search">
            </div>
            <div class="af-list" data-af-ref="list"></div>
          </div>
          <div class="af-detail" data-af-ref="detail">
            <div class="af-empty">
              <i class="fa-solid fa-microphone"></i>
              <p>No recording selected.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire toolbar actions (interactivity in later tasks).
    $('[data-af-action="refresh"]').addEventListener('click', () => refresh());
    wireSearch();
    // Record button is no-op here; Task 7 wires it.
  }

  /* ═══════════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════════ */
  function setProjectRoot(handle) {
    rootHandle = handle;
    // In Tauri mode, Shell.rootHandle is a path string. In browser mode,
    // it's a FileSystemDirectoryHandle (no usable absolute path).
    if (window.ForgeFS && window.ForgeFS.isTauri && window.ForgeFS.isTauri()) {
      projectRoot = window.Shell ? window.Shell.rootHandle : null;
    } else {
      projectRoot = null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Disk scan
     ═══════════════════════════════════════════════════════════ */
  async function scanRecordings() {
    if (!rootHandle) return [];
    const indicator = ref('refresh-indicator');
    if (indicator) indicator.textContent = 'Scanning…';
    try {
      const files = await ForgeFS.listMarkdownFiles(rootHandle, 'audio-forge/recordings');
      const out = [];
      for (const f of files) {
        try {
          const text = await ForgeFS.readFile(rootHandle, f.path);
          const { frontmatter, body } = helpers.parseFrontmatter(text);
          if (frontmatter && frontmatter.id && frontmatter.type === 'recording') {
            out.push({
              path: f.path,
              filename: f.name,
              frontmatter,
              body,
            });
          }
        } catch (e) {
          console.warn('[AudioForge] failed to read', f.path, e);
        }
      }
      out.sort((a, b) => {
        const ac = a.frontmatter.created || '';
        const bc = b.frontmatter.created || '';
        return bc.localeCompare(ac);
      });
      return out;
    } finally {
      if (indicator) indicator.textContent = '';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     List rendering
     ═══════════════════════════════════════════════════════════ */
  function filteredRecordings() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recordings;
    return recordings.filter((r) => {
      const t = (r.frontmatter.title || '').toLowerCase();
      return t.includes(q);
    });
  }

  function renderList() {
    const list = ref('list');
    const count = ref('count');
    if (!list) return;
    const items = filteredRecordings();
    count.textContent = String(items.length);
    if (items.length === 0) {
      list.innerHTML = `<div class="af-empty" style="height:auto;padding:20px;font-size:13px"><i class="fa-solid fa-inbox" style="font-size:24px"></i><p>No recordings yet.</p></div>`;
      return;
    }
    list.innerHTML = items.map((r) => {
      const fm = r.frontmatter;
      const status = (machineState.id === fm.id && machineState.status === 'transcribing')
        ? helpers.statusBadge('transcribing')
        : helpers.statusBadge(fm.transcript_status);
      const dur = helpers.formatDuration(fm.duration_seconds || 0);
      const date = helpers.formatTimestamp(fm.created || '').split(' ')[0] || '';
      const sel = (r.frontmatter.id === selectedId) ? ' selected' : '';
      return `
        <div class="af-item${sel}" data-af-id="${esc(fm.id)}">
          <div class="af-item-title">${esc(fm.title || '(untitled)')}</div>
          <div class="af-item-meta">
            <span>${esc(date)}</span>
            <span>${esc(dur)}</span>
            <span class="${status.cls}"><i class="fa-solid ${status.icon}"></i> ${esc(status.label)}</span>
          </div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('[data-af-id]').forEach((el) => {
      el.addEventListener('click', () => {
        selectedId = el.dataset.afId;
        renderList();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const detail = ref('detail');
    if (!detail) return;
    if (!selectedId) {
      detail.innerHTML = `
        <div class="af-empty">
          <i class="fa-solid fa-microphone"></i>
          <p>No recording selected.</p>
        </div>`;
      return;
    }
    const r = recordings.find((x) => x.frontmatter.id === selectedId);
    if (!r) { detail.innerHTML = ''; return; }
    const fm = r.frontmatter;
    const dur = helpers.formatDuration(fm.duration_seconds || 0);
    const created = helpers.formatTimestamp(fm.created || '');
    const liveStatus = (machineState.id === fm.id && machineState.status === 'transcribing')
      ? helpers.statusBadge('transcribing')
      : helpers.statusBadge(fm.transcript_status);

    const audioBlocks = [];
    if (fm.audio_files && fm.audio_files.system) {
      audioBlocks.push(`
        <div class="af-audio-player">
          <span class="af-audio-label">System</span>
          <audio controls preload="metadata" src="${esc(audioSrc(fm.audio_files.system))}"></audio>
        </div>`);
    }
    if (fm.audio_files && fm.audio_files.mic) {
      audioBlocks.push(`
        <div class="af-audio-player">
          <span class="af-audio-label">Mic</span>
          <audio controls preload="metadata" src="${esc(audioSrc(fm.audio_files.mic))}"></audio>
        </div>`);
    }

    const transcriptBlock = (fm.transcript_status === 'transcribed' && r.body && r.body.trim())
      ? `<div class="af-transcript">${esc(r.body.trim())}</div>`
      : (fm.transcript_status === 'failed'
          ? `<p>Transcription failed. <button class="af-retry-btn" data-af-action="retry-transcribe" data-af-id="${esc(fm.id)}">Retry</button></p>`
          : `<p style="color:var(--text-muted)">Transcript pending…</p>`);

    detail.innerHTML = `
      <div class="af-detail-header">
        <div class="af-detail-title">${esc(fm.title || '(untitled)')}</div>
        <div class="af-detail-meta">
          ${esc(created)} · ${esc(dur)} ·
          <span class="${liveStatus.cls}"><i class="fa-solid ${liveStatus.icon}"></i> ${esc(liveStatus.label)}</span>
        </div>
      </div>
      <div class="af-detail-section">${audioBlocks.join('')}</div>
      <div class="af-detail-section">
        <h3 style="font-size:14px;color:var(--text-secondary);margin:0 0 8px 0;">Transcript</h3>
        ${transcriptBlock}
      </div>
    `;
    // Wire the retry button — Task 10 implements retryTranscribe.
    const retryBtn = detail.querySelector('[data-af-action="retry-transcribe"]');
    if (retryBtn && typeof retryTranscribe === 'function') {
      retryBtn.addEventListener('click', () => retryTranscribe(retryBtn.dataset.afId));
    }
  }

  /* ═══════════════════════════════════════════════════════════
     refresh
     ═══════════════════════════════════════════════════════════ */
  async function refresh() {
    recordings = await scanRecordings();
    if (selectedId && !recordings.some((r) => r.frontmatter.id === selectedId)) {
      selectedId = null;
    }
    renderList();
    renderDetail();
  }

  /* ── Search wiring (called from scaffold AFTER scaffold completes) ── */
  function wireSearch() {
    const input = ref('search');
    if (!input) return;
    input.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderList();
    });
  }

  return {
    init(handle) {
      setProjectRoot(handle);
      if (!initialized) {
        scaffold();
        initialized = true;
      }
      refresh();
    },
    refresh,
  };
})();

Shell.registerController('audio-forge', window.AudioForgeView);
