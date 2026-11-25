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

    /// Solved roads in one mode where the player used no hints. iOS only for now, so it is not
    /// part of the shared `Summary` contract.
    static func noHintSolves(_ entries: [Entry], mode: RoadMode) -> Int {
        entries.filter { $0.puzzleType == mode && $0.solved && $0.hintsUsed == 0 }.count
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

    /// Where the player stands against the rest of the field, as one sentence. Ties are never
    /// counted as beaten. Players who never finished count as beaten. `alreadyCounted` is true
    /// when the field already holds this player's solve; then they are taken out first.
    /// Returns nil when no one else walked the road. Same rule as the web `fieldStanding`.
    static func fieldStanding(plays: Int, solvedAttemptsExact: [String: Int], attempts: Int,
                              alreadyCounted: Bool) -> String? {
        guard attempts > 0 else { return nil }
        let me = alreadyCounted ? 1 : 0
        let others = plays - me
        guard others > 0 else { return nil }
        var better = 0
        var tied = 0
        for (key, count) in solvedAttemptsExact {
            guard let value = Int(key) else { continue }
            if value < attempts { better += count } else if value == attempts { tied += count }
        }
        tied = max(0, tied - me)
        better = min(better, others)
        tied = min(tied, others - better)
        let worse = others - better - tied
        if better == 0 { return tied == 0 ? "You led the field." : "You matched the best in the field." }
        if worse == 0 { return tied > 0 ? "Nobody in the field needed more." : "The field needed fewer." }
        let percent = min(99, max(1, Int((Double(worse) / Double(others) * 100).rounded())))
        return "You beat \(percent)% of the field."
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
