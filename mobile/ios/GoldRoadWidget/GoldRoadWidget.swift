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

    var body: some View {
        let streak = entry.snapshot.streak(at: entry.date)
        VStack(alignment: .leading, spacing: 8) {
            Label("GOLDROAD", systemImage: "sparkle")
                .font(.caption2.bold())
                .tracking(1)
                .foregroundStyle(gold)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(streak)")
                    .font(.system(size: family == .systemMedium ? 38 : 32, weight: .bold, design: .rounded))
                Text("day streak")
                    .font(.caption.weight(.semibold))
            }
            .foregroundStyle(cream)
            Spacer(minLength: 0)
            if let cutoff = entry.snapshot.nextRoadAt, cutoff > entry.date {
                Text("Next road in")
                    .font(.caption2)
                    .foregroundStyle(cream.opacity(0.8))
                Text(timerInterval: entry.date...cutoff, countsDown: true)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(cream)
            } else {
                Text("Open GoldRoad for the next road")
                    .font(.caption)
                    .foregroundStyle(cream.opacity(0.85))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(red: 0.22, green: 0.14, blue: 0.05),
                                    Color(red: 0.06, green: 0.03, blue: 0.01)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

@main
struct GoldRoadWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetRoadSnapshot.kind, provider: RoadProvider()) { entry in
            RoadWidgetView(entry: entry)
        }
        .configurationDisplayName("GoldRoad")
        .description("See your Classic streak and when the next road opens.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
