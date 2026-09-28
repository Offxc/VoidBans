import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setSiteIconUrl, isValidPostimagesUrl } from "@/lib/site-icon";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  url: z.string().max(500).nullable(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const url = parsed.data.url?.trim() || null;
  if (url && !isValidPostimagesUrl(url)) {
    return NextResponse.json(
      { error: "Must be a direct image link from postimages.org (https://i.postimg.cc/...)." },
      { status: 400 },
    );
  }

  await setSiteIconUrl(url);

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "settings.icon.update",
      targetType: "site_setting",
      targetId: "site.icon_url",
      details: { url },
    },
  });

  return NextResponse.json({ ok: true });
}
