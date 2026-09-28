-- AlterTable
ALTER TABLE `punishments` ADD COLUMN `ipAddress` VARCHAR(45) NULL,
    ADD COLUMN `ipBanned` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `ipAddress` VARCHAR(45) NULL;

-- CreateIndex
CREATE INDEX `punishments_ipAddress_idx` ON `punishments`(`ipAddress`);

-- CreateIndex
CREATE INDEX `sessions_ipAddress_idx` ON `sessions`(`ipAddress`);
