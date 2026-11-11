import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { denyAccess, recordAudit } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { isValidDiscordInvite, isValidServerAddress, setServerInfo } from "@/lib/server-info";

const updateSchema = z.object({
  name: z.string().trim().max(48),
  address: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidServerAddress(v), "Use a hostname or IP, like play.example.com"),
  discordInvite: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidDiscordInvite(v), "Use a discord.gg invite link"),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Check the values and try again." }, { status: 400 });
  }

  await setServerInfo(parsed.data);

  await recordAudit(principal, {
    action: "settings.server_info.update",
    targetType: "site_setting",
    targetId: "site.server_info",
    details: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
