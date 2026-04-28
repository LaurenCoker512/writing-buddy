import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RouteParams } from "@/types/route";

export async function DELETE(_req: NextRequest, { params }: RouteParams<{ id: string; messageId: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, messageId } = await params;
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, documentId: id },
    include: {
      document: {
        include: {
          story: { select: { userId: true } },
          series: { select: { userId: true } },
          universe: { select: { userId: true } },
        },
      },
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerId =
    message.document.story?.userId ??
    message.document.series?.userId ??
    message.document.universe?.userId;

  if (ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.chatMessage.delete({ where: { id: messageId } });

  return new NextResponse(null, { status: 204 });
}
