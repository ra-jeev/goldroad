DROP TABLE IF EXISTS `player_game_session`;--> statement-breakpoint
DROP TABLE IF EXISTS `daily_game_stats`;--> statement-breakpoint
DROP TABLE IF EXISTS `player_road_analytics`;--> statement-breakpoint
CREATE TABLE `player_road_analytics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `player_id` text NOT NULL,
  `game_no` integer NOT NULL,
  `puzzle_type` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `solved` integer DEFAULT false NOT NULL,
  `hints_used` integer DEFAULT 0 NOT NULL,
  `attempts_before_first_hint` integer,
  `first_hint_move_index` integer,
  `solve_time_ms` integer,
  `dead_end_count` integer DEFAULT 0 NOT NULL,
  `wrong_exit_count` integer DEFAULT 0 NOT NULL,
  `last_played_at` text NOT NULL,
  `solved_at` text,
  `solve_session_id` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `player_road_analytics_player_game_mode_unique` ON `player_road_analytics` (`player_id`,`game_no`,`puzzle_type`);--> statement-breakpoint
CREATE INDEX `player_road_analytics_game_mode_idx` ON `player_road_analytics` (`game_no`,`puzzle_type`);--> statement-breakpoint
UPDATE `games`
SET
  `plays_count` = 0,
  `gold_count` = 0,
  `silver_count` = 0,
  `bronze_count` = 0,
  `finished_count` = 0,
  `updated_at` = (datetime('now'));
