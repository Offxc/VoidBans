import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isValidBanIdFormat } from "@/lib/ban-id";
import { AppealPanel } from "@/components/AppealPanel";
import { PunishmentStatus } from "@/components/PunishmentStatus";

export default async function BanPage({ params }: { params: { banId: string } }) {
  const banId = params.banId.toUpperCase();
  if (!isValidBanIdFormat(banId)) notFound();

  const punishment = await prisma.punishment.findUnique({
    where: { publicBanId: banId },
    include: { appeal: true },
  });

  if (!punishment) notFound();

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "56px 24px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <div className="vb-panel" style={{ padding: 28, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{punishment.type}</h1>
          <span className="vb-pill">{punishment.publicBanId}</span>
          <PunishmentStatus active={punishment.active} expiresAt={punishment.expiresAt?.toISOString() ?? null} />
        </div>

        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 12, fontSize: 14, marginTop: 24 }}>
          <dt style={{ color: "var(--text-dim)" }}>Reason</dt>
          <dd style={{ margin: 0 }}>{punishment.reason}</dd>

          <dt style={{ color: "var(--text-dim)" }}>Issued</dt>
          <dd style={{ margin: 0 }} suppressHydrationWarning>
            {new Date(punishment.issuedAt).toLocaleString()}
          </dd>
        </dl>
      </div>

      {punishment.appealable && (
        <AppealPanel
          banId={punishment.publicBanId}
          existingAppeal={
            punishment.appeal
              ? {
                  status: punishment.appeal.status,
                  staffResponse: punishment.appeal.staffResponse,
                }
              : null
          }
        />
      )}
    </main>
  );
}
