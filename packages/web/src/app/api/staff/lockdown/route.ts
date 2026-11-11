import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { denyAccess, recordAudit } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getLockdown, setLockdown } from "@/lib/lockdown";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const updateSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "server.lockdown")) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { enabled } = parsed.data;
  const current = await getLockdown();
  // Two people pressing the button at once shouldn't log it, or announce it, twice.
  if (current.enabled === enabled) return NextResponse.json({ ok: true, enabled });

  await setLockdown(enabled, principal.username);

  await recordAudit(principal, {
    action: enabled ? "server.lockdown.enable" : "server.lockdown.disable",
    targetType: "server",
    targetId: "lockdown",
  });

  notifyDiscordWebhook("server_lockdown", {
    title: enabled ? "Server locked down" : "Lockdown ended",
    description: enabled
      ? `**${principal.username}** put the server into maintenance mode. Only staff can be online.`
      : `**${principal.username}** ended maintenance mode. Players can join again.`,
    color: enabled ? 0xfbbf24 : 0x34d399,
  });

  return NextResponse.json({ ok: true, enabled });
}
