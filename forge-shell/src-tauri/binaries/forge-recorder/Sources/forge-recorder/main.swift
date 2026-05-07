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
