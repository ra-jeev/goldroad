import Foundation
import Observation

@MainActor
@Observable
final class DailyRoadModel {
    private(set) var classic: RoadRun?
    private(set) var expedition: RoadRun?
    private(set) var feedback: BoardFeedback?
    private(set) var isLoading = true
    private(set) var notice: String?
    private(set) var loadID = 0
    private(set) var nextDay: ClassicRoadClient.RoadDay?
    private(set) var waitingForRoad = false
    private(set) var updateRequired = false
    private var allowedSavedRoad: Int?
    private(set) var hintMessage: String?
    private(set) var hintRequest: UUID?
    private(set) var hintNudgeSignal = 0
    private var hintNudgeLevels: [RoadMode: Int] = [:]
    private var resultPending = false
    private(set) var replay: RoadRun?
    private(set) var muted: Bool
    private(set) var mode: RoadMode {
        didSet { defaults.set(mode.rawValue, forKey: "roadMode") }
    }
    var showHelp = false {
        didSet { if showHelp { pauseClock() } else { resumeClock() } }
    }
    var confirmRestart = false {
        didSet { if confirmRestart { pauseClock() } else { resumeClock() } }
    }
    var resultPresented = false

    private var now = Date()
    @ObservationIgnored private var isActive = true
    @ObservationIgnored private var activeSince: TimeInterval?
    private let defaults: UserDefaults
    private let sound = RoadSound()
    private let client: ClassicRoadClient

    init(defaults: UserDefaults = .standard, client: ClassicRoadClient = ClassicRoadClient()) {
        self.defaults = defaults
        self.client = client
        muted = defaults.bool(forKey: "muted")
        mode = defaults.string(forKey: "roadMode").flatMap(RoadMode.init(rawValue:)) ?? .classic
    }

    var run: RoadRun? { replay ?? (mode == .classic ? classic : expedition) }
    var roadExpired: Bool { nextDay != nil || classic?.road.isExpired(at: now) == true }
    var expeditionUnlocked: Bool {
        classic?.outcome == .solved && classic?.road.gameNo == expedition?.road.gameNo
    }
    var shouldOfferTutorial: Bool {
        guard !isLoading, !updateRequired, !roadExpired, let classic,
              classic.path.count == 1, classic.attempt == 1, classic.hintsUsed == 0 else { return false }
        return defaults.data(forKey: DailyRoadRecord.storageKey)?.isEmpty != false
    }

    var showsUpdateScreen: Bool {
        guard updateRequired else { return false }
        guard let run, replay == nil, run.outcome != .solved else { return true }
        return run.road.gameNo != allowedSavedRoad
    }

    func refresh() { loadID += 1 }

    func setActive(_ active: Bool) {
        isActive = active
        if active { refresh() } else { pauseClock() }
    }

    func onDisappear() {
        pauseClock()
        clearInteraction()
    }

    func onRoadExpired() {
        confirmRestart = false
        pauseClock()
    }

    func toggleMute() {
        muted.toggle()
        defaults.set(muted, forKey: "muted")
        if muted { sound.stop() }
    }

    func beginReplay() {
        guard let run, run.outcome == .solved, !roadExpired, !updateRequired else { return }
        clearInteraction()
        replay = RoadRun(road: run.road)
    }

    func endReplay() {
        replay = nil
        clearInteraction()
    }

    func advanceRoad() {
        guard !updateRequired else { return }
        if let nextDay, nextDay.availability(after: classic?.road, at: Date()) == .ready {
            openRoadDay(nextDay)
        } else {
            nextDay = nil
        }
        refresh()
    }

    func switchMode(_ mode: RoadMode) {
        guard self.mode != mode else { return }
        pauseClock()
        clearInteraction()
        replay = nil
        self.mode = mode
        resumeClock()
    }

