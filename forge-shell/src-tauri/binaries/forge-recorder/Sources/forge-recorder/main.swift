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
