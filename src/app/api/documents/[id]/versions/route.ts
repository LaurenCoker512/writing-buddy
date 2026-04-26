import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function findOwnedDoc(id: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: { id },
    include: {
      story: { select: { userId: true } },
      series: { select: { userId: true } },
      universe: { select: { userId: true } },
    },
  });
  if (!doc) return null;
  const owner = doc.story ?? doc.series ?? doc.universe;
  if (!owner || owner.userId !== userId) return null;
  return doc;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { tiptapJson?: unknown };

  if (!body.tiptapJson || typeof body.tiptapJson !== "object" || Array.isArray(body.tiptapJson)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const doc = await findOwnedDoc(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = await prisma.documentVersion.create({
    data: { documentId: id, tiptapJson: body.tiptapJson },
  });

  return NextResponse.json(version, { status: 201 });
}
