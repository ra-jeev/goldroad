import Foundation

struct ClassicRoadClient {
    struct VersionEnvelope: Decodable {
        struct Versions: Decodable {
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

    struct RoadDay: Decodable {
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

    private let baseURL = URL(string: "https://playgoldroad.com")!
    let installedVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"

    func fetch() async throws -> RoadDay {
        let request = URLRequest(url: baseURL.appending(path: "api/games/current"),
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

    func hint(for run: RoadRun, mode: RoadMode, player: UUID, session: UUID) async throws -> Hint {
        let payload = HintRequest(playerUUID: player, gameNo: run.road.gameNo, puzzleType: mode.rawValue,
                                  sessionId: session, attemptNumber: run.attempt, pathHistory: run.path,
                                  guidePath: run.guidePath)
        var request = URLRequest(url: baseURL.appending(path: "api/session/hint"), timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let data = try await responseData(for: request)
        let response = try JSONDecoder().decode(HintResponse.self, from: data)
        guard response.ok, let hint = response.hint else { throw URLError(.badServerResponse) }
        return hint
    }

    private func responseData(for request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
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
