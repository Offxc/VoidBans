package com.voidsmp.voidbans.state;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Active mutes for the players who are online, kept in memory so a chat
 * message doesn't cost a database query. Filled when a player joins and
 * refreshed every couple of seconds, which is how a mute issued or lifted
 * on the site takes effect.
 */
public final class MuteCache {

    public record Mute(String reason, String banId, Instant expiresAt) {}

    private final Map<UUID, Mute> mutes = new ConcurrentHashMap<>();

    /** The player's mute if it is still in force, otherwise null. */
    public Mute active(UUID uuid) {
        Mute mute = mutes.get(uuid);
        if (mute == null) return null;
        if (mute.expiresAt() != null && !mute.expiresAt().isAfter(Instant.now())) {
            mutes.remove(uuid, mute);
            return null;
        }
        return mute;
    }

    public void put(UUID uuid, Mute mute) {
        mutes.put(uuid, mute);
    }

    public void remove(UUID uuid) {
        mutes.remove(uuid);
    }

    /** Replaces what is cached for these players with what the database says now. */
    public void refresh(Connection conn, Collection<UUID> players) throws SQLException {
        Map<UUID, Mute> fresh = load(conn, players);
        for (UUID uuid : players) {
            Mute mute = fresh.get(uuid);
            if (mute != null) mutes.put(uuid, mute);
            else mutes.remove(uuid);
        }
    }

    private static Map<UUID, Mute> load(Connection conn, Collection<UUID> players) throws SQLException {
        Map<UUID, Mute> found = new HashMap<>();
        if (players.isEmpty()) return found;

        String placeholders = String.join(",", players.stream().map(p -> "?").toList());
        // Oldest first, so the newest mute is the one left in the map.
        String sql = "SELECT playerUuid, reason, publicBanId, expiresAt FROM punishments "
                + "WHERE type = 'MUTE' AND active = TRUE AND (expiresAt IS NULL OR expiresAt > NOW()) "
                + "AND playerUuid IN (" + placeholders + ") ORDER BY issuedAt ASC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int i = 1;
            for (UUID uuid : players) ps.setString(i++, uuid.toString());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Timestamp expires = rs.getTimestamp("expiresAt");
                    found.put(UUID.fromString(rs.getString("playerUuid")), new Mute(
                            rs.getString("reason"),
                            rs.getString("publicBanId"),
                            expires == null ? null : expires.toInstant()));
                }
            }
        }
        return found;
    }
}
