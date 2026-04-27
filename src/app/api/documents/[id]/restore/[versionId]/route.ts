import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";
import { findOwnedDocument } from "@/lib/db-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, versionId } = await params;
  const doc = await findOwnedDocument(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId: id },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
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

  const restoredJson = version.tiptapJson as Prisma.InputJsonValue;

  const newVersion = await prisma.documentVersion.create({
    data: {
      documentId: id,
      tiptapJson: restoredJson,
      label: "Restored",
    },
  });

  await prisma.document.update({
    where: { id },
    data: { tiptapJson: restoredJson },
  });

  return NextResponse.json({ version: newVersion, tiptapJson: version.tiptapJson });
}
