# Audio Forge — Phase 2B (Forge Shell UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a view-only Audio Forge dashboard to Forge Shell that records system + microphone audio, automatically creates a recording entity on stop, automatically transcribes via local Whisper, and lets the user browse/play/re-transcribe prior recordings — all without leaving the desktop app.

**Architecture:** Single IIFE view controller (`audio-forge.js`) following the established `` / `` pattern. Pure-logic helpers extracted to `audio-forge.helpers.js` (UMD-style dual-export, unit-testable under `node:test`). Pure state-machine reducer in `audio-forge.reducer.js`, also unit-tested. The view scans `audio-forge/recordings/` via `ForgeFS`, listens to `audio-forge://*` Tauri events, and invokes the six Tauri commands shipped in Phase 2A. No new Rust/backend code.

**Tech Stack:** Vanilla JS (IIFE + `window.*` exports), HTML5 `<audio>`, Tauri 2.x (`@tauri-apps/api/core` `invoke` and `convertFileSrc`, `@tauri-apps/api/event` `listen`), `node:test` for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-08-audio-forge-shell-ui-design.md](../specs/2026-05-08-audio-forge-shell-ui-design.md)

**Branch:** `feat/audio-forge-phase-2b` (cut from `feat/audio-forge-phase-2a` once that branch is merged to main, OR cut from main if 2A has merged by execution time).

**Reference patterns to mirror:**
- View controller IIFE shape: `forge-shell/app/js/`
- Toolbar HTML pattern: `forge-shell/STYLE_GUIDE.md`
- Plugin nav registration: `forge-shell/app/js/shell.js:9-20`
- Controller registration: `forge-shell/app/js/shell.js:35-42`, lines `:447-452`
- `ForgeFS` API: `forge-shell/app/js/fs-adapter.js`
- Toasts / confirm dialog: `forge-shell/app/js/utils.js` (`ForgeUtils.Toast`, `ForgeUtils.Confirm`)

---

## Task 0: Branch setup and dependencies

**Files:**
- N/A (git + npm only)

- [ ] **Step 1: Confirm Phase 2A merge status and cut a feature branch**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature
git fetch
# If feat/audio-forge-phase-2a has merged to main:
git checkout main && git pull
git checkout -b feat/audio-forge-phase-2b
# Otherwise:
git checkout feat/audio-forge-phase-2a
git checkout -b feat/audio-forge-phase-2b
```

- [ ] **Step 2: Verify forge-lib and Phase 2A sidecar are present**

Run:
```bash
python3 forge-lib/forge.py recording --help | head -10
ls forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin
```

Expected: forge-lib prints subcommands `create | get | query | update | delete | transcribe | prune`. The sidecar binary exists and is executable.

If either is missing, stop — this plan assumes Phase 2A is already on the branch.

- [ ] **Step 3: Initialize the test directory and add the test npm script**

Create directory:
```bash
mkdir -p forge-shell/test
```

Modify `forge-shell/package.json`:

```diff
   "scripts": {
     "tauri:dev": "cd src-tauri && cargo tauri dev",
     "tauri:build": "cd src-tauri && cargo tauri build",
-    "tauri:build:mac": "cd src-tauri && cargo tauri build --target universal-apple-darwin"
+    "tauri:build:mac": "cd src-tauri && cargo tauri build --target universal-apple-darwin",
+    "test": "node --test test/"
   },
```

Verify:
```bash
cd forge-shell && npm test
```

Expected: prints `# tests 0` (no tests yet, but runner works). Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/package.json forge-shell/test/.gitkeep 2>/dev/null || true
touch forge-shell/test/.gitkeep
git add forge-shell/package.json forge-shell/test/.gitkeep
git commit -m "chore(forge-shell): add node:test infrastructure for Phase 2B"
```

---

## Task 1: Tauri assetProtocol scope for WAV playback

**Why this is first:** The audio playback in Task 6 needs `convertFileSrc()` to resolve absolute file paths, which requires the asset protocol to be enabled with a scope. Configuring it up front avoids a mid-implementation Tauri rebuild.

**Files:**
- Modify: `forge-shell/src-tauri/tauri.conf.json`

- [ ] **Step 1: Read the current tauri.conf.json**

```bash
cat forge-shell/src-tauri/tauri.conf.json
```

Locate the `app` block. It currently has `"security": { "csp": null }` or similar — confirm.

- [ ] **Step 2: Add the assetProtocol scope under `app.security`**

The block must end up looking like:

```json
"app": {
  "security": {
    "csp": null,
    "assetProtocol": {
      "enable": true,
      "scope": ["**/audio-forge/audio/*.wav"]
    }
  },
  ...other app keys unchanged...
}
```

Do not change any other key. Preserve existing CSP setting.

- [ ] **Step 3: Verify the JSON is valid**

```bash
python3 -c "import json; json.load(open('forge-shell/src-tauri/tauri.conf.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Rebuild Tauri to pick up config**

```bash
cd forge-shell && npm run tauri:dev
```

