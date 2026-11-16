import SwiftUI

struct ClassicRoadView: View {
    var onBack: (() -> Void)? = nil

    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("classicRun.v1") private var savedClassic = Data()
    @AppStorage("expeditionRun.v1") private var savedExpedition = Data()
    @AppStorage("roadMode") private var mode = RoadMode.classic
    @AppStorage("muted") private var muted = false
    @AppStorage("playerUUID") private var playerUUID = ""
    @State private var classic: RoadRun?
    @State private var expedition: RoadRun?
    @State private var sound = RoadSound()
    @State private var feedback: BoardFeedback?
    @State private var isLoading = true
    @State private var notice: String?
    @State private var loadID = 0
    @State private var nextDay: ClassicRoadClient.RoadDay?
    @State private var waitingForRoad = false
    @State private var now = Date()
    @State private var hintMessage: String?
    @State private var hintRequest: UUID?
    @State private var showHelp = false
    @State private var confirmRestart = false
    @State private var resultPresented = false
    @State private var activeSince: TimeInterval?

    private let client = ClassicRoadClient()
    private var run: RoadRun? { mode == .classic ? classic : expedition }
    private var roadExpired: Bool {
        nextDay != nil || classic?.road.isExpired(at: now) == true
    }
    private var expeditionUnlocked: Bool {
        classic?.outcome == .solved && classic?.road.gameNo == expedition?.road.gameNo
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 14) {
                        if let run {
                            game(run)
                        } else if isLoading {
                            ProgressView("Loading the road…")
                        }
                        if let notice {
                            Text(notice)
                                .font(.footnote)
                                .foregroundStyle(RoadTheme.bright)
                                .multilineTextAlignment(.center)
                            if !waitingForRoad && !roadExpired {
                                Button("Try again") { loadID += 1 }
                                    .buttonStyle(.bordered)
                            }
                        }
                        if run == nil && waitingForRoad {
                            newRoadButton
                        }
                    }
                    .frame(maxWidth: 370)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity, minHeight: geometry.size.height)
                }
            }
        }
        .background {
            ZStack {
                LinearGradient(colors: [RoadTheme.color(0x1A0E03), RoadTheme.color(0x110900), RoadTheme.color(0x0D0702)],
                               startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [RoadTheme.color(0xA05A00).opacity(0.22), .clear],
                               center: UnitPoint(x: 0.15, y: 0), startRadius: 0, endRadius: 260)
            }
            .ignoresSafeArea()
        }
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .task(id: loadID) { await loadRoad() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { pauseClock() }
            loadID += 1
        }
        .onDisappear {
            pauseClock()
            clearInteraction()
        }
        .sheet(isPresented: $showHelp) { RoadTutorialView(onFinish: { showHelp = false }) }
        .sheet(isPresented: $resultPresented, onDismiss: resumeClock) {
            if let run, run.outcome == .solved {
                RoadResultView(
                    result: result(for: run, mode: mode),
                    classicResult: mode == .expedition ? classic.flatMap {
                        $0.outcome == .solved ? result(for: $0, mode: .classic) : nil
                    } : nil,
                    onContinueToExpedition: mode == .classic && expeditionUnlocked && !roadExpired
                        ? { resultPresented = false; switchMode(.expedition) } : nil,
                    onDismiss: { resultPresented = false }
                )
            }
        }
        .onChange(of: showHelp) { _, visible in
            if visible { pauseClock() } else { resumeClock() }
        }
        .alert("Start over?", isPresented: $confirmRestart) {
            Button("Keep playing", role: .cancel) {}
            Button("Try again", role: .destructive) { restart() }
        } message: {
            Text("This ends your current try and starts a new one.")
        }
        .onChange(of: roadExpired) { _, expired in
            if expired {
                confirmRestart = false
                pauseClock()
            }
        }
        .onChange(of: confirmRestart) { _, visible in
            if visible { pauseClock() } else { resumeClock() }
        }
    }

    private var header: some View {
        HStack(spacing: 9) {
            if let onBack {
                iconButton("chevron.left", label: "Home", action: onBack)
            }
            Text(onBack == nil ? "GoldRoad" : "Daily Road")
                .font(.custom("Marcellus-Regular", size: 24, relativeTo: .title2))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(
                    LinearGradient(colors: [RoadTheme.color(0xFFE08A), RoadTheme.darkGold],
                                   startPoint: .top, endPoint: .bottom)
                )
                .accessibilityAddTraits(.isHeader)
            if let day = run?.road.gameNo {
                Text("Day #\(day)")
                    .font(.custom("Chivo-Bold", size: 14, relativeTo: .subheadline))
                    .foregroundStyle(RoadTheme.bright.opacity(0.82))
            }
            Spacer(minLength: 4)
            iconButton(muted ? "speaker.slash.fill" : "speaker.wave.2.fill",
                       label: muted ? "Unmute sounds" : "Mute sounds") {
                muted.toggle()
                if muted { sound.stop() }
            }
            iconButton("questionmark.circle", label: "How to play") { showHelp = true }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .background(RoadTheme.color(0x1A0E03).opacity(0.9))
        .overlay(alignment: .bottom) {
            Rectangle().fill(RoadTheme.gold.opacity(0.17)).frame(height: 1)
        }
    }

    private func game(_ run: RoadRun) -> some View {
        VStack(spacing: 14) {
            modes
            metrics(run)
            if roadExpired {
                Text(nextDay == nil ? "You can still finish this road." : "The new road is ready. You can still finish this one.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("rollover-notice")
            }
            if mode == .expedition {
                HStack(spacing: 18) {
                    Text("Toll −\(run.road.board.tollValue)").foregroundStyle(RoadTheme.toll)
                    Text("Bonus +\(run.road.board.bonusValue)").foregroundStyle(RoadTheme.bonus)
                }
                .font(.custom("Chivo-Bold", size: 14, relativeTo: .subheadline))
                .padding(.top, 6)
            }
            RoadBoardView(run: run, feedback: feedback, onSelect: selectTile)
                .id(mode)
                .padding(.top, mode == .classic ? 21 : 4)
            Text(hintMessage ?? status(for: run))
                .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                .foregroundStyle(RoadTheme.bright)
                .multilineTextAlignment(.center)
                .frame(minHeight: 46)
                .padding(.top, 7)
                .accessibilityIdentifier("road-status")
            actions(run)
            if roadExpired { newRoadButton }
        }
    }

    private var modes: some View {
        HStack(spacing: 2) {
            ForEach(RoadMode.allCases, id: \.self) { option in
                let active = mode == option
                let locked = option == .expedition && !expeditionUnlocked
                let solved = (option == .classic ? classic : expedition)?.outcome == .solved
                Button {
                    switchMode(option)
                } label: {
                    HStack(spacing: 5) {
                        Text(option.title)
                        Image(systemName: solved ? "checkmark.circle.fill" : locked ? "lock.circle" : "circle.dotted")
                            .font(.system(size: 14))
                            .accessibilityHidden(true)
                    }
                    .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                    .padding(.horizontal, 15)
                    .frame(minHeight: 34)
                    .background(RoadTheme.gold.opacity(active ? 0.18 : 0), in: Capsule())
                    .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(active ? 0.26 : 0), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .foregroundStyle(RoadTheme.gold.opacity(locked ? 0.48 : active ? 1 : 0.72))
                .disabled(locked || roadExpired)
                .accessibilityAddTraits(active ? .isSelected : [])
                .accessibilityHint(locked ? "Solve Classic to unlock Expedition." : solved ? "Solved" : "")
            }
        }
        .padding(3)
        .background(RoadTheme.gold.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.22), lineWidth: 1))
    }

    private func metrics(_ run: RoadRun) -> some View {
        let scoreColor = mode == .classic && run.score > run.road.maxScore ? RoadTheme.toll : RoadTheme.gold
        let total = run.road.board.tiles.reduce(0, +)
        return HStack(spacing: 5) {
            Text("Score").foregroundStyle(RoadTheme.gold.opacity(0.72))
            Text(run.score, format: .number).foregroundStyle(scoreColor)
                .accessibilityIdentifier("road-score")
            Text("/").foregroundStyle(RoadTheme.gold.opacity(0.62))
            Text(run.road.maxScore, format: .number)
            Text("•").foregroundStyle(RoadTheme.gold.opacity(0.58))
            Text("Board").foregroundStyle(RoadTheme.gold.opacity(0.72))
            Text(total, format: .number)
        }
        .font(.custom("Chivo-Bold", size: 17, relativeTo: .body))
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(run.score), target \(run.road.maxScore), board \(total)")
        .accessibilityIdentifier("road-metrics")
    }

    private func actions(_ run: RoadRun) -> some View {
        HStack(spacing: 15) {
            if run.outcome == .inProgress {
                if run.canUndo {
                    iconButton("arrow.uturn.backward", label: "Undo") { undo() }
                }
                if run.path.count > 1 && !roadExpired {
                    iconButton("arrow.counterclockwise", label: "Try again") { confirmRestart = true }
                }
                if !roadExpired {
                    Button {
                        requestHint(for: run)
                    } label: {
                        Label(hintRequest != nil ? "Loading hint…" : "Hint · \(5 - run.hintsUsed)",
                              systemImage: "lightbulb.fill")
                            .padding(.horizontal, 14)
                            .frame(minHeight: 42)
                    }
                    .buttonStyle(.plain)
                    .background(RoadTheme.gold.opacity(0.09), in: Capsule())
                    .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.24), lineWidth: 1))
                    .opacity(hintRequest != nil || run.hintsUsed >= 5 ? 0.55 : 1)
                    .disabled(hintRequest != nil || run.hintsUsed >= 5)
                    .accessibilityHint("\(5 - run.hintsUsed) hints left")
                }
            } else if run.outcome == .solved {
                if !roadExpired {
                    Button("View result", systemImage: "medal") { resultPresented = true }
                        .buttonStyle(.bordered)
                }
                if mode == .classic && expeditionUnlocked && !roadExpired {
                    Button("Play Expedition") { switchMode(.expedition) }
                        .buttonStyle(.borderedProminent)
                        .foregroundStyle(RoadTheme.ink)
                }
            } else if !roadExpired {
                Button("Try again", systemImage: "arrow.counterclockwise") { restart() }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(RoadTheme.ink)
            }
        }
        .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
        .frame(minHeight: 44)
    }

    private var newRoadButton: some View {
        Button(nextDay == nil ? "Check for new road" : "Play the new road") {
            if let nextDay,
               nextDay.availability(after: classic?.road, at: Date()) == .ready {
                openRoadDay(nextDay)
                loadID += 1
            } else {
                nextDay = nil
                loadID += 1
            }
        }
        .buttonStyle(.bordered)
        .disabled(isLoading)
    }

    private func iconButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 34, height: 34)
                .background(RoadTheme.gold.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(RoadTheme.gold.opacity(0.2), lineWidth: 1))
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func status(for run: RoadRun) -> String {
        switch run.outcome {
        case .inProgress:
            run.path.count == 1 ? "You’re on the footprints. Step onto any glowing tile to begin." : ""
        case .solved: roadExpired ? "Solved. Saved to Past Roads." : "Solved."
        case .wrongTotal:
            "You reached the finish \(abs(run.road.maxScore - run.score)) \(run.score > run.road.maxScore ? "over" : "short of") the target."
        case .deadEnd: "Dead end. Walk it again to find the way through."
        }
    }

    private func switchMode(_ mode: RoadMode) {
        guard self.mode != mode else { return }
        pauseClock()
        clearInteraction()
        self.mode = mode
        resumeClock()
    }

    private func selectTile(_ tile: Int) {
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
        let countsAsDaily = !roadExpired && classic?.road.isExpired(at: Date()) != true
        if countsAsDaily {
            if activeSince == nil { activeSince = ProcessInfo.processInfo.systemUptime }
            bankTime(into: &run)
        }
        run.select(tile)
        save(run, for: mode)
        if countsAsDaily { DailyRoadRecord.record(run, mode: mode) }
        play(.move)
        if countsAsDaily && run.outcome != .solved { resumeClock() }
        switch run.outcome {
        case .inProgress:
            feedback = BoardFeedback(tile: tile, kind: .step)
        case .solved:
            feedback = BoardFeedback(tile: tile, kind: .step)
            ArchiveCompletion.record(run.road.gameNo, mode)
            play(.solve)
            resultPresented = countsAsDaily
        case .wrongTotal, .deadEnd:
            feedback = BoardFeedback(tile: tile, kind: .failed)
            play(.deadEnd)
        }
    }

    private func undo() {
        guard var run, run.canUndo else { return }
        clearInteraction()
        bankTime(into: &run)
        run.undo()
        save(run, for: mode)
        resumeClock()
        play(.undo)
    }

    private func restart() {
        guard !roadExpired, classic?.road.isExpired(at: Date()) != true, var run else { return }
        clearInteraction()
        bankTime(into: &run)
        run.restart()
        save(run, for: mode)
        DailyRoadRecord.record(run, mode: mode)
    }

    private func play(_ effect: RoadSound.Effect) {
        if !muted { sound.play(effect) }
    }

    private func result(for run: RoadRun, mode: RoadMode) -> RoadResult {
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

    private func resumeClock() {
        guard activeSince == nil, scenePhase == .active, !roadExpired, !showHelp,
              !confirmRestart, !resultPresented, let run,
              run.outcome != .solved, run.path.count > 1 else { return }
        activeSince = ProcessInfo.processInfo.systemUptime
    }

    private func clearInteraction() {
        feedback = nil
        hintMessage = nil
        hintRequest = nil
    }

    private func requestHint(for requestedRun: RoadRun) {
        guard !roadExpired, classic?.road.isExpired(at: Date()) != true,
              hintRequest == nil, requestedRun.hintsUsed < 5 else { return }
        let id = UUID()
        let mode = self.mode
        let player = UUID(uuidString: playerUUID) ?? UUID()
        playerUUID = player.uuidString
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
            savedClassic = data
        case .expedition:
            expedition = run
            savedExpedition = data
        }
    }

    private func restore(_ data: Data) -> RoadRun? {
        guard let snapshot = try? JSONDecoder().decode(RoadRun.Snapshot.self, from: data) else { return nil }
        return RoadRun(snapshot: snapshot)
    }

    private func loadRoad() async {
        guard scenePhase == .active else { return }
        if classic == nil { classic = restore(savedClassic, mode: .classic) }
        if expedition == nil { expedition = restore(savedExpedition, mode: .expedition) }
        if !expeditionUnlocked { switchMode(.classic) }
        sound.prepare()
        resumeClock()
        await checkForRoad()
        guard !Task.isCancelled else { return }

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
        nextDay = nil
        waitingForRoad = false
        notice = nil
        mode = .classic
        save(RoadRun(road: newClassic), for: .classic)
        save(day.playableExpedition.map(RoadRun.init(road:)), for: .expedition)
    }
}

#Preview {
    ClassicRoadView()
        .preferredColorScheme(.dark)
}
