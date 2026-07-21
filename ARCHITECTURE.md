# GoldRoad Architecture

This document is the active source of truth for GoldRoad v2.

It replaces the older rewrite, milestone, and gameplay planning docs. If implementation and this file disagree, the next step is to update either the code or this document so they match again.

## 1. Product model

GoldRoad is a daily route puzzle with a local-first player model.

### 1.1 Core loop

- A player opens the current road day.
- The road day contains two puzzles: `classic` and `expedition`.
- The player builds a self-avoiding path from the start tile to the exit tile.
- A puzzle is solved only when the player reaches the exit on the road target.
- The retry loop is central to the game.
- Hints are allowed and are meant to reduce abandonment, not to introduce separate outcome tiers.

### 1.2 Medal rules

Medals are derived from the solve try count (stored internally as `attempts`):
- Gold: solved on try 1
- Silver: solved on try 2
- Bronze: solved on try 3
- Try 4+: solved, but no medal

Important: medals are derived data. They should not be stored directly when the attempt count already exists.

### 1.3 Language guidance

Player-facing UI should usually say `solved`, not `exact solve`.

The exact target score is the only solve condition in GoldRoad, so "exact solve" is redundant as product language. Use target-score wording when teaching the rule, validating a run, or explaining why reaching the exit did not solve the puzzle. Use solved/unsolved everywhere else.

### 1.4 Solve celebration model

Solving never navigates away from the board. Celebration happens on a sheet over the board, in two distinct beats:

- Classic solve: a celebration bottom sheet with the medal/result moment, a shareable result preview with Share as the primary action, and Continue to Expedition as a prominent secondary action. Forward energy — "nice, now there's more."
- Expedition solve: a day-complete sheet with both mode results, a combined-day share text, the next-road countdown, and the streak/stats link. Closing energy — "that's the day, see you tomorrow."

Celebration energy tiers by result: first-try gold gets the full moment, medal solves get a standard celebration, late no-medal solves get warm relief with the Expedition CTA leading. A sheet fires once per first solve and never re-pops on later visits; every exact re-solve still plays its solve sound and shows a lightweight `Solved again.` acknowledgement without another award, streak change, analytics result, or full sheet.

All result sharing, including archive and random-road replay, points to the canonical production homepage and ends with `Walk today's road:`. Result text may name the solved road and mode, but never deep-links to `/games/:gameNo`. An archive replay sheet fires only for the first solve of a road+mode and awards no medal; it shows a counterfactual line ("Live, that would have been Gold") with the session solve time and may share that result through the homepage.

### 1.5 App shell requirements

Two v1 qualities are shipped as launch requirements for v2:

- game sounds (move/coin, denied move, dead-end, solve) with a persisted mute toggle (`useSoundEffects`); the mastered public assets stay below a −3 dB true-peak ceiling, while a shared `@vueuse/sound`/Howler bank begins preloading from the persistent layout, explicitly resumes on the first eligible gesture, replays the first queued effect when ready, and reloads/resumes on `pageshow` and foreground visibility transitions
- PWA installability: manifest and icon set in the v2 visual style, apple-touch-icon, and Open Graph / social metadata for link unfurls

No service worker or offline app shell is included for the v2 launch. That is a deliberate launch-scope decision; offline shell work is deferred until after launch.

### 1.6 Local-first scope

The player experience is intentionally local-first:
- no auth
- no account linking
- no cross-device sync
- no push notifications

Personal history is stored only in the browser. Server-side persistence exists only for anonymous analytics and aggregate comparison features.

## 2. Route surface

### Current routes

- `/` — current road day, including the first-run interactive tutorial and the `V1WelcomeSheet` transition flow for detected returning v1 players
- `/games` — recent past roads calendar
- `/games/:gameNo` — past road day replay
- `/stats` — personal local stats plus anonymous global comparison
- `/about` — About / Privacy / Contact, leading with the Updates timeline

## 3. Road-day model

The road day is the top-level gameplay unit.

Each road day contains:
- one `classic` puzzle
- one `expedition` puzzle

### Live road day behavior

- Classic is the primary live daily puzzle.
- Expedition unlocks through the live Classic solve flow.
- The home screen should make both modes feel part of the same day.

### Road rotation and puzzle pool

Road days rotate at `00:00 UTC`. A Nitro scheduled task named `rotate-road`
runs on the cron expression `0 0 * * *`, which Cloudflare Workers Cron Triggers
also declares in `wrangler.jsonc` under `triggers.crons`.

