package com.voidsmp.voidbans.staff;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.state.MuteCache;
import com.voidsmp.voidbans.task.WarningDelivery;
import com.voidsmp.voidbans.util.BanIdGenerator;
import com.voidsmp.voidbans.util.Durations;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Punishing from inside the game, the way the website does it: the same permissions (taken from the staff member's
 * Discord roles through their linked Minecraft account), the same rulebook and templates, the same rows, audit
 * entries and Discord webhook posts. Used by the /v commands and by staff menus in other plugins.
 *
 * <p>Call from the server thread. Database work happens in the background and the returned future completes there,
 * so callers must switch back to the server thread before touching the game. A staff UUID of null means the console,
 * which may do anything.
 */
public final class StaffService {

    public record Rule(long id, String category, String code, String title, String description,
                       String suggestedType, Long defaultDuration, boolean defaultAppealable) {}

    public record Template(long id, String name, String type, String reason, Long duration, boolean appealable) {}

    /** What a staff member may do. Not linked means the site has no staff account with their Minecraft UUID. */
    public record Access(boolean console, boolean linked, boolean owner, String discordId, String name, Set<String> permissions) {
        public boolean can(String key) {
            return console || owner || permissions.contains(key);
        }

        /** Why nothing at all is allowed, or null. */
        public String problem() {
            if (console || owner) return null;
            if (!linked) return "Your Minecraft account isn't linked to a staff account on the punishment site.";
            if (permissions.isEmpty()) return "Your Discord roles give you no permissions on the punishment site.";
            return null;
        }
    }

    public record Panel(Access access, boolean rulesEnabled, boolean templatesEnabled, List<Rule> rules,
                        List<Template> templates, boolean targetIsStaff) {}

    /** type is BAN, MUTE, KICK or WARN. A duration makes a ban or mute temporary. */
    public record Order(UUID target, String type, String reason, Long durationSeconds, List<Long> ruleIds,
                        Long templateId, boolean appealable, boolean ipBan) {}

    public record Result(boolean ok, String message, String banId) {
        static Result refused(String why) {
            return new Result(false, why, null);
        }
    }

    /** One punishment from a player's history. Times are epoch milliseconds. */
    public record Entry(long id, String type, String banId, String reason, String staff, long issued, Long expires,
                        boolean active, boolean ipBanned, Long revoked, boolean appealable) {
        public boolean lifted() {
            return revoked != null;
        }

        public boolean inForce() {
            return active && (type.equals("BAN") || type.equals("MUTE"))
                    && (expires == null || expires > System.currentTimeMillis());
        }
    }

    public record History(Access access, List<Entry> entries) {}

    private static final Pattern QUOTED = Pattern.compile("\"(\\d{5,32})\"");
    private static final int HISTORY_LIMIT = 135;

    private final VoidBansPlugin plugin;
    private final Database db;
    private final MessageTemplate messages;
    private final MuteCache mutes;
    private final Webhook webhook;

    public StaffService(VoidBansPlugin plugin, Database db, MessageTemplate messages, MuteCache mutes) {
        this.plugin = plugin;
        this.db = db;
        this.messages = messages;
        this.mutes = mutes;
        this.webhook = new Webhook(plugin.getLogger());
    }

    /** The permission issuing this needs: temporary and permanent are separate permissions. */
    public static String issueKey(String type, boolean temporary) {
        return switch (type) {
            case "BAN" -> temporary ? "punish.temp_ban" : "punish.ban";
            case "MUTE" -> temporary ? "punish.temp_mute" : "punish.mute";
            case "WARN" -> "punish.warn";
            default -> "punish.kick";
        };
    }

    /** The permission lifting this needs, or null if it never stays in force. */
    public static String revokeKey(String type) {
        return switch (type) {
            case "BAN" -> "punish.unban";
            case "MUTE" -> "punish.unmute";
            default -> null;
        };
    }

    private interface Work<T> {
        T run(Connection c) throws Exception;
    }

