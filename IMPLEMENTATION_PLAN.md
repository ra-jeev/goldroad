# GoldRoad Implementation Plan

This document is the working issue system for GoldRoad v2.

Use it in future sessions as the planning source of truth. The goal is to keep product decisions, implementation priorities, and acceptance criteria in one place so the repo does not drift back into contradictory docs.

## 1. How to use this document

Each item below is an implementation issue at the planning level.

Every issue should be tracked with:
- `Priority` — `P0`, `P1`, or `P2`
- `Status` — `planned`, `in progress`, `done`, or `deferred`
- `Goal` — what success looks like
- `Why it matters` — why it is worth doing now
- `Scope` — major files or systems affected
- `Acceptance criteria` — concrete conditions to consider the work done
- `Dependencies` — anything that should land first

## 2. Locked decisions snapshot

These decisions are treated as locked unless deliberately changed later:
- no auth
- no notification opt-in or push
- no server-side personal history sync
- a puzzle is solved only by reaching the exit on the target score
- medals are derived from tries to solve
- personal history is local-first
- archive is limited to recent roads
- random deep-archive play is allowed
- past-road replay is dual-mode and day-based
- local storage should use one versioned JSON key
- hints are a single repeated action, not a multi-level system
- hint guidance persists across retries until the puzzle is solved
- active solve time should be tracked
- edge naming should move to `missingEdges`, `tollEdges`, and `bonusEdges`
- solving never navigates away from the board; celebration happens on a sheet over the board
- launch is a clean break for v1 players: no history migration, announced via an Updates section on the About surface
- game sounds and PWA installability are launch requirements, not optional polish

## 3. Explicit data simplifications

These fields are considered redundant unless a later implementation proves otherwise:
- `medal`
- `assisted`
- `unassisted`
- `firstSolvedAttempt`

Recommended treatment:
- derive `medal` from `solved` and `attempts`
- derive assisted state from `hintsUsed`
- use `attempts` as the attempts-to-solve value once a puzzle is solved, since post-solve replay history is intentionally out of scope

`bestScore` is also not required by default. If near-miss analytics or UI need it later, prefer a clearer metric such as `closestTargetDelta`.

## 4. Priority list

## P0 — foundational product and data work

### Issue P0-1 — Rename the edge model and clean up schema naming
- Priority: `P0`
- Status: `done`
- Goal: make the schema and copy describe road gaps accurately.
- Why it matters: `blocked` implies a traversable road that later becomes unavailable, which is not how the board actually works.
- Scope:
  - shared validators and types
  - puzzle engine
  - generator
  - app copy
  - API serialization
  - schema/migration cleanup where needed
- Acceptance criteria:
  - `blocked` is removed from the active domain model
  - the canonical grouped names are `missingEdges`, `tollEdges`, and `bonusEdges`
  - user-facing copy stops describing absent roads as blocked roads
  - architecture and implementation docs match the new names
- Dependencies: none

### Issue P0-2 — Replace level-based hints with the new path-aware hint system
- Priority: `P0`
- Status: `done`
- Goal: ship the simplified hint model based on path prefix and divergence.
- Why it matters: this is a locked gameplay decision and affects client behavior, analytics, and docs.
- Scope:
  - hint request/response validators
  - hint API route
  - hint computation utilities
  - board footer and runtime messaging
  - local puzzle state for hint guide persistence
- Acceptance criteria:
  - hint requests use ordered `pathHistory`
  - if the player is still on an optimal prefix, the response returns the next correct tile
  - if the player has diverged, the response returns the divergence tile and correct next tile
  - a guided retry path can persist locally and reappear after Retry
  - repeated hints can extend the locally stored guide path
  - guide state is cleared once the puzzle is solved
- Dependencies:
  - P0-1 for naming consistency if hint messaging references edge names

### Issue P0-3 — Decide and implement the hint-computation boundary
- Priority: `P0`
- Status: `done`
- Goal: lock the technical boundary for hint computation so future sessions do not debate it again.
- Why it matters: the client/server boundary affects security, simplicity, and analytics behavior.
- Scope:
  - hint API contract
  - client hint cache strategy
  - architecture docs
- Recommended direction:
  - keep optimal paths server-side for the first implementation pass
  - return only the computed hint result
  - revisit client-side optimal-path caching only if solution exposure is considered acceptable later
- Acceptance criteria:
  - the chosen approach is documented explicitly in `ARCHITECTURE.md`
  - implementation follows the documented boundary
