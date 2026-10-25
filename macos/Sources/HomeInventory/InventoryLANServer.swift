import Foundation
import Network
import CoreImage
import ImageIO
import Darwin

/// Optional HTTP access on the home network. All requests and native saves share
/// the app's storage queue and InventoryStore's optimistic revision check.
final class InventoryLANServer: @unchecked Sendable {
    private let queue: DispatchQueue
    private let store: InventoryStore
    private let root: URL
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private var pairingKey = ""
    private var sessions: [String: Date] = [:]
    private var state = "off"
    private var failure = ""
    var onStatus: (([String: Any]) -> Void)?
    var onRemoteSave: (() -> Void)?
    private static let maxBody = 101 * 1024 * 1024
    private static func secret() -> String { (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "").lowercased() }

    init(store: InventoryStore, root: URL, queue: DispatchQueue) {
        self.store = store; self.root = root.resolvingSymlinksInPath(); self.queue = queue
    }

    func start() { queue.async { self.startOnQueue() } }
    func stop() { queue.async { self.stopOnQueue(); self.publish() } }
    func refresh() { queue.async { self.publish() } }
    func renew() { queue.async {
        guard self.listener != nil else { return }
        self.pairingKey = Self.secret(); self.sessions.removeAll()
        for connection in self.connections.values { connection.cancel() }
        self.connections.removeAll(); self.publish()
    } }

