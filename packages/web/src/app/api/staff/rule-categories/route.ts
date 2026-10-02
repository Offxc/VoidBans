import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const categorySchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.create")) {
    return denyAccess(principal);
  }

  const parsed = categorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const category = await prisma.ruleCategory.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
    },
  });

  await recordAudit(principal, {
    action: "rule_category.create",
    targetType: "rule_category",
    targetId: category.id.toString(),
    details: { name: category.name },
  });

  return NextResponse.json({ id: category.id.toString() }, { status: 201 });
}
