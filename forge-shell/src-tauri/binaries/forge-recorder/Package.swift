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
