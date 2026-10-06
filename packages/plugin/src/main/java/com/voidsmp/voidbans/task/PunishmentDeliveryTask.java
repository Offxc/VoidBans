package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Acts on kicks and bans issued from the website for players who are online
 * right now. The login and chat checks only run when a player connects or
 * speaks, so on their own a kick from the dashboard did nothing and a ban
 * only took effect the next time the player tried to join.
 *
 * Rows are picked up by a null deliveredAt and marked once the player has
 * actually been removed, so a row is acted on once. Only rows from the last
 * couple of minutes are considered: a kick for someone who left before it
 * was delivered should not fire hours later when they rejoin. With several
 * servers sharing one database, whichever server the player is on handles it.
 */
public final class PunishmentDeliveryTask extends BukkitRunnable {

    private record Pending(long id, UUID uuid, String type, String reason, String banId, Instant expiresAt) {}

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;

    public PunishmentDeliveryTask(VoidBansPlugin plugin, Database db, MessageTemplate messages) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
    }

    @Override
    public void run() {
        if (plugin.getServer().getOnlinePlayers().isEmpty()) return;

        List<Pending> pending = new ArrayList<>();
        String sql = """
            SELECT id, playerUuid, type, reason, publicBanId, expiresAt FROM punishments
            WHERE deliveredAt IS NULL AND type IN ('KICK', 'BAN')
              AND issuedAt > NOW() - INTERVAL 2 MINUTE
            ORDER BY id ASC LIMIT 25
            """;
        try (var conn = db.getConnection(); PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Timestamp expires = rs.getTimestamp("expiresAt");
                pending.add(new Pending(
                        rs.getLong("id"),
                        UUID.fromString(rs.getString("playerUuid")),
                        rs.getString("type"),
                        rs.getString("reason"),
                        rs.getString("publicBanId"),
                        expires == null ? null : expires.toInstant()));
            }
        } catch (SQLException e) {
            plugin.getLogger().warning("Punishment delivery poll failed: " + e.getMessage());
            return;
        }
        if (pending.isEmpty()) return;

        // Looking players up and kicking them has to happen on the main thread.
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            List<Long> delivered = new ArrayList<>();
            for (Pending p : pending) {
                Player player = plugin.getServer().getPlayer(p.uuid());
                if (player == null) continue; // not on this server (yet)

                String key = p.type().equals("KICK") ? "kick" : (p.expiresAt() != null ? "temp-ban" : "ban");
                String message = messages.render(key, p.reason(), p.banId(), p.expiresAt());
                player.kick(LegacyComponentSerializer.legacySection().deserialize(message));
                delivered.add(p.id());
            }
            if (!delivered.isEmpty()) {
                plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> markDelivered(delivered));
            }
        });
    }

    private void markDelivered(List<Long> ids) {
        String placeholders = String.join(",", ids.stream().map(i -> "?").toList());
        String sql = "UPDATE punishments SET deliveredAt = NOW() WHERE deliveredAt IS NULL AND id IN (" + placeholders + ")";
        try (var conn = db.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < ids.size(); i++) ps.setLong(i + 1, ids.get(i));
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().warning("Failed to mark punishments delivered: " + e.getMessage());
        }
    }
}
