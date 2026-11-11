package com.voidsmp.voidbans.listener;

import com.voidsmp.voidbans.VoidBansPlugin;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.state.MuteCache;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;

import java.util.List;
import java.util.Locale;

/**
 * Stops muted players talking: in public chat, and through the commands
 * listed under mute.blocked-commands (private messages, /me and so on).
 * Reads the in-memory mute cache, so neither check touches the database.
 */
public final class ChatListener implements Listener {

    private final VoidBansPlugin plugin;
    private final MessageTemplate messages;
    private final MuteCache mutes;

    public ChatListener(VoidBansPlugin plugin, MessageTemplate messages, MuteCache mutes) {
        this.plugin = plugin;
        this.messages = messages;
        this.mutes = mutes;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        MuteCache.Mute mute = mutes.active(event.getPlayer().getUniqueId());
        if (mute == null) return;
        event.setCancelled(true);
        tell(event.getPlayer(), mute);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        MuteCache.Mute mute = mutes.active(event.getPlayer().getUniqueId());
        if (mute == null) return;

        // "/minecraft:msg Steve hi" -> "msg"
        String label = event.getMessage().substring(1).split(" ", 2)[0].toLowerCase(Locale.ROOT);
        int namespace = label.indexOf(':');
        if (namespace >= 0) label = label.substring(namespace + 1);

        List<String> blocked = plugin.getConfig().getStringList("mute.blocked-commands");
        for (String command : blocked) {
            if (command.equalsIgnoreCase(label)) {
                event.setCancelled(true);
                tell(event.getPlayer(), mute);
                return;
            }
        }
    }

    private void tell(Player player, MuteCache.Mute mute) {
        String key = mute.expiresAt() != null ? "temp-mute" : "mute";
        player.sendMessage(LegacyComponentSerializer.legacySection()
                .deserialize(messages.render(key, mute.reason(), mute.banId(), mute.expiresAt())));
    }
}
