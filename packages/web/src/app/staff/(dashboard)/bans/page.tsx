import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { LocalTime } from "@/components/LocalTime";
import { PunishmentStatus } from "@/components/PunishmentStatus";

export default async function BansListPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bans.view")) redirect("/staff");

  const punishments = await prisma.punishment.findMany({
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: { player: { select: { username: true } } },
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Bans</h1>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 0 }}>
        Most recent 100 punishments. Times are shown in your local timezone.
      </p>

      <div className="vb-panel" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="vb-table">
          <thead>
            <tr>
              <th>Ban ID</th>
              <th>Player</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Issued</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {punishments.map((p) => (
              <tr key={p.id.toString()}>
                <td>
                  <a href={`/${p.publicBanId}`} className="vb-pill" style={{ textDecoration: "none" }}>
                    {p.publicBanId}
                  </a>
                </td>
                <td>{p.player.username}</td>
                <td>{p.type}</td>
                <td style={{ maxWidth: 280 }}>{p.reason}</td>
                <td>
                  <LocalTime iso={p.issuedAt.toISOString()} />
                </td>
                <td>
                  <PunishmentStatus active={p.active} expiresAt={p.expiresAt?.toISOString() ?? null} />
                </td>
              </tr>
            ))}
            {punishments.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-dim)" }}>
                  No punishments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
