---
title: Audio Forge — Auto-Stop Timer Design
date: 2026-05-09
phase: 2C
status: approved-for-planning
supersedes: none
related:
  - docs/superpowers/specs/2026-05-08-audio-forge-shell-ui-design.md
---

# Audio Forge — Auto-Stop Timer Design

Add an "Auto-stop after N minutes" timer to the Audio Forge recording toolbar in
Forge Shell. The user picks a duration before clicking Record; the recording
auto-stops at the chosen elapsed time and runs the existing create + transcribe
pipeline. The selection persists across sessions.

## Goal

Let the user start a recording, walk away to a meeting, and trust that the
recording will stop and transcribe itself when the meeting ends — without ever
returning to click Stop.

## Non-Goals

- Pre-stop warnings, banners, or prompts (the use case is "walk away").
- Snooze / extend mid-recording.
- Pause / resume.
- Per-recording timer history (we persist the *last-used* value, not a log).
- Server-side enforcement (Rust / Swift sidecar changes) — see "Approaches
  considered" below.
- Slash command equivalent (e.g. `/audio-forge:record --timer 30`).

## Approach

The Swift sidecar already emits `audio-forge://elapsed` events with seconds
roughly once per second. The frontend reducer already tracks `elapsed`. We
enforce auto-stop in the existing **frontend event loop**: when an `ELAPSED`
event arrives with `seconds >= autoStopMinutes * 60`, the controller dispatches
the same `STOP_CLICK` it would on a manual click and runs the existing stop
pipeline. No Rust or sidecar changes.

### Approaches considered (and rejected)

- **Rust-side tokio sleep timer.** Spawning a background tokio task to send
  `{"cmd":"stop"}` to the sidecar's stdin after N seconds would be more robust
  to a frozen webview, but it adds cancellation/error coordination across the
  IPC boundary for no UX gain — the user already trusts the elapsed counter
  they see, which is the same signal we'd be using.
- **Sidecar `--max-seconds` flag.** Cleanest in principle, but the
  `forge-recorder` Swift sidecar ships as a pre-built binary in
  `src-tauri/binaries/`. Source isn't in this repo. Out of scope.

## UX

### Toolbar layout

Additions in **bold** below; everything else is unchanged from the current
toolbar in [audio-forge.js:52](forge-shell/app/js/audio-forge.js:52):

```
[☰] 🎙 Audio Forge   [☑ system] [☑ mic]   ⏱ Auto-stop: [Off ▾]   [● Record]   0:00   ▮▮▯
```

### Dropdown options

- **Off** — no auto-stop (default for a fresh install).
- **30 min**
- **60 min**
- **90 min**
- **Custom…** — opens an inline numeric input next to the dropdown, validated
  to integer minutes in `[1, 240]`. While custom-entry is open, the toolbar
  shows:
  ```
  ⏱ Auto-stop: [Custom ▾]   [____] min   [Set]   [Cancel]
  ```
  - "Set" is disabled until the input parses to an integer in `[1, 240]`.
  - On Set: dropdown displays the chosen value (e.g. `45 min`) as a transient
    custom option above "Custom…". Persisted (see Persistence).
  - On Cancel: dropdown reverts to the previously committed selection.

### Display while recording

The existing `0:00` elapsed counter at [audio-forge.js:69](forge-shell/app/js/audio-forge.js:69)
becomes:

| Auto-stop setting | Display | Example |
|---|---|---|
| Off               | `<elapsed>`           | `5:23`         |
| 30 min            | `<elapsed> / <total>` | `5:23 / 30:00` |
| Custom 45 min     | `<elapsed> / <total>` | `5:23 / 45:00` |

Format uses the existing `helpers.formatDuration(seconds)` for both sides.

### Disabled-while-recording

Once `status !== 'idle'` (already the rule for source checkboxes at
[audio-forge.js:311-312](forge-shell/app/js/audio-forge.js:311)), the auto-stop
dropdown and any open custom input are disabled. Manual stop continues to work.

### Toast on auto-stop

When auto-stop fires, after kicking off the existing stop pipeline a toast
appears via the existing `toast(msg, level)` wrapper at
[audio-forge.js:550](forge-shell/app/js/audio-forge.js:550):

> ⏱ Auto-stopped after 30 min — transcription will continue in the background.

- Level: `info`. Default 4000ms duration (current `toast()` wrapper default).
- Toast fires only on auto-stop. Manual stops are silent (the user clicked, so
  they know).

## State machine changes

[audio-forge.reducer.js](forge-shell/app/js/audio-forge.reducer.js) currently
exposes `initialState` with these recording-relevant fields:

```js
status, id, startedAt, files, sources, elapsed, meter, error
```

