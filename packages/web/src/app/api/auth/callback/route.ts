import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.redirect(new URL("/staff/login?error=state_mismatch", req.url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(token.access_token);

    await syncStaffUserOnLogin(discordUser.id, discordUser.username, discordUser.avatar);
    await createSession({ discordId: discordUser.id });

    return NextResponse.redirect(new URL("/staff", req.url));
  } catch (err) {
    console.error("Discord OAuth callback failed", err);
    return NextResponse.redirect(new URL("/staff/login?error=oauth_failed", req.url));
  }
}
