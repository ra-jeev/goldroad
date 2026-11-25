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

    func testArchiveProgressRestoresEachMode() throws {
        let suite = "GoldRoadTests.archive.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let road: Rules = try fixture("rules")
        let store = ArchiveProgress(defaults: defaults)
        var run = RoadRun(road: road.road)
        run.select(1)
        run.applyHint([0, 1, 4])
        run.restart()
        run.select(1)
        store.save(run, mode: .expedition)
        store.selectMode(.expedition, for: run.road.gameNo)

        let reopened = ArchiveProgress(defaults: defaults)
        let expedition = reopened.restore(road.road, mode: .expedition)
        XCTAssertEqual(expedition.path, [0, 1])
        XCTAssertEqual(expedition.attempt, 2)
        XCTAssertEqual(expedition.hintsUsed, 1)
        XCTAssertEqual(expedition.guidePath, [0, 1, 4])
        XCTAssertTrue(expedition.canUndo)
        XCTAssertEqual(reopened.restore(road.road, mode: .classic).path, [0])
        XCTAssertEqual(reopened.selectedMode(for: run.road.gameNo), .expedition)
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
        struct Standing: Decodable {
            struct Field: Decodable { let plays: Int; let solvedAttemptsExact: [String: Int] }
            let field: Field
            let attempts: Int
            let alreadyCounted: Bool
            let expected: String?
        }
        let history: [RoadStats.Entry]
        let currentGameNo: Int
        let todayKey: String
        let classic: RoadStats.Summary
        let expedition: RoadStats.Summary
        let standing: [Standing]
    }

    func testStats() throws {
        let stats: Stats = try fixture("stats")
        XCTAssertEqual(RoadStats.summary(stats.history, mode: .classic, currentGameNo: stats.currentGameNo,
                                         todayKey: stats.todayKey), stats.classic)
        XCTAssertEqual(RoadStats.summary(stats.history, mode: .expedition, currentGameNo: stats.currentGameNo,
                                         todayKey: stats.todayKey), stats.expedition)
        XCTAssertFalse(stats.standing.isEmpty)
        for item in stats.standing {
            XCTAssertEqual(RoadStats.fieldStanding(plays: item.field.plays,
                                                   solvedAttemptsExact: item.field.solvedAttemptsExact,
                                                   attempts: item.attempts, alreadyCounted: item.alreadyCounted),
                           item.expected, "\(item.field.plays) plays, \(item.attempts) tries")
        }
    }

    func testICloudMergeKeepsSolvesAndFewerTriesByMode() {
        func record(_ day: Int, mode: RoadMode, tries: Int, solved: Bool) -> DailyRoadRecord {
            DailyRoadRecord(gameNo: day, playableAt: "2026-11-01T00:00:00Z", mode: mode,
                            attempts: tries, solved: solved, activeSeconds: solved ? 30 : nil, hintsUsed: 0)
        }
        let unfinished = record(1, mode: .classic, tries: 1, solved: false)
        let classic = record(1, mode: .classic, tries: 3, solved: true)
        let expedition = record(1, mode: .expedition, tries: 1, solved: true)
        let slowerExpedition = record(1, mode: .expedition, tries: 2, solved: true)
        let later = record(2, mode: .classic, tries: 1, solved: true)
        let local = [unfinished, expedition, later]
        let remote = [classic, slowerExpedition]
        let merged = RoadHistorySync.mergeHistory(local, remote)
        XCTAssertEqual(merged, [classic, expedition, later])
        XCTAssertEqual(merged, RoadHistorySync.mergeHistory(remote, local))
        XCTAssertEqual(merged, RoadHistorySync.mergeHistory(merged, remote))

        let archive = RoadHistorySync.mergeCompletion(["1": ["classic": true]],
                                                       ["1": ["classic": false, "expedition": true]])
        XCTAssertEqual(archive, ["1": ["classic": true, "expedition": true]])
    }

    func testICloudMergeKeepsNewerUnsolvedProgress() {
        func record(tries: Int, hints: Int) -> DailyRoadRecord {
            DailyRoadRecord(gameNo: 4, playableAt: "2026-11-04T00:00:00Z", mode: .classic,
                            attempts: tries, solved: false, activeSeconds: nil, hintsUsed: hints)
        }
        let older = record(tries: 1, hints: 0)
        let moreTries = record(tries: 3, hints: 0)
        let moreHints = record(tries: 3, hints: 2)
        XCTAssertEqual(RoadHistorySync.mergeHistory([moreTries], [older]), [moreTries])
        XCTAssertEqual(RoadHistorySync.mergeHistory([older], [moreTries]), [moreTries])
        XCTAssertEqual(RoadHistorySync.mergeHistory([moreTries], [moreHints]), [moreHints])
        XCTAssertEqual(RoadHistorySync.mergeHistory([moreHints], [moreTries]), [moreHints])
    }

    func testWidgetSnapshotTracksClassicSolveAtRollover() throws {
        func solve(_ day: Int, _ mode: RoadMode) -> DailyRoadRecord {
            DailyRoadRecord(gameNo: day, playableAt: "2026-11-19T00:00:00Z", mode: mode,
                            attempts: 1, solved: true, activeSeconds: 40, hintsUsed: 0)
        }
        let cutoff = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-20T00:00:00Z"))
        let old = [solve(97, .classic), solve(98, .classic), solve(99, .expedition)]
        let before = RoadWidgetPublisher.snapshot(for: old, currentGameNo: 99,
                                                 nextRoadAt: cutoff, today: "2026-11-19")
        XCTAssertEqual(before.streak(at: cutoff.addingTimeInterval(-1)), 2)
        XCTAssertEqual(before.streak(at: cutoff), 0)

        let solved = RoadWidgetPublisher.snapshot(for: old + [solve(99, .classic)], currentGameNo: 99,
                                                 nextRoadAt: cutoff, today: "2026-11-19")
        XCTAssertEqual(solved.streak(at: cutoff.addingTimeInterval(-1)), 3)
        XCTAssertEqual(solved.streak(at: cutoff), 3)
        XCTAssertEqual(solved.nextRoadAt, cutoff)

        let suite = "GoldRoadTests.widget.\(UUID().uuidString)"
        let group = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { group.removePersistentDomain(forName: suite) }
        XCTAssertEqual(WidgetRoadSnapshot.load(from: group), .empty)
        group.set(try JSONEncoder().encode(solved), forKey: WidgetRoadSnapshot.storageKey)
        XCTAssertEqual(WidgetRoadSnapshot.load(from: group), solved)
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

    func testVersionGuardReadsFloorBeforeTheBoard() throws {
        let invalidBoard = #"{"classic":"new wire shape","minClientVersion":{"ios":"1.10.0","android":"1.0.0"}}"#
        let envelope = try JSONDecoder().decode(ClassicRoadClient.VersionEnvelope.self, from: Data(invalidBoard.utf8))
        XCTAssertTrue(envelope.requiresUpdate(installed: "1.9.9"))
        XCTAssertFalse(envelope.requiresUpdate(installed: "1.10.0"))
        XCTAssertFalse(envelope.requiresUpdate(installed: "2.0.0"))
        let legacy = try JSONDecoder().decode(ClassicRoadClient.RoadDay.self, from: Data(#"{"classic":null,"expedition":null}"#.utf8))
        XCTAssertFalse(legacy.requiresUpdate(installed: "0.1.0"))
    }

    @MainActor
    func testReminderSchedulesFromServerCutoffInUTC() throws {
        let iso = ISO8601DateFormatter()
        let now = try XCTUnwrap(iso.date(from: "2026-11-19T14:00:00Z"))
        let tomorrow = try XCTUnwrap(iso.date(from: "2026-11-20T00:00:00Z"))
        let regular = try XCTUnwrap(RoadReminder.schedule(for: tomorrow, now: now))
        XCTAssertTrue(regular.repeats)
        XCTAssertEqual(regular.components.hour, 0)
        XCTAssertEqual(regular.components.timeZone?.secondsFromGMT(), 0)
        XCTAssertNil(regular.components.day)

        let extended = try XCTUnwrap(iso.date(from: "2026-11-22T00:00:00Z"))
        let oneShot = try XCTUnwrap(RoadReminder.schedule(for: extended, now: now))
        XCTAssertFalse(oneShot.repeats)
        XCTAssertEqual(oneShot.components.day, 22)
        XCTAssertNil(RoadReminder.schedule(for: now, now: now))
    }

    private struct Constants: Decodable {
        struct Medals: Decodable { let GOLD: Int; let SILVER: Int; let BRONZE: Int }
        let HINTS_PER_ROAD_MODE: Int
        let MIN_BOARD_SIZE: Int
        let MAX_BOARD_SIZE: Int
        let TILE_VALUE_MIN: Int
        let TILE_VALUE_MAX: Int
        let MEDAL_ATTEMPTS: Medals
        let feedbackMailto: String
    }

    func testConstants() throws {
        let values = try JSONDecoder().decode(Constants.self, from: data("constants.json"))
        XCTAssertEqual(GameConstants.hintsPerMode, values.HINTS_PER_ROAD_MODE)
        XCTAssertEqual(GameConstants.minBoardSize, values.MIN_BOARD_SIZE)
        XCTAssertEqual(GameConstants.maxBoardSize, values.MAX_BOARD_SIZE)
        XCTAssertEqual(GameConstants.tileValueMin, values.TILE_VALUE_MIN)
        XCTAssertEqual(GameConstants.tileValueMax, values.TILE_VALUE_MAX)
        XCTAssertEqual(GameConstants.feedbackURL?.absoluteString, values.feedbackMailto)
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

private final class SessionRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Data] = [:]
    let received: XCTestExpectation

    init(received: XCTestExpectation) { self.received = received }

    func record(_ request: URLRequest) {
        let body = request.httpBody ?? request.httpBodyStream.flatMap(readBody)
        lock.lock()
        storage[request.url?.path ?? ""] = body
        lock.unlock()
        received.fulfill()
    }

    private func readBody(_ stream: InputStream) -> Data? {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while true {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count < 0 { return nil }
            if count == 0 { return data }
            data.append(contentsOf: buffer.prefix(count))
        }
    }

    func body(for path: String) -> Data? {
        lock.lock()
        defer { lock.unlock() }
        return storage[path]
    }
}

private final class SessionURLProtocol: URLProtocol {
    static var recorder: SessionRequestRecorder?
    /// Delays each response, to test changes made while a request is in flight.
    static var responseDelay: TimeInterval = 0

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.recorder?.record(request)
        let response: String
        switch request.url?.path {
        case "/api/session/start": response = #"{"ok":true,"gameNo":1}"#
        case "/api/session/hint": response = #"{"ok":true,"hint":{"kind":"next-step","nextTileIndex":4,"guidePath":[0,1,4]}}"#
        case "/api/session/end": response = #"{"ok":true,"gameNo":1,"score":17,"solved":true,"medal":"silver"}"#
        default:
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }
        let http = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        let finish = { [self] in
            client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(response.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
        if Self.responseDelay > 0 {
            DispatchQueue.global().asyncAfter(deadline: .now() + Self.responseDelay, execute: finish)
        } else {
            finish()
        }
    }

    override func stopLoading() {}
}

extension ContractTests {
    @MainActor
    func testSessionIdentitySurvivesLegacyMigrationAndRetry() async throws {
        let received = expectation(description: "Start, hint, and solve requests")
        received.expectedFulfillmentCount = 3
        let recorder = SessionRequestRecorder(received: received)
        SessionURLProtocol.recorder = recorder
        defer { SessionURLProtocol.recorder = nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let suite = "GoldRoadTests.sessions.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let analytics = DailyRoadAnalytics(defaults: defaults, session: session)
        let client = ClassicRoadClient(session: session)
        let board = Board(rows: 3, cols: 3, tiles: [2, 3, 1, 1, 4, 2, 1, 1, 5],
                          missingEdges: [.init(from: 0, to: 3), .init(from: 2, to: 5)],
                          tollEdges: [.init(from: 0, to: 1)], bonusEdges: [.init(from: 1, to: 4)],
                          tollValue: 2, bonusValue: 3, start: 0, end: 8)
        let cutoff = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
        let road = ClassicRoad(gameNo: 1, maxScore: 17, playableAt: "2026-01-01T00:00:00Z",
                               board: board, nextGameAt: cutoff)
        var run = RoadRun(road: road)
        run.select(1)

        // Removing the new field reproduces a snapshot written before session IDs were stored.
        let saved = try JSONEncoder().encode(run.snapshot)
        var legacy = try XCTUnwrap(JSONSerialization.jsonObject(with: saved) as? [String: Any])
        legacy.removeValue(forKey: "sessionID")
        let oldData = try JSONSerialization.data(withJSONObject: legacy)
        let oldSnapshot = try JSONDecoder().decode(RoadRun.Snapshot.self, from: oldData)
        run = try XCTUnwrap(RoadRun(snapshot: oldSnapshot))
        let sessionID = run.sessionID
        let migrated = try JSONDecoder().decode(RoadRun.Snapshot.self, from: JSONEncoder().encode(run.snapshot))
        run = try XCTUnwrap(RoadRun(snapshot: migrated))
        XCTAssertEqual(run.sessionID, sessionID)

        analytics.startIfNeeded(for: run, mode: .classic)
        let hint = try await client.hint(for: run, mode: .classic, player: UUID())
        run.applyHint(hint.guidePath)
        run.restart()
        XCTAssertEqual(run.sessionID, sessionID)
        for tile in [1, 4, 5, 8] { run.select(tile) }
        XCTAssertEqual(run.outcome, .solved)
        analytics.recordSolve(for: run, mode: .classic)

        // Not asked yet: the start and the solve stay on the device. Only the hint is sent.
        XCTAssertNil(analytics.consent)
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertNil(recorder.body(for: "/api/session/start"))
        XCTAssertNil(recorder.body(for: "/api/session/end"))
        XCTAssertFalse(analytics.didSendSolve(gameNo: 1, mode: .classic))
        analytics.setConsent(true)
        await fulfillment(of: [received], timeout: 5)
        for _ in 0..<20 where !analytics.didSendSolve(gameNo: 1, mode: .classic) {
            try await Task.sleep(for: .milliseconds(50))
        }
        XCTAssertTrue(analytics.didSendSolve(gameNo: 1, mode: .classic))
        XCTAssertTrue(analytics.didSendStart(gameNo: 1, mode: .classic))
        // Start sent, solve not: the player's own unsolved row is left out, so the one
        // faster player is the whole field.
        XCTAssertEqual(RoadStats.fieldStanding(plays: 2 - 1, solvedAttemptsExact: ["1": 1], attempts: 2,
                                               alreadyCounted: false), "The field needed fewer.")

        for path in ["/api/session/start", "/api/session/hint", "/api/session/end"] {
            let body = try XCTUnwrap(recorder.body(for: path), path)
            let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any], path)
            let sent = try XCTUnwrap(payload["sessionId"] as? String, path)
            XCTAssertEqual(UUID(uuidString: sent), sessionID, path)
        }
    }

    @MainActor
    func testDecliningCommunityStatsDropsHeldPlay() throws {
        let suite = "GoldRoadTests.consent.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let analytics = DailyRoadAnalytics(defaults: defaults)
        let board = Board(rows: 3, cols: 3, tiles: [2, 3, 1, 1, 4, 2, 1, 1, 5],
                          missingEdges: [.init(from: 0, to: 3), .init(from: 2, to: 5)],
                          tollEdges: [.init(from: 0, to: 1)], bonusEdges: [.init(from: 1, to: 4)],
                          tollValue: 2, bonusValue: 3, start: 0, end: 8)
        let cutoff = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
        var run = RoadRun(road: ClassicRoad(gameNo: 1, maxScore: 17, playableAt: "2026-01-01T00:00:00Z",
                                            board: board, nextGameAt: cutoff))
        run.select(1)
        analytics.startIfNeeded(for: run, mode: .classic)
        for tile in [4, 5, 8] { run.select(tile) }
        XCTAssertEqual(run.outcome, .solved)
        analytics.recordSolve(for: run, mode: .classic)

        func held(_ key: String) throws -> Int {
            let data = try XCTUnwrap(defaults.data(forKey: key), key)
            return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [Any], key).count
        }
        XCTAssertEqual(try held("dailyAnalytics.heldStarts.v1"), 1)
        XCTAssertEqual(try held("dailyAnalytics.pendingSolves.v1"), 1)

        analytics.setConsent(false)
        XCTAssertEqual(analytics.consent, false)
        XCTAssertEqual(try held("dailyAnalytics.heldStarts.v1"), 0)
        XCTAssertEqual(try held("dailyAnalytics.pendingSolves.v1"), 0)

        // After a no, new play is not kept.
        analytics.recordSolve(for: run, mode: .classic)
        XCTAssertEqual(try held("dailyAnalytics.pendingSolves.v1"), 0)
    }

    @MainActor
    func testSolveConfirmedAfterOptOutIsStillRecordedAsSent() async throws {
        let received = expectation(description: "Solve request")
        let recorder = SessionRequestRecorder(received: received)
        SessionURLProtocol.recorder = recorder
        SessionURLProtocol.responseDelay = 0.4
        defer { SessionURLProtocol.recorder = nil; SessionURLProtocol.responseDelay = 0 }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let suite = "GoldRoadTests.inflight.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(true, forKey: GameConstants.analyticsKey)
        let analytics = DailyRoadAnalytics(defaults: defaults, session: session)
        let board = Board(rows: 3, cols: 3, tiles: [2, 3, 1, 1, 4, 2, 1, 1, 5],
                          missingEdges: [.init(from: 0, to: 3), .init(from: 2, to: 5)],
                          tollEdges: [.init(from: 0, to: 1)], bonusEdges: [.init(from: 1, to: 4)],
                          tollValue: 2, bonusValue: 3, start: 0, end: 8)
        let cutoff = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
        var run = RoadRun(road: ClassicRoad(gameNo: 1, maxScore: 17, playableAt: "2026-01-01T00:00:00Z",
                                            board: board, nextGameAt: cutoff))
        for tile in [1, 4, 5, 8] { run.select(tile) }
        XCTAssertEqual(run.outcome, .solved)
        analytics.recordSolve(for: run, mode: .classic)
        await fulfillment(of: [received], timeout: 5)

        // The player opts out while the solve is in flight. The server still confirms it.
        analytics.setConsent(false)
        for _ in 0..<30 where !analytics.didSendSolve(gameNo: 1, mode: .classic) {
            try await Task.sleep(for: .milliseconds(50))
        }
        XCTAssertTrue(analytics.didSendSolve(gameNo: 1, mode: .classic))
    }

    func testReviewIsAskedAfterThreeSolvedRoadsOncePerVersion() throws {
        let suite = "review-\(UUID())"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        func save(_ records: [DailyRoadRecord]) throws {
            defaults.set(try JSONEncoder().encode(records), forKey: DailyRoadRecord.storageKey)
        }
        func record(_ gameNo: Int, _ mode: RoadMode = .classic, solved: Bool = true) -> DailyRoadRecord {
            DailyRoadRecord(gameNo: gameNo, playableAt: "2026-11-20T00:00:00.000Z", mode: mode,
                            attempts: 1, solved: solved, activeSeconds: 60, hintsUsed: 0)
        }

        XCTAssertFalse(RoadReview.shouldAsk(defaults: defaults, version: "1.0.0"))
        // Two roads, one with both modes solved, and one unsolved road: not enough.
        try save([record(1), record(1, .expedition), record(2), record(3, solved: false)])
        XCTAssertFalse(RoadReview.shouldAsk(defaults: defaults, version: "1.0.0"))
        try save([record(1), record(2), record(3)])
        XCTAssertTrue(RoadReview.shouldAsk(defaults: defaults, version: "1.0.0"))
        RoadReview.markAsked(defaults: defaults, version: "1.0.0")
        XCTAssertFalse(RoadReview.shouldAsk(defaults: defaults, version: "1.0.0"))
        XCTAssertTrue(RoadReview.shouldAsk(defaults: defaults, version: "1.1.0"))
    }
}

/// Counts requests for today's road and fails each one, so a test can see whether the board fetched.
private final class CurrentRoadURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var count = 0
    static var requests: Int {
        lock.lock(); defer { lock.unlock() }
        return count
    }
    static func reset() { lock.lock(); count = 0; lock.unlock() }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        if request.url?.path == "/api/games/current" {
            Self.lock.lock(); Self.count += 1; Self.lock.unlock()
        }
        client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
    }
    override func stopLoading() {}
}

