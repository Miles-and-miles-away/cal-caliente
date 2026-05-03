-- ⚠️ PRE-DEPLOY CHECK REQUIRED ⚠️
-- The third statement creates a UNIQUE constraint on `canonicalKey`. It will
-- FAIL if any duplicate canonicalKey rows exist in production. MySQL DDL is
-- not transactional, so a failure here leaves the events table with the
-- non-unique index dropped, the venueDateKey column added, and no replacement
-- — a half-migrated state that needs manual recovery.
--
-- BEFORE applying this migration, run:
--
--   SELECT canonicalKey, COUNT(*) AS cnt FROM events
--   WHERE canonicalKey IS NOT NULL
--   GROUP BY canonicalKey HAVING cnt > 1;
--
-- If empty: safe to apply. If non-empty: dedup first, e.g.
--
--   DELETE e1 FROM events e1
--   INNER JOIN events e2
--     ON e1.canonicalKey = e2.canonicalKey
--     AND e1.id < e2.id;
--
-- (`venueDateKey` doesn't need a check — it's a new column; no rows have a
-- value yet, and MySQL allows multiple NULLs in a UNIQUE index.)

DROP INDEX `events_canonical_key_idx` ON `events`;--> statement-breakpoint
ALTER TABLE `events` ADD `venueDateKey` varchar(64);--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_canonical_key_idx` UNIQUE(`canonicalKey`);--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_venue_date_key_idx` UNIQUE(`venueDateKey`);