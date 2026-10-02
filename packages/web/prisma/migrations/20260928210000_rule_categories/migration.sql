-- CreateTable
CREATE TABLE `rule_categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed a placeholder category so any existing punishment_rules row (from
-- testing this feature before categories existed) has somewhere to land
--, the owner can rename/delete it from Settings once real categories
-- are created.
INSERT INTO `rule_categories` (`name`, `sortOrder`) VALUES ('Uncategorized', 0);

-- AlterTable: add categoryId (backfilled to the placeholder above), make
-- type optional and rename it to suggestedType, most rules don't
-- dictate a fixed punishment, severity is a staff judgment call at
-- punish time.
ALTER TABLE `punishment_rules`
    ADD COLUMN `categoryId` BIGINT NOT NULL DEFAULT 1,
    CHANGE COLUMN `type` `suggestedType` ENUM('BAN', 'MUTE', 'KICK', 'WARN') NULL;

ALTER TABLE `punishment_rules` ALTER COLUMN `categoryId` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `punishment_rules_categoryId_idx` ON `punishment_rules`(`categoryId`);

-- AddForeignKey
ALTER TABLE `punishment_rules` ADD CONSTRAINT `punishment_rules_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `rule_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
