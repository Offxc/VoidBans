import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { siteUrl } from "@/lib/site-url";
import { cookies } from "next/headers";
import { exchangeCodeForToken, fetchDiscordUser } from "@/lib/discord";
import { createSession } from "@/lib/session";
import { syncStaffUserOnLogin } from "@/lib/auth";

const STATE_COOKIE = "voidbans_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = cookies().get(STATE_COOKIE)?.value;

  cookies().set(STATE_COOKIE, "", { path: "/", maxAge: 0 });

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    await recordAudit(null, {
      action: "auth.login_failed",
      targetType: "session",
      targetId: "oauth",
      outcome: "failure",
      details: { reason: "state_mismatch" },
    });
    return NextResponse.redirect(siteUrl("/staff/login?error=state_mismatch"));
  }

  let attempted: { discordId: string; username: string } | null = null;
  try {
    const token = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(token.access_token);
    attempted = { discordId: discordUser.id, username: discordUser.username };

    await syncStaffUserOnLogin(discordUser.id, discordUser.username, discordUser.avatar);
    await createSession({ discordId: discordUser.id });
    await recordAudit(attempted, {
      action: "auth.login",
      targetType: "session",
      targetId: discordUser.id,
    });

    return NextResponse.redirect(siteUrl("/staff"));
  } catch (err) {
    // Logged in full server-side so the real cause (bad client secret,
    // redirect URI mismatch, bot token issue, etc.) is visible in
    // `docker compose logs web`, the redirect itself only ever shows the
    // player a generic error, on purpose.
    console.error("Discord OAuth callback failed:", err);
    await recordAudit(attempted, {
      action: "auth.login_failed",
      targetType: "session",
      targetId: attempted?.discordId ?? "oauth",
      outcome: "failure",
      details: { reason: "oauth_failed" },
    });
    return NextResponse.redirect(siteUrl("/staff/login?error=oauth_failed"));
  }
}
