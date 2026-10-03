import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission, revokeKeyFor, REVOKE_KEYS } from "@/lib/permissions";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const revokeSchema = z.object({
  revokeReason: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  // Needs at least one revoke permission to get this far; which type of
  // punishment it may be applied to is checked once the row is loaded.
  if (!principal || !REVOKE_KEYS.some((key) => hasPermission(principal, key))) {
    return denyAccess(principal);
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

  const needs = revokeKeyFor(punishment.type);
  if (!hasPermission(principal, needs)) {
    await recordAudit(principal, {
      action: "access.denied",
      targetType: "punishment",
      targetId: id.toString(),
      outcome: "denied",
      details: { reason: "missing_permission", needs },
    });
    return NextResponse.json({ error: "You don't have permission to revoke this type of punishment." }, { status: 403 });
  }

  await prisma.punishment.update({
    where: { id },
    data: {
      active: false,
      revokedBy: principal.discordId,
      revokedAt: new Date(),
      revokeReason: parsed.data.revokeReason || null,
    },
  });

  await recordAudit(principal, {
    action: "punishment.revoke",
    targetType: "punishment",
    targetId: id.toString(),
    details: { publicBanId: punishment.publicBanId },
  });

  notifyDiscordWebhook("punishment_lifted", {
    title: `${punishment.type} lifted`,
    description: `**${punishment.player.username}**'s ${punishment.type.toLowerCase()} was revoked by **${principal.username}**${parsed.data.revokeReason ? `\nReason: ${parsed.data.revokeReason}` : ""}`,
    color: 0x4ade80,
    url: `${process.env.SITE_URL ?? ""}/${punishment.publicBanId}`,
  });

  return NextResponse.json({ ok: true });
}
