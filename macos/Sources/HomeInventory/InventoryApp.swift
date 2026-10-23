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
    private var notificationAuthorization = "unknown"
    private var notificationAlerts = "notSupported"
    private var notificationGeneration = 0
    private var pendingNotificationNode: String?
    private var updates: UpdateManager!

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { store = try InventoryStore() }
        catch {
            let alert = NSAlert(); alert.messageText = "Не удалось открыть данные"; alert.informativeText = error.localizedDescription + "\nФайлы не изменены."; alert.runModal(); NSApp.terminate(nil); return
        }
        updates = UpdateManager()
        try? ApplicationIcon.apply(store.settings["appIcon"] as? String ?? "aurora")
        host = WebHost(mode: "inventory", transparent: false, boot: { [weak self] in
            guard let self else { return [:] }
            var boot: [String: Any] = ["inventorySettings": self.publicSettings, "platform": "macos"]
            if let d = self.store.document { boot["inventory"] = d }
            return boot
        })
        host.webView.uiDelegate = self
        host.onMessage = { [weak self] m in self?.receive(m) }
        store.backupFailure = { [weak self] error in self?.host.call("backupError", error) }
        store.settingsChanged = { [weak self] in self?.pushSettings() }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 920), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Life Assistant"; window.minSize = NSSize(width: 1000, height: 700)
        window.isReleasedWhenClosed = false; window.delegate = self
        window.backgroundColor = NSColor(calibratedRed: 0.04, green: 0.055, blue: 0.1, alpha: 1)
        window.contentView = host.webView; window.setFrameAutosaveName("InventoryMainWindow"); window.center()
        buildMenus()
        let center = UNUserNotificationCenter.current(); center.delegate = self
        host.load(); show()
        store.autoBackupIfDue(); refreshSystemStatus(); scheduleNotifications()
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.store.autoBackupIfDue(); self?.scheduleNotifications() }
        }
        LoginItem.followMove()
        if let path = ProcessInfo.processInfo.environment["HOUSE_SNAPSHOT_DIR"] {
            try? FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
            DispatchQueue.main.asyncAfter(deadline: .now()+10) { self.host.snapshot(to: URL(fileURLWithPath: path).appendingPathComponent("inventory.png")) }
        }
    }
    var publicSettings: [String: Any] {
        var s = store.publicSettings; s["login"] = LoginItem.state.rawValue
        s["reduceMotion"] = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        s["notificationAuthorization"] = notificationAuthorization; s["notificationAlerts"] = notificationAlerts
        s.merge(updates?.settings ?? [:]) { _, new in new }
        return s
    }
    private func pushSettings() { host?.call("inventorySettings", publicSettings) }
    private func refreshSystemStatus(replyTo message: [String: Any]? = nil) {
        UNUserNotificationCenter.current().getNotificationSettings { status in
            let auth: String
            switch status.authorizationStatus {
            case .notDetermined: auth = "notDetermined"
            case .denied: auth = "denied"
            case .authorized: auth = "authorized"
            case .provisional: auth = "provisional"
            case .ephemeral: auth = "ephemeral"
            @unknown default: auth = "unknown"
            }
            let alerts = status.alertSetting == .enabled ? "enabled" : status.alertSetting == .disabled ? "disabled" : "notSupported"
            DispatchQueue.main.async {
                self.notificationAuthorization = auth; self.notificationAlerts = alerts; self.pushSettings()
                if let message { self.host.reply(to: message, self.publicSettings) }
            }
        }
    }
    func windowDidBecomeKey(_ notification: Notification) { refreshSystemStatus() }
    @objc func show() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); host?.call("shown") }
    @objc func quit() { NSApp.terminate(nil) }
    @objc func undoInventory() { host.call("inventoryUndo") }
    @objc func checkForUpdates() { do { try updates.check() } catch { let alert = NSAlert(); alert.messageText = "Обновления"; alert.informativeText = error.localizedDescription; alert.runModal() } }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { show(); return false }
    func windowWillClose(_ notification: Notification) { host.call("hidden") }
    func buildMenus() {
        let menu = NSMenu(); let appMenu = NSMenu(); let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        appMenu.addItem(withTitle: "Открыть Life Assistant", action: #selector(show), keyEquivalent: "0").target = self
        appMenu.addItem(withTitle: "Проверить обновления…", action: #selector(checkForUpdates), keyEquivalent: "").target = self
        appMenu.addItem(.separator()); appMenu.addItem(withTitle: "Скрыть Life Assistant", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Выйти из Life Assistant", action: #selector(quit), keyEquivalent: "q").target = self
        let edit = NSMenu(title: "Правка"); let editItem = NSMenuItem(title: "Правка", action: nil, keyEquivalent: ""); editItem.submenu = edit; menu.addItem(editItem)
        edit.addItem(withTitle: "Отменить", action: #selector(undoInventory), keyEquivalent: "z").target = self
        for (title, selector, key) in [("Вырезать", "cut:", "x"), ("Скопировать", "copy:", "c"), ("Вставить", "paste:", "v"), ("Выбрать всё", "selectAll:", "a")] { edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key) }
        NSApp.mainMenu = menu
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "shippingbox", accessibilityDescription: "Life Assistant")
        let statusMenu = NSMenu(); statusMenu.addItem(withTitle: "Открыть Life Assistant", action: #selector(show), keyEquivalent: "").target = self
        statusMenu.addItem(.separator()); statusMenu.addItem(withTitle: "Выйти", action: #selector(quit), keyEquivalent: "q").target = self; statusItem.menu = statusMenu
    }
    func receive(_ m: [String: Any]) {
        do {
            switch m["type"] as? String {
            case "inventoryAppIcon":
                let name = m["icon"] as? String ?? ""
                _ = try ApplicationIcon.image(name)
                try store.setApplicationIcon(name)
                try ApplicationIcon.apply(name)
                pushSettings(); host.reply(to: m, publicSettings)
            case "inventoryCheckUpdates": try updates.check(); host.reply(to: m, ["ok": true])
            case "inventoryAutomaticUpdates": updates.setAutomaticChecks(m["on"] as? Bool ?? false); host.reply(to: m, publicSettings)
            case "saveInventory":
                guard let d = m["document"] as? [String: Any], let revision = m["expectedRevision"] as? Int else { throw InventoryError.message("Нет данных для сохранения") }
                try store.save(d, expected: revision, restoring: m["restore"] as? Bool ?? false)
                host.reply(to: m, ["ok": true]); scheduleNotifications()
            case "inventoryBackupFolder":
                let p = NSOpenPanel(); p.canChooseFiles = false; p.canChooseDirectories = true; p.canCreateDirectories = true; p.prompt = "Выбрать папку"
                if p.runModal() == .OK, let url = p.url { try store.chooseBackupFolder(url) }
                host.reply(to: m, publicSettings)
            case "inventoryBackupNow": try store.backup(); host.reply(to: m, publicSettings)
            case "inventorySystemStatus": refreshSystemStatus(replyTo: m)
            case "inventoryExport":
                let p = NSSavePanel(); p.nameFieldStringValue = "Life-Assistant-\(InventoryStore.day()).json"; p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url {
                    guard let d = store.document else { throw InventoryError.message("Нет данных для экспорта") }
                    try InventoryStore.encode(d).write(to: url, options: .atomic)
                    host.reply(to: m, ["ok": true])
                } else { host.reply(to: m, ["cancelled": true]) }
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
                    DispatchQueue.main.async { self.host.reply(to: m, error.map { ["error": $0.localizedDescription] } ?? ["allowed": allowed]); self.refreshSystemStatus(); self.scheduleNotifications() }
                }
            case "exportPlan":
                let p = NSSavePanel(); p.nameFieldStringValue = "План-квартиры.json"; p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url, let config = m["config"] as? [String: Any] { try InventoryStore.encode(config).write(to: url, options: .atomic) }
                host.reply(to: m, ["ok": true])
            case "importPlan":
                let p = NSOpenPanel(); p.allowedContentTypes = [.json]
                if p.runModal() == .OK, let url = p.url { host.reply(to: m, ["config": try JSONSerialization.jsonObject(with: Data(contentsOf: url))]) }
                else { host.reply(to: m, ["cancelled": true]) }
            case "ready":
                host.call("shown"); pushSettings()
                if let id = pendingNotificationNode { pendingNotificationNode = nil; host.call("inventoryOpenNode", id) }
            default: if m["callId"] != nil { throw InventoryError.message("Функция недоступна в версии инвентаризации") }
            }
        } catch { host.reply(to: m, ["error": error.localizedDescription]) }
    }
    private func scheduleNotifications() {
        notificationGeneration += 1
        let generation = notificationGeneration
        let center = UNUserNotificationCenter.current()
        guard let d = store.document, let prefs = d["settings"] as? [String: Any] else { return }
        guard prefs["notifications"] as? Bool == true else {
            center.removeAllPendingNotificationRequests(); store.reconcileNotificationSchedules(active: [], now: Date()); return
        }
        // Read existing banners before rebuilding the schedule; a delivered reminder is not repeated.
        center.getDeliveredNotifications { delivered in
            let deliveredIDs = Set(delivered.map { $0.request.identifier })
            UNUserNotificationCenter.current().getPendingNotificationRequests { pending in
                DispatchQueue.main.async {
                    guard generation == self.notificationGeneration else { return }
                    self.scheduleNotifications(document: d, preferences: prefs, deliveredIDs: deliveredIDs, pending: pending, generation: generation)
                }
            }
        }
    }
    private func scheduleNotifications(document d: [String: Any], preferences prefs: [String: Any], deliveredIDs: Set<String>, pending: [UNNotificationRequest], generation: Int) {
        let center = UNUserNotificationCenter.current(), now = Date()
        let days = max(0, min(365, prefs["reminderDays"] as? Int ?? 3))
        let nodes = d["nodes"] as? [[String: Any]] ?? []
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let parser = DateFormatter(); parser.locale = Locale(identifier: "en_US_POSIX"); parser.calendar = calendar
        parser.dateFormat = "yyyy-MM-dd"; parser.timeZone = calendar.timeZone; parser.isLenient = false
        let display = DateFormatter(); display.locale = Locale(identifier: "ru_RU"); display.dateStyle = .medium; display.timeZone = calendar.timeZone
        var active = Set<String>()
        for n in nodes where n["archived"] == nil || n["archived"] is NSNull {
            guard let nodeID = n["id"] as? String, let name = n["name"] as? String else { continue }
            for (field, label) in [("expiry", "Срок годности"), ("warranty", "Гарантия")] {
                guard let value = n[field] as? String, let expiry = parser.date(from: value),
                      let day = calendar.date(byAdding: .day, value: -days, to: expiry),
                      let fire = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: day) else { continue }
                let identifier = "inventory.\(nodeID).\(field).\(value)"
                active.insert(identifier)
                if fire > now, let previous = pending.first(where: { $0.identifier == identifier }),
                   let trigger = previous.trigger as? UNCalendarNotificationTrigger,
                   let scheduled = trigger.nextTriggerDate(), abs(scheduled.timeIntervalSince(fire)) < 1 { continue }
                // Do not cancel an immediate notification in the second between scheduling and delivery.
                if fire <= now, pending.contains(where: { $0.identifier == identifier && $0.trigger is UNTimeIntervalNotificationTrigger }) { continue }
                if deliveredIDs.contains(identifier) || fire <= now && self.store.wasNotificationScheduled(identifier, before: now) { continue }
                let content = UNMutableNotificationContent(); content.title = name
                content.body = "\(label): \(display.string(from: expiry))"; content.sound = .default
                content.userInfo = ["nodeId": nodeID, "field": field]
                let trigger: UNNotificationTrigger
                if fire > now {
                    var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire); parts.timeZone = calendar.timeZone
                    trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
                } else { trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false) }
                center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)) { error in
                    guard error == nil else { return }
                    DispatchQueue.main.async {
                        guard generation == self.notificationGeneration else { return }
                        self.store.rememberNotificationSchedule(identifier, fire: max(fire, now))
                    }
                }
            }
        }
        let obsolete = pending.filter { $0.identifier.hasPrefix("inventory.") && !active.contains($0.identifier) }.map(\.identifier)
        if !obsolete.isEmpty { center.removePendingNotificationRequests(withIdentifiers: obsolete) }
        store.reconcileNotificationSchedules(active: active, now: now)
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void) { handler([.banner, .sound]) }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler handler: @escaping () -> Void) {
        let nodeID = response.notification.request.content.userInfo["nodeId"] as? String
        DispatchQueue.main.async {
            self.show()
            if let nodeID {
                if self.host.isReady { self.host.call("inventoryOpenNode", nodeID) }
                else { self.pendingNotificationNode = nodeID }
            }
        }
        handler()
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "Продолжить"); alert.addButton(withTitle: "Отмена"); completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { let alert = NSAlert(); alert.messageText = message; alert.runModal(); completionHandler() }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let p = NSOpenPanel(); p.allowsMultipleSelection = false; p.canChooseDirectories = false; completionHandler(p.runModal() == .OK ? p.urls : nil)
    }
}
