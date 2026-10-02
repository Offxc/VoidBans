import { NextRequest, NextResponse } from "next/server";
import { denyAccess } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { resolveMojangUsername, resolveMojangUuid, isUuidLike, normalizeUuid } from "@/lib/mojang";

/**
 * Resolves a UUID or username to a player for the pre-ban flow — a player
 * this server has never seen has no local `players` row to look up, so
 * this falls back to Mojang once the local lookup misses. Read-only: it
 * never creates anything, so it doesn't need the stronger
 * players.pre_ban permission that creating the placeholder row does.
 */
export async function GET(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_roster")) {
    return denyAccess(principal);
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  // No `mode: "insensitive"` needed here (that's a Postgres-only Prisma
  // option) — this schema's MySQL columns already use a case-insensitive
  // collation (utf8mb4_unicode_ci) throughout, so a plain equals already
  // matches regardless of case.
  const local = await prisma.player.findFirst({
    where: isUuidLike(query) ? { uuid: normalizeUuid(query) } : { username: query },
    select: { uuid: true, username: true, hasJoined: true },
  });

  if (local) {
    return NextResponse.json({ found: "local", uuid: local.uuid, username: local.username });
  }

  // Bedrock (Geyser/Floodgate) players show up with a "." prefix and a
  // Floodgate-generated UUID that Mojang has never heard of — there's no
  // public API to resolve a not-yet-joined Bedrock player's username to a
  // UUID the way Mojang does for Java, so a username search for one can
  // only ever find a local row (i.e. they've joined before). Say that
  // directly instead of quietly falling through to a Mojang 404 that
  // would look identical to "no such player" and confuse staff.
  if (query.startsWith(".") && !isUuidLike(query)) {
    return NextResponse.json({
      found: "none",
      hint: "Bedrock players can't be looked up by name before they've joined — search by UUID instead (from a past session or player report).",
    });
  }

  try {
    const profile = isUuidLike(query) ? await resolveMojangUuid(query) : await resolveMojangUsername(query);
    if (!profile) return NextResponse.json({ found: "none" });
    return NextResponse.json({ found: "mojang", uuid: profile.uuid, username: profile.username });
  } catch (err) {
    console.error("Mojang lookup failed:", err);
    return NextResponse.json({ error: "Mojang lookup failed — try again shortly." }, { status: 502 });
  }
}
