// Compile with InventoryStore.swift and run outside the application; touches only a temporary folder.
import Foundation

@main struct StoreChecks {
    static func main() throws {
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("inventory-store-test-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: dir) }
        let folder = dir.appendingPathComponent("data")
        let backupFolder = dir.appendingPathComponent("copies")
        try fm.createDirectory(at: backupFolder, withIntermediateDirectories: true)
        let sample: [String: Any] = ["format":"my-home-inventory","version":1,"revision":1,"nodes":[],"categories":[],"events":[],"settings":["reminderDays":3],"plan":["rooms":[]]]
        let store = try InventoryStore(folder: folder)
        try store.save(sample, expected: 0, restoring: false)
        let reopened = try InventoryStore(folder: folder)
        precondition(reopened.revision == 1, "Saved document must survive relaunch")
        do { try reopened.save(sample, expected: 0, restoring: false); fatalError("Stale revision accepted") }
        catch { precondition(reopened.revision == 1) }
        try store.chooseBackupFolder(backupFolder)
        let untouched = backupFolder.appendingPathComponent("other-file.json")
        try Data("keep".utf8).write(to: untouched)
        for _ in 0..<7 { try store.backup() }
        let copies = try fm.contentsOfDirectory(at: backupFolder.appendingPathComponent("Мой дом — автокопии"), includingPropertiesForKeys: nil)
        precondition(copies.count == 5, "Exactly the newest five automatic copies must remain")
        let unrelated = try String(contentsOf: untouched, encoding: .utf8)
        precondition(unrelated == "keep")
        for file in copies { _ = try InventoryStore.decode(Data(contentsOf: file)) }
        let before = copies.count
        store.autoBackupIfDue()
        let after = try fm.contentsOfDirectory(at: backupFolder.appendingPathComponent("Мой дом — автокопии"), includingPropertiesForKeys: nil).count
        precondition(after == before, "No second auto copy on same day")
        var next = sample; next["revision"] = 2
        try store.save(next, expected: 1, restoring: true)
        let recoveries = try fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasPrefix("before-restore-") }
        precondition(recoveries.count == 1)
        let old = try InventoryStore.decode(Data(contentsOf: recoveries[0]))
        precondition(old["revision"] as? Int == 1, "Recovery copy contains the old document")
        do { _ = try InventoryStore.decode(Data("{\"version\":99}".utf8)); fatalError("Malformed backup accepted") }
        catch { let reloaded = try InventoryStore(folder: folder); precondition(reloaded.revision == 2) }
        let status = store.publicSettings
        precondition(!(status["lastBackupAt"] as? String ?? "").isEmpty, "Last successful backup date must be public")
        precondition(status["backupCount"] as? Int == 5)
        precondition((status["lastBackupError"] as? String ?? "").isEmpty)
        let future = Date().addingTimeInterval(3600)
        let past = Date().addingTimeInterval(-3600)
        store.rememberNotificationSchedule("future", fire: future)
        store.rememberNotificationSchedule("past", fire: past)
        precondition(!store.wasNotificationScheduled("future", before: Date()))
        precondition(store.wasNotificationScheduled("past", before: Date()))
        store.reconcileNotificationSchedules(active: [], now: Date())
        let receipts = try InventoryStore(folder: folder)
        precondition(!receipts.wasNotificationScheduled("future", before: future.addingTimeInterval(1)), "Cancelled future reminders are forgotten")
        precondition(receipts.wasNotificationScheduled("past", before: Date()), "Delivered reminders survive relaunch")
        try fm.removeItem(at: backupFolder)
        try Data("folder is unavailable".utf8).write(to: backupFolder)
        do { try store.backup(); fatalError("Backup to a file succeeded") } catch {}
        precondition(!(store.publicSettings["lastBackupError"] as? String ?? "").isEmpty, "Failure must stay visible")
        precondition(store.revision == 2, "Failed backup cannot change document")
        let failedReopened = try InventoryStore(folder: folder)
        precondition(!(failedReopened.publicSettings["lastBackupError"] as? String ?? "").isEmpty, "Failure survives relaunch")
        try fm.removeItem(at: backupFolder)
        try fm.createDirectory(at: backupFolder, withIntermediateDirectories: true)
        try store.chooseBackupFolder(backupFolder)
        precondition((store.publicSettings["lastBackupError"] as? String ?? "").isEmpty, "Successful retry clears error")
        try store.setApplicationIcon("orbit")
        let iconReopened = try InventoryStore(folder: folder)
        precondition(iconReopened.publicSettings["appIcon"] as? String == "orbit", "Icon selection survives relaunch")
        do { try store.setApplicationIcon("unknown"); fatalError("Unknown icon accepted") } catch {}
        precondition(store.publicSettings["appIcon"] as? String == "orbit", "Invalid icon cannot replace saved choice")
        print("PASS: icon preference, backup health, failure recovery, reminder receipts; atomic save, relaunch, revision conflict, 5-copy rotation, unrelated files, daily backup, pre-restore protection, invalid data")
    }
}
