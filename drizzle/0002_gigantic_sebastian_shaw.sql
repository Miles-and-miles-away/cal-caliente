CREATE TABLE `event_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`status` enum('interested','attending','not_attending') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int,
	`userId` int,
	`adminId` int,
	`reason` text NOT NULL,
	`action` enum('flagged','approved','hidden','deleted','user_suspended') NOT NULL,
	`flaggedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`danceStyle` enum('salsa','bachata','zouk','kizomba','merengue','cha-cha-cha','cumbia','reggaeton','samba','tango','rumba','mambo','afro-latin','mixed','other') NOT NULL,
	`eventType` enum('social','workshop','performance','festival','class','congress','bootcamp','other') NOT NULL DEFAULT 'social',
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`venueName` varchar(500),
	`venueAddress` text,
	`city` varchar(100),
	`prefecture` varchar(100),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`imageUrl` text,
	`isShared` boolean NOT NULL DEFAULT false,
	`moderationStatus` enum('pending','approved','hidden') NOT NULL DEFAULT 'pending',
	`flaggedReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `danceStyle` enum('salsa','bachata','zouk','kizomba','merengue','cha-cha-cha','cumbia','reggaeton','samba','tango','rumba','mambo','afro-latin','mixed','other');--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `eventType` enum('social','workshop','performance','festival','class','congress','bootcamp','other');--> statement-breakpoint
ALTER TABLE `user_preferences` MODIFY COLUMN `danceStyleFilter` varchar(50) DEFAULT 'all';