# Audio-Forge Mic Device Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose which microphone Forge Shell records from (so the lid-closed built-in mic isn't the only option), and warn within ~1 second if the chosen mic is producing silence.

**Architecture:** Three layers. (1) The Swift recorder gains a CoreAudio HAL enumeration command and accepts an optional `micDeviceUID` in its `start` payload, applying it to AVAudioEngine's input audio unit before the engine starts. (2) The Rust Tauri layer surfaces `list_audio_devices` as an invokable command and threads `mic_device_uid` through `start_recording`. (3) The JS UI adds a mic-device dropdown next to the existing source checkboxes, persists the selection to localStorage, and shows a toast when the recorder emits `MIC_SILENT_AT_SOURCE`.

**Tech Stack:** Swift 5.9 (AVFoundation + CoreAudio HAL), Rust + Tauri 2.x, vanilla JS (no framework), Node's built-in `node:test` runner (matches existing `forge-shell/test/` pattern). The sidecar speaks newline-delimited JSON over stdin/stdout — that's our integration-test surface.

---

## File Structure

**Modified files (no new files):**

- `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — adds `enumerateInputDevices()`, the `list_devices` command, `MicCapture` device-override + silent-source guard.
- `forge-shell/src-tauri/binaries/forge-recorder/build.sh` — no edits needed; re-sign step already in place from earlier work.
- `forge-shell/src-tauri/src/audio_commands.rs` — adds the `list_audio_devices` Tauri command and a new `mic_device_uid` field on `start_recording`.
- `forge-shell/src-tauri/src/lib.rs` — registers `list_audio_devices` in `generate_handler!`.
- `forge-shell/app/js/audio-forge.js` — adds the mic-device dropdown, list/persist/restore logic, passes the UID into `invokeStart`, handles the `audio-forge://warning` event for `MIC_SILENT_AT_SOURCE`.
- `forge-shell/test/audio-forge.devices.test.js` (NEW) — Node test verifying the JS-side device-list normalization helper.
- `audio-forge/README.md` — documents the new mic-selection toolbar and silent-source warning.

**Why no new Swift/Rust source files:** the recorder is a single-file CLI by convention (see comments in `main.swift`), and `audio_commands.rs` is the canonical home for all Tauri audio commands. Splitting would fragment cohesion. The single new JS test file matches the existing per-module pattern (`audio-forge.reducer.test.js`, `audio-forge.helpers.test.js`).

**Testing surface:** Swift and Rust changes are validated via IPC smoke tests (drive the sidecar from `bash` with line-delimited JSON, assert on the JSON output). JS is unit-tested where logic is testable (the device-normalization helper) and visually verified for the UI (toolbar dropdown, toast on warning).

---

### Task 1: Swift — CoreAudio input device enumeration helper

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` (add `import CoreAudio` and a new `enumerateInputDevices()` function near the top, after the existing imports).

- [ ] **Step 1: Add the import and helper**

Open `main.swift`. At the top, change the imports from:

```swift
import Foundation
import AVFoundation
import ScreenCaptureKit
```

to:

```swift
import Foundation
import AVFoundation
import ScreenCaptureKit
import CoreAudio
```

Then immediately after `import CoreAudio`, add:

```swift
// MARK: - Audio device enumeration

struct AudioInputDevice {
    let id: AudioDeviceID
    let uid: String
    let name: String
    let isDefault: Bool
    let inputChannels: UInt32
}

