-- bans.issue and bans.revoke are replaced by one permission per punishment type.
-- Existing roles keep exactly what they could do before: anything that had
-- bans.issue gets every issue permission, anything that had bans.revoke gets
-- every revoke permission. Then the old keys are removed.

INSERT IGNORE INTO `staff_permissions` (`roleId`, `permissionKey`)
SELECT p.`roleId`, k.`permissionKey`
FROM `staff_permissions` p
JOIN (
    SELECT 'punish.ban' AS `permissionKey`
    UNION ALL SELECT 'punish.temp_ban'
    UNION ALL SELECT 'punish.mute'
    UNION ALL SELECT 'punish.temp_mute'
    UNION ALL SELECT 'punish.kick'
) k
WHERE p.`permissionKey` = 'bans.issue';

INSERT IGNORE INTO `staff_permissions` (`roleId`, `permissionKey`)
SELECT p.`roleId`, k.`permissionKey`
FROM `staff_permissions` p
JOIN (
    SELECT 'punish.unban' AS `permissionKey`
    UNION ALL SELECT 'punish.unmute'
    UNION ALL SELECT 'punish.unkick'
) k
WHERE p.`permissionKey` = 'bans.revoke';

DELETE FROM `staff_permissions` WHERE `permissionKey` IN ('bans.issue', 'bans.revoke');
