# GoldRoad Staging Feedback Implementation Brief

Date: 2026-07-21

Status: implemented locally; deployment-gated iPhone Home Screen verification pending

Source: hands-on iPhone Home Screen and desktop staging testing after the mastered-sound deployment

## 1. Purpose

This document captures the agreed changes from the July 21 staging review so they can be implemented in a separate thread without having to reconstruct product decisions from conversation history.

This is a focused stabilization and mobile-polish pass. It does not reopen the broader v2 product model.

## 2. Locked decisions from this review

- Personal solve credit remains local-first and must never be rolled back because analytics delivery failed.
- Analytics records only two product events per road and mode: the first gameplay tile tap starts the puzzle, and an exact solve ends it.
- Dead ends, wrong exits, and manual retries remain gameplay states; they do not send session-end analytics.
- The page sends the solve immediately. Only an explicitly failed solve submission is handed to an app-wide, short-lived retry service.
- A failed solve stays persisted and retryable until the current road's `nextGameAt`, then expires. There is no previous-road grace period, signed receipt, or analytics event ledger.
- The real score remains visible when it reaches or exceeds the target.
- In Classic, a non-terminal move with `score >= target` shows: `This route may not lead to an exact finish.`
- A terminal tile keeps its specific outcome message instead of the generic over-target warning.
- All result shares, including archive results, link to the homepage. Do not deep-link result shares to `/games/:gameNo`.
- Keep the current manifest-based Home Screen experience. Do not add `@vite-pwa/nuxt`, a service worker, or an offline shell in this pass.
- Do not rename the audio files merely to distinguish them from v1. Fix the iOS audio lifecycle directly.
- Player-facing language uses `try` and `tries`. Internal database, validator, and API fields may remain named `attempts`.
- Retry-resting copy uses ordinals: `2nd Try`, `3rd Try`, and so on.
- The Tutorial segmented-tab treatment becomes the common visual language for segmented controls across Tutorial, the live board, and Stats.
- Toll and bonus roads use the same neutral-gold road color as other roads. Their rail patterns remain the distinguishing signal.

## 3. Staging evidence that drives the work

### Missing iPhone Classic analytics

- The iPhone stored the Road 2 Classic solve locally, but staging D1 has no corresponding analytics row.
- The iPhone result is visible locally through its solved state and histogram marker.
- Cloudflare observability shows only four `POST /api/session/end` requests for that road day:
  - two Classic endings from the desktop's two-try solve
  - one Expedition ending from iPhone
  - one Expedition ending from desktop
- Therefore, the iPhone Classic request did not reach the Worker. There was no server-side rejection to diagnose.
- The client currently records the local result before the network call and silently catches every submission error, with no retry or diagnostic state.
- The session sender lives in the page-scoped gameplay composable. A component unmount does not inherently cancel its existing `$fetch`, but page-scoped timers and lifecycle listeners are not an appropriate owner for retries.
- There is currently no real session-start request. A player first appears in analytics only after requesting a hint or ending an attempt.
- `POST /api/session/end` is currently sent for solve, dead end, wrong exit, and manual retry. Dead-end and wrong-exit counts only support behavioral field statistics that this review removes.

### Dead-end score rejection

- Road 3 Expedition's target was 109.
- A legal dead-end route can score 110, so the target is not a valid upper bound for every legal unfinished route.
- For the reconstructed Road 3 route, the score crossed from 107 to 110 only on its final dead-end tile.
- The server currently rejects any payload score above `maxScore`, incorrectly treating the best exit-route target as the board's maximum possible unfinished score.

### iPhone audio

- A previously installed iPhone Home Screen app produced no Classic or Expedition sounds during one session.
- The same deployment played sounds on desktop and later played them on the iPhone.
- The implementation has no explicit foreground resume, first-gesture readiness queue, failed-play retry, or observable audio state.

## 4. Implementation issues

### SF0-1 — Reduce analytics to puzzle start and solve completion

