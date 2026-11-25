import SwiftUI

// Shared pieces for every board screen (daily, past roads, practice), so the three stay alike.

enum RoadFont {
    static func body(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Chivo-Bold", size: size, relativeTo: style)
    }

    static func title(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2) -> Font {
        .custom("Marcellus-Regular", size: size, relativeTo: style)
    }
}

extension RoadTheme {
    static let cream = color(0xFFE4A0)
    static let sand = color(0xDDC79A)
    static let card = gold.opacity(0.07)
    static let cardBorder = gold.opacity(0.22)

    static var screenBackground: some View {
        ZStack {
            LinearGradient(colors: [color(0x1A0E03), color(0x110900), color(0x0D0702)],
                           startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [color(0xA05A00).opacity(0.22), .clear],
                           center: UnitPoint(x: 0.15, y: 0), startRadius: 0, endRadius: 280)
        }
        .ignoresSafeArea()
    }
}

// MARK: - Buttons

struct GoldButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, ghost }
    var kind: Kind = .primary
    var fullWidth = false
    /// A shorter pill for list rows. The pill is 38 pt tall, and its tap area
    /// grows to 44 pt.
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(RoadFont.body(compact ? 15 : 16))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, compact ? 16 : 20)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: compact ? 38 : 48)
            .foregroundStyle(kind == .primary ? RoadTheme.ink : RoadTheme.cream)
            .background {
                switch kind {
                case .primary:
                    Capsule().fill(LinearGradient(colors: [RoadTheme.color(0xF7D77E), RoadTheme.gold],
                                                  startPoint: .topLeading, endPoint: .bottomTrailing))
                case .secondary:
                    Capsule().fill(RoadTheme.gold.opacity(0.14))
                case .ghost:
                    Capsule().fill(.clear)
                }
            }
            .overlay {
                if kind != .primary {
                    Capsule().strokeBorder(RoadTheme.gold.opacity(kind == .ghost ? 0.4 : 0.3), lineWidth: 1)
                }
            }
            .contentShape(Capsule())
            .padding(.vertical, compact ? 3 : 0)
            .contentShape(compact ? AnyShape(Rectangle()) : AnyShape(Capsule()))
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

extension ButtonStyle where Self == GoldButtonStyle {
    static var goldPrimary: GoldButtonStyle { GoldButtonStyle(kind: .primary) }
    static var goldSecondary: GoldButtonStyle { GoldButtonStyle(kind: .secondary) }
    static var goldGhost: GoldButtonStyle { GoldButtonStyle(kind: .ghost) }
}

/// The square icon button used in top bars.
struct BarIconButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 38, height: 38)
                .background(RoadTheme.gold.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(RoadTheme.gold.opacity(0.22), lineWidth: 1))
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(RoadTheme.gold)
        .accessibilityLabel(label)
    }
}

/// One top bar for every board screen: back, a title with a small line under it, then actions.
struct RoadTopBar<Actions: View>: View {
    let title: String
    var subtitle: String?
    var onBack: (() -> Void)?
    @ViewBuilder var actions: Actions

    var body: some View {
        HStack(spacing: 8) {
            if let onBack {
                BarIconButton(icon: "chevron.left", label: "Back", action: onBack)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(RoadFont.title(23))
                    .foregroundStyle(LinearGradient(colors: [RoadTheme.color(0xFFE08A), RoadTheme.darkGold],
                                                    startPoint: .top, endPoint: .bottom))
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle)
                        .font(RoadFont.body(13, relativeTo: .caption))
                        .foregroundStyle(RoadTheme.gold)
                        .monospacedDigit()
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .padding(.leading, onBack == nil ? 6 : 0)
            Spacer(minLength: 4)
            actions
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(RoadTheme.color(0x1A0E03).opacity(0.92))
        .overlay(alignment: .bottom) {
            Rectangle().fill(RoadTheme.gold.opacity(0.17)).frame(height: 1)
        }
    }
}

// MARK: - Screen layout

/// Top controls, then the board centred in the free space, then a footer of fixed height.
/// The fixed footer keeps the board still when the run ends and the buttons change.
struct RoadScreenLayout<Top: View, Board: View, Footer: View>: View {
    /// Status line (44) + spacing (6) + the 56pt control row. No slack, so the board sits in the true centre.
    static var footerHeight: CGFloat { 108 }

    @ViewBuilder var top: Top
    @ViewBuilder var board: Board
    @ViewBuilder var footer: Footer

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    top
                    Spacer(minLength: 14)
                    board
                    Spacer(minLength: 14)
                    footer
                        .frame(height: Self.footerHeight, alignment: .top)
                }
                .frame(maxWidth: 390)
                .padding(.horizontal, 12)
                .padding(.top, 14)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity, minHeight: geometry.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}

