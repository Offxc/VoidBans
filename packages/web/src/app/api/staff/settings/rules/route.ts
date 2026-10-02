import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { getStaffPrincipal } from "@/lib/auth";
import { setRulesPageEnabled } from "@/lib/rules";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await setRulesPageEnabled(parsed.data.enabled);

  await recordAudit(principal, {
    action: "settings.rules_page.update",
    targetType: "site_setting",
    targetId: "rules.page_enabled",
    details: { enabled: parsed.data.enabled },
  });

  return NextResponse.json({ ok: true });
}