- Dependencies:
  - P0-2

### Issue P0-4 — Rework archive replay into a dual-puzzle road-day flow
- Priority: `P0`
- Status: `done`
- Goal: make past-road replay use the same day-based dual-mode model as the live road.
- Why it matters: archive currently behaves like a separate one-board product model.
- Scope:
  - past-road fetch API
  - archive replay page
  - mode-switching UI behavior
  - random-road entry flow
- Acceptance criteria:
  - a past-road fetch returns both `classic` and `expedition`
  - the archive replay page supports the same mode-switching pattern as the live road page
  - Expedition is directly available in archive replay
  - old single-board replay semantics are removed from the active experience
- Dependencies:
  - ideally P0-2 so hints work consistently in current and archive contexts

### Issue P0-5 — Unify gameplay state across current, archive, and random roads
- Priority: `P0`
- Status: `done`
- Goal: stop maintaining separate gameplay implementations for live and replay flows.
- Why it matters: shared gameplay rules should live in one state system to reduce drift.
- Scope:
  - `useGoldroadGame` and related composables
  - current road page
  - archive replay page
  - random road entry behavior
- Acceptance criteria:
  - one gameplay state model powers live roads, archive roads, and random roads
  - board header/footer behavior is consistent across entry types
  - hint persistence and timing behavior work the same way everywhere
- Dependencies:
  - P0-4

### Issue P0-6 — Consolidate local browser state into one versioned root key
- Priority: `P0`
- Status: `done`
- Goal: move all active player state into one versioned JSON blob.
- Why it matters: numbering is restarting and the current multi-key model is harder to reset and reason about.
- Scope:
  - local storage composables
  - stats derivation logic
  - gameplay persistence hooks
  - tutorial state
- Acceptance criteria:
  - one root local-storage key holds the active player state
  - old v1/vrewrite keys are ignored or cleaned up intentionally
  - the new schema does not store redundant fields such as `medal` or `assisted`
  - meaningful writes happen on game events rather than every timer tick
- Dependencies:
  - P0-5 because unified gameplay state should define what needs persistence

### Issue P0-7 — Redesign analytics around anonymous per-player-per-road records
- Priority: `P0`
- Status: `done`
- Goal: replace misleading session-history semantics with analytics data that matches the product.
- Why it matters: current analytics should support global comparison, not pretend to be a replay/session history system.
- Scope:
  - analytics schema
  - session end route
  - hint route
  - overview stats route
  - migration / seed / type cleanup as needed
- Acceptance criteria:
  - analytics rows are keyed by anonymous player + road + mode
  - hints are counted exactly once
  - derived fields like `medal` and `assisted` are not unnecessarily duplicated
  - behavior metrics include at least `attemptsBeforeFirstHint`, `firstHintMoveIndex` measured from the start tile with the start tile as `0`, `deadEndCount`, `wrongExitCount`, and `solveTimeMs`
  - the stats API can support yesterday comparison cleanly
- Dependencies:
  - P0-2
  - P0-6

### Issue P0-8 — Add active solve timer support
- Priority: `P0`
- Status: `done`
- Goal: record meaningful active solve durations.
- Why it matters: timer data supports share output, personal stats, and anonymous comparison.
- Scope:
  - gameplay runtime state
  - local persistence
  - analytics writes
  - stats presentation
- Acceptance criteria:
  - timer starts as soon as the board is visible for an unsolved puzzle
  - timer pauses when the document is hidden
  - timer resumes when the player returns
  - timer is persisted only on meaningful events
  - the accumulated timer value is kept across retries until the puzzle is solved
  - solve time is available to local stats and analytics
- Dependencies:
  - P0-5
  - P0-6
  - P0-7

## P1 — player-facing completion work

### Issue P1-1 — Bring the stats page to the intended parity level
- Priority: `P1`
- Status: `done`
- Goal: make the stats page a complete destination rather than a partial summary.
- Why it matters: stats is one of the main retention and share surfaces.
- Scope:
  - local stats derivation
  - stats page UI
  - server comparison API
- Acceptance criteria:
  - the page shows all-time personal stats derived from local history
  - the page shows streaks, solve rate, medals, hints, and solve timing
  - recent road history is easy to scan
  - yesterday comparison uses one card with a mode toggle
- Dependencies:
  - P0-6
  - P0-7
  - P0-8

