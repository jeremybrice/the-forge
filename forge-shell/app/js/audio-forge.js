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

  /* ── Mic device persistence ── */
  const MIC_DEVICE_KEY = 'audio-forge.micDeviceUID';

  function loadMicDeviceUID() {
    try {
      const raw = window.localStorage.getItem(MIC_DEVICE_KEY);
      return (typeof raw === 'string' && raw.length > 0) ? raw : '';
    } catch (e) {
      return '';
    }
  }

  function saveMicDeviceUID(uid) {
    try {
      if (uid && typeof uid === 'string') {
        window.localStorage.setItem(MIC_DEVICE_KEY, uid);
      } else {
        window.localStorage.removeItem(MIC_DEVICE_KEY);
      }
    } catch (e) {
      // localStorage unavailable / quota — degrade silently
    }
  }

  function normalizeDeviceList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((d) => d && typeof d.uid === 'string' && typeof d.name === 'string')
      .map((d) => ({
        uid: d.uid,
        name: d.name,
        isDefault: !!d.isDefault,
        channels: Number.isFinite(d.channels) ? d.channels : 0,
      }));
  }

  /* ── Auto-stop persistence ── */
  const AUTOSTOP_KEY = 'audio-forge.autoStopMinutes';

  function loadAutoStopPref() {
    try {
      const raw = window.localStorage.getItem(AUTOSTOP_KEY);
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return 0;
      if (n < 0 || n > 240) return 0;
      return n; // 0 (Off) or 1..240
    } catch (e) {
      return 0;
    }
  }

  function saveAutoStopPref(minutes) {
    try {
      const n = Number(minutes);
      const clean = Number.isFinite(n) && n >= 0 && n <= 240 ? Math.floor(n) : 0;
      window.localStorage.setItem(AUTOSTOP_KEY, String(clean));
    } catch (e) {
      // localStorage unavailable / quota — degrade silently
    }
  }

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
          <button class="btn-icon af-toolbar-toggle" data-af-action="toggle-sidebar" title="Toggle sidebar">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="toolbar-title"><i class="fa-solid fa-microphone"></i> Audio Forge</span>

          <div class="af-source-checkboxes" data-af-ref="sources">
            <label><input type="checkbox" data-af-source="system" checked> system</label>
            <label><input type="checkbox" data-af-source="mic" checked> mic</label>
          </div>

          <div class="af-mic-device" data-af-ref="mic-device-wrap">
            <label class="af-mic-device-label" for="af-mic-device-select">
              <i class="fa-solid fa-microphone-lines"></i> Mic:
            </label>
            <select id="af-mic-device-select" data-af-ref="mic-device-select">
              <option value="">(System default)</option>
            </select>
          </div>

          <div class="af-autostop" data-af-ref="autostop">
            <label class="af-autostop-label" for="af-autostop-select">
              <i class="fa-regular fa-clock"></i> Auto-stop:
            </label>
            <select id="af-autostop-select" data-af-ref="autostop-select">
              <option value="0">Off</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="custom">Custom…</option>
            </select>
            <span class="af-autostop-custom" data-af-ref="autostop-custom" hidden>
              <input type="number" min="1" max="240" step="1"
                     placeholder="min" data-af-ref="autostop-custom-input">
              <span class="af-autostop-custom-unit">min</span>
              <button type="button" data-af-action="autostop-set" disabled>Set</button>
              <button type="button" data-af-action="autostop-cancel">Cancel</button>
            </span>
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
          <div class="sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize sidebar"></div>
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
    $('[data-af-action="toggle-record"]').addEventListener('click', () => {
      onToggleRecord();
    });

    initAutoStopDropdown();
    wireAutoStopControls();
    populateMicDevices();
    wireMicDeviceControl();

    if (window.Sidebar) {
      window.Sidebar.init({
        pluginId: 'audio-forge',
        rootSelector: '#view-audio-forge',
        sidebarSelector: '.af-sidebar',
        toggleSelector: '[data-af-action="toggle-sidebar"]',
        resizerSelector: '.sidebar-resizer'
      });
    }
  }

  function initAutoStopDropdown() {
    const select = ref('autostop-select');
    if (!select) return;
    const stored = loadAutoStopPref();
    setAutoStopDropdownValue(stored);
  }

  function setAutoStopDropdownValue(minutes) {
    const select = ref('autostop-select');
    if (!select) return;
    // Remove any prior transient custom option
    const transient = select.querySelector('option[data-af-custom="1"]');
    if (transient) transient.remove();
    if (minutes === 0) {
      select.value = '0';
      return;
    }
    if (minutes === 30 || minutes === 60 || minutes === 90) {
      select.value = String(minutes);
      return;
    }
    // Custom value — insert a transient option just above the "Custom…" entry.
    const customEntry = select.querySelector('option[value="custom"]');
    const opt = document.createElement('option');
    opt.value = String(minutes);
    opt.textContent = `${minutes} min`;
    opt.dataset.afCustom = '1';
    select.insertBefore(opt, customEntry);
    select.value = String(minutes);
  }

  let lastCommittedAutoStop = 0;

  function getAutoStopSelection() {
    return lastCommittedAutoStop;
  }

  function wireAutoStopControls() {
    const select = ref('autostop-select');
    const custom = ref('autostop-custom');
    const input = ref('autostop-custom-input');
    const setBtn = view().querySelector('[data-af-action="autostop-set"]');
    const cancelBtn = view().querySelector('[data-af-action="autostop-cancel"]');
    if (!select) return;

    lastCommittedAutoStop = loadAutoStopPref();

    select.addEventListener('change', () => {
      const v = select.value;
      if (v === 'custom') {
        // Reveal the custom-entry block; do NOT commit until Set.
        if (custom) custom.hidden = false;
        if (input) {
          input.value = '';
          input.classList.remove('af-invalid');
          input.focus();
        }
        if (setBtn) setBtn.disabled = true;
        // Revert select to the previously committed value so the dropdown
        // does not lie about state while the input is open.
        setAutoStopDropdownValue(lastCommittedAutoStop);
        select.disabled = true; // prevent another change while custom is open
        return;
      }
      const n = parseInt(v, 10);
      const minutes = Number.isFinite(n) && n >= 0 && n <= 240 ? n : 0;
      lastCommittedAutoStop = minutes;
      saveAutoStopPref(minutes);
      // If the user selected a transient custom option, keep it visible.
      // If they selected a preset, drop any stale transient custom option.
      if (minutes === 0 || minutes === 30 || minutes === 60 || minutes === 90) {
        const transient = select.querySelector('option[data-af-custom="1"]');
        if (transient) transient.remove();
      }
    });

    if (input) {
      input.addEventListener('input', () => {
        const n = parseInt(input.value, 10);
        const valid = Number.isFinite(n) && n >= 1 && n <= 240;
        if (setBtn) setBtn.disabled = !valid;
        input.classList.toggle('af-invalid', input.value !== '' && !valid);
      });
    }

    if (setBtn) {
      setBtn.addEventListener('click', () => {
        const n = parseInt(input.value, 10);
        if (!Number.isFinite(n) || n < 1 || n > 240) return;
        lastCommittedAutoStop = n;
        saveAutoStopPref(n);
        setAutoStopDropdownValue(n);
        if (custom) custom.hidden = true;
        select.disabled = false;
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (custom) custom.hidden = true;
        setAutoStopDropdownValue(lastCommittedAutoStop);
        select.disabled = false;
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════════ */
  function setProjectRoot(handle) {
    rootHandle = handle;
    // In Tauri/server mode the handle IS the project-root path string (Shell.boot
    // passes its rootHandle into ctrl.init). In browser mode handle is a
    // FileSystemDirectoryHandle and there's no usable absolute path.
    if (window.ForgeFS && window.ForgeFS.usesPathStrings && window.ForgeFS.usesPathStrings()) {
      projectRoot = (typeof handle === 'string') ? handle : null;
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
    const SUBDIR = 'audio-forge/recordings';
    try {
      const files = await ForgeFS.listMarkdownFiles(rootHandle, SUBDIR);
      const out = [];
      for (const f of files) {
        // list_md_files returns paths relative to the listed subdir. To
        // readFile via root, prefix the subdir.
        const rel = `${SUBDIR}/${f.path}`;
        try {
          const text = await ForgeFS.readFile(rootHandle, rel);
          const { frontmatter, body } = helpers.parseFrontmatter(text);
          if (frontmatter && frontmatter.id && frontmatter.type === 'recording') {
            out.push({
              path: rel,
              filename: f.name,
              frontmatter,
              body,
            });
          }
        } catch (e) {
          console.warn('[AudioForge] failed to read', rel, e);
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
        <div class="af-item${sel}" data-af-id="${esc(fm.id)}" data-af-path="${esc(r.path)}">
          <div class="af-item-title">${esc(fm.title || '(untitled)')}</div>
          <div class="af-item-meta">
            <span>${esc(date)}</span>
            <span>${esc(dur)}</span>
            <span class="${status.cls}"><i class="fa-solid ${status.icon}"></i> ${esc(status.label)}</span>
          </div>
          <button class="af-item-delete" data-af-action="delete-recording"
                  title="Delete recording" aria-label="Delete recording">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
    }).join('');
    // Per-item delete button. stopPropagation so the row's select handler
    // doesn't also fire when the trash icon is clicked.
    list.querySelectorAll('[data-af-action="delete-recording"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('[data-af-id]');
        if (!row) return;
        deleteRecording(row.dataset.afId, row.dataset.afPath, row.querySelector('.af-item-title')?.textContent || '');
      });
    });
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

    const isComplete = fm.transcript_status === 'complete' || fm.transcript_status === 'transcribed';
    const transcriptBlock = (isComplete && r.body && r.body.trim())
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
     State machine + UI sync
     ═══════════════════════════════════════════════════════════ */
  function dispatch(event) {
    machineState = reduce(machineState, event);
    renderToolbar();
    renderList(); // status badge can change for active recording
  }

  function renderToolbar() {
    const btn = $('[data-af-action="toggle-record"]');
    const label = ref('record-label');
    const meter = ref('meter');
    const elapsed = ref('elapsed');
    if (!btn) return;
    const s = machineState.status;
    const recording = s === 'recording';
    const busy = s === 'starting' || s === 'stopping' || s === 'creating' || s === 'transcribing';

    btn.classList.toggle('recording', recording);
    btn.disabled = busy;
    label.textContent = recording ? 'Stop' :
                        s === 'starting'    ? 'Starting…' :
                        s === 'stopping'    ? 'Stopping…' :
                        s === 'creating'    ? 'Saving…'   :
                        s === 'transcribing'? 'Transcribing…' : 'Record';
    meter.style.display = recording ? '' : 'none';

    const elapsedText = helpers.formatDuration(machineState.elapsed);
    const limitMin = machineState.autoStopMinutes;
    if (limitMin && limitMin > 0) {
      elapsed.textContent = `${elapsedText} / ${helpers.formatDuration(limitMin * 60)}`;
    } else {
      elapsed.textContent = elapsedText;
    }

    // Disable source checkboxes and auto-stop dropdown while not idle
    $('[data-af-source="system"]').disabled = (s !== 'idle');
    $('[data-af-source="mic"]').disabled    = (s !== 'idle');
    const autostopSelect = ref('autostop-select');
    if (autostopSelect) autostopSelect.disabled = (s !== 'idle');
    const micDeviceSelect = ref('mic-device-select');
    if (micDeviceSelect) micDeviceSelect.disabled = (s !== 'idle');
    // If a custom-entry panel happened to be open and we are no longer idle,
    // hide it (manual safety against weird edge timing).
    const custom = ref('autostop-custom');
    if (custom && s !== 'idle') custom.hidden = true;
  }

  function checkedSources() {
    const out = [];
    if ($('[data-af-source="system"]').checked) out.push('system');
    if ($('[data-af-source="mic"]').checked)    out.push('mic');
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     Tauri command wrappers
     ═══════════════════════════════════════════════════════════ */
  async function invokeStart(sources, micDeviceUID) {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    // Tauri's serde maps camelCase ↔ snake_case automatically; we pass
    // micDeviceUID and the Rust side receives mic_device_uid.
    return core.invoke('start_recording', {
      projectRoot,
      sources,
      micDeviceUID: micDeviceUID || null,
    });
  }
  async function invokeStop() {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    return core.invoke('stop_recording');
  }
  async function invokeStatus() {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    return core.invoke('get_recording_status');
  }
  async function invokeListDevices() {
    const core = tauriCore();
    if (!core) return [];
    try {
      const raw = await core.invoke('list_audio_devices');
      return normalizeDeviceList(raw);
    } catch (e) {
      console.warn('[AudioForge] list_audio_devices failed', e);
      return [];
    }
  }
  async function invokeCreate(payload) {
    const core = tauriCore();
    return core.invoke('run_recording_create', payload);
  }
  async function invokeTranscribe(id, model) {
    const core = tauriCore();
    return core.invoke('run_recording_transcribe', { projectRoot, id, model: model || 'large-v3-turbo' });
  }
  async function invokeDelete(relativePath) {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    return core.invoke('run_recording_delete', { projectRoot, relativePath });
  }

  async function invokeRecover() {
    const core = tauriCore();
    if (!core) return null;
    try {
      return await core.invoke('recover_orphaned_recording', { projectRoot });
    } catch (e) {
      console.warn('[AudioForge] recover_orphaned_recording failed', e);
      return null;
    }
  }

  function clearRecoveryBanner() {
    const banner = ref('recovery-banner');
    if (banner) banner.innerHTML = '';
  }

  function renderRecoveryBanner(active) {
    const banner = ref('recovery-banner');
    if (!banner) return;
    const startedFmt = helpers.formatTimestamp(active.started_at || '');
    banner.innerHTML = `
      <div class="af-recovery-banner">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>Previous recording <code>${esc(active.id)}</code> (${esc(startedFmt)}) was interrupted. Save the captured audio?</span>
        <button data-af-action="recover-save">Save</button>
        <button data-af-action="recover-discard">Discard</button>
      </div>
    `;
    banner.querySelector('[data-af-action="recover-save"]').addEventListener('click', () => recoverSave(active));
    banner.querySelector('[data-af-action="recover-discard"]').addEventListener('click', () => recoverDiscard(active));
  }

  async function recoverSave(active) {
    try {
      await invokeCreate({
        projectRoot,
        id: active.id,
        title: `Recovered recording ${active.id}`,
        durationSeconds: 0,
        sources: active.sources || [],
        files: active.files || {},
      });
      toast('Recovered recording saved.', 'info');
    } catch (e) {
      toast(`Failed to save recovered recording: ${friendlyError(e)}`, 'error');
    } finally {
      // Clean up active.json regardless.
      try {
        await ForgeFS.deleteFile(rootHandle, 'audio-forge/recordings/active.json');
      } catch (e) { /* not fatal */ }
      clearRecoveryBanner();
      await refresh();
    }
  }

  async function recoverDiscard(active) {
    // Delete the orphaned WAVs and active.json.
    const files = active.files || {};
    for (const k of Object.keys(files)) {
      const rel = relPath(projectRoot, files[k]);
      try { await ForgeFS.deleteFile(rootHandle, rel); }
      catch (e) { console.warn('[AudioForge] discard: failed to delete', rel, e); }
    }
    try { await ForgeFS.deleteFile(rootHandle, 'audio-forge/recordings/active.json'); }
    catch (e) { /* not fatal */ }
    clearRecoveryBanner();
    toast('Discarded.', 'info');
  }

  function relPath(root, abs) {
    if (!abs) return '';
    const r = String(root).replace(/\\/g, '/').replace(/\/$/, '');
    const a = String(abs).replace(/\\/g, '/');
    return a.startsWith(r + '/') ? a.slice(r.length + 1) : a;
  }

  /**
   * The auto-transcribe pipeline. Called from onToggleRecord after STOP_OK.
   * Sequences: run_recording_create → refresh list → run_recording_transcribe → refresh.
   */
  async function runStopPipeline(stopped, startedAt) {
    const id = stopped.id || machineState.id;
    const sources = machineState.sources && machineState.sources.length
      ? machineState.sources
      : checkedSources();
    const title = helpers.deriveTitle(startedAt || machineState.startedAt);
    try {
      await invokeCreate({
        projectRoot,
        id,
        title,
        durationSeconds: stopped.duration_seconds | 0,
        sources,
        files: stopped.files || {},
      });
    } catch (e) {
      dispatch({ type: 'CREATE_ERR', message: friendlyError(e) });
      toast(`Failed to save recording: ${friendlyError(e)}`, 'error');
      return;
    }
    dispatch({ type: 'CREATE_OK' });
    // Render the list immediately so the new pending entity shows up.
    await refresh();
    selectedId = id;
    renderList();
    renderDetail();

    try {
      await invokeTranscribe(id);
      dispatch({ type: 'TRANSCRIBE_OK' });
    } catch (e) {
      dispatch({ type: 'TRANSCRIBE_ERR', message: friendlyError(e) });
      toast(`Transcription failed: ${friendlyError(e)}`, 'error');
    }
    // Always refresh — forge-lib has updated the file's frontmatter either way.
    await refresh();
    selectedId = id;
    renderList();
    renderDetail();
  }

  async function deleteRecording(id, relativePath, title) {
    if (!id || !relativePath) return;
    // Don't allow deletion while a recording is in progress — the active.json
    // / state machine assumes the recording set is stable while busy.
    if (machineState.status !== 'idle') {
      toast('Cannot delete while a recording is in progress.', 'warn');
      return;
    }
    const label = (title || '').trim() || id;
    // Tauri 2's webview proxies window.confirm through the dialog plugin and
    // returns a Promise<boolean>, NOT a synchronous boolean. We must await so
    // the user actually sees the dialog before the delete fires. The await
    // form is also safe against a plain-browser fallback (which returns a
    // boolean synchronously) — `await <non-promise>` just resolves to the
    // value.
    const ok = await window.confirm(
      `Delete "${label}"?\n\nThis removes the markdown file, its audio files, and the index entry. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await invokeDelete(relativePath);
    } catch (e) {
      toast(`Delete failed: ${friendlyError(e)}`, 'error');
      return;
    }
    if (selectedId === id) selectedId = null;
    await refresh();
    renderDetail();
    toast('Recording deleted.', 'info');
  }

  async function retryTranscribe(id) {
    if (!id) return;
    // Drop into a transcribing-like UI for this id while the call runs.
    // We don't update machineState (it's idle) — instead, briefly mark the entity in the list.
    const list = ref('list');
    const itemEl = list && list.querySelector(`[data-af-id="${cssEscape(id)}"]`);
    if (itemEl) itemEl.style.opacity = '0.6';
    try {
      await invokeTranscribe(id);
      toast('Transcription complete.', 'info');
    } catch (e) {
      toast(`Retry failed: ${friendlyError(e)}`, 'error');
    } finally {
      await refresh();
      selectedId = id;
      renderList();
      renderDetail();
    }
  }

  function cssEscape(s) {
    return String(s).replace(/["\\\n]/g, '\\$&');
  }

  /* ═══════════════════════════════════════════════════════════
     Record / Stop click
     ═══════════════════════════════════════════════════════════ */
  async function onToggleRecord() {
    const s = machineState.status;
    if (s === 'idle') {
      const sources = checkedSources();
      if (sources.length === 0) {
        toast('Select at least one source (system or mic).', 'warn');
        return;
      }
      const autoStopMinutes = getAutoStopSelection();
      dispatch({ type: 'RECORD_CLICK', sources, autoStopMinutes });
      try {
        const micDeviceUID = (ref('mic-device-select') && ref('mic-device-select').value) || '';
        const started = await invokeStart(sources, micDeviceUID);
        const startedAt = new Date().toISOString();
        dispatch({
          type: 'START_OK',
          id: started.id,
          startedAt,
          files: started.files || {},
        });
      } catch (e) {
        dispatch({ type: 'START_ERR', message: friendlyError(e) });
        toast(friendlyError(e), 'error');
      }
      return;
    }
    if (s === 'recording') {
      dispatch({ type: 'STOP_CLICK' });
      try {
        const stopped = await invokeStop();
        // Stop just transitions to 'creating' here; Task 9 wires the pipeline.
        dispatch({
          type: 'STOP_OK',
          durationSeconds: stopped.duration_seconds,
          files: stopped.files || {},
        });
        const startedAt = machineState.startedAt;
        const stoppedSnapshot = Object.assign({}, stopped, { id: machineState.id });
        // Drop into 'creating' UI state via the dispatched STOP_OK above; runStopPipeline drives the rest.
        await runStopPipeline(stoppedSnapshot, startedAt);
      } catch (e) {
        dispatch({ type: 'STOP_ERR', message: friendlyError(e) });
        toast(friendlyError(e), 'error');
      }
      return;
    }
  }

  function friendlyError(e) {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    try { return JSON.stringify(e); } catch { return String(e); }
  }

  async function runAutoStop() {
    const minutes = machineState.autoStopMinutes;
    try {
      const stopped = await invokeStop();
      const startedAt = machineState.startedAt;
      const recordingId = machineState.id;
      dispatch({
        type: 'STOP_OK',
        durationSeconds: stopped.duration_seconds,
        files: stopped.files || {},
      });
      const label = (minutes === 1) ? '1 min' : `${minutes} min`;
      toast(
        `⏱ Auto-stopped after ${label} — transcription will continue in the background.`,
        'info'
      );
      const stoppedSnapshot = Object.assign({}, stopped, { id: recordingId });
      await runStopPipeline(stoppedSnapshot, startedAt);
    } catch (e) {
      dispatch({ type: 'STOP_ERR', message: friendlyError(e) });
      toast(friendlyError(e), 'error');
    }
  }

  function toast(msg, level) {
    if (window.ForgeUtils && ForgeUtils.Toast) {
      ForgeUtils.Toast.show(msg, level || 'info', 4000);
    } else {
      console.log(`[AudioForge ${level || 'info'}] ${msg}`);
    }
  }

  function maybeAutoStop() {
    if (machineState.status !== 'recording') return;
    if (machineState.autoStopFired) return;
    const limit = machineState.autoStopMinutes;
    if (!limit || limit <= 0) return;
    if (machineState.elapsed < limit * 60) return;
    dispatch({ type: 'STOP_CLICK', auto: true });
    runAutoStop();
  }

  /* ═══════════════════════════════════════════════════════════
     Tauri event subscriptions
     ═══════════════════════════════════════════════════════════ */
  async function ensureListeners() {
    if (listenersAttached) return;
    const evt = tauriEvent();
    if (!evt || typeof evt.listen !== 'function') {
      console.warn('[AudioForge] Tauri event API unavailable');
      return;
    }
    unlisteners.push(await evt.listen('audio-forge://meter', (e) => {
      const p = e.payload || {};
      // Sidecar emits meter events with shape { event: 'meter', system: 0..1, mic: 0..1 }
      // Some payloads may only have one channel — coerce missing to 0.
      dispatch({ type: 'METER', system: Number(p.system) || 0, mic: Number(p.mic) || 0 });
      renderMeterBars();
    }));
    unlisteners.push(await evt.listen('audio-forge://elapsed', (e) => {
      const p = e.payload || {};
      dispatch({ type: 'ELAPSED', seconds: Number(p.seconds) || 0 });
      maybeAutoStop();
    }));
    unlisteners.push(await evt.listen('audio-forge://error', (e) => {
      const p = e.payload || {};
      const msg = p.message || 'Recorder error';
      dispatch({ type: 'ERROR_EVENT', message: msg });
      toast(msg, 'error');
    }));
    unlisteners.push(await evt.listen('audio-forge://warning', (e) => {
      const p = e.payload || {};
      // We only display warnings; they do not affect the state machine.
      if (p.code === 'MIC_SILENT_AT_SOURCE') {
        toast(p.message || 'Microphone is producing silence.', 'warn');
      } else if (p.message) {
        toast(p.message, 'warn');
      }
    }));
    unlisteners.push(await evt.listen('audio-forge://terminated', () => {
      // The sidecar exits cleanly after a normal stop (state is 'stopping' or
      // beyond by then). Only treat termination as unexpected when we still
      // believe a capture is in progress (starting/recording).
      if (machineState.status === 'starting' || machineState.status === 'recording') {
        dispatch({ type: 'TERMINATED_EVENT' });
        toast('Recorder exited unexpectedly. Captured audio (if any) will appear after refresh.', 'warn');
      }
    }));
    // 'started' and 'stopped' events are handled inside the invoke awaits
    // (start_recording/stop_recording resolve when those events are seen).
    // We deliberately do NOT subscribe to them here to avoid double-handling.
    listenersAttached = true;
  }

  function renderMeterBars() {
    const sys = view().querySelector('[data-af-meter-bar="system"]');
    const mic = view().querySelector('[data-af-meter-bar="mic"]');
    if (!sys || !mic) return;
    sys.style.width = `${Math.round((machineState.meter.system || 0) * 100)}%`;
    mic.style.width = `${Math.round((machineState.meter.mic || 0) * 100)}%`;
  }

  /* ═══════════════════════════════════════════════════════════
     Status reconciliation on activation
     (handles the case where this controller mounted while a recording
      is already in progress in the same Tauri process — uncommon but
      possible if the user changed views mid-recording.)
     ═══════════════════════════════════════════════════════════ */
  async function reconcileStatus() {
    try {
      const s = await invokeStatus();
      if (s && s.is_recording) {
        machineState = Object.assign({}, initialState, {
          status: 'recording',
          id: s.id || null,
          startedAt: new Date(Date.now() - (s.elapsed_seconds || 0) * 1000).toISOString(),
          elapsed: s.elapsed_seconds || 0,
          sources: checkedSources(),
          autoStopMinutes: loadAutoStopPref(),
        });
        renderToolbar();
      }
    } catch (e) {
      console.warn('[AudioForge] reconcileStatus failed', e);
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

  async function populateMicDevices() {
    const select = ref('mic-device-select');
    if (!select) return;
    const devices = await invokeListDevices();
    const stored = loadMicDeviceUID();

    // Wipe everything except the default placeholder.
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (placeholder) {
      select.appendChild(placeholder);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(System default)';
      select.appendChild(opt);
    }

    for (const d of devices) {
      const opt = document.createElement('option');
      opt.value = d.uid;
      const tag = d.isDefault ? ' (default)' : '';
      opt.textContent = `${d.name}${tag}`;
      select.appendChild(opt);
    }

    // Restore prior selection if still available.
    if (stored && devices.some((d) => d.uid === stored)) {
      select.value = stored;
    } else {
      select.value = '';
      if (stored) {
        // The previously chosen device disappeared. Clear stored so we don't
        // keep "remembering" something the user can no longer see.
        saveMicDeviceUID('');
        toast('Previously selected mic is unavailable; falling back to system default.', 'warn');
      }
    }
  }

  function wireMicDeviceControl() {
    const select = ref('mic-device-select');
    if (!select) return;
    select.addEventListener('change', () => {
      saveMicDeviceUID(select.value || '');
    });
    // Refresh the device list every time the user opens the dropdown so
    // plug/unplug events are reflected without an app restart.
    select.addEventListener('mousedown', () => {
      populateMicDevices();
    });
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
      ensureListeners();
      renderToolbar();
      refresh();
      reconcileStatus();

      /* Re-apply sidebar state on every init. Sidebar.init is idempotent. */
      if (window.Sidebar) {
        window.Sidebar.init({
          pluginId: 'audio-forge',
          rootSelector: '#view-audio-forge',
          sidebarSelector: '.af-sidebar',
          toggleSelector: '[data-af-action="toggle-sidebar"]',
          resizerSelector: '.sidebar-resizer'
        });
      }

      // Orphan recovery
      invokeRecover().then((active) => {
        if (active) renderRecoveryBanner(active);
      });
    },
    refresh,
  };
})();

Shell.registerController('audio-forge', window.AudioForgeView);
