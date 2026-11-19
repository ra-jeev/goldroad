import Foundation

enum GoldRoadAPI {
    static func url(_ path: String) throws -> URL {
        guard let setting = Bundle.main.object(forInfoDictionaryKey: "GoldRoadAPIBaseURL") as? String,
              let base = URL(string: setting), base.scheme == "https", base.host != nil else {
            throw URLError(.badURL)
        }
        return base.appending(path: path)
    }
}
