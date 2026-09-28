-- CreateTable
CREATE TABLE `players` (
    `uuid` CHAR(36) NOT NULL,
    `username` VARCHAR(16) NOT NULL,
    `lastSeenUsername` VARCHAR(16) NOT NULL,
    `firstJoined` DATETIME(3) NOT NULL,
    `lastLogin` DATETIME(3) NULL,
    `lastLogout` DATETIME(3) NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,

    INDEX `players_username_idx`(`username`),
    INDEX `players_isOnline_idx`(`isOnline`),
    PRIMARY KEY (`uuid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `playerUuid` CHAR(36) NOT NULL,
    `loginAt` DATETIME(3) NOT NULL,
    `logoutAt` DATETIME(3) NULL,
    `durationSeconds` INTEGER NULL,
    `serverId` VARCHAR(64) NOT NULL,

    INDEX `sessions_playerUuid_idx`(`playerUuid`),
    INDEX `sessions_loginAt_idx`(`loginAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punishments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicBanId` VARCHAR(16) NOT NULL,
    `playerUuid` CHAR(36) NOT NULL,
    `type` ENUM('BAN', 'MUTE', 'KICK', 'WARN') NOT NULL,
    `reason` TEXT NOT NULL,
    `templateId` BIGINT NULL,
    `staffDiscordId` VARCHAR(32) NULL,
    `staffUsername` VARCHAR(64) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `revokedBy` VARCHAR(32) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokeReason` TEXT NULL,
    `appealable` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `punishments_publicBanId_key`(`publicBanId`),
    INDEX `punishments_playerUuid_idx`(`playerUuid`),
    INDEX `punishments_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appeals` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `punishmentId` BIGINT NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answers` JSON NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DENIED') NOT NULL DEFAULT 'PENDING',
    `staffResponse` TEXT NULL,
    `resolvedByDiscordId` VARCHAR(32) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `autoRevoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `appeals_punishmentId_key`(`punishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appeal_questions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `prompt` VARCHAR(280) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punishment_templates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `type` ENUM('BAN', 'MUTE', 'KICK', 'WARN') NOT NULL,
    `defaultReason` TEXT NOT NULL,
    `defaultDuration` INTEGER NULL,
    `defaultAppealable` BOOLEAN NOT NULL DEFAULT false,
    `createdByDiscordId` VARCHAR(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `discordRoleId` VARCHAR(32) NOT NULL,
    `discordRoleName` VARCHAR(100) NOT NULL,
    `displayName` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NULL,
    `isOwnerRole` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `staff_roles_discordRoleId_key`(`discordRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_permissions` (
    `roleId` BIGINT NOT NULL,
    `permissionKey` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_users` (
    `discordId` VARCHAR(32) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `avatarHash` VARCHAR(64) NULL,
    `discordRoles` JSON NOT NULL,
    `isOwner` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,

    PRIMARY KEY (`discordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorDiscordId` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `targetType` VARCHAR(64) NOT NULL,
    `targetId` VARCHAR(64) NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_actorDiscordId_idx`(`actorDiscordId`),
    INDEX `audit_log_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punishments` ADD CONSTRAINT `punishments_playerUuid_fkey` FOREIGN KEY (`playerUuid`) REFERENCES `players`(`uuid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punishments` ADD CONSTRAINT `punishments_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `punishment_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appeals` ADD CONSTRAINT `appeals_punishmentId_fkey` FOREIGN KEY (`punishmentId`) REFERENCES `punishments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_permissions` ADD CONSTRAINT `staff_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `staff_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
