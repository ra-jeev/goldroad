ALTER TABLE `player_game_session` ADD `dead_end_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_game_session` ADD `wrong_exit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_game_stats` ADD `dead_end_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_game_stats` ADD `wrong_exit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
