import Foundation
import Security

protocol ItemMasterCredentialStore {
    func read() throws -> String
    func write(_ key: String) throws
}

struct ItemMasterKeychain: ItemMasterCredentialStore {
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "local.myhome.inventory.tavily", kSecAttrAccount as String: "api-key"] }
    func read() throws -> String {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let code = SecItemCopyMatching(q as CFDictionary, &value)
        if code == errSecItemNotFound { return "" }
        guard code == errSecSuccess, let data = value as? Data, let key = String(data: data, encoding: .utf8) else {
            throw ItemMasterTavily.failure("Не удалось прочитать ключ из Связки ключей Mac")
        }
        return key
    }
    func write(_ key: String) throws {
        if key.isEmpty {
            let code = SecItemDelete(query as CFDictionary)
            guard code == errSecSuccess || code == errSecItemNotFound else { throw ItemMasterTavily.failure("Не удалось удалить ключ Tavily") }
            return
        }
        let data = Data(key.utf8), code = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if code == errSecItemNotFound {
            var q = query; q[kSecValueData as String] = data
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw ItemMasterTavily.failure("Не удалось сохранить ключ в Связке ключей Mac") }
        } else if code != errSecSuccess { throw ItemMasterTavily.failure("Не удалось обновить ключ Tavily") }
    }
}

private final class TavilyNoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

final class ItemMasterTavily {
    typealias Reply = (Result<[String: Any], Error>) -> Void
    typealias Transport = (String, String, [String: Any]?, @escaping Reply) -> Void
    private let queue = DispatchQueue(label: "life-assistant.tavily-connection")
    private let store: ItemMasterCredentialStore
    private let transport: Transport
    private var key = "", loaded = false, generation = 0
    private var budget: [String: Int]?, checkedAt = Date.distantPast
    private var waiting: [(Result<String, Error>) -> Void] = []
    private var checking = false

