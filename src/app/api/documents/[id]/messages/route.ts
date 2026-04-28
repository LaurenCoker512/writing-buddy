import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedDocument } from "@/lib/db-helpers";
import type { RouteParams } from "@/types/route";

export async function GET(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await findOwnedDocument(id, session.user.id);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({
    messages,
    chatSummary: document.chatSummary,
  });
}
