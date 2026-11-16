import SwiftUI

struct ClassicRoadView: View {
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
    @State private var hintMessage: String?
    @State private var hintRequest: UUID?
    @State private var showHelp = false

    private let client = ClassicRoadClient()
    private var run: RoadRun? { mode == .classic ? classic : expedition }
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
                            if run == nil {
                                Button("Try again") { loadID += 1 }
                                    .buttonStyle(.bordered)
                            }
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
        .onChange(of: scenePhase) { _, current in
            if current == .active { loadID += 1 }
        }
        .sheet(isPresented: $showHelp) { help }
    }

    private var header: some View {
        HStack(spacing: 9) {
            Text("GoldRoad")
                .font(.custom("Marcellus-Regular", size: 24, relativeTo: .title2))
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
            iconButton("arrow.clockwise", label: "Check for today’s road") { loadID += 1 }
                .disabled(isLoading)
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
                .disabled(locked)
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
                if run.path.count > 1 {
                    iconButton("arrow.counterclockwise", label: "Restart") { restart() }
                }
                Button {
                    requestHint(for: run)
                } label: {
                    Label("Hint", systemImage: "lightbulb.fill")
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                }
                .buttonStyle(.plain)
                .background(RoadTheme.gold.opacity(0.09), in: Capsule())
                .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.24), lineWidth: 1))
                .opacity(hintRequest != nil || run.hintsUsed >= 5 ? 0.55 : 1)
                .disabled(hintRequest != nil || run.hintsUsed >= 5)
                .accessibilityHint("\(5 - run.hintsUsed) hints left")
            } else if run.outcome == .solved {
                if mode == .classic && expeditionUnlocked {
                    Button("Play Expedition") { switchMode(.expedition) }
                        .buttonStyle(.borderedProminent)
                        .foregroundStyle(RoadTheme.ink)
                }
            } else {
                Button("Try again", systemImage: "arrow.counterclockwise") { restart() }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(RoadTheme.ink)
            }
        }
        .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
        .frame(minHeight: 44)
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

    private var help: some View {
        NavigationStack {
            List {
                Text("Start at the footprints and tap a glowing coin to move. Every coin adds its value to your score. You can visit each coin once.")
                Text("Reach the flag with exactly the target score. Undo takes back your last move. Hints highlight the next step or show where to restart.")
                Text("Solve Classic to unlock Expedition. Dashed roads subtract a toll and double solid roads add a bonus.")
            }
            .navigationTitle("How to play")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showHelp = false }
                }
            }
        }
    }

    private func status(for run: RoadRun) -> String {
        switch run.outcome {
        case .inProgress:
            run.path.count == 1 ? "You’re on the footprints. Step onto any glowing tile to begin." : ""
        case .solved: "Solved."
        case .wrongTotal:
            "You reached the finish \(abs(run.road.maxScore - run.score)) \(run.score > run.road.maxScore ? "over" : "short of") the target."
        case .deadEnd: "Dead end. Walk it again to find the way through."
        }
    }

    private func switchMode(_ mode: RoadMode) {
        guard self.mode != mode else { return }
        clearInteraction()
        self.mode = mode
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
        run.select(tile)
        save(run, for: mode)
        play(.move)
        switch run.outcome {
        case .inProgress:
            feedback = BoardFeedback(tile: tile, kind: .step)
        case .solved:
            feedback = BoardFeedback(tile: tile, kind: .step)
            play(.solve)
        case .wrongTotal, .deadEnd:
            feedback = BoardFeedback(tile: tile, kind: .failed)
            play(.deadEnd)
        }
    }

    private func undo() {
        guard var run, run.canUndo else { return }
        clearInteraction()
        run.undo()
        save(run, for: mode)
        play(.undo)
    }

    private func restart() {
        guard var run else { return }
        clearInteraction()
        run.restart()
        save(run, for: mode)
    }

    private func play(_ effect: RoadSound.Effect) {
        if !muted { sound.play(effect) }
    }

    private func clearInteraction() {
        feedback = nil
        hintMessage = nil
        hintRequest = nil
    }

    private func requestHint(for requestedRun: RoadRun) {
        guard hintRequest == nil, requestedRun.hintsUsed < 5 else { return }
        let id = UUID()
        let mode = self.mode
        let player = UUID(uuidString: playerUUID) ?? UUID()
        playerUUID = player.uuidString
        hintRequest = id
        Task {
            defer { if hintRequest == id { hintRequest = nil } }
            do {
                let hint = try await client.hint(for: requestedRun, mode: mode, player: player, session: id)
                guard hintRequest == id, var run, run == requestedRun else { return }
                run.applyHint(hint.guidePath)
                save(run, for: mode)
                hintMessage = hint.message
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
        if classic == nil { classic = restore(savedClassic) }
        if expedition == nil { expedition = restore(savedExpedition) }
        if !expeditionUnlocked { switchMode(.classic) }
        sound.prepare()
        isLoading = true
        notice = nil
        do {
            let day = try await client.fetch()
            try Task.checkCancellation()
            if let next = day.classic, next.board.isPlayable {
                if classic?.road != next {
                    switchMode(.classic)
                    clearInteraction()
                    save(RoadRun(road: next), for: .classic)
                }
                let currentExpedition = day.expedition.flatMap {
                    $0.gameNo == next.gameNo && $0.board.isPlayable ? $0 : nil
                }
                if expedition?.road != currentExpedition {
                    if mode == .expedition { clearInteraction() }
                    save(currentExpedition.map(RoadRun.init(road:)), for: .expedition)
                }
                if !expeditionUnlocked { switchMode(.classic) }
            } else {
                notice = run == nil ? "Today’s road isn’t ready yet." : "Today’s road isn’t ready yet. You’re playing a saved road."
            }
        } catch {
            guard !Task.isCancelled else { return }
            notice = run == nil ? "Couldn’t load today’s road. Try again when you’re online."
                : "Couldn’t load today’s road. You’re playing a saved road."
        }
        isLoading = false
    }
}

#Preview {
    ClassicRoadView()
        .preferredColorScheme(.dark)
}
