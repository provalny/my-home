import Foundation

struct MonitoringReminder {
    let identifier: String
    let apartmentID: String
    let title: String
    let body: String
    let fire: Date
}

// Pure schedule generation: no notification requests and no writes to user data.
func monitoringReminders(document: [String: Any], now: Date = Date(), calendar source: Calendar = .current) -> [MonitoringReminder] {
    guard let monitoring = document["monitoring"] as? [String: Any],
          let apartments = monitoring["apartments"] as? [[String: Any]] else { return [] }
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = source.timeZone
    let parser = DateFormatter(); parser.locale = Locale(identifier: "en_US_POSIX"); parser.calendar = calendar
    parser.dateFormat = "yyyy-MM-dd"; parser.timeZone = calendar.timeZone; parser.isLenient = false
    let display = DateFormatter(); display.locale = Locale(identifier: "ru_RU"); display.dateStyle = .medium; display.timeZone = calendar.timeZone
    let start = calendar.startOfDay(for: now)
    var result: [MonitoringReminder] = []
    for apartment in apartments {
        guard let apartmentID = apartment["id"] as? String, let name = apartment["name"] as? String,
              let settings = apartment["settings"] as? [String: Any], settings["remindersEnabled"] as? Bool == true else { continue }
        let lead = max(0, min(365, settings["leadDays"] as? Int ?? 3))
        let until = calendar.date(byAdding: .day, value: lead + 40, to: start)!
        func add(_ id: String, _ label: String, _ raw: String) {
            guard let due = parser.date(from: raw), due <= until,
                  let early = calendar.date(byAdding: .day, value: -lead, to: due),
                  let fire = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: early) else { return }
            result.append(MonitoringReminder(identifier: "monitoring.\(apartmentID).\(id).\(raw)", apartmentID: apartmentID,
                title: name, body: "\(label) · \(display.string(from: due))", fire: fire))
        }
        for task in apartment["tasks"] as? [[String: Any]] ?? [] {
            if let done = task["completedAt"], !(done is NSNull) { continue }
            if let id = task["id"] as? String, let label = task["name"] as? String, let date = task["dueDate"] as? String { add("task.\(id)", label, date) }
        }
        for meter in apartment["meters"] as? [[String: Any]] ?? [] {
            if let retired = meter["retiredAt"], !(retired is NSNull) { continue }
            if let id = meter["id"] as? String, let label = meter["name"] as? String, let date = meter["verificationDate"] as? String { add("meter.\(id)", "Поверка: \(label)", date) }
        }
        let services = apartment["services"] as? [[String: Any]] ?? []
        let payments = apartment["payments"] as? [[String: Any]] ?? []
        for bill in apartment["bills"] as? [[String: Any]] ?? [] {
            guard let id = bill["id"] as? String, let amount = (bill["amountCents"] as? NSNumber)?.int64Value,
                  let date = bill["dueDate"] as? String else { continue }
            let paid = payments.filter { $0["billId"] as? String == id }.reduce(Int64(0)) { $0 + (($1["amountCents"] as? NSNumber)?.int64Value ?? 0) }
            guard amount + ((bill["adjustmentCents"] as? NSNumber)?.int64Value ?? 0) > paid else { continue }
            let label = services.first { $0["id"] as? String == bill["serviceId"] as? String }?["name"] as? String ?? "Счёт"
            add("bill.\(id)", "Оплата: \(label)", date)
        }
        let completions = apartment["completions"] as? [[String: Any]] ?? []
        for rule in apartment["rules"] as? [[String: Any]] ?? [] {
            guard rule["enabled"] as? Bool == true, let id = rule["id"] as? String,
                  let label = rule["name"] as? String, let day = rule["day"] as? Int, (1...31).contains(day) else { continue }
            let month = calendar.dateInterval(of: .month, for: now)!.start
            for offset in 0...max(2, (lead + 40) / 28 + 1) {
                guard let base = calendar.date(byAdding: .month, value: offset, to: month),
                      let range = calendar.range(of: .day, in: .month, for: base),
                      let due = calendar.date(byAdding: .day, value: min(day, range.count) - 1, to: base) else { continue }
                let raw = parser.string(from: due)
                if completions.contains(where: { $0["ruleId"] as? String == id && $0["date"] as? String == raw }) { continue }
                add("rule.\(id)", label, raw)
            }
        }
    }
    return result.sorted { $0.fire < $1.fire }
}
