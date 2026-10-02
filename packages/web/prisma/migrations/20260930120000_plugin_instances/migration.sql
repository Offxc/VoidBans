-- CreateTable
CREATE TABLE `plugin_instances` (
    `serverId` VARCHAR(64) NOT NULL,
    `pluginVersion` VARCHAR(32) NOT NULL,
    `platform` VARCHAR(128) NOT NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`serverId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
