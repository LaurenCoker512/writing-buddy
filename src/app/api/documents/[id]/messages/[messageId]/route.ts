import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; messageId: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: params.messageId, documentId: params.id },
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

  await prisma.chatMessage.delete({ where: { id: params.messageId } });

  return new NextResponse(null, { status: 204 });
}
