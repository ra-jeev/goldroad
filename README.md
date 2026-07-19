# GoldRoad

GoldRoad is a local-first daily route puzzle built with Nuxt, Cloudflare Workers, and D1.

The game is intentionally simple:
- one current road day at a time
- two puzzle modes per road day: Classic and Expedition
- a puzzle is solved only by reaching the exit on the target score
- medals based on the number of attempts needed to solve
- local browser storage for personal progress and history
- anonymous server analytics for global comparison and product tuning

This repository contains the active v2 implementation. Older rewrite notes and milestone planning docs have been retired in favor of the documents listed below.

## Product rules

These rules are the current source of truth:
- Classic and Expedition belong to the same road day.
- Classic is the primary live daily puzzle.
- Expedition unlocks from the live Classic solve flow.
- Past-road replay is day-based and should use the same dual-mode UI model as the live road.
- Solving means reaching the exit with the target score.
- Gold, Silver, and Bronze are based on solve attempt counts 1, 2, and 3.
- Personal stats stay local to the browser.
- Active solve timing starts when an unsolved board is visible and pauses while the tab is hidden.
- Global comparison is powered by anonymous analytics only.
- Auth, account sync, and push notifications are intentionally out of scope.

## Current routes

The app currently exposes these main surfaces:
- `/` — current road day, with a first-run interactive tutorial for new players
- `/games` — recent past roads, presented as a calendar rather than a card grid
- `/games/:gameNo` — past road day replay, played locally after a single board fetch (no analytics or hint calls)
- `/stats` — local stats plus global comparison, in v1's shape
- `/about` — About / Privacy / Contact, leading with the Updates timeline that announces the v2 fresh start

Shipped app-shell requirements:
- post-solve celebration and share sheets: a Classic-solve sheet that funnels into Expedition, and a day-complete sheet after Expedition
- game sounds with a persisted mute toggle
- PWA installability with v2-style icons and Open Graph / social link metadata

Remaining polish and cutover work is tracked in `IMPLEMENTATION_PLAN.md`.

## Tech stack

- Frontend: `Nuxt 4`, `Vue 3`
- Server runtime: `Nitro` on `Cloudflare Workers`
- Database: `Cloudflare D1`
- ORM / schema: `Drizzle ORM`
- Validation: `Zod`
- Styling: plain CSS with the design tokens documented in `DESIGN_SYSTEM.md`

## State and analytics

GoldRoad uses two persistence layers with different responsibilities:

### Local browser state

The current implementation stores browser-local state in one versioned local-storage document: `goldroad-state-v2`, managed through VueUse storage composables.

That root object holds the local player experience data for:
- anonymous player id
- current road context
- live daily puzzle progress, including active solve timing state
- replay-only progress for archive and random roads
- local history used by the stats page
- lightweight settings and tutorial state

Replay progress is kept under a separate child key so archive/random play does not pollute daily stats or streak history. Archive completion (whether a past road's Classic or Expedition was ever solved) is tracked separately again, per game and per mode, in `archiveCompletionByGame`; it only drives the Past Roads calendar markers and that road's local unlock state, never medals, streaks, or stats.

Older split local-storage keys are treated as legacy and cleaned up on load.

### Anonymous server analytics

The server stores only the data needed for:
- global comparison surfaces
- puzzle difficulty tuning
- aggregate behavior tracking

It is not meant to be a user history or account-sync system. Only the current road day accepts analytics writes; archive and random replay play never call the analytics endpoints, and a direct request for a past `gameNo` is rejected server-side. Writes are also rate-limited on both the client-supplied player id and the request's IP address.

## Development

GoldRoad follows Nuxt's supported Node releases (`22.12+`, `24.11+`, or
`26+`) and pins pnpm in `package.json`. Enable Corepack, then install the
dependencies and Chromium used by the browser smoke suite:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Main commands:
- `pnpm dev` — start the app locally
- `pnpm typecheck` — run Nuxt type checking
- `pnpm build` — create a production build
- `pnpm preview` — preview the Worker build locally
- `pnpm deploy` / `pnpm deploy:staging` — build and deploy the isolated staging Worker
- `pnpm deploy:production` — build and deploy the production Worker (only during the TLD cutover)
- `pnpm db:generate` — generate Drizzle migrations
- `pnpm db:migrate` — apply local D1 migrations
- `pnpm db:migrate:staging` — apply checked-in migrations to the remote staging D1
- `pnpm db:migrate:production` — apply checked-in migrations to the remote production D1
- `pnpm db:seed:local` — generate and load local seed puzzles
- `pnpm db:bootstrap:staging` — one-time, guarded bootstrap of an empty staging D1
- `pnpm db:bootstrap:production` — one-time, guarded production bootstrap; run only on launch day
- `pnpm test` — run unit/regression tests (Vitest)
- `pnpm verify:static` — run typecheck, unit/regression tests, and the production build
- `pnpm test:api` — reseed local D1 and run the API contract smoke checks against a dev server on port 3100
- `pnpm test:browser` — reseed local D1 and run the Playwright route smoke suite at desktop and mobile widths; it starts or reuses a dev server on port 3100
- `pnpm test:deployed:staging` — run a read-only smoke against `https://v2.playgoldroad.com`

### Release verification

Run the static gate first:

```sh
pnpm verify:static
```

Then keep the app running in one terminal:

```sh
pnpm dev --port 3100
```

Run the server and browser gates from a second terminal:

```sh
pnpm test:api
pnpm test:browser
```

The API gate covers current and archived roads, hint/session boundaries,
stats, expected error responses, and the intentional deep-archive 404 case.
The browser gate covers the live board and tutorial, Stats, Past Roads, and an
archived replay using Chromium at both 1280×900 and Pixel 7 widths. Both smoke
commands replace local D1 data with the deterministic development seed; do not
run them against local data you need to keep.

Remote deploys use Nitro's `cloudflare_module` preset and two explicit Wrangler
environments. Staging is `goldroad-v2-staging` with its own D1 database and is
served at `https://v2.playgoldroad.com`; production is
`goldroad-v2-production` with a separate, empty-until-launch D1 database. Never
deploy remotely without `--env staging` or `--env production` (the package
scripts include this). Keeping the databases separate lets staging rotate
through test roads without changing the production Road 1 launch date.

Staging blocks indexing in both page metadata and `robots.txt`. Canonical and
social image URLs are generated from the active request origin, so the same
build will use the TLD after cutover. The build output deployed by Wrangler is
`./.output/server/index.mjs`, with assets served from `./.output/public/`.

## Docs

The active root docs are:
- `README.md` — product and repo overview
- `ARCHITECTURE.md` — current technical and product source of truth
- `IMPLEMENTATION_PLAN.md` — prioritized issue tracker and rollout plan
- `DESIGN_SYSTEM.md` — design token and styling reference

## Legacy reference

The preserved legacy implementation and historical context live under `_archive/`. They are reference material only and are no longer the active source of truth for v2.
