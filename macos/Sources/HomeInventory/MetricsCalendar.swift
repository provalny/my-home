import Foundation
import EventKit

private enum MetricsCalendarError: LocalizedError {
    case unavailable, invalidDay, noCalendars
    var errorDescription: String? {
        switch self {
        case .unavailable: return "Разрешите Life Assistant доступ к календарям в настройках Mac"
        case .invalidDay: return "Некорректная дата календаря"
        case .noCalendars: return "Выберите календари в источниках личных метрик"
        }
    }
}

/// Reads only the selected day's timed events. Titles are returned for confirmation,
/// never copied into the inventory document or its backups.
final class MetricsCalendar {
    static let shared = MetricsCalendar()
    private let store = EKEventStore()
    private let formatter = ISO8601DateFormatter()
    private init() { formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds] }

    private func authorized(requestAccess: Bool, completion: @escaping (Result<Void, Error>) -> Void) {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(macOS 14.0, *) {
            if status == .fullAccess { completion(.success(())); return }
        } else if status == .authorized { completion(.success(())); return }
        if status == .notDetermined && requestAccess {
            if #available(macOS 14.0, *) {
                store.requestFullAccessToEvents { granted, error in
                    DispatchQueue.main.async {
                        if granted { completion(.success(())) }
                        else { completion(.failure(error ?? MetricsCalendarError.unavailable)) }
                    }
                }
            } else {
                store.requestAccess(to: .event) { granted, error in
                    DispatchQueue.main.async {
                        if granted { completion(.success(())) }
                        else { completion(.failure(error ?? MetricsCalendarError.unavailable)) }
                    }
                }
            }
        } else { completion(.failure(MetricsCalendarError.unavailable)) }
    }

    func calendars(requestAccess: Bool, completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
        DispatchQueue.main.async {
            self.authorized(requestAccess: requestAccess) { result in
                switch result {
                case .failure(let error): completion(.failure(error))
                case .success:
                    let list = self.store.calendars(for: .event).map { calendar in
                        ["id": calendar.calendarIdentifier, "title": calendar.title] as [String: Any]
                    }.sorted { ($0["title"] as? String ?? "") < ($1["title"] as? String ?? "") }
                    completion(.success(list))
                }
            }
        }
    }

    func events(day: String, calendarIDs: [String], completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
        let parser = DateFormatter(); parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = .current; parser.dateFormat = "yyyy-MM-dd"; parser.isLenient = false
        guard let parsed = parser.date(from: day), parser.string(from: parsed) == day else {
            completion(.failure(MetricsCalendarError.invalidDay)); return
        }
        guard !calendarIDs.isEmpty, calendarIDs.count <= 30 else {
            completion(.failure(MetricsCalendarError.noCalendars)); return
        }
        DispatchQueue.main.async {
            self.authorized(requestAccess: false) { result in
                switch result {
                case .failure(let error): completion(.failure(error))
                case .success:
                    let selected = self.store.calendars(for: .event).filter { calendarIDs.contains($0.calendarIdentifier) }
                    guard !selected.isEmpty else { completion(.failure(MetricsCalendarError.noCalendars)); return }
                    let start = Calendar.current.startOfDay(for: parsed)
                    guard let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else {
                        completion(.failure(MetricsCalendarError.invalidDay)); return
                    }
                    let predicate = self.store.predicateForEvents(withStart: start, end: end, calendars: selected)
                    let values: [[String: Any]] = self.store.events(matching: predicate)
                        .filter { !$0.isAllDay && $0.endDate > start && $0.startDate < end }
                        .prefix(200)
                        .map { event in
                            ["id": event.eventIdentifier ?? UUID().uuidString,
                             "title": String((event.title ?? "Событие").prefix(120)),
                             "calendarId": event.calendar.calendarIdentifier,
                             "start": self.formatter.string(from: max(event.startDate, start)),
                             "end": self.formatter.string(from: min(event.endDate, end))] as [String: Any]
                        }
                    completion(.success(values))
                }
            }
        }
    }
}
