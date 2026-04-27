import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";
import { findOwnedDocument } from "@/lib/db-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await findOwnedDocument(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true },
  });

  return NextResponse.json(versions);
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
  const body = (await req.json()) as { tiptapJson?: unknown; label?: unknown };

  if (
    !body.tiptapJson ||
    typeof body.tiptapJson !== "object" ||
    Array.isArray(body.tiptapJson)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : undefined;

  const doc = await findOwnedDocument(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const count = await prisma.documentVersion.count({ where: { documentId: id } });
  if (count >= AI_CONFIG.DOCUMENT_VERSION_CAP) {
    const oldest = await prisma.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (oldest) {
      await prisma.documentVersion.delete({ where: { id: oldest.id } });
    }
  }

  const version = await prisma.documentVersion.create({
    data: { documentId: id, tiptapJson: body.tiptapJson, label },
  });

  return NextResponse.json(version, { status: 201 });
}
