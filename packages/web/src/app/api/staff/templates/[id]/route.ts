import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["BAN", "MUTE", "KICK", "WARN"]),
  defaultReason: z.string().min(1).max(2000),
  defaultDurationSeconds: z.number().int().positive().optional(),
  defaultAppealable: z.boolean().default(false),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "templates.edit")) {
    return denyAccess(principal);
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  const existing = await prisma.punishmentTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.punishmentTemplate.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      defaultReason: input.defaultReason,
      defaultDuration: input.defaultDurationSeconds ?? null,
      defaultAppealable: input.defaultAppealable,
    },
  });

  await recordAudit(principal, {
    action: "template.update",
    targetType: "punishment_template",
    targetId: id.toString(),
    details: { name: input.name },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "templates.edit")) {
    return denyAccess(principal);
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.punishmentTemplate.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // onDelete: SetNull on Punishment.template, any past punishment issued
  // from this template keeps its own recorded reason/duration and just
  // loses the back-reference, so deleting a template never touches
  // punishment history.
  await prisma.punishmentTemplate.delete({ where: { id } });

  await recordAudit(principal, {
    action: "template.delete",
    targetType: "punishment_template",
    targetId: id.toString(),
    details: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
