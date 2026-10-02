import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setVulcanIntegrationEnabled } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  vulcanEnabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await setVulcanIntegrationEnabled(parsed.data.vulcanEnabled);

  await recordAudit(principal, {
    action: "settings.integrations.update",
    targetType: "site_setting",
    targetId: "integrations.vulcan.enabled",
    details: { vulcanEnabled: parsed.data.vulcanEnabled },
  });

  return NextResponse.json({ ok: true });
}
