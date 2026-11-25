package com.voidsmp.voidbans.command;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.staff.StaffService;
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
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

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

    public PunishmentCommand(VoidBansPlugin plugin, Database db, MessageTemplate messages) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
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
    // The website's permissions decide what is allowed: see StaffService.

    private static UUID staffId(CommandSender sender) {
        return sender instanceof Player p ? p.getUniqueId() : null; // null is the console
    }

    /** Finds the player in the background, then carries on from the server thread. */
    private void withTarget(CommandSender sender, String name, Consumer<Target> then) {
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) {
            then.accept(new Target(online.getUniqueId().toString(), online.getName()));
            return;
        }
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, name);
                if (target == null) {
                    say(sender, "No known player found named " + name + ".");
                    return;
                }
                Bukkit.getScheduler().runTask(plugin, () -> then.accept(target));
            } catch (SQLException e) {
                plugin.getLogger().warning("Looking up " + name + " failed: " + e.getMessage());
                say(sender, "That failed, check the console.");
            }
        });
    }

    private void report(CommandSender sender, CompletableFuture<StaffService.Result> result) {
        result.whenComplete((r, error) -> say(sender, error != null ? "That failed, check the console." : r.message()));
    }

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

        String reason = String.join(" ", Arrays.copyOfRange(args, reasonStart, args.length));
        final Long durationSeconds = seconds;
        withTarget(sender, args[0], target -> report(sender, plugin.staff().issue(staffId(sender), new StaffService.Order(
                UUID.fromString(target.uuid), type, reason, durationSeconds, List.of(), null, timed, false))));
    }

    // ── Revoking ─────────────────────────────────────────────────────────

    private void revoke(CommandSender sender, String[] args, String type) {
        String word = type.equals("BAN") ? "ban" : "mute";
        if (args.length < 1) {
            say(sender, "Usage: /vun" + word + " <player>");
            return;
        }
        String reason = args.length > 1 ? String.join(" ", Arrays.copyOfRange(args, 1, args.length)) : null;
        withTarget(sender, args[0], target -> report(sender,
                plugin.staff().revokeAll(staffId(sender), UUID.fromString(target.uuid), type, reason)));
    }

    // ── History ──────────────────────────────────────────────────────────

    private void history(CommandSender sender, String[] args) {
        if (args.length < 1) {
            say(sender, "Usage: /vhistory <player>");
            return;
        }
        withTarget(sender, args[0], target -> plugin.staff().history(staffId(sender), UUID.fromString(target.uuid))
                .whenComplete((history, error) -> {
                    if (error != null) say(sender, "That failed, check the console.");
                    else if (!history.access().can("bans.view")) say(sender, history.access().problem() != null
                            ? history.access().problem() : "You don't have permission on the punishment site to view punishments.");
                    else showHistory(sender, target);
                }));
    }

    private void showHistory(CommandSender sender, Target target) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
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

    private void say(CommandSender sender, String text) {
        sender.sendMessage(LEGACY.deserialize(messages.prefix()).append(Component.text(text)));
    }
}
