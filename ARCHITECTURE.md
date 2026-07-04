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

Medals are derived from the solve attempt count:
- Gold: solved on attempt 1
- Silver: solved on attempt 2
- Bronze: solved on attempt 3
- Attempt 4+: solved, but no medal

Important: medals are derived data. They should not be stored directly when the attempt count already exists.

### 1.3 Language guidance

Player-facing UI should usually say `solved`, not `exact solve`.

The exact target score is the only solve condition in GoldRoad, so "exact solve" is redundant as product language. Use target-score wording when teaching the rule, validating a run, or explaining why reaching the exit did not solve the puzzle. Use solved/unsolved everywhere else.

### 1.4 Solve celebration model

Solving never navigates away from the board. Celebration happens on a sheet over the board, in two distinct beats:

- Classic solve: a celebration bottom sheet with the medal/result moment, a shareable result preview with Share as the primary action, and Continue to Expedition as a prominent secondary action. Forward energy — "nice, now there's more."
- Expedition solve: a day-complete sheet with both mode results, a combined-day share text, the next-road countdown, and the streak/stats link. Closing energy — "that's the day, see you tomorrow."

Celebration energy tiers by result: first-attempt gold gets the full moment, medal solves get a standard celebration, late no-medal solves get warm relief with the Expedition CTA leading. A sheet fires once per solve event and never re-pops on later visits; a quiet Share affordance persists in the solved-board footer instead.

### 1.5 App shell requirements

Two v1 qualities are launch requirements for v2:

- game sounds (move/coin, denied move, dead-end, solve) with a persisted mute toggle; audio plays only after user interaction
- PWA installability: manifest and icon set in the v2 visual style, apple-touch-icon, and Open Graph / social metadata for link unfurls

### 1.6 Local-first scope

The player experience is intentionally local-first:
- no auth
- no account linking
- no cross-device sync
- no push notifications

Personal history is stored only in the browser. Server-side persistence exists only for anonymous analytics and aggregate comparison features.

## 2. Route surface

### Current routes

- `/` — current road day
- `/games` — recent past roads archive
- `/games/:gameNo` — past road day replay
- `/stats` — personal local stats plus anonymous global comparison

### Planned routes / surfaces

- interactive tutorial
- lightweight About / Privacy / Contact

## 3. Road-day model

The road day is the top-level gameplay unit.

Each road day contains:
- one `classic` puzzle
- one `expedition` puzzle

### Live road day behavior

- Classic is the primary live daily puzzle.
- Expedition unlocks through the live Classic solve flow.
- The home screen should make both modes feel part of the same day.

### Past road behavior

- Past-road replay is also day-based.
- A past-road fetch should return both puzzles in one response, mirroring the current-road API shape.
- Past-road replay should use the same mode-switching board UI model as the current road.
- Expedition should be directly available in archive replay rather than reusing the live-day unlock gate.

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

Tolls and bonuses change the score — the win condition — so they must read as first-class game elements, separated by hue and magnitude rather than fine glyph texture:

- open roads stay neutral gold line-work
- bonus roads carry a positive accent tint and a `+N` cost chip at the road midpoint
- toll roads carry a cautionary tint within the warm palette and a `−N` cost chip
- missing edges recede as far as possible

Guiding principle: plain roads whisper, scoring roads speak, missing roads disappear. Traversing a toll or bonus briefly pulses the chip and the score readout in the matching hue (disabled under reduced motion).

## 5. Puzzle generation and optimal paths

The generator computes the target score and the set of optimal paths for each puzzle.

### Current expectation

- `optimalPaths` remain a server-side generation artifact.
- They power hint logic and validation support.
- They are not part of normal public board payloads.

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
- `replayProgressByKey` for archive/random replay-only persistence
- `historyByDay`
- `tutorialState`

### 8.2 Per-puzzle progress guidance

For each puzzle key such as `classic:42` or `expedition:42`, store only the minimum useful state.

Important separation:
- live daily-road progress can feed `historyByDay` and personal stats
- archive/random replay progress can persist locally when useful, but it should live under `replayProgressByKey` so it does not affect daily stats or streak history

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

### 9.3 Recommended fields

Recommended analytics fields:
- `playerUUID`
- `gameNo`
- `puzzleType`
- `attempts`
- `solved`
- `hintsUsed`
- `attemptsBeforeFirstHint`
- `firstHintMoveIndex` if useful, measured as the relative move index from the start tile where the start tile itself is `0`
- `solveTimeMs` for solved runs
- `deadEndCount`
- `wrongExitCount`
- `lastPlayedAt`
- `solvedAt` if solved

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

Cross-mode facts (current streaks, all-time medal totals) live in a small always-visible header strip above the toggle so mode scoping never hides them.

### 10.4 Community comparison presentation

The tries-distribution histogram is the centerpiece of community comparison, with the player's own bar highlighted. A warm one-line percentile headline sits above it ("solved in 2 — better than X% today"). Comparison copy shows rather than tells; avoid analytics-flavored phrasing.

### 10.5 UI direction

The v2 board grid is the strongest part of the current interface and should be preserved.

The surrounding UI needs another product-design pass:
- the page layout should make the board feel intentionally placed — vertically centered like v1 — rather than merely stacked between controls
- the board header should carry road identity, score/target state, and mode switching with less visual noise
- the board footer should make retry, hint, next-step messaging, and post-solve actions clearer
- Classic and Expedition should feel like two parts of one road day, not generic tabs
- the stats page order is: personal emotional read first (streak, today's result, histogram), then community comparison, then a compressed all-time snapshot, then the recent road log, then share/explore actions
- the past-roads archive pages adopt the same card and typography system as the stats redesign

This is a planned UI refinement, not a change to the underlying gameplay model.

## 11. Interactive tutorial

The main How to Play experience should become an interactive guided puzzle.

The quick help sheet can stay as a compact reference, but it is not the primary onboarding surface.

The tutorial should teach:
- start and exit tiles
- target-score solve requirement
- self-avoiding movement
- missing roads / road gaps
- retry loop
- hints at a basic level

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
- the restart is announced through an Updates section on the About surface, visible to everyone; leftover v1 local data may be used to surface the note more prominently for returning players
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
