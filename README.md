# GoldRoad

GoldRoad is a local-first daily route puzzle built with Nuxt, Cloudflare Workers, and D1.

The game is intentionally simple:
- one current road day at a time
- two puzzle modes per road day: Classic and Expedition
- exact-score solves only
- medals based on the number of attempts needed to exact-solve
- local browser storage for personal progress and history
- anonymous server analytics for global comparison and product tuning

This repository contains the active v2 implementation. Older rewrite notes and milestone planning docs have been retired in favor of the documents listed below.

## Product rules

These rules are the current source of truth:
- Classic and Expedition belong to the same road day.
- Classic is the primary live daily puzzle.
- Expedition unlocks from the live Classic solve flow.
- Past-road replay is day-based and should use the same dual-mode UI model as the live road.
- Solving means reaching the exit with the exact target score.
- Gold, Silver, and Bronze are based on solve attempt counts 1, 2, and 3.
- Personal stats stay local to the browser.
- Global comparison is powered by anonymous analytics only.
- Auth, account sync, and push notifications are intentionally out of scope.

## Current routes

The app currently exposes these main surfaces:
- `/` — current road day
- `/games` — recent past roads archive
- `/games/:gameNo` — past road day replay
- `/stats` — local stats plus global comparison

Planned surfaces:
- interactive tutorial / how-to-play experience
- lightweight About / Privacy / Contact surface

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
- live daily puzzle progress
- replay-only progress for archive and random roads
- local history used by the stats page
- lightweight settings and tutorial state

Replay progress is kept under a separate child key so archive/random play does not pollute daily stats or streak history.

Older split local-storage keys are treated as legacy and cleaned up on load.

### Anonymous server analytics

The server stores only the data needed for:
- global comparison surfaces
- puzzle difficulty tuning
- aggregate behavior tracking

It is not meant to be a user history or account-sync system.

## Development

Install dependencies with `pnpm install`.

Main commands:
- `pnpm dev` — start the app locally
- `pnpm typecheck` — run Nuxt type checking
- `pnpm build` — create a production build
- `pnpm preview` — preview the Worker build locally
- `pnpm db:generate` — generate Drizzle migrations
- `pnpm db:migrate` — apply local D1 migrations
- `pnpm db:seed:local` — generate and load local seed puzzles
- `pnpm test:api` — run the API smoke checks

## Docs

The active root docs are:
- `README.md` — product and repo overview
- `ARCHITECTURE.md` — current technical and product source of truth
- `IMPLEMENTATION_PLAN.md` — prioritized issue tracker and rollout plan
- `DESIGN_SYSTEM.md` — design token and styling reference

## Legacy reference

The preserved legacy implementation and historical context live under `_working_archive/`. They are reference material only and are no longer the active source of truth for v2.