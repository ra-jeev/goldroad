import Foundation

/// Analytics for the live daily road only. Archive and tutorial callers must not use it.
@MainActor
final class DailyRoadAnalytics {
    static let shared = DailyRoadAnalytics()

    private struct Start: Codable {
        let playerUUID: String
        let gameNo: Int
        let puzzleType: String
        let sessionId: String
    }

    private struct Solve: Codable {
        let playerUUID: String
        let gameNo: Int
        let puzzleType: String
        let sessionId: String
        let score: Int
        let moves: Int
        let attemptNumber: Int
        let hintsUsed: Int
        let solveTimeMs: Int?
    }

    private struct Pending: Codable {
        let payload: Solve
        let cutoff: Date
        var backoffIndex: Int
        var nextAttempt: Date?

        var key: String { "\(payload.playerUUID):\(payload.gameNo):\(payload.puzzleType)" }
    }

    private struct APIResponse: Decodable { let ok: Bool }
    private let queueKey = "dailyAnalytics.pendingSolves.v1"
    private let defaults: UserDefaults
    private let session: URLSession
    private let baseURL = URL(string: "https://playgoldroad.com")!
    private let delays: [TimeInterval] = [2, 5, 15, 30, 60, 120]
    private var started: Set<String> = []
    private var sessionIDs: [String: String] = [:]
    private var pending: [Pending]
    private var inFlight = false
    private var timer: Task<Void, Never>?

    init(defaults: UserDefaults = .standard, session: URLSession = .shared) {
        self.defaults = defaults
        self.session = session
        if let data = defaults.data(forKey: "dailyAnalytics.pendingSolves.v1"),
           let saved = try? JSONDecoder().decode([Pending].self, from: data) {
            pending = saved
        } else {
            pending = []
        }
        discardExpired()
        schedule()
    }

    /// Call after a valid move off the start tile. Start failures are not queued.
    func startIfNeeded(for run: RoadRun, mode: RoadMode) {
        guard run.path.count > 1, isCurrent(run) else { return }
        let key = roadKey(run, mode)
        guard started.insert(key).inserted else { return }
        let payload = Start(playerUUID: playerUUID(), gameNo: run.road.gameNo,
                            puzzleType: mode.rawValue, sessionId: sessionID(for: key))
        Task { _ = await post("api/session/start", payload) }
    }

    /// Call after finalizing the active time on an exact daily solve.
    func recordSolve(for run: RoadRun, mode: RoadMode) {
        guard run.outcome == .solved, run.score == run.road.maxScore,
              let cutoff = run.road.cutoff, cutoff > Date() else { return }
        let key = roadKey(run, mode)
        let elapsed = run.activeTime.map { Int((min(max($0, 0), 86_400) * 1000).rounded()) }
        let payload = Solve(playerUUID: playerUUID(), gameNo: run.road.gameNo,
                            puzzleType: mode.rawValue, sessionId: sessionID(for: key),
                            score: run.score, moves: run.path.count,
                            attemptNumber: run.attempt, hintsUsed: run.hintsUsed, solveTimeMs: elapsed)
        let item = Pending(payload: payload, cutoff: cutoff, backoffIndex: 0, nextAttempt: Date())
        // Keep the original payload for a road if a delivery is already pending.
        guard !pending.contains(where: { $0.key == item.key }) else { return }
        pending.append(item)
        persist()
        Task { await deliver(force: true) }
    }

    /// Call on launch and foreground to retry pending solves without waiting for backoff.
    func flush() {
        Task { await deliver(force: true) }
    }

    private func roadKey(_ run: RoadRun, _ mode: RoadMode) -> String {
        "\(run.road.gameNo):\(mode.rawValue)"
    }

    private func isCurrent(_ run: RoadRun) -> Bool {
        guard let cutoff = run.road.cutoff else { return false }
        return cutoff > Date()
    }

    private func playerUUID() -> String {
        if let stored = defaults.string(forKey: "playerUUID"), let id = UUID(uuidString: stored) {
            return id.uuidString
        }
        let id = UUID().uuidString
        defaults.set(id, forKey: "playerUUID")
        return id
    }

    private func sessionID(for key: String) -> String {
        if let existing = sessionIDs[key] { return existing }
        let id = UUID().uuidString
        sessionIDs[key] = id
        return id
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(pending) { defaults.set(data, forKey: queueKey) }
    }

    private func discardExpired() {
        let count = pending.count
        pending.removeAll { $0.cutoff <= Date() }
        if pending.count != count { persist() }
    }

    private enum DeliveryResult { case success, retry, discard }

    private func post<Payload: Encodable>(_ path: String, _ payload: Payload) async -> DeliveryResult {
        var request = URLRequest(url: baseURL.appending(path: path), timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        guard let body = try? JSONEncoder().encode(payload) else { return .discard }
        request.httpBody = body
        do {
            let (data, response) = try await session.data(for: request)
            guard let response = response as? HTTPURLResponse else { return .retry }
            if response.statusCode == 429 || response.statusCode >= 500 { return .retry }
            guard (200..<300).contains(response.statusCode) else { return .discard }
            guard let result = try? JSONDecoder().decode(APIResponse.self, from: data), result.ok else { return .retry }
            return .success
        } catch {
            return .retry
        }
    }

    private func deliver(force: Bool) async {
        guard !inFlight else { return }
        timer?.cancel()
        timer = nil
        inFlight = true
        defer { inFlight = false; schedule() }
        discardExpired()
        while let index = pending.firstIndex(where: { force || ($0.nextAttempt.map { $0 <= Date() } ?? false) }) {
            let item = pending[index]
            guard item.cutoff > Date() else { discardExpired(); continue }
            let result = await post("api/session/end", item.payload)
            guard let current = pending.firstIndex(where: { $0.key == item.key }) else { continue }
            switch result {
            case .success, .discard:
                pending.remove(at: current)
            case .retry:
                let index = pending[current].backoffIndex
                if index < delays.count {
                    pending[current].nextAttempt = Date().addingTimeInterval(delays[index] * Double.random(in: 0.5...1.5))
                    pending[current].backoffIndex += 1
                } else {
                    pending[current].nextAttempt = nil
                }
            }
            persist()
            // Forced retries must not immediately retry the same failed item in a loop.
            if case .retry = result { break }
        }
    }

    private func schedule() {
        timer?.cancel()
        timer = nil
        discardExpired()
        guard !inFlight, let wake = pending.flatMap({ item in
            [item.cutoff, item.nextAttempt].compactMap { $0 }
        }).min() else { return }
        timer = Task { [weak self] in
            let delay = max(0, wake.timeIntervalSinceNow)
            do { try await Task.sleep(for: .seconds(delay)) } catch { return }
            self?.timer = nil
            await self?.deliver(force: false)
        }
    }
}
