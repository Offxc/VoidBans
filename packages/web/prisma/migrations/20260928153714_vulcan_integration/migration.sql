-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `clientBrand` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `violation_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `playerUuid` CHAR(36) NOT NULL,
    `checkName` VARCHAR(64) NOT NULL,
    `category` VARCHAR(64) NOT NULL,
    `violationLevel` INTEGER NOT NULL,
    `info` TEXT NULL,
    `punished` BOOLEAN NOT NULL DEFAULT false,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `violation_events_playerUuid_idx`(`playerUuid`),
    INDEX `violation_events_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `violation_events` ADD CONSTRAINT `violation_events_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;
