// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "HouseControl",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(path: "../core"),
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0")
    ],
    targets: [
        .executableTarget(name: "HomeInventory", dependencies: [.product(name: "Sparkle", package: "Sparkle")], path: "Sources/HomeInventory",
                          linkerSettings: [.unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]),
        .executableTarget(name: "HouseControl",
                          dependencies: [.product(name: "HouseCore", package: "core"),
                                         .product(name: "HouseSmartLife", package: "core")],
                          path: "Sources/HouseControl")
    ]
)
