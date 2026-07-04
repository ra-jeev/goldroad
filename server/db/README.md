# Migration workflow

GoldRoad uses Drizzle ORM against Cloudflare D1 (SQLite dialect). Migrations
live in `server/db/migrations/*.sql`, with Drizzle-kit's bookkeeping in
`server/db/migrations/meta/` (`_journal.json` + one `NNNN_snapshot.json` per
applied migration).

## `pnpm db:generate` vs hand-written SQL

- **Default path — `pnpm db:generate`:** whenever a schema change can be
  expressed purely as a `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` diff
  against `server/db/schema.ts`, edit the schema and run
  `pnpm db:generate`. This appends a new numbered `.sql` file and matching
  `meta/NNNN_snapshot.json` + `_journal.json` entry automatically. Prefer
  this path — it is what keeps the metadata in sync in the first place.
- **Hand-written SQL:** only needed when a change can't be expressed as a
  pure schema diff — e.g. a one-off data backfill/`UPDATE`, a rename that
  drizzle-kit would otherwise model as drop+create, or multi-statement
  cleanup like `0006_player_road_analytics.sql` (table drops + a data reset
  UPDATE in the same migration). If you hand-write a migration:
  1. Write the `.sql` file with the next sequential number.
  2. **Also hand-construct the matching `meta/NNNN_snapshot.json`** (a full
     copy of the previous snapshot with your DDL changes applied) **and add
     the corresponding entry to `meta/_journal.json`** (`idx`, `tag`, a
     `when` timestamp, `version: "6"`, `breakpoints: true`).
  3. Verify with `pnpm db:generate` afterwards — it should report
     `No schema changes, nothing to migrate`. If it instead tries to
     recreate tables/columns from your hand-written migration, the snapshot
     you added doesn't match `schema.ts` yet — fix the snapshot, not the
     already-applied `.sql` file.
- Never edit or renumber an already-applied migration `.sql` file. Once a
  migration has shipped (applied against any real D1 instance), treat it as
  immutable; make corrections via a new migration.

## When to regenerate seed data

`pnpm db:seed:local` runs `scripts/generate-dev-seed.ts` (which calls the
puzzle generator to produce fresh `games` rows) and then loads the result
into the local D1 instance. Regenerate seed data whenever:

- the `games` or `player_road_analytics` schema changes shape (new/removed
  columns the seed script's `INSERT` lists don't account for), or
- the puzzle generator's output shape changes (e.g. `optimal_paths_json` or
  `board_json` structure), since the seed script embeds live generator
  output rather than static fixtures.

`pnpm db:migrate` (fresh `wrangler d1 migrations apply --local`) followed by
`pnpm db:seed:local` is the standard way to get a clean local dev database
from scratch.
