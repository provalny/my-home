import Foundation

@main struct ItemMasterHTTPChecks {
    static func main() {
        for address in ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "172.16.0.1", "100.64.0.1", "224.0.0.1", "198.19.1.1"] {
            precondition(!ItemMasterHTTP.isPublicIPv4(address))
        }
        precondition(ItemMasterHTTP.isPublicIPv4("1.1.1.1"))
        for url in ["file:///etc/passwd", "https://127.0.0.1", "https://user:password@example.com", "https://printer.local", "http://example.com"] {
            let done = DispatchSemaphore(value: 0)
            ItemMasterHTTP.fetch(url) { result in
                if case .success = result { preconditionFailure("Unsafe URL accepted") }
                done.signal()
            }
            precondition(done.wait(timeout: .now() + 5) == .success)
        }
        if CommandLine.arguments.contains("--live") {
            let done = DispatchSemaphore(value: 0)
            ItemMasterHTTP.fetch("https://www.ikea.com/us/en/p/kallax-shelf-unit-white-90637303/") { result in
                switch result {
                case .success(let page):
                    precondition((page["text"] as? String)?.contains("KALLAX") == true)
                    print("Native public product page loaded")
                case .failure(let error): preconditionFailure(error.localizedDescription)
                }
                done.signal()
            }
            precondition(done.wait(timeout: .now() + 65) == .success)
        }
        print("Item Master HTTP checks passed")
    }
}
