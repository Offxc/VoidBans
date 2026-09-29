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
    <div>
      {/* Identity — avatar, name, and every risk signal staff need before scrolling */}
      <div className="vb-panel-strong" style={{ padding: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <PlayerHead uuid={player.uuid} size={56} />
        <div style={{ minWidth: 0 }}>
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {!player.hasJoined && (
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "10px 0 0" }}>
          This profile was pre-created by staff. {player.username} hasn&apos;t actually connected to the server
          yet. Any punishment issued here takes effect the moment they first join.
        </p>
      )}

      {/* Stat strip — compact tiles, not a vertical key:value list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        {player.hasJoined && (
          <StatTile label="First joined" value={<LocalTime iso={player.firstJoined.toISOString()} />} />
        )}
        {canViewSessions && (
          <>
            <StatTile label="Playtime (30d)" value={formatDuration(last30DaysPlaytimeSeconds)} />
            <StatTile label="Sessions (30d)" value={String(last30DaysSessionCount)} />
          </>
        )}
        {canViewIp && uniqueIpCount !== null && <StatTile label="Distinct IPs" value={String(uniqueIpCount)} />}
      </div>

      {/* Punish action bar */}
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
            categoryName: r.category.name,
            code: r.code,
            title: r.title,
            description: r.description,
          }))}
          templatesEnabled={punishmentModes.templatesEnabled}
          rulesEnabled={punishmentModes.rulesEnabled}
          canIssueDirectly={canIssue}
        />
      )}

      {/* Punishments — the primary reason staff land on this page, so it's
          its own table (not folded into a generic activity feed) right
          after the action to take one. */}
      <div className="vb-section">
        <div className="vb-section-label">Punishments ({punishments.length})</div>
        <div className="vb-panel" style={{ overflowX: "auto" }}>
          {punishments.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14, padding: 18, margin: 0 }}>No punishments on record.</p>
          ) : (
            <table className="vb-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Issued</th>
                  <th>Staff</th>
                  <th>Status</th>
                  {canRevoke && <th></th>}
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
                    <td>
                      {p.type}
                      {p.ipBanned && <span style={{ color: "var(--text-dim)" }}> +IP</span>}
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      {p.reason}
                      {p.appeal && (
                        <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>
                          Appeal: {p.appeal.status.toLowerCase()}
                        </div>
                      )}
                    </td>
                    <td>
                      <LocalTime iso={p.issuedAt.toISOString()} />
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{p.staffUsername ?? "—"}</td>
                    <td>
                      <PunishmentStatus active={p.active} expiresAt={p.expiresAt?.toISOString() ?? null} />
                    </td>
                    {canRevoke && <td>{p.active && <RevokeButton punishmentId={p.id.toString()} />}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vb-card" style={{ padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
