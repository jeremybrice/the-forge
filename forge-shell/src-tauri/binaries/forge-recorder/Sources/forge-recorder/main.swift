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
        let inFormat = withUnsafePointer(to: asbd) { AVAudioFormat(streamDescription: $0) }
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
                statusPointer.pointee = AVAudioConverterInputStatus.noDataNow
                return nil
            }
            produced = true
            statusPointer.pointee = AVAudioConverterInputStatus.haveData
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
