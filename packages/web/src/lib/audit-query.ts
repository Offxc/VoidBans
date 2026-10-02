import type { Prisma } from "@prisma/client";
import { ACTION_AREAS } from "@/lib/audit-labels";

export const AUDIT_OUTCOMES = ["success", "denied", "failure"] as const;

export interface AuditFilters {
  area: string;
  outcome: string;
  actor: string;
  target: string;
}

type Raw = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Filter values come straight from the query string, so each is checked
 * against what the UI can actually offer (area, outcome) or length-capped
 * (free text). Prisma parameterizes the rest.
 */
export function parseAuditFilters(raw: Raw): AuditFilters {
  const area = one(raw.area);
  const outcome = one(raw.outcome);
  return {
    area: (ACTION_AREAS as readonly string[]).includes(area) ? area : "",
    outcome: (AUDIT_OUTCOMES as readonly string[]).includes(outcome) ? outcome : "",
    actor: one(raw.actor).trim().slice(0, 64),
    target: one(raw.target).trim().slice(0, 64),
  };
}

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.area) and.push({ action: { startsWith: `${f.area}.` } });
  if (f.outcome) and.push({ outcome: f.outcome });
  if (f.actor) {
    and.push({ OR: [{ actorUsername: { contains: f.actor } }, { actorDiscordId: f.actor }] });
  }
  if (f.target) and.push({ targetId: { contains: f.target } });
  return and.length ? { AND: and } : {};
}

export function filtersToQuery(f: AuditFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `?${q}` : "";
}
