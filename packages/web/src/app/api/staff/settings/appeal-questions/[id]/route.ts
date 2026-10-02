import { NextRequest, NextResponse } from "next/server";
import { denyAccess, recordAudit } from "@/lib/audit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";

const updateSchema = z.object({
  active: z.boolean().optional(),
  required: z.boolean().optional(),
  prompt: z.string().min(1).max(280).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let questionId: bigint;
  try {
    questionId = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await prisma.appealQuestion.update({
    where: { id: questionId },
    data: parsed.data,
  });

  await recordAudit(principal, {
    action: "appeal_question.update",
    targetType: "appeal_question",
    targetId: questionId.toString(),
    details: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.appealQuestion.findUnique({ where: { id }, select: { id: true, prompt: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // No FK from Appeal to AppealQuestion, answers are stored as a free-form
  // {questionId: text} JSON blob, so a deleted question just falls back to
  // showing its raw id in a past appeal's answer list instead of the
  // prompt text. Nothing to cascade or reconcile.
  await prisma.appealQuestion.delete({ where: { id } });
  await recordAudit(principal, {
    action: "appeal_question.delete",
    targetType: "appeal_question",
    targetId: id.toString(),
    details: { prompt: existing.prompt },
  });

  return NextResponse.json({ ok: true });
}
