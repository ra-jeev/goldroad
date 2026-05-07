ALTER TABLE `player_game_session` ADD `hints_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_game_session` ADD `attempts_before_first_hint` integer;--> statement-breakpoint
ALTER TABLE `player_game_session` ADD `first_hint_move_index` integer;--> statement-breakpoint
ALTER TABLE `daily_game_stats` ADD `hint_uses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
