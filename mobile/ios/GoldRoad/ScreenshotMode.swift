import Foundation

/// Local demo data for App Store screenshots. Start a simulator build with the
/// launch argument `-GoldRoadScreenshotMode YES`: the app then answers its own
/// API calls with a fixed road, hints and community stats, and starts with a
/// sample history. Simulator builds only; device builds never turn it on.
enum ScreenshotMode {
#if targetEnvironment(simulator)
    /// On with the launch argument, or when the simulator device holds a
    /// `GoldRoadScreenshotMode` file in its data folder. The file survives
    /// reinstalls, so capture tools that relaunch the app keep the mode.
    static let isOn: Bool = {
        if UserDefaults.standard.bool(forKey: "GoldRoadScreenshotMode") { return true }
        guard let folder = ProcessInfo.processInfo.environment["SIMULATOR_SHARED_RESOURCES_DIRECTORY"] else {
            return false
        }
        return FileManager.default.fileExists(atPath: folder + "/GoldRoadScreenshotMode")
    }()
#else
    static let isOn = false
#endif

    /// Taps in a capture flow are fast. Show a believable solve time instead.
    static func shownTime(_ seconds: TimeInterval?) -> TimeInterval? {
        isOn ? seconds.map { $0 + 94 } : seconds
    }

    static func install() {
        guard isOn else { return }
        seedHistory()
        URLProtocol.registerClass(ScreenshotStub.self)
    }

    // MARK: Calendar

    private static let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    /// Road numbers count days from 12 Aug 2026 (UTC), like production.
    private static let firstDay = utc.date(from: DateComponents(year: 2026, month: 8, day: 12))!

    static var todayStart: Date { utc.startOfDay(for: Date()) }
    static var todayGameNo: Int { utc.dateComponents([.day], from: firstDay, to: todayStart).day ?? 100 }

    private static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private static func dayStart(_ gameNo: Int) -> Date {
        utc.date(byAdding: .day, value: gameNo - todayGameNo, to: todayStart)!
    }

    // MARK: Seed

    private static func seedHistory() {
        let defaults = UserDefaults.standard
        guard defaults.data(forKey: DailyRoadRecord.storageKey) == nil else { return }
        // Classic tries for the 12 days before today, oldest first; 0 means Expedition was skipped.
        let classicTries = [1, 2, 1, 1, 3, 1, 2, 1, 1, 1, 2, 2]
        let expeditionTries = [2, 1, 0, 1, 2, 1, 1, 0, 3, 1, 1, 2]
        var history: [DailyRoadRecord] = []
        for (offset, tries) in classicTries.enumerated() {
            let gameNo = todayGameNo - classicTries.count + offset
            let playableAt = iso(dayStart(gameNo))
            history.append(DailyRoadRecord(gameNo: gameNo, playableAt: playableAt, mode: .classic, attempts: tries,
                                           solved: true, activeSeconds: 95 + offset * 17 % 140, hintsUsed: offset % 4 == 0 ? 1 : 0))
            let expedition = expeditionTries[offset]
            if expedition > 0 {
                history.append(DailyRoadRecord(gameNo: gameNo, playableAt: playableAt, mode: .expedition,
                                               attempts: expedition, solved: true,
                                               activeSeconds: 140 + offset * 23 % 160, hintsUsed: 0))
            }
        }
        if let data = try? JSONEncoder().encode(history) { defaults.set(data, forKey: DailyRoadRecord.storageKey) }
        let yesterday = todayGameNo - 1
        defaults.set(["\(yesterday):classic", "\(yesterday):expedition"], forKey: "dailyAnalytics.sentSolves.v1")
        defaults.set(["\(yesterday):classic", "\(yesterday):expedition"], forKey: "dailyAnalytics.sentStarts.v1")
        defaults.set(true, forKey: GameConstants.analyticsKey)
        defaults.set(true, forKey: RoadTutorialView.seenKey)
        defaults.set(true, forKey: "dailyReminder.asked")
    }

    // MARK: API

    private struct Road: Decodable {
        let maxScore: Int
        let board: Board
        let path: [Int]
    }

