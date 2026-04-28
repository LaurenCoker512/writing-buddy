import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedDocument, createVersionWithCap } from "@/lib/db-helpers";
import type { RouteParams } from "@/types/route";

export async function POST(
  _req: NextRequest,
  { params }: RouteParams<{ id: string; versionId: string }>,
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

  const restoredJson = version.tiptapJson as Prisma.InputJsonValue;
  const newVersion = await createVersionWithCap(id, restoredJson, "Restored");

  await prisma.document.update({
    where: { id },
    data: { tiptapJson: restoredJson },
  });

  return NextResponse.json({ version: newVersion, tiptapJson: version.tiptapJson });
}
