-- CreateTable
CREATE TABLE `player_attachments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `playerUuid` CHAR(36) NOT NULL,
    `punishmentId` BIGINT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `bytesSize` INTEGER NOT NULL,
    `caption` VARCHAR(280) NULL,
    `authorDiscordId` VARCHAR(32) NOT NULL,
    `authorUsername` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `player_attachments_playerUuid_idx`(`playerUuid`),
    INDEX `player_attachments_punishmentId_idx`(`punishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `player_attachments` ADD CONSTRAINT `player_attachments_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `player_attachments` ADD CONSTRAINT `player_attachments_punishmentId_fkey` FOREIGN KEY (`punishmentId`) REFERENCES `punishments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
