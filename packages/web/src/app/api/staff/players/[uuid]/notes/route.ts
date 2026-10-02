import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const createSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: { params: { uuid: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.notes")) {
    return denyAccess(principal);
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

  await recordAudit(principal, {
    action: "player.note.create",
    targetType: "player",
    targetId: params.uuid,
    details: { noteId: note.id.toString() },
  });

  const player = await prisma.player.findUnique({ where: { uuid: params.uuid }, select: { username: true } });
  notifyDiscordWebhook("note_added", {
    title: "Note added",
    description: `**${principal.username}** added a note on **${player?.username ?? params.uuid}**:\n${note.body}`,
    color: 0xc084fc,
    url: `${process.env.SITE_URL ?? ""}/staff/players/${params.uuid}`,
  });

  return NextResponse.json({ id: note.id.toString() }, { status: 201 });
}
