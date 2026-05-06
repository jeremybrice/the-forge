# Audio-Forge Implementation Plan — Phase 2A: Recorder Sidecar + Tauri Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the audio capture layer for `audio-forge` — a Swift sidecar `forge-recorder` that captures system audio (via `ScreenCaptureKit`) + microphone (via `AVAudioEngine`) into separate WAV files, plus Tauri Rust commands that drive it from the Forge Shell process. End state: a JS caller in the Tauri dev console can `invoke('start_recording', {...})`, speak/play audio, `invoke('stop_recording')`, and end up with a fully transcribed recording in `audio-forge/recordings/`.

**Architecture:**
1. Swift Package `forge-recorder` (Sources/forge-recorder/main.swift) reads line-delimited JSON commands from stdin and emits line-delimited JSON events to stdout. One global `RecorderSession` actor owns capture state.
2. A build script produces an arch-specific binary copied to `forge-shell/src-tauri/binaries/forge-recorder-{arch}-apple-darwin`. Tauri `bundle.externalBin` registers it as a sidecar.
3. New `audio_commands.rs` module manages the spawned sidecar lifetime via `Mutex<Option<RecorderHandle>>` state. Three Tauri commands: `start_recording`, `stop_recording`, `get_recording_status`. Two more shell-out commands: `run_recording_create`, `run_recording_transcribe` (delegate to forge-lib).
4. `audio-forge/active.json` persists the running recording's state across forge-shell restarts; `recover_orphaned_recording` checks for it on launch.

**Tech Stack:** Swift 5.9+, ScreenCaptureKit (macOS 13+), AVFoundation/AVAudioEngine, Tauri 2.10, `tauri-plugin-shell` (already declared in `Cargo.toml`).

**Reference docs:**
- Design: `docs/plans/2026-05-06-audio-forge-design.md`
- Phase 1 plan: `docs/plans/2026-05-06-audio-forge-implementation.md`

**Scope boundary:** This plan ends with the Tauri command surface and the sidecar working end-to-end. The Forge Shell view (record button + meter + transcript browser) and the `/audio-forge:record` plugin command are out of scope here — they land in **Phase 2B (`docs/plans/2026-05-08-audio-forge-shell-view-implementation.md`)**, drafted after this plan ships.

**TDD applicability:** Phase 1 was almost fully TDD'd because forge-lib is pure Python. Phase 2A is mostly NOT TDD'able — Swift audio capture requires real audio devices, and Tauri Rust commands that spawn child processes are integration-only. Where automation is feasible (sidecar IPC scaffolding using fake stdin, active.json persistence in Rust) tests live alongside. Where it isn't (capture itself, permission prompts, Tauri sidecar integration), each task ends with a manual smoke check whose exact commands are written in the step.

---

## Prerequisites

Before starting any task:

```bash
# Toolchain check
swift --version    # expect 5.9 or newer
xcode-select -p    # expect a path; run `xcode-select --install` if missing
sw_vers -productVersion   # expect 13.0 or newer

# Verify Phase 1 artifacts are on main
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature log --oneline -5 | grep -q audio-forge && echo "Phase 1 present" || echo "Phase 1 missing — abort"

# Create the feature branch
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature checkout -b feat/audio-forge-phase-2a
```

If any check fails, stop and resolve before proceeding.

---

## File Structure

**Create:**
- `forge-shell/src-tauri/binaries/forge-recorder/Package.swift` — Swift Package manifest.
- `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift` — sidecar implementation (one file).
- `forge-shell/src-tauri/binaries/forge-recorder/build.sh` — build + copy script.
- `forge-shell/src-tauri/binaries/forge-recorder/.gitignore` — ignore `.build/`.
- `forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin` — built artifact (committed). For Intel-only contributors, `forge-recorder-x86_64-apple-darwin`. For both, both.
- `forge-shell/src-tauri/src/audio_commands.rs` — Tauri Rust commands.

**Modify:**
- `forge-shell/src-tauri/Cargo.toml` — add `tokio` and `tauri-plugin-shell` features needed for sidecar I/O.
- `forge-shell/src-tauri/tauri.conf.json` — declare `bundle.externalBin`, add `bundle.macOS.entitlements` + Info.plist usage descriptions.
- `forge-shell/src-tauri/capabilities/default.json` — already allows shell exec; verify and add sidecar-specific entries if needed.
- `forge-shell/src-tauri/src/lib.rs` — `mod audio_commands;`, register handlers, manage `RecorderState`, run orphan recovery on startup.

**Test commands:**
- Sidecar standalone: `swift run forge-recorder` from `forge-shell/src-tauri/binaries/forge-recorder/`, then send JSON commands on stdin.
- Tauri dev mode: `cd forge-shell && npm run tauri:dev`, then in browser DevTools console: `await window.__TAURI__.core.invoke('start_recording', {projectRoot: '/abs/path', sources: ['mic']})`.
- forge-lib (regression): `cd forge-lib && python3 -m pytest -v` — must stay at 411 PASS.

---

## Task 1: Swift Package skeleton

**Files:**
- Create: `forge-shell/src-tauri/binaries/forge-recorder/Package.swift`
- Create: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`
- Create: `forge-shell/src-tauri/binaries/forge-recorder/.gitignore`

- [ ] **Step 1: Verify the binaries directory doesn't exist yet**

```bash
test -d /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries && echo "exists — abort" || echo "ok to create"
```

Expected: `ok to create`.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder
```

- [ ] **Step 3: Write `Package.swift`**

Create `forge-shell/src-tauri/binaries/forge-recorder/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "forge-recorder",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "forge-recorder",
            path: "Sources/forge-recorder"
        )
    ]
)
```

- [ ] **Step 4: Write the seed `main.swift`**

Create `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`:

```swift
import Foundation

// Skeleton: read one stdin line, echo a "started" event, exit. Subsequent tasks
// replace this with the real IPC loop.
if let line = readLine() {
    let response = "{\"event\":\"echo\",\"received\":\(JSONSerializer.escape(line))}"
    print(response)
}

enum JSONSerializer {
    static func escape(_ s: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [s], options: [])) ?? Data()
        let str = String(data: data, encoding: .utf8) ?? "[\"\"]"
        // strip leading [ and trailing ]
        return String(str.dropFirst().dropLast())
    }
}
```

- [ ] **Step 5: Add `.gitignore`**

Create `forge-shell/src-tauri/binaries/forge-recorder/.gitignore`:

```
.build/
*.xcodeproj
.swiftpm/
.DS_Store
```

- [ ] **Step 6: Verify the package builds**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder
swift build
```

Expected: `Build complete!` with no errors. The binary lives at `.build/debug/forge-recorder`.

- [ ] **Step 7: Smoke-test the echo**

```bash
echo '{"cmd":"hello"}' | swift run forge-recorder
```

Expected output (one line):
```
{"event":"echo","received":"{\"cmd\":\"hello\"}"}
```

- [ ] **Step 8: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): swift package skeleton with stdin echo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: JSON IPC scaffold (status + error events)

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

This task replaces the echo with a real IPC loop. Subsequent tasks add capture commands.

- [ ] **Step 1: Replace `main.swift` with the IPC scaffold**

Write `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`:

```swift
import Foundation

// MARK: - JSON helpers

