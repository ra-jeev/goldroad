import SwiftUI

struct ArchiveDay: Decodable, Identifiable, Hashable {
    let gameNo: Int
    let playableAt: String
    var id: Int { gameNo }
}

struct RandomArchiveResponse: Decodable {
    let gameNo: Int
}

struct ArchiveResponse: Decodable {
    let games: [ArchiveDay]
}

struct ArchiveRoad: Decodable {
    let gameNo: Int
    let maxScore: Int
    let playableAt: String
    let board: Board
    let nextGameAt: String?
    let optimalPaths: [[Int]]

    var road: ClassicRoad {
        ClassicRoad(gameNo: gameNo, maxScore: maxScore, playableAt: playableAt,
                    board: board, nextGameAt: nextGameAt)
    }
}

struct ArchiveBoard: Decodable {
    let classic: ArchiveRoad?
    let expedition: ArchiveRoad?
}

private struct ArchiveClient {
    private let base = URL(string: "https://playgoldroad.com")!

    func fetch<Response: Decodable>(_ path: String) async throws -> Response {
        let request = URLRequest(url: base.appending(path: path),
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

enum ArchiveCompletion {
    static let key = "archiveCompletion.v1"

    static func contains(_ gameNo: Int, _ mode: RoadMode) -> Bool {
        let all = UserDefaults.standard.dictionary(forKey: key) as? [String: [String: Bool]] ?? [:]
        return all[String(gameNo)]?[mode.rawValue] == true
    }

    static func record(_ gameNo: Int, _ mode: RoadMode) {
        var all = UserDefaults.standard.dictionary(forKey: key) as? [String: [String: Bool]] ?? [:]
        var day = all[String(gameNo)] ?? [:]
        day[mode.rawValue] = true
        all[String(gameNo)] = day
        UserDefaults.standard.set(all, forKey: key)
    }
}

struct ArchiveProgress {
    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func restore(_ road: ClassicRoad, mode: RoadMode) -> RoadRun {
        guard let data = defaults.data(forKey: key(road.gameNo, mode)),
              let snapshot = try? JSONDecoder().decode(RoadRun.Snapshot.self, from: data),
              snapshot.road.gameNo == road.gameNo, snapshot.road.board == road.board,
              snapshot.road.maxScore == road.maxScore,
              var run = RoadRun(snapshot: snapshot) else { return RoadRun(road: road) }
        run.updateSchedule(from: road)
        return run
    }

    func save(_ run: RoadRun, mode: RoadMode) {
        if let data = try? JSONEncoder().encode(run.snapshot) {
            defaults.set(data, forKey: key(run.road.gameNo, mode))
        }
    }

    func selectedMode(for gameNo: Int) -> RoadMode {
        defaults.string(forKey: "archiveMode.v1.\(gameNo)").flatMap(RoadMode.init(rawValue:)) ?? .classic
    }

    func selectMode(_ mode: RoadMode, for gameNo: Int) {
        defaults.set(mode.rawValue, forKey: "archiveMode.v1.\(gameNo)")
    }

    private func key(_ gameNo: Int, _ mode: RoadMode) -> String {
        "archiveRun.v1.\(gameNo).\(mode.rawValue)"
    }
}

struct PastRoadsView: View {
    @AppStorage(DailyRoadRecord.storageKey) private var historyData = Data()
    @State private var days: [ArchiveDay] = []
    @State private var loading = true
    @State private var error: String?
    @State private var reload = 0
    @State private var completionVersion = 0
    @State private var randomDay: ArchiveDay?
    @State private var randomBusy = false
    @State private var randomError: String?
    private let client = ArchiveClient()
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if loading {
                    ProgressView("Gathering the archive…")
                } else if let error {
                    Text(error)
                    Button("Try again") { reload += 1 }.buttonStyle(.bordered)
                } else if days.isEmpty {
                    Text("No past roads yet")
                    Text("Older roads appear here once the archive fills in.").font(.footnote)
                } else {
                    Text("Pick a day, walk its road")
                        .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                    archiveCalendar
                    if (days.first?.gameNo ?? 0) > 30 {
                        Button(randomBusy ? "Finding a road…" : "Surprise me with an older road") {
                            Task { await chooseOlderRoad() }
                        }
                        .buttonStyle(.bordered)
                        .disabled(randomBusy)
                        if let randomError { Text(randomError).font(.footnote) }
                    }
                    Text("Classic marks are on the left, Expedition on the right. Solve Classic to unlock Expedition.")
                        .font(.footnote).multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: 400)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .background(RoadTheme.color(0x110900).ignoresSafeArea())
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .navigationTitle("Past Roads")
        .toolbar(.visible, for: .navigationBar)
        .navigationDestination(item: $randomDay) { day in
            ArchivedRoadView(day: day) { completionVersion += 1 }
        }
        .task(id: reload) {
            loading = true
            error = nil
            do {
                let response: ArchiveResponse = try await client.fetch("api/games/past")
                guard !Task.isCancelled else { return }
                days = response.games
            } catch {
                guard !Task.isCancelled else { return }
                self.error = "Past roads are unavailable right now."
            }
            loading = false
        }
    }

    private var archiveCalendar: some View {
        let gamesByDate = days.reduce(into: [Date: ArchiveDay]()) { games, day in
            if let date = parseArchiveDate(day.playableAt) {
                games[calendar.startOfDay(for: date)] = day
            }
        }
        let months = Set(gamesByDate.keys.compactMap { calendar.dateInterval(of: .month, for: $0)?.start })
        let history = (try? JSONDecoder().decode([DailyRoadRecord].self, from: historyData)) ?? []
        return ForEach(months.sorted(by: >), id: \.self) { month in
            monthGrid(month, gamesByDate: gamesByDate, history: history)
        }
    }

    private func monthGrid(_ month: Date, gamesByDate: [Date: ArchiveDay], history: [DailyRoadRecord]) -> some View {
        let blanks = calendar.component(.weekday, from: month) - 1
        let count = calendar.range(of: .day, in: .month, for: month)?.count ?? 0
        return VStack(alignment: .leading, spacing: 10) {
            Text(month.formatted(Date.FormatStyle(calendar: calendar, timeZone: calendar.timeZone).month(.wide).year()))
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(calendar.veryShortStandaloneWeekdaySymbols.indices, id: \.self) { index in
                    Text(calendar.veryShortStandaloneWeekdaySymbols[index])
                        .font(.caption2.bold())
                        .accessibilityHidden(true)
                }
                ForEach(-blanks..<count, id: \.self) { offset in
                    if offset < 0 {
                        Color.clear.accessibilityHidden(true)
                    } else if let date = calendar.date(byAdding: .day, value: offset, to: month),
                              let day = gamesByDate[date] {
                        dayLink(day, number: offset + 1, history: history)
                    } else {
                        Text("\(offset + 1)")
                            .font(.caption)
                            .foregroundStyle(RoadTheme.gold.opacity(0.45))
                            .frame(minHeight: 44)
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .padding(10)
        .background(RoadTheme.gold.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }

    private func dayLink(_ day: ArchiveDay, number: Int, history: [DailyRoadRecord]) -> some View {
        let modes = RoadMode.allCases.map { mode in
            let record = history.first { $0.gameNo == day.gameNo && $0.mode == mode && $0.solved }
            let medal = record.flatMap { RoadResult.Medal(rawValue: $0.attempts) }
            let solved = record != nil || ArchiveCompletion.contains(day.gameNo, mode)
            return (mode: mode, medal: medal, solved: solved)
        }
        let status = modes.map { entry in
            let result = entry.solved ? "solved" : "not solved"
            return "\(entry.mode.title) \(result)" + (entry.medal.map { ", \($0.name)" } ?? "")
        }.joined(separator: ". ")
        return NavigationLink {
            ArchivedRoadView(day: day) { completionVersion += 1 }
        } label: {
            VStack(spacing: 5) {
                Text("\(number)").font(.caption.bold())
                HStack(spacing: 4) {
                    ForEach(modes.indices, id: \.self) { index in
                        mark(medal: modes[index].medal, solved: modes[index].solved)
                    }
                }
                .id(completionVersion)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(RoadTheme.gold.opacity(0.14), in: RoundedRectangle(cornerRadius: 7))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Day #\(day.gameNo), \(archiveDate(day.playableAt)). \(status)")
        }
        .buttonStyle(.plain)
    }

    private func chooseOlderRoad() async {
        randomBusy = true
        randomError = nil
        defer { randomBusy = false }
        do {
            let result: RandomArchiveResponse = try await client.fetch("api/games/another")
            randomDay = ArchiveDay(gameNo: result.gameNo, playableAt: "")
        } catch {
            randomError = "No older road is available right now."
        }
    }

    private func mark(medal: RoadResult.Medal?, solved: Bool) -> some View {
        let color: Color = switch medal {
        case .gold: RoadTheme.gold
        case .silver: RoadTheme.color(0xC0C0C0)
        case .bronze: RoadTheme.color(0xCD7F32)
        case nil: solved ? .green : RoadTheme.gold.opacity(0.4)
        }
        return Image(systemName: solved ? "circle.fill" : "circle")
            .font(.system(size: 7, weight: .semibold))
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }
}

private func parseArchiveDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: value)
}

private func archiveDate(_ value: String) -> String {
    guard let date = parseArchiveDate(value) else { return value }
    let display = DateFormatter()
    display.dateStyle = .medium
    display.timeZone = TimeZone(secondsFromGMT: 0)
    return display.string(from: date)
}

private struct ArchivedRoadView: View {
    let day: ArchiveDay
    let onCompletion: () -> Void
    @AppStorage("muted") private var muted = false
    @AppStorage(GameConstants.hapticsKey) private var hapticsEnabled = true
    @State private var board: ArchiveBoard?
    @State private var classic: RoadRun?
    @State private var expedition: RoadRun?
    @State private var mode = RoadMode.classic
    @State private var loading = true
    @State private var error: String?
    @State private var reload = 0
    @State private var sound = RoadSound()
    @State private var feedback: BoardFeedback?
    @State private var hintMessage: String?
    @State private var confirmRestart = false
    @State private var completionVersion = 0
    private let client = ArchiveClient()
    private let progress = ArchiveProgress()

    private var run: RoadRun? { mode == .classic ? classic : expedition }
    private var archiveRoad: ArchiveRoad? { mode == .classic ? board?.classic : board?.expedition }
    private var expeditionUnlocked: Bool {
        board?.classic == nil || ArchiveCompletion.contains(day.gameNo, .classic)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if loading {
                    ProgressView("Loading the road…")
                } else if let error {
                    Text(error)
                    Button("Try again") { reload += 1 }.buttonStyle(.bordered)
                } else if let run {
                    game(run)
                }
            }
            .frame(maxWidth: 370)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .background(RoadTheme.color(0x110900).ignoresSafeArea())
        .foregroundStyle(RoadTheme.gold)
        .tint(RoadTheme.gold)
        .navigationTitle("Day #\(day.gameNo)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            Button {
                muted.toggle()
                if muted { sound.stop() }
            } label: {
                Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
            }
            .accessibilityLabel(muted ? "Unmute sounds" : "Mute sounds")
            Button {
                hapticsEnabled.toggle()
            } label: {
                Image(systemName: hapticsEnabled ? "waveform" : "waveform.slash")
            }
            .accessibilityLabel(hapticsEnabled ? "Turn haptics off" : "Turn haptics on")
        }
        .task(id: reload) { await load() }
        .alert("Start over?", isPresented: $confirmRestart) {
            Button("Keep playing", role: .cancel) {}
            Button("Try again", role: .destructive) { restart() }
        } message: { Text("This ends your current try and starts a new one.") }
    }

    private func game(_ run: RoadRun) -> some View {
        VStack(spacing: 14) {
            Text(archiveDate(run.road.playableAt)).font(.subheadline)
            HStack {
                ForEach(RoadMode.allCases, id: \.self) { option in
                    let available = option == .classic ? board?.classic != nil : board?.expedition != nil
                    let locked = option == .expedition && !expeditionUnlocked
                    Button {
                        switchMode(option)
                    } label: {
                        Label(option.title, systemImage: ArchiveCompletion.contains(day.gameNo, option)
                              ? "checkmark.circle.fill" : locked ? "lock.circle" : "circle")
                            .padding(8)
                            .background(RoadTheme.gold.opacity(mode == option ? 0.2 : 0), in: Capsule())
                    }
                    .disabled(!available || locked)
                    .accessibilityHint(locked ? "Solve Classic to unlock Expedition." : "")
                    .accessibilityAddTraits(mode == option ? .isSelected : [])
                }
            }
            .id(completionVersion)
            Text("Score \(run.score) / \(run.road.maxScore) · Board \(run.road.board.tiles.reduce(0, +))")
                .font(.custom("Chivo-Bold", size: 17, relativeTo: .body)).monospacedDigit()
            if mode == .expedition {
                HStack {
                    Text("Toll −\(run.road.board.tollValue)").foregroundStyle(RoadTheme.toll)
                    Text("Bonus +\(run.road.board.bonusValue)").foregroundStyle(RoadTheme.bonus)
                }.font(.subheadline.bold())
            }
            RoadBoardView(run: run, feedback: feedback, onSelect: select)
                .id(mode)
                .padding(.top, 12)
            Text(hintMessage ?? status(run))
                .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                .foregroundStyle(RoadTheme.bright)
                .multilineTextAlignment(.center)
                .frame(minHeight: 46)
            HStack(spacing: 15) {
                if run.outcome == .inProgress {
                    if run.canUndo { Button("Undo", systemImage: "arrow.uturn.backward") { undo() } }
                    if run.path.count > 1 { Button("Try again", systemImage: "arrow.counterclockwise") { confirmRestart = true } }
                    Button("Hint · \(GameConstants.hintsPerMode - run.hintsUsed)", systemImage: "lightbulb.fill") { hint() }
                        .disabled(run.hintsUsed >= GameConstants.hintsPerMode || archiveRoad?.optimalPaths.isEmpty != false)
                } else if run.outcome == .solved {
                    if mode == .classic && board?.expedition != nil {
                        Button("Play Expedition") { switchMode(.expedition) }
                    }
                    Button("Play again") { restart() }
                } else {
                    Button("Try again") { restart() }
                }
            }
            .buttonStyle(.bordered)
            .font(.subheadline.bold())
            if run.outcome == .solved {
                let result = RoadResult(gameNo: day.gameNo, mode: mode, attempts: run.attempt,
                                        elapsed: nil, hintsUsed: run.hintsUsed)
                ShareLink(item: result.archiveShareText) {
                    Label("Share result", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            let result: ArchiveBoard = try await client.fetch("api/games/\(day.gameNo)/board")
            guard !Task.isCancelled else { return }
            func restore(_ archived: ArchiveRoad?, mode: RoadMode) -> RoadRun? {
                guard let archived, archived.gameNo == day.gameNo, archived.board.isPlayable else { return nil }
                return progress.restore(archived.road, mode: mode)
            }
            let c = restore(result.classic, mode: .classic)
            let e = restore(result.expedition, mode: .expedition)
            guard c != nil || e != nil else { throw URLError(.badServerResponse) }
            board = result
            classic = c
            expedition = e
            if c == nil || (e != nil && expeditionUnlocked && progress.selectedMode(for: day.gameNo) == .expedition) {
                mode = .expedition
            } else {
                mode = .classic
            }
            sound.prepare()
        } catch {
            guard !Task.isCancelled else { return }
            self.error = "This archived road is unavailable right now."
        }
        loading = false
    }

    private func save(_ run: RoadRun) {
        if mode == .classic { classic = run } else { expedition = run }
        progress.save(run, mode: mode)
    }

    private func switchMode(_ mode: RoadMode) {
        self.mode = mode
        progress.selectMode(mode, for: day.gameNo)
        clearInteraction()
    }

    private func clearInteraction() { feedback = nil; hintMessage = nil }
    private func play(_ effect: RoadSound.Effect) { if !muted { sound.play(effect) } }

    private func select(_ tile: Int) {
        guard var run, run.outcome == .inProgress, tile != run.current else { return }
        if tile == run.previous && run.canUndo { undo(); return }
        guard run.legalMoves.contains(tile) else {
            feedback = BoardFeedback(tile: tile, kind: .denied)
            play(.deny)
            return
        }
        clearInteraction()
        run.select(tile)
        save(run)
        play(.move)
        switch run.outcome {
        case .inProgress: feedback = BoardFeedback(tile: tile, kind: .step)
        case .solved:
            feedback = BoardFeedback(tile: tile, kind: .solved)
            ArchiveCompletion.record(day.gameNo, mode)
            completionVersion += 1
            onCompletion()
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
        save(run)
        feedback = BoardFeedback(tile: run.current, kind: .undo)
        play(.undo)
    }

    private func restart() {
        guard var run else { return }
        clearInteraction(); run.restart(); save(run)
    }

    private func status(_ run: RoadRun) -> String {
        switch run.outcome {
        case .inProgress: run.path.count == 1 ? "You’re on the footprints. Step onto any glowing tile to begin." : ""
        case .solved: "Solved. Saved to Past Roads."
        case .wrongTotal: "You reached the finish \(abs(run.road.maxScore - run.score)) \(run.score > run.road.maxScore ? "over" : "short of") the target."
        case .deadEnd: "Dead end. Walk it again to find the way through."
        }
    }

    private func hint() {
        guard var run, let paths = archiveRoad?.optimalPaths,
              run.hintsUsed < GameConstants.hintsPerMode,
              let hint = RoadHints.compute(optimalPaths: paths, pathHistory: run.path,
                                           revealedGuide: run.guidePath) else { return }
        let oldCount = run.hintsUsed
        run.applyHint(hint.guidePath)
        if run.hintsUsed > oldCount { save(run) }
        hintMessage = hint.message(highlightedCount: max(0, run.visibleGuide.count - 1))
    }
}