Expected: app launches without errors. Look for any `assetProtocol` parse errors in stderr — there should be none. Kill the dev server (Ctrl+C) once you confirm clean startup.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/src-tauri/tauri.conf.json
git commit -m "feat(forge-shell): enable assetProtocol for audio-forge WAV playback"
```

---

## Task 2: Pure helpers module + unit tests

**Files:**
- Create: `forge-shell/app/js/audio-forge.helpers.js`
- Create: `forge-shell/test/audio-forge.helpers.test.js`

The helpers module is UMD-style (works as both a `<script>` tag exporting `window.AudioForgeHelpers` and a Node `require()`). Write tests first, then the implementation.

- [ ] **Step 1: Write the failing test file**

Create `forge-shell/test/audio-forge.helpers.test.js`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../app/js/audio-forge.helpers.js');

test('formatDuration: zero seconds', () => {
  assert.equal(helpers.formatDuration(0), '0:00');
});

test('formatDuration: under a minute', () => {
  assert.equal(helpers.formatDuration(7), '0:07');
  assert.equal(helpers.formatDuration(59), '0:59');
});

test('formatDuration: minutes and seconds', () => {
  assert.equal(helpers.formatDuration(60), '1:00');
  assert.equal(helpers.formatDuration(258), '4:18');
  assert.equal(helpers.formatDuration(3599), '59:59');
});

test('formatDuration: hours', () => {
  assert.equal(helpers.formatDuration(3600), '1:00:00');
  assert.equal(helpers.formatDuration(3661), '1:01:01');
  assert.equal(helpers.formatDuration(36015), '10:00:15');
});

test('formatDuration: rejects negative and non-finite', () => {
  assert.equal(helpers.formatDuration(-5), '0:00');
  assert.equal(helpers.formatDuration(NaN), '0:00');
  assert.equal(helpers.formatDuration(Infinity), '0:00');
});

test('formatTimestamp: ISO date and time', () => {
  // Format: YYYY-MM-DD HH:MM
  assert.equal(
    helpers.formatTimestamp('2026-05-08T14:32:15Z'),
    '2026-05-08 14:32',
  );
});

test('formatTimestamp: invalid input returns empty string', () => {
  assert.equal(helpers.formatTimestamp(''), '');
  assert.equal(helpers.formatTimestamp('not-a-date'), '');
  assert.equal(helpers.formatTimestamp(null), '');
});

test('deriveTitle: from RFC3339 timestamp', () => {
  assert.equal(
    helpers.deriveTitle('2026-05-08T14:32:00Z'),
    'Recording 2026-05-08 14:32',
  );
});

test('deriveTitle: handles missing input', () => {
  assert.match(helpers.deriveTitle(''), /^Recording /);
});

test('parseFrontmatter: typical recording', () => {
  const md = [
    '---',
    'id: 2026-05-08T143200',
    'type: recording',
    'title: Sprint standup',
    'created: 2026-05-08T14:32:00',
    'duration_seconds: 258',
    'transcript_status: transcribed',
    'sources:',
    '  - system',
    '  - mic',
    'audio_files:',
    '  system: audio-forge/audio/2026-05-08T143200.system.wav',
    '  mic: audio-forge/audio/2026-05-08T143200.mic.wav',
    '---',
    '',
    '# Sprint standup',
    '',
    '**System**: Hello team.',
    '**You**: Hi.',
    '',
  ].join('\n');
  const { frontmatter, body } = helpers.parseFrontmatter(md);
  assert.equal(frontmatter.id, '2026-05-08T143200');
  assert.equal(frontmatter.title, 'Sprint standup');
  assert.equal(frontmatter.duration_seconds, 258);
  assert.equal(frontmatter.transcript_status, 'transcribed');
  assert.deepEqual(frontmatter.sources, ['system', 'mic']);
  assert.deepEqual(frontmatter.audio_files, {
    system: 'audio-forge/audio/2026-05-08T143200.system.wav',
    mic: 'audio-forge/audio/2026-05-08T143200.mic.wav',
  });
  assert.match(body, /\*\*System\*\*: Hello team\./);
});

test('parseFrontmatter: missing frontmatter delimiters', () => {
  const result = helpers.parseFrontmatter('# Just a body\n');
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, '# Just a body\n');
});

test('parseFrontmatter: integer-looking strings stay strings if quoted', () => {
  const md = '---\nid: "2026"\nduration_seconds: 42\n---\nbody';
  const { frontmatter } = helpers.parseFrontmatter(md);
  assert.equal(frontmatter.id, '2026');
  assert.equal(frontmatter.duration_seconds, 42);
});

test('statusBadge: maps each status to label + class', () => {
  assert.deepEqual(helpers.statusBadge('transcribed'), {
    label: 'transcribed', icon: 'fa-circle-check', cls: 'af-status-ok',
  });
  assert.deepEqual(helpers.statusBadge('failed'), {
    label: 'failed', icon: 'fa-triangle-exclamation', cls: 'af-status-failed',
  });
  assert.deepEqual(helpers.statusBadge('pending'), {
    label: 'pending', icon: 'fa-circle-pause', cls: 'af-status-pending',
  });
  assert.deepEqual(helpers.statusBadge('transcribing'), {
    label: 'transcribing', icon: 'fa-hourglass-half', cls: 'af-status-progress',
  });
  // Unknown status falls back to pending
  assert.equal(helpers.statusBadge('weird-status').cls, 'af-status-pending');
  assert.equal(helpers.statusBadge(undefined).cls, 'af-status-pending');
});
```

- [ ] **Step 2: Run the tests; confirm they fail**

```bash
cd forge-shell && npm test
```

Expected: cannot find module `../app/js/audio-forge.helpers.js`. All tests fail.

- [ ] **Step 3: Write the helpers module**

Create `forge-shell/app/js/audio-forge.helpers.js`:

```javascript
/* ═══════════════════════════════════════════════════════════════
   Audio Forge — Pure helpers (UMD-style)
   Importable as a <script> (window.AudioForgeHelpers) or via Node require().
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AudioForgeHelpers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function formatDuration(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
      return '0:00';
    }
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${m}:${ss}`;
  }

  function formatTimestamp(rfc3339) {
    if (!rfc3339 || typeof rfc3339 !== 'string') return '';
    const d = new Date(rfc3339);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mn = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mn}`;
  }

  function deriveTitle(rfc3339) {
    const ts = formatTimestamp(rfc3339) || formatTimestamp(new Date().toISOString());
    return `Recording ${ts}`;
  }

  /**
   * Minimal YAML frontmatter parser. Handles:
   *   - simple scalars (string, integer, boolean)
   *   - quoted strings (preserved as strings)
   *   - flat lists (- item)
   *   - nested single-level maps (audio_files: { system: ..., mic: ... } via indented keys)
   * Does NOT handle: anchors, aliases, multi-line strings, deeply nested structures.
   * That's intentional — recording frontmatter is shallow and known-shaped.
   */
  function parseFrontmatter(text) {
    if (typeof text !== 'string') return { frontmatter: {}, body: '' };
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { frontmatter: {}, body: text };
    const yaml = m[1];
    const body = m[2] || '';
    const fm = {};
    const lines = yaml.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      const topLevel = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!topLevel) { i++; continue; }
      const key = topLevel[1];
      const rest = topLevel[2];
      if (rest === '') {
        // Could be a list or a nested map — peek at next line.
        const nextLines = [];
        i++;
        while (i < lines.length && /^( {2,}|\t)/.test(lines[i])) {
          nextLines.push(lines[i]);
          i++;
        }
        if (nextLines.length === 0) { fm[key] = null; continue; }
        const isList = nextLines.every(l => /^\s+-\s+/.test(l));
        if (isList) {
          fm[key] = nextLines.map(l => l.replace(/^\s+-\s+/, '').trim()).map(unquote);
        } else {
          const obj = {};
          for (const sub of nextLines) {
            const sm = sub.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
            if (sm) obj[sm[1]] = coerce(sm[2]);
          }
          fm[key] = obj;
        }
      } else {
        fm[key] = coerce(rest);
        i++;
      }
    }
    return { frontmatter: fm, body };
  }

  function coerce(raw) {
    const v = raw.trim();
    if (v === '') return '';
    // Quoted string: keep as string, strip quotes.
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
    return v;
  }

  function unquote(v) {
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function statusBadge(status) {
    switch (status) {
      case 'transcribed':
        return { label: 'transcribed', icon: 'fa-circle-check', cls: 'af-status-ok' };
      case 'failed':
        return { label: 'failed', icon: 'fa-triangle-exclamation', cls: 'af-status-failed' };
      case 'transcribing':
        return { label: 'transcribing', icon: 'fa-hourglass-half', cls: 'af-status-progress' };
      case 'pending':
      default:
        return { label: 'pending', icon: 'fa-circle-pause', cls: 'af-status-pending' };
    }
  }

  return {
    formatDuration,
    formatTimestamp,
    deriveTitle,
    parseFrontmatter,
    statusBadge,
  };
});
```