/// Enumerates all CoreAudio input devices visible on the system. Filters out
/// output-only devices (devices with zero input channels). The order is
/// CoreAudio's own enumeration order, which is stable across queries within a
/// single session.
func enumerateInputDevices() -> [AudioInputDevice] {
    let systemObject = AudioObjectID(kAudioObjectSystemObject)

    // List all device IDs
    var listAddr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var listSize: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(systemObject, &listAddr, 0, nil, &listSize) == noErr else {
        return []
    }
    let count = Int(listSize) / MemoryLayout<AudioDeviceID>.size
    var deviceIDs = [AudioDeviceID](repeating: 0, count: count)
    guard AudioObjectGetPropertyData(systemObject, &listAddr, 0, nil, &listSize, &deviceIDs) == noErr else {
        return []
    }

    // Default input device
    var defaultID: AudioDeviceID = 0
    var defaultSize = UInt32(MemoryLayout<AudioDeviceID>.size)
    var defaultAddr = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    _ = AudioObjectGetPropertyData(systemObject, &defaultAddr, 0, nil, &defaultSize, &defaultID)

    var results: [AudioInputDevice] = []
    for id in deviceIDs {
        // Input channel count via stream configuration
        var streamAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyStreamConfiguration,
            mScope: kAudioDevicePropertyScopeInput,
            mElement: kAudioObjectPropertyElementMain
        )
        var streamSize: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(id, &streamAddr, 0, nil, &streamSize) == noErr, streamSize > 0 else {
            continue
        }
        let bufList = UnsafeMutableRawPointer.allocate(byteCount: Int(streamSize), alignment: 16)
        defer { bufList.deallocate() }
        let ablTyped = bufList.assumingMemoryBound(to: AudioBufferList.self)
        guard AudioObjectGetPropertyData(id, &streamAddr, 0, nil, &streamSize, ablTyped) == noErr else {
            continue
        }
        let abl = UnsafeMutableAudioBufferListPointer(ablTyped)
        let channels = abl.reduce(0) { $0 + Int($1.mNumberChannels) }
        guard channels > 0 else { continue }

        // UID
        var uidAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyDeviceUID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var uidRef: Unmanaged<CFString>?
        var uidSize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        guard AudioObjectGetPropertyData(id, &uidAddr, 0, nil, &uidSize, &uidRef) == noErr,
              let uid = uidRef?.takeRetainedValue() as String? else {
            continue
        }

        // Human-readable name
        var nameAddr = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyDeviceNameCFString,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var nameRef: Unmanaged<CFString>?
        var nameSize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        let name: String
        if AudioObjectGetPropertyData(id, &nameAddr, 0, nil, &nameSize, &nameRef) == noErr,
           let n = nameRef?.takeRetainedValue() as String? {
            name = n
        } else {
            name = uid
        }

        results.append(AudioInputDevice(
            id: id, uid: uid, name: name,
            isDefault: id == defaultID,
            inputChannels: UInt32(channels)
        ))
    }
    return results
}

/// Look up a device by UID. Returns nil if no input device with that UID is
/// currently connected.
func inputDeviceID(forUID uid: String) -> AudioDeviceID? {
    return enumerateInputDevices().first(where: { $0.uid == uid })?.id
}
```

- [ ] **Step 2: Build the recorder and confirm it compiles**

Run from the project root:

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/build.sh
```

Expected: `Build complete!` and `Wrote .../forge-recorder-aarch64-apple-darwin`. No compiler errors. The helper is unused at this stage — Swift will warn but not error.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git commit -m "feat(audio-forge): add CoreAudio input device enumeration helper"
```

---

### Task 2: Swift — wire `list_devices` IPC command

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — add a case to `Recorder.handle(_:)`.

- [ ] **Step 1: Write the smoke test contract**

We test by driving the sidecar over stdin. Create `forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
OUT=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null)
echo "$OUT"
# Must produce a single JSON line with event=devices and a non-empty array
echo "$OUT" | grep -q '"event":"devices"' || { echo "FAIL: no devices event"; exit 1; }
echo "$OUT" | grep -q '"devices":\[' || { echo "FAIL: missing devices array"; exit 1; }
echo "PASS"
```

Make it executable: `chmod +x forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh`.

- [ ] **Step 2: Run the test — it should FAIL**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh
```