func emit(_ payload: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
          let line = String(data: data, encoding: .utf8) else {
        return
    }
    // Atomic line write to stdout.
    FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

func emitError(code: String, message: String) {
    emit(["event": "error", "code": code, "message": message])
}

// MARK: - Sidecar state

final class Recorder {
    var isRecording: Bool = false
    var startedAt: Date?
    var id: String?

    func handle(_ payload: [String: Any]) {
        guard let cmd = payload["cmd"] as? String else {
            emitError(code: "BAD_COMMAND", message: "missing 'cmd' field")
            return
        }

        switch cmd {
        case "status":
            emit([
                "event": "status",
                "isRecording": isRecording,
                "id": id ?? NSNull(),
                "elapsedSeconds": startedAt.map { Int(Date().timeIntervalSince($0)) } ?? NSNull(),
            ])

        case "start":
            // Implemented in Task 5. For now: respond with an error so callers know it's unimplemented.
            emitError(code: "NOT_IMPLEMENTED", message: "start not implemented in scaffold")

        case "stop":
            // Implemented in Task 5.
            emitError(code: "NOT_IMPLEMENTED", message: "stop not implemented in scaffold")

        default:
            emitError(code: "UNKNOWN_COMMAND", message: "unknown cmd: \(cmd)")
        }
    }
}

// MARK: - IPC main loop

let recorder = Recorder()

while let line = readLine() {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { continue }

    guard let data = trimmed.data(using: .utf8),
          let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        emitError(code: "BAD_JSON", message: "could not parse: \(trimmed)")
        continue
    }

    recorder.handle(payload)
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder
swift build
```

Expected: `Build complete!`

- [ ] **Step 3: Smoke-test the status command**

```bash
echo '{"cmd":"status"}' | swift run forge-recorder
```

Expected output:
```
{"event":"status","isRecording":false,"id":null,"elapsedSeconds":null}
```

(Field ordering may vary — JSONSerialization doesn't guarantee key order.)

- [ ] **Step 4: Smoke-test bad input**

```bash
printf '%s\n' 'not json' '{"cmd":"unknown"}' '{"no_cmd":"x"}' | swift run forge-recorder
```

Expected: three error event lines, one per malformed input.

- [ ] **Step 5: Smoke-test multi-line input**

```bash
printf '%s\n' '{"cmd":"status"}' '{"cmd":"status"}' '{"cmd":"status"}' | swift run forge-recorder
```

Expected: three status event lines.

- [ ] **Step 6: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): line-delimited JSON IPC scaffold (status + errors)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Microphone capture via AVAudioEngine

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

Adds a `MicCapture` helper class. Recording into a 48 kHz / 16-bit / mono PCM WAV via `AVAudioEngine.inputNode` tap. Doesn't yet wire to the `start` command — Task 5 does that.

- [ ] **Step 1: Add `import AVFoundation` and the `MicCapture` class**

In `main.swift`, replace the `import Foundation` line with:

```swift
import Foundation
import AVFoundation
```

Then, between the `import` block and the `// MARK: - JSON helpers` section, insert:

```swift
// MARK: - Mic capture

final class MicCapture {
    let outputURL: URL
    let engine = AVAudioEngine()
    private var file: AVAudioFile?
    private(set) var lastRMS: Float = 0
    private(set) var sampleCount: Int64 = 0

    init(outputURL: URL) {
        self.outputURL = outputURL
    }

    func start() throws {
        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        // Output: 48 kHz, mono, 16-bit PCM
        guard let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 48000,
            channels: 1,
            interleaved: true
        ) else {
            throw NSError(domain: "ForgeRecorder", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "could not build mic output format"])
        }

        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 48000.0,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ]

        // Create the parent dir for the output file if needed
        try FileManager.default.createDirectory(
            at: outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        self.file = try AVAudioFile(forWriting: outputURL, settings: settings)

        // Optional converter from input format to output format (input may be 44.1k stereo or hardware-native)
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)

        inputNode.installTap(onBus: 0, bufferSize: 4800, format: inputFormat) { [weak self] buffer, _ in
            guard let self = self, let file = self.file else { return }

            // Convert
            guard let outBuffer = AVAudioPCMBuffer(
                pcmFormat: outputFormat,
                frameCapacity: AVAudioFrameCount(outputFormat.sampleRate)
            ) else { return }

            var error: NSError?
            var produced = false
            converter?.convert(to: outBuffer, error: &error) { _, statusPointer in
                if produced {
                    statusPointer.pointee = .noDataNow
                    return nil
                }
                produced = true
                statusPointer.pointee = .haveData
                return buffer
            }
            if error != nil { return }

            // Compute RMS of the converted Int16 mono buffer
            if let int16 = outBuffer.int16ChannelData?[0] {
                let count = Int(outBuffer.frameLength)
                if count > 0 {
                    var sumSq: Double = 0
                    for i in 0..<count {
                        let s = Double(int16[i]) / 32768.0
                        sumSq += s * s
                    }
                    self.lastRMS = Float(sqrt(sumSq / Double(count)))
                }
            }

            do {
                try file.write(from: outBuffer)
                self.sampleCount += Int64(outBuffer.frameLength)
            } catch {
                // Surface to stderr but don't crash; the recording will still be partially written.
                FileHandle.standardError.write(Data("mic write error: \(error)\n".utf8))
            }
        }

        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        file = nil
    }

    var durationSeconds: Double {
        sampleCount > 0 ? Double(sampleCount) / 48000.0 : 0
    }
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder
swift build
```

Expected: `Build complete!`

- [ ] **Step 3: Wire a temporary `start` for mic-only smoke test**

In `main.swift`, find the `case "start":` arm in `Recorder.handle` and replace temporarily with:

```swift
        case "start":
            if isRecording {
                emitError(code: "ALREADY_RECORDING", message: "a recording is already in progress")
                return
            }
            guard let outDir = payload["outDir"] as? String,
                  let id = payload["id"] as? String else {
                emitError(code: "BAD_PAYLOAD", message: "start needs outDir and id")
                return
            }
            let micURL = URL(fileURLWithPath: outDir).appendingPathComponent("\(id)-mic.wav")
            do {
                let cap = MicCapture(outputURL: micURL)
                try cap.start()
                self.activeMic = cap
                self.id = id
                self.startedAt = Date()
                self.isRecording = true
                emit([
                    "event": "started",
                    "id": id,
                    "files": ["mic": micURL.path],
                ])
            } catch {
                emitError(code: "MIC_START_FAILED", message: "\(error.localizedDescription)")
            }
```

And update the `case "stop":` arm:

```swift
        case "stop":
            guard isRecording, let cap = activeMic else {
                emitError(code: "NOT_RECORDING", message: "no recording in progress")
                return
            }
            cap.stop()
            let duration = startedAt.map { Date().timeIntervalSince($0) } ?? 0
            isRecording = false
            self.activeMic = nil
            emit([
                "event": "stopped",
                "id": id ?? NSNull(),
                "duration_seconds": Int(duration),
                "sample_seconds": cap.durationSeconds,
                "files": ["mic": cap.outputURL.path],
            ])
            self.id = nil
            self.startedAt = nil
```

Add the field declaration to the `Recorder` class (top of `class Recorder`):

```swift
    var activeMic: MicCapture?
```

- [ ] **Step 4: Build**

```bash
swift build
```

Expected: `Build complete!`

- [ ] **Step 5: Manual smoke test (mic permission required)**

This will trigger the macOS microphone permission prompt the first time. Grant when asked.

```bash
mkdir -p /tmp/forge-mic-test
cd /tmp/forge-mic-test
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder <<'EOF'
{"cmd":"start","outDir":"/tmp/forge-mic-test","id":"smoke-test-001"}
EOF
```

The process is now reading from EOF; you need an interactive session. Better:

```bash
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
# Then paste:
{"cmd":"start","outDir":"/tmp/forge-mic-test","id":"smoke-test-001"}
# Speak for 5 seconds.
{"cmd":"stop"}
# Press Ctrl-D to exit.
```

Expected event sequence on stdout:
1. `{"event":"started","id":"smoke-test-001","files":{"mic":"/tmp/forge-mic-test/smoke-test-001-mic.wav"}}`
2. After ~5 s and the stop command: `{"event":"stopped","id":"smoke-test-001","duration_seconds":5,...}`

Verify the WAV is on disk and playable:

```bash
ls -lh /tmp/forge-mic-test/smoke-test-001-mic.wav
afinfo /tmp/forge-mic-test/smoke-test-001-mic.wav
afplay /tmp/forge-mic-test/smoke-test-001-mic.wav
```

Expected: file size ≈ 480 KB for 5 s of 48k/16/mono. `afinfo` reports 48000 Hz / 1 channel / 16 bits. `afplay` plays back your voice.

If the permission was denied or the WAV is silent/garbage, fix before proceeding. Common gotchas:
- Permission was denied: open System Settings → Privacy & Security → Microphone, enable Terminal (or whichever shell you ran from).
- WAV duration is 0: the engine never started. Re-run with stderr captured: `... 2>err.log` and inspect `err.log`.

- [ ] **Step 6: Cleanup**

```bash
rm -rf /tmp/forge-mic-test
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): mic capture via AVAudioEngine, 48k/16/mono PCM WAV

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: System audio capture via ScreenCaptureKit

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

Adds a `SystemCapture` class that captures the desktop's audio (no video) into a parallel WAV file. Combined with `MicCapture` in Task 5.

- [ ] **Step 1: Add ScreenCaptureKit import + the `SystemCapture` class**

In `main.swift`:

Replace the existing `import` block with:

```swift
import Foundation
import AVFoundation
import ScreenCaptureKit
```

Add this block after the `MicCapture` class:

```swift
// MARK: - System audio capture

final class SystemCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    let outputURL: URL
    private var stream: SCStream?
    private var file: AVAudioFile?
    private(set) var lastRMS: Float = 0
    private(set) var sampleCount: Int64 = 0
    private let outputQueue = DispatchQueue(label: "com.forge.recorder.system-output")

    init(outputURL: URL) {
        self.outputURL = outputURL
        super.init()
    }

    /// Synchronous-ish wrapper: kicks off async start and waits with a semaphore.
    func start() throws {
        let semaphore = DispatchSemaphore(value: 0)
        var startError: Error?

        Task {
            do {
                try await self.startAsync()
            } catch {
                startError = error
            }
            semaphore.signal()
        }
        // Block up to 10 s for the SCContentSharingPicker / shareableContent fetch
        if semaphore.wait(timeout: .now() + 10) == .timedOut {
            throw NSError(domain: "ForgeRecorder", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "SCStream start timed out"])
        }
        if let err = startError { throw err }
    }

    private func startAsync() async throws {
        // Discover available displays / windows. We capture the primary display's audio,
        // not its video (audioOnly content filter via main display + capturesAudio config).
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let display = content.displays.first else {
            throw NSError(domain: "ForgeRecorder", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "no SCDisplay found"])
        }

        // Filter that includes the display, no excluded apps. Audio capture comes from
        // every audible app on the system.
        let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true   // don't echo our own emitted audio
        config.sampleRate = 48000
        config.channelCount = 2                     // we'll mix down to mono in the buffer handler
        // Minimal video footprint — SCStream still requires non-zero dims.
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

        // Output WAV settings (mono-down-mix from stereo, 48 kHz, 16-bit)
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 48000.0,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false,
        ]
        try FileManager.default.createDirectory(
            at: outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        self.file = try AVAudioFile(forWriting: outputURL, settings: settings)

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: outputQueue)
        // Video output is required by SCStream even though we discard frames.
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: outputQueue)
        try await stream.startCapture()
        self.stream = stream
    }

    func stop() {
        guard let stream = self.stream else { return }
        let semaphore = DispatchSemaphore(value: 0)
        Task {
            try? await stream.stopCapture()
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 5)
        self.stream = nil
        file = nil
    }

    var durationSeconds: Double {
        sampleCount > 0 ? Double(sampleCount) / 48000.0 : 0
    }

    // MARK: SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid else { return }

        // Extract the AudioBufferList
        var blockBuffer: CMBlockBuffer?
        var audioBufferList = AudioBufferList()
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr, let blockBuf = blockBuffer else { return }
        _ = blockBuf  // keep the block buffer alive

        // ScreenCaptureKit emits float32 stereo interleaved at 48 kHz by default.
        // Build an AVAudioPCMBuffer from the raw bytes.
        guard let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc)?.pointee else {
            return
        }
        let inFormat = AVAudioFormat(streamDescription: &asbd as UnsafePointer<AudioStreamBasicDescription>)
        guard let inFormat = inFormat else { return }

        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard let inBuf = AVAudioPCMBuffer(pcmFormat: inFormat, frameCapacity: frameCount) else { return }
        inBuf.frameLength = frameCount

        // Copy samples from AudioBufferList to inBuf
        let mBuffers = audioBufferList.mBuffers
        if let src = mBuffers.mData,
           let dst = inBuf.audioBufferList.pointee.mBuffers.mData {
            memcpy(dst, src, Int(mBuffers.mDataByteSize))
        }

        // Convert to mono Int16 48k
        guard let outFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 48000,
            channels: 1,
            interleaved: true
        ) else { return }

        let converter = AVAudioConverter(from: inFormat, to: outFormat)
        guard let outBuf = AVAudioPCMBuffer(
            pcmFormat: outFormat,
            frameCapacity: AVAudioFrameCount(outFormat.sampleRate)
        ) else { return }

        var convError: NSError?
        var produced = false
        converter?.convert(to: outBuf, error: &convError) { _, statusPointer in
            if produced {
                statusPointer.pointee = .noDataNow
                return nil
            }
            produced = true
            statusPointer.pointee = .haveData
            return inBuf
        }
        if convError != nil { return }

        if let int16 = outBuf.int16ChannelData?[0] {
            let count = Int(outBuf.frameLength)
            if count > 0 {
                var sumSq: Double = 0
                for i in 0..<count {
                    let s = Double(int16[i]) / 32768.0
                    sumSq += s * s
                }
                self.lastRMS = Float(sqrt(sumSq / Double(count)))
            }
        }

        do {
            try file?.write(from: outBuf)
            self.sampleCount += Int64(outBuf.frameLength)
        } catch {
            FileHandle.standardError.write(Data("system write error: \(error)\n".utf8))
        }
    }

    // MARK: SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        FileHandle.standardError.write(Data("SCStream stopped with error: \(error)\n".utf8))
    }
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder
swift build
```

Expected: `Build complete!` Watch for ScreenCaptureKit deprecation warnings — they are advisory; do not change behavior.

- [ ] **Step 3: Standalone manual test of system capture**

Skip this step until Task 5 wires `start` to use `SystemCapture` alongside `MicCapture`. The class is library code in this task. Verification happens in Task 5.

- [ ] **Step 4: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): system-audio capture via ScreenCaptureKit (no video)

Captures system audio at 48k stereo float, downmixes to 48k/16/mono PCM
in the SCStreamOutput callback, writes to AVAudioFile. Excludes our own
emitted audio via excludesCurrentProcessAudio.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Dual-track concurrent recording

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

Replaces the temporary mic-only `start` from Task 3 with the real dual-track logic. The `sources` array in the start payload picks which captures to run; either or both.

- [ ] **Step 1: Replace the `Recorder` class body**

In `main.swift`, find the `final class Recorder { … }` block and replace its body entirely with:

```swift
final class Recorder {
    var isRecording: Bool = false
    var startedAt: Date?
    var id: String?
    var outDir: String?
    var sources: Set<String> = []
    var activeMic: MicCapture?
    var activeSystem: SystemCapture?

