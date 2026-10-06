-- AlterTable
ALTER TABLE `punishments` ADD COLUMN `deliveredAt` DATETIME(3) NULL;

-- Nothing that already exists is waiting to be delivered.
UPDATE `punishments` SET `deliveredAt` = `issuedAt`;

-- A kick is a one-off event, not something that stays in force. Old kicks
-- were left "active" forever, which showed as a permanent punishment.
UPDATE `punishments` SET `active` = FALSE WHERE `type` = 'KICK';

-- With kicks never active there is nothing for punish.unkick to revoke.
DELETE FROM `staff_permissions` WHERE `permissionKey` = 'punish.unkick';
