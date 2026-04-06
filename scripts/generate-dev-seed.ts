import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generatePuzzle } from '../server/utils/puzzleGenerator'

function mulberry32(seed: number) {
  return function random() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toSqlString(value: string | null) {
  if (value === null) return 'NULL'
  return `'${value.replaceAll("'", "''")}'`
}

function buildInsertRow(gameNo: number, isCurrent: boolean, playableAt: string) {
  const puzzle = generatePuzzle()
  if (!puzzle) {
    throw new Error(`Failed to generate puzzle for game ${gameNo}`)
  }

  const nextGameAt = isCurrent ? new Date(new Date(playableAt).getTime() + 86400000).toISOString() : null

  return `(
  ${gameNo},
  ${toSqlString(JSON.stringify(puzzle.board))},
  ${toSqlString(JSON.stringify(puzzle.optimalPaths))},
  ${puzzle.maxScore},
  ${puzzle.totalCoins},
  ${toSqlString(puzzle.difficultyBand)},
  ${puzzle.goldSilverGap},
  1,
  ${isCurrent ? 1 : 0},
  ${toSqlString(playableAt)},
  ${toSqlString(nextGameAt)}
)`
}

const originalRandom = Math.random
Math.random = mulberry32(20260403)

try {
  const rows = [
    buildInsertRow(1, false, '2026-01-01T00:00:00.000Z'),
    buildInsertRow(2, false, '2026-01-02T00:00:00.000Z'),
    buildInsertRow(3, true, '2026-01-03T00:00:00.000Z'),
  ]

  const sql = `-- Local development seed data for GoldRoad API testing.
-- Generated from the current puzzle generator to keep maxScore/path consistent.

DELETE FROM player_game_session;
DELETE FROM daily_game_stats;
DELETE FROM games;

INSERT INTO games (
  game_no,
  board_json,
  optimal_path_json,
  max_score,
  total_coins,
  difficulty_band,
  route_count,
  gold_silver_gap,
  active,
  current,
  playable_at,
  next_game_at
) VALUES
${rows.join(',\n')};
`

  writeFileSync(resolve('server/db/seeds/dev_seed.sql'), sql, 'utf8')
  console.log('Generated server/db/seeds/dev_seed.sql')
} finally {
  Math.random = originalRandom
}
