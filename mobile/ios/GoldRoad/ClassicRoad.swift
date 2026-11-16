import Foundation

enum RoadMode: String, CaseIterable, Codable {
    case classic, expedition

    var title: String { rawValue.capitalized }
}

struct ClassicRoad: Codable, Equatable {
    let gameNo: Int
    let maxScore: Int
    let playableAt: String
    let board: Board
    var nextGameAt: String?

    var cutoff: Date? {
        guard let nextGameAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: nextGameAt) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: nextGameAt)
    }

    func isExpired(at date: Date) -> Bool {
        cutoff.map { $0 <= date } ?? false
    }
}

struct Board: Codable, Equatable {
    struct Edge: Codable, Hashable {
        let from: Int
        let to: Int

        func connects(_ a: Int, _ b: Int) -> Bool {
            (from == a && to == b) || (from == b && to == a)
        }
    }

    let rows: Int
    let cols: Int
    let tiles: [Int]
    let missingEdges: [Edge]
    let tollEdges: [Edge]
    let bonusEdges: [Edge]
    let tollValue: Int
    let bonusValue: Int
    let start: Int
    let end: Int

    var isPlayable: Bool {
        (3...10).contains(rows) && (3...10).contains(cols)
            && tiles.count == rows * cols
            && tiles.allSatisfy { (1...6).contains($0) }
            && tiles.indices.contains(start) && tiles.indices.contains(end) && start != end
            && tollValue > 0 && tollValue <= Int.max / 100 - 6
            && bonusValue > 0 && bonusValue <= Int.max / 100 - 6
    }

    func neighbors(of tile: Int) -> [Int] {
        let row = tile / cols
        let column = tile % cols
        return [
            row > 0 ? tile - cols : nil,
            column > 0 ? tile - 1 : nil,
            column + 1 < cols ? tile + 1 : nil,
            row + 1 < rows ? tile + cols : nil,
        ].compactMap { $0 }.filter { isConnected(tile, $0) }
    }

    func isConnected(_ from: Int, _ to: Int) -> Bool {
        !missingEdges.contains { $0.connects(from, to) }
    }

    func adjustment(from: Int, to: Int) -> Int {
        if tollEdges.contains(where: { $0.connects(from, to) }) { return -tollValue }
        if bonusEdges.contains(where: { $0.connects(from, to) }) { return bonusValue }
        return 0
    }
}

struct RoadRun: Equatable {
    enum Outcome: String {
        case inProgress
        case solved
        case wrongTotal
        case deadEnd
    }

    private(set) var road: ClassicRoad
    private(set) var path: [Int]
    private(set) var undoAvailable = false
    private(set) var attempt = 1
    private(set) var hintsUsed = 0
    private(set) var guidePath: [Int] = []
    private(set) var activeTime: TimeInterval?

    init(road: ClassicRoad) {
        self.road = road
        path = [road.board.start]
    }

    var current: Int { path[path.count - 1] }

    var previous: Int? { path.dropLast().last }

    var score: Int {
        let board = road.board
        let tileTotal = path.reduce(0) { $0 + board.tiles[$1] }
        return zip(path, path.dropFirst()).reduce(tileTotal) {
            $0 + board.adjustment(from: $1.0, to: $1.1)
        }
    }

    private var unvisitedNeighbors: [Int] {
        road.board.neighbors(of: current).filter { !path.contains($0) }
    }

    var outcome: Outcome {
        if current == road.board.end {
            return score == road.maxScore ? .solved : .wrongTotal
        }
        return unvisitedNeighbors.isEmpty ? .deadEnd : .inProgress
    }

    var legalMoves: [Int] { outcome == .inProgress ? unvisitedNeighbors : [] }

    var canUndo: Bool { undoAvailable && outcome == .inProgress }

    mutating func addActiveTime(_ seconds: TimeInterval) {
        guard seconds.isFinite && seconds >= 0 else { return }
        activeTime = min((activeTime ?? 0) + seconds, 86_400)
    }

    mutating func updateSchedule(from publishedRoad: ClassicRoad) {
        guard road.gameNo == publishedRoad.gameNo else { return }
        road.nextGameAt = publishedRoad.nextGameAt ?? road.nextGameAt
    }

    var visibleGuide: [Int] {
        let shared = zip(path, guidePath).prefix { $0.0 == $0.1 }.count
        return Array(guidePath.dropFirst(max(0, shared - 1)))
    }

    mutating func applyHint(_ route: [Int]) {
        guard hintsUsed < 5, !guidePath.starts(with: route),
              route.first == road.board.start,
              Set(route).count == route.count,
              route.allSatisfy(road.board.tiles.indices.contains),
              zip(route, route.dropFirst()).allSatisfy({
                  road.board.neighbors(of: $0.0).contains($0.1)
              }) else { return }
        hintsUsed += 1
        guidePath = route
    }

    mutating func restart() {
        if path.count > 1 { attempt = min(attempt + 1, 1000) }
        path = [road.board.start]
        undoAvailable = false
    }

    mutating func select(_ tile: Int) {
        if tile == previous && canUndo {
            undo()
        } else if legalMoves.contains(tile) {
            path.append(tile)
            undoAvailable = outcome == .inProgress
        }
    }

    mutating func undo() {
        guard canUndo else { return }
        path.removeLast()
        undoAvailable = false
    }

    struct Snapshot: Codable {
        let road: ClassicRoad
        let path: [Int]
        let undoAvailable: Bool
        var attempt: Int?
        var hintsUsed: Int?
        var guidePath: [Int]?
        var activeTime: TimeInterval?
    }

    var snapshot: Snapshot {
        Snapshot(road: road, path: path, undoAvailable: undoAvailable,
                 attempt: attempt, hintsUsed: hintsUsed, guidePath: guidePath, activeTime: activeTime)
    }

    init?(snapshot: Snapshot) {
        let road = snapshot.road
        guard road.board.isPlayable, snapshot.path.first == road.board.start else { return nil }
        self.init(road: road)
        for tile in snapshot.path.dropFirst() {
            guard legalMoves.contains(tile) else { return nil }
            select(tile)
        }
        undoAvailable = undoAvailable && snapshot.undoAvailable
        attempt = min(max(1, snapshot.attempt ?? 1), 1000)
        hintsUsed = min(max(0, snapshot.hintsUsed ?? 0), 5)
        guidePath = snapshot.guidePath ?? []
        if let activeTime = snapshot.activeTime { addActiveTime(activeTime) }
    }
}
