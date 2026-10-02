import { NextRequest, NextResponse } from "next/server";
import { buildAuditData, denyAccess } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { isPermissionKey } from "@/lib/permissions";

const upsertSchema = z.object({
  discordRoleId: z.string().min(1),
  discordRoleName: z.string().min(1),
  displayName: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
  permissions: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { discordRoleId, discordRoleName, displayName, color, permissions } = parsed.data;
  const validKeys = permissions.filter(isPermissionKey);

  const role = await prisma.staffRole.upsert({
    where: { discordRoleId },
    create: { discordRoleId, discordRoleName, displayName, color },
    update: { discordRoleName, displayName, color },
  });

  await prisma.$transaction([
    prisma.staffPermission.deleteMany({ where: { roleId: role.id } }),
    prisma.staffPermission.createMany({
      data: validKeys.map((key) => ({ roleId: role.id, permissionKey: key })),
    }),
    prisma.auditLog.create({
      data: buildAuditData(principal, {
        action: "role.permissions.update",
        targetType: "staff_role",
        targetId: role.id.toString(),
        details: { discordRoleId, permissions: validKeys },
      }),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
