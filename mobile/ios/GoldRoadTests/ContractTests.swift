import Foundation
import XCTest
@testable import GoldRoad

final class ContractTests: XCTestCase {
    private func data(_ path: String) throws -> Data {
        let bundle = Bundle(for: Self.self)
        let root = try XCTUnwrap(bundle.url(forResource: "contract", withExtension: nil))
        return try Data(contentsOf: root.appendingPathComponent(path))
    }

    private func fixture<T: Decodable>(_ path: String, as type: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(type, from: data("fixtures/\(path).json"))
    }

    private struct Rules: Decodable {
        struct Case: Decodable {
            let name: String
            let road: ClassicRoad?
            let taps: [Int]
            let hintBeforeTap: Int?
            let hintOptimalPaths: [[Int]]?
            let hintResult: ClassicRoadClient.Hint?
            let path: [Int]
            let score: Int
            let legalMoves: [Int]
            let canUndo: Bool
            let outcome: String
        }
        let road: ClassicRoad
        let cases: [Case]
    }

    func testRules() throws {
        let rules: Rules = try fixture("rules")
        for item in rules.cases {
            var run = RoadRun(road: item.road ?? rules.road)
            for (index, tile) in item.taps.enumerated() {
                if item.hintBeforeTap == index {
                    let paths = try XCTUnwrap(item.hintOptimalPaths, item.name)
                    let hint = try XCTUnwrap(RoadHints.compute(optimalPaths: paths, pathHistory: run.path,
                                                               revealedGuide: run.guidePath), item.name)
                    XCTAssertEqual(hint, item.hintResult, item.name)
                    run.applyHint(hint.guidePath)
                }
                run.select(tile)
            }
            XCTAssertEqual(run.path, item.path, item.name)
            XCTAssertEqual(run.score, item.score, item.name)
            XCTAssertEqual(run.legalMoves.sorted(), item.legalMoves, item.name)
            XCTAssertEqual(run.canUndo, item.canUndo, item.name)
            XCTAssertEqual(run.outcome.rawValue, item.outcome, item.name)
            let snapshot = try JSONDecoder().decode(RoadRun.Snapshot.self, from: JSONEncoder().encode(run.snapshot))
            XCTAssertEqual(RoadRun(snapshot: snapshot), run, item.name)
        }
    }

    private struct Hints: Decodable {
        struct Case: Decodable {
            let name: String
            let optimalPaths: [[Int]]
            let pathHistory: [Int]
            let revealedGuide: [Int]
            let expected: ClassicRoadClient.Hint
        }
        struct Sequence: Decodable {
            struct Step: Decodable {
                let hintsUsed: Int
                let guidePath: [Int]
                let result: ClassicRoadClient.Hint?
            }
            let optimalPaths: [[Int]]
            let pathHistory: [Int]
            let requests: Int
            let steps: [Step]
        }
        let cases: [Case]
        let sequence: Sequence
    }

    func testHints() throws {
        let hints: Hints = try fixture("hints")
        for item in hints.cases {
            XCTAssertEqual(RoadHints.compute(optimalPaths: item.optimalPaths, pathHistory: item.pathHistory,
                                             revealedGuide: item.revealedGuide), item.expected, item.name)
        }
        let rules: Rules = try fixture("rules")
        let road = try XCTUnwrap(rules.cases.first { $0.name == "Classic 6x6 exact" }?.road)
        var run = RoadRun(road: road)
        XCTAssertEqual(hints.sequence.requests, hints.sequence.steps.count)
        for step in hints.sequence.steps {
            let result = run.hintsUsed < GameConstants.hintsPerMode
                ? RoadHints.compute(optimalPaths: hints.sequence.optimalPaths, pathHistory: run.path,
                                    revealedGuide: run.guidePath) : nil
            XCTAssertEqual(result, step.result)
            if let result { run.applyHint(result.guidePath) }
            XCTAssertEqual(run.hintsUsed, step.hintsUsed)
            XCTAssertEqual(run.guidePath, step.guidePath)
        }
    }

    private struct HintMessages: Decodable {
        struct Case: Decodable {
            let kind: ClassicRoadClient.Hint.Kind
            let highlightedCount: Int
            let message: String?
        }
        let cases: [Case]
    }

    func testHintMessages() throws {
        let messages: HintMessages = try fixture("hint-messages")
        for item in messages.cases {
            let hint = ClassicRoadClient.Hint(kind: item.kind, guidePath: [])
            XCTAssertEqual(hint.message(highlightedCount: item.highlightedCount), item.message)
        }
    }

    private struct Medals: Decodable {
        struct Case: Decodable { let attempts: Int; let solved: Bool; let medal: String? }
        let cases: [Case]
    }

    func testMedals() throws {
        let medals: Medals = try fixture("medals")
        for item in medals.cases {
            XCTAssertEqual(RoadResult.Medal.forAttempt(item.attempts, solved: item.solved)?.name.lowercased(), item.medal)
        }
    }

    private struct Shares: Decodable {
        struct Single: Decodable { let input: RoadShare.Single; let expected: RoadShare.Payload }
        struct Day: Decodable { let input: RoadShare.Day; let expected: RoadShare.Payload }
        let single: [Single]
        let day: [Day]
    }

