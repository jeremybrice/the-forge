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
            path: "Sources/forge-recorder",
            linkerSettings: [
                // Embed Info.plist into the Mach-O so TCC has a stable principal
                // (CFBundleIdentifier) and a NSMicrophoneUsageDescription string
                // it can show in the permission prompt. Without this, the binary
                // is identifier-less to TCC and mic access is silently denied —
                // AVAudioEngine starts successfully but the input node delivers
                // zero-amplitude buffers (the "Thank you." whisper hallucination
                // bug). The path is resolved relative to the package root at
                // link time.
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Info.plist",
                ])
            ]
        )
    ]
)
