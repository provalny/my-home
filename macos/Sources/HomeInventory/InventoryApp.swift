import AppKit
import WebKit
import UserNotifications

@MainActor
final class InventoryApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, UNUserNotificationCenterDelegate {
    var store: InventoryStore!
    var host: WebHost!
    var window: NSWindow!
    var statusItem: NSStatusItem!
    var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { store = try InventoryStore() }
        catch {
            let alert = NSAlert(); alert.messageText = "Не удалось открыть данные"; alert.informativeText = error.localizedDescription + "\nФайлы не изменены."; alert.runModal(); NSApp.terminate(nil); return
        }
        host = WebHost(mode: "inventory", transparent: false, boot: { [weak self] in
            guard let self else { return [:] }
            var boot: [String: Any] = ["inventorySettings": self.publicSettings, "platform": "macos"]
            if let d = self.store.document { boot["inventory"] = d }
            return boot
        })
        host.webView.uiDelegate = self
        host.onMessage = { [weak self] m in self?.receive(m) }
        store.backupFailure = { [weak self] error in self?.host.call("backupError", error) }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 920), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Мой дом"; window.minSize = NSSize(width: 1000, height: 700)
        window.isReleasedWhenClosed = false; window.delegate = self
        window.backgroundColor = NSColor(calibratedRed: 0.04, green: 0.055, blue: 0.1, alpha: 1)
        window.contentView = host.webView; window.setFrameAutosaveName("InventoryMainWindow"); window.center()
        buildMenus()
        let center = UNUserNotificationCenter.current(); center.delegate = self
        host.load(); show()
        store.autoBackupIfDue(); scheduleNotifications()
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.store.autoBackupIfDue() }
        }
        LoginItem.followMove()
        if let path = ProcessInfo.processInfo.environment["HOUSE_SNAPSHOT_DIR"] {
            try? FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
            DispatchQueue.main.asyncAfter(deadline: .now()+10) { self.host.snapshot(to: URL(fileURLWithPath: path).appendingPathComponent("inventory.png")) }
        }
    }
    var publicSettings: [String: Any] { var s = store.publicSettings; s["login"] = LoginItem.state.rawValue; return s }
    @objc func show() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); host?.call("shown") }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { show(); return false }
    func windowWillClose(_ notification: Notification) { host.call("hidden") }
    func buildMenus() {
        let menu = NSMenu(); let appMenu = NSMenu(); let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        appMenu.addItem(withTitle: "Открыть Мой дом", action: #selector(show), keyEquivalent: "0").target = self
        appMenu.addItem(.separator()); appMenu.addItem(withTitle: "Скрыть Мой дом", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Выйти из Мой дом", action: #selector(quit), keyEquivalent: "q").target = self
        let edit = NSMenu(title: "Правка"); let editItem = NSMenuItem(title: "Правка", action: nil, keyEquivalent: ""); editItem.submenu = edit; menu.addItem(editItem)
        for (title, selector, key) in [("Отменить", "undo:", "z"), ("Вырезать", "cut:", "x"), ("Скопировать", "copy:", "c"), ("Вставить", "paste:", "v"), ("Выбрать всё", "selectAll:", "a")] { edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key) }
        NSApp.mainMenu = menu
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "shippingbox", accessibilityDescription: "Мой дом")
        let statusMenu = NSMenu(); statusMenu.addItem(withTitle: "Открыть Мой дом", action: #selector(show), keyEquivalent: "").target = self
        statusMenu.addItem(.separator()); statusMenu.addItem(withTitle: "Выйти", action: #selector(quit), keyEquivalent: "q").target = self; statusItem.menu = statusMenu
    }
    func receive(_ m: [String: Any]) {
        do {
            switch m["type"] as? String {
            case "saveInventory":
                guard let d = m["document"] as? [String: Any], let revision = m["expectedRevision"] as? Int else { throw InventoryError.message("Нет данных для сохранения") }
                try store.save(d, expected: revision, restoring: m["restore"] as? Bool ?? false)
                host.reply(to: m, ["ok": true]); scheduleNotifications()
            case "inventoryBackupFolder":
                let p = NSOpenPanel(); p.canChooseFiles = false; p.canChooseDirectories = true; p.canCreateDirectories = true; p.prompt = "Выбрать папку"
                if p.runModal() == .OK, let url = p.url { try store.chooseBackupFolder(url) }
                host.reply(to: m, publicSettings)
            case "inventoryBackupNow": try store.backup(); host.reply(to: m, ["ok": true])
            case "inventoryExport":
                let p = NSSavePanel(); p.nameFieldStringValue = "Мой-дом-\(InventoryStore.day()).json"; p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url, let d = store.document { try InventoryStore.encode(d).write(to: url, options: .atomic) }
                host.reply(to: m, ["ok": true])
            case "inventoryImport":
                let p = NSOpenPanel(); p.allowedContentTypes = [.json]; p.allowsMultipleSelection = false
                if p.runModal() == .OK, let url = p.url {
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size <= 100 * 1024 * 1024 else { throw InventoryError.message("Копия больше 100 МБ") }
                    host.reply(to: m, ["document": try InventoryStore.decode(Data(contentsOf: url))])
                } else { host.reply(to: m, ["cancelled": true]) }
            case "inventoryLogin":
                try LoginItem.set(m["on"] as? Bool ?? false); host.reply(to: m, publicSettings)
            case "inventoryNotifications":
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { allowed, error in
                    DispatchQueue.main.async { self.host.reply(to: m, error.map { ["error": $0.localizedDescription] } ?? ["allowed": allowed]) }
                }
            case "exportPlan":
                let p = NSSavePanel(); p.nameFieldStringValue = "План-квартиры.json"; p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url, let config = m["config"] as? [String: Any] { try InventoryStore.encode(config).write(to: url, options: .atomic) }
                host.reply(to: m, ["ok": true])
            case "importPlan":
                let p = NSOpenPanel(); p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url { host.reply(to: m, ["config": try JSONSerialization.jsonObject(with: Data(contentsOf: url))]) }
                else { host.reply(to: m, ["cancelled": true]) }
            case "ready": host.call("shown")
            default: if m["callId"] != nil { throw InventoryError.message("Функция недоступна в версии инвентаризации") }
            }
        } catch { host.reply(to: m, ["error": error.localizedDescription]) }
    }
    private func scheduleNotifications() {
        let center = UNUserNotificationCenter.current()
        guard let d = store.document, let prefs = d["settings"] as? [String: Any] else { return }
        center.removeAllPendingNotificationRequests()
        guard prefs["notifications"] as? Bool == true else { return }
        let days = prefs["reminderDays"] as? Int ?? 3
        let nodes = d["nodes"] as? [[String: Any]] ?? []
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Europe/Moscow")!
        let parser = DateFormatter(); parser.dateFormat = "yyyy-MM-dd"; parser.timeZone = calendar.timeZone
        for n in nodes where n["archived"] == nil || n["archived"] is NSNull {
            guard let nodeID = n["id"] as? String, let name = n["name"] as? String else { continue }
            for (field, label) in [("expiry", "Срок годности"), ("warranty", "Гарантия")] {
                guard let value = n[field] as? String, let expiry = parser.date(from: value), let day = calendar.date(byAdding: .day, value: -days, to: expiry), let fire = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: day) else { continue }
                // A stable identifier includes the date, so edits do not schedule duplicates.
                let identifier = "inventory.\(nodeID).\(field).\(value).\(days)"
                let content = UNMutableNotificationContent(); content.title = name; content.body = "\(label): \(value)"; content.sound = .default
                guard fire > Date() else { continue }
                let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
                center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
            }
        }
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void) { handler([.banner, .sound]) }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler handler: @escaping () -> Void) { DispatchQueue.main.async { self.show() }; handler() }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "Продолжить"); alert.addButton(withTitle: "Отмена"); completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { let alert = NSAlert(); alert.messageText = message; alert.runModal(); completionHandler() }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let p = NSOpenPanel(); p.allowsMultipleSelection = false; p.canChooseDirectories = false; completionHandler(p.runModal() == .OK ? p.urls : nil)
    }
}
