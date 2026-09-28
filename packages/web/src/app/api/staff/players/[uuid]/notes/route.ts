import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const createSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: { uuid: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.notes")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const note = await prisma.playerNote.create({
    data: {
      playerUuid: params.uuid,
      body: parsed.data.body,
      authorDiscordId: principal.discordId,
      authorUsername: principal.username,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "player.note.create",
      targetType: "player",
      targetId: params.uuid,
      details: { noteId: note.id.toString() },
    },
  });

  return NextResponse.json({ id: note.id.toString() }, { status: 201 });
}
