import { NextRequest, NextResponse } from "next/server";
import { buildAuditData, denyAccess } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";

/**
 * Permanently deletes a punishment from a player's history. Owner only, and
 * deliberately not a permission key: it can't be granted to a role, so it
 * can't be handed out by accident. Deleting also removes the punishment's
 * appeal, its rule links and any attachments tied to it (the schema
 * cascades), and if the punishment was still in force the player is released
 * immediately, since the plugin reads this table live.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const punishment = await prisma.punishment.findUnique({
    where: { id },
    include: {
      player: { select: { username: true } },
      appeal: { select: { id: true } },
      _count: { select: { attachments: true } },
    },
  });
  if (!punishment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The audit entry and the delete happen together or not at all, and the
  // entry keeps what was removed, since the row itself will be gone.
  await prisma.$transaction([
    prisma.auditLog.create({
      data: buildAuditData(principal, {
        action: "punishment.delete",
        targetType: "punishment",
        targetId: id.toString(),
        details: {
          publicBanId: punishment.publicBanId,
          type: punishment.type,
          player: punishment.player.username,
          playerUuid: punishment.playerUuid,
          reason: punishment.reason,
          issuedBy: punishment.staffUsername,
          issuedAt: punishment.issuedAt,
          wasActive: punishment.active,
          hadAppeal: punishment.appeal !== null,
          attachmentsDeleted: punishment._count.attachments,
        },
      }),
    }),
    prisma.punishment.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
