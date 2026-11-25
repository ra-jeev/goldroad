import StoreKit
import SwiftUI

struct ClassicRoadView: View {
    var onBack: (() -> Void)? = nil

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.requestReview) private var requestReview
    @AppStorage(RoadTutorialView.seenKey) private var hasSeenTutorial = false
    @State private var model: DailyRoadModel
    @State private var showStats = false
    @State private var askReminder = false
    @State private var askStatsConsent = false
    @AppStorage("dailyReminder.asked") private var reminderAsked = false
    @State private var reviewTask: Task<Void, Never>?

    init(startMode: RoadMode = .classic, prefetched: ClassicRoadClient.RoadDay? = nil,
         onBack: (() -> Void)? = nil) {
        self.onBack = onBack
        _model = State(initialValue: DailyRoadModel(startMode: startMode, prefetched: prefetched))
    }

    private var title: String {
        guard let run = model.run, !model.holdsStaleRoad else { return model.mode.title }
        return "\(model.mode.title) · Day #\(run.road.gameNo)"
    }

    private var shouldOpenTutorial: Bool { !hasSeenTutorial && model.shouldOfferTutorial }

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            RoadTopBar(title: title, onBack: onBack) {
                BarIconButton(icon: "questionmark", label: "How to play") { model.showHelp = true }
                BarIconButton(icon: "ellipsis", label: "Settings") { model.showSettings = true }
            }
            if model.showsUpdateScreen {
                centered { updateScreen }
            } else if let run = model.run, !model.holdsStaleRoad {
                game(run)
            } else {
                centered { loadingOrNotice }
            }
        }
        .background(RoadTheme.screenBackground)
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .task(id: model.loadID) { await model.loadRoad(isActive: scenePhase == .active) }
        .task(id: model.feedback?.id) {
            guard model.feedback?.kind == .solved else { return }
            if !reduceMotion {
                do { try await Task.sleep(for: .milliseconds(650)) } catch { return }
            }
            model.presentPendingResult()
        }
        .onChange(of: scenePhase) { _, phase in
            reviewTask?.cancel()
            model.setActive(phase == .active)
        }
        .onChange(of: showStats) { _, shown in if shown { reviewTask?.cancel() } }
        .onDisappear {
            reviewTask?.cancel()
            model.onDisappear()
        }
        .sheet(isPresented: $model.showHelp) { RoadTutorialView(onFinish: { model.showHelp = false }) }
        .sheet(isPresented: $model.showSettings) { SettingsView(onDone: { model.showSettings = false }) }
        .onChange(of: shouldOpenTutorial, initial: true) { _, shouldOpen in
            if shouldOpen { model.showHelp = true }
        }
        .sheet(isPresented: $model.resultPresented, onDismiss: resultClosed) {
            if let run = model.run, run.outcome == .solved {
                RoadResultView(
                    result: model.result(for: run, mode: model.mode),
                    classicResult: model.mode == .expedition ? solvedClassicResult : nil,
                    cutoff: model.classic?.road.cutoff,
                    onContinueToExpedition: canContinueToExpedition
                        ? { model.resultPresented = false; model.switchMode(.expedition) } : nil,
                    onViewStats: { model.resultPresented = false; showStats = true },
                    onDismiss: { model.resultPresented = false }
                )
            }
        }
        .navigationDestination(isPresented: $showStats) {
            RoadStatsView(onBack: { showStats = false })
                .toolbar(.hidden, for: .navigationBar)
        }
        .alert("Help build community stats?", isPresented: $askStatsConsent) {
            Button("Not now", role: .cancel) { DailyRoadAnalytics.shared.setConsent(false) }
            Button("Share") { DailyRoadAnalytics.shared.setConsent(true) }
        } message: {
            Text("Send your daily results with a random player ID, so everyone can see how the field played. No name or account. You can change this in Settings.")
        }
        .alert("Get a reminder?", isPresented: $askReminder) {
            Button("Not now", role: .cancel) {}
            Button("Remind me") { Task { await RoadReminder.shared.setEnabled(true) } }
        } message: {
            Text("We can tell you when the next road opens. You can change this in Settings.")
        }
        .alert("Start over?", isPresented: $model.confirmRestart) {
            Button("Keep playing", role: .cancel) {}
            Button("Try again", role: .destructive) { model.restart() }
        } message: {
            Text("Your current route will be cleared and this will spend a try.")
        }
        .onChange(of: model.roadExpired) { _, expired in
            if expired { model.onRoadExpired() }
        }
    }

    /// After the first solve, ask about community stats. Ask about the reminder once, at a later
    /// solve, so the player never gets two questions in a row. After that both live in Settings.
    /// A rating request comes last, at a later solve, once per app version.
    private func resultClosed() {
        model.resumeClock()
        if DailyRoadAnalytics.shared.consent == nil {
            Task {
                try? await Task.sleep(for: .milliseconds(400))
                askStatsConsent = true
            }
            return
        }
        if !reminderAsked, !RoadReminder.shared.enabled {
            reminderAsked = true
            Task {
                try? await Task.sleep(for: .milliseconds(400))
                askReminder = true
            }
            return
        }
        guard model.run?.outcome == .solved, RoadReview.shouldAsk() else { return }
        // Wait for the sheet to settle. Leaving the app, opening Stats or leaving the board
        // cancels the wait; starting a replay or opening another sheet skips the request.
        reviewTask?.cancel()
        reviewTask = Task {
            do { try await Task.sleep(for: .milliseconds(600)) } catch { return }
            guard !Task.isCancelled, model.replay == nil, model.run?.outcome == .solved,
                  !model.resultPresented, !model.showHelp, !model.showSettings, !model.confirmRestart,
                  !showStats else { return }
            RoadReview.markAsked()
            requestReview()
        }
    }

    private var solvedClassicResult: RoadResult? {
        model.classic.flatMap { $0.outcome == .solved ? model.result(for: $0, mode: .classic) : nil }
    }

    private var canContinueToExpedition: Bool {
        model.mode == .classic && model.expeditionUnlocked && !model.roadExpired && !model.updateRequired
    }

    private func centered<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(spacing: 14) { content() }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var loadingOrNotice: some View {
        if model.isLoading && model.notice == nil {
            ProgressView("Loading the road…")
        }
        if let notice = model.notice {
            Text(notice)
                .font(.callout)
                .foregroundStyle(RoadTheme.gold)
                .multilineTextAlignment(.center)
            if model.waitingForRoad {
                newRoadButton
            } else if !model.roadExpired {
                Button("Try again", action: model.refresh).buttonStyle(.goldSecondary)
            }
        }
    }

    private var updateScreen: some View {
        VStack(spacing: 12) {
            Text("Update GoldRoad").font(RoadFont.title(28)).accessibilityAddTraits(.isHeader)
            Text("Update the app to play the next road.")
                .multilineTextAlignment(.center)
            let listing = Bundle.main.object(forInfoDictionaryKey: "GoldRoadAppStoreURL") as? String
            let customURL = listing.flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
            let url = customURL ?? URL(string: "https://apps.apple.com/us/iphone/search?term=GoldRoad")!
            Link("Open the App Store", destination: url).buttonStyle(.goldPrimary)
        }
    }

    // MARK: Board

    private func game(_ run: RoadRun) -> some View {
        RoadScreenLayout {
            VStack(spacing: 12) {
                RoadMetricsLine(run: run, mode: model.mode)
                RoadLegend(board: run.road.board, visible: model.mode == .expedition)
            }
        } board: {
            RoadBoardView(run: run, feedback: model.feedback, onSelect: model.selectTile)
                .id(model.mode)
        } footer: {
            footer(run)
        }
    }

    private func footer(_ run: RoadRun) -> some View {
        VStack(spacing: 6) {
            if model.replay != nil {
                replayFooter(run)
            } else if run.outcome == .solved {
                solvedStatus
                solvedActions(run)
            } else {
                // On rollover the new-road button takes the status slot, so the footer keeps its height.
                if model.roadExpired && !model.updateRequired {
                    newRoadButton.frame(height: 44)
                } else {
                    RoadStatusLine(text: model.hintMessage ?? RoadStatusCopy.text(for: run))
                }
                RoadPlayControls(
                    hintsLeft: GameConstants.hintsPerMode - run.hintsUsed,
                    hintEnabled: hintAvailable(run),
                    hintLoading: model.hintRequest != nil,
                    hintNudge: model.hintNudgeSignal,
                    retry: RoadStatusCopy.retry(for: run, canRetry: !model.roadExpired),
                    canUndo: run.canUndo,
                    onHint: { model.requestHint(for: run) },
                    onRetry: { run.outcome == .inProgress ? (model.confirmRestart = true) : model.restart() },
                    onUndo: model.undo
                )
            }
        }
    }

    @ViewBuilder
    private func replayFooter(_ run: RoadRun) -> some View {
        if run.outcome == .solved {
            RoadStatusLine(text: "Solved again. Replays do not change your stats.")
            HStack(spacing: 10) {
                Button("End replay", action: model.endReplay)
                    .buttonStyle(.goldSecondary)
                Button("Replay again", action: model.restart)
                    .buttonStyle(.goldPrimary)
            }
        } else {
            RoadStatusLine(text: run.outcome == .inProgress && run.path.count == 1
                           ? "Replaying today’s road. It does not change your stats."
                           : RoadStatusCopy.text(for: run))
            RoadPlayControls(
                hintsLeft: nil, hintEnabled: false, hintLoading: false,
                retry: RoadStatusCopy.retry(for: run, canRetry: true),
                canUndo: run.canUndo,
                onHint: {}, onRetry: model.restart, onUndo: model.undo,
                onExit: model.endReplay
            )
        }
    }

    private func hintAvailable(_ run: RoadRun) -> Bool {
        run.outcome == .inProgress && !model.roadExpired && !model.updateRequired
            && model.replay == nil && run.hintsUsed < GameConstants.hintsPerMode
    }

    @ViewBuilder
    private var solvedStatus: some View {
        Group {
            if model.roadExpired {
                Text(model.nextDay == nil ? "Solved. Saved to Past Roads." : "A new road just opened.")
            } else if let cutoff = model.classic?.road.cutoff {
                NextRoadCountdown(cutoff: cutoff)
            } else {
                Text("Solved.")
            }
        }
        .font(RoadFont.body(15))
        .foregroundStyle(RoadTheme.gold)
        .frame(height: 44)
    }

    private func solvedActions(_ run: RoadRun) -> some View {
        HStack(spacing: 10) {
            if !model.roadExpired && !model.updateRequired {
                Button(action: model.beginReplay) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 50, height: 50)
                        .background(RoadTheme.gold.opacity(0.06), in: Circle())
                        .overlay(Circle().strokeBorder(RoadTheme.gold.opacity(0.3), lineWidth: 1))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Replay today’s road")
            }
            ShareLink(item: shareText(for: run)) { Text("Share") }
                .buttonStyle(.goldSecondary)
        }
    }

    private func shareText(for run: RoadRun) -> String {
        let result = model.result(for: run, mode: model.mode)
        if model.mode == .expedition, let classic = solvedClassicResult {
            return result.dayShareText(with: classic)
        }
        return result.shareText
    }

    private var newRoadButton: some View {
        Button(model.nextDay == nil ? "Check for new road" : "Play the new road", action: model.advanceRoad)
            .buttonStyle(GoldButtonStyle(kind: model.nextDay == nil ? .secondary : .primary))
            .disabled(model.isLoading)
    }
}

#Preview {
    NavigationStack {
        ClassicRoadView()
    }
    .preferredColorScheme(.dark)
}
