package com.voidsmp.voidbans.command;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.util.BanIdGenerator;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

/**
 * Implements /vban and /vunban, declared in plugin.yml from the start but
 * never actually wired to a CommandExecutor, so both commands have silently
 * done nothing until now. Issues a permanent ban only (no duration syntax,
 * matching the usage string in plugin.yml); a temp ban or mute has to come
 * from the web dashboard, which already supports both. Works against an
 * offline target too (looked up in the players table by username, so this
 * also covers Bedrock ".name" players and anyone pre-created via the
 * staff dashboard's "find a player who hasn't joined" lookup), the target
 * doesn't need to be online.
 */
public final class PunishmentCommand implements CommandExecutor {

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
        return switch (command.getName().toLowerCase()) {
            case "vban" -> handleBan(sender, args);
            case "vunban" -> handleUnban(sender, args);
            default -> false;
        };
    }

    private boolean handleBan(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(Component.text("Usage: /vban <player> <reason>"));
            return true;
        }

        String targetName = args[0];
        String reason = String.join(" ", java.util.Arrays.copyOfRange(args, 1, args.length));
        String staffName = sender instanceof Player ? sender.getName() : "console";

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, targetName);
                if (target == null) {
                    sender.sendMessage(Component.text("No known player found named " + targetName + "."));
                    return;
                }

                String publicBanId = BanIdGenerator.generate();
                insertPunishment(conn, target.uuid, "BAN", reason, staffName, publicBanId);

                sender.sendMessage(Component.text("Banned " + target.username + " (" + publicBanId + ")."));

                Player online = Bukkit.getPlayer(UUID.fromString(target.uuid));
                if (online != null) {
                    Bukkit.getScheduler().runTask(plugin, () ->
                            online.kick(Component.text(messages.render("ban", reason, publicBanId, null))));
                }
            } catch (SQLException e) {
                plugin.getLogger().warning("/vban failed: " + e.getMessage());
                sender.sendMessage(Component.text("Ban failed, check the console."));
            }
        });

        return true;
    }

    private boolean handleUnban(CommandSender sender, String[] args) {
        if (args.length < 1) {
            sender.sendMessage(Component.text("Usage: /vunban <player>"));
            return true;
        }

        String targetName = args[0];
        String staffName = sender instanceof Player ? sender.getName() : "console";

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try (var conn = db.getConnection()) {
                Target target = resolveTarget(conn, targetName);
                if (target == null) {
                    sender.sendMessage(Component.text("No known player found named " + targetName + "."));
                    return;
                }

                int updated = revokeActiveBan(conn, target.uuid, staffName);
                sender.sendMessage(Component.text(updated > 0
                        ? "Unbanned " + target.username + "."
                        : target.username + " has no active ban."));
            } catch (SQLException e) {
                plugin.getLogger().warning("/vunban failed: " + e.getMessage());
                sender.sendMessage(Component.text("Unban failed, check the console."));
            }
        });

        return true;
    }

    private record Target(String uuid, String username) {}

    /**
     * Online players first (so a live nickname/UUID is authoritative), then
     * falls back to the players table for anyone offline, covers Bedrock
     * players and anyone pre-created via the dashboard's pre-ban lookup,
     * neither of which Bukkit.getPlayer(String) alone would find.
     */
    private Target resolveTarget(java.sql.Connection conn, String name) throws SQLException {
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) {
            return new Target(online.getUniqueId().toString(), online.getName());
        }

        String sql = "SELECT uuid, username FROM players WHERE username = ? LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new Target(rs.getString("uuid"), rs.getString("username"));
            }
        }
    }

    private void insertPunishment(java.sql.Connection conn, String uuid, String type, String reason,
                                   String staffName, String publicBanId) throws SQLException {
        String sql = """
            INSERT INTO punishments (publicBanId, playerUuid, type, reason, staffUsername, issuedAt, active, appealable)
            VALUES (?, ?, ?, ?, ?, NOW(), TRUE, TRUE)
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, publicBanId);
            ps.setString(2, uuid);
            ps.setString(3, type);
            ps.setString(4, reason);
            ps.setString(5, staffName);
            ps.executeUpdate();
        }
    }

    private int revokeActiveBan(java.sql.Connection conn, String uuid, String staffName) throws SQLException {
        String sql = """
            UPDATE punishments SET active = FALSE, revokedAt = NOW(), revokedBy = ?
            WHERE playerUuid = ? AND type = 'BAN' AND active = TRUE
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, staffName);
            ps.setString(2, uuid);
            return ps.executeUpdate();
        }
    }
}
