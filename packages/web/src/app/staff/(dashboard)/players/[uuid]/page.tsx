import { redirect, notFound } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isVulcanIntegrationEnabled } from "@/lib/integrations";
import { getPunishmentModes } from "@/lib/punishment-modes";
import { PlayerHead } from "@/components/PlayerHead";
import { LocalTime } from "@/components/LocalTime";
import { PunishmentPanel } from "@/components/PunishmentPanel";
import { PlayerNotes } from "@/components/PlayerNotes";
import { PlayerAttachments } from "@/components/PlayerAttachments";
import { ActivityTimeline, type ActivityEvent } from "@/components/ActivityTimeline";
import { ViolationHistory } from "@/components/ViolationHistory";

export default async function PlayerProfilePage({ params }: { params: { uuid: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_roster")) redirect("/staff");

  const player = await prisma.player.findUnique({ where: { uuid: params.uuid } });
  if (!player) notFound();

  const targetStaffUser = await prisma.staffUser.findFirst({
    where: { minecraftUuid: player.uuid },
    select: { username: true },
  });
  const canPunishThisPlayer = !targetStaffUser || principal.isOwner;

  const canViewSessions = hasPermission(principal, "players.view_sessions");
  const canViewIp = hasPermission(principal, "players.view_ip");
  const canViewNotes = hasPermission(principal, "players.notes");
  const canDeleteNotes = hasPermission(principal, "players.delete_notes");
  const canViewAttachments = hasPermission(principal, "players.view_attachments");
  const canAddAttachments = hasPermission(principal, "players.add_attachments");
  const canViewViolations = hasPermission(principal, "players.view_violations");
  const canIssue = hasPermission(principal, "bans.issue");
  const canRequest = hasPermission(principal, "bans.request");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const vulcanEnabled = await isVulcanIntegrationEnabled();
  const showViolations = vulcanEnabled && canViewViolations;
  const punishmentModes = await getPunishmentModes();

  const [sessions, last30DaysAgg, last30DaysSessionCount, punishments, templates, rules, usernameHistory, notes, violations, attachments] =
    await Promise.all([
      canViewSessions
        ? prisma.session.findMany({
            where: { playerUuid: player.uuid },
            orderBy: { loginAt: "desc" },
            take: 30,
          })
        : Promise.resolve([]),
      canViewSessions
        ? prisma.session.aggregate({
            where: { playerUuid: player.uuid, loginAt: { gte: thirtyDaysAgo } },
            _sum: { durationSeconds: true },
          })
        : Promise.resolve(null),
      canViewSessions
        ? prisma.session.count({
            where: { playerUuid: player.uuid, loginAt: { gte: thirtyDaysAgo } },
          })
        : Promise.resolve(0),
      prisma.punishment.findMany({
        where: { playerUuid: player.uuid },
        orderBy: { issuedAt: "desc" },
        include: { appeal: true },
      }),
      canIssue || canRequest
        ? prisma.punishmentTemplate.findMany({ orderBy: { name: "asc" } })
        : Promise.resolve([]),
      canIssue || canRequest
        ? prisma.punishmentRule.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] })
        : Promise.resolve([]),
      prisma.usernameHistory.findMany({
        where: { playerUuid: player.uuid },
        orderBy: { observedAt: "desc" },
        take: 10,
      }),
      canViewNotes
        ? prisma.playerNote.findMany({
            where: { playerUuid: player.uuid },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      showViolations
        ? prisma.violationEvent.findMany({
            where: { playerUuid: player.uuid },
            orderBy: { occurredAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      canViewAttachments
        ? prisma.playerAttachment.findMany({
            where: { playerUuid: player.uuid },
            orderBy: { createdAt: "desc" },
            select: { id: true, punishmentId: true, caption: true, authorUsername: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

  const last30DaysPlaytimeSeconds = last30DaysAgg?._sum.durationSeconds ?? 0;
  const uniqueIpCount = canViewIp
    ? new Set(sessions.map((s) => s.ipAddress).filter((ip): ip is string => !!ip)).size
    : null;

  const timeline: ActivityEvent[] = [
    ...punishments.map((p) => ({
      id: `punishment-${p.id}`,
      at: p.issuedAt.toISOString(),
      kind: "punishment" as const,
      summary: `${p.type}${p.ipBanned ? " + IP ban" : ""} — ${p.reason}`,
      detail: `${p.publicBanId} · ${punishmentStatusText(p.active, p.expiresAt)}${p.staffUsername ? ` · by ${p.staffUsername}` : ""}`,
    })),
    ...punishments
      .filter((p) => p.appeal)
      .map((p) => ({
        id: `appeal-${p.appeal!.id}`,
        at: p.appeal!.submittedAt.toISOString(),
        kind: "appeal" as const,
        summary: `Appeal submitted for ${p.publicBanId}`,
        detail: `Status: ${p.appeal!.status}`,
      })),
    ...(canViewNotes
      ? notes.map((n) => ({
          id: `note-${n.id}`,
          at: n.createdAt.toISOString(),
          kind: "note" as const,
          summary: n.body,
          detail: `Note by ${n.authorUsername}`,
        }))
      : []),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div>
      <div className="vb-panel-strong" style={{ padding: 22, display: "flex", alignItems: "center", gap: 16 }}>
        <PlayerHead uuid={player.uuid} size={56} />
        <div>
          <h1 style={{ fontSize: 21, margin: 0 }}>{player.username}</h1>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", fontFamily: "ui-monospace, monospace" }}>
            {player.uuid}
          </div>
          {usernameHistory.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              Formerly: {usernameHistory.map((h) => h.username).join(", ")}
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {targetStaffUser && <span className="vb-pill">Staff</span>}
          {!player.hasJoined ? (
            <span className="vb-pill vb-pill-warn">Never joined</span>
          ) : (
            <span className={`vb-pill ${player.isOnline ? "vb-pill-success" : "vb-pill-neutral"}`}>
              {player.isOnline ? "Online" : "Offline"}
            </span>
          )}
        </div>
      </div>

      {!player.hasJoined && (
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10 }}>
          This profile was pre-created by staff — {player.username} hasn&apos;t actually connected to the server
          yet. Any punishment issued here takes effect the moment they first join.
        </p>
      )}

      <div className="vb-panel" style={{ padding: 18, marginTop: 14 }}>
        <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 10, fontSize: 14, margin: 0 }}>
          {player.hasJoined && (
            <>
              <dt style={{ color: "var(--text-dim)" }}>First joined</dt>
              <dd style={{ margin: 0 }}><LocalTime iso={player.firstJoined.toISOString()} /></dd>
            </>
          )}
          {canViewSessions && (
            <>
              <dt style={{ color: "var(--text-dim)" }}>Playtime (last 30 days)</dt>
              <dd style={{ margin: 0 }}>{formatDuration(last30DaysPlaytimeSeconds)}</dd>
              <dt style={{ color: "var(--text-dim)" }}>Sessions (last 30 days)</dt>
              <dd style={{ margin: 0 }}>{last30DaysSessionCount}</dd>
            </>
          )}
          {canViewIp && uniqueIpCount !== null && (
            <>
              <dt style={{ color: "var(--text-dim)" }}>Distinct IPs (recent sessions)</dt>
              <dd style={{ margin: 0 }}>{uniqueIpCount}</dd>
            </>
          )}
        </dl>
      </div>

      {(canIssue || canRequest) && !canPunishThisPlayer && (
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 18 }}>
          {targetStaffUser?.username} is a staff member and can&apos;t be punished from here.
        </p>
      )}

      {(canIssue || canRequest) && canPunishThisPlayer && (
        <PunishmentPanel
          playerUuid={player.uuid}
          templates={templates.map((t) => ({
            id: t.id.toString(),
            name: t.name,
            type: t.type,
            defaultReason: t.defaultReason,
            defaultDuration: t.defaultDuration,
            defaultAppealable: t.defaultAppealable,
          }))}
          rules={rules.map((r) => ({
            id: r.id.toString(),
            code: r.code,
            title: r.title,
            type: r.type,
            defaultDuration: r.defaultDuration,
            defaultAppealable: r.defaultAppealable,
          }))}
          templatesEnabled={punishmentModes.templatesEnabled}
          rulesEnabled={punishmentModes.rulesEnabled}
          canIssueDirectly={canIssue}
        />
      )}

      <div className="vb-section">
        <div className="vb-section-label">Activity</div>
        <div className="vb-panel" style={{ padding: "4px 18px" }}>
          <ActivityTimeline events={timeline} />
        </div>
      </div>

      {canViewNotes && (
        <div className="vb-section">
          <div className="vb-section-label">Notes</div>
          <div className="vb-panel" style={{ padding: 18 }}>
            <PlayerNotes
              playerUuid={player.uuid}
              notes={notes.map((n) => ({
                id: n.id.toString(),
                body: n.body,
                authorUsername: n.authorUsername,
                createdAt: n.createdAt.toISOString(),
              }))}
              canWrite={canViewNotes}
              canDelete={canDeleteNotes}
            />
          </div>
        </div>
      )}

      {canViewAttachments && (
        <div className="vb-section">
          <div className="vb-section-label">Attachments</div>
          <div className="vb-panel" style={{ padding: 18 }}>
            <PlayerAttachments
              playerUuid={player.uuid}
              attachments={attachments.map((a) => ({
                id: a.id.toString(),
                punishmentId: a.punishmentId?.toString() ?? null,
                caption: a.caption,
                authorUsername: a.authorUsername,
                createdAt: a.createdAt.toISOString(),
              }))}
              canWrite={canAddAttachments}
            />
          </div>
        </div>
      )}

      {canViewSessions && (
        <div className="vb-section">
          <div className="vb-section-label">Recent sessions</div>
          <div className="vb-panel" style={{ padding: "4px 18px" }}>
            {sessions.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No sessions recorded.</p>}
            {sessions.map((s) => (
              <div
                key={s.id.toString()}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: "1px solid rgba(168, 130, 255, 0.08)",
                  fontSize: 14,
                }}
              >
                <span>
                  <LocalTime iso={s.loginAt.toISOString()} />
                  {s.clientBrand && (
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}> · {s.clientBrand}</span>
                  )}
                  {canViewIp && s.ipAddress && (
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}> · {s.ipAddress}</span>
                  )}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {s.durationSeconds ? formatDuration(s.durationSeconds) : "In progress"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showViolations && (
        <div className="vb-section">
          <div className="vb-section-label">Anticheat violations</div>
          <div className="vb-panel" style={{ padding: 18 }}>
            <ViolationHistory
              events={violations.map((v) => ({
                id: v.id.toString(),
                checkName: v.checkName,
                category: v.category,
                violationLevel: v.violationLevel,
                info: v.info,
                punished: v.punished,
                occurredAt: v.occurredAt.toISOString(),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function punishmentStatusText(active: boolean, expiresAt: Date | null): string {
  if (!active) return "Inactive";
  if (!expiresAt) return "Active · Permanent";
  if (expiresAt.getTime() <= Date.now()) return "Expired";
  return `Active until ${expiresAt.toLocaleString()}`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
