import SwiftUI

struct DailyRoadRecord: Codable, Identifiable, Equatable {
    static let storageKey = "dailyHistory.v1"

    let gameNo: Int
    let playableAt: String
    let mode: RoadMode
    let attempts: Int
    let solved: Bool
    let activeSeconds: Int?
    let hintsUsed: Int

    var id: String { "\(gameNo):\(mode.rawValue)" }

    var statsEntry: RoadStats.Entry {
        RoadStats.Entry(day: String(playableAt.prefix(10)), gameNo: gameNo,
                        puzzleType: mode, attempts: attempts, solved: solved,
                        hintsUsed: hintsUsed, solveTimeMs: activeSeconds.map { $0 * 1000 })
    }

    static func isSolved(gameNo: Int, mode: RoadMode, defaults: UserDefaults = .standard) -> Bool {
        guard let data = defaults.data(forKey: storageKey), !data.isEmpty,
              let history = try? JSONDecoder().decode([Self].self, from: data) else { return false }
        return history.contains { $0.gameNo == gameNo && $0.mode == mode && $0.solved }
    }

    @MainActor
    static func record(_ run: RoadRun, mode: RoadMode) {
        guard run.path.count > 1 || run.attempt > 1 || run.hintsUsed > 0 else { return }
        let defaults = UserDefaults.standard
        var history: [Self] = []
        if let data = defaults.data(forKey: storageKey), !data.isEmpty {
            guard let saved = try? JSONDecoder().decode([Self].self, from: data) else { return }
            history = saved
        }
        let solved = run.outcome == .solved
        let attempts = run.outcome == .inProgress ? run.attempt - 1 : run.attempt
        let record = Self(gameNo: run.road.gameNo, playableAt: run.road.playableAt, mode: mode,
                          attempts: attempts, solved: solved,
                          activeSeconds: solved ? ScreenshotMode.shownTime(run.activeTime).map { Int($0.rounded()) } : nil,
                          hintsUsed: run.hintsUsed)
        if let index = history.firstIndex(where: { $0.id == record.id }) {
            guard !history[index].solved, history[index] != record else { return }
            history[index] = record
        } else {
            history.append(record)
        }
        if let data = try? JSONEncoder().encode(history) {
            defaults.set(data, forKey: storageKey)
            RoadHistorySync.sync()
        }
    }
}

struct StatsOverview: Decodable {
    struct Day: Decodable {
        struct Community: Decodable {
            struct Behavior: Decodable {
                let totalHints: Int
                let averageSolveTimeMs: Double?
                let bestSolveTimeMs: Double?
            }

            let plays: Int
            let solveRate: Double
            let exactSolves: Int
            let solvedAttempts: [String: Int]
            let solvedAttemptsExact: [String: Int]
            let behavior: Behavior
        }
        let gameNo: Int?
        let classic: Community?
        let expedition: Community?
    }
    let currentGameNo: Int?
    let yesterday: Day
}

/// Keeps the last community stats answer for the day it was fetched on.
enum StatsOverviewStore {
    static let key = "statsOverview.v1"

    /// The saved answer, only if it was fetched for `currentGameNo`.
    static func load(currentGameNo: Int?, defaults: UserDefaults = .standard) -> StatsOverview? {
        guard let currentGameNo, let data = defaults.data(forKey: key),
              let overview = try? JSONDecoder().decode(StatsOverview.self, from: data),
              overview.currentGameNo == currentGameNo else { return nil }
        return overview
    }

    static func save(_ data: Data, for overview: StatsOverview, defaults: UserDefaults = .standard) {
        guard overview.currentGameNo != nil else { return }
        defaults.set(data, forKey: key)
    }
}

struct RoadStatsView: View {
    var onBack: (() -> Void)? = nil

    @AppStorage(DailyRoadRecord.storageKey) private var historyData = Data()
    @AppStorage("roadMode") private var preferredMode = RoadMode.classic
    @State private var recordMode = RoadMode.classic
    @State private var fieldMode = RoadMode.classic
    @State private var showFieldDetail = false
    @AppStorage(GameConstants.analyticsKey) private var statsConsent: Bool?
    @State private var overview: StatsOverview?
    @State private var loading = true
    @State private var failed = false
    @State private var loadID = 0

    private var history: [DailyRoadRecord]? {
        if historyData.isEmpty { return [] }
        return try? JSONDecoder().decode([DailyRoadRecord].self, from: historyData)
    }

