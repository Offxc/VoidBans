import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.delete_notes")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const note = await prisma.playerNote.findUnique({ where: { id }, select: { playerUuid: true } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.playerNote.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "player.note.delete",
      targetType: "player",
      targetId: note.playerUuid,
      details: { noteId: id.toString() },
    },
  });

  return NextResponse.json({ ok: true });
}
