CREATE TABLE `event_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` int NOT NULL,
	`status` enum('interested','going') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_attendance_user_event_idx` UNIQUE(`userId`,`eventId`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `submittedByUserId` int;--> statement-breakpoint
CREATE INDEX `event_attendance_event_idx` ON `event_attendance` (`eventId`);