    func handle(_ payload: [String: Any]) {
        guard let cmd = payload["cmd"] as? String else {
            emitError(code: "BAD_COMMAND", message: "missing 'cmd' field")
            return
        }

        switch cmd {
        case "status":
            emit([
                "event": "status",
                "isRecording": isRecording,
                "id": id ?? NSNull(),
                "elapsedSeconds": startedAt.map { Int(Date().timeIntervalSince($0)) } ?? NSNull(),
            ])

        case "start":
            startCapture(payload)

        case "stop":
            stopCapture()

        default:
            emitError(code: "UNKNOWN_COMMAND", message: "unknown cmd: \(cmd)")
        }
    }

    private func startCapture(_ payload: [String: Any]) {
        if isRecording {
            emitError(code: "ALREADY_RECORDING", message: "a recording is already in progress")
            return
        }
        guard let outDir = payload["outDir"] as? String,
              let id = payload["id"] as? String,
              let sourcesArr = payload["sources"] as? [String] else {
            emitError(code: "BAD_PAYLOAD", message: "start needs outDir, id, sources")
            return
        }

        self.id = id
        self.outDir = outDir
        self.sources = Set(sourcesArr)

        var startedFiles: [String: String] = [:]
        var startedAny = false

        // System first (user is likely to deny screen-recording perm; fail fast)
        if self.sources.contains("system") {
            let url = URL(fileURLWithPath: outDir).appendingPathComponent("\(id)-system.wav")
            do {
                let cap = SystemCapture(outputURL: url)
                try cap.start()
                self.activeSystem = cap
                startedFiles["system"] = url.path
                startedAny = true
            } catch {
                emitError(code: "PERMISSION_SCREEN_RECORDING",
                          message: "system audio capture failed: \(error.localizedDescription)")
                // Fall through; if mic also fails we'll bail.
            }
        }

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

        guard startedAny else {
            emitError(code: "PERMISSION_ALL", message: "all requested sources failed to start")
            self.id = nil
            self.outDir = nil
            self.sources.removeAll()
            return
        }

        self.startedAt = Date()
        self.isRecording = true
        emit([
            "event": "started",
            "id": id,
            "files": startedFiles,
            "sources": startedFiles.keys.sorted(),
        ])
    }

    private func stopCapture() {
        guard isRecording else {
            emitError(code: "NOT_RECORDING", message: "no recording in progress")
            return
        }
        var files: [String: String] = [:]
        if let cap = activeSystem {
            cap.stop()
            files["system"] = cap.outputURL.path
        }
        if let cap = activeMic {
            cap.stop()
            files["mic"] = cap.outputURL.path
        }

        let duration = startedAt.map { Date().timeIntervalSince($0) } ?? 0
        emit([
            "event": "stopped",
            "id": id ?? NSNull(),
            "duration_seconds": Int(duration),
            "files": files,
        ])

        isRecording = false
        startedAt = nil
        id = nil
        outDir = nil
        sources.removeAll()
        activeMic = nil
        activeSystem = nil
    }
}
```

- [ ] **Step 2: Build**

```bash
swift build
```

Expected: `Build complete!`

- [ ] **Step 3: Manual smoke test — mic only**

```bash
mkdir -p /tmp/forge-dual-mic
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
# Paste:
{"cmd":"start","outDir":"/tmp/forge-dual-mic","id":"mic-only-001","sources":["mic"]}
# Speak for 3s
{"cmd":"stop"}
# Ctrl-D
```

Expected: `started` event with only `mic` in files, then `stopped`. Verify WAV plays back.

- [ ] **Step 4: Manual smoke test — system only**

This requires Screen Recording permission. The first attempt may fail with a `PERMISSION_SCREEN_RECORDING` error and a system prompt to enable Screen Recording for whichever shell binary you're running from. Grant it, restart the shell, retry.

```bash
mkdir -p /tmp/forge-dual-sys
# Play music or a YouTube video before running this.
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
{"cmd":"start","outDir":"/tmp/forge-dual-sys","id":"sys-only-001","sources":["system"]}
# Let 5 s of audio elapse
{"cmd":"stop"}
# Ctrl-D
```

Expected: `started` with `system` only, then `stopped`. The WAV captures whatever was playing.

- [ ] **Step 5: Manual smoke test — both tracks**

```bash
mkdir -p /tmp/forge-dual-both
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
{"cmd":"start","outDir":"/tmp/forge-dual-both","id":"both-001","sources":["system","mic"]}
# 5 s, talk while music plays
{"cmd":"stop"}
# Ctrl-D
```

Expected: `started` with both keys in `files`, then `stopped`. Two WAVs on disk; one has system audio, one has mic.

- [ ] **Step 6: Cleanup**

```bash
rm -rf /tmp/forge-dual-mic /tmp/forge-dual-sys /tmp/forge-dual-both
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): dual-track recording driven by sources array

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Meter events + elapsed events

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

Adds a 200 ms tick that emits `meter` events with per-source RMS levels, and a 1 s tick that emits `elapsed` events. The Tauri layer will forward these to the UI for VU meter + timer.

- [ ] **Step 1: Add a heartbeat to the `Recorder` class**

In `main.swift`, modify the `Recorder` class. Add at the top of the class:

```swift
    private var meterTimer: DispatchSourceTimer?
    private var elapsedTimer: DispatchSourceTimer?
```

After `self.isRecording = true` in `startCapture`, add:

