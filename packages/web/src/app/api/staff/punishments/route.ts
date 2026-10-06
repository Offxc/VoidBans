import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission, issueKeyFor } from "@/lib/permissions";
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

const PAST_TENSE = { BAN: "banned", MUTE: "muted", KICK: "kicked", WARN: "warned" } as const;

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal) return denyAccess(principal, 401);

  const parsed = issueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Only bans and mutes can be temporary. A duration sent with a kick or
  // warn is ignored rather than turned into an expiry.
  const durationSeconds = input.type === "BAN" || input.type === "MUTE" ? input.durationSeconds : undefined;

  // Each punishment type has its own permission, and a temporary ban or
  // mute is separate from a permanent one. Which one applies is decided
  // here from what was actually sent, never from what the UI offered.
  // Staff without it but with bans.request get the identical UI routed to
  // a request instead of a direct punishment, same endpoint, different
  // write, so the client never has to special-case this itself.
  const issueKey = issueKeyFor(input.type, Boolean(durationSeconds));
  const canIssue = hasPermission(principal, issueKey);
  const canRequest = hasPermission(principal, "bans.request");
  if (!canIssue && !canRequest) {
    await recordAudit(principal, {
      action: "access.denied",
      targetType: "player",
      targetId: input.playerUuid,
      outcome: "denied",
      details: { reason: "missing_permission", needs: issueKey },
    });
    return NextResponse.json({ error: "You don't have permission to issue this punishment." }, { status: 403 });
  }

  // Staff can't punish another staff member's linked Minecraft account,
  // the owner is exempt, since they're the ultimate authority on the
  // panel and may genuinely need to act against a compromised or rogue
  // staff account.
  if (!principal.isOwner) {
    const targetIsStaff = await prisma.staffUser.findFirst({
      where: { minecraftUuid: input.playerUuid },
      select: { discordId: true },
    });
    if (targetIsStaff) {
      await recordAudit(principal, {
        action: "access.denied",
        targetType: "player",
        targetId: input.playerUuid,
        outcome: "denied",
        details: { reason: "target_is_staff", type: input.type },
      });
      return NextResponse.json({ error: "This player is a staff member and cannot be punished here." }, { status: 403 });
    }
  }

  const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;

  if (!canIssue) {
    // TODO: persist to a punishment_requests queue once that model lands;
    // stubbed here so the permission branch and API shape are in place.
    return NextResponse.json({ ok: true, requested: true }, { status: 202 });
  }

  // A kick only means something to someone who is on the server right now.
  // Say so instead of quietly recording a kick that did nothing.
  if (input.type === "KICK") {
    const target = await prisma.player.findUnique({
      where: { uuid: input.playerUuid },
      select: { username: true, isOnline: true },
    });
    if (!target?.isOnline) {
      return NextResponse.json(
        { error: `${target?.username ?? "That player"} isn't online right now, so they can't be kicked.` },
        { status: 409 },
      );
    }
  }

  const wantsIpBan = input.ipBanned && input.type === "BAN";
  if (wantsIpBan && !hasPermission(principal, "players.view_ip")) {
    // IP-banning requires resolving the player's IP, which is the same
    // sensitive-data boundary as viewing it on a profile.
    await recordAudit(principal, {
      action: "access.denied",
      targetType: "player",
      targetId: input.playerUuid,
      outcome: "denied",
      details: { reason: "ip_ban_without_view_ip" },
    });
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
      // A kick happens once and is over. Only bans and mutes stay in force.
      active: input.type !== "KICK",
      appealable: input.appealable,
      ipBanned: wantsIpBan && ipAddress !== null,
      ipAddress,
      ruleLinks: ruleIds.length > 0 ? { create: ruleIds.map((ruleId) => ({ ruleId })) } : undefined,
    },
    include: { player: { select: { username: true } } },
  });

  await recordAudit(principal, {
    action: "punishment.issue",
    targetType: "punishment",
    targetId: punishment.id.toString(),
    details: { type: input.type, publicBanId: punishment.publicBanId, ipBanned: punishment.ipBanned },
  });

  notifyDiscordWebhook("punishment_issued", {
    title: `${punishment.type} issued`,
    description: `**${punishment.player.username}** was ${PAST_TENSE[punishment.type]} by **${principal.username}**\nReason: ${punishment.reason}`,
    color: 0xf87171,
    url: `${process.env.SITE_URL ?? ""}/${punishment.publicBanId}`,
  });

  return NextResponse.json({ ok: true, publicBanId: punishment.publicBanId }, { status: 201 });
}
