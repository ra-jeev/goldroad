import Foundation

struct Fixture: Decodable {
    struct Scenario: Decodable {
        struct Hint: Decodable { let guidePath: [Int] }
        let name: String
        let taps: [Int]
        let road: ClassicRoad?
        let hintBeforeTap: Int?
        let hintResult: Hint?
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
    var run = RoadRun(road: scenario.road ?? fixture.road)
    for (index, tile) in scenario.taps.enumerated() {
        if scenario.hintBeforeTap == index, let hint = scenario.hintResult { run.applyHint(hint.guidePath) }
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
hinted.applyHint([0, 1])
hinted.applyHint([0, 1, 4])
precondition(hinted.hintsUsed == 1 && hinted.guidePath == [0, 1, 4])
hinted.applyHint([0, 1, 4, 5])
precondition(hinted.hintsUsed == 2 && hinted.guidePath == [0, 1, 4, 5])
hinted.applyHint([0, 1, 2])
precondition(hinted.hintsUsed == 3 && hinted.guidePath == [0, 1, 2])

print("Passed \(fixture.cases.count) gameplay cases, undo, hint progress, and save compatibility.")

var outgoing = fixture.road
outgoing.nextGameAt = "2026-01-02T00:00:00.000Z"
let cutoff = outgoing.cutoff!
let beforeCutoff = cutoff.addingTimeInterval(-1)
let oldDay = ClassicRoadClient.RoadDay(classic: outgoing, expedition: nil)
precondition(oldDay.availability(after: nil, at: beforeCutoff) == .open)
precondition(oldDay.availability(after: nil, at: cutoff) == .waiting)
precondition(oldDay.availability(after: outgoing, at: cutoff) == .sameDay)
precondition(ClassicRoadClient.RoadDay(classic: nil, expedition: nil)
    .availability(after: outgoing, at: cutoff) == .waiting)

let incoming = ClassicRoad(gameNo: outgoing.gameNo + 1, maxScore: outgoing.maxScore,
                           playableAt: "2026-01-02T00:00:00Z", board: outgoing.board,
                           nextGameAt: "2026-01-03T00:00:00Z")
let newDay = ClassicRoadClient.RoadDay(classic: incoming, expedition: outgoing)
precondition(newDay.availability(after: outgoing, at: cutoff) == .ready)
precondition(newDay.playableExpedition == nil)
precondition(oldDay.availability(after: incoming, at: beforeCutoff) == .waiting)

var restored = RoadRun(snapshot: legacySave)!
restored.updateSchedule(from: outgoing)
precondition(restored.road.isExpired(at: cutoff))
precondition(restored.path == [0, 1] && restored.canUndo)
restored.updateSchedule(from: incoming)
precondition(restored.road == outgoing)
print("Passed rollover availability and legacy schedule migration cases.")

precondition(restored.activeTime == nil)
restored.addActiveTime(12.5)
restored.addActiveTime(-1)
restored.addActiveTime(.infinity)
restored.restart()
restored.addActiveTime(7.5)
let timeData = try JSONEncoder().encode(restored.snapshot)
let timeSnapshot = try JSONDecoder().decode(RoadRun.Snapshot.self, from: timeData)
precondition(RoadRun(snapshot: timeSnapshot)?.activeTime == 20)
print("Passed accumulated active-time restore.")
