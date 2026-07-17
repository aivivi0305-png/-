CREATE TABLE `telegram_updates` (
	`update_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DELETE FROM `taste_entries`
WHERE `telegram_file_id` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`)
    FROM `taste_entries`
    WHERE `telegram_file_id` IS NOT NULL
    GROUP BY `owner_id`, `telegram_file_id`
  );
--> statement-breakpoint
DELETE FROM `taste_entries`
WHERE `source_type` = 'url'
  AND `source_url` IS NOT NULL
  AND `id` NOT IN (
    SELECT MIN(`id`)
    FROM `taste_entries`
    WHERE `source_type` = 'url' AND `source_url` IS NOT NULL
    GROUP BY `owner_id`, `source_url`
  );
