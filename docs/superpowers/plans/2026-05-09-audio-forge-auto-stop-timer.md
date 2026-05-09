# Audio Forge Auto-Stop Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Auto-stop after N minutes" timer to the Forge Shell Audio Forge toolbar so a recording stops itself at a user-chosen elapsed time and runs the existing create + transcribe pipeline.

**Architecture:** The Swift sidecar already emits `audio-forge://elapsed` events ~1 Hz. We enforce auto-stop entirely in the frontend: when an `ELAPSED` event arrives with `seconds >= autoStopMinutes * 60`, the controller dispatches the same stop flow a manual click would. Pure-reducer state changes; no Rust, no sidecar. The selection persists in `localStorage`. See `docs/superpowers/specs/2026-05-09-audio-forge-auto-stop-timer-design.md`.

**Tech Stack:** Vanilla JS IIFE controllers in `forge-shell/app/js/`, `node:test` harness in `forge-shell/test/`, plain CSS in `forge-shell/app/css/`.

---

## Task 1: Reducer state changes

Adds `autoStopMinutes` and `autoStopFired` to the state machine and wires the new event payload fields. Pure reducer work — fully unit-testable.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.reducer.js`
- Test: `forge-shell/test/audio-forge.reducer.test.js`

- [ ] **Step 1: Write the failing tests**

Append the following block to `forge-shell/test/audio-forge.reducer.test.js`, immediately above the `// ── helpers ──` line:

```javascript
test('initialState includes autoStop fields', () => {
  assert.equal(initialState.autoStopMinutes, 0);
  assert.equal(initialState.autoStopFired, false);
});

test('idle + RECORD_CLICK with autoStopMinutes carries it into state', () => {
  const next = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'],
    autoStopMinutes: 30,
  }));
  assert.equal(next.status, 'starting');
  assert.equal(next.autoStopMinutes, 30);
  assert.equal(next.autoStopFired, false);
});

test('idle + RECORD_CLICK without autoStopMinutes defaults to 0', () => {
  const next = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'],
  }));
  assert.equal(next.autoStopMinutes, 0);
});

test('starting + START_OK preserves autoStopMinutes', () => {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'],
    autoStopMinutes: 60,
  }));
  s = reduce(s, baseEvent('START_OK', {
    id: 'x',
    startedAt: '2026-05-09T10:00:00Z',
    files: { mic: '/a.mic.wav' },
  }));
  assert.equal(s.status, 'recording');
  assert.equal(s.autoStopMinutes, 60);
  assert.equal(s.autoStopFired, false);
});

test('recording + STOP_CLICK without auto leaves autoStopFired false', () => {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'], autoStopMinutes: 30,
  }));
  s = reduce(s, baseEvent('START_OK', {
    id: 'x', startedAt: 't', files: { mic: '/a.wav' },
  }));
  const next = reduce(s, baseEvent('STOP_CLICK'));
  assert.equal(next.status, 'stopping');
  assert.equal(next.autoStopFired, false);
});

test('recording + STOP_CLICK with auto:true sets autoStopFired', () => {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'], autoStopMinutes: 30,
  }));
  s = reduce(s, baseEvent('START_OK', {
    id: 'x', startedAt: 't', files: { mic: '/a.wav' },
  }));
  const next = reduce(s, baseEvent('STOP_CLICK', { auto: true }));
  assert.equal(next.status, 'stopping');
  assert.equal(next.autoStopFired, true);
});

test('recording + ERROR_EVENT resets autoStop fields', () => {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'], autoStopMinutes: 30,
  }));
  s = reduce(s, baseEvent('START_OK', {
    id: 'x', startedAt: 't', files: { mic: '/a.wav' },
  }));
  const next = reduce(s, baseEvent('ERROR_EVENT', { message: 'boom' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.autoStopMinutes, 0);
  assert.equal(next.autoStopFired, false);
});

test('transcribing + TRANSCRIBE_OK resets autoStop fields', () => {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['mic'], autoStopMinutes: 30,
  }));
  s = reduce(s, baseEvent('START_OK', {
    id: 'x', startedAt: 't', files: { mic: '/a.wav' },
  }));
  s = reduce(s, baseEvent('STOP_CLICK', { auto: true }));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 1800, files: s.files }));
  s = reduce(s, baseEvent('CREATE_OK'));
  const next = reduce(s, baseEvent('TRANSCRIBE_OK'));
  assert.equal(next.status, 'idle');
  assert.equal(next.autoStopMinutes, 0);
  assert.equal(next.autoStopFired, false);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd forge-shell && npm test -- test/audio-forge.reducer.test.js`
