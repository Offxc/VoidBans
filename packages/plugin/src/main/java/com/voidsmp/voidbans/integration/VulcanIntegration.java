package com.voidsmp.voidbans.integration;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import org.bukkit.entity.Player;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.RegisteredListener;

import java.lang.reflect.Method;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;

/**
 * Optional, reflection-only integration with Vulcan Anticheat. VoidBans
 * has no compile-time dependency on Vulcan at all, not even a soft one,
 * because this integration is meant to be a site-owner-toggleable feature
 * that most servers running this plugin will never have installed. All
 * classes below are Vulcan's own (me.frep.vulcan.api.*), loaded from
 * Vulcan's jar at runtime only if that plugin is actually present, via
 * Class.forName against the server's own classloader, this class never
 * imports anything from Vulcan.
 *
 * Toggled on/off from the web dashboard's Settings > Integrations panel
 * (site_settings key "integrations.vulcan.enabled"); this class polls
 * that flag on an interval rather than requiring a plugin restart to
 * pick up the change.
 */
public final class VulcanIntegration implements Listener {

    private static final String VULCAN_PLUGIN_NAME = "Vulcan";
    private static final String FLAG_EVENT_CLASS = "me.frep.vulcan.api.event.VulcanFlagEvent";
    private static final String PUNISH_EVENT_CLASS = "me.frep.vulcan.api.event.VulcanPunishEvent";
    private static final String CHECK_INTERFACE = "me.frep.vulcan.api.check.Check";

    private final VoidBansPlugin plugin;
    private final Database db;

    private boolean vulcanPresent;
    private boolean registered;

    public VulcanIntegration(VoidBansPlugin plugin, Database db) {
        this.plugin = plugin;
        this.db = db;
    }

    /** Called on plugin enable and again whenever the DB-backed toggle changes. */
    public void refresh(boolean enabledInSettings) {
        Plugin vulcan = plugin.getServer().getPluginManager().getPlugin(VULCAN_PLUGIN_NAME);
        this.vulcanPresent = vulcan != null && vulcan.isEnabled();

        if (!vulcanPresent) {
            if (enabledInSettings) {
                plugin.getLogger().info("Vulcan integration is enabled in settings, but the Vulcan plugin isn't installed, nothing to hook into.");
            }
            return;
        }

        if (enabledInSettings && !registered) {
            registerListeners();
        } else if (!enabledInSettings && registered) {
            unregisterListeners();
        }
    }

    private void registerListeners() {
        try {
            registerReflectiveEvent(FLAG_EVENT_CLASS, this::handleFlagEvent);
            registerReflectiveEvent(PUNISH_EVENT_CLASS, this::handlePunishEvent);
            registered = true;
            plugin.getLogger().info("Vulcan integration active, listening for flags and punishments.");
        } catch (ReflectiveOperationException e) {
            plugin.getLogger().warning("Failed to hook into Vulcan (unexpected API shape, Vulcan version may be incompatible): " + e.getMessage());
        }
    }

    private void unregisterListeners() {
        // Bukkit has no per-listener-instance unregister by predicate short
        // of HandlerList manipulation; simplest safe approach is to drop
        // and re-add this Listener's registration entirely.
        for (String eventClass : new String[]{FLAG_EVENT_CLASS, PUNISH_EVENT_CLASS}) {
            try {
                Class<?> clazz = Class.forName(eventClass);
                Method getHandlerList = clazz.getMethod("getHandlerList");
                var handlerList = (org.bukkit.event.HandlerList) getHandlerList.invoke(null);
                for (RegisteredListener rl : handlerList.getRegisteredListeners()) {
                    if (rl.getListener() == this) {
                        handlerList.unregister(this);
                    }
                }
            } catch (ReflectiveOperationException | ClassCastException ignored) {
                // Vulcan absent or shape changed, nothing to unregister.
            }
        }
        registered = false;
        plugin.getLogger().info("Vulcan integration disabled.");
    }

    @FunctionalInterface
    private interface ReflectiveHandler {
        void handle(Object event) throws ReflectiveOperationException;
    }

