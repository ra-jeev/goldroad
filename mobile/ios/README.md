# GoldRoad for iPhone

Open `GoldRoad.xcodeproj` in Xcode, select the **GoldRoad** scheme and an iPhone simulator, and press Run. The deployment target is iOS 17.

Open the daily puzzle from Home. Solve Classic to unlock Expedition. Both runs are saved on the device and can resume offline after the boards have loaded. The app checks for the next road when you open the puzzle, return to the app, or reach the daily cutoff. A saved board stays available until you choose **Play the new road**.

Hints use the configured GoldRoad API. Debug installs as **GoldRoad Staging** with its own save data and calls staging. Release calls production. Override `GOLDROAD_API_BASE_URL` at build time to point at another HTTPS environment. The app bundles the web sound effects from `public/sounds`. Use the speaker button to mute or unmute them.

The app keeps daily history and Past Roads completion on the device and syncs
them through the current iCloud account when available. It sends the same
anonymous start and exact-solve events as the web app for the live daily puzzle.
Practice, archive play, and solves after rollover stay out of web analytics.

After your first daily solve, you can turn on the daily reminder and turn it
off from Home. Add the **GoldRoad** widget to see your Classic streak and the
next road countdown. The App Group shares the streak and countdown with the
widget. Staging and production use separate App Groups and iCloud keys.

## Verify the rules

Run the shared **GoldRoad** scheme’s test action in Xcode for the full
contract suite. The `GoldRoadTests` target reads the repository’s `contract/`
folder as test resources.

When the listing is available, set `GOLDROAD_APP_STORE_URL` to its exact
URL for the update screen. The default link opens App Store search.

From the repository root, use the Swift compiler to run the gameplay and save tests without a simulator.

```sh
scratch_dir="$(mktemp -d)"
swiftc mobile/ios/GoldRoad/GoldRoadAPI.swift mobile/ios/GoldRoad/GameConstants.swift mobile/ios/GoldRoad/ClassicRoad.swift mobile/ios/GoldRoad/ClassicRoadClient.swift mobile/ios/Tests/main.swift -o "$scratch_dir/test-road"
"$scratch_dir/test-road" contract/fixtures/rules.json
```