Expected: 8 new tests fail (most with `autoStopMinutes` undefined / not equal to expected).

- [ ] **Step 3: Update `initialState` in the reducer**

In `forge-shell/app/js/audio-forge.reducer.js`, replace the `initialState` block:

```javascript
  const initialState = Object.freeze({
    status: 'idle',         // 'idle' | 'starting' | 'recording' | 'stopping' | 'creating' | 'transcribing'
    id: null,
    startedAt: null,
    files: {},
    sources: [],
    elapsed: 0,
    meter: { system: 0, mic: 0 },
    error: null,
    autoStopMinutes: 0,    // 0 = Off; otherwise integer in [1, 240]
    autoStopFired: false,  // true once auto-stop has been triggered (idempotency)
  });
```

- [ ] **Step 4: Update the `idle + RECORD_CLICK` branch**

Replace the existing `'idle'` case body in `reduce()`:

```javascript
      case 'idle':
        if (event.type === 'RECORD_CLICK') {
          const m = Number(event.autoStopMinutes);
          const autoStopMinutes =
            Number.isFinite(m) && m >= 1 && m <= 240 ? Math.floor(m) : 0;
          return Object.assign({}, initialState, {
            status: 'starting',
            sources: event.sources || [],
            autoStopMinutes,
          });
        }
        return state;
```

- [ ] **Step 5: Update the `recording + STOP_CLICK` branch**

In the `'recording'` case, replace the `STOP_CLICK` handler:

```javascript
        if (event.type === 'STOP_CLICK') {
          return Object.assign({}, state, {
            status: 'stopping',
            autoStopFired: state.autoStopFired || event.auto === true,
          });
        }
```

- [ ] **Step 6: Run all reducer tests to verify they pass**

Run: `cd forge-shell && npm test -- test/audio-forge.reducer.test.js`
Expected: All tests pass (existing + 8 new).

- [ ] **Step 7: Commit**

```bash
git add forge-shell/app/js/audio-forge.reducer.js forge-shell/test/audio-forge.reducer.test.js
git commit -m "feat(audio-forge): add autoStopMinutes/autoStopFired to reducer

Introduces the state-machine fields needed for the auto-stop timer.
Pure reducer changes; controller wiring follows."
```

---

## Task 2: Toolbar markup + CSS

