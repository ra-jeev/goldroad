import Foundation
import WidgetKit

enum RoadWidgetPublisher {
    private static let scheduleKey = "goldroad.widgetSchedule.v1"

    private struct Schedule: Codable, Equatable {
        let gameNo: Int
        let nextRoadAt: Date?

        init(_ road: ClassicRoad) {
            gameNo = road.gameNo
            nextRoadAt = road.cutoff
        }
    }

    static func remember(_ road: ClassicRoad?, defaults: UserDefaults = .standard) {
        guard let road else { return }
        let previous = schedule(in: defaults)
        let next = Schedule(road)
        guard next != previous, next.gameNo >= (previous?.gameNo ?? 0),
              let data = try? JSONEncoder().encode(next) else { return }
        defaults.set(data, forKey: scheduleKey)
        refresh(defaults: defaults)
    }

    static func refresh(defaults: UserDefaults = .standard) {
        guard let shared = WidgetRoadSnapshot.sharedDefaults else { return }
        let schedule = schedule(in: defaults)
        let history = defaults.data(forKey: DailyRoadRecord.storageKey)
            .flatMap { try? JSONDecoder().decode([DailyRoadRecord].self, from: $0) } ?? []
        let today = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let snapshot = snapshot(for: history, currentGameNo: schedule?.gameNo,
                                nextRoadAt: schedule?.nextRoadAt, today: today)
        guard snapshot != WidgetRoadSnapshot.load(from: shared),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        shared.set(data, forKey: WidgetRoadSnapshot.storageKey)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetRoadSnapshot.kind)
    }

    private static func schedule(in defaults: UserDefaults) -> Schedule? {
        if let data = defaults.data(forKey: scheduleKey),
           let saved = try? JSONDecoder().decode(Schedule.self, from: data) {
            return saved
        }
        // A build that predates the widget may already have a daily snapshot.
        guard let data = defaults.data(forKey: "classicRun.v1"),
              let saved = try? JSONDecoder().decode(RoadRun.Snapshot.self, from: data) else { return nil }
        return Schedule(saved.road)
    }

    static func snapshot(for history: [DailyRoadRecord], currentGameNo: Int?,
                         nextRoadAt: Date?, today: String) -> WidgetRoadSnapshot {
        let entries = history.map(\.statsEntry)
        let streak = RoadStats.summary(entries, mode: .classic, currentGameNo: currentGameNo,
                                       todayKey: today).currentStreak
        let afterRollover = currentGameNo.map { gameNo in
            RoadStats.summary(entries, mode: .classic, currentGameNo: gameNo + 1,
                              todayKey: today).currentStreak
        } ?? streak
        return WidgetRoadSnapshot(streak: streak, streakAfterCutoff: afterRollover, nextRoadAt: nextRoadAt)
    }
}
