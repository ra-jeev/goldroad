import SwiftUI

private struct ArchiveDay: Decodable, Identifiable, Hashable {
    let gameNo: Int
    let playableAt: String
    var id: Int { gameNo }
}

private struct RandomArchiveResponse: Decodable {
    let gameNo: Int
}

private struct ArchiveResponse: Decodable {
    let games: [ArchiveDay]
}

private struct ArchiveRoad: Decodable {
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

private struct ArchiveBoard: Decodable {
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

struct PastRoadsView: View {
    @State private var days: [ArchiveDay] = []
    @State private var loading = true
    @State private var error: String?
    @State private var reload = 0
    @State private var completionVersion = 0
    @State private var randomDay: ArchiveDay?
    @State private var randomBusy = false
    @State private var randomError: String?
    private let client = ArchiveClient()

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
                    ForEach(days) { day in
                        NavigationLink {
                            ArchivedRoadView(day: day) { completionVersion += 1 }
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Day #\(day.gameNo)").font(.headline)
                                    Text(archiveDate(day.playableAt)).font(.subheadline)
                                }
                                Spacer()
                                mark(day.gameNo, .classic)
                                mark(day.gameNo, .expedition)
                                Image(systemName: "chevron.right")
                            }
                            .padding()
                            .background(RoadTheme.gold.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                    if (days.first?.gameNo ?? 0) > 30 {
                        Button(randomBusy ? "Finding a road…" : "Surprise me with an older road") {
                            Task { await chooseOlderRoad() }
                        }
                        .buttonStyle(.bordered)
                        .disabled(randomBusy)
                        if let randomError { Text(randomError).font(.footnote) }
                    }
                    Text("Classic · Expedition. Solve Classic to unlock Expedition.")
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

    private func mark(_ gameNo: Int, _ mode: RoadMode) -> some View {
        let solved = ArchiveCompletion.contains(gameNo, mode)
        return Image(systemName: solved ? "checkmark.circle.fill" : "circle")
            .accessibilityLabel("\(mode.title) \(solved ? "solved" : "not solved")")
            .id(completionVersion)
    }
}

private func archiveDate(_ value: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    guard let date else { return value }
    let display = DateFormatter()
    display.dateStyle = .medium
    display.timeZone = TimeZone(secondsFromGMT: 0)
    return display.string(from: date)
}

private struct ArchivedRoadView: View {
    let day: ArchiveDay
    let onCompletion: () -> Void
    @AppStorage("muted") private var muted = false
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
                        mode = option
                        clearInteraction()
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
                    Button("Hint · \(5 - run.hintsUsed)", systemImage: "lightbulb.fill") { hint() }
                        .disabled(run.hintsUsed >= 5 || archiveRoad?.optimalPaths.isEmpty != false)
                } else if run.outcome == .solved {
                    if mode == .classic && board?.expedition != nil {
                        Button("Play Expedition") { mode = .expedition; clearInteraction() }
                    }
                    Button("Play again") { restart() }
                } else {
                    Button("Try again") { restart() }
                }
            }
            .buttonStyle(.bordered)
            .font(.subheadline.bold())
        }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            let result: ArchiveBoard = try await client.fetch("api/games/\(day.gameNo)/board")
            guard !Task.isCancelled else { return }
            let c = result.classic.flatMap { $0.gameNo == day.gameNo && $0.board.isPlayable ? RoadRun(road: $0.road) : nil }
            let e = result.expedition.flatMap { $0.gameNo == day.gameNo && $0.board.isPlayable ? RoadRun(road: $0.road) : nil }
            guard c != nil || e != nil else { throw URLError(.badServerResponse) }
            board = result
            classic = c
            expedition = e
            mode = c == nil ? .expedition : .classic
            sound.prepare()
        } catch {
            guard !Task.isCancelled else { return }
            self.error = "This archived road is unavailable right now."
        }
        loading = false
    }

    private func save(_ run: RoadRun) {
        if mode == .classic { classic = run } else { expedition = run }
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
            feedback = BoardFeedback(tile: tile, kind: .step)
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
        clearInteraction(); run.undo(); save(run); play(.undo)
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
        guard var run, let paths = archiveRoad?.optimalPaths, !paths.isEmpty, run.hintsUsed < 5 else { return }
        let guide = run.guidePath
        let path = run.path
        let guided = guide.count > 1 && guide.starts(with: path) ? paths.first(where: { $0.starts(with: guide) }) : nil
        guard let best = guided ?? paths.max(by: { commonPrefix($0, path) < commonPrefix($1, path) }) else { return }
        let matched = commonPrefix(best, path)
        let revealed = best.starts(with: guide) ? guide.count : 0
        let diverged = matched != path.count
        let end: Int
        if diverged {
            end = min(best.count, max(matched + 1, revealed > matched ? revealed + 1 : 0, 2))
        } else {
            end = min(best.count, max(matched, revealed) + 1)
        }
        let route = Array(best.prefix(end))
        let oldCount = run.hintsUsed
        run.applyHint(route)
        if run.hintsUsed > oldCount { save(run) }
        hintMessage = diverged ? "Paths diverged. Try again and follow the highlighted path." : "Follow the highlighted path."
    }

    private func commonPrefix(_ a: [Int], _ b: [Int]) -> Int {
        zip(a, b).prefix { $0.0 == $0.1 }.count
    }
}
