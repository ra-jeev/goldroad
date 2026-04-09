DROP INDEX `daily_game_stats_game_no_unique`;--> statement-breakpoint
ALTER TABLE `daily_game_stats` ADD `puzzle_type` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_game_stats_game_no_puzzle_type_unique` ON `daily_game_stats` (`game_no`,`puzzle_type`);--> statement-breakpoint
DROP INDEX `games_game_no_unique`;--> statement-breakpoint
ALTER TABLE `games` ADD `puzzle_type` text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `games_game_no_puzzle_type_unique` ON `games` (`game_no`,`puzzle_type`);--> statement-breakpoint
ALTER TABLE `player_game_session` ADD `puzzle_type` text DEFAULT 'classic' NOT NULL;