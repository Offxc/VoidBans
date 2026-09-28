import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const resolveSchema = z.object({
  decision: z.enum(["ACCEPTED", "DENIED"]),
  staffResponse: z.string().max(2000).optional(),
  autoRevoke: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "appeals.resolve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = resolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { decision, staffResponse, autoRevoke } = parsed.data;

  const appeal = await prisma.appeal.findUnique({ where: { id: BigInt(params.id) } });
  if (!appeal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (appeal.status !== "PENDING") {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }

  const willRevoke = decision === "ACCEPTED" && autoRevoke;

  await prisma.$transaction([
    prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: decision,
        staffResponse: staffResponse || null,
        resolvedByDiscordId: principal.discordId,
        resolvedAt: new Date(),
        autoRevoked: willRevoke,
      },
    }),
    ...(willRevoke
      ? [
          prisma.punishment.update({
            where: { id: appeal.punishmentId },
            data: {
              active: false,
              revokedBy: principal.discordId,
              revokedAt: new Date(),
              revokeReason: "Appeal accepted",
            },
          }),
        ]
      : []),
    prisma.auditLog.create({
      data: {
        actorDiscordId: principal.discordId,
        action: `appeal.${decision.toLowerCase()}`,
        targetType: "appeal",
        targetId: appeal.id.toString(),
        details: { autoRevoked: willRevoke },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
