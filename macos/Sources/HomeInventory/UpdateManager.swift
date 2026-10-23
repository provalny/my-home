import AppKit
import Sparkle

/// Sparkle verifies signed archives and installs updates while retaining app data.
@MainActor
final class UpdateManager {
    private var controller: SPUStandardUpdaterController?
    init() {
        guard ProcessInfo.processInfo.environment["HOUSE_DATA_DIR"] == nil,
              let feed = Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") as? String,
              feed.hasPrefix("https://"),
              let key = Bundle.main.object(forInfoDictionaryKey: "SUPublicEDKey") as? String, !key.isEmpty else { return }
        controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
    }
    var settings: [String: Any] {
        ["updatesConfigured": controller != nil,
         "automaticUpdateChecks": controller?.updater.automaticallyChecksForUpdates ?? false]
    }
    func check() throws {
        guard let controller else { throw InventoryError.message("Обновления ещё не настроены для этой сборки") }
        guard controller.updater.canCheckForUpdates else { throw InventoryError.message("Проверка обновлений уже выполняется. Дождитесь её завершения.") }
        controller.checkForUpdates(nil)
    }
    func setAutomaticChecks(_ enabled: Bool) {
        controller?.updater.automaticallyChecksForUpdates = enabled
    }
}
