import { NextRequest, NextResponse } from "next/server";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { denyAccess, recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { auditWhere, parseAuditFilters } from "@/lib/audit-query";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

// A spreadsheet treats a cell starting with = + - @ (or a tab/CR) as a
// formula, so an attacker-controlled value like a reason or username could
// run when staff open the export. Prefixing a quote makes it plain text.
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "audit.view")) return denyAccess(principal);

  const filters = parseAuditFilters(Object.fromEntries(new URL(req.url).searchParams));
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(filters),
    orderBy: { id: "desc" },
    take: MAX_ROWS,
  });

  await recordAudit(principal, {
    action: "audit.export",
    targetType: "audit_log",
    targetId: "csv",
    details: { filters, rows: rows.length },
  });

  const header = ["id", "time", "actorDiscordId", "actor", "action", "targetType", "targetId", "outcome", "ip", "userAgent", "details"];
  const lines = rows.map((r) =>
    [
      r.id.toString(),
      r.createdAt.toISOString(),
      r.actorDiscordId,
      r.actorUsername,
      r.action,
      r.targetType,
      r.targetId,
      r.outcome,
      r.ipAddress,
      r.userAgent,
      r.details === null ? "" : JSON.stringify(r.details),
    ]
      .map(csvCell)
      .join(","),
  );

  return new NextResponse([header.map(csvCell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
