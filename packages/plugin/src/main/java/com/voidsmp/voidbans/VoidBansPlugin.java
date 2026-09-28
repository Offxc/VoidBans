package com.voidsmp.voidbans;

import com.voidsmp.voidbans.db.Database;
import com.voidsmp.voidbans.integration.VulcanIntegration;
import com.voidsmp.voidbans.listener.SessionListener;
import com.voidsmp.voidbans.message.MessageTemplate;
import com.voidsmp.voidbans.task.IntegrationSettingsPollTask;
import com.voidsmp.voidbans.task.StaffAlertTask;
import org.bukkit.plugin.java.JavaPlugin;

public final class VoidBansPlugin extends JavaPlugin {

    private Database database;
    private MessageTemplate messages;
    private StaffAlertTask staffAlertTask;
    private VulcanIntegration vulcanIntegration;
    private IntegrationSettingsPollTask integrationSettingsPollTask;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        this.database = new Database(getConfig(), getLogger());
        this.messages = new MessageTemplate(getConfig());
        this.vulcanIntegration = new VulcanIntegration(this, database);

        getServer().getPluginManager().registerEvents(
                new SessionListener(this, database, messages, vulcanIntegration), this);

        if (getConfig().getBoolean("staff-alerts.enabled", true)) {
            long intervalTicks = getConfig().getLong("staff-alerts.poll-interval-seconds", 5) * 20L;
            this.staffAlertTask = new StaffAlertTask(this, database, messages);
            staffAlertTask.runTaskTimerAsynchronously(this, intervalTicks, intervalTicks);
        }

        // 20s is frequent enough that toggling an integration in the
        // dashboard feels responsive, without polling so often it's
        // meaningfully more DB load than the staff-alert poll above.
        this.integrationSettingsPollTask = new IntegrationSettingsPollTask(this, database, vulcanIntegration);
        integrationSettingsPollTask.runTaskTimerAsynchronously(this, 0L, 20L * 20L);

        getLogger().info("VoidBans enabled — site-url: " + getConfig().getString("site-url"));
    }

    @Override
    public void onDisable() {
        if (staffAlertTask != null) {
            staffAlertTask.cancel();
        }
        if (integrationSettingsPollTask != null) {
            integrationSettingsPollTask.cancel();
        }
        if (database != null) {
            database.close();
        }
    }

    public Database database() {
        return database;
    }

    public MessageTemplate messages() {
        return messages;
    }

    public VulcanIntegration vulcanIntegration() {
        return vulcanIntegration;
    }
}
