-- CreateTable
CREATE TABLE `punishment_rules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(16) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('BAN', 'MUTE', 'KICK', 'WARN') NOT NULL,
    `defaultDuration` INTEGER NULL,
    `defaultAppealable` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdByDiscordId` VARCHAR(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `punishment_rules_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punishment_rule_links` (
    `punishmentId` BIGINT NOT NULL,
    `ruleId` BIGINT NOT NULL,

    INDEX `punishment_rule_links_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`punishmentId`, `ruleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `punishment_rule_links` ADD CONSTRAINT `punishment_rule_links_punishmentId_fkey` FOREIGN KEY (`punishmentId`) REFERENCES `punishments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punishment_rule_links` ADD CONSTRAINT `punishment_rule_links_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `punishment_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
