import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { recordDenied } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ACTION_AREAS, ACTION_LABELS } from "@/lib/audit-labels";
import { AUDIT_OUTCOMES, auditWhere, filtersToQuery, parseAuditFilters } from "@/lib/audit-query";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const OUTCOME_PILL: Record<string, string> = {
  success: "vb-pill vb-pill-success",
  denied: "vb-pill vb-pill-warn",
  failure: "vb-pill vb-pill-danger",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "audit.view")) {
    await recordDenied(principal);
    redirect("/staff");
  }

  const filters = parseAuditFilters(searchParams);
  const where = auditWhere(filters);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Rows written before the name snapshot existed only have an id.
  const unnamed = Array.from(
    new Set(rows.filter((r) => r.actorDiscordId && !r.actorUsername).map((r) => r.actorDiscordId as string)),
  );
  const names = new Map(
    (unnamed.length
      ? await prisma.staffUser.findMany({ where: { discordId: { in: unnamed } }, select: { discordId: true, username: true } })
      : []
    ).map((u) => [u.discordId, u.username]),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(filters.area || filters.outcome || filters.actor || filters.target);

  return (
    <div>
      <PageHeader
        title="Audit log"
        meta={`${total.toLocaleString()} ${filtered ? "matching" : "total"}`}
        actions={
          <a
            href={`/api/staff/audit/export${filtersToQuery(filters)}`}
            className="vb-btn vb-btn-ghost"
            style={{ textDecoration: "none" }}
          >
            Export CSV
          </a>
        }
      />

      <form method="get" className="vb-panel" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <select name="area" defaultValue={filters.area} className="vb-select" style={{ width: "auto" }} aria-label="Area">
          <option value="">All areas</option>
          {ACTION_AREAS.map((a) => (
            <option key={a} value={a}>
              {a.replace("_", " ")}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={filters.outcome} className="vb-select" style={{ width: "auto" }} aria-label="Outcome">
          <option value="">Any outcome</option>
          {AUDIT_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input name="actor" defaultValue={filters.actor} placeholder="Actor name or Discord ID" maxLength={64} className="vb-input" style={{ width: 220 }} />
        <input name="target" defaultValue={filters.target} placeholder="Target ID" maxLength={64} className="vb-input" style={{ width: 180 }} />
        <button type="submit" className="vb-btn vb-btn-primary">
          Filter
        </button>
        {filtered && (
          <Link href="/staff/audit" className="vb-btn vb-btn-quiet" style={{ textDecoration: "none" }}>
            Clear
          </Link>
        )}
      </form>

      <div className="vb-panel" style={{ overflowX: "auto" }}>
        <table className="vb-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Result</th>
              <th>IP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const actor = r.actorUsername ?? (r.actorDiscordId ? names.get(r.actorDiscordId) ?? r.actorDiscordId : null);
              return (
                <tr key={r.id.toString()}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <LocalTime iso={r.createdAt.toISOString()} />
                  </td>
                  <td>{actor ?? <span style={{ color: "var(--text-faint)" }}>anonymous</span>}</td>
                  <td>
                    <div>{ACTION_LABELS[r.action] ?? r.action}</div>
                    <div style={{ color: "var(--text-faint)", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{r.action}</div>
                  </td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>
                    <span style={{ color: "var(--text-faint)" }}>{r.targetType}</span> {r.targetId}
                  </td>
                  <td>
                    <span className={OUTCOME_PILL[r.outcome] ?? "vb-pill vb-pill-neutral"}>{r.outcome}</span>
                  </td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: "var(--text-dim)" }}>{r.ipAddress ?? "-"}</td>
                  <td>
                    {(r.details !== null || r.userAgent) && (
                      <details>
                        <summary style={{ cursor: "pointer", color: "var(--accent-text)", fontSize: 12.5 }}>Details</summary>
                        <pre style={{ margin: "8px 0 0", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 360, color: "var(--text-dim)" }}>
                          {JSON.stringify(r.details ?? {}, null, 2)}
                          {r.userAgent ? `\n${r.userAgent}` : ""}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-dim)" }}>
                  {filtered ? "Nothing matches those filters." : "No events recorded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <PageLink filters={filters} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>
          <PageLink filters={filters} page={page + 1} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  children,
}: {
  filters: ReturnType<typeof parseAuditFilters>;
  page: number;
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
    <Link href={`/staff/audit${filtersToQuery(filters, { page: String(page) })}`} className="vb-btn vb-btn-ghost" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}