- [ ] **Step 4: Run the tests; confirm they pass**

```bash
cd forge-shell && npm test
```

Expected: all 13 tests pass. `# tests 13`, `# pass 13`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.helpers.js forge-shell/test/audio-forge.helpers.test.js
git commit -m "feat(forge-shell): audio-forge pure helpers + unit tests"
```

---

## Task 3: State-machine reducer + unit tests

**Files:**
- Create: `forge-shell/app/js/audio-forge.reducer.js`
- Create: `forge-shell/test/audio-forge.reducer.test.js`

The reducer is a pure function `(state, event) -> state` that drives the toolbar's record button and the auto-transcribe pipeline. Extracted from the view so it's exhaustively unit-testable.

- [ ] **Step 1: Write the failing test**

Create `forge-shell/test/audio-forge.reducer.test.js`:

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reduce, initialState } = require('../app/js/audio-forge.reducer.js');

const baseEvent = (type, extra = {}) => Object.assign({ type }, extra);

test('initialState shape', () => {
  assert.equal(initialState.status, 'idle');
  assert.equal(initialState.id, null);
  assert.equal(initialState.startedAt, null);
  assert.deepEqual(initialState.files, {});
  assert.deepEqual(initialState.sources, []);
  assert.equal(initialState.elapsed, 0);
  assert.deepEqual(initialState.meter, { system: 0, mic: 0 });
  assert.equal(initialState.error, null);
});

test('idle + RECORD_CLICK → starting', () => {
  const next = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['system', 'mic'],
  }));
  assert.equal(next.status, 'starting');
  assert.deepEqual(next.sources, ['system', 'mic']);
  assert.equal(next.error, null);
});

test('starting + START_OK → recording', () => {
  const s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['mic'] }));
  const next = reduce(s, baseEvent('START_OK', {
    id: '2026-05-08T143200',
    startedAt: '2026-05-08T14:32:00Z',
    files: { mic: '/abs/path.mic.wav' },
  }));
  assert.equal(next.status, 'recording');
  assert.equal(next.id, '2026-05-08T143200');
  assert.equal(next.startedAt, '2026-05-08T14:32:00Z');
  assert.deepEqual(next.files, { mic: '/abs/path.mic.wav' });
});

test('starting + START_ERR → idle with error', () => {
  const s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['mic'] }));
  const next = reduce(s, baseEvent('START_ERR', { message: 'permission denied' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'permission denied');
  assert.equal(next.id, null);
});

test('recording + METER → updates meter only', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('METER', { system: 0.4, mic: 0.7 }));
  assert.equal(next.status, 'recording');
  assert.deepEqual(next.meter, { system: 0.4, mic: 0.7 });
  // Other fields unchanged
  assert.equal(next.id, s.id);
  assert.equal(next.startedAt, s.startedAt);
});

test('recording + ELAPSED → updates elapsed', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('ELAPSED', { seconds: 12 }));
  assert.equal(next.elapsed, 12);
  assert.equal(next.status, 'recording');
});

test('recording + STOP_CLICK → stopping', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('STOP_CLICK'));
  assert.equal(next.status, 'stopping');
});

test('stopping + STOP_OK → creating', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  const next = reduce(s, baseEvent('STOP_OK', {
    durationSeconds: 30,
    files: { mic: '/abs/path.mic.wav' },
  }));
  assert.equal(next.status, 'creating');
  assert.equal(next.elapsed, 30);
  assert.deepEqual(next.files, { mic: '/abs/path.mic.wav' });
});

test('creating + CREATE_OK → transcribing', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  const next = reduce(s, baseEvent('CREATE_OK'));
  assert.equal(next.status, 'transcribing');
});

test('creating + CREATE_ERR → idle with error, retains id and files', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  const next = reduce(s, baseEvent('CREATE_ERR', { message: 'spawn failed' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'spawn failed');
});

test('transcribing + TRANSCRIBE_OK → idle, clears active id', () => {
  let s = transcribingState();
  const next = reduce(s, baseEvent('TRANSCRIBE_OK'));
  assert.equal(next.status, 'idle');
  assert.equal(next.id, null);
  assert.equal(next.error, null);
});

test('transcribing + TRANSCRIBE_ERR → idle with error, clears active id', () => {
  let s = transcribingState();
  const next = reduce(s, baseEvent('TRANSCRIBE_ERR', { message: 'whisper failed' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.id, null);
  assert.equal(next.error, 'whisper failed');
});

test('recording + ERROR_EVENT → idle with error', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('ERROR_EVENT', { message: 'sidecar exploded' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'sidecar exploded');
});

test('recording + TERMINATED_EVENT → idle', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('TERMINATED_EVENT'));
  assert.equal(next.status, 'idle');
});

test('idle + unhandled event types → unchanged', () => {
  const next = reduce(initialState, baseEvent('METER', { system: 0.1, mic: 0.1 }));
  assert.deepEqual(next, initialState);
});

test('reducer never mutates input state', () => {
  const s = recordingState();
  const snapshot = JSON.parse(JSON.stringify(s));
  reduce(s, baseEvent('METER', { system: 0.9, mic: 0.9 }));
  reduce(s, baseEvent('STOP_CLICK'));
  assert.deepEqual(s, snapshot);
});

// ── helpers ──
function recordingState() {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['system', 'mic'] }));
  s = reduce(s, baseEvent('START_OK', {
    id: '2026-05-08T143200',
    startedAt: '2026-05-08T14:32:00Z',
    files: { system: '/a.system.wav', mic: '/a.mic.wav' },
  }));
  return s;
}

function transcribingState() {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  s = reduce(s, baseEvent('CREATE_OK'));
  return s;
}
```

