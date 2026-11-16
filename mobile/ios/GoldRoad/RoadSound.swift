import AVFoundation
import UIKit

@MainActor
final class RoadSound {
    enum Effect: String, CaseIterable {
        case move, undo, deny, solve
        case deadEnd = "dead-end"

        var clip: String { self == .undo ? "move" : rawValue }
    }

    private var players: [Effect: AVAudioPlayer] = [:]

    func prepare() {
        guard players.isEmpty else { return }
        try? AVAudioSession.sharedInstance().setCategory(.ambient)
        for effect in Effect.allCases {
            guard let url = Bundle.main.url(forResource: effect.clip, withExtension: "mp3", subdirectory: "sounds"),
                  let player = try? AVAudioPlayer(contentsOf: url) else { continue }
            if effect == .undo {
                player.enableRate = true
                player.rate = 0.8
                player.volume = 0.55
            }
            player.prepareToPlay()
            players[effect] = player
        }
    }

    func play(_ effect: Effect) {
        prepare()
        if let player = players[effect] {
            player.currentTime = 0
            player.play()
        }
        switch effect {
        case .move: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .undo: UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        case .solve: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .deny, .deadEnd: break
        }
    }

    func stop() {
        players.values.forEach { $0.stop() }
    }
}