The task:
- checks the current road day's `nextGameAt`
- flips the old day's Classic and Expedition rows to `current=false` when
  `nextGameAt` has passed
- flips the next pre-generated road day to `current=true`
- replenishes the future pool after rotation

The future pool target is 5 complete road days beyond the current day. This is
small enough to avoid building a large unused archive ahead of time, but gives
several missed cron runs or failed generation attempts a buffer before the live
rotation depends on same-request fallback generation.

Each road day is two `games` rows sharing one `gameNo`: one `classic`, one
`expedition`. Pool replenishment uses the server-side `generatePuzzle` utility
and stores `board_json`, `optimal_paths_json`, score metadata, `active=true`,
`current=false`, and the day's `playable_at`.

If the pool is unexpectedly dry at rotation time, the task generates the next
day's missing rows before flipping `current`, and logs an error so the rotation
does not silently stall.

On the client, the live page's countdown anchors to the loaded road's own
`nextGameAt` (falling back to wall-clock UTC midnight until a road loads), so a
page opened while the cron lags is immediately "ready" rather than counting a
fresh 24 hours against yesterday's road. The midnight contract when that
anchor passes: **the board itself is never touched.** Retry, Hint, and mode
switching disappear, server calls stop, and every footer state gains a "Play
the new road" action — but the in-flight (or one first) attempt may finish
with full local credit: history, medal, streak, and celebration all count (the
solve belongs to the road, not the wall clock), only the analytics call is
skipped. With retry gone the old road can be walked at most once more, and the
celebration for a post-expiry Classic solve suppresses the Expedition CTA
(the mode switch is locked) so "Play the new road" leads instead.

There is no polling: the new-road fetch happens on user action. It fetches
first, compares `gameNo`, and applies only a genuinely new road — a same-road
or mid-flip-404 response changes nothing and the action stays for the next
tap. Reloading during the few-second cron window could technically grant one
more final attempt; that race is accepted rather than policed with persistent
state. The stats page follows the same passive model: at midnight its
countdown becomes "A new road is available · Play now", and the live page
performs the authoritative fetch on arrival.

Local testing options:
- `wrangler dev --test-scheduled`, then request
  `http://localhost:8787/cdn-cgi/handler/scheduled` to fire the scheduled
  handler locally.
- During Nitro dev, inspect `/_nitro/tasks` and call
  `/_nitro/tasks/rotate-road` to run the task directly.

### Past road behavior

- Past-road replay is also day-based.
- A past-road fetch returns both puzzles in one response, mirroring the current-road API shape, including their `optimalPaths` so hints work without a network call.
- Past-road replay uses the same mode-switching board UI model as the current road.
- Archive play is fully local: archived boards are fetched once, hints are computed client-side from the returned `optimalPaths`, and a solve makes no `/api/session` calls of any kind. Nothing about archive play reaches the analytics tables.
- Expedition stays gated behind Classic in archive replay, the same as the live road (see the RP0-5 archive/replay decision below). This deliberately supersedes the earlier P0-4 acceptance criterion that called for Expedition to be directly available in archive replay; that frictionless model predated tracked archive completion.
- An archive completion is recorded only when a mode is actually solved, per game and per mode, in `localStorage` under `goldroad-state-v2`'s `archiveCompletionByGame` map. It drives the Past Roads calendar markers and that road's local solved/unlock state only. It never touches medals, streaks, attempts, solve times, personal totals, today's result, yesterday's comparison, or server analytics.
- In-progress archive state (attempts, hints, guide path, solve timer) is session-scoped (see §8): leaving and returning days later starts a fresh game. Archive solves celebrate only on the first solve of a road+mode, award no medal (a counterfactual "would have been" line stands in), and share through the canonical homepage (see §1.4).
- The archive board endpoint serves archived roads only: requests for the current or a future road number 404, and every road it serves ships its `optimalPaths`.

### Random road behavior

- Random replay should choose a road day, not a single puzzle variant.
- It should land on the same dual-mode replay experience used by archive roads.
- It should appear only after the current road number has crossed the recent-archive boundary.

## 4. Board and edge model

GoldRoad uses an edge-based board model.

### 4.1 Board shape

Each board contains:
- `rows`
- `cols`
- `tiles`
- `missingEdges`
- `tollEdges`
- `bonusEdges`
- `tollValue`
- `bonusValue`
- `start`
- `end`

### 4.2 Naming decision

The old name `blocked` is misleading because those connections do not represent traversable roads that later become blocked. They represent absent roads.