    private func startOnQueue() {
        guard listener == nil else { publish(); return }
        guard FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            state = "error"; failure = "Не найдены файлы интерфейса. Пересоберите приложение."; publish(); return
        }
        do {
            let server = try NWListener(using: .tcp)
            pairingKey = Self.secret(); sessions.removeAll(); failure = ""; state = "starting"
            listener = server
            server.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            server.stateUpdateHandler = { [weak self, weak server] value in
                guard let self, let server, self.listener === server else { return }
                switch value {
                case .ready: self.state = "ready"; self.publish()
                case .failed(let error):
                    self.stopOnQueue(); self.state = "error"; self.failure = error.localizedDescription; self.publish()
                default: break
                }
            }
            server.start(queue: queue); publish()
        } catch { state = "error"; failure = error.localizedDescription; publish() }
    }

    private func stopOnQueue() {
        let old = listener; listener = nil; old?.cancel()
        for connection in connections.values { connection.cancel() }
        connections.removeAll(); sessions.removeAll(); pairingKey = ""; state = "off"; failure = ""
    }

    private func publish() {
        var links: [[String: Any]] = []
        if state == "ready", let port = listener?.port?.rawValue {
            for address in Self.localAddresses() {
                let url = "http://\(address):\(port)/#pair=\(pairingKey)"
                var link: [String: Any] = ["address": address, "url": url]
                if let png = Self.qrPNG(url) { link["qr"] = "data:image/png;base64," + png.base64EncodedString() }
                links.append(link)
            }
        }
        onStatus?(["state": state, "enabled": listener != nil, "links": links, "error": failure,
                   "port": Int(listener?.port?.rawValue ?? 0)])
    }

    static func localAddresses() -> [String] {
        var list: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&list) == 0 else { return [] }
        defer { freeifaddrs(list) }
        var addresses: [(String, String)] = []
        var current = list
        while let entry = current {
            defer { current = entry.pointee.ifa_next }
            guard let socket = entry.pointee.ifa_addr, socket.pointee.sa_family == UInt8(AF_INET),
                  entry.pointee.ifa_flags & UInt32(IFF_UP) != 0,
                  entry.pointee.ifa_flags & UInt32(IFF_LOOPBACK) == 0 else { continue }
            let name = String(cString: entry.pointee.ifa_name)
            // Physical Wi-Fi / Ethernet only; VPN and public interfaces aren't advertised.
            guard name.hasPrefix("en") || name.hasPrefix("bridge") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(socket, socklen_t(socket.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                let address = String(cString: host)
                if isLocalAddress(address) { addresses.append((name, address)) }
            }
        }
        return addresses.sorted { $0.0 < $1.0 }.map { $0.1 }.reduce(into: []) { if !$0.contains($1) { $0.append($1) } }
    }

    static func isLocalAddress(_ raw: String) -> Bool {
        let value = raw.components(separatedBy: "%")[0]
        let segments = value.split(separator: ".", omittingEmptySubsequences: false)
        let parts = segments.compactMap { UInt8($0) }
        if segments.count == 4, parts.count == 4, segments.allSatisfy({ !$0.isEmpty && $0.allSatisfy { $0.isASCII && $0.isNumber } }) {
            return parts[0] == 10 || parts[0] == 127 || parts[0] == 192 && parts[1] == 168
                || parts[0] == 172 && (16...31).contains(parts[1]) || parts[0] == 169 && parts[1] == 254
        }
        var address = in6_addr()
        guard value.withCString({ inet_pton(AF_INET6, $0, &address) }) == 1 else { return false }
        let bytes = withUnsafeBytes(of: address) { Array($0) }
        if bytes.prefix(12) == [0,0,0,0,0,0,0,0,0,0,255,255] {
            return isLocalAddress(bytes.suffix(4).map(String.init).joined(separator: "."))
        }
        return value == "::1" || bytes[0] & 0xfe == 0xfc || bytes[0] == 0xfe && bytes[1] & 0xc0 == 0x80
    }

    static func qrPNG(_ text: String) -> Data? {
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(Data(text.utf8), forKey: "inputMessage"); filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let image = CIContext().createCGImage(output, from: output.extent) else { return nil }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.png" as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    private func accept(_ connection: NWConnection) {
        guard listener != nil, connections.count < 16,
              case .hostPort(let host, _) = connection.endpoint, Self.isLocalAddress(String(describing: host)) else {
            connection.cancel(); return
        }
        let key = ObjectIdentifier(connection); connections[key] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] value in
            if case .failed = value { connection?.cancel(); self?.connections.removeValue(forKey: key) }
            if case .cancelled = value { self?.connections.removeValue(forKey: key) }
        }
        connection.start(queue: queue)
        let timeout = DispatchWorkItem { [weak connection] in connection?.cancel() }
        queue.asyncAfter(deadline: .now() + 60, execute: timeout)
        receive(connection, buffer: Data(), timeout: timeout)
    }

    private func receive(_ connection: NWConnection, buffer: Data, timeout: DispatchWorkItem) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] chunk, _, complete, error in
            guard let self, self.listener != nil, self.connections[ObjectIdentifier(connection)] != nil else { timeout.cancel(); connection.cancel(); return }
            var data = buffer; if let chunk { data.append(chunk) }
            do {
                if let request = try LANRequest.parse(data, maxBody: Self.maxBody) {
                    timeout.cancel()
                    if let response = self.handle(request, connection: connection) { self.respond(connection, response) }; return
                }
                if complete || error != nil { timeout.cancel(); connection.cancel(); return }
                self.receive(connection, buffer: data, timeout: timeout)
            } catch {
                timeout.cancel(); self.respond(connection, LANResponse.json(400, ["error": "Некорректный запрос или слишком большой файл"]))
            }
        }
    }

    private func respond(_ connection: NWConnection, _ response: LANResponse) {
        connection.send(content: response.encoded(), completion: .contentProcessed { _ in connection.cancel() })
    }

    private func handle(_ request: LANRequest, connection: NWConnection) -> LANResponse? {
        guard let host = request.headers["host"], let components = URLComponents(string: "http://" + host),
              components.host != nil, components.user == nil, components.password == nil,
              components.path.isEmpty, components.query == nil, components.fragment == nil,
              components.port == Int(listener?.port?.rawValue ?? 0),
              Self.isLocalAddress(components.host ?? "") || components.host == "localhost" else {
            return .json(403, ["error": "Откройте ссылку подключения с Mac"])
        }
        let path = request.path
        if path.hasPrefix("/api/") {
            if request.method == "POST" {
                guard request.headers["origin"] == "http://" + host,
                      request.headers["x-life-assistant"] == "1",
                      request.headers["content-type"]?.lowercased().hasPrefix("application/json") == true else {
                    return .json(403, ["error": "Откройте приложение по QR-коду"])
                }
            }
            sessions = sessions.filter { $0.value > Date() }
            if path == "/api/pair", request.method == "POST" {
                guard request.body.count < 1024, let body = try? JSONSerialization.jsonObject(with: request.body) as? [String: Any],
                      let key = body["key"] as? String, !pairingKey.isEmpty, key == pairingKey else {
                    return .json(401, ["error": "Ссылка больше не действует. Отсканируйте новый QR-код на Mac."])
                }
                guard sessions.count < 32 else { return .json(429, ["error": "Слишком много подключений. Обновите QR-код на Mac."]) }
                let token = Self.secret(); sessions[token] = Date().addingTimeInterval(24 * 3600)
                return .json(200, ["ok": true], headers: ["Set-Cookie": "la_session=\(token); HttpOnly; SameSite=Strict; Path=/; Max-Age=86400"])
            }
            let cookies = (request.headers["cookie"] ?? "").split(separator: ";").map { $0.trimmingCharacters(in: .whitespaces) }
            let token = cookies.first(where: { $0.hasPrefix("la_session=") }).map { String($0.dropFirst(11)) } ?? ""
            guard sessions[token] != nil else { return .json(401, ["error": "Подключение завершено. Отсканируйте QR-код на Mac."]) }
            if path == "/api/item-master/page", request.method == "POST" {
                guard request.body.count < 8192,
                      let body = try? JSONSerialization.jsonObject(with: request.body) as? [String: Any],
                      let url = body["url"] as? String else { return .json(400, ["error": "Нужна ссылка на товар"]) }
                ItemMasterHTTP.fetch(url) { [weak self, weak connection] result in
                    guard let self, let connection else { return }
                    self.queue.async {
                        guard self.listener != nil, self.sessions[token] != nil else { connection.cancel(); return }
                        switch result {
                        case .success(let value): self.respond(connection, .json(200, value))
                        case .failure(let error): self.respond(connection, .json(502, ["error": error.localizedDescription]))
                        }
                    }
                }
                return nil
            }
            if path == "/api/state", request.method == "GET" {
                guard let document = store.document else { return .json(503, ["error": "Сначала откройте квартиру на Mac"]) }
                let revision = document["revision"] as? Int ?? 0
                if request.query["revision"] == String(revision) { return .json(200, ["revision": revision]) }
                return .json(200, ["revision": revision, "document": document])
            }
            if path == "/api/save", request.method == "POST" {
                do {
                    guard let body = try JSONSerialization.jsonObject(with: request.body) as? [String: Any],
                          let document = body["document"] as? [String: Any],
                          let expected = body["expectedRevision"] as? Int, expected >= 0, expected < Int.max,
                          let revision = document["revision"] as? Int, revision == expected + 1 else {
                        return .json(400, ["error": "Некорректная версия данных"])
                    }
                    guard expected == store.revision else { return .json(409, ["error": "Данные изменились на другом устройстве. Обновите их перед сохранением."]) }
                    try store.save(document, expected: expected, restoring: body["restore"] as? Bool ?? false)
                    onRemoteSave?()
                    return .json(200, ["ok": true, "revision": store.revision])
                } catch { return .json(400, ["error": error.localizedDescription]) }
            }
            return .json(404, ["error": "Неизвестное действие"])
        }
        guard request.method == "GET" || request.method == "HEAD" else { return .json(405, ["error": "Метод не поддерживается"]) }
        let relative = path == "/" ? "index.html" : String(path.dropFirst())
        let file = root.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        // Never expose dotfiles, source maps, directory listings or files outside the web bundle.
        guard !relative.split(separator: "/").contains(where: { $0.hasPrefix(".") }),
              file.path.hasPrefix(root.path + "/"),
              let type = Self.mime[file.pathExtension.lowercased()],
              var data = try? Data(contentsOf: file) else { return .json(404, ["error": "Страница не найдена"]) }
        if file.lastPathComponent == "index.html", let html = String(data: data, encoding: .utf8) {
            data = Data(html.replacingOccurrences(of: "<head>", with: "<head><script>window.__HOUSE_LAN__=true;</script>").utf8)
        }
        return LANResponse(status: 200, body: request.method == "HEAD" ? Data() : data,
                           headers: ["Content-Type": type, "Content-Length": String(data.count)])
    }

    private static let mime = ["html":"text/html; charset=utf-8", "js":"text/javascript; charset=utf-8",
        "css":"text/css; charset=utf-8", "json":"application/json; charset=utf-8", "svg":"image/svg+xml",
        "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "avif":"image/avif",
        "woff":"font/woff", "woff2":"font/woff2", "ico":"image/x-icon", "glb":"model/gltf-binary"]
}

