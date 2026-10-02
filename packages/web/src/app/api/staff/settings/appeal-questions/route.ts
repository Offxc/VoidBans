import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";

const createSchema = z.object({
  prompt: z.string().min(1).max(280),
  required: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const maxOrder = await prisma.appealQuestion.aggregate({ _max: { sortOrder: true } });
  const question = await prisma.appealQuestion.create({
    data: {
      prompt: parsed.data.prompt,
      required: parsed.data.required,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  await recordAudit(principal, {
    action: "appeal_question.create",
    targetType: "appeal_question",
    targetId: question.id.toString(),
    details: { prompt: question.prompt, required: question.required },
  });

  return NextResponse.json({ id: question.id.toString() }, { status: 201 });
}
