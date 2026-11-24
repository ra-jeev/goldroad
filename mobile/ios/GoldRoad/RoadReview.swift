import Foundation

/// When to ask for an App Store rating. iOS decides whether the prompt shows
/// (at most 3 times a year), so the app only picks a good moment: the player
/// just closed a solved road, has solved a few daily roads, and was not asked
/// in this version yet.
enum RoadReview {
    static let askedVersionKey = "review.askedVersion"
    static let minimumSolvedRoads = 3

    static func shouldAsk(defaults: UserDefaults = .standard,
                          version: String = installedVersion) -> Bool {
        guard !ScreenshotMode.isOn, defaults.string(forKey: askedVersionKey) != version,
              let data = defaults.data(forKey: DailyRoadRecord.storageKey), !data.isEmpty,
              let history = try? JSONDecoder().decode([DailyRoadRecord].self, from: data) else { return false }
        let solvedRoads = Set(history.filter(\.solved).map(\.gameNo))
        return solvedRoads.count >= minimumSolvedRoads
    }

    static func markAsked(defaults: UserDefaults = .standard, version: String = installedVersion) {
        defaults.set(version, forKey: askedVersionKey)
    }

    static var installedVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }
}
