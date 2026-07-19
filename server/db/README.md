# Migration workflow

GoldRoad uses Drizzle ORM against Cloudflare D1. The active schema is represented
by the squashed migration `server/db/migrations/0000_goofy_jocasta.sql` and its
Drizzle metadata. Do not refer to or recreate the retired pre-squash migration
chain.

## Environments

Wrangler has three binding sets:

- top level: local Wrangler/Nitro development only
- `staging`: Worker `goldroad-v2-staging`, D1 `goldroad-v2-staging`
- `production`: Worker `goldroad-v2-production`, D1 `goldroad-v2-production`

The two remote databases are intentionally independent. Staging can rotate
through test roads while production stays empty until the real TLD launch.
Remote D1 commands must include both `--remote` and the intended `--env`; use
the package scripts instead of assembling the command by hand.

## Commands

```sh
# Local
pnpm db:migrate
pnpm db:seed:local

# Staging
pnpm db:migrate:staging
pnpm db:bootstrap:staging  # one time on an empty games table
pnpm deploy:staging

# Production cutover
pnpm db:migrate:production
pnpm db:bootstrap:production  # one time, immediately before first deploy
pnpm deploy:production
```

`scripts/bootstrap-road-pool.ts` accepts only the checked-in staging and
production name/environment pairs and refuses to run if `games` has any rows.
It creates Road 1 as current plus the five future road days expected by the cron
rotation contract. Production bootstrap is deliberately deferred so Road 1's
`playableAt` and `nextGameAt` are anchored to the actual launch day.

## Schema changes

For ordinary schema changes, edit `server/db/schema.ts` and run
`pnpm db:generate`. Commit the new numbered migration and generated Drizzle
metadata together. Use hand-written SQL only when a change cannot be expressed
as a schema diff, and keep the matching snapshot/journal metadata in sync.

Never edit or renumber a migration once it has been applied to either remote
database. Correct it with a new migration.

Regenerate local seed data when the game schema or puzzle output shape changes.
`pnpm db:seed:local` replaces local development data; it is never a remote
deployment command.
