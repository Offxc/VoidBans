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
