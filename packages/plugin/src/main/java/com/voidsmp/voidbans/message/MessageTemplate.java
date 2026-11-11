package com.voidsmp.voidbans.message;

import org.bukkit.ChatColor;
import com.voidsmp.voidbans.util.Durations;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.Plugin;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;

/**
 * Renders the owner-configurable messages in config.yml, substituting
 * {reason} {ban_id} {site_url} {site_host} {duration} {expires_at} and translating
 * '&' color codes. Kept independent of any specific event so both the
 * ban-time kick message and a later reconnect-attempt message can reuse it.
 */
public final class MessageTemplate {

    private static final DateTimeFormatter EXPIRY_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final Plugin plugin;

    public MessageTemplate(Plugin plugin) {
        this.plugin = plugin;
    }

    // Asked for each time, so /voidbans reload takes effect without a restart.
    private FileConfiguration config() {
        return plugin.getConfig();
    }

    public String siteUrl() {
        return config().getString("site-url", "").replaceAll("/+$", "");
    }

    /** The site address without the scheme, for showing on a screen where it can't be clicked. */
    public String siteHost() {
        return siteUrl().replaceFirst("^https?://", "");
    }

    public String prefix() {
        return ChatColor.translateAlternateColorCodes('&', config().getString("chat-prefix", ""));
    }

    public String render(String key, String reason, String banId, Instant expiresAt) {
        // No fallback argument here on purpose: getString(path) falls back to
        // the default shipped inside the jar, so a message added in a newer
        // version still works on a config.yml written by an older one.
        String template = config().getString("messages." + key);
        if (template == null) template = "";

        String duration = expiresAt == null ? "permanent"
                : Durations.human(java.time.Duration.between(Instant.now(), expiresAt));

        String rendered = template
                .replace("{reason}", reason == null ? "" : reason)
                .replace("{ban_id}", banId == null ? "" : banId)
                .replace("{site_url}", siteUrl())
                .replace("{site_host}", siteHost())
                .replace("{duration}", duration)
                .replace("{expires_at}", expiresAt == null ? "permanent" : EXPIRY_FORMAT.format(expiresAt));

        return ChatColor.translateAlternateColorCodes('&', rendered);
    }

    /**
     * Renders the staff-alert broadcast (config: staff-alerts.message),
     * prefixed with chat-prefix. Separate placeholder set from render()
     * above since this describes an action taken against a player, not a
     * message shown to the punished player themselves.
     */
    public String renderStaffAlert(String type, String typeVerb, String playerName, String staffName,
                                    String reason, String banId, String duration) {
        String template = config().getString("staff-alerts.message", "");

        String rendered = template
                .replace("{type}", type == null ? "" : type)
                .replace("{type_verb}", typeVerb == null ? "" : typeVerb)
                .replace("{player}", playerName == null ? "" : playerName)
                .replace("{staff}", staffName == null ? "console" : staffName)
                .replace("{reason}", reason == null ? "" : reason)
                .replace("{ban_id}", banId == null ? "" : banId)
                .replace("{duration}", duration == null ? "permanent" : duration);

        return prefix() + ChatColor.translateAlternateColorCodes('&', rendered);
    }

    /**
     * Renders any other configured line, prefixed with chat-prefix. Pairs are
     * placeholder name then value: format("alt-alerts.message", "player", name).
     */
    public String format(String path, String... pairs) {
        String rendered = config().getString(path, "");
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            rendered = rendered.replace("{" + pairs[i] + "}", pairs[i + 1] == null ? "" : pairs[i + 1]);
        }
        return prefix() + ChatColor.translateAlternateColorCodes('&', rendered);
    }
}
