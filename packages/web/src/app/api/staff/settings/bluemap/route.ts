import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setBlueMapConfig } from "@/lib/bluemap";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  enabled: z.boolean(),
  url: z.string().max(500).nullable(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await setBlueMapConfig(parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid URL." }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "settings.bluemap.update",
      targetType: "site_setting",
      targetId: "bluemap",
      details: { enabled: parsed.data.enabled, url: parsed.data.url },
    },
  });

  return NextResponse.json({ ok: true });
}
