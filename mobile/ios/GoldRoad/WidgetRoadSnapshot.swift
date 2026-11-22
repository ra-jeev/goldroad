import Foundation

struct WidgetRoadSnapshot: Codable, Equatable {
    static let kind = "GoldRoadStatus"
    static let storageKey = "goldroad.widgetSnapshot.v1"
    static let empty = Self(streak: 0, streakAfterCutoff: 0, nextRoadAt: nil)

    let streak: Int
    let streakAfterCutoff: Int
    let nextRoadAt: Date?
    /// Today's day number and what is solved on it. A new day starts with both unsolved.
    var gameNo: Int? = nil
    var classicSolved = false
    var expeditionSolved = false

    init(streak: Int, streakAfterCutoff: Int, nextRoadAt: Date?,
         gameNo: Int? = nil, classicSolved: Bool = false, expeditionSolved: Bool = false) {
        self.streak = streak
        self.streakAfterCutoff = streakAfterCutoff
        self.nextRoadAt = nextRoadAt
        self.gameNo = gameNo
        self.classicSolved = classicSolved
        self.expeditionSolved = expeditionSolved
    }

    /// Older saved snapshots have no solved fields, so read them as optional.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        streak = try c.decode(Int.self, forKey: .streak)
        streakAfterCutoff = try c.decode(Int.self, forKey: .streakAfterCutoff)
        nextRoadAt = try c.decodeIfPresent(Date.self, forKey: .nextRoadAt)
        gameNo = try c.decodeIfPresent(Int.self, forKey: .gameNo)
        classicSolved = try c.decodeIfPresent(Bool.self, forKey: .classicSolved) ?? false
        expeditionSolved = try c.decodeIfPresent(Bool.self, forKey: .expeditionSolved) ?? false
    }

    struct Day: Equatable {
        let gameNo: Int?
        let classicSolved: Bool
        let expeditionSolved: Bool
    }

    /// What the widget shows for the day at this time. After the cutoff it is the next, unplayed day.
    func day(at date: Date) -> Day {
        if let nextRoadAt, date >= nextRoadAt {
            return Day(gameNo: gameNo.map { $0 + 1 }, classicSolved: false, expeditionSolved: false)
        }
        return Day(gameNo: gameNo, classicSolved: classicSolved, expeditionSolved: expeditionSolved)
    }

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
