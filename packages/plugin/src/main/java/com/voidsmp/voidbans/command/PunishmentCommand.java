package com.voidsmp.voidbans.command;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.state.MuteCache;
import com.voidsmp.voidbans.task.WarningDelivery;
import com.voidsmp.voidbans.util.BanIdGenerator;
import com.voidsmp.voidbans.util.Durations;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The in-game commands: /vban, /vmute, /vkick, /vwarn, /vunban, /vunmute,
 * /vhistory and /voidbans reload. They write the same rows the website does,
 * so anything issued here shows up there, with its own ID and appeal page.
 */
public final class PunishmentCommand implements CommandExecutor, TabCompleter {

    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacySection();
    private static final List<String> DURATION_HINTS = List.of("perm", "1h", "12h", "1d", "7d", "30d");

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;
    private final MuteCache mutes;

    public PunishmentCommand(VoidBansPlugin plugin, Database db, MessageTemplate messages, MuteCache mutes) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
        this.mutes = mutes;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        switch (command.getName().toLowerCase(Locale.ROOT)) {
            case "vban" -> issue(sender, args, "BAN");
            case "vmute" -> issue(sender, args, "MUTE");
            case "vkick" -> issue(sender, args, "KICK");
            case "vwarn" -> issue(sender, args, "WARN");
            case "vunban" -> revoke(sender, args, "BAN");
            case "vunmute" -> revoke(sender, args, "MUTE");
            case "vhistory" -> history(sender, args);
            case "voidbans" -> admin(sender, args);
            default -> {
                return false;
            }
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        String name = command.getName().toLowerCase(Locale.ROOT);
        String typed = args[args.length - 1].toLowerCase(Locale.ROOT);

        if (name.equals("voidbans")) {
            return args.length == 1 && "reload".startsWith(typed) ? List.of("reload") : List.of();
        }
        if (args.length == 1) {
            List<String> names = new ArrayList<>();
            for (Player online : Bukkit.getOnlinePlayers()) {
                if (online.getName().toLowerCase(Locale.ROOT).startsWith(typed)) names.add(online.getName());
            }
            return names;
        }
        if (args.length == 2 && (name.equals("vban") || name.equals("vmute"))) {
            return DURATION_HINTS.stream().filter(hint -> hint.startsWith(typed)).toList();
        }
        return List.of();
    }

    // ── Issuing ──────────────────────────────────────────────────────────

    private void issue(CommandSender sender, String[] args, String type) {
        boolean timed = type.equals("BAN") || type.equals("MUTE");
        String command = "/v" + type.toLowerCase(Locale.ROOT);
        String usage = timed ? "Usage: " + command + " <player> [duration] <reason>" : "Usage: " + command + " <player> <reason>";

        if (args.length < 2) {
            say(sender, usage);
            return;
        }

        // An optional duration right after the name: "7d", "1d12h", or "perm" to be explicit.
        Long seconds = null;
        int reasonStart = 1;
        if (timed) {
            if (args[1].equalsIgnoreCase("perm") || args[1].equalsIgnoreCase("permanent")) {
                reasonStart = 2;
            } else {
                seconds = Durations.parseSeconds(args[1]);
                if (seconds != null) reasonStart = 2;
            }
        }
        if (reasonStart >= args.length) {
            say(sender, usage);
            return;
        }

        String targetName = args[0];
        String reason = String.join(" ", Arrays.copyOfRange(args, reasonStart, args.length));
        String staffName = sender instanceof Player ? sender.getName() : "console";
        final Long durationSeconds = seconds;

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, targetName);
                if (target == null) {
                    say(sender, "No known player found named " + targetName + ".");
                    return;
                }
                UUID uuid = UUID.fromString(target.uuid);
                boolean online = Bukkit.getPlayer(uuid) != null;

                if (type.equals("KICK") && !online) {
                    say(sender, target.username + " isn't online, so they can't be kicked.");
                    return;
                }
                // Same rule as the website: staff don't punish other staff. Console still can.
                if (sender instanceof Player && isLinkedStaff(conn, target.uuid)) {
                    say(sender, target.username + " is staff and can't be punished here.");
                    return;
                }

