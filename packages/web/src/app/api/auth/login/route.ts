import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { buildAuthorizeUrl } from "@/lib/discord";

const STATE_COOKIE = "voidbans_oauth_state";

export async function GET() {
  const state = randomBytes(24).toString("base64url");

  cookies().set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the round trip
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
