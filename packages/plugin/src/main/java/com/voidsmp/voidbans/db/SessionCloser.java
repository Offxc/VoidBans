package com.voidsmp.voidbans.db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

/**
 * Closes sessions the normal quit event never got to, a crash, a restart,
 * a player rejoining before their last quit was processed. Without this a
 * session keeps logoutAt = NULL forever and the dashboard shows it as
 * still running.
 */
public final class SessionCloser {

    private SessionCloser() {}

    /** Closes every open session this player has on this server. */
    public static void closeForPlayer(Connection conn, String uuid, String serverId) throws SQLException {
        String sql = """
            UPDATE sessions
            SET logoutAt = NOW(), durationSeconds = GREATEST(0, TIMESTAMPDIFF(SECOND, loginAt, NOW()))
            WHERE playerUuid = ? AND serverId = ? AND logoutAt IS NULL
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, serverId);
            ps.executeUpdate();
        }
    }

    /**
     * Runs once at startup, before this server's first heartbeat. Anything
     * still open for this server belongs to a previous run that stopped
     * without closing it. The last heartbeat the old run sent is the best
     * available end time (accurate to ~30s). Sessions with no heartbeat to
     * go on, or that began after it, stay open with an unknown end rather
     * than being given an invented one, the dashboard shows those as
     * "Not recorded".
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
                WHERE serverId = ? AND logoutAt IS NULL AND loginAt <= ?
                """;
            try (PreparedStatement ps = conn.prepareStatement(close)) {
                ps.setTimestamp(1, lastSeen);
                ps.setTimestamp(2, lastSeen);
                ps.setString(3, serverId);
                ps.setTimestamp(4, lastSeen);
                ps.executeUpdate();
            }
        }
    }
}
