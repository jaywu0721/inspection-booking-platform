ALTER TABLE `bookingLinks` DROP INDEX `booking_links_project_type_unique`;--> statement-breakpoint
ALTER TABLE `bookingSlots` ADD `isPrivate` boolean DEFAULT false NOT NULL;
