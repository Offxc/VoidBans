import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidBanIdFormat } from "@/lib/ban-id";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { notifyDiscordWebhook } from "@/lib/discord-webhook";

const appealSchema = z.object({
  answers: z.record(z.string(), z.string().max(2000)),
});

export async function POST(req: NextRequest, { params }: { params: { banId: string } }) {
  const ip = clientIpFromHeaders(req.headers);
  const limit = rateLimit(`appeal-submit:${ip}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    await recordAudit(null, {
      action: "ratelimit.exceeded",
      targetType: "route",
      targetId: "appeal-submit",
      outcome: "denied",
    });
    return NextResponse.json({ error: "Too many appeal attempts. Try again later." }, { status: 429 });
  }

  const banId = params.banId.toUpperCase();
  if (!isValidBanIdFormat(banId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = appealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const punishment = await prisma.punishment.findUnique({
    where: { publicBanId: banId },
    include: { appeal: true, player: { select: { username: true } } },
  });

  if (!punishment) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!punishment.appealable) {
    return NextResponse.json({ error: "This punishment is not appealable." }, { status: 403 });
  }
  if (punishment.appeal) {
    return NextResponse.json({ error: "An appeal already exists for this ban." }, { status: 409 });
  }

  const activeQuestions = await prisma.appealQuestion.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  for (const q of activeQuestions) {
    if (q.required) {
      const answer = parsed.data.answers[String(q.id)];
      if (!answer || answer.trim().length === 0) {
        return NextResponse.json(
          { error: `Missing required answer for: ${q.prompt}` },
          { status: 400 },
        );
      }
    }
  }

  const appeal = await prisma.appeal.create({
    data: {
      punishmentId: punishment.id,
      answers: parsed.data.answers,
    },
  });

  await recordAudit(null, {
    action: "appeal.submit",
    targetType: "appeal",
    targetId: appeal.id.toString(),
    details: { publicBanId: punishment.publicBanId },
  });

  notifyDiscordWebhook("appeal_submitted", {
    title: "Appeal submitted",
    description: `**${punishment.player.username}** appealed their ${punishment.type.toLowerCase()} (${punishment.publicBanId})`,
    color: 0xfbbf24,
    url: `${process.env.SITE_URL ?? ""}/${punishment.publicBanId}`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
