import Foundation

struct Fixture: Decodable {
    struct Scenario: Decodable {
        let name: String
        let taps: [Int]
        let path: [Int]
        let score: Int
        let legalMoves: [Int]
        let canUndo: Bool
        let outcome: String
    }

    let road: ClassicRoad
    let cases: [Scenario]
}

let fixtureURL = URL(fileURLWithPath: CommandLine.arguments[1])
let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: fixtureURL))
precondition(fixture.road.board.isPlayable)

for scenario in fixture.cases {
    var run = RoadRun(road: fixture.road)
    for tile in scenario.taps {
        run.select(tile)
    }
    precondition(run.path == scenario.path, "\(scenario.name): path")
    precondition(run.score == scenario.score, "\(scenario.name): score")
    precondition(run.legalMoves.sorted() == scenario.legalMoves, "\(scenario.name): legal moves")
    precondition(run.canUndo == scenario.canUndo, "\(scenario.name): canUndo")
    precondition(run.outcome.rawValue == scenario.outcome, "\(scenario.name): outcome")

    let data = try JSONEncoder().encode(run.snapshot)
    let snapshot = try JSONDecoder().decode(RoadRun.Snapshot.self, from: data)
    precondition(RoadRun(snapshot: snapshot) == run, "\(scenario.name): save and restore")
}

var undoRun = RoadRun(road: fixture.road)
undoRun.select(1)
undoRun.undo()
precondition(undoRun.path == [0] && undoRun.score == 2 && !undoRun.canUndo)

let invalidSave = RoadRun.Snapshot(road: fixture.road, path: [0, 3], undoAvailable: true)
precondition(RoadRun(snapshot: invalidSave) == nil)

let legacySave = RoadRun.Snapshot(road: fixture.road, path: [0, 1], undoAvailable: true)
precondition(RoadRun(snapshot: legacySave)?.canUndo == true)
precondition(RoadRun(snapshot: legacySave)?.hintsUsed == 0)

var hinted = RoadRun(road: fixture.road)
hinted.select(1)
hinted.applyHint([0, 1, 4])
precondition(hinted.visibleGuide == [1, 4])
hinted.select(4)
precondition(hinted.visibleGuide == [4])
hinted.restart()
precondition(hinted.path == [0] && hinted.visibleGuide == [0, 1, 4])
precondition(hinted.hintsUsed == 1 && hinted.attempt == 2)
let hintedData = try JSONEncoder().encode(hinted.snapshot)
let hintedSnapshot = try JSONDecoder().decode(RoadRun.Snapshot.self, from: hintedData)
precondition(RoadRun(snapshot: hintedSnapshot) == hinted)

print("Passed \(fixture.cases.count) gameplay cases, undo, hint progress, and save compatibility.")