extension ContractTests {
    @MainActor
    private func loadBoard(prefetchedCutoff: Date) async throws -> (DailyRoadModel, Int) {
        CurrentRoadURLProtocol.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CurrentRoadURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let suite = "GoldRoadTests.prefetch.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let board = Board(rows: 3, cols: 3, tiles: [2, 3, 1, 1, 4, 2, 1, 1, 5],
                          missingEdges: [], tollEdges: [], bonusEdges: [],
                          tollValue: 2, bonusValue: 3, start: 0, end: 8)
        let formatter = ISO8601DateFormatter()
        let road = ClassicRoad(gameNo: 105, maxScore: 9, playableAt: formatter.string(from: Date()),
                               board: board, nextGameAt: formatter.string(from: prefetchedCutoff))
        let day = ClassicRoadClient.RoadDay(classic: road, expedition: nil)
        let model = DailyRoadModel(prefetched: day, defaults: defaults, client: ClassicRoadClient(session: session))
        let load = Task { await model.loadRoad(isActive: true) }
        for _ in 0..<40 where model.isLoading {
            try await Task.sleep(for: .milliseconds(25))
        }
        load.cancel()
        return (model, CurrentRoadURLProtocol.requests)
    }

    /// Home's road opens the board at once, with no second fetch.
    @MainActor
    func testBoardUsesHomesRoadWithoutFetching() async throws {
        let (model, requests) = try await loadBoard(prefetchedCutoff: Date().addingTimeInterval(3600))
        XCTAssertEqual(model.run?.road.gameNo, 105)
        XCTAssertFalse(model.isLoading)
        XCTAssertEqual(requests, 0)
    }

    /// A road from Home that has expired is not trusted: the board fetches.
    @MainActor
    func testBoardFetchesWhenHomesRoadHasExpired() async throws {
        let (_, requests) = try await loadBoard(prefetchedCutoff: Date().addingTimeInterval(-60))
        XCTAssertEqual(requests, 1)
    }
}

