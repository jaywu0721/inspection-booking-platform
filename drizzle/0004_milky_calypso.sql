CREATE TABLE `statisticOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameKey` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `statisticOptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `statistic_options_link_name_key_unique` UNIQUE(`linkId`,`nameKey`)
);
--> statement-breakpoint
CREATE TABLE `statisticResponseHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`previousOptionId` int,
	`newOptionId` int NOT NULL,
	`previousOptionNameSnapshot` varchar(255),
	`newOptionNameSnapshot` varchar(255) NOT NULL,
	`changedByType` enum('resident','admin') NOT NULL,
	`changedByAdminUsername` varchar(120),
	`reason` text,
	`changedAtMs` bigint NOT NULL,
	CONSTRAINT `statisticResponseHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `statisticResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`projectId` int NOT NULL,
	`unitNumber` varchar(120) NOT NULL,
	`optionId` int NOT NULL,
	`lastChangedByType` enum('resident','admin') NOT NULL,
	`lastChangedByAdminUsername` varchar(120),
	`createdAtMs` bigint NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	CONSTRAINT `statisticResponses_id` PRIMARY KEY(`id`),
	CONSTRAINT `statistic_responses_link_unit_unique` UNIQUE(`linkId`,`unitNumber`)
);
--> statement-breakpoint
ALTER TABLE `bookingLinks` MODIFY COLUMN `type` enum('initial','reinspect');--> statement-breakpoint
ALTER TABLE `bookingLinks` ADD `mode` enum('inspection','statistics') DEFAULT 'inspection' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookingLinks` ADD `statisticsTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `bookingLinks` ADD `statisticsDescription` text;