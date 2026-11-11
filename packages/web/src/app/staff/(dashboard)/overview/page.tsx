import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getLockdown } from "@/lib/lockdown";
import { LocalTime } from "@/components/LocalTime";
import { LockdownControl } from "@/components/LockdownControl";
import { PageHeader } from "@/components/PageHeader";
import { PunishmentStatus } from "@/components/PunishmentStatus";

// The plugin reports every 30s; two missed beats and it counts as offline.
const ONLINE_WITHIN_MS = 90_000;

const TYPE_LABEL: Record<string, string> = { BAN: "Ban", MUTE: "Mute", KICK: "Kick", WARN: "Warning" };

export default async function OverviewPage() {
  const principal = await getStaffPrincipal();
  if (!principal) redirect("/staff/login");

  const canViewBans = hasPermission(principal, "bans.view");
  const canViewAppeals = hasPermission(principal, "appeals.view");
  const canViewPlayers = hasPermission(principal, "players.view_roster");
  const canLockdown = hasPermission(principal, "server.lockdown");

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const inForce = { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  const [onlineCount, pendingAppeals, issuedToday, activeBans, recent, instances, lockdown] = await Promise.all([
    canViewPlayers ? prisma.player.count({ where: { isOnline: true } }) : null,
    canViewAppeals ? prisma.appeal.count({ where: { status: "PENDING" } }) : null,
    canViewBans ? prisma.punishment.count({ where: { issuedAt: { gte: dayAgo } } }) : null,
    canViewBans ? prisma.punishment.count({ where: { type: "BAN", ...inForce } }) : null,
    canViewBans
      ? prisma.punishment.findMany({
          orderBy: { issuedAt: "desc" },
          take: 8,
          include: { player: { select: { username: true } } },
        })
      : [],
    prisma.pluginInstance.findMany({ orderBy: { serverId: "asc" } }),
    getLockdown(),
  ]);

  const isConnected = (lastSeenAt: Date) => now.getTime() - lastSeenAt.getTime() <= ONLINE_WITHIN_MS;
  const serverConnected = instances.some((i) => isConnected(i.lastSeenAt));

  const stats = [
    { label: "Players online", value: onlineCount, href: "/staff/players" },
    { label: "Pending appeals", value: pendingAppeals, href: "/staff/appeals" },
    { label: "Punishments in 24h", value: issuedToday, href: "/staff/bans" },
    { label: "Active bans", value: activeBans, href: "/staff/bans?type=BAN&status=active" },
  ].filter((s): s is { label: string; value: number; href: string } => s.value !== null);

  return (
    <div>
      <PageHeader
        title="Overview"
        actions={canLockdown ? <LockdownControl enabled={lockdown.enabled} serverConnected={serverConnected} /> : undefined}
      />

      {stats.length > 0 && (
        <div className="vb-stats">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="vb-card vb-stat">
              <span className="vb-stat-value">{s.value.toLocaleString()}</span>
              <span className="vb-stat-label">{s.label}</span>
            </Link>
          ))}
        </div>
      )}

      {canViewBans && (
        <div className="vb-section">
          <div className="vb-section-label">Recent punishments</div>
          <div className="vb-panel" style={{ overflowX: "auto" }}>
            <table className="vb-table">
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id.toString()}>
                    <td>
                      <a href={`/${p.publicBanId}`} className="vb-pill" style={{ textDecoration: "none" }}>
                        {p.publicBanId}
                      </a>
                    </td>
                    <td>
                      <Link href={`/staff/players/${p.playerUuid}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}>
                        {p.player.username}
                      </Link>
                    </td>
                    <td>{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td style={{ maxWidth: 280, color: "var(--text-dim)" }}>{p.reason}</td>
                    <td style={{ color: "var(--text-dim)" }}>{p.staffUsername ?? "-"}</td>
                    <td>
                      <LocalTime iso={p.issuedAt.toISOString()} smart />
                    </td>
                    <td>
                      <PunishmentStatus
                        active={p.active}
                        expiresAt={p.expiresAt?.toISOString() ?? null}
                        type={p.type}
                        delivered={p.deliveredAt !== null}
                      />
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td style={{ color: "var(--text-dim)" }}>No punishments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="vb-section">
        <div className="vb-section-label">Servers</div>
        <div className="vb-panel" style={{ padding: instances.length === 0 ? 18 : 0, overflowX: "auto" }}>
          {instances.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14 }}>No server has connected yet.</p>
          ) : (
            <table className="vb-table vb-table-compact">
              <tbody>
                {instances.map((i) => (
                  <tr key={i.serverId}>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{i.serverId}</td>
                    <td>
                      {isConnected(i.lastSeenAt) ? (
                        <span className="vb-pill vb-pill-success">Connected</span>
                      ) : (
                        <span className="vb-pill vb-pill-danger">Not reporting</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-dim)", textAlign: "right" }}>Plugin {i.pluginVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
