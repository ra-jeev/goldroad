enum RoadHints {
    static func compute(
        optimalPaths: [[Int]], pathHistory: [Int], revealedGuide: [Int] = []
    ) -> ClassicRoadClient.Hint? {
        guard let first = optimalPaths.first, !first.isEmpty else { return nil }
        var best = first
        if revealedGuide.count > 1, revealedGuide.starts(with: pathHistory),
           let guided = optimalPaths.first(where: { $0.starts(with: revealedGuide) }) {
            best = guided
        } else {
            var bestMatch = commonPrefix(first, pathHistory)
            for path in optimalPaths.dropFirst() {
                let match = commonPrefix(path, pathHistory)
                if match > bestMatch {
                    best = path
                    bestMatch = match
                }
            }
        }

        let matched = commonPrefix(best, pathHistory)
        let revealed = best.starts(with: revealedGuide) ? revealedGuide.count : 0
        if matched == pathHistory.count, matched < best.count {
            let next = max(matched, revealed)
            let tile = best[next < best.count ? next : matched]
            return .init(kind: .nextStep, guidePath: Array(best.prefix(next + 1)), nextTileIndex: tile)
        }
        if matched == 0 {
            let end = min(best.count, max(2, revealed + 1))
            return .init(kind: .diverged, guidePath: Array(best.prefix(end)),
                         divergenceTileIndex: best[0], correctTileIndex: best[end - 1])
        }
        if matched == pathHistory.count, matched == best.count {
            return .init(kind: .alreadySolved, guidePath: best)
        }

        let end = min(best.count, max(matched + 1, revealed > matched ? revealed + 1 : 0))
        return .init(kind: .diverged, guidePath: Array(best.prefix(end)),
                     divergenceTileIndex: best[matched - 1], correctTileIndex: best[end - 1])
    }

    private static func commonPrefix(_ a: [Int], _ b: [Int]) -> Int {
        zip(a, b).prefix { $0.0 == $0.1 }.count
    }
}
