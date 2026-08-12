CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`problem` text NOT NULL,
	`audience` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`category` text NOT NULL,
	`score` integer NOT NULL,
	`confidence` text NOT NULL,
	`evidence_count` integer DEFAULT 1 NOT NULL,
	`effort` text DEFAULT '7‑10 days' NOT NULL,
	`monetization` text DEFAULT 'Validate with users' NOT NULL,
	`status` text DEFAULT 'review' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_external_id_unique` ON `candidates` (`external_id`);