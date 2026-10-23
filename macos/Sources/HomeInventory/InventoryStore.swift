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
    private func writeSettings(_ next: [String: Any]) throws {
        try Self.encode(next).write(to: settingsURL, options: .atomic)
        settings = next
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
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Europe/Moscow"); return f.string(from: Date())
    }
    static func timestamp() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyyMMdd-HHmmss-SSS"; f.timeZone = TimeZone(identifier: "Europe/Moscow"); return f.string(from: Date())
    }
    func chooseBackupFolder(_ url: URL) throws {
        let bookmark = try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
        var next = settings
        next["backupBookmark"] = bookmark.base64EncodedString(); next["backupFolder"] = url.path
        next.removeValue(forKey: "lastBackupDay")
        try writeSettings(next)
        try backup()
    }
    func backup() throws {
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
        let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isRegularFileKey]).filter {
            $0.lastPathComponent.hasPrefix("my-home-auto-") && $0.pathExtension == "json" && (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
        }.sorted { $0.lastPathComponent > $1.lastPathComponent }
        for old in files.dropFirst(5) { try FileManager.default.removeItem(at: old) }
        next["lastBackupDay"] = Self.day()
        try writeSettings(next)
    }
    func autoBackupIfDue() {
        guard settings["backupBookmark"] != nil, settings["lastBackupDay"] as? String != Self.day() else { return }
        do { try backup() } catch { backupFailure?(error.localizedDescription) }
    }
    var publicSettings: [String: Any] { ["backupFolder": settings["backupFolder"] ?? ""] }
}