Adds the auto-stop dropdown and (hidden by default) custom-entry block to the toolbar scaffold, plus CSS to match the existing toolbar visual language. No behavior wiring yet — this task is purely structural.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js` (the `scaffold()` function, ~lines 52–101)
- Modify: `forge-shell/app/css/audio-forge.css`

- [ ] **Step 1: Update the toolbar HTML in `scaffold()`**

In `forge-shell/app/js/audio-forge.js`, locate the `scaffold()` function (around line 52). Find the toolbar block and insert the auto-stop markup *between* `af-source-checkboxes` and the record button. Replace the whole `<div class="plugin-toolbar">…</div>` block with:

```html
        <div class="plugin-toolbar">
          <span class="toolbar-title"><i class="fa-solid fa-microphone"></i> Audio Forge</span>

          <div class="af-source-checkboxes" data-af-ref="sources">
            <label><input type="checkbox" data-af-source="system" checked> system</label>
            <label><input type="checkbox" data-af-source="mic" checked> mic</label>
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
```

- [ ] **Step 2: Add the CSS**

Append to `forge-shell/app/css/audio-forge.css`:

```css
/* ── Auto-stop timer (toolbar) ───────────────────────────────── */
.af-autostop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.af-autostop-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.af-autostop select {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  padding: 4px 6px;
  cursor: pointer;
}
.af-autostop select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.af-autostop-custom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.af-autostop-custom input[type="number"] {
  width: 56px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  padding: 4px 6px;
}
.af-autostop-custom input[type="number"]:invalid,
.af-autostop-custom input[type="number"].af-invalid {
  border-color: #d33;
}
.af-autostop-custom-unit {
  color: var(--text-secondary);
}
.af-autostop-custom button {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
}
.af-autostop-custom button:hover:not(:disabled) {
  background: var(--bg-tertiary);
}
.af-autostop-custom button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify the dropdown renders without crashing**

Run: `cd forge-shell && npm test -- test/audio-forge.reducer.test.js`
Expected: Reducer tests still pass (no regressions).

(Visual verification is in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js forge-shell/app/css/audio-forge.css
git commit -m "feat(audio-forge): add auto-stop dropdown to toolbar scaffold

Markup + CSS for the auto-stop timer control. No behavior wired yet."
```

---

## Task 3: Persistence helpers + dropdown initialization

Adds `loadAutoStopPref()` / `saveAutoStopPref()` helpers and initializes the dropdown from `localStorage` during scaffold. No interactivity yet — that's Task 4.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add the persistence helpers**

In `forge-shell/app/js/audio-forge.js`, find the `/* ── DOM helpers ── */` block (around line 44). Immediately above it, add a new block:

```javascript
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
```

- [ ] **Step 2: Initialize the dropdown from persistence**

Find the bottom of `scaffold()` (around line 109, just after `wireSearch()` and before the closing `}`). Replace the closing portion with:

```javascript
    // Wire toolbar actions (interactivity in later tasks).
    $('[data-af-action="refresh"]').addEventListener('click', () => refresh());
    wireSearch();
    $('[data-af-action="toggle-record"]').addEventListener('click', () => {
      onToggleRecord();
    });

    initAutoStopDropdown();
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
```

- [ ] **Step 3: Smoke-test load/save in isolation**

There is no Node test harness for the controller (DOM-bound). Verify by inspection:
- `loadAutoStopPref()` returns `0` for missing key, valid int for `"30"`, `0` for `"abc"` or `"9999"`.
- `saveAutoStopPref(45)` writes `"45"`; `saveAutoStopPref("garbage")` writes `"0"`.

(Behavioral validation in the manual smoke test in Task 8.)

- [ ] **Step 4: Run the existing test suite to ensure no regressions**

Run: `cd forge-shell && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): persist auto-stop selection in localStorage

Adds load/save helpers and initialises the dropdown from the
last-used value on scaffold."
```

---

## Task 4: Wire dropdown change events + custom-entry flow

Adds the change listener on the dropdown, the open/Set/Cancel flow for `Custom…`, validation, and the `getAutoStopSelection()` helper that the controller will read on RECORD_CLICK.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add the dropdown change handler and custom-entry helpers**

In `forge-shell/app/js/audio-forge.js`, immediately below `setAutoStopDropdownValue()` (added in Task 3, Step 2), add:

```javascript
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
```

- [ ] **Step 2: Call `wireAutoStopControls()` from scaffold**

In `scaffold()`, replace the call to `initAutoStopDropdown();` with:

```javascript
    initAutoStopDropdown();
    wireAutoStopControls();
```

- [ ] **Step 3: Run the full test suite**

Run: `cd forge-shell && npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): wire auto-stop dropdown + custom-minutes entry

