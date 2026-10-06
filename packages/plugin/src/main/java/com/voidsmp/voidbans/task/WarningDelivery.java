package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.title.Title;
import org.bukkit.entity.Player;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Shows a warning to a player: a chat message with the reason, ID and link,
 * plus a title so it isn't lost in busy chat. A warning for someone who is
 * offline stays undelivered in the database and is shown the next time they
 * join, so nobody misses one.
 */
public final class WarningDelivery {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacySection();

    private WarningDelivery() {}

    /** Must run on the main thread. */
    public static void show(MessageTemplate messages, Player player, String reason, String banId) {
        String body = messages.render("warn", reason, banId, null);
        if (!body.isEmpty()) player.sendMessage(LEGACY.deserialize(body));

        String title = messages.render("warn-title", reason, banId, null);
        String subtitle = messages.render("warn-subtitle", reason, banId, null);
        if (!title.isEmpty() || !subtitle.isEmpty()) {
            player.showTitle(Title.title(
                    title.isEmpty() ? Component.empty() : LEGACY.deserialize(title),
                    subtitle.isEmpty() ? Component.empty() : LEGACY.deserialize(subtitle),
                    Title.Times.times(Duration.ofMillis(500), Duration.ofSeconds(5), Duration.ofSeconds(1))));
        }
    }

    /**
     * Called from the async join handler. Looks up warnings this player
     * hasn't seen, shows them a couple of seconds after joining (so they
     * aren't buried under the join messages), then marks them delivered.
     */
    public static void deliverPendingOnJoin(VoidBansPlugin plugin, Database db, MessageTemplate messages, Player player) {
        record Pending(long id, String reason, String banId) {}
        List<Pending> pending = new ArrayList<>();

        String sql = """
            SELECT id, reason, publicBanId FROM punishments
            WHERE playerUuid = ? AND type = 'WARN' AND deliveredAt IS NULL
            ORDER BY id ASC LIMIT 10
            """;
        try (var conn = db.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, player.getUniqueId().toString());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) pending.add(new Pending(rs.getLong("id"), rs.getString("reason"), rs.getString("publicBanId")));
            }
        } catch (SQLException e) {
            plugin.getLogger().warning("Failed to look up warnings for " + player.getName() + ": " + e.getMessage());
            return;
        }
        if (pending.isEmpty()) return;

        plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            if (!player.isOnline()) return; // they left again; it stays pending
            List<Long> shown = new ArrayList<>();
            for (Pending p : pending) {
                show(messages, player, p.reason(), p.banId());
                shown.add(p.id());
            }
            plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> markDelivered(plugin, db, shown));
        }, 40L);
    }

    public static void markDelivered(VoidBansPlugin plugin, Database db, List<Long> ids) {
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
