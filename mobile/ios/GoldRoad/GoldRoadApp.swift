import CoreText
import SwiftUI

@main
struct GoldRoadApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        ScreenshotMode.install()
        for name in ["Chivo-Bold", "Marcellus-Regular"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            GoldRoadHomeView()
                .preferredColorScheme(.dark)
                .task {
                    for await _ in NotificationCenter.default.notifications(
                        named: NSUbiquitousKeyValueStore.didChangeExternallyNotification
                    ) {
                        RoadHistorySync.sync()
                    }
                }
                .task(id: scenePhase) {
                    if scenePhase == .active {
                        DailyRoadAnalytics.shared.flush()
                        RoadHistorySync.refresh()
                    }
                }
        }
    }
}
