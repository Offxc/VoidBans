import { recordDenied } from "@/lib/audit";
import { redirect, notFound } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission, ISSUE_KEY_BY_ACTION, revokeKeyFor } from "@/lib/permissions";
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
  if (!principal || !hasPermission(principal, "players.view_roster")) {
    await recordDenied(principal);
    redirect("/staff");
  }

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
  // Per action: issue it directly, request it, or not at all. A role can be
  // allowed to mute but not ban, so this is decided button by button.
  const canRequest = hasPermission(principal, "bans.request");
  const actionAccess: Record<string, "issue" | "request"> = {};
  for (const [action, key] of Object.entries(ISSUE_KEY_BY_ACTION)) {
    if (hasPermission(principal, key)) actionAccess[action] = "issue";
    else if (canRequest) actionAccess[action] = "request";
  }
  const canPunish = Object.keys(actionAccess).length > 0;
  const canRevokeType = (type: "BAN" | "MUTE" | "KICK" | "WARN") => hasPermission(principal, revokeKeyFor(type));

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
      canPunish
        ? prisma.punishmentTemplate.findMany({ orderBy: { name: "asc" } })
        : Promise.resolve([]),
      canPunish
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

  const showClient = sessions.some((s) => s.clientBrand);

  return (
    <div className="vb-profile">
      {/* Left rail: identity, risk signals, stats, and the punish action
          all stay in view while the right column scrolls, staff never
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

        {canPunish && !canPunishThisPlayer && (
          <p style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 16, textAlign: "center" }}>
            {targetStaffUser?.username} is staff and can&apos;t be punished here.
          </p>
        )}

        {canPunish && canPunishThisPlayer && (
          <div style={{ marginTop: 16 }}>
            <PunishmentPanel
              playerUuid={player.uuid}
              playerName={player.username}
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
              actionAccess={actionAccess}
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
                    {canRevokeType(p.type) && p.active && (
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
            <div className="vb-panel" style={{ overflowX: "auto" }}>
              {sessions.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0, padding: "14px 18px" }}>No sessions recorded.</p>
              ) : (
                <table className="vb-table vb-table-compact">
                  <thead>
                    <tr>
                      <th>Joined</th>
                      {showClient && <th>Client</th>}
                      {canViewIp && <th>IP</th>}
                      <th style={{ textAlign: "right" }}>Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => {
                      // A session only counts as live if it's the newest one and
                      // the player really is online. Any other session with no
                      // logout was cut off (crash, restart) and never closed, so
                      // its length is unknown rather than "in progress".
                      const live = s.logoutAt === null && i === 0 && player.isOnline;
                      return (
                        <tr key={s.id.toString()}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <LocalTime iso={s.loginAt.toISOString()} />
                          </td>
                          {showClient && <td style={{ color: "var(--text-dim)" }}>{s.clientBrand ?? "-"}</td>}
                          {canViewIp && (
                            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: "var(--text-dim)" }}>
                              {s.ipAddress ?? "-"}
                            </td>
                          )}
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {s.durationSeconds !== null ? (
                              formatDuration(s.durationSeconds)
                            ) : live ? (
                              <span className="vb-pill vb-pill-success">Online now</span>
                            ) : (
                              <span style={{ color: "var(--text-faint)" }} title="The server stopped before this session was closed">
                                Not recorded
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
  if (totalSeconds > 0 && totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
