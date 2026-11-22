import SwiftUI
import WidgetKit

private struct RoadEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetRoadSnapshot
}

private struct RoadProvider: TimelineProvider {
    func placeholder(in context: Context) -> RoadEntry {
        RoadEntry(date: Date(), snapshot: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (RoadEntry) -> Void) {
        completion(RoadEntry(date: Date(), snapshot: .load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RoadEntry>) -> Void) {
        let now = Date()
        let snapshot = WidgetRoadSnapshot.load()
        var entries = [RoadEntry(date: now, snapshot: snapshot)]
        if let cutoff = snapshot.nextRoadAt, cutoff > now {
            entries.append(RoadEntry(date: cutoff, snapshot: snapshot))
        }
        completion(Timeline(entries: entries, policy: .never))
    }
}

private struct RoadWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RoadEntry

    private let gold = Color(red: 0.85, green: 0.65, blue: 0.24)
    private let cream = Color(red: 1, green: 0.90, blue: 0.67)
    private var goldText: LinearGradient {
        LinearGradient(colors: [Color(red: 1, green: 0.91, blue: 0.64), gold], startPoint: .top, endPoint: .bottom)
    }

    var body: some View {
        let streak = entry.snapshot.streak(at: entry.date)
        let day = entry.snapshot.day(at: entry.date)
        Group {
            if family == .systemMedium {
                HStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        brand
                        streakBlock(streak, size: 40)
                        Spacer(minLength: 0)
                        countdown
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Rectangle().fill(gold.opacity(0.18)).frame(width: 1)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(day.gameNo.map { "DAY #\($0)" } ?? "TODAY")
                            .font(.caption2.bold())
                            .tracking(1)
                            .foregroundStyle(gold.opacity(0.8))
                        modeRow("Classic", solved: day.classicSolved)
                        modeRow("Expedition", solved: day.expeditionSolved)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    brand
                    streakBlock(streak, size: 34)
                    Spacer(minLength: 0)
                    HStack(spacing: 8) {
                        modeDot("Classic", short: "C", solved: day.classicSolved)
                        modeDot("Expedition", short: "E", solved: day.expeditionSolved)
                    }
                    countdown
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(red: 0.22, green: 0.14, blue: 0.05),
                                    Color(red: 0.06, green: 0.03, blue: 0.01)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    private var brand: some View {
        HStack(spacing: 6) {
            Image("BrandMark")
                .resizable()
                .frame(width: 20, height: 20)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            Text("GOLDROAD")
                .font(.caption2.bold())
                .tracking(1)
                .foregroundStyle(gold)
        }
    }

    /// Flame and number on one line, the label under it, so a large number still has room.
    private func streakBlock(_ streak: Int, size: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 4) {
                Image(systemName: "flame.fill")
                    .font(.system(size: size * 0.72))
                    .foregroundStyle(streak > 0
                        ? LinearGradient(colors: [Color(red: 1, green: 0.84, blue: 0.35), Color(red: 0.93, green: 0.45, blue: 0.12)],
                                         startPoint: .top, endPoint: .bottom)
                        : LinearGradient(colors: [gold.opacity(0.35)], startPoint: .top, endPoint: .bottom))
                Text("\(streak)")
                    .font(.system(size: size, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .foregroundStyle(goldText)
            }
            Text("DAY STREAK")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(gold.opacity(0.8))
        }
    }

    @ViewBuilder
    private var countdown: some View {
        if let cutoff = entry.snapshot.nextRoadAt, cutoff > entry.date {
            HStack(spacing: 4) {
                Text("Next")
                    .font(.caption2)
                    .foregroundStyle(cream.opacity(0.75))
                Text(timerInterval: entry.date...cutoff, countsDown: true)
                    .font(.system(size: 15, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(goldText)
            }
        } else {
            Text("Open GoldRoad for the next road")
                .font(.caption2)
                .foregroundStyle(cream.opacity(0.85))
        }
    }

    private func statusIcon(_ solved: Bool) -> some View {
        Image(systemName: solved ? "checkmark.circle.fill" : "circle")
            .foregroundStyle(solved ? gold : cream.opacity(0.4))
    }

    private func modeRow(_ title: String, solved: Bool) -> some View {
        HStack(spacing: 8) {
            statusIcon(solved).font(.system(size: 18))
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(cream)
                Text(solved ? "Solved" : "Not solved yet")
                    .font(.caption2)
                    .foregroundStyle(solved ? gold : cream.opacity(0.6))
            }
        }
    }

    private func modeDot(_ title: String, short: String, solved: Bool) -> some View {
        HStack(spacing: 3) {
            statusIcon(solved).font(.system(size: 12))
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(solved ? cream : cream.opacity(0.6))
        }
        .accessibilityLabel("\(title) \(solved ? "solved" : "not solved")")
    }
}

@main
struct GoldRoadWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetRoadSnapshot.kind, provider: RoadProvider()) { entry in
            RoadWidgetView(entry: entry)
        }
        .configurationDisplayName("GoldRoad")
        .description("See your streak, today’s roads, and when the next road opens.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
