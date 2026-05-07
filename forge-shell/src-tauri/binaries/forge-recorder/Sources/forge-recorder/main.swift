import Foundation
import AVFoundation

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
    var activeMic: MicCapture?

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
