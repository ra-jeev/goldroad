import SwiftUI

enum RoadTheme {
    static let gold = color(0xDAA520)
    static let darkGold = color(0xB8860B)
    static let bright = color(0xD4AF37)
    static let ink = color(0x2D1C02)
    static let toll = color(0xD2691E)
    static let bonus = color(0xFFCE3A)
    static let hint = color(0xD6336C)

    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255,
              blue: Double(hex & 255) / 255)
    }
}

struct BoardFeedback: Equatable {
    enum Kind {
        case step, undo, denied, failed, solved

        var haptic: SensoryFeedback {
            switch self {
            case .step: .impact(weight: .light)
            case .undo: .impact(flexibility: .soft)
            case .denied: .warning
            case .failed: .error
            case .solved: .success
            }
        }
    }
    let id = UUID()
    let tile: Int
    let kind: Kind
}

struct RoadBoardView: View {
    let run: RoadRun
    var feedback: BoardFeedback?
    let onSelect: (Int) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage(GameConstants.hapticsKey) private var hapticsEnabled = true
    private let gap: CGFloat = 14

    var body: some View {
        let run = self.run
        let feedback = self.feedback
        let reduceMotion = self.reduceMotion
        let gap = self.gap
        let hapticsEnabled = self.hapticsEnabled
        let board = run.road.board
        let legal = Set(run.legalMoves)
        let visited = Set(run.path)
        let guided = Set(run.visibleGuide.dropFirst())
        GeometryReader { geometry in
            let size = CGSize(
                width: (geometry.size.width - CGFloat(board.cols - 1) * gap) / CGFloat(board.cols),
                height: (geometry.size.height - CGFloat(board.rows - 1) * gap) / CGFloat(board.rows)
            )

            ZStack {
                Color.clear
                    .keyframeAnimator(initialValue: 1.0, trigger: feedback?.id) { _, progress in
                        Canvas { context, _ in
                            let animatingWalk = !reduceMotion && feedback?.tile == run.current
                                && (feedback?.kind == .step || feedback?.kind == .solved)
                            Self.drawRoads(in: context, run: run, size: size, gap: gap,
                                           legal: legal, visited: visited, walkProgress: animatingWalk ? progress : 1)
                        }
                    } keyframes: { _ in
                        MoveKeyframe(0)
                        CubicKeyframe(1, duration: 0.24)
                    }
                    .accessibilityHidden(true)
                    .allowsHitTesting(false)

                VStack(spacing: gap) {
                    ForEach(0..<board.rows, id: \.self) { row in
                        HStack(spacing: gap) {
                            ForEach(0..<board.cols, id: \.self) { column in
                                let index = row * board.cols + column
                                tile(index, size: size, active: legal.contains(index),
                                     visited: visited.contains(index), guided: guided.contains(index))
                            }
                        }
                    }
                }
            }
            .keyframeAnimator(initialValue: 0.0, trigger: feedback?.id) { content, progress in
                let pulse = feedback?.kind == .solved && !reduceMotion ? sin(progress * .pi) : 0
                content.scaleEffect(1 + pulse * 0.025)
                    .shadow(color: RoadTheme.gold.opacity(pulse * 0.4), radius: pulse * 12)
            } keyframes: { _ in
                MoveKeyframe(0)
                LinearKeyframe(1, duration: 0.45)
            }
        }
        .aspectRatio(CGFloat(board.cols) / CGFloat(board.rows), contentMode: .fit)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Puzzle board")
        .sensoryFeedback(trigger: feedback) { _, event in
            hapticsEnabled ? event?.kind.haptic : nil
        }
    }

