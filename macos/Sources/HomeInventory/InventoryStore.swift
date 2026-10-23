import Foundation

enum InventoryError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let s) = self { return s }; return nil }
}

/// One atomic, versioned document includes geometry, photos, inventory and events.
/// The UI sends a revision with every edit; an out-of-date writer cannot overwrite it.
final class InventoryStore {
    let folder: URL
    private let settingsURL: URL
    private(set) var document: [String: Any]?
    private(set) var settings: [String: Any] = [:]
    var backupFailure: ((String) -> Void)?
    var settingsChanged: (() -> Void)?
    private var lastAutomaticAttempt: Date?
    var revision: Int { document?["revision"] as? Int ?? 0 }

    init(folder override: URL? = nil) throws {
        let env = ProcessInfo.processInfo.environment
        folder = override ?? env["HOUSE_DATA_DIR"].map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MyHomeInventory", isDirectory: true)
        settingsURL = folder.appendingPathComponent("preferences.json")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("inventory.json")
        if FileManager.default.fileExists(atPath: url.path) {
            document = try Self.decode(Data(contentsOf: url))
        }
        if FileManager.default.fileExists(atPath: settingsURL.path) {
            settings = try JSONSerialization.jsonObject(with: Data(contentsOf: settingsURL)) as? [String: Any] ?? [:]
        }
    }
    static func decode(_ data: Data) throws -> [String: Any] {
        guard data.count <= 100 * 1024 * 1024 else { throw InventoryError.message("Копия больше 100 МБ") }
        guard let d = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              d["format"] as? String == "my-home-inventory", d["version"] as? Int == 1,
              d["nodes"] is [[String: Any]], d["categories"] is [[String: Any]],
              d["events"] is [[String: Any]], d["plan"] is [String: Any], d["settings"] is [String: Any] else {
            throw InventoryError.message("Некорректный формат данных «Мой дом»")
        }
        return d
    }
    static func encode(_ d: [String: Any]) throws -> Data { try JSONSerialization.data(withJSONObject: d, options: [.sortedKeys, .withoutEscapingSlashes]) }
    private func writeSettings(_ next: [String: Any], notify: Bool = true) throws {
        try Self.encode(next).write(to: settingsURL, options: .atomic)
        settings = next
        if notify { settingsChanged?() }
    }
    func save(_ next: [String: Any], expected: Int, restoring: Bool) throws {
        guard expected == revision else { throw InventoryError.message("Данные уже изменились. Закройте и снова откройте окно.") }
        let data = try Self.encode(next)
        _ = try Self.decode(data)
        if restoring, let old = document {
            let recovery = folder.appendingPathComponent("before-restore-\(Self.timestamp()).json")
            try Self.encode(old).write(to: recovery, options: .atomic)
        }
        try data.write(to: folder.appendingPathComponent("inventory.json"), options: .atomic)
        document = next
        autoBackupIfDue()
    }
    static func day() -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current; return f.string(from: Date())
    }
    static func timestamp() -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyyMMdd-HHmmss-SSS"; f.timeZone = .current; return f.string(from: Date())
    }
    func chooseBackupFolder(_ url: URL) throws {
        let bookmark = try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
        var next = settings
        next["backupBookmark"] = bookmark.base64EncodedString(); next["backupFolder"] = url.path
        for key in ["lastBackupDay", "lastBackupAt", "lastBackupError", "lastBackupErrorAt", "backupCount"] { next.removeValue(forKey: key) }
        try writeSettings(next)
        try backup()
    }
    func backup() throws {
        do { try writeBackup() }
        catch {
            var next = settings
            next["lastBackupError"] = error.localizedDescription
            next["lastBackupErrorAt"] = ISO8601DateFormatter().string(from: Date())
            try? writeSettings(next)
            throw error
        }
    }
    private func writeBackup() throws {
        guard let document else { throw InventoryError.message("Сначала добавьте данные") }
        guard let encoded = settings["backupBookmark"] as? String, let bookmark = Data(base64Encoded: encoded) else { throw InventoryError.message("Выберите папку для резервных копий в настройках") }
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: .withSecurityScope, relativeTo: nil, bookmarkDataIsStale: &stale)
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var next = settings
        if stale { next["backupBookmark"] = try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil).base64EncodedString() }
        // Keep the user's chosen directory untouched: only our dedicated subfolder is rotated.
        let dir = url.appendingPathComponent("Мой дом — автокопии", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("my-home-auto-\(Self.timestamp())-\(UUID().uuidString).json")
        try Self.encode(document).write(to: file, options: .atomic)
        let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isRegularFileKey, .contentModificationDateKey]).filter {
            $0.lastPathComponent.hasPrefix("my-home-auto-") && $0.pathExtension == "json" && (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
        }.sorted {
            let a = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let b = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return a == b ? $0.lastPathComponent > $1.lastPathComponent : a > b
        }
        for old in files.dropFirst(5) { try FileManager.default.removeItem(at: old) }
        next["lastBackupDay"] = Self.day()
        next["lastBackupAt"] = ISO8601DateFormatter().string(from: Date())
        next["backupCount"] = min(5, files.count)
        next.removeValue(forKey: "lastBackupError"); next.removeValue(forKey: "lastBackupErrorAt")
        try writeSettings(next)
    }
    func autoBackupIfDue() {
        guard settings["backupBookmark"] != nil, settings["lastBackupDay"] as? String != Self.day() else { return }
        // Keep the failure visible, retry periodically, and avoid an error toast on every edit.
        if let lastAutomaticAttempt, Date().timeIntervalSince(lastAutomaticAttempt) < 15 * 60 { return }
        lastAutomaticAttempt = Date()
        let previousError = settings["lastBackupError"] as? String
        do { try backup() } catch { if previousError != error.localizedDescription { backupFailure?(error.localizedDescription) } }
    }
    var publicSettings: [String: Any] {
        ["backupFolder": settings["backupFolder"] ?? "", "lastBackupAt": settings["lastBackupAt"] ?? "",
         "lastBackupError": settings["lastBackupError"] ?? "", "lastBackupErrorAt": settings["lastBackupErrorAt"] ?? "",
         "backupCount": settings["backupCount"] ?? 0, "appIcon": settings["appIcon"] ?? "aurora"]
    }
    func setApplicationIcon(_ name: String) throws {
        guard ["aurora", "sunset", "orbit", "forest"].contains(name) else { throw InventoryError.message("Неизвестная иконка приложения") }
        var next = settings; next["appIcon"] = name
        try writeSettings(next)
    }
    // Remember scheduled reminders across launches, including banners the user has dismissed.
    // A future reminder removed by an edit is forgotten, so a later restore can notify again.
    func wasNotificationScheduled(_ identifier: String, before date: Date) -> Bool {
        guard let schedules = settings["notificationSchedules"] as? [String: String], let raw = schedules[identifier],
              let fire = ISO8601DateFormatter().date(from: raw) else { return false }
        return fire <= date
    }
    func reconcileNotificationSchedules(active: Set<String>, now: Date) {
        guard let schedules = settings["notificationSchedules"] as? [String: String] else { return }
        let formatter = ISO8601DateFormatter()
        let nextSchedules = schedules.filter { active.contains($0.key) || (formatter.date(from: $0.value) ?? .distantFuture) <= now }
        guard schedules != nextSchedules else { return }
        var next = settings; next["notificationSchedules"] = nextSchedules
        try? writeSettings(next, notify: false)
    }
    func rememberNotificationSchedule(_ identifier: String, fire: Date) {
        var schedules = settings["notificationSchedules"] as? [String: String] ?? [:]
        schedules[identifier] = ISO8601DateFormatter().string(from: fire)
        if schedules.count > 5000 { schedules = Dictionary(uniqueKeysWithValues: schedules.sorted { $0.value > $1.value }.prefix(5000).map { ($0.key, $0.value) }) }
        var next = settings; next["notificationSchedules"] = schedules
        try? writeSettings(next, notify: false)
    }
}
