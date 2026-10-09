ALTER TABLE `residents` ADD `name` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `residents` SET `name` = COALESCE(`note`, '');--> statement-breakpoint
ALTER TABLE `residents` DROP INDEX `residents_project_unit_phone_unique`;--> statement-breakpoint
ALTER TABLE `residents` ADD CONSTRAINT `residents_project_unit_phone_name_unique` UNIQUE(`projectId`,`unitNumber`,`phoneNumber`,`name`);
