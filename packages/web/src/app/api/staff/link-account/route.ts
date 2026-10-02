import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";

const linkSchema = z.object({
  username: z.string().min(1).max(16),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal) return denyAccess(principal, 401);

  const parsed = linkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid username." }, { status: 400 });

  // Must be a player who has actually joined the server at least once,
  // this can't be an arbitrary typed username, since the whole point is
  // linking to a real, known Player row so the punishment route can
  // recognize "this UUID belongs to staff."
  const player = await prisma.player.findFirst({
    where: { username: { equals: parsed.data.username } },
    select: { uuid: true, username: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  const alreadyLinkedToOther = await prisma.staffUser.findFirst({
    where: { minecraftUuid: player.uuid, discordId: { not: principal.discordId } },
  });
  if (alreadyLinkedToOther) {
    return NextResponse.json({ error: "That account is already linked." }, { status: 409 });
  }

  await prisma.staffUser.update({
    where: { discordId: principal.discordId },
    data: { minecraftUuid: player.uuid },
  });

  await recordAudit(principal, {
    action: "staff.link_account",
    targetType: "player",
    targetId: player.uuid,
    details: { username: player.username },
  });

  return NextResponse.json({ ok: true, username: player.username });
}