- Priority: `P0`
- Status: `implemented`
- Goal: accurately measure unique starters and solvers without sending an event for every failed try, while giving a failed solve submission a short recovery window.
- Scope:
  - `app/composables/useRoadDayGameplay.ts`
  - `app/composables/useSessionApi.ts`
  - `app/composables/useApi.ts`
  - a small app-wide client delivery composable initialized by a Nuxt client plugin
  - short-lived failed-solve storage
  - a new `server/api/session/start.post.ts`
  - `server/api/session/end.post.ts`
  - Stats aggregation/types that currently expose failed-route behavior

#### Event model

- On the first gameplay tile tap for a fresh live road and mode, send one `session/start` request.
- Start is unique per anonymous player, road, and mode. The server uses the existing unique analytics-row key so duplicate starts do not increment the starter count twice.
- `session/start` applies the same player-UUID plus IP rate limiting as the existing end and hint endpoints; it is a new unauthenticated write path.
- Start is best-effort and does not use the durable retry service. If start was missed but the player later solves, `session/end` creates the row and counts the player as both started and solved.
- Derive community starter and solver counts from analytics-row state, not raw endpoint request counts: every row represents one starter and `solved = true` represents one solver.
- If the lightweight `games` aggregates continue to be maintained, a solve that inserts a missing row increments both `playsCount` and `finishedCount`; a solve that updates an existing unsolved row increments only `finishedCount`; a duplicate solve increments neither. Perform the row and aggregate changes atomically where D1 permits.
- Send `session/end` only for an exact solve. Do not send it for dead ends, wrong exits, or the `Try again` action.
- The solve payload carries the final try number, hints used, solve time, score, and move count. These are sufficient for medals, the tries histogram, hint totals, and solve-time comparison.
- `session/end` is a solve-only contract; `solved` and the non-solve `endReason` branches are redundant and should be removed from the new client contract.
- The hint endpoint remains necessary to return a server-computed live hint, but it should not create a starter or independently mutate analytics. The solve payload is the source of truth for total hints used by solvers.
- Remove dead-end and wrong-exit aggregation from the Stats response and UI. Existing database columns may remain dormant in this stabilization pass; dropping them can be a later cleanup migration.

#### Failed-solve handoff and retry

- The page-scoped gameplay flow makes the first solve submission immediately, after local solve credit and celebration are secured.
- Send the initial request with `keepalive: true` as page-lifecycle protection.
- If that request explicitly fails, hand its complete payload to the app-wide delivery composable. Prefer a typed composable method such as `queueFailedSolve(payload)` over an untyped browser custom event; it is the same page-to-app handoff with a smaller testing surface.
- Persist only failed solve submissions. Do not persist start, hint, dead-end, wrong-exit, or retry events.
- Initialize the delivery owner from a Nuxt client plugin so navigation cannot dispose of its timers and lifecycle listeners.
- Retry one request at a time with jittered backoff at approximately 2s, 5s, 15s, 30s, 60s, and 120s after handoff.
- Also attempt a pending solve when connectivity returns, on `pageshow`, and when visibility returns to `visible`, without creating parallel in-flight requests.
- The retry deadline is `nextGameAt`. Active backoff stops once the schedule is exhausted, but the persisted payload survives until road rotation and gets another attempt on each lifecycle trigger, including the next app launch. This is what rescues the observed iPhone loss pattern: solve fails to send, app is closed, and the event is still delivered when the app reopens later the same road day.
- Treat network failures, `429`, and `5xx` as retryable. Treat other `4xx` responses, including a road that is no longer current, as final and discard the pending event.
- Delete the pending event after a successful response or when its deadline is reached. Never submit it for yesterday's road and never rewrite its game number.
- Sequential solve retries remain safe through the existing solved-row guard: once a player-road-mode row is solved, a later delivery returns success without incrementing solve or medal aggregates again. No event-ID ledger is added.
- Log failed and expired delivery outcomes during development/staging without showing an analytics error to the player.
- Accepted limitation: because persistence happens only after an explicit failure, an OS kill while the initial request is still in flight can still lose the event. `keepalive` reduces that window without introducing a write-before-send queue.

