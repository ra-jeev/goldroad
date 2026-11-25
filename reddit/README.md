# GoldRoad Daily

GoldRoad Daily is a daily number-path puzzle for Reddit communities. The app
posts two new roads every day. Players walk from the footprints to the flag,
add up the coins on each tile they step on, and try to land exactly on the
target number. Everyone in the community plays the same roads, so players can
compare results on a shared leaderboard and talk about the roads in the
comments.

**Who it is for:** communities that want a short daily game (one to five
minutes) that brings members back every day, and moderators who want it to run
with no daily work.

## Overview

- **Two roads a day.** A new post appears at 00:00 UTC with two roads,
  Classic and Expedition. A game day is a UTC day. Each post keeps its roads
  for ever, so old posts stay playable.
- **Classic.** The daily road. Step from tile to tile, collect the coins, and
  reach the flag with a total exactly equal to the target.
- **Expedition.** A harder second road on the same post. It opens after a
  player solves Classic. Some lanes between tiles are tolls (crossing one
  takes coins) or bonuses (crossing one gives coins).
- **Medals.** A solve on the first try gets gold, the second try silver, the
  third try bronze. Later solves still count as solved.
- **Hints.** Each player gets 5 hints per road. A hint shows the next
  step of a best route. Hints are counted on the leaderboard.
- **Leaderboards.** Each road has its own leaderboard. Fewer tries
  rank higher, then fewer hints, then less time.
- **Streaks.** Solving Classic on days in a row builds a streak. The app shows
  the streak as the player's user flair in the subreddit (for example
  "🔥 4-day streak"). It never replaces a flair the player set themselves.
- **Sunday community roads.** During the week, players vote on the shape of
  the coming Sunday's roads (Maze, Big coins, or Wide road). Voting closes on
  Saturday at 23:30 UTC, and both Sunday roads use the winning shape.
- **Sharing results.** After a solve, a player can post their result as a
  comment. The comment is posted from the player's own account, only when the
  player taps the button, and always as a reply to the app's pinned results
  comment. The text has the medal, tries, hints and time, and never the route.
- **Logged-out visitors** can play, but nothing is saved for them.

## For moderators

The app runs by itself. There are no settings to configure.

- On install, it creates the post flairs **Daily road** (moderators only),
  **Feedback** and **Bug**, and posts today's roads.
- Every day at 00:00 UTC, it posts the day's roads. Each daily post gets the
  **Daily road** flair and a pinned comment where players share results.
- Post flair must be turned on for the flairs to show. Go to **Mod tools →
  Look and feel → Post flair** and turn on **Enable post flair**.

### Moderator menu

Open the subreddit's **⋯** menu (mod tools) to find these items:

- **GoldRoad: post today's road.** Posts today's roads if the post is missing, for
  example if the 00:00 post failed. It never makes a second post for the same
  day.
- **GoldRoad: delete a player's data.** Deletes all GoldRoad data of one
  player, for a removal request. Enter a username, or a `t2_` user id for an
  account that no longer exists. This cannot be undone.

## How to play

1. Open the day's post and tap **Play**. Classic opens first.
2. Start on the footprints. Glowing tiles are the steps you can take: up,
   down, left or right, where a lane joins the tiles. Tap one to step on it.
   On a computer, the arrow keys or W, A, S, D also work, and Backspace takes
   back a step.
3. Each tile adds its coins to your total. A gap between tiles means there is
   no lane there.
4. Reach the flag with a total exactly equal to the target to solve the road.
5. If the walk cannot finish, tap **Try again**. **Undo** takes back one step.
   **Hint** shows the next step of a best route.
6. After a solve, the result card shows your medal, your rank and your
   streak. From there you can share your result, vote for Sunday's roads, and
   continue to Expedition.

The **?** button at the top opens a short guide with examples.

## Player data

GoldRoad stores only what the game needs, in the app's own Reddit-hosted
storage (Redis). It sends no data outside Reddit.

**What is stored for a player who is logged in:**

- Reddit user id and username (to show names on the leaderboard).
- For each road: tries, hints used, solve time, medal, and whether a
  result comment was posted (its comment id).
- Leaderboard entries for each road solved on its day.
- Streak: current streak, best streak and the last day solved.
- The Sunday vote of each week.
- The streak flair text the app set, so it never replaces a player's own
  flair.
- The last time the player opened or played a road.
- Streak reminder choice and time zone offset, only if the player turned
  reminders on. Reminders are turned off now. They will be turned on after
  Reddit approves the app for push notifications.

The "trap map" counts which wrong step players take most on each road. It
stores counts only and no user ids.

For a logged-out visitor, nothing is stored on the server. The route of a try
in progress is kept in the browser tab only, so a reload continues the same
try.

**How data is deleted:**

- **Automatic:** all data of a player who has not opened or played GoldRoad
  for 30 days is deleted by a daily job (03:15 UTC). This also removes the
  data of deleted Reddit accounts.
- **On request:** a moderator can delete one player's data at once with
  **GoldRoad: delete a player's data**.
- Result comments are normal Reddit comments. Players can edit or delete them
  on Reddit at any time.