    private void registerReflectiveEvent(String eventClassName, ReflectiveHandler handler) throws ReflectiveOperationException {
        Class<?> eventClass = Class.forName(eventClassName);
        Method getHandlerList = eventClass.getMethod("getHandlerList");
        var handlerList = (org.bukkit.event.HandlerList) getHandlerList.invoke(null);

        handlerList.register(new org.bukkit.plugin.RegisteredListener(
                this,
                (listener, event) -> {
                    if (!eventClass.isInstance(event)) return;
                    try {
                        handler.handle(event);
                    } catch (ReflectiveOperationException e) {
                        plugin.getLogger().warning("Vulcan event handling failed: " + e.getMessage());
                    }
                },
                EventPriority.MONITOR,
                plugin,
                false
        ));
    }

    private void handleFlagEvent(Object event) throws ReflectiveOperationException {
        Class<?> eventClass = event.getClass();
        Player player = (Player) eventClass.getMethod("getPlayer").invoke(event);
        Object check = eventClass.getMethod("getCheck").invoke(event);
        String info = (String) eventClass.getMethod("getInfo").invoke(event);

        Class<?> checkClass = Class.forName(CHECK_INTERFACE);
        String checkName = (String) checkClass.getMethod("getName").invoke(check);
        String category = (String) checkClass.getMethod("getCategory").invoke(check);
        int vl = (int) checkClass.getMethod("getVl").invoke(check);

        persistViolation(player.getUniqueId(), checkName, category, vl, info, false);
    }

    private void handlePunishEvent(Object event) throws ReflectiveOperationException {
        Class<?> eventClass = event.getClass();
        Player player = (Player) eventClass.getMethod("getPlayer").invoke(event);
        Object check = eventClass.getMethod("getCheck").invoke(event);

        Class<?> checkClass = Class.forName(CHECK_INTERFACE);
        String checkName = (String) checkClass.getMethod("getName").invoke(check);
        String category = (String) checkClass.getMethod("getCategory").invoke(check);
        int vl = (int) checkClass.getMethod("getVl").invoke(check);

        persistViolation(player.getUniqueId(), checkName, category, vl, null, true);
    }

    private void persistViolation(UUID playerUuid, String checkName, String category, int vl, String info, boolean punished) {
        new org.bukkit.scheduler.BukkitRunnable() {
            @Override
            public void run() {
                String sql = """
                    INSERT INTO violation_events (playerUuid, checkName, category, violationLevel, info, punished, occurredAt)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    """;
                try (var conn = db.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, playerUuid.toString());
                    ps.setString(2, checkName);
                    ps.setString(3, category);
                    ps.setInt(4, vl);
                    ps.setString(5, info);
                    ps.setBoolean(6, punished);
                    ps.executeUpdate();
                } catch (SQLException e) {
                    plugin.getLogger().warning("Failed to persist Vulcan violation: " + e.getMessage());
                }
            }
        }.runTaskAsynchronously(plugin);
    }

    /**
     * Reflectively reads the player's current client brand from Vulcan's
     * IPlayerData, if Vulcan is present and the integration is enabled.
     * Returns null otherwise, callers should treat that as "no data",
     * not as an error.
     */
    public String getClientBrand(Player player) {
        if (!vulcanPresent || !registered) return null;

        try {
            Plugin vulcan = plugin.getServer().getPluginManager().getPlugin(VULCAN_PLUGIN_NAME);
            Class<?> factoryClass = Class.forName("me.frep.vulcan.api.VulcanAPI$Factory");
            Object api = factoryClass.getMethod("getApi").invoke(null);
            if (api == null) return null;

            Class<?> apiClass = Class.forName("me.frep.vulcan.api.VulcanAPI");
            Object playerData = apiClass.getMethod("getPlayerData", Player.class).invoke(api, player);
            if (playerData == null) return null;

            Class<?> playerDataClass = Class.forName("me.frep.vulcan.api.data.IPlayerData");
            return (String) playerDataClass.getMethod("getClientBrand").invoke(playerData);
        } catch (ReflectiveOperationException | ClassCastException e) {
            return null;
        }
    }

    public boolean isActive() {
        return vulcanPresent && registered;
    }
}