    private nonisolated static func drawRoads(in context: GraphicsContext, run: RoadRun,
                                              size: CGSize, gap: CGFloat, legal: Set<Int>,
                                              visited: Set<Int>, walkProgress: Double) {
        let board = run.road.board
        let walked = edges(in: run.path)
        let guide = edges(in: run.visibleGuide)
        let latestEdge = run.path.count > 1
            ? Board.Edge(from: min(run.path[run.path.count - 2], run.current),
                         to: max(run.path[run.path.count - 2], run.current)) : nil

        for from in board.tiles.indices {
            for to in board.neighbors(of: from) where to > from {
                let key = Board.Edge(from: from, to: to)
                let direction = walked[key] ?? guide[key]
                let active = (from == run.current && legal.contains(to)) || (to == run.current && legal.contains(from))
                let closed = visited.contains(from) || visited.contains(to)
                let adjustment = board.adjustment(from: from, to: to)
                let normal = adjustment < 0 ? RoadTheme.toll : adjustment > 0 ? RoadTheme.bonus : RoadTheme.gold
                let color = guide[key] != nil && walked[key] == nil ? RoadTheme.hint
                    : walked[key] != nil && adjustment == 0 ? RoadTheme.darkGold : normal
                let opacity = direction != nil || active ? 1.0 : closed ? 0.26 : 0.78

                let horizontal = to - from == 1
                let center = CGPoint(x: CGFloat(from % board.cols) * (size.width + gap) + size.width / 2,
                                     y: CGFloat(from / board.cols) * (size.height + gap) + size.height / 2)
                let radius = min(size.width, size.height) / 2
                let length = (horizontal ? size.width : size.height) + gap - 2 * radius

                func point(_ along: CGFloat, _ across: CGFloat) -> CGPoint {
                    horizontal
                        ? CGPoint(x: center.x + radius + along, y: center.y + across)
                        : CGPoint(x: center.x + across, y: center.y + radius + along)
                }

                var roadContext = context
                if key == latestEdge, walked[key] != nil, walkProgress < 1, let direction {
                    let progress = CGFloat(max(0, min(1, walkProgress)))
                    let start = direction ? 0 : length * (1 - progress)
                    let clip = horizontal
                        ? CGRect(x: center.x + radius + start, y: center.y - 12,
                                 width: length * progress, height: 24)
                        : CGRect(x: center.x - 12, y: center.y + radius + start,
                                 width: 24, height: length * progress)
                    roadContext.clip(to: Path(clip))
                }
                if active || guide[key] != nil {
                    roadContext.addFilter(.shadow(color: color.opacity(0.65), radius: 4))
                }
                for offset in adjustment == 0 ? [CGFloat(0)] : [-4, 4] {
                    let line = Path { path in
                        path.move(to: point(0, offset))
                        path.addLine(to: point(length, offset))
                    }
                    roadContext.stroke(line, with: .color(color.opacity(opacity)),
                                       style: StrokeStyle(lineWidth: 3.2, lineCap: adjustment < 0 ? .butt : .round,
                                                          dash: adjustment < 0 ? [length / 3, length / 3] : []))
                }

                if let direction {
                    if adjustment != 0 {
                        let sign: CGFloat = direction ? 1 : -1
                        let middle = length / 2
                        let arrow = Path { path in
                            path.move(to: point(middle + sign * 3.1175, 0))
                            path.addLine(to: point(middle - sign * 3.1175, -3.6))
                            path.addLine(to: point(middle - sign * 3.1175, 3.6))
                            path.closeSubpath()
                        }
                        roadContext.fill(arrow, with: .color(color))
                    } else {
                        let tip = direction ? length : 0
                        let tail = direction ? tip - 4.5 : tip + 4.5
                        let arrow = Path { path in
                            path.move(to: point(tail, -4))
                            path.addLine(to: point(tip, 0))
                            path.addLine(to: point(tail, 4))
                        }
                        roadContext.stroke(arrow, with: .color(color),
                                       style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                    }
                }
            }
        }
    }

    private nonisolated static func edges(in path: [Int]) -> [Board.Edge: Bool] {
        zip(path, path.dropFirst()).reduce(into: [:]) { edges, pair in
            edges[Board.Edge(from: min(pair.0, pair.1), to: max(pair.0, pair.1))] = pair.0 < pair.1
        }
    }

    private func tile(_ index: Int, size: CGSize, active: Bool, visited: Bool, guided: Bool) -> some View {
        let board = run.road.board
        let reduceMotion = self.reduceMotion
        let current = index == run.current
        let undo = run.canUndo && index == run.previous
        let diameter = min(size.width, size.height)
        let marker = index == board.start ? "Footprints" : index == board.end ? "FinishFlag" : nil
        let adjustment = active ? board.adjustment(from: run.current, to: index) : 0
        let border = guided ? RoadTheme.hint : visited ? RoadTheme.darkGold : RoadTheme.gold.opacity(active ? 1 : 0.72)
        let glow = guided ? RoadTheme.hint : RoadTheme.gold

        return Button {
            onSelect(index)
        } label: {
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: visited
                            ? [RoadTheme.bright, RoadTheme.color(0xB88E1E)]
                            : [RoadTheme.color(0x23180C), RoadTheme.color(0x0E0905)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    ))
                    .shadow(color: .black.opacity(0.45), radius: 2, y: 2)
                    .shadow(color: glow.opacity(!guided && (active || visited) ? 0.68 : 0), radius: visited ? 7 : 6)

                Circle().strokeBorder(border, lineWidth: 2.7)
                    .keyframeAnimator(initialValue: 1.0, trigger: guided) { content, brightness in
                        let value = guided && !reduceMotion ? brightness : 1
                        content.opacity(value)
                            .shadow(color: RoadTheme.hint.opacity(guided ? value * 0.8 : 0), radius: 5)
                    } keyframes: { _ in
                        MoveKeyframe(1)
                        LinearKeyframe(1, duration: 0.13)
                        LinearKeyframe(0.4, duration: 0.12)
                        LinearKeyframe(0.4, duration: 0.07)
                        LinearKeyframe(1, duration: 0.17)
                        LinearKeyframe(0.8, duration: 0.21)
                    }
                Circle().inset(by: 3).strokeBorder(
                    LinearGradient(colors: [.white.opacity(visited ? 0.4 : 0.14), .clear, .black.opacity(0.5)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1.5
                )
                Text(board.tiles[index], format: .number)
                    .font(.custom("Chivo-Bold", fixedSize: min(26, diameter * 0.55)))
                    .foregroundStyle(visited ? RoadTheme.ink : RoadTheme.gold.opacity(active ? 1 : 0.76))
                    .shadow(color: .white.opacity(visited ? 0.48 : 0.28), radius: 0, x: -0.6, y: -0.6)
                    .shadow(color: .black.opacity(0.8), radius: 1, x: 1, y: 1)
            }
            .frame(width: diameter, height: diameter)
            .overlay(alignment: .topTrailing) {
                if let marker {
                    Image(marker)
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .padding(4)
                        .frame(width: 23, height: 23)
                        .foregroundStyle(RoadTheme.gold)
                        .background(RoadTheme.ink, in: Circle())
                        .overlay(Circle().strokeBorder(RoadTheme.gold, lineWidth: 1))
                        .shadow(color: .black.opacity(0.45), radius: 2, y: 1)
                        .offset(x: 5, y: -5)
                        .allowsHitTesting(false)
                }
            }
            .keyframeAnimator(initialValue: 0.0, trigger: feedback?.tile == index ? feedback?.id : nil) { content, progress in
                let kind = feedback?.tile == index && !reduceMotion ? feedback?.kind : nil
                let pulse = sin(progress * .pi)
                content
                    .scaleEffect(kind == .step ? 1 + pulse * 0.07 : kind == .denied ? 1 - pulse * 0.10 : 1)
                    .offset(x: kind == .failed ? sin(progress * 4 * .pi) * 4 : 0)
                    .overlay {
                        Circle().strokeBorder(RoadTheme.toll.opacity(kind == .denied ? pulse : 0), lineWidth: 3)
                    }
            } keyframes: { _ in
                MoveKeyframe(0)
                LinearKeyframe(1, duration: 0.22)
            }
            .frame(width: size.width, height: size.height)
            .contentShape(Rectangle())
        }
        .buttonStyle(CoinButtonStyle())
        .disabled(run.outcome != .inProgress || current)
        .accessibilityIdentifier("tile-\(index)")
        .accessibilityLabel(tileLabel(index, adjustment: adjustment))
        .accessibilityValue(current ? "Current tile" : undo ? "Undo last step" : visited ? "Visited" : active ? "Available move" : "Unavailable")
    }

    private func tileLabel(_ index: Int, adjustment: Int) -> String {
        let board = run.road.board
        let name = index == board.start ? "Start" : index == board.end ? "Finish" : "Tile"
        let position = "row \(index / board.cols + 1), column \(index % board.cols + 1)"
        let edge = adjustment == 0 ? "" : adjustment < 0 ? ", toll of \(-adjustment)" : ", bonus of \(adjustment)"
        return "\(name), \(board.tiles[index]) points, \(position)\(edge)"
    }
}

private struct CoinButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.88 : 1)
    }
}