    private <T> CompletableFuture<T> background(String what, Work<T> work) {
        CompletableFuture<T> future = new CompletableFuture<>();
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (Connection c = db.getConnection()) {
                future.complete(work.run(c));
            } catch (Throwable e) {
                plugin.getLogger().warning(what + " failed: " + e.getMessage());
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    // ── Who may do what ──────────────────────────────────────────────────

    private Access access(Connection c, UUID staff) throws SQLException {
        if (staff == null) return new Access(true, true, false, null, "console", Set.of());
        String discordId = null, name = null, roles = null;
        boolean owner = false;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT discordId, username, discordRoles, isOwner FROM staff_users WHERE minecraftUuid = ? LIMIT 1")) {
            ps.setString(1, staff.toString());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    discordId = rs.getString("discordId");
                    name = rs.getString("username");
                    roles = rs.getString("discordRoles");
                    owner = rs.getBoolean("isOwner");
                }
            }
        }
        if (discordId == null) return new Access(false, false, false, null, null, Set.of());

        List<String> roleIds = new ArrayList<>();
        Matcher m = QUOTED.matcher(roles == null ? "" : roles);
        while (m.find()) roleIds.add(m.group(1));

        Set<String> permissions = new HashSet<>();
        if (!roleIds.isEmpty()) {
            String marks = String.join(",", roleIds.stream().map(r -> "?").toList());
            try (PreparedStatement ps = c.prepareStatement("SELECT p.permissionKey FROM staff_permissions p "
                    + "JOIN staff_roles r ON r.id = p.roleId WHERE r.discordRoleId IN (" + marks + ")")) {
                for (int i = 0; i < roleIds.size(); i++) ps.setString(i + 1, roleIds.get(i));
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) permissions.add(rs.getString(1));
                }
            }
        }
        return new Access(false, true, owner, discordId, name, Set.copyOf(permissions));
    }

    private static boolean isStaff(Connection c, UUID player) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM staff_users WHERE minecraftUuid = ? LIMIT 1")) {
            ps.setString(1, player.toString());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String setting(Connection c, String key) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT value FROM site_settings WHERE `key` = ?")) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    // ── The punish menu ──────────────────────────────────────────────────

    public CompletableFuture<Panel> panel(UUID staff, UUID target) {
        return background("Loading the punish menu", c -> {
            Access access = access(c, staff);
            // the same defaults as the site: templates on until turned off, the rulebook off until turned on
            String templatesSetting = setting(c, "punishing.templates_enabled");
            boolean templatesEnabled = templatesSetting == null || templatesSetting.trim().equals("true");
            String rulesSetting = setting(c, "punishing.rules_enabled");
            boolean rulesEnabled = rulesSetting != null && rulesSetting.trim().equals("true");

            List<Rule> rules = new ArrayList<>();
            if (rulesEnabled) {
                try (PreparedStatement ps = c.prepareStatement("SELECT c.name AS category, r.id, r.code, r.title, r.description, "
                        + "r.suggestedType, r.defaultDuration, r.defaultAppealable FROM punishment_rules r "
                        + "JOIN rule_categories c ON c.id = r.categoryId WHERE r.active = TRUE "
                        + "ORDER BY c.sortOrder, c.id, r.sortOrder, r.code");
                     ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        rules.add(new Rule(rs.getLong("id"), rs.getString("category"), rs.getString("code"), rs.getString("title"),
                                rs.getString("description"), rs.getString("suggestedType"), nullableLong(rs, "defaultDuration"),
                                rs.getBoolean("defaultAppealable")));
                    }
                }
            }
            List<Template> templates = new ArrayList<>();
            if (templatesEnabled) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT id, name, type, defaultReason, defaultDuration, defaultAppealable FROM punishment_templates ORDER BY name");
                     ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        templates.add(new Template(rs.getLong("id"), rs.getString("name"), rs.getString("type"),
                                rs.getString("defaultReason"), nullableLong(rs, "defaultDuration"), rs.getBoolean("defaultAppealable")));
                    }
                }
            }
            boolean targetIsStaff = !access.console() && !access.owner() && isStaff(c, target);
            return new Panel(access, rulesEnabled, templatesEnabled, rules, templates, targetIsStaff);
        });
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    // ── Issuing ──────────────────────────────────────────────────────────

    public CompletableFuture<Result> issue(UUID staff, Order order) {
        boolean online = Bukkit.getPlayer(order.target()) != null;
        return background("Punishing", c -> {
            String type = order.type();
            if (!List.of("BAN", "MUTE", "KICK", "WARN").contains(type)) return Result.refused("Unknown punishment type.");
            String reason = order.reason() == null ? "" : order.reason().trim();
            if (reason.isEmpty()) return Result.refused("A reason is needed.");
            if (reason.length() > 2000) return Result.refused("The reason is too long.");

            // only bans and mutes can be temporary; a length sent with anything else is ignored
            boolean stays = type.equals("BAN") || type.equals("MUTE");
            Long seconds = stays ? order.durationSeconds() : null;

            Access access = access(c, staff);
            String key = issueKey(type, seconds != null);
            if (!access.can(key)) {
                audit(c, access, "access.denied", "player", order.target().toString(), "denied",
                        Json.object("reason", "missing_permission", "needs", key));
                String problem = access.problem();
                return Result.refused(problem != null ? problem : "You don't have permission on the punishment site to issue this.");
            }

            String username;
            try (PreparedStatement ps = c.prepareStatement("SELECT username FROM players WHERE uuid = ?")) {
                ps.setString(1, order.target().toString());
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return Result.refused("The punishment site has no record of that player yet.");
                    username = rs.getString(1);
                }
            }

            if (!access.console() && !access.owner() && isStaff(c, order.target())) {
                audit(c, access, "access.denied", "player", order.target().toString(), "denied",
                        Json.object("reason", "target_is_staff", "type", type));
                return Result.refused(username + " is staff and can't be punished here.");
            }
            if (type.equals("KICK") && !online) return Result.refused(username + " isn't online, so they can't be kicked.");

            boolean wantsIp = order.ipBan() && type.equals("BAN");
            String ip = null;
            if (wantsIp) {
                if (!access.can("players.view_ip")) {
                    audit(c, access, "access.denied", "player", order.target().toString(), "denied",
                            Json.object("reason", "ip_ban_without_view_ip"));
                    return Result.refused("IP bans need the permission to view IP addresses.");
                }
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT ipAddress FROM sessions WHERE playerUuid = ? AND ipAddress IS NOT NULL ORDER BY loginAt DESC LIMIT 1")) {
                    ps.setString(1, order.target().toString());
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) ip = rs.getString(1);
                    }
                }
            }

            // a warning for someone offline stays undelivered and is shown when they next join
            boolean delivered = !type.equals("WARN") || online;
            long id = -1;
            String banId = null;
            c.setAutoCommit(false);
            try {
                for (int attempt = 0; attempt < 5 && banId == null; attempt++) {
                    String candidate = BanIdGenerator.generate();
                    try {
                        id = insert(c, candidate, order, access, reason, seconds, stays, ip, delivered);
                        banId = candidate;
                    } catch (SQLIntegrityConstraintViolationException duplicate) {
                        if (!String.valueOf(duplicate.getMessage()).contains("publicBanId")) throw duplicate;
                    }
                }
                if (banId == null) {
                    c.rollback();
                    return Result.refused("Couldn't create a unique ID. Try again.");
                }
                if (order.ruleIds() != null) {
                    // rules deleted on the site in the meantime are left out rather than failing the punishment
                    try (PreparedStatement ps = c.prepareStatement(
                            "INSERT INTO punishment_rule_links (punishmentId, ruleId) SELECT ?, id FROM punishment_rules WHERE id = ?")) {
                        for (Long rule : new HashSet<>(order.ruleIds())) {
                            ps.setLong(1, id);
                            ps.setLong(2, rule);
                            ps.executeUpdate();
                        }
                    }
                }
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }

            audit(c, access, "punishment.issue", "punishment", Long.toString(id), "success",
                    "{\"type\":" + Json.quote(type) + ",\"publicBanId\":" + Json.quote(banId) + ",\"ipBanned\":" + (ip != null)
                            + ",\"via\":\"in-game\"}");

            String past = switch (type) {
                case "BAN" -> "banned";
                case "MUTE" -> "muted";
                case "KICK" -> "kicked";
                default -> "warned";
            };
            webhook.send(c, "punishment_issued", type + " issued",
                    "**" + username + "** was " + past + " by **" + access.name() + "**\nReason: " + reason, 0xf87171, link(banId));

            Instant expires = seconds == null ? null : Instant.now().plusSeconds(seconds);
            String issued = banId;
            if (plugin.isEnabled()) Bukkit.getScheduler().runTask(plugin, () -> apply(order.target(), type, reason, issued, expires));

            String length = !stays ? "" : seconds == null ? " permanently" : " for " + Durations.human(Duration.ofSeconds(seconds));
            String note = type.equals("WARN") && !online ? " They'll see it when they next join."
                    : wantsIp && ip == null ? " No IP address is on record, so no IP ban was added." : "";
            String verb = Character.toUpperCase(past.charAt(0)) + past.substring(1);
            return new Result(true, verb + " " + username + length + " (" + banId + ")." + note, banId);
        });
    }

    private long insert(Connection c, String banId, Order order, Access access, String reason, Long seconds,
                        boolean stays, String ip, boolean delivered) throws SQLException {
        String expires = seconds == null ? "NULL" : "DATE_ADD(NOW(), INTERVAL ? SECOND)";
        String sql = "INSERT INTO punishments (publicBanId, playerUuid, type, reason, templateId, staffDiscordId, staffUsername, "
                + "issuedAt, expiresAt, active, appealable, ipAddress, ipBanned, deliveredAt) VALUES (?, ?, ?, ?, "
                + "(SELECT id FROM punishment_templates WHERE id = ?), ?, ?, NOW(), " + expires + ", ?, ?, ?, ?, "
                + (delivered ? "NOW()" : "NULL") + ")";
        try (PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            int i = 1;
            ps.setString(i++, banId);
            ps.setString(i++, order.target().toString());
            ps.setString(i++, order.type());
            ps.setString(i++, reason);
            if (order.templateId() == null) ps.setNull(i++, Types.BIGINT);
            else ps.setLong(i++, order.templateId());
            ps.setString(i++, access.discordId());
            ps.setString(i++, access.name());
            if (seconds != null) ps.setLong(i++, seconds);
            ps.setBoolean(i++, stays);
            ps.setBoolean(i++, stays && order.appealable()); // only something still in force can be appealed
            ps.setString(i++, ip);
            ps.setBoolean(i, ip != null);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    /** Server thread: makes the punishment take effect for a player who is online right now. */
    private void apply(UUID uuid, String type, String reason, String banId, Instant expiresAt) {
        if (type.equals("MUTE")) mutes.put(uuid, new MuteCache.Mute(reason, banId, expiresAt));

        Player player = Bukkit.getPlayer(uuid);
        if (player == null) return;
        LegacyComponentSerializer legacy = LegacyComponentSerializer.legacySection();
        switch (type) {
            case "BAN" -> player.kick(legacy.deserialize(messages.render(expiresAt != null ? "temp-ban" : "ban", reason, banId, expiresAt)));
            case "KICK" -> player.kick(legacy.deserialize(messages.render("kick", reason, banId, null)));
            case "MUTE" -> player.sendMessage(legacy.deserialize(messages.render(expiresAt != null ? "temp-mute" : "mute", reason, banId, expiresAt)));
            default -> WarningDelivery.show(messages, player, reason, banId);
        }
    }

    private String link(String banId) {
        String site = messages.siteUrl();
        return site.isEmpty() ? null : site + "/" + banId;
    }

    // ── Lifting ──────────────────────────────────────────────────────────

    /** Lifts one punishment, picked from the history. */
    public CompletableFuture<Result> revoke(UUID staff, long punishmentId, String reason) {
        return background("Lifting a punishment", c -> lift(c, access(c, staff), punishmentId, reason));
    }

    /** Lifts every ban, or every mute, a player has in force. */
    public CompletableFuture<Result> revokeAll(UUID staff, UUID target, String type, String reason) {
        return background("Lifting a punishment", c -> {
            String needs = revokeKey(type);
            if (needs == null) return Result.refused("This type of punishment can't be lifted.");
            Access access = access(c, staff);
            if (!access.can(needs)) {
                audit(c, access, "access.denied", "player", target.toString(), "denied",
                        Json.object("reason", "missing_permission", "needs", needs));
                String problem = access.problem();
                return Result.refused(problem != null ? problem : "You don't have permission on the punishment site to lift this.");
            }
            List<Long> ids = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT id FROM punishments WHERE playerUuid = ? AND type = ? AND active = TRUE")) {
                ps.setString(1, target.toString());
                ps.setString(2, type);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) ids.add(rs.getLong(1));
                }
            }
            Result last = null;
            for (long id : ids) last = lift(c, access, id, reason);
            String word = type.toLowerCase();
            if (last == null) return Result.refused("They have no active " + word + ".");
            return last;
        });
    }

    private Result lift(Connection c, Access access, long id, String reason) throws SQLException {
        String type, banId, username;
        UUID target;
        boolean active;
        try (PreparedStatement ps = c.prepareStatement("SELECT p.type, p.publicBanId, p.active, p.playerUuid, pl.username "
                + "FROM punishments p JOIN players pl ON pl.uuid = p.playerUuid WHERE p.id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Result.refused("That punishment no longer exists.");
                type = rs.getString("type");
                banId = rs.getString("publicBanId");
                active = rs.getBoolean("active");
                target = UUID.fromString(rs.getString("playerUuid"));
                username = rs.getString("username");
            }
        }
        String needs = revokeKey(type);
        if (needs == null) return Result.refused("This type of punishment can't be lifted.");
        if (!access.can(needs)) {
            audit(c, access, "access.denied", "punishment", Long.toString(id), "denied",
                    Json.object("reason", "missing_permission", "needs", needs));
            String problem = access.problem();
            return Result.refused(problem != null ? problem : "You don't have permission on the punishment site to lift this.");
        }
        if (!active) return Result.refused("That punishment is no longer active.");

        String why = reason == null || reason.isBlank() ? null : reason.trim();
        try (PreparedStatement ps = c.prepareStatement(
                "UPDATE punishments SET active = FALSE, revokedAt = NOW(), revokedBy = ?, revokeReason = ? WHERE id = ? AND active = TRUE")) {
            ps.setString(1, access.discordId() != null ? access.discordId() : access.name());
            ps.setString(2, why);
            ps.setLong(3, id);
            if (ps.executeUpdate() == 0) return Result.refused("That punishment is no longer active.");
        }
        if (type.equals("MUTE")) mutes.remove(target); // another mute still in force is picked up again within seconds
        audit(c, access, "punishment.revoke", "punishment", Long.toString(id), "success",
                "{\"publicBanId\":" + Json.quote(banId) + ",\"via\":\"in-game\"}");
        webhook.send(c, "punishment_lifted", type + " lifted",
                "**" + username + "**'s " + type.toLowerCase() + " was revoked by **" + access.name() + "**"
                        + (why == null ? "" : "\nReason: " + why), 0x4ade80, link(banId));
        return new Result(true, (type.equals("BAN") ? "Unbanned " : "Unmuted ") + username + " (" + banId + ").", banId);
    }

    // ── History ──────────────────────────────────────────────────────────

    /** Newest first. The entries are empty when the staff member may not view punishments. */
    public CompletableFuture<History> history(UUID staff, UUID target) {
        return background("Loading punishment history", c -> {
            Access access = access(c, staff);
            List<Entry> entries = new ArrayList<>();
            if (!access.can("bans.view")) return new History(access, entries);
            try (PreparedStatement ps = c.prepareStatement("SELECT id, type, publicBanId, reason, staffUsername, issuedAt, expiresAt, "
                    + "active, ipBanned, revokedAt, appealable FROM punishments WHERE playerUuid = ? ORDER BY issuedAt DESC, id DESC LIMIT ?")) {
                ps.setString(1, target.toString());
                ps.setInt(2, HISTORY_LIMIT);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Timestamp expires = rs.getTimestamp("expiresAt"), revoked = rs.getTimestamp("revokedAt");
                        entries.add(new Entry(rs.getLong("id"), rs.getString("type"), rs.getString("publicBanId"), rs.getString("reason"),
                                rs.getString("staffUsername"), rs.getTimestamp("issuedAt").getTime(),
                                expires == null ? null : expires.getTime(), rs.getBoolean("active"), rs.getBoolean("ipBanned"),
                                revoked == null ? null : revoked.getTime(), rs.getBoolean("appealable")));
                    }
                }
            }
            return new History(access, entries);
        });
    }

    // ── Audit ────────────────────────────────────────────────────────────

    private void audit(Connection c, Access access, String action, String targetType, String targetId, String outcome, String details) {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO audit_log (actorDiscordId, actorUsername, action, targetType, "
                + "targetId, outcome, details, userAgent) VALUES (?, ?, ?, ?, ?, ?, ?, 'VoidBans plugin')")) {
            ps.setString(1, access.discordId());
            ps.setString(2, access.name());
            ps.setString(3, action);
            ps.setString(4, targetType);
            ps.setString(5, targetId);
            ps.setString(6, outcome);
            ps.setString(7, details);
            ps.executeUpdate();
        } catch (SQLException e) {
            plugin.getLogger().warning("Couldn't write the audit log entry for " + action + ": " + e.getMessage());
        }
    }
}
