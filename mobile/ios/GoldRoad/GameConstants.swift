import Foundation

enum GameConstants {
    static let minBoardSize = 3
    static let maxBoardSize = 10
    static let tileValueMin = 1
    static let tileValueMax = 6
    static let hintsPerMode = 5
    /// Settings switch for anonymous play stats. On by default. Hints do not use it.
    static let analyticsKey = "shareAnonymousStats"
    static let hapticsKey = "hapticsEnabled"

    static let feedbackURL: URL? = {
        struct Contact: Decodable { let feedbackMailto: URL }
        guard let file = Bundle.main.url(forResource: "constants", withExtension: "json"),
              let data = try? Data(contentsOf: file),
              let contact = try? JSONDecoder().decode(Contact.self, from: data),
              contact.feedbackMailto.scheme == "mailto" else { return nil }
        return contact.feedbackMailto
    }()
}
