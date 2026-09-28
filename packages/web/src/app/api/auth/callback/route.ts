import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken, fetchDiscordUser } from "@/lib/discord";
import { createSession } from "@/lib/session";
import { syncStaffUserOnLogin } from "@/lib/auth";

const STATE_COOKIE = "voidbans_oauth_state";

// Redirects here must be built from SITE_URL, never from req.url — behind
// a reverse proxy, req.url reflects whatever address Next's own server is
// bound to (e.g. 0.0.0.0, or a Docker-internal hostname), not the public
// domain the request actually arrived through, since nothing forwards the
// original Host into how Next constructs absolute URLs by default.
function siteUrl(path: string): URL {
  const base = process.env.SITE_URL;
  if (!base) throw new Error("SITE_URL is not set");
  return new URL(path, base);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = cookies().get(STATE_COOKIE)?.value;

  cookies().set(STATE_COOKIE, "", { path: "/", maxAge: 0 });

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(siteUrl("/staff/login?error=state_mismatch"));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(token.access_token);

    await syncStaffUserOnLogin(discordUser.id, discordUser.username, discordUser.avatar);
    await createSession({ discordId: discordUser.id });

    return NextResponse.redirect(siteUrl("/staff"));
  } catch (err) {
    // Logged in full server-side so the real cause (bad client secret,
    // redirect URI mismatch, bot token issue, etc.) is visible in
    // `docker compose logs web` — the redirect itself only ever shows the
    // player a generic error, on purpose.
    console.error("Discord OAuth callback failed:", err);
    return NextResponse.redirect(siteUrl("/staff/login?error=oauth_failed"));
  }
}