### New initial-state fields

```js
autoStopMinutes: 0,    // 0 = Off; otherwise integer in [1, 240]
autoStopFired: false,  // true once auto-stop has been triggered (idempotency)
```

Both reset to defaults on every transition that returns to `initialState`
(START_ERR, ERROR_EVENT, TERMINATED_EVENT, STOP_ERR, CREATE_ERR, TRANSCRIBE_OK,
TRANSCRIBE_ERR).

### Event payload changes

- `RECORD_CLICK` event now carries `autoStopMinutes: number`. The handler in
  the `idle` branch copies it into state (alongside `sources`).
- `STOP_CLICK` event now carries optional `auto: boolean`. When `auto: true`,
  the reducer sets `autoStopFired: true` while transitioning to `stopping`.
- No new event types. No transitions added or removed.

### Reducer rule for `autoStopFired`

The reducer is pure — it does **not** read the clock or dispatch events. It
only flips `autoStopFired` when it sees `STOP_CLICK { auto: true }`. The
*decision* to fire lives in the controller subscription that already dispatches
`ELAPSED` (see Controller logic below).

### Reducer test additions

To be added to [forge-shell/test/audio-forge.reducer.test.js](forge-shell/test/audio-forge.reducer.test.js):

- `initialState` includes `autoStopMinutes: 0` and `autoStopFired: false`.
- `RECORD_CLICK { sources, autoStopMinutes: 30 }` from idle → starting with
  `autoStopMinutes === 30`, `autoStopFired === false`.
- `RECORD_CLICK { sources, autoStopMinutes: 0 }` from idle → starting with
  `autoStopMinutes === 0`.
- `STOP_CLICK { auto: true }` from recording → stopping with `autoStopFired === true`.
- `STOP_CLICK` (no `auto`) from recording → stopping with `autoStopFired === false`.
- `START_OK` preserves `autoStopMinutes` from the prior `starting` state.
- `ERROR_EVENT` from recording resets `autoStopMinutes` and `autoStopFired` to
  defaults (i.e. returns to `initialState`).
- `TRANSCRIBE_OK` resets `autoStopMinutes` and `autoStopFired` to defaults.

## Controller logic

In [audio-forge.js](forge-shell/app/js/audio-forge.js):

### On RECORD_CLICK

`onToggleRecord()` reads the current dropdown selection (committed value, not
in-flight Custom entry) and includes it in the dispatched event:

```js
dispatch({
  type: 'RECORD_CLICK',
  sources,
  autoStopMinutes: getAutoStopSelection(),
});
```

### On every ELAPSED event

The existing `audio-forge://elapsed` listener at
[audio-forge.js:575-578](forge-shell/app/js/audio-forge.js:575) gains an
auto-stop guard. After dispatching `ELAPSED`, if all of:

- `machineState.status === 'recording'`
- `machineState.autoStopMinutes > 0`
- `machineState.autoStopFired === false`
- `machineState.elapsed >= machineState.autoStopMinutes * 60`

then the listener triggers the same flow `onToggleRecord` runs for a manual
stop, but with `auto: true`:

```js
dispatch({ type: 'STOP_CLICK', auto: true });
runAutoStop();   // mirrors the recording branch of onToggleRecord
```

`runAutoStop()` calls `invokeStop()`, dispatches `STOP_OK`, runs
`runStopPipeline(...)`, and on success shows the auto-stop toast. On error it
dispatches `STOP_ERR` and surfaces the error toast (existing pattern).

### Read of "current selection"

`getAutoStopSelection()` returns:
- `0` if the dropdown is on **Off**, or
- the integer minutes for any preset / persisted custom value.

In-flight (uncommitted) custom-entry values are never returned — the dropdown
remains on its previously committed value until "Set" is clicked.

## Persistence

A single key in browser `localStorage`:

| Key | Value | Notes |
|---|---|---|
| `audio-forge.autoStopMinutes` | string of integer in `[0, 240]` | `"0"` means Off |

- Read once during `scaffold()`; used to initialize the dropdown selection.
- Written on every committed change (preset selection or successful Custom Set).
- Missing, non-numeric, or out-of-range (`< 1` or `> 240`) value → treated as
  `0` (Off). We reject rather than clamp: a `9999` in localStorage almost
  certainly indicates corruption or tampering, and silently clamping to `240`
  would hide that.
- **Not synced via git or forge config.** This is a per-device UI preference,
  matching the existing `ForgeUtils.Theme` persistence pattern in
  [utils.js](forge-shell/app/js/utils.js).

## Edge cases

