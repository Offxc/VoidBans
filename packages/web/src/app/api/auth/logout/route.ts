import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { destroySession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (principal) {
    await recordAudit(principal, {
      action: "auth.logout",
      targetType: "session",
      targetId: principal.discordId,
    });
  }
  destroySession();
  return NextResponse.redirect(new URL("/", req.url));
}
