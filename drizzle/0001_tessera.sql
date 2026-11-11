CREATE TABLE `tessera_audit` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traveler_id` text NOT NULL,
	`card_id` text,
	`actor` text NOT NULL,
	`actor_role` text NOT NULL,
	`facility` text,
	`scope` text,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text,
	`seeded` integer DEFAULT 0 NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tessera_audit_traveler` ON `tessera_audit` (`traveler_id`,`seq`);--> statement-breakpoint
CREATE TABLE `tessera_cards` (
	`card_id` text PRIMARY KEY NOT NULL,
	`traveler_id` text NOT NULL,
	`serial_number` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`replaced_by` text,
	`pass_last_updated` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tessera_cards_serial_number_unique` ON `tessera_cards` (`serial_number`);--> statement-breakpoint
CREATE INDEX `tessera_cards_traveler` ON `tessera_cards` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `tessera_records` (
	`id` text PRIMARY KEY NOT NULL,
	`traveler_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`facility` text,
	`body` text,
	`summary` text,
	`simulated` integer DEFAULT 0 NOT NULL,
	`r2_key` text,
	`content_type` text,
	`size` integer,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tessera_records_traveler` ON `tessera_records` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `tessera_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`traveler_id` text NOT NULL,
	`card_id` text NOT NULL,
	`clinician` text NOT NULL,
	`role` text NOT NULL,
	`facility` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`decided` text
);
--> statement-breakpoint
CREATE INDEX `tessera_requests_traveler` ON `tessera_requests` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `tessera_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`traveler_id` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	`revoked` text
);
--> statement-breakpoint
CREATE TABLE `tessera_travelers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`dob` text NOT NULL,
	`profile` text NOT NULL,
	`privacy` text NOT NULL,
	`language` text NOT NULL,
	`auto_approve` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER `tessera_audit_no_update` BEFORE UPDATE ON `tessera_audit` BEGIN SELECT RAISE(ABORT, 'tessera_audit is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `tessera_audit_no_delete` BEFORE DELETE ON `tessera_audit` BEGIN SELECT RAISE(ABORT, 'tessera_audit is append-only'); END;
