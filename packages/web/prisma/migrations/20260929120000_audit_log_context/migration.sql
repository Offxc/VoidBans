-- AlterTable
ALTER TABLE `audit_log`
    MODIFY `actorDiscordId` VARCHAR(32) NULL,
    ADD COLUMN `actorUsername` VARCHAR(64) NULL,
    ADD COLUMN `outcome` VARCHAR(16) NOT NULL DEFAULT 'success',
    ADD COLUMN `ipAddress` VARCHAR(45) NULL,
    ADD COLUMN `userAgent` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `audit_log_action_idx` ON `audit_log`(`action`);

-- CreateIndex
CREATE INDEX `audit_log_targetType_targetId_idx` ON `audit_log`(`targetType`, `targetId`);
