import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { generatePublicBanId } from "@/lib/ban-id";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const issueSchema = z.object({
  playerUuid: z.string().uuid(),
  type: z.enum(["BAN", "MUTE", "KICK", "WARN"]),
  reason: z.string().min(1).max(2000),
  templateId: z.string().optional(),
  ruleIds: z.array(z.string()).optional(),
  durationSeconds: z.number().int().positive().optional(),
  appealable: z.boolean().default(false),
  ipBanned: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = issueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Staff without bans.issue but with bans.request get the identical UI
  // routed to a request instead of a direct punishment — same endpoint,
  // different write, so the client never has to special-case this itself.
  const canIssue = hasPermission(principal, "bans.issue");
  const canRequest = hasPermission(principal, "bans.request");
  if (!canIssue && !canRequest) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Staff can't punish another staff member's linked Minecraft account —
  // the owner is exempt, since they're the ultimate authority on the
  // panel and may genuinely need to act against a compromised or rogue
  // staff account.
  if (!principal.isOwner) {
    const targetIsStaff = await prisma.staffUser.findFirst({
      where: { minecraftUuid: input.playerUuid },
      select: { discordId: true },
    });
    if (targetIsStaff) {
      return NextResponse.json({ error: "This player is a staff member and cannot be punished here." }, { status: 403 });
    }
  }

  const expiresAt = input.durationSeconds
    ? new Date(Date.now() + input.durationSeconds * 1000)
    : null;

  if (!canIssue) {
    // TODO: persist to a punishment_requests queue once that model lands;
    // stubbed here so the permission branch and API shape are in place.
    return NextResponse.json({ ok: true, requested: true }, { status: 202 });
  }

  const wantsIpBan = input.ipBanned && input.type === "BAN";
  if (wantsIpBan && !hasPermission(principal, "players.view_ip")) {
    // IP-banning requires resolving the player's IP, which is the same
    // sensitive-data boundary as viewing it on a profile.
    return NextResponse.json({ error: "Missing players.view_ip permission for IP bans" }, { status: 403 });
  }

  let ipAddress: string | null = null;
  if (wantsIpBan) {
    const lastSession = await prisma.session.findFirst({
      where: { playerUuid: input.playerUuid, ipAddress: { not: null } },
      orderBy: { loginAt: "desc" },
      select: { ipAddress: true },
    });
    ipAddress = lastSession?.ipAddress ?? null;
  }

  const ruleIds = (input.ruleIds ?? []).map((id) => BigInt(id));

  const punishment = await prisma.punishment.create({
    data: {
      publicBanId: generatePublicBanId(),
      playerUuid: input.playerUuid,
      type: input.type,
      reason: input.reason,
      templateId: input.templateId ? BigInt(input.templateId) : null,
      staffDiscordId: principal.discordId,
      staffUsername: principal.username,
      expiresAt,
      appealable: input.appealable,
      ipBanned: wantsIpBan && ipAddress !== null,
      ipAddress,
      ruleLinks: ruleIds.length > 0 ? { create: ruleIds.map((ruleId) => ({ ruleId })) } : undefined,
    },
    include: { player: { select: { username: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "punishment.issue",
      targetType: "punishment",
      targetId: punishment.id.toString(),
      details: { type: input.type, publicBanId: punishment.publicBanId, ipBanned: punishment.ipBanned },
    },
  });

  notifyDiscordWebhook("punishment_issued", {
    title: `${punishment.type} issued`,
    description: `**${punishment.player.username}** was ${punishment.type.toLowerCase()}ed by **${principal.username}**\nReason: ${punishment.reason}`,
    color: 0xf87171,
    url: `${process.env.SITE_URL ?? ""}/${punishment.publicBanId}`,
  });

  return NextResponse.json({ ok: true, publicBanId: punishment.publicBanId }, { status: 201 });
}