- [ ] **Step 2: Run tests; confirm they fail**

```bash
cd forge-shell && npm test
```

Expected: cannot find module `audio-forge.reducer.js`. All new tests fail. (Helpers tests still pass.)

- [ ] **Step 3: Implement the reducer**

Create `forge-shell/app/js/audio-forge.reducer.js`:

```javascript
/* ═══════════════════════════════════════════════════════════════
   Audio Forge — State Machine Reducer (pure)
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AudioForgeReducer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const initialState = Object.freeze({
    status: 'idle',         // 'idle' | 'starting' | 'recording' | 'stopping' | 'creating' | 'transcribing'
    id: null,
    startedAt: null,
    files: {},
    sources: [],
    elapsed: 0,
    meter: { system: 0, mic: 0 },
    error: null,
  });

  function reduce(state, event) {
    switch (state.status) {
      case 'idle':
        if (event.type === 'RECORD_CLICK') {
          return Object.assign({}, initialState, {
            status: 'starting',
            sources: event.sources || [],
          });
        }
        return state;

      case 'starting':
        if (event.type === 'START_OK') {
          return Object.assign({}, state, {
            status: 'recording',
            id: event.id,
            startedAt: event.startedAt,
            files: event.files || {},
            elapsed: 0,
            meter: { system: 0, mic: 0 },
            error: null,
          });
        }
        if (event.type === 'START_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'start failed' });
        }
        return state;

      case 'recording':
        if (event.type === 'METER') {
          return Object.assign({}, state, {
            meter: {
              system: clampUnit(event.system),
              mic: clampUnit(event.mic),
            },
          });
        }
        if (event.type === 'ELAPSED') {
          return Object.assign({}, state, { elapsed: Math.max(0, event.seconds | 0) });
        }
        if (event.type === 'STOP_CLICK') {
          return Object.assign({}, state, { status: 'stopping' });
        }
        if (event.type === 'ERROR_EVENT') {
          return Object.assign({}, initialState, { error: event.message || 'recorder error' });
        }
        if (event.type === 'TERMINATED_EVENT') {
          return Object.assign({}, initialState);
        }
        return state;

      case 'stopping':
        if (event.type === 'STOP_OK') {
          return Object.assign({}, state, {
            status: 'creating',
            elapsed: Math.max(0, event.durationSeconds | 0),
            files: event.files || state.files,
          });
        }
        if (event.type === 'STOP_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'stop failed' });
        }
        return state;

      case 'creating':
        if (event.type === 'CREATE_OK') {
          return Object.assign({}, state, { status: 'transcribing' });
        }
        if (event.type === 'CREATE_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'create failed' });
        }
        return state;

      case 'transcribing':
        if (event.type === 'TRANSCRIBE_OK') {
          return Object.assign({}, initialState);
        }
        if (event.type === 'TRANSCRIBE_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'transcribe failed' });
        }
        return state;

      default:
        return state;
    }
  }

  function clampUnit(x) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
    return Math.min(1, Math.max(0, x));
  }

  return { initialState, reduce };
});
```

- [ ] **Step 4: Run tests; confirm all pass**

```bash
cd forge-shell && npm test
```

Expected: all helper + reducer tests pass. `# tests 30`, `# pass 30`, `# fail 0` (13 helpers + 17 reducer).

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.reducer.js forge-shell/test/audio-forge.reducer.test.js
git commit -m "feat(forge-shell): audio-forge state-machine reducer + unit tests"
```

---

## Task 4: Nav registration + view scaffold + CSS file

**Files:**
- Create: `forge-shell/app/css/audio-forge.css`
- Create: `forge-shell/app/js/audio-forge.js` (skeleton only)
- Modify: `forge-shell/app/index.html`
- Modify: `forge-shell/app/js/shell.js` (one line in plugins array)

This task wires the new view into the shell so the nav item appears, the empty view loads, and the toolbar renders. No interactivity yet.

- [ ] **Step 1: Add the plugin entry to shell.js**


```diff
+  { id: 'audio-forge',         label: 'Audio Forge',      icon: 'fa-solid fa-microphone',     requiredDir: 'audio-forge' },
 ];
```

- [ ] **Step 2: Add the view slot, css, and script tag in index.html**

In `forge-shell/app/index.html`:

1. After the existing `<link rel="stylesheet" href="css/">` (around line 21), add:

```html
  <link rel="stylesheet" href="css/audio-forge.css">
```

2. After the existing `<!-- a removed harvest plugin View -->` div block (around line 99), add:

```html
      <!-- Audio Forge View -->
      <div id="view-audio-forge" class="shell-view">
        <!-- Rendered by AudioForgeView controller -->
      </div>
```

3. After the script tag for `` (around line 134), add:

```html
  <script src="js/audio-forge.helpers.js"></script>
  <script src="js/audio-forge.reducer.js"></script>
  <script src="js/audio-forge.js"></script>
```

- [ ] **Step 3: Create the CSS file**

Create `forge-shell/app/css/audio-forge.css`:

```css
/* ═══════════════════════════════════════════════════════════════
   Audio Forge — view styles
   All colors via CSS custom properties from theme.css.
   ═══════════════════════════════════════════════════════════════ */

#view-audio-forge {
  display: none;
  height: 100%;
  overflow: hidden;
}

#view-audio-forge.active {
  display: flex;
  flex-direction: column;
}

.af-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

/* Toolbar */
.af-toolbar-spacer { flex: 1; }

