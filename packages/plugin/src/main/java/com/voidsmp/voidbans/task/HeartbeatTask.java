package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Tells the site this server is connected. The plugin and the web app share
 * one database and nothing else, so without this the dashboard has no way
 * to tell a working install from one pointed at the wrong database.
 * Settings > Plugin connection reads these rows.
 */
public final class HeartbeatTask extends BukkitRunnable {

    private final VoidBansPlugin plugin;
    private final Database db;

    public HeartbeatTask(VoidBansPlugin plugin, Database db) {
        this.plugin = plugin;
        this.db = db;
    }

    @Override
    public void run() {
        String serverId = plugin.getConfig().getString("server-id", "default");
        String version = plugin.getDescription().getVersion();
        String platform = plugin.getServer().getName() + " " + plugin.getServer().getBukkitVersion();

        String sql = """
            INSERT INTO plugin_instances (serverId, pluginVersion, platform, firstSeenAt, lastSeenAt)
            VALUES (?, ?, ?, NOW(3), NOW(3))
            ON DUPLICATE KEY UPDATE
                pluginVersion = VALUES(pluginVersion),
                platform = VALUES(platform),
                lastSeenAt = NOW(3)
            """;
        try (var conn = db.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, truncate(serverId, 64));
            ps.setString(2, truncate(version, 32));
            ps.setString(3, truncate(platform, 128));
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().warning("Failed to send heartbeat to the site database: " + e.getMessage());
        }
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
