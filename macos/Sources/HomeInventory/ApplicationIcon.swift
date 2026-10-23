import AppKit

/// Runtime Dock icon. Writing Finder's custom-icon resource fork breaks strict code signing.
@MainActor
enum ApplicationIcon {
    static let choices = ["aurora", "sunset", "orbit", "forest"]
    static func image(_ name: String) throws -> NSImage {
        guard choices.contains(name), let url = Bundle.main.resourceURL?.appendingPathComponent("Icons/\(name).icns"),
              let image = NSImage(contentsOf: url) else { throw InventoryError.message("Иконка приложения недоступна") }
        return image
    }
    static func apply(_ name: String) throws {
        let image = try image(name)
        NSApp.applicationIconImage = image
    }
}
