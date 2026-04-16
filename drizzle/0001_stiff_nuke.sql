CREATE TABLE `adminCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(120) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminCredentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `bookingLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` enum('initial','reinspect') NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`disabledReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookingLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_links_project_type_unique` UNIQUE(`projectId`,`type`)
);
--> statement-breakpoint
CREATE TABLE `bookingReschedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`oldSlotId` int NOT NULL,
	`newSlotId` int NOT NULL,
	`note` text,
	`changedAtMs` bigint NOT NULL,
	`changedBy` varchar(120) NOT NULL,
	CONSTRAINT `bookingReschedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookingSlots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`slotDate` timestamp NOT NULL,
	`startLabel` varchar(20) NOT NULL,
	`endLabel` varchar(20) NOT NULL,
	`capacity` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookingSlots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`linkId` int NOT NULL,
	`residentId` int NOT NULL,
	`slotId` int NOT NULL,
	`bookingType` enum('initial','reinspect') NOT NULL,
	`unitNumberSnapshot` varchar(120) NOT NULL,
	`phoneNumberSnapshot` varchar(30) NOT NULL,
	`gmail` varchar(320) NOT NULL,
	`hasInspectionCompany` boolean NOT NULL DEFAULT false,
	`status` enum('booked','rescheduled','cancelled') NOT NULL DEFAULT 'booked',
	`internalNote` text,
	`createdAtMs` bigint NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`logoUrl` text NOT NULL,
	`contactPhone` varchar(50) NOT NULL,
	`contactEmail` varchar(320),
	`heroTitle` varchar(255) NOT NULL,
	`heroDescription` text NOT NULL,
	`inspectionFlow` text NOT NULL,
	`handoverFlow` text NOT NULL,
	`precautions` text NOT NULL,
	`faqItems` json NOT NULL,
	`contactWindow` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`unitFormatHint` varchar(255) NOT NULL,
	`houseNumberExample` varchar(255) NOT NULL,
	`address` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_company_slug_unique` UNIQUE(`companyId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `residents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`unitNumber` varchar(120) NOT NULL,
	`phoneNumber` varchar(30) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `residents_id` PRIMARY KEY(`id`),
	CONSTRAINT `residents_project_unit_phone_unique` UNIQUE(`projectId`,`unitNumber`,`phoneNumber`)
);
