import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { LocalTime } from "@/components/LocalTime";
import { PunishmentStatus } from "@/components/PunishmentStatus";

const PAGE_SIZE = 50;

export default async function PunishmentsListPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bans.view")) redirect("/staff");

  const page = Math.max(1, Number(searchParams.page) || 1);

  const [punishments, total] = await Promise.all([
    prisma.punishment.findMany({
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { player: { select: { username: true } } },
    }),
    prisma.punishment.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Punishments</h1>

      <div className="vb-panel" style={{ overflowX: "auto" }}>
        <table className="vb-table">
          <thead>
            <tr>
              <th>ID</th>
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

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <PageLink page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className="vb-btn vb-btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/staff/bans?page=${page}`} className="vb-btn vb-btn-ghost" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}