                // A kick or warning happens once and is over. Only bans and mutes stay in force.
                // A warning for someone offline is left undelivered, and shown when they next join.
                boolean delivered = !type.equals("WARN") || online;
                String banId = null;
                for (int attempt = 0; attempt < 5 && banId == null; attempt++) {
                    String candidate = BanIdGenerator.generate();
                    try {
                        insertPunishment(conn, target.uuid, type, reason, staffName, candidate, durationSeconds, timed, delivered);
                        banId = candidate;
                    } catch (SQLIntegrityConstraintViolationException duplicate) {
                        // ID already taken, try another
                    }
                }
                if (banId == null) {
                    say(sender, "Couldn't create a unique ID. Try again.");
                    return;
                }

                Instant expiresAt = durationSeconds == null ? null : Instant.now().plusSeconds(durationSeconds);
                String length = !timed ? "" : durationSeconds == null ? " permanently" : " for " + Durations.human(Duration.ofSeconds(durationSeconds));
                String verb = switch (type) {
                    case "BAN" -> "Banned ";
                    case "MUTE" -> "Muted ";
                    case "KICK" -> "Kicked ";
                    default -> "Warned ";
                };
                String note = type.equals("WARN") && !online ? " They'll see it when they next join." : "";
                say(sender, verb + target.username + length + " (" + banId + ")." + note);

