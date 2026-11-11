package com.voidsmp.voidbans.task;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.state.Lockdown;
import com.voidsmp.voidbans.state.MuteCache;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

/**
 * Every couple of seconds, picks up what the site has changed: whether the
 * server is locked down, and which online players are muted.
 */
public final class StatePollTask extends BukkitRunnable {

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;
    private final Lockdown lockdown;
    private final MuteCache mutes;

    private boolean failing;

    public StatePollTask(VoidBansPlugin plugin, Database db, MessageTemplate messages, Lockdown lockdown, MuteCache mutes) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
        this.lockdown = lockdown;
        this.mutes = mutes;
    }

    @Override
    public void run() {
        List<UUID> online = plugin.getServer().getOnlinePlayers().stream().map(Player::getUniqueId).toList();

        try (var conn = db.getConnection()) {
            if (lockdown.refresh(conn)) {
                plugin.getLogger().info(lockdown.enabled()
                        ? "Lockdown turned on from the site. Only staff can be on the server."
                        : "Lockdown turned off from the site.");
            }
            mutes.refresh(conn, online);
            if (failing) {
                failing = false;
                plugin.getLogger().info("Reconnected to the site database.");
            }
        } catch (SQLException e) {
            // Keep whatever was known last. Log once, not every two seconds.
            if (!failing) {
                failing = true;
                plugin.getLogger().warning("Couldn't read lockdown and mute state: " + e.getMessage());
            }
        }

        if (lockdown.enabled() && !online.isEmpty()) {
            plugin.getServer().getScheduler().runTask(plugin, () -> lockdown.kickEveryoneElse(plugin.getServer(), messages));
        }
    }
}
