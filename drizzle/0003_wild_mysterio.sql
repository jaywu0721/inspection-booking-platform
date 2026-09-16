ALTER TABLE `bookingSlots` ADD `uniquenessScope` varchar(64) DEFAULT 'public' NOT NULL;--> statement-breakpoint
UPDATE `bookingSlots` SET `uniquenessScope` = CONCAT('private-', `id`) WHERE `isPrivate` = true AND `uniquenessScope` = 'public';--> statement-breakpoint
ALTER TABLE `bookingSlots` DROP INDEX `booking_slots_link_datetime_unique`;--> statement-breakpoint
ALTER TABLE `bookingSlots` ADD CONSTRAINT `booking_slots_link_datetime_scope_unique` UNIQUE(`linkId`,`slotDate`,`startLabel`,`endLabel`,`uniquenessScope`);
