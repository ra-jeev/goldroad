/**
 * Drizzle schema for GoldRoad v2 — targeting Cloudflare D1 (SQLite dialect).
 *
 * Two active tables:
 *   games                 — puzzle definitions + lightweight aggregate counts
 *   player_road_analytics — anonymous per-player-per-road analytics rows
 *
 * The optimal paths (gold routes) are stored in `games.optimal_paths_json` and are
 * NEVER returned to the client — only used server-side for hint computation.
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// games
// ---------------------------------------------------------------------------

export const games = sqliteTable(
  'games',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gameNo: integer('game_no').notNull(),
    puzzleType: text('puzzle_type', { enum: ['classic', 'expedition'] })
      .notNull()
      .default('classic'),

    /** Full Board JSON (tiles + edges + start/end). Served to client. */
    boardJson: text('board_json').notNull(),

    /**
     * Array of all gold route paths (each path is an array of tile IDs).
     * Server-side only — used exclusively for hint computation.
     */
    optimalPathsJson: text('optimal_paths_json').notNull(),

    maxScore: integer('max_score').notNull(),
    /** Sum of all tile values on the board (upper bound if player collected everything). */
    totalCoins: integer('total_coins').notNull(),
    difficultyBand: text('difficulty_band', {
      enum: ['easy', 'medium', 'hard'],
    }).notNull(),

    /** Coin gap between gold and silver route. */
    goldSilverGap: integer('gold_silver_gap').notNull().default(0),

    active: integer('active', { mode: 'boolean' }).notNull().default(false),
    current: integer('current', { mode: 'boolean' }).notNull().default(false),

    playableAt: text('playable_at').notNull(), // ISO-8601
    nextGameAt: text('next_game_at'), // ISO-8601, null until rotation

    /**
     * Lightweight aggregate counts derived from per-player analytics.
     * These are updated only when a player's aggregate row changes meaningfully.
     */
    playsCount: integer('plays_count').notNull().default(0),
    goldCount: integer('gold_count').notNull().default(0),
    silverCount: integer('silver_count').notNull().default(0),
    bronzeCount: integer('bronze_count').notNull().default(0),
    finishedCount: integer('finished_count').notNull().default(0),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    gameNoPuzzleTypeIdx: uniqueIndex('games_game_no_puzzle_type_unique').on(
      table.gameNo,
      table.puzzleType,
    ),
  }),
);

// ---------------------------------------------------------------------------
// player_road_analytics
// ---------------------------------------------------------------------------

export const playerRoadAnalytics = sqliteTable(
  'player_road_analytics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Random UUID stored in the player's localStorage. Not linked to any account. */
    playerId: text('player_id').notNull(),
    gameNo: integer('game_no').notNull(),
    puzzleType: text('puzzle_type', {
      enum: ['classic', 'expedition'],
    }).notNull(),

    /** Attempts taken to solve once solved, otherwise the furthest attempt reached so far. */
    attempts: integer('attempts').notNull().default(0),
    solved: integer('solved', { mode: 'boolean' }).notNull().default(false),

    /** Total number of hints requested before the puzzle was solved. */
    hintsUsed: integer('hints_used').notNull().default(0),

    /** Number of completed attempts before the player asked for the first hint. */
    attemptsBeforeFirstHint: integer('attempts_before_first_hint'),

    /** Move index from the start tile (start tile = 0) when the first hint was requested. */
    firstHintMoveIndex: integer('first_hint_move_index'),

    /** Active solve duration in milliseconds for the exact solve, when available. */
    solveTimeMs: integer('solve_time_ms'),

    deadEndCount: integer('dead_end_count').notNull().default(0),
    wrongExitCount: integer('wrong_exit_count').notNull().default(0),

    lastPlayedAt: text('last_played_at').notNull(),
    solvedAt: text('solved_at'),
    solveSessionId: text('solve_session_id'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    playerGameModeIdx: uniqueIndex(
      'player_road_analytics_player_game_mode_unique',
    ).on(table.playerId, table.gameNo, table.puzzleType),
    gameModeIdx: index('player_road_analytics_game_mode_idx').on(
      table.gameNo,
      table.puzzleType,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types (used across server handlers)
// ---------------------------------------------------------------------------

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type PlayerRoadAnalytics = typeof playerRoadAnalytics.$inferSelect;
export type NewPlayerRoadAnalytics = typeof playerRoadAnalytics.$inferInsert;
