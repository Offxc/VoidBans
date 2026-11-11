package com.voidsmp.voidbans.state;

import com.voidsmp.voidbans.message.MessageTemplate;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Server;
import org.bukkit.entity.Player;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Maintenance mode, switched on and off from the site. While it is on, only
 * staff can be on the server: everyone else is kicked and refused at login.
 *
 * Staff means anyone holding voidbans.lockdown.bypass, or anyone who has
 * linked their Minecraft account on the site and still has staff access
 * there. The second part is so the people pressing the button aren't locked
 * out themselves if nobody has set the permission up.
 */
public final class Lockdown {

    public static final String BYPASS_PERMISSION = "voidbans.lockdown.bypass";
    private static final String SETTING_KEY = "lockdown.enabled";

    private volatile boolean enabled;
    private volatile Set<UUID> linkedStaff = Set.of();

    public boolean enabled() {
        return enabled;
    }

    public boolean allows(Player player) {
        return player.hasPermission(BYPASS_PERMISSION) || linkedStaff.contains(player.getUniqueId());
    }

    /** Reads the current state from the database. Returns true if it changed. */
    public boolean refresh(Connection conn) throws SQLException {
        boolean now = readEnabled(conn);
        // Load the staff list before flipping the flag, so nobody is judged against an empty list.
        if (now) linkedStaff = readLinkedStaff(conn);
        boolean changed = now != enabled;
        enabled = now;
        return changed;
    }

    /** Must run on the main thread. */
    public void kickEveryoneElse(Server server, MessageTemplate messages) {
        if (!enabled) return;
        Component message = LegacyComponentSerializer.legacySection()
                .deserialize(messages.render("lockdown", null, null, null));
        for (Player player : server.getOnlinePlayers()) {
            if (!allows(player)) player.kick(message);
        }
    }

    private static boolean readEnabled(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT value FROM site_settings WHERE `key` = ?")) {
            ps.setString(1, SETTING_KEY);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return false;
                String raw = rs.getString("value");
                return raw != null && raw.trim().equalsIgnoreCase("true");
            }
        }
    }

    private static Set<UUID> readLinkedStaff(Connection conn) throws SQLException {
        // Someone who lost their staff role has their stored roles cleared, so they drop out of this.
        String sql = """
            SELECT minecraftUuid FROM staff_users
            WHERE minecraftUuid IS NOT NULL AND (isOwner = TRUE OR JSON_LENGTH(discordRoles) > 0)
            """;
        Set<UUID> staff = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                try {
                    staff.add(UUID.fromString(rs.getString(1)));
                } catch (IllegalArgumentException ignored) {
                    // not a UUID, skip the row
                }
            }
        }
        return Set.copyOf(staff);
    }
}