    private static let roads: [String: Road] = {
        let json = #"{"classic":{"maxScore":112,"board":{"rows":6,"cols":6,"tiles":[5,6,6,1,3,5,3,1,4,2,6,4,3,1,2,5,1,6,6,1,6,2,2,4,1,5,6,4,1,2,2,5,5,2,4,1],"missingEdges":[{"from":5,"to":11},{"from":14,"to":15},{"from":10,"to":16},{"from":24,"to":25},{"from":19,"to":20},{"from":28,"to":34},{"from":12,"to":13},{"from":3,"to":4},{"from":30,"to":31}],"tollEdges":[],"bonusEdges":[],"tollValue":2,"bonusValue":6,"start":27,"end":0},"path":[27,28,22,16,15,21,20,26,25,31,32,33,34,35,29,23,17,11,10,9,3,2,8,14,13,19,18,12,6,7,1,0]},"expedition":{"maxScore":86,"board":{"rows":6,"cols":6,"tiles":[2,3,5,5,3,1,2,1,4,3,1,2,2,3,2,1,2,2,4,4,1,5,1,1,2,3,2,6,4,2,3,1,5,6,4,4],"missingEdges":[{"from":5,"to":11},{"from":1,"to":2},{"from":21,"to":27},{"from":24,"to":30},{"from":23,"to":29},{"from":4,"to":5},{"from":13,"to":19},{"from":17,"to":23},{"from":13,"to":14},{"from":12,"to":13},{"from":20,"to":26}],"tollEdges":[{"from":22,"to":28},{"from":0,"to":1}],"bonusEdges":[{"from":14,"to":20}],"tollValue":2,"bonusValue":6,"start":22,"end":6},"path":[22,28,29,35,34,33,27,26,32,31,25,24,18,19,20,14,15,16,17,11,10,4,3,2,8,7,1,0,6]}}"#
        return (try? JSONDecoder().decode([String: Road].self, from: Data(json.utf8))) ?? [:]
    }()

    static func response(path: String, body: Data?) -> (Int, Any) {
        switch path {
        case "/api/games/current": return (200, currentDay())
        case "/api/session/hint": return (200, hint(body))
        case "/api/stats/overview": return (200, overview())
        case "/api/session/start": return (200, ["ok": true, "gameNo": todayGameNo])
        case "/api/session/end":
            return (200, ["ok": true, "gameNo": todayGameNo, "medal": "gold", "score": 0, "solved": true])
        default: return (404, ["ok": false])
        }
    }

    private static func currentDay() -> [String: Any] {
        func road(_ mode: String) -> [String: Any] {
            guard let road = roads[mode], let board = try? JSONSerialization.jsonObject(
                with: JSONEncoder().encode(road.board)) else { return [:] }
            return ["gameNo": todayGameNo, "puzzleType": mode, "maxScore": road.maxScore, "board": board,
                    "playableAt": iso(todayStart), "nextGameAt": iso(dayStart(todayGameNo + 1))]
        }
        return ["minClientVersion": ["ios": "0.1.0", "android": "1.0.0"],
                "classic": road("classic"), "expedition": road("expedition")]
    }

    private static func hint(_ body: Data?) -> [String: Any] {
        guard let body, let request = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
              let mode = request["puzzleType"] as? String, let route = roads[mode]?.path,
              let walked = request["pathHistory"] as? [Int] else { return ["ok": false] }
        let shared = zip(walked, route).prefix { $0 == $1 }.count
        let next = min(shared, route.count - 1)
        if shared == walked.count {
            return ["ok": true, "hint": ["kind": "next-step", "guidePath": Array(route[...next]),
                                         "nextTileIndex": route[next]]]
        }
        return ["ok": true, "hint": ["kind": "diverged", "guidePath": Array(route[...next]),
                                     "divergenceTileIndex": walked[shared], "correctTileIndex": route[next]]]
    }

    private static func overview() -> [String: Any] {
        func community(_ mode: String, _ attempts: [String: Int], plays: Int) -> [String: Any] {
            let solves = attempts.values.reduce(0, +)
            return ["gameNo": todayGameNo - 1, "puzzleType": mode, "plays": plays, "exactSolves": solves,
                    "solveRate": Double(solves * 100 / plays), "solvedAttempts": attempts, "solvedAttemptsExact": attempts,
                    "behavior": ["totalHints": plays / 3, "averageSolveTimeMs": 184_000, "bestSolveTimeMs": 41_000]]
        }
        let classic = ["1": 318, "2": 486, "3": 402, "4": 261, "5": 158, "6": 97, "7": 61, "8": 38, "9": 24,
                       "10": 15, "11": 9, "12": 6]
        let expedition = ["1": 142, "2": 266, "3": 301, "4": 243, "5": 171, "6": 112, "7": 74, "8": 46, "9": 29,
                          "10": 18, "11": 12, "12": 7]
        return ["currentGameNo": todayGameNo,
                "yesterday": ["gameNo": todayGameNo - 1,
                              "classic": community("classic", classic, plays: 1_972),
                              "expedition": community("expedition", expedition, plays: 1_604)]]
    }
}

private final class ScreenshotStub: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.path.hasPrefix("/api/") == true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let (status, object) = ScreenshotMode.response(path: url.path, body: requestBody())
        let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data()
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private func requestBody() -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