extension ContractTests {
    func testNoHintSolvesCountsOnlyCleanSolvesInTheMode() {
        func entry(_ gameNo: Int, _ mode: RoadMode, solved: Bool, hints: Int) -> RoadStats.Entry {
            RoadStats.Entry(day: "2026-11-\(10 + gameNo)", gameNo: gameNo, puzzleType: mode, attempts: 1,
                            solved: solved, hintsUsed: hints, solveTimeMs: nil)
        }
        let entries = [entry(1, .classic, solved: true, hints: 0), entry(2, .classic, solved: true, hints: 2),
                       entry(3, .classic, solved: false, hints: 0), entry(4, .expedition, solved: true, hints: 0)]
        XCTAssertEqual(RoadStats.noHintSolves(entries, mode: .classic), 1)
        XCTAssertEqual(RoadStats.noHintSolves(entries, mode: .expedition), 1)
    }
}

extension ContractTests {
    private func savedDay(cutoff: Date) -> ClassicRoadClient.RoadDay {
        let board = Board(rows: 3, cols: 3, tiles: [2, 3, 1, 1, 4, 2, 1, 1, 5],
                          missingEdges: [], tollEdges: [], bonusEdges: [],
                          tollValue: 2, bonusValue: 3, start: 0, end: 8)
        let formatter = ISO8601DateFormatter()
        let road = ClassicRoad(gameNo: 106, maxScore: 9, playableAt: formatter.string(from: Date()),
                               board: board, nextGameAt: formatter.string(from: cutoff))
        return ClassicRoadClient.RoadDay(classic: road, expedition: road)
    }

