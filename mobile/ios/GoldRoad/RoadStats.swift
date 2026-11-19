import Foundation

enum RoadStats {
    struct Entry: Decodable {
        let day: String
        let gameNo: Int
        let puzzleType: RoadMode
        let attempts: Int
        let solved: Bool
        let hintsUsed: Int
        let solveTimeMs: Int?
    }

    struct MedalCounts: Decodable, Equatable {
        var gold = 0
        var silver = 0
        var bronze = 0

        subscript(medal: RoadResult.Medal) -> Int {
            switch medal {
            case .gold: gold
            case .silver: silver
            case .bronze: bronze
            }
        }
    }

    struct Summary: Decodable, Equatable {
        let puzzleType: RoadMode
        let sessionsPlayed: Int
        let exactSolves: Int
        let solveRate: Int
        let totalHints: Int
        let averageSolvedAttempts: String
        let averageSolveTimeMs: Int?
        let bestSolveTimeMs: Int?
        let currentStreak: Int
        let bestStreak: Int
        let medalCounts: MedalCounts
    }

    static func summary(_ entries: [Entry], mode: RoadMode, currentGameNo: Int?, todayKey: String) -> Summary {
        let active = entries.filter { $0.puzzleType == mode && ($0.attempts > 0 || $0.hintsUsed > 0) }
        let solved = active.filter(\.solved)
        let times = solved.compactMap(\.solveTimeMs)
        let streak = streaks(solved, currentGameNo: currentGameNo, todayKey: todayKey)
        return Summary(
            puzzleType: mode, sessionsPlayed: active.count, exactSolves: solved.count,
            solveRate: active.isEmpty ? 0 : percentage(solved.count, of: active.count),
            totalHints: active.reduce(0) { $0 + $1.hintsUsed },
            averageSolvedAttempts: averageAttempts(solved),
            averageSolveTimeMs: times.isEmpty ? nil : Int((Double(times.reduce(0, +)) / Double(times.count)).rounded()),
            bestSolveTimeMs: times.min(), currentStreak: streak.current, bestStreak: streak.best,
            medalCounts: medalCounts(solved)
        )
    }

    static func medalCounts(_ entries: [Entry]) -> MedalCounts {
        entries.reduce(into: MedalCounts()) { counts, entry in
            switch RoadResult.Medal.forAttempt(entry.attempts, solved: entry.solved) {
            case .gold: counts.gold += 1
            case .silver: counts.silver += 1
            case .bronze: counts.bronze += 1
            case nil: break
            }
        }
    }

    static func topPercent(plays: Int, solvedAttemptsExact: [String: Int], attempts: Int) -> Int {
        guard attempts > 0, plays > 0 else { return 0 }
        let atOrBetter = solvedAttemptsExact.reduce(0) { total, item in
            total + ((Int(item.key) ?? Int.max) <= attempts ? item.value : 0)
        }
        return max(1, percentage(atOrBetter, of: plays))
    }

    private static func percentage(_ value: Int, of total: Int) -> Int {
        min(100, max(0, Int((Double(value) / Double(total) * 100).rounded())))
    }

    private static func averageAttempts(_ solved: [Entry]) -> String {
        guard !solved.isEmpty else { return "–" }
        let mean = Double(solved.reduce(0) { $0 + $1.attempts }) / Double(solved.count)
        // Decimal ties that a Double represents exactly end in .25 or .75.
        // JS toFixed rounds these up, while printf uses half-even.
        let quarter = mean * 4
        let value = quarter.truncatingRemainder(dividingBy: 2) == 1 ? mean.nextUp : mean
        let formatted = String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), value)
        return formatted.hasSuffix(".0") ? String(formatted.dropLast(2)) : formatted
    }

    private static func streaks(_ solved: [Entry], currentGameNo: Int?, todayKey: String) -> (current: Int, best: Int) {
        var byGame: [Int: Entry] = [:]
        for entry in solved { byGame[entry.gameNo] = entry }
        let games = byGame.keys.sorted()
        var best = 0
        var last = 0
        var previous: Int?
        for game in games {
            last = previous.map { game == $0 + 1 ? last + 1 : 1 } ?? 1
            best = max(best, last)
            previous = game
        }
        guard let latest = games.last, let record = byGame[latest] else { return (0, best) }
        if let currentGameNo {
            return (latest == currentGameNo || latest == currentGameNo - 1 ? last : 0, best)
        }
        let formatter = ISO8601DateFormatter()
        let today = formatter.date(from: todayKey + "T00:00:00Z")
        let completed = formatter.date(from: record.day + "T00:00:00Z")
        let recent = completed != nil && (completed == today || completed == today?.addingTimeInterval(-86400))
        return (recent ? last : 0, best)
    }
}