```swift
        startMeterTicks()
        startElapsedTicks()
```

Before `isRecording = false` in `stopCapture`, add:

```swift
        meterTimer?.cancel(); meterTimer = nil
        elapsedTimer?.cancel(); elapsedTimer = nil
```

Add these methods to the class (anywhere inside `Recorder`):

```swift
    private func startMeterTicks() {
        let q = DispatchQueue(label: "com.forge.recorder.meter")
        let timer = DispatchSource.makeTimerSource(queue: q)
        timer.schedule(deadline: .now() + .milliseconds(200), repeating: .milliseconds(200))
        timer.setEventHandler { [weak self] in
            guard let self = self, self.isRecording else { return }
            var sources: [String: Float] = [:]
            if let cap = self.activeSystem { sources["system"] = cap.lastRMS }
            if let cap = self.activeMic { sources["mic"] = cap.lastRMS }
            emit(["event": "meter", "sources": sources])
        }
        timer.resume()
        self.meterTimer = timer
    }

    private func startElapsedTicks() {
        let q = DispatchQueue(label: "com.forge.recorder.elapsed")
        let timer = DispatchSource.makeTimerSource(queue: q)
        timer.schedule(deadline: .now() + .seconds(1), repeating: .seconds(1))
        timer.setEventHandler { [weak self] in
            guard let self = self, self.isRecording, let started = self.startedAt else { return }
            let elapsed = Int(Date().timeIntervalSince(started))
            emit(["event": "elapsed", "seconds": elapsed])
        }
        timer.resume()
        self.elapsedTimer = timer
    }
```

- [ ] **Step 2: Build**

```bash
swift build
```

- [ ] **Step 3: Smoke-test the heartbeat**

Run a 3-second mic-only recording and pipe stdout through `head -20`:

```bash
mkdir -p /tmp/forge-meter
( /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder <<'EOF'
{"cmd":"start","outDir":"/tmp/forge-meter","id":"meter-001","sources":["mic"]}
EOF
) &
PID=$!
sleep 3
echo '{"cmd":"stop"}' | nc -U - 2>/dev/null || true   # we can't pipe to a backgrounded stdin; alternative below
```

Easier interactive flow:

```bash
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
{"cmd":"start","outDir":"/tmp/forge-meter","id":"meter-001","sources":["mic"]}
# Wait 3 seconds — you should see ~15 meter events and 3 elapsed events
{"cmd":"stop"}
# Ctrl-D
rm -rf /tmp/forge-meter
```

Expected: `meter` events at ~5/sec with `sources.mic` floats, `elapsed` events at 1/sec with `seconds` ints, mixed in temporal order.

- [ ] **Step 4: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): emit meter + elapsed events while recording

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Auto-stop conditions

**Files:**
- Modify: `forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift`

Adds two safety stops:
- 4-hour hard cap.
- Disk space watchdog: stop if free space drops below 1 GB.

- [ ] **Step 1: Extend `startElapsedTicks` to enforce both conditions**

Replace the `startElapsedTicks` method body with:

```swift
    private func startElapsedTicks() {
        let q = DispatchQueue(label: "com.forge.recorder.elapsed")
        let timer = DispatchSource.makeTimerSource(queue: q)
        timer.schedule(deadline: .now() + .seconds(1), repeating: .seconds(1))
        timer.setEventHandler { [weak self] in
            guard let self = self, self.isRecording, let started = self.startedAt else { return }
            let elapsed = Int(Date().timeIntervalSince(started))
            emit(["event": "elapsed", "seconds": elapsed])

            if elapsed >= 4 * 60 * 60 {
                self.autoStop(reason: "MAX_DURATION", message: "4-hour cap reached")
                return
            }

            if let outDir = self.outDir, let free = self.freeBytes(at: outDir) {
                if free < 1_000_000_000 {
                    self.autoStop(reason: "DISK_LOW", message: "free disk below 1 GB")
                    return
                }
            }
        }
        timer.resume()
        self.elapsedTimer = timer
    }

    private func autoStop(reason: String, message: String) {
        emit(["event": "auto_stop", "reason": reason, "message": message])
        DispatchQueue.main.async {
            self.stopCapture()
        }
    }

    private func freeBytes(at path: String) -> UInt64? {
        let url = URL(fileURLWithPath: path)
        do {
            let values = try url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let bytes = values.volumeAvailableCapacityForImportantUsage {
                return UInt64(bytes)
            }
        } catch {
            return nil
        }
        return nil
    }
```

- [ ] **Step 2: Add a pre-flight disk check inside `startCapture`**

In `startCapture`, after the `guard let outDir = ..., id = ..., sourcesArr = ...` block, add:

```swift
        if let free = self.freeBytes(at: outDir) {
            if free < 5_000_000_000 {
                emit(["event": "warning", "code": "DISK_LOW", "message": "free disk below 5 GB at start"])
            }
        }
```

This emits a non-fatal warning. The Tauri layer will surface it to the UI; recording proceeds.

- [ ] **Step 3: Build**

```bash
swift build
```

- [ ] **Step 4: Manual sanity check (no real test for the 4-hour cap or disk-low)**

Run a normal 5-second mic recording and confirm it still works (no false-positive auto-stop):

```bash
mkdir -p /tmp/forge-cap
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/.build/debug/forge-recorder
{"cmd":"start","outDir":"/tmp/forge-cap","id":"cap-001","sources":["mic"]}
# 5 s
{"cmd":"stop"}
# Ctrl-D
rm -rf /tmp/forge-cap
```

Expected: normal `started` + meters + elapsed + `stopped`. No `auto_stop` event.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/Sources/forge-recorder/main.swift
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-recorder): 4-hour cap + disk-low watchdog with pre-flight warning

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Sidecar build script + binary delivery

**Files:**
- Create: `forge-shell/src-tauri/binaries/forge-recorder/build.sh`
- Create: `forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin` (committed binary)

Tauri 2 expects sidecar binaries named with the `cargo --print target-spec-json | jq -r '.["llvm-target"]'` triple. On Apple Silicon that's `aarch64-apple-darwin`. The binary lives at `forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin` and is referenced from `tauri.conf.json` as `binaries/forge-recorder` (Tauri appends the triple automatically).

- [ ] **Step 1: Create `build.sh`**

Create `forge-shell/src-tauri/binaries/forge-recorder/build.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Build the forge-recorder Swift sidecar and copy it to the Tauri binaries
# directory with the architecture-specific suffix Tauri expects.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SCRIPT_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) TRIPLE="aarch64-apple-darwin" ;;
  x86_64) TRIPLE="x86_64-apple-darwin" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

echo "Building forge-recorder for $TRIPLE…"
swift build -c release --arch "$ARCH"

SRC=".build/release/forge-recorder"
DEST="$BIN_DIR/forge-recorder-$TRIPLE"

cp -f "$SRC" "$DEST"
chmod +x "$DEST"
echo "Wrote $DEST"
```

Make it executable:

```bash
chmod +x /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/build.sh
```

- [ ] **Step 2: Run the build script**

```bash
/Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder/build.sh
```

Expected last line: `Wrote /…/forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin` (or `…-x86_64-apple-darwin` on Intel).

- [ ] **Step 3: Verify the bundled binary works**

```bash
echo '{"cmd":"status"}' | /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin
```

Expected: `{"event":"status","isRecording":false,"id":null,"elapsedSeconds":null}`.

- [ ] **Step 4: Confirm size and arch**

```bash
file /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin
ls -lh /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin
```

Expected: arm64 executable (or x86_64 on Intel), ~1-2 MB.

- [ ] **Step 5: Commit (including the binary)**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder/build.sh
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/binaries/forge-recorder-aarch64-apple-darwin
# Or whichever arch you're on
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "build(forge-recorder): add build.sh and committed arm64 sidecar binary

Tauri picks up sidecar binaries from src-tauri/binaries/<name>-<triple>;
build.sh wraps swift build and copies into place. The Apple Silicon
binary is committed; Intel contributors run build.sh to produce their
own variant alongside.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## MILESTONE 1 — Sidecar standalone

At this point you have a working Swift sidecar that records system + mic audio to disk and emits IPC events. You can test it from any terminal without Tauri. The next tasks bolt it into the Forge Shell process.

---

## Task 9: Tauri config — externalBin, entitlements, Info.plist

**Files:**
- Modify: `forge-shell/src-tauri/tauri.conf.json`
- Modify: `forge-shell/src-tauri/capabilities/default.json`

Tauri needs three things:
1. `bundle.externalBin` to register the sidecar so it's bundled with the app.
2. `bundle.macOS.entitlements` and `infoPlist` keys for ScreenCaptureKit + Microphone permissions.
3. `shell:allow-execute` capability for the sidecar binary path (already present at the global level, but confirm).

- [ ] **Step 1: Update `tauri.conf.json`**

Read the current config:

```bash
cat /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/tauri.conf.json
```

In `forge-shell/src-tauri/tauri.conf.json`, modify the `bundle` block:

- Add `externalBin: ["binaries/forge-recorder"]`.
- Add a `macOS` sub-object with `infoPlist` mapping for the two usage descriptions.

Replace the existing `bundle` block with:

