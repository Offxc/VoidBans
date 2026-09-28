package com.voidsmp.voidbans.listener;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;

/**
 * Blocks chat for a player with an active MUTE punishment — issuing a mute
 * from the web dashboard or /vban previously only wrote a punishments row;
 * nothing actually stopped the player from talking. Checked per-message
 * (not cached) so a mute or unmute takes effect on the very next message,
 * same as the login ban check.
 */
public final class ChatListener implements Listener {

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;

    public ChatListener(VoidBansPlugin plugin, Database db, MessageTemplate messages) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        String uuid = event.getPlayer().getUniqueId().toString();

        try (var conn = db.getConnection()) {
            ActiveMute mute = findActiveMute(conn, uuid);
            if (mute != null) {
                event.setCancelled(true);
                String key = mute.expiresAt != null ? "temp-mute" : "mute";
                event.getPlayer().sendMessage(Component.text(
                        messages.render(key, mute.reason, mute.publicBanId, mute.expiresAt)));
            }
        } catch (SQLException e) {
            plugin.getLogger().warning("Mute check failed for " + uuid + ": " + e.getMessage());
            // Fail open — a DB hiccup should not silently mute the whole server.
        }
    }

    private record ActiveMute(String reason, String publicBanId, Instant expiresAt) {}

    private ActiveMute findActiveMute(java.sql.Connection conn, String uuid) throws SQLException {
        String sql = """
            SELECT reason, publicBanId, expiresAt FROM punishments
            WHERE playerUuid = ? AND type = 'MUTE' AND active = TRUE
              AND (expiresAt IS NULL OR expiresAt > NOW())
            ORDER BY issuedAt DESC LIMIT 1
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Timestamp expiresAtTs = rs.getTimestamp("expiresAt");
                return new ActiveMute(
                        rs.getString("reason"),
                        rs.getString("publicBanId"),
                        expiresAtTs == null ? null : expiresAtTs.toInstant());
            }
        }
    }
}
