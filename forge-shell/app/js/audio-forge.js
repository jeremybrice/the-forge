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

  /* ── State ── */
  let initialized = false;
  let rootHandle = null;
  let projectRoot = null;
  let machineState = initialState;
  let recordings = [];
  let selectedId = null;
  let listenersAttached = false;
  let unlisteners = [];

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
    // Record button is no-op here; Task 7 wires it.
  }

  /* ═══════════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════════ */
  function setProjectRoot(handle) {
    rootHandle = handle;
    if (window.Shell && window.Shell.rootDirPath) {
      projectRoot = window.Shell.rootDirPath;
    }
  }

  async function refresh() {
    // Stub — Task 5 implements scanning.
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
