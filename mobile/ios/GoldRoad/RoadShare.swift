import Foundation

struct RoadResult {
    enum Medal: Int {
        case gold = 1, silver, bronze

        static func forAttempt(_ attempts: Int, solved: Bool) -> Self? {
            solved ? Self(rawValue: attempts) : nil
        }

        var name: String {
            switch self {
            case .gold: "Gold"
            case .silver: "Silver"
            case .bronze: "Bronze"
            }
        }

        var emoji: String {
            switch self {
            case .gold: "🥇"
            case .silver: "🥈"
            case .bronze: "🥉"
            }
        }
    }

    let gameNo: Int
    let mode: RoadMode
    let attempts: Int
    let elapsed: TimeInterval?
    let hintsUsed: Int

    private var modeResult: RoadShare.ModeResult {
        .init(attempts: attempts, solved: true,
              solveTimeMs: elapsed.flatMap { $0.isFinite ? Int(($0 * 1000).rounded()) : nil })
    }

    private var single: RoadShare.Single {
        .init(gameNo: gameNo, puzzleType: mode, attempts: attempts, solved: true,
              solveTimeMs: modeResult.solveTimeMs, hintsUsed: hintsUsed)
    }

    var resultLabel: String { RoadShare.resultLabel(attempts: attempts, solved: true) }
    var timeLabel: String? { modeResult.solveTimeMs.map(RoadShare.duration) }
    var shareText: String { RoadShare.single(single).text }
    var archiveShareText: String { RoadShare.single(single, archive: true).text }

    func dayShareText(with classic: RoadResult) -> String {
        RoadShare.day(.init(gameNo: gameNo, classic: classic.modeResult, expedition: modeResult)).text
    }
}

enum RoadShare {
    struct Payload: Decodable, Equatable { let title: String; let text: String; let url: String }
    struct Single: Decodable {
        let gameNo: Int
        let puzzleType: RoadMode
        let attempts: Int
        let solved: Bool
        let solveTimeMs: Int?
        let hintsUsed: Int
    }
    struct ModeResult: Decodable {
        let attempts: Int
        let solved: Bool
        let solveTimeMs: Int?
    }
    struct Day: Decodable {
        let gameNo: Int
        let classic: ModeResult?
        let expedition: ModeResult?
    }

    private static let site = "https://playgoldroad.com"

    static func single(_ input: Single, archive: Bool = false) -> Payload {
        let title = "GoldRoad Day #\(input.gameNo) · \(input.puzzleType.title)"
        let url = archive ? "\(site)/games/\(input.gameNo)" : "\(site)/"
        var lines = [title, trail(attempts: input.attempts, solved: input.solved),
                     resultLabel(attempts: input.attempts, solved: input.solved)]
        if input.solved, let time = input.solveTimeMs { lines.append("Solve time: \(duration(time))") }
        if input.hintsUsed > 0 { lines.append("Hints used: \(input.hintsUsed)") }
        lines.append(archive ? "Walk this past road:" : "Walk today’s road:")
        lines.append(url)
        return Payload(title: title, text: lines.joined(separator: "\n"), url: url)
    }

    static func day(_ input: Day) -> Payload {
        let title = "GoldRoad Day #\(input.gameNo) · Full day"
        let url = "\(site)/"
        return Payload(title: title, text: [
            title, dayLine(.classic, input.classic), dayLine(.expedition, input.expedition),
            "Walk today’s road:", url,
        ].joined(separator: "\n"), url: url)
    }

    static func duration(_ milliseconds: Int) -> String {
        let seconds = Int((Double(max(0, milliseconds)) / 1000).rounded())
        let minutes = seconds / 60
        return minutes > 0 ? "\(minutes)m \(String(format: "%02d", seconds % 60))s" : "\(seconds)s"
    }

    static func resultLabel(attempts: Int, solved: Bool) -> String {
        let tries = "\(attempts) \(attempts == 1 ? "try" : "tries")"
        if let medal = RoadResult.Medal.forAttempt(attempts, solved: solved) {
            return "\(medal.emoji) \(medal.name) in \(tries)"
        }
        return solved ? "😅 Solved in \(tries)" : "Still chasing the solve after \(tries)"
    }

    private static func trail(attempts: Int, solved: Bool) -> String {
        let visible = min(max(attempts, 1), 8)
        return String(repeating: "🟫", count: solved ? visible - 1 : visible)
            + (solved ? "🟩" : "") + (attempts > visible ? " +\(attempts - visible)" : "")
    }

    private static func dayLine(_ mode: RoadMode, _ result: ModeResult?) -> String {
        guard let result else { return "\(mode.title): not played" }
        let base = "\(mode.title): \(trail(attempts: result.attempts, solved: result.solved)) \(resultLabel(attempts: result.attempts, solved: result.solved))"
        if result.solved, let time = result.solveTimeMs { return base + " · \(duration(time))" }
        return base
    }
}