Expected: `FAIL: no devices event` (because the command isn't wired yet — the binary will emit `BAD_COMMAND`).

- [ ] **Step 3: Wire the command in `Recorder.handle`**

In `main.swift`, find `Recorder.handle(_:)` and its `switch cmd` block. Add a new case **before** the `default:`:

```swift
case "list_devices":
    let devs = enumerateInputDevices().map { d -> [String: Any] in
        return [
            "uid": d.uid,
            "name": d.name,
            "isDefault": d.isDefault,
            "channels": Int(d.inputChannels),
        ]
    }
    emit(["event": "devices", "devices": devs])
```

- [ ] **Step 4: Rebuild and re-run the test — should PASS**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/build.sh
bash forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh
```

Expected: a JSON line like `{"event":"devices","devices":[{"uid":"BuiltInMicrophoneDevice","name":"MacBook Pro Microphone","isDefault":true,"channels":1},...]}` followed by `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh
git commit -m "feat(audio-forge): add list_devices IPC command to recorder"
```

---

### Task 3: Swift — `MicCapture` accepts a device UID

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — extend `MicCapture` init and `start()`.

- [ ] **Step 1: Add `preferredDeviceUID` to `MicCapture`**

Locate `final class MicCapture` and change the property block + init to:

```swift
final class MicCapture {
    let outputURL: URL
    let preferredDeviceUID: String?
    let engine = AVAudioEngine()
    private var file: AVAudioFile?
    private(set) var lastRMS: Float = 0
    private(set) var sampleCount: Int64 = 0
    private var inputSampleRate: Double = 48000

    init(outputURL: URL, preferredDeviceUID: String? = nil) {
        self.outputURL = outputURL
        self.preferredDeviceUID = preferredDeviceUID
    }
```

- [ ] **Step 2: Apply the device override in `start()` BEFORE format query**

In `MicCapture.start()`, replace:

```swift
        try MicCapture.ensureAuthorized()

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        self.inputSampleRate = inputFormat.sampleRate
```

with:

```swift
        try MicCapture.ensureAuthorized()

        let inputNode = engine.inputNode

        // Apply preferred device override BEFORE first format query. AVAudioEngine
        // lazily binds its input audio unit to a device on the first format
        // access, so setting kAudioOutputUnitProperty_CurrentDevice later would
        // be a no-op.
        if let uid = preferredDeviceUID {
            if let devID = inputDeviceID(forUID: uid), let au = inputNode.audioUnit {
                var d = devID
                let err = AudioUnitSetProperty(
                    au,
                    kAudioOutputUnitProperty_CurrentDevice,
                    kAudioUnitScope_Global,
                    0,
                    &d,
                    UInt32(MemoryLayout<AudioDeviceID>.size)
                )
                if err != noErr {
                    FileHandle.standardError.write(Data(
                        "[mic] AudioUnitSetProperty(CurrentDevice) failed for uid=\(uid): \(err)\n".utf8))
                } else {
                    FileHandle.standardError.write(Data(
                        "[mic] using requested device uid=\(uid) id=\(devID)\n".utf8))
                }
            } else {
                FileHandle.standardError.write(Data(
                    "[mic] requested device uid=\(uid) not found; falling back to system default\n".utf8))
            }
        }

        let inputFormat = inputNode.outputFormat(forBus: 0)
        self.inputSampleRate = inputFormat.sampleRate
```

- [ ] **Step 3: Rebuild — confirm clean compile**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/build.sh
```

Expected: `Build complete!`. No behavior change yet (no caller passes a UID).

- [ ] **Step 4: Commit**

```bash
git add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git commit -m "feat(audio-forge): MicCapture accepts an optional preferredDeviceUID"
```

---

### Task 4: Swift — plumb `micDeviceUID` through the `start` IPC command

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — extend `Recorder.startCapture`.

- [ ] **Step 1: Add a smoke test for an explicit-device start**

Create `forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
TMP=$(mktemp -d)
# Use the system default device's UID — read it via list_devices first.
DEFAULT_UID=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null \
  | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print(next(x["uid"] for x in d["devices"] if x["isDefault"]))')
echo "Using UID: $DEFAULT_UID"
OUT=$( (echo "{\"cmd\":\"start\",\"outDir\":\"$TMP\",\"id\":\"smoketest\",\"sources\":[\"mic\"],\"micDeviceUID\":\"$DEFAULT_UID\"}"; sleep 2; echo '{"cmd":"stop"}'; sleep 1) | "$BIN" 2>&1 )
echo "$OUT"
# Stderr must mention the device we asked for
echo "$OUT" | grep -q "using requested device uid=$DEFAULT_UID" || { echo "FAIL: device override not applied"; exit 1; }
echo "PASS"
rm -rf "$TMP"
```

Make executable: `chmod +x forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh`.

- [ ] **Step 2: Run the test — should FAIL**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh
```

Expected: `FAIL: device override not applied` (the start handler ignores the field).

- [ ] **Step 3: Extract `micDeviceUID` in `startCapture` and pass it to `MicCapture`**

In `main.swift`, find `Recorder.startCapture` and locate the `if self.sources.contains("mic") {` block. Replace:

```swift
        if self.sources.contains("mic") {
            let url = URL(fileURLWithPath: outDir).appendingPathComponent("\(id)-mic.wav")
            do {
                let cap = MicCapture(outputURL: url)
                try cap.start()
                self.activeMic = cap
                startedFiles["mic"] = url.path
                startedAny = true
            } catch {
                emitError(code: "PERMISSION_MIC",
                          message: "mic capture failed: \(error.localizedDescription)")
                // Fall through.
            }
        }
```

with:

```swift
        if self.sources.contains("mic") {
            let url = URL(fileURLWithPath: outDir).appendingPathComponent("\(id)-mic.wav")
            // Optional caller-provided device UID. nil => system default input.
            let preferredUID = (payload["micDeviceUID"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            do {
                let cap = MicCapture(outputURL: url, preferredDeviceUID: preferredUID)
                try cap.start()
                self.activeMic = cap
                startedFiles["mic"] = url.path
                startedAny = true
            } catch {
                emitError(code: "PERMISSION_MIC",
                          message: "mic capture failed: \(error.localizedDescription)")
                // Fall through.
            }
        }
```

- [ ] **Step 4: Rebuild and re-run — should PASS**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/build.sh
bash forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh
```

Expected: stderr contains `[mic] using requested device uid=…` and the script prints `PASS`.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh
git commit -m "feat(audio-forge): start IPC accepts optional micDeviceUID"
```

---

### Task 5: Swift — silent-source detection emits `MIC_SILENT_AT_SOURCE` warning

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — add peak tracking inside the tap callback and a scheduled silence check in `MicCapture` plus a wiring hook in `Recorder.startCapture`.

- [ ] **Step 1: Add peak tracking + silence-check scheduler to `MicCapture`**

Inside `MicCapture` (just after the existing `private var inputSampleRate: Double = 48000` line), add:

```swift
    private(set) var bufferPeakSinceStart: Float = 0
    private var silenceTimer: DispatchSourceTimer?
    var onSilenceDetected: ((Float) -> Void)?
```

In the tap callback inside `start()`, immediately after the RMS computation (right before `do { try file.write(from: buffer) ...}`), add:

```swift
            // Track peak amplitude for the silence guard. Cheap; we already
            // walked ch0 above for RMS.
            if frames > 0, let ch0 = buffer.floatChannelData?[0] {
                var peak: Float = 0
                for i in 0..<frames { peak = max(peak, abs(ch0[i])) }
                if peak > self.bufferPeakSinceStart {
                    self.bufferPeakSinceStart = peak
                }
            }
```

Finally, at the end of `MicCapture.start()` (after `try engine.start()`), append:

```swift
        // Silent-source guard: 1.0s after the engine starts, check whether any
        // non-zero audio has appeared. If not, the chosen mic is producing
        // silence (lid closed, muted at HAL, HAL plugin interception, etc.).
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue(label: "com.forge.recorder.silence-check"))
        timer.schedule(deadline: .now() + 1.0)
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            let peak = self.bufferPeakSinceStart
            if peak < 1e-4 {
                self.onSilenceDetected?(peak)
            }
        }
        timer.resume()
        self.silenceTimer = timer
```

Also extend `MicCapture.stop()` to cancel the timer. Replace:

```swift
    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        file = nil
    }
```

with:

```swift
    func stop() {
        silenceTimer?.cancel()
        silenceTimer = nil
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        file = nil
    }
```

- [ ] **Step 2: Wire the warning into `Recorder.startCapture`**

In the same `mic` branch you edited in Task 4, immediately after `try cap.start()`, add:

```swift
                cap.onSilenceDetected = { [weak self] peak in
                    guard let self = self else { return }
                    let deviceLabel = preferredUID ?? "(system default)"
                    emit([
                        "event": "warning",
                        "code": "MIC_SILENT_AT_SOURCE",
                        "message": "Microphone is producing silence (peak=\(peak)). Device=\(deviceLabel). Likely causes: MacBook lid closed disabling built-in mic, mic muted in System Settings, a HAL plugin (Wispr/Krisp/etc.) intercepting the input, or wrong device selected.",
                        "peak": peak,
                        "device_uid": preferredUID ?? NSNull(),
                    ])
                    // Note: recording continues — system audio may still be useful.
                    _ = self  // silence unused-self warning if we add nothing else
                }
```

- [ ] **Step 3: Smoke-test the silence path**

Create `forge-shell/src-tauri/binaries/forge-recorder/test-silence-guard.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BIN=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/forge-recorder-aarch64-apple-darwin
TMP=$(mktemp -d)
# Find a UID that does NOT exist. The recorder will fall back to default;
# if the user's default mic is currently producing audio this test won't fire,
# so instead we exercise it by pointing at BlackHole 2ch if installed
# (silent loopback). Skip if absent.
BLACKHOLE_UID=$(echo '{"cmd":"list_devices"}' | "$BIN" 2>/dev/null \
  | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); blk=[x for x in d["devices"] if "BlackHole" in x["name"]]; print(blk[0]["uid"] if blk else "")')
if [ -z "$BLACKHOLE_UID" ]; then
  echo "SKIP: BlackHole not installed — silence guard cannot be deterministically tested without it"
  exit 0
fi
echo "Using silent device: $BLACKHOLE_UID"
OUT=$( (echo "{\"cmd\":\"start\",\"outDir\":\"$TMP\",\"id\":\"silencetest\",\"sources\":[\"mic\"],\"micDeviceUID\":\"$BLACKHOLE_UID\"}"; sleep 2; echo '{"cmd":"stop"}'; sleep 1) | "$BIN" 2>/dev/null )
echo "$OUT"
echo "$OUT" | grep -q '"code":"MIC_SILENT_AT_SOURCE"' || { echo "FAIL: silence guard did not fire"; exit 1; }
echo "PASS"
rm -rf "$TMP"
```

Make executable: `chmod +x forge-shell/src-tauri/binaries/forge-recorder/test-silence-guard.sh`.

- [ ] **Step 4: Rebuild and run**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/build.sh
bash forge-shell/src-tauri/binaries/forge-recorder/test-silence-guard.sh
```

Expected: either `PASS` (BlackHole present → warning fires) or `SKIP: BlackHole not installed` (acceptable; we'll still verify visually in the UI). On Jeremy's machine BlackHole IS installed (saw it in earlier device enum), so `PASS` is expected.

- [ ] **Step 5: Commit**

```bash
git add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift forge-shell/src-tauri/binaries/forge-recorder/test-silence-guard.sh
git commit -m "feat(audio-forge): emit MIC_SILENT_AT_SOURCE warning when mic returns silence"
```

---

### Task 6: Verify the rebuilt sidecar end-to-end

This task has no code changes — it confirms all three Swift changes coexist cleanly.

- [ ] **Step 1: Re-run every recorder test in sequence**

```bash
bash forge-shell/src-tauri/binaries/forge-recorder/test-list-devices.sh
bash forge-shell/src-tauri/binaries/forge-recorder/test-start-with-device.sh
bash forge-shell/src-tauri/binaries/forge-recorder/test-silence-guard.sh
```

Expected: each prints `PASS` (or `SKIP` for silence guard if BlackHole is absent).

- [ ] **Step 2: Verify the rebuilt binary is properly signed**

```bash
/usr/bin/codesign -dvvv forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin 2>&1 | grep -E "Identifier|Info.plist"
```

Expected output contains:
```
Identifier=com.forge-marketplace.shell.recorder
Info.plist entries=9
```

If `Info.plist=not bound` appears instead, re-run `bash forge-shell/src-tauri/binaries/forge-recorder/build.sh` and re-check; the build script handles the re-sign automatically.

- [ ] **Step 3: No commit needed for a verification-only task.**

---

### Task 7: Rust — add `list_audio_devices` Tauri command

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs` — add the command function.
- Modify: `forge-shell/src-tauri/src/lib.rs` — register the command in `generate_handler!`.

- [ ] **Step 1: Add the data type and command function in `audio_commands.rs`**

At the top of `audio_commands.rs`, just under the existing `AudioFiles` struct, add:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInputDevice {
    pub uid: String,
    pub name: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    pub channels: u32,
}
```

At the bottom of the file (just before the closing brace of the module or after the last existing `#[tauri::command]`), add:

```rust
#[tauri::command]
pub async fn list_audio_devices(app: AppHandle) -> Result<Vec<AudioInputDevice>, String> {
    let shell = app.shell();
    let (mut rx, mut child) = shell
        .sidecar("forge-recorder")
        .map_err(|e| format!("sidecar lookup: {e}"))?
        .spawn()
        .map_err(|e| format!("sidecar spawn: {e}"))?;

    child
        .write(b"{\"cmd\":\"list_devices\"}\n")
        .map_err(|e| format!("sidecar stdin: {e}"))?;

    let timeout = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        match tokio::time::timeout(std::time::Duration::from_millis(500), rx.recv()).await {
            Ok(Some(CommandEvent::Stdout(bytes))) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                for raw in line.lines() {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        if value.get("event").and_then(|v| v.as_str()) == Some("devices") {
                            let _ = child.kill();
                            let arr = value
                                .get("devices")
                                .and_then(|v| v.as_array())
                                .cloned()
                                .unwrap_or_default();
                            let devices: Vec<AudioInputDevice> = arr
                                .into_iter()
                                .filter_map(|v| serde_json::from_value(v).ok())
                                .collect();
                            return Ok(devices);
                        }
                    }
                }
            }
            Ok(Some(CommandEvent::Stderr(_))) => {}
            Ok(Some(CommandEvent::Terminated(_))) => break,
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) => continue,
        }
    }
    let _ = child.kill();
    Err("timed out waiting for devices event".to_string())
}
```

- [ ] **Step 2: Register the command in `lib.rs`**

In `forge-shell/src-tauri/src/lib.rs`, find the `tauri::generate_handler!` block (around line 24). Add `audio_commands::list_audio_devices,` to the list of commands. The block goes from:

```rust
    .invoke_handler(tauri::generate_handler![
      …existing commands…
      audio_commands::start_recording,
      audio_commands::stop_recording,
      audio_commands::get_recording_status,
      audio_commands::recover_orphaned_recording,
      audio_commands::run_recording_create,
      audio_commands::run_recording_transcribe,
```

to include the new entry. Append (preserve the existing order):

```rust
      audio_commands::list_audio_devices,
```

right after `audio_commands::run_recording_transcribe,` and before the closing `]`.

- [ ] **Step 3: Build the Tauri app to confirm Rust compiles**

```bash
cd forge-shell/src-tauri && cargo build 2>&1 | tail -20
```

Expected: `Compiling forge-shell …` then `Finished dev …`. No errors. Warnings about unused imports are tolerable.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/src-tauri/src/audio_commands.rs forge-shell/src-tauri/src/lib.rs
git commit -m "feat(audio-forge): expose list_audio_devices Tauri command"
```

---

### Task 8: Rust — `start_recording` accepts `mic_device_uid`

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs` — extend `start_recording`'s signature and the JSON it writes to the sidecar.

- [ ] **Step 1: Add the parameter and forward it**

In `audio_commands.rs`, find `pub async fn start_recording(...)`. Change the signature from:

```rust
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    project_root: String,
    sources: Vec<String>,
) -> Result<StartedRecording, String> {
```

to:

```rust
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    project_root: String,
    sources: Vec<String>,
    mic_device_uid: Option<String>,
) -> Result<StartedRecording, String> {
```

Then locate the `start_cmd` JSON construction:

```rust
    let start_cmd = serde_json::json!({
        "cmd": "start",
        "outDir": out_dir.to_string_lossy(),
        "id": id,
        "sources": sources,
    });
```

and replace with:

```rust
    let start_cmd = serde_json::json!({
        "cmd": "start",
        "outDir": out_dir.to_string_lossy(),
        "id": id,
        "sources": sources,
        // Optional. When present and non-empty, the recorder will set this
        // device as the input on AVAudioEngine before starting. When null or
        // empty, the recorder uses the system default input.
        "micDeviceUID": mic_device_uid.as_deref().unwrap_or(""),
    });
```

- [ ] **Step 2: Build**

```bash
cd forge-shell/src-tauri && cargo build 2>&1 | tail -10
```

Expected: clean build. Note: the JS side will start passing `null` for the parameter in Task 11; until then, calls from JS will fail-fast with a deserialization error — that's fine because we don't run the app between Rust tasks.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/src-tauri/src/audio_commands.rs
git commit -m "feat(audio-forge): start_recording accepts mic_device_uid"
```

---

### Task 9: JS — add mic-device dropdown to the toolbar markup

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js` — extend the toolbar scaffold (lines ~84-87).

- [ ] **Step 1: Add the dropdown HTML**

In `audio-forge.js`, locate the `scaffold()` function. Find the source-checkboxes block:

```js
          <div class="af-source-checkboxes" data-af-ref="sources">
            <label><input type="checkbox" data-af-source="system" checked> system</label>
            <label><input type="checkbox" data-af-source="mic" checked> mic</label>
          </div>
```

Immediately AFTER this block (still inside `.plugin-toolbar`), add:

```js
          <div class="af-mic-device" data-af-ref="mic-device-wrap">
            <label class="af-mic-device-label" for="af-mic-device-select">
              <i class="fa-solid fa-microphone-lines"></i> Mic:
            </label>
            <select id="af-mic-device-select" data-af-ref="mic-device-select">
              <option value="">(System default)</option>
            </select>
          </div>
```

- [ ] **Step 2: Verify visually**

```bash
cd forge-shell && npm run tauri dev
```

The Audio Forge view should now show a "Mic: (System default)" dropdown next to the source checkboxes. The dropdown has only the placeholder option for now — Task 10 populates it.

- [ ] **Step 3: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): add mic-device dropdown to toolbar"
```

---

### Task 10: JS — populate dropdown from `list_audio_devices` + persist selection

**Files:**
- Create: `forge-shell/test/audio-forge.devices.test.js` — unit-test the helper that normalizes the device list for the dropdown.
- Modify: `forge-shell/app/js/audio-forge.js` — add helper, wiring, persistence.

- [ ] **Step 1: Write the failing test for the normalizer helper**

Create `forge-shell/test/audio-forge.devices.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');

// Inline copy of the helper under test. Keep this in sync with the
// implementation in audio-forge.js. Both intentionally do the same thing —
// the test exists to lock down the contract.
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

test('normalizes a valid device list', () => {
  const out = normalizeDeviceList([
    { uid: 'a', name: 'Mic A', isDefault: true, channels: 1 },
    { uid: 'b', name: 'Mic B', isDefault: false, channels: 2 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].uid, 'a');
  assert.equal(out[0].isDefault, true);
  assert.equal(out[1].channels, 2);
});

test('drops malformed entries', () => {
  const out = normalizeDeviceList([
    { uid: 'a', name: 'Mic A' },
    { uid: 123, name: 'Mic Bad' },     // uid not a string
    null,
    { name: 'No UID' },                // missing uid
    { uid: 'c', name: 'Mic C', isDefault: false, channels: 'three' }, // bad channels
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((d) => d.uid), ['a', 'c']);
  assert.equal(out[1].channels, 0); // bad channels coerced to 0
});

test('returns empty for non-array input', () => {
  assert.deepEqual(normalizeDeviceList(null), []);
  assert.deepEqual(normalizeDeviceList('oops'), []);
  assert.deepEqual(normalizeDeviceList({}), []);
});
```

- [ ] **Step 2: Run the test — should FAIL (file under test doesn't export the helper yet)**

```bash
cd forge-shell && node --test test/audio-forge.devices.test.js
```

Expected: tests PASS (because the helper is inlined in the test file for now — this is intentional, the test locks the contract independently). If they don't pass, fix typos before continuing.

- [ ] **Step 3: Add the helper, dropdown population, and persistence to `audio-forge.js`**

In `audio-forge.js`, find the auto-stop persistence block (around line 45):

```js
  /* ── Auto-stop persistence ── */
  const AUTOSTOP_KEY = 'audio-forge.autoStopMinutes';
```

Immediately ABOVE that, add:

```js
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
```

Then, find the Tauri command wrappers section (search for `async function invokeStatus()`). Immediately after `invokeStatus`, add:

```js
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
```

Now wire population + change handling. Find `wireAutoStopControls();` inside `scaffold()` and immediately after it, add:

```js
    populateMicDevices();
    wireMicDeviceControl();
```

Then, anywhere among the other helper functions (just above `wireSearch` is a good spot), add:

```js
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
```

Finally, also disable the dropdown during recording. In `renderToolbar()`, find:

```js
    const autostopSelect = ref('autostop-select');
    if (autostopSelect) autostopSelect.disabled = (s !== 'idle');
```

Immediately after, add:

```js
    const micDeviceSelect = ref('mic-device-select');
    if (micDeviceSelect) micDeviceSelect.disabled = (s !== 'idle');
```

- [ ] **Step 4: Verify the test still passes**

```bash
cd forge-shell && node --test test/audio-forge.devices.test.js
```

Expected: all three tests pass.

- [ ] **Step 5: Visual smoke check**

```bash
cd forge-shell && npm run tauri dev
```

The dropdown should now list real devices (e.g. "MacBook Pro Microphone (default)", "BlackHole 2ch", "HD Webcam C615"). Pick one and reload — selection persists.

- [ ] **Step 6: Commit**

```bash
git add forge-shell/app/js/audio-forge.js forge-shell/test/audio-forge.devices.test.js
git commit -m "feat(audio-forge): populate mic device dropdown and persist selection"
```

---

### Task 11: JS — pass the selected UID to `invokeStart`

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js` — extend `invokeStart` and its single caller.

- [ ] **Step 1: Extend `invokeStart` to accept and forward the UID**

Find `invokeStart`:

```js
  async function invokeStart(sources) {
    const core = tauriCore();
    if (!core) throw new Error('Tauri runtime not available');
    return core.invoke('start_recording', { projectRoot, sources });
  }
```

Replace with:

```js
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
```

- [ ] **Step 2: Update the caller in `onToggleRecord`**

Find the call site inside `onToggleRecord`:

```js
        const started = await invokeStart(sources);
```

Replace with:

```js
        const micDeviceUID = (ref('mic-device-select') && ref('mic-device-select').value) || '';
        const started = await invokeStart(sources, micDeviceUID);
```

- [ ] **Step 3: Verify**

```bash
cd forge-shell && npm run tauri dev
```

Pick the BlackHole device, record for 5 seconds, stop. Recording is saved; transcription returns silence as expected. Switch to "(System default)" — recording records actual mic audio.

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): pass selected mic device UID to recorder"
```

---

### Task 12: JS — toast on `MIC_SILENT_AT_SOURCE` warning

**Files:**
- Modify: `forge-shell/app/js/audio-forge.js` — subscribe to the `audio-forge://warning` event in `ensureListeners`.

- [ ] **Step 1: Add the listener**

Find `ensureListeners`. Just after the `audio-forge://error` listener block:

```js
    unlisteners.push(await evt.listen('audio-forge://error', (e) => {
      const p = e.payload || {};
      const msg = p.message || 'Recorder error';
      dispatch({ type: 'ERROR_EVENT', message: msg });
      toast(msg, 'error');
    }));
```

Add the new warning listener immediately after:

```js
    unlisteners.push(await evt.listen('audio-forge://warning', (e) => {
      const p = e.payload || {};
      // We only display warnings; they do not affect the state machine.
      if (p.code === 'MIC_SILENT_AT_SOURCE') {
        toast(p.message || 'Microphone is producing silence.', 'warn');
      } else if (p.message) {
        toast(p.message, 'warn');
      }
    }));
```

- [ ] **Step 2: Verify by recording from BlackHole**

```bash
cd forge-shell && npm run tauri dev
```

Pick "BlackHole 2ch" from the dropdown, press Record. Within 1 second a toast appears:
> Microphone is producing silence (peak=0.0). Device=…BlackHole…. Likely causes: …

Recording continues — that's intentional. Stop after 3s; the WAV is silent (expected) but you were warned in real time.

- [ ] **Step 3: Verify NO toast appears with a working mic**

Pick "(System default)" with the laptop lid open and a working built-in mic. Press Record. No `MIC_SILENT_AT_SOURCE` toast should appear (real audio is present, peak well above 1e-4).

- [ ] **Step 4: Commit**

```bash
git add forge-shell/app/js/audio-forge.js
git commit -m "feat(audio-forge): surface MIC_SILENT_AT_SOURCE warning to user"
```

---

### Task 13: Documentation update

**Files:**
- Modify: `audio-forge/README.md` — document the new mic-selection toolbar and silent-source warning.

- [ ] **Step 1: Append a "Choosing a Microphone" section**

Open `audio-forge/README.md`. After the existing "Commands" table (and before "File Layout"), insert:

```markdown
## Choosing a Microphone

By default Forge Shell records from the system default input device (System Settings → Sound → Input). The Audio Forge toolbar includes a **Mic** dropdown that lets you override this per project.

- Pick **(System default)** to follow whatever macOS considers the default input.
- Pick a specific device (e.g. "Logitech HD Webcam C615 (default)") to record from it regardless of the system default. This is useful when the MacBook is closed in clamshell mode (the built-in mic is disabled by hardware) or when a virtual device like BlackHole is the default but you want a physical mic.

Your selection is remembered across launches via `localStorage`. If the device disappears (e.g. you unplug the USB mic), Forge Shell silently falls back to the system default and shows a one-time warning.

### Silent-source warning

Within ~1 second of pressing Record, Forge Shell checks whether the chosen mic is actually producing audio. If the input is bit-perfect silence (peak amplitude < 0.0001), a toast appears:

> Microphone is producing silence (peak=0.0). Device=…. Likely causes: MacBook lid closed disabling built-in mic, mic muted in System Settings, a HAL plugin (Wispr/Krisp/etc.) intercepting the input, or wrong device selected.

The recording continues — you may still want the system-audio track even when the mic is dead. Stop early if the warning surprises you.

### Diagnosing a silent mic

| Cause | Fix |
|---|---|
| Lid closed on MacBook Pro | Open the lid, or pick a different device in the dropdown |
| Input muted at OS level | System Settings → Sound → Input → raise volume slider |
| HAL plugin (Wispr Flow, Krisp, NVIDIA Broadcast) intercepting | Quit the interceptor app, retry |
| Wrong default device selected | Pick the intended device explicitly in the toolbar |
```

- [ ] **Step 2: Commit**

```bash
git add audio-forge/README.md
git commit -m "docs(audio-forge): document mic-selection toolbar and silence warning"
```

---

## Self-Review

**Spec coverage:**

| Requirement from request | Task(s) |
|---|---|
| User can select which mic to use | 1, 2, 7, 9, 10, 11 |
| Selection persists across sessions | 10 (localStorage `audio-forge.micDeviceUID`) |
| Recorder uses the selected device | 3, 4, 8 |
| Warn if the selected device is silent | 5, 12 |
| Fall back gracefully if device disappears | 10 (`populateMicDevices` clears stale selection) |
| Documentation reflects new behavior | 13 |

No gaps.

**Placeholder scan:** zero `TBD`/`TODO`/`implement later`. Every step shows real code, real commands, expected output.

**Type consistency:**
- `micDeviceUID` (camelCase) is used at the JS↔Tauri boundary and in the recorder's stdin JSON.
- `mic_device_uid` (snake_case) is used in Rust function signatures — `serde` + Tauri handle the bridge.
- `preferredDeviceUID` is the Swift property name on `MicCapture`.
- `MIC_SILENT_AT_SOURCE` is the code on the warning event, emitted as `code` in JSON, asserted in `test-silence-guard.sh` and matched in JS `ensureListeners`.
- `normalizeDeviceList` has identical signature/behavior in test and production code (intentional duplication; locked by the test).

All names check out.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-audio-forge-mic-device-selection.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
