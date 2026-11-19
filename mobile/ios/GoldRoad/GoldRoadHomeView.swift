import SwiftUI

struct GoldRoadHomeView: View {
    @State private var showingRoad = false
    @State private var showingStats = false
    @State private var showingTutorial = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    brand
                        .padding(.bottom, 32)

                    dailyRoad
                    NavigationLink {
                        PastRoadsView()
                    } label: {
                        destinationLabel("Past Roads", icon: "calendar", actionIcon: "chevron.right")
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 16)
                    Button {
                        showingStats = true
                    } label: {
                        destinationLabel("Your Stats", icon: "chart.bar", actionIcon: "chevron.right")
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)
                    Link(destination: URL(string: "https://playgoldroad.com/about")!) {
                        destinationLabel("About & Privacy", icon: "info.circle", actionIcon: "arrow.up.right")
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)
                    Button {
                        showingTutorial = true
                    } label: {
                        destinationLabel("How to Play", icon: "questionmark.circle", actionIcon: "chevron.right")
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)
                    if let feedbackURL = GameConstants.feedbackURL {
                        Link(destination: feedbackURL) {
                            destinationLabel("Send feedback", icon: "envelope", actionIcon: "arrow.up.right")
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 10)
                    }
                }
                .frame(maxWidth: 460, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 26)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(background)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showingRoad) {
                ClassicRoadView(onBack: { showingRoad = false })
                    .toolbar(.hidden, for: .navigationBar)
            }
            .navigationDestination(isPresented: $showingStats) {
                RoadStatsView(onBack: { showingStats = false })
                    .toolbar(.hidden, for: .navigationBar)
            }
            .sheet(isPresented: $showingTutorial) {
                RoadTutorialView(onFinish: { showingTutorial = false })
            }
        }
        .tint(RoadTheme.gold)
    }

    private func destinationLabel(_ title: String, icon: String, actionIcon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).accessibilityHidden(true)
            Text(title)
            Spacer()
            Image(systemName: actionIcon)
                .font(.footnote.weight(.semibold))
                .accessibilityHidden(true)
        }
        .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
        .foregroundStyle(RoadTheme.gold)
        .padding(16)
        .frame(minHeight: 52)
        .background(RoadTheme.gold.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private var brand: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkle")
                .font(.system(size: 18, weight: .semibold))
                .accessibilityHidden(true)
            Text("GoldRoad")
                .font(.custom("Marcellus-Regular", size: 25, relativeTo: .title2))
        }
        .foregroundStyle(
            LinearGradient(colors: [RoadTheme.color(0xFFE8A3), RoadTheme.gold],
                           startPoint: .top, endPoint: .bottom)
        )
        .accessibilityElement(children: .combine)
    }

    private var dailyRoad: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                Text("Daily Road")
                    .font(.custom("Marcellus-Regular", size: 30, relativeTo: .title))
                    .foregroundStyle(RoadTheme.color(0xFFE4A0))
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Image(systemName: "sun.max")
                    .font(.system(size: 20))
                    .foregroundStyle(RoadTheme.gold.opacity(0.8))
                    .accessibilityHidden(true)
            }

            Text("Reach the finish with exactly the target score. Solve Classic to unlock Expedition.")
                .font(.body)
                .foregroundStyle(RoadTheme.color(0xDDC79A))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            Button {
                showingRoad = true
            } label: {
                HStack {
                    Text("Open daily puzzle")
                    Spacer(minLength: 12)
                    Image(systemName: "arrow.right")
                        .accessibilityHidden(true)
                }
                .font(.custom("Chivo-Bold", size: 16, relativeTo: .body))
                .foregroundStyle(RoadTheme.ink)
                .padding(.horizontal, 18)
                .frame(minHeight: 52)
                .background(
                    LinearGradient(colors: [RoadTheme.color(0xF7D77E), RoadTheme.gold],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 12)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 28)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [RoadTheme.color(0x3A250C), RoadTheme.color(0x211407)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 20)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(RoadTheme.gold.opacity(0.34), lineWidth: 1)
        }
    }

    private var background: some View {
        ZStack {
            LinearGradient(colors: [RoadTheme.color(0x1A0E03), RoadTheme.color(0x110900), RoadTheme.color(0x0D0702)],
                           startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [RoadTheme.color(0xA05A00).opacity(0.24), .clear],
                           center: .topLeading, startRadius: 0, endRadius: 360)
        }
        .ignoresSafeArea()
    }
}

#Preview {
    GoldRoadHomeView()
        .preferredColorScheme(.dark)
}
