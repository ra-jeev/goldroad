import SwiftUI

struct RoadTutorialView: View {
    static let seenKey = "hasSeenRoadTutorial"

    /// Open the practice road on its own, without the guide.
    var startInPractice = false
    let onFinish: () -> Void
    @AppStorage(Self.seenKey) private var hasSeenTutorial = false
    @State private var showPractice = false

    var body: some View {
        Group {
            if startInPractice {
                RoadPracticeView(onBack: nil, onFinish: onFinish)
            } else {
                NavigationStack {
                    guide
                        .toolbar(.hidden, for: .navigationBar)
                        .navigationDestination(isPresented: $showPractice) {
                            RoadPracticeView(onBack: { showPractice = false }, onFinish: onFinish)
                                .toolbar(.hidden, for: .navigationBar)
                        }
                }
            }
        }
        .tint(RoadTheme.gold)
        .onAppear { hasSeenTutorial = true }
    }

    private var guide: some View {
        VStack(spacing: 0) {
            SheetHeader(eyebrow: "How to play", title: "Learn the road", onBack: nil, onClose: onFinish)
            guideContent
        }
        .background(RoadTheme.screenBackground)
    }

    static let route = [11, 6, 7, 2, 1, 0, 5, 10, 15, 20, 21, 16, 17, 12, 13, 18, 23, 24, 19, 14, 9, 8, 3]
    static let practiceRoad = ClassicRoad(
        gameNo: 0, maxScore: 79, playableAt: "", board: Board(
            rows: 5, cols: 5,
            tiles: [5, 4, 1, 3, 1, 3, 5, 3, 3, 4, 3, 1, 3, 5, 4, 5, 3, 6, 3, 1, 3, 4, 1, 3, 1],
            missingEdges: [.init(from: 17, to: 18), .init(from: 3, to: 4), .init(from: 21, to: 22)],
            tollEdges: [.init(from: 1, to: 6), .init(from: 0, to: 5)],
            bonusEdges: [.init(from: 1, to: 2)], tollValue: 1, bonusValue: 4, start: 11, end: 3
        )
    )

    // MARK: Guide

    private var guideContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Learn the basics, then try a practice road.")
                    .font(.body)
                    .foregroundStyle(RoadTheme.sand)
                ForEach(TutorialLesson.all) { lesson in
                    RoadCard {
                        lesson.visual
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                        Text(lesson.title)
                            .font(RoadFont.body(17, relativeTo: .headline))
                            .foregroundStyle(RoadTheme.cream)
                        Text(lesson.body)
                            .font(.body)
                            .foregroundStyle(RoadTheme.sand)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Button("Try a practice road") { showPractice = true }
                    .buttonStyle(GoldButtonStyle(kind: .primary, fullWidth: true))
                    .padding(.top, 4)
            }
            .frame(maxWidth: 500)
            .padding(20)
            .frame(maxWidth: .infinity)
        }
    }
}

/// The practice road, on its own screen.
struct RoadPracticeView: View {
    var onBack: (() -> Void)?
    let onFinish: () -> Void
    @State private var run = RoadRun(road: RoadTutorialView.practiceRoad)
    @State private var message: String?
    @State private var feedback: BoardFeedback?
    @State private var sound = RoadSound()

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(eyebrow: "Practice", title: "Practice road", onBack: onBack, onClose: onFinish)
            practiceContent
        }
        .background(RoadTheme.screenBackground)
        .tint(RoadTheme.gold)
        .onAppear { sound.prepare() }
    }

    // MARK: Practice

    private var practiceContent: some View {
        RoadScreenLayout {
            VStack(spacing: 6) {
                Text("Walk from the footprints to the flag and reach 79 points.")
                    .font(.subheadline)
                    .foregroundStyle(RoadTheme.sand)
                    .multilineTextAlignment(.center)
                RoadMetricsLine(run: run, mode: .expedition)
                RoadLegend(board: run.road.board, visible: true)
            }
        } board: {
            RoadBoardView(run: run, feedback: feedback, onSelect: select)
        } footer: {
            VStack(spacing: 6) {
                RoadStatusLine(text: message ?? status)
                if run.outcome == .solved {
                    HStack(spacing: 10) {
                        Button("Walk it again") { restart() }
                            .buttonStyle(.goldSecondary)
                        Button("Finish tutorial", action: onFinish)
                            .buttonStyle(.goldPrimary)
                    }
                } else {
                    RoadPlayControls(
                        hintsLeft: GameConstants.hintsPerMode - run.hintsUsed,
                        hintEnabled: run.outcome == .inProgress && run.hintsUsed < GameConstants.hintsPerMode,
                        hintLoading: false,
                        retry: RoadStatusCopy.retry(for: run),
                        canUndo: run.canUndo,
                        onHint: hint, onRetry: restart, onUndo: undo
                    )
                }
            }
        }
    }

    private func select(_ tile: Int) {
        guard run.outcome == .inProgress, tile != run.current else { return }
        message = nil
        if tile == run.previous && run.canUndo {
            undo()
            return
        }
        guard run.legalMoves.contains(tile) else {
            feedback = BoardFeedback(tile: tile, kind: .denied)
            sound.play(.deny)
            return
        }
        run.select(tile)
        sound.play(.move)
        switch run.outcome {
        case .inProgress:
            feedback = BoardFeedback(tile: tile, kind: .step)
        case .solved:
            feedback = BoardFeedback(tile: tile, kind: .solved)
            sound.play(.solve)
        case .wrongTotal, .deadEnd:
            feedback = BoardFeedback(tile: tile, kind: .failed)
            sound.play(.deadEnd)
        }
    }

    private func undo() {
        guard run.canUndo else { return }
        run.undo()
        message = nil
        feedback = BoardFeedback(tile: run.current, kind: .undo)
        sound.play(.undo)
    }

    private func restart() {
        run.restart()
        message = nil
        feedback = nil
    }

    private func hint() {
        guard run.outcome == .inProgress else { return }
        let onRoute = RoadTutorialView.route.starts(with: run.path)
        run.applyHint(RoadTutorialView.route)
        message = onRoute ? "Follow the highlighted path."
            : "Paths diverged. Try again and follow the highlighted path."
    }

    private var status: String? {
        switch run.outcome {
        case .inProgress: run.path.count == 1 ? "Tap a glowing tile to move." : nil
        case .solved: "Practice road complete. You are ready for today’s road."
        case .wrongTotal: "That score missed the target. Try again."
        case .deadEnd: "No moves left. Try again."
        }
    }
}

