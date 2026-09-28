import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const templateSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["BAN", "MUTE", "KICK", "WARN"]),
  defaultReason: z.string().min(1).max(2000),
  defaultDurationHours: z.number().int().positive().optional(),
  defaultAppealable: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "templates.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = templateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const template = await prisma.punishmentTemplate.create({
    data: {
      name: input.name,
      type: input.type,
      defaultReason: input.defaultReason,
      defaultDuration: input.defaultDurationHours ? input.defaultDurationHours * 3600 : null,
      defaultAppealable: input.defaultAppealable,
      createdByDiscordId: principal.discordId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "template.create",
      targetType: "punishment_template",
      targetId: template.id.toString(),
      details: { name: template.name },
    },
  });

  return NextResponse.json({ id: template.id.toString() }, { status: 201 });
}