Change handler persists preset selections; Custom… reveals an inline
1–240 numeric input gated by Set/Cancel."
```

---

## Task 5: Pass `autoStopMinutes` through `RECORD_CLICK`

Wires the dropdown's committed selection into the dispatched RECORD_CLICK so the reducer sees it.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Update `onToggleRecord()` to include `autoStopMinutes`**

In `forge-shell/app/js/audio-forge.js`, find `onToggleRecord()` (around line 497). Replace the `idle` branch's `dispatch({ type: 'RECORD_CLICK', sources });` line with:

```javascript
      const autoStopMinutes = getAutoStopSelection();
      dispatch({ type: 'RECORD_CLICK', sources, autoStopMinutes });
```

- [ ] **Step 2: Run all tests**

Run: `cd forge-shell && npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): pass auto-stop selection on RECORD_CLICK

Reducer now receives the chosen minutes so the controller can
trigger auto-stop from the existing ELAPSED listener."
```

---

## Task 6: Auto-stop trigger + `runAutoStop()` + post-stop toast

The heart of the feature: when an `ELAPSED` event arrives at-or-past the threshold, dispatch `STOP_CLICK { auto: true }` and run the existing stop pipeline, ending with the auto-stop toast.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add the `runAutoStop()` helper**

In `forge-shell/app/js/audio-forge.js`, find `onToggleRecord()` (around line 497). Immediately after the `friendlyError(e)` function (around line 543), add a new function block:

```javascript
  async function runAutoStop() {
    const minutes = machineState.autoStopMinutes;
    try {
      const stopped = await invokeStop();
      dispatch({
        type: 'STOP_OK',
        durationSeconds: stopped.duration_seconds,
        files: stopped.files || {},
      });
      const startedAt = machineState.startedAt;
      const stoppedSnapshot = Object.assign({}, stopped, { id: machineState.id });
      await runStopPipeline(stoppedSnapshot, startedAt);
      const label = (minutes === 1) ? '1 min' : `${minutes} min`;
      toast(
        `⏱ Auto-stopped after ${label} — transcription will continue in the background.`,
        'info'
      );
    } catch (e) {
      dispatch({ type: 'STOP_ERR', message: friendlyError(e) });
      toast(friendlyError(e), 'error');
    }
  }
```

(`⏱` is the ⏱ stopwatch glyph; using the escape avoids any source-encoding ambiguity.)

- [ ] **Step 2: Augment the `audio-forge://elapsed` listener**

Find the `evt.listen('audio-forge://elapsed', …)` block in `ensureListeners()` (around line 575). Replace it with:

```javascript
    unlisteners.push(await evt.listen('audio-forge://elapsed', (e) => {
      const p = e.payload || {};
      dispatch({ type: 'ELAPSED', seconds: Number(p.seconds) || 0 });
      maybeAutoStop();
    }));
```

- [ ] **Step 3: Add the `maybeAutoStop()` guard**

Immediately above `ensureListeners()` (around line 561), add:

```javascript
  function maybeAutoStop() {
    if (machineState.status !== 'recording') return;
    if (machineState.autoStopFired) return;
    const limit = machineState.autoStopMinutes;
    if (!limit || limit <= 0) return;
    if (machineState.elapsed < limit * 60) return;
    dispatch({ type: 'STOP_CLICK', auto: true });
    runAutoStop();
  }
```

- [ ] **Step 4: Run the full test suite**

Run: `cd forge-shell && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): trigger auto-stop on elapsed threshold

When an ELAPSED event lands at or past autoStopMinutes*60 and we have
not already fired, dispatch STOP_CLICK{auto:true} and run the same
stop+create+transcribe pipeline a manual click runs, then surface a
post-stop toast."
```

---

## Task 7: Display "elapsed / total" + disable dropdown while recording

Updates `renderToolbar()` so the elapsed counter shows `<elapsed> / <total>` whenever a timer is set, and disables the auto-stop dropdown for any non-idle status.

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Update `renderToolbar()`**

