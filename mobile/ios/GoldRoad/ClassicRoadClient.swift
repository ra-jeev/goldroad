import Foundation

struct ClassicRoadClient {
    struct RoadDay: Decodable {
        let classic: ClassicRoad?
        let expedition: ClassicRoad?

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

    struct Hint: Decodable {
        enum Kind: String, Decodable {
            case nextStep = "next-step"
            case diverged
            case alreadySolved = "already-solved"
        }

        let kind: Kind
        let guidePath: [Int]

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

    private struct HintRequest: Encodable {
        let playerUUID: UUID
        let gameNo: Int
        let puzzleType: String
        let sessionId: UUID
        let attemptNumber: Int
        let pathHistory: [Int]
        let guidePath: [Int]
    }

    private struct HintResponse: Decodable {
        let ok: Bool
        let hint: Hint?
    }

    private let baseURL = URL(string: "https://playgoldroad.com")!

    func fetch() async throws -> RoadDay {
        let request = URLRequest(url: baseURL.appending(path: "api/games/current"),
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        do {
            return try await send(request)
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
        let response: HintResponse = try await send(request)
        guard response.ok, let hint = response.hint else { throw URLError(.badServerResponse) }
        return hint
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(response.statusCode) else {
            throw HTTPError(status: response.statusCode)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }

    private struct HTTPError: Error {
        let status: Int
    }
}