// MARK: - Mode toggle, score, legend

struct RoadModeToggle: View {
    struct Option {
        let mode: RoadMode
        let solved: Bool
        let locked: Bool
        let enabled: Bool
    }

    let selected: RoadMode
    let options: [Option]
    let onSelect: (RoadMode) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.mode) { option in
                let active = selected == option.mode
                Button {
                    onSelect(option.mode)
                } label: {
                    HStack(spacing: 6) {
                        Text(option.mode.title)
                        Image(systemName: option.solved ? "checkmark.circle.fill"
                              : option.locked ? "lock.circle" : "circle.circle")
                            .font(.system(size: 13))
                            .accessibilityHidden(true)
                    }
                    .font(RoadFont.body(16))
                    .padding(.horizontal, 16)
                    .frame(minHeight: 36)
                    .background(RoadTheme.gold.opacity(active ? 0.18 : 0), in: Capsule())
                    .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(active ? 0.3 : 0), lineWidth: 1))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .foregroundStyle(RoadTheme.gold.opacity(option.locked || !option.enabled ? 0.45 : active ? 1 : 0.7))
                .disabled(option.locked || !option.enabled)
                .accessibilityAddTraits(active ? .isSelected : [])
                .accessibilityHint(option.locked ? "Solve Classic to unlock Expedition." : option.solved ? "Solved" : "")
            }
        }
        .padding(3)
        .background(RoadTheme.gold.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.22), lineWidth: 1))
    }
}

struct RoadMetricsLine: View {
    let run: RoadRun
    let mode: RoadMode

    var body: some View {
        let over = mode == .classic && run.score > run.road.maxScore
        let total = run.road.board.tiles.reduce(0, +)
        HStack(spacing: 6) {
            Text("Score").foregroundStyle(RoadTheme.gold.opacity(0.72))
            Text(run.score, format: .number).foregroundStyle(over ? RoadTheme.toll : RoadTheme.gold)
                .contentTransition(.numericText())
                .accessibilityIdentifier("road-score")
            Text("/").foregroundStyle(RoadTheme.gold.opacity(0.62))
            Text(run.road.maxScore, format: .number)
            Text("•").foregroundStyle(RoadTheme.gold.opacity(0.58))
            Text("Board").foregroundStyle(RoadTheme.gold.opacity(0.72))
            Text(total, format: .number)
        }
        .font(RoadFont.body(19))
        .monospacedDigit()
        .foregroundStyle(RoadTheme.gold)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(run.score), target \(run.road.maxScore), board \(total)")
        .accessibilityIdentifier("road-metrics")
    }
}

/// The two rails of a toll (dashed) or bonus (solid) lane, drawn like the board draws them.
struct RailGlyph: View {
    enum Kind { case toll, bonus }
    let kind: Kind
    var length: CGFloat = 16

    var body: some View {
        Canvas { context, size in
            RoadRails.draw(in: context, kind: kind, from: CGPoint(x: 0, y: size.height / 2),
                           length: size.width, horizontal: true, scale: 1,
                           color: kind == .toll ? RoadTheme.toll : RoadTheme.bonus, opacity: 1)
        }
        .frame(width: length, height: 18)
        .accessibilityHidden(true)
    }
}

enum RoadRails {
    /// Half the distance between the two rails at a 50 pt coin, as on the web (12 pt road, rails at -1.4 and 25.4 of 24).
    static let halfGap: CGFloat = 6.7
    static let lineWidth: CGFloat = 3.2

    static func draw(in context: GraphicsContext, kind: RailGlyph.Kind, from start: CGPoint, length: CGFloat,
                     horizontal: Bool, scale: CGFloat, color: Color, opacity: Double) {
        for side in [-1.0, 1.0] as [CGFloat] {
            let offset = side * halfGap * scale
            let line = Path { path in
                if horizontal {
                    path.move(to: CGPoint(x: start.x, y: start.y + offset))
                    path.addLine(to: CGPoint(x: start.x + length, y: start.y + offset))
                } else {
                    path.move(to: CGPoint(x: start.x + offset, y: start.y))
                    path.addLine(to: CGPoint(x: start.x + offset, y: start.y + length))
                }
            }
            context.stroke(line, with: .color(color.opacity(opacity)),
                           style: StrokeStyle(lineWidth: lineWidth, lineCap: kind == .toll ? .butt : .round,
                                              dash: kind == .toll ? [length / 3, length / 3] : []))
        }
    }
}