The canonical names going forward are:
- `missingEdges`
- `tollEdges`
- `bonusEdges`

### 4.3 Why grouped edge arrays are preferred right now

For the current scope, grouped arrays are preferred over a unified `edges[]` structure because they are:
- easier to validate
- easier to generate
- compact in JSON
- already close to the current implementation

A unified `edges[]` model can be revisited later only if it unlocks a real feature or substantially simplifies code.

### 4.4 Edge visual hierarchy

Tolls and bonuses change the score — the win condition — so they must read as first-class game elements. The July 21 staging pass superseded RP1-2's hue distinction: line pattern is now the road-type signal and every traversable road uses the neutral-gold family.

- open roads are solid neutral gold, thick and opaque, spanning the complete tile gap
- toll roads are two dashed neutral-gold rails
- bonus roads are two solid neutral-gold rails
- missing edges are true empty space — no faint road remnant on the live board
- toll/bonus values are board-global and stated once in the board legend (**Toll cost N**, **Road bonus N**); per-edge `+N`/`−N` chips were deliberately removed

Guiding principle: one coherent road palette, pattern-first scoring-road recognition, and true empty space for missing roads. Traversing a toll or bonus may still pulse the score readout to explain the signed score change (disabled under reduced motion).

## 5. Puzzle generation and optimal paths

The generator computes the target score and the set of optimal paths for each puzzle.

### Current expectation

- `optimalPaths` remain a server-side generation artifact.
- They power hint logic and validation support.
- Live/current road paths never leave the server; archived, playable roads ship paths for local hints.

### Important implementation note

If the hint system ever ships all optimal paths to the client after the first hint request, that becomes an intentional tradeoff: lower server round-trips in exchange for exposing solution data to the browser.

The recommended default is:
- keep optimal paths server-side for now
- compute and return only the hint result needed for the player

This is simpler to secure and works cleanly even when a puzzle has multiple optimal paths.

## 6. Hint system

GoldRoad uses a single repeated hint action rather than separate hint levels.

### 6.1 Hint request model

The client should send the ordered `pathHistory`, not just the current tile.

This is required because the hint system needs to know:
- whether the player is still on an optimal prefix
- where the path first diverged if it is no longer optimal
- which optimal path best matches the player’s run so far

### 6.2 Hint response rules

When a hint is requested:
- if the current path is still a valid prefix of at least one optimal path, return the next tile to tap
- if the current path has diverged from all optimal paths, return:
  - the divergence tile
  - the next tile the player should have taken
  - messaging that explains the target route was lost there

### 6.3 Guided retry behavior

Hints should persist locally for that puzzle until the puzzle is solved.

Expected behavior:
- after taking a hint, pressing Retry should highlight the guide path again
- taking another hint can extend the guided path farther
- the guide path survives page reloads because it is part of local puzzle state
- the guide path is cleared once the puzzle is solved
- this behavior applies to both current roads and old roads

### 6.4 Derived fields

The hint system should prefer derived flags over duplicated booleans:
- `assisted` is derived from `hintsUsed > 0`
- no separate `assisted` field is required in local storage or analytics unless a downstream reporting system genuinely needs a materialized field

## 7. Timer model

GoldRoad tracks active solve time.

### Rules

- timer starts as soon as the board is visible for an unsolved puzzle, not on first move
- timer pauses when the tab becomes hidden
- timer resumes when the player returns to a visible unsolved board
- timer should not be written to local storage on every tick
- timer should be flushed on meaningful events such as move, hint, retry, solve, hide, and unload
- the accumulated active timer value should be kept across retries until the puzzle is solved

### Uses

Active solve time can be used for:
- share output
- local stats
- anonymous comparison analytics

## 8. Local storage model

This section describes the active consolidated storage model.

GoldRoad uses one versioned local-storage key backed by one JSON document, with browser persistence managed through VueUse storage composables.

Recommended key shape:
- one root key such as `goldroad-state-v2`
- older split keys should be treated as legacy and cleaned up intentionally

### Why one key

One versioned JSON document gives the app:
- one place to migrate
- one place to reset when numbering restarts
- no cross-key drift bugs
- easier debugging

### 8.1 What local storage should contain

The root object should contain only the information needed for the local player experience.

Recommended categories:
- `version`
- `playerUUID`
- `settings`
- `currentRoadContext`
- `puzzleProgressByKey` for the live daily road
- `replayProgressByKey` for archive/random replay-only session persistence (`sessionStorage`)
- `historyByDay`
- `tutorialState`

