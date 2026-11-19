# GoldRoad platform parity

Update the relevant row in every PR that adds or changes a user-facing feature.
The iOS column describes the code on `codex/ios-parity`. Android has no app in
this repository. The Reddit column describes the separate `reddit-port` source.

| Feature | Web | iOS | Android | Reddit |
| --- | --- | --- | --- | --- |
| Daily Classic | yes | yes | no | different (Reddit daily road) |
| Expedition, tolls, and bonuses | yes | yes | no | different (Reddit daily road) |
| One-step undo | yes | yes | no | yes |
| Progressive hints and five-hint limit | yes | yes | no | yes |
| Resume a saved daily run | yes | yes | no | different (Reddit session and account storage) |
| Daily rollover and countdown | yes | yes | no | different (Reddit publication schedule) |
| Tutorial and practice road | yes | yes | no | no |
| Medals and result sharing | yes | yes | no | different (Reddit result and comments) |
| Past Roads calendar and archive hints | yes | yes | no | no |
| Save a Past Roads run | yes | no | no | n/a |
| Personal stats and streak | yes | yes | no | different (Reddit account stats) |
| Community comparisons | yes | yes | no | different (Reddit standings) |
| Animated path, failure, hint nudge, solve, and Reduce Motion | yes | different (tile feedback only) | no | different (Reddit board feedback) |
| Sound toggle | yes | yes | no | no |
| Haptics and independent toggle | different (browser vibration with sound settings) | no | no | n/a |
| One session ID for start, hint, and submit | yes | no | no | different (Reddit run endpoints) |
| Feedback email | yes | no | no | no |
| Configurable API environment | yes | no | no | different (Reddit backend) |
| App Store setup | n/a | no | n/a | n/a |
| Opt-in daily reminder | no | no | no | no |
| iCloud stats sync | n/a | no | n/a | n/a |
| Home-screen streak and countdown widget | n/a | no | no | n/a |
| Native minimum version guard | yes | yes | no | n/a |
