import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { destroySession } from "@/lib/session";
import { siteUrl } from "@/lib/site-url";

export async function POST() {
  const principal = await getStaffPrincipal();
  if (principal) {
    await recordAudit(principal, {
      action: "auth.logout",
      targetType: "session",
      targetId: principal.discordId,
    });
  }
  destroySession();
  // 303 so the browser follows with a GET — the default 307 would replay
  // this POST against the landing page.
  return NextResponse.redirect(siteUrl("/"), 303);
}