/// Title block for the guide and practice sheets.
private struct SheetHeader: View {
    let eyebrow: String
    let title: String
    let onBack: (() -> Void)?
    let onClose: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            if let onBack {
                BarIconButton(icon: "chevron.left", label: "Back to the guide", action: onBack)
            }
            VStack(alignment: .leading, spacing: 2) {
                Eyebrow(eyebrow)
                Text(title)
                    .font(RoadFont.title(28, relativeTo: .title))
                    .foregroundStyle(RoadTheme.cream)
                    .accessibilityAddTraits(.isHeader)
            }
            Spacer()
            BarIconButton(icon: "xmark", label: "Close", action: onClose)
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 6)
    }
}

// MARK: - Lessons with mini boards, as on the web guide

private struct TutorialLesson: Identifiable {
    let id: String
    let title: String
    let body: String
    let visual: AnyView

    static let all: [TutorialLesson] = [
        .init(id: "icons", title: "From the footprints to the flag",
              body: "You start on the footprints. Glowing tiles are legal moves. Reach the finish flag with your score on target.",
              visual: AnyView(MiniRoad(values: [5, 3, 6], lane: .open, startState: true))),
        .init(id: "open-road", title: "Open lanes",
              body: "You can move up, down, left, or right when there is a lane between neighboring tiles.",
              visual: AnyView(MiniRoad(values: [3, 4], lane: .open))),
        .init(id: "missing-road", title: "Missing lanes",
              body: "An empty gap means there is no lane. You cannot move between those tiles.",
              visual: AnyView(MiniRoad(values: [2, 5], lane: .missing))),
        .init(id: "toll-road", title: "Toll lanes",
              body: "Two dashed rails mark a toll lane. If you cross it, you pay the toll shown above the board.",
              visual: AnyView(MiniRoad(values: [6, 4], lane: .toll))),
        .init(id: "bonus-road", title: "Bonus lanes",
              body: "Two solid rails mark a bonus lane. If you cross it, you get the bonus shown above the board.",
              visual: AnyView(MiniRoad(values: [1, 3], lane: .bonus))),
        .init(id: "undo", title: "Take back a wrong step",
              body: "Tapped the wrong tile? Use the button, or the tile you came from, to undo your last step. You can undo only one step at a time.",
              visual: AnyView(MiniControls(icons: [("arrow.left.to.line", nil)]))),
        .init(id: "retry-hint", title: "Walk it again, or take a hint",
              body: "A road never locks you out. Try again walks it from the start, as often as you like. Hint shows your next useful move.",
              visual: AnyView(MiniControls(icons: [("lightbulb", 5), ("arrow.counterclockwise", nil)]))),
    ]
}

private struct MiniRoad: View {
    enum Lane { case open, missing, toll, bonus }

    let values: [Int]
    let lane: Lane
    var startState = false

    var body: some View {
        let count = values.count
        let pairs = (0..<(count - 1)).map { Board.Edge(from: $0, to: $0 + 1) }
        let board = Board(
            rows: 1, cols: count, tiles: values,
            missingEdges: lane == .missing ? pairs : [],
            tollEdges: lane == .toll ? pairs : [],
            bonusEdges: lane == .bonus ? pairs : [],
            tollValue: 2, bonusValue: 2, start: 0, end: count - 1
        )
        let road = ClassicRoad(gameNo: 0, maxScore: 0, playableAt: "", board: board)
        RoadBoardView(run: RoadRun(road: road),
                      preview: startState ? nil : BoardPreview(markers: false),
                      onSelect: { _ in })
            .frame(width: CGFloat(count) * 50 + CGFloat(count - 1) * 14, height: 50)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .padding(.top, startState ? 6 : 0)
    }
}

private struct MiniControls: View {
    let icons: [(String, Int?)]

    var body: some View {
        HStack(spacing: 22) {
            ForEach(icons.indices, id: \.self) { index in
                let (icon, badge) = icons[index]
                Image(systemName: icon)
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(RoadTheme.gold)
                    .frame(width: 50, height: 50)
                    .background(RoadTheme.gold.opacity(0.08), in: Circle())
                    .overlay(Circle().strokeBorder(RoadTheme.gold.opacity(0.3), lineWidth: 1))
                    .overlay(alignment: .topTrailing) {
                        if let badge {
                            Text("\(badge)")
                                .font(RoadFont.body(12, relativeTo: .caption2))
                                .foregroundStyle(RoadTheme.ink)
                                .frame(minWidth: 20, minHeight: 20)
                                .background(RoadTheme.gold, in: Circle())
                                .offset(x: 4, y: -4)
                        }
                    }
            }
        }
        .accessibilityHidden(true)
    }
}
