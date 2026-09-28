import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PlayerHead } from "@/components/PlayerHead";
import { LocalTime } from "@/components/LocalTime";

export default async function PlayersPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_roster")) redirect("/staff");

  const [online, offline] = await Promise.all([
    prisma.player.findMany({ where: { isOnline: true }, orderBy: { username: "asc" } }),
    prisma.player.findMany({
      where: { isOnline: false },
      orderBy: { lastLogout: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Players</h1>

      <div className="vb-section">
        <div className="vb-section-label">Online</div>
        <div className="vb-panel" style={{ padding: 16 }}>
          <div style={gridStyle}>
            {online.map((p) => (
              <Link key={p.uuid} href={`/staff/players/${p.uuid}`} className="vb-card" style={cardStyle}>
                <PlayerHead uuid={p.uuid} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.username}</div>
                  <div style={{ fontSize: 12, color: "var(--success)" }}>Online</div>
                </div>
              </Link>
            ))}
            {online.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>Nobody online.</p>}
          </div>
        </div>
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Offline</div>
        <div className="vb-panel" style={{ padding: 16 }}>
          <div style={gridStyle}>
            {offline.map((p) => (
              <Link key={p.uuid} href={`/staff/players/${p.uuid}`} className="vb-card" style={cardStyle}>
                <PlayerHead uuid={p.uuid} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.username}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {p.lastLogout ? <LocalTime iso={p.lastLogout.toISOString()} relative /> : "Never seen"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  textDecoration: "none",
  color: "inherit",
};
