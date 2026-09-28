import { NextRequest, NextResponse } from "next/server";
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
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.appealQuestion.update({
    where: { id: BigInt(params.id) },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.appealQuestion.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // No FK from Appeal to AppealQuestion — answers are stored as a free-form
  // {questionId: text} JSON blob, so a deleted question just falls back to
  // showing its raw id in a past appeal's answer list instead of the
  // prompt text. Nothing to cascade or reconcile.
  await prisma.appealQuestion.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
