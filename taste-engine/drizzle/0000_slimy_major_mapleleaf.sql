CREATE TABLE `taste_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`telegram_file_id` text,
	`media_key` text,
	`media_type` text,
	`title` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`aspect` text,
	`intent` text,
	`status` text DEFAULT 'awaiting_aspect' NOT NULL,
	`analysis_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `telegram_owners` (
	`telegram_user_id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`username` text,
	`first_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
