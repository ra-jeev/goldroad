# GoldRoad for iPhone

Open `GoldRoad.xcodeproj` in Xcode, select the **GoldRoad** scheme and an iPhone simulator, and press Run. The deployment target is iOS 17.

Open the daily puzzle from Home. Solve Classic to unlock Expedition. Both runs are saved on the device and can resume offline after the boards have loaded. The app checks for the next road when you open the puzzle, return to the app, or reach the daily cutoff. A saved board stays available until you choose **Play the new road**.

Hints use the live GoldRoad API. The app bundles the web sound effects from `public/sounds`. Use the speaker button to mute or unmute them.

The app keeps daily history and Past Roads completion on the device. It sends the same anonymous start and exact-solve events as the web app for the live daily puzzle. Practice, archive play, and solves after rollover stay local.

## Verify the rules

Run the shared **GoldRoad** scheme’s test action in Xcode for the full
contract suite. The `GoldRoadTests` target reads the repository’s `contract/`
folder as test resources.

From the repository root, use the Swift compiler to run the gameplay and save tests without a simulator.

```sh
scratch_dir="$(mktemp -d)"
swiftc mobile/ios/GoldRoad/GameConstants.swift mobile/ios/GoldRoad/ClassicRoad.swift mobile/ios/GoldRoad/ClassicRoadClient.swift mobile/ios/Tests/main.swift -o "$scratch_dir/test-road"
"$scratch_dir/test-road" contract/fixtures/rules.json
```
