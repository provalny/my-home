import AppKit

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = InventoryApp()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
