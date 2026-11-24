import Foundation

enum GameConstants {
    static let minBoardSize = 3
    static let maxBoardSize = 10
    static let tileValueMin = 1
    static let tileValueMax = 6
    static let hintsPerMode = 5
    /// The player's answer to "Contribute to community stats". No value means not asked yet.
    /// Nothing is sent before the answer is yes. Hints do not use it.
    static let analyticsKey = "communityStats.consent"
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
