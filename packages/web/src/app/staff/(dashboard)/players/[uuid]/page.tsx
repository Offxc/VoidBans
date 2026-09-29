import { redirect, notFound } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isVulcanIntegrationEnabled } from "@/lib/integrations";
import { getPunishmentModes } from "@/lib/punishment-modes";
import { PlayerHead } from "@/components/PlayerHead";
import { LocalTime } from "@/components/LocalTime";
import { PunishmentPanel } from "@/components/PunishmentPanel";
import { PunishmentStatus } from "@/components/PunishmentStatus";
import { RevokeButton } from "@/components/RevokeButton";
import { PlayerNotes } from "@/components/PlayerNotes";
import { PlayerAttachments } from "@/components/PlayerAttachments";
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
  const canRevoke = hasPermission(principal, "bans.revoke");

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
        ? prisma.punishmentRule.findMany({
            where: { active: true },
            orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
            include: { category: { select: { name: true } } },
          })
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

  const activePunishment = punishments.find((p) => p.active && (!p.expiresAt || p.expiresAt.getTime() > Date.now()));

  return (
    <div className="vb-profile">
      {/* Left rail: identity, risk signals, stats, and the punish action
          all stay in view while the right column scrolls — staff never
          lose sight of who they're looking at or their current status
          while reading through punishment history. */}
      <aside className={`vb-profile-rail ${activePunishment ? "vb-profile-rail-flagged" : ""}`}>
        <div className="vb-profile-identity">
          <PlayerHead uuid={player.uuid} size={72} />
          <div className="vb-profile-identity-text">
            <h1 style={{ fontSize: 19, margin: 0 }}>{player.username}</h1>
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
              {player.uuid}
            </div>
            {usernameHistory.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                Formerly: {usernameHistory.map((h) => h.username).join(", ")}
              </div>
            )}
            <div className="vb-profile-badges">
              {activePunishment && (
                <span className="vb-pill vb-pill-danger">Active {activePunishment.type.toLowerCase()}</span>
              )}
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
        </div>

        {!player.hasJoined && (
          <p style={{ color: "var(--text-dim)", fontSize: 12.5, margin: "14px 0 0" }}>
            Pre-created by staff. Hasn&apos;t connected yet. Any punishment takes effect on first join.
          </p>
        )}

        <div className="vb-profile-stats">
          {player.hasJoined && (
            <StatRow label="First joined" value={<LocalTime iso={player.firstJoined.toISOString()} />} />
          )}
          {canViewSessions && (
            <>
              <StatRow label="Playtime (30d)" value={formatDuration(last30DaysPlaytimeSeconds)} />
              <StatRow label="Sessions (30d)" value={String(last30DaysSessionCount)} />
            </>
          )}
          {canViewIp && uniqueIpCount !== null && <StatRow label="Distinct IPs" value={String(uniqueIpCount)} />}
        </div>

        {(canIssue || canRequest) && !canPunishThisPlayer && (
          <p style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 16, textAlign: "center" }}>
            {targetStaffUser?.username} is staff and can&apos;t be punished here.
          </p>
        )}

        {(canIssue || canRequest) && canPunishThisPlayer && (
          <div style={{ marginTop: 16 }}>
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
                categoryName: r.category.name,
                code: r.code,
                title: r.title,
                description: r.description,
              }))}
              templatesEnabled={punishmentModes.templatesEnabled}
              rulesEnabled={punishmentModes.rulesEnabled}
              canIssueDirectly={canIssue}
            />
          </div>
        )}
      </aside>

      {/* Right column: history, in priority order */}
      <div className="vb-profile-main">
        <div className="vb-section" style={{ marginTop: 0 }}>
          <div className="vb-section-label">Punishments ({punishments.length})</div>
          {punishments.length === 0 ? (
            <div className="vb-panel" style={{ padding: 18 }}>
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>No punishments on record.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {punishments.map((p) => (
                <div
                  key={p.id.toString()}
                  className="vb-punishment-row"
                  data-status={p.active ? "active" : "inactive"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <a href={`/${p.publicBanId}`} className="vb-pill" style={{ textDecoration: "none" }}>
                      {p.publicBanId}
                    </a>
                    <strong style={{ fontSize: 13.5 }}>
                      {p.type}
                      {p.ipBanned && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}> +IP</span>}
                    </strong>
                    <PunishmentStatus active={p.active} expiresAt={p.expiresAt?.toISOString() ?? null} />
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>
                      <LocalTime iso={p.issuedAt.toISOString()} />
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, margin: "8px 0 0" }}>{p.reason}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {p.staffUsername ? `by ${p.staffUsername}` : "issued by console"}
                    </span>
                    {p.appeal && (
                      <span className="vb-pill vb-pill-neutral" style={{ fontSize: 10.5 }}>
                        Appeal: {p.appeal.status.toLowerCase()}
                      </span>
                    )}
                    {canRevoke && p.active && (
                      <span style={{ marginLeft: "auto" }}>
                        <RevokeButton punishmentId={p.id.toString()} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid var(--glass-border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
