import SwiftUI

struct ClassicRoadView: View {
    var onBack: (() -> Void)? = nil

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage(RoadTutorialView.seenKey) private var hasSeenTutorial = false
    @AppStorage(GameConstants.hapticsKey) private var hapticsEnabled = true
    @State private var model = DailyRoadModel()

    private var shouldOpenTutorial: Bool { !hasSeenTutorial && model.shouldOfferTutorial }

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            header
            GeometryReader { geometry in
                ScrollView {
                    VStack(spacing: 14) {
                        if model.showsUpdateScreen {
                            updateScreen
                        } else if let run = model.run {
                            game(run)
                        } else if model.isLoading {
                            ProgressView("Loading the road…")
                        }
                        if let notice = model.notice {
                            Text(notice)
                                .font(.footnote)
                                .foregroundStyle(RoadTheme.bright)
                                .multilineTextAlignment(.center)
                            if !model.waitingForRoad && !model.roadExpired {
                                Button("Try again", action: model.refresh)
                                    .buttonStyle(.bordered)
                            }
                        }
                        if model.run == nil && model.waitingForRoad {
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
        .task(id: model.loadID) { await model.loadRoad(isActive: scenePhase == .active) }
        .task(id: model.feedback?.id) {
            guard model.feedback?.kind == .solved else { return }
            if !reduceMotion {
                do { try await Task.sleep(for: .milliseconds(450)) } catch { return }
            }
            model.presentPendingResult()
        }
        .onChange(of: scenePhase) { _, phase in model.setActive(phase == .active) }
        .onDisappear { model.onDisappear() }
        .sheet(isPresented: $model.showHelp) { RoadTutorialView(onFinish: { model.showHelp = false }) }
        .onChange(of: shouldOpenTutorial) { _, shouldOpen in
            if shouldOpen { model.showHelp = true }
        }
        .sheet(isPresented: $model.resultPresented, onDismiss: model.resumeClock) {
            if let run = model.run, run.outcome == .solved {
                RoadResultView(
                    result: model.result(for: run, mode: model.mode),
                    classicResult: model.mode == .expedition ? model.classic.flatMap {
                        $0.outcome == .solved ? model.result(for: $0, mode: .classic) : nil
                    } : nil,
                    onContinueToExpedition: model.mode == .classic && model.expeditionUnlocked
                        && !model.roadExpired && !model.updateRequired
                        ? { model.resultPresented = false; model.switchMode(.expedition) } : nil,
                    onDismiss: { model.resultPresented = false }
                )
            }
        }
        .alert("Start over?", isPresented: $model.confirmRestart) {
            Button("Keep playing", role: .cancel) {}
            Button("Try again", role: .destructive) { model.restart() }
        } message: {
            Text("This ends your current try and starts a new one.")
        }
        .onChange(of: model.roadExpired) { _, expired in
            if expired { model.onRoadExpired() }
        }
    }

    private var updateScreen: some View {
        VStack(spacing: 12) {
            Text("Update GoldRoad").font(.title2).accessibilityAddTraits(.isHeader)
            Text("Update the app to play the next road.")
                .multilineTextAlignment(.center)
            let listing = Bundle.main.object(forInfoDictionaryKey: "GoldRoadAppStoreURL") as? String
            let customURL = listing.flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
            let url = customURL ?? URL(string: "https://apps.apple.com/us/iphone/search?term=GoldRoad")!
            Link("Open the App Store", destination: url).buttonStyle(.borderedProminent)
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
            if let day = model.run?.road.gameNo {
                Text("Day #\(day)")
                    .font(.custom("Chivo-Bold", size: 14, relativeTo: .subheadline))
                    .foregroundStyle(RoadTheme.bright.opacity(0.82))
            }
            Spacer(minLength: 4)
            iconButton(model.muted ? "speaker.slash.fill" : "speaker.wave.2.fill",
                       label: model.muted ? "Unmute sounds" : "Mute sounds", action: model.toggleMute)
            iconButton(hapticsEnabled ? "waveform" : "waveform.slash",
                       label: hapticsEnabled ? "Turn haptics off" : "Turn haptics on") {
                hapticsEnabled.toggle()
            }
            iconButton("questionmark.circle", label: "How to play") { model.showHelp = true }
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
            if model.roadExpired {
                Text(model.nextDay == nil ? "You can still finish this road." : "The new road is ready. You can still finish this one.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("rollover-notice")
            }
            if model.mode == .expedition {
                HStack(spacing: 18) {
                    Text("Toll −\(run.road.board.tollValue)").foregroundStyle(RoadTheme.toll)
                    Text("Bonus +\(run.road.board.bonusValue)").foregroundStyle(RoadTheme.bonus)
                }
                .font(.custom("Chivo-Bold", size: 14, relativeTo: .subheadline))
                .padding(.top, 6)
            }
            RoadBoardView(run: run, feedback: model.feedback, onSelect: model.selectTile)
                .id(model.mode)
                .padding(.top, model.mode == .classic ? 21 : 4)
            Text(model.hintMessage ?? status(for: run))
                .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                .foregroundStyle(RoadTheme.bright)
                .multilineTextAlignment(.center)
                .frame(minHeight: 46)
                .padding(.top, 7)
                .accessibilityIdentifier("road-status")
            actions(run)
            replayAction(run)
            if model.roadExpired && !model.updateRequired { newRoadButton }
            if model.replay == nil, run.outcome == .solved, !model.roadExpired,
               let cutoff = model.classic?.road.cutoff {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    if cutoff > context.date {
                        HStack(spacing: 5) {
                            Text("Next road in")
                            Text(timerInterval: context.date...cutoff, countsDown: true)
                                .monospacedDigit()
                                .fixedSize()
                        }
                        .font(.footnote)
                    }
                }
            }
        }
    }

    private var modes: some View {
        HStack(spacing: 2) {
            ForEach(RoadMode.allCases, id: \.self) { option in
                let active = model.mode == option
                let locked = option == .expedition && !model.expeditionUnlocked
                let solved = (option == .classic ? model.classic : model.expedition)?.outcome == .solved
                Button {
                    model.switchMode(option)
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
                .disabled(locked || model.roadExpired || model.updateRequired)
                .accessibilityAddTraits(active ? .isSelected : [])
                .accessibilityHint(locked ? "Solve Classic to unlock Expedition." : solved ? "Solved" : "")
            }
        }
        .padding(3)
        .background(RoadTheme.gold.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.22), lineWidth: 1))
    }

    private func metrics(_ run: RoadRun) -> some View {
        let scoreColor = model.mode == .classic && run.score > run.road.maxScore ? RoadTheme.toll : RoadTheme.gold
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
        KeyframeAnimator(initialValue: 0.0, trigger: model.hintNudgeSignal) { light in
            actionButtons(run, hintLight: reduceMotion ? 0 : light)
        } keyframes: { _ in
            LinearKeyframe(1, duration: 0.12)
            LinearKeyframe(0, duration: 0.14)
            LinearKeyframe(0, duration: 0.08)
            LinearKeyframe(1, duration: 0.12)
            LinearKeyframe(0, duration: 0.24)
        }
    }

    private func actionButtons(_ run: RoadRun, hintLight: Double) -> some View {
        HStack(spacing: 15) {
            if run.outcome == .inProgress {
                if run.canUndo {
                    iconButton("arrow.uturn.backward", label: "Undo") { model.undo() }
                }
                if run.path.count > 1 && !model.roadExpired {
                    iconButton("arrow.counterclockwise", label: "Try again") { model.confirmRestart = true }
                }
                if !model.roadExpired && !model.updateRequired && model.replay == nil {
                    Button {
                        model.requestHint(for: run)
                    } label: {
                        Label {
                            Text(model.hintRequest != nil ? "Loading hint…" : "Hint · \(GameConstants.hintsPerMode - run.hintsUsed)")
                        } icon: {
                            Image(systemName: "lightbulb.fill")
                                .scaleEffect(1 + hintLight * 0.18)
                                .shadow(color: RoadTheme.gold.opacity(hintLight), radius: 6)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                    }
                    .buttonStyle(.plain)
                    .background(RoadTheme.gold.opacity(0.09), in: Capsule())
                    .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.24), lineWidth: 1))
                    .opacity(model.hintRequest != nil || run.hintsUsed >= GameConstants.hintsPerMode ? 0.55 : 1)
                    .disabled(model.hintRequest != nil || run.hintsUsed >= GameConstants.hintsPerMode)
                    .accessibilityHint("\(GameConstants.hintsPerMode - run.hintsUsed) hints left")
                }
            } else if run.outcome == .solved {
                if !model.roadExpired && model.replay == nil {
                    Button("View result", systemImage: "medal") { model.resultPresented = true }
                        .buttonStyle(.bordered)
                }
                if model.mode == .classic && model.expeditionUnlocked && !model.roadExpired {
                    Button("Play Expedition") { model.switchMode(.expedition) }
                        .buttonStyle(.borderedProminent)
                        .foregroundStyle(RoadTheme.ink)
                }
            } else if !model.roadExpired {
                Button("Try again", systemImage: "arrow.counterclockwise") { model.restart() }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(RoadTheme.ink)
            }
        }
        .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
        .frame(minHeight: 44)
    }

    @ViewBuilder
    private func replayAction(_ run: RoadRun) -> some View {
        if model.replay != nil {
            Button("End replay", action: model.endReplay)
                .buttonStyle(.bordered)
        } else if run.outcome == .solved, !model.roadExpired {
            Button("Replay road", action: model.beginReplay)
                .buttonStyle(.bordered)
        }
    }

    private var newRoadButton: some View {
        Button(model.nextDay == nil ? "Check for new road" : "Play the new road", action: model.advanceRoad)
            .buttonStyle(.bordered)
            .disabled(model.isLoading)
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
        case .solved:
            model.replay != nil ? "Solved again." : model.roadExpired ? "Solved. Saved to Past Roads." : "Solved."
        case .wrongTotal:
            "You reached the finish \(abs(run.road.maxScore - run.score)) \(run.score > run.road.maxScore ? "over" : "short of") the target."
        case .deadEnd: "Dead end. Walk it again to find the way through."
        }
    }


}

#Preview {
    ClassicRoadView()
        .preferredColorScheme(.dark)
}