#### Product metrics after simplification

- `started`: unique anonymous players who tapped into a live road and mode, plus any solver whose start request was missed
- `solved`: unique starters who later submitted an exact solve
- completion rate: `solved / started`
- medal and tries distribution, hint total, and average solve time: calculated from solved rows
- no dead-end, wrong-exit, or incomplete-try behavioral metrics
- accepted bias: because start is best-effort, a missed start from a player who never solves undercounts starters, so the completion rate reads slightly high

- Acceptance criteria:
  - the first tile tap creates one starter row and repeated taps do not create more
  - dead ends, wrong exits, and `Try again` produce no session-end requests
  - an exact solve produces one immediate session-end request with final result data
  - a failed solve appears in D1 after connectivity returns before road rotation, including after closing and reopening the app on the same road day
  - navigation after a failed solve does not dispose of the retry owner
  - a pending solve is discarded at road rotation
  - sequential delivery of the same solved payload changes aggregate data only once
  - a solve with a missed start still counts as one starter and one solver
  - a failed analytics request never removes a local solve, medal, streak, solve time, or celebration
- Tests:
  - unique start insertion and duplicate start handling
  - solve upsert when the start request was missed, including one starter and one solver aggregate increment
  - solve update after a recorded start, including no second starter increment
  - no network call for dead end, wrong exit, or manual retry
  - failed-solve handoff, serialization, backoff, lifecycle triggers, and single-flight behavior
  - `nextGameAt` expiry
  - retryable versus final response classification
  - sequential duplicate solved delivery

### SF0-2 — Validate exact solves and clarify over-target Classic routes

- Priority: `P0`
- Status: `implemented`
- Goal: keep the score display understandable while making the solve-only server contract reject non-exact finishes.
- Scope:
  - `server/api/session/end.post.ts`
  - `app/composables/useRoadDayGameplay.ts`
  - `app/content/uiCopy.ts`
  - session route and gameplay tests