                final String issuedId = banId;
                Bukkit.getScheduler().runTask(plugin, () -> apply(uuid, type, reason, issuedId, expiresAt));
            } catch (SQLException e) {
                plugin.getLogger().warning(command + " failed: " + e.getMessage());
                say(sender, "That failed, check the console.");
            }
        });
    }

    /** Main thread: makes the punishment take effect for a player who is online right now. */
    private void apply(UUID uuid, String type, String reason, String banId, Instant expiresAt) {
        if (type.equals("MUTE")) mutes.put(uuid, new MuteCache.Mute(reason, banId, expiresAt));

        Player player = Bukkit.getPlayer(uuid);
        if (player == null) return;

        switch (type) {
            case "BAN" -> player.kick(LEGACY.deserialize(messages.render(expiresAt != null ? "temp-ban" : "ban", reason, banId, expiresAt)));
            case "KICK" -> player.kick(LEGACY.deserialize(messages.render("kick", reason, banId, null)));
            case "MUTE" -> player.sendMessage(LEGACY.deserialize(messages.render(expiresAt != null ? "temp-mute" : "mute", reason, banId, expiresAt)));
            default -> WarningDelivery.show(messages, player, reason, banId);
        }
    }

    private void insertPunishment(Connection conn, String uuid, String type, String reason, String staffName, String banId,
                                  Long durationSeconds, boolean staysInForce, boolean delivered) throws SQLException {
        String expires = durationSeconds == null ? "NULL" : "DATE_ADD(NOW(), INTERVAL ? SECOND)";
        String sql = "INSERT INTO punishments "
                + "(publicBanId, playerUuid, type, reason, staffUsername, issuedAt, expiresAt, active, appealable, deliveredAt) "
                + "VALUES (?, ?, ?, ?, ?, NOW(), " + expires + ", ?, ?, " + (delivered ? "NOW()" : "NULL") + ")";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int i = 1;
            ps.setString(i++, banId);
            ps.setString(i++, uuid);
            ps.setString(i++, type);
            ps.setString(i++, reason);
            ps.setString(i++, staffName);
            if (durationSeconds != null) ps.setLong(i++, durationSeconds);
            ps.setBoolean(i++, staysInForce);
            ps.setBoolean(i, staysInForce); // only something still in force can be appealed
            ps.executeUpdate();
        }
    }

    // ── Revoking ─────────────────────────────────────────────────────────

    private void revoke(CommandSender sender, String[] args, String type) {
        String word = type.equals("BAN") ? "ban" : "mute";
        if (args.length < 1) {
            say(sender, "Usage: /vun" + word + " <player>");
            return;
        }

        String targetName = args[0];
        String staffName = sender instanceof Player ? sender.getName() : "console";

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, targetName);
                if (target == null) {
                    say(sender, "No known player found named " + targetName + ".");
                    return;
                }

                int updated;
                String sql = """
                    UPDATE punishments SET active = FALSE, revokedAt = NOW(), revokedBy = ?
                    WHERE playerUuid = ? AND type = ? AND active = TRUE
                    """;
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, staffName);
                    ps.setString(2, target.uuid);
                    ps.setString(3, type);
                    updated = ps.executeUpdate();
                }
                if (type.equals("MUTE")) mutes.remove(UUID.fromString(target.uuid));

                say(sender, updated > 0
                        ? (type.equals("BAN") ? "Unbanned " : "Unmuted ") + target.username + "."
                        : target.username + " has no active " + word + ".");
            } catch (SQLException e) {
                plugin.getLogger().warning("/vun" + word + " failed: " + e.getMessage());
                say(sender, "That failed, check the console.");
            }
        });
    }

    // ── History ──────────────────────────────────────────────────────────

    private void history(CommandSender sender, String[] args) {
        if (args.length < 1) {
            say(sender, "Usage: /vhistory <player>");
            return;
        }
        String targetName = args[0];

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, targetName);
                if (target == null) {
                    say(sender, "No known player found named " + targetName + ".");
                    return;
                }

                Map<String, Integer> counts = new LinkedHashMap<>();
                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT type, COUNT(*) FROM punishments WHERE playerUuid = ? GROUP BY type")) {
                    ps.setString(1, target.uuid);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) counts.put(rs.getString(1), rs.getInt(2));
                    }
                }
                if (counts.isEmpty()) {
                    say(sender, target.username + " has no punishments.");
                    return;
                }

                List<String> lines = new ArrayList<>();
                lines.add("§e" + target.username + "§7: "
                        + count(counts, "BAN", "ban") + ", " + count(counts, "MUTE", "mute") + ", "
                        + count(counts, "KICK", "kick") + ", " + count(counts, "WARN", "warning"));

                String sql = """
                    SELECT type, reason, publicBanId, issuedAt, expiresAt, active FROM punishments
                    WHERE playerUuid = ? ORDER BY issuedAt DESC, id DESC LIMIT 8
                    """;
                Instant now = Instant.now();
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, target.uuid);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            String type = rs.getString("type");
                            Timestamp expires = rs.getTimestamp("expiresAt");
                            boolean inForce = rs.getBoolean("active") && (expires == null || expires.toInstant().isAfter(now));
                            String state = "";
                            if (type.equals("BAN") || type.equals("MUTE")) {
                                state = inForce ? " §c(active)" : rs.getBoolean("active") ? " §8(expired)" : " §8(lifted)";
                            }
                            String age = Durations.human(Duration.between(rs.getTimestamp("issuedAt").toInstant(), now));
                            lines.add("§7" + type + " §f" + rs.getString("publicBanId") + " §8" + age + " ago §7"
                                    + rs.getString("reason") + state);
                        }
                    }
                }

                for (String line : lines) sender.sendMessage(LEGACY.deserialize(line));

                String site = messages.siteUrl();
                if (!site.isEmpty()) {
                    String url = site + "/staff/players/" + target.uuid;
                    sender.sendMessage(Component.text("Full profile: ", NamedTextColor.GRAY)
                            .append(Component.text(messages.siteHost() + "/staff/players/…", NamedTextColor.AQUA)
                                    .clickEvent(ClickEvent.openUrl(url))));
                }
            } catch (SQLException e) {
                plugin.getLogger().warning("/vhistory failed: " + e.getMessage());
                say(sender, "That failed, check the console.");
            }
        });
    }

    private static String count(Map<String, Integer> counts, String type, String word) {
        int n = counts.getOrDefault(type, 0);
        return n + " " + word + (n == 1 ? "" : "s");
    }

    // ── Admin ────────────────────────────────────────────────────────────

    private void admin(CommandSender sender, String[] args) {
        if (args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            plugin.reloadConfig();
            say(sender, "Config reloaded. Database settings and the alert interval still need a restart.");
            return;
        }
        say(sender, "VoidBans v" + plugin.getDescription().getVersion() + ". Usage: /voidbans reload");
    }

    // ── Shared ───────────────────────────────────────────────────────────

    private record Target(String uuid, String username) {}

    /**
     * An online player by exact name, otherwise the last known holder of that
     * name. Offline lookup means a ban can land on someone who already left.
     */
    private Target resolveTarget(Connection conn, String name) throws SQLException {
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) {
            return new Target(online.getUniqueId().toString(), online.getName());
        }
        String sql = "SELECT uuid, username FROM players WHERE username = ? ORDER BY lastLogin DESC LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new Target(rs.getString("uuid"), rs.getString("username"));
            }
        }
    }

    private boolean isLinkedStaff(Connection conn, String uuid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM staff_users WHERE minecraftUuid = ? LIMIT 1")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private void say(CommandSender sender, String text) {
        sender.sendMessage(LEGACY.deserialize(messages.prefix()).append(Component.text(text)));
    }
}
