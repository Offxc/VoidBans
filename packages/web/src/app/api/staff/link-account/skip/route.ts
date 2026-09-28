import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";

/**
 * Lets a staff member into the dashboard without a linked Minecraft
 * account, for the genuine case where they've never actually joined the
 * server yet — there's no real Player row to link to. Intentionally not
 * exposed until the client has already tried and failed at least once
 * (see LinkAccountForm), so this isn't just a silent bypass of the
 * requirement.
 */
export async function POST() {
  const principal = await getStaffPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.staffUser.update({
    where: { discordId: principal.discordId },
    data: { minecraftLinkSkippedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