    init(store: ItemMasterCredentialStore = ItemMasterKeychain(), transport: @escaping Transport = ItemMasterTavily.request) {
        self.store = store; self.transport = transport
    }
    static func failure(_ text: String) -> NSError { NSError(domain: "ItemMaster", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    static func validatedKey(_ raw: String) throws -> String {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard key.range(of: "^tvly-[A-Za-z0-9_-]{10,240}$", options: .regularExpression) != nil else {
            throw failure("Вставьте API-ключ Tavily целиком: он начинается с tvly-")
        }
        return key
    }
    static func freeUsage(_ data: [String: Any]) throws -> [String: Int] {
        func number(_ value: Any?) -> Int? {
            guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite,
                  n.doubleValue >= 0, n.doubleValue <= 1e9, n.doubleValue.rounded() == n.doubleValue else { return nil }
            return n.intValue
        }
        guard let a = data["account"] as? [String: Any], let plan = a["current_plan"] as? String,
              ["researcher", "free"].contains(plan.lowercased()), let limit = number(a["plan_limit"]), limit <= 1000,
              let used = number(a["plan_usage"]), (number(a["paygo_limit"]) == 0 || a["paygo_limit"] is NSNull && number(a["paygo_usage"]) == 0) else {
            throw failure("Подключите бесплатный тариф Tavily с отключённой оплатой сверх лимита. Проверьте тариф и Pay as you go в кабинете Tavily.")
        }
        var remaining = max(0, limit - used)
        if let k = data["key"] as? [String: Any], let keyLimit = number(k["limit"]), let keyUsed = number(k["usage"]) {
            remaining = min(remaining, max(0, keyLimit - keyUsed))
        }
        return ["limit": limit, "used": used, "remaining": remaining]
    }
    private func load() throws { if !loaded { key = try store.read(); loaded = true } }
    private func status() -> [String: Any] {
        var result: [String: Any] = ["connected": !key.isEmpty, "canManage": true, "storage": "keychain"]
        if let budget { result["budget"] = budget }
        return result
    }
    func connection(action: String, apiKey: String = "", completion: @escaping Reply) {
        queue.async {
            do {
                try self.load()
                if action == "status" { completion(.success(self.status())); return }
                if action == "disconnect" {
                    try self.store.write(""); self.generation += 1; self.key = ""; self.budget = nil; self.checkedAt = .distantPast
                    completion(.success(self.status())); return
                }
                guard ["connect", "check"].contains(action) else { throw Self.failure("Неизвестное действие подключения") }
                let candidate = try Self.validatedKey(action == "connect" ? apiKey : self.key)
                self.generation += 1; let revision = self.generation
                self.transport("usage", candidate, nil) { response in
                    self.queue.async {
                        do {
                            let next = try Self.freeUsage(response.get())
                            guard revision == self.generation else { throw Self.failure("Настройки подключения изменились. Повторите проверку.") }
                            if action == "connect" { try self.store.write(candidate) }
                            self.key = candidate; self.budget = next; self.checkedAt = Date()
                            completion(.success(self.status()))
                        } catch { completion(.failure(error)) }
                    }
                }
            } catch { completion(.failure(error)) }
        }
    }
    func authorize(completion: @escaping (Result<String, Error>) -> Void) {
        queue.async {
            do {
                try self.load()
                if self.key.isEmpty { completion(.success("")); return }
                if self.budget == nil || Date().timeIntervalSince(self.checkedAt) >= 120 {
                    self.waiting.append(completion)
                    if self.checking { return }; self.checking = true
                    let candidate = self.key, revision = self.generation
                    self.transport("usage", candidate, nil) { response in
                        self.queue.async {
                            let callbacks = self.waiting; self.waiting = []; self.checking = false
                            do {
                                let next = try Self.freeUsage(response.get())
                                guard revision == self.generation else { throw Self.failure("Подключение Tavily изменилось. Запустите поиск снова.") }
                                self.budget = next; self.checkedAt = Date()
                                callbacks.forEach { self.authorize(completion: $0) }
                            } catch { callbacks.forEach { $0(.failure(error)) } }
                        }
                    }
                    return
                }
                guard let remaining = self.budget?["remaining"], remaining > 0 else { throw Self.failure("Бесплатные запросы Tavily закончились. Обновите остаток в настройках поиска.") }
                self.budget?["remaining"] = remaining - 1; self.budget?["used", default: 0] += 1
                completion(.success(self.key))
            } catch { completion(.failure(error)) }
        }
    }
    static func request(_ path: String, key: String, body: [String: Any]?, completion: @escaping Reply) {
        guard ["search", "usage"].contains(path) else { completion(.failure(failure("Некорректный запрос Tavily"))); return }
        var request = URLRequest(url: URL(string: "https://api.tavily.com/" + path)!)
        request.httpMethod = body == nil ? "GET" : "POST"; request.timeoutInterval = path == "usage" ? 15 : 35
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if key.isEmpty { request.setValue("keyless", forHTTPHeaderField: "X-Tavily-Access-Mode") }
        else { request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil; configuration.urlCache = nil
        configuration.timeoutIntervalForResource = 40
        let session = URLSession(configuration: configuration, delegate: TavilyNoRedirect(), delegateQueue: nil)
        session.dataTask(with: request) { data, response, error in
            defer { session.finishTasksAndInvalidate() }
            guard error == nil, let response = response as? HTTPURLResponse, response.url?.host == "api.tavily.com" else {
                completion(.failure(failure("Сервис Tavily не ответил. Проверьте интернет и попробуйте снова."))); return
            }
            guard response.statusCode == 200 else {
                let text: String
                if !key.isEmpty && [401, 403].contains(response.statusCode) { text = "Tavily отклонил API-ключ. Проверьте или замените его в настройках поиска." }
                else if !key.isEmpty && response.statusCode == 429 { text = "Слишком много запросов к Tavily. Поиск остановлен; попробуйте позже." }
                else if [402, 429, 432, 433].contains(response.statusCode) { text = "Достигнут лимит бесплатного поиска. Попробуйте позже. Платный поиск не включён." }
                else { text = "Tavily временно недоступен. Попробуйте позже." }
                completion(.failure(failure(text))); return
            }
            guard let data, data.count <= (path == "usage" ? 32000 : 2_000_000), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(.failure(failure("Не удалось прочитать ответ Tavily"))); return
            }
            completion(.success(value))
        }.resume()
    }
}