    func selectTile(_ tile: Int) {
        guard var run, run.outcome == .inProgress, tile != run.current else { return }
        if tile == run.previous && run.canUndo {
            undo()
            return
        }
        guard run.legalMoves.contains(tile) else {
            feedback = BoardFeedback(tile: tile, kind: .denied)
            play(.deny)
            return
        }

        clearInteraction()
        let countsAsDaily = replay == nil && !roadExpired && classic?.road.isExpired(at: Date()) != true
        if countsAsDaily {
            if activeSince == nil { activeSince = ProcessInfo.processInfo.systemUptime }
            bankTime(into: &run)
        }
        run.select(tile)
        saveProgress(run)
        if countsAsDaily {
            DailyRoadRecord.record(run, mode: mode)
            if !updateRequired { DailyRoadAnalytics.shared.startIfNeeded(for: run, mode: mode) }
        }
        play(.move)
        if countsAsDaily && run.outcome != .solved { resumeClock() }
        switch run.outcome {
        case .inProgress:
            feedback = BoardFeedback(tile: tile, kind: .step)
        case .solved:
            if updateRequired { allowedSavedRoad = nil }
            feedback = BoardFeedback(tile: tile, kind: .solved)
            ArchiveCompletion.record(run.road.gameNo, mode)
            play(.solve)
            if countsAsDaily && !updateRequired { DailyRoadAnalytics.shared.recordSolve(for: run, mode: mode) }
            resultPending = countsAsDaily
        case .wrongTotal, .deadEnd:
            feedback = BoardFeedback(tile: tile, kind: .failed)
            play(.deadEnd)
        }
    }

    func presentPendingResult() {
        guard resultPending else { return }
        resultPending = false
        resultPresented = true
    }

    func undo() {
        guard var run, run.canUndo else { return }
        clearInteraction()
        bankTime(into: &run)
        run.undo()
        saveProgress(run)
        resumeClock()
        play(.undo)
    }

    func restart() {
        guard !roadExpired, classic?.road.isExpired(at: Date()) != true, var run else { return }
        clearInteraction()
        bankTime(into: &run)
        run.restart()
        saveProgress(run)
        if replay == nil {
            DailyRoadRecord.record(run, mode: mode)
            nudgeHintIfStuck(run)
        }
    }

    private func nudgeHintIfStuck(_ run: RoadRun) {
        guard !updateRequired, run.hintsUsed == 0 else { return }
        let level = hintNudgeLevels[mode, default: 0]
        let first = level == 0 && run.attempt >= 3
        let second = level == 1 && (run.attempt >= 6 || (run.activeTime ?? 0) >= 300)
        guard first || second else { return }
        hintNudgeLevels[mode] = level + 1
        hintNudgeSignal += 1
    }

    private func play(_ effect: RoadSound.Effect) {
        if !muted { sound.play(effect) }
    }

    func result(for run: RoadRun, mode: RoadMode) -> RoadResult {
        RoadResult(gameNo: run.road.gameNo, mode: mode, attempts: run.attempt,
                   elapsed: run.activeTime, hintsUsed: run.hintsUsed)
    }

    private func bankTime(into run: inout RoadRun) {
        guard let activeSince else { return }
        self.activeSince = nil
        run.addActiveTime(ProcessInfo.processInfo.systemUptime - activeSince)
    }

    private func pauseClock() {
        guard activeSince != nil, var run else { return }
        bankTime(into: &run)
        save(run, for: mode)
    }

    func resumeClock() {
        guard activeSince == nil, isActive, replay == nil, !roadExpired, !showHelp,
              !confirmRestart, !resultPresented, let run,
              run.outcome != .solved, run.path.count > 1 else { return }
        activeSince = ProcessInfo.processInfo.systemUptime
    }

    private func clearInteraction() {
        feedback = nil
        hintMessage = nil
        hintRequest = nil
        resultPending = false
    }

    func requestHint(for requestedRun: RoadRun) {
        guard !updateRequired, !roadExpired, classic?.road.isExpired(at: Date()) != true,
              hintRequest == nil, requestedRun.hintsUsed < GameConstants.hintsPerMode else { return }
        let id = UUID()
        let mode = self.mode
        let player = defaults.string(forKey: "playerUUID").flatMap(UUID.init(uuidString:)) ?? UUID()
        defaults.set(player.uuidString, forKey: "playerUUID")
        hintRequest = id
        Task {
            defer { if hintRequest == id { hintRequest = nil } }
            do {
                let hint = try await client.hint(for: requestedRun, mode: mode, player: player, session: id)
                guard hintRequest == id, !roadExpired, var run, run == requestedRun,
                      !run.road.isExpired(at: Date()) else { return }
                run.applyHint(hint.guidePath)
                save(run, for: mode)
                DailyRoadRecord.record(run, mode: mode)
                hintMessage = hint.message(highlightedCount: max(0, run.visibleGuide.count - 1))
            } catch {
                if hintRequest == id { hintMessage = "Couldn’t load a hint. Try again in a moment." }
            }
        }
    }

    private func save(_ run: RoadRun?, for mode: RoadMode) {
        let data = run.flatMap { try? JSONEncoder().encode($0.snapshot) } ?? Data()
        switch mode {
        case .classic:
            classic = run
            defaults.set(data, forKey: "classicRun.v1")
        case .expedition:
            expedition = run
            defaults.set(data, forKey: "expeditionRun.v1")
        }
    }

