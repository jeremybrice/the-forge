import Foundation
import AVFoundation
import ScreenCaptureKit

// MARK: - Mic capture

final class MicCapture {
    let outputURL: URL
    let engine = AVAudioEngine()
    private var file: AVAudioFile?
    private(set) var lastRMS: Float = 0
    private(set) var sampleCount: Int64 = 0
    private var inputSampleRate: Double = 48000

    init(outputURL: URL) {
        self.outputURL = outputURL
    }

    func start() throws {
        // TCC pre-flight. On macOS, AVAudioEngine does NOT throw when mic
        // permission is denied — it starts and delivers zero-amplitude buffers
        // forever, producing silent WAVs that whisper transcribes as "Thank
        // you." Surface the denial explicitly so the recorder bails with
        // PERMISSION_MIC instead of recording silence.
        try MicCapture.ensureAuthorized()

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)
        self.inputSampleRate = inputFormat.sampleRate

        // On-disk WAV: 48 kHz, mono, 16-bit PCM. AVAudioFile (via ExtAudioFile)
        // converts the input buffer's format to these settings on write — no
        // explicit AVAudioConverter needed in the real-time tap callback,
        // which avoids SIGTRAPs from running the converter off the audio thread.
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

        // Initialize AVAudioFile with the input's processing format so the tap
        // callback can write its buffer directly. AVAudioFile handles the
        // conversion to the on-disk settings internally.
        self.file = try AVAudioFile(
            forWriting: outputURL,
            settings: settings,
            commonFormat: inputFormat.commonFormat,
            interleaved: inputFormat.isInterleaved
        )

        inputNode.installTap(onBus: 0, bufferSize: 4800, format: inputFormat) { [weak self] buffer, _ in
            guard let self = self, let file = self.file else { return }

            // RMS from the input buffer's first channel (typically Float32)
            let frames = Int(buffer.frameLength)
            if frames > 0 {
                if let floatChannels = buffer.floatChannelData {
                    let ch0 = floatChannels[0]
                    var sumSq: Double = 0
                    for i in 0..<frames {
                        let s = Double(ch0[i])
                        sumSq += s * s
                    }
                    self.lastRMS = Float(sqrt(sumSq / Double(frames)))
                } else if let int16Channels = buffer.int16ChannelData {
                    let ch0 = int16Channels[0]
                    var sumSq: Double = 0
                    for i in 0..<frames {
                        let s = Double(ch0[i]) / 32768.0
                        sumSq += s * s
                    }
                    self.lastRMS = Float(sqrt(sumSq / Double(frames)))
                }
            }

            do {
                try file.write(from: buffer)
                self.sampleCount += Int64(buffer.frameLength)
            } catch {
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
        sampleCount > 0 ? Double(sampleCount) / inputSampleRate : 0
    }

    /// Synchronously confirms (or requests) TCC microphone access for this
    /// process. Throws if access is denied or restricted. Must be called from
    /// the recorder's command thread, NOT from a CoreAudio callback.
    ///
    /// AVAudioEngine's silent-on-denial behavior is the reason this exists:
    /// without an explicit check, a denied permission produces zero-amplitude
    /// buffers with no error, and the failure is only visible downstream when
    /// the WAV gets transcribed as "Thank you."
    static func ensureAuthorized() throws {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        switch status {
        case .authorized:
            return
        case .notDetermined:
            // First-run: synchronously block on the TCC prompt completion.
            let sem = DispatchSemaphore(value: 0)
            var granted = false
            AVCaptureDevice.requestAccess(for: .audio) { ok in
                granted = ok
                sem.signal()
            }
            // 60 s is generous; macOS shows the prompt immediately, the user
            // just needs to click.
            _ = sem.wait(timeout: .now() + 60)
            if !granted {
                throw NSError(
                    domain: "ForgeRecorder", code: 10,
                    userInfo: [NSLocalizedDescriptionKey:
                        "microphone permission denied by user"])
            }
        case .denied:
            throw NSError(
                domain: "ForgeRecorder", code: 11,
                userInfo: [NSLocalizedDescriptionKey:
                    "microphone permission denied — enable in System Settings → Privacy & Security → Microphone for forge-recorder, then retry"])
        case .restricted:
            throw NSError(
                domain: "ForgeRecorder", code: 12,
                userInfo: [NSLocalizedDescriptionKey:
                    "microphone access is restricted on this device (parental controls or MDM)"])
        @unknown default:
            throw NSError(
                domain: "ForgeRecorder", code: 13,
                userInfo: [NSLocalizedDescriptionKey:
                    "unknown microphone authorization status: \(status.rawValue)"])
        }
    }
}

// MARK: - System audio capture

final class SystemCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    let outputURL: URL
    private var stream: SCStream?
    private var file: AVAudioFile?
    private(set) var lastRMS: Float = 0
    private(set) var sampleCount: Int64 = 0
    private let outputQueue = DispatchQueue(label: "com.forge.recorder.system-output")
    private var inputSampleRate: Double = 48000
    private var bufferCount: Int64 = 0

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

