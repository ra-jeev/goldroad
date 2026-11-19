import Foundation
import Observation
import UserNotifications

@MainActor
@Observable
final class RoadReminder {
    static let shared = RoadReminder()

    private static let requestID = "goldroad.next-road"
    private static let enabledKey = "dailyReminder.enabled"
    private static let cutoffKey = "dailyReminder.nextGameAt"

    private(set) var enabled: Bool
    private(set) var changing = false
    private(set) var message: String?
    private var nextCutoff: Date?
    private let defaults: UserDefaults
    private let center: UNUserNotificationCenter

    init(defaults: UserDefaults = .standard, center: UNUserNotificationCenter = .current()) {
        self.defaults = defaults
        self.center = center
        enabled = defaults.bool(forKey: Self.enabledKey)
        nextCutoff = defaults.object(forKey: Self.cutoffKey) as? Date
    }

    func setEnabled(_ value: Bool) async {
        guard !changing, value != enabled else { return }
        message = nil
        if !value {
            enabled = false
            defaults.set(false, forKey: Self.enabledKey)
            center.removePendingNotificationRequests(withIdentifiers: [Self.requestID])
            return
        }

        changing = true
        defer { changing = false }
        do {
            guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                message = "Allow notifications in Settings to get daily reminders."
                return
            }
            enabled = true
            defaults.set(true, forKey: Self.enabledKey)
            await schedule()
        } catch {
            message = "Couldn’t turn reminders on. Try again in a moment."
        }
    }

    func rememberCutoff(_ cutoff: Date?) {
        guard let cutoff, cutoff > Date(), cutoff != nextCutoff else { return }
        nextCutoff = cutoff
        defaults.set(cutoff, forKey: Self.cutoffKey)
        if enabled { Task { await schedule() } }
    }

    private func schedule() async {
        guard enabled, let cutoff = nextCutoff,
              let schedule = Self.schedule(for: cutoff, now: Date()) else { return }
        let content = UNMutableNotificationContent()
        content.title = "GoldRoad"
        content.body = "A new daily road is ready."
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(dateMatching: schedule.components, repeats: schedule.repeats)
        do {
            try await center.add(UNNotificationRequest(identifier: Self.requestID, content: content, trigger: trigger))
            if !enabled {
                center.removePendingNotificationRequests(withIdentifiers: [Self.requestID])
            }
        } catch {
            if enabled { message = "Couldn’t schedule the daily reminder." }
        }
    }

    struct Schedule {
        let components: DateComponents
        let repeats: Bool
    }

    static func schedule(for cutoff: Date, now: Date) -> Schedule? {
        guard cutoff > now else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0)!
        let time = utc.dateComponents([.calendar, .timeZone, .hour, .minute, .second], from: cutoff)
        if let next = utc.nextDate(after: now, matching: time, matchingPolicy: .nextTime),
           abs(next.timeIntervalSince(cutoff)) < 1 {
            return Schedule(components: time, repeats: true)
        }
        let date = utc.dateComponents([.calendar, .timeZone, .year, .month, .day, .hour, .minute, .second], from: cutoff)
        return Schedule(components: date, repeats: false)
    }
}
