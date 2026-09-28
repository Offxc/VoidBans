import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const questions = await prisma.appealQuestion.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, prompt: true, required: true },
  });

  return NextResponse.json(
    questions.map((q) => ({ id: q.id.toString(), prompt: q.prompt, required: q.required })),
  );
}
