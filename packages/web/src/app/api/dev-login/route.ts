import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const DEV_OWNER_DISCORD_ID = "000000000000000001";

// Forces per-request evaluation instead of Next statically prerendering
// this route at build time — without this, the NODE_ENV check below runs
// once during `next build` and gets baked into a cached static response,
// rather than being re-checked on every real request.
export const dynamic = "force-dynamic";

/**
 * Dev-only shortcut around Discord OAuth so the staff dashboard can be
 * previewed without a real Discord app configured. Hard-gated on
 * NODE_ENV so this route does not exist at all outside `next dev` —
 * production builds 404 here regardless of any env var misconfiguration.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.staffUser.upsert({
    where: { discordId: DEV_OWNER_DISCORD_ID },
    create: {
      discordId: DEV_OWNER_DISCORD_ID,
      username: "HeadAdmin (dev)",
      avatarHash: null,
      discordRoles: [],
      isOwner: true,
      lastLoginAt: new Date(),
    },
    update: { lastLoginAt: new Date() },
  });

  await createSession({ discordId: DEV_OWNER_DISCORD_ID });

  return NextResponse.redirect(new URL("/staff", req.url));
}
