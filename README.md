# GoldRoad

[GoldRoad](https://playgoldroad.com) is a daily number-path puzzle. Build a
self-avoiding route from the start to the finish and land exactly on the target
score.

Each road day has two puzzles:

- **Classic** is the familiar daily road.
- **Expedition** is a second, more challenging road.

Hints reveal the next step without giving away the complete route. Progress,
history, streaks, and personal stats stay in the browser; the server receives
anonymous gameplay events used for aggregate comparisons and puzzle tuning.

## Stack

- Nuxt 4 and Vue 3
- Nitro on Cloudflare Workers
- Cloudflare D1 with Drizzle ORM
- Vitest and Playwright
- pnpm

## Local development

Use a Nuxt-supported Node release (22.12+, 24.11+, or 26+) and enable Corepack:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed:local
pnpm dev
```

The local app is available at `http://localhost:3000` by default.

## Verification

Run the production gate before merging:

```sh
pnpm verify:static
```

This runs type checking, the unit and regression suite, and a production build.

The API and browser smoke suites use a deterministic local D1 seed and expect a
development server on port 3100:

```sh
pnpm dev --port 3100
```

Then, in another terminal:

```sh
pnpm test:api
pnpm test:browser
```

Both smoke commands replace local D1 data. Do not run them against local data
you need to preserve.

## Deployment

Cloudflare Workers Builds automatically verifies and deploys pushes to `main`.
Production deployment uses the `production` Wrangler environment.

Database migrations are deliberately separate from automatic deployment.
Review checked-in migrations and apply them before merging code that depends on
them:

```sh
pnpm db:migrate:production
```

Staging remains available for release testing:

```sh
pnpm db:migrate:staging
pnpm deploy:staging
pnpm test:deployed:staging
```

Never run the bootstrap commands against a populated database. They are guarded
for empty-database initialization and are not part of routine releases.

## License

See [LICENSE](LICENSE).