    private func saveProgress(_ run: RoadRun) {
        if replay != nil { replay = run } else { save(run, for: mode) }
    }

    private func restore(_ data: Data) -> RoadRun? {
        guard let snapshot = try? JSONDecoder().decode(RoadRun.Snapshot.self, from: data) else { return nil }
        return RoadRun(snapshot: snapshot)
    }

    func loadRoad(isActive: Bool) async {
        self.isActive = isActive
        guard isActive else { return }
        if classic == nil { classic = restore(defaults.data(forKey: "classicRun.v1") ?? Data(), mode: .classic) }
        if expedition == nil { expedition = restore(defaults.data(forKey: "expeditionRun.v1") ?? Data(), mode: .expedition) }
        if !expeditionUnlocked { switchMode(.classic) }
        sound.prepare()
        resumeClock()
        await checkForRoad()
        guard !Task.isCancelled, !updateRequired else { return }

        if let cutoff = classic?.road.cutoff, !roadExpired {
            do {
                try await Task.sleep(for: .seconds(max(0, cutoff.timeIntervalSinceNow)))
            } catch { return }
            await checkForRoad()
        }
        for _ in 0..<5 {
            guard !Task.isCancelled, nextDay == nil, waitingForRoad || roadExpired else { return }
            do {
                try await Task.sleep(for: .seconds(5))
            } catch { return }
            await checkForRoad()
        }
    }

    private func restore(_ data: Data, mode: RoadMode) -> RoadRun? {
        let restored = restore(data)
        if let restored, restored.outcome == .solved {
            ArchiveCompletion.record(restored.road.gameNo, mode)
        }
        return restored
    }

    private func checkForRoad() async {
        guard !Task.isCancelled else { return }
        now = Date()
        if roadExpired { clearInteraction() }
        isLoading = true
        defer { if !Task.isCancelled { isLoading = false } }
        do {
            let day = try await client.fetch()
            try Task.checkCancellation()
            updateRequired = day.requiresUpdate(installed: client.installedVersion)
            if updateRequired {
                if let run, replay == nil, run.outcome != .solved,
                   run.path.count > 1 || run.attempt > 1 || run.hintsUsed > 0 {
                    allowedSavedRoad = run.road.gameNo
                }
                clearInteraction()
                nextDay = nil
                waitingForRoad = false
                notice = nil
                return
            }
            allowedSavedRoad = nil
            now = Date()
            if nextDay?.classic?.isExpired(at: now) == true { nextDay = nil }
            notice = nil
            switch day.availability(after: classic?.road, at: now) {
            case .open:
                openRoadDay(day)
            case .ready:
                nextDay = day
                waitingForRoad = false
                clearInteraction()
            case .sameDay:
                if let published = day.classic, var run = classic {
                    run.updateSchedule(from: published)
                    if run != classic { save(run, for: .classic) }
                }
                if !roadExpired, let published = day.playableExpedition {
                    if var run = expedition, run.road.gameNo == published.gameNo {
                        run.updateSchedule(from: published)
                        if run != expedition { save(run, for: .expedition) }
                    } else {
                        save(RoadRun(road: published), for: .expedition)
                    }
                }
                waitingForRoad = roadExpired && nextDay == nil
                if !roadExpired {
                    if let classic { DailyRoadRecord.record(classic, mode: .classic) }
                    if let expedition, expedition.road.gameNo == classic?.road.gameNo {
                        DailyRoadRecord.record(expedition, mode: .expedition)
                    }
                }
            case .waiting:
                waitingForRoad = nextDay == nil && (classic == nil || roadExpired)
                if !waitingForRoad && nextDay == nil {
                    notice = "Today’s road is unavailable. You can still play the saved puzzle."
                }
            }
            if waitingForRoad {
                notice = "The new road is still being prepared."
            }
            if roadExpired {
                hintMessage = nil
                hintRequest = nil
            }
        } catch {
            guard !Task.isCancelled else { return }
            notice = "Couldn’t check for today’s road. Try again when you’re online."
        }
    }

    private func openRoadDay(_ day: ClassicRoadClient.RoadDay) {
        guard let newClassic = day.classic else { return }
        pauseClock()
        clearInteraction()
        replay = nil
        nextDay = nil
        hintNudgeLevels.removeAll()
        waitingForRoad = false
        notice = nil
        mode = .classic
        save(RoadRun(road: newClassic), for: .classic)
        save(day.playableExpedition.map(RoadRun.init(road:)), for: .expedition)
    }
}