### Issue P1-2 — Add share support
- Priority: `P1`
- Status: `done`
- Goal: allow the player to share results cleanly from the stats surface.
- Why it matters: sharing was valuable in the legacy product and fits this game naturally.
- Scope:
  - stats page UI
  - client share helper logic
- Acceptance criteria:
  - use `navigator.share` when available
  - provide clipboard fallback otherwise
  - share output includes the road, mode, attempt result, and solve time when appropriate
- Dependencies:
  - P1-1

### Issue P1-3 — Add the random-road CTA after the archive boundary
- Priority: `P1`
- Status: `done`
- Goal: provide a deep-archive escape hatch without turning the recent archive into long pagination.
- Why it matters: this is the planned way to keep older roads accessible without a giant archive list.
- Scope:
  - stats page and optionally archive page
  - random-road API
  - replay entry behavior
- Acceptance criteria:
  - the CTA appears only after the current road number crosses the recent-archive boundary
  - it chooses a road day rather than a single puzzle mode
  - it lands on the normal dual-mode replay experience
- Dependencies:
  - P0-4
  - P0-5

### Issue P1-4 — Simplify solved terminology across product copy
- Priority: `P1`
- Status: `done`
- Goal: make the language match the product rule: solved means reaching the exit on the target score.
- Why it matters: "exact solve" is redundant if there is no other solve type, and it makes the UI feel more technical than it needs to.
- Scope:
  - app copy
  - stats labels
  - share output
  - architecture/docs terminology
  - legacy helper names only where renaming is low risk
- Acceptance criteria:
  - player-facing UI uses solved/unsolved instead of exact solve/exact solves
  - instructional copy still explains that the final score must equal the target
  - stats labels use "Solves" or "Solved" where appropriate
  - internal code that must keep exact-score helper names remains clear and isolated
- Dependencies: none

### Issue P1-5 — Redesign the board shell, header, footer, and mode switcher
- Priority: `P1`
- Status: `done`
- Goal: preserve the improved v2 board grid while making the surrounding game UI feel as polished and intentional as the previous version.
- Why it matters: the core gameplay is stronger, but the current page frame, header, footer, and mode tabs do not yet carry the same warmth or clarity as the old UI.
- Scope:
  - current road page layout
  - archive replay page layout
  - `GameBoardHeader`
  - `GameBoardFooter`
  - Classic/Expedition mode switching
  - post-solve and already-solved states
- Acceptance criteria:
  - the board is visually centered and aligned with stable spacing on mobile and desktop
  - road identity, target, current score, attempts, and solved state are easy to scan without crowding the board
  - retry, hint, stats, archive, and expedition-unlock actions have clear priority
  - solved boards have an intentional replay/post-solve interaction model
  - Classic and Expedition read as two modes of one road day, including locked/unlocked/archive states
  - the UI remains accessible by keyboard and touch
- Dependencies:
  - P1-4 so new copy uses the simplified terminology
- Completion notes:
  - board grid, tiles, and road visual treatment were preserved
  - page shell was re-centered around the board with a compact mode switcher and inline score/board coin readout
  - footer behavior now follows the older app's dynamic rhythm: status at rest, compact icon actions during play
  - solved Classic keeps Expedition available while allowing untracked Classic replay
  - solved-history replays do not increase attempts, track time, record hints, or submit run analytics

