-- AlterTable
ALTER TABLE `staff_users` ADD COLUMN `minecraftUuid` CHAR(36) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `staff_users_minecraftUuid_key` ON `staff_users`(`minecraftUuid`);
