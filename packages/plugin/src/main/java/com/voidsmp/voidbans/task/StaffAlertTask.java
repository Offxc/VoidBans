package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

/**
 * Polls the punishments table for rows created since the last check and
 * broadcasts a chat alert to online players holding the configured
 * permission (grant it via LuckPerms, see the README). This is how a
 * punishment issued through the WEB dashboard also produces an in-game
 * alert, not just ones issued with /vban, the plugin has no live
 * connection back from the website, so polling is the simplest way for it
 * to notice a row it didn't write itself.
 */
public final class StaffAlertTask extends BukkitRunnable {

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;

    private Instant lastSeenIssuedAt;
    private long lastSeenId;

    public StaffAlertTask(VoidBansPlugin plugin, Database db, MessageTemplate messages) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
        // Start from "now" so a restart never replays old punishments as
        // fresh alerts, only ones issued after the plugin came up.
        this.lastSeenIssuedAt = Instant.now();
        this.lastSeenId = 0L;
    }

    @Override
    public void run() {
        if (!plugin.getConfig().getBoolean("staff-alerts.enabled", true)) return;

        String permission = plugin.getConfig().getString("staff-alerts.permission", "voidbans.alerts.punishments");
        boolean anyoneListening = plugin.getServer().getOnlinePlayers().stream()
                .anyMatch(p -> p.hasPermission(permission));
        if (!anyoneListening) return; // skip the query entirely if nobody would see it

        try (var conn = db.getConnection()) {
            String sql = """
                SELECT p.id, p.type, p.reason, p.publicBanId, p.staffUsername, p.expiresAt, p.issuedAt,
                       pl.username AS playerUsername
                FROM punishments p
                JOIN players pl ON pl.uuid = p.playerUuid
                WHERE p.issuedAt > ? OR (p.issuedAt = ? AND p.id > ?)
                ORDER BY p.issuedAt ASC, p.id ASC
                LIMIT 50
                """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setTimestamp(1, Timestamp.from(lastSeenIssuedAt));
                ps.setTimestamp(2, Timestamp.from(lastSeenIssuedAt));
                ps.setLong(3, lastSeenId);

                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        broadcast(rs, permission);
                        lastSeenId = rs.getLong("id");
                        lastSeenIssuedAt = rs.getTimestamp("issuedAt").toInstant();
                    }
                }
            }
        } catch (SQLException e) {
            plugin.getLogger().warning("Staff alert poll failed: " + e.getMessage());
        }
    }

    private void broadcast(ResultSet rs, String permission) throws SQLException {
        String type = rs.getString("type");
        String reason = rs.getString("reason");
        String banId = rs.getString("publicBanId");
        String staffName = rs.getString("staffUsername");
        String playerName = rs.getString("playerUsername");
        Timestamp expiresAtTs = rs.getTimestamp("expiresAt");

        String typeVerb = switch (type) {
            case "BAN" -> expiresAtTs != null ? "temp-banned" : "banned";
            case "MUTE" -> expiresAtTs != null ? "temp-muted" : "muted";
            case "KICK" -> "kicked";
            case "WARN" -> "warned";
            default -> "punished";
        };

        String duration = expiresAtTs == null ? "permanent"
                : Duration.between(Instant.now(), expiresAtTs.toInstant()).toString();

        String message = messages.renderStaffAlert(type, typeVerb, playerName, staffName, reason, banId, duration);

        for (Player online : plugin.getServer().getOnlinePlayers()) {
            if (online.hasPermission(permission)) {
                online.sendMessage(message);
            }
        }
    }
}