### Issue P1-6 — Redesign the stats page presentation
- Priority: `P1`
- Status: `planned`
- Goal: keep the richer v2 local/global stats model, but make the stats page one coherent, scannable, emotionally rewarding surface — and extend that design system to the past-roads pages.
- Why it matters: stats is a retention and sharing surface; it should feel rewarding, not like an analytics dashboard. The current page mixes per-card mode toggles, side-by-side mode cards, and split grids with no single pattern.
- Design decisions (agreed):
  - one global Classic/Expedition segmented toggle at the top of the page scopes every mode-specific section below it; no per-card toggles or side-by-side mode columns
  - cross-mode facts (current streaks, all-time medal totals) live in a small always-visible header strip above the toggle so mode scoping never hides them
  - the tries-distribution histogram returns as the centerpiece of community comparison, with the player's own bar highlighted
  - the "top X%" percentile line returns as a warm one-line headline above the histogram
  - page order: personal emotional read first (streak, today's result, histogram), then community comparison, then a compressed all-time snapshot (~4 headline numbers with the rest behind a "more" affordance), then recent road log, then share/explore actions
- Scope:
  - stats page hierarchy
  - local all-time snapshot
  - medal/streak presentation
  - current/yesterday community comparison, including the histogram
  - recent road log
  - share and random-road actions
  - `/games` archive pages adopting the same card and typography system
- Acceptance criteria:
  - personal progress is the first emotional read
  - one global mode toggle scopes the page; the same presentation pattern is used in every section
  - the histogram and percentile headline are live for community comparison
  - global comparison is useful but does not dominate the page
  - medals, streaks, attempts, hints, and solve time are scannable at a glance
  - share actions feel attached to a concrete result
  - the page works well with sparse/no local history
  - the past-roads archive pages visibly share the same design system
- Dependencies:
  - P1-4
  - P1-10 so share actions and result framing match the celebration sheets

### Issue P1-7 — Replace static help with an interactive tutorial
- Priority: `P1`
- Status: `done`
- Goal: make onboarding hands-on instead of text-first.
- Why it matters: the puzzle teaches best through play.
- Scope:
  - tutorial guided experience
  - help sheet role cleanup
  - tutorial state in local storage
- Acceptance criteria:
  - a new player can learn the core rules by playing through a guided flow
  - the tutorial covers target-score solving, retry, missing edges, and self-avoiding movement
  - the quick help sheet remains as a short reference rather than the main tutorial
- Dependencies:
  - P0-6
- Completion notes:
  - first-run players see a two-step tutorial dialog instead of a static help sheet
  - visual guide steps explain start/exit icons, open roads, missing roads, toll roads, and bonus roads
  - the practice step uses one fixed Expedition puzzle with normal retry and hint behavior
  - tutorial completion is persisted only when the player solves the practice road and clicks Play today
  - How to Play remains available as a compact reference and entry point back into the tutorial

### Issue P1-8 — Add About / Privacy / Contact surfaces
- Priority: `P1`
- Status: `done`
- Goal: add lightweight public-facing support surfaces without reviving legacy auth or notification complexity.
- Why it matters: public polish and privacy clarity still matter.
- Scope:
  - lightweight page or sheet
  - nav updates if needed
- Acceptance criteria:
  - the app has a simple privacy explanation
  - basic about/contact information is available
  - an Updates section announces v2 as a fresh start: numbering restart, local-first history, and a clean break from v1 accounts and server history
  - the tone keeps the v1 identity (made-with-love footer, contact link)
- Dependencies: none
- Completion notes:
  - `/about` ships About, Updates (typed entry list, newest first), Privacy, and the v1-voice contact footer
  - nav link added to the mobile menu panel next to Past Games
  - the pinned Updates entry uses a "Jul 2026" placeholder date — set the real date during P2-4 launch cutover

### Issue P1-9 — Replace the stale API smoke script and add regression coverage
- Priority: `P1`
- Status: `done`
- Goal: make sure the repo has tests that match the actual contract.
- Why it matters: hint, archive, and analytics changes touch multiple boundaries.
- Scope:
  - API smoke script
  - selected tests around hint logic and stats aggregation
- Acceptance criteria:
  - the API smoke script uses the current request/response contract
  - local seed data can satisfy the smoke script, including the random older-road condition or an intentional 404 branch
  - there is regression coverage for the hint prefix/divergence logic
  - there is regression coverage for analytics aggregation edge cases
- Dependencies:
  - P0-2
  - P0-7
- Completion notes:
  - `scripts/check-api-routes.ts` (replacing the stale `.mjs`) validates every response against the real Zod schemas and handles the deep-archive 404 branch
  - 37 vitest tests across hints, pathfinder, puzzleEngine, gameTiers, and stats aggregation
  - bug fixed in scope: `session/end` and `session/hint` threw raw `ZodError` on bad payloads, surfacing as bare 500s instead of 400s; both now route through a shared `parsePayload` (`server/utils/validation.ts`)
  - stats aggregation's pure shaping functions extracted (behavior-preserving) into `server/utils/statsAggregation.ts` for testability
  - found, not fixed (tracked below): `PastGameSummarySchema` in `shared/validators/game.ts` is stale and no longer matches the `/api/games/past` response shape from the P0-4 rework; `computeHint` returns an ambiguous "diverged" result when a hint is requested after the player has already fully traversed the best-matching optimal path (no distinct "already solved" signal)

### Issue P1-10 — Add post-solve celebration and share sheets
- Priority: `P1`
- Status: `done`
- Goal: restore the v1 solve-moment emotion and share funnel without losing the Expedition handoff.
- Why it matters: the solve is the emotional peak of the session and the entire share funnel. v1 spent it well (navigate to stats, "+1" medal tick, share button); v2 currently spends it on a quiet footer status line. Navigating away like v1 would kill Expedition momentum, so celebration must float over the board.
- Design decisions (agreed):
  - Classic solve opens a celebration bottom sheet over the board; the app never navigates away on solve
  - sheet contents in order: medal/result celebration with "+1" energy, shareable result preview with a primary Share button, Continue to Expedition as a prominent secondary CTA, quiet dismiss
  - celebration energy tiers by result: first-attempt gold gets the full moment; 2–3 attempt medal solves get a standard celebration; late no-medal solves get warm relief ("You made it"), quieter share, Expedition CTA leading
  - the sheet fires once per solve event and never re-pops on later app opens that day
  - after dismissal, the solved-board footer keeps a persistent quiet Share affordance alongside Switch to Expedition
  - Expedition solve opens a distinct day-complete sheet: both mode results together, a combined-day share text, the next-road countdown as the retention hook, and the streak increment with a stats link
- Scope:
  - celebration sheet component and solve-event wiring
  - share text helpers, including a combined Classic+Expedition day share
  - board footer share affordance for already-solved boards
  - local state for fired-celebration tracking
- Acceptance criteria:
  - solving Classic shows the celebration sheet with Share primary and Expedition secondary
  - celebration tone matches the three result tiers
  - dismissing returns to the solved board with Expedition and Share still reachable from the footer
  - the sheet does not re-open on revisits after being shown once for that solve
  - solving Expedition shows the day-complete sheet with both results, combined share, and next-road countdown
  - archive/random replays keep celebrations lightweight and do not imply daily-streak credit
- Dependencies:
  - P1-5
- Completion notes:
  - one `SolveCelebrationSheet` component covers all three variants: classic-solve, day-complete, and a lightweight replay-solve for archive/random
  - celebration-fired tracking lives in `goldroad-state-v2` as `celebratedSolveKeys` (`buildCelebrationKey`, `hasCelebratedSolve`, `markSolveCelebrated`)
  - relief-tier classic solves flip the CTA hierarchy so Expedition leads and Share goes quiet, per spec
  - day-complete share text combines both modes; footer gained a persistent quiet Share affordance for already-solved boards
  - merged alongside P1-13's board-visual changes to the same page shells without conflict (additive changes in both)

### Issue P1-11 — Restore game sounds
- Priority: `P1` (launch-blocking)
- Status: `planned`
- Goal: bring back the audio feedback that made v1 tactile — with a mute toggle.
- Why it matters: v1 had coin, deny, win, and no-moves sounds; v2 has none. For a tap-driven puzzle this is lost game feel, and launch will not happen without it.
- Scope:
  - sound assets (reuse or re-record the v1 set)
  - a small playback composable
  - mute setting persisted under `settings` in `goldroad-state-v2`
  - a reachable mute toggle in the app shell
- Acceptance criteria:
  - move/coin, denied move, dead-end, and solve events have distinct sounds
  - the celebration sheets play the solve sound tier
  - mute state persists across sessions
  - no autoplay violations: audio only ever plays after user interaction
  - light haptic feedback (`navigator.vibrate`) accompanies moves and solves on supporting devices, following the same mute setting
- Dependencies:
  - P1-10 for the solve-tier hookup (partial overlap is fine)

### Issue P1-12 — PWA installability and social metadata
- Priority: `P1` (launch-blocking)
- Status: `planned`
- Goal: make v2 installable and shareable-looking, replacing the v1 icon set.
- Why it matters: daily games live on home screens and in shared links. v1 shipped a manifest, maskable icons, and apple-touch-icon; v2 currently has only a favicon and robots.txt.
- Scope:
  - web app manifest and icon set in the new v2 board visual style (v1 icons show the old tile/coin design and should not be reused)
  - apple-touch-icon and favicon refresh
  - Open Graph / Twitter meta tags with a share image
  - basic offline-shell decision (explicitly in or out; not silently missing)
- Acceptance criteria:
  - the app is installable on Android and iOS with correct new-style icons
  - shared links unfurl with title, description, and image
  - the manifest passes a Lighthouse PWA installability check
- Dependencies: none

### Issue P1-13 — Elevate toll/bonus road visuals and page composition
- Priority: `P1`
- Status: `done`
- Goal: make scoring roads read as first-class game elements and fix the board's page placement.
- Why it matters: tolls and bonuses change the score — the entire win condition — but render as faint gold line patterns of the same species as open roads. The board column also no longer centers vertically the way v1 did.
- Design decisions (agreed):
  - separate road types by hue, not just glyph: bonus gets a positive accent, toll a cautionary tint within the warm palette, open roads stay neutral gold
  - toll/bonus roads carry a small `+N` / `−N` cost chip at the road midpoint in the matching tint
  - missing edges recede further; guiding principle: plain roads whisper, scoring roads speak, missing roads disappear
  - traversing a toll/bonus briefly animates the chip and pulses the score readout in the matching hue
- Scope:
  - `RoadGlyph` / `BoardRoad` visual treatment
  - score readout feedback
  - page shell vertical composition on the current-road and replay pages
- Acceptance criteria:
  - toll and bonus roads are identifiable at a glance by color before reading any glyph
  - cost chips show the actual score delta
  - the board grid itself keeps its current strong treatment
  - the board column centers vertically like v1 on typical mobile and desktop viewports
  - reduced-motion preference disables the pulse animations
- Dependencies: none
- Completion notes:
  - toll = rust `#d2691e`, bonus = honey-gold `#ffce3a`, distinct from neutral open-road gold and from the end-tile color
  - cost chips carry sign + number (not color alone), so the signal is color-blind safe
  - board shell on both current-road and replay pages now centers vertically via flex column
  - `GameBoardHeader` gained an optional `pulse` prop; `GameBoard` emits `scoringMove` on toll/bonus traversal — additive, no breaking prop changes

## P2 — polish and operations

### Issue P2-1 — Align migration metadata with the current schema
- Priority: `P2`
- Status: `done`
- Goal: make future schema generation and migration review reliable again.
- Why it matters: migrations after `0003` exist, but the Drizzle metadata journal currently stops at `0003`, which can confuse future migration generation.
- Scope:
  - `server/db/migrations`
  - `server/db/migrations/meta`
  - local migration workflow
- Acceptance criteria:
  - migration metadata reflects the latest committed schema state
  - running `pnpm db:generate` does not try to recreate already-applied schema changes
  - local migration/setup notes explain when to regenerate seed data
- Dependencies:
  - P1-9 can land before or alongside this
- Completion notes:
  - hand-constructed `meta/0004`–`0006` snapshots and `_journal.json` entries to match migrations 0004–0006, no `.sql` files touched
  - `pnpm db:generate` verified as a clean no-op; `pnpm db:migrate` + `pnpm db:seed:local` verified from a fresh local D1
  - added `server/db/README.md` documenting generate-vs-hand-write workflow and when to regenerate seed data

### Issue P2-2 — Finalize Cloudflare cron and puzzle-pool operations
- Priority: `P2`
- Status: `planned`
- Goal: automate active-road rotation and pool replenishment.
- Why it matters: required for production, but intentionally sequenced after product behavior is stable.
- Scope:
  - cron handler
  - queue or inline generation strategy
  - seed pool generation
  - deployment and migration notes
- Acceptance criteria:
  - the active road can rotate without manual intervention
  - the puzzle pool can replenish automatically
  - the system keeps a healthy buffer of future roads
- Dependencies:
  - core product issues above should be stable first

### Issue P2-3 — Production deployment cleanup
- Priority: `P2`
- Status: `planned`
- Goal: make the deploy path and D1 setup explicit and repeatable.
- Why it matters: the app should not depend on implied local knowledge to ship.
- Scope:
  - Wrangler config
  - build/deploy scripts
  - migration documentation
- Acceptance criteria:
  - production D1 bindings are clearly documented
  - placeholder D1 ids in Wrangler config are replaced or documented as local-only placeholders
  - the expected deploy command and target path are documented
  - local and production migration flows are both clear
  - Workers observability/logging is enabled so cron rotation or API failures are visible without player reports
  - the analytics write endpoints (session end, hint) have basic rate limiting against anonymous-UUID spam
- Dependencies:
  - P2-2 can land alongside or just before this

### Issue P2-5 — Remove the stale `PastGameSummarySchema` validator
- Priority: `P2`
- Status: `planned`
- Goal: delete or correct the leftover flat-shape validator that no longer matches `/api/games/past`.
- Why it matters: found during P1-9 test writing — `shared/validators/game.ts` exports `PastGameSummarySchema` as `{gameNo, maxScore, totalCoins, playableAt}`, predating the P0-4 dual-puzzle archive rework. The live route returns `{count, games: [{gameNo, playableAt, classic, expedition}]}`. The schema appears unused; a stale exported type is a landmine for the next person who wires it up assuming it's current.
- Scope:
  - `shared/validators/game.ts` and any re-exported type in `shared/types/game.ts`
- Acceptance criteria:
  - either the schema is removed, or it is corrected to match the current `/api/games/past` response and something references it
- Dependencies: none

### Issue P2-6 — Give hint requests an explicit "already solved" signal
- Priority: `P2`
- Status: `planned`
- Goal: make `computeHint`'s behavior well-defined when a hint is requested after the player has already fully traversed the best-matching optimal path.
- Why it matters: found during P1-9 test writing — today this returns a "diverged" result where the divergence tile equals the correct next tile, which is a confusing signal to build UI messaging on. This is a product-behavior decision (what should the hint UI say/do post-solve-equivalent), not just a bug fix.
- Scope:
  - `server/utils/hints.ts`
  - hint response type in `shared/validators/game.ts` if a new result variant is needed
  - board footer hint messaging if the client needs to handle a new case
- Acceptance criteria:
  - a hint request against a fully-traversed optimal path returns an unambiguous result distinct from a genuine divergence
  - a regression test locks in the chosen behavior
- Dependencies: none

### Issue P2-4 — Launch cutover and v1 decommission
- Priority: `P2` (launch-blocking)
- Status: `planned`
- Goal: make the v1 → v2 switchover on playgoldroad.com a deliberate, scripted event rather than an implied one.
- Why it matters: playgoldroad.com has live players with server-side streaks and history. The decision is a clean break — no migration — and that must be communicated, not silently imposed.
- Scope:
  - DNS / hosting switchover of playgoldroad.com to the Cloudflare deployment
  - the About Updates section entry announcing the fresh start (from P1-8), live at launch
  - optional detection of leftover v1 local data to surface the update note more prominently for returning players
  - Firebase / hosting sunset checklist for the v1 stack
  - launch-day verification pass: current road live, analytics writing, share links unfurling
- Acceptance criteria:
  - playgoldroad.com serves v2
  - returning v1 players see an explanation of the restart on first visit paths (About Updates at minimum)
  - v1 infrastructure has a written shutdown checklist, executed or scheduled
  - no v1 URLs break hard: legacy routes land somewhere sensible in v2
- Dependencies:
  - P2-2
  - P2-3

## 5. Docs cleanup plan

### Keep
- `README.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `DESIGN_SYSTEM.md`

### Remove from the active root-doc set
- `REWRITE_ARCHITECTURE.md`
- `GAMEPLAY_REFACTOR_GUIDE.md`
- `MILESTONE_1_BOARD_FIRST_BUILD_SPEC.md`
- `LEGACY_ARCHITECTURE_NOTES.md`

The legacy code and archive material under `_archive/` remain the place for historical reference.

## 6. Recommended implementation order

1. P0-1 — schema naming cleanup
2. P0-2 — new hint system
3. P0-3 — hint boundary decision and documentation
4. P0-4 — dual-puzzle archive flow
5. P0-5 — unified gameplay state
6. P0-6 — one-key local storage model
7. P0-7 — analytics redesign
8. P0-8 — active solve timer
9. P1-1 — stats parity pass
10. P1-2 — share support
11. P1-3 — random-road CTA
12. P1-4 — solved terminology cleanup
13. P1-5 — board shell, header, footer, and mode switcher redesign ✅
14. P1-7 — interactive tutorial ✅
15. P1-10 — post-solve celebration and share sheets
16. P1-13 — toll/bonus road visuals and page composition
17. P1-11 — game sounds
18. P1-9 — test and smoke script cleanup (before further stats/analytics churn)
19. P1-6 — stats page redesign, including past-roads design coherence
20. P1-8 — About / Privacy / Contact with the Updates section
21. P1-12 — PWA installability and social metadata
22. P2-1 — migration metadata alignment
23. P2-2 / P2-3 — cron and deployment work
24. P2-4 — launch cutover and v1 decommission

## 7. Update rule

Whenever a product decision is changed, update this file and `ARCHITECTURE.md` in the same pass.

That keeps future sessions aligned with the same plan and prevents outdated docs from becoming accidental requirements again.
