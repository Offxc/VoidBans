package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.integration.VulcanIntegration;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Polls site_settings for the owner-controlled integration toggles set
 * from the web dashboard (Settings > Integrations) and applies them,
 * so flipping a switch there takes effect within one poll interval,
 * without requiring a plugin restart.
 */
public final class IntegrationSettingsPollTask extends BukkitRunnable {

    private final VoidBansPlugin plugin;
    private final Database db;
    private final VulcanIntegration vulcanIntegration;

    public IntegrationSettingsPollTask(VoidBansPlugin plugin, Database db, VulcanIntegration vulcanIntegration) {
        this.plugin = plugin;
        this.db = db;
        this.vulcanIntegration = vulcanIntegration;
    }

    @Override
    public void run() {
        try (var conn = db.getConnection()) {
            boolean vulcanEnabled = readBooleanSetting(conn, "integrations.vulcan.enabled");
            vulcanIntegration.refresh(vulcanEnabled);
        } catch (SQLException e) {
            plugin.getLogger().warning("Failed to poll integration settings: " + e.getMessage());
        }
    }

    private boolean readBooleanSetting(java.sql.Connection conn, String key) throws SQLException {
        String sql = "SELECT value FROM site_settings WHERE `key` = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return false;
                // Prisma's Json column stores a JSON-encoded scalar, so a
                // boolean `true` is literally the 4-byte string "true".
                String raw = rs.getString("value");
                return raw != null && raw.trim().equalsIgnoreCase("true");
            }
        }
    }
}
