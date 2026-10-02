import { prisma } from "@/lib/prisma";
import { LocalTime } from "@/components/LocalTime";

// The plugin reports every 30s; two missed beats and it counts as offline.
const ONLINE_WITHIN_MS = 90_000;

export async function PluginConnection() {
  const instances = await prisma.pluginInstance.findMany({ orderBy: { serverId: "asc" } });
  const now = Date.now();

  if (instances.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6 }}>
        No plugin has connected yet. In the plugin&apos;s <code>config.yml</code>, point{" "}
        <code>database</code> at the same MySQL database as this site, then restart the Minecraft server.
        It appears here within 30 seconds.
      </p>
    );
  }

  return (
    <table className="vb-table">
      <thead>
        <tr>
          <th>Server</th>
          <th>Status</th>
          <th>Plugin</th>
          <th>Platform</th>
          <th>Last seen</th>
        </tr>
      </thead>
      <tbody>
        {instances.map((i) => {
          const online = now - i.lastSeenAt.getTime() <= ONLINE_WITHIN_MS;
          return (
            <tr key={i.serverId}>
              <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{i.serverId}</td>
              <td>
                <span className={online ? "vb-pill vb-pill-success" : "vb-pill vb-pill-danger"}>
                  {online ? "Connected" : "Not reporting"}
                </span>
              </td>
              <td>{i.pluginVersion}</td>
              <td style={{ color: "var(--text-dim)" }}>{i.platform}</td>
              <td>
                <LocalTime iso={i.lastSeenAt.toISOString()} relative />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
