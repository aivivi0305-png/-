CREATE TABLE `weekly_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`owner_id` text NOT NULL,
	`category` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`reason` text NOT NULL,
	`feedback` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weekly_recommendations_owner_idx` ON `weekly_recommendations` (`owner_id`);--> statement-breakpoint
CREATE INDEX `weekly_recommendations_report_idx` ON `weekly_recommendations` (`report_id`);--> statement-breakpoint
CREATE TABLE `weekly_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`week_key` text NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`profile_summary` text DEFAULT '' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reports_owner_week_idx` ON `weekly_reports` (`owner_id`,`week_key`);