    /// Home keeps today's road on the device and uses it until the road closes.
    func testRoadDayStoreKeepsOnlyAnOpenRoad() throws {
        let suite = "GoldRoadTests.roadDay.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let now = Date()
        RoadDayStore.save(savedDay(cutoff: now.addingTimeInterval(3600)), defaults: defaults, now: now)
        XCTAssertEqual(RoadDayStore.load(defaults: defaults, now: now)?.classic?.gameNo, 106)
        XCTAssertEqual(RoadDayStore.load(defaults: defaults, now: now)?.playableExpedition?.gameNo, 106)
        XCTAssertNil(RoadDayStore.load(defaults: defaults, now: now.addingTimeInterval(3601)))

        // A day with no road (or an update-required answer) is not saved.
        defaults.removeObject(forKey: RoadDayStore.key)
        RoadDayStore.save(ClassicRoadClient.RoadDay(classic: nil, expedition: nil), defaults: defaults, now: now)
        XCTAssertNil(defaults.data(forKey: RoadDayStore.key))
    }

    /// One fetch per launch, then none while the road is open.
    func testHomeFetchesOncePerLaunchThenOnlyWhenTheRoadCloses() {
        let now = Date()
        let open = savedDay(cutoff: now.addingTimeInterval(3600))
        XCTAssertTrue(RoadDayStore.needsFetch(open, checked: false, now: now))
        XCTAssertFalse(RoadDayStore.needsFetch(open, checked: true, now: now))
        XCTAssertTrue(RoadDayStore.needsFetch(nil, checked: true, now: now))
        XCTAssertTrue(RoadDayStore.needsFetch(open, checked: true, now: now.addingTimeInterval(3601)))
    }