### 8.2 Per-puzzle progress guidance

For each puzzle key such as `classic:42` or `expedition:42`, store only the minimum useful state.

Important separation:
- live daily-road progress can feed `historyByDay` and personal stats
- archive/random replay progress is session-scoped in `replayProgressByKey` (`sessionStorage`) and is cleared when the browser session ends, so it does not affect daily stats or streak history

Recommended fields:
- `attempts`
- `solved`
- `hintsUsed`
- `activeTimeMs` for accumulated unsolved timer state
- `timerStartedAt` when the active timer is currently running
- `solveTimeMs` when solved
- `guidePath` for hint-assisted retries
- optionally a compact summary field if the stats UI really needs it

### 8.3 Fields that should not be stored when derivable

These fields are intentionally considered redundant and should not be stored by default:
- `medal` — derive from `solved` and `attempts`
- `assisted` / `unassisted` — derive from `hintsUsed`
- `firstSolvedAttempt` — unnecessary if post-solve replay attempts do not mutate the record and `attempts` already represents attempts taken to solve

### 8.4 About `bestScore`

`bestScore` is not required for the core player model.

It is only worth storing if the product wants near-miss feedback such as:
- closest unfinished run
- best non-solving attempt
- archive/stats messaging about how close the player got

If GoldRoad does not plan to surface near-miss feedback, `bestScore` should be dropped from local storage.

## 9. Anonymous analytics model

This section describes the active analytics shape.

Server-side analytics should be anonymous and minimal.

### 9.1 Purpose

Analytics exists to support:
- yesterday comparison
- aggregate solve and hint behavior
- future puzzle tuning

It is not a user history system.

### 9.2 Recommended grain

The main analytics record should be one anonymous row per:
- `playerUUID`
- `gameNo`
- `puzzleType`

This avoids fake session history semantics while still allowing correct aggregate reporting.

The active implementation uses one anonymous analytics row per player, road day, and mode, then derives current-day and yesterday comparisons from those rows.

### 9.2.1 Write boundary and rate limiting

`/api/session/start`, `/api/session/end`, and `/api/session/hint` only accept the road day currently flagged `current=true`. A request for any other `gameNo`, including a past or archived road, is rejected outright, so archive/replay play cannot reach analytics even if called directly.

All three endpoints rate-limit on two independent keys: the client-supplied `playerUUID` and the request's source IP. Either key tripping rejects the request with a `429`.

The first valid tile move sends one best-effort `session/start` per live road and mode. `session/end` is solve-only and accepts only `score === maxScore`; dead ends, wrong exits, and manual retries never call it. The hint endpoint computes and returns a hint but does not create or mutate analytics. If a solve arrives without a starter row, the solve transaction creates the row and counts both the starter and solver exactly once.

Local solve credit is committed before analytics delivery. The initial solve request uses `keepalive`; an explicitly failed retryable request is handed to an app-wide client owner, persisted under `goldroad-failed-solves-v1`, retried sequentially at approximately 2s/5s/15s/30s/60s/120s plus lifecycle triggers, and discarded at that road's `nextGameAt`. No start or hint request is persisted. The current manifest-only install experience remains deliberate: there is no service worker, offline shell, or background sync.

### 9.3 Recommended fields

Recommended analytics fields:
- `playerUUID`
- `gameNo`
- `puzzleType`
- `attempts`
- `solved`
- `hintsUsed`
- `solveTimeMs` for solved runs
- `lastPlayedAt`
- `solvedAt` if solved

Legacy database columns for first-hint and failed-route behavior remain dormant until a later schema cleanup; they are not mutated or exposed by the active Stats contract.

### 9.4 Fields that should remain derived

These should stay derived unless reporting constraints prove otherwise:
- `medal`
- `assisted`
- `unassisted`

### 9.5 About near-miss analytics

If GoldRoad wants to understand how close players get before abandoning or solving, store a closeness metric such as:
- `closestTargetDelta`

That is more meaningful than storing raw `bestScore` in an exact-target game.

If near-miss tuning is not important yet, it can be omitted initially.

## 10. Stats model

The stats page blends two sources of truth.

### 10.1 Local stats

The browser should provide:
- all-time personal counts
- streaks
- solve rate
- medal distribution
- hint totals
- solve durations
- recent road log

### 10.2 Anonymous server stats

The server should provide:
- yesterday comparison
- aggregate solve counts
- anonymous field comparison by mode
- share-friendly summary context when useful