    private var entries: [RoadStats.Entry] { (history ?? []).map(\.statsEntry) }

    private var todayGameNo: Int? { overview?.currentGameNo ?? RoadWidgetPublisher.expectedGameNo() }

    private func summary(for mode: RoadMode) -> RoadStats.Summary {
        let today = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        return RoadStats.summary(entries, mode: mode, currentGameNo: todayGameNo, todayKey: today)
    }

    private func record(_ gameNo: Int?, _ mode: RoadMode) -> DailyRoadRecord? {
        guard let gameNo else { return nil }
        return history?.first { $0.gameNo == gameNo && $0.mode == mode }
    }

    var body: some View {
        VStack(spacing: 0) {
            RoadTopBar(title: "Stats", subtitle: "Your road so far", onBack: onBack) { EmptyView() }
            ScrollView {
                VStack(spacing: 14) {
                    if history == nil {
                        RoadCard {
                            Text("Your saved stats couldn’t be read.")
                            Text("Your history is still on this device.").font(.footnote)
                        }
                    } else {
                        streakCard
                        medalGrid
                        todayCard
                    }
                    fieldCard
                    if history != nil { recordCard }
                }
                .frame(maxWidth: 480)
                .padding(16)
                .frame(maxWidth: .infinity)
            }
        }
        .background(RoadTheme.screenBackground)
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .task(id: loadID) { await loadOverview() }
        .onAppear {
            recordMode = preferredMode
            fieldMode = preferredMode
        }
    }

    // MARK: Streak and medals

    private var streakCard: some View {
        let classic = summary(for: .classic)
        let current = classic.currentStreak
        let best = classic.bestStreak
        let solves = summary(for: .classic).exactSolves + summary(for: .expedition).exactSolves
        let line: String = {
            if current > 0 {
                let gap = best - current
                return current >= best ? "Your best run yet"
                    : "\(gap) more day\(gap == 1 ? "" : "s") to match your best of \(best)."
            }
            if best > 1 { return "You once did \(best) days. Solve today’s road to light it again." }
            if solves > 0 {
                return "\(solves) road\(solves == 1 ? "" : "s") conquered so far. Solve one today to make it \(solves + 1) and light the flame."
            }
            return "Solve today’s road to light the flame."
        }()
        return HStack(spacing: 14) {
            StreakFlame(lit: current > 0, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(current > 0 ? "\(current)-day streak" : "No streak yet")
                    .font(RoadFont.body(21, relativeTo: .title3))
                    .foregroundStyle(RoadTheme.cream)
                Text(line).font(.subheadline).foregroundStyle(RoadTheme.sand)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(RoadTheme.cardBorder))
        .accessibilityElement(children: .combine)
    }

    private var medalGrid: some View {
        let classic = summary(for: .classic).medalCounts
        let expedition = summary(for: .expedition).medalCounts
        return VStack(spacing: 8) {
            HStack(spacing: 8) {
                ForEach(RoadResult.Medal.allCases, id: \.rawValue) { medal in
                    let count = classic[medal] + expedition[medal]
                    VStack(spacing: 6) {
                        HStack(spacing: 4) {
                            Text(medal.emoji).font(.system(size: 26))
                            Text("x").font(RoadFont.body(13)).opacity(0.7)
                            Text(count == 0 ? "–" : "\(count)").font(RoadFont.body(22)).monospacedDigit()
                        }
                        Text("\(medal.rawValue) \(medal.rawValue == 1 ? "TRY" : "TRIES")")
                            .font(RoadFont.body(11, relativeTo: .caption2)).tracking(1).opacity(0.7)
                    }
                    .frame(maxWidth: .infinity, minHeight: 84)
                    .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(RoadTheme.cardBorder))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(count) \(medal.name) medal\(count == 1 ? "" : "s")")
                }
            }
            if classic.gold + classic.silver + classic.bronze + expedition.gold + expedition.silver + expedition.bronze == 0 {
                Text("Fewer tries, better medal.").font(.footnote).foregroundStyle(RoadTheme.sand)
            }
        }
    }

    // MARK: Today

