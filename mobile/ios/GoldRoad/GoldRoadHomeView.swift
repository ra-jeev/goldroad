import SwiftUI

struct GoldRoadHomeView: View {
    @State private var showingRoad = false
    @State private var roadMode = RoadMode.classic
    @State private var showingStats = false
    @State private var showingPast = false
    @State private var showingSettings = false
    @AppStorage(DailyRoadRecord.storageKey) private var historyData = Data()
    @Environment(\.scenePhase) private var scenePhase
    @State private var refresh = 0
    @State private var today: ClassicRoadClient.RoadDay?

    private var history: [DailyRoadRecord] {
        (try? JSONDecoder().decode([DailyRoadRecord].self, from: historyData)) ?? []
    }

    /// The fetched day when we have it; otherwise the saved schedule, moved on by one day once its cutoff has passed.
    private var currentGameNo: Int? {
        _ = refresh
        // A fetched day whose cutoff has passed is stale. Fall back to the schedule, which moves on by itself.
        let live = today?.classic.flatMap { $0.isExpired(at: Date()) ? nil : $0.gameNo }
        return live ?? RoadWidgetPublisher.expectedGameNo()
    }

    private func record(_ mode: RoadMode) -> DailyRoadRecord? {
        guard let currentGameNo else { return nil }
        return history.first { $0.gameNo == currentGameNo && $0.mode == mode }
    }

    private func summary(_ mode: RoadMode) -> RoadStats.Summary {
        let today = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        return RoadStats.summary(history.map(\.statsEntry), mode: mode, currentGameNo: currentGameNo, todayKey: today)
    }

    private func solvedToday(_ mode: RoadMode) -> Bool {
        guard let currentGameNo else { return false }
        return history.contains { $0.gameNo == currentGameNo && $0.mode == mode && $0.solved }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Image("BrandMark")
                        .renderingMode(.original)
                        .resizable()
                        .frame(width: 32, height: 32)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityHidden(true)
                    Text("GoldRoad")
                        .font(RoadFont.title(27))
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    BarIconButton(icon: "ellipsis", label: "Settings") { showingSettings = true }
                }
                .foregroundStyle(LinearGradient(colors: [RoadTheme.color(0xFFE8A3), RoadTheme.gold],
                                                startPoint: .top, endPoint: .bottom))
                .padding(.horizontal, 20)
                .padding(.top, 8)

