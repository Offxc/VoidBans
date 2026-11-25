package com.voidsmp.voidbans.staff;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * The site's Discord webhook (Settings on the site), so punishments issued in game appear in the same channel as
 * those issued there. The address grants posting rights, so it is never logged.
 */
final class Webhook {
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    Webhook(Logger logger) {
        this.logger = logger;
    }

    private static String setting(Connection c, String key) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT value FROM site_settings WHERE `key` = ?")) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    /** Never fails the action that caused it. */
    void send(Connection c, String event, String title, String description, int color, String url) {
        try {
            String address = Json.unquote(setting(c, "discord_webhook.url"));
            if (address == null || address.isBlank()) return;
            String events = setting(c, "discord_webhook.events");
            if (events != null && Pattern.compile("\"" + event + "\"\\s*:\\s*false").matcher(events).find()) return;

            String embed = "{\"title\":" + Json.quote(title) + ",\"description\":" + Json.quote(description) + ",\"color\":" + color
                    + (url == null ? "" : ",\"url\":" + Json.quote(url)) + ",\"timestamp\":" + Json.quote(Instant.now().toString()) + "}";
            HttpRequest request = HttpRequest.newBuilder(URI.create(address)).timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"embeds\":[" + embed + "],\"allowed_mentions\":{\"parse\":[]}}"))
                    .build();
            http.sendAsync(request, HttpResponse.BodyHandlers.discarding()).whenComplete((response, error) -> {
                if (error != null) logger.warning("Discord webhook post failed: " + error.getClass().getSimpleName());
                else if (response.statusCode() >= 300) logger.warning("Discord webhook post was refused (" + response.statusCode() + ")");
            });
        } catch (SQLException | RuntimeException e) {
            logger.warning("Discord webhook post failed: " + e.getClass().getSimpleName());
        }
    }
}
