import { redirect } from "next/navigation";
import { recordDenied } from "@/lib/audit";
import Link from "next/link";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission, revokeKeyFor, REVOKE_KEYS } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LocalTime } from "@/components/LocalTime";
import { PunishmentStatus } from "@/components/PunishmentStatus";
import { RevokeButton } from "@/components/RevokeButton";
import { DeletePunishmentButton } from "@/components/DeletePunishmentButton";
import { PageHeader } from "@/components/PageHeader";

const PAGE_SIZE = 50;

const TYPES = ["BAN", "MUTE", "KICK", "WARN"] as const;
type PunishmentType = (typeof TYPES)[number];
const TYPE_LABEL: Record<PunishmentType, string> = { BAN: "Bans", MUTE: "Mutes", KICK: "Kicks", WARN: "Warnings" };

export default async function PunishmentsListPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; type?: string; status?: string };
}) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bans.view")) {
    await recordDenied(principal);
    redirect("/staff");
  }

  const canRevoke = REVOKE_KEYS.some((key) => hasPermission(principal, key));
  const canRevokeRow = (type: "BAN" | "MUTE" | "KICK" | "WARN") => {
    const key = revokeKeyFor(type);
    return key !== null && hasPermission(principal, key);
  };
  const isOwner = principal.isOwner;
  const showActions = canRevoke || isOwner;

  const page = Math.max(1, Number(searchParams.page) || 1);

  // Everything from the URL is untrusted: clamp it to known values before it reaches a query.
  const q = (searchParams.q ?? "").trim().slice(0, 64);
  const type = TYPES.find((t) => t === searchParams.type) ?? null;
  const status = searchParams.status === "active" || searchParams.status === "inactive" ? searchParams.status : null;
  const filtered = q !== "" || type !== null || status !== null;

  const now = new Date();
  const inForce: Prisma.PunishmentWhereInput = { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  const conditions: Prisma.PunishmentWhereInput[] = [];
  if (q) {
    conditions.push({
      OR: [
        { publicBanId: { contains: q } },
        { player: { username: { contains: q } } },
        { reason: { contains: q } },
        { staffUsername: { contains: q } },
      ],
    });
  }
  if (type) conditions.push({ type });
  if (status === "active") conditions.push(inForce);
  if (status === "inactive") conditions.push({ NOT: inForce });
  const where: Prisma.PunishmentWhereInput = { AND: conditions };

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (type) query.set("type", type);
  if (status) query.set("status", status);

  const [punishments, total] = await Promise.all([
    prisma.punishment.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { player: { select: { username: true } } },
    }),
    prisma.punishment.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Punishments" meta={`${total.toLocaleString()} ${filtered ? "matching" : "total"}`} />

      <form method="get" action="/staff/bans" className="vb-filters">
        <input
          className="vb-input"
          type="search"
          name="q"
          defaultValue={q}
          maxLength={64}
          placeholder="Player, ID, reason or staff"
          aria-label="Search punishments"
        />
        <select className="vb-select" name="type" defaultValue={type ?? ""} aria-label="Type">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select className="vb-select" name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">In force</option>
          <option value="inactive">Not in force</option>
        </select>
        <button type="submit" className="vb-btn vb-btn-primary">
          Search
        </button>
        {filtered && (
          <Link href="/staff/bans" className="vb-btn vb-btn-quiet" style={{ textDecoration: "none" }}>
            Clear
          </Link>
        )}
      </form>

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
              {showActions && <th></th>}
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
                  <Link href={`/staff/players/${p.playerUuid}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}>
                    {p.player.username}
                  </Link>
                </td>
                <td>{p.type}</td>
                <td style={{ maxWidth: 280 }}>{p.reason}</td>
                <td>
                  <LocalTime iso={p.issuedAt.toISOString()} smart />
                </td>
                <td>
                  <PunishmentStatus
                    active={p.active}
                    expiresAt={p.expiresAt?.toISOString() ?? null}
                    type={p.type}
                    delivered={p.deliveredAt !== null}
                  />
                </td>
                {showActions && (
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {p.active && canRevokeRow(p.type) && <RevokeButton punishmentId={p.id.toString()} />}
                      {isOwner && (
                        <DeletePunishmentButton
                          punishmentId={p.id.toString()}
                          banId={p.publicBanId}
                          playerName={p.player.username}
                          stillInForce={p.active}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {punishments.length === 0 && (
              <tr>
                <td colSpan={showActions ? 7 : 6} style={{ color: "var(--text-dim)" }}>
                  {filtered ? "Nothing matches." : "No punishments yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <PageLink page={page - 1} query={query} disabled={page <= 1}>
            Previous
          </PageLink>
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>
          <PageLink page={page + 1} query={query} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  page,
  query,
  disabled,
  children,
}: {
  page: number;
  query: URLSearchParams;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="vb-btn vb-btn-ghost" style={{ opacity: 0.4, pointerEvents: "none" }}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/staff/bans?${withPage(query, page)}`} className="vb-btn vb-btn-ghost" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}

function withPage(query: URLSearchParams, page: number): string {
  const next = new URLSearchParams(query);
  next.set("page", String(page));
  return next.toString();
}
