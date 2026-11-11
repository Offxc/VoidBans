package com.voidsmp.voidbans.listener;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.db.SessionCloser;
import com.voidsmp.voidbans.task.WarningDelivery;
import com.voidsmp.voidbans.integration.VulcanIntegration;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.state.Lockdown;
import com.voidsmp.voidbans.state.MuteCache;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerLoginEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitRunnable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Tracks players/sessions rows on join and quit. Runs DB work off the
 * main thread, session bookkeeping must never add latency to login/quit.
 */
public final class SessionListener implements Listener {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacySection();

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;
    private final VulcanIntegration vulcanIntegration;
    private final Lockdown lockdown;
    private final MuteCache mutes;

    public SessionListener(VoidBansPlugin plugin, Database db, MessageTemplate messages, VulcanIntegration vulcanIntegration,
                           Lockdown lockdown, MuteCache mutes) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
        this.vulcanIntegration = vulcanIntegration;
        this.lockdown = lockdown;
        this.mutes = mutes;
    }

    /**
     * The ban check. Runs off the main thread, before the player exists on
     * the server, so a slow database delays this one login and nothing else.
     */
    @EventHandler(priority = EventPriority.HIGH)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        if (event.getLoginResult() != AsyncPlayerPreLoginEvent.Result.ALLOWED) return;

        String ip = event.getAddress().getHostAddress();
        String uuid = event.getUniqueId().toString();

        try (var conn = db.getConnection()) {
            ActiveBan ban = findActiveBan(conn, uuid);
            if (ban != null) {
                String key = ban.expiresAt != null ? "temp-ban" : "ban";
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED,
                        LEGACY.deserialize(messages.render(key, ban.reason, ban.publicBanId, ban.expiresAt)));
                return;
            }

            ActiveBan ipBan = findActiveIpBan(conn, ip);
            if (ipBan != null) {
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED,
                        LEGACY.deserialize(messages.render("ip-ban", ipBan.reason, ipBan.publicBanId, null)));
            }
        } catch (SQLException e) {
            // Bans can't be checked. Either let people in unchecked or turn everyone
            // away until the database is back: the owner picks which in config.yml.
            boolean deny = "deny".equalsIgnoreCase(plugin.getConfig().getString("login.on-database-error", "allow"));
            plugin.getLogger().warning("Ban check failed for " + uuid + (deny ? ", login refused: " : ", login allowed: ") + e.getMessage());
            if (deny) {
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER,
                        LEGACY.deserialize(messages.render("database-error", null, null, null)));
            }
        }
    }

    /** Lockdown. Needs the player's permissions, which only exist from this event on. */
    @EventHandler(priority = EventPriority.HIGH)
    public void onLogin(PlayerLoginEvent event) {
        if (event.getResult() != PlayerLoginEvent.Result.ALLOWED) return;
        if (lockdown.enabled() && !lockdown.allows(event.getPlayer())) {
            event.disallow(PlayerLoginEvent.Result.KICK_OTHER,
                    LEGACY.deserialize(messages.render("lockdown", null, null, null)));
        }
    }

    private record ActiveBan(String reason, String publicBanId, Instant expiresAt) {}

    private ActiveBan findActiveBan(java.sql.Connection conn, String uuid) throws SQLException {
        String sql = """
            SELECT reason, publicBanId, expiresAt FROM punishments
            WHERE playerUuid = ? AND type = 'BAN' AND active = TRUE
              AND (expiresAt IS NULL OR expiresAt > NOW())
            ORDER BY issuedAt DESC LIMIT 1
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Timestamp expiresAtTs = rs.getTimestamp("expiresAt");
                return new ActiveBan(
                        rs.getString("reason"),
                        rs.getString("publicBanId"),
                        expiresAtTs == null ? null : expiresAtTs.toInstant());
            }
        }
    }

    private ActiveBan findActiveIpBan(java.sql.Connection conn, String ip) throws SQLException {
        String sql = """
            SELECT reason, publicBanId FROM punishments
            WHERE ipAddress = ? AND ipBanned = TRUE AND active = TRUE
              AND (expiresAt IS NULL OR expiresAt > NOW())
            LIMIT 1
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ip);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? new ActiveBan(rs.getString("reason"), rs.getString("publicBanId"), null) : null;
            }
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        recordJoin(player, true);
        scheduleClientBrandLookup(player);
    }

    /**
     * For players already connected when the plugin loads (a hot reload with
     * PlugMan or similar). They never fire a join event, so without this they
     * would show as offline until they reconnected.
     */
    public void trackExisting(Player player) {
        recordJoin(player, false);
        scheduleClientBrandLookup(player);
    }

    private void recordJoin(Player player, boolean announce) {
        String uuid = player.getUniqueId().toString();
        String name = player.getName();
        String serverId = plugin.getConfig().getString("server-id", "default");
        String ip = player.getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;

        new BukkitRunnable() {
            @Override
            public void run() {
                try (var conn = db.getConnection()) {
                    upsertPlayerOnLogin(conn, uuid, name);
                    // A leftover open session here means the last quit never
                    // landed (crash, race). Its end is unknown, so it is
                    // abandoned, never closed with the current time.
                    SessionCloser.abandonOpen(conn, uuid, serverId);
                    insertSessionStart(conn, uuid, serverId, ip);
                    mutes.refresh(conn, List.of(player.getUniqueId()));
                    WarningDelivery.deliverPendingOnJoin(plugin, db, messages, player);
                    if (announce) alertStaffToBannedAlts(conn, uuid, name, ip);
                } catch (SQLException e) {
                    plugin.getLogger().warning("Failed to record login for " + name + ": " + e.getMessage());
                }
            }
        }.runTaskAsynchronously(plugin);
    }

    private void scheduleClientBrandLookup(Player player) {
        String uuid = player.getUniqueId().toString();
        String name = player.getName();

        if (vulcanIntegration.isActive()) {
            // Client brand is negotiated over a plugin message channel
            // shortly after join, so it usually isn't populated yet on
            // PlayerJoinEvent itself, read it a few seconds later instead
            // of racing it. Must run on the main thread (Vulcan's API
            // reads from Bukkit's own player/channel state).
            new BukkitRunnable() {
                @Override
                public void run() {
                    if (!player.isOnline()) return;
                    String clientBrand = vulcanIntegration.getClientBrand(player);
                    if (clientBrand == null) return;

                    new BukkitRunnable() {
                        @Override
                        public void run() {
                            try (var conn = db.getConnection()) {
                                recordClientBrandForOpenSession(conn, uuid, clientBrand);
                            } catch (SQLException e) {
                                plugin.getLogger().warning("Failed to record client brand for " + name + ": " + e.getMessage());
                            }
                        }
                    }.runTaskAsynchronously(plugin);
                }
            }.runTaskLater(plugin, 20L * 5); // 5s
        }
    }

    private void recordClientBrandForOpenSession(java.sql.Connection conn, String uuid, String clientBrand) throws SQLException {
        String sql = """
            UPDATE sessions SET clientBrand = ?
            WHERE playerUuid = ? AND logoutAt IS NULL
            ORDER BY loginAt DESC LIMIT 1
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, clientBrand);
            ps.setString(2, uuid);
            ps.executeUpdate();
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        String uuid = player.getUniqueId().toString();
        String name = player.getName();
        String serverId = plugin.getConfig().getString("server-id", "default");

        new BukkitRunnable() {
            @Override
            public void run() {
                try (var conn = db.getConnection()) {
                    mutes.remove(player.getUniqueId());
                    SessionCloser.closeOnQuit(conn, uuid, serverId);
                    markOffline(conn, uuid);
                } catch (SQLException e) {
                    plugin.getLogger().warning("Failed to record logout for " + name + ": " + e.getMessage());
                }
            }
        }.runTaskAsynchronously(plugin);
    }

    /**
     * Tells staff when the player who just joined has used the same IP as an
     * account that is banned right now. The IP itself is never shown.
     */
    private void alertStaffToBannedAlts(java.sql.Connection conn, String uuid, String name, String ip) throws SQLException {
        if (ip == null || !plugin.getConfig().getBoolean("alt-alerts.enabled", true)) return;

        String permission = plugin.getConfig().getString("alt-alerts.permission", "voidbans.alerts.alts");
        List<Player> listeners = new ArrayList<>();
        for (Player online : plugin.getServer().getOnlinePlayers()) {
            if (online.hasPermission(permission)) listeners.add(online);
        }
        if (listeners.isEmpty()) return;

        String sql = """
            SELECT DISTINCT pl.username FROM sessions s
            JOIN players pl ON pl.uuid = s.playerUuid
            JOIN punishments p ON p.playerUuid = s.playerUuid
            WHERE s.ipAddress = ? AND s.playerUuid <> ?
              AND p.type = 'BAN' AND p.active = TRUE AND (p.expiresAt IS NULL OR p.expiresAt > NOW())
            LIMIT 5
            """;
        List<String> banned = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ip);
            ps.setString(2, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) banned.add(rs.getString(1));
            }
        }
        if (banned.isEmpty()) return;

        String message = messages.format("alt-alerts.message", "player", name, "accounts", String.join(", ", banned));
        for (Player listener : listeners) listener.sendMessage(LEGACY.deserialize(message));
    }

    private void upsertPlayerOnLogin(java.sql.Connection conn, String uuid, String name) throws SQLException {
        String previousName = fetchLastSeenUsername(conn, uuid);

        // ON DUPLICATE KEY intentionally does not overwrite firstJoined,
        // for a real returning player that's correct (keep their true
        // first-join date), and for a staff-pre-created placeholder row
        // (hasJoined = FALSE, firstJoined = whenever staff created it) this
        // is the row's actual first real join, but backfilling the exact
        // original moment isn't worth a second UPDATE; hasJoined flipping
        // to TRUE is what the UI actually keys off of.
        String sql = """
            INSERT INTO players (uuid, username, lastSeenUsername, firstJoined, lastLogin, isOnline, hasJoined)
            VALUES (?, ?, ?, NOW(), NOW(), TRUE, TRUE)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                lastSeenUsername = VALUES(lastSeenUsername),
                lastLogin = NOW(),
                isOnline = TRUE,
                hasJoined = TRUE
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, name);
            ps.setString(3, name);
            ps.executeUpdate();
        }

        // First-ever login (previousName == null) isn't a rename, so it
        // doesn't get a history row, only actual changes do.
        if (previousName != null && !previousName.equals(name)) {
            insertUsernameHistory(conn, uuid, name);
        }
    }

    private String fetchLastSeenUsername(java.sql.Connection conn, String uuid) throws SQLException {
        String sql = "SELECT lastSeenUsername FROM players WHERE uuid = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString("lastSeenUsername") : null;
            }
        }
    }

    private void insertUsernameHistory(java.sql.Connection conn, String uuid, String name) throws SQLException {
        String sql = "INSERT INTO username_history (playerUuid, username, observedAt) VALUES (?, ?, NOW())";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, name);
            ps.executeUpdate();
        }
    }

    private void insertSessionStart(java.sql.Connection conn, String uuid, String serverId, String ip) throws SQLException {
        String sql = "INSERT INTO sessions (playerUuid, loginAt, serverId, ipAddress) VALUES (?, NOW(), ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.setString(2, serverId);
            ps.setString(3, ip);
            ps.executeUpdate();
        }
    }

    private void markOffline(java.sql.Connection conn, String uuid) throws SQLException {
        String sql = "UPDATE players SET isOnline = FALSE, lastLogout = NOW() WHERE uuid = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uuid);
            ps.executeUpdate();
        }
    }
}
