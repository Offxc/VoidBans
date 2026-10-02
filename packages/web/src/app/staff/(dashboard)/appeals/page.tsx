import { redirect } from "next/navigation";
import { recordDenied } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AppealResolveCard } from "@/components/AppealResolveCard";
import { PageHeader } from "@/components/PageHeader";

export default async function AppealsPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "appeals.view")) {
    await recordDenied(principal);
    redirect("/staff");
  }

  const appeals = await prisma.appeal.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { punishment: { include: { player: { select: { username: true } } } } },
  });

  const questions = await prisma.appealQuestion.findMany({ orderBy: { sortOrder: "asc" } });
  const questionMap = new Map(questions.map((q) => [String(q.id), q.prompt]));

  const canResolve = hasPermission(principal, "appeals.resolve");

  return (
    <div>
      <PageHeader title="Appeals" meta={`${appeals.length} pending`} />

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
    </div>
  );
}
