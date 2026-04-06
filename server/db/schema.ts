/**
 * Drizzle schema for GoldRoad v2 — targeting Cloudflare D1 (SQLite dialect).
 *
 * Three tables:
 *   games               — puzzle definitions + aggregate outcome counts
 *   player_game_session — one row per anonymous player per game (analytics)
 *   daily_game_stats    — pre-aggregated daily counters (fast reads for stats page)
 *
 * The optimal paths (gold routes) are stored in `games.optimal_path_json` and are
 * NEVER returned to the client — only used server-side for hint computation.
 */

import { sql } from 'drizzle-orm'
import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// games
// ---------------------------------------------------------------------------

export const games = sqliteTable('games', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  gameNo:          integer('game_no').notNull().unique(),

  /** Full Board JSON (tiles + edges + start/end). Served to client. */
  boardJson:       text('board_json').notNull(),

  /**
   * Array of all gold route paths (each path is an array of tile IDs).
   * Server-side only — used exclusively for hint computation.
   */
  optimalPathJson: text('optimal_path_json').notNull(),

  maxScore:        integer('max_score').notNull(),
  /** Sum of all tile values on the board (upper bound if player collected everything). */
  totalCoins:      integer('total_coins').notNull(),
  difficultyBand:  text('difficulty_band', { enum: ['easy', 'medium', 'hard'] }).notNull(),

  /** Number of distinct valid routes (informational / difficulty metadata). */
  routeCount:      integer('route_count').notNull().default(0),
  /** Coin gap between gold and silver route. */
  goldSilverGap:   integer('gold_silver_gap').notNull().default(0),

  active:          integer('active', { mode: 'boolean' }).notNull().default(false),
  current:         integer('current', { mode: 'boolean' }).notNull().default(false),

  playableAt:      text('playable_at').notNull(),   // ISO-8601
  nextGameAt:      text('next_game_at'),             // ISO-8601, null until rotation

  // Aggregate outcome counts — incremented by /api/session/end
  playsCount:      integer('plays_count').notNull().default(0),
  goldCount:       integer('gold_count').notNull().default(0),
  silverCount:     integer('silver_count').notNull().default(0),
  bronzeCount:     integer('bronze_count').notNull().default(0),
  finishedCount:   integer('finished_count').notNull().default(0),

  createdAt:       text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:       text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ---------------------------------------------------------------------------
// player_game_session
// ---------------------------------------------------------------------------

export const playerGameSession = sqliteTable('player_game_session', {
  id:            integer('id').primaryKey({ autoIncrement: true }),

  /** Random UUID stored in the player's localStorage. Not linked to any account. */
  playerId:      text('player_id').notNull(),
  gameNo:        integer('game_no').notNull(),

  /** Per-tab session UUID — allows multiple device sessions per player per game. */
  sessionId:     text('session_id').notNull().unique(),

  startedAt:     text('started_at').notNull(),   // ISO-8601
  finishedAt:    text('finished_at'),            // null until run ends

  attempts:      integer('attempts').notNull().default(1),
  bestScore:     integer('best_score'),
  maxScore:      integer('max_score').notNull(),

  /** Final tier of the best completed run this session. */
  outcomeTier:   text('outcome_tier', {
    enum: ['gold', 'silver', 'bronze', 'finished', 'unfinished'],
  }),

  completed:     integer('completed', { mode: 'boolean' }).notNull().default(false),
  gold:          integer('gold', { mode: 'boolean' }).notNull().default(false),

  hintsLevel1:   integer('hints_level_1').notNull().default(0),
  hintsLevel2:   integer('hints_level_2').notNull().default(0),
  hintsLevel3:   integer('hints_level_3').notNull().default(0),

  /** Whether the player opened the Past Roads list during this session. */
  pastRoadViewed: integer('past_road_viewed', { mode: 'boolean' }).notNull().default(false),

  createdAt:     text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ---------------------------------------------------------------------------
// daily_game_stats
// ---------------------------------------------------------------------------

/**
 * Pre-aggregated counters for the Yesterday's Performance block on the Stats
 * page. Updated by /api/session/end — fast to query with a single row lookup.
 */
export const dailyGameStats = sqliteTable('daily_game_stats', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  gameNo:              integer('game_no').notNull().unique(),

  plays:               integer('plays').notNull().default(0),
  completions:         integer('completions').notNull().default(0),
  goldCompletions:     integer('gold_completions').notNull().default(0),
  silverCompletions:   integer('silver_completions').notNull().default(0),
  bronzeCompletions:   integer('bronze_completions').notNull().default(0),
  totalAttempts:       integer('total_attempts').notNull().default(0),

  hintLevel1Uses:      integer('hint_level_1_uses').notNull().default(0),
  hintLevel2Uses:      integer('hint_level_2_uses').notNull().default(0),
  hintLevel3Uses:      integer('hint_level_3_uses').notNull().default(0),

  /** Stored as a float (0–100). Recomputed on each /api/session/end write. */
  completionRate:      real('completion_rate'),
  pastRoadsOpened:     integer('past_roads_opened').notNull().default(0),

  updatedAt:           text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ---------------------------------------------------------------------------
// Inferred TypeScript types (used across server handlers)
// ---------------------------------------------------------------------------

export type Game              = typeof games.$inferSelect
export type NewGame           = typeof games.$inferInsert
export type PlayerGameSession = typeof playerGameSession.$inferSelect
export type NewPlayerGameSession = typeof playerGameSession.$inferInsert
export type DailyGameStats    = typeof dailyGameStats.$inferSelect
