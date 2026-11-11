import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidBanIdFormat } from "@/lib/ban-id";
import { AppealPanel } from "@/components/AppealPanel";
import { PunishmentStatus } from "@/components/PunishmentStatus";
import { LocalTime } from "@/components/LocalTime";
import { TimeLeft } from "@/components/TimeLeft";
import { SiteShell } from "@/components/SiteShell";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { BAN: "Ban", MUTE: "Mute", KICK: "Kick", WARN: "Warning" };

const APPEAL_PILL: Record<string, { label: string; pill: string }> = {
  PENDING: { label: "Appeal pending", pill: "vb-pill-warn" },
  ACCEPTED: { label: "Appeal accepted", pill: "vb-pill-success" },
  DENIED: { label: "Appeal denied", pill: "vb-pill-danger" },
};

export default async function BanPage({ params }: { params: { banId: string } }) {
  const banId = params.banId.toUpperCase();
  if (!isValidBanIdFormat(banId)) notFound();

  const punishment = await prisma.punishment.findUnique({
    where: { publicBanId: banId },
    include: {
      appeal: true,
      ruleLinks: { include: { rule: { select: { code: true, title: true, description: true } } } },
    },
  });

  if (!punishment) notFound();

  const appealPill = punishment.appeal ? APPEAL_PILL[punishment.appeal.status] : undefined;
  // Still counting down: in force, with an end date that hasn't passed.
  const endsLater = punishment.active && punishment.expiresAt !== null && punishment.expiresAt.getTime() > Date.now();

  const typeLabel = `${punishment.expiresAt ? "Temporary " : ""}${TYPE_LABEL[punishment.type] ?? punishment.type}`;

  return (
    <SiteShell>
      <div className="vb-doc">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="vb-pill" style={{ fontFamily: "ui-monospace, monospace" }}>
            {punishment.publicBanId}
          </span>
          <PunishmentStatus
            active={punishment.active}
            expiresAt={punishment.expiresAt?.toISOString() ?? null}
            type={punishment.type}
            delivered={punishment.deliveredAt !== null}
          />
          {appealPill && <span className={`vb-pill ${appealPill.pill}`}>{appealPill.label}</span>}
        </div>
        <h1 className="vb-doc-title">{typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1).toLowerCase()}</h1>
        <p className="vb-doc-meta">
          Issued <LocalTime iso={punishment.issuedAt.toISOString()} />
        </p>

        <div className="vb-panel" style={{ padding: 24 }}>
          <dl className="vb-kv">
            <dt>Reason</dt>
            <dd>{punishment.reason}</dd>
            <dt>Ends</dt>
            <dd>
              {punishment.expiresAt ? <LocalTime iso={punishment.expiresAt.toISOString()} /> : "Never"}
              {endsLater && punishment.expiresAt && (
                <span style={{ color: "var(--text-dim)", marginLeft: 10 }}>
                  <TimeLeft iso={punishment.expiresAt.toISOString()} />
                </span>
              )}
            </dd>
            <dt>Appealable</dt>
            <dd>{punishment.appealable ? "Yes" : "No"}</dd>
          </dl>
        </div>

        {punishment.ruleLinks.length > 0 && (
          <div className="vb-section">
            <div className="vb-section-label">Rule{punishment.ruleLinks.length > 1 ? "s" : ""} broken</div>
            <div className="vb-panel">
              {punishment.ruleLinks.map(({ rule }, i) => (
                <div
                  key={rule.code}
                  style={{ padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    <span style={{ color: "var(--accent-text)", marginRight: 8 }}>{rule.code}</span>
                    {rule.title}
                  </div>
                  {rule.description && (
                    <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 4 }}>{rule.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {punishment.appealable && (
          <div className="vb-section">
            <div className="vb-section-label">Appeal</div>
            <AppealPanel
              banId={punishment.publicBanId}
              existingAppeal={
                punishment.appeal
                  ? { status: punishment.appeal.status, staffResponse: punishment.appeal.staffResponse }
                  : null
              }
            />
          </div>
        )}
      </div>
    </SiteShell>
  );
}
