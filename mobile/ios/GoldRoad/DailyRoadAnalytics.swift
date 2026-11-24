import Foundation

private protocol SessionResponse: Decodable {
    var ok: Bool { get }
}

/// Analytics for the live daily road only. Archive and tutorial callers must not use it.
@MainActor
final class DailyRoadAnalytics {
    static let shared = DailyRoadAnalytics()

    struct Start: Codable {
        let playerUUID: String
        let gameNo: Int
        let puzzleType: String
        let sessionId: String
    }

    struct Solve: Codable {
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

    /// A start made before the player answered the consent question. Sent only after a yes.
    private struct HeldStart: Codable {
        let payload: Start
        let cutoff: Date
    }

    private struct Pending: Codable {
        let payload: Solve
        let cutoff: Date
        var backoffIndex: Int
        var nextAttempt: Date?

        var key: String { "\(payload.playerUUID):\(payload.gameNo):\(payload.puzzleType)" }
    }

    struct StartResponse: SessionResponse {
        let ok: Bool
        let gameNo: Int
    }

    struct EndResponse: SessionResponse {
        let ok: Bool
        let gameNo: Int
        let medal: String?
        let score: Int
        let solved: Bool
    }

    private let queueKey = "dailyAnalytics.pendingSolves.v1"
    private let heldStartsKey = "dailyAnalytics.heldStarts.v1"
    private let defaults: UserDefaults
    private let session: URLSession
    private let delays: [TimeInterval] = [2, 5, 15, 30, 60, 120]
    private var started: Set<UUID> = []
    private var pending: [Pending]
    private var heldStarts: [HeldStart]
    private var inFlight = false
    private var timer: Task<Void, Never>?

    /// nil = not asked yet: play data is kept on the device and nothing is sent.
    /// false = no: nothing is kept or sent. true = yes: data is sent.
    var consent: Bool? {
        defaults.object(forKey: GameConstants.analyticsKey) as? Bool
    }

    private var enabled: Bool { consent == true }
    private var mayRecord: Bool { consent != false }

    /// Call with the player's answer, from the first-solve question or the Settings switch.
    func setConsent(_ allowed: Bool) {
        defaults.set(allowed, forKey: GameConstants.analyticsKey)
        if allowed {
            let starts = heldStarts.filter { $0.cutoff > Date() }.map(\.payload)
            heldStarts = []
            persistHeldStarts()
            Task {
                for start in starts {
                    _ = await post("api/session/start", start, response: StartResponse.self)
                }
                await deliver(force: true)
            }
        } else {
            // Drop everything at once, so nothing queued can be sent later.
            timer?.cancel()
            timer = nil
            heldStarts = []
            persistHeldStarts()
            pending = []
            persist()
        }
    }

    init(defaults: UserDefaults = .standard, session: URLSession = .shared) {
        self.defaults = defaults
        self.session = session
        if let data = defaults.data(forKey: "dailyAnalytics.pendingSolves.v1"),
           let saved = try? JSONDecoder().decode([Pending].self, from: data) {
            pending = saved
        } else {
            pending = []
        }
        if let data = defaults.data(forKey: heldStartsKey),
           let saved = try? JSONDecoder().decode([HeldStart].self, from: data) {
            heldStarts = saved.filter { $0.cutoff > Date() }
        } else {
            heldStarts = []
        }
        discardExpired()
        schedule()
    }

    /// Call after a valid move off the start tile. Start failures are not queued.
    func startIfNeeded(for run: RoadRun, mode: RoadMode) {
        guard mayRecord, run.path.count > 1, isCurrent(run), let cutoff = run.road.cutoff else { return }
        guard started.insert(run.sessionID).inserted else { return }
        let payload = Start(playerUUID: playerUUID(), gameNo: run.road.gameNo,
                            puzzleType: mode.rawValue, sessionId: run.sessionID.uuidString)
        guard enabled else {
            heldStarts.append(HeldStart(payload: payload, cutoff: cutoff))
            persistHeldStarts()
            return
        }
        Task { _ = await post("api/session/start", payload, response: StartResponse.self) }
    }

    /// Call after finalizing the active time on an exact daily solve.
    func recordSolve(for run: RoadRun, mode: RoadMode) {
        guard mayRecord, run.outcome == .solved, run.score == run.road.maxScore,
              let cutoff = run.road.cutoff, cutoff > Date() else { return }
        let elapsed = run.activeTime.map { Int((min(max($0, 0), 86_400) * 1000).rounded()) }
        let payload = Solve(playerUUID: playerUUID(), gameNo: run.road.gameNo,
                            puzzleType: mode.rawValue, sessionId: run.sessionID.uuidString,
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

    private func persistHeldStarts() {
        if let data = try? JSONEncoder().encode(heldStarts) { defaults.set(data, forKey: heldStartsKey) }
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

    private func post<Payload: Encodable, Response: SessionResponse>(
        _ path: String, _ payload: Payload, response type: Response.Type
    ) async -> DeliveryResult {
        guard enabled else { return .discard }
        guard let url = try? GoldRoadAPI.url(path) else { return .discard }
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        guard let body = try? JSONEncoder().encode(payload) else { return .discard }
        request.httpBody = body
        do {
            let (data, response) = try await session.data(for: request)
            guard let response = response as? HTTPURLResponse else { return .retry }
            if response.statusCode == 429 || response.statusCode >= 500 { return .retry }
            guard (200..<300).contains(response.statusCode) else { return .discard }
            guard let result = try? JSONDecoder().decode(type, from: data), result.ok else { return .retry }
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
        // Not asked yet: keep the queue on the device until the player answers.
        guard enabled else { return }
        while let index = pending.firstIndex(where: { force || ($0.nextAttempt.map { $0 <= Date() } ?? false) }) {
            let item = pending[index]
            guard item.cutoff > Date() else { discardExpired(); continue }
            let result = await post("api/session/end", item.payload, response: EndResponse.self)
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
        guard enabled, !inFlight, let wake = pending.flatMap({ item in
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