    func testShare() throws {
        let shares: Shares = try fixture("share")
        for item in shares.single { XCTAssertEqual(RoadShare.single(item.input), item.expected) }
        for item in shares.day { XCTAssertEqual(RoadShare.day(item.input), item.expected) }
    }

    private struct Stats: Decodable {
        struct Percentile: Decodable {
            struct Field: Decodable { let plays: Int; let solvedAttemptsExact: [String: Int] }
            let field: Field
            let attempts: Int
            let expected: Int
        }
        let history: [RoadStats.Entry]
        let currentGameNo: Int
        let todayKey: String
        let classic: RoadStats.Summary
        let expedition: RoadStats.Summary
        let percentile: [Percentile]
    }

    func testStats() throws {
        let stats: Stats = try fixture("stats")
        XCTAssertEqual(RoadStats.summary(stats.history, mode: .classic, currentGameNo: stats.currentGameNo,
                                         todayKey: stats.todayKey), stats.classic)
        XCTAssertEqual(RoadStats.summary(stats.history, mode: .expedition, currentGameNo: stats.currentGameNo,
                                         todayKey: stats.todayKey), stats.expedition)
        for item in stats.percentile {
            XCTAssertEqual(RoadStats.topPercent(plays: item.field.plays, solvedAttemptsExact: item.field.solvedAttemptsExact,
                                                attempts: item.attempts), item.expected)
        }
    }

    private struct Rollover: Decodable {
        struct Road: Decodable { let gameNo: Int; let nextGameAt: String? }
        struct Case: Decodable { let current: Road?; let fetched: Road?; let now: String; let expected: String }
        let cases: [Case]
    }

    func testRollover() throws {
        let rollover: Rollover = try fixture("rollover")
        let rules: Rules = try fixture("rules")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for item in rollover.cases {
            func road(_ schedule: Rollover.Road?) -> ClassicRoad? {
                schedule.map { ClassicRoad(gameNo: $0.gameNo, maxScore: rules.road.maxScore,
                                           playableAt: rules.road.playableAt, board: rules.road.board,
                                           nextGameAt: $0.nextGameAt) }
            }
            let day = ClassicRoadClient.RoadDay(classic: road(item.fetched), expedition: nil)
            let result = day.availability(after: road(item.current), at: try XCTUnwrap(formatter.date(from: item.now)))
            XCTAssertEqual(String(describing: result), item.expected)
        }
    }

    private struct Constants: Decodable {
        struct Medals: Decodable { let GOLD: Int; let SILVER: Int; let BRONZE: Int }
        let HINTS_PER_ROAD_MODE: Int
        let MIN_BOARD_SIZE: Int
        let MAX_BOARD_SIZE: Int
        let TILE_VALUE_MIN: Int
        let TILE_VALUE_MAX: Int
        let MEDAL_ATTEMPTS: Medals
    }

    func testConstants() throws {
        let values = try JSONDecoder().decode(Constants.self, from: data("constants.json"))
        XCTAssertEqual(GameConstants.hintsPerMode, values.HINTS_PER_ROAD_MODE)
        XCTAssertEqual(GameConstants.minBoardSize, values.MIN_BOARD_SIZE)
        XCTAssertEqual(GameConstants.maxBoardSize, values.MAX_BOARD_SIZE)
        XCTAssertEqual(GameConstants.tileValueMin, values.TILE_VALUE_MIN)
        XCTAssertEqual(GameConstants.tileValueMax, values.TILE_VALUE_MAX)
        XCTAssertEqual(RoadResult.Medal.forAttempt(values.MEDAL_ATTEMPTS.GOLD, solved: true)?.name.lowercased(), "gold")
        XCTAssertEqual(RoadResult.Medal.forAttempt(values.MEDAL_ATTEMPTS.SILVER, solved: true)?.name.lowercased(), "silver")
        XCTAssertEqual(RoadResult.Medal.forAttempt(values.MEDAL_ATTEMPTS.BRONZE, solved: true)?.name.lowercased(), "bronze")
    }

    func testAPISamples() throws {
        func decode<T: Decodable>(_ type: T.Type, _ name: String) throws {
            _ = try JSONDecoder().decode(type, from: data("api/samples/\(name).json"))
        }
        try decode(ClassicRoadClient.RoadDay.self, "current-games")
        try decode(ClassicRoadClient.HintRequest.self, "hint-request")
        try decode(ClassicRoadClient.HintResponse.self, "hint-response")
        try decode(ArchiveBoard.self, "archive-board")
        try decode(ArchiveResponse.self, "past-games")
        try decode(RandomArchiveResponse.self, "random-archive")
        try decode(StatsOverview.self, "stats-overview")
        try decode(DailyRoadAnalytics.Start.self, "session-start-request")
        try decode(DailyRoadAnalytics.Solve.self, "session-end-request")
        try decode(DailyRoadAnalytics.StartResponse.self, "session-start-response")
        try decode(DailyRoadAnalytics.EndResponse.self, "session-end-response")
    }
}
