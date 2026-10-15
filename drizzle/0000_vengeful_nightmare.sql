CREATE TABLE `passports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`token` text NOT NULL,
	`number` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL,
	`arrival` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passports_token_unique` ON `passports` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `passports_number_unique` ON `passports` (`number`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL
);