```json
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "DeveloperTool",
    "shortDescription": "Unified dashboard for Forge plugins",
    "longDescription": "Forge Shell is a desktop application that provides a unified visual interface for all your Forge plugins, including Product Forge, Cognitive Forge, Rovo Agent Forge, and more.",
    "externalBin": [
      "binaries/forge-recorder"
    ],
    "macOS": {
      "infoPlist": {
        "NSScreenCaptureUsageDescription": "Forge Shell records system audio for transcription via the audio-forge plugin.",
        "NSMicrophoneUsageDescription": "Forge Shell records your microphone for transcription via the audio-forge plugin."
      }
    }
  }
```

If your installed Tauri 2.10's schema uses a slightly different key (e.g., `macOS` vs `macos`, or `infoPlist` is rooted elsewhere), match the schema. The `tauri build --help` output and `https://schema.tauri.app/config/2` are authoritative. Adjust and proceed.

- [ ] **Step 2: Update `capabilities/default.json`**

Read the current capabilities:

```bash
cat /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell/src-tauri/capabilities/default.json
```

Existing content already has `shell:allow-execute`, which permits any sidecar invocation. For tighter security, restrict to the specific sidecar:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": [
    "main"
  ],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "shell:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "binaries/forge-recorder",
          "sidecar": true,
          "args": []
        }
      ]
    }
  ]
}
```

If the more permissive `shell:allow-execute` is preferred (matches the existing `tauri-plugin-shell` defaults you might be using), leave the original line and skip the explicit `allow` block. The narrower form is recommended for production builds.

- [ ] **Step 3: Verify Tauri config parses**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
npx tauri info 2>&1 | head -30
```

Expected: no parse errors. The output should show the full app metadata.

- [ ] **Step 4: Run `tauri dev` to confirm the sidecar bundling works**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
npm run tauri:dev
```

Expected: the dev window opens. Wait for the "Compiled successfully" / similar message. If it fails complaining about missing sidecar binaries, double-check Step 1 of Task 8 produced the correctly named binary in `forge-shell/src-tauri/binaries/`.

Close the dev window when satisfied.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/tauri.conf.json forge-shell/src-tauri/capabilities/default.json
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "build(forge-shell): register forge-recorder as Tauri sidecar with mac entitlements

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `audio_commands.rs` scaffolding

**Files:**
- Create: `forge-shell/src-tauri/src/audio_commands.rs`
- Modify: `forge-shell/src-tauri/Cargo.toml` (no deps needed if you already have `serde_json`, `tokio` via tauri's runtime — but verify)
- Modify: `forge-shell/src-tauri/src/lib.rs` (declare `mod audio_commands;`)

Sets up the state container and the empty command stubs. Subsequent tasks fill them in.

- [ ] **Step 1: Confirm Cargo.toml has the needed deps**

Read `forge-shell/src-tauri/Cargo.toml`. Required:
- `serde_json` (already present)
- `serde` (already present)
- `tauri = { version = "2.10.0", features = [] }` (already present)
- `tauri-plugin-shell = "2"` (already present)

If any are missing, add them. You shouldn't need anything else for Phase 2A.

- [ ] **Step 2: Create `audio_commands.rs`**

Create `forge-shell/src-tauri/src/audio_commands.rs`:

```rust
//! Audio recording commands for the audio-forge plugin.
//!
//! Spawns the `forge-recorder` Swift sidecar and pumps its line-delimited JSON
//! events to the frontend via Tauri events. Persists the active recording's
//! state in <project>/audio-forge/active.json so a Forge Shell crash can be
//! recovered on the next launch.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveRecording {
    pub id: String,
    pub project_root: String,
    pub started_at: String,
    pub sources: Vec<String>,
    pub files: AudioFiles,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AudioFiles {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mic: Option<String>,
}

pub struct RecorderState {
    inner: Mutex<Option<RecorderHandle>>,
}

impl RecorderState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

struct RecorderHandle {
    id: String,
    project_root: String,
    sources: Vec<String>,
    started_at: String,
    files: AudioFiles,
    pid: u32,
    stdin: Box<dyn StdinSink + Send>,
}

trait StdinSink {
    fn send_line(&mut self, line: &str) -> Result<(), String>;
}

impl StdinSink for tauri_plugin_shell::process::CommandChild {
    fn send_line(&mut self, line: &str) -> Result<(), String> {
        let mut buf = line.as_bytes().to_vec();
        if !line.ends_with('\n') {
            buf.push(b'\n');
        }
        self.write(&buf).map_err(|e| format!("sidecar stdin write: {e}"))
    }
}

#[derive(Debug, Serialize)]
pub struct StartedRecording {
    pub id: String,
    pub files: AudioFiles,
}

#[derive(Debug, Serialize)]
pub struct StoppedRecording {
    pub id: String,
    pub duration_seconds: u64,
    pub files: AudioFiles,
}

#[derive(Debug, Serialize)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub id: Option<String>,
    pub elapsed_seconds: Option<u64>,
}

// ----------------- Commands (stubs filled in by Tasks 11-13) -----------------

#[tauri::command]
pub async fn start_recording(
    _app: AppHandle,
    _state: State<'_, RecorderState>,
    _project_root: String,
    _sources: Vec<String>,
) -> Result<StartedRecording, String> {
    Err("start_recording not implemented yet (Task 11)".to_string())
}

#[tauri::command]
pub async fn stop_recording(
    _app: AppHandle,
    _state: State<'_, RecorderState>,
) -> Result<StoppedRecording, String> {
    Err("stop_recording not implemented yet (Task 12)".to_string())
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, RecorderState>) -> RecordingStatus {
    let guard = state.inner.lock().unwrap();
    if let Some(handle) = guard.as_ref() {
        RecordingStatus {
            is_recording: true,
            id: Some(handle.id.clone()),
            elapsed_seconds: None,
        }
    } else {
        RecordingStatus {
            is_recording: false,
            id: None,
            elapsed_seconds: None,
        }
    }
}

#[tauri::command]
pub async fn recover_orphaned_recording(
    _app: AppHandle,
    _state: State<'_, RecorderState>,
    _project_root: String,
) -> Result<Option<ActiveRecording>, String> {
    Err("recover_orphaned_recording not implemented yet (Task 13)".to_string())
}

#[tauri::command]
pub async fn run_recording_create(
    _app: AppHandle,
    _project_root: String,
    _id: String,
    _title: String,
    _duration_seconds: u32,
    _sources: Vec<String>,
    _files: AudioFiles,
) -> Result<String, String> {
    Err("run_recording_create not implemented yet (Task 14)".to_string())
}

#[tauri::command]
pub async fn run_recording_transcribe(
    _app: AppHandle,
    _project_root: String,
    _id: String,
    _model: Option<String>,
) -> Result<String, String> {
    Err("run_recording_transcribe not implemented yet (Task 14)".to_string())
}

// ----------------- Helpers -----------------

fn audio_forge_root(project_root: &str) -> PathBuf {
    Path::new(project_root).join("audio-forge")
}

fn active_state_path(project_root: &str) -> PathBuf {
    audio_forge_root(project_root).join("active.json")
}
```

- [ ] **Step 3: Wire the new module into `lib.rs`**

In `forge-shell/src-tauri/src/lib.rs`:

Add at the top with the other `mod` declarations:

```rust
mod audio_commands;
```

Inside the `tauri::Builder::default()` chain, before `.invoke_handler(...)`:

```rust
    .manage(audio_commands::RecorderState::new())
```

(The existing `.manage(watcher::WatcherState::new())` is right above this.)

Append the new commands to the `tauri::generate_handler!` list:

```rust
      // Audio commands
      audio_commands::start_recording,
      audio_commands::stop_recording,
      audio_commands::get_recording_status,
      audio_commands::recover_orphaned_recording,
      audio_commands::run_recording_create,
      audio_commands::run_recording_transcribe,
```

The full `invoke_handler!` macro should look roughly like:

```rust
    .invoke_handler(tauri::generate_handler![
      // File system commands
      fs_commands::read_file,
      fs_commands::write_file,
      fs_commands::read_dir,
      fs_commands::list_md_files,
      fs_commands::get_file_meta,
      fs_commands::create_directory,
      fs_commands::delete_file,
      // Config commands
      config::get_project_path,
      config::set_project_path,
      config::get_recent_projects,
      config::get_theme,
      config::set_theme,
      // Watcher commands
      watcher::watch_directory,
      watcher::unwatch_directory,
      // Audio commands
      audio_commands::start_recording,
      audio_commands::stop_recording,
      audio_commands::get_recording_status,
      audio_commands::recover_orphaned_recording,
      audio_commands::run_recording_create,
      audio_commands::run_recording_transcribe,
    ])
```

- [ ] **Step 4: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: compiles cleanly. Warnings about unused parameters in the stub commands are expected at this stage.

- [ ] **Step 5: Run the dev server briefly to confirm it boots**

```bash
npm run tauri:dev
```

Wait for the dev window to open, confirm no panic in the terminal output, then close.

- [ ] **Step 6: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs forge-shell/src-tauri/src/lib.rs
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): scaffold audio_commands module + RecorderState

Adds command stubs returning 'not implemented' errors so the Tauri
handler list compiles. Tasks 11-14 fill in the bodies.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `start_recording` command

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs`

Spawns the sidecar via `tauri-plugin-shell`, sends `{cmd:"start"}`, blocks until either a `started` event arrives or an `error` event aborts. On success: persists `active.json`, stores the `RecorderHandle` in state, spawns a background task that forwards subsequent events (`meter`, `elapsed`, `error`, `auto_stop`) to the frontend via Tauri events.

- [ ] **Step 1: Replace `start_recording` body**

In `audio_commands.rs`, replace the stub with:

