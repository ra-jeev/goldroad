import SwiftUI

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
