import SwiftUI

/// Sound, haptics, reminder, guides and links. Opened from the "more" button on Home and on the board.
struct SettingsView: View {
    let onDone: () -> Void

    @AppStorage(RoadSound.mutedKey) private var muted = false
    @AppStorage(GameConstants.hapticsKey) private var hapticsEnabled = true
    @AppStorage(GameConstants.analyticsKey) private var shareStats = true
    @State private var reminder = RoadReminder.shared
    @State private var guide: GuideStart?
    @State private var showWidgetHelp = false

    private enum GuideStart: String, Identifiable {
        case guide, practice
        var id: String { rawValue }
    }

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Text("Settings")
                        .font(RoadFont.title(32, relativeTo: .largeTitle))
                        .foregroundStyle(RoadTheme.cream)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button("Done", action: onDone)
                        .buttonStyle(GoldButtonStyle(kind: .secondary))
                }

                section("Game") {
                    toggleRow("Sound", icon: "speaker.wave.2.fill", isOn: Binding(
                        get: { !muted }, set: { muted = !$0 }))
                    divider
                    toggleRow("Haptics", icon: "iphone.radiowaves.left.and.right", isOn: $hapticsEnabled)
                    divider
                    toggleRow("Daily reminder", icon: "bell.fill", isOn: Binding(
                        get: { reminder.enabled },
                        set: { value in Task { await reminder.setEnabled(value) } }))
                        .disabled(reminder.changing)
                    if let message = reminder.message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(RoadTheme.sand)
                            .padding(.horizontal, 18)
                            .padding(.bottom, 12)
                    }
                    divider
                    linkRow("How to play", icon: "questionmark.circle") { guide = .guide }
                    divider
                    linkRow("Practice road", icon: "figure.walk") { guide = .practice }
                    divider
                    linkRow("Add the Home Screen widget", icon: "square.grid.2x2") { showWidgetHelp = true }
                }

                section("Privacy") {
                    toggleRow("Share anonymous play stats", icon: "chart.bar", isOn: $shareStats)
                    Text("Sends when you start and solve the daily road, with a random player ID. Hints still ask the server for the next move.")
                        .font(.footnote)
                        .foregroundStyle(RoadTheme.sand)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 14)
                }

                section("About") {
                    externalRow("About GoldRoad", icon: "info.circle",
                                url: URL(string: "https://playgoldroad.com/about")!)
                    divider
                    externalRow("Privacy", icon: "hand.raised",
                                url: URL(string: "https://playgoldroad.com/privacy")!)
                    if let feedback = GameConstants.feedbackURL {
                        divider
                        externalRow("Send feedback", icon: "envelope", url: feedback)
                    }
                }

                Text("GoldRoad \(version)")
                    .font(RoadFont.body(12, relativeTo: .caption))
                    .tracking(1.2)
                    .foregroundStyle(RoadTheme.gold.opacity(0.55))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
            }
            .frame(maxWidth: 500, alignment: .leading)
            .padding(22)
            .frame(maxWidth: .infinity)
        }
        .background(RoadTheme.screenBackground)
        .tint(RoadTheme.gold)
        .sheet(item: $guide) { start in
            RoadTutorialView(startInPractice: start == .practice, onFinish: { guide = nil })
        }
        .sheet(isPresented: $showWidgetHelp) { WidgetHelpView(onDone: { showWidgetHelp = false }) }
    }

    private var divider: some View {
        Rectangle().fill(RoadTheme.gold.opacity(0.14)).frame(height: 1)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(title).padding(.leading, 6)
            VStack(alignment: .leading, spacing: 0) { content() }
                .background(RoadTheme.card, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(RoadTheme.cardBorder))
        }
    }

    private func label(_ title: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 22)
                .foregroundStyle(RoadTheme.gold.opacity(0.85))
                .accessibilityHidden(true)
            Text(title).foregroundStyle(RoadTheme.cream)
        }
        .font(RoadFont.body(16))
    }

    private func toggleRow(_ title: String, icon: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) { label(title, icon: icon) }
            .tint(RoadTheme.gold)
            .padding(.horizontal, 18)
            .frame(minHeight: 56)
    }

    private func linkRow(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                label(title, icon: icon)
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                    .foregroundStyle(RoadTheme.gold.opacity(0.7))
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func externalRow(_ title: String, icon: String, url: URL) -> some View {
        Link(destination: url) {
            HStack {
                label(title, icon: icon)
                Spacer()
                Image(systemName: "arrow.up.right").font(.footnote.weight(.semibold))
                    .foregroundStyle(RoadTheme.gold.opacity(0.7))
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    SettingsView(onDone: {}).preferredColorScheme(.dark)
}

/// iOS does not let an app add a widget itself, so this shows the steps.
private struct WidgetHelpView: View {
    let onDone: () -> Void

    private let steps = [
        "Go to your Home Screen. Touch and hold an empty area until the apps move.",
        "Tap Edit at the top, then tap Add Widget.",
        "Search for GoldRoad.",
        "Pick Small or Medium, then tap Add Widget.",
        "Tap Done.",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Eyebrow("Widget")
                    Text("Add GoldRoad to your Home Screen")
                        .font(RoadFont.title(24, relativeTo: .title2))
                        .foregroundStyle(RoadTheme.cream)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                BarIconButton(icon: "xmark", label: "Close", action: onDone)
            }
            Text("See your streak, today’s roads, and when the next road opens.")
                .font(.body)
                .foregroundStyle(RoadTheme.sand)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(steps.indices, id: \.self) { index in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1)")
                            .font(RoadFont.body(14, relativeTo: .footnote))
                            .foregroundStyle(RoadTheme.ink)
                            .frame(width: 26, height: 26)
                            .background(RoadTheme.gold, in: Circle())
                        Text(steps[index])
                            .font(.body)
                            .foregroundStyle(RoadTheme.cream)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(22)
        .background(RoadTheme.screenBackground)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
