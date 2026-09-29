import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const revokeSchema = z.object({
  revokeReason: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bans.revoke")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = revokeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const punishment = await prisma.punishment.findUnique({
    where: { id },
    include: { player: { select: { username: true } } },
  });
  if (!punishment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!punishment.active) return NextResponse.json({ error: "Already inactive" }, { status: 409 });

  await prisma.punishment.update({
    where: { id },
    data: {
      active: false,
      revokedBy: principal.discordId,
      revokedAt: new Date(),
      revokeReason: parsed.data.revokeReason || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "punishment.revoke",
      targetType: "punishment",
      targetId: id.toString(),
      details: { publicBanId: punishment.publicBanId },
    },
  });

  notifyDiscordWebhook("punishment_lifted", {
    title: `${punishment.type} lifted`,
    description: `**${punishment.player.username}**'s ${punishment.type.toLowerCase()} was revoked by **${principal.username}**${parsed.data.revokeReason ? `\nReason: ${parsed.data.revokeReason}` : ""}`,
    color: 0x4ade80,
    url: `${process.env.SITE_URL ?? ""}/${punishment.publicBanId}`,
  });

  return NextResponse.json({ ok: true });
}
