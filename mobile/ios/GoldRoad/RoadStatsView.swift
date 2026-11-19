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
                          activeSeconds: solved ? run.activeTime.map { Int($0.rounded()) } : nil,
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

struct RoadStatsView: View {
    var onBack: (() -> Void)? = nil

    @AppStorage(DailyRoadRecord.storageKey) private var historyData = Data()
    @State private var mode = RoadMode.classic
    @State private var communityMode = RoadMode.classic
    @State private var overview: StatsOverview?
    @State private var loading = true
    @State private var failed = false
    @State private var loadID = 0

    private var history: [DailyRoadRecord]? {
        if historyData.isEmpty { return [] }
        return try? JSONDecoder().decode([DailyRoadRecord].self, from: historyData)
    }

    private var entries: [RoadStats.Entry] {
        (history ?? []).map { record in
            RoadStats.Entry(day: String(record.playableAt.prefix(10)), gameNo: record.gameNo,
                            puzzleType: record.mode, attempts: record.attempts, solved: record.solved,
                            hintsUsed: record.hintsUsed, solveTimeMs: record.activeSeconds.map { $0 * 1000 })
        }
    }

    private func summary(for mode: RoadMode) -> RoadStats.Summary {
        let formatter = ISO8601DateFormatter()
        let today = String(formatter.string(from: Date()).prefix(10))
        return RoadStats.summary(entries, mode: mode, currentGameNo: overview?.currentGameNo, todayKey: today)
    }

