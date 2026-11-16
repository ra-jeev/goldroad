# GoldRoad for iPhone

Open `GoldRoad.xcodeproj` in Xcode, select the **GoldRoad** scheme and an iPhone simulator, and press Run. The deployment target is iOS 17.

The app fetches the daily Classic and Expedition boards from `https://playgoldroad.com/api/games/current`. Solve Classic to unlock Expedition. Both runs are saved on the device and can resume offline after the boards have loaded. The app checks for a new road on launch, when it becomes active, and when you tap the refresh button.

Hints use the live GoldRoad API. The app bundles the web sound effects from `public/sounds`. Use the speaker button to mute or unmute them.

## Verify the rules

From the repository root, use the Swift compiler to run the gameplay and save tests without a simulator.

```sh
scratch_dir="$(mktemp -d)"
swiftc mobile/ios/GoldRoad/ClassicRoad.swift mobile/ios/Tests/main.swift -o "$scratch_dir/test-road"
"$scratch_dir/test-road" mobile/fixtures/classic-road.json
```
