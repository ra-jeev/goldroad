ALTER TABLE `games` RENAME COLUMN "optimal_path_json" TO "optimal_paths_json";--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `route_count`;