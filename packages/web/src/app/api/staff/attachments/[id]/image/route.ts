import { NextRequest, NextResponse } from "next/server";
import { denyAccess } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_attachments")) {
    return denyAccess(principal);
  }

  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const attachment = await prisma.playerAttachment.findUnique({ where: { id }, select: { data: true } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
