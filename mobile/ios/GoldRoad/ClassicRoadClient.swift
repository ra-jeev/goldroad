import Foundation

struct ClassicRoadClient {
    struct VersionEnvelope: Decodable {
        struct Versions: Codable {
            let ios: String
            let android: String
        }

        var minClientVersion: Versions?

        func requiresUpdate(installed: String) -> Bool {
            guard let minimum = minClientVersion?.ios else { return false }
            let minimumParts = minimum.split(separator: ".").compactMap { Int($0) }
            let installedParts = installed.split(separator: ".").compactMap { Int($0) }
            guard minimumParts.count == 3, installedParts.count == 3 else { return false }
            return installedParts.lexicographicallyPrecedes(minimumParts)
        }
    }

    struct RoadDay: Codable {
        let classic: ClassicRoad?
        let expedition: ClassicRoad?
        var minClientVersion: VersionEnvelope.Versions?

        func requiresUpdate(installed: String) -> Bool {
            VersionEnvelope(minClientVersion: minClientVersion).requiresUpdate(installed: installed)
        }

        var playableExpedition: ClassicRoad? {
            guard let expedition, expedition.gameNo == classic?.gameNo,
                  expedition.board.isPlayable else { return nil }
            return expedition
        }

        func availability(after current: ClassicRoad?, at now: Date) -> Availability {
            guard let classic, classic.board.isPlayable else { return .waiting }
            if classic.gameNo == current?.gameNo { return .sameDay }
            guard !classic.isExpired(at: now) else { return .waiting }
            guard let current else { return .open }
            return classic.gameNo > current.gameNo ? .ready : .waiting
        }

        enum Availability {
            case waiting, sameDay, open, ready
        }
    }

    struct Hint: Decodable, Equatable {
        enum Kind: String, Decodable {
            case nextStep = "next-step"
            case diverged
            case alreadySolved = "already-solved"
        }

        let kind: Kind
        let guidePath: [Int]
        var nextTileIndex: Int?
        var divergenceTileIndex: Int?
        var correctTileIndex: Int?

        func message(highlightedCount: Int) -> String? {
            switch kind {
            case .nextStep:
                highlightedCount == 0 ? nil : highlightedCount == 1
                    ? "The highlighted tile is your next move."
                    : "Follow the highlighted path."
            case .diverged: "Paths diverged. Try again and follow the highlighted path."
            case .alreadySolved: "You already found the best route."
            }
        }
    }

    struct HintRequest: Codable {
        let playerUUID: UUID
        let gameNo: Int
        let puzzleType: String
        let sessionId: UUID
        let attemptNumber: Int
        let pathHistory: [Int]
        let guidePath: [Int]
    }

    struct HintResponse: Decodable {
        let ok: Bool
        let hint: Hint?
    }

    private let session: URLSession
    let installedVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"

    init(session: URLSession = .shared) {
        self.session = session
    }

    func fetch() async throws -> RoadDay {
        let request = URLRequest(url: try GoldRoadAPI.url("api/games/current"),
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        do {
            let data = try await responseData(for: request)
            let decoder = JSONDecoder()
            let version = try decoder.decode(VersionEnvelope.self, from: data)
            if version.requiresUpdate(installed: installedVersion) {
                return RoadDay(classic: nil, expedition: nil, minClientVersion: version.minClientVersion)
            }
            return try decoder.decode(RoadDay.self, from: data)
        } catch let error as HTTPError where error.status == 404 {
            return RoadDay(classic: nil, expedition: nil)
        }
    }

    func hint(for run: RoadRun, mode: RoadMode, player: UUID) async throws -> Hint {
        let payload = HintRequest(playerUUID: player, gameNo: run.road.gameNo, puzzleType: mode.rawValue,
                                  sessionId: run.sessionID, attemptNumber: run.attempt, pathHistory: run.path,
                                  guidePath: run.guidePath)
        var request = URLRequest(url: try GoldRoadAPI.url("api/session/hint"), timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let data = try await responseData(for: request)
        let response = try JSONDecoder().decode(HintResponse.self, from: data)
        guard response.ok, let hint = response.hint else { throw URLError(.badServerResponse) }
        return hint
    }

    private func responseData(for request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(response.statusCode) else {
            throw HTTPError(status: response.statusCode)
        }
        return data
    }

    private struct HTTPError: Error {
        let status: Int
    }
}

/// Keeps the last fetched road day on the device, so Home can show it at once
/// and skip the server while that road is still open.
enum RoadDayStore {
    static let key = "roadDay.v1"

    /// Set after the first successful fetch in this launch. One fetch per
    /// launch keeps the "update required" check working.
    @MainActor static var checkedThisLaunch = false

    /// The saved day, only if its Classic road is still open at `now`.
    static func load(defaults: UserDefaults = .standard, now: Date = Date()) -> ClassicRoadClient.RoadDay? {
        guard let data = defaults.data(forKey: key),
              let day = try? JSONDecoder().decode(ClassicRoadClient.RoadDay.self, from: data),
              isOpen(day, at: now) else { return nil }
        return day
    }

    /// Saves a day that has an open Classic road. Other days (no road yet,
    /// update required) are not saved, so the next look asks the server again.
    static func save(_ day: ClassicRoadClient.RoadDay, defaults: UserDefaults = .standard, now: Date = Date()) {
        guard isOpen(day, at: now), let data = try? JSONEncoder().encode(day) else { return }
        defaults.set(data, forKey: key)
    }

    /// Home asks the server only on the first look in a launch, or when it has
    /// no open road.
    static func needsFetch(_ day: ClassicRoadClient.RoadDay?, checked: Bool, now: Date = Date()) -> Bool {
        guard checked, let day else { return true }
        return !isOpen(day, at: now)
    }

    private static func isOpen(_ day: ClassicRoadClient.RoadDay, at now: Date) -> Bool {
        guard let classic = day.classic, classic.cutoff != nil else { return false }
        return !classic.isExpired(at: now)
    }
}