    /// Community stats are reused for the same day and fetched again on the next day.
    func testStatsOverviewStoreMatchesTheDay() throws {
        let suite = "GoldRoadTests.overview.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let json = #"{"currentGameNo":124,"yesterday":{"gameNo":123,"classic":null,"expedition":null}}"#
        let data = Data(json.utf8)
        let overview = try JSONDecoder().decode(StatsOverview.self, from: data)
        StatsOverviewStore.save(data, for: overview, defaults: defaults)
        XCTAssertEqual(StatsOverviewStore.load(currentGameNo: 124, defaults: defaults)?.yesterday.gameNo, 123)
        XCTAssertNil(StatsOverviewStore.load(currentGameNo: 125, defaults: defaults))
        XCTAssertNil(StatsOverviewStore.load(currentGameNo: nil, defaults: defaults))
    }
}

extension ContractTests {
    private func archiveJSON(gameNo: Int) -> Data {
        let road = """
        {"gameNo":\(gameNo),"maxScore":9,"playableAt":"2026-11-20T00:00:00Z","nextGameAt":null,"optimalPaths":[[0,4,8]],
         "board":{"rows":3,"cols":3,"tiles":[2,3,1,1,4,2,1,1,5],"missingEdges":[],"tollEdges":[],"bonusEdges":[],
                  "tollValue":2,"bonusValue":3,"start":0,"end":8}}
        """
        return Data(#"{"classic":\#(road),"expedition":null}"#.utf8)
    }

    /// A past day's board is kept and read back with no fetch. Today's is not.
    func testArchiveCacheKeepsOnlyPastBoards() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let cache = ArchiveCache(folder: folder)

        let past = archiveJSON(gameNo: 123)
        cache.saveBoard(past, try JSONDecoder().decode(ArchiveBoard.self, from: past), gameNo: 123, currentGameNo: 124)
        XCTAssertEqual(cache.board(123)?.classic?.gameNo, 123)

        let today = archiveJSON(gameNo: 124)
        cache.saveBoard(today, try JSONDecoder().decode(ArchiveBoard.self, from: today), gameNo: 124, currentGameNo: 124)
        XCTAssertNil(cache.board(124))
        cache.saveBoard(today, try JSONDecoder().decode(ArchiveBoard.self, from: today), gameNo: 124, currentGameNo: nil)
        XCTAssertNil(cache.board(124))
    }

    /// The calendar list is reused on the same day and fetched again on the next.
    func testArchiveCacheListMatchesTheDay() {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let cache = ArchiveCache(folder: folder)
        let data = Data(#"{"games":[{"gameNo":123,"playableAt":"2026-11-24T00:00:00Z"}]}"#.utf8)
        cache.saveList(data, currentGameNo: 124)
        XCTAssertEqual(cache.list(currentGameNo: 124)?.games.first?.gameNo, 123)
        XCTAssertNil(cache.list(currentGameNo: 125))
        XCTAssertNil(cache.list(currentGameNo: nil))
    }
}
