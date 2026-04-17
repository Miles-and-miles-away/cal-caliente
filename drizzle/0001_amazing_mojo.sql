CREATE TABLE `event_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`sourceType` enum('facebook','instagram','rss','html','custom') NOT NULL DEFAULT 'html',
	`region` varchar(100) DEFAULT 'japan',
	`isActive` boolean NOT NULL DEFAULT true,
	`isUserAdded` boolean NOT NULL DEFAULT false,
	`lastScrapedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`externalId` varchar(255),
	`title` varchar(500) NOT NULL,
	`description` text,
	`danceStyle` enum('salsa','bachata','both','other'),
	`eventType` enum('social','workshop','performance','festival','class','other'),
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`venueName` varchar(500),
	`venueAddress` text,
	`city` varchar(100),
	`prefecture` varchar(100),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`nearestStation` varchar(200),
	`imageUrl` text,
	`sourceUrl` text,
	`price` varchar(200),
	`organizer` varchar(300),
	`isVerified` boolean NOT NULL DEFAULT false,
	`isCancelled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scrape_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`status` enum('success','error','partial') NOT NULL,
	`eventsFound` int NOT NULL DEFAULT 0,
	`eventsAdded` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scrape_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`city` varchar(100),
	`prefecture` varchar(100),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`maxDistanceKm` int DEFAULT 30,
	`nearestStation` varchar(200),
	`maxWalkMinutes` int DEFAULT 15,
	`danceStyleFilter` enum('salsa','bachata','both') DEFAULT 'both',
	`eventTypeFilters` text,
	`notificationsEnabled` boolean DEFAULT true,
	`notifyBeforeHours` int DEFAULT 24,
	`theme` enum('light','dark','system') DEFAULT 'system',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
