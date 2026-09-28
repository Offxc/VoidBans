import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const ruleSchema = z.object({
  categoryId: z.string().min(1),
  code: z.string().min(1).max(16),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  suggestedType: z.enum(["BAN", "MUTE", "KICK", "WARN"]).optional(),
  defaultDurationSeconds: z.number().int().positive().optional(),
  defaultAppealable: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ruleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;

  let categoryId: bigint;
  try {
    categoryId = BigInt(input.categoryId);
  } catch {
    return NextResponse.json({ error: "Invalid categoryId" }, { status: 400 });
  }
  const category = await prisma.ruleCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const existing = await prisma.punishmentRule.findUnique({ where: { code: input.code }, select: { id: true } });
  if (existing) return NextResponse.json({ error: `Rule code "${input.code}" is already in use` }, { status: 409 });

  const rule = await prisma.punishmentRule.create({
    data: {
      categoryId,
      code: input.code,
      title: input.title,
      description: input.description || null,
      suggestedType: input.suggestedType,
      defaultDuration: input.defaultDurationSeconds ?? null,
      defaultAppealable: input.defaultAppealable,
      createdByDiscordId: principal.discordId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorDiscordId: principal.discordId,
      action: "rule.create",
      targetType: "punishment_rule",
      targetId: rule.id.toString(),
      details: { code: rule.code, title: rule.title },
    },
  });

  return NextResponse.json({ id: rule.id.toString() }, { status: 201 });
}
