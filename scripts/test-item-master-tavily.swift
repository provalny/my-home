import Foundation

private final class TestCredentials: ItemMasterCredentialStore {
    var value = ""
    func read() throws -> String { value }
    func write(_ key: String) throws { value = key }
}
@main struct TavilyChecks {
    static func check(_ condition: Bool) { precondition(condition) }
    static func wait(_ operation: (@escaping ItemMasterTavily.Reply) -> Void) throws -> [String: Any] {
        let done = DispatchSemaphore(value: 0); var result: Result<[String: Any], Error>!
        operation { result = $0; done.signal() }
        check(done.wait(timeout: .now() + 5) == .success)
        return try result.get()
    }
    static func authorize(_ c: ItemMasterTavily) throws -> String {
        let done = DispatchSemaphore(value: 0); var result: Result<String, Error>!
        c.authorize { result = $0; done.signal() }
        check(done.wait(timeout: .now() + 5) == .success)
        return try result.get()
    }
    static func main() throws {
        let fakeKey = "tvly-test-connection-placeholder", store = TestCredentials()
        var reads = 0, reject = false
        let usage: [String: Any] = ["account": ["current_plan": "Researcher", "plan_limit": 1000, "plan_usage": 998, "paygo_usage": 0, "paygo_limit": NSNull()], "key": ["limit": NSNull(), "usage": 0]]
        let c = ItemMasterTavily(store: store) { path, key, body, completion in
            check(path == "usage" && body == nil && key.hasPrefix("tvly-")); reads += 1
            completion(reject ? .failure(ItemMasterTavily.failure("Invalid test key")) : .success(usage))
        }
        let initial = try wait { c.connection(action: "status", completion: $0) }
        check(initial["connected"] as? Bool == false)
        let connected = try wait { c.connection(action: "connect", apiKey: fakeKey, completion: $0) }
        check(connected["connected"] as? Bool == true && store.value == fakeKey)
        let encoded = String(data: try JSONSerialization.data(withJSONObject: connected), encoding: .utf8)!
        check(!encoded.contains(fakeKey))
        check(try authorize(c) == fakeKey); check(reads == 1)
        reject = true
        do { _ = try wait { c.connection(action: "connect", apiKey: fakeKey + "wrong", completion: $0) }; preconditionFailure("Rejected key was saved") } catch { }
        check(store.value == fakeKey); check(try authorize(c) == fakeKey)
        do { _ = try authorize(c); preconditionFailure("Free budget exceeded") } catch { }
        reject = false
        _ = try wait { c.connection(action: "check", completion: $0) }
        _ = try wait { c.connection(action: "disconnect", completion: $0) }
        let disconnected = try authorize(c); check(store.value.isEmpty && disconnected.isEmpty)
        var paid = usage
        paid["account"] = ["current_plan": "Bootstrap", "plan_limit": 15000, "plan_usage": 0, "paygo_limit": 0]
        do { _ = try ItemMasterTavily.freeUsage(paid); preconditionFailure("Paid plan accepted") } catch { }
        var capped = usage; capped["key"] = ["limit": 0, "usage": 0]
        check(try ItemMasterTavily.freeUsage(capped)["remaining"] == 0)
        if CommandLine.arguments.contains("--live-invalid") {
            let live = ItemMasterTavily(store: TestCredentials())
            let done = DispatchSemaphore(value: 0)
            live.connection(action: "connect", apiKey: fakeKey) { result in
                switch result {
                case .success: preconditionFailure("Fake API key unexpectedly accepted")
                case .failure(let error): check(error.localizedDescription.contains("отклонил API-ключ"))
                }
                done.signal()
            }
            check(done.wait(timeout: .now() + 25) == .success)
            print("Live Tavily authentication correctly rejected a deliberately invalid test key")
        }
        print("Native Tavily checks passed: connect, sanitized status, failed replacement, free budget, cache, refresh, disconnect and paid-plan rejection. No Keychain records accessed.")
    }
}
