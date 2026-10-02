package com.voidsmp.voidbans.db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

/**
 * Keeps the sessions table honest when the normal join/quit events aren't
 * the whole story: a crash, a restart, a player rejoining before their last
 * quit was processed.
 *
 * A session that is left open has no known end, and it must never be given
 * one by guessing from "now" later on: that is how an old session from last
 * week ends up with a 150 hour length. Such sessions are marked ended with
 * logoutAt = loginAt and a NULL duration. The dashboard shows that as "Not
 * recorded" and playtime totals skip it.
 */
public final class SessionCloser {

    /** A session still open at startup is only trusted if it began this recently before the last heartbeat. */
    private static final long MAX_CRASHED_SESSION_SECONDS = 24 * 3600;

    private SessionCloser() {}

    /** Marks every open session this player has on this server as ended at an unknown time. */
    public static void abandonOpen(Connection conn, String uuid, String serverId) throws SQLException {
        String sql = """
            UPDATE sessions SET logoutAt = loginAt, durationSeconds = NULL
            WHERE playerUuid = ? AND serverId = ? AND logoutAt IS NULL
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, serverId);
            ps.executeUpdate();
        }
    }

    /**
     * A player is leaving. Their newest open session is the one that just
     * ended and gets a real end time. Any older open session can't still be
     * running, so it is abandoned rather than closed with today's date.
     */
    public static void closeOnQuit(Connection conn, String uuid, String serverId) throws SQLException {
        long newestId = -1;
        String newest = """
            SELECT id FROM sessions
            WHERE playerUuid = ? AND serverId = ? AND logoutAt IS NULL
            ORDER BY loginAt DESC, id DESC LIMIT 1
            """;
        try (PreparedStatement ps = conn.prepareStatement(newest)) {
            ps.setString(1, uuid);
            ps.setString(2, serverId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) newestId = rs.getLong("id");
            }
        }
        if (newestId < 0) return;

        String abandonOlder = """
            UPDATE sessions SET logoutAt = loginAt, durationSeconds = NULL
            WHERE playerUuid = ? AND serverId = ? AND logoutAt IS NULL AND id <> ?
            """;
        try (PreparedStatement ps = conn.prepareStatement(abandonOlder)) {
            ps.setString(1, uuid);
            ps.setString(2, serverId);
            ps.setLong(3, newestId);
            ps.executeUpdate();
        }

        String close = """
            UPDATE sessions
            SET logoutAt = NOW(), durationSeconds = GREATEST(0, TIMESTAMPDIFF(SECOND, loginAt, NOW()))
            WHERE id = ?
            """;
        try (PreparedStatement ps = conn.prepareStatement(close)) {
            ps.setLong(1, newestId);
            ps.executeUpdate();
        }
    }

    /**
     * Runs once at startup, before this server's first heartbeat. Whatever is
     * still open for this server belongs to a previous run that stopped
     * without closing it. The last heartbeat that run sent is the best
     * available end time (accurate to about 30 seconds), but only for sessions
     * that began shortly before it. Anything older was already stale long
     * before that run ended, and anything newer than the heartbeat has no
     * reliable end at all, so those are abandoned. After this, nothing is
     * left open for this server.
     */
    public static void reconcileAfterRestart(Connection conn, String serverId) throws SQLException {
        Timestamp lastSeen = null;
        try (PreparedStatement ps = conn.prepareStatement("SELECT lastSeenAt FROM plugin_instances WHERE serverId = ?")) {
            ps.setString(1, serverId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) lastSeen = rs.getTimestamp("lastSeenAt");
            }
        }
        Timestamp endedAt = lastSeen != null ? lastSeen : new Timestamp(System.currentTimeMillis());

        // Players first, while their stale sessions still identify them.
        String offline = """
            UPDATE players SET isOnline = FALSE, lastLogout = ?
            WHERE isOnline = TRUE
              AND uuid IN (SELECT playerUuid FROM sessions WHERE serverId = ? AND logoutAt IS NULL)
            """;
        try (PreparedStatement ps = conn.prepareStatement(offline)) {
            ps.setTimestamp(1, endedAt);
            ps.setString(2, serverId);
            ps.executeUpdate();
        }

        if (lastSeen != null) {
            String close = """
                UPDATE sessions
                SET logoutAt = ?, durationSeconds = GREATEST(0, TIMESTAMPDIFF(SECOND, loginAt, ?))
                WHERE serverId = ? AND logoutAt IS NULL
                  AND loginAt <= ? AND loginAt >= TIMESTAMPADD(SECOND, ?, ?)
                """;
            try (PreparedStatement ps = conn.prepareStatement(close)) {
                ps.setTimestamp(1, lastSeen);
                ps.setTimestamp(2, lastSeen);
                ps.setString(3, serverId);
                ps.setTimestamp(4, lastSeen);
                ps.setLong(5, -MAX_CRASHED_SESSION_SECONDS);
                ps.setTimestamp(6, lastSeen);
                ps.executeUpdate();
            }
        }

        String abandon = """
            UPDATE sessions SET logoutAt = loginAt, durationSeconds = NULL
            WHERE serverId = ? AND logoutAt IS NULL
            """;
        try (PreparedStatement ps = conn.prepareStatement(abandon)) {
            ps.setString(1, serverId);
            ps.executeUpdate();
        }
    }
}
