# Launch cutover notes (P2-4)

This is the working checklist for Issue P2-4 ("Launch cutover and v1 decommission"),
split into the actual sequence agreed on: soft-launch on a subdomain first,
observe for a few days, then do the real production cutover and v1 decommission.

This file is now tracked in git (RP1-14): it holds the still-open launch checklist
for P2-4/RP0-2, not settled product decisions, so it stays separate from the
canonical doc set (`README.md` / `ARCHITECTURE.md` / `IMPLEMENTATION_PLAN.md` /
`DESIGN_SYSTEM.md`) rather than being merged into it. Once launch and v1
decommission are complete, delete this file; nothing in it needs to survive as
permanent documentation once the checklist items are done.

## Open decisions (fill in before executing)

- [x] Subdomain: `v2.playgoldroad.com`
- [x] Observation window: through at least two successful automatic rotations (Roads 2 and 3; earliest cutover review on 22 July 2026 IST)
- [ ] Go-live date for the real cutover (needed to replace `app/content/updates.ts`'s `'Jul 2026'` placeholder date on its fresh-start entry)
- [x] Whether to add proactive v1-returning-player messaging before the *production* cutover — **done**, see below

## v1-returning-player notice — implemented

**Correction (verified directly against `_archive/frontend/src`, not assumed):**
the `LEGACY_STORAGE_KEYS` / `LEGACY_STORAGE_PREFIXES` handled by
`removeLegacyKeys()` in `useGoldroadLocalState.ts`
(`goldroad-progress-v1`, `goldroad-player-uuid`, `goldroad-classic-solved-*`, etc.)
are **not** real v1 keys — they're leftovers from an early v2 storage iteration,
predating today's single `goldroad-state-v2` key. They tell us nothing about
whether a browser ever ran v1. Don't rely on them for v1 detection.

The actual v1 client-side writes, exhaustively (grepped every
`localStorage`/`sessionStorage`/`indexedDB`/`document.cookie` reference in the
archive):
- `sounds` (`App.js`) — only set if the player ever toggled mute
- `isRedirecting` (`Firebase.js`) — transient OAuth-redirect flag, removed right after
- `registration-token` / `registration-token-sent` (`Firebase.js`) — only set if push notifications were granted
- `game-update-300323` (`Toolbar.jsx`) — only set after the player visited `/about` at least once (see below — this is v1's *own* prior version of this exact problem)
- `howToPlayShown` (`Game.jsx`) — `sessionStorage`, gone on tab close, not useful here

None of those is a universal signal — each depends on a specific action the
player may never have taken.

**The best signal found (verified in code): a Cache Storage bucket named
`audio-cache`.** `_archive/frontend/src/hooks/useGameSounds.js` calls
`window.caches.open('audio-cache')` and pre-fetches all five gameplay mp3s
into it via a module-level `downloadSounds()` call that runs **unconditionally
on load** — no gate on the mute setting, no auth, no user action of any kind.
Since `Game.jsx` imports this hook and is the main gameplay component, this
cache gets created for essentially every visit to the game board. Cache
Storage is origin-scoped like IndexedDB, so it survives on `playgoldroad.com`
across sessions until evicted or the user clears site data. Detection is a
one-liner and doesn't create anything if absent:
```js
const hasV1Cache = (await caches.keys()).includes('audio-cache');
```

**Second-best signal**: v1 uses Firebase Auth v9
(`_archive/frontend/package.json`), and `Firebase.js`'s `onAuthStateChanged`
handler calls `signInAnonymously(auth)` for anyone with no session — so every
v1 visitor also got an anonymous Firebase Auth session, persisted by the SDK
in IndexedDB (a database typically named `firebaseLocalStorageDb`). Same
origin-scoping logic applies, but `indexedDB.databases()` has patchier
cross-browser support (notably historically on Safari) than the Cache API, so
treat this as a secondary check, not primary.

**Decision**: check both `audio-cache` and `firebaseLocalStorageDb` as an OR
(either present = treat as a returning v1 player), skip the five weaker
localStorage/sessionStorage keys entirely. The two aren't identical signals —
`audio-cache` only appears once the game board actually loads, Firebase's
session fires from the app-wide provider regardless of route — but for a game
that *is* the whole app, they overlap almost completely in practice, and
checking both is cheap insurance against either being evicted independently.

Also worth noting: **v1 already solved this exact problem once**, with a
simple, good pattern (`Toolbar.jsx`'s `LAST_UPDATE` mechanism) — a small
notification dot appears on first load if the current dated update key hasn't
been marked seen; visiting `/about` clears it and marks it seen. v2 reuses
that same idea rather than inventing a banner/toast.

**Shipped**: `app/composables/useV1ReturningPlayerNotice.ts` runs both checks
on mount (client-only) and exposes `showNotice`; `app/layouts/default.vue`
renders a small gold dot on the nav hamburger button when true, and clears +
persists (`v1NoticeDismissed` in `goldroad-state-v2`, same fire-once
convention as `celebratedSolveKeys`) the first time the player visits
`/about`. Verified live: absent with no v1 signal, appears when `audio-cache`
is simulated, stays cleared after visiting `/about` and reloading. Full
details in `IMPLEMENTATION_PLAN.md`'s P2-4 progress notes.

**Note (RP1-14):** the mechanism above is v1-detection-specific (the hamburger
dot only, gated on the two origin-scoped v1 signals). The general "something
changed" notification is a separate, always-on mechanism that applies to every
player, not just detected v1 returnees: `app/content/updates.ts` is the single
source of truth for update entries (newest first), and
`app/composables/useUpdatesNotice.ts` compares `UPDATES[0].date` against the
player's persisted `lastAcknowledgedUpdateId` to decide whether to show a dot.
That dot now appears at two levels — the nav hamburger button, and again
beside the About entry inside the open menu, so the destination is
unambiguous — and only the About page itself (`app/pages/about.vue`) clears
it, by calling `acknowledgeLatestUpdate()` on mount. The v1 welcome sheet and
the general Updates dot both persist their own acknowledgment flags so
neither re-nags after the other has already been seen.

This was safe to build ahead of the subdomain soft-launch even though it only
matters at the real `playgoldroad.com` cutover — it's inert (no v1 signal
exists) until real v1 traffic ever hits the same origin.

---

## Phase 1 — Subdomain soft-launch

Goal: get the real Cloudflare Worker + D1 stack live somewhere real, under your
own control, with zero risk to current `playgoldroad.com` traffic (still on v1/Firebase).

1. [x] Created isolated `goldroad-v2-staging` and `goldroad-v2-production` D1 databases; both have the squashed migration and no placeholder IDs remain.
2. [x] Bootstrapped staging only: Road 1 is current and Roads 2–6 form the future pool. Production remains empty so its Road 1 starts on the actual cutover day.
3. [x] Deployed Worker `goldroad-v2-staging` and attached the custom domain `v2.playgoldroad.com`.
4. [x] Registered the `0 0 * * *` UTC cron trigger. Deployment version: `c9e9a86a-6149-4bbb-9134-154adb6e4bb3`.
5. [x] Added staging `noindex, nofollow`, a blocking `robots.txt`, request-origin canonical/social URLs, and a permanent `/sign-in` → `/about` redirect.
6. [x] Ran the read-only deployed smoke (`pnpm test:deployed:staging`) and an in-app browser pass of the live board/tutorial, Stats, and empty Past Roads state with no browser errors.
7. **Launch-day verification pass** on the subdomain:
   - [x] current road loads for both Classic and Expedition
   - [x] a synthetic solve wrote the expected analytics row and counters to staging D1; the test row/counters were then removed
   - [x] a live hint request returned a valid hint and recorded `hints_used`
   - [ ] deliberately trip the 20/min staging rate limit and confirm the 429 path (avoid doing this during a player test session)
   - [x] Open Graph metadata uses an absolute staging image URL and the image returns 200
   - [ ] confirm a real third-party share unfurl (not just source metadata)
   - [ ] PWA installs correctly (manifest, icons) on at least one Android and one iOS device
   - [ ] sounds + haptics work, mute toggle persists
   - [x] `/about` returns 200 and renders in the deployed app

## Phase 2 — Observation window

Play it daily yourself for the window you picked above. Specifically watch:

- Workers Logs (observability is already enabled in `wrangler.jsonc`) for any
  `console.error` noise from the P2-3 logging additions — those are meant to
  catch exactly this kind of thing without waiting for player reports
- whether the cron actually fires at `00:00 UTC` and rotates the road without
  manual intervention
- whether the puzzle pool buffer (5 days) is holding steady, not shrinking
- any 429s from the rate limiter that look like real players getting
  false-positived rather than actual spam (20 req/60s per player should be
  generous, but worth eyeballing)

## Phase 3 — Production cutover (playgoldroad.com)

Only after phase 2 looks clean.

1. The proactive v1-returning-player messaging referenced above is already
   shipped (`useV1ReturningPlayerNotice.ts` / `V1WelcomeSheet.vue`) — nothing
   to close out here.
2. Replace the `'Jul 2026'` placeholder date in `app/content/updates.ts`'s
   fresh-start entry with the real go-live date.
3. Immediately before cutover, run `pnpm db:bootstrap:production`, add the apex
   custom-domain route to the `production` Wrangler environment, remove/replace
   the old Firebase DNS target, and run `pnpm deploy:production`. Production is
   already migrated but intentionally has zero roads until this step.
4. Re-run the full launch-day verification checklist from phase 1 against the
   real domain.
5. Make sure old v1 routes don't hard-break — check what routes the v1 app
   actually used (`_archive/frontend/src` React Router config) and confirm
   they land somewhere sensible in v2 rather than 404ing.

## Phase 4 — v1 decommission (Firebase sunset)

From the archive code (`_archive/frontend/src/providers/Firebase.js`), the v1
stack has, at minimum:
- Firebase Hosting (serving the old React app)
- Firebase Auth (Google sign-in — `isRedirecting` / redirect-auth flow)
- A Firestore/RTDB-backed player data store (streaks, history)
- Cloud Messaging / push notification registration (`registration-token`)
- (Per your earlier note: some Cloud Functions may still exist from the
  original Mongo Atlas-era backend even after the Firebase migration — worth
  a quick audit of the Firebase console's Functions tab before assuming the
  full surface area.)

Shutdown checklist:
- [ ] Export/back up Firestore/RTDB data if you want a permanent archive before deleting anything
- [ ] Disable Firebase Hosting for the old app (or leave serving a redirect page pointed at the new domain for a grace period, your call)
- [ ] Revoke/rotate any exposed API keys used by the old client
- [ ] Disable or delete Cloud Functions
- [ ] Cancel any paid Firebase tier / confirm no ongoing billing
- [ ] Decide whether to keep the Firebase project around (dormant) or delete it outright

Nothing in this phase is time-sensitive relative to phase 3 — it can happen
whenever you're comfortable, once the new domain has been live and stable for
a while.
