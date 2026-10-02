import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import type { StaffPrincipal } from "@/lib/permissions";

/**
 * Audit logging, written with the OWASP Logging Cheat Sheet in mind:
 *
 *  - who / what / when / where: actor id + name snapshot, action, target,
 *    outcome, timestamp, source IP and user agent.
 *  - security events, not just successes: sign-ins (good and bad), access
 *    denials and rate-limit hits are recorded alongside the staff actions.
 *  - no secrets: values under sensitive-looking keys are replaced before
 *    they are stored, and callers never pass credentials in the first place.
 *  - log injection: control characters (including newlines) are stripped
 *    from every string, and details are stored as structured JSON rather
 *    than interpolated into a text line.
 *  - bounded: strings, arrays and nesting depth are capped, and unauthenticated
 *    denial logging is rate limited per IP so it can't be used to flood the
 *    table.
 *  - append-only: nothing in the app updates or deletes these rows.
 *
 * Writes never throw. A broken audit write must not take down the action
 * being audited, but it is reported to stderr so it can't fail silently.
 */

export type AuditOutcome = "success" | "denied" | "failure";

export interface AuditActor {
  discordId: string;
  username: string;
}

export interface AuditEvent {
  action: string;
  targetType: string;
  targetId: string;
  outcome?: AuditOutcome;
  details?: unknown;
}

const SENSITIVE_KEY = /token|secret|password|passwd|authorization|cookie|api[-_]?key|webhook[-_]?url|session/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_DEPTH = 4;

function cleanString(value: string, max = MAX_STRING): string {
  const cleaned = value.replace(CONTROL_CHARS, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export function sanitizeDetails(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => sanitizeDetails(v, depth + 1)) as Prisma.InputJsonValue;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      const safeKey = cleanString(key, 64);
      out[safeKey] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeDetails(v, depth + 1);
    }
    return out as Prisma.InputJsonObject;
  }
  return null;
}

function requestContext(): { ipAddress: string | null; userAgent: string | null } {
  try {
    const h = headers();
    const ip = clientIpFromHeaders(h);
    const ua = h.get("user-agent");
    return {
      ipAddress: ip && ip !== "unknown" ? cleanString(ip, 45) : null,
      userAgent: ua ? cleanString(ua, 255) : null,
    };
  } catch {
    // Called outside a request (a script, a build step) — nothing to record.
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Builds the row without writing it, for callers that need the insert to be
 * part of a prisma.$transaction alongside the change it describes.
 */
export function buildAuditData(
  actor: AuditActor | StaffPrincipal | null,
  event: AuditEvent,
): Prisma.AuditLogUncheckedCreateInput {
  const ctx = requestContext();
  return {
    actorDiscordId: actor?.discordId ?? null,
    actorUsername: actor ? cleanString(actor.username, 64) : null,
    action: cleanString(event.action, 64),
    targetType: cleanString(event.targetType, 64),
    targetId: cleanString(event.targetId, 64),
    outcome: event.outcome ?? "success",
    details: sanitizeDetails(event.details) ?? undefined,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  };
}

export async function recordAudit(actor: AuditActor | StaffPrincipal | null, event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({ data: buildAuditData(actor, event) });
  } catch (err) {
    // Deliberately logs only the action name, never the details.
    console.error(`Audit log write failed for ${event.action}:`, err instanceof Error ? err.message : "unknown error");
  }
}

function currentRoute(): { path: string; method: string } {
  try {
    const h = headers();
    return {
      path: cleanString(h.get("x-audit-path") ?? "unknown", 64),
      method: cleanString(h.get("x-audit-method") ?? "unknown", 16),
    };
  } catch {
    return { path: "unknown", method: "unknown" };
  }
}

/**
 * Records a rejected request and returns the matching error response.
 * Unauthenticated callers are capped per IP so a scanner hammering the API
 * can't fill the table; authenticated denials are always kept, since those
 * are the ones that point at a misbehaving or compromised account.
 */
export function denyAccess(principal: StaffPrincipal | null, status: 401 | 403 = 403): NextResponse {
  recordDenied(principal, status);
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
}

export function recordDenied(principal: StaffPrincipal | null, status: 401 | 403 = 403): Promise<void> {
  if (!principal) {
    const ip = requestContext().ipAddress ?? "unknown";
    if (!rateLimit(`audit-denied:${ip}`, 20, 60_000).allowed) return Promise.resolve();
  }
  const route = currentRoute();
  return recordAudit(principal, {
    action: "access.denied",
    targetType: "route",
    targetId: route.path,
    outcome: "denied",
    details: { method: route.method, status },
  });
}
