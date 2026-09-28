import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const updateSchema = z.object({
  code: z.string().min(1).max(16),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  type: z.enum(["BAN", "MUTE", "KICK", "WARN"]),
  defaultDurationSeconds: z.number().int().positive().optional(),
  defaultAppealable: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const existing = await prisma.punishmentRule.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const codeOwner = await prisma.punishmentRule.findUnique({ where: { code: input.code }, select: { id: true } });
  if (codeOwner && codeOwner.id !== id) {
    return NextResponse.json({ error: `Rule code "${input.code}" is already in use` }, { status: 409 });
  }

  await prisma.punishmentRule.update({
    where: { id },
    data: {
      code: input.code,
      title: input.title,
      description: input.description || null,
      type: input.type,
      defaultDuration: input.defaultDurationSeconds ?? null,
      defaultAppealable: input.defaultAppealable,
      active: input.active,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "rule.update",
      targetType: "punishment_rule",
      targetId: id.toString(),
      details: { code: input.code, title: input.title },
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.punishmentRule.findUnique({ where: { id }, select: { code: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // onDelete: Cascade on PunishmentRuleLink — deleting a rule removes the
  // link rows to any past punishment that cited it, but the punishment
  // itself (and its own recorded reason/type/duration) is untouched.
  await prisma.punishmentRule.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "rule.delete",
      targetType: "punishment_rule",
      targetId: id.toString(),
      details: { code: existing.code },
    },
  });

  return NextResponse.json({ ok: true });
}
