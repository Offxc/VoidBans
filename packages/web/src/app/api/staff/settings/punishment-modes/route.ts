import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setPunishmentModes } from "@/lib/punishment-modes";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  templatesEnabled: z.boolean(),
  rulesEnabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await setPunishmentModes(parsed.data);

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "settings.punishment_modes.update",
      targetType: "site_setting",
      targetId: "punishment_modes",
      details: parsed.data,
    },
  });

  return NextResponse.json({ ok: true });
}