Find `renderToolbar()` (around line 290). Replace the function body with:

```javascript
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
    // If a custom-entry panel happened to be open and we are no longer idle,
    // hide it (manual safety against weird edge timing).
    const custom = ref('autostop-custom');
    if (custom && s !== 'idle') custom.hidden = true;
  }
```

- [ ] **Step 2: Run the full test suite**

Run: `cd forge-shell && npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): show elapsed/total and lock dropdown while recording

When a timer is set the toolbar reads e.g. \"5:23 / 30:00\" so the
user sees both elapsed and the auto-stop target at a glance. The
dropdown disables for any non-idle status so it can't change mid-run."
```

---

## Task 8: Manual smoke test

End-to-end verification on a real machine. No code changes. The earlier reducer tests cover the state machine; this verifies the Tauri+sidecar integration and the persistence/UI behaviors that have no Node-testable surface.

**Files:**
- None modified.

- [ ] **Step 1: Build and launch the desktop app**

Run: `cd forge-shell && npm install && npm run tauri dev`
Expected: Desktop app opens; Audio Forge view loads with the new toolbar including the `Auto-stop: [Off ▾]` dropdown.

- [ ] **Step 2: Verify the dropdown options**

Click the Auto-stop dropdown. Confirm options are: Off, 30 min, 60 min, 90 min, Custom….

- [ ] **Step 3: Custom-entry validation**

- Pick **Custom…**. Confirm the inline number input and Set/Cancel buttons appear; Set is disabled; the dropdown shows the previously committed value.
- Type `999`. Confirm Set stays disabled and the input is highlighted as invalid.
- Type `0`. Confirm Set stays disabled.
- Type `45`, click **Set**. Confirm the dropdown now shows `45 min` and the input/Set/Cancel disappear.

- [ ] **Step 4: Persistence**

Quit the app (`⌘Q`). Relaunch with `npm run tauri dev`. Open Audio Forge. Confirm the dropdown still reads `45 min`.

- [ ] **Step 5: Custom-value 1 min recording end-to-end**

- In the dropdown, pick **Custom…**, type `1`, click Set.
- Tick **mic**, untick **system** (faster). Click **Record**.
- The elapsed counter should read `0:00 / 1:00` and tick up.
- Walk away ~70 seconds.
- On return, confirm:
  - Recording has stopped automatically.
  - A toast read approximately `⏱ Auto-stopped after 1 min — transcription will continue in the background.` (it auto-dismissed; if you missed it, that's fine — proceed to next bullet).
  - A new entry exists in the Recordings sidebar with duration ≈ `1:00`.
  - The status badge progresses to `transcribed` within the usual interval (or shows a transcription error if Whisper isn't set up — the auto-stop itself is what we're verifying).

- [ ] **Step 6: Manual-stop flow (no toast)**

- Set Auto-stop to **30 min**, click Record.
- After ~10 seconds click **Stop** manually.
- Confirm: no auto-stop toast appears. The recording entity is created normally. Status badge progresses to `transcribed` as usual.

- [ ] **Step 7: Off-mode parity**

- Set Auto-stop to **Off**. Click Record.
- The elapsed counter reads `0:00` (no `/ <total>` suffix).
- Click Stop after ~5 seconds. Confirm normal pipeline runs and there is no auto-stop toast.

- [ ] **Step 8: Disabled-while-recording**

- Set Auto-stop to **30 min**. Click Record.
- Confirm the auto-stop dropdown is greyed out / disabled. Try clicking it: it should not open.
- Click Stop. Confirm the dropdown re-enables once status returns to idle.

- [ ] **Step 9: Commit (if any code changes were made during smoke testing)**

If smoke testing surfaced bugs that required code changes, commit them with a follow-up commit. Otherwise, skip this step — no commit needed for the smoke test itself.
