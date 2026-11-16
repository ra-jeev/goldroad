import CoreText
import SwiftUI

@main
struct GoldRoadApp: App {
    init() {
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
        }
    }
}