    private var bestStreak: Int { summary(for: .classic).bestStreak }
    private var currentStreak: Int? {
        guard overview?.currentGameNo != nil else { return nil }
        return summary(for: .classic).currentStreak
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 14) {
                    if history == nil {
                        card {
                            Text("Your saved stats couldn’t be read.")
                            Text("Your history is still on this device.").font(.footnote)
                        }
                    } else {
                        streakCard
                        medalsCard
                        todayCard
                        personalCard
                    }
                    communityCard
                }
                .frame(maxWidth: 480)
                .padding(16)
                .frame(maxWidth: .infinity)
            }
        }
        .background {
            LinearGradient(colors: [RoadTheme.color(0x1A0E03), RoadTheme.color(0x0D0702)],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
        }
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .task(id: loadID) { await loadOverview() }
    }

    private var header: some View {
        HStack {
            if let onBack {
                Button(action: onBack) { Image(systemName: "chevron.left").frame(width: 40, height: 44) }
                    .accessibilityLabel("Home")
            }
            Text("Your Stats")
                .font(.custom("Marcellus-Regular", size: 24, relativeTo: .title2))
                .accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.horizontal, 12)
        .background(RoadTheme.color(0x1A0E03).opacity(0.9))
        .overlay(alignment: .bottom) { Rectangle().fill(RoadTheme.gold.opacity(0.17)).frame(height: 1) }
    }

    private var streakCard: some View {
        card {
            Label("CLASSIC STREAK", systemImage: "flame.fill").font(.caption.bold())
            if let currentStreak {
                Text(currentStreak == 0 ? "No streak yet" : "\(currentStreak)-day streak")
                    .font(.custom("Marcellus-Regular", size: 25, relativeTo: .title2))
                Text("Best: \(bestStreak) \(bestStreak == 1 ? "day" : "days")")
                    .font(.subheadline)
            } else {
                Text("Best streak: \(bestStreak) \(bestStreak == 1 ? "day" : "days")")
                Text("Current streak needs the latest road.").font(.footnote)
            }
            Text("Solve Classic roads in succession to keep your streak going.")
                .font(.footnote).foregroundStyle(RoadTheme.bright.opacity(0.8))
        }
    }

    private var medalsCard: some View {
        card {
            Text("YOUR MEDALS").font(.caption.bold())
            let counts = RoadStats.medalCounts(entries)
            HStack {
                ForEach(RoadResult.Medal.allCases, id: \.self) { medal in
                    let tries = medal.rawValue
                    let count = counts[medal]
                    VStack(spacing: 5) {
                        Image(systemName: "medal.fill")
                            .foregroundStyle(tries == 1 ? RoadTheme.gold : tries == 2 ? Color.gray : RoadTheme.toll)
                        Text(medal.name).font(.caption)
                        Text(count == 0 ? "–" : "\(count)").font(.headline)
                        Text("\(tries) \(tries == 1 ? "try" : "tries")").font(.caption2)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(count) \(medal.name.lowercased()) medals")
                }
            }
        }
    }

    private var todayCard: some View {
        card {
            Text("TODAY’S ROAD").font(.caption.bold())
            if let day = overview?.currentGameNo {
                Text("Day #\(day)").font(.headline)
                ForEach(RoadMode.allCases, id: \.self) { option in
                    let result = (history ?? []).first { $0.gameNo == day && $0.mode == option }
                    VStack(alignment: .leading, spacing: 5) {
                        Text(option.title).font(.subheadline.bold())
                        if let result, result.solved {
                            let details = ["\(result.attempts) \(result.attempts == 1 ? "try" : "tries")"]
                                + (result.activeSeconds.map { [duration($0)] } ?? [])
                                + (result.hintsUsed > 0 ? ["\(result.hintsUsed) \(result.hintsUsed == 1 ? "hint" : "hints")"] : [])
                            Text(details.joined(separator: " · "))
                                .font(.footnote).foregroundStyle(RoadTheme.bright)
                        } else {
                            Text(result == nil ? "Not played yet" : "In progress")
                                .font(.footnote).foregroundStyle(RoadTheme.bright)
                        }
                    }
                }
                if let text = shareText(for: day) {
                    ShareLink(item: text) {
                        Label("Share today’s result", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.bordered)
                }
            } else {
                Text(loading ? "Loading today’s road…" : "Today’s road is unavailable.")
                    .font(.subheadline)
            }
        }
    }

    private func shareText(for day: Int) -> String? {
        let results = (history ?? []).filter { $0.gameNo == day && $0.solved }.map {
            RoadResult(gameNo: $0.gameNo, mode: $0.mode, attempts: $0.attempts,
                       elapsed: $0.activeSeconds.map(Double.init), hintsUsed: $0.hintsUsed)
        }
        let classic = results.first { $0.mode == .classic }
        let expedition = results.first { $0.mode == .expedition }
        if let classic, let expedition { return expedition.dayShareText(with: classic) }
        return (classic ?? expedition)?.shareText
    }

    private var personalCard: some View {
        card {
            Text("YOUR STATS").font(.caption.bold())
            Picker("Road mode", selection: $mode) {
                ForEach(RoadMode.allCases, id: \.self) { option in Text(option.title).tag(option) }
            }.pickerStyle(.segmented)
            let stats = summary(for: mode)
            if stats.sessionsPlayed == 0 {
                Text("Play a \(mode.title) road and your stats will appear here.")
                    .font(.subheadline).padding(.vertical, 8)
            } else {
                statRow("Roads played", "\(stats.sessionsPlayed)")
                statRow("Completion", "\(stats.solveRate)%")
                statRow("Average tries", stats.averageSolvedAttempts)
                statRow("Average solve time", stats.averageSolveTimeMs.map { duration(Int((Double($0) / 1000).rounded())) } ?? "–")
                statRow("Best solve time", stats.bestSolveTimeMs.map { duration(Int((Double($0) / 1000).rounded())) } ?? "–")
                statRow("Total hints used", "\(stats.totalHints)")
            }
            Text("Stats are saved on this device and sync with iCloud when available.")
                .font(.footnote).foregroundStyle(RoadTheme.bright.opacity(0.75))
        }
    }

    private var communityCard: some View {
        card {
            Text("PREVIOUS ROAD · COMMUNITY").font(.caption.bold())
            if loading {
                ProgressView("Loading community stats…")
            } else if failed {
                Text("Community stats couldn’t be loaded.").font(.subheadline)
                Button("Try again") { loadID += 1 }.buttonStyle(.bordered)
            } else if let day = overview?.yesterday, let number = day.gameNo {
                let field = communityMode == .classic ? day.classic : day.expedition
                let result = history?.first { $0.gameNo == number && $0.mode == communityMode }
                Text("Day #\(number)").font(.headline)
                Picker("Community road mode", selection: $communityMode) {
                    ForEach(RoadMode.allCases, id: \.self) { option in Text(option.title).tag(option) }
                }.pickerStyle(.segmented)
                if let field {
                    if field.plays > 0 {
                        Text("\(Int(field.solveRate.rounded()))% of roadgoers reached the finish.")
                            .font(.subheadline)
                        histogram(field.solvedAttempts)
                        Text(field.behavior.totalHints == 0
                             ? "No hints were used on this road."
                             : "Solvers used \(field.behavior.totalHints) hints in total.")
                            .font(.footnote)
                        if let average = field.behavior.averageSolveTimeMs {
                            let fieldTime = duration(Int((Double(average) / 1000).rounded()))
                            let playerTime = result?.activeSeconds.map(duration)
                            Text("Field solve time averaged \(fieldTime)."
                                 + (playerTime.map { " You solved it in \($0)." } ?? ""))
                                .font(.footnote)
                        }
                        if let fastest = field.behavior.bestSolveTimeMs {
                            let fastestTime = duration(Int((Double(fastest) / 1000).rounded()))
                            Text("Fastest field solve was \(fastestTime).")
                                .font(.footnote)
                        }
                    } else {
                        Text("No community results were recorded for this road.").font(.subheadline)
                    }
                    if let result, result.solved {
                        if field.plays > 0 && field.exactSolves > 0 {
                            let top = RoadStats.topPercent(plays: field.plays,
                                                            solvedAttemptsExact: field.solvedAttemptsExact,
                                                            attempts: result.attempts)
                            Text("You finished in \(result.attempts) \(result.attempts == 1 ? "try" : "tries"), in the top \(top)% of the field.")
                                .font(.footnote)
                        } else {
                            Text("You finished in \(result.attempts) \(result.attempts == 1 ? "try" : "tries"). No community comparison was recorded.")
                                .font(.footnote)
                        }
                    } else if let result, result.attempts > 0 {
                        Text("You walked this road too, but didn’t reach the finish.").font(.footnote)
                    }
                } else {
                    Text("No \(communityMode.title) comparison is available for this road.").font(.subheadline)
                }
                Text("Community results are available after a road ends.")
                    .font(.footnote).foregroundStyle(RoadTheme.bright.opacity(0.75))
            } else {
                Text("No previous road is available yet.").font(.subheadline)
            }
        }
    }

    private func histogram(_ distribution: [String: Int]) -> some View {
        let buckets = distribution.keys.filter { distribution[$0, default: 0] > 0 }.sorted {
            (Int($0.replacingOccurrences(of: "+", with: "")) ?? 0)
                < (Int($1.replacingOccurrences(of: "+", with: "")) ?? 0)
        }
        let maximum = distribution.values.max() ?? 0
        return VStack(alignment: .leading, spacing: 4) {
            if !buckets.isEmpty && maximum > 0 {
                Text("SOLVES BY TRIES").font(.caption2.bold())
                ForEach(buckets, id: \.self) { bucket in
                    HStack(spacing: 8) {
                        Text(bucket).frame(width: 30, alignment: .trailing)
                        GeometryReader { geometry in
                            Capsule().fill(RoadTheme.gold.opacity(0.8))
                                .frame(width: geometry.size.width * CGFloat(distribution[bucket, default: 0]) / CGFloat(maximum))
                        }.frame(height: 8)
                    }
                    .font(.caption2.monospacedDigit())
                    .accessibilityLabel("\(bucket) tries, relative number of solves")
                }
            }
        }
    }

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(RoadTheme.gold.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(RoadTheme.gold.opacity(0.22)))
    }

    private func statRow(_ label: String, _ value: String) -> some View {
        HStack { Text(label); Spacer(); Text(value).foregroundStyle(RoadTheme.bright) }
            .font(.subheadline).monospacedDigit()
    }

    private func duration(_ seconds: Int) -> String {
        seconds >= 60 ? "\(seconds / 60)m \(String(format: "%02d", seconds % 60))s" : "\(seconds)s"
    }

    @MainActor private func loadOverview() async {
        loading = true
        failed = false
        do {
            let url = try GoldRoadAPI.url("api/stats/overview")
            let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
                throw URLError(.badServerResponse)
            }
            let result = try JSONDecoder().decode(StatsOverview.self, from: data)
            guard !Task.isCancelled else { return }
            overview = result
            loading = false
        } catch {
            guard !Task.isCancelled else { return }
            failed = true
            loading = false
        }
    }
}