```rust
#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    project_root: String,
    sources: Vec<String>,
) -> Result<StartedRecording, String> {
    // Reject if a recording is already in progress
    {
        let guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        if guard.is_some() {
            return Err("a recording is already in progress".to_string());
        }
    }

    // Generate id (YYYY-MM-DDTHHMMSS)
    let now = chrono::Utc::now();
    let id = now.format("%Y-%m-%dT%H%M%S").to_string();

    // Ensure audio-forge/audio/ exists
    let out_dir = audio_forge_root(&project_root).join("audio");
    std::fs::create_dir_all(&out_dir)
        .map_err(|e| format!("create audio dir: {e}"))?;

    // Spawn the sidecar
    let shell = app.shell();
    let (mut rx, mut child) = shell
        .sidecar("forge-recorder")
        .map_err(|e| format!("sidecar lookup: {e}"))?
        .spawn()
        .map_err(|e| format!("sidecar spawn: {e}"))?;

    let pid = child.pid();

    // Send the start command
    let start_cmd = serde_json::json!({
        "cmd": "start",
        "outDir": out_dir.to_string_lossy(),
        "id": id,
        "sources": sources,
    });
    let line = format!("{}\n", start_cmd);
    child.write(line.as_bytes()).map_err(|e| format!("sidecar stdin: {e}"))?;

    // Wait for `started` or `error` (timeout 30 s)
    let mut started_files = AudioFiles::default();
    let mut got_started = false;
    let mut start_err: Option<String> = None;

    let started_event_type: &str = "started";
    let error_event_type: &str = "error";

    let timeout = std::time::Duration::from_secs(30);
    let start_instant = std::time::Instant::now();

    while start_instant.elapsed() < timeout {
        match tokio::time::timeout(std::time::Duration::from_secs(1), rx.recv()).await {
            Ok(Some(CommandEvent::Stdout(bytes))) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                for raw in line.lines() {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() { continue; }
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        let evt = value.get("event").and_then(|v| v.as_str()).unwrap_or("");
                        if evt == started_event_type {
                            got_started = true;
                            if let Some(files) = value.get("files") {
                                started_files.system = files.get("system").and_then(|v| v.as_str()).map(String::from);
                                started_files.mic = files.get("mic").and_then(|v| v.as_str()).map(String::from);
                            }
                        } else if evt == error_event_type {
                            start_err = Some(value.get("message").and_then(|v| v.as_str()).unwrap_or("sidecar error").to_string());
                        }
                    }
                }
                if got_started { break; }
                if start_err.is_some() { break; }
            }
            Ok(Some(CommandEvent::Stderr(bytes))) => {
                let line = String::from_utf8_lossy(&bytes).to_string();
                log::warn!("forge-recorder stderr: {}", line.trim());
            }
            Ok(Some(CommandEvent::Terminated(_))) => {
                start_err = Some("sidecar terminated before started event".to_string());
                break;
            }
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) => continue,
        }
    }

    if let Some(msg) = start_err {
        let _ = child.kill();
        return Err(msg);
    }
    if !got_started {
        let _ = child.kill();
        return Err("timed out waiting for started event".to_string());
    }

    // Persist active.json
    let started_at = now.to_rfc3339();
    let active = ActiveRecording {
        id: id.clone(),
        project_root: project_root.clone(),
        started_at: started_at.clone(),
        sources: sources.clone(),
        files: started_files.clone(),
        pid,
    };
    write_active_state(&project_root, &active)?;

    // Insert handle into state
    let stdin: Box<dyn StdinSink + Send> = Box::new(child);
    {
        let mut guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        *guard = Some(RecorderHandle {
            id: id.clone(),
            project_root: project_root.clone(),
            sources,
            started_at,
            files: started_files.clone(),
            pid,
            stdin,
        });
    }

    // Forward subsequent events to the frontend
    let app_handle = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    for raw in line.lines() {
                        let trimmed = raw.trim();
                        if trimmed.is_empty() { continue; }
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
                            let evt = value.get("event").and_then(|v| v.as_str()).unwrap_or("");
                            // Forward all events under a single channel namespace
                            let _ = app_handle.emit(&format!("audio-forge://{}", evt), value);
                        }
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).to_string();
                    log::warn!("forge-recorder stderr: {}", line.trim());
                }
                CommandEvent::Terminated(_) => {
                    let _ = app_handle.emit("audio-forge://terminated", serde_json::json!({}));
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(StartedRecording {
        id,
        files: started_files,
    })
}

fn write_active_state(project_root: &str, active: &ActiveRecording) -> Result<(), String> {
    let path = active_state_path(project_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create active.json parent: {e}"))?;
    }
    let json = serde_json::to_string_pretty(active).map_err(|e| format!("serialize active.json: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("write active.json: {e}"))?;
    Ok(())
}

fn delete_active_state(project_root: &str) {
    let _ = std::fs::remove_file(active_state_path(project_root));
}
```

- [ ] **Step 2: Add `chrono` if not already present**

Inspect `Cargo.toml`. The existing crate already includes `chrono = "0.4"`. If not, add it. Otherwise no change.

- [ ] **Step 3: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: compiles. Warnings about unused fields in `RecorderHandle.sources` etc. are fine for now (Task 12 / 13 use them).

- [ ] **Step 4: End-to-end manual test in Tauri dev**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
npm run tauri:dev
```

In the dev window's DevTools console (Cmd+Opt+I), with a real project root in mind, run:

```javascript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// Listen for recorder events
const unlisten1 = await listen('audio-forge://meter', e => console.log('METER', e.payload));
const unlisten2 = await listen('audio-forge://elapsed', e => console.log('ELAPSED', e.payload));
const unlisten3 = await listen('audio-forge://error', e => console.warn('ERROR', e.payload));

// Start recording — choose a project root that exists on disk
const result = await invoke('start_recording', {
  projectRoot: '/tmp/forge-tauri-smoke',
  sources: ['mic']
});
console.log('STARTED', result);
```

Before you run the above, on the host:

```bash
mkdir -p /tmp/forge-tauri-smoke
```

Expected console output: a sequence of `STARTED { id, files: { mic: "..." } }`, then `ELAPSED` events at 1 Hz, `METER` events at 5 Hz.

Don't call `stop_recording` yet — Task 12 implements it. The recording will continue until you close the dev window or call `tauri-plugin-shell` explicit kill. To clean up, simply close the window.

- [ ] **Step 5: Cleanup**

```bash
rm -rf /tmp/forge-tauri-smoke
```

Note: the `active.json` file will linger in that directory; since you're deleting the whole tree, no manual cleanup needed.

- [ ] **Step 6: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): start_recording spawns sidecar, persists active.json, forwards events

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `stop_recording` command

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs`

- [ ] **Step 1: Replace `stop_recording` body**

In `audio_commands.rs`, replace the stub with:

```rust
#[tauri::command]
pub async fn stop_recording(
    _app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<StoppedRecording, String> {
    // Take ownership of the handle so we don't hold the lock across await
    let mut handle = {
        let mut guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        guard.take().ok_or_else(|| "no recording in progress".to_string())?
    };

    // Send the stop command
    handle.stdin.send_line("{\"cmd\":\"stop\"}")?;

    // The forwarding task spawned in start_recording will see the `stopped`
    // event on stdout and emit it. We don't have direct access to that channel
    // here, so we wait briefly for the sidecar to write the WAVs and exit.
    // 5 s is generous for closing files; ScreenCaptureKit teardown can take ~2 s.
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    // Compute duration from the recorded started_at
    let started_at: chrono::DateTime<chrono::Utc> = chrono::DateTime::parse_from_rfc3339(&handle.started_at)
        .map_err(|e| format!("parse started_at: {e}"))?
        .with_timezone(&chrono::Utc);
    let elapsed = chrono::Utc::now() - started_at;
    let duration_seconds = elapsed.num_seconds().max(0) as u64;

    // Clean up active.json
    delete_active_state(&handle.project_root);

    Ok(StoppedRecording {
        id: handle.id,
        duration_seconds,
        files: handle.files,
    })
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature
cargo check --manifest-path forge-shell/src-tauri/Cargo.toml
```

- [ ] **Step 3: End-to-end manual test of full start→stop**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
npm run tauri:dev
```

In dev console:

```javascript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const unlistenStopped = await listen('audio-forge://stopped', e => console.log('STOPPED', e.payload));

mkdir -p /tmp/forge-stop-test  // run this in the host shell first

const started = await invoke('start_recording', {
  projectRoot: '/tmp/forge-stop-test',
  sources: ['mic']
});
console.log('STARTED', started);

