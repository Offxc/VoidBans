import Link from "next/link";
import { redirect } from "next/navigation";
import { recordDenied } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppealResolveCard } from "@/components/AppealResolveCard";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";

const RESOLVED_SHOWN = 50;

export default async function AppealsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "appeals.view")) {
    await recordDenied(principal);
    redirect("/staff");
  }

  const showResolved = searchParams.tab === "resolved";
  const pendingCount = await prisma.appeal.count({ where: { status: "PENDING" } });

  return (
    <div>
      <PageHeader title="Appeals" meta={`${pendingCount} pending`} />

      <nav className="vb-tabs" aria-label="Appeals">
        <Link href="/staff/appeals" className="vb-tab" aria-current={showResolved ? undefined : "page"}>
          Pending
        </Link>
        <Link href="/staff/appeals?tab=resolved" className="vb-tab" aria-current={showResolved ? "page" : undefined}>
          Resolved
        </Link>
      </nav>

      {showResolved ? <ResolvedAppeals /> : <PendingAppeals canResolve={hasPermission(principal, "appeals.resolve")} />}
    </div>
  );
}

async function PendingAppeals({ canResolve }: { canResolve: boolean }) {
  const appeals = await prisma.appeal.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { punishment: { include: { player: { select: { username: true } } } } },
  });

  const questions = await prisma.appealQuestion.findMany({ orderBy: { sortOrder: "asc" } });
  const questionMap = new Map(questions.map((q) => [String(q.id), q.prompt]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {appeals.map((a) => (
        <AppealResolveCard
          key={a.id.toString()}
          appealId={a.id.toString()}
          banId={a.punishment.publicBanId}
          playerUsername={a.punishment.player.username}
          reason={a.punishment.reason}
          answers={Object.entries(a.answers as Record<string, string>).map(([id, text]) => ({
            prompt: questionMap.get(id) ?? id,
            text,
          }))}
          canResolve={canResolve}
        />
      ))}
      {appeals.length === 0 && (
        <div className="vb-panel" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>Nothing pending.</p>
        </div>
      )}
    </div>
  );
}

async function ResolvedAppeals() {
  const appeals = await prisma.appeal.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { resolvedAt: "desc" },
    take: RESOLVED_SHOWN,
    include: { punishment: { include: { player: { select: { username: true } } } } },
  });

  const resolverIds = [...new Set(appeals.map((a) => a.resolvedByDiscordId).filter((id): id is string => !!id))];
  const resolvers = await prisma.staffUser.findMany({
    where: { discordId: { in: resolverIds } },
    select: { discordId: true, username: true },
  });
  const resolverName = new Map(resolvers.map((r) => [r.discordId, r.username]));

  if (appeals.length === 0) {
    return (
      <div className="vb-panel" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>No appeals have been resolved yet.</p>
      </div>
    );
  }

  return (
    <div className="vb-panel" style={{ overflowX: "auto" }}>
      <table className="vb-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Player</th>
            <th>Decision</th>
            <th>Response</th>
            <th>By</th>
            <th>Resolved</th>
          </tr>
        </thead>
        <tbody>
          {appeals.map((a) => (
            <tr key={a.id.toString()}>
              <td>
                <a href={`/${a.punishment.publicBanId}`} className="vb-pill" style={{ textDecoration: "none" }}>
                  {a.punishment.publicBanId}
                </a>
              </td>
              <td>
                <Link
                  href={`/staff/players/${a.punishment.playerUuid}`}
                  style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}
                >
                  {a.punishment.player.username}
                </Link>
              </td>
              <td>
                {a.status === "ACCEPTED" ? (
                  <span className="vb-pill vb-pill-success">Accepted</span>
                ) : (
                  <span className="vb-pill vb-pill-danger">Denied</span>
                )}
              </td>
              <td style={{ maxWidth: 320, color: a.staffResponse ? undefined : "var(--text-faint)" }}>
                {a.staffResponse || "-"}
              </td>
              <td style={{ color: "var(--text-dim)" }}>
                {(a.resolvedByDiscordId && resolverName.get(a.resolvedByDiscordId)) || "-"}
              </td>
              <td>{a.resolvedAt ? <LocalTime iso={a.resolvedAt.toISOString()} smart /> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