/// Toll and bonus values for Expedition. It always takes its space, so the board does not move between modes.
struct RoadLegend: View {
    let board: Board
    let visible: Bool

    var body: some View {
        HStack(spacing: 12) {
            item(.toll, label: "Toll", value: "−\(board.tollValue)", color: RoadTheme.toll)
            Text("•").foregroundStyle(RoadTheme.gold.opacity(0.6))
            item(.bonus, label: "Bonus", value: "+\(board.bonusValue)", color: RoadTheme.bonus)
        }
        .frame(height: 30)
        .opacity(visible ? 1 : 0)
        .accessibilityHidden(!visible)
        .accessibilityElement(children: .combine)
    }

    private func item(_ kind: RailGlyph.Kind, label: String, value: String, color: Color) -> some View {
        HStack(spacing: 7) {
            RailGlyph(kind: kind, length: 14)
            Text(label).font(RoadFont.body(15)).opacity(0.75)
            Text(value).font(RoadFont.body(20)).monospacedDigit()
        }
        .foregroundStyle(color)
    }
}

// MARK: - Footer

/// The play row from the web footer: Hint on the left, Try again in the middle, Undo on the right.
struct RoadPlayControls: View {
    enum Retry: Equatable {
        case icon(enabled: Bool)
        case primary
        case resting(attempt: Int)
        case hidden
    }

    let hintsLeft: Int?
    let hintEnabled: Bool
    let hintLoading: Bool
    var hintNudge = 0
    let retry: Retry
    let canUndo: Bool
    let onHint: () -> Void
    let onRetry: () -> Void
    let onUndo: () -> Void
    /// In a replay the hint slot becomes "End replay".
    var onExit: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack {
            if let onExit {
                roundButton(icon: "xmark", label: "End replay", enabled: true, action: onExit)
            } else {
                hintButton
            }
            Spacer()
            retryControl
            Spacer()
            roundButton(icon: "arrow.left.to.line", label: "Undo last step", enabled: canUndo, action: onUndo)
        }
        .frame(height: 56)
    }

    private var hintButton: some View {
        KeyframeAnimator(initialValue: 0.0, trigger: hintNudge) { light in
            let glow = reduceMotion ? 0 : light
            Button(action: onHint) {
                ZStack {
                    if hintLoading {
                        ProgressView().tint(RoadTheme.gold)
                    } else {
                        Image(systemName: "lightbulb")
                            .font(.system(size: 20, weight: .bold))
                            .scaleEffect(1 + glow * 0.18)
                            .shadow(color: RoadTheme.gold.opacity(glow), radius: 7)
                    }
                }
                .frame(width: 50, height: 50)
                .background(RoadTheme.gold.opacity(0.08 + glow * 0.12), in: Circle())
                .overlay(Circle().strokeBorder(RoadTheme.gold.opacity(0.3), lineWidth: 1))
                .overlay(alignment: .topTrailing) {
                    if let hintsLeft {
                        Text("\(hintsLeft)")
                            .font(RoadFont.body(12, relativeTo: .caption2))
                            .foregroundStyle(RoadTheme.ink)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(RoadTheme.gold, in: Circle())
                            .offset(x: 4, y: -4)
                    }
                }
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(RoadTheme.gold)
            .opacity(hintEnabled ? 1 : 0.4)
            .disabled(!hintEnabled || hintLoading)
            .accessibilityLabel(hintsLeft.map { "Hint, \($0) \($0 == 1 ? "hint" : "hints") left" } ?? "Hint")
        } keyframes: { _ in
            LinearKeyframe(1, duration: 0.12)
            LinearKeyframe(0, duration: 0.14)
            LinearKeyframe(0, duration: 0.08)
            LinearKeyframe(1, duration: 0.12)
            LinearKeyframe(0, duration: 0.24)
        }
    }

    @ViewBuilder
    private var retryControl: some View {
        switch retry {
        case .icon(let enabled):
            roundButton(icon: "arrow.counterclockwise", label: "Try again", enabled: enabled, action: onRetry)
        case .primary:
            Button("Try again", action: onRetry)
                .buttonStyle(.goldPrimary)
        case .resting(let attempt):
            Text(Self.ordinalTry(attempt))
                .font(RoadFont.body(16))
                .foregroundStyle(RoadTheme.gold.opacity(0.8))
                .accessibilityLabel("Try \(attempt)")
        case .hidden:
            Color.clear.frame(width: 50, height: 50)
        }
    }

    private func roundButton(icon: String, label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .bold))
                .frame(width: 50, height: 50)
                .background(RoadTheme.gold.opacity(0.06), in: Circle())
                .overlay(Circle().strokeBorder(RoadTheme.gold.opacity(0.3), lineWidth: 1))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(RoadTheme.gold)
        .opacity(enabled ? 1 : 0.35)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    static func ordinalTry(_ attempt: Int) -> String {
        let suffixes = ["st", "nd", "rd"]
        let index = ((attempt + 90) % 100 - 10) % 10 - 1
        let suffix = (0..<3).contains(index) ? suffixes[index] : "th"
        return "\(attempt)\(suffix) Try"
    }
}