                ScrollView {
                    VStack(spacing: 12) {
                        dailyCard
                        statsCard
                        destination("Past Roads", icon: "calendar") { showingPast = true }
                    }
                    .frame(maxWidth: 460)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
            .background(RoadTheme.screenBackground)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showingRoad) {
                ClassicRoadView(startMode: roadMode, prefetched: today, onBack: { showingRoad = false })
                    .toolbar(.hidden, for: .navigationBar)
            }
            .navigationDestination(isPresented: $showingStats) {
                RoadStatsView(onBack: { showingStats = false })
                    .toolbar(.hidden, for: .navigationBar)
            }
            .navigationDestination(isPresented: $showingPast) {
                PastRoadsView()
            }
            .sheet(isPresented: $showingSettings) { SettingsView(onDone: { showingSettings = false }) }
            .task(id: refresh) {
                await loadToday()
                // Stay current while Home is open: refresh again when the countdown ends.
                // If the new road is not published yet, check again soon.
                let stale = today?.classic?.isExpired(at: Date()) == true
                guard let wake = RoadWidgetPublisher.nextRoadAt() ?? (stale ? Date().addingTimeInterval(30) : nil)
                else { return }
                do { try await Task.sleep(for: .seconds(max(1, wake.timeIntervalSinceNow + 1))) } catch { return }
                refresh += 1
            }
            .onChange(of: scenePhase) { _, phase in if phase == .active { refresh += 1 } }
            .onChange(of: showingRoad) { _, open in if !open { refresh += 1 } }
        }
        .tint(RoadTheme.gold)
    }

    // MARK: Daily card

    private func loadToday() async {
        guard let day = try? await ClassicRoadClient().fetch(), !Task.isCancelled else { return }
        today = day
        RoadWidgetPublisher.remember(day.classic ?? day.expedition)
        RoadReminder.shared.rememberCutoff(day.classic?.cutoff ?? day.expedition?.cutoff)
    }

    private func open(_ mode: RoadMode) {
        roadMode = mode
        showingRoad = true
    }

    private var dailyCard: some View {
        let classic = solvedToday(.classic)
        let expedition = solvedToday(.expedition)
        let started = record(.classic)
        let streak = summary(.classic)
        let title = classic && expedition ? "Both roads conquered."
            : classic ? "Classic conquered." : "Today’s roads"
        let detail: String = {
            if classic && expedition { return "A clean sweep. See you tomorrow." }
            if classic {
                if let board = today?.playableExpedition?.board {
                    return "Expedition is open. Tolls cost \(board.tollValue), bonuses pay \(board.bonusValue)."
                }
                return "Expedition is waiting when you’re ready."
            }
            if let started {
                return started.attempts > 0
                    ? "Still out there after \(started.attempts) \(started.attempts == 1 ? "try" : "tries"). Your route is saved."
                    : "You’re on your way. Your route is saved."
            }
            if streak.currentStreak > 0 {
                return "Solve Classic to make it a \(streak.currentStreak + 1)-day streak."
            }
            if streak.bestStreak > 1 {
                return "Your best run is \(streak.bestStreak) days. Start a new one today."
            }
            return "Walk from the footprints to the flag and land exactly on the target."
        }()

        return VStack(alignment: .leading, spacing: 0) {
            Eyebrow(currentGameNo.map { "Today · Day #\($0)" } ?? "Today")
            Text(title)
                .font(RoadFont.title(32, relativeTo: .title))
                .foregroundStyle(RoadTheme.cream)
                .accessibilityAddTraits(.isHeader)
                .padding(.top, 8)
            Text(detail)
                .font(.body)
                .foregroundStyle(RoadTheme.sand)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            VStack(spacing: 0) {
                modeRow(.classic,
                        note: today?.classic.map { .target($0.maxScore) },
                        state: classic ? .solved : started != nil ? .continue : .play)
                Rectangle().fill(RoadTheme.gold.opacity(0.14)).frame(height: 1)
                modeRow(.expedition,
                        note: !classic ? .locked : today?.playableExpedition.map { .target($0.maxScore) },
                        state: expedition ? .solved : classic ? .play : .locked)
            }
            .background(RoadTheme.color(0x120A03).opacity(0.55), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(RoadTheme.cardBorder))
            .padding(.top, 18)

            TimelineView(.periodic(from: .now, by: 1)) { context in
                if let cutoff = RoadWidgetPublisher.nextRoadAt(now: context.date) {
                    HStack(spacing: 5) {
                        Image(systemName: "clock").accessibilityHidden(true)
                        Text("Next road in")
                        Text(timerInterval: context.date...cutoff, countsDown: true)
                            .monospacedDigit()
                            .fixedSize()
                        LocalRoadTime(cutoff: cutoff)
                    }
                    .font(RoadFont.body(14, relativeTo: .footnote))
                    .foregroundStyle(RoadTheme.gold)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 14)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [RoadTheme.color(0x3A250C), RoadTheme.color(0x211407)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22)
        )
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(RoadTheme.gold.opacity(0.34), lineWidth: 1))
    }

    private enum RowState { case play, `continue`, solved, locked }

    /// The dim text after a road's name. Each note has a short form for when
    /// the full one does not fit on the row's one line.
    private enum RowNote {
        case target(Int), locked
        var full: String {
            switch self {
            case .target(let score): "Target \(score)"
            case .locked: "Solve Classic to unlock"
            }
        }
        var short: String {
            switch self {
            case .target(let score): "→ \(score)"
            case .locked: "Locked"
            }
        }
    }

    private func modeRow(_ mode: RoadMode, note: RowNote?, state: RowState) -> some View {
        HStack(spacing: 12) {
            Image(systemName: state == .locked ? "lock.fill" : mode == .classic ? "figure.walk" : "mountain.2.fill")
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 26)
                .foregroundStyle(RoadTheme.gold.opacity(state == .locked ? 0.55 : 1))
                .accessibilityHidden(true)
            // One line only: the note switches to its short form
            // when the full one does not fit, so the row never grows to two lines.
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(mode.title)
                    .font(RoadFont.body(17))
                    .foregroundStyle(RoadTheme.cream.opacity(state == .locked ? 0.6 : 1))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)
                if let note {
                    ViewThatFits(in: .horizontal) {
                        Text(note.full)
                        Text(note.short).accessibilityLabel(note.full)
                    }
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(RoadTheme.sand.opacity(state == .locked ? 0.7 : 0.9))
                    .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            switch state {
            case .play, .continue:
                Button(state == .play ? "Play" : "Continue") { open(mode) }
                    .buttonStyle(GoldButtonStyle(kind: .primary, compact: true))
                    .fixedSize()
                    .accessibilityLabel("\(state == .play ? "Play" : "Continue") \(mode.title)")
            case .solved:
                Button { open(mode) } label: {
                    Label("Solved", systemImage: "checkmark")
                }
                .buttonStyle(GoldButtonStyle(kind: .secondary, compact: true))
                .fixedSize()
                .accessibilityLabel("\(mode.title) solved. Open the board")
            case .locked:
                EmptyView()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(minHeight: 58)
        .accessibilityElement(children: state == .locked ? .combine : .contain)
    }

    // MARK: Stat tiles

    private func fact(_ text: String) -> some View {
        Text(text)
            .font(RoadFont.body(13, relativeTo: .footnote))
            .monospacedDigit()
            .foregroundStyle(RoadTheme.gold)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(RoadTheme.gold.opacity(0.1), in: Capsule())
            .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.22)))
    }

    private var statsCard: some View {
        let classic = summary(.classic)
        let expedition = summary(.expedition)
        let solved = classic.exactSolves + expedition.exactSolves
        let golds = classic.medalCounts.gold + expedition.medalCounts.gold
        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                tile(value: "\(classic.currentStreak)", label: "Day streak",
                     note: classic.bestStreak > 0 ? "Best \(classic.bestStreak)" : nil) {
                    StreakFlame(lit: classic.currentStreak > 0, size: 20)
                }
                tile(value: "\(golds)", label: "Gold medals", note: nil) {
                    Text("🥇").font(.system(size: 20))
                }
                tile(value: "\(solved)", label: "Roads solved", note: nil) {
                    // The board's finish flag: a solved road is one that reached the flag.
                    Image("FinishFlag")
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 20, height: 20)
                        .foregroundStyle(RoadTheme.gold)
                        .accessibilityHidden(true)
                }
            }
            .padding(10)
            Rectangle().fill(RoadTheme.gold.opacity(0.14)).frame(height: 1)
            Button { showingStats = true } label: {
                HStack(spacing: 12) {
                    Image(systemName: "chart.bar").frame(width: 22).accessibilityHidden(true)
                    Text("View all stats")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .accessibilityHidden(true)
                }
                .font(RoadFont.body(16))
                .foregroundStyle(RoadTheme.gold)
                .padding(.horizontal, 18)
                .frame(minHeight: 52)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(RoadTheme.cardBorder))
    }

    private func tile<Icon: View>(value: String, label: String, note: String?,
                                  @ViewBuilder icon: () -> Icon) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                icon()
                Text(value).font(RoadFont.body(26)).monospacedDigit().foregroundStyle(RoadTheme.cream)
            }
            Text(label.uppercased())
                .font(RoadFont.body(10, relativeTo: .caption2))
                .tracking(1.1)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(RoadTheme.gold)
            Text(note ?? " ")
                .font(.caption2)
                .foregroundStyle(RoadTheme.sand.opacity(0.8))
                .accessibilityHidden(note == nil)
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, minHeight: 88)
        .background(RoadTheme.gold.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    private func destination(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).frame(width: 22).accessibilityHidden(true)
                Text(title)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .accessibilityHidden(true)
            }
            .font(RoadFont.body(16))
            .foregroundStyle(RoadTheme.gold)
            .padding(.horizontal, 18)
            .frame(minHeight: 56)
            .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(RoadTheme.cardBorder))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    GoldRoadHomeView()
        .preferredColorScheme(.dark)
}
