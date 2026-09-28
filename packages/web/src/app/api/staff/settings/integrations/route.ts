import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setVulcanIntegrationEnabled } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  vulcanEnabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await setVulcanIntegrationEnabled(parsed.data.vulcanEnabled);

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "settings.integrations.update",
      targetType: "site_setting",
      targetId: "integrations.vulcan.enabled",
      details: { vulcanEnabled: parsed.data.vulcanEnabled },
    },
  });

  return NextResponse.json({ ok: true });
}
