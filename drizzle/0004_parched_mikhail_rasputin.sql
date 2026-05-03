ALTER TABLE `events` ADD `canonicalKey` varchar(64);--> statement-breakpoint
CREATE INDEX `events_canonical_key_idx` ON `events` (`canonicalKey`);