.af-source-checkboxes {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.af-source-checkboxes label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.af-source-checkboxes input[type="checkbox"] {
  cursor: pointer;
}

.af-record-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}
.af-record-btn:hover:not(:disabled) { background: var(--bg-tertiary); }
.af-record-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.af-record-btn.recording {
  background: var(--af-record-bg, #d33);
  color: white;
  border-color: var(--af-record-bg, #d33);
}
.af-record-btn .af-record-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d33;
}
.af-record-btn.recording .af-record-dot {
  background: white;
  border-radius: 2px;
}

.af-elapsed {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 0 8px;
  min-width: 56px;
  text-align: center;
}

.af-meter {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 60px;
}
.af-meter-bar {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}
.af-meter-bar > div {
  height: 100%;
  width: 0;
  background: var(--accent);
  transition: width 0.05s linear;
}

/* Main split */
.af-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.af-sidebar {
  width: 320px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.af-sidebar-header {
  padding: 10px 14px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.af-search {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}
.af-search input {
  width: 100%;
  padding: 6px 10px 6px 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}
.af-search i {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.af-list {
  flex: 1;
  overflow-y: auto;
}
.af-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.af-item:hover { background: var(--bg-tertiary); }
.af-item.selected {
  background: var(--bg-tertiary);
  border-left: 3px solid var(--accent);
  padding-left: 11px;
}
.af-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.af-item-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
}

.af-status-ok       { color: var(--success, #22a565); }
.af-status-failed   { color: var(--danger, #d33); }
.af-status-pending  { color: var(--text-muted); }
.af-status-progress { color: var(--accent); }

/* Detail */
.af-detail {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: var(--bg-primary);
}
.af-detail-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}
.af-detail-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
.af-detail-meta {
  color: var(--text-muted);
  font-size: 13px;
}
.af-detail-section { margin-top: 20px; }
.af-audio-player {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.af-audio-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.af-audio-player audio { width: 100%; }

.af-transcript {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--text-primary);
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.af-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
  padding: 40px;
  text-align: center;
}
.af-empty i { font-size: 48px; opacity: 0.5; }

.af-recovery-banner {
  background: var(--bg-warning, #fff3cd);
  color: var(--text-warning, #856404);
  border-bottom: 1px solid var(--border-color);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.af-recovery-banner button {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.af-retry-btn {
  margin-left: 6px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
```

- [ ] **Step 4: Create the view-controller skeleton**

Create `forge-shell/app/js/audio-forge.js`:

```javascript
/* ═══════════════════════════════════════════════════════════════
   Audio Forge View Controller
   Records system + mic via Tauri sidecar, browses + transcribes recordings.
   Pattern matches  / .
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
```

- [ ] **Step 5: Verify by launching the app**

```bash
cd forge-shell && npm run tauri:dev
```

Open the app. Click **Audio Forge** in the sidebar.
Expected:
- Nav item with microphone icon visible.
- Toolbar shows: 🎙 Audio Forge | system ☑ mic ☑ | ⏺ Record | 0:00 | refresh button.
- Main area: left sidebar "Recordings (0)" with an empty list, right pane shows microphone empty-state.
- No console errors related to `AudioForgeView`, `AudioForgeHelpers`, or `AudioForgeReducer`.

If Tauri dev fails to start, check `tauri.conf.json` from Task 1.

Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/index.html forge-shell/app/js/shell.js \
        forge-shell/app/js/audio-forge.js forge-shell/app/css/audio-forge.css
git commit -m "feat(forge-shell): audio-forge nav + view scaffold + CSS"
```

---

## Task 5: Disk scan + list rendering (read-only)

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

This task makes the recordings list populate by scanning `audio-forge/recordings/` for markdown files and rendering items. The list is interactive (click to select), but the detail panel is still placeholder — that's Task 6.

- [ ] **Step 1: Confirm ForgeFS API names**

Re-verify the API:

```bash
grep -n "listMarkdownFiles\|readFile\|getFileMeta" forge-shell/app/js/fs-adapter.js | head
```

Expected functions: `ForgeFS.listMarkdownFiles(handle, relativePath)` returning `[{ path, name, ... }]`, `ForgeFS.readFile(handle, path)` returning text. (If signatures differ, adapt the calls below to match.)

- [ ] **Step 2: Implement `scanRecordings` and list rendering**

Open `forge-shell/app/js/audio-forge.js`. Replace the stub `refresh()` with a real implementation, and add the supporting functions. Also add filter / search state.

Replace the section starting `async function refresh()` and add the new functions. Final structure:

```javascript
  /* ── State (additions) ── */
  let searchQuery = '';

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
    // Stub — Task 6 implements detail rendering.
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
    detail.innerHTML = `<div class="af-detail-title">${esc(r.frontmatter.title || '')}</div>`;
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
```

In `scaffold()`, after the existing `addEventListener('click', () => refresh())`, add:

```javascript
    wireSearch();
```

- [ ] **Step 3: Seed the test directory with one fixture recording**

Create one fake recording markdown so the list has something to render. From the repo root:

```bash
mkdir -p audio-forge/recordings audio-forge/audio
cat > audio-forge/recordings/2026-05-08-fixture.md <<'EOF'
---
id: 2026-05-08T120000
type: recording
title: Fixture for list rendering
created: 2026-05-08T12:00:00
updated: 2026-05-08T12:00:00
duration_seconds: 92
sources:
  - system
  - mic
audio_files:
  system: audio-forge/audio/2026-05-08T120000.system.wav
  mic: audio-forge/audio/2026-05-08T120000.mic.wav
transcript_status: transcribed
---

# Fixture for list rendering

**System**: Hello.
**You**: Hi.
EOF
```

- [ ] **Step 4: Verify in dev**

```bash
cd forge-shell && npm run tauri:dev
```

Click Audio Forge.
Expected:
- Sidebar header reads `Recordings (1)`.
- One list item visible: "Fixture for list rendering" with `2026-05-08`, `1:32`, ✓ transcribed badge.
- Clicking the item highlights it (left accent border) and the right pane shows the title.
- Typing `xyz` into the search box hides the item; clearing it brings it back.

Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js audio-forge/recordings/2026-05-08-fixture.md
git commit -m "feat(forge-shell): scan audio-forge/recordings and render list"
```

---

## Task 6: Detail panel + audio playback

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add the audio-src helper at the top of the IIFE**

Below the `esc` declaration in `audio-forge.js`, add:

```javascript
  function tauriCore() { return (window.__TAURI__ && window.__TAURI__.core) || null; }
  function tauriEvent() { return (window.__TAURI__ && window.__TAURI__.event) || null; }

  /**
   * Resolve a project-relative WAV path into a webview-loadable src.
   * Uses Tauri's convertFileSrc (asset:// scheme) so the audio element
   * can play files outside the bundled app.
   */
  function audioSrc(relPath) {
    if (!relPath) return '';
    const abs = `${projectRoot}/${relPath}`.replace(/\\/g, '/');
    const core = tauriCore();
    if (core && typeof core.convertFileSrc === 'function') {
      return core.convertFileSrc(abs);
    }
    // Browser-mode fallback (read-only): not supported, leave blank.
    return '';
  }
```

- [ ] **Step 2: Replace `renderDetail` with the real implementation**

```javascript
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
    // Wire the retry button — Task 8 implements retryTranscribe.
    const retryBtn = detail.querySelector('[data-af-action="retry-transcribe"]');
    if (retryBtn && typeof retryTranscribe === 'function') {
      retryBtn.addEventListener('click', () => retryTranscribe(retryBtn.dataset.afId));
    }
  }
```

- [ ] **Step 3: Verify with a real recording fixture**

The fixture from Task 5 references WAV paths that don't exist on disk. Generate two short silent WAVs to make the audio elements playable (this is just to validate the asset protocol resolves; the content doesn't matter):

```bash
# Use ffmpeg if available (commonly installed on dev machines):
which ffmpeg && ffmpeg -y -f lavfi -i "anullsrc=r=48000:cl=mono" -t 2 \
  -c:a pcm_s16le audio-forge/audio/2026-05-08T120000.system.wav 2>/dev/null
which ffmpeg && ffmpeg -y -f lavfi -i "anullsrc=r=48000:cl=mono" -t 2 \
  -c:a pcm_s16le audio-forge/audio/2026-05-08T120000.mic.wav 2>/dev/null

# If ffmpeg is not available, fall back to creating empty files (audio elements
# will show "broken audio" but the rest of the UI still renders):
[ -f audio-forge/audio/2026-05-08T120000.system.wav ] || \
  touch audio-forge/audio/2026-05-08T120000.system.wav
[ -f audio-forge/audio/2026-05-08T120000.mic.wav ] || \
  touch audio-forge/audio/2026-05-08T120000.mic.wav
```

- [ ] **Step 4: Verify in dev**

```bash
cd forge-shell && npm run tauri:dev
```

Click Audio Forge → click the fixture item.
Expected:
- Right pane shows title "Fixture for list rendering", meta "2026-05-08 12:00 · 1:32 · ✓ transcribed".
- Two audio players visible labeled "System" and "Mic".
- If ffmpeg generated real silence, both play 2 seconds of nothing. If not, the players show duration `--:--` but no error.
- Transcript block shows the body markdown rendered as preformatted text.

If the audio players show a 404 or "asset not allowed" error, the assetProtocol scope from Task 1 didn't take effect — restart Tauri dev with `cargo clean && npm run tauri:dev`.

Kill the dev server. **Do not commit the WAV fixtures** (binary, irrelevant to the test).

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): audio-forge detail panel with audio playback"
```

---

## Task 7: Toolbar Record/Stop wiring + state machine integration

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

This task connects the Record button to the Tauri `start_recording` command, drives UI updates from the state-machine reducer, and wires the source checkboxes. Live event subscriptions (meter, elapsed) come in Task 8; the auto-transcribe pipeline is Task 9.

- [ ] **Step 1: Add state-application + invoke wrappers**

In `audio-forge.js`, after the `audioSrc` helper, add:

```javascript
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
    elapsed.textContent = helpers.formatDuration(machineState.elapsed);

    // Disable source checkboxes while not idle
    $('[data-af-source="system"]').disabled = (s !== 'idle');
    $('[data-af-source="mic"]').disabled    = (s !== 'idle');
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
  async function invokeStart(sources) {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    return core.invoke('start_recording', { projectRoot, sources });
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
      dispatch({ type: 'RECORD_CLICK', sources });
      try {
        const started = await invokeStart(sources);
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
        // Task 9 replaces this stub with the create+transcribe call:
        dispatch({ type: 'CREATE_OK' });
        dispatch({ type: 'TRANSCRIBE_OK' });
        await refresh();
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

  function toast(msg, level) {
    if (window.ForgeUtils && ForgeUtils.Toast) {
      ForgeUtils.Toast.show(msg, level || 'info', 4000);
    } else {
      console.log(`[AudioForge ${level || 'info'}] ${msg}`);
    }
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
        });
        renderToolbar();
      }
    } catch (e) {
      console.warn('[AudioForge] reconcileStatus failed', e);
    }
  }
```

- [ ] **Step 2: Wire the Record button in `scaffold()`**

Replace the comment `// Record button is no-op here; Task 7 wires it.` with:

```javascript
    $('[data-af-action="toggle-record"]').addEventListener('click', () => {
      onToggleRecord();
    });
```

- [ ] **Step 3: Call `reconcileStatus()` from `init()` after `refresh()`**

Update the public `init`:

```javascript
    init(handle) {
      setProjectRoot(handle);
      if (!initialized) {
        scaffold();
        initialized = true;
      }
      renderToolbar();
      refresh();
      reconcileStatus();
    },
```

- [ ] **Step 4: Verify in dev (no audio playing required for this task)**

```bash
cd forge-shell && npm run tauri:dev
```

In Audio Forge:
- Uncheck both `system` and `mic`. Click Record. Expected: a toast "Select at least one source…" and no state change.
- Re-check both. Click Record. Expected: Button label briefly says "Starting…", then "Stop", source checkboxes disable. Elapsed stays at `0:00` (Task 8 wires the elapsed event).
- Click Stop. Expected: Button briefly cycles "Stopping…" → "Saving…" → "Transcribing…" → "Record". (These are stubbed transitions — actual create+transcribe is Task 9.) After stop, list refreshes; the WAVs landed in `audio-forge/audio/` but no recording entity yet.
- Repeat with only `mic` checked: should also work (system not requested).

Open DevTools console; expect no red errors during the cycle.

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): audio-forge Record/Stop button + reducer wiring"
```

---

## Task 8: Live Tauri event subscriptions (meter, elapsed, error, terminated)

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add `ensureListeners()` and live-meter rendering**

In `audio-forge.js`, after the `friendlyError` helper, add:

```javascript
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
    }));
    unlisteners.push(await evt.listen('audio-forge://error', (e) => {
      const p = e.payload || {};
      const msg = p.message || 'Recorder error';
      dispatch({ type: 'ERROR_EVENT', message: msg });
      toast(msg, 'error');
    }));
    unlisteners.push(await evt.listen('audio-forge://terminated', () => {
      // Only act if we believe we're still recording.
      if (machineState.status !== 'idle') {
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
```

- [ ] **Step 2: Call `ensureListeners()` from `init()`**

Update the public `init`:

```javascript
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
    },
```

- [ ] **Step 3: Verify in dev — record with audio playing in the background**

Play any audio on the Mac (YouTube tab, Music app). Then:

```bash
cd forge-shell && npm run tauri:dev
```

In Audio Forge → click Record. Expected:
- Meter bars (the two thin horizontal stripes left of the spacer) animate as audio levels change.
- Elapsed timer increments: `0:01`, `0:02`, …
- Click Stop after ~5 seconds. Timer freezes; meter bars stay at their last value (visually fine — they hide on next state change).

Open DevTools console; you should not see warnings about `audio-forge://meter` or `elapsed` listener errors.

Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): subscribe to audio-forge meter/elapsed/error events"
```

---

## Task 9: Stop pipeline — auto-create + auto-transcribe

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

This is the most consequential task. Replace the stubbed `dispatch({ type: 'CREATE_OK' }); dispatch({ type: 'TRANSCRIBE_OK' });` from Task 7 with real `run_recording_create` + `run_recording_transcribe` invocations.

- [ ] **Step 1: Add the pipeline functions**

After `invokeStatus`, add:

```javascript
  async function invokeCreate(payload) {
    const core = tauriCore();
    return core.invoke('run_recording_create', payload);
  }
  async function invokeTranscribe(id, model) {
    const core = tauriCore();
    return core.invoke('run_recording_transcribe', { projectRoot, id, model: model || 'large-v3-turbo' });
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
```

- [ ] **Step 2: Replace the stop-stub in `onToggleRecord`**

Find the lines added in Task 7:

```javascript
        // Task 9 replaces this stub with the create+transcribe call:
        dispatch({ type: 'CREATE_OK' });
        dispatch({ type: 'TRANSCRIBE_OK' });
        await refresh();
```

Replace with:

```javascript
        const startedAt = machineState.startedAt;
        const stoppedSnapshot = Object.assign({}, stopped, { id: machineState.id });
        // Drop into 'creating' UI state via the dispatched STOP_OK above; runStopPipeline drives the rest.
        await runStopPipeline(stoppedSnapshot, startedAt);
```

- [ ] **Step 3: Verify end-to-end with real audio**

Play audio in the background (e.g. a YouTube clip). Then:

```bash
cd forge-shell && npm run tauri:dev
```

In Audio Forge:
1. Click Record (both sources checked). Wait 6–8 seconds. Click Stop.
2. The toolbar cycles: Stop → Stopping… → Saving… → (list refreshes, new item appears with ⏸ pending or ⏳ transcribing) → Transcribing… (1–2 minutes for a few seconds of audio with `large-v3-turbo`).
3. When transcribe completes, the list item flips to ✓ transcribed.
4. The detail panel shows the title `Recording <YYYY-MM-DD HH:MM>`, two audio players, and the transcript body with `**System**:` / `**You**:` lines.

Inspect the markdown directly:

```bash
ls audio-forge/recordings/ | tail -3
cat audio-forge/recordings/<latest>.md | head -25
```

Expected: frontmatter includes `transcript_status: transcribed`, `audio_files: { system: ..., mic: ... }`, body has interleaved `**System**:` and `**You**:` lines.

Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): auto-transcribe pipeline on stop"
```

---

## Task 10: Failed-state retry + error toasts polish

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

The Retry button was wired in Task 6's renderDetail to look for `retryTranscribe`. This task implements it.

- [ ] **Step 1: Implement `retryTranscribe`**

After `runStopPipeline`, add:

```javascript
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
```

- [ ] **Step 2: Sanity-check by simulating a Whisper failure**

To exercise the failed path without breaking your Whisper install: temporarily make a recording fail by editing one of the existing recording markdown files to set `transcript_status: failed`:

```bash
# pick the most recent one
LATEST=$(ls -t audio-forge/recordings/*.md | head -1)
sed -i.bak 's/transcript_status: transcribed/transcript_status: failed/' "$LATEST"
```

Reload the app (or click Refresh in the toolbar). The list item should show ⚠ failed; the detail pane should show "Transcription failed. [Retry]".

Click Retry. Expected: toast "Transcription complete." after Whisper finishes, status flips back to ✓. (forge-lib's `transcribe` is idempotent — it'll re-transcribe the WAVs.)

Restore the file:

```bash
mv "$LATEST.bak" "$LATEST" 2>/dev/null || true
```

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): audio-forge retry-transcribe button + toast polish"
```

---

## Task 11: Orphan recovery banner + flow

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js`

- [ ] **Step 1: Add `recover_orphaned_recording` invoke wrapper and banner**

After `invokeTranscribe`, add:

```javascript
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
      // Clean up active.json regardless — Tauri's recover_orphaned_recording
      // doesn't auto-delete it. We delete it from the frontend by writing an
      // explicit "stop" semantics here is impossible (no live sidecar), so we
      // call a small filesystem cleanup via ForgeFS.
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
```

- [ ] **Step 2: Verify `ForgeFS.deleteFile` exists**

```bash
grep -n "deleteFile\b" forge-shell/app/js/fs-adapter.js | head
```

If `deleteFile` is missing in `ForgeFS`, replace the `ForgeFS.deleteFile(...)` calls with direct Tauri `invoke` to `tauri-plugin-fs`'s `remove` command, e.g.:

```javascript
await window.__TAURI__.core.invoke('plugin:fs|remove', { path: `${projectRoot}/${rel}` });
```

If neither is available, the recover/discard flow can degrade to "leave file on disk and just remove active.json by writing an empty placeholder". Surface a toast: "Recovery cleanup not implemented in this build; remove active.json manually."

- [ ] **Step 3: Call recovery on init**

In the public `init`, after `reconcileStatus()`, add:

```javascript
      // Orphan recovery
      invokeRecover().then((active) => {
        if (active) renderRecoveryBanner(active);
      });
```

- [ ] **Step 4: Verify by simulating an orphan**

Force an orphan: start a recording, then force-quit Forge Shell (Cmd+Q on the dev window, or kill the Tauri process). The sidecar's SIGINT handler closes the WAVs and writes status, but `active.json` is left behind because `stop_recording` was never called.

```bash
ls audio-forge/recordings/active.json   # should exist
```

Restart Tauri dev and click Audio Forge.

Expected:
- Yellow banner above the list reads "Previous recording <id> (timestamp) was interrupted. [Save] [Discard]".
- Click Save → toast "Recovered recording saved.", banner disappears, new entity appears in the list with `transcript_status: pending`.
- Or click Discard → toast "Discarded.", banner disappears, WAVs removed from `audio-forge/audio/`.

Kill dev server. Clean up `active.json` if needed.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(forge-shell): orphan recovery banner with save/discard flow"
```

---

## Task 12: Final UAT, fixture cleanup, polish, branch merge prep

**Files:**
- Modify: `audio-forge/recordings/2026-05-08-fixture.md` (delete)
- Possibly: `forge-shell/app/js/audio-forge.js` (polish only, no logic changes)

This task is the end-to-end UAT pass. Step 1 is the script the user runs against a clean app build; everything else only runs if the UAT surfaces a defect.

- [ ] **Step 1: Run the full UAT script**

Pre-flight: kill any running Tauri dev, ensure the Whisper binary is at `/opt/homebrew/bin/whisper`, and have music or a YouTube tab playing audibly.

```bash
cd forge-shell && npm run tauri:dev
```

Run through, ticking each box:

- [ ] App launches without console errors. Sidebar shows `🎙 Audio Forge`.
- [ ] Click Audio Forge. Toolbar renders correctly. Empty state visible (or fixture if not yet deleted).
- [ ] Both source checkboxes default to checked.
- [ ] Click Record. Within ~1s the button label flips to "Stop", checkboxes disable, meter bars become visible. Elapsed begins counting up.
- [ ] Meter bars animate in response to background audio.
- [ ] Wait ~10 seconds. Click Stop. Button cycles "Stopping…" → "Saving…". A new list item appears within ~3 seconds.
- [ ] Button enters "Transcribing…" state. After ~30–90 seconds (depending on Whisper model + audio length), the list item's badge flips to ✓ transcribed and the button returns to "Record".
- [ ] Click the new list item. Detail panel shows two audio players. Both play audibly. Transcript shows interleaved `**System**:` / `**You**:` lines. Title is `Recording 2026-05-08 HH:MM`.
- [ ] Search box: typing the title substring filters; clearing restores full list.
- [ ] Refresh button works without breaking selected state.
- [ ] Make a recording with only `mic` checked (uncheck system). Verify it succeeds; detail panel shows only the Mic player.
- [ ] Make a recording with only `system` checked. Verify likewise.
- [ ] Force an orphan: start a recording, kill Tauri (Activity Monitor → Force Quit), restart `npm run tauri:dev`. Click Audio Forge. Recovery banner appears. Click Save. Recovered entity visible in list.
- [ ] Manually edit one entity's `transcript_status` to `failed`, click Refresh. Click the entity. Click Retry in detail. Toast "Transcription complete." appears; status flips back.
- [ ] Run unit tests: `npm test` from `forge-shell/` — all 30 tests pass.

If any item fails, fix inline (no need to re-run prior tasks unless the bug is structural) and re-run the UAT before continuing.

- [ ] **Step 2: Delete the fixture**

```bash
rm -f audio-forge/recordings/2026-05-08-fixture.md
rm -f audio-forge/audio/2026-05-08T120000.system.wav
rm -f audio-forge/audio/2026-05-08T120000.mic.wav
```

- [ ] **Step 3: Re-run UAT empty-state checks**

Restart the dev server. Audio Forge → empty state visible ("No recordings yet."). Make one fresh recording end-to-end to confirm no fixture-shaped assumptions leaked in.

- [ ] **Step 4: Run `npm test` one final time**

```bash
cd forge-shell && npm test
```

Expected: all 30 tests pass.

- [ ] **Step 5: Commit & open PR**

```bash
git add -A
git commit -m "chore(audio-forge): remove dev fixture; UAT clean"
git push -u origin feat/audio-forge-phase-2b
```

If `gh` is configured:

```bash
gh pr create --title "feat(audio-forge): Phase 2B — Forge Shell UI" --body "$(cat <<'EOF'
## Summary
- View-only Audio Forge dashboard in Forge Shell.
- Auto-transcribe-on-stop pipeline (system + mic → forge-lib → Whisper).
- Detail panel with HTML5 audio playback (assetProtocol-scoped).
- Orphan recovery banner.
- Pure helpers + state-machine reducer covered by node:test (30 tests).

## Test plan
- [ ] `npm test` from forge-shell/ — all 30 tests pass.
- [ ] UAT script in `docs/superpowers/plans/2026-05-08-audio-forge-shell-ui.md` Task 12 — all items pass.
- [ ] Fresh recording end-to-end on empty state.
- [ ] Orphan recovery flow.
- [ ] Retry transcribe on simulated failure.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review summary

- **Spec coverage:** Every section of the design spec maps to a task: nav + scaffold (T4), list (T5), detail + audio playback (T6), toolbar/state machine (T7), live events (T8), auto-transcribe pipeline (T9), error/retry (T10), orphan recovery (T11), UAT + acceptance criteria (T12). The assetProtocol scope (T1) and test infrastructure (T0/T2/T3) are infrastructure tasks that the spec implies but doesn't enumerate.
- **No placeholders:** Every step has either exact code, exact commands, or a verifiable expected outcome. No "TBD" / "TODO" / "implement appropriate handling" anywhere.
- **Type consistency:** `machineState`, `recordings[]`, `selectedId`, `projectRoot`, `rootHandle` are used consistently across tasks. Tauri command names match `audio_commands.rs`: `start_recording`, `stop_recording`, `get_recording_status`, `recover_orphaned_recording`, `run_recording_create`, `run_recording_transcribe`. Reducer event types are stable (`RECORD_CLICK`, `START_OK`, `START_ERR`, `METER`, `ELAPSED`, `STOP_CLICK`, `STOP_OK`, `STOP_ERR`, `CREATE_OK`, `CREATE_ERR`, `TRANSCRIBE_OK`, `TRANSCRIBE_ERR`, `ERROR_EVENT`, `TERMINATED_EVENT`).
