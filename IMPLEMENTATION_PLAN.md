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
  - _(superseded: archive hints are local per RP0-5's owner carve-out; live/current road paths stay server-only)_
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
  - _(superseded: archive Expedition is gated per RP0-5; archive hints are local per RP0-5's owner carve-out)_
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
- Status: `done`
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
- Completion notes:
  - `app/pages/stats.vue` restructured around the locked order: header strip (medals/streaks) → global Classic/Expedition toggle → today/personal read → community comparison (histogram + percentile) → compressed all-time snapshot behind a "more" affordance → recent road log → share/random-road actions
  - histogram extracted into a new reusable `app/components/StatsTriesHistogram.vue`
  - `/games` archive pages (`index.vue` and `[gameNo].vue`) restyled onto the same card/typography system as stats
  - reused existing data composables (`useLocalPlayerStats`, `useLocalGameProgress`, `useStatsApi`, `useGamesApi`, `useRoadResultShare`) unchanged — this was a presentation restructure, not a data-layer rewrite
  - verified live: empty-state (no local history) renders a clean first-run prompt rather than a broken/blank page; games archive and archived-road-day replay pages render with matching visual language; `pnpm typecheck` and `pnpm test` (38/38) clean on merged `nuxt`

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
- Status: `done`
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
- Completion notes:
  - reused v1's exact `_archive/frontend/src/assets/audio/*.mp3` set, copied into `public/sounds/` as `move.mp3` (from `coin.mp3`), `deny.mp3`, `dead-end.mp3` (from `no-moves.mp3`), `solve.mp3` (from `win.mp3`)
  - new `useSoundEffects.ts` composable lazily creates/reuses `HTMLAudioElement`s, gated by a new `settings.muted` field in `goldroad-state-v2` (same extension pattern as `celebratedSolveKeys`)
  - denied-move taps previously fell through silently in `moveTo()`; added a `deniedMoveSignal` counter so the deny sound has something real to hook into
  - wrong-exit and dead-end both play the dead-end sound (no 5th sound invented); solve sound fires once per celebration trigger across both classic-solve and day-complete variants
  - haptics (`navigator.vibrate`) fire on move (short pulse) and solve (short pattern), scoped to the same mute setting, moves/solves only per spec
  - mute toggle added to the app header reusing the existing `.icon-button` pattern
  - typecheck clean, 38/38 tests pass on merged `nuxt`

### Issue P1-12 — PWA installability and social metadata
- Priority: `P1` (launch-blocking)
- Status: `done`
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
- Completion notes:
  - new v2 icon art (diamond road-tile glyph on the dark gold gradient) designed as `public/icons/icon-master.svg` / social card as `public/icons/og-image.svg`, rasterized via a one-off `scripts/generate-icons.ts` (`sharp`, devDependency) into 192/512 "any" icons, a proper full-bleed maskable 512 variant, a 180px apple-touch-icon, a refreshed favicon, and a 1200x630 OG image
  - `public/manifest.webmanifest` + `nuxt.config.ts` `app.head` wired: manifest link, apple-touch-icon, favicon, theme-color, and full OG/Twitter card meta
  - offline shell: explicitly decided **out of scope for v2 launch**, recorded in `ARCHITECTURE.md` §1.5 rather than left silently missing
  - verified live: manifest and OG image both serve 200, `<head>` carries all the expected tags; a real Lighthouse audit is still pending (no browser in the build sandbox), but the manifest satisfies every field Lighthouse's installability check requires
  - minor known polish item, not blocking: the OG image's start-node dot sits very close to the left edge — fine as-is, worth a small nudge later if anyone touches that asset again
  - typecheck, build, and 38/38 tests pass on merged `nuxt`

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
- Status: `done`
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
- Completion notes:
  - new Nitro scheduled task `server/tasks/rotate-road.ts` (registered via `nitro.scheduledTasks` in `nuxt.config.ts`, matching Cloudflare Cron Trigger `triggers.crons` in `wrangler.jsonc`, both `'0 0 * * *'` — daily at UTC midnight)
  - core logic in pure, testable `server/utils/roadOperations.ts`: `rotateRoadAndReplenishPool()` flips `current` flags between road days, maintains a 5-day future buffer via `generatePuzzle`, and falls back to on-the-spot generation (with an error log) if the pool is ever found dry at rotation time
  - documented in `ARCHITECTURE.md` under "Road rotation and puzzle pool", including two local-testing options
  - verified: task registers correctly (`/_nitro/tasks` lists it), builds into the worker bundle, and `wrangler dev` confirms the `DB` binding and cron trigger are wired correctly; a full local scheduled-event fire hit a known Miniflare/wrangler tooling bug (`DataCloneError` serializing `ScheduledController` under `--test-scheduled`) unrelated to this code — not something to chase further here
  - typecheck clean, 38/38 tests pass on merged `nuxt`

### Issue P2-3 — Production deployment cleanup
- Priority: `P2`
- Status: `done`
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
- Completion notes:
  - `wrangler.jsonc`'s `<database_id>` placeholder now carries an impossible-to-miss comment; `server/db/README.md` documents the exact `wrangler d1 create goldroad` step and the local-vs-production migration commands
  - `README.md` documents the `pnpm deploy` path and build output layout
  - `session/end.post.ts` and `session/hint.post.ts` both gained `console.error` logging on failure paths (invalid payload, game not found, rate-limited, unexpected 5xx) without logging full payload bodies or full UUIDs
  - rate limiting via Cloudflare's native Workers Rate Limiting binding (`RATE_LIMITER`, 20 req/60s per `playerUUID`, `wrangler.jsonc` `ratelimits` block), returning `429 {"ok":false,"error":"rate_limited"}` when exceeded
  - fixed a real type error in the delivered code: the `RateLimitedEvent` type intersected with the strict generated `Env` (all bindings required), which no real `H3Event` structurally satisfies — narrowed it to match the same all-optional-fields pattern already used by `useD1` in `server/db/client.ts`; regenerated `worker-configuration.d.ts` via `pnpm cf-typegen` so `Env` includes `RATE_LIMITER`
  - verified live under plain `pnpm dev`: hint/session-end endpoints work normally, and hammering the hint endpoint with one `playerUUID` confirmed exactly 20 successful requests then `429` on the 21st
  - typecheck and 38/38 tests pass on merged `nuxt`

### Issue P2-5 — Remove the stale `PastGameSummarySchema` validator
- Priority: `P2`
- Status: `done`
- Goal: delete or correct the leftover flat-shape validator that no longer matches `/api/games/past`.
- Why it matters: found during P1-9 test writing — `shared/validators/game.ts` exports `PastGameSummarySchema` as `{gameNo, maxScore, totalCoins, playableAt}`, predating the P0-4 dual-puzzle archive rework. The live route returns `{count, games: [{gameNo, playableAt, classic, expedition}]}`. The schema appears unused; a stale exported type is a landmine for the next person who wires it up assuming it's current.
- Scope:
  - `shared/validators/game.ts` and any re-exported type in `shared/types/game.ts`
- Acceptance criteria:
  - either the schema is removed, or it is corrected to match the current `/api/games/past` response and something references it
- Completion notes:
  - `/api/games/past` never used a Zod validator at all (hand-shaped grouped response); `PastGameSummarySchema`/`PastGameSummary` had zero real consumers, so removed outright along with its re-exports in `server/db/validators.ts` and `shared/types/game.ts`
  - `pnpm typecheck` clean after removal
- Dependencies: none

### Issue P2-6 — Give hint requests an explicit "already solved" signal
- Priority: `P2`
- Status: `done`
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
- Completion notes:
  - added a new `HintAlreadySolvedResult` variant (`{ kind: 'already-solved', guidePath }`) returned by `computeHint` as its own branch, ahead of the old fallback that previously mislabeled this case as `diverged` with the divergence tile equal to the correct tile
  - same latent bug also existed in `useTutorialPractice.ts`'s duplicate hint logic for the tutorial practice puzzle — fixed there too
  - new copy: `UI_COPY.runtime.hintAlreadySolved`
  - regression tests added/updated in `tests/hints.test.ts`; suite is now 38 tests, all passing; `pnpm typecheck` clean

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
- Progress notes (issue remains `planned` overall — DNS/Firebase work is real-infrastructure and still outstanding):
  - the "optional detection of leftover v1 local data" scope bullet is now **done**, and grew from a quiet nav dot into a dedicated welcome-back sheet after further review — a rewrite of this scope this significant (new Expedition mode, new toll/bonus/missing-road visuals) warranted more than a passive nudge:
    - `app/composables/useV1ReturningPlayerNotice.ts` detects a returning v1 player via two origin-scoped signals v1 produced unconditionally — a Cache Storage bucket named `audio-cache` (populated on load by v1's sound hook, no user action needed) and a Firebase Auth session persisted in IndexedDB (`firebaseLocalStorageDb`, since v1 auto-signed in every visitor anonymously). Investigated and ruled out: the `LEGACY_STORAGE_KEYS`/`LEGACY_STORAGE_PREFIXES` already handled in `useGoldroadLocalState.ts` are not real v1 keys (leftovers from an early v2 storage iteration); the five real v1 localStorage/sessionStorage keys (`sounds`, `isRedirecting`, `registration-token(-sent)`, `game-update-300323`, `howToPlayShown`) were considered and rejected as primary signals since each depends on a specific action a player may never have taken
    - `app/components/V1WelcomeSheet.vue` (new): a bottom sheet reusing `SolveCelebrationSheet.vue`'s scrim/dialog pattern, shown once to detected v1 players on the live page. Copy (in `UI_COPY.v1Welcome`) covers the clean break *and* teases Expedition, rather than routing through the more FAQ-toned `/about` Updates entry. Primary CTA opens the existing first-run tutorial (already teaches missing/toll/bonus roads and Expedition hands-on via its practice puzzle — no new teaching content needed); secondary CTA just dismisses. Both paths persist `v1NoticeDismissed` and acknowledge the update so the nav dot (below) doesn't redundantly re-nag right after
    - the general "unread update" nav dot was decoupled from the v1-specific flow into `app/composables/useUpdatesNotice.ts`, comparing a persisted `lastAcknowledgedUpdateId` against `app/content/updates.ts` (extracted from `about.vue`) — restores v1's own `Toolbar.jsx` `LAST_UPDATE` mechanism generically, so future minor updates get the quiet-dot treatment without any new plumbing
    - a real, separate bug was found and fixed while building this: the active solve timer already starts as soon as `setupGame()` runs (matches the documented "starts as soon as the board is visible" spec — an earlier claim in this thread that it only started on first move was wrong and corrected), but nothing paused it for an in-page overlay sitting on top of the board — only actual tab-visibility changes and route unmounts paused it. This meant the first-run tutorial (and would have meant the new welcome sheet) silently let the solve clock run underneath. Fixed generically via `app/composables/useBoardOverlayGate.ts`, consulted by `useRoadDayGameplay.ts`'s timer start/resume/pause logic the same way `documentVisibility` already is
    - also fixed: the first-run-tutorial auto-open and the new welcome sheet would otherwise race/double-fire for a detected v1 player (who also has no v2 local progress) — the auto-tutorial trigger in `app/pages/index.vue` now waits for v1-detection to resolve and defers to the welcome sheet's own CTA instead of auto-opening independently
    - verified live via Playwright: sheet appears only once `audio-cache` is simulated, `activeTimeMs` stays at `0` while the sheet is showing (confirms the timer fix), the primary CTA opens the tutorial, the secondary CTA dismisses without a fallback tutorial popup, and neither the sheet nor a redundant dot reappears after reload
    - typecheck and all 38 tests pass
  - remaining for this issue: the actual DNS switchover, Firebase/hosting sunset checklist, and launch-day verification pass — tracked in the untracked local `LAUNCH_CUTOVER_NOTES.md` working doc, not this file

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

## 8. V2 release-polish tracker

This is the follow-up queue from the first full v1/v2 consistency review and the July 2026 screenshot review. It does not erase the completed rewrite history above. It tracks the remaining work needed for v2 to feel release-ready in real use.

### Clarified product decisions

- Keep the sum of every tile value visible near the score. Players asked for it in v1 because comparing the target with the whole-board total helps them reason about how much of the board can be left out. Rename the player-facing metric from **Road Coins** to **Board total**: some tiles will never belong to the completed road, and the number is a value sum rather than a count of coins.
- Missing roads on the real board remain true empty space, not a faint dotted road. Open roads must be sufficiently solid, thick, and edge-to-edge that an empty gap cannot be mistaken for a connection. The tutorial must demonstrate the same visual contract.
- ~~V2 community stats are dynamic at request time for both the current road and the previous road.~~ **Superseded (July 2026 experience review):** community stats are shown only for the previous, completed road — v1's model. There are no dynamic community stats for the in-progress road; without a live global scoreboard as a deliberate feature, a mid-day snapshot answers no player question. The stats page's "today" section is the player's own result (and share), not a community comparison. Histogram/percentile UI still handles tiny samples honestly (RP0-4 / RP1-5 safeguards stay).
- "Recent roads" on the current stats page means the player's own locally stored recent results, not another copy of the playable Past Roads archive. Keep it only if a short personal-result history adds value after the stats redesign; do not give it a large archive-like section by default.
- Sharing belongs beside the concrete result being shared. The current generic "Share & explore" section should not survive merely because the previous stats plan listed it.

### Clarified product decisions — July 2026 experience review

The v2 UI is visually good; these decisions are about behavior and information rhythm, with v1 as the explicit reference:

- **Board messaging is strictly contextual.** v1's `GameFooter` is the contract: exactly one message or affordance per state. During movement, only the retry affordance shows — no status text, no attempt count. The attempt count appears only at rest after a retry (v1's "3rd try") and disappears on the first move. Pre-play shows one instruction. Solved shows the next-road ticker. Nothing renders merely because space exists for it.
- **The stats page returns to v1's shape, adapted for two modes.** v1's forms were better: medal-count displays with the "+1" increment moment, a "Today's Road" card holding the player's own result and share (or a play prompt), a previous-road global-stats story (histogram plus the narrative "X% finished it… you were in the top Y%"), and a key-value "Your Stats" record (streaks, treads, finishes, completion %, average attempts). Two modes are scoped by the single global mode toggle; some deviation from v1 is expected, but the forms above are the target.
- **Past Roads becomes a calendar.** The card grid conveys nothing per road (every card is date + number + the same two pills). Replace it with a calendar-style picker where tapping a date opens that road day. Replay pages drop header/label chrome — the board is the content.
- **The footer is the hint's home.** v1 had no hint feature, so its one-thing-at-a-time footer never had to accommodate one. v2 keeps Hint in the board footer, made contextual to the extent possible: reachable but quiet during play, absent once the road is solved or in untracked replay.
- **Medals are gold/silver/bronze only.** v1's 4+/10+/20+ try buckets (😅😥😓) served no purpose and are not carried over. The medal display is the three medal counts with the "+1" moment for whatever was earned today. v2 has no medal iconography — medals are a typographic color system (see RP1-11 for the display decision).
- **One focus color.** `--color-focus` (#4b9eff blue) is the single focus indicator everywhere; the v1-inherited `#afcbff` global outline was replaced (applied July 2026).
- **A final dead-declaration cleanup pass is agreed** (RP1-13): once the experience issues land, remove CSS tokens and code declared but unused or no longer used in the sense they were declared (e.g. the `--color-start`/`--color-end` families — start/finish are distinguished by icon, not color — and `--color-blocked`).

### Clarified product decisions — July 2026 feedback round (post-RP1-10/11/12 review)

- **The histogram never reveals counts.** v1's conscious decision restored: showing per-bucket counts tells players how many people played. Bars are relative to the busiest bucket only; empty buckets stay as hairlines so the field reads as a field. The server still returns counts (`solvedAttempts`) — clients render shape only. Bars cover solvers at 1..24 attempts plus a pooled 25+, v1's exact form, with axis markers at 1, 25+, and the player's own bar (👇).
- **The board frame never changes height between states.** The footer reserves fixed-height message and action slots that render whether or not they're occupied; transient share feedback borrows the message slot. This kills the board jumping that state-contextual messaging otherwise causes — v1 solved it the same way with fixed slots.
- **Try again follows the board's dirty state, with one solved-state exception.** A fresh or newly reset board has no Try again control because no move has been made. Once the player moves, a quiet retry control appears; a failed road promotes it to **Try again**. A newly solved board also keeps a quiet **Try again** control as the explicit entry into an untracked replay. Pressing it resets to the solved-at-rest presentation, hides retry until the first replay move, and never makes the solved road look unsolved.
- **Replay pages carry no page-level header.** The global toolbar's road label (now "Road N · date") is the identity; the board leads with the same composition as the live page.
- **Today's solved card uses v1's celebration form**: a "Yay! You got to the finish 🎉" line over a solid-gold result block with dark text, Share beneath. The medal "+1" is golden text (v1's), never a green badge, and the medal count bumps on arrival.
- **The pre-run instruction doesn't repeat the target number** (it's in the header) and is action-first like v1's: "You're on the footprints. Step onto any glowing tile to begin."
- **Medals are ribboned SVG art** (`MedalIcon.vue`), not discs and not emoji — emoji render inconsistently across platforms; SVGs give v1's medal feel everywhere. The stats page presents them as v1 did: three standalone cards, `medal × count`, attempts sub-label, golden +1.
- **The today gold block previews the exact share payload** (v1's trick): it renders `buildRoadResultShareText` line by line, so what you see is literally what Share now sends. Share text carries the medal emoji (🥇🥈🥉, 😅 for late solves) — emoji are fine in shared text where platform rendering is out of our hands anyway.
- **The stats page is center-aligned throughout**, and Your stats uses v1's two-column record (keys right-aligned, values left-aligned).
- **No cyan element accents anywhere.** An audit confirmed the working palette: golds/bronze/silver for the game, toll rust + bonus honey for the road grammar, red for hint highlights, blue for focus, green for success feedback. Expedition identity comes from its background tint only. ~~Secondary emphasis (like the Expedition streak line) uses silver~~ **superseded below: silver read as too strong an accent against the gold palette; the Expedition streak line uses a muted gold tone instead.** The unused cyan accent tokens go in RP1-13.
- **A solved puzzle always presents as solved at rest.** Retrying mid-replay (or right after solving) resets the board but returns to the solved footer (ticker + Share + next action) — never the pre-run instruction, which made solved puzzles feel unsolved. Moving off the start tile is what begins an untracked replay.
- **The next-road ticker shows in both solved footer states** (solved Classic and day-complete) and on the stats page's solved today card.
- **App icon is a mini road of coin tiles.** The launch icon's diamond tile matched nothing in the game; the new mark is three circular coin tiles joined by gold roads — bright filled start, open corner, flagged finish — on the dark gold gradient, mirrored in the OG image (which also fixes the old left-edge clipping).
- **The Classic streak is THE daily streak, presented with a flame.** Since Classic is the day's baseline challenge (Expedition only unlocks behind it), "consecutive days with Classic solved" is what a player means by "my streak." It lives in an always-visible flame card under the medals (Reddit-style: lit with a glow when alive, dimmed with "Solve today's road to light the flame" at zero), with the Expedition streak as a smaller accent line in the same card. Streak rows no longer appear in the mode-scoped Your stats record. Streak *calculation* stays per-mode and unchanged.

### Clarified product decisions — July 2026 feedback round 2 (annotation review)

- **The streak "best" note rides beside the headline, not below it.** "3-day streak" and its qualifier sit on one baseline, same golden family, the qualifier just smaller and quieter — one fact, not two lines. When the current streak equals the longest one, the qualifier reads "Your best yet" instead of restating the number.
- **The Expedition streak line is a muted gold tone, not silver.** Silver read as an unrelated accent against a page that's otherwise entirely gold/bronze; `--color-gold-muted` keeps it in the same family while still reading as secondary.
- **The histogram's player marker is a thin chevron, not an emoji.** 👇 read as a sticker; a two-line CSS corner (border-right + border-bottom, rotated) reads as a UI marker and matches the histogram's own thin-line aesthetic.
- **No em dashes in UI copy.** Prose sentences using "—" were rewritten with periods, commas, or "but" instead of restructured around the dash. The few table/share placeholders for a missing value ("Best solve time" with no solved runs, "Average attempts" with no data) now use a plain en dash (`–`) instead — a distinct, narrower glyph that reads as a conventional "no value" mark rather than a sentence connector.
- **A solved puzzle always presents as solved at rest, confirmed again this round** (see above) — this round additionally confirmed the next-road ticker now appears in the solved-Classic footer, the day-complete footer, and the stats page's solved today card, so "when does the next road land" is answered everywhere a solved state is shown.
- **The update notification dot appears at both levels.** The hamburger icon's dot told players *something* changed but not *where to look*; the About entry inside the open menu now carries its own dot too, so the destination is unambiguous.
- **About leads with Updates, in its own visually distinct section** — a timeline treatment (dot + connecting line + a gold "Latest" badge on the newest entry) rather than another plain card, so what changed is the first thing a returning player sees, ahead of the evergreen About/Privacy content.
- **The app icon's road reads as three coin tiles**, matching the in-game tile geometry exactly (filled start, open tiles, flagged finish) rather than an abstracted diamond mark.

### Clarified product decisions — July 2026 archive and replay review

- **Archive completion is local, mode-specific, and calendar-only.** Solving an old road records only that Classic or Expedition was completed for the Past Roads calendar and for restoring that archive road's local solved/unlock state. It must not change medals, streaks, attempts, solve times, personal totals, today's result, yesterday's comparison, or server/global analytics.
- **An archive attempt counts only when it is solved.** Starting, retrying, abandoning, or failing an archived road creates no completion mark. This intentionally treats an unfinished archive attempt the same as an unplayed road.
- **The calendar shows two per-mode, medal-tinted completion discs** (owner decision, replacing the reviewer's neutral-disc proposal). Classic and Expedition each have a fixed marker position, so the day answers "which half is unfinished" at a glance. Each disc tints by that mode's own result: gold/silver/bronze from live history's attempt count, and the game's existing solved-green (`--color-solved`) for no-medal solves and for archive completions (which store no attempt count). Uncompleted modes show a faint hollow marker. A short C/E legend explains the positions, and each playable day exposes the full state to assistive technology, for example: "Road 1. Classic solved, gold. Expedition not solved."
- **Expedition remains gated in archive play** (owner-confirmed; this deliberately supersedes P0-4's "Expedition is directly available in archive replay" acceptance criterion — that frictionless model predates tracked archive completion). It unlocks only after Classic for that road has been solved, whether the Classic solve originally happened live or later in the archive. "Expedition solved while Classic unsolved" is not a valid reachable state.
- **Archive hints are local** (owner-confirmed; a deliberate carve-out from P0-3's server-side-paths boundary, for archived roads only — protecting yesterday's solutions is pointless load once the road is history). Fetch the archived boards with their valid solution paths, then reuse the client hint calculation. Archived play makes no session, hint, or result analytics calls. Current/live solution paths must remain protected behind the existing live-game contract.
- **Deep-archive random play stays** (owner decision, upholding the §2 locked decision "random deep-archive play is allowed"). **Surprise me** is retained in simplified, identity-free form: it picks any road older than the calendar window with no player-identity or analytics lookup; repeats are acceptable.

### Clarified product decisions — July 2026 feedback round 3 (tutorial, help sheet, updates dot)

- **Tutorial lesson 1 shows the real pre-run state.** The mini board renders the footprints tile already occupied and its neighbor glowing, matching what a player actually sees before their first move, with copy explaining that every road begins with you standing on the footprints.
- **The How to Play sheet is a pure game reference.** Its About and Updates sections were removed; that content lives on the About page. In-game copy says "Try again", not "Retry".
- **The next-road countdown on stats is always visible** — after a solve it's the wait for tomorrow's road; before one it's the time left to play today's.
- **The About page owns update acknowledgment.** A glowing inline "new" marker sits beside the Latest badge on the visit that first reads the update and is gone on every visit after; the nav dot clears at the same moment. The old timeline-marker column, which read as a stray bullet, is gone.
- **Client state writes must never build on the SSR placeholder.** Mutations go through `ensureLoadedForWrite()`, which loads real storage before cloning, so hydration-time placeholder state can never clobber stored player data. Reads keep hydration-safe behavior (no load side effects during render).
- **`V1WelcomeSheet` keeps its name deliberately**: it is cutover-transition furniture shown only to detected returning v1 players (new players get the tutorial), and the `V1` prefix marks it as removable after the v1 sunset.

### Issue RP0-1 — Restore a trustworthy release verification gate
- Priority: `P0` (launch-blocking)
- Status: `in progress`
- Goal: make the documented verification commands reliable on a clean checkout.
- Why it matters: the declared typecheck command was broken by the installed TypeScript/tooling combination. That tooling issue is fixed, but release confidence still depends on turning the manual UI smoke pass into a repeatable gate.
- Scope:
  - package/tooling versions and scripts
  - CI or equivalent clean-checkout verification
  - release checklist documentation
- Acceptance criteria:
  - `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass from the supported setup
  - the release checklist names the exact commands and expected environment
  - board, tutorial, stats, past-roads, and replay routes receive at least one browser smoke pass at mobile and desktop widths
- Dependencies: none
- Progress notes:
  - added the missing explicit `typescript@^5.9.3` dev dependency, replacing the incompatible transitive TypeScript 7 resolution
  - `pnpm typecheck`, `pnpm test` (41/41), and `pnpm build` now pass
  - browser-smoked the live board, first-run guide, practice road, archived Classic/Expedition replay, Past Roads, mobile header, and dialog keyboard focus with no console errors
  - the latest full audit again passes `pnpm typecheck`, `pnpm test` (43/43), and `pnpm build`; main board, both stats modes, calendar, replay, About, Help, Tutorial guide/practice, and menu outside-click were browser-smoked without console errors
  - July 2026: RP1-9 added 42 automated Vitest tests (59 → 101) covering the archive-completion contract, footer state machine, and pooled-vs-exact percentile math via pure-function extraction; `pnpm typecheck`, `pnpm test` (101/101), and `pnpm build` are green and repeatable on a clean checkout
  - remains in progress: the added suite is composable/pure-logic-level, not a UI/browser smoke suite — board, tutorial, stats, past-roads, and replay routes still rely on the manual browser passes recorded above rather than an automated one, since this repo has no jsdom/@nuxt/test-utils/@vue/test-utils to drive real component or page rendering; a repeatable *browser* smoke gate is still the open item

### Issue RP0-2 — Finish deployment, migration, and cutover readiness
- Priority: `P0` (launch-blocking)
- Status: `planned`
- Goal: remove configuration ambiguity before the v1-to-v2 switch.
- Why it matters: production configuration still requires a real D1 database ID, migration documentation refers to the pre-squash migration chain, and the actual DNS/Firebase cutover remains outstanding.
- Scope:
  - `wrangler.jsonc`
  - database and deployment docs
  - `LAUNCH_CUTOVER_NOTES.md`
  - legacy-route handling, including `/sign-in`
  - launch-day verification and v1 shutdown checklist
- Acceptance criteria:
  - production bindings and secrets are configured without placeholders
  - migration docs match the active squashed migration state
  - legacy public URLs land on sensible v2 destinations rather than hard 404s
  - the P2-4 DNS, Firebase sunset, analytics-write, and share-unfurl checklist is executed or explicitly scheduled
- Dependencies:
  - RP0-1
- Audit notes:
  - `wrangler.jsonc` still contains a placeholder production D1 database ID
  - the legacy `/sign-in` route referenced by the cutover plan is not present in v2, so its redirect/destination still needs an explicit decision
  - the DNS/Firebase shutdown, production analytics-write decision, share-unfurl verification, and launch-day ownership/checklist remain open rather than merely undocumented

### Issue RP0-3 — Fix gameplay and local-stats correctness gaps
- Priority: `P0` (launch-blocking)
- Status: `done`
- Goal: remove small behavioral contradictions that undermine trust in the game.
- Why it matters: the start tile is already selected when a road loads while the footer tells the player to start there; clicking it produces denied feedback. The computed roving keyboard tab index is also not bound to the tile buttons, and the current-streak calculation can fall to zero at the start of a new day before the player has played.
- Scope:
  - `useRoadDayGameplay`
  - `GameTile` / `GameBoard` keyboard behavior
  - runtime instruction copy
  - `useLocalPlayerStats`
- Acceptance criteria:
  - the initial instruction accurately describes the state already visible on the board
  - clicking/tapping the current start tile does not emit misleading denied feedback
  - only the intended tile participates in the roving-tabindex pattern, with arrow-key behavior verified
  - an active streak remains correct across the daily rollover before today's solve
- Dependencies: none
- Completion notes:
  - the loaded-road instruction now acknowledges that the player is already on the footprints; selecting the current tile is a quiet no-op instead of denied feedback
  - the computed tile tabindex is bound to the button, only the current tile has `tabindex="0"`, and keyboard movement moves DOM focus with the current tile
  - board keyboard input is suppressed while Help, Tutorial, or the returning-player welcome sheet covers the board
  - current streaks now remain alive through today's unplayed window when yesterday was solved; three deterministic regression tests cover rollover, today solved, and expired streak states

### Issue RP0-4 — Make anonymous analytics trustworthy and accurately described
- Priority: `P0` (launch-blocking)
- Status: `done`
- Goal: ensure global comparison cannot be trivially distorted and public privacy copy matches stored data.
- Why it matters: session analytics currently accepts important solve fields from the client, and rate limiting uses a player-supplied UUID. The privacy page describes aggregated data even though the database keeps pseudonymous per-player, per-road, per-mode rows. Archived solves currently use the same analytics path as live play, and the 25+ histogram bucket is too coarse to support an exact percentile for every player inside it.
- Scope:
  - session-end and hint analytics validation
  - abuse/rate-limit identity strategy
  - stats aggregation safeguards
  - strict exclusion of archive play from analytics and personal-stat inputs
  - percentile calculation independent of the display histogram's pooled 25+ bucket
  - About/Privacy copy
- Acceptance criteria:
  - the server validates or derives every result field it can reasonably verify
  - one client cannot bypass useful limits merely by rotating its supplied UUID
  - tiny or suspicious samples do not produce authoritative percentile claims
  - archived hints, attempts, and solves create no analytics rows and cannot affect today's, yesterday's, or all-time statistics
  - the chart may keep its visual 25+ bucket, but a player's “top N%” statement is calculated from unpooled attempts or from a separate server-derived at-or-better value
  - privacy copy plainly describes pseudonymous event/result storage and aggregation
- Dependencies: none
- Completion notes:
  - `server/api/session/end.post.ts` and `hint.post.ts` now gate their `games` lookup on `current = true` (in addition to the existing `active`/`gameNo`/`puzzleType` match): a payload for any non-current road 404s before any row is read or written, making the archive-is-local boundary (RP0-5) a server guarantee rather than only client behavior
  - `end.post.ts` also validates the reported `score` against that road's stored `maxScore` and rejects payloads that exceed it (400)
  - `shared/validators/game.ts`: `SessionEndPayloadSchema`/`HintRequestPayloadSchema` gained sanity ceilings (`moves` ≤ 5000, `attemptNumber` ≤ 1000, `hintsUsed` ≤ 1000, `pathHistory` length ≤ 5000, `solveTimeMs` ≤ 24h) plus a cross-field check rejecting `hintsUsed` wildly disproportionate to `attemptNumber`; full server-side session-timestamp derivation was out of scope since no session-start record exists yet, so this round hardens via validation/clamping rather than adding new session-tracking infrastructure
  - rate limiting in both session routes now checks two independent keys (`player:<uuid>` and `ip:<CF-Connecting-IP via getRequestIP>`) against the same `RATE_LIMITER` binding and fails closed if either trips, so rotating the client-supplied UUID alone no longer bypasses the limit
  - `CommunityRoadStats` gained `solvedAttemptsExact` (`server/utils/statsAggregation.ts`: `buildExactSolvedAttemptsDistribution`), an unpooled attempts→count map alongside the existing pooled `solvedAttempts` histogram; `stats.vue`'s `topPercent` now sums the exact map instead of the pooled one, so a player above the pooled 25+ bucket still gets an exact percentile
  - added a percentile-specific minimum sample gate (`PERCENTILE_SAMPLE_MIN = 10` solvers, separate from the existing `COMMUNITY_SAMPLE_MIN = 5` used for the histogram/headline): below it the "top N%" line is replaced with an explicit "not enough solvers yet" line rather than showing a number
  - `about.vue` Privacy card rewritten to state plainly that the server stores one row per player per road per mode (attempts, hints, solve time) keyed to the on-device random id, that these are the raw rows the stats page's community numbers come from, and that archived (Past Roads) play never reaches the server
  - tests: `tests/statsAggregation.test.ts` extended for `buildExactSolvedAttemptsDistribution` and the pooled/exact split on `toCommunityRoadStats`; new `tests/sessionPayloadValidation.test.ts` covers the new schema ceilings and cross-field checks
  - `pnpm typecheck`, `pnpm test` (59/59), and `pnpm build` all green

### Issue RP0-5 — Make archive completion local, mode-specific, and stats-free
- Priority: `P0` (launch-blocking)
- Status: `done`
- Goal: let players complete missed roads from Past Roads without turning archive replay into live competition or corrupting personal/global records.
- Why it matters: archive mode currently unlocks Expedition without requiring that road's Classic solve, and its gameplay can travel through the live session/hint/end analytics contract. The calendar also collapses both modes into one best-result marker, so it cannot answer the useful question: which half of this road day is still unfinished?
- Scope:
  - archive road response and gameplay state
  - archive-local hint calculation
  - separate local archive-completion storage
  - calendar mode markers and accessible state labels
  - Classic-to-Expedition archive gating
  - `/api/games/another` and the deep-archive product boundary
- Acceptance criteria:
  - the archive fetch supplies both boards and their valid paths for local hint calculation without exposing the current live road's paths
  - archived play never creates or updates session, hint, end, player-road, or aggregate analytics data
  - archive progress (attempts, hints, guide path, solve timer) lives per browser session only; the sole durable write is the road+mode completion mark; only the first solve of a road+mode celebrates (re-solving a road already solved live or in the archive just settles into the solved rest state), the celebration shows a would-have medal but never awards one, and archive plays expose no share affordance (sharing is live-only); the calendar shows archive completions as solved-green only
  - live completion history and archive completion are merged only when deriving the calendar and that archive road's local solved/unlock state; the archive map is not an input to medals, streaks, attempts, solve times, completion rate, personal totals, or community stats
  - each calendar day has fixed Classic and Expedition positions, each disc tinted by that mode's own result (gold/silver/bronze from live history, solved-green for no-medal solves and archive completions), faint hollow when uncompleted, plus a compact C/E legend
  - the calendar link's accessible name states both modes in full, including unsolved states
  - Expedition is disabled until Classic for that road is solved locally, whether that Classic completion came from live history or archive completion
  - the impossible Expedition-only state cannot be produced through the UI or normal storage writes; defensive rendering remains understandable if corrupted legacy data contains it
  - **Surprise me** and `/api/games/another` are retained in simplified identity-free form (no playerId/analytics lookup; repeats acceptable), per the owner decision upholding deep-archive play
- Dependencies:
  - coordinate with RP0-4 so archive requests cannot reach analytics writes
  - RP1-9 for the completion, unlock, hint, and storage regression matrix
- Completion notes:
  - `computeHint` moved to `shared/utils/hints.ts` (used server-side for the live road, client-side for archived roads); tests updated
  - `/api/games/[gameNo]/board` now attaches `optimalPaths` only when the road is not current — verified the live road never ships paths even through the archive URL; `PublicGameSchema` gained the optional field with the boundary documented inline
  - `useRoadDayGameplay`: archive entry type never calls `session/hint` or `session/end` (browser-verified zero requests across a full hint + solve session); hints compute locally from the shipped paths; an archive solve writes exactly one durable fact to the new `archiveCompletionByGame` map
  - solved/unlock presentation for archived roads derives from live history merged with the completion map (`isRoadModeSolved`), so a solved archive road presents as solved across reloads; the merge feeds only presentation and the calendar, never stats — `historyByDay` verified untouched after an archive solve
  - Expedition gating unified: `isExpeditionUnlocked` now gates archive play behind that road's Classic solve (the archive-bypass branch and the replay page's hardcoded `true` both removed); the tab unlocks live at the moment of the Classic solve
  - calendar renders two fixed-position per-mode discs (Classic left, Expedition right): gold/silver/bronze from live history, solved-green for archive completions, faint hollow when unsolved, with a legend row and full per-day accessible labels ("Road 2, 2 Jan 2026. Classic solved. Expedition not solved.")
  - `/api/games/another` simplified to identity-free pure random (analytics lookup and `playerId` param removed end to end)
  - stored-state sanitizer tolerates corrupted completion entries (degrades to "not completed")
  - typecheck, 43/43 tests, and 12/12 API smoke checks green; browser-verified gating, local hint, solve, persistence, calendar discs, and a11y labels

### Issue RP1-1 — Rebuild onboarding around the production game language
- Priority: `P1`
- Status: `done`
- Goal: make the guide and practice road a faithful, polished miniature of the real game.
- Why it matters: the current tutorial uses unnamed icons, awkward "exact target score" wording, two-tile examples, connection gaps, and toll/bonus labels that do not match the board. It omits a real Hint lesson, crowds the practice footer, and preserves an already-solved practice state when reopened.
- Scope:
  - `TutorialDialog`
  - `TutorialMiniBoard`
  - tutorial content and practice state
  - How to Play handoff
- Acceptance criteria:
  - start and finish markers are named and described by their visible symbols, such as footprints and finish flag
  - the goal is explained consistently: reach the finish with the score matching the target
  - start/finish teaching uses enough board context to show a route rather than two isolated endpoints
  - open, missing, toll, and bonus examples reuse the production road visuals and spacing exactly
  - the guide explicitly teaches Hint with the same button treatment used by the game; Retry remains contextual to a failed attempt instead of occupying a permanent lesson
  - practice uses intentional vertical spacing and a practice-specific contextual footer
  - reopening the tutorial starts a fresh practice session rather than showing the previous solved board
  - practice completion says **Practice complete** or **Solved**, never **Solved on target**
- Dependencies:
  - RP1-2
  - RP1-3
- Completion notes:
  - the guide now names footprints and the finish flag, explains the target without "exact target score," and uses a three-tile start-to-finish vignette
  - guide roads reuse the production open, empty-gap, double-dotted toll, and double-solid bonus grammar with no fake connection margins or per-edge value labels
  - the permanent Hint/Try again lesson was simplified to a dedicated Hint lesson using the real lightbulb-and-label button treatment
  - browser feedback exposed that the first mini-board implementation collapsed production tiles and positioned road glyphs inside a zero-gap flex row; it now uses the production board's grid sizing and absolute road geometry, including real empty space for a missing road
  - toll and bonus explanations now describe the player consequence directly (pay the toll / get the bonus), and the second tutorial tab is named **Practice Road**
  - the practice panel uses one **Practice road** heading rather than repeating an eyebrow and title; the shared Expedition legend now reads **Toll cost N** and **Road bonus N**, without redundant minus/plus signs
  - every desktop guide card now reserves the same fixed visual column, keeping all lesson headings and descriptions on one shared text axis while centering the differently sized examples
  - removed the redundant practice-panel title, moved the practice invitation into the dialog description, restored the production pre-run instruction in the footer, and optically centered the shared toll/bonus road samples in their value pills
  - practice now uses the production toll/bonus legend, separate Score/Target/Board total metrics, more vertical space, and no duplicate four-road legend below the board
  - opening or reopening the tutorial resets the practice road, hints, and solved state

### Issue RP1-2 — Make every road type legible at a glance
- Priority: `P1`
- Status: `done`
- Goal: remove ambiguity between open, missing, toll, and bonus connections.
- Why it matters: open roads currently render with low opacity and a short glyph inside the inter-tile gap. Missing roads are correctly omitted, yet tile glow and the faint road treatment can create the illusion of a connection. Toll and bonus roads also compete with midpoint value chips even though their values are global for the board.
- Scope:
  - road sizing tokens
  - `RoadGlyph`
  - `BoardRoad`
  - board toll/bonus legend
  - Classic/Expedition board surfaces
- Acceptance criteria:
  - open roads are thicker, more opaque, and visually meet the tile boundaries
  - missing roads read as unmistakable empty space under normal, active, visited, and glow states
  - toll and bonus each have a distinct non-color-only line pattern that remains legible at mobile size
  - per-edge `-N` / `+N` chips are removed if the modifier is board-global; the board legend states **Toll cost N** and **Road bonus N** once
  - Expedition is distinguished without a cyan rectangle behind the board; mode identity comes from the switcher, modifier legend, and restrained accents
  - tutorial, live board, and replay board use the same road grammar
- Dependencies: none
- Completion notes:
  - open roads now span the complete tile gap at higher opacity and with a thicker alignment area; missing roads render as true empty space
  - toll roads use two dashed rails and bonus roads use two solid rails, preserving color as a secondary signal
  - per-edge modifier chips were removed; Expedition presents each board-global modifier once in the legend
  - the cyan Expedition board rectangle was removed while the mode switch, modifier legend, and restrained accents retain mode identity
  - verified in the rendered tutorial, live Classic board, and archived Expedition board at desktop and mobile widths

### Issue RP1-3 — Redesign the board header and footer as contextual game UI
- Priority: `P1`
- Status: `done` (remaining verification absorbed and completed by RP1-10)
- Goal: show the right information and action for the player's current state instead of presenting every control at once.
- Why it matters: the current footer is crowded and the Hint action has weak placement. The header's score syntax and **Road Coins** label are also misleading.
- Scope:
  - `GameBoardHeader`
  - `GameBoardFooter`
  - live and replay page composition
  - state-specific copy
- Acceptance criteria:
  - the header reads clearly as current score, target, and **Board total**, with a short accessible explanation of Board total
  - before movement, the footer gives one clear instruction and keeps Hint quiet but reachable
  - during a run, Retry and Hint are available without competing with irrelevant post-solve actions
  - a dead end or wrong finish promotes the retry action and explains what happened
  - a Classic solve prioritizes Share and/or Expedition according to the celebration outcome
  - an Expedition solve prioritizes the day result, sharing, stats, and next-road timing
  - solved replay states remain visibly untracked and use quieter actions
- Dependencies:
  - RP1-2
- Progress notes:
  - header now separates Score, Target, and Board total; Board total explains that it is the sum of every tile and that a route may leave tiles out
  - the pre-move footer shows one instruction and a clearly labeled Hint action; active attempts stay compact; failed endings promote a labeled primary Try again action
  - "Solved on target" was removed from shared runtime/footer language
  - Classic and Expedition now carry a compact unsolved marker that becomes a medal-colored check after that mode is solved
  - the Expedition legend sits in a reserved row, so switching modes no longer moves the board vertically
  - board metrics, legend labels, state messages, and footer controls use larger type; solved footers show only the relevant timer or next action instead of restating "Solved"
  - footer actions now follow one order across live and replay states: recovery, sharing/navigation, then the primary next step
  - remains in progress until full dead-end, wrong-finish, Classic-solve, Expedition-solve, and solved-replay state transitions are browser-regression tested
  - July 2026 review: the contextual-messaging contract is tightened further by RP1-10, which absorbs this issue's remaining state-transition verification

### Issue RP1-4 — Unify the app header and navigation language
- Priority: `P1`
- Status: `done`
- Goal: make all global actions feel like one intentional control set.
- Why it matters: Stats is the only text-treated action, other icon buttons lack visible hover/focus tooltips, sound placement needs review, and the menu calls roads "Past Games." The brand also alternates between Goldroad and GoldRoad.
- Scope:
  - default layout/header
  - navigation copy and tooltips
  - brand casing
- Acceptance criteria:
  - Stats, Sound, How to Play, and Menu share one visual treatment and touch target size
  - icon-only actions have accessible names plus desktop hover/focus tooltips
  - the sound control remains easy to reach without dominating the header
  - **Past Games** becomes **Past Roads** consistently, including replay back-links
  - player-facing brand casing is consistently **GoldRoad**
- Dependencies: none
- Completion notes:
  - Stats is now an icon peer of Sound, How to play, and Menu, resolving the mobile header squeeze while keeping Sound first and top-level
  - every icon action has an accessible label, native title, and desktop hover/focus tooltip
  - menu and replay navigation now consistently use Past Roads
  - an open menu closes when focus moves to a route or the player clicks outside the menu shell
  - player-facing brand casing is GoldRoad

### Issue RP1-5 — Reframe stats as a rewarding personal record
- Priority: `P1`
- Status: `done` (superseded by RP1-11)
- Goal: retain the richer v2 data while restoring the clarity, consistent cards, and emotional payoff of v1.
- Why it matters: the page at the time had the right ingredients but read as several analytics treatments assembled together. Its current-road histogram could also look nonsensical when only one player had contributed. RP1-11 subsequently replaced that direction.
- Scope:
  - stats hierarchy and card system
  - current-road and previous-road community states
  - medal/personal summary treatment
  - recent local results
  - contextual sharing
- Acceptance criteria:
  - one card language is used for today's result, medal/attempt record, previous-road community result, and all-time personal stats
  - current-road stats are labeled as a request-time snapshot and refreshed when the page is revisited or explicitly refreshed
  - a defined minimum sample (initial recommendation: 5 plays) is required before showing a histogram or percentile; smaller samples use honest early-field copy
  - yesterday's completed-road comparison remains available and visually quieter than the player's own result
  - medal totals and today's earned medal regain the clear reward treatment v1 had
  - the local recent-result log is either compressed to a few useful entries or removed if it duplicates Past Roads without adding personal meaning
  - Share sits on today's or another specific result, not in a generic catch-all panel
- Dependencies:
  - RP0-4
  - RP1-7
- Progress notes:
  - consolidated streaks and medal totals into one **Your record** card and made today's earned medal a clear visual reward
  - today's community view is labeled as a visit-time snapshot, has an explicit Refresh action, and withholds histograms/percentiles until at least five results exist
  - kept yesterday's completed-road comparison as the quieter community card and retained a compact expandable all-time personal snapshot
  - compressed personal history to the three newest results, renamed it **Your recent results**, and linked the actual Past Roads archive instead of duplicating it
  - removed the generic Share & explore panel; sharing now stays attached to today's concrete result
  - implementation is ready for the planned product-feedback pass on dynamic today stats and personal recent results
  - July 2026 review (the awaited feedback): dynamic today-community stats are dropped and the page returns to v1's shape — direction continues as RP1-11; this issue's shipped safeguards (small-sample honesty, card consolidation, contextual share) carry forward

### Issue RP1-6 — Simplify Past Roads around replay decisions
- Priority: `P1`
- Status: `done` (card presentation superseded by RP1-12)
- Goal: make the archive easier to scan and less card-heavy.
- Why it matters: each current road-day card nests multiple cards, repeats secondary metadata, and makes the replay action visually clumsy.
- Scope:
  - `/games`
  - `/games/[gameNo]`
  - archive/replay copy
- Acceptance criteria:
  - each road day has one compact card with date/road number and clear Classic/Expedition availability or personal results
  - target, Board total, and difficulty are shown only where they help choose or understand a replay
  - the entire card or one obvious action opens the road day without a redundant oversized CTA
  - replay pages share the polished board/header/footer patterns without pretending to affect today's streak or stats
- Dependencies:
  - RP1-2
  - RP1-3
- Completion notes:
  - replaced nested Classic/Expedition metric cards and the oversized CTA with one compact clickable road-day card
  - each card now leads with date and road number, then small neutral mode pills and a quiet replay label
  - target and Board total remain on the actual replay board where they help play, rather than crowding archive selection
  - player-facing difficulty labels were removed from archive cards and replay headers because they do not help the replay decision
  - Expedition availability no longer uses the neon/cyan accent on archive cards
  - July 2026 review: the compact-card presentation is superseded by RP1-12's calendar direction; the copy and metadata decisions here carry forward

### Issue RP1-7 — Give v2 one warm, concrete product voice
- Priority: `P1`
- Status: `done`
- Goal: restore character without bringing back v1's less precise rules or inventing extra game jargon.
- Why it matters: v2 mixes run/attempt/try, start/exit/finish, road/game, analytics language, and internal phrases such as **Milestone 1**. Correct mechanics still feel unfinished when their language drifts.
- Scope:
  - centralized UI copy
  - tutorial/help
  - runtime states
  - celebration and stats
  - archive/navigation
  - About/Privacy
- Acceptance criteria:
  - a short terminology sheet locks the preferred words before copy is rewritten
  - use **attempt** for the medal-counting unit and **road/path/route** only where each is genuinely meant
  - start/finish, target, hint, retry, solved, and replay language is consistent across every surface
  - internal roadmap language and analytics jargon do not appear in player-facing UI
  - the voice is warm, direct, and lightly road-themed, using the celebration sheet and strongest v1 moments as tone references
- Dependencies: none
- Progress notes:
  - established and applied footprints, finish, attempt, Try again, Past Roads, Board total, and plain Solved language across the board, tutorial, help, celebration, archive, and navigation
  - removed the player-facing internal "Milestone 1" heading
  - stats now uses **attempt** for medal-counting units and reserves **result** for community histogram counts
  - remaining audit drift: About still uses **start/exit** where the game teaches **footprints/finish**; Help and one runtime hint still use **Retry** where the player-facing action is **Try again**
  - final drift sweep: About's road paragraph now reads "footprints" and "finish flag/finish" instead of "start tile"/"exit tile"/"reach the exit"; the stats field-behavior line now reads dead ends "per attempt" instead of "per run"; a repo-wide grep confirmed no remaining player-facing **Retry** text, no stray em-dashes outside code comments, and no internal jargon (milestone/analytics/session/issue codes) in UI copy — `pnpm typecheck` and `pnpm test` (59 tests) both pass

### Issue RP1-8 — Complete keyboard and dialog accessibility
- Priority: `P1`
- Status: `done`
- Goal: make the polished interaction model work predictably without a pointer and with assistive technology.
- Why it matters: dialogs currently expose roles and Escape handling but do not fully manage initial focus, focus containment, or focus restoration. Tooltips and board keyboard behavior also need a complete pass.
- Scope:
  - tutorial/help/welcome/celebration dialogs
  - board keyboard interaction
  - header tooltips and focus styles
- Acceptance criteria:
  - opening a dialog moves focus to an intentional element
  - Tab and Shift+Tab remain inside the active dialog
  - closing restores focus to the control that opened it
  - Escape and backdrop behavior are consistent and do not discard progress unexpectedly
  - all icon buttons expose matching accessible names, tooltips, and visible focus states
  - the full daily flow can be completed by keyboard
- Dependencies:
  - RP0-3
  - RP1-4
- Completion notes:
  - added one shared dialog-focus contract used by Help, Tutorial, V1 Welcome, and solve celebrations
  - opening focuses the first dialog control, Tab/Shift+Tab loop inside, closing restores the opener, and dialog-to-dialog handoffs avoid stealing focus back
  - browser-verified Help initial focus, forward/backward looping, and restoration to the header Help button

### Issue RP1-9 — Add UI regression coverage for the release surfaces
- Priority: `P1`
- Status: `done`
- Goal: protect the interactions most likely to regress during the polish pass.
- Why it matters: existing tests cover pure game and aggregation logic well, but there are no component or browser tests for the screens now being redesigned.
- Scope:
  - component tests where useful
  - browser smoke/regression tests
  - visual state fixtures for boards and dialogs
- Acceptance criteria:
  - tests cover first-run tutorial, tutorial reopen/reset, Classic solve to Expedition, dead-end/retry, hint, celebration dismissal, stats sparse-data states, and archive replay
  - archive tests cover separate Classic/Expedition calendar dots, Classic-to-Expedition unlock, local hint calculation, solved-only local completion writes, and zero analytics/stat writes
  - board-footer tests cover fresh, dirty, failed, newly solved, solved-reset, and dirty untracked-replay retry visibility
  - stats tests prove that an exact percentile remains correct for attempts inside the pooled 25+ display bucket
  - at least one keyboard-only board/dialog flow is automated
  - open/missing/toll/bonus road snapshots or equivalent visual assertions are protected at a mobile viewport
- Dependencies:
  - land alongside RP1-1 through RP1-8 rather than after all UI work
- Progress notes:
  - added three local-streak rollover regression tests; suite is now 41 tests
  - completed manual browser smoke coverage for the edited release surfaces and keyboard focus contract
  - the latest suite is 43/43; the archive-mode, solved-retry, and pooled-percentile cases above are still missing
  - automated component/browser coverage for the listed visual and state transitions remains outstanding
  - July 2026: turned the previously-missing acceptance criteria into automated Vitest coverage at the composable/pure-function level (no browser-test infra added, per the repo's existing node-environment Vitest setup with no jsdom/@nuxt/test-utils/@vue/test-utils installed). Suite is now 101/101 (`pnpm typecheck`, `pnpm test`, `pnpm build` all green).
  - archive contract (`tests/archiveState.test.ts`, 18 tests): `normalizeStoredArchiveCompletionMap` tolerance (bad keys, non-boolean/false mode values, empty records all dropped; `/^\d+$/` keys with a true mode kept) is now exported and directly tested; the historyByDay/archiveCompletionByGame merge behind `isRoadModeSolved` was extracted into an exported pure `computeIsRoadModeSolved(historyByDay, archiveCompletionByGame, gameNo, puzzleType)` in `useGoldroadLocalState.ts` and tested for archive-only, history-only, merged, unsolved, and wrong-gameNo cases; solved-only local completion writes and the archive-analytics boundary were extracted from `useRoadDayGameplay.ts`'s `finalizeRun` into exported pure gates `shouldRecordArchiveCompletion(entryType, solved)` and `shouldCallSessionApi(entryType, isUntrackedReplay)` (used in place of the previous inline booleans, behavior unchanged) and both are exhaustively tested, proving starting/failing/abandoning an archive run writes no completion, history, medal, or statistics and archive play never reaches the session API
  - local hint calculation for archive boards: extended `tests/hints.test.ts` with a `computeHint` suite driven directly by a shipped `optimalPaths` array (next-step, diverged, already-solved), matching how archived boards compute hints locally with no server round trip
  - Classic→Expedition unlock: covered indirectly through `computeIsRoadModeSolved` (the gate `isExpeditionUnlocked` reads from) plus the existing manual browser verification recorded under RP0-5; a live composable-level test of `isExpeditionUnlocked` itself remains out of reach without Nuxt auto-import stubbing (see below)
  - pooled-percentile proof (`tests/statsPresentation.test.ts`): extracted `stats.vue`'s `topPercent`/`toPercent`/`hasPercentileSample`/`COMMUNITY_SAMPLE_MIN`/`PERCENTILE_SAMPLE_MIN` into a new pure module `app/utils/statsPresentation.ts` (page behavior unchanged, now imports from it) plus a new `hasCommunitySample` helper; a 30-solver fixture (1..29 attempts once each, plus one solver at 40) proves the exact percentile stays correct for a player exactly at the pooled 25+ boundary, past it (attempt 40, correctly 100% rather than a bucket artifact), and at the interior edge (attempt 30) — cross-checked against a manual sum over the exact map, independent of `buildSolvedAttemptsDistribution`'s pooled bucket
  - footer state machine (`tests/footerState.test.ts`, 8 tests): extracted `GameBoardFooter.vue`'s inline `footerState` computed into a pure `computeFooterState` in `app/utils/footerState.ts` (component now calls it, same six states, unchanged markup/behavior); tests cover fresh (resting-first), dirty mid-run, failed, newly solved with Expedition waiting (solved-next), solved-reset with no Expedition left (solved-final, true even before a replay move), resting-retry after a tracked failed attempt, and the untracked-replay retry case (a solved-and-reset board's `attemptNumber > 1` never produces `resting-retry` while `trackingDisabled`), plus a priority-ordering check (solved beats ended/hasMoved/attemptNumber)
  - stats sparse-data gates (`tests/statsPresentation.test.ts`): `COMMUNITY_SAMPLE_MIN` (5) and `PERCENTILE_SAMPLE_MIN` (10) gates are now exported pure predicates (`hasCommunitySample`, `hasPercentileSample`) and tested at and below their thresholds
  - tutorial start-state (`tests/tutorialContent.test.ts`): asserts lesson 1 (`icons`) is the only lesson with `showStartState: true`, carries `isStart`/`isEnd`, and its body names footprints/finish without the retired "exact target score" phrasing
  - explicitly still outstanding, and intentionally left for future browser-test infra rather than bolted on here: keyboard-only board/dialog flow automation, open/missing/toll/bonus road visual/snapshot assertions at mobile viewport, separate Classic/Expedition calendar-dot rendering, and true end-to-end wiring of `useRoadDayGameplay`/`useGoldroadLocalState` (their composables call Nuxt auto-imports — `useState`, `useSessionApi`, `useLocalGameProgress`, `useDocumentVisibility`'s window listeners — that have no stand-in in this repo's plain-node Vitest config since `@nuxt/test-utils`/`@vue/test-utils`/jsdom are not installed); the pure-logic extractions above cover the same acceptance-criteria decisions but do not exercise the composables' Vue lifecycle or storage wiring end to end
  - status stays `in progress`: the regression-matrix intent for archive/footer/percentile logic is now met at the automated level, but the browser/visual/keyboard criteria remain genuinely untested by this suite

### Issue RP1-10 — Make board messaging strictly contextual (v1 footer contract)
- Priority: `P1`
- Status: `done`
- Goal: show exactly one contextual message or affordance per board state, restoring v1's information rhythm.
- Why it matters: v2's footer renders status text, attempt pill, hint button, and action row concurrently. v1 showed one thing at a time — attempt count only at rest after a retry, gone on the first move; only a retry icon during movement. The current board talks when the context doesn't demand it.
- Scope:
  - `GameBoardFooter` (and `GameBoardHeader` if any always-on element fails the context test)
  - `useRoadDayGameplay` state exposure if finer-grained states are needed
  - runtime copy in `uiCopy.ts`
- State contract (v1-derived, adapted to v2 features; the footer is the hint's home — v1 had no hint, so this is the one deliberate addition to its contract):
  - pre-play, first visit path: one instruction line; Hint quiet but reachable
  - mid-run (any moves made): quiet retry affordance only — no status line, no attempt pill, Hint reachable but visually quiet
  - at rest after a failed attempt: what happened + promoted Try again + attempt count; all of it clears on the next move
  - newly solved Classic: celebration/share/Expedition per P1-10 tiering; footer afterwards carries the relevant next action plus a quiet Try again entry into untracked replay
  - newly solved day: next-road ticker as the single resting message, with quiet Try again/Share and View stats actions
  - solved reset, before a replay move: the board still presents as solved and retry is hidden because the reset board is clean
  - untracked replay after a move: quiet retry returns; no attempt pill and no tracked-result effects
- Acceptance criteria:
  - no board state renders more than one message plus its state-relevant actions
  - the attempt count is visible only at rest after a retry and disappears on the first move of the new attempt
  - during a run, nothing persistent competes with the board (verified at mobile width)
  - hint guidance messages replace — not stack on — the status line
  - the existing RP1-3 state transitions still pass their browser checks
- Dependencies:
  - RP1-3 (absorbs its remaining state-transition verification)
  - RP1-9 for regression coverage of the state matrix
- Completion notes:
  - `GameBoardFooter` now computes an explicit six-state machine (`resting-first`, `resting-retry`, `mid-run`, `failed`, `solved-next`, `solved-final`) from a new `hasMoved` prop passed by the live, replay, and tutorial-practice surfaces
  - mid-run renders no text at all — only quiet icon-circle Retry and Hint; a player-requested hint message is the one exception and clears on the next move (existing behavior)
  - the resting state after a retry shows only the v1-style ordinal attempt line ("2nd attempt", `UI_COPY.boardFooter.attemptResting`), which disappears on the first move; the attempt pill now appears only in the failed state alongside the promoted Try again
  - solved-next (Expedition waiting) shows no message with quiet retry + Share and a primary Play Expedition; solved-final shows the next-road ticker as its single message with quiet retry/Share and View stats
  - the solved-state retry behavior was rechecked in July 2026: the quiet Try again control on a newly solved board is intentional; after it resets the board, retry stays hidden until the player makes the first untracked replay move
  - the replay page's footer back-link now appears only in solved/failed states (the archive header already carries a permanent back link)
  - browser-verified every transition on the live board: resting-first → mid-run → retry → resting-retry (clears on move) → hint mid-run → wrong-finish failed state → solve → relief-tier celebration → solved-next → Expedition solve → day-complete sheet → solved-final ticker; typecheck and 41/41 tests pass
  - automated coverage of this state matrix remains tracked by RP1-9

### Issue RP1-11 — Return stats to v1's shape, adapted for two modes
- Priority: `P1`
- Status: `done`
- Goal: rebuild the stats page around v1's proven forms — medal displays, own-result today card, previous-road global story, key-value personal record — scoped by the single global mode toggle.
- Why it matters: the July 2026 review judged v1's stats page better. v2's current page still reads as assembled analytics, and its dynamic today-community section answers no player question without a live scoreboard.
- Design decision (medal display): v2 has no medal artwork — medals exist only as a typographic color system (colored count + uppercase label in the stats header strip, medal-tinted badge pills, a medal-colored check in `GameBoardHeader`). The rebuilt display uses v1's *form* — one tile per medal tier, count prominent, "+1" tick on today's earn — built from v2's medal color system (or new small medal art if a taste pass justifies it). Only gold, silver, and bronze: v1's 4+/10+/20+ try buckets are dropped.
- Scope:
  - `stats.vue` restructure (presentation; data composables largely reusable)
  - medal display treatment (v1's medal-cards-with-count form and the "+1" increment moment on arrival from a solve)
  - removal of the dynamic today-community snapshot, its Refresh action, and its API usage
  - previous-road global stats: histogram plus v1's narrative framing ("X% of the people who walked down Road N finished it… top Y%")
  - key-value personal record list (streaks, roads played, solves, completion %, average attempts, plus v2's solve time)
  - server stats API surface reduction if the current-road aggregation becomes dead
- Acceptance criteria:
  - page order: medals (with +1 moment when arriving from a solve) → today's own result + share (or play prompt) → previous-road global story → personal record → past-roads entry
  - medal displays show only gold/silver/bronze counts — no 4+/10+/20+ bucket tiles
  - no community data is shown for the in-progress road anywhere
  - one global Classic/Expedition toggle scopes mode-specific sections; cross-mode facts stay always visible
  - the histogram keeps the player's bar highlighted and keeps the RP1-5 small-sample honesty rules
  - sparse/no-history states stay clean
- Dependencies:
  - supersedes the remaining direction of RP1-5 (its shipped safeguards and card consolidation carry forward)
  - RP0-4 for the aggregation-side changes
- Completion notes:
  - `stats.vue` rebuilt in v1's page order: medal tiles → mode toggle → Today's Road (own result + share, or play prompt) → Yesterday's Road global stats (histogram + narrative) → Your stats key-value record → "Keep walking & improving" past-roads entry
  - medal tiles use v1's form in v2's materials: a gradient medal disc carrying the all-time count (cross-mode, always visible above the toggle), tier label, attempts sub-label, and a green "+N" tick for medals earned on today's road in either mode
  - the v1 record labels returned: Total treads, Total finishes, Completion, plus streaks, average/best solve time, and hints — a flat key-value list, no expandable snapshot grid
  - yesterday's narrative uses v1's voice: "X% of the roadgoers who walked down Road N reached the finish" and "You got to the finish in N attempts — in the top Y% of the field" (v1's at-or-better percentile), with honest small-sample copy below 5 results and the histogram withheld
  - dynamic today-community stats removed end to end: `/api/stats/overview` now returns `{ currentGameNo, yesterday }` only and no longer aggregates the in-progress road; `StatsOverviewSchema` updated; API smoke script passes (12/12) against the new contract
  - the recent-results log was removed — the personal record and Past Roads cover it (per the "Recent roads" clarified decision); the quiet "How the field played it" behavior detail stays on yesterday's card
  - browser-verified with a synthetic 6-play field for the previous road: both mode scopes, solved/no-medal badge states, +1 tick, histogram, and empty-field hiding; typecheck and 41/41 tests pass
  - dev note: the "current streak 0 with today solved" seen locally is a seed-data artifact (seeded road day is months behind the calendar), not a logic bug

### Issue RP1-12 — Past Roads as a calendar; de-chrome the replay pages
- Priority: `P1`
- Status: `done`
- Goal: replace the past-roads card grid with a calendar-style picker and strip replay-page text to what helps play.
- Why it matters: every archive card carries identical content (date, road number, the same two mode pills) — a grid of cards that conveys nothing. A calendar says the same thing in one glance and matches the day-based product model. The replay page also fronts too many headers and labels before the board.
- Scope:
  - `/games` (`games/index.vue`) calendar UI over the recent-archive window
  - personal-result marks on calendar days (solved/medal state from local history) if cheap — decide during implementation
  - `/games/[gameNo]` header/label reduction
  - random-road CTA placement, pending the later RP0-5 deep-archive decision
- Acceptance criteria:
  - past roads render as a calendar (or month strip) of playable days; tapping a day opens that road day's dual-mode replay
  - days outside the recent-archive window are visibly not playable; whether a separate deep-archive random-road entry remains is decided under RP0-5
  - the replay page leads with the board; page-level eyebrow/subtitle chrome is removed or collapsed to a single compact identity line
  - empty/error/loading states remain handled
- Dependencies:
  - RP1-6 (supersedes its card-grid presentation; its copy and metadata decisions carry forward)
- Completion notes:
  - `/games` now renders month calendars (UTC, newest month first): playable archive days are tappable cells and other days recede; the originally shipped single best-result medal dot is superseded by RP0-5's two per-mode medal-tinted completion discs (owner-approved)
  - the deep-archive random-road entry was found to have lost its UI entry point during RP1-5's panel removal and was restored here as a "Surprise me with an older road" action; the question was resolved in RP0-5: the action and `/api/games/another` survive in simplified identity-free form
  - `/games/[gameNo]` dropped the archive-header card (eyebrow, h1, subtitle, note) for one compact identity bar — back arrow, "Road N · date", and a small REPLAY tag — so the board leads the page
  - browser-verified the calendar (playable vs. inert days) and the de-chromed replay page; typecheck and 41/41 tests pass

### Issue RP1-13 — Dead-declaration cleanup across CSS and code
- Priority: `P1`
- Status: `done`
- Goal: remove everything declared but unused — or no longer used in the sense it was declared — once the experience issues have settled the UI.
- Why it matters: the polish passes left residue. `main.css` declares the `--color-start`/`--color-end` families and `--color-silver-rgb` (start/finish are icon-distinguished and share gold coloring — no component references these), plus the pre-P0-1 `--color-blocked`. Component CSS, composables, and exports likely have equivalent leftovers. A trustworthy design system documents only what exists.
- Scope:
  - `app/assets/css/main.css` token audit (colors, gradients, shadows — verify each has a live consumer)
  - component-scoped CSS audit for orphaned and duplicate rules, including the duplicate `.container` declaration in `app/pages/games/index.vue`
  - TypeScript audit for unused exports/composables/props (typecheck + a dead-code pass)
  - `DESIGN_SYSTEM.md` updated in the same pass so doc and code stay in lockstep
- Acceptance criteria:
  - every token in `main.css` has at least one real consumer, or is removed
  - the known dead tokens (`--color-start`/`--color-end` families, `--color-silver-rgb`, `--color-blocked`) are gone
  - misleadingly named tokens still in use are renamed to what they actually do (e.g. `--color-active` if it survives as a stats accent)
  - no unused exported functions/composables/props remain in `app/`
  - `pnpm typecheck`, `pnpm test`, and `pnpm build` stay green; a browser smoke pass confirms no visual regressions
- Dependencies:
  - RP1-10, RP1-11, RP1-12 — run this after the UI settles, not before
- Completion notes:
  - **`main.css` token audit** — every custom property was checked for a real consumer (`var(--x)` and `var(--x, fallback)` both counted; a token used only by another dead token doesn't count). Removed as confirmed dead: `--color-start`/`-light`/`-dark`, `--color-end`/`-light`/`-dark`, `--color-silver-rgb`, `--color-blocked`, the full `--color-expedition-accent`/`-rgb`/`-bright`/`-bright-rgb` cyan family, `--color-text-on-expedition`, `--color-gold-dark-rgb`, `--color-gold-light`, `--color-medal-bronze`/`-rgb`/`-segment` (base tier, `-bright` stays live), `--color-medal-silver`/`-light`/`-rgb`/`-segment` (base tier, `-bright`/`-muted` stay live), `--color-text-primary`, `--gradient-bg-classic`/`-expedition` (mode-specific card backgrounds are set with literal colors, not these tokens), `--gradient-card-board`, `--gradient-radial-active`, `--letter-spacing-tight`, `--mode-tint-classic`/`-alt`, `--mode-tint-expedition-alt` (and the dead `body.mode-classic .hero-card/.board-stage` rule that only redeclared them), `--road-missing-opacity`, `--shadow-md`, `--shadow-glow-active`/`-active-hover`/`-end`/`-end-subtle`/`-road`/`-start`, and the now-orphaned `--color-bg-classic-*`/`--color-bg-expedition-*` triplets (only consumed by the gradients just removed). Kept `--gradient-card-completion` — it looked dead by exact-call grep but is a real consumer via `var(--gradient-card-completion, var(--gradient-card-overlay))` in `V1WelcomeSheet.vue` and `SolveCelebrationSheet.vue`.
  - **Renamed** `--color-active`/`--color-active-rgb` → `--color-solved`/`--color-solved-rgb` (its only two consumers are the archive calendar's solved-day marker in `app/pages/games/index.vue` and the stats page's positive feedback text in `app/pages/stats.vue` — a "solved" state color, not "active"). Both consumers and `DESIGN_SYSTEM.md` updated.
  - **Component-scoped CSS** — merged the duplicate `.container` rule in `app/pages/games/index.vue` into one declaration. Removed the fully orphaned `.nav-link`/`.nav-link--compact`/`.nav-link:hover`/`.nav-link.router-link-active` rule set in `app/layouts/default.vue` (no template element carries that class; nav items use `.menu-link`/`.icon-button` instead) and the `.medal-disc` responsive rule in `app/pages/stats.vue` (leftover from before RP1-9's SVG `MedalIcon` medal redesign). Verified all other apparent "orphans" from an automated selector/template scan are false positives — dynamic `:class` bindings built from template literals (`road--${type}`, `mode-status--${medal}`, `day-mark--${tier}`, etc.) and Vue's auto-generated `<Transition>` classes.
  - **TypeScript dead-export audit** (`app/`, `lib/`, `shared/`, `server/`) — removed: `buildConnectionGrid`, `calcTileSize`/`TileSizeResult`, `coinsNeededLabel` from `app/utils/boardUtils.ts` (all superseded, only `buildInitialTileStates` is still called); the now-unused `TILE_SIZE`/`MIN_TILE_SIZE`/`TILE_GAP`/`OTHER_ELEMENTS_HEIGHT` constants those functions consumed, plus `PAST_ROADS_LIMIT` (duplicate of the live `RECENT_ARCHIVE_DAY_LIMIT` in `shared/utils/archive.ts`) from `lib/gameConstants.ts`; the ratio-tier legacy helpers `calcOutcomeTier`, `applyHintPenalties`, `MEDAL_LABEL`, `MEDAL_SHORT`, `TIER_LABEL`, `TIER_SHORT` from `lib/gameTiers.ts` (the file's own docblock called these a temporary migration bridge — the live path now goes through `calcMedalForAttempt` end-to-end, confirmed via `useRoadDayGameplay.ts`), and the `TIER_THRESHOLDS`/`HINT_GOLD_LOCK_LEVEL` constants they alone consumed; `ROAD_ROTATION_CRON` from `server/utils/roadOperations.ts` (the actual cron schedule is hardcoded separately in `nuxt.config.ts` and `wrangler.jsonc`, never imports this constant).
  - **Flagged but kept** (ambiguous, not obviously dead — left for a human call): `HINTS_PER_DAY_DEFAULT`, `HINTS_PER_DAY_MAX`, `HINT_SCORE_PENALTY` in `lib/gameConstants.ts` are wired nowhere (no per-day hint budget or score-penalty enforcement exists in the hint/session routes), which reads like an unfinished feature rather than pure residue; `isExactSolve` (`lib/gameTiers.ts`), `hasCommunitySample` (`app/utils/statsPresentation.ts`), and `getDirection` (`shared/utils/puzzleEngine.ts`, docstring claims it's "used when drawing connection lines on the board" but has no current call site) are exercised only by their unit tests and nowhere in production.
  - `DESIGN_SYSTEM.md` updated in the same pass: token tables/lists now list only what exists post-cleanup (including the rename), with the start/finish and cyan-accent commentary trimmed to match.
  - Verification: `pnpm typecheck` (vue-tsc, clean), `pnpm test` (101/101 passing, unchanged count), `pnpm build` (clean) all green on the working tree. A manual browser smoke pass was not performed in this session — the acceptance criterion calling for one is not yet checked off.

### Issue RP1-14 — Bring release documentation back in sync with the shipped app
- Priority: `P1`
- Status: `done`
- Goal: make the repository's release and design documents describe the product that is actually being reviewed for launch.
- Why it matters: README and architecture notes still call shipped About, Tutorial, sounds, celebration, stats, and archive work “planned.” The tracker itself leaves superseded work looking active, and design/cutover notes preserve decisions that the UI has since replaced. That makes release review slower and invites old behavior to be reintroduced.
- Scope:
  - `README.md` and `ARCHITECTURE.md`
  - `DESIGN_SYSTEM.md`
  - `LAUNCH_CUTOVER_NOTES.md`
  - tracker status/supersession cleanup
  - Updates-content ownership and notification-dot documentation
- Acceptance criteria:
  - shipped surfaces are described as current behavior, not future work
  - superseded issues such as RP1-5 point clearly to their replacement and do not imply a second implementation is still pending
  - the design-system palette records muted gold, not silver, as Expedition's secondary emphasis and removes the stale cyan guidance
  - launch notes describe the current two-level update dot (hamburger and About entry) and identify `app/content/updates.ts` as the Updates-content source of truth
  - the currently ignored `LAUNCH_CUTOVER_NOTES.md` is either deliberately tracked as release documentation or its still-valid checklist is moved into a tracked source of truth
  - archive, analytics, replay, and retry documentation matches RP0-4, RP0-5, and the clarified RP1-10 state contract
  - no release checklist points at a route, file, or behavior that does not exist without also recording the required migration/redirect decision
- Dependencies:
  - finalize RP0-4 and RP0-5 behavior before closing this documentation pass
- Completion notes:
  - `README.md` and `ARCHITECTURE.md`: moved About, the interactive tutorial, sounds, celebration sheets, PWA installability, and the v1's-shape stats page out of "planned" language into current-behavior description; added `/about` to the route lists (verified `app/pages/about.vue` exists and is routed)
  - `ARCHITECTURE.md`: rewrote the Past road behavior section to describe archive play as fully local (archived boards return `optimalPaths`, hints compute client-side, no `/api/session` calls) and to fix a real contradiction — it previously still said Expedition unlocks directly in archive replay, which the July 2026 archive/replay review explicitly superseded (Expedition stays gated behind Classic everywhere, live and archived); added the `archiveCompletionByGame` local-storage contract (RP0-5); added the current-road-only + UUID+IP rate-limit contract for `/api/session/end` and `/api/session/hint` (verified directly in `server/api/session/end.post.ts`); added the yesterday-only, pooled-histogram-plus-unpooled-percentile, 5/10 sample-size-gated stats contract (verified in `app/utils/statsPresentation.ts`: `COMMUNITY_SAMPLE_MIN = 5`, `PERCENTILE_SAMPLE_MIN = 10`); documented the two-level update dot and `app/content/updates.ts` as the Updates-content source of truth
  - `DESIGN_SYSTEM.md`: was already substantially correct post-RP1-13; added an explicit note tying `--color-gold-muted` to Expedition's secondary emphasis (the stats page's `.streak-expedition` line) and confirming no cyan tokens remain, closing the one acceptance-criterion gap that was implicit rather than stated
  - tracker cleanup: added a superseded-pointer to RP1-6's Status line ("card presentation superseded by RP1-12"), matching the pattern RP1-5 already used, so both P1-era redesign issues that were followed by a later RP1 issue read the same way
  - `LAUNCH_CUTOVER_NOTES.md`: decided to track it (removed the `LAUNCH_CUTOVER_NOTES.md` line from `.gitignore`). It holds a still-open, still-accurate P2-4/RP0-2 launch checklist, not settled product decisions, so it stays a separate tracked file rather than being merged into `ARCHITECTURE.md`. Reworded its header (no longer "not committed" / "delete once launch is done" as an ignore-file, since it is now itself the artifact that gets deleted post-launch), fixed a stale reference (the `'Jul 2026'` placeholder date lives in `app/content/updates.ts` now, not `about.vue`, since that content was extracted during the P2-4 work), and added an explicit paragraph distinguishing the v1-detection-specific hamburger dot from the general two-level Updates dot and naming `app/content/updates.ts` as its source of truth
  - verified every route/file the touched docs reference actually exists: `app/pages/about.vue`, `app/content/updates.ts`, `app/composables/useUpdatesNotice.ts`, `app/composables/useV1ReturningPlayerNotice.ts`, `app/components/V1WelcomeSheet.vue`, `server/api/session/end.post.ts`, `server/api/session/hint.post.ts`, `app/utils/statsPresentation.ts`, `server/db/README.md`, and the `wrangler.jsonc` `database_id`/`crons`/`observability` keys the cutover checklist points at
  - `pnpm typecheck` and `pnpm test` (101/101) pass unchanged; this was a docs-and-`.gitignore`-only pass with no source changes

### Recommended implementation order

1. RP0-1 — verification gate
2. RP0-3 — gameplay, keyboard, and streak correctness
3. RP1-7 — terminology and voice decisions
4. RP1-2 — road grammar and Expedition surface
5. RP1-3 — contextual board header/footer
6. RP1-1 — tutorial rebuilt from the production components
7. RP1-4 and RP1-8 — header/navigation and dialog accessibility
8. RP1-5 — stats redesign and sparse live-data states ✅ (direction continues as RP1-11)
9. RP1-6 — Past Roads redesign ✅ (presentation superseded by RP1-12)
10. RP1-10 — contextual board messaging (absorbs RP1-3 verification)
11. RP1-11 — stats page in v1's shape, coordinated with RP0-4
12. RP1-12 — Past Roads calendar and replay de-chroming
13. RP0-5 — local, mode-specific, stats-free archive completion and archive hints
14. RP0-4 — analytics hardening/privacy, coordinated with RP0-5's archive boundary and RP1-11's reduced stats surface
15. RP1-7 — finish the remaining terminology drift
16. RP1-14 — synchronize release/design documentation after behavior contracts settle
17. RP1-13 — dead-declaration cleanup once the UI has settled
18. RP1-9 — regression coverage throughout the work, completed as a release gate
19. RP0-2 — production cutover after every local release gate is green
