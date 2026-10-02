-- Repairs session lengths inflated by plugin 0.2.0 (see CHANGELOG.md).
--
-- 0.2.0 closed every old, never-closed session with the current time, so a
-- session from last week could get a length of days. This finds those and
-- marks them as "Not recorded". Sessions are only touched if they are
-- clearly wrong:
--   - a later session by the same player had already started when this one
--     supposedly ended (a player can't be on twice), or
--   - it is longer than 6 hours and was closed at the moment the player's
--     next session began, or at a startup heartbeat time (fractional seconds).
-- Real sessions, including long ones, are left alone.
--
-- Preview (changes nothing):
--   docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" voidbans' < deploy/repair-sessions.sql
-- Apply:
--   (echo "SET @apply = 1;"; cat deploy/repair-sessions.sql) | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" voidbans'

SET @apply = COALESCE(@apply, 0);

DROP TEMPORARY TABLE IF EXISTS bad_sessions;
CREATE TEMPORARY TABLE bad_sessions AS
SELECT DISTINCT s.id
FROM sessions s
WHERE s.durationSeconds IS NOT NULL
  AND s.logoutAt IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM sessions n
      WHERE n.playerUuid = s.playerUuid AND n.serverId = s.serverId
        AND n.loginAt > s.loginAt AND n.loginAt < s.logoutAt
    )
    OR (
      s.durationSeconds > 21600
      AND (
        MICROSECOND(s.logoutAt) <> 0
        OR EXISTS (
          SELECT 1 FROM sessions n
          WHERE n.playerUuid = s.playerUuid AND n.serverId = s.serverId
            AND n.loginAt > s.loginAt AND n.loginAt <= TIMESTAMPADD(SECOND, 3, s.logoutAt)
        )
      )
    )
  );

SELECT COUNT(*) AS sessions_to_repair,
       ROUND(COALESCE(SUM(s.durationSeconds), 0) / 3600, 1) AS hours_removed
FROM sessions s JOIN bad_sessions b ON b.id = s.id;

SELECT s.id, p.username, s.loginAt, s.logoutAt, ROUND(s.durationSeconds / 3600, 1) AS hours
FROM sessions s
JOIN bad_sessions b ON b.id = s.id
JOIN players p ON p.uuid = s.playerUuid
ORDER BY s.durationSeconds DESC
LIMIT 25;

UPDATE sessions s
JOIN bad_sessions b ON b.id = s.id
SET s.logoutAt = s.loginAt, s.durationSeconds = NULL
WHERE @apply = 1;

SELECT IF(@apply = 1, 'Applied.', 'Preview only. Nothing was changed.') AS result;
DROP TEMPORARY TABLE bad_sessions;
