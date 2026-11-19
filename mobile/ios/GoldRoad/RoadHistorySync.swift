import Foundation

enum RoadHistorySync {
    typealias Completion = [String: [String: Bool]]
    static let archiveMarksChanged = Notification.Name("GoldRoad.ArchiveMarksChanged")

    static func mergeHistory(_ local: [DailyRoadRecord], _ remote: [DailyRoadRecord]) -> [DailyRoadRecord] {
        var records: [String: DailyRoadRecord] = [:]
        for record in local + remote {
            if let saved = records[record.id], !prefer(record, over: saved) { continue }
            records[record.id] = record
        }
        return records.values.sorted {
            if $0.gameNo != $1.gameNo { return $0.gameNo < $1.gameNo }
            return $0.mode.rawValue < $1.mode.rawValue
        }
    }

    private static func prefer(_ candidate: DailyRoadRecord, over saved: DailyRoadRecord) -> Bool {
        if candidate.solved != saved.solved { return candidate.solved }
        if candidate.attempts != saved.attempts { return candidate.attempts < saved.attempts }
        if candidate.hintsUsed != saved.hintsUsed { return candidate.hintsUsed < saved.hintsUsed }
        let candidateTime = candidate.activeSeconds ?? .max
        let savedTime = saved.activeSeconds ?? .max
        if candidateTime != savedTime { return candidateTime < savedTime }
        return candidate.playableAt < saved.playableAt
    }

    static func mergeCompletion(_ local: Completion, _ remote: Completion) -> Completion {
        var merged: Completion = [:]
        for marks in [local, remote] {
            for (day, modes) in marks {
                for (mode, solved) in modes where solved {
                    merged[day, default: [:]][mode] = true
                }
            }
        }
        return merged
    }

    @MainActor
    static func refresh() {
        NSUbiquitousKeyValueStore.default.synchronize()
        sync()
    }

    @MainActor
    static func sync() {
        let defaults = UserDefaults.standard
        let cloud = NSUbiquitousKeyValueStore.default
        syncHistory(defaults: defaults, cloud: cloud)
        syncCompletion(defaults: defaults, cloud: cloud)
    }

    private static func syncHistory(defaults: UserDefaults, cloud: NSUbiquitousKeyValueStore) {
        let key = DailyRoadRecord.storageKey
        let localData = defaults.data(forKey: key)
        let remoteData = cloud.data(forKey: key)
        guard let local = decodeHistory(localData), let remote = decodeHistory(remoteData) else { return }

        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let merged = mergeHistory(local, remote)
        if merged != local, let data = try? encoder.encode(merged) {
            defaults.set(data, forKey: key)
        }

        // Keep the complete history on-device. A deterministic recent window
        // leaves space for the archive marks in iCloud's 1 MB store.
        let recent = Array(merged.suffix(2048))
        if recent != remote, let data = try? encoder.encode(recent), data.count <= 450_000 {
            cloud.set(data, forKey: key)
        }
    }

    private static func decodeHistory(_ data: Data?) -> [DailyRoadRecord]? {
        guard let data, !data.isEmpty else { return [] }
        return try? JSONDecoder().decode([DailyRoadRecord].self, from: data)
    }

    private static func syncCompletion(defaults: UserDefaults, cloud: NSUbiquitousKeyValueStore) {
        let key = ArchiveCompletion.key
        let local = defaults.dictionary(forKey: key) as? Completion ?? [:]
        let remote = cloud.dictionary(forKey: key) as? Completion ?? [:]
        let merged = mergeCompletion(local, remote)
        if merged != local {
            defaults.set(merged, forKey: key)
            NotificationCenter.default.post(name: archiveMarksChanged, object: nil)
        }

        let recentDays = merged.keys.compactMap { Int($0) }.sorted(by: >).prefix(4096)
        let recent = recentDays.reduce(into: Completion()) { marks, day in
            let key = String(day)
            marks[key] = merged[key]
        }
        if recent != remote,
           let data = try? PropertyListSerialization.data(fromPropertyList: recent, format: .binary, options: 0),
           data.count <= 300_000 {
            cloud.set(recent, forKey: key)
        }
    }
}
