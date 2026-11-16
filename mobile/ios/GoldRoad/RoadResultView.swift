import SwiftUI

/// A completed road's first-solve result. Elapsed time is measured in seconds.
struct RoadResult {
    let gameNo: Int
    let mode: RoadMode
    let attempts: Int
    let elapsed: TimeInterval?
    let hintsUsed: Int

    private var tryLabel: String { "\(attempts) \(attempts == 1 ? "try" : "tries")" }

    private var medal: (emoji: String, name: String)? {
        switch attempts {
        case 1: ("🥇", "Gold")
        case 2: ("🥈", "Silver")
        case 3: ("🥉", "Bronze")
        default: nil
        }
    }

    var resultLabel: String {
        if let medal { return "\(medal.emoji) \(medal.name) in \(tryLabel)" }
        return "😅 Solved in \(tryLabel)"
    }

    var timeLabel: String? {
        guard let elapsed, elapsed.isFinite else { return nil }
        let seconds = Int(max(0, elapsed).rounded())
        let minutes = seconds / 60
        return minutes > 0 ? "\(minutes)m \(String(format: "%02d", seconds % 60))s" : "\(seconds)s"
    }

    private var trail: String {
        let visible = min(max(attempts, 1), 8)
        return String(repeating: "🟫", count: visible - 1) + "🟩"
            + (attempts > visible ? " +\(attempts - visible)" : "")
    }

    private var dayLine: String {
        "\(mode.title): \(trail) \(resultLabel)" + (timeLabel.map { " · \($0)" } ?? "")
    }

    var shareText: String {
        var lines = ["GoldRoad Day #\(gameNo) · \(mode.title)", trail, resultLabel]
        if let timeLabel { lines.append("Solve time: \(timeLabel)") }
        if hintsUsed > 0 { lines.append("Hints used: \(hintsUsed)") }
        lines.append("Walk today’s road:")
        lines.append("https://playgoldroad.com/")
        return lines.joined(separator: "\n")
    }

    func dayShareText(with classic: RoadResult) -> String {
        ["GoldRoad Day #\(gameNo) · Full day", classic.dayLine, dayLine,
         "Walk today’s road:", "https://playgoldroad.com/"].joined(separator: "\n")
    }
}

struct RoadResultView: View {
    let result: RoadResult
    var classicResult: RoadResult? = nil
    var onContinueToExpedition: (() -> Void)? = nil
    let onDismiss: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("DAY #\(result.gameNo) · \(result.mode.title.uppercased())")
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(RoadTheme.gold)
                Text(result.mode == .expedition ? "Day complete" : "Road solved")
                    .font(.custom("Marcellus-Regular", size: 32, relativeTo: .title))
                    .foregroundStyle(RoadTheme.color(0xFFE4A0))
                    .accessibilityAddTraits(.isHeader)
                Text(result.resultLabel)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(RoadTheme.color(0xFFE4A0))
                HStack(spacing: 8) {
                    if let time = result.timeLabel { chip("Time \(time)", icon: "clock") }
                    if result.hintsUsed > 0 {
                        chip("\(result.hintsUsed) \(result.hintsUsed == 1 ? "hint" : "hints")", icon: "lightbulb")
                    }
                }
                .font(.subheadline)
                .foregroundStyle(RoadTheme.color(0xDDC79A))

                ShareLink(item: classicResult.map { result.dayShareText(with: $0) } ?? result.shareText) {
                    Label("Share result", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(ResultPrimaryButtonStyle())

                if let onContinueToExpedition {
                    Button("Play Expedition", action: onContinueToExpedition)
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .foregroundStyle(RoadTheme.color(0xFFE4A0))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(RoadTheme.gold.opacity(0.6)))
                }
                Button("Close", action: onDismiss)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RoadTheme.color(0xDDC79A))
                    .padding(8)
            }
            .frame(maxWidth: 420)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .background(
            LinearGradient(colors: [RoadTheme.color(0x3A250C), RoadTheme.color(0x110900)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
        )
    }

    private func chip(_ label: String, icon: String) -> some View {
        Label(label, systemImage: icon)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RoadTheme.gold.opacity(0.12), in: Capsule())
    }
}

private struct ResultPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(RoadTheme.ink)
            .background(
                LinearGradient(colors: [RoadTheme.color(0xF7D77E), RoadTheme.gold],
                               startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 12)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}
