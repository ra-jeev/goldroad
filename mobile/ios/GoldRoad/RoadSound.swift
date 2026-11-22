import AVFoundation

/// Short game sounds. All audio work runs on a background queue, so fast taps never wait on the audio system.
@MainActor
final class RoadSound {
    enum Effect: String, CaseIterable, Sendable {
        case move, undo, deny, solve
        case deadEnd = "dead-end"

        var clip: String { self == .undo ? "move" : rawValue }
    }

    static let mutedKey = "muted"

    private let engine = Engine()

    func prepare() { engine.prepare() }

    /// Sound only. Haptics come from the board's sensory feedback, which follows the haptics setting.
    func play(_ effect: Effect) {
        guard !UserDefaults.standard.bool(forKey: Self.mutedKey) else { return }
        engine.play(effect)
    }

    func stop() { engine.stop() }

    private final class Engine: @unchecked Sendable {
        private let queue = DispatchQueue(label: "com.playgoldroad.sound", qos: .userInteractive)
        /// Two players per effect, used in turn, so a fast second tap does not cut off the first.
        private var players: [Effect: [AVAudioPlayer]] = [:]
        private var next: [Effect: Int] = [:]

        func prepare() { queue.async { self.load() } }

        func play(_ effect: Effect) {
            queue.async {
                self.load()
                guard let pool = self.players[effect], !pool.isEmpty else { return }
                let index = self.next[effect, default: 0]
                self.next[effect] = (index + 1) % pool.count
                let player = pool[index]
                player.currentTime = 0
                player.play()
            }
        }

        func stop() { queue.async { self.players.values.joined().forEach { $0.stop() } } }

        private func load() {
            guard players.isEmpty else { return }
            try? AVAudioSession.sharedInstance().setCategory(.ambient)
            for effect in Effect.allCases {
                guard let url = Bundle.main.url(forResource: effect.clip, withExtension: "mp3", subdirectory: "sounds") else { continue }
                players[effect] = (0..<2).compactMap { _ in
                    guard let player = try? AVAudioPlayer(contentsOf: url) else { return nil }
                    if effect == .undo {
                        player.enableRate = true
                        player.rate = 0.8
                        player.volume = 0.55
                    }
                    player.prepareToPlay()
                    return player
                }
            }
        }
    }
}
