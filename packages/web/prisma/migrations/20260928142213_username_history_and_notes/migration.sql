-- CreateTable
CREATE TABLE `username_history` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `playerUuid` CHAR(36) NOT NULL,
    `username` VARCHAR(16) NOT NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `username_history_playerUuid_idx`(`playerUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `player_notes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `playerUuid` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `authorDiscordId` VARCHAR(32) NOT NULL,
    `authorUsername` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `player_notes_playerUuid_idx`(`playerUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `username_history` ADD CONSTRAINT `username_history_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `player_notes` ADD CONSTRAINT `player_notes_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;