- Server behavior:
  - require every submitted session end to have a score exactly equal to the target; `games.maxScore` is the target for both modes (the generator sets it to the best complete route's total, and `isExactSolve` already compares `score === maxScore`)
  - dead ends, retries, and wrong exits never call this endpoint, so their legal over-target scores require no server exception
  - retain broad payload safety bounds from the schema
  - route-level server validation can be considered separately if path history is ever submitted; it is not required in this pass
- UI behavior:
  - always keep displaying the real score
  - in Classic, after a non-terminal move where `score >= target`, set the contextual status to exactly: `This route may not lead to an exact finish.`
  - if that move reaches the finish or creates a dead end, show the existing specific finish/dead-end outcome instead
  - do not reset, mask, or replace the numeric score as v1 did
  - do not add the same generic warning to Expedition in this pass because a later toll can reduce its score
- Acceptance criteria:
  - the known legal Road 3 Expedition dead end at 110 produces no analytics request and therefore no 400 response
  - a session-end submission above or below the target is rejected
  - Classic keeps showing the true score after reaching or passing the target
  - a non-terminal Classic move at or above target shows the agreed warning
  - terminal outcome messaging takes precedence over the warning

### SF0-3 — Make iPhone audio recover across launch and foreground transitions

- Priority: `P0`
- Status: `follow-up implemented after installed-iPhone lock/unlock test; device retest pending deployment`
- Goal: make the first gameplay session in an iPhone Home Screen app as reliable as desktop playback.
- Scope:
  - `app/composables/useSoundEffects.ts`
  - persistent layout audio initialization
  - focused audio lifecycle tests where practical
- Required behavior:
  - explicitly unlock or resume the shared audio context from the first eligible pointer/touch gesture
  - retry the first requested effect once audio becomes ready instead of silently dropping it
  - on `pageshow` or return to visible, invalidate any stale unlock attempt and mark the sound bank unready; resume or recreate it from the next eligible gesture
  - observe and log sound loading/playback failures during staging testing
  - preserve the existing mute preference and never violate user-gesture autoplay requirements
- Deliberate non-goals:
  - no `@vite-pwa/nuxt`
  - no service worker or offline shell
  - no audio-file rename solely for v1 separation
- Acceptance criteria:
  - a fresh iPhone Home Screen launch plays the first move sound after the first board interaction
  - sounds still play after backgrounding and reopening the Home Screen app
  - mute still suppresses all game sounds and haptics
  - desktop behavior remains unchanged

#### July 22 installed-app follow-up

- A fresh Home Screen launch played correctly, but locking and unlocking the phone after a few moves left the prior unlock promise/context unusable until relaunch.
- Foreground lifecycle events now invalidate the prior recovery generation, clear its promise, and reset gesture eligibility. They do not call `resume()` outside a fresh gesture; non-gesture playback can only queue until the next board tap performs recovery and replays its effect.
- The lock/unlock acceptance case must be repeated on the deployed Home Screen app because desktop automation cannot reproduce iOS WebKit's interrupted audio-context state.

### SF0-4 — Share every result through the homepage

- Priority: `P0`
- Status: `implemented`
- Goal: ensure every shared result leads to a playable experience.
- Scope:
  - `app/composables/useRoadResultShare.ts`
  - result-share tests
- Required behavior:
  - live Classic, live Expedition, combined-day, archive, and random-road shares all use the canonical homepage URL
  - result text may still name the road number and mode
  - the CTA is `Walk today's road:` followed by the homepage URL
  - no result share generates `/games/:gameNo`
  - derive the canonical production origin from configuration rather than whichever staging/browser origin happens to be open
- Acceptance criteria:
  - sharing today's result opens the homepage
  - sharing an archive result also opens the homepage
  - shared text uses `try`/`tries`

### SF1-1 — Acknowledge every exact re-solve

- Priority: `P1`
- Status: `implemented`
- Goal: avoid the silent ending when a player solves an already-completed road again.
- Scope:
  - `app/composables/useRoadDayGameplay.ts`
  - `app/pages/index.vue`
  - `app/pages/games/[gameNo].vue`
  - board-footer acknowledgement UI
- Required behavior:
  - decouple exact-solve audio from first-time celebration state
  - play the solve sound on every exact finish when sound is enabled
  - show a lightweight `Solved again.` acknowledgement
  - do not award another medal, streak increment, analytics result, or full celebration sheet
- Acceptance criteria:
  - exact re-solves are acknowledged visually and audibly
  - first-solve celebration behavior is unchanged
  - replay remains untracked

### SF1-2 — Simplify and correct Stats presentation

- Priority: `P1`
- Status: `implemented`
- Scope:
  - `app/pages/stats.vue`
  - `app/components/stats/StatsTriesHistogram.vue`
  - `app/utils/statsPresentation.ts`
  - stats presentation tests

#### Histogram

- Replace the current chevron with a proper downward arrow containing a visible shaft and head.
- Leave a visible gap of approximately 6px between the arrow and its bar.
- Change the horizontal-axis label from `attempts` to `tries`.
- Continue showing the player's local marker even while its analytics event is pending, but do not fabricate a global bar from local-only data.

#### Field detail

- Keep the player/field try comparison and percentile calculation.
- The missing iPhone Classic submission is what produced the misleading top-1% result. With one 1-try solve and one 2-try solve, it should calculate to top 50%.
- Remove hint-user percentage and average dead-end copy.
- Zero hints: `No hints were used on this road.`
- Nonzero hints: `Solvers used N hints in total.`
- Time comparison: `Field solve time averaged 1m 30s. You solved it in 10m 45s.` using the real formatted values.
- If the player has no solve time, show only the field average.

#### Mode-scoped streak

- Move the streak card below the Classic/Expedition segmented control.
- Show only the selected mode's current and best streak.
- Do not combine Classic and Expedition streak sentences in one card.
- Increase the flame to approximately 28–30px in an approximately 48px container.
- Replace hard-coded orange/yellow fills and glow with GoldRoad gold design tokens.

#### Medal cards

- Labels are `1 TRY`, `2 TRIES`, and `3 TRIES`.
- Keep each label on one line with a slightly smaller mobile size and reduced letter spacing where needed.
- Keep `+1` absolutely positioned in the top-right so it consumes no card layout space.
- Animate only `+1` and the numeric medal count.
- Do not scale the medal icon, multiplication sign, or whole medal-stat group.

#### Acceptance criteria

- all three medal labels remain single-line at iPhone widths
- selected-mode streak information is concise and unambiguous
- the flame uses the GoldRoad palette and has greater visual weight
- field detail contains total hints and a direct field-versus-player time comparison
- average dead ends are not shown
- the histogram marker reads as an arrow and does not touch the bar

### SF1-3 — Improve celebration statistics

- Priority: `P1`
- Status: `implemented`
- Scope:
  - `app/components/SolveCelebrationSheet.vue`
  - celebration copy/tests
- Required behavior:
  - reduce duplicated medal presentation
  - for day completion, show one compact row each for Classic and Expedition
  - each solved row includes medal/result, try count, and solve time
  - include hints only when the mode used one or more
  - use `try`/`tries` everywhere
- Acceptance criteria:
  - both mode results are scannable without repeating the same medal artwork and text
  - solve time is present for each available result
  - zero-hint noise is omitted

### SF1-4 — Finish the player-facing `try` terminology migration

- Priority: `P1`
- Status: `implemented`
- Goal: use the shorter v1 term consistently without churning internal contracts.
- Scope:
  - `app/content/uiCopy.ts`
  - player-facing page and component copy
  - share text and tests
- Required behavior:
  - use `try`/`tries` in the board footer, Tutorial, Help, About, Stats, histogram, celebration, sharing, and accessibility labels where the player encounters the term
  - use ordinal retry-resting copy: `2nd Try`, `3rd Try`, `4th Try`, and so on
  - remove the failed-state try-count pill beside `Try again`; show the ordinal only after the board has reset for the new try
  - keep internal names such as `attemptNumber`, `attempts`, database columns, and API payload fields unchanged
- Acceptance criteria:
  - no player-facing `attempt` or `attempts` remains
  - a failed state shows the failure message and `Try again`, without a duplicate count pill
  - after retry, the resting footer shows the correct ordinal `Nth Try`

### SF1-5 — Unify segmented controls and correct Tutorial mobile alignment

- Priority: `P1`
- Status: `implemented`
- Scope:
  - `app/components/TutorialDialog.vue`
  - `app/components/TutorialMiniBoard.vue`
  - `app/components/GameBoardHeader.vue`
  - `app/pages/stats.vue`
  - shared component or shared segmented-control styles
- Segmented controls:
  - use the Tutorial control's quiet bordered shell and soft gold active tint as the common design
  - provide a compact layout for the board header and stretched layouts for Stats and Tutorial
  - preserve the live board's solved/medal status indicators, disabled states, ARIA tab semantics, keyboard focus, and touch targets
  - remove Stats' bright gradient-filled active tab treatment
- Tutorial Hint lesson:
  - on mobile, left-align the illustrated Hint button with the lesson title/body
  - remove the internal 11.5rem minimum-width offset on mobile
  - desktop may retain right alignment within the illustration column
- Practice stage:
  - vertically center the practice-road content in the available dialog area on sufficiently tall screens
  - retain top alignment and normal scrolling on short mobile viewports so no content becomes inaccessible
- Acceptance criteria:
  - Tutorial, live-board, and Stats segmented controls visibly belong to the same component family
  - the mobile Hint illustration aligns with its copy
  - the practice road is vertically balanced on a normal iPhone viewport and remains usable on short screens

### SF1-6 — Return toll and bonus roads to the neutral road palette

- Priority: `P1`
- Status: `implemented`
- Goal: reduce visual competition while preserving structural recognition.
- Scope:
  - `app/components/RoadGlyph.vue`
  - `app/components/BoardRoad.vue`
  - road legend/tutorial visuals
  - `DESIGN_SYSTEM.md`
- Required behavior:
  - open, toll, and bonus roads use the same neutral-gold color family
  - toll remains double dashed rails
  - bonus remains double solid rails
  - remove rust/honey background-rail tinting
  - preserve signed toll/bonus values and any non-color semantic labels
- Superseded decision:
  - this replaces RP1-13's decision to distinguish toll and bonus roads primarily by hue
- Acceptance criteria:
  - road types remain distinguishable without color
  - the board has one coherent road palette
  - Tutorial and live board render the same road grammar

## 5. Recommended implementation order

1. `SF0-1` — simplify the event model, add the real start request, and add short-lived failed-solve delivery.
2. `SF0-2` — make session end solve-only and add the Classic over-target warning.
3. `SF0-3` — harden iPhone audio lifecycle.
4. `SF0-4` and `SF1-1` — repair result sharing and replay completion acknowledgement.
5. `SF1-4` — centralize `try` terminology before dependent UI copy changes.
6. `SF1-2` and `SF1-3` — Stats and celebration presentation.
7. `SF1-5` and `SF1-6` — shared segmented controls, Tutorial mobile layout, and road palette.

`SF0-1` is the largest behavioral change. It should not be mixed into the visual-polish commit.

## 6. Verification gate

### Automated

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- API tests covering unique starts, solve-only endings, missed-start solve upsert, exact-score validation, and sequential duplicate solves
- delivery tests covering failed-solve handoff, backoff, lifecycle triggers, navigation survival, response classification, and expiry
- share tests asserting the homepage URL for every entry type
- copy tests for `1 try`, plural `tries`, and ordinal resting states
- browser regression checks at desktop and iPhone-width viewports

### Manual staging

- Fresh iPhone Home Screen launch: verify the first move, deny, dead-end, and solve sounds.
- Background and reopen the Home Screen app, then verify sound again.
- Start a road and verify the first tile tap records one starter; further taps and failed tries do not add rows or session-end requests.
- Solve while temporarily offline, reconnect on the same road day, and verify one D1 solve update.
- Solve while offline, close the Home Screen app, reopen it later the same road day, and verify the queued solve is delivered.
- Navigate to another page after the failed send and verify the app-wide retry still delivers it.
- Keep a failed event past road rotation and verify it is discarded without a stale request.
- Re-deliver the same solved payload sequentially and confirm analytics does not change twice.
- Inspect the Cloudflare route logs and D1 row together.
- Trigger an over-target unfinished Classic route and verify true score plus warning copy.
- Trigger an over-target terminal route and verify terminal outcome copy wins.
- Share live and archive results and confirm both open the homepage.
- Re-solve an already-completed road and verify sound plus `Solved again.` with no new award.
- Review Stats, celebration, and Tutorial on an iPhone viewport for wrapping and alignment.

## 7. Explicitly out of scope

- adding `@vite-pwa/nuxt`
- service-worker caching, offline shell, install prompts, or background sync
- changing internal `attempts` field names
- server-side personal-history sync or authentication
- submitting full route history merely to validate analytics
- archive-result deep links
- redesigning the puzzle generator to prevent every possible over-target unfinished route
- caching `/api/stats/overview` or `/api/games/current`; handle response caching as a separate follow-up after this stabilization pass
- dynamic `cachedEventHandler` max-age experiments before the Nuxt/Nitro version in this project supports the desired production contract

## 8. Documentation follow-through

When implementation is complete:

- update `IMPLEMENTATION_PLAN.md` with completion status and note which older decisions were superseded
- update `ARCHITECTURE.md` for the start/solve-only analytics model and the road-day-bounded failed-solve delivery owner
- update `DESIGN_SYSTEM.md` for the shared segmented control and neutral road palette
- keep the existing manifest-only/no-offline-shell decision explicit
- record real staging verification results rather than marking device checks complete by inspection alone
