-- Deduplicate event_sources before adding the UNIQUE(url) constraint.
-- A non-idempotent startup seed (INSERT IGNORE against a url key that never
-- existed) accumulated one extra copy of every default source on each restart.
-- Keep the lowest id per url as canonical, repoint references to it, drop the
-- rest, then enforce uniqueness so the seed and sources.add are truly idempotent.

-- Repoint events to the canonical source row (no FKs in this schema).
UPDATE `events` e
JOIN `event_sources` s ON e.`sourceId` = s.`id`
JOIN (SELECT `url`, MIN(`id`) AS keep_id FROM `event_sources` GROUP BY `url`) k ON s.`url` = k.`url`
SET e.`sourceId` = k.keep_id
WHERE e.`sourceId` <> k.keep_id;--> statement-breakpoint

-- Repoint scrape logs to the canonical source row.
UPDATE `scrape_logs` l
JOIN `event_sources` s ON l.`sourceId` = s.`id`
JOIN (SELECT `url`, MIN(`id`) AS keep_id FROM `event_sources` GROUP BY `url`) k ON s.`url` = k.`url`
SET l.`sourceId` = k.keep_id
WHERE l.`sourceId` <> k.keep_id;--> statement-breakpoint

-- Drop the non-canonical duplicate sources.
DELETE s FROM `event_sources` s
JOIN (SELECT `url`, MIN(`id`) AS keep_id FROM `event_sources` GROUP BY `url`) k ON s.`url` = k.`url`
WHERE s.`id` <> k.keep_id;--> statement-breakpoint

ALTER TABLE `event_sources` MODIFY COLUMN `url` varchar(768) NOT NULL;--> statement-breakpoint
ALTER TABLE `event_sources` ADD CONSTRAINT `event_sources_url_idx` UNIQUE(`url`);
