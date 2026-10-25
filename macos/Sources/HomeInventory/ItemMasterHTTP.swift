import Foundation
import Darwin

/// A bounded public-page reader. No inventory, cookies, credentials or web scripts.
enum ItemMasterHTTP {
    private static let workers = DispatchQueue(label: "life-assistant.item-master", qos: .utility, attributes: .concurrent)
    private static let slots = DispatchSemaphore(value: 3)

    static func fetch(_ raw: String, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        workers.async {
            guard slots.wait(timeout: .now()) == .success else {
                completion(.failure(failure("Дождитесь завершения текущего запроса"))); return
            }
            defer { slots.signal() }
            completion(Result { try read(raw, redirects: 0) })
        }
    }

    static func isPublicIPv4(_ value: String) -> Bool {
        let parts = value.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }) else { return false }
        let a = parts[0], b = parts[1]
        return a > 0 && a < 224 && a != 10 && a != 127
            && !(a == 169 && b == 254) && !(a == 172 && (16...31).contains(b))
            && !(a == 192 && [0, 2, 168].contains(b)) && !(a == 100 && (64...127).contains(b))
            && !(a == 198 && [18, 19, 51].contains(b)) && !(a == 203 && b == 0 && parts[2] == 113)
    }

    private static func failure(_ message: String) -> NSError {
        NSError(domain: "ItemMaster", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func read(_ raw: String, redirects: Int) throws -> [String: Any] {
        guard raw.count <= 4096, let url = URL(string: raw), url.scheme == "https", let host = url.host,
              url.user == nil, url.password == nil, url.port == nil || url.port == 443,
              host.contains("."), !host.contains(":"), !host.hasSuffix(".local"),
              !host.hasSuffix(".internal"), !host.hasSuffix(".localhost"),
              host.range(of: "^[0-9.]+$", options: .regularExpression) == nil else {
            throw failure("Разрешены только общедоступные страницы HTTPS")
        }
        var hints = addrinfo(); hints.ai_family = AF_INET; hints.ai_socktype = SOCK_STREAM
        var addresses: UnsafeMutablePointer<addrinfo>?
        guard getaddrinfo(host, nil, &hints, &addresses) == 0, let first = addresses else {
            throw failure("Нет связи с источником. Проверьте интернет.")
        }
        defer { freeaddrinfo(first) }
        var cursor: UnsafeMutablePointer<addrinfo>? = first, ips: [String] = []
        while let entry = cursor {
            var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(entry.pointee.ai_addr, entry.pointee.ai_addrlen, &buffer, socklen_t(buffer.count), nil, 0, NI_NUMERICHOST) == 0 {
                ips.append(String(cString: buffer))
            }
            cursor = entry.pointee.ai_next
        }
        guard let ip = ips.first, ips.allSatisfy(isPublicIPv4) else { throw failure("Локальные и служебные адреса недоступны") }

        // curl is part of macOS. --resolve pins the validated address while retaining TLS
        // hostname verification. No shell, automatic redirects, proxies or user curl config.
        let process = Process(), output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
        process.arguments = ["--disable", "--silent", "--show-error", "--include", "--noproxy", "*",
            "--proto", "=https", "--max-time", "15", "--connect-timeout", "8", "--max-filesize", "2000000",
            "--resolve", "\(host):443:\(ip)", "--user-agent", "LifeAssistant-ItemMaster/1.0",
            "--header", "Accept: text/html,application/xhtml+xml", "--header", "Accept-Language: ru,en;q=0.8", "--url", url.absoluteString]
        process.standardOutput = output; process.standardError = FileHandle.nullDevice
        try process.run()
        var bytes = Data()
        while let chunk = try output.fileHandleForReading.read(upToCount: 65536), !chunk.isEmpty {
            bytes.append(chunk)
            if bytes.count > 2_020_000 { process.terminate(); process.waitUntilExit(); throw failure("Страница слишком большая для чтения") }
        }
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw failure("Источник не ответил вовремя или страница недоступна") }
        guard let split = bytes.range(of: Data("\r\n\r\n".utf8)),
              let header = String(data: bytes[..<split.lowerBound], encoding: .utf8) else { throw failure("Не удалось прочитать страницу") }
        let lines = header.components(separatedBy: "\r\n")
        let status = Int(lines[0].split(separator: " ").dropFirst().first ?? "0") ?? 0
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            if let colon = line.firstIndex(of: ":") { headers[line[..<colon].lowercased()] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces) }
        }
        if (300...399).contains(status), let location = headers["location"] {
            guard redirects < 3, let next = URL(string: location, relativeTo: url)?.absoluteURL else { throw failure("Слишком много перенаправлений") }
            return try read(next.absoluteString, redirects: redirects + 1)
        }
        guard status == 200 else { throw failure([202, 403, 429].contains(status) ? "Источник временно ограничил запросы. Попробуйте позже или добавьте ссылку на товар." : "Сайт не ответил: \(status)") }
        guard let type = headers["content-type"], type.contains("text/html") || type.contains("application/xhtml+xml") || type.contains("text/plain") else { throw failure("Нужна HTML-страница товара") }
        guard let html = String(data: bytes[split.upperBound...], encoding: .utf8), html.utf8.count <= 2_000_000 else { throw failure("Не удалось прочитать текст страницы") }
        return ["text": html, "url": url.absoluteString]
    }
}