// Wait 5 seconds, then:
setTimeout(async () => {
  const stopped = await invoke('stop_recording');
  console.log('RESULT', stopped);
}, 5000);
```

Expected:
- `STARTED { id, files }` printed.
- 5 ELAPSED events.
- `STOPPED` event from the listener carrying `{event:"stopped", id, duration_seconds, files}`.
- `RESULT { id, duration_seconds, files }` from the invoke return.
- WAV file at `/tmp/forge-stop-test/audio-forge/audio/<id>-mic.wav`.

Verify on host:

```bash
ls /tmp/forge-stop-test/audio-forge/audio/
afinfo /tmp/forge-stop-test/audio-forge/audio/*.wav
afplay /tmp/forge-stop-test/audio-forge/audio/*.wav   # play it back
test -f /tmp/forge-stop-test/audio-forge/active.json && echo "ACTIVE LINGERED" || echo "active.json cleaned"
```

Expected: WAV is the right size, plays back, `active.json` is gone.

- [ ] **Step 4: Cleanup**

```bash
rm -rf /tmp/forge-stop-test
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): stop_recording sends stop, awaits teardown, cleans active.json

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Active.json persistence + orphan recovery

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs`

`active.json` is already written by `start_recording` and removed by `stop_recording`. This task implements `recover_orphaned_recording`, which the frontend calls on startup to detect a previous crash.

- [ ] **Step 1: Replace `recover_orphaned_recording` body**

In `audio_commands.rs`, replace the stub with:

```rust
#[tauri::command]
pub async fn recover_orphaned_recording(
    _app: AppHandle,
    state: State<'_, RecorderState>,
    project_root: String,
) -> Result<Option<ActiveRecording>, String> {
    let path = active_state_path(&project_root);
    if !path.exists() {
        return Ok(None);
    }
    // If we already have an in-flight recording in this process, the file isn't
    // an orphan — somebody just hasn't called stop yet.
    {
        let guard = state.inner.lock().map_err(|_| "state lock poisoned".to_string())?;
        if guard.is_some() {
            return Ok(None);
        }
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| format!("read active.json: {e}"))?;
    let active: ActiveRecording = serde_json::from_str(&raw)
        .map_err(|e| format!("parse active.json: {e}"))?;

    // Optional: check whether the PID is still alive. If it is, it's not an
    // orphan; the previous Forge Shell is still running. Don't return it as
    // recoverable — that user can use that other window.
    if pid_is_alive(active.pid) {
        return Ok(None);
    }

    Ok(Some(active))
}

#[cfg(unix)]
fn pid_is_alive(pid: u32) -> bool {
    // kill(pid, 0) returns 0 if the process exists.
    unsafe {
        libc::kill(pid as libc::pid_t, 0) == 0
    }
}

#[cfg(not(unix))]
fn pid_is_alive(_pid: u32) -> bool {
    false
}
```

- [ ] **Step 2: Add `libc` to `Cargo.toml`**

In `forge-shell/src-tauri/Cargo.toml` under `[dependencies]`:

```toml
libc = "0.2"
```

- [ ] **Step 3: Build**

```bash
cargo check --manifest-path forge-shell/src-tauri/Cargo.toml
```

- [ ] **Step 4: Manual test of orphan recovery**

In Tauri dev console:

```javascript
const { invoke } = window.__TAURI__.core;

// Start a recording
mkdir -p /tmp/forge-orphan   // run on host first
await invoke('start_recording', { projectRoot: '/tmp/forge-orphan', sources: ['mic'] });

// Don't call stop_recording. Instead: kill the dev process from the host (Cmd-Q on the window or Ctrl-C in the npm run tauri:dev terminal).
```

Then on the host:

```bash
# Confirm active.json was written
cat /tmp/forge-orphan/audio-forge/active.json
# The PID inside should now be a zombie — verify
ps -p $(cat /tmp/forge-orphan/audio-forge/active.json | python3 -c 'import json,sys; print(json.load(sys.stdin)["pid"])') || echo "pid gone"
```

Restart `npm run tauri:dev`. In the new dev console:

```javascript
const { invoke } = window.__TAURI__.core;
const orphan = await invoke('recover_orphaned_recording', { projectRoot: '/tmp/forge-orphan' });
console.log('ORPHAN', orphan);
```

Expected: an object with the previous recording's `id`, `started_at`, `sources`, `files`, and `pid`. The frontend can now offer "transcribe what was captured" or "discard."

Cleanup:

```bash
rm -rf /tmp/forge-orphan
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs forge-shell/src-tauri/Cargo.toml forge-shell/src-tauri/Cargo.lock
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): recover_orphaned_recording detects crashed sessions via active.json

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: `run_recording_create` + `run_recording_transcribe` (forge-lib bridge)

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs`

Both commands shell out to `python3 forge-lib/forge.py recording {create,transcribe}` so the existing CLI is the single source of truth. Returns the markdown file path on success.

- [ ] **Step 1: Replace both stubs**

Replace `run_recording_create` and `run_recording_transcribe` bodies with:

```rust
#[tauri::command]
pub async fn run_recording_create(
    app: AppHandle,
    project_root: String,
    id: String,
    title: String,
    duration_seconds: u32,
    sources: Vec<String>,
    files: AudioFiles,
) -> Result<String, String> {
    // Compose the JSON payload
    let now = chrono::Utc::now();
    let created = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let mut audio_files_json = serde_json::Map::new();
    if let Some(p) = files.system.as_ref() {
        // Convert absolute path to project-relative
        let rel = relativize_audio(&project_root, p);
        audio_files_json.insert("system".to_string(), serde_json::Value::String(rel));
    }
    if let Some(p) = files.mic.as_ref() {
        let rel = relativize_audio(&project_root, p);
        audio_files_json.insert("mic".to_string(), serde_json::Value::String(rel));
    }

    let payload = serde_json::json!({
        "id": id,
        "title": title,
        "created": created,
        "duration_seconds": duration_seconds,
        "sources": sources,
        "audio_files": audio_files_json,
    });

    let payload_arg = payload.to_string();

    let shell = app.shell();
    let output = shell
        .command("python3")
        .args([
            "forge-lib/forge.py",
            "recording",
            "create",
            "--directory",
            &project_root,
            "--data",
            &payload_arg,
        ])
        .current_dir(workspace_root_for(&project_root))
        .output()
        .await
        .map_err(|e| format!("forge recording create exec: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "forge recording create failed (exit {:?}): stdout={} stderr={}",
            output.status.code(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let envelope: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("parse forge envelope: {e}: {stdout}"))?;
    let file_path = envelope
        .get("data")
        .and_then(|d| d.get("file_path"))
        .and_then(|s| s.as_str())
        .ok_or_else(|| "envelope missing data.file_path".to_string())?
        .to_string();
    Ok(file_path)
}

#[tauri::command]
pub async fn run_recording_transcribe(
    app: AppHandle,
    project_root: String,
    id: String,
    model: Option<String>,
) -> Result<String, String> {
    let shell = app.shell();

    let mut args: Vec<String> = vec![
        "forge-lib/forge.py".into(),
        "recording".into(),
        "transcribe".into(),
        id.clone(),
        "--directory".into(),
        project_root.clone(),
    ];
    if let Some(m) = model {
        args.push("--model".into());
        args.push(m);
    }

    let output = shell
        .command("python3")
        .args(args.iter().map(|s| s.as_str()))
        .current_dir(workspace_root_for(&project_root))
        .output()
        .await
        .map_err(|e| format!("forge recording transcribe exec: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let envelope: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("parse transcribe envelope: {e}: {stdout}"))?;

    let success = envelope
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !success {
        let err = envelope
            .get("error")
            .and_then(|s| s.as_str())
            .unwrap_or("transcribe failed");
        return Err(err.to_string());
    }

    let file_path = envelope
        .get("data")
        .and_then(|d| d.get("file_path"))
        .and_then(|s| s.as_str())
        .ok_or_else(|| "envelope missing data.file_path".to_string())?
        .to_string();
    Ok(file_path)
}

fn relativize_audio(project_root: &str, abs_path: &str) -> String {
    let pr = std::path::Path::new(project_root);
    let p = std::path::Path::new(abs_path);
    if let Ok(rel) = p.strip_prefix(pr) {
        rel.to_string_lossy().to_string()
    } else {
        abs_path.to_string()
    }
}

fn workspace_root_for(project_root: &str) -> std::path::PathBuf {
    // Run forge.py from the directory that contains forge-lib/. Most callers
    // pass the same project root that contains forge-lib as a sibling, but if
    // forge-lib lives elsewhere on this system, you can hardcode the absolute
    // path here. For The Forge Marketplace v2 dev tree, the project_root *is*
    // the workspace root.
    std::path::PathBuf::from(project_root)
}
```

- [ ] **Step 2: Confirm `tauri-plugin-shell` exposes `command(...).output().await`**

Read the docs at https://docs.rs/tauri-plugin-shell or `cargo doc --open` to verify the API. Tauri 2.10's `tauri-plugin-shell` exposes `Shell::command(name)` returning a builder with `.args(...)`, `.current_dir(...)`, and `.output()`. If the API differs in your version, adapt — the exact pattern is documented in the plugin README.

- [ ] **Step 3: Build**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature
cargo check --manifest-path forge-shell/src-tauri/Cargo.toml
```

If it fails on `Shell::command`, you may need to enable a feature in `tauri-plugin-shell`. The dependency is already declared as `tauri-plugin-shell = "2"`. Inspect docs.rs for the right cargo feature flag.

- [ ] **Step 4: Add `python3` to capabilities allow-list**

The `shell:default` permission may already permit arbitrary `python3` invocation, but to be explicit, ensure `forge-shell/src-tauri/capabilities/default.json` includes (alongside the sidecar entry from Task 9):

```json
        {
          "identifier": "shell:allow-execute",
          "allow": [
            {"name": "python3", "args": ["forge-lib/forge.py", "recording", { "validator": "\\S+" }]}
          ]
        }
```

If you went with the unrestricted `shell:allow-execute` earlier, no change needed.

- [ ] **Step 5: Manual end-to-end test**

```bash
mkdir -p /tmp/forge-bridge-test/audio-forge/audio
cp /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-lib/tests/fixtures/whisper_system_sample.json /tmp/   # not used, just for proof of fs reach
cd /tmp/forge-bridge-test
# Generate a small mic WAV manually for the test
ffmpeg -f lavfi -i anullsrc=channel_layout=mono:sample_rate=48000 -t 5 -c:a pcm_s16le audio-forge/audio/2026-05-07T120000-mic.wav
ls audio-forge/audio/
```

Then in `npm run tauri:dev` console:

```javascript
const { invoke } = window.__TAURI__.core;
const filePath = await invoke('run_recording_create', {
  projectRoot: '/tmp/forge-bridge-test',
  id: '2026-05-07T120000',
  title: 'Bridge Test',
  durationSeconds: 5,
  sources: ['mic'],
  files: { mic: '/tmp/forge-bridge-test/audio-forge/audio/2026-05-07T120000-mic.wav' }
});
console.log('CREATE', filePath);

const transcriptPath = await invoke('run_recording_transcribe', {
  projectRoot: '/tmp/forge-bridge-test',
  id: '2026-05-07T120000',
});
console.log('TRANSCRIBE', transcriptPath);
```

Expected: both calls return absolute file paths under `/tmp/forge-bridge-test/audio-forge/recordings/`.

Verify on host:

```bash
cat /tmp/forge-bridge-test/audio-forge/recordings/*.md
```

Expected: completed transcript markdown with `transcript_status: complete`.

Cleanup:

```bash
rm -rf /tmp/forge-bridge-test
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs forge-shell/src-tauri/capabilities/default.json
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): bridge to forge recording create + transcribe via shell-out

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: `get_recording_status` enhancement

**Files:**
- Modify: `forge-shell/src-tauri/src/audio_commands.rs`

Currently `get_recording_status` returns `is_recording` but no `elapsed_seconds`. Compute the elapsed value live so the UI can poll it on demand even if it missed the periodic events.

- [ ] **Step 1: Replace `get_recording_status` body**

```rust
#[tauri::command]
pub fn get_recording_status(state: State<'_, RecorderState>) -> RecordingStatus {
    let guard = state.inner.lock().unwrap();
    if let Some(handle) = guard.as_ref() {
        let elapsed = chrono::DateTime::parse_from_rfc3339(&handle.started_at)
            .ok()
            .map(|dt| {
                let elapsed = chrono::Utc::now() - dt.with_timezone(&chrono::Utc);
                elapsed.num_seconds().max(0) as u64
            });
        RecordingStatus {
            is_recording: true,
            id: Some(handle.id.clone()),
            elapsed_seconds: elapsed,
        }
    } else {
        RecordingStatus {
            is_recording: false,
            id: None,
            elapsed_seconds: None,
        }
    }
}
```

- [ ] **Step 2: Build + smoke test**

```bash
cargo check --manifest-path forge-shell/src-tauri/Cargo.toml
```

In Tauri dev console:

```javascript
const { invoke } = window.__TAURI__.core;

const status1 = await invoke('get_recording_status');
console.log('IDLE', status1);   // { is_recording: false, ... }

await invoke('start_recording', { projectRoot: '/tmp/forge-status', sources: ['mic'] });
// Wait 3 s
setTimeout(async () => {
  const status2 = await invoke('get_recording_status');
  console.log('ACTIVE', status2);  // { is_recording: true, id: '...', elapsed_seconds: 3 }
  await invoke('stop_recording');
}, 3000);
```

Cleanup: `rm -rf /tmp/forge-status`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature add forge-shell/src-tauri/src/audio_commands.rs
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature commit -m "feat(forge-shell): get_recording_status returns live elapsed_seconds

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: End-to-end smoke test from Tauri dev console

**Files:** None (manual verification).

This task verifies the entire Phase 2A pipeline: spawn sidecar → record both tracks → stop → create entity → transcribe → see markdown.

- [ ] **Step 1: Set up a clean project**

```bash
mkdir -p /tmp/forge-phase2a-e2e
cd /tmp/forge-phase2a-e2e
```

- [ ] **Step 2: Run Tauri dev**

```bash
cd /Users/jeremybrice/Documents/GitHub/the-forge-feature/forge-shell
npm run tauri:dev
```

- [ ] **Step 3: Run the full pipeline from the dev console**

```javascript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

await listen('audio-forge://error', e => console.warn('ERR', e.payload));
await listen('audio-forge://stopped', e => console.log('STOPPED', e.payload));

const projectRoot = '/tmp/forge-phase2a-e2e';

// 1. Start
const started = await invoke('start_recording', { projectRoot, sources: ['system','mic'] });
console.log('STARTED', started);

// 2. Talk + play music for 10 s, then stop
await new Promise(r => setTimeout(r, 10000));
const stopped = await invoke('stop_recording');
console.log('STOPPED', stopped);

// 3. Create the recording entity
const mdPath = await invoke('run_recording_create', {
  projectRoot,
  id: started.id,
  title: 'Phase 2A E2E Test',
  durationSeconds: stopped.duration_seconds,
  sources: ['system', 'mic'],
  files: stopped.files,
});
console.log('CREATED', mdPath);

// 4. Transcribe (real whisper invocation; takes 30 s - 3 min)
const finalPath = await invoke('run_recording_transcribe', {
  projectRoot,
  id: started.id,
});
console.log('TRANSCRIBED', finalPath);
```

- [ ] **Step 4: Verify the artifact**

```bash
cat /tmp/forge-phase2a-e2e/audio-forge/recordings/*.md
ls -la /tmp/forge-phase2a-e2e/audio-forge/audio/
```

Expected:
- Markdown frontmatter complete: `transcript_status: complete`, both audio files in `audio_files`, `model: large-v3-turbo`.
- `## Transcript` section contains `**System** (HH:MM:SS):` and `**You** (HH:MM:SS):` lines reflecting what was captured.
- Both WAV files exist on disk with non-zero size.

- [ ] **Step 5: Cleanup**

```bash
rm -rf /tmp/forge-phase2a-e2e
```

- [ ] **Step 6: Final integration commit (only if any docs/typo fixes surfaced)**

```bash
git -C /Users/jeremybrice/Documents/GitHub/the-forge-feature status
# If anything to commit:
# git add … && git commit -m "..."
```

---

## MILESTONE 2 — Phase 2A complete

You can now record from the Forge Shell process via Tauri commands and produce a fully-transcribed recording. The next plan (`docs/plans/2026-05-08-audio-forge-shell-view-implementation.md`, drafted after this branch lands) wires this into a Forge Shell page with a record button + meter + transcript browser, and adds the `/audio-forge:record` plugin command.

---

## Self-Review Notes

This plan was self-reviewed. Coverage map:

| Spec section (design doc)              | Implementing task(s) |
|----------------------------------------|----------------------|
| Swift sidecar JSON IPC                 | Tasks 1, 2           |
| Mic capture (AVAudioEngine)            | Task 3               |
| System capture (ScreenCaptureKit)      | Tasks 4, 5           |
| Meter + elapsed events                 | Task 6               |
| 4-hour cap + disk-low watchdog         | Task 7               |
| Sidecar binary delivery to Tauri       | Task 8               |
| Tauri sidecar declaration + entitlements | Task 9             |
| Tauri Rust state container             | Task 10              |
| `start_recording` / `stop_recording`   | Tasks 11, 12         |
| `active.json` orphan recovery          | Task 13              |
| `run_recording_create` + `run_recording_transcribe` | Task 14 |
| `get_recording_status` enhancements    | Task 15              |
| End-to-end Tauri verification          | Task 16              |

Spec sections **not** covered here (intentional — they belong to Phase 2B):
- Forge Shell view (`audio-forge.js`, `audio-forge.css`, PLUGINS array, view container).
- The `/audio-forge:record` plugin command.
- Permission deeplink dialog (UI-side handler for `PERMISSION_SCREEN_RECORDING`).
- VU meter rendering, recording list, detail pane with `<audio>` segment-seek.
- Watcher integration to live-update the UI when forge-lib writes new transcripts.

These will be the focus of Phase 2B.

## Known Risks

| Risk | Mitigation |
|------|------------|
| `tauri-plugin-shell` API surface differs slightly between 2.x patch versions; the exact `Shell::command(...).output().await` signature may need tweaks. | Verify with `cargo doc -p tauri-plugin-shell --open` before Task 14. Keep the call sites isolated so a small refactor is sufficient. |
| ScreenCaptureKit deprecation on a future macOS could change `SCStreamConfiguration` keys. | The plan uses the macOS 13+ stable surface. Watch for warnings on `swift build`; bump only if Apple ships a hard break. |
| The 5-second sleep in `stop_recording` (Task 12) is a heuristic for sidecar teardown. On heavily loaded systems it may not be enough. | If the smoke test in Task 12 sometimes returns `duration_seconds` while the WAV is still finalizing, replace the sleep with a real `Stopped` event handshake (track-via-channel pattern). |
| Committed binary (`forge-recorder-aarch64-apple-darwin`) only covers Apple Silicon. Intel contributors must run `build.sh` to produce their own variant before `npm run tauri:dev` works. | Document this requirement in `forge-shell/README.md` as part of Phase 2B's docs polish. |
| macOS may attribute Screen Recording permission to the Tauri app bundle rather than the sidecar. First `start_recording` with `system` source may fail until the user grants the permission and restarts the app. | Document this in Phase 2B's permission-deeplink flow. The error code `PERMISSION_SCREEN_RECORDING` already surfaces to the frontend. |
