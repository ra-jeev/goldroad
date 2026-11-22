import SwiftUI

/// The solve sheet, as on the web: a short card that fits its content, not a full screen.
struct RoadResultView: View {
    let result: RoadResult
    var classicResult: RoadResult? = nil
    var cutoff: Date? = nil
    var onContinueToExpedition: (() -> Void)? = nil
    var onViewStats: (() -> Void)? = nil
    let onDismiss: () -> Void

    @State private var height: CGFloat = 420

    private enum Tier { case gold, medal, relief }

    private var isDayComplete: Bool { result.mode == .expedition && classicResult != nil }
    private var medal: RoadResult.Medal? { RoadResult.Medal.forAttempt(result.attempts, solved: true) }
    private var tier: Tier { medal == .gold ? .gold : medal != nil ? .medal : .relief }
    private var expeditionLeads: Bool { onContinueToExpedition != nil && tier == .relief }

    private var heading: (eyebrow: String, title: String, body: String) {
        if isDayComplete { return ("Day complete", "Both roads conquered.", "See you tomorrow.") }
        if result.mode == .expedition { return ("Expedition solved", "Road conquered.", "That wraps the Expedition road for today.") }
        let body: String
        switch tier {
        case .gold: body = "A flawless start. Carry that momentum straight into Expedition."
        case .medal: body = "Medal secured. There is more road waiting in Expedition."
        case .relief: body = "Every solve counts. You stayed with the road and found the way through."
        }
        let title = tier == .gold ? "Gold. First try." : tier == .medal ? "Clean solve." : "Road conquered."
        return ("Classic solved", title, onContinueToExpedition == nil ? "That wraps the Classic road for today." : body)
    }

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // The sheet fits its content. At large text sizes the content can be taller than the screen,
        // so it scrolls, and a large detent is offered too.
        ScrollView {
            content
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationDetents(typeSize.isAccessibilitySize ? [.height(height), .large] : [.height(height)])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(28)
            .presentationBackground {
                LinearGradient(colors: [RoadTheme.color(0x3A250C), RoadTheme.color(0x1A0E03)],
                               startPoint: .top, endPoint: .bottom)
            }
    }

    private var content: some View {
        VStack(spacing: 14) {
            HStack {
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .frame(width: 34, height: 34)
                        .background(RoadTheme.gold.opacity(0.1), in: Circle())
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(RoadTheme.gold)
                .accessibilityLabel("Close")
            }
            .padding(.bottom, -18)

            if !isDayComplete {
                ZStack(alignment: .topTrailing) {
                    Text(medal?.emoji ?? "✓")
                        .font(.system(size: 54))
                        .foregroundStyle(RoadTheme.gold)
                    if result.mode == .classic {
                        Text("+1")
                            .font(RoadFont.body(13, relativeTo: .caption))
                            .foregroundStyle(RoadTheme.ink)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(RoadTheme.gold, in: Capsule())
                            .offset(x: 18, y: -2)
                            .accessibilityLabel("Streak plus one")
                    }
                }
            }

            VStack(spacing: 6) {
                Eyebrow(heading.eyebrow)
                Text(heading.title)
                    .font(RoadFont.title(30, relativeTo: .title))
                    .foregroundStyle(RoadTheme.cream)
                    .accessibilityAddTraits(.isHeader)
                Text(heading.body)
                    .font(.body)
                    .foregroundStyle(RoadTheme.sand)
                    .multilineTextAlignment(.center)
            }

            if isDayComplete, let classicResult {
                VStack(spacing: 8) {
                    dayRow(classicResult)
                    dayRow(result)
                }
                if let cutoff {
                    NextRoadCountdown(cutoff: cutoff)
                        .font(RoadFont.body(14, relativeTo: .footnote))
                        .foregroundStyle(RoadTheme.gold)
                }
            } else {
                chips
            }

            actions
                .padding(.top, 4)

        }
        .frame(maxWidth: 420)
        .padding(.horizontal, 24)
        .padding(.top, 14)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity)
    }

    private var chips: some View {
        let items = [medal.map { "\($0.name) medal" } ?? "Solved",
                     "\(result.attempts) \(result.attempts == 1 ? "try" : "tries")"]
            + (result.timeLabel.map { ["Solve time \($0)"] } ?? [])
            + (result.hintsUsed > 0 ? ["\(result.hintsUsed) \(result.hintsUsed == 1 ? "hint" : "hints")"] : [])
        return FlowChips(items: items)
    }

    private func dayRow(_ row: RoadResult) -> some View {
        let rowMedal = RoadResult.Medal.forAttempt(row.attempts, solved: true)
        let details = ["\(row.attempts) \(row.attempts == 1 ? "try" : "tries")"]
            + (row.timeLabel.map { [$0] } ?? [])
            + (row.hintsUsed > 0 ? ["\(row.hintsUsed) \(row.hintsUsed == 1 ? "hint" : "hints")"] : [])
        return HStack(spacing: 12) {
            Text(rowMedal?.emoji ?? "✓").font(.system(size: 26)).frame(width: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.mode.title).font(RoadFont.body(16)).foregroundStyle(RoadTheme.cream)
                Text(details.joined(separator: " · ")).font(.subheadline).foregroundStyle(RoadTheme.sand)
            }
            Spacer()
        }
        .padding(12)
        .background(RoadTheme.gold.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private var actions: some View {
        let shareText = classicResult.map { result.dayShareText(with: $0) } ?? result.shareText
        VStack(spacing: 10) {
            ShareLink(item: shareText) {
                Text(isDayComplete ? "Share the day" : "Share result").frame(maxWidth: .infinity)
            }
            .buttonStyle(GoldButtonStyle(kind: expeditionLeads ? .ghost : .primary, fullWidth: true))

            if let onContinueToExpedition {
                Button(action: onContinueToExpedition) {
                    Text("Continue to Expedition").frame(maxWidth: .infinity)
                }
                .buttonStyle(GoldButtonStyle(kind: expeditionLeads ? .primary : .secondary, fullWidth: true))
            } else if let onViewStats {
                Button(action: onViewStats) {
                    Text("View stats").frame(maxWidth: .infinity)
                }
                .buttonStyle(GoldButtonStyle(kind: .secondary, fullWidth: true))
            }
        }
    }
}

private struct FlowChips: View {
    let items: [String]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            row(items)
            VStack(spacing: 8) {
                row(Array(items.prefix(2)))
                row(Array(items.dropFirst(2)))
            }
        }
    }

    private func row(_ values: [String]) -> some View {
        HStack(spacing: 8) {
            ForEach(values, id: \.self) { item in
                Text(item)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RoadTheme.sand)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 11)
                    .padding(.vertical, 7)
                    .background(RoadTheme.gold.opacity(0.12), in: Capsule())
            }
        }
    }
}
