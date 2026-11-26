# GoldRoad – App Store listing

Copy each field into App Store Connect (ASC). Character limits are in brackets.

## 1. New App form

| Field | Value |
|---|---|
| Platform | iOS |
| Name [30] | `GoldRoad: Daily Path Puzzle` (27) |
| Primary language | English (U.S.) |
| Bundle ID | `com.playgoldroad.ios` — **not** `.widget`, **not** `.staging` |
| SKU | `goldroad-ios` |
| User access | Full Access |

If the name is taken, use `GoldRoad – Number Path Puzzle`.

## 2. App Information

| Field | Value |
|---|---|
| Subtitle [30] | `Plan a route, hit the number` (28) |
| Primary category | Games → Puzzle |
| Secondary category | Games → Board |
| Content rights | No, it does not contain, show, or access third-party content |
| Age rating | Answer "None" / "No" to every question → 4+ |

## 3. Pricing and Availability

- Price: Free (USD 0).
- Availability: all countries.

## 4. App Privacy

- Privacy Policy URL: `https://playgoldroad.com/privacy`
- "Do you collect data?" → **Yes**. Add these 2 types:

| Category | Type | Used for | Linked to user? | Tracking? |
|---|---|---|---|---|
| Identifiers | Device ID | Analytics, App Functionality | No | No |
| Usage Data | Product Interaction | Analytics | No | No |

These match `PrivacyInfo.xcprivacy`. Hints need no entry of their own: the server does not keep hint requests. But each daily hint sends the random player ID, even when community stats are off (the server rate-limits by it, and error logs can keep its first 8 characters). So Device ID also lists App Functionality.

## 5. Version 1.0 page

| Field | Value |
|---|---|
| Support URL | `https://playgoldroad.com/about` |
| Marketing URL | `https://playgoldroad.com` |
| Version | `1.0.0` |
| Copyright | `2026 Rajeev R Sharma` |
| Release | Manually release this version |

**Promotional text [170]**

```
Two new roads every day. Build a path from your footprints to the flag and land exactly on the target score. Solve on the first try for gold.
```

**Keywords [100]** (no spaces, do not repeat words from the name)

```
number,math,logic,brain,teaser,maze,route,sum,grid,arithmetic,streak,mind,tiles,trail,game
```

**Description [4000]**

```
GoldRoad is a daily number path puzzle. Every day brings two new roads: Classic and Expedition.

Walk from your footprints to the finish flag, one tile at a time. Each tile changes your score. You cannot retrace your steps. The road is solved only when you reach the flag with your score exactly on the target: not more, not less.

TWO ROADS EVERY DAY
• Classic is the main daily challenge.
• Expedition unlocks when you solve Classic, with toll and bonus lanes.

EARN YOUR MEDAL
• Solve on your first try for gold.
• Second try is silver. Third try is bronze.
• Keep going after that: it still counts as solved.

STUCK? TAKE A HINT
Hints are always there, with no penalty. They guide you back onto a road that reaches the target.

MORE TO PLAY
• Past Roads: play earlier daily roads at your own pace.
• Stats: your streaks, medals and history.
• Community stats: see how the field played, if you choose to share.
• Widget: your Classic streak and a countdown to the next road.
• Daily reminder, if you want one.
• Your history syncs through iCloud.

PRIVATE BY DESIGN
No account. No ads. No tracking. Your history stays on your device and in your iCloud. The app asks before it sends any community play stats.

New roads arrive every day. See you on the road.
```

**Screenshots** — iPhone 6.9" (1320 × 2868), 3 to 10 images. The app is iPhone only, so no iPad screenshots.

**App Review Information**

- Sign-in required: No.
- Contact: your name, phone and email.
- Notes:

```
GoldRoad needs no account. Open the daily road from Home and tap tiles to build a path from the footprints to the flag. The puzzle is solved when the score at the flag equals the target.

Hints call our server with the current route to find the next move. Nothing is saved.

After the first daily solve, the app asks once whether to share anonymous community play stats. Nothing is sent before the player says yes. The switch is in Settings → "Contribute to community stats".

The widget shows the Classic streak and the next road countdown.
```

## 6. Build and submit

1. Xcode: scheme **GoldRoad**, destination **Any iOS Device (arm64)**.
2. Product → Archive. Organizer opens.
3. Distribute App → App Store Connect → Upload.
4. Wait about 15 minutes for processing. ASC emails you.
5. Version page → Build → select the build.
6. Export compliance: "None of the algorithms mentioned above" (the app uses only standard HTTPS).
7. Add for Review → Submit.

## 7. After the app record exists

Done: `GOLDROAD_APP_STORE_URL` is `https://apps.apple.com/app/id6838678223` (Apple ID 6838678223).
