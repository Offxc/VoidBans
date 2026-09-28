package com.voidsmp.voidbans.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.bukkit.configuration.file.FileConfiguration;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.logging.Logger;

/**
 * Thin connection-pool wrapper over the schema Prisma owns (see
 * packages/web/prisma/schema.prisma). This plugin reads/writes rows in
 * that schema — it never runs migrations or DDL; the web/API side owns
 * the schema's shape.
 */
public final class Database {

    private final HikariDataSource pool;
    private final Logger logger;

    public Database(FileConfiguration config, Logger logger) {
        this.logger = logger;

        HikariConfig hikariConfig = new HikariConfig();
        String host = config.getString("database.host", "localhost");
        int port = config.getInt("database.port", 3306);
        String name = config.getString("database.name", "voidbans");

        hikariConfig.setJdbcUrl("jdbc:mysql://" + host + ":" + port + "/" + name
                + "?useSSL=true&serverTimezone=UTC");
        hikariConfig.setUsername(config.getString("database.user", "voidbans"));
        hikariConfig.setPassword(config.getString("database.password", ""));
        hikariConfig.setMaximumPoolSize(6);
        hikariConfig.setPoolName("VoidBans");

        this.pool = new HikariDataSource(hikariConfig);
    }

    public Connection getConnection() throws SQLException {
        return pool.getConnection();
    }

    public void close() {
        if (pool != null && !pool.isClosed()) {
            pool.close();
        }
    }
}
