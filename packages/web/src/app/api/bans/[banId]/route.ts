import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isValidBanIdFormat } from "@/lib/ban-id";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export async function GET(req: NextRequest, { params }: { params: { banId: string } }) {
  const ip = clientIpFromHeaders(req.headers);
  const limit = rateLimit(`ban-lookup:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    await recordAudit(null, {
      action: "ratelimit.exceeded",
      targetType: "route",
      targetId: "ban-lookup",
      outcome: "denied",
    });
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const banId = params.banId.toUpperCase();
  if (!isValidBanIdFormat(banId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const punishment = await prisma.punishment.findUnique({
    where: { publicBanId: banId },
    include: { appeal: true },
  });

  if (!punishment) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Public projection only, never leak internal DB ids, the player's
  // UUID/username, or staff identity beyond what's meant to be public.
  return NextResponse.json({
    banId: punishment.publicBanId,
    type: punishment.type,
    reason: punishment.reason,
    issuedAt: punishment.issuedAt,
    expiresAt: punishment.expiresAt,
    active: punishment.active,
    appealable: punishment.appealable,
    appeal: punishment.appeal
      ? {
          status: punishment.appeal.status,
          submittedAt: punishment.appeal.submittedAt,
          staffResponse: punishment.appeal.staffResponse,
          resolvedAt: punishment.appeal.resolvedAt,
        }
      : null,
  });
}
