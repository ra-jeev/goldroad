CREATE TABLE `daily_game_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_no` integer NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`completions` integer DEFAULT 0 NOT NULL,
	`gold_completions` integer DEFAULT 0 NOT NULL,
	`silver_completions` integer DEFAULT 0 NOT NULL,
	`bronze_completions` integer DEFAULT 0 NOT NULL,
	`total_attempts` integer DEFAULT 0 NOT NULL,
	`hint_level_1_uses` integer DEFAULT 0 NOT NULL,
	`hint_level_2_uses` integer DEFAULT 0 NOT NULL,
	`hint_level_3_uses` integer DEFAULT 0 NOT NULL,
	`completion_rate` real,
	`past_roads_opened` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_game_stats_game_no_unique` ON `daily_game_stats` (`game_no`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_no` integer NOT NULL,
	`board_json` text NOT NULL,
	`optimal_path_json` text NOT NULL,
	`max_score` integer NOT NULL,
	`difficulty_band` text NOT NULL,
	`route_count` integer DEFAULT 0 NOT NULL,
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
CREATE UNIQUE INDEX `games_game_no_unique` ON `games` (`game_no`);--> statement-breakpoint
CREATE TABLE `player_game_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`game_no` integer NOT NULL,
	`session_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`best_score` integer,
	`max_score` integer NOT NULL,
	`outcome_tier` text,
	`completed` integer DEFAULT false NOT NULL,
	`gold` integer DEFAULT false NOT NULL,
	`hints_level_1` integer DEFAULT 0 NOT NULL,
	`hints_level_2` integer DEFAULT 0 NOT NULL,
	`hints_level_3` integer DEFAULT 0 NOT NULL,
	`past_road_viewed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_game_session_session_id_unique` ON `player_game_session` (`session_id`);