| Scenario | Behavior |
|---|---|
| Manual Stop click before timer fires | `STOP_CLICK` dispatched with no `auto` flag. `autoStopFired` stays false. Pipeline runs, no auto-stop toast. State resets through normal flow. |
| Sidecar emits `ERROR_EVENT` while recording | Reducer returns to `initialState` (existing behavior); `autoStopMinutes` and `autoStopFired` reset. |
| Sidecar `TERMINATED_EVENT` while recording | Same as above. |
| `ELAPSED` events arrive twice past threshold | Second event hits `autoStopFired === true` guard and no-ops. |
| Auto-stop equals elapsed exactly (e.g. 1800 vs. 1800) | `>=` comparison fires on the first event at-or-past threshold. |
| User opens Custom… input but never clicks Set, then clicks Record | Recording uses the previously committed value (the dropdown reverts). |
| User picks Off (autoStopMinutes = 0) | Auto-stop guard `autoStopMinutes > 0` short-circuits — recording behaves exactly as today. |
| Webview reload during a recording | Existing recovery banner flow handles the orphan; auto-stop preference re-loads from localStorage; no auto-stop fires for the recovered recording (it's stopped already). |
| `localStorage` unavailable | Reads return `0`; writes throw silently (caught and ignored). Feature degrades to "always Off" with no error surfaced. |
| Custom input non-integer or fractional (e.g. `30.5`) | Validation truncates via `parseInt(value, 10)`. `30.5` → `30`. `"abc"` → NaN → Set disabled. |

## File-level changes

| File | Change |
|---|---|
| [forge-shell/app/js/audio-forge.reducer.js](forge-shell/app/js/audio-forge.reducer.js) | Add `autoStopMinutes` and `autoStopFired` to `initialState`. Update `RECORD_CLICK` handler in `idle` branch. Update `STOP_CLICK` handler in `recording` branch to set `autoStopFired` when `auto: true`. |
| [forge-shell/app/js/audio-forge.js](forge-shell/app/js/audio-forge.js) | Add toolbar dropdown + custom-entry markup to `scaffold()`. Wire `change` listener that persists selection. Read selection on `RECORD_CLICK`. Augment `audio-forge://elapsed` listener with auto-stop trigger. Add `runAutoStop()` helper. Update `renderToolbar()` to show `<elapsed> / <total>` when timer is set, and to disable the dropdown while not idle. |
| [forge-shell/app/css/audio-forge.css](forge-shell/app/css/audio-forge.css) | Add `.af-autostop` (container), `.af-autostop select`, `.af-autostop input[type=number]`, `.af-autostop button` (Set/Cancel) styles, matching the existing toolbar visual language. |
| [forge-shell/test/audio-forge.reducer.test.js](forge-shell/test/audio-forge.reducer.test.js) | Add reducer tests listed in "Reducer test additions" above. |

No Rust changes. No `forge-lib` / Python changes. No schema or frontmatter
changes.

## Testing

### Unit (Node)

The new reducer cases listed above run via the existing `node --test` harness
the project already uses for [audio-forge.reducer.test.js](forge-shell/test/audio-forge.reducer.test.js).

### Manual smoke test

1. Set Auto-stop to **Custom… 1 min**, click Record.
2. Walk away ~70 seconds.
3. Return; confirm:
   - Recording stopped automatically.
   - Toast read: *"⏱ Auto-stopped after 1 min …"*.
   - The new recording entity exists under `audio-forge/recordings/` with a
     duration ≈ 60s.
   - Transcription kicked off automatically (status badge progresses to
     "transcribed" within the usual interval).
   - On the next launch of Forge Shell, Auto-stop dropdown still reads
     **1 min** (persistence).

### Manual edge-case test

- Set Auto-stop to **30 min**, click Record, then click Stop manually after
  10s. Confirm: no auto-stop toast appears; pipeline completes normally.
- Set Auto-stop to **Off**, click Record, click Stop. Confirm behavior is
  byte-identical to current main.
- Open Custom…, type `999`, confirm Set is disabled. Type `45`, click Set,
  confirm dropdown shows `45 min`. Reload app, confirm dropdown still shows
  `45 min`.

## Risks

- **Drift between webview "elapsed" and sidecar wall clock.** The sidecar
  emits `elapsed` at roughly 1 Hz; if it pauses (e.g. during system sleep) the
  auto-stop will fire late by the same amount. The existing UI counter has
  this same limitation — we are not making accuracy worse.
- **Tab/webview frozen.** If the Tauri webview is frozen, neither the elapsed
  display nor auto-stop fires. Existing recovery banner flow already covers
  the orphan-recording case on next launch. This is an accepted limitation of
  Approach 1 and matches the existing failure mode.
- **`localStorage` corruption.** Mitigated by the clamping/parse defaults
  described in Persistence.
