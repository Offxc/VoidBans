import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setDiscordWebhookConfig, WEBHOOK_EVENT_KEYS } from "@/lib/discord-webhook";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  url: z.string().max(500).nullable(),
  events: z.record(z.enum(WEBHOOK_EVENT_KEYS), z.boolean()),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await setDiscordWebhookConfig({
      url: parsed.data.url,
      events: parsed.data.events as Record<(typeof WEBHOOK_EVENT_KEYS)[number], boolean>,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid webhook." }, { status: 400 });
  }

  await recordAudit(principal, {
    action: "settings.discord_webhook.update",
    targetType: "site_setting",
    targetId: "discord_webhook",
    // Never log the URL itself, it's a bearer credential for posting
    // to that channel, same reasoning as not logging DISCORD_BOT_TOKEN.
    details: { configured: Boolean(parsed.data.url), events: parsed.data.events },
  });

  return NextResponse.json({ ok: true });
}
