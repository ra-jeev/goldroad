# GoldRoad – Google Play listing

Copy each field into Play Console. Character limits are in brackets.

Build: `/Users/rajeev/.codex/worktrees/android/goldroad/mobile/android/app/build/outputs/bundle/productionRelease/app-production-release.aab`
(version 1.0.0, versionCode 1, package `com.playgoldroad.android`, signed with the upload key: SHA-256 `2C:51:A4:D4:…:CD:E6`).

## 1. Create app

| Field | Value |
|---|---|
| App name [30] | `GoldRoad: Daily Path Puzzle` (27) |
| Default language | English (United States) – en-US |
| App or game | Game |
| Free or paid | Free (you cannot change this later) |
| Declarations | Tick Developer Program Policies and US export laws |

## 2. Set up your app (Dashboard → "Set up your app")

| Task | Answer |
|---|---|
| Privacy policy | `https://playgoldroad.com/privacy` |
| App access | All functionality is available without special access |
| Ads | No, my app does not contain ads |
| Content rating | Email: your email. Category: "Puzzle, Board, Card, Word…" (or "All other app types" if not shown). Answer **No** to every question (violence, fear, sex, language, drugs, gambling, user interaction, sharing location, digital purchases). Result: Everyone / PEGI 3. |
| Target audience | **13–15, 16–17, 18 and over**. Do not tick an age under 13: that adds the Families policy. "Appeals to children": No. |
| News app | No |
| COVID-19 apps | Not a COVID app (if asked) |
| Data safety | See section 3 |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health | No health features |
| Advertising ID | No, the app does not use advertising ID |

## 3. Data safety

**Overview**
- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **No** (no account; the data is anonymous). Optional: if you add a contact address for deletion requests on the privacy page, you can answer Yes.

**Data types: tick these two only**

| Category | Type | Collected | Shared | Ephemeral | Required or optional | Purpose |
|---|---|---|---|---|---|---|
| App activity | App interactions | Yes | No | No | Optional (users can choose) | Analytics |
| Device or other IDs | Device or other IDs | Yes | No | No | Optional (users can choose) | Analytics |

- App interactions = anonymous community play stats (moves, solve, medal), sent only after the player says yes.
- Device or other IDs = the random player UUID that the app makes. It is not linked to a person or an account.
- Hints: the route goes to the server only to find the next move and is not saved. If Play asks, add it under App activity → "Other actions", Ephemeral: **Yes**, Required, purpose App functionality.

Do not tick location, personal info, contacts, photos, audio, files, calendar, health, financial or messages.

## 4. Main store listing (Grow → Store presence → Main store listing)

| Field | Value |
|---|---|
| App name [30] | `GoldRoad: Daily Path Puzzle` |
| Category | Game → Puzzle |
| Tags (up to 5) | Puzzle, Logic, Brain games, Math, Casual |
| Email | your support email |
| Website | `https://playgoldroad.com` |
| Privacy policy | `https://playgoldroad.com/privacy` |

**Short description [80]**

```
A daily number path puzzle. Reach the flag on the exact target score.
```

**Full description [4000]**

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
• Home screen widget: your Classic streak and a countdown to the next road.
• Daily reminder, if you want one.
• Your history comes back with your Android backup when you move to a new phone.

PRIVATE BY DESIGN
No account. No ads. No tracking. Your history stays on your device. The app asks before it sends any community play stats.

New roads arrive every day. See you on the road.
```

**Graphics**

| Asset | Size | Needed |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit, max 1 MB | Yes |
| Feature graphic | 1024 × 500 PNG or JPG, no transparency | Yes |
| Phone screenshots | 2 to 8, 9:16, 1080 × 1920 or bigger (max 3840 px side) | Yes (4+ recommended) |
| Tablet screenshots | 7" and 10" | No (phone only) |

## 5. First release

1. Test and release → Testing → **Internal testing** → Create new release.
2. Play App Signing: accept "Use Google-generated key". Your upload key stays as the upload key.
3. Upload `app-production-release.aab`. Release name: `1.0.0 (1)`. Release notes: `First release.`
4. Add yourself as a tester, open the opt-in link on your phone, install from Play and check it.
5. If your developer account is a **personal account made after 13 Nov 2023**, Play needs a **closed test with at least 12 testers opted in for 14 days in a row** before you can apply for production. Start this early.
6. Then Production → Create new release → promote the same build → Send for review.

## 6. From the CLI later

After the app exists in Play Console and the first build is uploaded by hand:
- Make a Google Cloud service account, enable the "Google Play Android Developer API", and invite the service account in Play Console → Users and permissions (Release manager).
- Then `fastlane supply` or the Gradle Play Publisher plugin can upload builds, release notes, listing text and screenshots.
- These stay in Play Console only: creating the app, Data safety, content rating, target audience, app access and other declarations.