struct LANRequest {
    let method: String
    let path: String
    let query: [String: String]
    let headers: [String: String]
    let body: Data
    static func parse(_ data: Data, maxBody: Int) throws -> LANRequest? {
        guard let end = data.range(of: Data("\r\n\r\n".utf8)) else {
            if data.count > 16384 { throw InventoryError.message("Слишком длинный заголовок") }; return nil
        }
        guard end.lowerBound <= 16384, let text = String(data: data[..<end.lowerBound], encoding: .utf8) else { throw InventoryError.message("Некорректный заголовок") }
        let lines = text.components(separatedBy: "\r\n"), first = lines[0].split(separator: " ")
        guard first.count == 3, first[2] == "HTTP/1.1", first[1].hasPrefix("/"), !first[1].hasPrefix("//"),
              let url = URLComponents(string: String(first[1])), let path = url.percentEncodedPath.removingPercentEncoding,
              !path.contains("\0"), !path.contains("\\") else { throw InventoryError.message("Некорректный адрес") }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { throw InventoryError.message("Некорректный заголовок") }
            let key = line[..<colon].lowercased(), value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            guard !key.isEmpty, !key.contains(where: { $0.isWhitespace }), headers[key] == nil else { throw InventoryError.message("Повторный заголовок") }
            headers[key] = value
        }
        guard headers["transfer-encoding"] == nil else { throw InventoryError.message("Неподдерживаемый запрос") }
        let rawLength = headers["content-length"] ?? "0"
        guard !rawLength.isEmpty, rawLength.allSatisfy({ $0.isASCII && $0.isNumber }), let length = Int(rawLength), length <= maxBody else { throw InventoryError.message("Слишком большой запрос") }
        guard data.count >= end.upperBound + length else { return nil }
        guard data.count == end.upperBound + length else { throw InventoryError.message("Лишние данные запроса") }
        var query: [String: String] = [:]; for item in url.queryItems ?? [] { query[item.name] = item.value }
        return LANRequest(method: String(first[0]), path: path, query: query, headers: headers, body: Data(data[end.upperBound...]))
    }
}

struct LANResponse {
    let status: Int
    let body: Data
    var headers: [String: String] = [:]
    static func json(_ status: Int, _ value: [String: Any], headers: [String: String] = [:]) -> LANResponse {
        var fields = headers; fields["Content-Type"] = "application/json; charset=utf-8"
        return LANResponse(status: status, body: (try? JSONSerialization.data(withJSONObject: value, options: [.withoutEscapingSlashes])) ?? Data(), headers: fields)
    }
    func encoded() -> Data {
        var fields = headers
        fields["Content-Length"] = fields["Content-Length"] ?? String(body.count)
        fields["Connection"] = "close"; fields["Cache-Control"] = "no-store"
        fields["X-Content-Type-Options"] = "nosniff"; fields["Referrer-Policy"] = "no-referrer"
        fields["X-Frame-Options"] = "SAMEORIGIN"
        var result = Data(("HTTP/1.1 \(status) \(status == 200 ? "OK" : "Error")\r\n" + fields.sorted { $0.key < $1.key }.map { "\($0): \($1)" }.joined(separator: "\r\n") + "\r\n\r\n").utf8)
        result.append(body); return result
    }
}