/// A status line with a fixed height of two lines, so a longer message does not push the board.
struct RoadStatusLine: View {
    let text: String?

    var body: some View {
        Text(text ?? " ")
            .font(RoadFont.body(15))
            .foregroundStyle(RoadTheme.gold)
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.85)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .animation(.easeOut(duration: 0.2), value: text)
            .accessibilityIdentifier("road-status")
    }
}

enum RoadStatusCopy {
    static func text(for run: RoadRun) -> String? {
        switch run.outcome {
        case .inProgress:
            run.path.count == 1 && run.attempt == 1 ? "You’re on the footprints. Step onto any glowing tile to begin." : nil
        case .solved: nil
        case .wrongTotal:
            "You reached the finish \(abs(run.road.maxScore - run.score)) \(run.score > run.road.maxScore ? "over" : "short of") the target."
        case .deadEnd: "Dead end. Walk it again to find the way through."
        }
    }

    static func retry(for run: RoadRun, canRetry: Bool = true) -> RoadPlayControls.Retry {
        guard canRetry else { return .hidden }
        switch run.outcome {
        case .wrongTotal, .deadEnd: return .primary
        case .solved: return .hidden
        case .inProgress:
            if run.path.count > 1 { return .icon(enabled: true) }
            return run.attempt > 1 ? .resting(attempt: run.attempt) : .icon(enabled: false)
        }
    }
}

// MARK: - Countdown and flame

struct NextRoadCountdown: View {
    let cutoff: Date
    var prefix = "Next road in"

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            if cutoff > context.date {
                HStack(spacing: 5) {
                    Text(prefix)
                    Text(timerInterval: context.date...cutoff, countsDown: true)
                        .monospacedDigit()
                        .fixedSize()
                    LocalRoadTime(cutoff: cutoff)
                }
                .accessibilityElement(children: .combine)
            } else {
                Text("A new road is ready.")
            }
        }
    }
}

/// The next road's start in the player's own time, such as "(5:30 AM)". The road changes at
/// 00:00 UTC, so a countdown alone leaves players outside UTC guessing the hour.
struct LocalRoadTime: View {
    let cutoff: Date

    var body: some View {
        Text("(\(cutoff.formatted(date: .omitted, time: .shortened)))")
            .monospacedDigit()
            .fixedSize()
            .opacity(0.75)
            .accessibilityLabel("at \(cutoff.formatted(date: .omitted, time: .shortened))")
    }
}

struct StreakFlame: View {
    let lit: Bool
    var size: CGFloat = 34

    var body: some View {
        Image(systemName: "flame.fill")
            .font(.system(size: size))
            .foregroundStyle(lit
                ? AnyShapeStyle(LinearGradient(colors: [RoadTheme.color(0xFFD54A), RoadTheme.color(0xFF7A1A), RoadTheme.color(0xE0431B)],
                                               startPoint: .top, endPoint: .bottom))
                : AnyShapeStyle(RoadTheme.color(0x5A4A3A)))
            .shadow(color: lit ? RoadTheme.color(0xFF8A1A).opacity(0.55) : .clear, radius: 10)
            .accessibilityHidden(true)
    }
}

/// A gold segmented control, used in place of the system one, which draws grey on the dark theme.
struct GoldSegmentedPicker<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [(value: Value, label: String)]

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let active = option.value == selection
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { selection = option.value }
                } label: {
                    Text(option.label)
                        .font(RoadFont.body(15))
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(RoadTheme.gold.opacity(active ? 0.2 : 0), in: Capsule())
                        .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(active ? 0.32 : 0), lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .foregroundStyle(RoadTheme.gold.opacity(active ? 1 : 0.65))
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(3)
        .background(RoadTheme.gold.opacity(0.07), in: Capsule())
        .overlay(Capsule().strokeBorder(RoadTheme.gold.opacity(0.2), lineWidth: 1))
    }
}

struct RoadCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(RoadTheme.cardBorder))
    }
}

struct Eyebrow: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(RoadFont.body(12, relativeTo: .caption))
            .tracking(1.4)
            .foregroundStyle(RoadTheme.gold)
    }
}
