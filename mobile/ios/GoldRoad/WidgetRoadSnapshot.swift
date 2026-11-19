import Foundation

struct WidgetRoadSnapshot: Codable, Equatable {
    static let kind = "GoldRoadStatus"
    static let storageKey = "goldroad.widgetSnapshot.v1"
    static let empty = Self(streak: 0, streakAfterCutoff: 0, nextRoadAt: nil)

    let streak: Int
    let streakAfterCutoff: Int
    let nextRoadAt: Date?

    static var sharedDefaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "GoldRoadAppGroup") as? String,
              !group.isEmpty else { return nil }
        return UserDefaults(suiteName: group)
    }

    static func load(from defaults: UserDefaults? = sharedDefaults) -> Self {
        guard let data = defaults?.data(forKey: storageKey),
              let snapshot = try? JSONDecoder().decode(Self.self, from: data) else { return .empty }
        return snapshot
    }

    func streak(at date: Date) -> Int {
        if let nextRoadAt, date >= nextRoadAt { return streakAfterCutoff }
        return streak
    }
}