### 10.3 Two-mode presentation pattern

The stats page uses one global Classic/Expedition segmented toggle at the top that scopes every mode-specific section below it. There are no per-card mode toggles and no side-by-side mode columns.

All-time medal totals remain cross-mode above the toggle. The streak card sits immediately below the toggle and shows only the selected mode's current and best streak.

### 10.4 Community comparison presentation

The tries-distribution histogram is the centerpiece of community comparison, with the player's own bar highlighted. A warm one-line percentile headline sits above it ("solved in 2 — better than X% today"). Comparison copy shows rather than tells; avoid analytics-flavored phrasing.

Community data is yesterday-only: there is no dynamic comparison for the in-progress road. The histogram pools attempts 1 through 24 individually plus a pooled 25+ bucket and never reveals raw per-bucket counts, only shape relative to the busiest bucket. The histogram appears as soon as one play exists; a one-player field is still meaningful feedback to that player. At zero plays, the previous-road card remains visible with an explicit empty state. The unpooled `solvedAttemptsExact` percentile is computed separately from the pooled histogram data and appears from the first recorded solve; no minimum field-size gate is applied.

### 10.5 UI direction

The v2 board grid is the strongest part of the current interface and should be preserved.

The board shell, header, footer, mode switcher, road grammar, and navigation passes from the P1/RP1 series have landed. So has the July 2026 UI direction that followed it:

- board messaging is strictly contextual, following v1's footer contract: one message or affordance per state, the ordinal try (`2nd Try`, `3rd Try`) shown only at rest after a retry and cleared on the first move
- the stats page follows v1's shape — medal displays with a "+1" moment, a today's-result card with share, a previous-road global-stats story, and a key-value personal record — adapted to two modes via the single global mode toggle; there are no dynamic community stats for the in-progress road (RP1-11)
- Past Roads is a calendar-style picker rather than a card grid, and replay pages shed header/label chrome (RP1-12)

This was a UI refinement, not a change to the underlying gameplay model.

## 11. Interactive tutorial

The main How to Play experience is an interactive guided puzzle (`app/composables/useTutorialFlow.ts`, `useTutorialPractice.ts`, `TutorialDialog.vue`), shown on first run and reachable again from the header.

The How to Play sheet is a pure game-mechanics reference; its former About and Updates sections were removed and now live only on `/about`. In-game copy says "Try again", not "Retry".

The tutorial teaches:
- start and exit tiles, including the pre-run state where the footprints tile is already occupied and its neighbor glowing
- target-score solve requirement
- self-avoiding movement
- missing roads / road gaps
- retry loop
- hints at a basic level, including Expedition hands-on via the practice puzzle

## 12. Ops direction

Ops is intentionally not the first implementation priority, but the long-term direction is defined.

### Current direction

- Cloudflare Cron will rotate the active road day
- the cron job can also generate or queue new puzzles
- the system should maintain a puzzle pool buffer
- an initial seed buffer of around 15 road days is acceptable

### Launch and v1 cutover

- launch happens as soon as the remaining launch-blocking issues are done
- v2 is a clean break for v1 players: no history migration, no account import
- the restart is announced through an Updates timeline on the About surface, visible to everyone; `app/content/updates.ts` is the source of truth for update entries, newest first, and a new entry there automatically surfaces the notification dot for every player until they visit `/about`
- the notification dot appears at two levels: on the nav hamburger button, and again beside the About entry inside the open menu, so the destination is unambiguous. The About page itself owns acknowledgment: visiting it captures whether the update was still unseen (to show a one-time "new" marker on the newest entry), then clears the dot at both levels via `useUpdatesNotice`'s persisted `lastAcknowledgedUpdateId`
- leftover v1 local data (a `caches` bucket named `audio-cache`, or an IndexedDB `firebaseLocalStorageDb`) triggers a one-time `V1WelcomeSheet` for returning v1 players in addition to the general Updates dot; see `LAUNCH_CUTOVER_NOTES.md` for the full detection rationale
- the v1 Firebase stack gets a written shutdown checklist as part of cutover

## 13. Non-goals

These are intentionally out of scope for the current product direction:
- auth and account sync
- notification opt-in and push delivery
- server-side personal history
- long paginated archive history
- replay-history trophies such as D-day vs later-solve distinction
- score-ratio outcome tiers

## 14. Canonical docs

The active top-level docs are:
- `README.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `DESIGN_SYSTEM.md`

Older rewrite and milestone docs should not be restored as competing sources of truth.