        // Ensure parent directory; the AVAudioFile is created lazily on the
        // first audio buffer so we can match its commonFormat / interleaved
        // layout to the stream's actual format.
        try FileManager.default.createDirectory(
            at: outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

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
        sampleCount > 0 ? Double(sampleCount) / inputSampleRate : 0
    }

    // MARK: SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid else { return }

        bufferCount += 1

        // Read the format from the sample buffer so we can build a matching
        // AVAudioPCMBuffer. ScreenCaptureKit emits Float32 interleaved stereo
        // at 48 kHz by default (matching SCStreamConfiguration sampleRate +
        // channelCount).
        guard let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc)?.pointee else {
            FileHandle.standardError.write(Data("[system] no format description\n".utf8))
            return
        }
        let inFormat = withUnsafePointer(to: asbd) { AVAudioFormat(streamDescription: $0) }
        guard let inFormat = inFormat else {
            FileHandle.standardError.write(Data("[system] could not build AVAudioFormat\n".utf8))
            return
        }

        // Lazy-init AVAudioFile on first buffer. We always feed it a MONO
        // float32 buffer (downmixed from the input stream's channels below).
        // ExtAudioFile then only has to do a sample-format conversion
        // (float32 → int16 mono 48k on disk), which is RT-safe and well-
        // supported. We avoid asking ExtAudioFile to do channel mixing,
        // because it returns -50 (kAudio_ParamError) on non-interleaved
        // stereo input — that was the bug behind silent empty WAVs.
        if self.file == nil {
            self.inputSampleRate = inFormat.sampleRate
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: 48000.0,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ]
            do {
                // Client format: mono float32 at the input's sample rate.
                self.file = try AVAudioFile(
                    forWriting: outputURL,
                    settings: settings,
                    commonFormat: .pcmFormatFloat32,
                    interleaved: false
                )
                FileHandle.standardError.write(
                    Data("[system] AVAudioFile opened (input sr=\(inFormat.sampleRate), ch=\(inFormat.channelCount), interleaved=\(inFormat.isInterleaved); client=mono float32)\n".utf8)
                )
            } catch {
                FileHandle.standardError.write(Data("[system] AVAudioFile init failed: \(error)\n".utf8))
                return
            }
        }
        guard let file = self.file else { return }

        // Extract the AudioBufferList. Allocate enough room for non-interleaved
        // multi-channel layouts; for interleaved formats only the first AudioBuffer
        // entry is used.
        let channelCount = Int(inFormat.channelCount)
        let bufListByteSize = MemoryLayout<AudioBufferList>.size
            + MemoryLayout<AudioBuffer>.size * max(0, channelCount - 1)

        var blockBuffer: CMBlockBuffer?
        let bufListPtr = UnsafeMutableRawPointer.allocate(byteCount: bufListByteSize, alignment: 16)
        defer { bufListPtr.deallocate() }
        let abl = bufListPtr.assumingMemoryBound(to: AudioBufferList.self)

        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: abl,
            bufferListSize: bufListByteSize,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr, blockBuffer != nil else {
            FileHandle.standardError.write(Data("[system] CMSampleBufferGetAudioBufferList failed: \(status)\n".utf8))
            return
        }

        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard frameCount > 0 else { return }
        guard let inBuf = AVAudioPCMBuffer(pcmFormat: inFormat, frameCapacity: frameCount) else { return }
        inBuf.frameLength = frameCount

        // Copy each plane (1 buffer for interleaved, N for non-interleaved).
        let srcList = UnsafeMutableAudioBufferListPointer(abl)
        let dstList = UnsafeMutableAudioBufferListPointer(inBuf.mutableAudioBufferList)
        for i in 0..<min(srcList.count, dstList.count) {
            if let src = srcList[i].mData, let dst = dstList[i].mData {
                let bytes = min(srcList[i].mDataByteSize, dstList[i].mDataByteSize)
                memcpy(dst, src, Int(bytes))
                dstList[i].mDataByteSize = bytes
            }
        }

        // Downmix to a mono float32 buffer. For stereo we average L+R; for
        // mono we copy through. Channel 0 also feeds the RMS metering.
        guard let monoFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: inFormat.sampleRate,
            channels: 1,
            interleaved: false
        ), let monoBuf = AVAudioPCMBuffer(pcmFormat: monoFormat, frameCapacity: frameCount) else { return }
        monoBuf.frameLength = frameCount

        guard let srcChannels = inBuf.floatChannelData,
              let dstChannel = monoBuf.floatChannelData?[0] else { return }
        let frames = Int(frameCount)
        let srcCh0 = srcChannels[0]
        if inFormat.channelCount >= 2 {
            let srcCh1 = srcChannels[1]
            for i in 0..<frames {
                dstChannel[i] = (srcCh0[i] + srcCh1[i]) * 0.5
            }
        } else {
            for i in 0..<frames {
                dstChannel[i] = srcCh0[i]
            }
        }

        // RMS from the mono mix
        if frames > 0 {
            var sumSq: Double = 0
            for i in 0..<frames {
                let s = Double(dstChannel[i])
                sumSq += s * s
            }
            self.lastRMS = Float(sqrt(sumSq / Double(frames)))
        }

        // Write the mono buffer; AVAudioFile converts mono float32 → mono
        // int16 48k on disk via ExtAudioFile.
        do {
            try file.write(from: monoBuf)
            self.sampleCount += Int64(monoBuf.frameLength)
        } catch {
            FileHandle.standardError.write(Data("[system] write error: \(error)\n".utf8))
        }
    }

    // MARK: SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        FileHandle.standardError.write(Data("SCStream stopped with error: \(error)\n".utf8))
    }
}

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
    var outDir: String?
    var sources: Set<String> = []
    var activeMic: MicCapture?
    var activeSystem: SystemCapture?
    private var meterTimer: DispatchSourceTimer?
    private var elapsedTimer: DispatchSourceTimer?

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

        if let free = self.freeBytes(at: outDir) {
            if free < 5_000_000_000 {
                emit(["event": "warning", "code": "DISK_LOW", "message": "free disk below 5 GB at start"])
            }
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
        startMeterTicks()
        startElapsedTicks()
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

        meterTimer?.cancel(); meterTimer = nil
        elapsedTimer?.cancel(); elapsedTimer = nil
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
}

// MARK: - IPC main loop

let recorder = Recorder()

// Graceful shutdown on SIGINT / SIGTERM. Stops the active capture(s)
// synchronously so AVAudioFile's deinit patches the WAV header's data-size
// field before the process exits. Without this, ^C leaves a header that
// reports 0 audio bytes even though samples are on disk.
var signalSources: [DispatchSourceSignal] = []
let signalQueue = DispatchQueue(label: "com.forge.recorder.signal")
for sig in [SIGINT, SIGTERM] {
    signal(sig, SIG_IGN)
    let src = DispatchSource.makeSignalSource(signal: sig, queue: signalQueue)
    src.setEventHandler {
        recorder.activeMic?.stop()
        recorder.activeSystem?.stop()
        // Give AVAudioFile deinit a moment to flush.
        usleep(200_000)
        exit(0)
    }
    src.resume()
    signalSources.append(src)
}

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
