import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setRulesConfig } from "@/lib/rules";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  enabled: z.boolean(),
  markdown: z.string().max(50_000),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await setRulesConfig(parsed.data);

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "settings.rules.update",
      targetType: "site_setting",
      targetId: "rules",
      details: { enabled: parsed.data.enabled, length: parsed.data.markdown.length },
    },
  });

  return NextResponse.json({ ok: true });
}
