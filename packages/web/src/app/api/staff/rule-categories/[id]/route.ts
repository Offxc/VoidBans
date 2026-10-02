import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.edit")) {
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

  const existing = await prisma.ruleCategory.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ruleCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
    },
  });

  await recordAudit(principal, {
    action: "rule_category.update",
    targetType: "rule_category",
    targetId: id.toString(),
    details: { from: existing.name, to: parsed.data.name },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.edit")) {
    return denyAccess(principal);
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const category = await prisma.ruleCategory.findUnique({
    where: { id },
    select: { name: true, _count: { select: { rules: true } } },
  });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // onDelete: Cascade on PunishmentRule.category would silently wipe
  // every rule in it — refuse instead, so deleting a category is never
  // an accidental mass-delete of rules.
  if (category._count.rules > 0) {
    return NextResponse.json(
      { error: `Move or delete the ${category._count.rules} rule(s) in this category first.` },
      { status: 409 },
    );
  }

  await prisma.ruleCategory.delete({ where: { id } });
  await recordAudit(principal, {
    action: "rule_category.delete",
    targetType: "rule_category",
    targetId: id.toString(),
    details: { name: category.name },
  });
  return NextResponse.json({ ok: true });
}
