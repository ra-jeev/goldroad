import SwiftUI

struct RoadTutorialView: View {
    static let seenKey = "hasSeenRoadTutorial"

    let onFinish: () -> Void
    @AppStorage(Self.seenKey) private var hasSeenTutorial = false
    @State private var practice = false
    @State private var run = RoadRun(road: Self.practiceRoad)
    @State private var message: String?

    private static let route = [11, 6, 7, 2, 1, 0, 5, 10, 15, 20, 21, 16, 17, 12, 13, 18, 23, 24, 19, 14, 9, 8, 3]
    private static let practiceRoad = ClassicRoad(
        gameNo: 0, maxScore: 79, playableAt: "", board: Board(
            rows: 5, cols: 5,
            tiles: [5, 4, 1, 3, 1, 3, 5, 3, 3, 4, 3, 1, 3, 5, 4, 5, 3, 6, 3, 1, 3, 4, 1, 3, 1],
            missingEdges: [.init(from: 17, to: 18), .init(from: 3, to: 4), .init(from: 21, to: 22)],
            tollEdges: [.init(from: 1, to: 6), .init(from: 0, to: 5)],
            bonusEdges: [.init(from: 1, to: 2)], tollValue: 1, bonusValue: 4, start: 11, end: 3
        )
    )

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text(practice ? "Practice road" : "How to play")
                        .font(.custom("Marcellus-Regular", size: 30, relativeTo: .title))
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button("Close", action: onFinish)
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(RoadTheme.color(0xFFE4A0))

                if practice { practiceContent } else { guideContent }
            }
            .frame(maxWidth: 500, alignment: .leading)
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(RoadTheme.color(0x1A0E03).ignoresSafeArea())
        .tint(RoadTheme.gold)
        .onAppear { hasSeenTutorial = true }
    }

    private var guideContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            lesson("From the footprints to the flag", "Start on the footprints and follow glowing tiles. Reach the flag with exactly the target score.")
            lesson("Follow the lanes", "Move up, down, left or right along a lane. An empty gap cannot be crossed.")
            lesson("Tolls and bonuses", "Two dashed rails subtract a toll. Two solid rails add a bonus. Their values appear above the board.")
            lesson("Undo, retry and hint", "Undo the last step with the button or the tile you came from. Try again starts the road over. Hint shows a useful route.")
            action("Try the practice road") { practice = true }
        }
    }

    private var practiceContent: some View {
        VStack(spacing: 16) {
            Text("Walk from the footprints to the flag and reach 79 points.")
                .foregroundStyle(RoadTheme.color(0xDDC79A))
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack {
                Text("Score \(run.score) / 79")
                Spacer()
                Text("Toll −1 · Bonus +4")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(RoadTheme.color(0xFFE4A0))
            RoadBoardView(run: run) { tile in
                run.select(tile)
                message = nil
            }
            Text(message ?? status)
                .font(.subheadline)
                .foregroundStyle(RoadTheme.color(0xDDC79A))
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.updatesFrequently)
            HStack {
                Button("Undo") { run.undo() }
                    .disabled(!run.canUndo)
                Spacer()
                Button("Try again") { run.restart(); message = nil }
                Spacer()
                Button("Hint") {
                    if Self.route.starts(with: run.path) {
                        run.applyHint(Self.route)
                        message = "Follow the pink route."
                    } else {
                        message = "Try again to follow the highlighted route from the start."
                        run.applyHint(Self.route)
                    }
                }
                .disabled(run.outcome != .inProgress || run.hintsUsed >= 5)
            }
            .font(.subheadline.weight(.semibold))
            if run.outcome == .solved {
                action("Finish tutorial", action: onFinish)
            } else {
                Button("Back to guide") { practice = false }
                    .font(.subheadline.weight(.semibold))
            }
        }
    }

    private var status: String {
        switch run.outcome {
        case .inProgress: "Tap a glowing tile to move."
        case .solved: "Practice road complete."
        case .wrongTotal: "That score missed the target. Try again."
        case .deadEnd: "No moves left. Try again."
        }
    }

    private func lesson(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.headline).foregroundStyle(RoadTheme.color(0xFFE4A0))
            Text(detail).font(.body).foregroundStyle(RoadTheme.color(0xDDC79A))
        }
    }

    private func action(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.headline).foregroundStyle(RoadTheme.ink)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(RoadTheme.gold, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}
