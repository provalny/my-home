// swiftc InventoryStore.swift InventoryLANServer.swift ItemMasterHTTP.swift test-inventory-lan.swift -o /tmp/life-lan-checks
// Uses a disposable store only. --serve <web-root> <fixture> keeps a QA server alive.
import Foundation
import CoreImage

@main struct LANChecks {
    static func main() throws {
        func check(_ value: Bool, _ message: String = "LAN check failed") { precondition(value, message) }
        let fm = FileManager.default, folder = fm.temporaryDirectory.appendingPathComponent("life-lan-test-\(UUID().uuidString)")
        try fm.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: folder) }
        let serving = CommandLine.arguments.count == 4 && CommandLine.arguments[1] == "--serve"
        let root = serving ? URL(fileURLWithPath: CommandLine.arguments[2]) : folder.appendingPathComponent("web")
        if !serving {
            try fm.createDirectory(at: root, withIntermediateDirectories: true)
            try Data("<!doctype html><html><head></head><body>Life Assistant</body></html>".utf8).write(to: root.appendingPathComponent("index.html"))
            try Data("hidden".utf8).write(to: folder.appendingPathComponent("private.json"))
            try fm.createSymbolicLink(at: root.appendingPathComponent("leak.json"), withDestinationURL: folder.appendingPathComponent("private.json"))
        }
        let store = try InventoryStore(folder: folder.appendingPathComponent("data"))
        let sample: [String: Any] = serving ? try InventoryStore.decode(Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]))) :
            ["format":"my-home-inventory","version":1,"revision":1,"nodes":[],"categories":[],"events":[],"settings":[:],"plan":["rooms":[]]]
        try store.save(sample, expected: 0, restoring: false)
        let queue = DispatchQueue(label:"life.lan.checks"), server = InventoryLANServer(store:store,root:root,queue:queue)
        let ready = DispatchSemaphore(value:0), statusLock = NSLock()
        var status: [String: Any] = [:]
        server.onStatus = { next in
            if !serving { print("LAN state:", next["state"] ?? "", next["error"] ?? ""); fflush(stdout) }
            statusLock.lock(); status = next; statusLock.unlock()
            if next["state"] as? String == "ready" { ready.signal() }
        }
        server.start()
        check(ready.wait(timeout:.now()+10) == .success,"Listener didn't start")
        statusLock.lock(); let initial = status; statusLock.unlock()
        let port = initial["port"] as! Int, origin = "http://127.0.0.1:\(port)"
        let link = (initial["links"] as? [[String: Any]])?.first?["url"] as? String
        // Tests may run without a physical network. Extract the key from a ready
        // status link when available; a private interface is required for pairing tests.
        guard let link, let key = URLComponents(string:link)?.fragment?.replacingOccurrences(of:"pair=",with:"") else {
            fatalError("Connect this Mac to a private Wi-Fi/Ethernet network before running LAN checks")
        }
        if serving {
            print(String(data:try JSONSerialization.data(withJSONObject:["origin":origin,"link":link,"folder":folder.path]),encoding:.utf8)!)
            fflush(stdout); dispatchMain()
        }
        check(InventoryLANServer.isLocalAddress("192.168.1.5"))
        check(InventoryLANServer.isLocalAddress("172.16.0.2"))
        check(InventoryLANServer.isLocalAddress("::ffff:192.168.1.5"))
        check(!InventoryLANServer.isLocalAddress("8.8.8.8"))
        check(!InventoryLANServer.isLocalAddress("10.0.0.1.evil.test"))
        check(!InventoryLANServer.isLocalAddress("172.32.0.2"))
        check(!InventoryLANServer.isLocalAddress("2001:4860:4860::8888"))
        let qrData = InventoryLANServer.qrPNG(link)!
        let detector = CIDetector(ofType:CIDetectorTypeQRCode,context:CIContext(),options:[CIDetectorAccuracy:CIDetectorAccuracyHigh])!
        let feature = detector.features(in:CIImage(data:qrData)!).first as? CIQRCodeFeature
        check(feature?.messageString == link,"QR code must decode to the exact pairing link")
        let valid = Data("POST /api/pair HTTP/1.1\r\nHost: 127.0.0.1:\(port)\r\nContent-Length: 2\r\n\r\n{}".utf8)
        check(try LANRequest.parse(Data(valid.dropLast()),maxBody:100) == nil)
        check(try LANRequest.parse(valid,maxBody:100)?.body == Data("{}".utf8))
        for text in ["GET / HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n", "POST / HTTP/1.1\r\nContent-Length: -1\r\n\r\n", "POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n", "POST / HTTP/1.1\r\nContent-Length: 101\r\n\r\n"] {
            do { _ = try LANRequest.parse(Data(text.utf8),maxBody:100); fatalError("Invalid HTTP request accepted") } catch {}
        }
        let config = URLSessionConfiguration.ephemeral; config.httpShouldSetCookies = false
        let session = URLSession(configuration:config)
        func request(_ path:String, method:String = "GET", body:[String:Any]? = nil, cookie:String? = nil, originOverride:String? = nil, host:String? = nil) throws -> (Int, Data, HTTPURLResponse) {
            var req = URLRequest(url:URL(string:origin+path)!); req.httpMethod = method; req.timeoutInterval = 10
            if let body {
                req.httpBody = try JSONSerialization.data(withJSONObject:body)
                req.setValue("application/json",forHTTPHeaderField:"Content-Type");req.setValue("1",forHTTPHeaderField:"X-Life-Assistant")
                req.setValue(originOverride ?? origin,forHTTPHeaderField:"Origin")
            }
            if let cookie { req.setValue(cookie,forHTTPHeaderField:"Cookie") }
            if let host { req.setValue(host,forHTTPHeaderField:"Host") }
            let done = DispatchSemaphore(value:0)
            var result: Result<(Int,Data,HTTPURLResponse),Error>!
            session.dataTask(with:req) { data,response,error in
                if let error { result = .failure(error) }
                else if let response = response as? HTTPURLResponse { result = .success((response.statusCode,data ?? Data(),response)) }
                else { result = .failure(InventoryError.message("Missing response")) }
                done.signal()
            }.resume()
            check(done.wait(timeout:.now()+12) == .success)
            return try result.get()
        }
        func code(_ path:String) throws -> Int { try request(path).0 }
        check(try code("/api/state") == 401,"Inventory must require pairing")
        check(try request("/api/item-master/page",method:"POST",body:["url":"https://example.com"]).0 == 401,"Item search must require pairing")
        check(try request("/api/pair",method:"POST",body:["key":"wrong"]).0 == 401)
        check(try request("/api/pair",method:"POST",body:["key":key],originOverride:"http://evil.test").0 == 403)
        let paired = try request("/api/pair",method:"POST",body:["key":key])
        check(paired.0 == 200)
        let cookie = paired.2.value(forHTTPHeaderField:"Set-Cookie")!.components(separatedBy:";")[0]
        check(paired.2.value(forHTTPHeaderField:"Set-Cookie")!.contains("HttpOnly; SameSite=Strict"))
        let loaded = try request("/api/state",cookie:cookie)
        check(try request("/api/item-master/page",method:"POST",body:["url":"https://example.com"],cookie:cookie,originOverride:"http://evil.test").0 == 403,"Item search must check origin")
        check(try request("/api/item-master/page",method:"POST",body:["url":"https://127.0.0.1"],cookie:cookie).0 == 502,"Item search must reject local targets asynchronously")
        check(loaded.0 == 200)
        let payload = try JSONSerialization.jsonObject(with:loaded.1) as! [String:Any]
        check((payload["document"] as? [String:Any])?["revision"] as? Int == 1)
        let unchanged = try request("/api/state?revision=1",cookie:cookie)
        check((try JSONSerialization.jsonObject(with:unchanged.1) as! [String:Any])["document"] == nil)
        var next = sample; next["revision"] = 2; next["settings"] = ["testPhone":true]
        let save: [String:Any] = ["document":next,"expectedRevision":1]
        check(try request("/api/save",method:"POST",body:save,cookie:cookie,originOverride:"http://evil.test").0 == 403)
        check(store.revision == 1)
        check(try request("/api/save",method:"POST",body:save,cookie:cookie).0 == 200)
        check(store.revision == 2,"Phone edits must reach the same store")
        check(try request("/api/save",method:"POST",body:save,cookie:cookie).0 == 409,"A stale phone cannot overwrite newer data")
        var fromMac = next; fromMac["revision"] = 3; try store.save(fromMac,expected:2,restoring:false)
        let changed = try request("/api/state?revision=2",cookie:cookie)
        check((try JSONSerialization.jsonObject(with:changed.1) as! [String:Any])["revision"] as? Int == 3,"Mac edits must be visible to phones")
        var restored = next; restored["revision"] = 4
        check(try request("/api/save",method:"POST",body:["document":restored,"expectedRevision":3,"restore":true],cookie:cookie).0 == 200)
        check(try fm.contentsOfDirectory(atPath:store.folder.path).contains(where:{$0.hasPrefix("before-restore-")}))
        let html = try request("/");check(String(data:html.1,encoding:.utf8)!.contains("window.__HOUSE_LAN__=true"))
        check(try code("/leak.json") == 404,"Symlinks outside the bundle must not be served")
        check(try code("/%2e%2e/private.json") == 404)
        check(try request("/",host:"evil.test:\(port)").0 == 403,"DNS rebinding host must be rejected")
        check(try request("/",host:"10.0.0.1.evil.test:\(port)").0 == 403)
        server.renew(); queue.sync {}
        check(try request("/api/state",cookie:cookie).0 == 401,"Renewing QR revokes sessions")
        check(try request("/api/pair",method:"POST",body:["key":key]).0 == 401,"Old QR must no longer pair")
        server.stop();queue.sync {}
        do { _ = try request("/"); fatalError("Server still accepts connections after stop") } catch {}
        session.invalidateAndCancel()
        print("LAN checks passed: pairing, QR decoding, shared writes, stale revisions, restore copies, origins, paths, revocation and stop")
    }
}
