import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { normalizeUuid, isUuidLike } from "@/lib/mojang";

const createSchema = z.object({
  uuid: z.string().min(1),
  username: z.string().min(1).max(64),
});

/**
 * Creates a placeholder `players` row for a UUID that has never actually
 * connected to the server, so staff can issue a punishment ahead of a
 * player's first join. The plugin's own login upsert (ON DUPLICATE KEY
 * UPDATE) absorbs this into a real row — setting hasJoined back to TRUE —
 * the moment they actually connect, so nothing here needs to be reconciled
 * later.
 */
export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.pre_ban")) {
    return denyAccess(principal);
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (!isUuidLike(parsed.data.uuid)) {
    return NextResponse.json({ error: "Not a valid UUID" }, { status: 400 });
  }
  const uuid = normalizeUuid(parsed.data.uuid);
  const username = parsed.data.username.trim().slice(0, 16);
  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

  const existing = await prisma.player.findUnique({ where: { uuid }, select: { uuid: true } });
  if (existing) {
    return NextResponse.json({ uuid: existing.uuid, alreadyExisted: true });
  }

  await prisma.player.create({
    data: {
      uuid,
      username,
      lastSeenUsername: username,
      firstJoined: new Date(),
      hasJoined: false,
    },
  });

  await recordAudit(principal, {
    action: "player.pre_ban.create",
    targetType: "player",
    targetId: uuid,
    details: { username },
  });

  return NextResponse.json({ uuid, alreadyExisted: false }, { status: 201 });
}