    private var todayCard: some View {
        let day = todayGameNo
        let rows = RoadMode.allCases.compactMap { mode -> (RoadMode, DailyRoadRecord)? in
            guard let result = record(day, mode), result.solved else { return nil }
            return (mode, result)
        }
        let classic = record(day, .classic)
        let title: String
        let detail: String
        switch rows.count {
        case 0:
            title = "Waiting to be walked."
            detail = (classic?.attempts ?? 0) > 0
                ? "The solve is still out there after \(tries(classic!.attempts))."
                : "Chart today’s road to start your streak."
        case 2:
            title = "Both roads conquered."
            detail = "A clean sweep. Worth telling someone."
        default:
            let solved = rows[0].0
            title = "\(solved.title) conquered."
            detail = "\(solved == .classic ? "Expedition" : "Classic") is waiting when you’re ready."
        }
        return RoadCard {
            VStack(alignment: .leading, spacing: 4) {
                Eyebrow(day.map { "Today’s roads · Day #\($0)" } ?? "Today’s roads")
                Text(title).font(RoadFont.title(24)).foregroundStyle(RoadTheme.cream)
            }
            ForEach(rows, id: \.0) { mode, result in
                HStack(spacing: 12) {
                    Text(RoadResult.Medal.forAttempt(result.attempts, solved: true)?.emoji ?? "✓")
                        .font(.system(size: 24)).frame(width: 32)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(mode.title).font(RoadFont.body(16)).foregroundStyle(RoadTheme.cream)
                        Text(details(result).joined(separator: " · ")).font(.subheadline).foregroundStyle(RoadTheme.sand)
                    }
                }
            }
            Text(detail).font(.subheadline).foregroundStyle(RoadTheme.sand)
            if let day, let text = shareText(for: day, rows: rows) {
                ShareLink(item: text) {
                    Text(rows.count == 2 ? "Share the day" : "Share \(rows[0].0.title)").frame(maxWidth: .infinity)
                }
                .buttonStyle(GoldButtonStyle(kind: .primary, fullWidth: true))
            }
            if let cutoff = RoadWidgetPublisher.nextRoadAt() {
                NextRoadCountdown(cutoff: cutoff)
                    .font(RoadFont.body(14, relativeTo: .footnote))
                    .foregroundStyle(RoadTheme.gold)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func details(_ result: DailyRoadRecord) -> [String] {
        [tries(result.attempts)]
            + (result.activeSeconds.map { [RoadShare.duration($0 * 1000)] } ?? [])
            + (result.hintsUsed > 0 ? ["\(result.hintsUsed) hint\(result.hintsUsed == 1 ? "" : "s")"] : [])
    }

    private func tries(_ count: Int) -> String { "\(count) \(count == 1 ? "try" : "tries")" }

    private func shareText(for day: Int, rows: [(RoadMode, DailyRoadRecord)]) -> String? {
        let results = rows.map { mode, record in
            RoadResult(gameNo: day, mode: mode, attempts: record.attempts,
                       elapsed: record.activeSeconds.map(Double.init), hintsUsed: record.hintsUsed)
        }
        let classic = results.first { $0.mode == .classic }
        let expedition = results.first { $0.mode == .expedition }
        if let classic, let expedition { return expedition.dayShareText(with: classic) }
        return (classic ?? expedition)?.shareText
    }

    // MARK: Yesterday's field

    @ViewBuilder
    private var fieldCard: some View {
        if loading && overview == nil {
            RoadCard { ProgressView("Gathering community stats…").frame(maxWidth: .infinity) }
        } else if failed && overview == nil {
            RoadCard {
                Text("Community comparison is unavailable right now.").font(.subheadline)
                Button("Try again") { loadID += 1 }.buttonStyle(.goldSecondary)
            }
        } else if let day = overview?.yesterday, let number = day.gameNo {
            let field = fieldMode == .classic ? day.classic : day.expedition
            let result = record(number, fieldMode)
            let member = membership(number, result)
            RoadCard {
                VStack(spacing: 4) {
                    Eyebrow("Yesterday’s roads · Day #\(number)")
                    Text("Global stats").font(RoadFont.title(22)).foregroundStyle(RoadTheme.cream)
                    Text("Among players who share stats")
                        .font(.footnote)
                        .foregroundStyle(RoadTheme.sand)
                }
                .frame(maxWidth: .infinity)
                if let field {
                    if field.plays > 0 {
                        TriesHistogram(distribution: field.solvedAttempts,
                                       playerAttempts: result?.solved == true ? result?.attempts : nil)
                    }
                    VStack(spacing: 8) {
                        Text(field.plays > 0
                             ? "\(Int(field.solveRate.rounded()))% of the roadgoers who walked this road reached the finish."
                             : "No community results were recorded for this road.")
                            .font(RoadFont.body(15))
                            .foregroundStyle(RoadTheme.cream)
                        if let line = playerLine(field, result, membership: member) {
                            Text(line).font(.subheadline).foregroundStyle(RoadTheme.sand)
                        }
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    if field.plays > 0 {
                        Button(showFieldDetail ? "Hide field detail" : "How the field played it") {
                            withAnimation(.easeOut(duration: 0.2)) { showFieldDetail.toggle() }
                        }
                        .font(RoadFont.body(14))
                        .underline()
                        .frame(maxWidth: .infinity)
                        if showFieldDetail {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(behaviorRows(field, result), id: \.self) { row in
                                    Label(row, systemImage: "circle.fill")
                                        .labelStyle(DotLabelStyle())
                                }
                            }
                            .font(.subheadline)
                            .foregroundStyle(RoadTheme.sand)
                        }
                    }
                } else {
                    Text("No \(fieldMode.title) comparison is available for this road.")
                        .font(.subheadline).frame(maxWidth: .infinity)
                }
                if statsConsent != true { contributePrompt }
                Rectangle().fill(RoadTheme.gold.opacity(0.14)).frame(height: 1)
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { fieldMode = fieldMode == .classic ? .expedition : .classic }
                } label: {
                    // As on the web: Classic points back (left), Expedition points on (right).
                    if fieldMode == .classic {
                        Label("View Expedition stats", systemImage: "arrow.right")
                            .labelStyle(TrailingIconLabelStyle())
                    } else {
                        Label("View Classic stats", systemImage: "arrow.left")
                    }
                }
                .font(RoadFont.body(15))
                .frame(maxWidth: .infinity)
            }
        }
    }

    /// Shown only while sharing is off. Your own result above comes from this phone either way.
    private var contributePrompt: some View {
        VStack(spacing: 8) {
            Text("Help build community stats. If you opt in, this may include play already saved for today’s road.")
                .font(.subheadline)
                .foregroundStyle(RoadTheme.sand)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button("Share my play stats") { DailyRoadAnalytics.shared.setConsent(true) }
                .buttonStyle(.goldSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    /// What the server holds for this player on that road, so the comparison neither counts
    /// them twice nor counts them as someone they beat.
    private enum Membership { case solved, unsolvedRow, absent }

    private func membership(_ gameNo: Int, _ result: DailyRoadRecord?) -> Membership {
        let analytics = DailyRoadAnalytics.shared
        guard result?.solved == true else { return .absent }
        if analytics.didSendSolve(gameNo: gameNo, mode: fieldMode) { return .solved }
        if analytics.didSendStart(gameNo: gameNo, mode: fieldMode) { return .unsolvedRow }
        return .absent
    }

    private func playerLine(_ field: StatsOverview.Day.Community, _ result: DailyRoadRecord?,
                            membership: Membership) -> String? {
        if let result, result.solved {
            // An unsolved row of this player's own is not someone they beat, so it is left out.
            guard let standing = RoadStats.fieldStanding(
                plays: membership == .unsolvedRow ? field.plays - 1 : field.plays,
                solvedAttemptsExact: field.solvedAttemptsExact,
                attempts: result.attempts, alreadyCounted: membership == .solved) else {
                return "You got to the finish in \(tries(result.attempts)). No community comparison was recorded for this road."
            }
            return "You got to the finish in \(tries(result.attempts)). \(standing)"
        }
        if let result, result.attempts > 0 {
            return "You walked it too, but the finish stayed out of reach that day."
        }
        return field.plays > 0
            ? "Walk down today’s road and come back tomorrow to see how you fared against the field." : nil
    }

    private func behaviorRows(_ field: StatsOverview.Day.Community, _ result: DailyRoadRecord?) -> [String] {
        let behavior = field.behavior
        var rows = [behavior.totalHints == 0 ? "No hints were used on this road."
                    : "Solvers used \(behavior.totalHints) hints in total."]
        if let average = behavior.averageSolveTimeMs {
            let fieldTime = RoadShare.duration(Int(average))
            rows.append(result?.activeSeconds.map {
                "Field solve time averaged \(fieldTime). You solved it in \(RoadShare.duration($0 * 1000))."
            } ?? "Field solve time averaged \(fieldTime).")
        }
        if let best = behavior.bestSolveTimeMs {
            rows.append("Fastest field solve was \(RoadShare.duration(Int(best))).")
        }
        return rows
    }

    // MARK: Record

    private var recordCard: some View {
        let stats = summary(for: recordMode)
        return RoadCard {
            Eyebrow("Your stats · \(recordMode.title)").frame(maxWidth: .infinity)
            GoldSegmentedPicker(selection: $recordMode, options: [(.classic, "Classic"), (.expedition, "Expedition")])
            if stats.sessionsPlayed > 0 {
                VStack(spacing: 10) {
                    row("Roads played", "\(stats.sessionsPlayed) road\(stats.sessionsPlayed == 1 ? "" : "s")")
                    row("Completion", "\(stats.solveRate)%")
                    row("Average tries", stats.averageSolvedAttempts)
                    row("Average solve time", stats.averageSolveTimeMs.map(RoadShare.duration) ?? "–")
                    row("Best solve time", stats.bestSolveTimeMs.map(RoadShare.duration) ?? "–")
                    row("Total hints used", "\(stats.totalHints)")
                    row("\(RoadResult.noHintsLabel) solves", "\(RoadStats.noHintSolves(entries, mode: recordMode))")
                }
            } else {
                Text("Play a \(recordMode.title) road and your stats will appear here.")
                    .font(.subheadline).foregroundStyle(RoadTheme.sand)
            }
            Text("Stats are saved on this device and sync with iCloud when available.")
                .font(.footnote).foregroundStyle(RoadTheme.sand.opacity(0.8))
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(RoadTheme.sand)
            Spacer()
            Text(value).font(RoadFont.body(16)).foregroundStyle(RoadTheme.cream)
        }
        .font(.subheadline)
        .monospacedDigit()
    }

    @MainActor private func loadOverview() async {
        // The community card shows yesterday's closed road, so one answer is good for the whole day.
        if let saved = StatsOverviewStore.load(currentGameNo: RoadWidgetPublisher.expectedGameNo()) {
            overview = saved
            loading = false
            failed = false
            return
        }
        loading = true
        failed = false
        do {
            let request = URLRequest(url: try GoldRoadAPI.url("api/stats/overview"),
                                     cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
                throw URLError(.badServerResponse)
            }
            let result = try JSONDecoder().decode(StatsOverview.self, from: data)
            guard !Task.isCancelled else { return }
            StatsOverviewStore.save(data, for: result)
            overview = result
        } catch {
            guard !Task.isCancelled else { return }
            failed = true
        }
        loading = false
    }
}

/// One thin bar per try count up to the pooled "25+" bar, as on the web. Counts are never shown.
struct TriesHistogram: View {
    let distribution: [String: Int]
    let playerAttempts: Int?
    var upperBound = 25

    var body: some View {
        let keys = (1..<upperBound).map(String.init) + ["\(upperBound)+"]
        let playerKey = playerAttempts.map { $0 >= upperBound ? "\(upperBound)+" : String($0) }
        let maxCount = max(keys.map { distribution[$0] ?? 0 }.max() ?? 0, 1)
        VStack(spacing: 6) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(keys, id: \.self) { key in
                    let count = distribution[key] ?? 0
                    let fraction = count > 0 ? max(0.06, Double(count) / Double(maxCount)) : 0.01
                    let mine = key == playerKey
                    VStack(spacing: 3) {
                        Spacer(minLength: 0)
                        if mine {
                            Image(systemName: "arrowtriangle.down.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(RoadTheme.cream)
                        }
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(mine ? RoadTheme.cream : RoadTheme.gold.opacity(0.75))
                            .frame(height: max(1.5, 110 * fraction))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 128)
            .overlay(alignment: .bottom) {
                Rectangle().fill(RoadTheme.gold.opacity(0.4)).frame(height: 1)
            }
            HStack {
                Text("1")
                Spacer()
                Text("tries →").opacity(0.75)
                Spacer()
                Text("\(upperBound)+")
            }
            .font(RoadFont.body(13, relativeTo: .caption))
        }
        .padding(.horizontal, 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("How many tries the field needed, from 1 to \(upperBound) and beyond."
            + (playerKey.map { " Your solve is marked at \($0)." } ?? ""))
    }
}

private struct DotLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            configuration.icon.font(.system(size: 5)).alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
            configuration.title
        }
    }
}

private struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) { configuration.title; configuration.icon }
    }
}
