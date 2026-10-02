import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const MAX_BYTES = 5 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function GET(req: NextRequest, { params }: { params: { uuid: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_attachments")) {
    return denyAccess(principal);
  }

  const attachments = await prisma.playerAttachment.findMany({
    where: { playerUuid: params.uuid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      punishmentId: true,
      bytesSize: true,
      caption: true,
      authorUsername: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    attachments: attachments.map((a) => ({
      id: a.id.toString(),
      punishmentId: a.punishmentId?.toString() ?? null,
      bytesSize: a.bytesSize,
      caption: a.caption,
      authorUsername: a.authorUsername,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { uuid: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.add_attachments")) {
    return denyAccess(principal);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File must be between 1 byte and ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });
  }

  const captionRaw = form?.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim().slice(0, 280) : null;

  const punishmentIdRaw = form?.get("punishmentId");
  let punishmentId: bigint | undefined;
  if (typeof punishmentIdRaw === "string" && punishmentIdRaw.trim()) {
    try {
      punishmentId = BigInt(punishmentIdRaw.trim());
    } catch {
      return NextResponse.json({ error: "Invalid punishmentId" }, { status: 400 });
    }
    const owning = await prisma.punishment.findUnique({ where: { id: punishmentId }, select: { playerUuid: true } });
    if (!owning || owning.playerUuid !== params.uuid) {
      return NextResponse.json({ error: "Invalid punishmentId" }, { status: 400 });
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Trust the actual file bytes, not the browser-supplied MIME type or
  // filename extension — both are client-controlled and trivially spoofed.
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    return NextResponse.json({ error: "File is not a valid PNG" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { uuid: params.uuid }, select: { uuid: true, username: true } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const attachment = await prisma.playerAttachment.create({
    data: {
      playerUuid: params.uuid,
      punishmentId,
      data: bytes,
      bytesSize: bytes.length,
      caption,
      authorDiscordId: principal.discordId,
      authorUsername: principal.username,
    },
    select: { id: true },
  });

  await recordAudit(principal, {
    action: "player.attachment.create",
    targetType: "player",
    targetId: params.uuid,
    details: { attachmentId: attachment.id.toString(), punishmentId: punishmentId?.toString() ?? null },
  });

  notifyDiscordWebhook("attachment_added", {
    title: "Attachment added",
    description: `**${principal.username}** added an attachment on **${player.username}**${caption ? `\n${caption}` : ""}`,
    color: 0xc084fc,
    url: `${process.env.SITE_URL ?? ""}/staff/players/${params.uuid}`,
  });

  return NextResponse.json({ id: attachment.id.toString() }, { status: 201 });
}
