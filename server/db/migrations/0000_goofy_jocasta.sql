CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_no` integer NOT NULL,
	`puzzle_type` text DEFAULT 'classic' NOT NULL,
	`board_json` text NOT NULL,
	`optimal_paths_json` text NOT NULL,
	`max_score` integer NOT NULL,
	`total_coins` integer NOT NULL,
	`difficulty_band` text NOT NULL,
	`gold_silver_gap` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`current` integer DEFAULT false NOT NULL,
	`playable_at` text NOT NULL,
	`next_game_at` text,
	`plays_count` integer DEFAULT 0 NOT NULL,
	`gold_count` integer DEFAULT 0 NOT NULL,
	`silver_count` integer DEFAULT 0 NOT NULL,
	`bronze_count` integer DEFAULT 0 NOT NULL,
	`finished_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_game_no_puzzle_type_unique` ON `games` (`game_no`,`puzzle_type`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_road_analytics_player_game_mode_unique` ON `player_road_analytics` (`player_id`,`game_no`,`puzzle_type`);--> statement-breakpoint
CREATE INDEX `player_road_analytics_game_mode_idx` ON `player_road_analytics` (`game_no`,`puzzle_type`);